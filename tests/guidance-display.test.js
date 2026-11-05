/**
 * Guidance Display Tests
 * Verifies reviewer guidance display, validation, history, and authorization
 */

const assert = require('assert');
const fs = require('fs');

console.log('Running guidance display tests...\n');

const html = fs.readFileSync('/tmp/intake-lifecycle-test/StatusTracker.html', 'utf8');
const serverJs = fs.readFileSync('/tmp/intake-lifecycle-test/IA_StatusTracker.js', 'utf8');

function testGuidanceContainerRendered() {
  console.log('Test: Guidance container rendered for Follow-up needed status');

  // Find guidance container with correct label
  const guidancePattern = /status === 'Follow-up needed'[\s\S]{0,500}Guidance from Reviewer/;
  const match = html.match(guidancePattern);

  assert.ok(match, 'Should render guidance container with "Guidance from Reviewer" label when status is Follow-up needed');
  console.log('  ✓ Guidance container rendered with correct label\n');
}

function testLoadAdminFeedbackCalled() {
  console.log('Test: loadAdminFeedback called after rendering guidance container');

  const loadCallPattern = /status === 'Follow-up needed'[\s\S]{0,600}loadAdminFeedback\(num\)/;
  const match = html.match(loadCallPattern);

  assert.ok(match, 'Should call loadAdminFeedback() when status is Follow-up needed');
  console.log('  ✓ loadAdminFeedback() called for Follow-up needed demos\n');
}

function testServerValidatesGuidanceRequired() {
  console.log('Test: Server validates guidance is non-empty');

  const validationPattern = /function requestChanges[\s\S]{0,500}!adminNotes.*trim\(\)[\s\S]{0,200}Admin Notes required/;
  const match = serverJs.match(validationPattern);

  assert.ok(match, 'Server should validate adminNotes is non-empty before saving');
  console.log('  ✓ Server validates guidance is required\n');
}

function testGuidanceSavedToQueue() {
  console.log('Test: Guidance saved to Response_Queue Admin Notes column');

  const savePattern = /adminNotesIdx.*setValue\(adminNotes\.trim\(\)\)/;
  const match = serverJs.match(savePattern);

  assert.ok(match, 'Should save trimmed adminNotes to Response_Queue Admin Notes column');
  console.log('  ✓ Guidance saved to Admin Notes column\n');
}

function testServerSearchesLatestFollowUp() {
  console.log('Test: Server searches for latest Follow-up needed entry');

  // getLatestAdminFeedback should search from end of array (latest first)
  const hasReverseSearch = /data\.length - 1; i >= 0; i--/.test(serverJs);
  const hasFollowUpCheck = /Follow-up needed/.test(serverJs);

  assert.ok(hasReverseSearch, 'Should search from data.length - 1 (latest first)');
  assert.ok(hasFollowUpCheck, 'Should check for Follow-up needed status');
  console.log('  ✓ Server searches latest Follow-up needed entry\n');
}

function testCreatorAuthorization() {
  console.log('Test: Server authorizes creator by email');

  const hasAdminCheck = /!isUserAdmin/.test(serverJs);
  const hasCreatorEmail = /CREATOR_EMAIL/.test(serverJs);
  const hasAuthorized = /authorized = true/.test(serverJs);

  assert.ok(hasAdminCheck, 'Should check if user is admin');
  assert.ok(hasCreatorEmail, 'Should check CREATOR_EMAIL column');
  assert.ok(hasAuthorized, 'Should set authorized flag when creator matches');
  console.log('  ✓ Creator authorization checks creator email\n');
}

function testUnauthorizedAccessBlocked() {
  console.log('Test: Server blocks unauthorized access to guidance');

  const hasUnauthorizedCheck = /!authorized/.test(serverJs);
  const hasErrorMessage = /Not authorized to access feedback/.test(serverJs);

  assert.ok(hasUnauthorizedCheck, 'Should check authorized flag');
  assert.ok(hasErrorMessage, 'Should return "Not authorized to access feedback" error');
  console.log('  ✓ Unauthorized access blocked\n');
}

function testGuidanceDisplayLabeling() {
  console.log('Test: Guidance displayed with "Guidance from Reviewer" label');

  // Check all instances use the correct label
  const adminFeedbackCount = (html.match(/Admin Feedback/g) || []).length;
  const guidanceFromReviewerCount = (html.match(/Guidance from Reviewer/g) || []).length;

  assert.ok(guidanceFromReviewerCount >= 4, 'Should have at least 4 instances of "Guidance from Reviewer" label');
  assert.strictEqual(adminFeedbackCount, 0, 'Should NOT have any "Admin Feedback" labels (all should be "Guidance from Reviewer")');

  console.log('  ✓ All guidance labels use "Guidance from Reviewer"\n');
}

function testNoGuidanceMessage() {
  console.log('Test: Shows "No guidance found" when guidance missing');

  const hasCheck = /!result\.feedback/.test(html);
  const hasMessage = /No guidance found/.test(html);

  assert.ok(hasCheck, 'Should check if feedback exists');
  assert.ok(hasMessage, 'Should display "No guidance found" message');
  console.log('  ✓ Displays appropriate message when no guidance available\n');
}

function testActionCompletedDateNotSet() {
  console.log('Test: Action Completed Date not set during guidance');

  // requestChanges should NOT set Action Completed Date
  const noCompletedPattern = /function requestChanges[\s\S]{2000}/.test(serverJs);
  const hasCompletedWrite = /function requestChanges[\s\S]{0,2000}ACTION_COMPLETED_DATE/.test(serverJs);

  assert.strictEqual(hasCompletedWrite, false, 'requestChanges should NOT write to Action Completed Date column');
  console.log('  ✓ Action Completed Date not set during guidance workflow\n');
}

function testStatusRemainsFollowUpNeeded() {
  console.log('Test: Status remains Follow-up needed after guidance');

  // requestChanges sets status to Follow-up needed, not Complete
  const hasFollowUpStatus = /setValue\('Follow-up needed'\)/.test(serverJs);

  assert.ok(hasFollowUpStatus, 'Should set status to Follow-up needed (not Complete)');
  console.log('  ✓ Status set to Follow-up needed\n');
}

// Run all tests
try {
  testGuidanceContainerRendered();
  testLoadAdminFeedbackCalled();
  testServerValidatesGuidanceRequired();
  testGuidanceSavedToQueue();
  testServerSearchesLatestFollowUp();
  testCreatorAuthorization();
  testUnauthorizedAccessBlocked();
  testGuidanceDisplayLabeling();
  testNoGuidanceMessage();
  testActionCompletedDateNotSet();
  testStatusRemainsFollowUpNeeded();

  console.log('✅ All guidance display tests passed');
} catch (error) {
  console.error('❌ Test failed:', error.message);
  process.exit(1);
}
