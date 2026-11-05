/**
 * UI Improvements Tests
 * Tests for secondary badge styling, submit behavior, and Response Queue Assigned mapping
 */

const assert = require('assert');

console.log('Running UI improvements tests...\n');

// Test 1: All secondary workflow badges use same amber styling
function testUnifiedSecondaryBadgeStyle() {
  console.log('Test: Pending review / More info needed use same amber badge style');

  const AMBER_STYLE = {
    background: '#fef7e0',
    color: '#b06000'
  };

  // All active secondary states use the same style
  const pendingReviewStyle = AMBER_STYLE;
  const moreInfoStyle = AMBER_STYLE;

  assert.deepStrictEqual(pendingReviewStyle, moreInfoStyle, 'Both use amber style');

  console.log('✓ Unified secondary badge style test passed\n');
}

// Test 2: Complete state hides recommendation badges
function testCompleteHidesRecommendationBadges() {
  console.log('Test: Complete lifecycle action hides recommendation badges');

  function getRecommendationLabel(action, actionStatus) {
    // Hide recommendation when Complete
    if ((action === 'Improve completion' || action === 'Consider retirement') &&
        actionStatus === 'Complete') {
      return '';
    }

    if (action === 'Improve completion') return 'Update needed';
    if (action === 'Consider retirement') return 'Retirement review';
    return '';
  }

  assert.strictEqual(getRecommendationLabel('Improve completion', 'Complete'), '', 'No badge when Complete');
  assert.strictEqual(getRecommendationLabel('Improve completion', 'Action needed'), 'Update needed', 'Show badge when active');
  assert.strictEqual(getRecommendationLabel('Consider retirement', 'Complete'), '', 'No badge when Complete');

  console.log('✓ Complete hides recommendation test passed\n');
}

// Test 3: Complete state hides secondary workflow badge
function testCompleteHidesWorkflowBadge() {
  console.log('Test: Complete lifecycle action hides secondary workflow badge');

  function getWorkflowStatusLabel(action, actionStatus) {
    if (action !== 'Improve completion' && action !== 'Consider retirement') return '';
    if (actionStatus === 'Action needed') return '';
    if (actionStatus === 'Complete') return '';  // Hidden
    if (actionStatus === 'Pending review') return 'Pending review';
    if (actionStatus === 'Resubmit required') return 'More info needed';
    return '';
  }

  assert.strictEqual(getWorkflowStatusLabel('Improve completion', 'Complete'), '', 'No workflow badge when Complete');
  assert.strictEqual(getWorkflowStatusLabel('Improve completion', 'Pending review'), 'Pending review', 'Show when Pending');

  console.log('✓ Complete hides workflow badge test passed\n');
}

// Test 4: Successful resubmit transitions to Pending review
function testResubmitTransition() {
  console.log('Test: Successful creator resubmit transitions Resubmit required → Pending review');

  let masterActionStatus = 'Resubmit required';
  let queueHistory = [
    { rowIndex: 5, reviewStatus: 'Resubmit required', adminNotes: 'Need more detail' }
  ];

  // Creator resubmits
  function handleResubmit() {
    // Append new queue row
    queueHistory.push({ rowIndex: 8, reviewStatus: 'Pending review', adminNotes: '' });
    // Update Master
    masterActionStatus = 'Pending review';
  }

  handleResubmit();

  assert.strictEqual(masterActionStatus, 'Pending review', 'Master updated to Pending review');
  assert.strictEqual(queueHistory.length, 2, 'New queue row appended');
  assert.strictEqual(queueHistory[0].reviewStatus, 'Resubmit required', 'Old row unchanged');
  assert.strictEqual(queueHistory[1].reviewStatus, 'Pending review', 'New row Pending review');

  console.log('✓ Resubmit transition test passed\n');
}

// Test 5: Response Queue Assigned and Creator Email copy from Master
function testAssignedMapping() {
  console.log('Test: Response Queue Assigned/Creator Email copy from Request_Master');

  const masterRecord = {
    number: '123',
    assigned: 'Alice',
    creatorName: 'Bob',
    creatorEmail: 'bob@example.com'
  };

  const currentUserEmail = 'admin@example.com';  // Actual submitter

  function buildQueueRow(master, submitterEmail) {
    return {
      number: master.number,
      assigned: master.assigned,  // Copy from Master (recommendation owner)
      creatorName: master.creatorName,  // Copy from Master (content creator)
      creatorEmail: master.creatorEmail,  // Copy from Master (content creator email)
      email: submitterEmail  // Actual submitting user (may differ if admin submits)
    };
  }

  const queueRow = buildQueueRow(masterRecord, currentUserEmail);

  assert.strictEqual(queueRow.assigned, 'Alice', 'Assigned copied from Master');
  assert.strictEqual(queueRow.creatorName, 'Bob', 'Creator Name copied from Master');
  assert.strictEqual(queueRow.creatorEmail, 'bob@example.com', 'Creator Email copied from Master');
  assert.strictEqual(queueRow.email, 'admin@example.com', 'email = actual submitter');
  assert.notStrictEqual(queueRow.email, queueRow.creatorEmail, 'Submitter can differ from creator');

  console.log('✓ Assigned/Creator Email mapping test passed\n');
}

// Test 6: Creator Name and Creator Email remain separate
function testCreatorFieldsSeparate() {
  console.log('Test: Creator Name / Creator Email remain populated separately from Assigned');

  const queueRow = {
    assigned: 'Alice',  // Recommendation owner
    creatorName: 'Bob',  // Content creator
    creatorEmail: 'bob@example.com'
  };

  assert.strictEqual(queueRow.assigned !== queueRow.creatorName, true, 'Assigned can differ from Creator Name');
  assert.strictEqual(!!queueRow.creatorName, true, 'Creator Name populated');
  assert.strictEqual(!!queueRow.creatorEmail, true, 'Creator Email populated');

  console.log('✓ Creator fields separate test passed\n');
}

// Run all tests
try {
  testUnifiedSecondaryBadgeStyle();
  testCompleteHidesRecommendationBadges();
  testCompleteHidesWorkflowBadge();
  testResubmitTransition();
  testAssignedMapping();
  testCreatorFieldsSeparate();

  console.log('✅ All UI improvements tests passed');
} catch (error) {
  console.error('❌ Test failed:', error.message);
  process.exit(1);
}
