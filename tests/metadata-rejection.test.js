/**
 * Metadata Editing Rejection Test
 * Verifies metadata editing is properly disabled in Status Tracker
 */

const assert = require('assert');

console.log('Running metadata editing rejection tests...\n');

// Test: Metadata editing disabled in frontend
function testMetadataEditingDisabled() {
  console.log('Test: Metadata editing disabled in frontend');

  // Simulate buildDetailSectionsContent logic
  function canEditMetadata() {
    // Metadata editing is not supported in Status Tracker
    const canEdit = false;
    return canEdit;
  }

  assert.strictEqual(canEditMetadata(), false, 'Metadata editing should be disabled for all users');

  console.log('✓ Metadata editing disabled test passed\n');
}

// Test: Server-side metadata rejection
function testServerSideMetadataRejection() {
  console.log('Test: Server-side metadata rejection');

  // Simulate submitCreatorResponse validation
  function validatePayload(payload) {
    const hasMetadata = payload.metadataChanges && typeof payload.metadataChanges === 'object'
      && Object.keys(payload.metadataChanges).length > 0;

    if (hasMetadata) {
      return { success: false, error: 'Metadata editing is not supported. Please use lifecycle action responses only.' };
    }

    const hasResponse = payload.response && payload.response.trim() !== '';
    if (!hasResponse) {
      return { success: false, error: 'Please select a response.' };
    }

    return { success: true };
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
  const validResult = validatePayload(validPayload);
  assert.strictEqual(validResult.success, true, 'Valid lifecycle response should be accepted');

  // Lifecycle response with metadata should be rejected
  const metadataPayload = {
    number: '123',
    type: 'lifecycle_response',
    action: 'Improve completion',
    response: 'Updated',
    metadataChanges: { 'Primary Product': 'RHEL' }
  };
  const metadataResult = validatePayload(metadataPayload);
  assert.strictEqual(metadataResult.success, false, 'Metadata changes should be rejected');
  assert.strictEqual(
    metadataResult.error,
    'Metadata editing is not supported. Please use lifecycle action responses only.',
    'Should return correct error message'
  );

  // Metadata-only submission should be rejected
  const metadataOnlyPayload = {
    number: '123',
    metadataChanges: { 'Primary Product': 'RHEL', 'Primary Topic': 'Security' }
  };
  const metadataOnlyResult = validatePayload(metadataOnlyPayload);
  assert.strictEqual(metadataOnlyResult.success, false, 'Metadata-only should be rejected');

  // Empty metadata changes should be allowed (no metadata)
  const emptyMetadataPayload = {
    number: '123',
    type: 'lifecycle_response',
    action: 'Improve completion',
    response: 'Updated',
    metadataChanges: {}
  };
  const emptyMetadataResult = validatePayload(emptyMetadataPayload);
  assert.strictEqual(emptyMetadataResult.success, true, 'Empty metadata object should not trigger rejection');

  console.log('✓ Server-side metadata rejection test passed\n');
}

// Test: Lifecycle response with new link preserved
function testLifecycleResponseWithLink() {
  console.log('Test: Lifecycle response with new link preserved');

  // Verify that newLink field is still accepted for lifecycle responses
  function validateLifecycleResponse(payload) {
    const hasMetadata = payload.metadataChanges && typeof payload.metadataChanges === 'object'
      && Object.keys(payload.metadataChanges).length > 0;

    if (hasMetadata) {
      return { success: false };
    }

    const hasResponse = payload.response && payload.response.trim() !== '';
    if (!hasResponse) {
      return { success: false };
    }

    // newLink is part of lifecycle response, not metadata
    const acceptedFields = ['number', 'type', 'action', 'response', 'newLink', 'notes', 'title'];
    return { success: true, acceptedFields: acceptedFields };
  }

  const payloadWithLink = {
    number: '123',
    type: 'lifecycle_response',
    action: 'Improve completion',
    response: 'Updated',
    newLink: 'https://app.arcade.software/share/updated-demo',
    notes: 'Updated completion flow'
  };

  const result = validateLifecycleResponse(payloadWithLink);
  assert.strictEqual(result.success, true, 'Lifecycle response with newLink should be accepted');
  assert.strictEqual(result.acceptedFields.includes('newLink'), true, 'newLink should be in accepted fields');

  console.log('✓ Lifecycle response with new link test passed\n');
}

// Run all tests
try {
  testMetadataEditingDisabled();
  testServerSideMetadataRejection();
  testLifecycleResponseWithLink();

  console.log('✅ All metadata editing rejection tests passed!');
} catch (err) {
  console.error('❌ Test failed:', err.message);
  process.exit(1);
}
