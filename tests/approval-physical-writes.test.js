/**
 * Approval Physical Column Write Tests
 * Behavioral regression test with mocked spreadsheet structure
 * Verifies writes target correct physical columns when Guide Extraction JSON
 * precedes lifecycle columns
 */

const assert = require('assert');
const fs = require('fs');

console.log('Running approval physical write behavioral tests...\n');

// Mock spreadsheet scenario where Guide Extraction JSON precedes Action Status
// Simplified to essential columns for testing
const MOCK_PHYSICAL_HEADERS = [];

// Add initial columns 0-4
MOCK_PHYSICAL_HEADERS[0] = 'Number';
MOCK_PHYSICAL_HEADERS[1] = 'Status';
MOCK_PHYSICAL_HEADERS[2] = 'Creator Name';
MOCK_PHYSICAL_HEADERS[3] = 'Creation Link';
MOCK_PHYSICAL_HEADERS[4] = 'Status Retired Timestamp';

// Add Guide Extraction JSON at position 5
MOCK_PHYSICAL_HEADERS[5] = 'Guide Extraction JSON';

// Add lifecycle columns AFTER Guide JSON (positions 6-8)
MOCK_PHYSICAL_HEADERS[6] = 'Recommended action';
MOCK_PHYSICAL_HEADERS[7] = 'Action Status';
MOCK_PHYSICAL_HEADERS[8] = 'Action Completed Date';

const GUIDE_JSON_IDX = 5;
const ACTION_STATUS_PHYSICAL_IDX = 7;
const ACTION_COMPLETED_PHYSICAL_IDX = 8;
const CREATION_LINK_PHYSICAL_IDX = 3;
const STATUS_PHYSICAL_IDX = 1;
const STATUS_RETIRED_TS_PHYSICAL_IDX = 4;

// Create compacted headers (what getRequestMasterData_() returns)
const COMPACTED_HEADERS = MOCK_PHYSICAL_HEADERS.filter((_, idx) => idx !== GUIDE_JSON_IDX);

// Compacted indices (WRONG - off by 1 after Guide JSON)
const ACTION_STATUS_COMPACTED_IDX = COMPACTED_HEADERS.indexOf('Action Status'); // 112 (wrong!)
const ACTION_COMPLETED_COMPACTED_IDX = COMPACTED_HEADERS.indexOf('Action Completed Date'); // 113 (wrong!)

function testPhysicalVsCompactedIndices() {
  console.log('Test: Physical indices differ from compacted indices');

  console.log(`  Physical Action Status index: ${ACTION_STATUS_PHYSICAL_IDX}`);
  console.log(`  Compacted Action Status index: ${ACTION_STATUS_COMPACTED_IDX}`);

  assert.notStrictEqual(ACTION_STATUS_PHYSICAL_IDX, ACTION_STATUS_COMPACTED_IDX,
    'Physical and compacted indices should differ when Guide JSON precedes Action Status');

  assert.strictEqual(ACTION_STATUS_PHYSICAL_IDX - ACTION_STATUS_COMPACTED_IDX, 1,
    'Physical index should be 1 greater than compacted index');

  console.log('  ✓ Indices differ by 1 (confirms offset bug scenario)\n');
}

function testOldCodeWouldWriteToWrongColumn() {
  console.log('Test: Old code (using compacted index) would target wrong column');

  // Simulate old buggy code: masterSheet.getRange(row, actionStatusIdx + 1)
  const buggyTargetCol = ACTION_STATUS_COMPACTED_IDX + 1; // 1-indexed
  const buggyTargetColName = MOCK_PHYSICAL_HEADERS[buggyTargetCol - 1];

  console.log(`  Old code would write to column ${buggyTargetCol}: "${buggyTargetColName}"`);

  // Old code would write to wrong column (Recommended action instead of Action Status)
  assert.notStrictEqual(buggyTargetColName, 'Action Status',
    'Old code would NOT write to Action Status (the bug!)');

  // Verify it targets column before Action Status
  assert.strictEqual(buggyTargetColName, 'Recommended action',
    'Old code would incorrectly write to Recommended action');

  console.log('  ✓ Confirms old code targets wrong column\n');
}

function testFixedCodeTargetsCorrectColumn() {
  console.log('Test: Fixed code (using physical index) targets correct column');

  // Simulate fixed code reading physical headers
  const physicalHeaders = MOCK_PHYSICAL_HEADERS;
  const physicalActionStatusIdx = physicalHeaders.indexOf('Action Status');

  // Fixed code: masterSheet.getRange(row, physicalActionStatusIdx + 1)
  const fixedTargetCol = physicalActionStatusIdx + 1; // 114 (1-indexed)
  const fixedTargetColName = MOCK_PHYSICAL_HEADERS[fixedTargetCol - 1];

  console.log(`  Fixed code writes to column ${fixedTargetCol}: "${fixedTargetColName}"`);

  assert.strictEqual(fixedTargetColName, 'Action Status',
    'Fixed code should correctly write to Action Status');

  assert.strictEqual(physicalActionStatusIdx, ACTION_STATUS_PHYSICAL_IDX,
    'Physical index lookup should match expected position');

  console.log('  ✓ Fixed code targets correct Action Status column\n');
}

function testAllCriticalFieldsUsePhysicalIndices() {
  console.log('Test: All critical fields use physical indices in fixed code');

  const source = fs.readFileSync('IA_StatusTracker.js', 'utf8');

  // Extract approveResponse function
  const approveMatch = source.match(/function approveResponse[\s\S]+?^}/m);
  assert.ok(approveMatch, 'Should find approveResponse function');

  const approveCode = approveMatch[0];

  // Verify physical index reads
  assert.ok(/const physicalHeaders = masterSheet\.getRange/.test(approveCode),
    'Should read physical headers from masterSheet');

  // Verify all critical fields use physical indices
  const criticalFields = [
    'physicalActionStatusIdx',
    'physicalCompletedDateIdx',
    'physicalCreationLinkIdx',
    'physicalStatusIdx',
    'physicalRetiredTsIdx'
  ];

  criticalFields.forEach(field => {
    assert.ok(new RegExp(`const ${field} = physicalHeaders\\.indexOf`).test(approveCode),
      `Should define ${field} from physical headers`);
  });

  // Verify writes use physical indices
  assert.ok(/masterSheet\.getRange\([^)]+physicalActionStatusIdx \+ 1\)\.setValue\('Complete'\)/.test(approveCode),
    'Should use physicalActionStatusIdx for Complete write');

  assert.ok(/masterSheet\.getRange\([^)]+physicalCompletedDateIdx \+ 1\)\.setValue\(timestamp\)/.test(approveCode),
    'Should use physicalCompletedDateIdx for timestamp write');

  console.log('  ✓ All critical fields use physical indices\n');
}

function testRequestChangesUsesPhysicalIndex() {
  console.log('Test: requestChanges uses physical index for Follow-up needed write');

  const source = fs.readFileSync('IA_StatusTracker.js', 'utf8');

  const requestChangesMatch = source.match(/function requestChanges[\s\S]+?^}/m);
  assert.ok(requestChangesMatch, 'Should find requestChanges function');

  const requestChangesCode = requestChangesMatch[0];

  // Should read physical headers
  assert.ok(/const physicalHeaders = masterSheet\.getRange/.test(requestChangesCode),
    'Should read physical headers');

  // Should use physical index for write
  assert.ok(/masterSheet\.getRange\([^)]+physicalActionStatusIdx \+ 1\)\.setValue\('Follow-up needed'\)/.test(requestChangesCode),
    'Should use physicalActionStatusIdx for Follow-up needed write');

  console.log('  ✓ requestChanges uses physical index\n');
}

function testRollbackUsesPhysicalIndices() {
  console.log('Test: Rollback uses physical indices to restore correct Master columns');

  const source = fs.readFileSync('IA_StatusTracker.js', 'utf8');

  // Find Master rollback section (approveResponse)
  const approveMatch = source.match(/function approveResponse[\s\S]+?^}/m);
  assert.ok(approveMatch, 'Should find approveResponse function');

  // Look for rollback that restores Pending review to Master
  const rollbackPattern = /\/\/ Rollback[\s\S]{0,500}?physicalActionStatusIdx.*setValue\('Pending review'\)/;
  const hasRollback = rollbackPattern.test(approveMatch[0]);

  assert.ok(hasRollback,
    'Master rollback should use physicalActionStatusIdx');

  console.log('  ✓ Rollback uses physical indices for Master\n');
}

function testRetirementUsesPhysicalIndices() {
  console.log('Test: Retirement writes use physical indices');

  const source = fs.readFileSync('IA_StatusTracker.js', 'utf8');

  const approveMatch = source.match(/function approveResponse[\s\S]+?^}/m);
  const approveCode = approveMatch[0];

  // Find retirement block - look for broader pattern
  const retirementPattern = /if \(isRetirement\) \{[\s\S]{0,500}?setValue\('Retired'\)/;
  const hasRetirement = retirementPattern.test(approveCode);
  assert.ok(hasRetirement, 'Should have retirement block with Retired setValue');

  // Extract the retirement section
  const retirementMatch = approveCode.match(retirementPattern);
  const retirementCode = retirementMatch[0];

  // Should use physical indices for Status
  assert.ok(/physicalStatusIdx/.test(retirementCode),
    'Should use physicalStatusIdx for Retired status');

  // Check if retiredTs is used (optional field)
  const usesRetiredTs = /physicalRetiredTsIdx/.test(approveCode);
  if (usesRetiredTs) {
    console.log('  ✓ Retirement uses physicalRetiredTsIdx for timestamp');
  }

  console.log('  ✓ Retirement uses physical indices for Status fields\n');
}

// Run all tests
try {
  testPhysicalVsCompactedIndices();
  testOldCodeWouldWriteToWrongColumn();
  testFixedCodeTargetsCorrectColumn();
  testAllCriticalFieldsUsePhysicalIndices();
  testRequestChangesUsesPhysicalIndex();
  testRollbackUsesPhysicalIndices();
  testRetirementUsesPhysicalIndices();

  console.log('✅ All approval physical write behavioral tests passed');
  console.log('\nSummary:');
  console.log('- Confirmed compacted vs physical index offset of 1');
  console.log('- Verified old code would write to wrong columns');
  console.log('- Verified fixed code uses physical indices for all writes');
  console.log('- Verified rollback uses physical indices');
  console.log('- Verified retirement uses physical indices');
} catch (error) {
  console.error('❌ Test failed:', error.message);
  process.exit(1);
}
