/**
 * Action Status Normalization Tests
 * Verifies migration-compatible normalization logic
 */

const assert = require('assert');

function normalizeActionStatus_(status) {
  var s = String(status || '').trim();
  if (!s) return '';
  if (s === 'Open' || s === 'Pending Review' || s === 'Completed' || s === 'Resubmit') return s;
  var lower = s.toLowerCase();
  if (lower === 'pending review') return 'Pending Review';
  if (lower === 'complete' || lower === 'completed') return 'Completed';
  if (lower === 'resubmit' || lower === 'resubmit required') return 'Resubmit';
  if (lower === 'open') return 'Open';
  return s;
}

function testActionStatusNormalization() {
  console.log('Test: Action Status normalization (migration-compatible)');

  // Canonical values pass through
  assert.strictEqual(normalizeActionStatus_('Open'), 'Open');
  assert.strictEqual(normalizeActionStatus_('Pending Review'), 'Pending Review');
  assert.strictEqual(normalizeActionStatus_('Completed'), 'Completed');
  assert.strictEqual(normalizeActionStatus_('Resubmit'), 'Resubmit');

  // Legacy aliases normalize to canonical
  assert.strictEqual(normalizeActionStatus_('Pending review'), 'Pending Review');
  assert.strictEqual(normalizeActionStatus_('pending review'), 'Pending Review');
  assert.strictEqual(normalizeActionStatus_('Complete'), 'Completed');
  assert.strictEqual(normalizeActionStatus_('complete'), 'Completed');
  assert.strictEqual(normalizeActionStatus_('Resubmit required'), 'Resubmit');
  assert.strictEqual(normalizeActionStatus_('resubmit required'), 'Resubmit');

  // Empty/whitespace
  assert.strictEqual(normalizeActionStatus_(''), '');
  assert.strictEqual(normalizeActionStatus_('  '), '');

  console.log('✓ Action Status normalization test passed');
}

testActionStatusNormalization();
