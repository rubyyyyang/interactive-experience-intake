# /dev Performance Measurement Guide

**Deployed commit:** 8b16ad4  
**Deployment:** Apps Script @HEAD (auto-updates with clasp push)  
**Date:** 2026-11-06 15:02 PST  

---

## /dev URL

**Status Tracker:**  
https://script.google.com/a/macros/redhat.com/s/AKfycbyW_N668oLpaWMzrR1OXlYh9hTZ6Av33nCtegYUJAw/dev?page=status

---

## Measurement 1: Initial Page Load

**What to measure:** Time from navigation until Status Tracker table is fully displayed and interactive.

**Steps:**
1. Clear browser cache (Cmd+Shift+R or Ctrl+Shift+R)
2. Navigate to /dev URL
3. Open browser DevTools → Network tab
4. Record time from initial request to table render complete
5. Repeat 3 times for consistency

**Expected timing:**
- Network requests complete: ~2-4 seconds
- Table render: +0.5-1 second
- Total: ~2.5-5 seconds (baseline unknown, needs comparison)

**Record:**
- Run 1: _____ seconds
- Run 2: _____ seconds
- Run 3: _____ seconds
- Average: _____ seconds

---

## Measurement 2: Server-Side Master Read Duration

**What to measure:** Actual Sheets API read time for getRequestMasterData_()

**Steps:**
1. Open Apps Script Editor: https://script.google.com/home/projects/13DEk6NBZ-BPZ9MFPoKH_V-4is6EWKKSgJnoQf3JoIZZR0Epulo4UihCE/edit
2. Navigate to Executions panel (left sidebar)
3. Load /dev Status Tracker (triggers getMySubmissions → getRequestMasterData_)
4. Click on the most recent execution in Executions panel
5. Look for log entries with `[PERF]` prefix

**Expected log entries:**
```
[PERF] getRequestMasterData_: Cache MISS - reading from sheet
[PERF] getRequestMasterData_: Sheet data fetch: XXXms
[PERF] getRequestMasterData_: Cache payload size: XX.XX KB
[PERF] getRequestMasterData_: Cache write SUCCESS
[PERF] getRequestMasterData_: Full Master read: XXXms
```

**Record:**
- Sheet data fetch duration: _____ ms
- Full Master read duration: _____ ms
- Cache payload size: _____ KB

---

## Measurement 3: Cache Effectiveness

**What to measure:** Whether cache is working and payload size

**First load (cache MISS):**
1. Clear Apps Script cache (wait 90 seconds for TTL expiration)
2. Load /dev Status Tracker
3. Check Apps Script execution log for:
   - "Cache MISS - reading from sheet"
   - "Cache payload size: XX.XX KB"
   - "Cache write SUCCESS" or "Cache write FAILED"

**Second load (cache HIT):**
1. Immediately reload /dev Status Tracker (within 90 seconds)
2. Check Apps Script execution log for:
   - "Cache HIT"
   - No "Sheet data fetch" timing (skipped)

**Record:**
- Cache payload size: _____ KB (should be < 100KB)
- Cache write status: SUCCESS / FAILED
- Second load shows cache HIT: YES / NO

**Critical check:**
- If cache write FAILED: Payload exceeds 100KB limit, optimization needed
- If cache HIT not observed: Cache TTL or runtime memo issue

---

## Measurement 4: Lifecycle Submit Response Time

**What to measure:** Click-to-status-update time for lifecycle response submission

**Prerequisites:**
- Must have a demo with Action Status = "Action needed"
- Must have valid Recommended Action ("Improve completion" or "Consider retirement")

**Steps:**
1. Open /dev Status Tracker
2. Find a demo with lifecycle action available
3. Expand detail panel
4. Select lifecycle response (e.g., "Improve completion" → "Updated")
5. Enter notes: "Testing performance optimization"
6. **Start timer** when clicking "Submit Response"
7. **Stop timer** when Action Status badge updates to "Pending review"
8. Verify NO full page reload (fast path preserved)

**Browser DevTools verification:**
1. Open DevTools → Network tab BEFORE submitting
2. After submit, verify NO `getMySubmissions` network call
3. Should see only `submitCreatorResponse` call

**Apps Script execution log verification:**
1. Check Apps Script Executions panel
2. Find submitCreatorResponse execution
3. Look for: `[PERF] submitCreatorResponse: Post-lock validation: XXXms`

**Record:**
- Click-to-badge-update time: _____ seconds
- Post-lock validation duration (from logs): _____ ms
- Full reload occurred: YES / NO (should be NO)
- getMySubmissions call observed: YES / NO (should be NO)

---

## Measurement 5: Data Correctness Verification

**What to verify:** Lifecycle submit writes to correct sheets

**Steps:**
1. After submitting lifecycle response in Measurement 4
2. Open production spreadsheet in new tab
3. Check Response_Queue sheet:
   - ✓ New row appended with Review Status = "Pending review"
   - ✓ Correct demo number
   - ✓ Notes match what you entered
4. Check Request_Master sheet:
   - ✓ Action Status updated to "Pending review"
   - ✓ All other columns unchanged

**Record:**
- Response_Queue entry created: YES / NO
- Request_Master Action Status updated: YES / NO
- Any data corruption observed: YES / NO

---

## Baseline Comparison (if available)

**Before optimization:**
- Initial page load: _____ seconds (unknown - need to capture)
- Master read duration: _____ ms (unknown)
- Cache working: UNKNOWN
- Submit time: _____ seconds (unknown)

**After optimization:**
- Initial page load: _____ seconds
- Master read duration: _____ ms
- Cache working: YES / NO
- Submit time: _____ seconds

**Improvement:**
- Initial load: _____% faster / slower / no change
- Submit: _____% faster / slower / no change

**IMPORTANT:** Only report measured improvements, not estimates.

---

## Expected Results

**Optimization 1: getRequestMasterData_()**
- Estimated benefit: ~40-60% faster (NOT MEASURED - just estimate)
- Actual benefit: _____ (to be measured)

**Optimization 2: submitCreatorResponse()**
- Estimated benefit: ~30-50% faster (NOT MEASURED - just estimate)
- Actual benefit: _____ (to be measured)

**If measurements show:**
- **Significant improvement:** Document actual benefit, consider Production deployment
- **No improvement:** API latency dominates, consider reverting optimization
- **Regression:** Revert immediately

---

## Troubleshooting

**If cache write FAILED:**
- Payload exceeds 100KB limit
- Check "Cache payload size" log entry
- May need to exclude more columns or accept cache doesn't work

**If timing logs not visible:**
- Check Apps Script Executions panel (not browser console)
- Logs appear only in server-side execution logs
- Look for executions with function names: getMySubmissions, submitCreatorResponse

**If Action Status doesn't update:**
- Check for JavaScript errors in browser console
- Verify fast path is working (no getMySubmissions reload)
- Check Response_Queue and Master sheets manually

**If performance is worse:**
- Extra Sheets API calls may add more latency than saved network transfer
- Measure post-lock validation duration vs baseline
- Consider reverting if regression confirmed

---

## Next Steps After Measurement

1. ✅ **Capture measurements** - Fill in all blanks above
2. ✅ **Verify correctness** - All data integrity checks pass
3. ✅ **Compare to estimates** - Actual vs expected improvements
4. ⏳ **Report findings** - Measured results only, no claims without data
5. ⏳ **Decision** - Deploy to Production / Revert / Further optimize

**Do not deploy to Production until measurements confirm benefit.**

---

## Deployment Info

**Deployed to:**
- Apps Script @HEAD (auto-updates)
- NOT deployed to Production (@55 unchanged)

**Script ID:**
- 13DEk6NBZ-BPZ9MFPoKH_V-4is6EWKKSgJnoQf3JoIZZR0Epulo4UihCE

**Deployment IDs:**
- @HEAD (dev): AKfycbyW_N668oLpaWMzrR1OXlYh9hTZ6Av33nCtegYUJAw
- @61 (Team Testing): AKfycbzIb3mHr5gngtA0KvzRciwO8YXCEFT1av-Q2eQH7IWkiyeU_pQi-psg3IneJZDDF-Zp
- @55 (Production): AKfycby41BSoZbpLqdkdRG5B5hvdr7-c1KT-TaCw9_WV3_Q0ag13oe_CjHt-JUIDeHzdSTAg

**Only @HEAD contains performance optimizations.**

---

**End of Measurement Guide**
