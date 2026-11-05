/**
 * Retirement Form ID Regression Test
 * Verifies retirement response select ID matches submitLifecycleResponse expectations
 */

const assert = require('assert');
const fs = require('fs');

console.log('Running retirement form ID regression test...\n');

const html = fs.readFileSync('/tmp/intake-lifecycle-test/StatusTracker.html', 'utf8');

function testRetirementSelectIdConsistency() {
  console.log('Test: Retirement select ID matches submit handler expectations');

  // Find the retirement form select element (contains showHelperText with Keep active/Retire/Need help)
  const retireSelectPattern = /id="resp-sel-' \+ num \+ '" onchange="showHelperText\(this, \\'helper-text-retire-.*?Keep active.*?Retire.*?Need help/;
  const retireSelectMatch = html.match(retireSelectPattern);

  assert.ok(retireSelectMatch, 'Should find retirement select element with showHelperText and three retirement options');
  console.log('  Found retirement select ID pattern: resp-sel-{num}');

  // Verify the exact options exist
  const optionsPattern = /<option value="Keep active">Keep active<\/option>.*?<option value="Retire">Retire<\/option>.*?<option value="Need help">I need help<\/option>/s;
  assert.ok(html.match(optionsPattern), 'Should have Keep active, Retire, and Need help options');

  // Find submitLifecycleResponse function
  const submitFnMatch = html.match(/function submitLifecycleResponse\(num, action\)[\s\S]{0,200}getElementById\('resp-sel-' \+ num\)\.value/);
  assert.ok(submitFnMatch, 'submitLifecycleResponse should look for resp-sel-{num}');

  console.log('✓ Retirement select ID matches submit handler\n');
}

function testUpdateSelectIdConsistency() {
  console.log('Test: Update needed select ID matches submit handler expectations');

  // Find the Update needed form select element
  const updateSelectPattern = /id="resp-sel-' \+ num \+ '" onchange="handleUpdateNeededSelection/;
  const updateSelectMatch = html.match(updateSelectPattern);

  assert.ok(updateSelectMatch, 'Should find Update needed select element with handleUpdateNeededSelection');
  console.log('  Found Update needed select ID pattern: resp-sel-{num}');

  // Verify the Update options exist
  const updateOptionsPattern = /<option value="Updated">I\\'ve updated it<\/option>.*?<option value="Need help">I need help<\/option>/s;
  assert.ok(html.match(updateOptionsPattern), 'Should have Updated and Need help options');

  console.log('✓ Update needed select ID matches submit handler\n');
}

function testRetirementResponseValues() {
  console.log('Test: Retirement response values are correctly defined');

  const keepActiveMatch = html.match(/<option value="Keep active">Keep active<\/option>/);
  const retireMatch = html.match(/<option value="Retire">Retire<\/option>/);
  const needHelpMatch = html.match(/<option value="Need help">I need help<\/option>/);

  assert.ok(keepActiveMatch, 'Should have "Keep active" option');
  assert.ok(retireMatch, 'Should have "Retire" option');
  assert.ok(needHelpMatch, 'Should have "Need help" option (displayed as "I need help")');
  console.log('  Found response values: "Keep active", "Retire", "Need help"');

  console.log('✓ Retirement response values are correct\n');
}

function testNoRetireSuffixedIds() {
  console.log('Test: No resp-sel-retire-{num} IDs exist');

  const retireSuffixMatch = html.match(/id="resp-sel-retire-/);
  assert.strictEqual(retireSuffixMatch, null, 'Should NOT find any resp-sel-retire-{num} IDs');

  console.log('✓ No resp-sel-retire- IDs found\n');
}

// Run all tests
try {
  testRetirementSelectIdConsistency();
  testUpdateSelectIdConsistency();
  testRetirementResponseValues();
  testNoRetireSuffixedIds();

  console.log('✅ All retirement form ID regression tests passed');
} catch (error) {
  console.error('❌ Test failed:', error.message);
  process.exit(1);
}
