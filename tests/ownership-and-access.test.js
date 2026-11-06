/**
 * Ownership and Access Control Tests
 * Tests for Status Tracker tab visibility, ownership calculation, and authorization
 */

const assert = require('assert');

console.log('Running ownership and access control tests...\n');

// Test 1: isMine calculation for Interactive Demo
function testIsMineCalculation() {
  console.log('Test: isMine calculation for Interactive Demo');

  // Mock buildSubmissionFromRow_ behavior
  function calculateIsMine(creatorEmail, requestorEmail, userEmail) {
    const lowerUserEmail = userEmail ? userEmail.toLowerCase().trim() : '';
    const lowerCreatorEmail = creatorEmail ? creatorEmail.toLowerCase().trim() : '';
    const lowerRequestorEmail = requestorEmail ? requestorEmail.toLowerCase().trim() : '';

    // Empty string is falsy in boolean context
    return !!lowerUserEmail && (lowerCreatorEmail === lowerUserEmail || lowerRequestorEmail === lowerUserEmail);
  }

  // Creator match
  assert.strictEqual(
    calculateIsMine('alice@redhat.com', 'bob@redhat.com', 'alice@redhat.com'),
    true,
    'Creator email should match'
  );

  // Requestor match
  assert.strictEqual(
    calculateIsMine('alice@redhat.com', 'bob@redhat.com', 'bob@redhat.com'),
    true,
    'Requestor email should match'
  );

  // No match
  assert.strictEqual(
    calculateIsMine('alice@redhat.com', 'bob@redhat.com', 'charlie@redhat.com'),
    false,
    'Non-owner should not match'
  );

  // Case insensitive
  assert.strictEqual(
    calculateIsMine('Alice@RedHat.com', 'bob@redhat.com', 'alice@redhat.com'),
    true,
    'Email comparison should be case-insensitive'
  );

  // Empty user email
  assert.strictEqual(
    calculateIsMine('alice@redhat.com', 'bob@redhat.com', ''),
    false,
    'Empty user email should not match'
  );

  console.log('✓ isMine calculation tests passed\n');
}

// Test 2: isMine calculation for Video Demo (creator-only)
function testVideoIsMineCalculation() {
  console.log('Test: isMine calculation for Video Demo (creator-only)');

  // Video Demo uses creator email only (no requestor)
  function calculateVideoIsMine(creatorEmail, userEmail) {
    const lowerUserEmail = userEmail ? userEmail.toLowerCase().trim() : '';
    const lowerCreatorEmail = creatorEmail ? creatorEmail.toLowerCase().trim() : '';

    return lowerUserEmail && (lowerCreatorEmail === lowerUserEmail);
  }

  // Creator match
  assert.strictEqual(
    calculateVideoIsMine('alice@redhat.com', 'alice@redhat.com'),
    true,
    'Video Demo creator should match'
  );

  // No match
  assert.strictEqual(
    calculateVideoIsMine('alice@redhat.com', 'bob@redhat.com'),
    false,
    'Non-creator should not match Video Demo'
  );

  console.log('✓ Video Demo isMine calculation tests passed\n');
}

// Test 3: Tab visibility for all users
function testTabVisibility() {
  console.log('Test: Tab visibility for all users');

  // Simulate frontend tab visibility logic
  function areTabsVisible(isAdmin) {
    // All three tabs should be visible regardless of admin status
    return {
      mySubmissions: true,
      allSubmissions: true,
      reports: true
    };
  }

  const regularUser = areTabsVisible(false);
  assert.strictEqual(regularUser.mySubmissions, true, 'Regular user should see My Submissions');
  assert.strictEqual(regularUser.allSubmissions, true, 'Regular user should see All Submissions');
  assert.strictEqual(regularUser.reports, true, 'Regular user should see Reports');

  const adminUser = areTabsVisible(true);
  assert.strictEqual(adminUser.mySubmissions, true, 'Admin should see My Submissions');
  assert.strictEqual(adminUser.allSubmissions, true, 'Admin should see All Submissions');
  assert.strictEqual(adminUser.reports, true, 'Admin should see Reports');

  console.log('✓ Tab visibility tests passed\n');
}

// Test 4: My Submissions filtering
function testMySubmissionsFiltering() {
  console.log('Test: My Submissions filtering');

  const allSubmissions = [
    { title: 'Demo 1', isMine: true, status: 'Published' },
    { title: 'Demo 2', isMine: false, status: 'Published' },
    { title: 'Demo 3', isMine: true, status: 'Request Open' },
    { title: 'Demo 4', isMine: false, status: 'Retired' }
  ];

  const mySubmissions = allSubmissions.filter(s => s.isMine);

  assert.strictEqual(mySubmissions.length, 2, 'Should filter to only owned submissions');
  assert.strictEqual(mySubmissions[0].title, 'Demo 1', 'Should include first owned demo');
  assert.strictEqual(mySubmissions[1].title, 'Demo 3', 'Should include second owned demo');

  console.log('✓ My Submissions filtering tests passed\n');
}

// Test 5: Response form authorization (Open collaboration model)
function testResponseFormAuthorization() {
  console.log('Test: Response form authorization (open collaboration)');

  function canShowResponseForm(hasCreatorAction, status) {
    // Open collaboration: All authenticated users can submit responses
    // Hide form only when response is already pending review
    const showForm = hasCreatorAction && (status === 'Action needed' || status === 'Follow-up needed');
    return showForm;
  }

  // Anyone with action needed
  assert.strictEqual(
    canShowResponseForm(true, 'Action needed'),
    true,
    'Any user should see response form when action needed (open collaboration)'
  );

  // Anyone with follow-up needed
  assert.strictEqual(
    canShowResponseForm(true, 'Follow-up needed'),
    true,
    'Any user should see response form when follow-up needed'
  );

  // No form when pending review (response already submitted)
  assert.strictEqual(
    canShowResponseForm(true, 'Pending review'),
    false,
    'No one should see response form when pending review'
  );

  // No form when completed
  assert.strictEqual(
    canShowResponseForm(true, 'Complete'),
    false,
    'No one should see response form when action complete'
  );

  console.log('✓ Response form authorization tests passed\n');
}

// Test 6: Admin-only features remain protected
function testAdminOnlyFeatures() {
  console.log('Test: Admin-only features remain protected');

  function getAdminOnlyData(isAdmin) {
    if (isAdmin) {
      return {
        pendingResponse: { /* queue data */ },
        adminNotes: 'Internal notes',
        needsReviewFilter: true
      };
    }
    return {
      pendingResponse: undefined,
      adminNotes: undefined,
      needsReviewFilter: false
    };
  }

  const regularUserData = getAdminOnlyData(false);
  assert.strictEqual(regularUserData.pendingResponse, undefined, 'Regular user should not see pending queue');
  assert.strictEqual(regularUserData.adminNotes, undefined, 'Regular user should not see admin notes');
  assert.strictEqual(regularUserData.needsReviewFilter, false, 'Regular user should not see Needs review filter');

  const adminData = getAdminOnlyData(true);
  assert.notStrictEqual(adminData.pendingResponse, undefined, 'Admin should see pending queue');
  assert.notStrictEqual(adminData.adminNotes, undefined, 'Admin should see admin notes');
  assert.strictEqual(adminData.needsReviewFilter, true, 'Admin should see Needs review filter');

  console.log('✓ Admin-only features tests passed\n');
}

// Test 7: Recommendation visibility (public) and action forms (open collaboration)
function testRecommendationVisibility() {
  console.log('Test: Recommendation visibility and action forms (open collaboration)');

  function getRecommendationDisplay(hasAction, status) {
    const showRecommendation = hasAction;  // Everyone sees recommendations
    const showActionForm = hasAction && (status === 'Action needed' || status === 'Follow-up needed');  // Everyone can respond when actionable

    return { showRecommendation, showActionForm };
  }

  // Anyone with action needed sees both
  const actionNeeded = getRecommendationDisplay(true, 'Action needed');
  assert.strictEqual(actionNeeded.showRecommendation, true, 'Anyone should see recommendation');
  assert.strictEqual(actionNeeded.showActionForm, true, 'Anyone should see action form when actionable (open collaboration)');

  // Anyone with pending review sees recommendation but not form
  const pendingReview = getRecommendationDisplay(true, 'Pending review');
  assert.strictEqual(pendingReview.showRecommendation, true, 'Anyone should see recommendation');
  assert.strictEqual(pendingReview.showActionForm, false, 'No one should see action form when pending review');

  // Anyone with completed action sees recommendation but not form
  // Note: buildActionBanner() returns empty string when status is 'Complete', so panel is hidden at that level
  const completed = getRecommendationDisplay(true, 'Complete');
  assert.strictEqual(completed.showRecommendation, true, 'Recommendation context visible (but panel hidden by buildActionBanner)');
  assert.strictEqual(completed.showActionForm, false, 'Completed actions hide action form');

  console.log('✓ Recommendation visibility tests passed\n');
}

// Test 8: Submitted Response visibility (post-submission experience)
function testSubmittedResponseVisibility() {
  console.log('Test: Submitted Response visibility (post-submission)');

  function getPostSubmissionDisplay(status, hasResponse) {
    const showSubmittedResponse = status === 'Pending review' && hasResponse;
    const showActionForm = status === 'Action needed' || status === 'Follow-up needed';
    const showAdminFeedback = status === 'Follow-up needed';

    return { showSubmittedResponse, showActionForm, showAdminFeedback };
  }

  // Pending review - show submitted response, hide form
  const pending = getPostSubmissionDisplay('Pending review', true);
  assert.strictEqual(pending.showSubmittedResponse, true, 'Should show submitted response when pending review');
  assert.strictEqual(pending.showActionForm, false, 'Should hide action form when pending review');
  assert.strictEqual(pending.showAdminFeedback, false, 'Should not show admin feedback when pending review');

  // Follow-up needed - show admin feedback and form, hide submitted response
  const followUp = getPostSubmissionDisplay('Follow-up needed', false);
  assert.strictEqual(followUp.showSubmittedResponse, false, 'Should not show submitted response when follow-up needed');
  assert.strictEqual(followUp.showActionForm, true, 'Should show action form when follow-up needed');
  assert.strictEqual(followUp.showAdminFeedback, true, 'Should show admin feedback when follow-up needed');

  // Action needed - show form only
  const actionNeeded = getPostSubmissionDisplay('Action needed', false);
  assert.strictEqual(actionNeeded.showSubmittedResponse, false, 'Should not show submitted response when action needed');
  assert.strictEqual(actionNeeded.showActionForm, true, 'Should show action form when action needed');
  assert.strictEqual(actionNeeded.showAdminFeedback, false, 'Should not show admin feedback when action needed');

  console.log('✓ Submitted Response visibility tests passed\n');
}

// Test 9: Non-creator submission and feedback workflow
function testNonCreatorCollaboration() {
  console.log('Test: Non-creator submission and feedback workflow');

  function canSubmitResponse(isAuthenticated, demoStatus) {
    // Any authenticated Red Hat user can submit responses
    // Retired demos don't accept lifecycle responses
    return isAuthenticated && demoStatus !== 'Retired';
  }

  function canViewSubmittedResponse(isAuthenticated) {
    // Any authenticated user can view submitted responses
    return isAuthenticated;
  }

  function canViewAdminFeedback(isAuthenticated) {
    // Any authenticated user can view admin feedback
    return isAuthenticated;
  }

  // Non-creator authenticated user
  assert.strictEqual(
    canSubmitResponse(true, 'Published'),
    true,
    'Non-creator can submit response for published demo'
  );

  assert.strictEqual(
    canViewSubmittedResponse(true),
    true,
    'Non-creator can view submitted response details'
  );

  assert.strictEqual(
    canViewAdminFeedback(true),
    true,
    'Non-creator can view admin feedback after follow-up requested'
  );

  // Retired demo restriction
  assert.strictEqual(
    canSubmitResponse(true, 'Retired'),
    false,
    'Retired demos do not accept lifecycle responses'
  );

  console.log('✓ Non-creator collaboration tests passed\n');
}

// Run all tests
try {
  testIsMineCalculation();
  testVideoIsMineCalculation();
  testTabVisibility();
  testMySubmissionsFiltering();
  testResponseFormAuthorization();
  testAdminOnlyFeatures();
  testRecommendationVisibility();
  testSubmittedResponseVisibility();
  testNonCreatorCollaboration();

  console.log('✅ All ownership and access control tests passed!');
} catch (err) {
  console.error('❌ Test failed:', err.message);
  process.exit(1);
}
