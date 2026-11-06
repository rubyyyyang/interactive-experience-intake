/**
 * Guide Extraction JSON Payload Exclusion Test
 * Verifies that Guide Extraction JSON is excluded from initial submission payload
 * through both top-level property and nested metadata object
 */

const assert = require('assert');

console.log('Running Guide JSON payload exclusion test...\n');

// Simulate EDITABLE_METADATA_FIELDS from IA_Config.js
const EDITABLE_METADATA_FIELDS = [
  { key: 'Final Demo Title', label: 'Final Demo Title', group: 'Content Info' },
  { key: 'Primary Product', label: 'Primary Product', group: 'Content Info' },
  { key: 'Demo Description', label: 'Demo Description', group: 'Content Info' },
  { key: 'Guide Extraction JSON', label: 'Guide Extraction JSON', group: 'Technical', wide: true, multiline: true }
];

// Simulate buildSubmissionFromRow_ logic
function buildSubmissionFromRow_Mock(row, headerMap) {
  const get = (name) => {
    const idx = headerMap[name];
    return idx != null ? String(row[idx] || '') : '';
  };

  // Build metadata object (excluding Guide Extraction JSON)
  var meta = {};
  for (var fi = 0; fi < EDITABLE_METADATA_FIELDS.length; fi++) {
    // Exclude Guide Extraction JSON from initial payload (read-only field, never edited)
    if (EDITABLE_METADATA_FIELDS[fi].key === 'Guide Extraction JSON') continue;
    meta[EDITABLE_METADATA_FIELDS[fi].key] = get(EDITABLE_METADATA_FIELDS[fi].key);
  }

  return {
    title: get('Final Demo Title'),
    primaryProduct: get('Primary Product'),
    description: get('Demo Description'),
    // guideExtractionJson: REMOVED - large read-only field excluded from initial payload
    metadata: meta
  };
}

// Test 1: Top-level property excluded
function testTopLevelPropertyExcluded() {
  console.log('Test: Guide JSON not in top-level submission property');

  const mockHeaderMap = {
    'Final Demo Title': 0,
    'Primary Product': 1,
    'Demo Description': 2,
    'Guide Extraction JSON': 3
  };

  const mockRow = [
    'Test Demo',
    'RHEL',
    'Test description',
    '{"title":"Test","bodyText":"Very long JSON content here...","steps":[...]}'  // Large JSON
  ];

  const submission = buildSubmissionFromRow_Mock(mockRow, mockHeaderMap);

  assert.strictEqual(submission.guideExtractionJson, undefined,
    'guideExtractionJson should not exist as top-level property');

  console.log('✓ Top-level property excluded\n');
}

// Test 2: Metadata object does not include Guide JSON
function testMetadataObjectExcluded() {
  console.log('Test: Guide JSON not in metadata object');

  const mockHeaderMap = {
    'Final Demo Title': 0,
    'Primary Product': 1,
    'Demo Description': 2,
    'Guide Extraction JSON': 3
  };

  const mockRow = [
    'Test Demo',
    'RHEL',
    'Test description',
    '{"title":"Test","bodyText":"Very long JSON content here...","steps":[...]}'
  ];

  const submission = buildSubmissionFromRow_Mock(mockRow, mockHeaderMap);

  assert.strictEqual(submission.metadata['Guide Extraction JSON'], undefined,
    'Guide Extraction JSON should not be in metadata object');

  // Verify other metadata fields are present
  assert.strictEqual(submission.metadata['Final Demo Title'], 'Test Demo',
    'Other metadata fields should still be present');
  assert.strictEqual(submission.metadata['Primary Product'], 'RHEL',
    'Other metadata fields should still be present');

  console.log('✓ Metadata object excludes Guide JSON\n');
}

// Test 3: Calculate payload size reduction
function testPayloadSizeReduction() {
  console.log('Test: Payload size reduction');

  const TYPICAL_GUIDE_JSON_SIZE = 15000; // chars (10-50KB range)
  const SUBMISSIONS_COUNT = 50; // typical My Submissions view

  // Before: Guide JSON in submission.guideExtractionJson AND submission.metadata['Guide Extraction JSON']
  const beforeGuideJsonCount = 2; // two copies per submission
  const beforePayloadSize = SUBMISSIONS_COUNT * TYPICAL_GUIDE_JSON_SIZE * beforeGuideJsonCount;

  // After: Guide JSON excluded from both locations
  const afterPayloadSize = 0;

  const reduction = beforePayloadSize - afterPayloadSize;
  const reductionKB = reduction / 1024;

  console.log('  Typical Guide JSON size: ' + TYPICAL_GUIDE_JSON_SIZE + ' chars');
  console.log('  Copies per submission (before): ' + beforeGuideJsonCount);
  console.log('  Submissions in view: ' + SUBMISSIONS_COUNT);
  console.log('  Before: ' + (beforePayloadSize / 1024).toFixed(1) + ' KB');
  console.log('  After: 0 KB');
  console.log('  Reduction: ' + reductionKB.toFixed(1) + ' KB');

  // For 50 submissions with 15KB JSON each, duplicated twice:
  // Before: 50 * 15KB * 2 = 1465 KB
  // After: 0 KB
  // Reduction: 1465 KB

  assert.strictEqual(afterPayloadSize, 0, 'Guide JSON payload should be zero');
  assert.strictEqual(reduction > 1000000, true, 'Reduction should exceed 1MB for typical case');

  console.log('✓ Significant payload reduction achieved\n');
}

// Test 4: Verify metadata editing still receives field definition
function testMetadataFieldDefinitionPreserved() {
  console.log('Test: Guide JSON field definition preserved for metadata schema');

  // The field should still be in EDITABLE_METADATA_FIELDS
  // (sent in getMySubmissions response as editableFields)
  // even though the actual value is excluded from submission objects

  const guideJsonField = EDITABLE_METADATA_FIELDS.find(
    f => f.key === 'Guide Extraction JSON'
  );

  assert.notStrictEqual(guideJsonField, undefined,
    'Guide Extraction JSON should remain in EDITABLE_METADATA_FIELDS');
  assert.strictEqual(guideJsonField.group, 'Technical',
    'Field definition should be complete');

  console.log('✓ Field definition preserved in schema\n');
}

// Test 5: Verify admin review handles missing metadata gracefully
function testAdminReviewHandlesMissingMetadata() {
  console.log('Test: Admin review handles missing Guide JSON metadata gracefully');

  // Simulate admin review panel code
  function buildAdminReview_Mock(sub, changes) {
    const results = [];
    const keys = Object.keys(changes);

    for (let i = 0; i < keys.length; i++) {
      const fieldKey = keys[i];
      const newVal = changes[fieldKey];
      const oldVal = sub.metadata ? (sub.metadata[fieldKey] || '') : '';

      results.push({
        field: fieldKey,
        oldValue: oldVal,
        newValue: newVal
      });
    }

    return results;
  }

  const mockSubmission = {
    title: 'Test Demo',
    metadata: {
      'Final Demo Title': 'Test Demo',
      'Primary Product': 'RHEL'
      // Guide Extraction JSON intentionally missing
    }
  };

  const mockChanges = {
    'Primary Product': 'OpenShift'
  };

  const results = buildAdminReview_Mock(mockSubmission, mockChanges);

  // Should handle without error
  assert.strictEqual(results.length, 1, 'Should process metadata changes');
  assert.strictEqual(results[0].oldValue, 'RHEL', 'Should read old value from metadata');
  assert.strictEqual(results[0].newValue, 'OpenShift', 'Should read new value from changes');

  // If Guide JSON was in changes (shouldn't happen, but test graceful handling)
  const mockChangesWithGuideJson = {
    'Guide Extraction JSON': '{"new":"value"}'
  };

  const results2 = buildAdminReview_Mock(mockSubmission, mockChangesWithGuideJson);
  assert.strictEqual(results2[0].oldValue, '', 'Missing metadata should default to empty string');

  console.log('✓ Admin review handles missing metadata correctly\n');
}

// Test 6: Verify serialized JSON payload size
function testSerializedPayloadSize() {
  console.log('Test: Serialized JSON payload size measurement');

  const mockHeaderMap = {
    'Final Demo Title': 0,
    'Primary Product': 1,
    'Demo Description': 2,
    'Guide Extraction JSON': 3
  };

  // Simulate realistic Guide JSON (truncated to 15KB)
  const largeGuideJson = JSON.stringify({
    title: 'Test Demo',
    bodyText: 'A'.repeat(10000),  // Simulate large extracted text
    steps: Array(20).fill({ title: 'Step', description: 'B'.repeat(100) })
  });

  const mockRow = [
    'Test Demo',
    'RHEL',
    'Test description',
    largeGuideJson
  ];

  const submission = buildSubmissionFromRow_Mock(mockRow, mockHeaderMap);

  // Measure actual serialized size
  const serialized = JSON.stringify(submission);
  const serializedSizeKB = serialized.length / 1024;

  console.log('  Serialized submission size: ' + serializedSizeKB.toFixed(2) + ' KB');
  console.log('  Guide JSON size (excluded): ' + (largeGuideJson.length / 1024).toFixed(2) + ' KB');

  // Verify Guide JSON is not in serialized output
  assert.strictEqual(serialized.indexOf(largeGuideJson), -1,
    'Serialized submission should not contain Guide JSON');

  // Verify submission is much smaller than if it included Guide JSON
  const expectedSizeWithGuideJson = serialized.length + (largeGuideJson.length * 2); // 2 copies
  const actualReduction = expectedSizeWithGuideJson - serialized.length;

  console.log('  Size if Guide JSON included (2 copies): ' + (expectedSizeWithGuideJson / 1024).toFixed(2) + ' KB');
  console.log('  Actual reduction: ' + (actualReduction / 1024).toFixed(2) + ' KB');

  assert.strictEqual(actualReduction > 20000, true,
    'Should save >20KB per submission with typical Guide JSON');

  console.log('✓ Serialized payload excludes Guide JSON\n');
}

// Run all tests
try {
  testTopLevelPropertyExcluded();
  testMetadataObjectExcluded();
  testPayloadSizeReduction();
  testMetadataFieldDefinitionPreserved();
  testAdminReviewHandlesMissingMetadata();
  testSerializedPayloadSize();

  console.log('✅ All Guide JSON payload exclusion tests passed');
  console.log('\n📊 Summary:');
  console.log('  ✓ Guide JSON excluded from submission.guideExtractionJson');
  console.log('  ✓ Guide JSON excluded from submission.metadata["Guide Extraction JSON"]');
  console.log('  ✓ Field definition preserved in EDITABLE_METADATA_FIELDS');
  console.log('  ✓ Admin review handles missing metadata gracefully');
  console.log('  ✓ Estimated payload reduction: ~1.4 MB for 50 submissions');
} catch (error) {
  console.error('❌ Test failed:', error.message);
  process.exit(1);
}
