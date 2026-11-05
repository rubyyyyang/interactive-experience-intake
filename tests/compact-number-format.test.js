/**
 * Compact Number Format Test
 * Verifies K/M formatting for large numbers
 */

const assert = require('assert');

console.log('Running compact number format test...\n');

function formatCompactNumber(val) {
  var num = Number(val);
  if (isNaN(num)) return val;
  if (num >= 1000000) return (num / 1000000).toFixed(2).replace(/\.?0+$/, '') + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
  return num.toLocaleString();
}

function testSmallNumbers() {
  console.log('Test: Small numbers unchanged');

  assert.strictEqual(formatCompactNumber(0), '0');
  assert.strictEqual(formatCompactNumber(950), '950');
  assert.strictEqual(formatCompactNumber(42), '42');

  console.log('  ✓ Small numbers\n');
}

function testThousands() {
  console.log('Test: Thousands formatted with K');

  assert.strictEqual(formatCompactNumber(1200), '1.2K');
  assert.strictEqual(formatCompactNumber(25000), '25K');
  assert.strictEqual(formatCompactNumber(1000), '1K');
  assert.strictEqual(formatCompactNumber(1500), '1.5K');

  console.log('  ✓ Thousands\n');
}

function testMillions() {
  console.log('Test: Millions formatted with M');

  assert.strictEqual(formatCompactNumber(1540000), '1.54M');
  assert.strictEqual(formatCompactNumber(1000000), '1M');
  assert.strictEqual(formatCompactNumber(2500000), '2.5M');

  console.log('  ✓ Millions\n');
}

function testTrailingZeros() {
  console.log('Test: Trailing zeros removed');

  assert.strictEqual(formatCompactNumber(1000000), '1M'); // not 1.00M
  assert.strictEqual(formatCompactNumber(5000), '5K'); // not 5.0K

  console.log('  ✓ Trailing zeros removed\n');
}

// Run all tests
try {
  testSmallNumbers();
  testThousands();
  testMillions();
  testTrailingZeros();

  console.log('✅ All compact number format tests passed');
  console.log('\n📋 Format examples:');
  console.log('  $950 → $950');
  console.log('  $1,200 → $1.2K');
  console.log('  $25,000 → $25K');
  console.log('  $1,540,000 → $1.54M');
} catch (error) {
  console.error('❌ Test failed:', error.message);
  process.exit(1);
}
