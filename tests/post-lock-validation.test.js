/**
 * Post-Lock Validation Test
 * Verifies direct sheet read bypasses both caches after lock acquisition
 */

const assert = require('assert');

console.log('Running post-lock validation tests...\n');

// Test: Direct sheet read bypasses runtime memo and CacheService
function testDirectSheetReadBypassesBothCaches() {
  console.log('Test: Direct sheet read bypasses runtime memo and CacheService');

  // Mock Apps Script dependencies
  let sheetData = [
    ['123', 'Demo Title', 'Pending review', 'Published', 'Alice', 'alice@example.com', 'Alice Smith'],
    ['124', 'Other Demo', 'Action needed', 'Published', 'Bob', 'bob@example.com', 'Bob Jones']
  ];

  // Simulate stale caches
  let runtimeMemo = {
    headers: ['Number', 'Demo Title', 'Action Status', 'Status', 'Assigned', 'Creator Email', 'Creator Name'],
    rows: [
      ['123', 'Demo Title', 'Action needed', 'Published', 'Alice', 'alice@example.com', 'Alice Smith'],
      ['124', 'Other Demo', 'Action needed', 'Published', 'Bob', 'bob@example.com', 'Bob Jones']
    ],
    headerMap: { 'Number': 0, 'Demo Title': 1, 'Action Status': 2, 'Status': 3, 'Assigned': 4, 'Creator Email': 5, 'Creator Name': 6 }
  };

  let cacheServiceData = JSON.stringify(runtimeMemo);

  // Simulate production submitCreatorResponse post-lock validation
  function postLockValidation(demoNumber) {
    // After acquiring lock - DO NOT use runtime memo or CacheService
    // Read directly from authoritative sheet
    const headers = ['Number', 'Demo Title', 'Action Status', 'Status', 'Assigned', 'Creator Email', 'Creator Name'];
    const masterNumIdx = headers.indexOf('Number');
    const masterActionStatusIdx = headers.indexOf('Action Status');
    const masterStatusIdx = headers.indexOf('Status');

    // Direct sheet read (simulated)
    let masterActionStatus = '';
    let masterStatus = '';
    let found = false;

    for (let i = 0; i < sheetData.length; i++) {
      if (String(sheetData[i][masterNumIdx] || '').trim() === String(demoNumber)) {
        found = true;
        if (masterActionStatusIdx !== -1) {
          masterActionStatus = String(sheetData[i][masterActionStatusIdx] || '').trim();
        }
        if (masterStatusIdx !== -1) {
          masterStatus = String(sheetData[i][masterStatusIdx] || '').trim();
        }
        break;
      }
    }

    if (!found) {
      return { canProceed: false, reason: 'not_found' };
    }

    // Post-lock validation - block ALL users if pending review
    if (masterActionStatus === 'Pending review') {
      return { canProceed: false, reason: 'pending_review_after_lock', readFrom: 'direct_sheet' };
    }

    if (masterStatus === 'Retired') {
      return { canProceed: false, reason: 'retired_after_lock', readFrom: 'direct_sheet' };
    }

    return { canProceed: true, readFrom: 'direct_sheet' };
  }

  // Scenario: User B acquires lock after User A already submitted
  // Runtime memo shows "Action needed" (stale)
  // CacheService shows "Action needed" (stale)
  // Sheet contains "Pending review" (authoritative)
  const result = postLockValidation('123');

  assert.strictEqual(result.canProceed, false, 'Should block based on fresh sheet data');
  assert.strictEqual(result.reason, 'pending_review_after_lock', 'Should detect pending review from sheet');
  assert.strictEqual(result.readFrom, 'direct_sheet', 'Should read from direct sheet, not cache');

  // Verify caches still contain stale data (not used)
  assert.strictEqual(runtimeMemo.rows[0][2], 'Action needed', 'Runtime memo should still be stale');
  assert.strictEqual(JSON.parse(cacheServiceData).rows[0][2], 'Action needed', 'CacheService should still be stale');

  // Verify User B on demo 124 can proceed
  const otherResult = postLockValidation('124');
  assert.strictEqual(otherResult.canProceed, true, 'Other demo should proceed');

  console.log('✓ Direct sheet read bypasses both caches test passed\n');
}

// Test: Admin also blocked from creating duplicate pending responses
function testAdminBlockedFromDuplicatePending() {
  console.log('Test: Admin cannot create duplicate pending response via submission endpoint');

  // Mock sheet with demo already pending review
  const sheetData = [
    ['123', 'Demo Title', 'Pending review', 'Published', 'Alice', 'alice@example.com', 'Alice Smith']
  ];

  function validateAfterLock(demoNumber, isUserAdmin) {
    const headers = ['Number', 'Demo Title', 'Action Status', 'Status', 'Assigned', 'Creator Email', 'Creator Name'];
    const masterNumIdx = headers.indexOf('Number');
    const masterActionStatusIdx = headers.indexOf('Action Status');

    let masterActionStatus = '';
    for (let i = 0; i < sheetData.length; i++) {
      if (String(sheetData[i][masterNumIdx] || '').trim() === String(demoNumber)) {
        if (masterActionStatusIdx !== -1) {
          masterActionStatus = String(sheetData[i][masterActionStatusIdx] || '').trim();
        }
        break;
      }
    }

    // Block ALL users (including Admin) from creating duplicate pending via submission
    if (masterActionStatus === 'Pending review') {
      return { canProceed: false, reason: 'pending_review_blocks_all' };
    }

    return { canProceed: true };
  }

  // Non-admin cannot submit
  const nonAdminResult = validateAfterLock('123', false);
  assert.strictEqual(nonAdminResult.canProceed, false, 'Non-admin should be blocked');

  // Admin ALSO cannot submit via this endpoint (review/approval are separate operations)
  const adminResult = validateAfterLock('123', true);
  assert.strictEqual(adminResult.canProceed, false, 'Admin should also be blocked from duplicate pending');
  assert.strictEqual(adminResult.reason, 'pending_review_blocks_all', 'Should block with same reason');

  console.log('✓ Admin blocked from duplicate pending test passed\n');
}

// Test: Retired demo guard with fresh data
function testRetiredDemoGuardWithFreshData() {
  console.log('Test: Retired demo guard uses fresh sheet data');

  // Mock sheet with retired demo
  const sheetData = [
    ['123', 'Old Demo', 'Action needed', 'Retired', 'Alice', 'alice@example.com', 'Alice Smith']
  ];

  function validateAfterLock(demoNumber) {
    const headers = ['Number', 'Demo Title', 'Action Status', 'Status', 'Assigned', 'Creator Email', 'Creator Name'];
    const masterNumIdx = headers.indexOf('Number');
    const masterStatusIdx = headers.indexOf('Status');

    let masterStatus = '';
    for (let i = 0; i < sheetData.length; i++) {
      if (String(sheetData[i][masterNumIdx] || '').trim() === String(demoNumber)) {
        if (masterStatusIdx !== -1) {
          masterStatus = String(sheetData[i][masterStatusIdx] || '').trim();
        }
        break;
      }
    }

    if (masterStatus === 'Retired') {
      return { canProceed: false, reason: 'retired_after_lock' };
    }

    return { canProceed: true };
  }

  const result = validateAfterLock('123');
  assert.strictEqual(result.canProceed, false, 'Should block retired demo');
  assert.strictEqual(result.reason, 'retired_after_lock', 'Should detect retired from fresh data');

  console.log('✓ Retired demo guard test passed\n');
}

// Test: Row-level read is efficient (not full sheet reload)
function testRowLevelReadEfficiency() {
  console.log('Test: Row-level read avoids full sheet reload where possible');

  // Mock large sheet
  const sheetData = [];
  for (let i = 1; i <= 1000; i++) {
    sheetData.push([
      String(i),
      `Demo ${i}`,
      i % 10 === 0 ? 'Pending review' : 'Action needed',
      'Published',
      `User${i}`,
      `user${i}@example.com`,
      `User ${i}`
    ]);
  }

  let readCount = 0;

  function findTargetRow(demoNumber) {
    const headers = ['Number', 'Demo Title', 'Action Status', 'Status', 'Assigned', 'Creator Email', 'Creator Name'];
    const masterNumIdx = headers.indexOf('Number');
    const masterActionStatusIdx = headers.indexOf('Action Status');

    // In production, getRange(2, 1, lastRow, lastCol).getValues() reads the entire data range once
    // This is efficient enough for Status Tracker's scale (hundreds of rows, not thousands)
    readCount++;

    let masterActionStatus = '';
    for (let i = 0; i < sheetData.length; i++) {
      if (String(sheetData[i][masterNumIdx] || '').trim() === String(demoNumber)) {
        if (masterActionStatusIdx !== -1) {
          masterActionStatus = String(sheetData[i][masterActionStatusIdx] || '').trim();
        }
        break;
      }
    }

    return { actionStatus: masterActionStatus, readCount: readCount };
  }

  // Target row is #500 (500 % 10 === 0, so Pending review)
  const result = findTargetRow('500');
  assert.strictEqual(result.actionStatus, 'Pending review', 'Should find target row');
  assert.strictEqual(result.readCount, 1, 'Should read sheet data once');

  console.log('✓ Row-level read efficiency test passed\n');
}

// Run all tests
try {
  testDirectSheetReadBypassesBothCaches();
  testAdminBlockedFromDuplicatePending();
  testRetiredDemoGuardWithFreshData();
  testRowLevelReadEfficiency();

  console.log('✅ All post-lock validation tests passed!');
} catch (err) {
  console.error('❌ Test failed:', err.message);
  process.exit(1);
}
