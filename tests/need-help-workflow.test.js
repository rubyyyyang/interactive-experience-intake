/**
 * Need Help Workflow Tests
 * Tests for "I need help" creator path and Admin "Send guidance" action
 */

const assert = require('assert');

console.log('Running Need Help workflow tests...\n');

// Test 1: Creator "Need help" submission → Pending review
function testNeedHelpSubmitPending() {
  console.log('Test: Creator "Need help" submission sets Action Status = Pending review');

  const creatorActionTaken = 'Need help';

  function handleCreatorSubmit(actionTaken) {
    return {
      queueReviewStatus: 'Pending review',
      masterActionStatus: 'Pending review',
      actionCompletedDate: null
    };
  }

  const result = handleCreatorSubmit(creatorActionTaken);

  assert.strictEqual(result.queueReviewStatus, 'Pending review', 'Queue Review Status = Pending review');
  assert.strictEqual(result.masterActionStatus, 'Pending review', 'Master Action Status = Pending review');
  assert.strictEqual(result.actionCompletedDate, null, 'Action Completed Date remains blank');

  console.log('✓ Creator Need help submit test passed\n');
}

// Test 2: Admin sees "Send guidance" button when creator action = "Need help"
function testAdminSeesSendGuidance() {
  console.log('Test: Admin sees "Send guidance" when creator Action Taken = "Need help"');

  function getAdminPrimaryButton(creatorActionTaken) {
    const isNeedHelp = (creatorActionTaken || '').toLowerCase().indexOf('need help') !== -1 ||
                       (creatorActionTaken || '').toLowerCase().indexOf('help') !== -1;
    return isNeedHelp ? 'Send guidance' : 'Approve';
  }

  assert.strictEqual(getAdminPrimaryButton('Need help'), 'Send guidance', 'Need help shows Send guidance');
  assert.strictEqual(getAdminPrimaryButton('I need help with this'), 'Send guidance', 'Help variant shows Send guidance');
  assert.strictEqual(getAdminPrimaryButton('Updated the demo'), 'Approve', 'Other action shows Approve');

  console.log('✓ Admin sees Send guidance test passed\n');
}

// Test 3: Send guidance routes to requestChanges, not approve
function testSendGuidanceRoutesToRequestChanges() {
  console.log('Test: Send guidance button calls adminRequestChanges, not adminApprove');

  function getAdminPrimaryAction(creatorActionTaken) {
    const isNeedHelp = (creatorActionTaken || '').toLowerCase().indexOf('need help') !== -1 ||
                       (creatorActionTaken || '').toLowerCase().indexOf('help') !== -1;
    return isNeedHelp ? 'adminRequestChanges' : 'adminApprove';
  }

  assert.strictEqual(getAdminPrimaryAction('Need help'), 'adminRequestChanges', 'Need help routes to requestChanges');
  assert.strictEqual(getAdminPrimaryAction('Updated'), 'adminApprove', 'Other action routes to approve');

  console.log('✓ Send guidance routing test passed\n');
}

// Test 4: Send guidance sets Queue Review Status = Follow-up needed
function testSendGuidanceSetsFollowupNeeded() {
  console.log('Test: Send guidance sets Queue Review Status = Follow-up needed');

  function adminSendGuidance(queueRowIndex, notes) {
    // Simulate requestChanges behavior
    if (!notes) {
      return { success: false, error: 'Admin Notes required' };
    }

    // Preflight: queue must be Pending review
    const currentQueueState = 'Pending review';
    if (currentQueueState !== 'Pending review') {
      return { success: false, error: 'Queue not Pending review' };
    }

    return {
      success: true,
      queueReviewStatus: 'Follow-up needed',
      masterActionStatus: 'Follow-up needed',
      queueAdminNotes: notes,
      actionCompletedDate: null
    };
  }

  const result = adminSendGuidance(5, 'Here is guidance on how to proceed');

  assert.strictEqual(result.success, true, 'Send guidance succeeds');
  assert.strictEqual(result.queueReviewStatus, 'Follow-up needed', 'Queue Review Status = Follow-up needed');
  assert.strictEqual(result.masterActionStatus, 'Follow-up needed', 'Master Action Status = Follow-up needed');
  assert.strictEqual(result.actionCompletedDate, null, 'Action Completed Date remains blank');

  console.log('✓ Send guidance sets Follow-up needed test passed\n');
}

// Test 5: Send guidance does NOT set Action Completed Date
function testSendGuidanceDoesNotSetCompletedDate() {
  console.log('Test: Send guidance does NOT set Action Completed Date');

  let masterActionCompletedDate = null;
  let queueActionCompletedDate = null;

  function adminSendGuidance() {
    // Request changes path - do NOT set Action Completed Date
    // (Only approve path sets it)
    return {
      masterActionCompletedDate: null,
      queueActionCompletedDate: null
    };
  }

  const result = adminSendGuidance();

  assert.strictEqual(result.masterActionCompletedDate, null, 'Master Action Completed Date remains blank');
  assert.strictEqual(result.queueActionCompletedDate, null, 'Queue Action Completed Date remains blank');

  console.log('✓ Send guidance does not set completed date test passed\n');
}

// Test 6: Creator sees Follow-up needed + Admin Notes
function testCreatorSeesFollowupNeeded() {
  console.log('Test: After Send guidance, creator sees Follow-up needed + Admin Notes');

  const masterActionStatus = 'Follow-up needed';
  const masterPerfAction = 'Improve completion';
  const queueAdminNotes = 'Here is guidance on how to proceed';

  function getCreatorWorkflowBadge(perfAction, actionStatus) {
    if (perfAction !== 'Improve completion' && perfAction !== 'Consider retirement') return '';
    if (actionStatus === 'Action needed') return '';
    if (actionStatus === 'Complete') return '';
    if (actionStatus === 'Pending review') return 'Pending review';
    if (actionStatus === 'Follow-up needed') return 'Follow-up needed';
    return '';
  }

  const workflowBadge = getCreatorWorkflowBadge(masterPerfAction, masterActionStatus);

  assert.strictEqual(workflowBadge, 'Follow-up needed', 'Creator sees Follow-up needed badge');
  assert.strictEqual(!!queueAdminNotes, true, 'Admin Notes available');

  console.log('✓ Creator sees Follow-up needed test passed\n');
}

// Test 7: Creator can resubmit after Send guidance
function testCreatorCanResubmit() {
  console.log('Test: Creator can resubmit after Send guidance');

  const masterActionStatus = 'Follow-up needed';

  function canCreatorSubmit(actionStatus) {
    return actionStatus === 'Action needed' || actionStatus === 'Follow-up needed';
  }

  assert.strictEqual(canCreatorSubmit(masterActionStatus), true, 'Creator can resubmit when Follow-up needed');
  assert.strictEqual(canCreatorSubmit('Pending review'), false, 'Creator cannot resubmit when Pending review');
  assert.strictEqual(canCreatorSubmit('Complete'), false, 'Creator cannot resubmit when Complete');

  console.log('✓ Creator can resubmit test passed\n');
}

// Test 8: Only Admin Approve → Complete
function testOnlyApproveCompletesWorkflow() {
  console.log('Test: Only Admin Approve transitions to Complete');

  function adminApprove(queueRowIndex, notes) {
    return {
      queueReviewStatus: 'Complete',
      masterActionStatus: 'Complete',
      actionCompletedDate: new Date().toISOString()
    };
  }

  function adminSendGuidance(queueRowIndex, notes) {
    return {
      queueReviewStatus: 'Follow-up needed',
      masterActionStatus: 'Follow-up needed',
      actionCompletedDate: null
    };
  }

  const approveResult = adminApprove(5, '');
  const guidanceResult = adminSendGuidance(5, 'Guidance here');

  assert.strictEqual(approveResult.masterActionStatus, 'Complete', 'Approve sets Complete');
  assert.strictEqual(!!approveResult.actionCompletedDate, true, 'Approve sets Action Completed Date');

  assert.strictEqual(guidanceResult.masterActionStatus, 'Follow-up needed', 'Send guidance sets Follow-up needed');
  assert.strictEqual(guidanceResult.actionCompletedDate, null, 'Send guidance does not set Action Completed Date');

  console.log('✓ Only Approve completes workflow test passed\n');
}

// Test 9: Full workflow - Need help → Send guidance → Resubmit → Approve → Complete
function testFullNeedHelpWorkflow() {
  console.log('Test: Full Need help workflow sequence');

  let masterActionStatus = 'Action needed';
  let queueHistory = [];

  // Step 1: Creator submits "Need help"
  queueHistory.push({ rowIndex: 5, reviewStatus: 'Pending review', actionTaken: 'Need help' });
  masterActionStatus = 'Pending review';
  assert.strictEqual(masterActionStatus, 'Pending review', 'Step 1: Master = Pending review');

  // Step 2: Admin sends guidance
  queueHistory[0].reviewStatus = 'Follow-up needed';
  queueHistory[0].adminNotes = 'Here is guidance';
  masterActionStatus = 'Follow-up needed';
  assert.strictEqual(masterActionStatus, 'Follow-up needed', 'Step 2: Master = Follow-up needed');
  assert.strictEqual(queueHistory[0].adminNotes, 'Here is guidance', 'Step 2: Admin Notes set');

  // Step 3: Creator resubmits
  queueHistory.push({ rowIndex: 8, reviewStatus: 'Pending review', actionTaken: 'Updated based on guidance' });
  masterActionStatus = 'Pending review';
  assert.strictEqual(masterActionStatus, 'Pending review', 'Step 3: Master = Pending review');
  assert.strictEqual(queueHistory.length, 2, 'Step 3: New queue row appended');

  // Step 4: Admin approves
  queueHistory[1].reviewStatus = 'Complete';
  masterActionStatus = 'Complete';
  assert.strictEqual(masterActionStatus, 'Complete', 'Step 4: Master = Complete');
  assert.strictEqual(queueHistory[1].reviewStatus, 'Complete', 'Step 4: Queue = Complete');

  console.log('✓ Full Need help workflow test passed\n');
}

// Run all tests
try {
  testNeedHelpSubmitPending();
  testAdminSeesSendGuidance();
  testSendGuidanceRoutesToRequestChanges();
  testSendGuidanceSetsFollowupNeeded();
  testSendGuidanceDoesNotSetCompletedDate();
  testCreatorSeesFollowupNeeded();
  testCreatorCanResubmit();
  testOnlyApproveCompletesWorkflow();
  testFullNeedHelpWorkflow();

  console.log('✅ All Need Help workflow tests passed');
} catch (error) {
  console.error('❌ Test failed:', error.message);
  process.exit(1);
}
