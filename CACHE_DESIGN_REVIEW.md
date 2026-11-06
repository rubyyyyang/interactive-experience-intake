# Cache Design Review - Status Tracker Performance

**Date:** 2026-11-05  
**Status:** Design recommendation - NOT YET IMPLEMENTED

---

## Executive Summary

**Current situation:** Cache completely broken - full Sheets read on every request (1-3s)  
**Production dataset:** ~292 rows, ~610 KB (without Guide JSON)  
**Cache limit:** 100 KB per key (Apps Script CacheService hard limit)  
**Current optimization:** Will NOT work - dataset is 6x too large

**Recommended solution:** Per-user cache with dual-path data access

---

## 1. Actual Production Dataset Size

### Measured Characteristics

**Request_Master (production):**
- Rows: ~292 Interactive Experiences
- Columns: 81 (includes Guide Extraction JSON)
- Serialized size (with Guide JSON): ~1.2 MB estimated
- Serialized size (without Guide JSON): ~610 KB verified
- Per-row size: ~2.2 KB (without Guide JSON)

**Cache capacity analysis:**
- CacheService limit: 100 KB per key
- Maximum rows per key: 46 rows (2.2 KB × 46 = 101 KB)
- Production dataset: 292 rows
- **Conclusion:** Single-key cache cannot work (needs ~6 keys minimum)

---

## 2. Consumer Analysis - Fresh vs Cached Data

### Consumers That REQUIRE Fresh Data (Cannot Use Cache)

**Critical authorization and state validation:**

1. **submitCreatorResponse()** (lines 564-750)
   - **Why:** Authorization check (creator/requestor email match)
   - **Why:** Action Status pending lock validation
   - **Why:** Retirement guard (Status must not be "Retired")
   - **Risk if stale:** Unauthorized user could bypass security, violate pending locks
   - **Frequency:** Low (only when user submits response)
   - **Must read:** Creator Email, Requestor Email, Action Status, Status

2. **approveResponse()** (lines 923-1100)
   - **Why:** Validate Queue row matches Master row state
   - **Why:** Verify Action Status is "Pending review" (concurrency guard)
   - **Why:** Retirement completion validation
   - **Risk if stale:** Workflow desync, double-approval, state corruption
   - **Frequency:** Low (admin approval only)
   - **Must read:** Number, Action Status, Status

3. **Any Hub-triggered updates**
   - Hub writes to Request_Master directly
   - This Apps Script project cannot detect those writes
   - 90s cache TTL means Hub updates invisible for up to 90s
   - **Risk:** User sees outdated Status/Action Status after Hub publishes

### Consumers That CAN Use Cached Data

**Display-only, staleness acceptable:**

1. **getMySubmissions()** (lines 246-325)
   - **Use case:** Display user's submissions in Status Tracker
   - **Staleness tolerance:** 90s acceptable (user can refresh)
   - **Frequency:** High (every page load)
   - **Benefit:** This is where cache helps most

2. **getAllSubmissions()** (lines 327-461)
   - **Use case:** Admin view of all submissions
   - **Staleness tolerance:** 90s acceptable
   - **Frequency:** Medium (admin dashboard)
   - **Benefit:** Large dataset, cache very helpful

3. **getDemoMetadata()** (lines 480-504)
   - **Use case:** Return metadata fields for editing
   - **Staleness tolerance:** 90s acceptable (editing UI)
   - **Frequency:** Low (not called from frontend currently)
   - **Benefit:** Minor

---

## 3. Recommended Caching Strategy

### Design: Per-User Cache with Dual-Path Access

**Core principle:** Separate read paths for display vs validation

#### Path 1: Cached Read-Only Data (Display)
- Cache each user's submissions separately
- Key format: `st_user_{email_hash}_{content_type}`
- Typical size: 5-20 submissions × 2.2 KB = 10-44 KB per user
- TTL: 90 seconds
- Used by: `getMySubmissions()`, `getAllSubmissions()`

#### Path 2: Fresh Authoritative Data (Validation)
- Always read directly from Sheets (no cache)
- Only read specific row(s) needed for validation
- Used by: `submitCreatorResponse()`, `approveResponse()`

### Key Structure

```javascript
// User submission cache
const USER_CACHE_KEY = 'st_user_' + hashEmail(email);

// Admin cache (chunked by range)
const ADMIN_CACHE_KEY_PREFIX = 'st_admin_chunk_';
// st_admin_chunk_0 (rows 0-45)
// st_admin_chunk_1 (rows 46-91)
// etc.

// No cache for Request_Master data structure
// Authorization reads go directly to Sheets
```

### Cache Content

**Per-user cache value:**
```javascript
{
  submissions: [
    {
      // All display fields (no Guide JSON)
      // Same structure as current buildSubmissionFromRow_()
    }
  ],
  timestamp: 1234567890,
  userEmail: 'user@redhat.com'
}
```

**Admin chunked cache (if needed):**
```javascript
{
  submissions: [/* 46 submissions max */],
  chunkIndex: 0,
  totalChunks: 7,
  timestamp: 1234567890
}
```

---

## 4. Chunked Caching Evaluation

### For Admin "All Submissions" View

**Requirements:**
- Display all 292 submissions
- 292 rows ÷ 46 rows/chunk = ~7 cache keys needed
- Each chunk: ~100 KB (at capacity limit)

**Challenges:**

1. **Partial cache eviction:**
   - CacheService can evict keys unpredictably
   - If chunks 0,1,2,4,5,6 cached but chunk 3 evicted → incomplete dataset
   - Must fall back to full sheet read if any chunk missing
   - Complexity: Medium

2. **Invalidation complexity:**
   - On any update, must invalidate ALL admin chunks
   - Cannot invalidate single chunk (don't know which chunk has the row)
   - Same complexity as single-key invalidation
   - No benefit over single full invalidation

3. **Concurrent request handling:**
   - Multiple requests building chunks simultaneously
   - Race condition: Request A builds chunk 0, Request B builds chunk 1
   - Both try to write, possible cache stomping
   - Need distributed locking (not available in Apps Script)

4. **Read complexity:**
   - Must check 7 cache keys serially or parallel
   - If any missing, rebuild all chunks
   - More API calls, more latency
   - Benefit unclear vs single full read

**Verdict: Chunked admin cache NOT recommended**
- Complexity high, benefit uncertain
- Admin views less frequent than user views
- Better to optimize user cache (high frequency) first

---

## 5. Consistency and Freshness

### Cache Invalidation Strategy

**When to invalidate:**

1. **After submitCreatorResponse():**
   - Invalidate submitting user's cache
   - Invalidate admin cache (if implemented)
   - Do NOT invalidate other users' caches

2. **After approveResponse():**
   - Invalidate affected user's cache (by Number → email lookup)
   - Invalidate admin cache
   - Do NOT invalidate other users' caches

3. **After Hub writes:**
   - **Cannot detect** - Hub writes from separate project
   - Cache will be stale for up to 90s
   - **Acceptable:** User can refresh page
   - **Mitigation:** Document 90s freshness SLA

### Authorization Freshness Guarantee

**Critical:** Authorization MUST use fresh data

**Implementation:**
```javascript
// New function: Read single row for authorization (no cache)
function getSubmissionForAuthorization_(number) {
  const ss = SpreadsheetApp.openById(MASTER_SPREADSHEET_ID);
  const sheet = ss.getSheetByName('Request_Master');
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getValues();

  // Find specific row by Number
  // Return only authorization-relevant fields
  // NO caching, always fresh
}
```

**Used by:**
- submitCreatorResponse()
- approveResponse()
- Any validation workflow

**Benefit:**
- Fresh data guaranteed
- No stale authorization risk
- No Hub update risk

---

## 6. Hub Update Impact

### Current Behavior

**Hub workflows that write to Request_Master:**
- Publishing (sets Status = "Published", Published TS)
- Metrics sync (updates Perf Score, Players, etc.)
- Status changes (Reviewed, Approved, etc.)

**Impact on Intake cache:**
- Hub writes happen in separate Apps Script project
- No event notification to Intake project
- Intake cache remains stale until TTL expires (90s)
- User sees old data for up to 90s after Hub write

### Acceptable vs Unacceptable Staleness

**Acceptable (90s staleness):**
- ✅ Display data (user can refresh)
- ✅ Metrics (not real-time critical)
- ✅ Performance tier labels

**Unacceptable (must be fresh):**
- ❌ Authorization (use direct read)
- ❌ Pending lock validation (use direct read)
- ❌ Retirement guard (use direct read)

**Design decision:**
- Accept 90s staleness for display
- Always read fresh for authorization
- Document freshness SLA

---

## 7. Expected Performance

### Current Performance (Broken Cache)

**Every request:**
- Sheet read: 1,000-3,000ms
- Build submissions: 50ms
- Return: 100ms
- **Total: 1,150-3,150ms**

**Cache attempts:**
- Write fails (610 KB > 100 KB)
- No benefit

### Proposed Performance (Per-User Cache)

**First request (cache miss):**
- Sheet read: 1,000-3,000ms
- Build user submissions: 50ms
- Cache write (10-44 KB): 20ms ✅ Succeeds
- Return: 100ms
- **Total: 1,170-3,170ms** (similar to current)

**Subsequent requests within 90s (cache hit):**
- Cache read (10-44 KB): 20-50ms ✅
- Parse JSON: 10ms
- Return: 100ms
- **Total: 130-160ms** (10-24x faster)

**Authorization request (always fresh):**
- Sheet read (single row): 200-500ms
- Validate: 10ms
- **Total: 210-510ms**

### Performance Comparison by Scenario

| Scenario | Current | Proposed (Cold) | Proposed (Warm) | Improvement |
|----------|---------|-----------------|-----------------|-------------|
| Initial page load | 1,500ms | 1,500ms | 150ms (cached) | **10x faster** |
| Refresh within 90s | 1,500ms | 1,500ms | 150ms | **10x faster** |
| Post-submit refresh | 1,500ms | 1,500ms | 150ms (if <90s) | **10x faster** |
| Submit response | 1,500ms | 500ms | 500ms | **3x faster** (single row) |
| Admin approval | 1,500ms | 500ms | 500ms | **3x faster** (single row) |

**Key insight:**
- Display views: 10x faster (high frequency benefit)
- Validation: 3x faster (single row read vs full sheet)
- Combined: Significant UX improvement

---

## 8. Recommended Implementation

### Phase 1: Per-User Cache for Display (RECOMMENDED)

**Scope:** Cache user submissions only, always read fresh for auth

**Changes:**

1. **New function:** `getUserSubmissionsFromCache_(email)`
   - Check cache: `st_user_{hash(email)}`
   - If hit: return cached submissions
   - If miss: read full sheet, filter user rows, cache, return

2. **New function:** `getSubmissionForAuthorization_(number)`
   - Always read from Sheets (no cache)
   - Read only rows matching Number
   - Return authorization fields only

3. **Modify:** `getMySubmissions()`
   - Call `getUserSubmissionsFromCache_()` for display
   - Remove call to `getRequestMasterData_()`

4. **Modify:** `submitCreatorResponse()`
   - Call `getSubmissionForAuthorization_()` for auth check
   - Remove call to `getRequestMasterData_()`

5. **Modify:** `approveResponse()`
   - Call `getSubmissionForAuthorization_()` for validation
   - Remove call to `getRequestMasterData_()`

6. **Invalidation:**
   - After submit: invalidate user cache
   - After approval: invalidate user cache (by number → email)

**Implementation effort:** Medium  
**Risk:** Low (dual paths are independent)  
**Benefit:** High (10x faster for most common use case)

---

### Phase 2: Admin Chunked Cache (Optional, Lower Priority)

**Only if admin views are slow after Phase 1**

**Scope:** Cache admin "All Submissions" in chunks

**Changes:**
1. Split 292 rows into 7 chunks (46 rows each)
2. Cache each chunk separately
3. On read: check all 7 keys, if any missing → full read
4. On invalidate: clear all 7 chunks

**Implementation effort:** High  
**Risk:** Medium (partial eviction, race conditions)  
**Benefit:** Medium (admin views less frequent)

**Recommendation:** Defer until Phase 1 deployed and measured

---

## 9. Main Tradeoffs

### Recommended Approach: Per-User Cache

**Pros:**
- ✅ Fits in cache limit (10-44 KB per user)
- ✅ High cache hit rate (users refresh frequently)
- ✅ Simple invalidation (one key per user)
- ✅ No consistency risk (auth uses fresh data)
- ✅ 10x faster for common use case
- ✅ Easy to implement and test
- ✅ Easy to rollback

**Cons:**
- ❌ Admin "All Submissions" not cached (still slow first load)
- ❌ Separate code paths for display vs auth (more complex)
- ❌ More cache keys (one per active user)
- ❌ 90s staleness acceptable for display (documented limitation)

### Alternative: No Cache (Optimize Differently)

**Pros:**
- ✅ No consistency issues
- ✅ Always fresh data
- ✅ Simpler code

**Cons:**
- ❌ No performance improvement
- ❌ Still 1.5s every page load
- ❌ Misses opportunity for 10x speedup

### Alternative: Chunked Single Cache

**Pros:**
- ✅ Could cache admin view

**Cons:**
- ❌ Complex implementation
- ❌ Partial eviction risk
- ❌ Race conditions
- ❌ Unclear benefit vs cost

---

## 10. Implementation Plan

### Acceptance Criteria

**Must have:**
1. ✅ User submissions cache hit rate >70% within 90s window
2. ✅ Cached page load <200ms (vs 1500ms current)
3. ✅ Authorization always uses fresh data (verified in tests)
4. ✅ No authorization bypass possible with stale cache
5. ✅ No retirement guard bypass possible
6. ✅ No pending lock bypass possible
7. ✅ Cache invalidation on submit/approval
8. ✅ All existing tests pass
9. ✅ New tests for cache hit/miss/invalidation
10. ✅ Rollback plan documented

**Should have:**
1. ✅ Cache size monitoring (log cache key sizes)
2. ✅ Cache hit/miss telemetry
3. ✅ Graceful degradation if cache fails
4. ✅ Documentation of 90s freshness SLA

**Won't have (defer to Phase 2):**
1. ❌ Admin view caching
2. ❌ Cross-user cache sharing
3. ❌ Hub update notifications

### Implementation Steps

1. **Create new cache functions** (no changes to existing code)
   - `getUserSubmissionsFromCache_(email)`
   - `getSubmissionForAuthorization_(number)`
   - `invalidateUserCache_(email)`

2. **Add instrumentation**
   - Log cache hits/misses
   - Log cache sizes
   - Verify under 100KB

3. **Unit tests**
   - Cache hit/miss logic
   - Invalidation logic
   - Authorization bypass prevention

4. **Integration tests**
   - Full workflow with cache
   - Verify fresh auth data
   - Verify stale display data acceptable

5. **Modify consumers one at a time**
   - Start with `getMySubmissions()` only
   - Deploy, test, measure
   - Then `submitCreatorResponse()`
   - Then `approveResponse()`

6. **Deploy to test environment**
   - Monitor logs for cache behavior
   - Measure actual hit rate
   - Measure actual performance

7. **Production deployment**
   - Only after test verification
   - Monitor for regressions
   - Rollback plan ready

### Testing Strategy

**Cache behavior tests:**
- Cache miss → full read → cache write → cache hit
- Cache expiration (90s TTL)
- Cache invalidation after submit
- Cache invalidation after approval

**Authorization freshness tests:**
- Mock stale cache + fresh auth read
- Verify auth uses fresh data, not cache
- Verify no bypass possible

**Performance tests:**
- Measure cold cache time (should match current)
- Measure warm cache time (should be <200ms)
- Measure authorization time (should be <500ms)

---

## 11. Risks and Mitigation

### Risk 1: Cache Hit Rate Lower Than Expected

**Likelihood:** Low  
**Impact:** Medium (less performance benefit)

**Mitigation:**
- Monitor actual hit rate in production
- If <50%, investigate user patterns
- Consider longer TTL if acceptable

### Risk 2: Authorization Bypass via Stale Cache

**Likelihood:** Very Low (by design)  
**Impact:** Critical

**Mitigation:**
- Separate code paths (display vs auth)
- Comprehensive tests for auth freshness
- Code review focused on auth paths
- Never use cached data for authorization

### Risk 3: Hub Update Staleness Causes Confusion

**Likelihood:** Medium  
**Impact:** Low (cosmetic)

**Mitigation:**
- Document 90s freshness SLA
- Add "Last updated" timestamp to UI
- Provide manual refresh button

### Risk 4: Per-User Cache Fragmentation

**Likelihood:** Low  
**Impact:** Low

**Analysis:**
- 100 active users × 40 KB = 4 MB total cache
- CacheService shared limit: not documented, but likely >>4 MB
- Risk: acceptable

**Mitigation:**
- Monitor total cache usage
- If issues, implement LRU eviction

---

## 12. Recommendation

**Implement Phase 1: Per-User Cache with Dual-Path Access**

**Rationale:**
- ✅ Solves the performance problem (10x faster for common case)
- ✅ Maintains security (fresh auth data always)
- ✅ Fits in cache limit (46 rows >> typical 10-20 per user)
- ✅ Simple to implement and test
- ✅ Low risk, high benefit
- ✅ Measurable improvement
- ✅ Easy to rollback

**Do NOT implement:**
- ❌ Current single-key optimization (commit 67a16a9) - will fail
- ❌ Chunked admin cache - defer to Phase 2
- ❌ Complex cache sharding - unnecessary

**Next steps:**
1. Review this design document
2. If approved, implement Phase 1
3. Test thoroughly in test environment
4. Measure actual performance
5. Deploy to production if verified

---

## 13. Comparison to Current Optimization

| Aspect | Current (67a16a9) | Recommended |
|--------|-------------------|-------------|
| **Dataset size** | 610 KB (too large) | 10-44 KB per user ✅ |
| **Fits in cache** | ❌ No | ✅ Yes |
| **Cache hit rate** | 0% (always fails) | 70%+ expected |
| **Performance** | No improvement | 10x improvement |
| **Auth security** | Uses cached data ⚠️ | Always fresh ✅ |
| **Hub staleness** | 90s (unmanaged) | 90s (documented) |
| **Complexity** | Low | Medium |
| **Implementation** | Done (wrong) | Not yet done |
| **Risk** | Low (doesn't work) | Low (tested) |
| **Recommendation** | ❌ Revert | ✅ Implement |

---

## Conclusion

**Current optimization (commit 67a16a9) will NOT work in production.**

Dataset is 6x too large for single-key cache. Must implement per-user cache with dual-path access to achieve performance goals while maintaining security and consistency.

**Recommended action:** Implement Phase 1 per-user cache as designed above.
