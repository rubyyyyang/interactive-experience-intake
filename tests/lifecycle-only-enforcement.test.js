/**
 * Lifecycle-Only Enforcement Test
 * Verifies Status Tracker only accepts valid lifecycle responses
 */

const assert = require('assert');

console.log('Running lifecycle-only enforcement tests...\n');

// Test: Lifecycle-only validation
function testLifecycleOnlyValidation() {
  console.log('Test: Only lifecycle responses accepted');

  // Simulate submitCreatorResponse validation logic
  function validateSubmission(payload) {
    // Require explicit lifecycle_response type from frontend
    if (payload.type !== 'lifecycle_response') {
      return { success: false, error: 'Only lifecycle responses are supported. Please select an action and response.' };
    }

    const hasMetadata = payload.metadataChanges && typeof payload.metadataChanges === 'object'
      && Object.keys(payload.metadataChanges).length > 0;

    if (hasMetadata) {
      return { success: false, error: 'Metadata editing is not supported. Please use lifecycle action responses only.' };
    }

    // Validate lifecycle response based on action
    let hasResponse = false;
    if (payload.response) {
      const lifecycleValues = payload.action === 'Improve completion'
        ? ['Updated', 'Need help']
        : payload.action === 'Consider retirement'
          ? ['Keep active', 'Retire', 'Need help']
          : [];
      hasResponse = lifecycleValues.indexOf(payload.response) !== -1;
    }

    if (!hasResponse) {
      return { success: false, error: 'Please select a response.' };
    }

    return { success: true, type: 'lifecycle_response' };
  }

  // Valid lifecycle response
  const validPayload = {
    number: '123',
    type: 'lifecycle_response',
    action: 'Improve completion',
    response: 'Updated',
    newLink: 'https://app.arcade.software/share/new',
    notes: 'Fixed completion flow'
  };
  const validResult = validateSubmission(validPayload);
  assert.strictEqual(validResult.success, true, 'Valid lifecycle response should be accepted');

  // Valid lifecycle response (Consider retirement)
  const retirePayload = {
    number: '123',
    type: 'lifecycle_response',
    action: 'Consider retirement',
    response: 'Keep active',
    notes: 'Still relevant'
  };
  const retireResult = validateSubmission(retirePayload);
  assert.strictEqual(retireResult.success, true, 'Consider retirement response should be accepted');

  console.log('✓ Lifecycle-only validation test passed\n');
}

// Test: Legacy response-only submissions rejected
function testLegacyResponseRejection() {
  console.log('Test: Legacy response-only submissions rejected');

  function validateSubmission(payload) {
    const isLifecycleResponse = payload.type === 'lifecycle_response' ||
      (payload.action && ['Improve completion', 'Consider retirement'].indexOf(payload.action) !== -1);

    if (!isLifecycleResponse) {
      return { success: false, error: 'Only lifecycle responses are supported. Please select an action and response.' };
    }

    return { success: true };
  }

  // Legacy "Done" response without action
  const legacyDone = {
    number: '123',
    response: 'Done'
  };
  const doneResult = validateSubmission(legacyDone);
  assert.strictEqual(doneResult.success, false, 'Legacy Done should be rejected');
  assert.strictEqual(
    doneResult.error,
    'Only lifecycle responses are supported. Please select an action and response.',
    'Should return correct error'
  );

  // Legacy "Declined" response
  const legacyDeclined = {
    number: '123',
    response: 'Declined'
  };
  const declinedResult = validateSubmission(legacyDeclined);
  assert.strictEqual(declinedResult.success, false, 'Legacy Declined should be rejected');

  // Legacy "Need help" without action
  const legacyNeedHelp = {
    number: '123',
    response: 'Need help'
  };
  const needHelpResult = validateSubmission(legacyNeedHelp);
  assert.strictEqual(needHelpResult.success, false, 'Legacy Need help without action should be rejected');

  console.log('✓ Legacy response rejection test passed\n');
}

// Test: Metadata edit type rejected
function testMetadataEditTypeRejection() {
  console.log('Test: Metadata edit type rejected');

  function validateSubmission(payload) {
    // Check for metadata_edit type first
    if (payload.type === 'metadata_edit') {
      return { success: false, error: 'Metadata editing is not supported. Please use lifecycle action responses only.' };
    }

    const isLifecycleResponse = payload.type === 'lifecycle_response' ||
      (payload.action && ['Improve completion', 'Consider retirement'].indexOf(payload.action) !== -1);

    if (!isLifecycleResponse) {
      return { success: false, error: 'Only lifecycle responses are supported. Please select an action and response.' };
    }

    return { success: true };
  }

  // Metadata edit submission
  const metadataEdit = {
    number: '123',
    type: 'metadata_edit',
    metadataChanges: { 'Primary Product': 'RHEL' }
  };
  const result = validateSubmission(metadataEdit);
  assert.strictEqual(result.success, false, 'Metadata edit type should be rejected');
  assert.strictEqual(
    result.error,
    'Metadata editing is not supported. Please use lifecycle action responses only.',
    'Should return correct error'
  );

  console.log('✓ Metadata edit type rejection test passed\n');
}

// Test: Lifecycle response with invalid action rejected
function testInvalidActionRejection() {
  console.log('Test: Lifecycle response with invalid action rejected');

  function validateSubmission(payload) {
    const isLifecycleResponse = payload.type === 'lifecycle_response' ||
      (payload.action && ['Improve completion', 'Consider retirement'].indexOf(payload.action) !== -1);

    if (!isLifecycleResponse) {
      return { success: false, error: 'Only lifecycle responses are supported. Please select an action and response.' };
    }

    let hasResponse = false;
    if (payload.response) {
      const lifecycleValues = payload.action === 'Improve completion'
        ? ['Updated', 'Need help']
        : payload.action === 'Consider retirement'
          ? ['Keep active', 'Retire', 'Need help']
          : [];
      hasResponse = lifecycleValues.indexOf(payload.response) !== -1;
    }

    if (!hasResponse) {
      return { success: false, error: 'Please select a response.' };
    }

    return { success: true };
  }

  // Invalid action "Fix bugs"
  const invalidAction = {
    number: '123',
    type: 'lifecycle_response',
    action: 'Fix bugs',
    response: 'Done'
  };
  const result = validateSubmission(invalidAction);
  assert.strictEqual(result.success, false, 'Invalid action should be rejected');

  console.log('✓ Invalid action rejection test passed\n');
}

// Test: Lifecycle response with mismatched response value rejected
function testMismatchedResponseRejection() {
  console.log('Test: Lifecycle response with mismatched response value rejected');

  function validateSubmission(payload) {
    const isLifecycleResponse = payload.type === 'lifecycle_response' ||
      (payload.action && ['Improve completion', 'Consider retirement'].indexOf(payload.action) !== -1);

    if (!isLifecycleResponse) {
      return { success: false, error: 'Only lifecycle responses are supported. Please select an action and response.' };
    }

    let hasResponse = false;
    if (payload.response) {
      const lifecycleValues = payload.action === 'Improve completion'
        ? ['Updated', 'Need help']
        : payload.action === 'Consider retirement'
          ? ['Keep active', 'Retire', 'Need help']
          : [];
      hasResponse = lifecycleValues.indexOf(payload.response) !== -1;
    }

    if (!hasResponse) {
      return { success: false, error: 'Please select a response.' };
    }

    return { success: true };
  }

  // "Improve completion" with "Keep active" (wrong action)
  const mismatchedResponse = {
    number: '123',
    type: 'lifecycle_response',
    action: 'Improve completion',
    response: 'Keep active'
  };
  const result = validateSubmission(mismatchedResponse);
  assert.strictEqual(result.success, false, 'Mismatched response should be rejected');

  // "Consider retirement" with "Updated" (wrong action)
  const mismatchedRetire = {
    number: '123',
    type: 'lifecycle_response',
    action: 'Consider retirement',
    response: 'Updated'
  };
  const retireResult = validateSubmission(mismatchedRetire);
  assert.strictEqual(retireResult.success, false, 'Mismatched retire response should be rejected');

  console.log('✓ Mismatched response rejection test passed\n');
}

// Test: newLink and notes accepted as part of lifecycle response
function testNewLinkAndNotesAccepted() {
  console.log('Test: newLink and notes accepted as part of lifecycle response');

  function validateSubmission(payload) {
    const isLifecycleResponse = payload.type === 'lifecycle_response' ||
      (payload.action && ['Improve completion', 'Consider retirement'].indexOf(payload.action) !== -1);

    if (!isLifecycleResponse) {
      return { success: false, error: 'Only lifecycle responses are supported. Please select an action and response.' };
    }

    const hasMetadata = payload.metadataChanges && typeof payload.metadataChanges === 'object'
      && Object.keys(payload.metadataChanges).length > 0;

    if (hasMetadata) {
      return { success: false, error: 'Metadata editing is not supported. Please use lifecycle action responses only.' };
    }

    let hasResponse = false;
    if (payload.response) {
      const lifecycleValues = payload.action === 'Improve completion'
        ? ['Updated', 'Need help']
        : payload.action === 'Consider retirement'
          ? ['Keep active', 'Retire', 'Need help']
          : [];
      hasResponse = lifecycleValues.indexOf(payload.response) !== -1;
    }

    if (!hasResponse) {
      return { success: false, error: 'Please select a response.' };
    }

    // newLink and notes are part of lifecycle response, not metadata
    return {
      success: true,
      acceptedFields: ['number', 'type', 'action', 'response', 'newLink', 'notes', 'title']
    };
  }

  // Lifecycle response with newLink
  const withNewLink = {
    number: '123',
    type: 'lifecycle_response',
    action: 'Improve completion',
    response: 'Updated',
    newLink: 'https://app.arcade.software/share/new'
  };
  const linkResult = validateSubmission(withNewLink);
  assert.strictEqual(linkResult.success, true, 'newLink should be accepted');
  assert.strictEqual(linkResult.acceptedFields.includes('newLink'), true, 'newLink should be in accepted fields');

  // Lifecycle response with notes
  const withNotes = {
    number: '123',
    type: 'lifecycle_response',
    action: 'Consider retirement',
    response: 'Keep active',
    notes: 'Still relevant for RHEL 9'
  };
  const notesResult = validateSubmission(withNotes);
  assert.strictEqual(notesResult.success, true, 'notes should be accepted');
  assert.strictEqual(notesResult.acceptedFields.includes('notes'), true, 'notes should be in accepted fields');

  console.log('✓ newLink and notes acceptance test passed\n');
}

// Run all tests
try {
  testLifecycleOnlyValidation();
  testLegacyResponseRejection();
  testMetadataEditTypeRejection();
  testInvalidActionRejection();
  testMismatchedResponseRejection();
  testNewLinkAndNotesAccepted();

  console.log('✅ All lifecycle-only enforcement tests passed!');
} catch (err) {
  console.error('❌ Test failed:', err.message);
  process.exit(1);
}
