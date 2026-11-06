/**
 * Cache Size Analysis Test
 *
 * Simulates the actual cache payload to determine if it exceeds the 100KB limit.
 * This explains why cache is likely never hitting.
 */

const assert = require('assert');

console.log('Analyzing Status Tracker cache size...\n');

// Simulate a realistic Request_Master row with all columns
function createMockRow() {
  return [
    'ARCADE-1234',           // Number
    'Published',             // Status
    'Test Interactive Demo', // Final Demo Title
    'RHEL',                  // Primary Product
    'Installation',          // Primary Topic
    'creator@redhat.com',    // Creator Email
    'Creator Name',          // Creator Name
    'requestor@redhat.com',  // Requestor Email
    'Requestor Name',        // Requestor Name
    'https://demo.redhat.com/test', // Creation Link
    'This is a demo description that could be fairly long with multiple sentences explaining what the demo does and why it matters.', // Description
    'https://access.redhat.com/demo/test', // Drupal Page URL
    'GID-' + Math.random().toString(36).substring(7), // Global ID
    '2024-01-15 10:30:00',   // Date Submitted
    '2024-01-20 14:00:00',   // Published Date
    '5 minutes',             // Duration
    'Q1 2024',               // Quarter
    'Content Team',          // Creator Team
    'Marketing Team',        // Requestor Team
    'Request',               // Origin Type
    'en-US',                 // Language
    'NAPS',                  // Vertical
    '',                      // Event
    'https://redhat.com/cta', // CTA Link
    'Yes',                   // TDP
    '',                      // Sales Tactic
    '',                      // Marketing Program
    'No',                    // Synthetic Voice
    'No',                    // Translation
    'Yes',                   // Mobile Friendly
    '',                      // Group
    'No',                    // Employee Advocacy
    'OpenShift, Ansible',    // Other Products
    'Learn how to install and configure RHEL in a production environment', // SEO Description
    'https://docs.google.com/document/d/abc123', // Creation Brief
    '2024-01-15 10:30:00',   // Status Open TS
    '2024-01-16 09:00:00',   // Status Approved TS
    '2024-01-17 11:00:00',   // Status Received TS
    '2024-01-18 14:30:00',   // Status Reviewed TS
    '2024-01-20 14:00:00',   // Status Published TS
    '',                      // Status Retired TS
    '',                      // Status Closed TS
    'Refresh',               // Recommended Action
    'Low engagement',        // Action Reason
    'Medium',                // Action Priority
    'team@redhat.com',       // Assigned
    'Open',                  // Action Status
    '',                      // Action Completed Date
    '75',                    // Perf Score
    'Moderate',              // Perf Tier
    'Stable',                // Perf Trend
    'Good completion rate',  // Perf Signals
    '',                      // Perf Flags
    '150',                   // Players Per Month
    '85',                    // Completion Rate
    '5',                     // MT Opportunity
    '2',                     // MT Won
    '180',                   // Content Age
    '2024-11-01',            // Metrics Last Sync
    'Medium',                // Priority
    '',                      // Deadline
    'Yes',                   // Contacted BU
    'Yes',                   // Checked Existing
    'Developers',            // Primary Audience
    'DevOps Engineer',       // Personas
    'Complex installation',  // Pain Points
    'https://access.redhat.com/docs', // Relevant Links
    'Website, Social',       // Destination Channels
    'Yes',                   // Request Advocacy
    'Alternative demo description from creator', // Demo Desc Creator
    'RHEL, installation, setup, configuration', // SEO Words
    // Guide Extraction JSON - THIS IS THE BIG ONE
    JSON.stringify({
      title: 'Test Interactive Demo',
      bodyText: 'A'.repeat(8000),  // Typical extracted text (8-12KB)
      steps: Array(15).fill(null).map((_, i) => ({
        title: 'Step ' + (i + 1),
        description: 'B'.repeat(200),  // 200 chars per step
        actions: ['Click', 'Type', 'Navigate']
      })),
      metadata: {
        duration: '5 minutes',
        product: 'RHEL',
        version: '9.0'
      }
    })
  ];
}

// Simulate Request_Master data structure
function simulateRequestMasterCache(rowCount) {
  const headers = [
    'Number', 'Status', 'Final Demo Title', 'Primary Product', 'Primary Topic',
    'Creator Email', 'Creator Name', 'Requestor Email', 'Requestor Name',
    'Creation Link', 'Description', 'Drupal Page URL', 'Global ID',
    'Creator Submitted TS', 'Status Published TS', 'Duration', 'Quarter',
    'Creator Team', 'Requestor Team', 'Origin Type', 'Language', 'Vertical',
    'Event', 'CTA Link', 'TDP', 'Sales Tactic', 'Marketing Program',
    'Synthetic Voice', 'Translation', 'Mobile Friendly', 'Group',
    'Employee Advocacy', 'Product', 'Description for SEO', 'Creation Brief Doc URL',
    'Status Open TS', 'Status Approved TS', 'Status Received TS',
    'Status Reviewed TS', 'Status Published TS', 'Status Retired TS',
    'Status Closed TS', 'Recommended Action', 'Action Reason', 'Action Priority',
    'Assigned', 'Action Status', 'Action Completed Date', 'Perf Score',
    'Perf Tier', 'Perf Trend', 'Perf Signals', 'Perf Flags', 'Players Per Month',
    'Completion Rate', 'MT Opportunity', 'MT Won', 'Content Age',
    'Metrics Last Sync', 'Priority', 'Deadline', 'Contacted BU', 'Checked Existing',
    'Primary Audience', 'Personas', 'Pain Points', 'Relevant Links',
    'Destination Channels', 'Request Advocacy', 'Demo Desc Creator', 'SEO Words',
    'Guide Extraction JSON'
  ];

  const rows = [];
  for (let i = 0; i < rowCount; i++) {
    rows.push(createMockRow());
  }

  const headerMap = {};
  headers.forEach((h, i) => { headerMap[h] = i; });

  return { headers, rows, headerMap };
}

// Test cache size at different row counts
function testCacheSizeAtScale() {
  console.log('Testing cache size at different row counts:\n');

  const testCases = [
    { rows: 10, label: 'Small (10 rows)' },
    { rows: 50, label: 'Typical (50 rows)' },
    { rows: 100, label: 'Large (100 rows)' },
    { rows: 200, label: 'Very Large (200 rows)' }
  ];

  const CACHE_LIMIT_KB = 100;

  for (const testCase of testCases) {
    const data = simulateRequestMasterCache(testCase.rows);
    const serialized = JSON.stringify(data);
    const sizeKB = serialized.length / 1024;
    const overLimit = sizeKB > CACHE_LIMIT_KB;

    console.log(testCase.label + ':');
    console.log('  Rows: ' + testCase.rows);
    console.log('  Serialized size: ' + sizeKB.toFixed(1) + ' KB');
    console.log('  Cache limit: ' + CACHE_LIMIT_KB + ' KB');
    console.log('  Over limit: ' + (overLimit ? 'YES - CACHE WILL FAIL' : 'NO'));
    console.log('  Size per row: ' + (sizeKB / testCase.rows).toFixed(2) + ' KB');
    console.log('');
  }
}

// Test cache size WITHOUT Guide JSON
function testCacheSizeWithoutGuideJson() {
  console.log('Testing cache size WITHOUT Guide Extraction JSON:\n');

  const testCases = [
    { rows: 50, label: 'Typical (50 rows)' },
    { rows: 100, label: 'Large (100 rows)' },
    { rows: 200, label: 'Very Large (200 rows)' }
  ];

  const CACHE_LIMIT_KB = 100;
  const guideJsonIdx = 68; // Last column

  for (const testCase of testCases) {
    const data = simulateRequestMasterCache(testCase.rows);

    // Remove Guide JSON from all rows
    data.rows = data.rows.map(row => {
      const newRow = [...row];
      newRow[guideJsonIdx] = ''; // Empty out Guide JSON
      return newRow;
    });

    const serialized = JSON.stringify(data);
    const sizeKB = serialized.length / 1024;
    const overLimit = sizeKB > CACHE_LIMIT_KB;

    console.log(testCase.label + ' (no Guide JSON):');
    console.log('  Rows: ' + testCase.rows);
    console.log('  Serialized size: ' + sizeKB.toFixed(1) + ' KB');
    console.log('  Cache limit: ' + CACHE_LIMIT_KB + ' KB');
    console.log('  Over limit: ' + (overLimit ? 'YES' : 'NO'));
    console.log('  Size per row: ' + (sizeKB / testCase.rows).toFixed(2) + ' KB');
    console.log('');
  }
}

// Calculate Guide JSON contribution to cache size
function calculateGuideJsonImpact() {
  console.log('Calculating Guide JSON impact on cache size:\n');

  const rowCount = 50;
  const guideJsonIdx = 68;

  const dataWithGuideJson = simulateRequestMasterCache(rowCount);
  const withSize = JSON.stringify(dataWithGuideJson).length / 1024;

  const dataWithoutGuideJson = simulateRequestMasterCache(rowCount);
  dataWithoutGuideJson.rows = dataWithoutGuideJson.rows.map(row => {
    const newRow = [...row];
    newRow[guideJsonIdx] = '';
    return newRow;
  });
  const withoutSize = JSON.stringify(dataWithoutGuideJson).length / 1024;

  const reduction = withSize - withoutSize;
  const reductionPct = (reduction / withSize * 100).toFixed(1);

  console.log('Impact of Guide JSON on cache (50 rows):');
  console.log('  With Guide JSON: ' + withSize.toFixed(1) + ' KB');
  console.log('  Without Guide JSON: ' + withoutSize.toFixed(1) + ' KB');
  console.log('  Reduction: ' + reduction.toFixed(1) + ' KB (' + reductionPct + '%)');
  console.log('  Cache limit: 100 KB');
  console.log('');
  console.log('Conclusion:');
  if (withSize > 100) {
    console.log('  ❌ CACHE FAILING: With Guide JSON, cache exceeds 100KB limit');
    console.log('     Cache will NEVER hit - full sheet read on every request');
  }
  if (withoutSize > 100) {
    console.log('  ❌ STILL TOO LARGE: Even without Guide JSON, cache exceeds limit');
    console.log('     Need additional optimization beyond removing Guide JSON');
  } else {
    console.log('  ✅ CACHE VIABLE: Without Guide JSON, cache fits in 100KB limit');
    console.log('     Removing Guide JSON from cache would enable caching');
  }
  console.log('');
}

// Run all tests
try {
  testCacheSizeAtScale();
  testCacheSizeWithoutGuideJson();
  calculateGuideJsonImpact();

  console.log('========================================');
  console.log('SUMMARY');
  console.log('========================================');
  console.log('');
  console.log('The current implementation caches the ENTIRE Request_Master sheet');
  console.log('including all columns (headers, rows, headerMap).');
  console.log('');
  console.log('Problem: Guide Extraction JSON is ~10KB per row, causing cache to');
  console.log('exceed the 100KB limit at just 10-15 rows.');
  console.log('');
  console.log('Result: Cache ALWAYS fails, triggering full sheet read on EVERY request.');
  console.log('');
  console.log('Solution: Exclude Guide Extraction JSON from the SHEET READ itself,');
  console.log('not just the frontend payload. This requires reading a subset of columns');
  console.log('instead of all columns.');
  console.log('');
  console.log('Implementation: Replace getRange(2, 1, lastRow-1, lastCol) with');
  console.log('column-specific reads that exclude Guide Extraction JSON column.');
  console.log('');

} catch (error) {
  console.error('❌ Test failed:', error.message);
  process.exit(1);
}
