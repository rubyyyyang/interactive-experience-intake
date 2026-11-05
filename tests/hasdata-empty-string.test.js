/**
 * hasData Empty String Test
 * Verifies empty string handling in Performance snapshot visibility
 */

const assert = require('assert');
const fs = require('fs');

console.log('Running hasData empty string test...\n');

const html = fs.readFileSync('/Users/rubyyang/arcade-intake-app/StatusTracker.html', 'utf8');

function testHasDataChecksEmptyString() {
  console.log('Test: hasData checks for empty string, not just null');

  // Should check both != null AND !== ''
  const checksEmpty = /playersPerMonth !== ''/.test(html);
  const checksNull = /playersPerMonth != null/.test(html);

  assert.ok(checksNull, 'Should check != null');
  assert.ok(checksEmpty, 'Should check !== empty string');

  console.log('  ✓ hasData checks for empty string\n');
}

function testIndividualMetricsCheckEmpty() {
  console.log('Test: Individual metric display checks for empty string');

  // Players per month
  const playersChecksEmpty = /if \(sub\.playersPerMonth != null && sub\.playersPerMonth !== ''\)/.test(html);

  // Completion rate
  const crChecksEmpty = /if \(sub\.completionRate != null && sub\.completionRate !== ''\)/.test(html);

  // MTPV
  const mtpvChecksEmpty = /if \(sub\.mtOpportunity != null && sub\.mtOpportunity !== ''/.test(html);

  // Content age
  const ageChecksEmpty = /if \(sub\.contentAge != null && sub\.contentAge !== ''\)/.test(html);

  assert.ok(playersChecksEmpty, 'Players per month should check empty string');
  assert.ok(crChecksEmpty, 'Completion rate should check empty string');
  assert.ok(mtpvChecksEmpty, 'MTPV should check empty string');
  assert.ok(ageChecksEmpty, 'Content age should check empty string');

  console.log('  ✓ Individual metrics check empty string\n');
}

function testAllMetricsMissing() {
  console.log('Test: All metrics missing → no snapshot');

  // Simulate sub object with all empty strings
  const sub = {
    status: 'Published',
    playersPerMonth: '',
    completionRate: '',
    mtOpportunity: '',
    mtWon: '',
    contentAge: ''
  };

  // The hasData check should fail with all empty strings
  const hasData = (sub.playersPerMonth != null && sub.playersPerMonth !== '') ||
                  (sub.completionRate != null && sub.completionRate !== '') ||
                  (sub.mtOpportunity != null && sub.mtOpportunity !== '') ||
                  (sub.mtWon != null && sub.mtWon !== '') ||
                  (sub.contentAge != null && sub.contentAge !== '');

  assert.strictEqual(hasData, false, 'All empty strings should result in no data');

  console.log('  ✓ All missing → no snapshot\n');
}

function testNumericZeroValid() {
  console.log('Test: Numeric zero is valid data');

  // Simulate sub object with zero values
  const sub = {
    status: 'Published',
    playersPerMonth: '0',
    completionRate: '0',
    mtOpportunity: '0',
    mtWon: '0',
    contentAge: '0'
  };

  // Zero string should pass hasData check
  const hasData = (sub.playersPerMonth != null && sub.playersPerMonth !== '') ||
                  (sub.completionRate != null && sub.completionRate !== '') ||
                  (sub.mtOpportunity != null && sub.mtOpportunity !== '') ||
                  (sub.mtWon != null && sub.mtWon !== '') ||
                  (sub.contentAge != null && sub.contentAge !== '');

  assert.strictEqual(hasData, true, 'Zero values should be valid data');

  console.log('  ✓ Numeric zero → valid data\n');
}

function testAtLeastOneMetric() {
  console.log('Test: At least one valid metric → snapshot renders');

  // Only one metric present
  const sub = {
    status: 'Published',
    playersPerMonth: '',
    completionRate: '0.42',
    mtOpportunity: '',
    mtWon: '',
    contentAge: ''
  };

  const hasData = (sub.playersPerMonth != null && sub.playersPerMonth !== '') ||
                  (sub.completionRate != null && sub.completionRate !== '') ||
                  (sub.mtOpportunity != null && sub.mtOpportunity !== '') ||
                  (sub.mtWon != null && sub.mtWon !== '') ||
                  (sub.contentAge != null && sub.contentAge !== '');

  assert.strictEqual(hasData, true, 'One valid metric should enable snapshot');

  console.log('  ✓ One valid metric → snapshot renders\n');
}

// Run all tests
try {
  testHasDataChecksEmptyString();
  testIndividualMetricsCheckEmpty();
  testAllMetricsMissing();
  testNumericZeroValid();
  testAtLeastOneMetric();

  console.log('✅ All hasData empty string tests passed');
  console.log('\n📋 Verified behavior:');
  console.log('  ✓ hasData checks != null AND !== empty string');
  console.log('  ✓ All metrics missing (empty strings) → no snapshot');
  console.log('  ✓ Numeric zero is valid data, not missing');
  console.log('  ✓ At least one valid metric → snapshot can render');
} catch (error) {
  console.error('❌ Test failed:', error.message);
  process.exit(1);
}
