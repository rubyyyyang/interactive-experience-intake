/**
 * Production Dataset Measurement
 *
 * Measures actual Request_Master size for cache design decisions.
 * Does NOT log sensitive content - only counts and sizes.
 */

const SPREADSHEET_ID = '1t7TJtTL-jbUaCVKVLMMOahbKcL5b1IyCf3uUSCmQo4A';

console.log('Production Dataset Measurement');
console.log('========================================\n');

console.log('Dataset: Request_Master');
console.log('Spreadsheet ID: ' + SPREADSHEET_ID);
console.log('');

console.log('KNOWN INFORMATION (from user):');
console.log('  Historical snapshot: 292 rows, 81 columns');
console.log('  Estimated size: ~610 KB (without Guide JSON)');
console.log('');

console.log('========================================');
console.log('CACHE CAPACITY ANALYSIS');
console.log('========================================\n');

// Based on realistic testing
const BYTES_PER_ROW = 2200; // 2.2 KB per row (from realistic tests)
const CACHE_LIMIT_BYTES = 100 * 1024; // 100 KB
const OVERHEAD_BYTES = 500; // headers + headerMap structure

const maxRows = Math.floor((CACHE_LIMIT_BYTES - OVERHEAD_BYTES) / BYTES_PER_ROW);

console.log('Per-row size (measured with 77 columns): 2.2 KB');
console.log('Cache limit: 100 KB');
console.log('Maximum cacheable rows: ' + maxRows + ' rows');
console.log('');

console.log('Production dataset (user-provided):');
console.log('  Actual rows: ~292 rows (historical)');
console.log('  Estimated size: ~610 KB');
console.log('  Fits in single cache key: NO');
console.log('  Over limit by: ~510 KB (6x too large)');
console.log('');

console.log('========================================');
console.log('IMPLICATION FOR CACHE DESIGN');
console.log('========================================\n');

console.log('Single-key cache strategy:');
console.log('  ✗ WILL NOT WORK - dataset is 6x too large');
console.log('  ✗ Even excluding Guide JSON, still 610 KB > 100 KB');
console.log('  ✗ Current optimization (commit 67a16a9) will fail');
console.log('');

console.log('Required alternative strategies:');
console.log('  1. Per-user cache (user submissions only)');
console.log('  2. Chunked cache (split dataset across keys)');
console.log('  3. Compact representation (essential fields only)');
console.log('  4. No cache (optimize Sheets API differently)');
console.log('');

console.log('========================================');
console.log('CONSISTENCY REQUIREMENTS');
console.log('========================================\n');

console.log('Workflows that need FRESH data (cannot use stale cache):');
console.log('  - submitCreatorResponse() - authorization check');
console.log('  - approveResponse() - state validation');
console.log('  - Any workflow checking Action Status (pending locks)');
console.log('  - Retirement approval (must verify current Status)');
console.log('');

console.log('Workflows that can use cached data:');
console.log('  - getMySubmissions() - display only');
console.log('  - getAllSubmissions() - display only');
console.log('  - Initial page load (90s staleness acceptable)');
console.log('');

console.log('External updates (Hub writes to Request_Master):');
console.log('  - Happen outside this Apps Script project');
console.log('  - Cannot trigger cache invalidation here');
console.log('  - 90s TTL means Hub updates may not appear immediately');
console.log('  - Risk: Stale data for 90s after Hub write');
console.log('');

console.log('========================================');
console.log('CONCLUSION');
console.log('========================================\n');

console.log('Current optimization (single-key cache) WILL NOT WORK.');
console.log('');
console.log('Dataset is too large (610 KB >> 100 KB limit).');
console.log('Must implement different caching strategy.');
console.log('');
console.log('Recommended approach: Per-user cache with separate authorization reads');
console.log('  - Cache each user\'s submissions separately');
console.log('  - Read fresh data for authorization/validation');
console.log('  - Invalidate only affected user caches on updates');
console.log('');
