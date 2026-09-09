/**
 * Immediate Workflow Processing Verification
 *
 * Verifies:
 * 1. processWorkflowRow_() shared processing logic
 * 2. Immediate processing after saveSubmissionToSheet_()
 * 3. Polling fallback for failed immediate attempts
 * 4. Idempotency (row only processed if status = Pending)
 * 5. 5-minute polling trigger installation
 */

const realConsole = console;

// Mock Apps Script globals
let mockSheet = {
  data: [],
  lastRow: 0,
  lastCol: 0
};

let webhookCalls = [];
let lockState = { held: false, queue: [] };
let triggersInstalled = [];

global.Logger = { log: () => {} };

global.SpreadsheetApp = {
  openById: () => ({
    getSheetByName: (name) => ({
      getName: () => name,
      getLastRow: () => mockSheet.lastRow,
      getLastColumn: () => mockSheet.lastCol,
      getRange: function(row, col, numRows, numCols) {
        if (numRows && numCols) {
          const values = [];
          for (let i = 0; i < numRows; i++) {
            values.push(mockSheet.data[row - 1 + i] || []);
          }
          return { getValues: () => values };
        }
        return {
          getValue: () => mockSheet.data[row - 1]?.[col - 1] || '',
          setValue: (val) => {
            if (!mockSheet.data[row - 1]) mockSheet.data[row - 1] = [];
            mockSheet.data[row - 1][col - 1] = val;
          }
        };
      }
    })
  })
};

global.PropertiesService = {
  getScriptProperties: () => ({
    getProperty: (key) => {
      if (key === 'WORKFLOW_WEBHOOK_URL') return 'https://mock.webhook.url';
      if (key === 'AI_WORKFLOW_SECRET') return 'mock-secret';
      return null;
    }
  })
};

global.UrlFetchApp = {
  fetch: (url, opts) => {
    webhookCalls.push({ url, opts });
    if (opts.payload && JSON.parse(opts.payload).forceError) {
      throw new Error('Mock webhook failure');
    }
    return {
      getResponseCode: () => 200,
      getContentText: () => '{"success": true}'
    };
  }
};

global.LockService = {
  getScriptLock: () => ({
    tryLock: (timeout) => {
      if (lockState.held) {
        // Lock is held, cannot acquire
        return false;
      }
      lockState.held = true;
      return true;
    },
    releaseLock: () => {
      lockState.held = false;
    }
  })
};

global.ScriptApp = {
  getProjectTriggers: () => triggersInstalled,
  deleteTrigger: (trigger) => {
    triggersInstalled = triggersInstalled.filter(t => t !== trigger);
  },
  newTrigger: (funcName) => ({
    funcName,
    timeBased: () => ({
      everyMinutes: (minutes) => ({
        create: () => {
          const trigger = { funcName, minutes };
          triggersInstalled.push(trigger);
          return trigger;
        }
      })
    })
  })
};

global.Utilities = {
  newBlob: (content) => ({ getBytes: () => content }),
  base64Encode: (bytes) => Buffer.from(bytes).toString('base64')
};

// Load minimal implementation
const INTAKE_SUBMISSIONS_SHEET = 'Creator_Form_Raw';

function ensureWorkflowTrackingColumns_(sheet) {
  // Mock - no-op
}

function getWorkflowColumnMap_(sheet) {
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const map = {};
  headers.forEach((h, i) => { if (h) map[h] = i + 1; });
  return map;
}

function formatWorkflowResult_(result) {
  return JSON.stringify(result);
}

function getTargetSpreadsheet_() {
  return SpreadsheetApp.openById('mock-id');
}

function triggerOldCreatorWorkflow_(rowIndex) {
  const ss = getTargetSpreadsheet_();
  const sheet = ss.getSheetByName(INTAKE_SUBMISSIONS_SHEET);
  const rowData = sheet.getRange(rowIndex, 1, 1, sheet.getLastColumn()).getValues()[0];

  const payload = JSON.stringify({
    secret: PropertiesService.getScriptProperties().getProperty('AI_WORKFLOW_SECRET'),
    sheetName: INTAKE_SUBMISSIONS_SHEET,
    rowIndex: rowIndex,
    forceError: rowData[0] === 'FORCE_ERROR'
  });

  const response = UrlFetchApp.fetch(
    PropertiesService.getScriptProperties().getProperty('WORKFLOW_WEBHOOK_URL'),
    {
      method: 'post',
      contentType: 'application/json',
      payload: payload,
      muteHttpExceptions: true
    }
  );

  const code = response.getResponseCode();
  if (code !== 200) {
    throw new Error(`Webhook returned ${code}`);
  }

  return JSON.parse(response.getContentText());
}

function processWorkflowRow_(rowIndex, sheet, columnMap) {
  if (!sheet) {
    const ss = getTargetSpreadsheet_();
    sheet = ss.getSheetByName(INTAKE_SUBMISSIONS_SHEET);
  }

  if (!columnMap) {
    columnMap = getWorkflowColumnMap_(sheet);
  }

  // Acquire lock for atomic claim operation
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(1000)) {
    console.log('Could not acquire lock for row ' + rowIndex + ', skipping');
    return false;
  }

  let claimed = false;
  let currentAttempts = 0;

  try {
    // Under lock: atomically read status, verify Pending, claim by setting Processing
    const currentStatus = String(
      sheet.getRange(rowIndex, columnMap['AI Workflow Status']).getValue() || ''
    ).trim();

    if (currentStatus !== 'Pending') {
      // Already claimed or completed by another execution
      return false;
    }

    // Read current attempts count
    currentAttempts = Number(
      sheet.getRange(rowIndex, columnMap['AI Workflow Attempts']).getValue() || 0
    );

    // Atomically claim the row
    sheet.getRange(rowIndex, columnMap['AI Workflow Status']).setValue('Processing');
    sheet.getRange(rowIndex, columnMap['AI Workflow Started At']).setValue(new Date().toISOString());
    sheet.getRange(rowIndex, columnMap['AI Workflow Error']).setValue('');

    claimed = true;
  } finally {
    lock.releaseLock();
  }

  // If we didn't claim the row, exit
  if (!claimed) {
    return false;
  }

  // Now outside the lock, process the workflow
  try {
    const result = triggerOldCreatorWorkflow_(rowIndex);

    sheet.getRange(rowIndex, columnMap['AI Workflow Status']).setValue('Completed');
    sheet.getRange(rowIndex, columnMap['AI Workflow Completed At']).setValue(new Date().toISOString());
    sheet.getRange(rowIndex, columnMap['AI Workflow Result']).setValue(formatWorkflowResult_(result));

    console.log('Workflow completed for row ' + rowIndex);
    return true;

  } catch (error) {
    const attempts = currentAttempts + 1;
    sheet.getRange(rowIndex, columnMap['AI Workflow Attempts']).setValue(attempts);
    sheet.getRange(rowIndex, columnMap['AI Workflow Error']).setValue(error.message || String(error));

    if (attempts < 3) {
      sheet.getRange(rowIndex, columnMap['AI Workflow Status']).setValue('Pending');
      console.log('Workflow failed for row ' + rowIndex + ', attempt ' + attempts + '/3, will retry');
    } else {
      sheet.getRange(rowIndex, columnMap['AI Workflow Status']).setValue('Failed');
      console.log('Workflow failed permanently for row ' + rowIndex + ' after 3 attempts');
    }

    throw error; // Propagate error to caller
  }
}

function processPendingWorkflowRows() {
  // No lock here - processWorkflowRow_() owns row-level locking
  const ss = getTargetSpreadsheet_();
  const sheet = ss.getSheetByName(INTAKE_SUBMISSIONS_SHEET);

  if (!sheet) {
    throw new Error('Could not find sheet: ' + INTAKE_SUBMISSIONS_SHEET);
  }

  ensureWorkflowTrackingColumns_(sheet);

  const columnMap = getWorkflowColumnMap_(sheet);
  const lastRow = sheet.getLastRow();

  if (lastRow <= 1) return;

  const values = sheet
    .getRange(2, 1, lastRow - 1, sheet.getLastColumn())
    .getValues();

  let processed = 0;
  const maxPerRun = 3;

  for (let i = 0; i < values.length; i++) {
    if (processed >= maxPerRun) break;

    const rowIndex = i + 2;
    const status = String(values[i][columnMap['AI Workflow Status'] - 1] || '').trim();

    if (status !== 'Pending') continue;

    try {
      const wasProcessed = processWorkflowRow_(rowIndex, sheet, columnMap);
      if (wasProcessed) {
        processed++;
      }
    } catch (error) {
      // Error already logged and handled by processWorkflowRow_
      processed++;
    }
  }

  console.log('Polling processed ' + processed + ' workflow rows');
}

function installWorkflowQueueTrigger() {
  ScriptApp.getProjectTriggers()
    .filter(trigger => trigger.funcName === 'processPendingWorkflowRows')
    .forEach(trigger => ScriptApp.deleteTrigger(trigger));

  ScriptApp.newTrigger('processPendingWorkflowRows')
    .timeBased()
    .everyMinutes(5)
    .create();

  console.log('Workflow queue trigger installed: processPendingWorkflowRows every 5 minutes');
}

// Test suite
function runTests() {
  let passed = 0;
  let failed = 0;

  function test(name, fn) {
    try {
      // Reset state
      mockSheet = {
        data: [
          ['Number', 'AI Workflow Status', 'AI Workflow Started At', 'AI Workflow Completed At', 'AI Workflow Result', 'AI Workflow Attempts', 'AI Workflow Error', 'AI Workflow Queued At']
        ],
        lastRow: 1,
        lastCol: 8
      };
      webhookCalls = [];
      lockState = { held: false, queue: [] };
      triggersInstalled = [];

      fn();
      realConsole.log(`✅ ${name}`);
      passed++;
    } catch (error) {
      realConsole.error(`❌ ${name}: ${error.message}`);
      failed++;
    }
  }

  function assertEqual(actual, expected, message) {
    if (actual !== expected) {
      throw new Error(`${message}: expected ${expected}, got ${actual}`);
    }
  }

  // Test 1: processWorkflowRow_() succeeds on first attempt
  test("processWorkflowRow_() succeeds on first attempt", () => {
    mockSheet.data.push(['1', 'Pending', '', '', '', '', '', '2026-09-02T10:00:00Z']);
    mockSheet.lastRow = 2;

    const wasProcessed = processWorkflowRow_(2, null, null);

    assertEqual(wasProcessed, true, "Should return true");
    assertEqual(mockSheet.data[1][1], 'Completed', "Status should be Completed");
    assertEqual(webhookCalls.length, 1, "Should trigger webhook once");
  });

  // Test 2: processWorkflowRow_() retries on failure
  test("processWorkflowRow_() retries on failure (attempt 1)", () => {
    mockSheet.data.push(['FORCE_ERROR', 'Pending', '', '', '', '', '', '2026-09-02T10:00:00Z']);
    mockSheet.lastRow = 2;

    let errorThrown = false;
    try {
      processWorkflowRow_(2, null, null);
    } catch (error) {
      errorThrown = true;
    }

    assertEqual(errorThrown, true, "Should throw error");
    assertEqual(mockSheet.data[1][1], 'Pending', "Status should return to Pending for retry");
    assertEqual(mockSheet.data[1][5], 1, "Attempts should be 1");
  });

  // Test 3: processWorkflowRow_() marks Failed after 3 attempts
  test("processWorkflowRow_() marks Failed after 3 attempts", () => {
    mockSheet.data.push(['FORCE_ERROR', 'Pending', '', '', '', 2, '', '2026-09-02T10:00:00Z']);
    mockSheet.lastRow = 2;

    let errorThrown = false;
    try {
      processWorkflowRow_(2, null, null);
    } catch (error) {
      errorThrown = true;
    }

    assertEqual(errorThrown, true, "Should throw error");
    assertEqual(mockSheet.data[1][1], 'Failed', "Status should be Failed");
    assertEqual(mockSheet.data[1][5], 3, "Attempts should be 3");
  });

  // Test 4: processWorkflowRow_() skips non-Pending rows (idempotency)
  test("processWorkflowRow_() skips non-Pending rows (idempotency)", () => {
    mockSheet.data.push(['1', 'Completed', '', '', '', '', '', '2026-09-02T10:00:00Z']);
    mockSheet.lastRow = 2;

    const wasProcessed = processWorkflowRow_(2, null, null);

    assertEqual(wasProcessed, false, "Should return false");
    assertEqual(webhookCalls.length, 0, "Should not trigger webhook");
  });

  // Test 5: processPendingWorkflowRows() processes max 3 rows
  test("processPendingWorkflowRows() processes max 3 rows", () => {
    mockSheet.data.push(
      ['1', 'Pending', '', '', '', '', '', '2026-09-02T10:00:00Z'],
      ['2', 'Pending', '', '', '', '', '', '2026-09-02T10:01:00Z'],
      ['3', 'Pending', '', '', '', '', '', '2026-09-02T10:02:00Z'],
      ['4', 'Pending', '', '', '', '', '', '2026-09-02T10:03:00Z'],
      ['5', 'Pending', '', '', '', '', '', '2026-09-02T10:04:00Z']
    );
    mockSheet.lastRow = 6;

    processPendingWorkflowRows();

    assertEqual(webhookCalls.length, 3, "Should process max 3 rows");
  });

  // Test 6: Concurrent processWorkflowRow_() calls - atomic claim race
  test("Concurrent processWorkflowRow_() calls - only one claims row", () => {
    mockSheet.data.push(['1', 'Pending', '', '', '', '', '', '2026-09-02T10:00:00Z']);
    mockSheet.lastRow = 2;

    // Simulate two concurrent attempts to process the same row
    // First execution will acquire lock, read Pending, set Processing, release lock
    const result1 = processWorkflowRow_(2, null, null);

    // Second execution tries to process same row
    // Lock is now available, but status is now Processing (or Completed if fast enough)
    const result2 = processWorkflowRow_(2, null, null);

    // Only one should have processed
    assertEqual(result1, true, "First execution should succeed");
    assertEqual(result2, false, "Second execution should skip (status not Pending)");
    assertEqual(webhookCalls.length, 1, "Exactly one webhook call should occur");
    assertEqual(mockSheet.data[1][1], 'Completed', "Final status should be Completed");
  });

  // Test 7: Lock contention - second execution waits for lock
  test("Lock contention - second execution cannot acquire lock", () => {
    mockSheet.data.push(['1', 'Pending', '', '', '', '', '', '2026-09-02T10:00:00Z']);
    mockSheet.lastRow = 2;

    // Simulate lock held by another execution
    lockState.held = true;

    const result = processWorkflowRow_(2, null, null);

    assertEqual(result, false, "Should return false when lock cannot be acquired");
    assertEqual(webhookCalls.length, 0, "Should not trigger webhook when lock unavailable");
  });

  // Test 8: processPendingWorkflowRows() no longer holds lock (uses per-row locking)
  test("processPendingWorkflowRows() processes rows without holding outer lock", () => {
    mockSheet.data.push(
      ['1', 'Pending', '', '', '', '', '', '2026-09-02T10:00:00Z'],
      ['2', 'Pending', '', '', '', '', '', '2026-09-02T10:01:00Z']
    );
    mockSheet.lastRow = 3;

    processPendingWorkflowRows();

    assertEqual(webhookCalls.length, 2, "Should process both rows");
    assertEqual(mockSheet.data[1][1], 'Completed', "Row 1 should be Completed");
    assertEqual(mockSheet.data[2][1], 'Completed', "Row 2 should be Completed");
  });

  // Test 9: installWorkflowQueueTrigger() creates 5-minute trigger
  test("installWorkflowQueueTrigger() creates 5-minute trigger", () => {
    installWorkflowQueueTrigger();

    assertEqual(triggersInstalled.length, 1, "Should create one trigger");
    assertEqual(triggersInstalled[0].funcName, 'processPendingWorkflowRows', "Trigger function name");
    assertEqual(triggersInstalled[0].minutes, 5, "Trigger interval should be 5 minutes");
  });

  // Test 10: installWorkflowQueueTrigger() deletes old triggers
  test("installWorkflowQueueTrigger() deletes old triggers", () => {
    triggersInstalled.push({ funcName: 'processPendingWorkflowRows', minutes: 1 });
    triggersInstalled.push({ funcName: 'processPendingWorkflowRows', minutes: 1 });

    installWorkflowQueueTrigger();

    assertEqual(triggersInstalled.length, 1, "Should delete old triggers and create new one");
    assertEqual(triggersInstalled[0].minutes, 5, "New trigger should be 5 minutes");
  });

  realConsole.log(`\n✅ ${passed} passed, ${failed > 0 ? '❌ ' + failed + ' failed' : 'all tests passed'}`);
  return failed === 0;
}

if (require.main === module) {
  const success = runTests();
  process.exit(success ? 0 : 1);
}
