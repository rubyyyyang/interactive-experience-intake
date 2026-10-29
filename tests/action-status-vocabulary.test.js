/**
 * Action Status Normalization Tests
 * Verifies migration-compatible normalization to Sheet-native values
 */

const assert = require('assert');

function normalizeActionStatus_(status) {
  var s = String(status || '').trim();
  if (!s) return '';

  // Sheet-native canonical values pass through unchanged
  if (s === 'Action needed' || s === 'Assignee notified' || s === 'Assignee responded' ||
      s === 'Pending review' || s === 'Complete' || s === 'Resubmit required') {
    return s;
  }

  // Normalize aliases to Sheet-native values
  var lower = s.toLowerCase();
  if (lower === 'open') return 'Action needed';
  if (lower === 'pending review') return 'Pending review';
  if (lower === 'completed' || lower === 'complete') return 'Complete';
  if (lower === 'resubmit') return 'Resubmit required';
  if (lower === 'action needed') return 'Action needed';
  if (lower === 'assignee notified') return 'Assignee notified';
  if (lower === 'assignee responded') return 'Assignee responded';
  if (lower === 'resubmit required') return 'Resubmit required';

  return s;
}

function testActionStatusNormalization() {
  console.log('Test: Action Status normalization to Sheet-native values');

  // Sheet-native canonical values pass through
  assert.strictEqual(normalizeActionStatus_('Action needed'), 'Action needed');
  assert.strictEqual(normalizeActionStatus_('Pending review'), 'Pending review');
  assert.strictEqual(normalizeActionStatus_('Complete'), 'Complete');
  assert.strictEqual(normalizeActionStatus_('Resubmit required'), 'Resubmit required');
  assert.strictEqual(normalizeActionStatus_('Assignee notified'), 'Assignee notified');
  assert.strictEqual(normalizeActionStatus_('Assignee responded'), 'Assignee responded');

  // Legacy aliases normalize to Sheet-native values
  assert.strictEqual(normalizeActionStatus_('Open'), 'Action needed');
  assert.strictEqual(normalizeActionStatus_('open'), 'Action needed');
  assert.strictEqual(normalizeActionStatus_('Pending Review'), 'Pending review');
  assert.strictEqual(normalizeActionStatus_('PENDING REVIEW'), 'Pending review');
  assert.strictEqual(normalizeActionStatus_('Completed'), 'Complete');
  assert.strictEqual(normalizeActionStatus_('completed'), 'Complete');
  assert.strictEqual(normalizeActionStatus_('Resubmit'), 'Resubmit required');
  assert.strictEqual(normalizeActionStatus_('resubmit'), 'Resubmit required');

  // Empty/whitespace
  assert.strictEqual(normalizeActionStatus_(''), '');
  assert.strictEqual(normalizeActionStatus_('  '), '');

  console.log('✓ Action Status normalization test passed');
}

testActionStatusNormalization();
