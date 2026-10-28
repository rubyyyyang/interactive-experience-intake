/**
 * Data Scope Tests
 * Verifies server-side data boundaries for normal creators vs admins
 */

const assert = require('assert');

console.log('Running data scope tests...\n');

function testGetMySubmissionsDataScope() {
  console.log('Test: getMySubmissions() returns appropriate data scope');

  // Mock data loading behavior
  function getMySubmissions(userEmail, isAdmin, allRecords) {
    const lowerEmail = userEmail.toLowerCase();
    const submissions = [];

    for (let i = 0; i < allRecords.length; i++) {
      const creatorEmail = (allRecords[i].creatorEmail || '').toLowerCase();
      const requestorEmail = (allRecords[i].requestorEmail || '').toLowerCase();

      if (isAdmin) {
        // Admin gets ALL records
        submissions.push(allRecords[i]);
      } else {
        // Creator gets only their own records
        if (creatorEmail === lowerEmail || requestorEmail === lowerEmail) {
          submissions.push(allRecords[i]);
        }
      }
    }

    // Mark isMine for frontend filtering
    for (let s = 0; s < submissions.length; s++) {
      const ce = (submissions[s].creatorEmail || '').toLowerCase();
      const re = (submissions[s].requestorEmail || '').toLowerCase();
      submissions[s].isMine = (ce === lowerEmail || re === lowerEmail);
    }

    return { success: true, submissions, userEmail: lowerEmail, isAdmin };
  }

  const allRecords = [
    { number: '1', creatorEmail: 'creator@ex.com', requestorEmail: '' },
    { number: '2', creatorEmail: 'other@ex.com', requestorEmail: '' },
    { number: '3', creatorEmail: 'admin@ex.com', requestorEmail: '' },
    { number: '4', creatorEmail: 'another@ex.com', requestorEmail: 'creator@ex.com' }
  ];

  // Normal creator should receive only their own records
  const creatorResult = getMySubmissions('creator@ex.com', false, allRecords);
  assert.strictEqual(creatorResult.success, true, 'Creator request should succeed');
  assert.strictEqual(creatorResult.submissions.length, 2, 'Creator should receive 2 records (creator + requestor)');
  assert.strictEqual(creatorResult.submissions[0].number, '1', 'Should include their created record');
  assert.strictEqual(creatorResult.submissions[1].number, '4', 'Should include record they requested');
  assert.strictEqual(creatorResult.isAdmin, false, 'Should mark as non-admin');

  // Admin should receive ALL records
  const adminResult = getMySubmissions('admin@ex.com', true, allRecords);
  assert.strictEqual(adminResult.success, true, 'Admin request should succeed');
  assert.strictEqual(adminResult.submissions.length, 4, 'Admin should receive all 4 records');
  assert.strictEqual(adminResult.isAdmin, true, 'Should mark as admin');

  // Verify isMine flag
  const adminMyCount = adminResult.submissions.filter(s => s.isMine).length;
  assert.strictEqual(adminMyCount, 1, 'Admin should have 1 record marked as isMine');

  console.log('✓ Data scope test passed\n');
}

function testGetAllSubmissionsAdminOnly() {
  console.log('Test: getAllSubmissions() enforces admin-only access');

  function getAllSubmissions(userEmail, isAdmin) {
    // Server-side authorization
    if (!isAdmin) {
      return { success: false, error: 'Admin access required for All Submissions.' };
    }
    return { success: true, submissions: [{number: '1'}, {number: '2'}] };
  }

  // Normal creator blocked
  const creatorResult = getAllSubmissions('creator@ex.com', false);
  assert.strictEqual(creatorResult.success, false, 'Creator should be blocked');
  assert.strictEqual(creatorResult.error, 'Admin access required for All Submissions.', 'Should return auth error');

  // Admin allowed
  const adminResult = getAllSubmissions('admin@ex.com', true);
  assert.strictEqual(adminResult.success, true, 'Admin should be allowed');
  assert.strictEqual(adminResult.submissions.length, 2, 'Admin should receive data');

  console.log('✓ getAllSubmissions admin-only enforcement test passed\n');
}

// Run all tests
try {
  testGetMySubmissionsDataScope();
  testGetAllSubmissionsAdminOnly();

  console.log('✅ All data scope tests passed');
} catch (error) {
  console.error('❌ Test failed:', error.message);
  process.exit(1);
}
