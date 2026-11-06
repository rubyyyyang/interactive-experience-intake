# Cache Optimization Implementation Report

**Date:** 2026-11-05  
**Optimization:** Exclude Guide Extraction JSON from server-side cache  
**Status:** Implemented, tested, ready for deployment to test environment

---

## Problem Statement

Status Tracker page loads are slow (1-3 seconds) on every request because the CacheService is **completely ineffective**.

---

## Root Cause (Verified)

### Issue
The `getRequestMasterData_()` function caches the entire Request_Master sheet including Guide Extraction JSON column, which contains 10-12KB of JSON per row.

### Measurements
- **With Guide JSON:** 498 KB for 50 rows (exceeds 100KB limit)
- **Without Guide JSON:** 7.9 KB for 50 rows (well under limit)
- **Cache limit:** 100 KB (Apps Script CacheService hard limit)

### Impact
- Cache write **always fails** silently (try/catch swallows error)
- Every page load triggers full Google Sheets API call (1-3 seconds)
- Runtime memo only lasts single execution (doesn't help across requests)

---

## Solution Implemented

### Change Summary
Exclude Guide Extraction JSON column from the sheet data cached in `getRequestMasterData_()`.

### Implementation Approach
**File:** `IA_StatusTracker.js`  
**Function:** `getRequestMasterData_()`  
**Lines changed:** 17 new lines (replaces 2 existing lines)

**Method:**
1. Read all headers to find Guide JSON column index
2. If found, filter out that column from headers and rows
3. If not found, proceed normally (backward compatible)
4. Cache the reduced dataset

**Code:**
```javascript
const allHeaders = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(h => String(h || '').trim());

// Find Guide Extraction JSON column to exclude from cache (large read-only field)
const guideJsonColIdx = allHeaders.indexOf('Guide Extraction JSON');

let headers, rows;

if (guideJsonColIdx === -1) {
  // No Guide JSON column - read all columns normally
  headers = allHeaders;
  rows = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
} else {
  // Exclude Guide JSON column from cache to stay under 100KB limit
  // Read all other columns and reconstruct rows without Guide JSON
  headers = allHeaders.filter((_, idx) => idx !== guideJsonColIdx);

  const allRows = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
  rows = allRows.map(row => row.filter((_, idx) => idx !== guideJsonColIdx));
}

const headerMap = {};
headers.forEach((h, i) => { if (h) headerMap[h] = i; });
```

### Why This Approach

**Pros:**
- ✅ Simple logic (filter arrays)
- ✅ Single Sheets API call (not split into ranges)
- ✅ Backward compatible (handles missing column)
- ✅ Easy to understand and maintain
- ✅ No performance penalty (filtering in-memory arrays is fast)

**Alternatives considered:**
- ❌ Split range reads (more complex, multiple API calls)
- ❌ Per-user cache (doesn't help admin view, complex invalidation)
- ❌ Properties Service (still need to solve size problem, overkill)

---

## Dependencies Verified

### Functions Using getRequestMasterData_()

1. **getMySubmissions()** - ✅ Safe
   - Uses buildSubmissionFromRow_() which already excludes Guide JSON from payload
   - No dependency on Guide JSON in cached data

2. **getAllSubmissions()** - ✅ Safe
   - Same as getMySubmissions()
   - Admin view benefits most from cache optimization

3. **getDemoMetadata()** - ✅ Safe
   - Reads metadata fields through headerMap
   - Falls back to empty string if column missing
   - **Not called from frontend** (unused endpoint)

4. **submitCreatorResponse()** - ✅ Safe
   - Only reads authorization and status fields
   - No dependency on Guide JSON

5. **Other internal functions** - ✅ Safe
   - All verified to not use Guide JSON from cached data

### Frontend Compatibility

- **buildSubmissionFromRow_():** Already excludes Guide JSON from payload (commit 7b4f72e)
- **No API calls to getDemoMetadata():** Field never needed by frontend
- **All Status Tracker features preserved:** Lifecycle, metadata editing, admin review

---

## Test Results

### New Tests

**cache-verification.test.js** ✅ All tests passing
- Cache size confirmed: 141.5 KB (10 rows) → exceeds limit
- getDemoMetadata() handles missing column gracefully
- buildSubmissionFromRow_() works unchanged

**cache-optimization.test.js** ✅ All tests passing
- Column filtering logic correct
- HeaderMap remapping correct  
- Cache size: 498 KB → 7.9 KB (98.4% reduction)
- getDemoMetadata() compatibility verified
- buildSubmissionFromRow_() compatibility verified

### Existing Tests

**All 14 test suites passing:**
- lifecycle-management.test.js
- workflow-consistency.test.js
- creator-authorization.test.js
- retirement-status-value.test.js
- lifecycle-ui-display.test.js
- action-status-vocabulary.test.js
- guidance-display.test.js
- lifecycle-response-validation.test.js
- guide-json-payload-exclusion.test.js
- retirement-guard.test.js
- retirement-evidence.test.js
- (3 more test suites)

---

## Expected Performance Impact

### Current Behavior (Broken Cache)

Every page load:
1. Check runtime memo: ❌ Miss (cleared between requests)
2. Check CacheService: ❌ Miss (cache write failed, empty)
3. **Read Google Sheets:** 🐌 1-3 seconds
4. Build submissions: ~50ms
5. Try to cache: ❌ Fails (498 KB > 100 KB)
6. Return to frontend: ~100ms

**Total: 1-3 seconds every request**

### Expected Behavior (Working Cache)

**First request (cache miss):**
1. Check runtime memo: ❌ Miss
2. Check CacheService: ❌ Miss (first time)
3. **Read Google Sheets:** 🐌 1-3 seconds
4. Build submissions: ~50ms
5. Cache successfully: ✅ (7.9 KB < 100 KB)
6. Return to frontend: ~100ms

**Total: 1-3 seconds**

**Subsequent requests within 90s (cache hit):**
1. Check runtime memo: ❌ Miss
2. **Check CacheService:** ✅ HIT - <50ms
3. Build submissions: ~50ms
4. Return to frontend: ~100ms

**Total: <200ms (5-15x faster)**

### User Experience Impact

**Before:**
- Every page load: 1-3 seconds
- Every post-submit refresh: 1-3 seconds
- Feels slow and unresponsive

**After:**
- First load: 1-3 seconds (expected - must read Sheets)
- Subsequent loads within 90s: <200ms (instant)
- Post-submit refresh: <200ms if within TTL
- Feels fast and responsive

---

## Measurements to Collect After Deployment

### Required Metrics

1. **Cache hit rate:**
   - How often cache actually hits vs misses
   - Target: >50% hit rate within normal usage patterns

2. **Cache payload size:**
   - Actual serialized size with production data
   - Verify stays under 100 KB for typical datasets

3. **Response times:**
   - Cold cache (first request): Baseline measurement
   - Warm cache (subsequent requests): Improvement measurement
   - Target: <300ms for cached requests

4. **Sheet read duration:**
   - Time spent in SpreadsheetApp.openById() and getRange()
   - Verify filtering doesn't add overhead

### Instrumentation Method

Add temporary logging to test deployment:

```javascript
// After cache lookup
if (cached) {
  Logger.log('[CACHE] HIT - size: ' + (cached.length / 1024).toFixed(1) + ' KB');
} else {
  Logger.log('[CACHE] MISS');
}

// After cache write
const serialized = JSON.stringify(result);
Logger.log('[CACHE] Write - size: ' + (serialized.length / 1024).toFixed(1) + ' KB, success: ' + (serialized.length <= 100000));
```

Check Apps Script execution logs after deployment.

---

## Risks and Mitigation

### Risk 1: Cache Still Too Large

**Likelihood:** Low (test shows 7.9 KB for 50 rows)  
**Impact:** Medium (cache still wouldn't work)

**Mitigation:**
- Monitor actual cache size with production data
- If exceeds 100 KB, implement per-user cache keys
- For now, 50-100 rows should fit comfortably

### Risk 2: Missing Guide JSON Breaks Workflow

**Likelihood:** Very Low  
**Impact:** Low

**Evidence:**
- Guide JSON already excluded from frontend payload
- getDemoMetadata() falls back to empty string
- No frontend calls to getDemoMetadata()
- All tests passing

**Mitigation:**
- Can add `getGuideExtractionJson(globalId)` endpoint if needed later
- Currently not implemented because not required

### Risk 3: Performance Regression

**Likelihood:** Very Low  
**Impact:** Low

**Evidence:**
- Single Sheets API call (same as before)
- Array filtering is fast in-memory operation
- Test shows 98.4% cache size reduction

**Mitigation:**
- Monitor sheet read times in production
- Can revert immediately if regression detected

---

## Rollback Plan

If issues occur after deployment:

1. **Revert the change:**
   ```bash
   git revert HEAD
   clasp push
   ```

2. **Or manually restore original logic:**
   ```javascript
   const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(h => String(h || '').trim());
   const rows = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
   ```

3. **Invalidate broken cache:**
   ```javascript
   CacheService.getScriptCache().remove(ST_CACHE_KEY_);
   ```

**Rollback time:** <2 minutes

---

## Deployment Checklist

- [x] Implementation complete
- [x] New tests written and passing
- [x] Existing tests passing (all 14 suites)
- [x] Dependencies verified
- [x] Risk assessment complete
- [x] Rollback plan documented
- [x] Git commit ready
- [ ] **NOT DONE:** Deploy to test Apps Script environment
- [ ] **NOT DONE:** Verify cache hit/miss in logs
- [ ] **NOT DONE:** Measure actual response times
- [ ] **NOT DONE:** Verify frontend functionality
- [ ] **NOT DONE:** Production deployment

---

## Next Steps

1. **Commit changes to Git**
   - Clear commit message explaining optimization
   - Reference this documentation

2. **Deploy to test Apps Script environment**
   ```bash
   clasp push
   ```
   (Deploys to @HEAD, not production @57)

3. **Test in browser**
   - Open Status Tracker (@HEAD deployment)
   - Check Apps Script logs for cache behavior
   - Verify page loads quickly on subsequent requests
   - Test all major workflows (submit, approve, lifecycle)

4. **Measure performance**
   - Cold cache: First page load time
   - Warm cache: Subsequent load time (within 90s)
   - Cache payload size from logs
   - Cache hit/miss rate

5. **Report results**
   - Actual measurements vs expected
   - Any regressions or issues found
   - Recommendation for production promotion

---

## Conclusion

This optimization **enables the cache** for the first time, providing:
- ✅ 5-15x faster page loads for cached requests
- ✅ 98.4% cache size reduction (498 KB → 7.9 KB)
- ✅ Better user experience (instant subsequent loads)
- ✅ Reduced Google Sheets API load
- ✅ Zero functionality changes
- ✅ Low risk, easily reversible

**Status:** Ready for deployment to test environment  
**Risk level:** LOW  
**Expected improvement:** High (cache currently never works)
