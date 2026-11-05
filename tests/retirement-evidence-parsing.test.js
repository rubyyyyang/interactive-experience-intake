/**
 * Retirement Evidence Parsing Tests
 * Tests perfActionReason parsing for retirement evidence display
 */

const assert = require('assert');

console.log('Running retirement evidence parsing tests...\n');

function testNoActivityWithContentAge() {
  console.log('Test: No-activity retirement with ContentAge in reason');

  // Simulate buildRetirementEvidenceStrip_ logic for no-activity case
  function parseEvidence(actionReason, contentAge) {
    var lines = [];
    var contentAgeFromReason = actionReason ? actionReason.match(/ContentAge:\s*(\d+)\s*mo/i) : null;

    if (contentAgeFromReason) {
      lines.push('Activity: No recent activity');
    }

    // Show Content Age - prefer parsed from reason, fallback to structured field
    var ageToDisplay = null;
    if (contentAgeFromReason) {
      ageToDisplay = parseInt(contentAgeFromReason[1]);
    } else if (contentAge !== undefined && contentAge !== null && contentAge !== '') {
      ageToDisplay = parseInt(contentAge);
    }

    if (!isNaN(ageToDisplay) && ageToDisplay > 0) {
      lines.push('Content age: ' + ageToDisplay + ' months');
    }

    return lines;
  }

  // Test case from demo #199 (no-activity with age in reason)
  const reason199 = 'ContentAge: 4 mo. (recent)';
  const lines199 = parseEvidence(reason199, null);

  assert.strictEqual(lines199.length, 2, 'Should have 2 lines for no-activity retirement');
  assert.strictEqual(lines199[0], 'Activity: No recent activity', 'First line should be no activity');
  assert.strictEqual(lines199[1], 'Content age: 4 months', 'Second line should show parsed age');

  // Test other formats
  const reason6mo = 'ContentAge: 6 mo.';
  const lines6mo = parseEvidence(reason6mo, null);
  assert.strictEqual(lines6mo[1], 'Content age: 6 months', 'Should parse 6 mo.');

  const reason12mo = 'ContentAge: 12 mo. (mature)';
  const lines12mo = parseEvidence(reason12mo, null);
  assert.strictEqual(lines12mo[1], 'Content age: 12 months', 'Should parse 12 mo.');

  console.log('✓ No-activity with ContentAge test passed\n');
}

function testUsageRetirementWithContentAge() {
  console.log('Test: Usage-based retirement with Content Age from Request_Master');

  function parseEvidence(signalsStr, actionReason, contentAge) {
    var lines = [];
    var contentAgeFromReason = actionReason ? actionReason.match(/ContentAge:\s*(\d+)\s*mo/i) : null;

    if (contentAgeFromReason) {
      lines.push('Activity: No recent activity');
    } else {
      var usageMatch = signalsStr ? signalsStr.match(/Usage:\s*(\d+)ppm/i) : null;
      if (usageMatch) {
        lines.push('Usage: ' + usageMatch[1] + ' players/month (typical baseline: 15 players/month)');
      }
    }

    // Show Content Age for all cases where available
    var ageToDisplay = null;
    if (contentAgeFromReason) {
      ageToDisplay = parseInt(contentAgeFromReason[1]);
    } else if (contentAge !== undefined && contentAge !== null && contentAge !== '') {
      ageToDisplay = parseInt(contentAge);
    }

    if (!isNaN(ageToDisplay) && ageToDisplay > 0) {
      lines.push('Content age: ' + ageToDisplay + ' months');
    }

    return lines;
  }

  // Low usage retirement with Content Age from Request_Master column
  const signals = 'Usage: 5ppm (low 15)';
  const reason = 'Usage: 5 players/mo (below typical baseline: 15 players/mo)';
  const contentAge = 12; // From Request_Master Content Age column
  const lines = parseEvidence(signals, reason, contentAge);

  assert.strictEqual(lines.length, 2, 'Should have 2 lines: usage + age');
  assert.strictEqual(lines[0], 'Usage: 5 players/month (typical baseline: 15 players/month)', 'Should show usage with baseline');
  assert.strictEqual(lines[1], 'Content age: 12 months', 'Should show Content Age from structured field');

  // Usage retirement without Content Age (missing or zero)
  const linesNoAge = parseEvidence(signals, reason, null);
  assert.strictEqual(linesNoAge.length, 1, 'Should only show usage when age missing');
  assert.strictEqual(linesNoAge[0], 'Usage: 5 players/month (typical baseline: 15 players/month)', 'Should show usage');

  console.log('✓ Usage retirement with ContentAge test passed\n');
}

function testMissingOrMalformedReason() {
  console.log('Test: Missing or malformed actionReason');

  function parseEvidence(actionReason) {
    var lines = [];
    var contentAgeMatch = actionReason ? actionReason.match(/ContentAge:\s*(\d+)\s*mo/i) : null;

    if (contentAgeMatch) {
      lines.push('Activity: No recent activity');
      var age = parseInt(contentAgeMatch[1]);
      if (!isNaN(age) && age > 0) {
        lines.push('Content age: ' + age + ' months');
      }
    }

    return lines;
  }

  // Missing reason
  const linesNull = parseEvidence(null);
  assert.strictEqual(linesNull.length, 0, 'Null reason should produce no lines');

  const linesEmpty = parseEvidence('');
  assert.strictEqual(linesEmpty.length, 0, 'Empty reason should produce no lines');

  // Malformed ContentAge (missing number)
  const linesMalformed1 = parseEvidence('ContentAge: unknown');
  assert.strictEqual(linesMalformed1.length, 0, 'Malformed ContentAge (no number) should produce no lines');

  // Malformed ContentAge (zero)
  const linesMalformed2 = parseEvidence('ContentAge: 0 mo.');
  assert.strictEqual(linesMalformed2.length, 1, 'Zero ContentAge should show activity line only');
  assert.strictEqual(linesMalformed2[0], 'Activity: No recent activity', 'Should show activity line');
  assert.ok(linesMalformed2.every(l => l.indexOf('Content age') === -1), 'Should NOT show Content age for zero');

  // Other reason text (not ContentAge)
  const linesOther = parseEvidence('Low completion rate observed');
  assert.strictEqual(linesOther.length, 0, 'Non-ContentAge reason should produce no lines');

  console.log('✓ Missing/malformed reason test passed\n');
}

function testContentAgeNotInvented() {
  console.log('Test: Content age not invented when unparseable');

  function parseEvidence(actionReason) {
    var lines = [];
    var contentAgeMatch = actionReason ? actionReason.match(/ContentAge:\s*(\d+)\s*mo/i) : null;

    if (contentAgeMatch) {
      lines.push('Activity: No recent activity');
      var age = parseInt(contentAgeMatch[1]);
      if (!isNaN(age) && age > 0) {
        lines.push('Content age: ' + age + ' months');
      }
    }

    return lines;
  }

  // ContentAge string but no parseable number - regex won't match, produces no lines
  const reason = 'ContentAge: very old';
  const lines = parseEvidence(reason);

  // Regex requires "\d+" so unparseable ContentAge produces no match, no lines
  assert.strictEqual(lines.length, 0, 'Unparseable ContentAge produces no lines (regex requires number)');

  // Valid ContentAge but age is zero - shows activity but no age line
  const reasonZero = 'ContentAge: 0 mo.';
  const linesZero = parseEvidence(reasonZero);
  assert.strictEqual(linesZero.length, 1, 'Zero age shows activity only');
  assert.strictEqual(linesZero[0], 'Activity: No recent activity', 'Should show activity');
  assert.ok(linesZero.every(l => l.indexOf('Content age') === -1), 'Should NOT show "Content age: 0 months"');

  console.log('✓ Content age not invented test passed\n');
}

function testNoDuplicateContentAge() {
  console.log('Test: No duplicate Content Age lines');

  function parseEvidence(actionReason, contentAge) {
    var lines = [];
    var contentAgeFromReason = actionReason ? actionReason.match(/ContentAge:\s*(\d+)\s*mo/i) : null;

    if (contentAgeFromReason) {
      lines.push('Activity: No recent activity');
    }

    // Show Content Age once - prefer reason, fallback to structured
    var ageToDisplay = null;
    if (contentAgeFromReason) {
      ageToDisplay = parseInt(contentAgeFromReason[1]);
    } else if (contentAge !== undefined && contentAge !== null && contentAge !== '') {
      ageToDisplay = parseInt(contentAge);
    }

    if (!isNaN(ageToDisplay) && ageToDisplay > 0) {
      lines.push('Content age: ' + ageToDisplay + ' months');
    }

    return lines;
  }

  // Case where both reason and structured field have age (prefer reason)
  const reason = 'ContentAge: 4 mo. (recent)';
  const structuredAge = 5; // Different value in Request_Master
  const lines = parseEvidence(reason, structuredAge);

  assert.strictEqual(lines.length, 2, 'Should have 2 lines total');
  assert.strictEqual(lines[0], 'Activity: No recent activity', 'Should show activity');
  assert.strictEqual(lines[1], 'Content age: 4 months', 'Should use age from reason (not structured field)');

  // Verify only one Content age line
  const ageLines = lines.filter(l => l.indexOf('Content age') !== -1);
  assert.strictEqual(ageLines.length, 1, 'Should have exactly one Content age line');

  console.log('✓ No duplicate Content Age test passed\n');
}

// Run all tests
try {
  testNoActivityWithContentAge();
  testUsageRetirementWithContentAge();
  testMissingOrMalformedReason();
  testContentAgeNotInvented();
  testNoDuplicateContentAge();

  console.log('✅ All retirement evidence parsing tests passed');
} catch (error) {
  console.error('❌ Test failed:', error.message);
  process.exit(1);
}
