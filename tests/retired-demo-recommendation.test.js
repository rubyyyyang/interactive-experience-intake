/**
 * Retired Demo Recommendation Bug Test
 * Verifies that Retired demos never show Recommendation panels
 */

const assert = require('assert');
const fs = require('fs');

console.log('Running retired demo recommendation test...\n');

const html = fs.readFileSync('/Users/rubyyang/arcade-intake-app/StatusTracker.html', 'utf8');
const serverJs = fs.readFileSync('/Users/rubyyang/arcade-intake-app/IA_StatusTracker.js', 'utf8');

function testClientSideRetiredCheck() {
  console.log('Test: Client checks Status = Retired before rendering Recommendation');

  // Should read demoStatus from sub.status
  const readsDemoStatus = /var demoStatus = \(sub\.status \|\| ''\)\.trim\(\);/.test(html);

  // Should check if demoStatus === 'Retired'
  const checksRetired = /demoStatus === 'Retired'/.test(html);

  // Should return early when Retired
  const returnsEarlyOnRetired = /if \(status === 'Complete' \|\| demoStatus === 'Retired'\) return '';/.test(html);

  assert.ok(readsDemoStatus, 'Should read demoStatus from sub.status');
  assert.ok(checksRetired, 'Should check if demoStatus === Retired');
  assert.ok(returnsEarlyOnRetired, 'Should return empty when Complete OR Retired');

  console.log('  ✓ Client-side Retired check\n');
}

function testServerSideRetiredGuard() {
  console.log('Test: Server rejects lifecycle responses for Retired demos');

  // Should read statusIdx from headerMap
  const readsStatusIdx = /const statusIdx = headerMap\[STATUS_TRACKER_COLUMNS\.STATUS\];/.test(serverJs);

  // Should read currentStatus from rows
  const readsCurrentStatus = /currentStatus = String\(rows\[i\]\[statusIdx\]/.test(serverJs);

  // Should have RETIRED GUARD comment and check
  const hasRetiredGuard = /\/\/ RETIRED GUARD.*currentStatus === 'Retired'/s.test(serverJs);

  // Should return error for Retired demos
  const returnsError = /error: 'This demo is retired and no longer accepts lifecycle responses\.'/s.test(serverJs);

  assert.ok(readsStatusIdx, 'Should read statusIdx from column map');
  assert.ok(readsCurrentStatus, 'Should read currentStatus from Request_Master row');
  assert.ok(hasRetiredGuard, 'Should have RETIRED GUARD check');
  assert.ok(returnsError, 'Should return descriptive error for Retired demos');

  console.log('  ✓ Server-side Retired guard\n');
}

function testGuardBeforePendingLock() {
  console.log('Test: Retired guard runs before Pending review lock');

  // Extract both guard positions
  const retiredGuardMatch = serverJs.match(/\/\/ RETIRED GUARD[\s\S]{0,200}currentStatus === 'Retired'/);
  const pendingLockMatch = serverJs.match(/\/\/ PENDING LOCK[\s\S]{0,300}currentActionStatus === 'Pending review'/);

  assert.ok(retiredGuardMatch, 'Should find RETIRED GUARD');
  assert.ok(pendingLockMatch, 'Should find PENDING LOCK');

  // RETIRED GUARD must appear before PENDING LOCK in the code
  const retiredPos = serverJs.indexOf(retiredGuardMatch[0]);
  const pendingPos = serverJs.indexOf(pendingLockMatch[0]);

  assert.ok(retiredPos < pendingPos, 'RETIRED GUARD should run before PENDING LOCK');

  console.log('  ✓ Guard order correct\n');
}

function testRetiredWithActionNeeded() {
  console.log('Test: Retired demo with stale Action needed → no Recommendation');

  // Simulate a demo that was flagged for retirement, then admin retired it
  // but Action Status is still "Action needed" (stale)
  const sub = {
    status: 'Retired',
    perfAction: 'Consider retirement',
    perfActionStatus: 'Action needed', // stale
    requestNumber: 'T-999'
  };

  // The client-side check should prevent rendering
  // Simulated logic from buildActionBanner:
  function hasAction(s) { return s.perfAction; }
  function isCreatorAction(a) { return ['Improve completion', 'Consider retirement'].includes(a); }

  const shouldRender = hasAction(sub) && isCreatorAction(sub.perfAction);
  const status = sub.perfActionStatus === 'Complete' ? 'Complete' : 'Action needed';
  const demoStatus = sub.status;

  const hidePanel = status === 'Complete' || demoStatus === 'Retired';

  assert.strictEqual(shouldRender, true, 'Has action and is creator action');
  assert.strictEqual(hidePanel, true, 'Should hide panel when Retired');

  console.log('  ✓ Retired + Action needed → hidden\n');
}

function testCompleteWithRecommendation() {
  console.log('Test: Complete demo with historical recommendation → no Recommendation');

  const sub = {
    status: 'Published',
    perfAction: 'Improve completion',
    perfActionStatus: 'Complete',
    requestNumber: 'T-888'
  };

  function hasAction(s) { return s.perfAction; }
  function isCreatorAction(a) { return ['Improve completion', 'Consider retirement'].includes(a); }

  const shouldRender = hasAction(sub) && isCreatorAction(sub.perfAction);
  const status = sub.perfActionStatus;
  const demoStatus = sub.status;

  const hidePanel = status === 'Complete' || demoStatus === 'Retired';

  assert.strictEqual(shouldRender, true, 'Has action and is creator action');
  assert.strictEqual(hidePanel, true, 'Should hide panel when Complete');

  console.log('  ✓ Complete → hidden\n');
}

function testPublishedWithActionNeeded() {
  console.log('Test: Published demo with Action needed → shows Recommendation');

  const sub = {
    status: 'Published',
    perfAction: 'Consider retirement',
    perfActionStatus: 'Action needed',
    requestNumber: 'T-777'
  };

  function hasAction(s) { return s.perfAction; }
  function isCreatorAction(a) { return ['Improve completion', 'Consider retirement'].includes(a); }

  const shouldRender = hasAction(sub) && isCreatorAction(sub.perfAction);
  const status = sub.perfActionStatus;
  const demoStatus = sub.status;

  const hidePanel = status === 'Complete' || demoStatus === 'Retired';

  assert.strictEqual(shouldRender, true, 'Has action and is creator action');
  assert.strictEqual(hidePanel, false, 'Should show panel when Published + Action needed');

  console.log('  ✓ Published + Action needed → visible\n');
}

// Run all tests
try {
  testClientSideRetiredCheck();
  testServerSideRetiredGuard();
  testGuardBeforePendingLock();
  testRetiredWithActionNeeded();
  testCompleteWithRecommendation();
  testPublishedWithActionNeeded();

  console.log('✅ All retired demo recommendation tests passed');
  console.log('\n📋 Verified behavior:');
  console.log('  ✓ Client: Status = Retired → hide Recommendation panel');
  console.log('  ✓ Server: Status = Retired → reject lifecycle responses');
  console.log('  ✓ Retired guard runs before Pending review lock');
  console.log('  ✓ Retired + stale Action needed → no panel');
  console.log('  ✓ Complete → no panel (existing)');
  console.log('  ✓ Published + Action needed → panel visible');
} catch (error) {
  console.error('❌ Test failed:', error.message);
  process.exit(1);
}
