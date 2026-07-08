# Code & Sheet Best Practices Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix concrete issues in the Intake app's code and the shared spreadsheet that cause bugs, data drift, or maintenance headaches.

**Architecture:** Targeted fixes to existing code and sheet structure. No architecture changes, no file splitting, no new features.

**Tech Stack:** Google Apps Script, Google Sheets API (read), clasp

## Global Constraints

- No file splitting or architecture changes (that's a separate plan)
- Sheets: read-only via API; any writes go through Apps Script runtime or user action
- Test after each change: `clasp push` → verify web app works

---

### Task 1: Fix Duplicate Function in Index.html

`setGuideSuccessStatus` is defined twice — at ~line 542 and ~line 877. The second definition silently overrides the first. The second version has a null guard and better link text.

**Files:**
- Modify: `Index.html`

**Interfaces:**
- Consumes: Called by guide extraction success flow
- Produces: No interface change — same function, just one copy

- [ ] **Step 1: Find both definitions**

```bash
grep -n "function setGuideSuccessStatus" Index.html
```

Expected: Two line numbers

- [ ] **Step 2: Remove the first definition**

Delete the first `setGuideSuccessStatus` function block (the one WITHOUT the null guard). Keep the second one (the one WITH `if (!el) return`).

- [ ] **Step 3: Verify**

Run: `clasp push`
Test: Paste an Arcade URL in the web app, verify the guide status shows correctly after extraction.

- [ ] **Step 4: Commit**

```bash
git add Index.html
git commit -m "fix: remove duplicate setGuideSuccessStatus definition"
```

---

### Task 2: Fix Hardcoded Column Numbers in backfillDescriptions()

`backfillDescriptions()` at Code.js:2163 uses hardcoded column numbers (`STATUS_COL = 1`, `PRIMARY_URL_COL = 3`, `FALLBACK_URL_COL = 63`, `DESC_COL = 66`) while the rest of Code.js uses header-name lookups. If columns are added or reordered in Request_Master, this breaks silently.

**Files:**
- Modify: `Code.js` (~lines 2163-2193)

**Interfaces:**
- Consumes: `Request_Master` sheet headers
- Produces: Same behavior, but column-reorder-safe

- [ ] **Step 1: Replace hardcoded columns with header lookups**

Replace lines 2165-2168:

```javascript
// BEFORE:
const STATUS_COL = 1;
const PRIMARY_URL_COL = 3;
const FALLBACK_URL_COL = 63;
const DESC_COL = 66;

// AFTER:
const statusCol = headers.indexOf('Status') + 1;
const primaryUrlCol = headers.indexOf('Production Link') + 1;
const fallbackUrlCol = headers.indexOf('Creation Link') + 1;
const descCol = headers.indexOf('Demo Description') + 1;
if (!statusCol || !primaryUrlCol || !descCol) {
  throw new Error('Required columns missing from ' + SHEET_NAME);
}
```

Move the `headers` read (currently at line 2181) above these lookups. Update all references from `STATUS_COL` → `statusCol`, etc.

- [ ] **Step 2: Verify column names match actual sheet headers**

Cross-check against Request_Master headers:
- Col 1: `Status` ✓
- Col 3: `Production Link` ✓
- Col 63: `Creation Link` ✓ (fallback URL source)
- Col 66: `Demo Description (Gemni generated)` — note the typo "Gemni" in the sheet header. Use `Demo Description` if that's what col 65 is called, or match the exact header string.

- [ ] **Step 3: Test**

Run: `clasp push`
From Apps Script editor: run `backfillDescriptions()` and check Logger output for correct row processing.

- [ ] **Step 4: Commit**

```bash
git add Code.js
git commit -m "fix: replace hardcoded column numbers with header lookups in backfillDescriptions"
```

---

### Task 3: Sync Taxonomy Sheet with Code.js Products

The `Arcade finder taxonomy` tab in the Master Spreadsheet is missing 3 AI products that exist in Code.js `FIELD_OPTIONS`:

| In Code.js | In Taxonomy Sheet |
|---|---|
| Red Hat OpenShift AI | Missing |
| Red Hat Enterprise Linux AI | Missing |
| Red Hat AI Inference | Missing |

This means any system reading from the taxonomy tab has a stale product list.

**Files:**
- Modify: `Arcade finder taxonomy` tab in Master Spreadsheet (column L, rows 3+)
- No code changes

- [ ] **Step 1: Add missing products to the taxonomy sheet**

User action (or Apps Script function): Add these 3 values to column L (`Primary Product Featured`) in the `Arcade finder taxonomy` tab, after `Red Hat OpenShift` (row 5):
- `Red Hat OpenShift AI`
- `Red Hat Enterprise Linux AI`
- `Red Hat AI Inference`

This keeps the sheet in sync with Code.js `FIELD_OPTIONS.products`.

- [ ] **Step 2: Verify**

Read the taxonomy tab and confirm all products from `FIELD_OPTIONS.products` are present.

---

### Task 4: Fix Request_Master Column Header Typo

Column 66 in `Request_Master` says `Demo Description (Gemni generated)` — should be `Gemini`. This doesn't break anything (Code.js uses `DESC_COL = 66` by number), but after Task 2 switches to header-name lookups, the header name matters.

**Files:**
- Modify: `Request_Master` tab, row 1, column 66 (header cell)
- No code changes

- [ ] **Step 1: Fix the typo**

User action: In `Request_Master`, change cell BN1 from `Demo Description (Gemni generated)` to `Demo Description (Gemini generated)`.

- [ ] **Step 2: Update Code.js header lookup to match**

After Task 2, make sure `backfillDescriptions()` uses the corrected header name. If using `Demo Description` as the lookup (col 65, `Demo Description`), this doesn't matter. If using the Gemini-generated column specifically, use the corrected name.

---

### Task 5: Normalize var to const/let in Code.js

~135 `var` declarations remain in Code.js, concentrated in functions converted from the original Express MVP. V8 runtime supports `const`/`let` fully.

**Files:**
- Modify: `Code.js`

**Interfaces:**
- No behavior change — `var` → `const` for values never reassigned, `var` → `let` for values that are reassigned

- [ ] **Step 1: Convert var declarations**

Rules:
- `var` that is never reassigned → `const`
- `var` that is reassigned (loop counters, accumulators) → `let`
- Don't change function parameters or `for...in` patterns

Focus on the main functions: `extractGuideContent`, `generateDraftFromGuide`, `callGemini_`, `fetchGuideContent_`, `backfillDescriptions`, `parseModelJson`.

- [ ] **Step 2: Verify**

Run: `clasp push`
Test: Full golden path — paste URL → extract → generate → submit

- [ ] **Step 3: Commit**

```bash
git add Code.js
git commit -m "refactor: normalize var to const/let across Code.js"
```

---

## Summary

| # | Fix | Risk | Why |
|---|-----|------|-----|
| 1 | Remove duplicate function | None | Second definition silently overrides first — a bug waiting to diverge |
| 2 | Header-based column lookups | Low | Hardcoded column numbers break silently when sheet structure changes |
| 3 | Sync taxonomy sheet | None | 3 AI products missing from sheet that Code.js already has |
| 4 | Fix header typo | None | "Gemni" → "Gemini" in Request_Master col 66 |
| 5 | var → const/let | None | Code consistency, catches accidental reassignment |

Tasks 3 and 4 are sheet changes (user action). Tasks 1, 2, 5 are code changes (I do them, `clasp push`).

---

## Verification

After all tasks:
- `clasp push` succeeds
- Golden path works: paste URL → extract guide → generate AI draft → review with confidence scores → submit → row appears in Creator_Form_Raw → workflow trigger fires
- `backfillDescriptions()` runs from Apps Script editor without errors
- No `var` declarations remain in Code.js (grep for `\bvar\b`)
