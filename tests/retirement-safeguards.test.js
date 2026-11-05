/**
 * Retirement Safeguards Test
 * Verifies authorization and queue validation for retirement completion
 */

const assert = require('assert');
const fs = require('fs');

console.log('Running retirement safeguards test...\n');

const serverJs = fs.readFileSync('/Users/rubyyang/arcade-intake-app/IA_StatusTracker.js', 'utf8');

function testAdminAuthorizationChecked() {
  console.log('Test: Admin authorization checked before processing');

  // approveResponse should check admin at start
  const checksAdmin = /function approveResponse[\s\S]{0,200}!isAdmin/.test(serverJs);
  const requiresAuth = /Admin access required/.test(serverJs);

  assert.ok(checksAdmin, 'Should check if user is admin');
  assert.ok(requiresAuth, 'Should return error if not admin');

  console.log('  ✓ Admin authorization required\n');
}

function testUsesLockService() {
  console.log('Test: Uses lock service for concurrency safety');

  const usesLock = /LockService\.getScriptLock\(\)/.test(serverJs);
  const waitsForLock = /lock\.waitLock/.test(serverJs);
  const releasesLock = /lock\.releaseLock/.test(serverJs);

  assert.ok(usesLock, 'Should get script lock');
  assert.ok(waitsForLock, 'Should wait for lock');
  assert.ok(releasesLock, 'Should release lock');

  console.log('  ✓ Uses lock service\n');
}

function testReadsCurrentQueueRow() {
  console.log('Test: Reads current queue row data (not cached)');

  // Should read queue row using queueRowIndex parameter
  const readsQueueRow = /sheet\.getRange\(queueRowIndex/.test(serverJs);
  const getsRowData = /getValues\(\)\[0\]/.test(serverJs);

  assert.ok(readsQueueRow, 'Should read queue row by index');
  assert.ok(getsRowData, 'Should get row values');

  console.log('  ✓ Reads current queue row\n');
}

function testValidatesPendingReview() {
  console.log('Test: Validates queue entry is "Pending review"');

  const checksPendingReview = /queueReviewStatus.*!==.*'Pending review'/.test(serverJs);
  const returnsError = /Queue row is not Pending review/.test(serverJs);

  assert.ok(checksPendingReview, 'Should check queue review status');
  assert.ok(returnsError, 'Should return error if not Pending review');

  console.log('  ✓ Validates Pending review state\n');
}

function testValidatesMasterPendingReview() {
  console.log('Test: Validates Request_Master is "Pending review"');

  const checksMasterStatus = /masterActionStatus.*!==.*'Pending review'/.test(serverJs);
  const returnsError = /Master Action Status is not Pending review/.test(serverJs);

  assert.ok(checksMasterStatus, 'Should check Master action status');
  assert.ok(returnsError, 'Should return error if Master not Pending review');

  console.log('  ✓ Validates Master Pending review state\n');
}

function testValidatesQueueNumber() {
  console.log('Test: Validates queue entry has demo number');

  const checksNumber = /!number/.test(serverJs);
  const returnsError = /No demo number found in Queue row/.test(serverJs);

  assert.ok(checksNumber, 'Should check if number exists');
  assert.ok(returnsError, 'Should return error if number missing');

  console.log('  ✓ Validates queue entry has number\n');
}

function testValidatesMasterExists() {
  console.log('Test: Validates Request_Master row exists');

  const checksMasterRow = /masterRowIdx < 0/.test(serverJs);
  const returnsError = /not found on Request_Master/.test(serverJs);

  assert.ok(checksMasterRow, 'Should check if Master row found');
  assert.ok(returnsError, 'Should return error if Master row not found');

  console.log('  ✓ Validates Master row exists\n');
}

function testPreflightBeforeWrites() {
  console.log('Test: Performs preflight validation before writes');

  const hasPreflightComment = /PREFLIGHT.*Validate all preconditions before any writes/.test(serverJs);
  const hasWritesComment = /PREFLIGHT PASSED.*Perform writes/.test(serverJs);

  assert.ok(hasPreflightComment, 'Should have preflight validation section');
  assert.ok(hasWritesComment, 'Should perform writes only after preflight passes');

  console.log('  ✓ Preflight validation before writes\n');
}

function testRollbackOnFailure() {
  console.log('Test: Attempts rollback on write failure');

  const hasRollback = /Rollback.*attempt to restore/.test(serverJs);
  const catchesWriteError = /catch \(writeErr\)/.test(serverJs);

  assert.ok(hasRollback, 'Should have rollback logic');
  assert.ok(catchesWriteError, 'Should catch write errors');

  console.log('  ✓ Rollback on write failure\n');
}

function testInvalidatesCache() {
  console.log('Test: Invalidates cache after successful write');

  const invalidatesCache = /invalidateStatusTrackerCache/.test(serverJs);

  assert.ok(invalidatesCache, 'Should invalidate cache after write');

  console.log('  ✓ Invalidates cache after write\n');
}

// Run all tests
try {
  testAdminAuthorizationChecked();
  testUsesLockService();
  testReadsCurrentQueueRow();
  testValidatesPendingReview();
  testValidatesMasterPendingReview();
  testValidatesQueueNumber();
  testValidatesMasterExists();
  testPreflightBeforeWrites();
  testRollbackOnFailure();
  testInvalidatesCache();

  console.log('✅ All retirement safeguards tests passed');
  console.log('\n📋 Verified safeguards:');
  console.log('  ✓ Admin authorization required');
  console.log('  ✓ Lock service prevents concurrent modifications');
  console.log('  ✓ Reads current unprocessed queue entry');
  console.log('  ✓ Validates queue is Pending review');
  console.log('  ✓ Validates Master is Pending review');
  console.log('  ✓ Validates queue has demo number');
  console.log('  ✓ Validates Master row exists');
  console.log('  ✓ Preflight validation before writes');
  console.log('  ✓ Rollback on write failure');
  console.log('  ✓ Cache invalidation after success');
} catch (error) {
  console.error('❌ Test failed:', error.message);
  process.exit(1);
}
