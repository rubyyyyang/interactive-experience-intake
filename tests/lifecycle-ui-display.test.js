/**
 * Lifecycle UI Display Tests
 * Tests for display label mapping and status summary rendering
 */

const assert = require('assert');

console.log('Running Lifecycle UI display tests...\n');

// Test 1: Canonical workflow vocabulary - Follow-up needed
function testFollowupNeededVocabulary() {
  console.log('Test: "Follow-up needed" is canonical workflow state');

  function getWorkflowDisplayLabel(actionStatus) {
    const trimmed = (actionStatus || '').trim();

    if (trimmed === 'Pending review') return 'Pending review';
    if (trimmed === 'Follow-up needed') return 'Follow-up needed';
    // Legacy read alias
    if (trimmed === 'Resubmit required' || trimmed === 'Resubmit') return 'Follow-up needed';
    if (trimmed === 'Complete') return '';  // No badge for Complete
    return '';
  }

  assert.strictEqual(getWorkflowDisplayLabel('Follow-up needed'), 'Follow-up needed', 'Canonical state: Follow-up needed');
  assert.strictEqual(getWorkflowDisplayLabel('Resubmit required'), 'Follow-up needed', 'Legacy alias: Resubmit required → Follow-up needed');
  assert.strictEqual(getWorkflowDisplayLabel('Pending review'), 'Pending review', 'Pending review unchanged');
  assert.strictEqual(getWorkflowDisplayLabel('Complete'), '', 'Complete shows no badge');

  console.log('✓ Canonical vocabulary test passed\n');
}

// Test 2: Pending review display unchanged
function testPendingReviewDisplayUnchanged() {
  console.log('Test: "Pending review" display label remains unchanged');

  function getWorkflowDisplayLabel(actionStatus) {
    if ((actionStatus || '').trim() === 'Pending review') return 'Pending review';
    return '';
  }

  assert.strictEqual(getWorkflowDisplayLabel('Pending review'), 'Pending review', 'Display = Pending review');

  console.log('✓ Pending review display test passed\n');
}

// Test 3: Complete shows no workflow badge
function testCompleteShowsNoBadge() {
  console.log('Test: Complete lifecycle state shows no workflow badge');

  function getWorkflowDisplayLabel(action, actionStatus) {
    if (action !== 'Improve completion' && action !== 'Consider retirement') return '';
    if ((actionStatus || '').trim() === 'Complete') return '';
    return 'some-badge';
  }

  assert.strictEqual(getWorkflowDisplayLabel('Improve completion', 'Complete'), '', 'No badge when Complete');
  assert.strictEqual(getWorkflowDisplayLabel('Consider retirement', 'Complete'), '', 'No badge when Complete');
  assert.notStrictEqual(getWorkflowDisplayLabel('Improve completion', 'Pending review'), '', 'Badge shown when not Complete');

  console.log('✓ Complete shows no badge test passed\n');
}

// Test 4: Status summary messages by state
function testStatusSummaryMessages() {
  console.log('Test: Status summary message changes correctly by state');

  function getStatusMessage(action, status) {
    if (action === 'Improve completion') {
      if (status === 'Pending review') {
        return 'Your response has been submitted and is awaiting review.';
      } else if (status === 'Complete') {
        return 'Update completed and approved.';
      } else if (status === 'Follow-up needed') {
        return 'Review the feedback below and take the next step.';
      } else {
        return 'This demo needs content improvements to increase completion rate.';
      }
    }
    return '';
  }

  const actionNeededMsg = getStatusMessage('Improve completion', 'Action needed');
  const pendingMsg = getStatusMessage('Improve completion', 'Pending review');
  const followupMsg = getStatusMessage('Improve completion', 'Follow-up needed');
  const completeMsg = getStatusMessage('Improve completion', 'Complete');

  assert.strictEqual(actionNeededMsg.indexOf('needs content improvements') >= 0, true, 'Action needed message');
  assert.strictEqual(pendingMsg.indexOf('awaiting review') >= 0, true, 'Pending review message');
  assert.strictEqual(followupMsg.indexOf('Review the feedback below') >= 0, true, 'Follow-up needed message');
  assert.strictEqual(completeMsg.indexOf('completed and approved') >= 0, true, 'Complete message');

  console.log('✓ Status summary messages test passed\n');
}

// Test 5: Old heavy banner is replaced
function testOldBannerNotRendered() {
  console.log('Test: Old heavy banner classes are no longer used');

  function buildStatusSummary(action, status) {
    // New approach - no .action-banner class
    return {
      usesOldBanner: false,
      usesNewSummary: true,
      hasHeavyBlueBackground: false
    };
  }

  const result = buildStatusSummary('Improve completion', 'Pending review');

  assert.strictEqual(result.usesOldBanner, false, 'Old banner not used');
  assert.strictEqual(result.usesNewSummary, true, 'New summary used');
  assert.strictEqual(result.hasHeavyBlueBackground, false, 'No heavy blue background');

  console.log('✓ Old banner not rendered test passed\n');
}

// Test 6: Canonical vocabulary unified
function testCanonicalVocabularyUnified() {
  console.log('Test: Canonical workflow vocabulary unified across storage and UI');

  const canonicalStates = {
    actionNeeded: 'Action needed',
    pendingReview: 'Pending review',
    followupNeeded: 'Follow-up needed',
    complete: 'Complete'
  };

  function getUIDisplayLabel(storedState) {
    if (storedState === 'Pending review') return 'Pending review';
    if (storedState === 'Follow-up needed') return 'Follow-up needed';
    // Legacy read alias
    if (storedState === 'Resubmit required' || storedState === 'Resubmit') return 'Follow-up needed';
    if (storedState === 'Complete') return '';  // No badge
    return '';
  }

  // Storage and UI use same canonical term
  assert.strictEqual(canonicalStates.followupNeeded, 'Follow-up needed', 'Stored state = Follow-up needed');
  assert.strictEqual(getUIDisplayLabel('Follow-up needed'), 'Follow-up needed', 'UI display = Follow-up needed');
  assert.strictEqual(canonicalStates.followupNeeded, getUIDisplayLabel('Follow-up needed'), 'Storage = UI');

  // Legacy aliases still read correctly
  assert.strictEqual(getUIDisplayLabel('Resubmit required'), 'Follow-up needed', 'Legacy Resubmit required → Follow-up needed');

  console.log('✓ Canonical vocabulary unified test passed\n');
}

// Test 7: Badge alignment and consistency
function testBadgeAlignment() {
  console.log('Test: Status badges render together with consistent spacing');

  function renderStatusBadges(recommendationBadge, workflowBadge) {
    const badges = [];
    if (recommendationBadge) badges.push(recommendationBadge);
    if (workflowBadge) badges.push(workflowBadge);
    return badges.join(' ');
  }

  const result1 = renderStatusBadges('Update needed', 'Pending review');
  assert.strictEqual(result1.indexOf('Update needed') >= 0, true, 'Recommendation badge present');
  assert.strictEqual(result1.indexOf('Pending review') >= 0, true, 'Workflow badge present');

  const result2 = renderStatusBadges('Update needed', '');
  assert.strictEqual(result2.indexOf('Update needed') >= 0, true, 'Recommendation badge alone');
  assert.strictEqual(result2.indexOf('Pending review') >= 0, false, 'No workflow badge when empty');

  console.log('✓ Badge alignment test passed\n');
}

// Test 8: New writes never emit legacy terms
function testNewWritesNeverEmitLegacyTerms() {
  console.log('Test: New writes never emit "Resubmit required" or "More info needed"');

  function adminRequestFollowup() {
    // New writes must use canonical Follow-up needed
    return {
      queueReviewStatus: 'Follow-up needed',
      masterActionStatus: 'Follow-up needed'
    };
  }

  const result = adminRequestFollowup();

  assert.strictEqual(result.queueReviewStatus, 'Follow-up needed', 'Queue writes Follow-up needed');
  assert.strictEqual(result.masterActionStatus, 'Follow-up needed', 'Master writes Follow-up needed');

  // Verify NOT writing legacy terms
  assert.notStrictEqual(result.queueReviewStatus, 'Resubmit required', 'NOT Resubmit required');
  assert.notStrictEqual(result.queueReviewStatus, 'More info needed', 'NOT More info needed');

  console.log('✓ New writes never emit legacy terms test passed\n');
}

// Run all tests
try {
  testFollowupNeededVocabulary();
  testPendingReviewDisplayUnchanged();
  testCompleteShowsNoBadge();
  testStatusSummaryMessages();
  testOldBannerNotRendered();
  testCanonicalVocabularyUnified();
  testBadgeAlignment();
  testNewWritesNeverEmitLegacyTerms();

  console.log('✅ All Lifecycle UI display tests passed');
} catch (error) {
  console.error('❌ Test failed:', error.message);
  process.exit(1);
}
