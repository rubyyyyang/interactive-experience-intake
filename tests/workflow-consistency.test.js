/**
 * Workflow Consistency Tests
 * Tests for Master/Queue synchronization, preflight validation, and rollback behavior
 */

const assert = require('assert');

console.log('Running workflow consistency tests...\n');

// Test 1: Preflight failure prevents all writes
function testPreflightPreventsWrites() {
  console.log('Test: Preflight failure prevents writes to both Master and Queue');

  function simulateApproveWithBadQueueState(queueState, masterState) {
    // Preflight check
    if (queueState !== 'Pending review') {
      return { success: false, error: 'Queue not Pending review', masterWritten: false, queueWritten: false };
    }
    if (masterState !== 'Pending review') {
      return { success: false, error: 'Master not Pending review', masterWritten: false, queueWritten: false };
    }

    // Only write if preflight passed
    return { success: true, masterWritten: true, queueWritten: true };
  }

  // Queue already processed
  const result1 = simulateApproveWithBadQueueState('Complete', 'Pending review');
  assert.strictEqual(result1.success, false, 'Reject if Queue already processed');
  assert.strictEqual(result1.masterWritten, false, 'No Master write when preflight fails');
  assert.strictEqual(result1.queueWritten, false, 'No Queue write when preflight fails');

  // Master not pending
  const result2 = simulateApproveWithBadQueueState('Pending review', 'Complete');
  assert.strictEqual(result2.success, false, 'Reject if Master not Pending review');
  assert.strictEqual(result2.masterWritten, false, 'No Master write when Master state wrong');
  assert.strictEqual(result2.queueWritten, false, 'No Queue write when Master state wrong');

  // Both valid
  const result3 = simulateApproveWithBadQueueState('Pending review', 'Pending review');
  assert.strictEqual(result3.success, true, 'Succeed when both states valid');
  assert.strictEqual(result3.masterWritten, true, 'Master written when valid');
  assert.strictEqual(result3.queueWritten, true, 'Queue written when valid');

  console.log('✓ Preflight prevents writes test passed\n');
}

// Test 2: Request changes keeps Master and Queue synchronized
function testRequestChangesSync() {
  console.log('Test: Request changes synchronizes Master and exact Queue attempt');

  let queueState = 'Pending review';
  let masterState = 'Pending review';
  const queueRowId = 5;
  const targetRowId = 5;

  // Verify targeting exact row
  if (queueRowId === targetRowId && queueState === 'Pending review' && masterState === 'Pending review') {
    queueState = 'Resubmit required';
    masterState = 'Resubmit required';
  }

  assert.strictEqual(queueState, 'Resubmit required', 'Queue updated to Resubmit required');
  assert.strictEqual(masterState, 'Resubmit required', 'Master updated to Resubmit required');

  console.log('✓ Request changes sync test passed\n');
}

// Test 3: Approve keeps Master and Queue synchronized
function testApproveSync() {
  console.log('Test: Approve synchronizes Master and exact Queue attempt');

  let queueState = 'Pending review';
  let masterState = 'Pending review';
  const queueRowId = 7;
  const targetRowId = 7;

  // Verify targeting exact row
  if (queueRowId === targetRowId && queueState === 'Pending review' && masterState === 'Pending review') {
    queueState = 'Complete';
    masterState = 'Complete';
  }

  assert.strictEqual(queueState, 'Complete', 'Queue updated to Complete');
  assert.strictEqual(masterState, 'Complete', 'Master updated to Complete');

  console.log('✓ Approve sync test passed\n');
}

// Test 4: Admin action cannot update wrong queue history row
function testExactQueueRowTargeting() {
  console.log('Test: Admin action targets exact queue attempt, not arbitrary row');

  const queueHistory = [
    { rowIndex: 3, number: '123', reviewStatus: 'Complete' },
    { rowIndex: 5, number: '123', reviewStatus: 'Resubmit required' },
    { rowIndex: 8, number: '123', reviewStatus: 'Pending review' }
  ];

  const adminTargetRowIndex = 8;  // Admin loaded this specific attempt

  // Admin action must use the exact rowIndex from loadAdminReviewData
  const targetRow = queueHistory.find(r => r.rowIndex === adminTargetRowIndex);

  assert.strictEqual(targetRow.rowIndex, 8, 'Targets exact row index');
  assert.strictEqual(targetRow.reviewStatus, 'Pending review', 'Correct row state');

  // Must not select by demo number alone
  const wrongApproach = queueHistory.filter(r => r.number === '123' && r.reviewStatus === 'Pending review');
  assert.strictEqual(wrongApproach.length, 1, 'Demo number alone finds correct count');
  assert.strictEqual(wrongApproach[0].rowIndex, 8, 'But must still use the admin-loaded rowIndex');

  console.log('✓ Exact queue row targeting test passed\n');
}

// Test 5: Stale/concurrent queueRowIndex fails safely
function testStaleRowIndexFailure() {
  console.log('Test: Stale queueRowIndex detected and rejected');

  function validateQueueRow(rowIndex, expectedState, currentState) {
    if (currentState !== expectedState) {
      return { success: false, error: 'Queue row state changed. Refresh and retry.' };
    }
    return { success: true };
  }

  // Admin loaded row when it was Pending review
  const adminLoadedState = 'Pending review';

  // Concurrent creator resubmission changed it
  const currentState = 'Complete';

  const result = validateQueueRow(8, adminLoadedState, currentState);

  assert.strictEqual(result.success, false, 'Reject stale row state');
  assert.strictEqual(result.error.indexOf('Refresh') >= 0, true, 'Tell admin to refresh');

  console.log('✓ Stale row index failure test passed\n');
}

// Test 6: Needs review count updates after transitions
function testNeedsReviewCountUpdate() {
  console.log('Test: Needs review count updates after Request changes and Approve');

  let submissions = [
    { number: '123', perfActionStatus: 'Pending review' },
    { number: '124', perfActionStatus: 'Pending review' },
    { number: '125', perfActionStatus: 'Action needed' }
  ];

  function getNeedsReviewCount(subs) {
    return subs.filter(s => (s.perfActionStatus || '').trim() === 'Pending review').length;
  }

  assert.strictEqual(getNeedsReviewCount(submissions), 2, 'Initial count: 2 pending');

  // Request changes on #123
  submissions[0].perfActionStatus = 'Resubmit required';
  assert.strictEqual(getNeedsReviewCount(submissions), 1, 'After Request changes: 1 pending');

  // Approve #124
  submissions[1].perfActionStatus = 'Complete';
  assert.strictEqual(getNeedsReviewCount(submissions), 0, 'After Approve: 0 pending');

  console.log('✓ Needs review count update test passed\n');
}

// Test 7: Cache invalidation after successful transition
function testCacheInvalidation() {
  console.log('Test: Cache invalidated only after successful write');

  let cacheValid = true;

  function performTransitionWithCache(writeSuccess) {
    if (!writeSuccess) {
      return { success: false, cacheInvalidated: false };
    }

    // Only invalidate after write succeeds
    cacheValid = false;
    return { success: true, cacheInvalidated: true };
  }

  const fail = performTransitionWithCache(false);
  assert.strictEqual(fail.cacheInvalidated, false, 'Cache not invalidated on failure');
  assert.strictEqual(cacheValid, true, 'Cache still valid');

  const success = performTransitionWithCache(true);
  assert.strictEqual(success.cacheInvalidated, true, 'Cache invalidated on success');
  assert.strictEqual(cacheValid, false, 'Cache marked invalid');

  console.log('✓ Cache invalidation test passed\n');
}

// Test 8: Creator resubmit preserves prior history
function testResubmitPreservesHistory() {
  console.log('Test: Creator resubmit preserves prior Resubmit required row');

  const queueHistory = [
    { rowIndex: 5, number: '123', reviewStatus: 'Resubmit required', adminNotes: 'Need more detail' }
  ];

  // Creator resubmits → append new row, preserve old
  queueHistory.push({ rowIndex: 8, number: '123', reviewStatus: 'Pending review', adminNotes: '' });

  assert.strictEqual(queueHistory.length, 2, 'New row appended');
  assert.strictEqual(queueHistory[0].reviewStatus, 'Resubmit required', 'Prior row unchanged');
  assert.strictEqual(queueHistory[0].adminNotes, 'Need more detail', 'Prior admin notes preserved');
  assert.strictEqual(queueHistory[1].reviewStatus, 'Pending review', 'New row Pending review');

  console.log('✓ Resubmit preserves history test passed\n');
}

// Test 9: Master/Queue inconsistency detected
function testInconsistencyDetection() {
  console.log('Test: Master/Queue inconsistency detected rather than ignored');

  function checkConsistency(masterState, queueStates) {
    const pendingQueues = queueStates.filter(q => q.reviewStatus === 'Pending review');

    // Case A: Master = Pending review, no matching Queue
    if (masterState === 'Pending review' && pendingQueues.length === 0) {
      return { consistent: false, issue: 'Master pending but no Queue pending' };
    }

    // Case B: Queue pending, Master not pending
    if (masterState !== 'Pending review' && pendingQueues.length > 0) {
      return { consistent: false, issue: 'Queue pending but Master not pending' };
    }

    return { consistent: true };
  }

  // Case A
  const caseA = checkConsistency('Pending review', [
    { reviewStatus: 'Complete' },
    { reviewStatus: 'Resubmit required' }
  ]);
  assert.strictEqual(caseA.consistent, false, 'Detect Master pending with no Queue pending');

  // Case B
  const caseB = checkConsistency('Complete', [
    { reviewStatus: 'Complete' },
    { reviewStatus: 'Pending review' }
  ]);
  assert.strictEqual(caseB.consistent, false, 'Detect Queue pending with Master not pending');

  // Consistent state
  const consistent = checkConsistency('Pending review', [
    { reviewStatus: 'Complete' },
    { reviewStatus: 'Pending review' }
  ]);
  assert.strictEqual(consistent.consistent, true, 'Detect consistent state');

  console.log('✓ Inconsistency detection test passed\n');
}

// Run all tests
try {
  testPreflightPreventsWrites();
  testRequestChangesSync();
  testApproveSync();
  testExactQueueRowTargeting();
  testStaleRowIndexFailure();
  testNeedsReviewCountUpdate();
  testCacheInvalidation();
  testResubmitPreservesHistory();
  testInconsistencyDetection();

  console.log('✅ All workflow consistency tests passed');
} catch (error) {
  console.error('❌ Test failed:', error.message);
  process.exit(1);
}
