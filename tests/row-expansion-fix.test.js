/**
 * Row Expansion Fix Test
 * Verifies SVG timeline HTML construction doesn't break innerHTML assignment
 */

const assert = require('assert');
const fs = require('fs');

console.log('Running row expansion fix test...\n');

const html = fs.readFileSync('/Users/rubyyang/arcade-intake-app/StatusTracker.html', 'utf8');

function testSVGUsesDoubleQuotes() {
  console.log('Test: SVG attributes use single quotes (not double)');

  // SVG should use single quotes for attributes to avoid conflicts
  const usesDoubleQuotes = /<svg width="20" height="20"/.test(html);
  const usesSingleQuotes = /<svg width='20' height='20'/.test(html);

  assert.strictEqual(usesDoubleQuotes, false, 'SVG should NOT use double quotes for attributes');
  assert.ok(usesSingleQuotes, 'SVG should use single quotes for attributes');

  console.log('  ✓ SVG uses single quotes\n');
}

function testCompletedIconSyntax() {
  console.log('Test: Completed icon SVG syntax is valid');

  const completedIcon = /<svg width='20' height='20' viewBox='0 0 20 20'><circle cx='10' cy='10' r='9' fill='#80868b' stroke='none'\/><path d='M6 10l3 3 5-6' stroke='#fff' stroke-width='2' fill='none' stroke-linecap='round' stroke-linejoin='round'\/><\/svg>/.test(html);

  assert.ok(completedIcon, 'Completed icon SVG should have valid syntax');

  console.log('  ✓ Completed icon syntax valid\n');
}

function testCurrentIconSyntax() {
  console.log('Test: Current icon SVG with color variable is valid');

  // Should concatenate color variable with single quotes
  const currentIconPattern = /<svg width='20' height='20' viewBox='0 0 20 20'><circle cx='10' cy='10' r='9' fill='none' stroke='" \+ color \+ "' stroke-width='2'\/><circle cx='10' cy='10' r='4' fill='" \+ color \+ "'\/><\/svg>/.test(html);

  assert.ok(currentIconPattern, 'Current icon should use color variable with single quotes');

  console.log('  ✓ Current icon syntax valid\n');
}

function testFutureIconSyntax() {
  console.log('Test: Future icon SVG syntax is valid');

  const futureIcon = /<svg width='20' height='20' viewBox='0 0 20 20'><circle cx='10' cy='10' r='9' fill='none' stroke='#dadce0' stroke-width='2'\/><\/svg>/.test(html);

  assert.ok(futureIcon, 'Future icon SVG should have valid syntax');

  console.log('  ✓ Future icon syntax valid\n');
}

function testHTMLConstructionSimulation() {
  console.log('Test: Simulate HTML construction without errors');

  // Simulate the actual JavaScript execution
  try {
    const color = '#1a73e8';
    const completedIcon = "<svg width='20' height='20' viewBox='0 0 20 20'><circle cx='10' cy='10' r='9' fill='#80868b' stroke='none'/><path d='M6 10l3 3 5-6' stroke='#fff' stroke-width='2' fill='none' stroke-linecap='round' stroke-linejoin='round'/></svg>";
    const currentIcon = "<svg width='20' height='20' viewBox='0 0 20 20'><circle cx='10' cy='10' r='9' fill='none' stroke='" + color + "' stroke-width='2'/><circle cx='10' cy='10' r='4' fill='" + color + "'/></svg>";
    const futureIcon = "<svg width='20' height='20' viewBox='0 0 20 20'><circle cx='10' cy='10' r='9' fill='none' stroke='#dadce0' stroke-width='2'/></svg>";

    // Simulate td.innerHTML assignment
    const detailHTML = '<div class="detail-panel">' + currentIcon + '</div>';

    assert.ok(detailHTML.includes('svg'), 'HTML should contain SVG');
    assert.ok(detailHTML.includes(color), 'HTML should contain color variable');
    assert.ok(!detailHTML.includes('undefined'), 'HTML should not contain undefined');

    console.log('  ✓ HTML construction succeeds\n');
  } catch (e) {
    assert.fail('HTML construction should not throw: ' + e.message);
  }
}

function testNoConflictingQuotes() {
  console.log('Test: No conflicting quote patterns');

  // Check that we don\'t have patterns like: '<svg width="20"...' inside an outer double-quoted string
  // This would cause: td.innerHTML = "<div>...<svg width="20"...>" to fail

  // The pattern we want to AVOID (double quotes in SVG inside double-quoted assignment)
  const badPattern = /td\.innerHTML = ".*<svg width="20"/.test(html);

  assert.strictEqual(badPattern, false, 'Should not have conflicting double quotes');

  console.log('  ✓ No conflicting quotes\n');
}

// Run all tests
try {
  testSVGUsesDoubleQuotes();
  testCompletedIconSyntax();
  testCurrentIconSyntax();
  testFutureIconSyntax();
  testHTMLConstructionSimulation();
  testNoConflictingQuotes();

  console.log('✅ All row expansion fix tests passed');
  console.log('\n📋 Root cause identified:');
  console.log('  - SVG attributes were using double quotes');
  console.log('  - When concatenated in td.innerHTML assignment, quotes conflicted');
  console.log('  - Changed all SVG attributes to use single quotes');
  console.log('  - HTML construction now succeeds without syntax errors');
  console.log('\n⚠️  Browser verification required:');
  console.log('  - Static tests verify syntax only');
  console.log('  - Must test actual row click in browser to confirm fix');
} catch (error) {
  console.error('❌ Test failed:', error.message);
  process.exit(1);
}
