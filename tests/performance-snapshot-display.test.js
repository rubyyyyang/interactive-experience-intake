/**
 * Performance Snapshot Display Test
 * Verifies unified performance snapshot rendering
 */

const assert = require('assert');
const fs = require('fs');

console.log('Running performance snapshot display test...\n');

const html = fs.readFileSync('/Users/rubyyang/arcade-intake-app/StatusTracker.html', 'utf8');
const config = fs.readFileSync('/Users/rubyyang/arcade-intake-app/IA_Config.js', 'utf8');
const tracker = fs.readFileSync('/Users/rubyyang/arcade-intake-app/IA_StatusTracker.js', 'utf8');

function testPerformanceColumnsAdded() {
  console.log('Test: Performance metric columns added to config');

  const hasPlayersPerMonth = /PLAYERS_PER_MONTH: 'All-time Players\/ Active Months'/.test(config);
  const hasCompletionRate = /COMPLETION_RATE: 'All-time Completion Rate'/.test(config);

  assert.ok(hasPlayersPerMonth, 'Should have PLAYERS_PER_MONTH column');
  assert.ok(hasCompletionRate, 'Should have COMPLETION_RATE column');

  console.log('  ✓ Performance columns added\n');
}

function testDataMappingIncludesMetrics() {
  console.log('Test: Data mapping includes new metrics');

  const mapsPlayersPerMonth = /playersPerMonth: getNumeric\(col\.PLAYERS_PER_MONTH\)/.test(tracker);
  const mapsCompletionRate = /completionRate: getNumeric\(col\.COMPLETION_RATE\)/.test(tracker);

  assert.ok(mapsPlayersPerMonth, 'Should map playersPerMonth');
  assert.ok(mapsCompletionRate, 'Should map completionRate');

  console.log('  ✓ Data mapping includes metrics\n');
}

function testBuildPerformanceSnapshotExists() {
  console.log('Test: buildPerformanceSnapshot function exists');

  const hasFunction = /function buildPerformanceSnapshot\(sub\)/.test(html);

  assert.ok(hasFunction, 'Should have buildPerformanceSnapshot function');

  console.log('  ✓ Function exists\n');
}

function testOnlyForPublishedDemos() {
  console.log('Test: Snapshot only shown for Published status');

  const checksPublished = /status !== 'Published'[\s\S]{0,100}return ''/.test(html);

  assert.ok(checksPublished, 'Should return empty for non-Published demos');

  console.log('  ✓ Only shown for Published demos\n');
}

function testRequiresPerformanceData() {
  console.log('Test: Requires performance data to display');

  const checksHasData = /hasData = sub\.playersPerMonth/.test(html) && /sub\.completionRate/.test(html) && /sub\.mtOpportunity/.test(html);
  const returnsIfNoData = /!hasData[\s\S]{0,100}return ''/.test(html);

  assert.ok(checksHasData, 'Should check if performance data exists');
  assert.ok(returnsIfNoData, 'Should return empty if no data');

  console.log('  ✓ Requires performance data\n');
}

function testRenderedAbovePublishingTimeline() {
  console.log('Test: Rendered above Publishing timeline');

  // Should be in rendering order: buildActionBanner + buildPerformanceSnapshot + buildLifecycle
  const correctOrder = /buildActionBanner\(sub\).*\+.*buildPerformanceSnapshot\(sub\).*\+.*buildLifecycle\(sub\)/.test(html);

  assert.ok(correctOrder, 'Should render between Action banner and Lifecycle timeline');

  console.log('  ✓ Correct rendering order\n');
}

function testDisplaysLastRefreshed() {
  console.log('Test: Displays Last refreshed timestamp');

  const hasLastRefreshed = /Last refreshed:/.test(html);
  const usesPerformanceLastRefreshed = /performanceLastRefreshed/.test(html);
  const handlesNotAvailable = /Not available/.test(html);

  assert.ok(hasLastRefreshed, 'Should have "Last refreshed:" label');
  assert.ok(usesPerformanceLastRefreshed, 'Should use performanceLastRefreshed variable');
  assert.ok(handlesNotAvailable, 'Should handle missing timestamp');

  console.log('  ✓ Last refreshed displayed\n');
}

function testFormatsMMMDYYYY() {
  console.log('Test: Formats timestamp as MMM D, YYYY');

  // Should extract month, day, year
  const usesMonthsArray = /months = \['Jan', 'Feb', 'Mar'/.test(html);
  const formatsCorrectly = /months\[refreshDate\.getMonth\(\)\].*refreshDate\.getDate\(\).*refreshDate\.getFullYear\(\)/.test(html);

  assert.ok(usesMonthsArray, 'Should have months array');
  assert.ok(formatsCorrectly, 'Should format as MMM D, YYYY');

  console.log('  ✓ Timestamp formatted correctly\n');
}

function testDisplaysPlayersPerMonth() {
  console.log('Test: Displays Avg. monthly players with benchmark');

  const hasLabel = /Avg\. monthly players/.test(html);
  const usesBenchmark15 = /Benchmark: 15\/month/.test(html);
  const usesPlayersPerMonth = /sub\.playersPerMonth/.test(html);

  assert.ok(hasLabel, 'Should have "Avg. monthly players" label');
  assert.ok(usesBenchmark15, 'Should show benchmark: 15/month');
  assert.ok(usesPlayersPerMonth, 'Should use sub.playersPerMonth');

  console.log('  ✓ Players per month displayed\n');
}

function testDisplaysCompletionRate() {
  console.log('Test: Displays Completion rate with 40% benchmark');

  const hasLabel = /Completion rate/.test(html);
  const usesBenchmark40 = /Benchmark: 40%/.test(html);
  const convertsToPercent = /sub\.completionRate.*\* 100/.test(html);

  assert.ok(hasLabel, 'Should have "Completion rate" label');
  assert.ok(usesBenchmark40, 'Should show benchmark: 40%');
  assert.ok(convertsToPercent, 'Should convert decimal to percentage');

  console.log('  ✓ Completion rate displayed\n');
}

function testDisplaysMTPVPipeline() {
  console.log('Test: Displays MTPV pipeline (not MT Opportunity)');

  const usesCorrectLabel = /Attributed pipeline \(MTPV\)/.test(html);
  const showsAllTime = /All-time/.test(html);
  const usesMtOpportunity = /sub\.mtOpportunity/.test(html);

  assert.ok(usesCorrectLabel, 'Should use label "Attributed pipeline (MTPV)"');
  assert.ok(showsAllTime, 'Should show "All-time"');
  assert.ok(usesMtOpportunity, 'Should use sub.mtOpportunity data');

  console.log('  ✓ MTPV pipeline displayed\n');
}

function testDisplaysMTPVWon() {
  console.log('Test: Displays MTPV won (not MT Won)');

  const usesCorrectLabel = /Attributed won \(MTPV\)/.test(html);
  const usesMtWon = /sub\.mtWon/.test(html);

  assert.ok(usesCorrectLabel, 'Should use label "Attributed won (MTPV)"');
  assert.ok(usesMtWon, 'Should use sub.mtWon data');

  console.log('  ✓ MTPV won displayed\n');
}

function testDisplaysContentAge() {
  console.log('Test: Displays Content age');

  const hasLabel = /Content age/.test(html);
  const usesContentAge = /sub\.contentAge/.test(html);
  const handlesPlural = /ageMonths === 1.*'1 month'.*ageMonths \+ ' months'/.test(html);

  assert.ok(hasLabel, 'Should have "Content age" label');
  assert.ok(usesContentAge, 'Should use sub.contentAge');
  assert.ok(handlesPlural, 'Should handle singular/plural');

  console.log('  ✓ Content age displayed\n');
}

function testDistinguishesMissingVsZero() {
  console.log('Test: Distinguishes missing values from zero');

  // Should check != null, not just truthiness
  const checksNull = /sub\.playersPerMonth != null/.test(html);

  // Should check > 0 for MTPV to avoid showing $0
  const checksGreaterThanZero = /mtOpportunity > 0/.test(html);

  assert.ok(checksNull, 'Should check != null for numeric values');
  assert.ok(checksGreaterThanZero, 'Should check > 0 for MTPV values');

  console.log('  ✓ Missing values handled correctly\n');
}

function testUsesGridLayout() {
  console.log('Test: Uses responsive grid layout');

  const usesGrid = /display:grid;grid-template-columns/.test(html);
  const responsive = /auto-fit/.test(html);

  assert.ok(usesGrid, 'Should use CSS grid');
  assert.ok(responsive, 'Should be responsive (auto-fit)');

  console.log('  ✓ Responsive grid layout\n');
}

// Run all tests
try {
  testPerformanceColumnsAdded();
  testDataMappingIncludesMetrics();
  testBuildPerformanceSnapshotExists();
  testOnlyForPublishedDemos();
  testRequiresPerformanceData();
  testRenderedAbovePublishingTimeline();
  testDisplaysLastRefreshed();
  testFormatsMMMDYYYY();
  testDisplaysPlayersPerMonth();
  testDisplaysCompletionRate();
  testDisplaysMTPVPipeline();
  testDisplaysMTPVWon();
  testDisplaysContentAge();
  testDistinguishesMissingVsZero();
  testUsesGridLayout();

  console.log('✅ All performance snapshot display tests passed');
  console.log('\n📋 Verified behavior:');
  console.log('  ✓ Performance columns added to config');
  console.log('  ✓ Data mapping includes new metrics');
  console.log('  ✓ Only shown for Published demos with data');
  console.log('  ✓ Rendered above Publishing timeline');
  console.log('  ✓ Last refreshed: MMM D, YYYY or Not available');
  console.log('  ✓ Avg. monthly players (benchmark: 15/month)');
  console.log('  ✓ Completion rate (benchmark: 40%)');
  console.log('  ✓ Attributed pipeline (MTPV)');
  console.log('  ✓ Attributed won (MTPV)');
  console.log('  ✓ Content age');
  console.log('  ✓ Missing values ≠ zero values');
  console.log('  ✓ Responsive grid layout');
} catch (error) {
  console.error('❌ Test failed:', error.message);
  process.exit(1);
}
