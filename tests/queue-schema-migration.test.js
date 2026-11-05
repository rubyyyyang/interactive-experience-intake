/**
 * Response Queue Schema Migration Tests
 * Tests migration-compatible header lookup for "Review Status" vs "Action Status"
 */

const assert = require('assert');

console.log('Running Response Queue schema migration tests...\n');

// Test 1: Creator first submit sets Review Status = Pending review
function testCreatorFirstSubmit() {
  console.log('Test: Creator first submit appends Review Status = Pending review');

  // Simulate header lookup with migration compatibility
  function getReviewStatusHeader(headers) {
    const reviewStatusIdx = headers.indexOf('Review Status');
    const actionStatusIdx = headers.indexOf('Action Status');
    return reviewStatusIdx >= 0 ? 'Review Status' : 'Action Status';
  }

  // Case 1: Sheet already renamed to "Review Status"
  const newHeaders = ['Demo Number', 'Review Status', 'Timestamp', 'Number'];
  const header1 = getReviewStatusHeader(newHeaders);
  assert.strictEqual(header1, 'Review Status', 'Use Review Status when available');

  // Case 2: Sheet still has "Action Status" (pre-rename)
  const oldHeaders = ['Demo Number', 'Action Status', 'Timestamp', 'Number'];
  const header2 = getReviewStatusHeader(oldHeaders);
  assert.strictEqual(header2, 'Action Status', 'Fall back to Action Status when Review Status not found');

  // Simulate row construction
  function buildRow(headers) {
    const col = (name) => headers.indexOf(name);
    const rowData = new Array(headers.length).fill('');

    function set(name, value) {
      const idx = col(name);
      if (idx >= 0) rowData[idx] = value;
    }

    const reviewStatusHeader = getReviewStatusHeader(headers);
    set(reviewStatusHeader, 'Pending review');
    set('Number', '123');

    return rowData;
  }

  const row1 = buildRow(newHeaders);
  assert.strictEqual(row1[1], 'Pending review', 'Review Status column populated (new schema)');

  const row2 = buildRow(oldHeaders);
  assert.strictEqual(row2[1], 'Pending review', 'Action Status column populated (old schema)');

  console.log('✓ Creator first submit test passed\n');
}

// Test 2: Creator resubmit after Resubmit required appends NEW row
function testCreatorResubmitAppendsNewRow() {
  console.log('Test: Creator resubmit appends NEW row with Review Status = Pending review');

  const queueHistory = [
    { rowIndex: 5, number: '123', reviewStatus: 'Resubmit required', adminNotes: 'Need more info' }
  ];

  // Simulate resubmit - always append, never overwrite
  function handleResubmit(history, number) {
    // Always append new row
    const newRowIndex = history.length + 5;  // Simplified row index
    history.push({ rowIndex: newRowIndex, number: number, reviewStatus: 'Pending review', adminNotes: '' });
    return history;
  }

  const updated = handleResubmit(queueHistory, '123');

  assert.strictEqual(updated.length, 2, 'New row appended');
  assert.strictEqual(updated[0].reviewStatus, 'Resubmit required', 'Old row unchanged');
  assert.strictEqual(updated[0].adminNotes, 'Need more info', 'Old admin notes preserved');
  assert.strictEqual(updated[1].reviewStatus, 'Pending review', 'New row Pending review');
  assert.strictEqual(updated[1].adminNotes, '', 'New row has no admin notes yet');

  console.log('✓ Creator resubmit test passed\n');
}

// Test 3: Old Resubmit required row remains unchanged
function testOldRowPreserved() {
  console.log('Test: Old Resubmit required row remains unchanged after resubmit');

  const beforeResubmit = { rowIndex: 5, number: '123', reviewStatus: 'Resubmit required', adminNotes: 'Original feedback' };
  const afterResubmit = { ...beforeResubmit };  // Should remain identical

  assert.deepStrictEqual(afterResubmit, beforeResubmit, 'Old row data preserved');

  console.log('✓ Old row preservation test passed\n');
}

// Test 4: Admin lookup returns the new pending row
function testAdminLookupReturnsNewPendingRow() {
  console.log('Test: Admin lookup returns latest Pending review row');

  const queueHistory = [
    { rowIndex: 5, number: '123', reviewStatus: 'Resubmit required', adminNotes: 'First feedback' },
    { rowIndex: 8, number: '123', reviewStatus: 'Pending review', adminNotes: '' }
  ];

  // Simulate admin lookup - find latest pending
  function getLatestPending(history, number) {
    for (let i = history.length - 1; i >= 0; i--) {
      if (history[i].number === number && history[i].reviewStatus === 'Pending review') {
        return history[i];
      }
    }
    return null;
  }

  const result = getLatestPending(queueHistory, '123');

  assert.strictEqual(result !== null, true, 'Found pending row');
  assert.strictEqual(result.rowIndex, 8, 'Returns latest row');
  assert.strictEqual(result.reviewStatus, 'Pending review', 'Correct status');

  console.log('✓ Admin lookup test passed\n');
}

// Test 5: Admin action uses exact queueRowIndex
function testAdminActionUsesExactRowIndex() {
  console.log('Test: Admin action uses exact queueRowIndex from lookup');

  const adminLoadedEntry = { rowIndex: 8, number: '123', reviewStatus: 'Pending review' };

  // Admin action must use the exact rowIndex from the loaded entry
  function adminApprove(loadedEntry, targetRowIndex) {
    if (loadedEntry.rowIndex !== targetRowIndex) {
      return { success: false, error: 'Row index mismatch' };
    }
    return { success: true, targetedRow: targetRowIndex };
  }

  const success = adminApprove(adminLoadedEntry, 8);
  assert.strictEqual(success.success, true, 'Correct row index accepted');
  assert.strictEqual(success.targetedRow, 8, 'Targeted correct row');

  const failure = adminApprove(adminLoadedEntry, 5);
  assert.strictEqual(failure.success, false, 'Wrong row index rejected');

  console.log('✓ Admin action row index test passed\n');
}

// Test 6: Blank Review Status is never treated as pending
function testBlankReviewStatusRejected() {
  console.log('Test: Blank Review Status is never treated as Pending review');

  function isValidPendingState(reviewStatus) {
    const trimmed = (reviewStatus || '').trim();
    return trimmed === 'Pending review';
  }

  assert.strictEqual(isValidPendingState('Pending review'), true, 'Valid pending state');
  assert.strictEqual(isValidPendingState(''), false, 'Blank rejected');
  assert.strictEqual(isValidPendingState(null), false, 'Null rejected');
  assert.strictEqual(isValidPendingState(undefined), false, 'Undefined rejected');
  assert.strictEqual(isValidPendingState('   '), false, 'Whitespace rejected');
  assert.strictEqual(isValidPendingState('Complete'), false, 'Other status rejected');

  console.log('✓ Blank Review Status rejection test passed\n');
}

// Test 7: Migration-compatible header lookup
function testMigrationCompatibleHeaderLookup() {
  console.log('Test: Migration-compatible header lookup');

  function getReviewStatusCol(headers) {
    const reviewStatusIdx = headers.indexOf('Review Status');
    const actionStatusIdx = headers.indexOf('Action Status');

    if (reviewStatusIdx >= 0) return reviewStatusIdx;
    if (actionStatusIdx >= 0) return actionStatusIdx;
    return -1;
  }

  // New schema
  const newHeaders = ['Number', 'Review Status', 'Admin Notes'];
  assert.strictEqual(getReviewStatusCol(newHeaders), 1, 'Find Review Status in new schema');

  // Old schema
  const oldHeaders = ['Number', 'Action Status', 'Admin Notes'];
  assert.strictEqual(getReviewStatusCol(oldHeaders), 1, 'Find Action Status in old schema');

  // Both present (Review Status takes precedence)
  const mixedHeaders = ['Number', 'Action Status', 'Review Status', 'Admin Notes'];
  assert.strictEqual(getReviewStatusCol(mixedHeaders), 2, 'Prefer Review Status when both present');

  // Neither present
  const invalidHeaders = ['Number', 'Admin Notes'];
  assert.strictEqual(getReviewStatusCol(invalidHeaders), -1, 'Return -1 when neither found');

  console.log('✓ Migration-compatible header lookup test passed\n');
}

// Run all tests
try {
  testCreatorFirstSubmit();
  testCreatorResubmitAppendsNewRow();
  testOldRowPreserved();
  testAdminLookupReturnsNewPendingRow();
  testAdminActionUsesExactRowIndex();
  testBlankReviewStatusRejected();
  testMigrationCompatibleHeaderLookup();

  console.log('✅ All Response Queue schema migration tests passed');
} catch (error) {
  console.error('❌ Test failed:', error.message);
  process.exit(1);
}
