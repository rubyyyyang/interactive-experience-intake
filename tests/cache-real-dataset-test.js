/**
 * Real Dataset Cache Test
 *
 * Simulates actual Request_Master data structure to verify cache size
 * with realistic column count and data density.
 */

const assert = require('assert');

console.log('Real Dataset Cache Size Test\n');
console.log('========================================\n');

// Realistic Request_Master row based on actual schema
function createRealisticRow(includeGuideJson) {
  // Request_Master has ~70 columns based on STATUS_TRACKER_COLUMNS
  const row = [
    'ARCADE-1234',                    // Number
    'Published',                      // Status
    'Interactive Demo: Installing RHEL 9 on Bare Metal Servers',  // Final Demo Title
    'RHEL',                           // Primary Product
    'Installation',                   // Primary Topic
    'Installation, Configuration, Management',  // Topic
    'Interactive Demo',               // Content Type
    'creator@redhat.com',             // Creator Email
    'John Doe',                       // Creator Name
    'requestor@redhat.com',           // Requestor Email
    'Jane Smith',                     // Requestor Name
    'https://demo.redhat.com/test\nhttps://demo.redhat.com/test/v2',  // Creation Link
    'https://access.redhat.com/demo/installing-rhel-9',  // Drupal Page URL
    'https://access.redhat.com/demo/installing-rhel-9',  // Public Site Link
    '',                               // RHAC Page
    '2024-01-20 14:00:00',            // Status Published TS
    'GID-abc123xyz789',               // Global ID
    'Learn how to install and configure Red Hat Enterprise Linux 9 in a production environment with best practices for security and performance.',  // Description
    'https://demo.redhat.com/test/production',  // Production Link
    '5 minutes',                      // Duration
    'Q1 2024',                        // Quarter
    'Content Services Team',          // Creator Team
    'Marketing Team',                 // Requestor Team
    'Request',                        // Origin Type
    'en-US',                          // Language
    'NAPS',                           // Vertical
    '',                               // Event
    'https://www.redhat.com/en/technologies/linux-platforms/enterprise-linux',  // CTA Link
    'Yes',                            // TDP
    '',                               // Sales Tactic
    '',                               // Marketing Program
    'No',                             // Synthetic Voice
    'No',                             // Translation
    'Yes',                            // Mobile Friendly
    '',                               // Group
    'No',                             // Employee Advocacy
    'OpenShift, Ansible Automation Platform, Red Hat Satellite',  // Product (other products)
    'Learn the complete step-by-step process for installing RHEL 9, including system requirements, disk partitioning, network configuration, and initial security hardening.',  // Description for SEO
    'https://docs.google.com/document/d/1234567890abcdefghijk',  // Creation Brief Doc URL
    '2024-01-15 10:30:00',            // Status Open TS
    '2024-01-16 09:00:00',            // Status Approved TS
    '2024-01-17 11:00:00',            // Status Received TS
    '2024-01-18 14:30:00',            // Status Reviewed TS
    '2024-01-20 14:00:00',            // Status Published TS (duplicate)
    '',                               // Status Retired TS
    '',                               // Status Closed TS
    'Refresh',                        // Recommended Action
    'Low engagement trend detected over past 30 days with declining completion rate',  // Action Reason
    'Medium',                         // Action Priority
    'team@redhat.com',                // Assigned
    'Open',                           // Action Status
    '',                               // Action Completed Date
    '75',                             // Perf Score
    'Moderate',                       // Perf Tier
    'Stable',                         // Perf Trend
    'Completion rate above average at 85%, player count stable around 150/month, no recent spikes',  // Perf Signals
    '',                               // Perf Flags
    '150',                            // Players Per Month
    '85',                             // Completion Rate
    '5',                              // MT Opportunity
    '2',                              // MT Won
    '180',                            // Content Age
    '2024-11-01',                     // Metrics Last Sync
    'Medium',                         // Priority
    '',                               // Deadline
    'Yes',                            // Contacted BU
    'Yes',                            // Checked Existing
    'Developers, System Administrators, IT Operations',  // Primary Audience
    'Linux System Administrator, DevOps Engineer, Platform Engineer',  // Personas
    'Complex installation process, unclear documentation, lack of hands-on practice environment',  // Pain Points
    'https://access.redhat.com/documentation/en-us/red_hat_enterprise_linux/9',  // Relevant Links
    'Website, Social Media, Email Newsletter, Partner Portal',  // Destination Channels
    'Yes',                            // Request Advocacy
    'This interactive demo provides a comprehensive hands-on walkthrough of the RHEL 9 installation process, designed for both new and experienced administrators.',  // Demo Desc Creator
    'RHEL, RHEL 9, installation, setup, configuration, enterprise linux, red hat, linux administration, system deployment',  // SEO Words
    '2024-01-15 10:30:00'             // Creator Submitted TS
  ];

  if (includeGuideJson) {
    // Realistic Guide Extraction JSON (10-12KB typical)
    row.push(JSON.stringify({
      title: 'Interactive Demo: Installing RHEL 9 on Bare Metal Servers',
      bodyText: 'This interactive demonstration walks you through the complete process of installing Red Hat Enterprise Linux 9 on bare metal servers. You will learn about system requirements, disk partitioning strategies, network configuration, and initial security hardening. The demo covers both automated and manual installation methods, including custom kickstart configuration. ' + 'A'.repeat(8000),
      steps: Array(15).fill(null).map((_, i) => ({
        title: 'Step ' + (i + 1) + ': ' + ['System Requirements', 'Download ISO', 'Create Bootable Media', 'Boot from Media', 'Select Installation Language', 'Configure Disk Partitioning', 'Configure Network', 'Set Root Password', 'Create User Account', 'Select Software Packages', 'Begin Installation', 'Complete Installation', 'Reboot System', 'Initial Login', 'Verify Installation'][i],
        description: 'Detailed instructions for this step including screenshots and configuration examples. ' + 'B'.repeat(200),
        actions: ['Click', 'Type', 'Navigate', 'Verify', 'Configure']
      })),
      metadata: {
        duration: '5 minutes',
        product: 'RHEL',
        version: '9.0',
        difficulty: 'Intermediate',
        prerequisites: 'Basic Linux knowledge'
      }
    }));
  }

  return row;
}

// Test with different dataset sizes
function testRealDatasetCacheSize() {
  console.log('Testing cache size with realistic Request_Master data:\n');

  const testCases = [
    { rows: 50, label: 'Small deployment (50 rows)' },
    { rows: 100, label: 'Medium deployment (100 rows)' },
    { rows: 200, label: 'Large deployment (200 rows)' },
    { rows: 500, label: 'Very large deployment (500 rows)' }
  ];

  const CACHE_LIMIT = 100 * 1024; // 100KB

  // Build realistic headers (70+ columns)
  const allHeaders = [
    'Number', 'Status', 'Final Demo Title', 'Primary Product', 'Primary Topic',
    'Topic', 'Content Type', 'Creator Email', 'Creator Name', 'Requestor Email',
    'Requestor Name', 'Creation Link', 'Drupal Page URL', 'Public Site Link',
    'RHAC Page', 'Status Published TS', 'Global ID', 'Description',
    'Production Link', 'Duration', 'Quarter', 'Creator Team', 'Requestor Team',
    'Origin Type', 'Language', 'Vertical', 'Event', 'CTA Link', 'TDP',
    'Sales Tactic', 'Marketing Program', 'Synthetic Voice', 'Translation',
    'Mobile Friendly', 'Group', 'Employee Advocacy', 'Product',
    'Description for SEO', 'Creation Brief Doc URL', 'Status Open TS',
    'Status Approved TS', 'Status Received TS', 'Status Reviewed TS',
    'Status Published TS', 'Status Retired TS', 'Status Closed TS',
    'Recommended Action', 'Action Reason', 'Action Priority', 'Assigned',
    'Action Status', 'Action Completed Date', 'Perf Score', 'Perf Tier',
    'Perf Trend', 'Perf Signals', 'Perf Flags', 'Players Per Month',
    'Completion Rate', 'MT Opportunity', 'MT Won', 'Content Age',
    'Metrics Last Sync', 'Priority', 'Deadline', 'Contacted BU',
    'Checked Existing', 'Primary Audience', 'Personas', 'Pain Points',
    'Relevant Links', 'Destination Channels', 'Request Advocacy',
    'Demo Desc Creator', 'SEO Words', 'Creator Submitted TS',
    'Guide Extraction JSON'
  ];

  console.log('Schema info:');
  console.log('  Total columns: ' + allHeaders.length);
  console.log('  Guide JSON column index: ' + allHeaders.indexOf('Guide Extraction JSON'));
  console.log('');

  console.log('========================================');
  console.log('WITH Guide Extraction JSON (current prod):');
  console.log('========================================\n');

  for (const testCase of testCases) {
    const rows = Array(testCase.rows).fill(null).map(() => createRealisticRow(true));
    const headerMap = {};
    allHeaders.forEach((h, i) => { headerMap[h] = i; });

    const cacheData = { headers: allHeaders, rows, headerMap };
    const serialized = JSON.stringify(cacheData);
    const sizeBytes = serialized.length;
    const sizeKB = sizeBytes / 1024;

    console.log(testCase.label + ':');
    console.log('  Rows: ' + testCase.rows);
    console.log('  Cache size: ' + sizeKB.toFixed(2) + ' KB');
    console.log('  Fits in 100KB limit: ' + (sizeBytes <= CACHE_LIMIT ? 'YES' : 'NO'));
    console.log('  Size per row: ' + (sizeKB / testCase.rows).toFixed(2) + ' KB');
    console.log('');
  }

  console.log('========================================');
  console.log('WITHOUT Guide Extraction JSON (optimized):');
  console.log('========================================\n');

  const guideJsonIdx = allHeaders.indexOf('Guide Extraction JSON');
  const headersNoGuide = allHeaders.filter((_, idx) => idx !== guideJsonIdx);

  for (const testCase of testCases) {
    const allRows = Array(testCase.rows).fill(null).map(() => createRealisticRow(true));
    const rows = allRows.map(row => row.filter((_, idx) => idx !== guideJsonIdx));

    const headerMap = {};
    headersNoGuide.forEach((h, i) => { headerMap[h] = i; });

    const cacheData = { headers: headersNoGuide, rows, headerMap };
    const serialized = JSON.stringify(cacheData);
    const sizeBytes = serialized.length;
    const sizeKB = sizeBytes / 1024;

    console.log(testCase.label + ':');
    console.log('  Rows: ' + testCase.rows);
    console.log('  Cache size: ' + sizeKB.toFixed(2) + ' KB');
    console.log('  Fits in 100KB limit: ' + (sizeBytes <= CACHE_LIMIT ? 'YES' : 'NO'));
    console.log('  Size per row: ' + (sizeKB / testCase.rows).toFixed(2) + ' KB');
    console.log('');
  }

  console.log('========================================');
  console.log('ANALYSIS');
  console.log('========================================\n');

  // Calculate realistic row size
  const sampleRow = createRealisticRow(false);
  const sampleRowSize = JSON.stringify(sampleRow).length;
  const sampleRowKB = sampleRowSize / 1024;

  console.log('Per-row size analysis:');
  console.log('  Single row (no Guide JSON): ' + sampleRowKB.toFixed(2) + ' KB');
  console.log('  Estimated capacity at 100KB: ' + Math.floor(CACHE_LIMIT / sampleRowSize) + ' rows');
  console.log('');

  const withGuide = createRealisticRow(true);
  const withGuideSize = JSON.stringify(withGuide).length;
  const guideSize = withGuideSize - sampleRowSize;

  console.log('Guide JSON impact:');
  console.log('  Guide JSON size per row: ' + (guideSize / 1024).toFixed(2) + ' KB');
  console.log('  Percentage of row data: ' + ((guideSize / withGuideSize) * 100).toFixed(1) + '%');
  console.log('');
}

// Test cache serialization overhead
function testCacheOverhead() {
  console.log('========================================');
  console.log('CACHE STRUCTURE OVERHEAD');
  console.log('========================================\n');

  const headers = ['Col1', 'Col2', 'Col3'];
  const headerMap = { 'Col1': 0, 'Col2': 1, 'Col3': 2 };

  const overheadEmpty = JSON.stringify({ headers, rows: [], headerMap }).length;
  console.log('Empty cache structure: ' + overheadEmpty + ' bytes');

  const rows1 = [['a', 'b', 'c']];
  const overhead1 = JSON.stringify({ headers, rows: rows1, headerMap }).length;
  const data1 = JSON.stringify(rows1).length;
  console.log('1 row overhead: ' + (overhead1 - data1) + ' bytes');

  const rows10 = Array(10).fill(['a', 'b', 'c']);
  const overhead10 = JSON.stringify({ headers, rows: rows10, headerMap }).length;
  const data10 = JSON.stringify(rows10).length;
  console.log('10 rows overhead: ' + (overhead10 - data10) + ' bytes');
  console.log('');
}

// Run tests
try {
  testRealDatasetCacheSize();
  testCacheOverhead();

  console.log('========================================');
  console.log('CONCLUSION');
  console.log('========================================\n');
  console.log('Based on realistic Request_Master schema (70+ columns):');
  console.log('');
  console.log('WITH Guide JSON:');
  console.log('  ✗ 50 rows: Exceeds 100KB limit');
  console.log('  ✗ 100+ rows: Far exceeds limit');
  console.log('  ✗ Cache NEVER works');
  console.log('');
  console.log('WITHOUT Guide JSON:');
  console.log('  ✓ 50 rows: Fits comfortably');
  console.log('  ✓ 100 rows: May exceed depending on data density');
  console.log('  ⚠ 200+ rows: Likely exceeds limit');
  console.log('');
  console.log('RECOMMENDATION:');
  console.log('  If production has >100 rows, cache may still fail');
  console.log('  Need to measure ACTUAL production row count');
  console.log('  If >100 rows, consider per-user cache or compact representation');
  console.log('');

} catch (error) {
  console.error('❌ Test failed:', error.message);
  console.error(error.stack);
  process.exit(1);
}
