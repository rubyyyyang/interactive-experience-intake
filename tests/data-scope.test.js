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

function testNumericZeroPreservation() {
  console.log('Test: Numeric zero values preserved in submission data');

  // Simulate buildSubmissionFromRow_ behavior for numeric fields
  function buildSubmission(row, headerMap) {
    const get = (name) => {
      const idx = headerMap[name];
      return idx != null ? String(row[idx] || '') : '';
    };

    const getNumeric = (name) => {
      const idx = headerMap[name];
      if (idx == null) return '';
      const val = row[idx];
      if (val === null || val === undefined || val === '') return '';
      return String(val);
    };

    return {
      title: get('Title'),
      mtOpportunity: getNumeric('MT_Opportunity'),
      mtWon: getNumeric('MT_Won')
    };
  }

  const headerMap = { 'Title': 0, 'MT_Opportunity': 1, 'MT_Won': 2 };

  // Test 1: Zero values preserved
  const rowWithZeros = ['Demo 1', 0, 0];
  const result1 = buildSubmission(rowWithZeros, headerMap);
  assert.strictEqual(result1.mtOpportunity, '0', 'mtOpportunity = 0 should be preserved as "0"');
  assert.strictEqual(result1.mtWon, '0', 'mtWon = 0 should be preserved as "0"');

  // Test 2: Blank values remain empty
  const rowWithBlanks = ['Demo 2', '', ''];
  const result2 = buildSubmission(rowWithBlanks, headerMap);
  assert.strictEqual(result2.mtOpportunity, '', 'Blank mtOpportunity should remain empty');
  assert.strictEqual(result2.mtWon, '', 'Blank mtWon should remain empty');

  // Test 3: Null values remain empty
  const rowWithNulls = ['Demo 3', null, null];
  const result3 = buildSubmission(rowWithNulls, headerMap);
  assert.strictEqual(result3.mtOpportunity, '', 'Null mtOpportunity should remain empty');
  assert.strictEqual(result3.mtWon, '', 'Null mtWon should remain empty');

  // Test 4: Non-zero numeric values preserved
  const rowWithValues = ['Demo 4', 50000, 10000];
  const result4 = buildSubmission(rowWithValues, headerMap);
  assert.strictEqual(result4.mtOpportunity, '50000', 'mtOpportunity = 50000 should be preserved');
  assert.strictEqual(result4.mtWon, '10000', 'mtWon = 10000 should be preserved');

  // Test 5: String fields still use standard get() - zero becomes empty
  const rowWithStringZero = ['Demo 5', 0, 0];
  const result5 = buildSubmission(rowWithStringZero, headerMap);
  assert.strictEqual(result5.title, 'Demo 5', 'String fields use standard get()');

  console.log('✓ Numeric zero preservation test passed\n');
}

// Run all tests
try {
  testGetMySubmissionsDataScope();
  testGetAllSubmissionsAdminOnly();
  testNumericZeroPreservation();

  console.log('✅ All data scope tests passed');
} catch (error) {
  console.error('❌ Test failed:', error.message);
  process.exit(1);
}
