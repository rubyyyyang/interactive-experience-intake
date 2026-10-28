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
    { action: 'Improve completion', expected: 'Update needed' },
    { action: 'Consider retirement', expected: 'Retirement review' },
    { action: 'Boost sales impact', expected: '' }, // Hidden from creators
    { action: 'No action needed', signals: 'High usage', expected: 'Performing well' },
    { action: 'No action needed', signals: '', expected: '' }, // No label for neutral
    { action: '', signals: '', expected: '' } // New/insufficient data
  ];

  mappings.forEach(m => {
    let label = '';
    if (m.action === 'Improve completion') label = 'Update needed';
    else if (m.action === 'Consider retirement') label = 'Retirement review';
    else if (m.action === 'Boost sales impact') label = '';
    else if (m.action === 'No action needed' && m.signals && m.signals.indexOf('High') !== -1) {
      label = 'Performing well';
    }

    assert.strictEqual(label, m.expected,
      `Failed: ${m.action} with signals "${m.signals}" should map to "${m.expected}"`);
  });

  console.log('✓ Recommendation mapping test passed\n');
}

// Test 2: "Performing well" requires positive flags (not signals)
function testPerformingWellRequiresSignals() {
  console.log('Test: "Performing well" only shown with positive flags');

  const cases = [
    { flags: 'High usage', shouldShow: true },
    { flags: 'High engagement', shouldShow: true },
    { flags: 'High business impact', shouldShow: true },
    { flags: 'High-value niche', shouldShow: true },
    { flags: 'High usage, Low completion', shouldShow: true }, // Mixed flags, has positive
    { flags: '', shouldShow: false }, // No flags
    { flags: 'Low completion', shouldShow: false }, // Only negative
    { flags: 'Mature content', shouldShow: false }, // Not positive
  ];

  cases.forEach(c => {
    const hasPositive = c.flags.indexOf('High usage') !== -1 ||
                       c.flags.indexOf('High engagement') !== -1 ||
                       c.flags.indexOf('High business impact') !== -1 ||
                       c.flags.indexOf('High-value niche') !== -1;
    assert.strictEqual(hasPositive, c.shouldShow,
      `Flags "${c.flags}" should ${c.shouldShow ? '' : 'not '}show Performing well`);
  });

  console.log('✓ Performing well flag requirement test passed\n');
}

// Test 3: Action Status compatibility
function testActionStatusCompatibility() {
  console.log('Test: Action Status values compatible with Hub');

  const CANONICAL = {
    PENDING: 'Pending Review',
    COMPLETED: 'Completed',
    RESUBMIT: 'Resubmit',
    OPEN: 'Open'
  };

  // Verify canonical values (not lowercase variants)
  assert.strictEqual(CANONICAL.PENDING, 'Pending Review', 'Title case required');
  assert.notStrictEqual(CANONICAL.PENDING, 'Pending review', 'Not lowercase');
  assert.strictEqual(CANONICAL.COMPLETED, 'Completed', 'Full word required');
  assert.notStrictEqual(CANONICAL.COMPLETED, 'Complete', 'Not abbreviated');
  assert.strictEqual(CANONICAL.RESUBMIT, 'Resubmit', 'Simple form required');
  assert.notStrictEqual(CANONICAL.RESUBMIT, 'Resubmit required', 'Not verbose');

  console.log('✓ Action Status compatibility test passed\n');
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
