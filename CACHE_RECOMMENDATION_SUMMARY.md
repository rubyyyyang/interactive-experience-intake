# Cache Optimization Recommendation - Executive Summary

**Date:** 2026-11-05  
**Status:** Design review complete - awaiting approval to implement

---

## Current Situation

- **Problem:** Status Tracker loads slowly (1-3 seconds every page load)
- **Root cause:** Cache completely broken - 610 KB dataset exceeds 100 KB limit
- **Current optimization (commit 67a16a9):** Deployed to test, will NOT work in production
- **Production dataset:** ~292 rows, too large for single-key cache

---

## Recommended Solution

### Per-User Cache with Dual-Path Access

**Core design:**
- Cache each user's submissions separately (~10-40 KB per user)
- Use cache for display (getMySubmissions, getAllSubmissions)
- Always read fresh data for authorization (submitCreatorResponse, approveResponse)

**Key insight:** Separate "fast display" from "secure validation"

---

## Performance Expected

| Scenario | Current | After Fix | Improvement |
|----------|---------|-----------|-------------|
| Initial page load (cold cache) | 1,500ms | 1,500ms | Same |
| Refresh within 90s (warm cache) | 1,500ms | **150ms** | **10x faster** |
| Post-submit refresh | 1,500ms | **150ms** | **10x faster** |
| Authorization check | 1,500ms | **500ms** | **3x faster** |

**User experience:**
- First load: Normal (must read Sheets)
- Subsequent loads: **Instant** (<200ms)
- Submit/approval: **Faster** (single-row read)

---

## Security & Consistency

**Authorization (CRITICAL):**
- ✅ Always uses fresh data from Sheets (never cached)
- ✅ No stale authorization risk
- ✅ No pending lock bypass risk
- ✅ No retirement guard bypass risk

**Display data:**
- ⚠️ May be stale up to 90s (acceptable - user can refresh)
- ⚠️ Hub updates not visible for 90s (documented limitation)

---

## Main Tradeoffs

**Pros:**
- ✅ Actually works (fits in 100 KB cache limit)
- ✅ 10x faster for most common use case
- ✅ Secure (fresh auth data always)
- ✅ Simple to implement
- ✅ Easy to rollback

**Cons:**
- ❌ More complex than single cache (two code paths)
- ❌ Admin "All Submissions" not cached initially (defer to Phase 2)
- ❌ 90s staleness for display (acceptable, documented)

---

## Implementation Plan

**Estimated effort:** 2-3 days  
**Risk level:** Low

### New Functions (no changes to existing code initially)

1. `getUserSubmissionsFromCache_(email)` - Read/write per-user cache
2. `getSubmissionForAuthorization_(number)` - Always fresh single-row read
3. `invalidateUserCache_(email)` - Clear user cache on updates

### Modified Functions (after new functions tested)

1. `getMySubmissions()` → Use user cache
2. `submitCreatorResponse()` → Use fresh auth read
3. `approveResponse()` → Use fresh auth read

### Testing

- Unit tests for cache hit/miss/invalidation
- Integration tests for auth bypass prevention
- Performance tests for cache effectiveness
- Deploy to test, measure, verify, then promote

---

## Acceptance Criteria

**Must pass before production:**
1. ✅ Cache hit rate >70% within 90s window
2. ✅ Cached page load <200ms
3. ✅ Authorization always uses fresh data
4. ✅ No security bypasses possible
5. ✅ All existing tests pass
6. ✅ Performance improvement verified in test environment

---

## Current Deployment Status

- **Production (@57):** UNCHANGED, SAFE
- **Test (@HEAD, version 59):** Has broken optimization (commit 67a16a9)
- **Recommendation:** Keep test as-is until new design implemented

---

## What About Current Optimization?

**Commit 67a16a9 (deployed to test):**
- Excludes Guide JSON from cache
- Reduces 1.2 MB → 610 KB
- Still 6x too large (needs 100 KB)
- Will NOT work in production

**Options:**
1. Leave it (doesn't help, doesn't hurt)
2. Revert it (clean slate)
3. Build on it (use as foundation for per-user cache)

**Recommendation:** Build on it - the Guide JSON exclusion is still correct, just insufficient alone.

---

## Next Steps

1. **Approval decision:** Proceed with per-user cache design?
2. **If yes:** Implement Phase 1 (per-user cache)
3. **If no:** Revert commit 67a16a9, pursue different optimization

---

## Questions for Review

1. **Is 90s staleness acceptable for display data?**
   - Alternative: Reduce TTL to 30s (less cache benefit)

2. **Is dual-path complexity acceptable?**
   - Alternative: No cache, optimize differently (pagination, etc.)

3. **Should we cache admin view in Phase 1?**
   - Current recommendation: Defer to Phase 2 (less frequent use case)

4. **Hub update staleness acceptable?**
   - Current: No cross-project notifications possible
   - Alternative: Document limitation, accept 90s delay

---

## Recommendation

**✅ PROCEED with per-user cache implementation**

This design:
- Solves the performance problem (10x faster)
- Maintains security (fresh auth always)
- Fits in cache limit (tested)
- Low risk, high benefit
- Measurable improvement

**Timeline:**
- Design approved: Today
- Implementation: 2-3 days
- Testing: 1-2 days
- Deployment: After verification

**Expected outcome:** Status Tracker feels instant for repeat visitors (150ms vs 1,500ms).
