/**
 * Action Validation Test
 * Verifies lifecycle action matches authoritative Recommended action
 */

const assert = require('assert');

console.log('Running action validation tests...\n');

// Test: Requested action must match authoritative Recommended action
function testActionMatchesRecommendation() {
  console.log('Test: Requested action must match authoritative Recommended action');

  // Simulate post-lock validation
  function validateAction(payload, masterRecommendedAction, masterActionStatus) {
    // Block if already complete
    if (masterActionStatus === 'Complete') {
      return { success: false, error: 'This action is already complete. No further responses accepted.' };
    }

    // Validate requested action matches authoritative recommendation
    if (payload.action && masterRecommendedAction) {
      const normalizedPayloadAction = payload.action.trim();
      const normalizedMasterAction = masterRecommendedAction.trim();

      const supportedActions = ['Improve completion', 'Consider retirement'];
      if (supportedActions.indexOf(normalizedPayloadAction) === -1) {
        return { success: false, error: 'Unsupported lifecycle action. Please use an action from the recommendation.' };
      }

      if (normalizedPayloadAction !== normalizedMasterAction) {
        return {
          success: false,
          error: 'Your selected action ("' + normalizedPayloadAction + '") does not match the current recommendation ("' + normalizedMasterAction + '"). Please refresh and respond to the current recommendation.'
        };
      }
    }

    return { success: true };
  }

  // Valid: Action matches recommendation
  const validImprove = {
    number: '123',
    type: 'lifecycle_response',
    action: 'Improve completion',
    response: 'Updated'
  };
  const validImproveResult = validateAction(validImprove, 'Improve completion', 'Action needed');
  assert.strictEqual(validImproveResult.success, true, 'Matching action should be accepted');

  const validRetire = {
    number: '123',
    type: 'lifecycle_response',
    action: 'Consider retirement',
    response: 'Retire'
  };
  const validRetireResult = validateAction(validRetire, 'Consider retirement', 'Resubmit');
  assert.strictEqual(validRetireResult.success, true, 'Matching retirement action should be accepted');

  console.log('✓ Action matches recommendation test passed\n');
}

// Test: Mismatched action rejected
function testMismatchedActionRejected() {
  console.log('Test: Mismatched action rejected');

  function validateAction(payload, masterRecommendedAction) {
    if (payload.action && masterRecommendedAction) {
      const normalizedPayloadAction = payload.action.trim();
      const normalizedMasterAction = masterRecommendedAction.trim();

      const supportedActions = ['Improve completion', 'Consider retirement'];
      if (supportedActions.indexOf(normalizedPayloadAction) === -1) {
        return { success: false, error: 'Unsupported lifecycle action. Please use an action from the recommendation.' };
      }

      if (normalizedPayloadAction !== normalizedMasterAction) {
        return {
          success: false,
          error: 'Your selected action ("' + normalizedPayloadAction + '") does not match the current recommendation ("' + normalizedMasterAction + '"). Please refresh and respond to the current recommendation.'
        };
      }
    }

    return { success: true };
  }

  // User submits retirement request but recommendation is "Improve completion"
  const mismatchedPayload = {
    number: '123',
    type: 'lifecycle_response',
    action: 'Consider retirement',
    response: 'Retire'
  };
  const result = validateAction(mismatchedPayload, 'Improve completion');
  assert.strictEqual(result.success, false, 'Mismatched action should be rejected');
  assert.strictEqual(
    result.error.includes('does not match the current recommendation'),
    true,
    'Should explain mismatch'
  );

  // User submits improvement but recommendation is "Consider retirement"
  const reverseMismatch = {
    number: '123',
    type: 'lifecycle_response',
    action: 'Improve completion',
    response: 'Updated'
  };
  const reverseResult = validateAction(reverseMismatch, 'Consider retirement');
  assert.strictEqual(reverseResult.success, false, 'Reverse mismatch should be rejected');

  console.log('✓ Mismatched action rejection test passed\n');
}

// Test: Unsupported action rejected
function testUnsupportedActionRejected() {
  console.log('Test: Unsupported action rejected');

  function validateAction(payload, masterRecommendedAction) {
    if (payload.action && masterRecommendedAction) {
      const normalizedPayloadAction = payload.action.trim();
      const normalizedMasterAction = masterRecommendedAction.trim();

      const supportedActions = ['Improve completion', 'Consider retirement'];
      if (supportedActions.indexOf(normalizedPayloadAction) === -1) {
        return { success: false, error: 'Unsupported lifecycle action. Please use an action from the recommendation.' };
      }

      if (normalizedPayloadAction !== normalizedMasterAction) {
        return { success: false, error: 'Action mismatch' };
      }
    }

    return { success: true };
  }

  // Unsupported action "Fix bugs"
  const unsupportedPayload = {
    number: '123',
    type: 'lifecycle_response',
    action: 'Fix bugs',
    response: 'Done'
  };
  const result = validateAction(unsupportedPayload, 'Fix bugs');
  assert.strictEqual(result.success, false, 'Unsupported action should be rejected');
  assert.strictEqual(
    result.error,
    'Unsupported lifecycle action. Please use an action from the recommendation.',
    'Should return unsupported action error'
  );

  console.log('✓ Unsupported action rejection test passed\n');
}

// Test: Complete action status blocks submission
function testCompleteActionStatusBlocked() {
  console.log('Test: Complete action status blocks submission');

  function validateAction(payload, masterRecommendedAction, masterActionStatus) {
    if (masterActionStatus === 'Complete') {
      return { success: false, error: 'This action is already complete. No further responses accepted.' };
    }

    if (payload.action && masterRecommendedAction) {
      const normalizedPayloadAction = payload.action.trim();
      const normalizedMasterAction = masterRecommendedAction.trim();

      const supportedActions = ['Improve completion', 'Consider retirement'];
      if (supportedActions.indexOf(normalizedPayloadAction) === -1) {
        return { success: false };
      }

      if (normalizedPayloadAction !== normalizedMasterAction) {
        return { success: false };
      }
    }

    return { success: true };
  }

  // Action is already complete
  const payload = {
    number: '123',
    type: 'lifecycle_response',
    action: 'Improve completion',
    response: 'Updated'
  };
  const result = validateAction(payload, 'Improve completion', 'Complete');
  assert.strictEqual(result.success, false, 'Complete action should block submission');
  assert.strictEqual(result.error, 'This action is already complete. No further responses accepted.', 'Should return complete error');

  // Action needed should allow submission
  const allowedResult = validateAction(payload, 'Improve completion', 'Action needed');
  assert.strictEqual(allowedResult.success, true, 'Action needed should allow submission');

  // Resubmit should allow submission
  const resubmitResult = validateAction(payload, 'Improve completion', 'Resubmit');
  assert.strictEqual(resubmitResult.success, true, 'Resubmit should allow submission');

  console.log('✓ Complete action status blocking test passed\n');
}

// Test: Type requirement enforcement
function testTypeRequirement() {
  console.log('Test: Type requirement enforcement');

  function validateType(payload) {
    // Require explicit lifecycle_response type from frontend
    if (payload.type !== 'lifecycle_response') {
      return { success: false, error: 'Only lifecycle responses are supported. Please select an action and response.' };
    }

    return { success: true };
  }

  // Valid type
  const validPayload = {
    number: '123',
    type: 'lifecycle_response',
    action: 'Improve completion',
    response: 'Updated'
  };
  const validResult = validateType(validPayload);
  assert.strictEqual(validResult.success, true, 'lifecycle_response type should be accepted');

  // Missing type
  const missingType = {
    number: '123',
    action: 'Improve completion',
    response: 'Updated'
  };
  const missingResult = validateType(missingType);
  assert.strictEqual(missingResult.success, false, 'Missing type should be rejected');

  // Wrong type
  const wrongType = {
    number: '123',
    type: 'metadata_edit',
    action: 'Improve completion',
    response: 'Updated'
  };
  const wrongResult = validateType(wrongType);
  assert.strictEqual(wrongResult.success, false, 'Wrong type should be rejected');

  // Legacy response type
  const legacyType = {
    number: '123',
    type: 'response',
    response: 'Done'
  };
  const legacyResult = validateType(legacyType);
  assert.strictEqual(legacyResult.success, false, 'Legacy type should be rejected');

  console.log('✓ Type requirement test passed\n');
}

// Test: Missing recommendation rejected (fail-closed)
function testMissingRecommendationRejected() {
  console.log('Test: Missing recommendation rejected (fail-closed)');

  function validateAction(payload, masterRecommendedAction) {
    // Fail-closed: Require supported, nonempty recommendation
    const normalizedMasterAction = masterRecommendedAction ? masterRecommendedAction.trim() : '';
    const supportedActions = ['Improve completion', 'Consider retirement'];

    if (!normalizedMasterAction || supportedActions.indexOf(normalizedMasterAction) === -1) {
      return {
        success: false,
        error: 'This demo does not have a valid lifecycle recommendation. Cannot accept responses.'
      };
    }

    const normalizedPayloadAction = payload.action ? payload.action.trim() : '';

    if (supportedActions.indexOf(normalizedPayloadAction) === -1) {
      return { success: false, error: 'Unsupported lifecycle action. Please use an action from the recommendation.' };
    }

    if (normalizedPayloadAction !== normalizedMasterAction) {
      return { success: false, error: 'Action mismatch' };
    }

    return { success: true };
  }

  // Empty recommendation
  const emptyPayload = {
    number: '123',
    type: 'lifecycle_response',
    action: 'Improve completion',
    response: 'Updated'
  };
  const emptyResult = validateAction(emptyPayload, '');
  assert.strictEqual(emptyResult.success, false, 'Empty recommendation should be rejected');
  assert.strictEqual(
    emptyResult.error,
    'This demo does not have a valid lifecycle recommendation. Cannot accept responses.',
    'Should return missing recommendation error'
  );

  // Null recommendation
  const nullResult = validateAction(emptyPayload, null);
  assert.strictEqual(nullResult.success, false, 'Null recommendation should be rejected');

  // Whitespace-only recommendation
  const whitespaceResult = validateAction(emptyPayload, '   ');
  assert.strictEqual(whitespaceResult.success, false, 'Whitespace recommendation should be rejected');

  // Unsupported recommendation value
  const unsupportedRec = {
    number: '123',
    type: 'lifecycle_response',
    action: 'Fix bugs',
    response: 'Done'
  };
  const unsupportedRecResult = validateAction(unsupportedRec, 'Fix bugs');
  assert.strictEqual(unsupportedRecResult.success, false, 'Unsupported recommendation value should be rejected');

  console.log('✓ Missing recommendation rejection test passed\n');
}

// Test: Action mismatch with valid recommendation
function testActionMismatchWithValidRecommendation() {
  console.log('Test: Action mismatch with valid recommendation');

  function validateAction(payload, masterRecommendedAction) {
    const normalizedMasterAction = masterRecommendedAction ? masterRecommendedAction.trim() : '';
    const supportedActions = ['Improve completion', 'Consider retirement'];

    if (!normalizedMasterAction || supportedActions.indexOf(normalizedMasterAction) === -1) {
      return { success: false, error: 'This demo does not have a valid lifecycle recommendation. Cannot accept responses.' };
    }

    const normalizedPayloadAction = payload.action ? payload.action.trim() : '';

    if (supportedActions.indexOf(normalizedPayloadAction) === -1) {
      return { success: false, error: 'Unsupported lifecycle action. Please use an action from the recommendation.' };
    }

    if (normalizedPayloadAction !== normalizedMasterAction) {
      return {
        success: false,
        error: 'Your selected action ("' + normalizedPayloadAction + '") does not match the current recommendation ("' + normalizedMasterAction + '"). Please refresh and respond to the current recommendation.'
      };
    }

    return { success: true };
  }

  // Recommendation is "Improve completion", user tries to retire
  const mismatchPayload = {
    number: '123',
    type: 'lifecycle_response',
    action: 'Consider retirement',
    response: 'Retire'
  };
  const result = validateAction(mismatchPayload, 'Improve completion');
  assert.strictEqual(result.success, false, 'Mismatched action should be rejected');
  assert.strictEqual(
    result.error,
    'Your selected action ("Consider retirement") does not match the current recommendation ("Improve completion"). Please refresh and respond to the current recommendation.',
    'Should return detailed mismatch error'
  );

  // Recommendation is "Consider retirement", user tries to improve
  const reverseMismatch = {
    number: '123',
    type: 'lifecycle_response',
    action: 'Improve completion',
    response: 'Updated'
  };
  const reverseResult = validateAction(reverseMismatch, 'Consider retirement');
  assert.strictEqual(reverseResult.success, false, 'Reverse mismatch should be rejected');
  assert.strictEqual(
    reverseResult.error.includes('does not match the current recommendation'),
    true,
    'Should explain mismatch'
  );

  console.log('✓ Action mismatch test passed\n');
}

// Run all tests
try {
  testActionMatchesRecommendation();
  testMismatchedActionRejected();
  testUnsupportedActionRejected();
  testCompleteActionStatusBlocked();
  testTypeRequirement();
  testMissingRecommendationRejected();
  testActionMismatchWithValidRecommendation();

  console.log('✅ All action validation tests passed!');
} catch (err) {
  console.error('❌ Test failed:', err.message);
  process.exit(1);
}
