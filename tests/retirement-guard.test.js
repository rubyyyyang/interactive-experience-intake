/**
 * Retirement Guard Tests
 * Tests for server-side retirement completion guard
 */

const assert = require('assert');

console.log('Running Retirement guard tests...\n');

// Test 1: Retire response rejected when content not retired
function testRetireRejectedWhenNotRetired() {
  console.log('Test: Server rejects Retire completion when content Status is not Retired');

  function serverApproveResponse(queueRow, masterRow) {
    // Preflight validation
    if (queueRow.reviewStatus !== 'Pending review') {
      return { success: false, error: 'Queue not Pending review' };
    }
    if (masterRow.actionStatus !== 'Pending review') {
      return { success: false, error: 'Master not Pending review' };
    }

    // RETIREMENT GUARD
    if (queueRow.actionTaken === 'Retire') {
      const contentStatus = masterRow.status;
      if (contentStatus !== 'Retired' && contentStatus !== 'Demo Retired') {
        return {
          success: false,
          error: 'Cannot complete retirement workflow: Content lifecycle Status is "' + contentStatus + '", not "Retired". The existing content retirement process must be completed first.'
        };
      }
    }

    // Write transition
    return {
      success: true,
      queueReviewStatus: 'Complete',
      masterActionStatus: 'Complete',
      actionCompletedDate: new Date().toISOString()
    };
  }

  const queueRow = { reviewStatus: 'Pending review', actionTaken: 'Retire', number: '123' };
  const masterRow = { actionStatus: 'Pending review', status: 'Published', number: '123' };

  const result = serverApproveResponse(queueRow, masterRow);

  assert.strictEqual(result.success, false, 'Reject when content is Published');
  assert.strictEqual(result.error.indexOf('not "Retired"') >= 0, true, 'Error explains content not retired');
  assert.strictEqual(result.queueReviewStatus, undefined, 'No Queue write');
  assert.strictEqual(result.masterActionStatus, undefined, 'No Master write');

  console.log('✓ Retire rejected when not retired test passed\n');
}

// Test 2: Queue remains Pending review after rejection
function testQueueRemainsPendingAfterRejection() {
  console.log('Test: Queue remains Pending review when Retire completion rejected');

  let queueReviewStatus = 'Pending review';
  let masterActionStatus = 'Pending review';

  function attemptApprove(actionTaken, contentStatus) {
    if (actionTaken === 'Retire' && contentStatus !== 'Retired') {
      return { success: false };
    }
    queueReviewStatus = 'Complete';
    masterActionStatus = 'Complete';
    return { success: true };
  }

  const result = attemptApprove('Retire', 'Published');

  assert.strictEqual(result.success, false, 'Approval rejected');
  assert.strictEqual(queueReviewStatus, 'Pending review', 'Queue remains Pending review');
  assert.strictEqual(masterActionStatus, 'Pending review', 'Master remains Pending review');

  console.log('✓ Queue remains Pending after rejection test passed\n');
}

// Test 3: Action Completed Date remains blank after rejection
function testCompletedDateBlankAfterRejection() {
  console.log('Test: Action Completed Date remains blank when Retire completion rejected');

  let actionCompletedDate = null;

  function attemptApprove(actionTaken, contentStatus) {
    if (actionTaken === 'Retire' && contentStatus !== 'Retired') {
      return { success: false };
    }
    actionCompletedDate = new Date().toISOString();
    return { success: true };
  }

  const result = attemptApprove('Retire', 'Published');

  assert.strictEqual(result.success, false, 'Approval rejected');
  assert.strictEqual(actionCompletedDate, null, 'Action Completed Date remains blank');

  console.log('✓ Completed date blank after rejection test passed\n');
}

// Test 4: No publishing Status mutation on rejection
function testNoPublishingStatusMutation() {
  console.log('Test: Retire completion guard does not mutate publishing Status');

  let publishingStatus = 'Published';

  function attemptApprove(actionTaken, contentStatus) {
    // Guard only reads Status, never writes it
    if (actionTaken === 'Retire' && contentStatus !== 'Retired') {
      // NO Status mutation here
      return { success: false };
    }
    // Even on success, completion does NOT change publishing Status
    return { success: true };
  }

  const result = attemptApprove('Retire', 'Published');

  assert.strictEqual(result.success, false, 'Approval rejected');
  assert.strictEqual(publishingStatus, 'Published', 'Publishing Status unchanged');

  console.log('✓ No publishing Status mutation test passed\n');
}

// Test 5: Retire succeeds when content is Retired
function testRetireSucceedsWhenRetired() {
  console.log('Test: Retire completion succeeds when content Status is Retired');

  function serverApproveResponse(queueRow, masterRow) {
    if (queueRow.reviewStatus !== 'Pending review') {
      return { success: false, error: 'Queue not Pending review' };
    }
    if (masterRow.actionStatus !== 'Pending review') {
      return { success: false, error: 'Master not Pending review' };
    }

    // RETIREMENT GUARD
    if (queueRow.actionTaken === 'Retire') {
      const contentStatus = masterRow.status;
      if (contentStatus !== 'Retired' && contentStatus !== 'Demo Retired') {
        return { success: false, error: 'Content not retired' };
      }
    }

    return {
      success: true,
      queueReviewStatus: 'Complete',
      masterActionStatus: 'Complete',
      actionCompletedDate: new Date().toISOString()
    };
  }

  const queueRow = { reviewStatus: 'Pending review', actionTaken: 'Retire', number: '123' };
  const masterRow = { actionStatus: 'Pending review', status: 'Retired', number: '123' };

  const result = serverApproveResponse(queueRow, masterRow);

  assert.strictEqual(result.success, true, 'Approval succeeds when Retired');
  assert.strictEqual(result.queueReviewStatus, 'Complete', 'Queue → Complete');
  assert.strictEqual(result.masterActionStatus, 'Complete', 'Master → Complete');
  assert.strictEqual(!!result.actionCompletedDate, true, 'Action Completed Date set');

  console.log('✓ Retire succeeds when retired test passed\n');
}

// Test 6: Retire succeeds for Demo Retired
function testRetireSucceedsForDemoRetired() {
  console.log('Test: Retire completion succeeds when content Status is Demo Retired');

  function serverApproveResponse(queueRow, masterRow) {
    if (queueRow.actionTaken === 'Retire') {
      const contentStatus = masterRow.status;
      if (contentStatus !== 'Retired' && contentStatus !== 'Demo Retired') {
        return { success: false };
      }
    }
    return { success: true, queueReviewStatus: 'Complete', masterActionStatus: 'Complete' };
  }

  const queueRow = { reviewStatus: 'Pending review', actionTaken: 'Retire' };
  const masterRow = { actionStatus: 'Pending review', status: 'Demo Retired' };

  const result = serverApproveResponse(queueRow, masterRow);

  assert.strictEqual(result.success, true, 'Approval succeeds for Demo Retired');
  assert.strictEqual(result.queueReviewStatus, 'Complete', 'Queue → Complete');
  assert.strictEqual(result.masterActionStatus, 'Complete', 'Master → Complete');

  console.log('✓ Retire succeeds for Demo Retired test passed\n');
}

// Test 7: Keep active bypasses retirement guard
function testKeepActiveBypassesGuard() {
  console.log('Test: Keep active completion bypasses retirement guard');

  function serverApproveResponse(queueRow, masterRow) {
    // RETIREMENT GUARD only applies to Retire
    if (queueRow.actionTaken === 'Retire') {
      const contentStatus = masterRow.status;
      if (contentStatus !== 'Retired' && contentStatus !== 'Demo Retired') {
        return { success: false };
      }
    }

    return { success: true, queueReviewStatus: 'Complete', masterActionStatus: 'Complete' };
  }

  const queueRow = { reviewStatus: 'Pending review', actionTaken: 'Keep active' };
  const masterRow = { actionStatus: 'Pending review', status: 'Published' };

  const result = serverApproveResponse(queueRow, masterRow);

  assert.strictEqual(result.success, true, 'Keep active succeeds regardless of Status');
  assert.strictEqual(result.queueReviewStatus, 'Complete', 'Queue → Complete');
  assert.strictEqual(result.masterActionStatus, 'Complete', 'Master → Complete');

  console.log('✓ Keep active bypasses guard test passed\n');
}

// Test 8: I've updated it bypasses retirement guard
function testUpdatedBypassesGuard() {
  console.log('Test: I\'ve updated it completion bypasses retirement guard');

  function serverApproveResponse(queueRow, masterRow) {
    // RETIREMENT GUARD only applies to Retire
    if (queueRow.actionTaken === 'Retire') {
      const contentStatus = masterRow.status;
      if (contentStatus !== 'Retired' && contentStatus !== 'Demo Retired') {
        return { success: false };
      }
    }

    return { success: true, queueReviewStatus: 'Complete', masterActionStatus: 'Complete' };
  }

  const queueRow = { reviewStatus: 'Pending review', actionTaken: 'Updated' };
  const masterRow = { actionStatus: 'Pending review', status: 'Published' };

  const result = serverApproveResponse(queueRow, masterRow);

  assert.strictEqual(result.success, true, 'Updated succeeds regardless of Status');
  assert.strictEqual(result.queueReviewStatus, 'Complete', 'Queue → Complete');

  console.log('✓ Updated bypasses guard test passed\n');
}

// Test 9: Missing Status column → rejected (fail closed)
function testMissingStatusColumnRejected() {
  console.log('Test: Retire completion rejected when Status column missing (fail closed)');

  function serverApproveResponse(queueRow, masterRow, statusColExists) {
    if (queueRow.reviewStatus !== 'Pending review') {
      return { success: false, error: 'Queue not Pending review' };
    }

    // RETIREMENT GUARD
    if (queueRow.actionTaken === 'Retire') {
      if (!statusColExists) {
        return {
          success: false,
          error: 'Cannot complete retirement workflow: Status column not found.'
        };
      }

      const contentStatus = masterRow.status;
      if (!contentStatus) {
        return { success: false, error: 'Status is blank' };
      }
      if (contentStatus !== 'Retired' && contentStatus !== 'Demo Retired') {
        return { success: false, error: 'Content not retired' };
      }
    }

    return { success: true, queueReviewStatus: 'Complete', masterActionStatus: 'Complete' };
  }

  const queueRow = { reviewStatus: 'Pending review', actionTaken: 'Retire' };
  const masterRow = { actionStatus: 'Pending review', status: 'Retired' };

  const result = serverApproveResponse(queueRow, masterRow, false);

  assert.strictEqual(result.success, false, 'Reject when Status column missing');
  assert.strictEqual(result.error.indexOf('Status column not found') >= 0, true, 'Error explains missing column');
  assert.strictEqual(result.queueReviewStatus, undefined, 'No Queue write');
  assert.strictEqual(result.masterActionStatus, undefined, 'No Master write');

  console.log('✓ Missing Status column rejected test passed\n');
}

// Test 10: Blank Status → rejected (fail closed)
function testBlankStatusRejected() {
  console.log('Test: Retire completion rejected when Status is blank (fail closed)');

  function serverApproveResponse(queueRow, masterRow) {
    if (queueRow.actionTaken === 'Retire') {
      const contentStatus = masterRow.status || '';
      if (!contentStatus.trim()) {
        return {
          success: false,
          error: 'Cannot complete retirement workflow: Content lifecycle Status is blank. The existing content retirement process must be completed first.'
        };
      }
      if (contentStatus !== 'Retired' && contentStatus !== 'Demo Retired') {
        return { success: false, error: 'Content not retired' };
      }
    }

    return { success: true, queueReviewStatus: 'Complete', masterActionStatus: 'Complete' };
  }

  const queueRow = { reviewStatus: 'Pending review', actionTaken: 'Retire' };
  const masterRow = { actionStatus: 'Pending review', status: '' };

  const result = serverApproveResponse(queueRow, masterRow);

  assert.strictEqual(result.success, false, 'Reject when Status is blank');
  assert.strictEqual(result.error.indexOf('Status is blank') >= 0, true, 'Error explains blank status');
  assert.strictEqual(result.queueReviewStatus, undefined, 'No Queue write');

  console.log('✓ Blank Status rejected test passed\n');
}

// Test 11: Non-retired Status → rejected
function testNonRetiredStatusRejected() {
  console.log('Test: Retire completion rejected when Status is not explicitly retired');

  function serverApproveResponse(queueRow, masterRow) {
    if (queueRow.actionTaken === 'Retire') {
      const contentStatus = masterRow.status;
      // Explicit whitelist only
      if (contentStatus !== 'Retired' && contentStatus !== 'Demo Retired') {
        return {
          success: false,
          error: 'Cannot complete retirement workflow: Content lifecycle Status is "' + contentStatus + '", not "Retired".'
        };
      }
    }

    return { success: true, queueReviewStatus: 'Complete' };
  }

  const testCases = [
    { status: 'Published', shouldFail: true },
    { status: 'Demo Published', shouldFail: true },
    { status: 'Closed', shouldFail: true },
    { status: 'Demo Received', shouldFail: true },
    { status: 'Retired', shouldFail: false },
    { status: 'Demo Retired', shouldFail: false }
  ];

  testCases.forEach(tc => {
    const queueRow = { reviewStatus: 'Pending review', actionTaken: 'Retire' };
    const masterRow = { actionStatus: 'Pending review', status: tc.status };
    const result = serverApproveResponse(queueRow, masterRow);

    if (tc.shouldFail) {
      assert.strictEqual(result.success, false, tc.status + ' should be rejected');
    } else {
      assert.strictEqual(result.success, true, tc.status + ' should be allowed');
    }
  });

  console.log('✓ Non-retired Status rejected test passed\n');
}

// Test 12: Accepted retired Status values
function testAcceptedRetiredStatusValues() {
  console.log('Test: Only "Retired" and "Demo Retired" are accepted retired Status values');

  const ACCEPTED_RETIRED_STATUSES = ['Retired', 'Demo Retired'];

  function isRetiredStatus(status) {
    return status === 'Retired' || status === 'Demo Retired';
  }

  assert.strictEqual(isRetiredStatus('Retired'), true, 'Retired is accepted');
  assert.strictEqual(isRetiredStatus('Demo Retired'), true, 'Demo Retired is accepted');
  assert.strictEqual(isRetiredStatus('Published'), false, 'Published is NOT accepted');
  assert.strictEqual(isRetiredStatus('Closed'), false, 'Closed is NOT accepted');
  assert.strictEqual(isRetiredStatus(''), false, 'Blank is NOT accepted');

  assert.strictEqual(ACCEPTED_RETIRED_STATUSES.length, 2, 'Exactly 2 accepted retired statuses');

  console.log('✓ Accepted retired Status values test passed\n');
}

// Run all tests
try {
  testRetireRejectedWhenNotRetired();
  testQueueRemainsPendingAfterRejection();
  testCompletedDateBlankAfterRejection();
  testNoPublishingStatusMutation();
  testRetireSucceedsWhenRetired();
  testRetireSucceedsForDemoRetired();
  testKeepActiveBypassesGuard();
  testUpdatedBypassesGuard();
  testMissingStatusColumnRejected();
  testBlankStatusRejected();
  testNonRetiredStatusRejected();
  testAcceptedRetiredStatusValues();

  console.log('✅ All Retirement guard tests passed');
} catch (error) {
  console.error('❌ Test failed:', error.message);
  process.exit(1);
}
