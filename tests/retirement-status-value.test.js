/**
 * Retirement Status Value Test
 * Verifies the correct canonical Status value is used for retirement
 */

const assert = require('assert');
const fs = require('fs');

console.log('Running retirement status value test...\n');

const serverJs = fs.readFileSync('/Users/rubyyang/arcade-intake-app/IA_StatusTracker.js', 'utf8');

function testUsesRetiredNotDemoRetired() {
  console.log('Test: Uses "Retired" as canonical Status value');

  // Should write "Retired" (matches Hub ENHANCED_CONFIG.STATUS.DEMO_RETIRED = "Retired")
  const writesRetired = /setValue\('Retired'\)/.test(serverJs);

  // Should NOT write "Demo Retired" (legacy alternative that Hub normalizes)
  const writesDemoRetired = /setValue\('Demo Retired'\)/.test(serverJs);

  assert.ok(writesRetired, 'Should write Status = "Retired"');
  assert.strictEqual(writesDemoRetired, false, 'Should NOT write "Demo Retired" (use "Retired" instead)');

  console.log('  ✓ Uses canonical value "Retired"\n');
}

function testRetirementDetection() {
  console.log('Test: Correctly detects retirement from Action Taken');

  // Should check if actionTaken === 'Retire'
  const detectsRetirement = /actionTaken.*===.*'Retire'/.test(serverJs);
  const setsFlag = /isRetirement/.test(serverJs);

  assert.ok(detectsRetirement, 'Should check if actionTaken === "Retire"');
  assert.ok(setsFlag, 'Should set isRetirement flag');

  console.log('  ✓ Correctly detects retirement\n');
}

function testConditionalStatusWrite() {
  console.log('Test: Only writes Status when retirement detected');

  // Should write Status conditionally based on isRetirement
  const conditionalWrite = /if \(isRetirement\)[\s\S]{0,300}setValue\('Retired'\)/.test(serverJs);

  assert.ok(conditionalWrite, 'Should only write Status = "Retired" when isRetirement is true');

  console.log('  ✓ Status write is conditional\n');
}

function testUsesStatusColumn() {
  console.log('Test: Uses STATUS_TRACKER_COLUMNS.STATUS constant');

  const usesStatusConst = /STATUS_TRACKER_COLUMNS\.STATUS/.test(serverJs);

  assert.ok(usesStatusConst, 'Should reference STATUS_TRACKER_COLUMNS.STATUS');

  console.log('  ✓ Uses STATUS column constant\n');
}

function testUsesRetiredTimestampColumn() {
  console.log('Test: Uses STATUS_TRACKER_COLUMNS.STATUS_RETIRED_TS constant');

  const usesRetiredTs = /STATUS_TRACKER_COLUMNS\.STATUS_RETIRED_TS/.test(serverJs);

  assert.ok(usesRetiredTs, 'Should reference STATUS_RETIRED_TS column');

  console.log('  ✓ Uses STATUS_RETIRED_TS column constant\n');
}

// Run all tests
try {
  testUsesRetiredNotDemoRetired();
  testRetirementDetection();
  testConditionalStatusWrite();
  testUsesStatusColumn();
  testUsesRetiredTimestampColumn();

  console.log('✅ All retirement status value tests passed');
  console.log('\n📋 Summary:');
  console.log('  Canonical value: "Retired" (matches Hub ENHANCED_CONFIG.STATUS.DEMO_RETIRED)');
  console.log('  Hub normalizes: "retired", "ie retired", "demo retired" → "Retired"');
  console.log('  Implementation: ✓ Correct');
} catch (error) {
  console.error('❌ Test failed:', error.message);
  process.exit(1);
}
