/**
 * Admin State Refresh Test
 * Verifies admin actions immediately update UI state without manual refresh
 */

const assert = require('assert');
const fs = require('fs');

console.log('Running admin state refresh test...\n');

const html = fs.readFileSync('/Users/rubyyang/arcade-intake-app/StatusTracker.html', 'utf8');

function testRefreshSubmissionsExists() {
  console.log('Test: refreshSubmissions function exists');

  const hasFunction = /function refreshSubmissions\(\)/.test(html);

  assert.ok(hasFunction, 'Should have refreshSubmissions function');
  console.log('  ✓ refreshSubmissions function exists\n');
}

function testRefreshSubmissionsCallsReload() {
  console.log('Test: refreshSubmissions calls reloadSubmissions');

  // Should call reloadSubmissions(), not the non-existent loadSubmissions()
  const callsReload = /function refreshSubmissions[\s\S]{0,300}reloadSubmissions\(\)/.test(html);
  // Check for the wrong function name (excluding "re" prefix)
  const callsWrongFunction = /function refreshSubmissions[\s\S]{0,300}[^a-z]loadSubmissions\(\)/.test(html);

  assert.ok(callsReload, 'Should call reloadSubmissions()');
  assert.strictEqual(callsWrongFunction, false, 'Should NOT call non-existent loadSubmissions()');

  console.log('  ✓ Calls correct reload function\n');
}

function testRefreshSubmissionsClosesDetails() {
  console.log('Test: refreshSubmissions closes detail rows before reload');

  const closesDetailRows = /function refreshSubmissions[\s\S]{0,200}\.detail-row.*remove/.test(html);
  const collapsesExpanded = /function refreshSubmissions[\s\S]{0,200}\.expanded.*remove/.test(html);

  assert.ok(closesDetailRows, 'Should close detail rows');
  assert.ok(collapsesExpanded, 'Should collapse expanded rows');

  console.log('  ✓ Closes detail rows before reload\n');
}

function testAdminRequestChangesCallsRefresh() {
  console.log('Test: adminRequestChanges calls refreshSubmissions on success');

  const callsRefresh = /function adminRequestChanges[\s\S]{0,600}refreshSubmissions\(\)/.test(html);

  assert.ok(callsRefresh, 'Should call refreshSubmissions() after successful request changes');
  console.log('  ✓ adminRequestChanges calls refreshSubmissions\n');
}

function testAdminApproveCallsRefresh() {
  console.log('Test: adminApprove calls refreshSubmissions on success');

  const callsRefresh = /function adminApprove[\s\S]{0,400}refreshSubmissions\(\)/.test(html);

  assert.ok(callsRefresh, 'Should call refreshSubmissions() after successful approve');
  console.log('  ✓ adminApprove calls refreshSubmissions\n');
}

function testAdminApproveRetirementCallsRefresh() {
  console.log('Test: adminApproveRetirement calls refreshSubmissions on success');

  const callsRefresh = /function adminApproveRetirement[\s\S]{0,1500}refreshSubmissions\(\)/.test(html);

  assert.ok(callsRefresh, 'Should call refreshSubmissions() after successful retirement');
  console.log('  ✓ adminApproveRetirement calls refreshSubmissions\n');
}

function testReloadSubmissionsExists() {
  console.log('Test: reloadSubmissions function exists and fetches data');

  const hasFunction = /function reloadSubmissions\(\)/.test(html);
  const callsGetMySubmissions = /function reloadSubmissions[\s\S]{0,1000}getMySubmissions\(\)/.test(html);
  const updatesAllSubmissions = /allSubmissions = result\.submissions/.test(html);

  assert.ok(hasFunction, 'Should have reloadSubmissions function');
  assert.ok(callsGetMySubmissions, 'Should call getMySubmissions()');
  assert.ok(updatesAllSubmissions, 'Should update allSubmissions array');

  console.log('  ✓ reloadSubmissions fetches fresh data\n');
}

function testReloadSubmissionsRendersTable() {
  console.log('Test: reloadSubmissions renders table after loading data');

  const callsRenderTable = /function reloadSubmissions[\s\S]{0,1000}renderTable\(\)/.test(html);

  assert.ok(callsRenderTable, 'Should call renderTable() to update display');
  console.log('  ✓ reloadSubmissions renders table\n');
}

function testNoLoadSubmissionsFunction() {
  console.log('Test: No loadSubmissions function exists (should use reloadSubmissions)');

  const hasLoadSubmissions = /function loadSubmissions\(\)/.test(html);

  assert.strictEqual(hasLoadSubmissions, false, 'Should NOT have loadSubmissions function (use reloadSubmissions instead)');
  console.log('  ✓ No duplicate loadSubmissions function\n');
}

// Run all tests
try {
  testRefreshSubmissionsExists();
  testRefreshSubmissionsCallsReload();
  testRefreshSubmissionsClosesDetails();
  testAdminRequestChangesCallsRefresh();
  testAdminApproveCallsRefresh();
  testAdminApproveRetirementCallsRefresh();
  testReloadSubmissionsExists();
  testReloadSubmissionsRendersTable();
  testNoLoadSubmissionsFunction();

  console.log('✅ All admin state refresh tests passed');
  console.log('\n📋 Summary:');
  console.log('  ✓ refreshSubmissions calls reloadSubmissions (not loadSubmissions)');
  console.log('  ✓ All admin actions call refreshSubmissions on success');
  console.log('  ✓ reloadSubmissions fetches fresh data and renders table');
  console.log('  ✓ UI updates immediately without manual browser refresh');
} catch (error) {
  console.error('❌ Test failed:', error.message);
  process.exit(1);
}
