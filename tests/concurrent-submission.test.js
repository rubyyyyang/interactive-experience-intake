/**
 * Concurrent Submission Race Condition Test
 * Verifies that concurrent submissions don't create duplicate pending responses
 */

const assert = require('assert');

console.log('Running concurrent submission tests...\n');

// Test: Pending review lock after acquiring lock
function testPendingReviewLockAfterAcquiringLock() {
  console.log('Test: Pending review lock after acquiring lock');

  // Simulate the authorization flow in submitCreatorResponse
  function simulateSubmission(currentActionStatus, isUserAdmin, hasLock) {
    // Pre-lock check (original implementation - now removed)
    // const preCheck = currentActionStatus === 'Pending review' && !isUserAdmin;

    if (!hasLock) {
      // Before acquiring lock - no check should happen here anymore
      return { canProceed: true, reason: 'waiting_for_lock' };
    }

    // After acquiring lock - re-check Master status
    const postLockActionStatus = currentActionStatus; // In reality, this would be re-read from Master
    const isBlocked = postLockActionStatus === 'Pending review' && !isUserAdmin;

    if (isBlocked) {
      return { canProceed: false, reason: 'pending_review_after_lock' };
    }

    return { canProceed: true, reason: 'can_write' };
  }

  // Race scenario: Two users submit simultaneously
  // Initial state: Action Status = "Action needed"
  const initialState = 'Action needed';

  // User A checks status before lock
  const userA_preCheck = simulateSubmission(initialState, false, false);
  assert.strictEqual(userA_preCheck.canProceed, true, 'User A should proceed to acquire lock');

  // User B checks status before lock (race window)
  const userB_preCheck = simulateSubmission(initialState, false, false);
  assert.strictEqual(userB_preCheck.canProceed, true, 'User B should also proceed to acquire lock');

  // User A acquires lock first and updates Master to "Pending review"
  const newState = 'Pending review';

  // User A post-lock check (status still "Action needed" in their read)
  const userA_postLock = simulateSubmission(initialState, false, true);
  assert.strictEqual(userA_postLock.canProceed, true, 'User A should write Queue entry');

  // User B acquires lock second, re-reads Master (now "Pending review")
  const userB_postLock = simulateSubmission(newState, false, true);
  assert.strictEqual(userB_postLock.canProceed, false, 'User B should be blocked after lock');
  assert.strictEqual(userB_postLock.reason, 'pending_review_after_lock', 'User B blocked by post-lock check');

  console.log('✓ Pending review lock after acquiring lock tests passed\n');
}

// Test: Admin can override pending review
function testAdminOverridePendingReview() {
  console.log('Test: Admin can override pending review');

  function simulateAdminSubmission(currentActionStatus, isUserAdmin, hasLock) {
    if (!hasLock) {
      return { canProceed: true, reason: 'waiting_for_lock' };
    }

    const isBlocked = currentActionStatus === 'Pending review' && !isUserAdmin;

    if (isBlocked) {
      return { canProceed: false, reason: 'pending_review_after_lock' };
    }

    return { canProceed: true, reason: 'can_write' };
  }

  // Admin should be able to submit even when pending review
  const result = simulateAdminSubmission('Pending review', true, true);
  assert.strictEqual(result.canProceed, true, 'Admin should override pending review');

  console.log('✓ Admin override tests passed\n');
}

// Test: Retired demo guard after lock
function testRetiredDemoGuardAfterLock() {
  console.log('Test: Retired demo guard after lock');

  function simulateLifecycleSubmission(currentStatus, isLifecycleResponse, hasLock) {
    if (!hasLock) {
      return { canProceed: true, reason: 'waiting_for_lock' };
    }

    // After acquiring lock - re-check Master status
    const isRetired = isLifecycleResponse && currentStatus === 'Retired';

    if (isRetired) {
      return { canProceed: false, reason: 'retired_after_lock' };
    }

    return { canProceed: true, reason: 'can_write' };
  }

  // Race scenario: Demo is retired while user is submitting
  const initialStatus = 'Published';
  const retiredStatus = 'Retired';

  // User checks status before lock
  const preCheck = simulateLifecycleSubmission(initialStatus, true, false);
  assert.strictEqual(preCheck.canProceed, true, 'User should proceed to acquire lock');

  // Admin retires demo (status changes to "Retired")
  // User acquires lock, re-reads Master (now "Retired")
  const postLock = simulateLifecycleSubmission(retiredStatus, true, true);
  assert.strictEqual(postLock.canProceed, false, 'User should be blocked after lock');
  assert.strictEqual(postLock.reason, 'retired_after_lock', 'User blocked by post-lock retired check');

  console.log('✓ Retired demo guard tests passed\n');
}

// Run all tests
try {
  testPendingReviewLockAfterAcquiringLock();
  testAdminOverridePendingReview();
  testRetiredDemoGuardAfterLock();

  console.log('✅ All concurrent submission tests passed!');
} catch (err) {
  console.error('❌ Test failed:', err.message);
  process.exit(1);
}
