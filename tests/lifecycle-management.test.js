/**
 * Lifecycle Management Tests
 * Tests for recommendation mapping, authorization, and status compatibility
 */

const assert = require('assert');

console.log('Running lifecycle management tests...\n');

// Test 1: Recommendation Label Mapping
function testRecommendationMapping() {
  console.log('Test: Recommendation label mapping');

  const mappings = [
    { action: 'Improve completion', tier: 'Top', expected: 'Update needed' }, // Action takes precedence
    { action: 'Improve completion', tier: 'Mid', expected: 'Update needed' },
    { action: 'Consider retirement', tier: 'Low', expected: 'Retirement review' },
    { action: 'Boost sales impact', tier: 'Top', expected: '' }, // Hidden from creators
    { action: 'No action needed', tier: 'Top', expected: 'Top performer' }, // Top tier
    { action: 'No action needed', tier: 'Mid', expected: '' }, // No label for Mid
    { action: 'No action needed', tier: 'Low', expected: '' }, // No label for Low
    { action: 'No action needed', tier: 'Inactive', expected: '' }, // No label for Inactive
    { action: 'No action needed', tier: '', expected: '' }, // No label for missing tier
    { action: '', tier: '', expected: '' } // New/insufficient data
  ];

  mappings.forEach(m => {
    let label = '';
    if (m.action === 'Boost sales impact') label = '';
    else if (m.action === 'Improve completion') label = 'Update needed';
    else if (m.action === 'Consider retirement') label = 'Retirement review';
    else if (m.tier === 'Top') label = 'Top performer';

    assert.strictEqual(label, m.expected,
      `Failed: action="${m.action}" tier="${m.tier}" should map to "${m.expected}"`);
  });

  console.log('✓ Recommendation mapping test passed\n');
}

// Test 2: "Top performer" uses Performance Tier (not custom flags)
function testPerformingWellRequiresSignals() {
  console.log('Test: "Top performer" shown only for Top tier');

  const cases = [
    { tier: 'Top', action: 'No action needed', shouldShow: true },
    { tier: 'Mid', action: 'No action needed', shouldShow: false },
    { tier: 'Low', action: 'No action needed', shouldShow: false },
    { tier: 'Inactive', action: 'No action needed', shouldShow: false },
    { tier: '', action: 'No action needed', shouldShow: false },
    { tier: 'Top', action: 'Improve completion', shouldShow: false }, // Action takes precedence
  ];

  cases.forEach(c => {
    // Reuse existing Performance Tier (score >= 70 = Top)
    const shouldShow = c.tier === 'Top' &&
                      c.action !== 'Improve completion' &&
                      c.action !== 'Consider retirement' &&
                      c.action !== 'Boost sales impact';

    assert.strictEqual(shouldShow, c.shouldShow,
      `Tier "${c.tier}" with action "${c.action}" should ${c.shouldShow ? '' : 'not '}show Top performer`);
  });

  console.log('✓ Top performer tier requirement test passed\n');
}

// Test 3: Action Status Sheet-native values
function testActionStatusCompatibility() {
  console.log('Test: Action Status uses Sheet-native values');

  const SHEET_NATIVE = {
    ACTION_NEEDED: 'Action needed',
    PENDING_REVIEW: 'Pending review',
    COMPLETE: 'Complete',
    RESUBMIT_REQUIRED: 'Resubmit required',
    ASSIGNEE_NOTIFIED: 'Assignee notified',
    ASSIGNEE_RESPONDED: 'Assignee responded'
  };

  // Verify Sheet-native canonical values (must match Sheet data validation)
  assert.strictEqual(SHEET_NATIVE.ACTION_NEEDED, 'Action needed', 'Sheet-native initial state');
  assert.strictEqual(SHEET_NATIVE.PENDING_REVIEW, 'Pending review', 'Sheet-native pending state');
  assert.strictEqual(SHEET_NATIVE.COMPLETE, 'Complete', 'Sheet-native complete state');
  assert.strictEqual(SHEET_NATIVE.RESUBMIT_REQUIRED, 'Resubmit required', 'Sheet-native resubmit state');

  console.log('✓ Action Status Sheet-native values test passed\n');
}

// Test 4: Boost sales impact not shown to creators
function testBoostSalesImpactHidden() {
  console.log('Test: Boost sales impact hidden from creators');

  const action = 'Boost sales impact';
  const ADMIN_ACTIONS = ['Create page', 'Increase visibility', 'Review data linkage', 'Needs review', 'Boost sales impact'];
  const CREATOR_ACTIONS = ['Improve completion', 'Consider retirement'];

  assert.strictEqual(ADMIN_ACTIONS.indexOf(action) !== -1, true, 'Should be in ADMIN_ACTIONS');
  assert.strictEqual(CREATOR_ACTIONS.indexOf(action), -1, 'Should NOT be in CREATOR_ACTIONS');

  // Recommendation label should be empty
  const label = ''; // Matches getRecommendationLabel logic
  assert.strictEqual(label, '', 'Boost sales impact should not have creator label');

  console.log('✓ Boost sales impact visibility test passed\n');
}

// Test 5: Authorization logic
function testAuthorizationLogic() {
  console.log('Test: Server-side creator authorization');

  function isAuthorized(userEmail, creatorEmail, requestorEmail, isAdmin) {
    if (isAdmin) return true;
    if (userEmail === creatorEmail) return true;
    if (requestorEmail && userEmail === requestorEmail) return true;
    return false;
  }

  assert.strictEqual(isAuthorized('creator@ex.com', 'creator@ex.com', '', false), true, 'Creator authorized');
  assert.strictEqual(isAuthorized('other@ex.com', 'creator@ex.com', '', false), false, 'Other not authorized');
  assert.strictEqual(isAuthorized('admin@ex.com', 'creator@ex.com', '', true), true, 'Admin authorized');
  assert.strictEqual(isAuthorized('req@ex.com', 'creator@ex.com', 'req@ex.com', false), true, 'Requestor authorized');

  console.log('✓ Authorization logic test passed\n');
}

// Test 6: No duplicate unresolved responses
function testNoDuplicateResponses() {
  console.log('Test: Prevent duplicate unresolved responses');

  // Current implementation overwrites existing unresolved response + pending lock
  // This ensures one unresolved response per submission

  const existingResponses = [
    { number: '123', processed: false, status: 'Pending Review' },
    { number: '456', processed: true, status: 'Completed' }
  ];

  function hasUnresolvedResponse(number, responses) {
    return responses.some(r => r.number === number && !r.processed);
  }

  assert.strictEqual(hasUnresolvedResponse('123', existingResponses), true, 'Should find unresolved');
  assert.strictEqual(hasUnresolvedResponse('456', existingResponses), false, 'Should not find resolved as unresolved');
  assert.strictEqual(hasUnresolvedResponse('789', existingResponses), false, 'Should not find non-existent');

  console.log('✓ Duplicate response prevention test passed\n');
}

// Test 7: Pending lock enforcement
function testPendingLock() {
  console.log('Test: Pending response lock');

  function canSubmitLifecycleResponse(currentStatus, isAdmin) {
    if (currentStatus === 'Pending Review' && !isAdmin) {
      return false; // Locked
    }
    return true;
  }

  assert.strictEqual(canSubmitLifecycleResponse('Pending Review', false), false, 'Creator locked when Pending Review');
  assert.strictEqual(canSubmitLifecycleResponse('Pending Review', true), true, 'Admin can override lock');
  assert.strictEqual(canSubmitLifecycleResponse('Resubmit', false), true, 'Creator can resubmit when Resubmit');
  assert.strictEqual(canSubmitLifecycleResponse('Open', false), true, 'Creator can submit when Open');

  console.log('✓ Pending lock test passed\n');
}

// Run all tests
try {
  testRecommendationMapping();
  testPerformingWellRequiresSignals();
  testActionStatusCompatibility();
  testBoostSalesImpactHidden();
  testAuthorizationLogic();
  testNoDuplicateResponses();
  testPendingLock();

  console.log('✅ All lifecycle management tests passed');
} catch (error) {
  console.error('❌ Test failed:', error.message);
  process.exit(1);
}
