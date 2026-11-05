/**
 * Performance Timestamp Test
 * Verifies Developer Metadata timestamp for Last refreshed
 */

const assert = require('assert');
const fs = require('fs');

console.log('Running performance timestamp test...\n');

const hubPerf = fs.readFileSync('/Users/rubyyang/Arcade Finder/RM_Performance.js', 'utf8');
const intakeTracker = fs.readFileSync('/Users/rubyyang/arcade-intake-app/IA_StatusTracker.js', 'utf8');

function testHubRecordsTimestamp() {
  console.log('Test: Hub records timestamp after successful refresh');

  // Should use DOCUMENT visibility for cross-project access
  const usesDocumentVisibility = /SpreadsheetApp\.DeveloperMetadataVisibility\.DOCUMENT/.test(hubPerf);

  // Should use exact key name
  const usesCorrectKey = /PERFORMANCE_LAST_REFRESHED_AT/.test(hubPerf);

  // Should record ISO timestamp
  const recordsISOTimestamp = /new Date\(\)\.toISOString\(\)/.test(hubPerf);

  // Should update existing metadata, not create duplicates
  const updatesExisting = /existingMetadata\[0\]\.setValue/.test(hubPerf);
  const createsIfMissing = /addDeveloperMetadata/.test(hubPerf);

  assert.ok(usesDocumentVisibility, 'Should use DOCUMENT visibility for cross-project access');
  assert.ok(usesCorrectKey, 'Should use key PERFORMANCE_LAST_REFRESHED_AT');
  assert.ok(recordsISOTimestamp, 'Should record ISO timestamp');
  assert.ok(updatesExisting, 'Should update existing metadata');
  assert.ok(createsIfMissing, 'Should create metadata if missing');

  console.log('  ✓ Hub records timestamp with correct metadata\n');
}

function testHubTimestampAfterCompletion() {
  console.log('Test: Timestamp recorded after validation completes');

  // Timestamp should be after validation errors log
  const timestampAfterValidation = /validationErrors.*[\s\S]{0,500}PERFORMANCE_LAST_REFRESHED_AT/.test(hubPerf);

  assert.ok(timestampAfterValidation, 'Should record timestamp after validation completes');

  console.log('  ✓ Timestamp recorded after successful completion\n');
}

function testHubCatchesTimestampErrors() {
  console.log('Test: Hub catches timestamp errors without failing refresh');

  // Should wrap in try/catch
  const hasTry = /try \{[\s\S]{0,800}PERFORMANCE_LAST_REFRESHED_AT/.test(hubPerf);
  const hasCatch = /\} catch \(metadataError\)/.test(hubPerf);

  // Should log warning, not throw
  const logsWarning = /Warning: Could not record refresh timestamp/.test(hubPerf);

  assert.ok(hasTry, 'Should have try block around timestamp logic');
  assert.ok(hasCatch, 'Should have catch block for metadata errors');
  assert.ok(logsWarning, 'Should log warning on error');

  console.log('  ✓ Timestamp errors caught and logged\n');
}

function testIntakeReadsTimestamp() {
  console.log('Test: Intake reads timestamp from shared spreadsheet');

  // Should use same key
  const usesCorrectKey = /PERFORMANCE_LAST_REFRESHED_AT/.test(intakeTracker);

  // Should use DOCUMENT visibility
  const usesDocumentVisibility = /SpreadsheetApp\.DeveloperMetadataVisibility\.DOCUMENT/.test(intakeTracker);

  // Should filter by key and visibility
  const filtersByKeyAndVisibility = /getKey\(\) === 'PERFORMANCE_LAST_REFRESHED_AT'[\s\S]{0,200}getVisibility\(\) === SpreadsheetApp\.DeveloperMetadataVisibility\.DOCUMENT/.test(intakeTracker);

  assert.ok(usesCorrectKey, 'Should use same key as Hub');
  assert.ok(usesDocumentVisibility, 'Should use DOCUMENT visibility');
  assert.ok(filtersByKeyAndVisibility, 'Should filter by key AND visibility');

  console.log('  ✓ Intake reads timestamp correctly\n');
}

function testIntakeHandlesMissingTimestamp() {
  console.log('Test: Intake handles missing timestamp gracefully');

  // Should return null if no metadata found
  const returnsNullIfMissing = /metadata\.length > 0[\s\S]{0,300}timestamp: null/.test(intakeTracker);

  assert.ok(returnsNullIfMissing, 'Should return null if metadata missing');

  console.log('  ✓ Missing timestamp handled gracefully\n');
}

function testIntakeCatchesReadErrors() {
  console.log('Test: Intake catches read errors');

  // Should wrap in try/catch
  const hasTryCatch = /function getPerformanceLastRefreshed[\s\S]{0,500}try \{[\s\S]{0,500}\} catch \(e\)/.test(intakeTracker);

  // Should return error object
  const returnsError = /return \{ success: false, error:/.test(intakeTracker);

  assert.ok(hasTryCatch, 'Should wrap in try/catch');
  assert.ok(returnsError, 'Should return error object');

  console.log('  ✓ Read errors caught\n');
}

function testNoScriptProperties() {
  console.log('Test: Does NOT use Script Properties (not shared across projects)');

  const hubUsesScriptProps = /PropertiesService\.getScriptProperties\(\)\.setProperty\('PERFORMANCE_LAST_REFRESHED/.test(hubPerf);
  const intakeReadsScriptProps = /PropertiesService\.getScriptProperties\(\)\.getProperty\('PERFORMANCE_LAST_REFRESHED/.test(intakeTracker);

  assert.strictEqual(hubUsesScriptProps, false, 'Hub should NOT use Script Properties for timestamp');
  assert.strictEqual(intakeReadsScriptProps, false, 'Intake should NOT use Script Properties for timestamp');

  console.log('  ✓ Correctly uses Developer Metadata, not Script Properties\n');
}

function testTimestampNotPerDemo() {
  console.log('Test: Single shared timestamp, not per-demo column');

  // Should not write to a column
  const writesToColumn = /PERFORMANCE_LAST_REFRESHED[\s\S]{0,200}setValues/.test(hubPerf);

  assert.strictEqual(writesToColumn, false, 'Should NOT write timestamp to column');

  console.log('  ✓ Uses shared metadata, not per-demo column\n');
}

// Run all tests
try {
  testHubRecordsTimestamp();
  testHubTimestampAfterCompletion();
  testHubCatchesTimestampErrors();
  testIntakeReadsTimestamp();
  testIntakeHandlesMissingTimestamp();
  testIntakeCatchesReadErrors();
  testNoScriptProperties();
  testTimestampNotPerDemo();

  console.log('✅ All performance timestamp tests passed');
  console.log('\n📋 Verified behavior:');
  console.log('  ✓ Hub records ISO timestamp after successful refresh');
  console.log('  ✓ Uses Developer Metadata with DOCUMENT visibility');
  console.log('  ✓ Updates existing metadata, no duplicates');
  console.log('  ✓ Intake reads from shared spreadsheet metadata');
  console.log('  ✓ Missing timestamp handled gracefully');
  console.log('  ✓ Errors caught without failing refresh');
  console.log('  ✓ Single shared timestamp, not per-demo');
} catch (error) {
  console.error('❌ Test failed:', error.message);
  process.exit(1);
}
