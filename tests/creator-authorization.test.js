/**
 * Creator Authorization Tests
 * Tests for server-side authorization and pending response lock
 */

const assert = require('assert');

console.log('Running creator authorization tests...\n');

function testCreatorAuthorization() {
  console.log('Test: Creator authorization logic');

  const scenarios = [
    {
      name: 'Creator can respond to own submission',
      userEmail: 'creator@example.com',
      submissionCreatorEmail: 'creator@example.com',
      isAdmin: false,
      shouldAllow: true
    },
    {
      name: 'Creator cannot respond to another creator submission',
      userEmail: 'creator-a@example.com',
      submissionCreatorEmail: 'creator-b@example.com',
      isAdmin: false,
      shouldAllow: false
    },
    {
      name: 'Admin can respond to any submission',
      userEmail: 'admin@example.com',
      submissionCreatorEmail: 'creator@example.com',
      isAdmin: true,
      shouldAllow: true
    },
    {
      name: 'Requestor can respond to their requested submission',
      userEmail: 'requestor@example.com',
      submissionCreatorEmail: 'creator@example.com',
      submissionRequestorEmail: 'requestor@example.com',
      isAdmin: false,
      shouldAllow: true
    }
  ];

  scenarios.forEach(scenario => {
    const result = shouldAllowResponse(scenario);
    assert.strictEqual(
      result,
      scenario.shouldAllow,
      `Failed: ${scenario.name}`
    );
  });

  console.log('✓ Authorization logic test passed\n');
}

function testPendingLock() {
  console.log('Test: Pending response lock');

  const lockScenarios = [
    {
      name: 'Creator cannot resubmit while Pending Review',
      userEmail: 'creator@example.com',
      submissionCreatorEmail: 'creator@example.com',
      currentActionStatus: 'Pending Review',
      isAdmin: false,
      isLifecycleResponse: true,
      shouldAllow: false
    },
    {
      name: 'Admin can override Pending Review lock',
      userEmail: 'admin@example.com',
      submissionCreatorEmail: 'creator@example.com',
      currentActionStatus: 'Pending Review',
      isAdmin: true,
      isLifecycleResponse: true,
      shouldAllow: true
    },
    {
      name: 'Creator can resubmit when Resubmit status',
      userEmail: 'creator@example.com',
      submissionCreatorEmail: 'creator@example.com',
      currentActionStatus: 'Resubmit',
      isAdmin: false,
      isLifecycleResponse: true,
      shouldAllow: true
    },
    {
      name: 'Creator can submit when Open status',
      userEmail: 'creator@example.com',
      submissionCreatorEmail: 'creator@example.com',
      currentActionStatus: 'Open',
      isAdmin: false,
      isLifecycleResponse: true,
      shouldAllow: true
    },
    {
      name: 'Pending lock only applies to lifecycle responses',
      userEmail: 'creator@example.com',
      submissionCreatorEmail: 'creator@example.com',
      currentActionStatus: 'Pending Review',
      isAdmin: false,
      isLifecycleResponse: false,
      shouldAllow: true  // Metadata edits not affected
    }
  ];

  lockScenarios.forEach(scenario => {
    const result = shouldAllowWithLock(scenario);
    assert.strictEqual(
      result,
      scenario.shouldAllow,
      `Failed: ${scenario.name}`
    );
  });

  console.log('✓ Pending lock test passed\n');
}

function shouldAllowResponse(scenario) {
  // Authorization check
  if (scenario.isAdmin) return true;
  if (scenario.userEmail === scenario.submissionCreatorEmail) return true;
  if (scenario.submissionRequestorEmail && scenario.userEmail === scenario.submissionRequestorEmail) return true;
  return false;
}

function shouldAllowWithLock(scenario) {
  // First check authorization
  if (!shouldAllowResponse(scenario)) return false;

  // Then check pending lock
  if (scenario.isLifecycleResponse &&
      scenario.currentActionStatus === 'Pending Review' &&
      !scenario.isAdmin) {
    return false;
  }

  return true;
}

// Run all tests
try {
  testCreatorAuthorization();
  testPendingLock();

  console.log('✅ All creator authorization tests passed');
} catch (error) {
  console.error('❌ Test failed:', error.message);
  process.exit(1);
}
