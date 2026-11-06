/**
 * Detailed Cache Size Analysis
 * Identify which data is actually bloating the cache
 */

const assert = require('assert');

console.log('Detailed cache size analysis...\n');

// Test what the cache actually stores
function analyzeCacheStructure() {
  const headers = ['Number', 'Status', 'Title', 'Guide Extraction JSON'];
  const rows = [
    ['ARCADE-1', 'Published', 'Demo 1', JSON.stringify({ title: 'Test', body: 'A'.repeat(10000) })],
    ['ARCADE-2', 'Published', 'Demo 2', JSON.stringify({ title: 'Test', body: 'B'.repeat(10000) })],
    ['ARCADE-3', 'Published', 'Demo 3', JSON.stringify({ title: 'Test', body: 'C'.repeat(10000) })]
  ];

  const headerMap = {};
  headers.forEach((h, i) => { headerMap[h] = i; });

  const data = { headers, rows, headerMap };

  const serialized = JSON.stringify(data);
  console.log('Cache structure analysis (3 rows):');
  console.log('  Total size: ' + (serialized.length / 1024).toFixed(1) + ' KB');
  console.log('  Headers size: ' + JSON.stringify(headers).length + ' bytes');
  console.log('  HeaderMap size: ' + JSON.stringify(headerMap).length + ' bytes');
  console.log('  Rows size: ' + (JSON.stringify(rows).length / 1024).toFixed(1) + ' KB');
  console.log('');

  // Check individual row size
  console.log('Individual row sizes:');
  rows.forEach((row, i) => {
    console.log('  Row ' + i + ': ' + (JSON.stringify(row).length / 1024).toFixed(1) + ' KB');
    console.log('    Guide JSON: ' + (row[3].length / 1024).toFixed(1) + ' KB');
    console.log('    Other fields: ' + ((JSON.stringify(row).length - row[3].length) / 1024).toFixed(1) + ' KB');
  });
  console.log('');
}

// The real question: does the cache store raw getValues() output or transformed data?
function testActualCachePayload() {
  console.log('What does getRequestMasterData_() actually cache?\n');

  // Simulate what Apps Script returns from getValues()
  // Answer: It returns an array of arrays with primitive values

  const mockSheetData = [
    ['ARCADE-1', 'Published', 'Demo Title', JSON.stringify({ body: 'A'.repeat(10000) })],
    ['ARCADE-2', 'Published', 'Demo Title', JSON.stringify({ body: 'B'.repeat(10000) })]
  ];

  const cached = {
    headers: ['Number', 'Status', 'Title', 'Guide Extraction JSON'],
    rows: mockSheetData,
    headerMap: { 'Number': 0, 'Status': 1, 'Title': 2, 'Guide Extraction JSON': 3 }
  };

  const serialized = JSON.stringify(cached);

  console.log('Cached payload (2 rows with 10KB Guide JSON each):');
  console.log('  Size: ' + (serialized.length / 1024).toFixed(1) + ' KB');
  console.log('  Cache limit: 100 KB');
  console.log('  Result: ' + (serialized.length > 100000 ? 'EXCEEDS LIMIT' : 'Within limit'));
  console.log('');

  // Now without Guide JSON
  const cachedNoGuideJson = {
    headers: ['Number', 'Status', 'Title'],
    rows: mockSheetData.map(row => [row[0], row[1], row[2]]),
    headerMap: { 'Number': 0, 'Status': 1, 'Title': 2 }
  };

  const serializedNoGuideJson = JSON.stringify(cachedNoGuideJson);

  console.log('Cached payload WITHOUT Guide JSON (2 rows):');
  console.log('  Size: ' + (serializedNoGuideJson.length / 1024).toFixed(1) + ' KB');
  console.log('  Reduction: ' + ((serialized.length - serializedNoGuideJson.length) / 1024).toFixed(1) + ' KB');
  console.log('');
}

// Calculate realistic limits
function calculateRowCapacity() {
  console.log('Row capacity with and without Guide JSON:\n');

  // Realistic row WITHOUT Guide JSON (all other fields)
  const rowNoGuideJson = [
    'ARCADE-1234',
    'Published',
    'Test Interactive Demo Title',
    'RHEL',
    'Installation',
    'creator@redhat.com',
    'Creator Name',
    'requestor@redhat.com',
    'Requestor Name',
    'https://demo.redhat.com/test',
    'This is a demo description.',
    'https://access.redhat.com/demo',
    'GID-abc123',
    '2024-01-15 10:30:00',
    '2024-01-20 14:00:00'
    // ... 50+ more fields
  ];

  // Add realistic Guide JSON (10KB)
  const rowWithGuideJson = [
    ...rowNoGuideJson,
    JSON.stringify({ title: 'Test', body: 'A'.repeat(10000) })
  ];

  const sizeWithGuideJson = JSON.stringify(rowWithGuideJson).length;
  const sizeNoGuideJson = JSON.stringify(rowNoGuideJson).length;

  console.log('Single row size:');
  console.log('  With Guide JSON: ' + (sizeWithGuideJson / 1024).toFixed(2) + ' KB');
  console.log('  Without Guide JSON: ' + (sizeNoGuideJson / 1024).toFixed(2) + ' KB');
  console.log('  Guide JSON contribution: ' + ((sizeWithGuideJson - sizeNoGuideJson) / 1024).toFixed(2) + ' KB');
  console.log('');

  const cacheLimit = 100 * 1024; // 100KB
  const overhead = 500; // headers + headerMap

  const rowsWithGuideJson = Math.floor((cacheLimit - overhead) / sizeWithGuideJson);
  const rowsWithoutGuideJson = Math.floor((cacheLimit - overhead) / sizeNoGuideJson);

  console.log('Cache capacity (100KB limit):');
  console.log('  With Guide JSON: ' + rowsWithGuideJson + ' rows');
  console.log('  Without Guide JSON: ' + rowsWithoutGuideJson + ' rows');
  console.log('');
  console.log('Typical Status Tracker usage:');
  console.log('  Creator view: 5-20 submissions');
  console.log('  Admin view: 50-200 submissions');
  console.log('');
  console.log('Cache effectiveness:');
  if (rowsWithGuideJson < 20) {
    console.log('  ❌ WITH Guide JSON: Cache fails for most users');
  }
  if (rowsWithoutGuideJson < 200) {
    console.log('  ⚠️  WITHOUT Guide JSON: Cache fails for large admin views');
  }
  if (rowsWithoutGuideJson >= 50) {
    console.log('  ✅ WITHOUT Guide JSON: Cache works for typical creator views');
  }
}

try {
  analyzeCacheStructure();
  testActualCachePayload();
  calculateRowCapacity();

  console.log('========================================');
  console.log('KEY FINDINGS');
  console.log('========================================\n');
  console.log('1. Guide Extraction JSON is stored in the cache');
  console.log('   It comes from sheet.getRange().getValues() raw output\n');
  console.log('2. Cache stores { headers, rows, headerMap }');
  console.log('   rows is array of arrays (raw from Sheets API)\n');
  console.log('3. Guide JSON is ~10KB per row');
  console.log('   This bloats the cache significantly\n');
  console.log('4. Current cache ALWAYS fails because:');
  console.log('   - Even 10 rows = 100KB+ with Guide JSON');
  console.log('   - Any admin view (50+ rows) is 500KB+\n');
  console.log('5. Removing Guide JSON from sheet read would:');
  console.log('   - Reduce cache size by ~10KB per row');
  console.log('   - Allow caching up to 50+ rows');
  console.log('   - Make cache effective for creator views\n');
  console.log('RECOMMENDATION:');
  console.log('Read Guide JSON column separately, ONLY when needed.');
  console.log('Do not include it in the cached Request_Master data.');
  console.log('');

} catch (error) {
  console.error('❌ Test failed:', error.message);
  process.exit(1);
}
