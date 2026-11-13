/**
 * Reports Admin Access Tests
 * Tests that Reports tab is admin-only
 */

const assert = require('assert');
const fs = require('fs');

console.log('Running Reports admin access tests...\n');

const html = fs.readFileSync('/Users/rubyyang/arcade-intake-app/StatusTracker.html', 'utf8');

function testReportsTabHidden() {
  console.log('Test: Reports tab hidden for non-admin users');

  // Verify Reports tab button exists
  const reportsTab = html.match(/<button[^>]*data-tab="reports"[^>]*>/);
  assert.ok(reportsTab, 'Reports tab button should exist');

  // Should have id for programmatic access
  const hasId = /id="reportsTab"/.test(html);
  assert.ok(hasId, 'Reports tab should have id="reportsTab"');

  // Should be hidden by default (style="display:none;")
  const hiddenByDefault = /<button[^>]*data-tab="reports"[^>]*style="display:none;"/.test(html);
  assert.ok(hiddenByDefault, 'Reports tab should be hidden by default with style="display:none;"');

  console.log('  ✓ Reports tab hidden for non-admin users\n');
}

function testSwitchTabPreventsNonAdminAccess() {
  console.log('Test: switchTab prevents non-admin access to reports');

  // Find switchTab function
  const switchTabFn = html.match(/function switchTab\(tab\) \{[\s\S]+?\n\s+\}/);
  assert.ok(switchTabFn, 'switchTab function should exist');

  // Should check isAdmin before allowing reports tab
  const checksAdmin = /tab === 'reports'.*!isAdmin/.test(switchTabFn[0]);
  assert.ok(checksAdmin, 'switchTab should check !isAdmin for reports tab');

  // Should return early for non-admin
  const hasReturn = /if \(tab === 'reports' && !isAdmin\)[\s\S]{0,100}return/.test(switchTabFn[0]);
  assert.ok(hasReturn, 'switchTab should return early for non-admin on reports');

  console.log('  ✓ switchTab prevents non-admin access to reports\n');
}

function testAdminShowsReportsTab() {
  console.log('Test: Admin users can see Reports tab');

  // Should have logic to show Reports tab for admins in initStatusTracker
  const showsForAdmin = /if \(isAdmin\)[\s\S]{0,200}reportsTab[\s\S]{0,100}display/.test(html);
  assert.ok(showsForAdmin, 'Should show Reports tab for admin users');

  console.log('  ✓ Admin users can see Reports tab\n');
}

// Run all tests
try {
  testReportsTabHidden();
  testSwitchTabPreventsNonAdminAccess();
  testAdminShowsReportsTab();

  console.log('✅ All Reports admin access tests passed');
} catch (error) {
  console.error('❌ Test failed:', error.message);
  process.exit(1);
}
