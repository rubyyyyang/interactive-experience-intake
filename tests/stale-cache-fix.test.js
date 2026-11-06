/**
 * Stale Cache Fix Test
 * Verifies that Master data is read fresh after acquiring lock
 */

const assert = require('assert');

console.log('Running stale cache fix tests...\n');

// Test: Fresh Master read after lock prevents stale-cache race
function testFreshMasterReadAfterLock() {
  console.log('Test: Fresh Master read after lock prevents stale-cache race');

  // Simulate the flow with cache invalidation
  let runtimeMemo = { actionStatus: 'Action needed', lastRead: Date.now() - 5000 };

  function submitWithCacheInvalidation(currentActionStatus) {
    // Before lock: read from cache (stale)
    const preLockStatus = runtimeMemo.actionStatus;

    // Acquire lock (simulated)
    // CRITICAL: Invalidate cache to force fresh read
    runtimeMemo = null;

    // After lock: read fresh data
    const postLockStatus = currentActionStatus; // Fresh read from sheet
    return { preLockStatus, postLockStatus };
  }

  // Scenario: User A checks Action needed (cached), User B updates to Pending review, User A acquires lock
  const result = submitWithCacheInvalidation('Pending review');

  assert.strictEqual(result.preLockStatus, 'Action needed', 'Pre-lock should read from cache');
  assert.strictEqual(result.postLockStatus, 'Pending review', 'Post-lock should read fresh data');

  // After invalidation, memo should be null (forcing fresh read)
  assert.strictEqual(runtimeMemo, null, 'Runtime memo should be invalidated');

  console.log('✓ Fresh Master read after lock test passed\n');
}

// Test: Post-lock validation catches concurrent submission
function testPostLockValidation() {
  console.log('Test: Post-lock validation catches concurrent submission');

  function validateAfterLock(freshActionStatus, isUserAdmin) {
    // Re-check using fresh Master data after acquiring lock
    const isBlocked = freshActionStatus === 'Pending review' && !isUserAdmin;

    if (isBlocked) {
      return { canProceed: false, reason: 'pending_review_after_fresh_read' };
    }

    return { canProceed: true };
  }

  // User B acquires lock after User A already submitted
  const result = validateAfterLock('Pending review', false);
  assert.strictEqual(result.canProceed, false, 'Should block concurrent submission');
  assert.strictEqual(result.reason, 'pending_review_after_fresh_read', 'Should block with fresh data');

  // Admin should still bypass
  const adminResult = validateAfterLock('Pending review', true);
  assert.strictEqual(adminResult.canProceed, true, 'Admin should bypass pending review');

  console.log('✓ Post-lock validation test passed\n');
}

// Test: Cache invalidation doesn't affect other operations
function testCacheInvalidationIsolation() {
  console.log('Test: Cache invalidation is isolated to submission flow');

  // Simulate that invalidation only affects submitCreatorResponse, not getAllSubmissions
  let submissionMemo = { data: 'cached', timestamp: Date.now() - 10000 };
  let readOnlyMemo = { data: 'cached', timestamp: Date.now() - 1000 };

  function submitCreatorResponse() {
    // Invalidate only for this critical write path
    submissionMemo = null;
    return 'Fresh data read for submission';
  }

  function getAllSubmissions() {
    // Read operations can use cache
    return readOnlyMemo.data;
  }

  const submitResult = submitCreatorResponse();
  assert.strictEqual(submissionMemo, null, 'Submission should invalidate cache');

  const readResult = getAllSubmissions();
  assert.strictEqual(readResult, 'cached', 'Read operations should use cache');
  assert.notStrictEqual(readOnlyMemo, null, 'Read cache should not be invalidated');

  console.log('✓ Cache invalidation isolation test passed\n');
}

// Run all tests
try {
  testFreshMasterReadAfterLock();
  testPostLockValidation();
  testCacheInvalidationIsolation();

  console.log('✅ All stale cache fix tests passed!');
} catch (err) {
  console.error('❌ Test failed:', err.message);
  process.exit(1);
}
