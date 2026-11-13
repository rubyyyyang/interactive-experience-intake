/**
 * Approval Column Index Tests
 * Verifies approveResponse and requestChanges use physical column indices
 * Critical regression test for Guide Extraction JSON column exclusion bug
 */

const assert = require('assert');
const fs = require('fs');

console.log('Running approval column index tests...\n');

const source = fs.readFileSync('IA_StatusTracker.js', 'utf8');

function testApprovalUsesPhysicalHeaders() {
  console.log('Test: approveResponse reads physical Master headers before writes');

  // Should read physical headers directly from masterSheet
  const readsPhysical = /const physicalHeaders = masterSheet\.getRange.*\.getValues/.test(source);
  assert.ok(readsPhysical, 'Should read physical headers from masterSheet');

  // Should create physical index variables
  const hasPhysicalIndices = /const physicalActionStatusIdx/.test(source);
  assert.ok(hasPhysicalIndices, 'Should create physicalActionStatusIdx variable');

  // Should use physical indices for writes, not compacted headerMap indices
  const usesPhysicalForWrite = /masterSheet\.getRange\([^)]+physicalActionStatusIdx \+ 1\)\.setValue/.test(source);
  assert.ok(usesPhysicalForWrite, 'Should use physicalActionStatusIdx for writes');

  // Should NOT use compacted actionStatusIdx for Master writes
  const avoidCompacted = !/masterSheet\.getRange\([^)]+actionStatusIdx \+ 1\)\.setValue(?!.*\/\/ old code)/.test(source);
  assert.ok(avoidCompacted, 'Should NOT use compacted actionStatusIdx for Master writes');

  console.log('  ✓ approveResponse uses physical headers\n');
}

function testRequestChangesUsesPhysicalHeaders() {
  console.log('Test: requestChanges reads physical Master headers before writes');

  // Find requestChanges function
  const requestChangesMatch = source.match(/function requestChanges[\s\S]+?^}/m);
  assert.ok(requestChangesMatch, 'requestChanges function should exist');

  const requestChanges = requestChangesMatch[0];

  // Should read physical headers
  const readsPhysical = /const physicalHeaders = masterSheet\.getRange/.test(requestChanges);
  assert.ok(readsPhysical, 'requestChanges should read physical headers');

  // Should use physical index for Master write
  const usesPhysical = /physicalActionStatusIdx/.test(requestChanges);
  assert.ok(usesPhysical, 'requestChanges should use physicalActionStatusIdx');

  console.log('  ✓ requestChanges uses physical headers\n');
}

function testFailClosedValidation() {
  console.log('Test: Fail-closed validation prevents writes to wrong columns');

  // Should validate Action Status column exists
  const checksExists = /if \(physicalActionStatusIdx < 0\)/.test(source);
  assert.ok(checksExists, 'Should check if Action Status column exists');

  // Should validate header matches expected field
  const checksHeader = /if \(physicalHeaders\[physicalActionStatusIdx\] !== STATUS_TRACKER_COLUMNS\.ACTION_STATUS\)/.test(source);
  assert.ok(checksHeader, 'Should validate header matches expected field name');

  // Should throw error on mismatch
  const throwsError = /throw new Error.*Action Status/.test(source);
  assert.ok(throwsError, 'Should throw error on validation failure');

  console.log('  ✓ Fail-closed validation prevents column mismatch\n');
}

function testRollbackUsesPhysicalIndices() {
  console.log('Test: Rollback uses physical indices');

  // Rollback should use physical indices, not compacted
  const rollbackMatch = source.match(/\/\/ Rollback[\s\S]{0,500}setValue\('Pending review'\)/);
  assert.ok(rollbackMatch, 'Should have rollback logic');

  const rollback = rollbackMatch[0];
  const usesPhysical = /physicalActionStatusIdx/.test(rollback);
  assert.ok(usesPhysical, 'Rollback should use physicalActionStatusIdx');

  console.log('  ✓ Rollback uses physical indices\n');
}

function testPhysicalIndexForAllFields() {
  console.log('Test: Physical indices used for all Master field writes');

  const criticalFields = [
    'physicalActionStatusIdx',
    'physicalCompletedDateIdx',
    'physicalCreationLinkIdx',
    'physicalStatusIdx',
    'physicalRetiredTsIdx'
  ];

  criticalFields.forEach(field => {
    const hasField = new RegExp(`const ${field}`).test(source);
    assert.ok(hasField, `Should define ${field}`);
  });

  console.log('  ✓ All critical fields use physical indices\n');
}

// Run all tests
try {
  testApprovalUsesPhysicalHeaders();
  testRequestChangesUsesPhysicalHeaders();
  testFailClosedValidation();
  testRollbackUsesPhysicalIndices();
  testPhysicalIndexForAllFields();

  console.log('✅ All approval column index tests passed');
} catch (error) {
  console.error('❌ Test failed:', error.message);
  process.exit(1);
}
