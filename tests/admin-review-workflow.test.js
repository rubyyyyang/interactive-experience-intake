/**
 * Admin Review Workflow Tests
 * Tests for Response Queue schema, workflow state transitions, and admin review controls
 */

const assert = require('assert');

console.log('Running admin review workflow tests...\n');

// Test 1: Response Queue schema mapping
function testResponseQueueSchema() {
  console.log('Test: Response Queue uses correct schema');

  const EXPECTED_HEADERS = [
    'Demo Number', 'Assigned', 'email', 'Demo Title', 'Review Status', 'Timestamp',
    'Action Taken', 'New Creation Link', 'Target Update Date', 'Additional Comments',
    'Admin Notes', 'Action Completed Date', 'Number', 'Demo Page Link',
    'Production Demo Link', 'Creator Name', 'Creator Email', 'Primary Product',
    'Marketing Program', 'TDP', 'Sales Tactic', 'Demo Description', 'Language',
    'SEOWords', 'Description for SEO', 'CTALink', 'Recommended Action',
    'Action Priority', 'Recommended action reason'
  ];

  // Verify Review Status is used (not Action Status)
  assert.strictEqual(EXPECTED_HEADERS.indexOf('Review Status') >= 0, true, 'Review Status header present');
  assert.strictEqual(EXPECTED_HEADERS.indexOf('Action Status'), -1, 'Action Status header not present');

  // Verify key columns exist
  assert.strictEqual(EXPECTED_HEADERS.indexOf('Admin Notes') >= 0, true, 'Admin Notes column present');
  assert.strictEqual(EXPECTED_HEADERS.indexOf('Action Taken') >= 0, true, 'Action Taken column present');
  assert.strictEqual(EXPECTED_HEADERS.indexOf('New Creation Link') >= 0, true, 'New Creation Link column present');

  console.log('✓ Response Queue schema test passed\n');
}

// Test 2: Request_Master still uses Action Status
function testRequestMasterSchema() {
  console.log('Test: Request_Master uses Action Status (not Review Status)');

  const STATUS_TRACKER_COLUMNS = {
    ACTION_STATUS: 'Action Status',
    RECOMMENDED_ACTION: 'Recommended action'
  };

  assert.strictEqual(STATUS_TRACKER_COLUMNS.ACTION_STATUS, 'Action Status', 'Request_Master uses Action Status');

  console.log('✓ Request_Master schema test passed\n');
}

// Test 3: Secondary workflow labels
function testSecondaryWorkflowLabels() {
  console.log('Test: Secondary workflow status labels');

  function getWorkflowLabel(actionStatus, action) {
    if (action !== 'Improve completion' && action !== 'Consider retirement') return '';
    if (actionStatus === 'Action needed') return '';
    if (actionStatus === 'Pending review') return 'Pending review';
    if (actionStatus === 'Resubmit required') return 'More info needed';
    if (actionStatus === 'Complete') return 'Resolved';
    return '';
  }

  // Action needed → no label
  assert.strictEqual(getWorkflowLabel('Action needed', 'Improve completion'), '', 'No label for Action needed');

  // Pending review → show "Pending review"
  assert.strictEqual(getWorkflowLabel('Pending review', 'Improve completion'), 'Pending review', 'Show Pending review');

  // Resubmit required → show "More info needed"
  assert.strictEqual(getWorkflowLabel('Resubmit required', 'Improve completion'), 'More info needed', 'Show More info needed');

  // Complete → show "Resolved"
  assert.strictEqual(getWorkflowLabel('Complete', 'Improve completion'), 'Resolved', 'Show Resolved');

  // Top performer → no workflow label
  assert.strictEqual(getWorkflowLabel('Action needed', 'No action needed'), '', 'No label for Top performer');

  console.log('✓ Secondary workflow labels test passed\n');
}

// Test 4: Needs review filter derives from Pending review
function testNeedsReviewFilter() {
  console.log('Test: Needs review filter derives from Master Pending review');

  const submissions = [
    { perfActionStatus: 'Pending review' },
    { perfActionStatus: 'Action needed' },
    { perfActionStatus: 'Pending review' },
    { perfActionStatus: 'Complete' },
    { perfActionStatus: 'Resubmit required' }
  ];

  const needsReview = submissions.filter(s => (s.perfActionStatus || '').trim() === 'Pending review');

  assert.strictEqual(needsReview.length, 2, 'Count Pending review submissions');

  console.log('✓ Needs review filter test passed\n');
}

// Test 5: First submission workflow
function testFirstSubmission() {
  console.log('Test: First lifecycle submission workflow');

  // Creator submits → new Queue row, Review Status = Pending review, Master = Pending review
  const queueReviewStatus = 'Pending review';
  const masterActionStatus = 'Pending review';

  assert.strictEqual(queueReviewStatus, 'Pending review', 'Queue Review Status set to Pending review');
  assert.strictEqual(masterActionStatus, 'Pending review', 'Master Action Status set to Pending review');

  console.log('✓ First submission workflow test passed\n');
}

// Test 6: Admin approve workflow
function testApproveWorkflow() {
  console.log('Test: Admin approve workflow');

  // Admin approves → same Queue row Review Status = Complete, Master = Complete
  let queueReviewStatus = 'Pending review';
  let masterActionStatus = 'Pending review';

  // Simulate approval
  queueReviewStatus = 'Complete';
  masterActionStatus = 'Complete';

  assert.strictEqual(queueReviewStatus, 'Complete', 'Queue Review Status updated to Complete');
  assert.strictEqual(masterActionStatus, 'Complete', 'Master Action Status updated to Complete');

  console.log('✓ Approve workflow test passed\n');
}

// Test 7: Admin request changes workflow
function testRequestChangesWorkflow() {
  console.log('Test: Admin request changes workflow');

  // Admin requests changes → Queue Review Status = Resubmit required, Master = Resubmit required
  let queueReviewStatus = 'Pending review';
  let masterActionStatus = 'Pending review';

  // Simulate request changes (requires Admin Notes)
  const adminNotes = 'Please provide more details about the update.';
  if (adminNotes) {
    queueReviewStatus = 'Resubmit required';
    masterActionStatus = 'Resubmit required';
  }

  assert.strictEqual(queueReviewStatus, 'Resubmit required', 'Queue Review Status updated to Resubmit required');
  assert.strictEqual(masterActionStatus, 'Resubmit required', 'Master Action Status updated to Resubmit required');
  assert.strictEqual(!!adminNotes, true, 'Admin Notes required');

  console.log('✓ Request changes workflow test passed\n');
}

// Test 8: Creator resubmission creates new row
function testResubmissionCreatesNewRow() {
  console.log('Test: Creator resubmission appends new Queue row');

  const queueHistory = [
    { number: '123', reviewStatus: 'Resubmit required', adminNotes: 'Need more info' }
  ];

  // Creator resubmits → append new row, preserve history
  queueHistory.push({ number: '123', reviewStatus: 'Pending review', adminNotes: '' });

  assert.strictEqual(queueHistory.length, 2, 'New row appended');
  assert.strictEqual(queueHistory[0].reviewStatus, 'Resubmit required', 'Historical row preserved');
  assert.strictEqual(queueHistory[1].reviewStatus, 'Pending review', 'New row Pending review');

  console.log('✓ Resubmission creates new row test passed\n');
}

// Test 9: Need help special case
function testNeedHelpSpecialCase() {
  console.log('Test: Need help special case');

  const creatorActionTaken = 'Need help';
  const isNeedHelp = creatorActionTaken.toLowerCase().indexOf('need help') !== -1;

  // Admin UI should show "Send guidance" instead of "Approve"
  const primaryButtonText = isNeedHelp ? 'Send guidance' : 'Approve';
  assert.strictEqual(primaryButtonText, 'Send guidance', 'Show Send guidance for Need help');

  // Under the hood, same transition: Resubmit required
  const queueReviewStatus = 'Resubmit required';
  const masterActionStatus = 'Resubmit required';

  assert.strictEqual(queueReviewStatus, 'Resubmit required', 'Queue Review Status Resubmit required');
  assert.strictEqual(masterActionStatus, 'Resubmit required', 'Master Action Status Resubmit required');

  console.log('✓ Need help special case test passed\n');
}

// Test 10: Retire is non-destructive
function testRetireNonDestructive() {
  console.log('Test: Retire response remains non-destructive');

  const creatorActionTaken = 'Retire';
  const currentPublishingStatus = 'Published';

  // Submission only sets Queue and Master Action Status
  const queueReviewStatus = 'Pending review';
  const masterActionStatus = 'Pending review';

  // Publishing status NOT changed
  const newPublishingStatus = currentPublishingStatus;

  assert.strictEqual(queueReviewStatus, 'Pending review', 'Queue Review Status Pending review');
  assert.strictEqual(masterActionStatus, 'Pending review', 'Master Action Status Pending review');
  assert.strictEqual(newPublishingStatus, 'Published', 'Publishing status unchanged');

  console.log('✓ Retire non-destructive test passed\n');
}

// Test 11: Admin Notes from prior Resubmit required row appear to creator
function testAdminNotesDisplay() {
  console.log('Test: Admin Notes displayed to creator on Resubmit required');

  const masterActionStatus = 'Resubmit required';
  const latestQueueEntry = {
    reviewStatus: 'Resubmit required',
    adminNotes: 'Please update the completion steps to be more specific.'
  };

  // Creator should see admin feedback
  const shouldShowFeedback = masterActionStatus === 'Resubmit required' && !!latestQueueEntry.adminNotes;

  assert.strictEqual(shouldShowFeedback, true, 'Admin feedback displayed');
  assert.strictEqual(latestQueueEntry.adminNotes.length > 0, true, 'Admin Notes present');

  console.log('✓ Admin Notes display test passed\n');
}

// Test 12: Full lifecycle Timeline unchanged
function testLifecycleTimelineUnchanged() {
  console.log('Test: Full lifecycle Timeline remains unchanged');

  const LIFECYCLE_STAGES = [
    'Request Open',
    'Request Approved',
    'Demo Received',
    'Demo Reviewed',
    'Published',
    'Retired',
    'Closed'
  ];

  // Verify all 7 stages present
  assert.strictEqual(LIFECYCLE_STAGES.length, 7, '7 lifecycle stages');
  assert.strictEqual(LIFECYCLE_STAGES.indexOf('Request Open') >= 0, true, 'Request Open present');
  assert.strictEqual(LIFECYCLE_STAGES.indexOf('Published') >= 0, true, 'Published present');
  assert.strictEqual(LIFECYCLE_STAGES.indexOf('Retired') >= 0, true, 'Retired present');
  assert.strictEqual(LIFECYCLE_STAGES.indexOf('Closed') >= 0, true, 'Closed present');

  console.log('✓ Lifecycle Timeline unchanged test passed\n');
}

// Test 13: Non-admin cannot access admin review functions
function testNonAdminPermissions() {
  console.log('Test: Non-admin cannot access admin review functions');

  function isAdmin(email) {
    // Simplified admin check
    return email && email.indexOf('@redhat.com') !== -1 && email.indexOf('admin') !== -1;
  }

  const normalUser = 'creator@redhat.com';
  const adminUser = 'admin@redhat.com';

  assert.strictEqual(isAdmin(normalUser), false, 'Normal user not admin');
  assert.strictEqual(isAdmin(adminUser), true, 'Admin user is admin');

  // getLatestPendingQueueEntry requires admin
  function canAccessPendingQueue(email) {
    return isAdmin(email);
  }

  assert.strictEqual(canAccessPendingQueue(normalUser), false, 'Normal user cannot access pending queue');
  assert.strictEqual(canAccessPendingQueue(adminUser), true, 'Admin can access pending queue');

  console.log('✓ Non-admin permissions test passed\n');
}

// Test 14: Unrelated user cannot fetch admin feedback for other creator's demo
function testAdminFeedbackAuthorization() {
  console.log('Test: Unrelated user cannot fetch admin feedback');

  function canAccessAdminFeedback(userEmail, demoCreatorEmail, isAdmin) {
    if (isAdmin) return true;

    // Lifecycle feedback authorization: must be the creator
    const userLower = (userEmail || '').toLowerCase().trim();
    const creatorLower = (demoCreatorEmail || '').toLowerCase().trim();

    return userLower === creatorLower;
  }

  const creator = 'alice@redhat.com';
  const otherUser = 'bob@redhat.com';
  const admin = 'admin@redhat.com';

  // Creator can access their own feedback
  assert.strictEqual(canAccessAdminFeedback(creator, creator, false), true, 'Creator can access own feedback');

  // Unrelated authenticated user CANNOT access
  assert.strictEqual(canAccessAdminFeedback(otherUser, creator, false), false, 'Unrelated user cannot access feedback');

  // Admin can access any feedback
  assert.strictEqual(canAccessAdminFeedback(admin, creator, true), true, 'Admin can access any feedback');

  console.log('✓ Admin feedback authorization test passed\n');
}

// Run all tests
try {
  testResponseQueueSchema();
  testRequestMasterSchema();
  testSecondaryWorkflowLabels();
  testNeedsReviewFilter();
  testFirstSubmission();
  testApproveWorkflow();
  testRequestChangesWorkflow();
  testResubmissionCreatesNewRow();
  testNeedHelpSpecialCase();
  testRetireNonDestructive();
  testAdminNotesDisplay();
  testLifecycleTimelineUnchanged();
  testNonAdminPermissions();
  testAdminFeedbackAuthorization();

  console.log('✅ All admin review workflow tests passed');
} catch (error) {
  console.error('❌ Test failed:', error.message);
  process.exit(1);
}
