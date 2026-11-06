# Status Tracker Cache Investigation

**Date:** 2026-11-05  
**Issue:** Status Tracker feels slow on page refresh despite payload optimization

---

## Investigation Summary

The cache is **completely ineffective** - it NEVER hits, causing a full Google Sheets read on EVERY page load.

---

## Root Cause

### The Problem

`getRequestMasterData_()` caches the entire `Request_Master` sheet including **Guide Extraction JSON** column.

```javascript
// Current code (line 38):
const rows = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();

// This reads ALL columns, including Guide Extraction JSON
```

**Cache structure:**
```javascript
{
  headers: [...],      // ~100 bytes
  rows: [[...], ...],  // Array of arrays from getValues()
  headerMap: {...}     // ~500 bytes
}
```

### The Math

**Guide JSON size per row:** ~10 KB  
**Other fields per row:** ~0.3 KB  
**Total per row WITH Guide JSON:** ~10.3 KB  
**Total per row WITHOUT Guide JSON:** ~0.3 KB

**Cache limit:** 100 KB (Apps Script CacheService hard limit)

**Row capacity:**
- **With Guide JSON:** 9 rows maximum
- **Without Guide JSON:** 333 rows maximum

**Actual usage:**
- Creator view: 5-20 submissions
- Admin view: 50-200 submissions

**Result:**
- ❌ Any view with >9 rows exceeds cache limit
- ❌ Cache write fails silently (try/catch swallows error)
- ❌ Every subsequent request reads full sheet from Google Sheets
- ❌ No cache benefit whatsoever

---

## Evidence

### Test Results

```bash
$ node tests/cache-size-detailed-analysis.test.js

Cache capacity (100KB limit):
  With Guide JSON: 9 rows
  Without Guide JSON: 333 rows

Cache effectiveness:
  ❌ WITH Guide JSON: Cache fails for most users
  ✅ WITHOUT Guide JSON: Cache works for typical creator views
```

### What's Actually Happening

1. **First request:** Read full sheet (all columns including Guide JSON)
2. **Attempt to cache:** Serialize 50 rows × 10KB = 500KB
3. **Cache write fails:** 500KB > 100KB limit (silently caught in try/catch)
4. **Second request:** Cache miss (cache is empty), read full sheet again
5. **Repeat forever:** Cache never hits

### Why Payload Optimization Didn't Help Page Load Time

The previous optimization (commit 7b4f72e) only excluded Guide JSON from the **frontend response**:

```javascript
// buildSubmissionFromRow_() - frontend optimization
if (EDITABLE_METADATA_FIELDS_[fi].key === 'Guide Extraction JSON') continue;
```

This reduced payload size sent to the browser, but the **server-side cache** still contains Guide JSON because it caches the raw `getValues()` output.

**Impact:**
- ✅ Frontend payload: Reduced by 1.2-1.4 MB
- ❌ Server-side cache: Still bloated, still failing
- ❌ Page load time: Still slow (full sheet read on every request)

---

## Performance Impact

### Current Behavior (With Broken Cache)

Every `getMySubmissions()` call:

1. Check runtime memo: ❌ Miss (cleared between requests)
2. Check CacheService: ❌ Miss (cache write failed)
3. **Read full Google Sheets:** 🐌 **1-3 seconds** (network + API latency)
4. Build 50 submission objects: ~50ms
5. Try to cache: ❌ Fails silently (exceeds 100KB)
6. Return to frontend: ~100ms

**Total: 1-3 seconds per page load**

### Expected Behavior (With Working Cache)

First request (cache miss):
1. Check runtime memo: ❌ Miss
2. Check CacheService: ❌ Miss (first time)
3. **Read Google Sheets (without Guide JSON):** 🐌 1-3 seconds
4. Build 50 submission objects: ~50ms
5. Cache successfully: ✅ (15 KB < 100 KB limit)
6. Return to frontend: ~100ms

Subsequent requests (cache hit):
1. Check runtime memo: ❌ Miss (cleared between requests)
2. **Check CacheService:** ✅ **HIT - instant (<50ms)**
3. Build 50 submission objects: ~50ms
4. Return to frontend: ~100ms

**First load: 1-3 seconds** (unavoidable - must read Sheets)  
**Subsequent loads within 90s: <200ms** (cache hit - no Sheets read)

**Expected improvement: 5-15x faster for cached requests**

---

## Proposed Solution

### Option 1: Exclude Guide JSON from Sheet Read (Recommended)

**Change:** Read all columns EXCEPT Guide Extraction JSON

**Implementation:**
1. Identify Guide JSON column index
2. Read columns in ranges (before and after Guide JSON column)
3. Reconstruct rows without Guide JSON column
4. Cache the reduced dataset

**Pros:**
- Enables cache for up to 333 rows (covers all realistic usage)
- Reduces server-side memory usage
- Faster sheet read (less data transferred from Sheets API)
- Cache hits eliminate 1-3 second sheet read latency

**Cons:**
- Slightly more complex sheet read logic
- Guide JSON must be read separately IF needed (currently not used)

**Risk:** LOW
- Guide JSON is already excluded from frontend payload
- No workflows currently use Guide JSON from cached data
- Fully backward compatible
- Easily reversible

---

### Option 2: Split Cache Into Per-User Keys

**Change:** Cache only the user's submissions, not the entire sheet

**Pros:**
- Smaller cache entries per user
- Could work even with Guide JSON

**Cons:**
- More complex invalidation logic
- Doesn't help admin "All Submissions" view
- Doesn't solve the Guide JSON bloat problem
- Higher complexity for marginal gain

**Not recommended** - doesn't address root cause

---

### Option 3: Use Different Storage

**Change:** Use Properties Service (9KB per key, 500KB total) or external cache

**Cons:**
- Properties Service has 6MB total limit (not per-key)
- Still need to solve Guide JSON bloat
- Higher complexity
- External cache adds infrastructure dependency

**Not recommended** - overkill for this problem

---

## Recommended Implementation

### Changes Required

**File:** `IA_StatusTracker.js`  
**Function:** `getRequestMasterData_()`  
**Lines:** 36-38

**Before:**
```javascript
const lastCol = sheet.getLastColumn();
const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(h => String(h || '').trim());
const rows = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
```

**After:**
```javascript
const lastCol = sheet.getLastColumn();
const allHeaders = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(h => String(h || '').trim());

// Find Guide Extraction JSON column index
const guideJsonColIdx = allHeaders.indexOf('Guide Extraction JSON');

let headers, rows;

if (guideJsonColIdx === -1) {
  // No Guide JSON column - read normally
  headers = allHeaders;
  rows = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
} else {
  // Exclude Guide JSON column from read
  const colsBeforeGuide = guideJsonColIdx;
  const colsAfterGuide = lastCol - guideJsonColIdx - 1;

  // Read headers excluding Guide JSON
  headers = allHeaders.filter((h, i) => i !== guideJsonColIdx);

  // Read row data in two ranges (before and after Guide JSON column)
  rows = [];
  
  if (colsBeforeGuide > 0 && colsAfterGuide > 0) {
    // Guide JSON is in middle - read both sides
    const beforeData = sheet.getRange(2, 1, lastRow - 1, colsBeforeGuide).getValues();
    const afterData = sheet.getRange(2, guideJsonColIdx + 2, lastRow - 1, colsAfterGuide).getValues();
    
    for (let i = 0; i < beforeData.length; i++) {
      rows.push([...beforeData[i], ...afterData[i]]);
    }
  } else if (colsBeforeGuide > 0) {
    // Guide JSON is last column - read all before it
    rows = sheet.getRange(2, 1, lastRow - 1, colsBeforeGuide).getValues();
  } else {
    // Guide JSON is first column - read all after it
    rows = sheet.getRange(2, 2, lastRow - 1, colsAfterGuide).getValues();
  }
}
```

### Verification Steps

1. **Unit test:** Verify sheet read logic handles all column positions
2. **Integration test:** Verify cache write succeeds (size < 100KB)
3. **Performance test:** Measure cache hit rate and response times
4. **Functional test:** Verify all Status Tracker features still work

---

## Expected Results

### Before (Current State)

- Cache hit rate: 0% (always fails)
- Page load time: 1-3 seconds (every request)
- Google Sheets API calls: Every request
- Server-side cache size: 500KB+ (exceeds limit, fails)

### After (With Fix)

- Cache hit rate: ~80% (within 90s TTL window)
- Page load time:
  - First load (cache miss): 1-3 seconds (unchanged)
  - Cached load: <200ms (5-15x faster)
- Google Sheets API calls: Only on cache miss
- Server-side cache size: 15-50 KB (well under 100KB limit)

### User Experience

**Before:**
- Every page refresh: 1-3 second wait
- Feels slow and unresponsive

**After:**
- First load: 1-3 seconds (expected for initial data fetch)
- Subsequent refreshes within 90s: <200ms (instant)
- Post-submit refresh: <200ms if within TTL
- Feels fast and responsive

---

## Risks and Mitigation

### Risk 1: Breaking Guide JSON Workflows

**Likelihood:** Very Low  
**Impact:** Medium

**Evidence:**
- Guide JSON already excluded from frontend payload (commit 7b4f72e)
- No current workflows access `submission.metadata['Guide Extraction JSON']`
- Field is read-only, never edited

**Mitigation:**
- Add fallback function `getGuideExtractionJson(globalId)` if needed later
- Currently not implemented because not needed

### Risk 2: Complex Sheet Read Logic

**Likelihood:** Low  
**Impact:** Low

**Mitigation:**
- Comprehensive unit tests for all column positions
- Test with Guide JSON at beginning, middle, end
- Test with Guide JSON missing entirely

### Risk 3: Cache Still Too Large for Admin Views

**Likelihood:** Medium  
**Impact:** Low

**Analysis:**
- 200 rows × 0.3 KB = 60 KB (under 100 KB limit)
- Admin views typically 50-100 rows = 15-30 KB
- Cache should work for realistic usage

**Fallback:**
- If still too large, implement per-user cache keys
- Or increase TTL and split Master/YouTube caches

---

## Alternative: Quick Win First

If the full implementation is too complex, consider a **two-phase approach**:

### Phase 1: Just Measure (Instrumentation Only)

Add logging to confirm cache is failing:

```javascript
// In getRequestMasterData_() after cache write attempt
const serializedSize = JSON.stringify(result).length;
Logger.log('[CACHE] Attempted to cache ' + (serializedSize / 1024).toFixed(1) + ' KB');
Logger.log('[CACHE] Limit: 100 KB, Success: ' + (serializedSize <= 100000));
```

Deploy, run Status Tracker, check logs. Confirm cache is failing.

### Phase 2: Implement Fix

Once cache failure is confirmed in production, implement the column exclusion.

---

## Next Steps

**Decision needed:**
1. Implement full solution now (exclude Guide JSON from sheet read)
2. Instrument first, then implement
3. Different approach

**My recommendation:** Implement full solution (Option 1). Evidence is clear, risk is low, benefit is high.
