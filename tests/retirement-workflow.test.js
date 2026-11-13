/**
 * Retirement Workflow Tests
 * Verifies complete retirement workflow behavior with new product requirements
 */

const assert = require('assert');
const fs = require('fs');

console.log('Running retirement workflow tests...\n');

const html = fs.readFileSync('/Users/rubyyang/arcade-intake-app/StatusTracker.html', 'utf8');
const serverJs = fs.readFileSync('/Users/rubyyang/arcade-intake-app/IA_StatusTracker.js', 'utf8');

function testRetirementGuardRemoved() {
  console.log('Test: Retirement guard requiring pre-retired status removed');

  // Should NOT have the old guard that checks contentStatus !== 'Retired'
  const hasOldGuard = /Cannot complete retirement workflow.*Content lifecycle Status.*not.*Retired/.test(serverJs);

  assert.strictEqual(hasOldGuard, false, 'Should NOT have retirement guard that requires Status to already be Retired');
  console.log('  ✓ Old retirement guard removed\n');
}

function testRetirementSetsStatus() {
  console.log('Test: Server sets Status to "Retired" when completing retirement');

  const hasRetirementCheck = /isRetirement.*actionTaken.*===.*Retire/.test(serverJs);
  const setsStatus = /setValue\('Retired'\)/.test(serverJs);

  assert.ok(hasRetirementCheck, 'Should check if action is retirement');
  assert.ok(setsStatus, 'Should set Status to "Retired"');
  console.log('  ✓ Server sets Status to "Retired"\n');
}

function testRetirementSetsTimestamp() {
  console.log('Test: Server sets Status Retired Timestamp');

  const hasRetiredTimestamp = /STATUS_RETIRED_TS/.test(serverJs);
  const setsTimestamp = /retiredTsIdx/.test(serverJs);

  assert.ok(hasRetiredTimestamp, 'Should reference STATUS_RETIRED_TS column');
  assert.ok(setsTimestamp, 'Should set retired timestamp');
  console.log('  ✓ Server sets Status Retired Timestamp\n');
}

function testRetirementSetsActionComplete() {
  console.log('Test: Server sets Action Status to Complete');

  const setsComplete = /setValue\('Complete'\)/.test(serverJs);

  assert.ok(setsComplete, 'Should set Action Status to Complete');
  console.log('  ✓ Server sets Action Status to Complete\n');
}

function testRetirementSetsActionCompletedDate() {
  console.log('Test: Server sets Action Completed Date');

  const hasCompletedDate = /completedDateIdx/.test(serverJs);
  const setsDate = /ACTION_COMPLETED_DATE/.test(serverJs);

  assert.ok(hasCompletedDate, 'Should have completedDateIdx');
  assert.ok(setsDate, 'Should reference ACTION_COMPLETED_DATE column');
  console.log('  ✓ Server sets Action Completed Date\n');
}

function testConfirmationMentionsDrupal() {
  console.log('Test: Confirmation dialog mentions Drupal unpublishing requirement');

  const hasDrupalWarning = /unpublish.*demo.*Drupal.*BEFORE.*confirm/i.test(html);
  const hasConfirmQuestion = /Have you unpublished.*Drupal/.test(html);

  assert.ok(hasDrupalWarning, 'Should warn admin to unpublish in Drupal first');
  assert.ok(hasConfirmQuestion, 'Should ask if admin has unpublished in Drupal');
  console.log('  ✓ Confirmation dialog mentions Drupal requirement\n');
}

function testConfirmationShowsDrupalLink() {
  console.log('Test: Confirmation dialog shows Drupal link if available');

  const hasDrupalUrl = /drupalPageUrl/.test(html);
  const showsInConfirm = /Drupal page:/.test(html);

  assert.ok(hasDrupalUrl, 'Should get drupalPageUrl from submission');
  assert.ok(showsInConfirm, 'Should include Drupal page URL in confirmation message');
  console.log('  ✓ Confirmation shows Drupal link\n');
}

function testButtonLabelCorrect() {
  console.log('Test: Button label is "Mark retirement complete" for Retire responses');

  const hasCorrectLabel = /Mark retirement complete/.test(html);

  assert.ok(hasCorrectLabel, 'Should have "Mark retirement complete" button label');
  console.log('  ✓ Button label correct\n');
}

function testAdminWarningUpdated() {
  console.log('Test: Admin warning panel mentions new workflow');

  const hasNewWarning = /unpublish.*demo.*Drupal.*BEFORE.*completing.*workflow/i.test(html);

  assert.ok(hasNewWarning, 'Should warn admin to unpublish in Drupal before completing');
  console.log('  ✓ Admin warning panel updated\n');
}

function testKeepActivePreserved() {
  console.log('Test: "Keep active" workflow uses normal approve behavior');

  const hasKeepActive = /Keep active/.test(html);
  const hasConfirmKeepActive = /Confirm keep active/.test(html);

  assert.ok(hasKeepActive, 'Should have "Keep active" option');
  assert.ok(hasConfirmKeepActive, 'Should have "Confirm keep active" button');
  console.log('  ✓ "Keep active" workflow preserved\n');
}

function testUpdatedDoesNotTriggerRetirement() {
  console.log('Test: "Updated" response does not trigger retirement');

  // isRetirement check should ONLY be for 'Retire', not 'Updated'
  const retirementCheck = serverJs.match(/const isRetirement = \(actionTaken === '([^']+)'\)/);

  assert.ok(retirementCheck, 'Should have isRetirement check');
  assert.strictEqual(retirementCheck[1], 'Retire', 'isRetirement should only be true for "Retire"');

  // Retirement logic (Status = Retired) should be scoped to isRetirement
  const retirementBlock = /if \(isRetirement\) \{[\s\S]+?setValue\('Retired'\)/.test(serverJs);
  assert.ok(retirementBlock, 'Retirement status change should be inside isRetirement block');

  console.log('  ✓ "Updated" does not trigger retirement\n');
}

function testNoDrupalApiCalls() {
  console.log('Test: No automatic Drupal API calls');

  // Should NOT have Drupal API calls or unpublishing logic
  const hasDrupalApi = /drupal.*api|unpublish.*http|fetch.*drupal/i.test(serverJs);

  assert.strictEqual(hasDrupalApi, false, 'Should NOT have Drupal API calls');
  console.log('  ✓ No automatic Drupal API calls\n');
}

function testAuthorizationRequired() {
  console.log('Test: Admin authorization required');

  const checksAdmin = /!isAdmin/.test(serverJs);
  const requiresAuth = /Admin access required/.test(serverJs);

  assert.ok(checksAdmin, 'Should check if user is admin');
  assert.ok(requiresAuth, 'Should require admin access');
  console.log('  ✓ Admin authorization required\n');
}

function testPendingReviewValidation() {
  console.log('Test: Validates queue is in Pending review state');

  const validatesPendingReview = /queueReviewStatus.*!==.*Pending review/.test(serverJs);

  assert.ok(validatesPendingReview, 'Should validate queue row is Pending review');
  console.log('  ✓ Validates Pending review state\n');
}

function testMarksQueueComplete() {
  console.log('Test: Marks Response Queue entry as Complete');

  const marksComplete = /reviewStatusIdx.*setValue\('Complete'\)/.test(serverJs);

  assert.ok(marksComplete, 'Should mark queue entry as Complete');
  console.log('  ✓ Marks queue entry Complete\n');
}

function testRetirementLinkOnlySentForUpdated() {
  console.log('Test: Retirement link only sent when response is Updated');

  // Should check if response === 'Updated' before using retirement link field
  const checksUpdated = /if \(response === 'Updated'\)/.test(html);
  assert.ok(checksUpdated, 'Should check if response is Updated');

  // Should use retirement link field only for Updated
  const usesRetireLink = /resp-link-retire/.test(html);
  assert.ok(usesRetireLink, 'Should have retirement-specific link field');

  // For other responses (Keep active, Retire, Need help), newLink should remain empty
  const hasEmptyLinkComment = /Keep active, Retire, Need help.*newLink remains empty/.test(html);
  assert.ok(hasEmptyLinkComment, 'Should document that other responses do not send link');

  console.log('  ✓ Retirement link only sent for Updated response\n');
}

// Run all tests
try {
  testRetirementGuardRemoved();
  testRetirementSetsStatus();
  testRetirementSetsTimestamp();
  testRetirementSetsActionComplete();
  testRetirementSetsActionCompletedDate();
  testConfirmationMentionsDrupal();
  testConfirmationShowsDrupalLink();
  testButtonLabelCorrect();
  testAdminWarningUpdated();
  testKeepActivePreserved();
  testUpdatedDoesNotTriggerRetirement();
  testRetirementLinkOnlySentForUpdated();
  testNoDrupalApiCalls();
  testAuthorizationRequired();
  testPendingReviewValidation();
  testMarksQueueComplete();

  console.log('✅ All retirement workflow tests passed');
} catch (error) {
  console.error('❌ Test failed:', error.message);
  process.exit(1);
}
