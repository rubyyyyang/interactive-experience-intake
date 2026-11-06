# Partial-Write Recovery Guide

**Scenario:** User submits lifecycle response. Queue entry succeeds, but Master status write fails.

---

## What Happened

1. Response_Queue entry created with Review Status "Pending review"
2. Request_Master Action Status update failed (still "Open" or previous value)
3. User sees error: "Your response was recorded in Response_Queue but Request_Master could not be updated. Contact an administrator to reconcile. Do NOT retry."

---

## Why Normal Admin Review Won't Work

**Admin Review UI requires:**
- Request_Master Action Status = "Pending review"

**In partial-write state:**
- Request_Master Action Status = NOT "Pending review" (write failed)
- Response_Queue entry exists but is "orphaned"

**Result:** Admin Review panel won't show the pending entry in UI.

---

## Manual Recovery Steps (Admin)

### Step 1: Verify the Partial State

1. Open Response_Queue sheet
2. Find entry for demo #X
3. Verify Review Status = "Pending review"
4. Note the Queue row number

### Step 2: Check Request_Master

1. Open Request_Master sheet
2. Find demo #X row
3. Check Action Status column
4. Verify it is NOT "Pending review" (confirms partial write)

### Step 3: Manual Reconciliation

**Option A: Complete the Update (if response is valid)**

1. In Request_Master, manually set Action Status to "Pending review"
2. Now Admin Review UI will show the pending entry
3. Review and approve/reject normally through UI

**Option B: Remove Orphaned Entry (if response is invalid)**

1. In Response_Queue, find the orphaned entry
2. Set Review Status to "Rejected" or delete the row
3. Inform creator to resubmit if needed

---

## Prevention

Preflight validation (commit 4fea4dd) prevents most failures before Queue append.

Remaining failure scenario:
- Sheets API error during setValue()
- Permission errors
- Concurrent modification conflicts

These are rare but can happen.

---

## What User Should Do

**User sees error message:**
```
Your response was recorded in Response_Queue but Request_Master could not be updated.
Contact an administrator to reconcile. Do NOT retry.
```

**Correct action:**
1. Contact admin with demo number
2. Do NOT retry (creates duplicate Queue entry)
3. Wait for admin reconciliation

**Incorrect action:**
❌ Retry immediately (creates duplicate entry, complicates recovery)

---

## Multiple Queue Entries

**Legitimate scenarios for multiple entries:**
- Creator submits → Admin rejects → Creator resubmits (CORRECT)
- Creator submits multiple times over time with updates (CORRECT)

**Problematic scenario:**
- Partial write error → User retries immediately → Duplicate pending entries (INCORRECT)

Queue is history-preserving, but simultaneous pending entries from failed retry are NOT equivalent to legitimate resubmission after feedback.

---

## Technical Details

**Partial-write sequence:**
1. Preflight: Master row exists ✓
2. Queue append: Success ✓
3. Master setValue(): **FAILS** → throws error
4. User sees error (no success returned)
5. Master Action Status unchanged (orphaned Queue entry)

**Recovery mechanism:**
- Manual admin reconciliation (no automatic recovery)
- Admin must manually sync Queue entry with Master status
