# Cross-App Best Practices Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix bugs, code smells, and best practice violations across all three Arcade Apps Script projects (Intake, Finder, Lifecycle Management)

**Architecture:** Targeted fixes to existing functions. No file splitting, no new features, no architecture changes.

**Tech Stack:** Google Apps Script (V8 runtime), clasp

## Global Constraints

- Deploy each project independently with `clasp push` from its own folder
- Sheets: read-only via API; all writes through Apps Script runtime
- Test after each change per project
- Each task is independent within its project — can be done in any order
- Finder and Lifecycle have their own `.clasp.json` pointing to their own Apps Script projects

---

## Already Fixed / Planned Elsewhere

These issues are covered by previous plans and should NOT be re-done:

| Issue | Status |
|-------|--------|
| Duplicate `setGuideSuccessStatus` in Intake Index.html | Fixed (2026-07-08-code-and-sheet-best-practices) |
| Hardcoded columns in Intake `backfillDescriptions` | Fixed (2026-07-08-code-and-sheet-best-practices) |
| var→const/let in Intake Code.js | Fixed (2026-07-08-code-and-sheet-best-practices) |
| Race condition in Intake `saveSubmissionToSheet_` | Fixed (2026-07-08-code-improvements) |
| Contradictory AI prompt in Intake | Fixed (2026-07-08-code-improvements) |
| Gemini retry in Intake `callGemini_` | Fixed (2026-07-08-code-improvements) |
| Batch image fetch in Intake | Fixed (2026-07-08-code-improvements) |
| Workflow retry in Intake | Fixed (2026-07-08-code-improvements) |
| "Gemni" typo in sheet header | Planned — user action (2026-07-08-code-and-sheet-best-practices Task 4) |
| Taxonomy sync (3 AI products) | Planned — user action (2026-07-08-code-and-sheet-best-practices Task 3) |

---

## FINDER — Priority 1: Bugs

### Task 1: Fix undefined variables in createRequestOpenThread

**Severity: CRITICAL — runtime crash**

`createRequestOpenThread` (RM_Workflow.js:633) uses 5 variables (`contextDescription`, `primaryProduct`, `primaryAudience`, `eventName`, `globalIdLine`) that are never defined in its scope. They exist in the next function `createCreatorApprovedRequestMessage` (line 688). This is a copy-paste error. Any "Request Open" workflow status will throw `ReferenceError`.

**Files:**
- Modify: `Arcade Finder/RM_Workflow.js` (~lines 633-667)

**Interfaces:**
- Consumes: `context` object with `{ number, globalId, originType, rowData, headerMap }`
- Produces: Slack message string (same format, now with actual data instead of crash)

- [ ] **Step 1: Add the missing variable definitions**

Add these lines after line 641 (after the `requestDocUrl` line), mirroring the definitions from `createCreatorApprovedRequestMessage`:

```javascript
const primaryProduct = String(
  safeGetByName(rowData, headerMap, ENHANCED_CONFIG.COLUMNS.PRIMARY_PRODUCT) || ""
).trim() || "—";

const primaryAudience = String(
  safeGetByName(rowData, headerMap, ENHANCED_CONFIG.COLUMNS.PRIMARY_AUDIENCE) || ""
).trim() || "—";

const eventName = String(
  safeGetByName(rowData, headerMap, ENHANCED_CONFIG.COLUMNS.EVENT) || ""
).trim() || "—";

const contextDescription = String(
  safeGetByName(rowData, headerMap, ENHANCED_CONFIG.COLUMNS.CONTEXT_DESC) || ""
).trim() || "—";

const globalIdLine = globalId ? `*Global ID*: ${globalId}\n` : "";
```

- [ ] **Step 2: Verify**

```bash
cd ~/Arcade\ Finder && node -c RM_Workflow.js && clasp push
```

Test: Trigger a "Request Open" workflow status change and verify the Slack message posts correctly with all fields populated.

---

### Task 2: Fix duplicate onEdit — global namespace collision

`onEdit` is defined in both `DiscoveryWebApp.js:35` and `RM_Datasync.js:80`. Apps Script's flat global namespace means only one runs — the other is silently ignored. Same issue with `onOpen` in `RM_Lifecycle.js:271` (though only one definition was found).

**Files:**
- Modify: `Arcade Finder/DiscoveryWebApp.js` (~line 35)
- Modify: `Arcade Finder/RM_Datasync.js` (~line 80)

**Interfaces:**
- Consumes: `onEdit(e)` trigger event
- Produces: Combined behavior of both handlers

- [ ] **Step 1: Determine which onEdit is the primary**

Read both `onEdit` functions. Determine which one handles more critical logic. The other should be renamed and called from the primary.

- [ ] **Step 2: Merge into a single onEdit**

Keep one `onEdit(e)` as the entry point. Rename the other (e.g., `onEditDiscovery_(e)` or `onEditDatasync_(e)`) and call it from the primary:

```javascript
function onEdit(e) {
  onEditDiscovery_(e);
  onEditDatasync_(e);
}
```

- [ ] **Step 3: Verify**

```bash
cd ~/Arcade\ Finder && clasp push
```

Test: Make an edit in the spreadsheet and verify both handlers' behaviors fire (check whatever each one does — column updates, syncs, etc.).

---

## FINDER — Priority 2: Reliability

### Task 3: Remove auto-initialization on file load

`RM_Datasync.js:602` has a bare `initializeTriggerSystem()` call at the module level. This runs every time ANY function in the project executes — even `doGet()`, `onEdit()`, or test functions. It adds overhead and can cause unexpected side effects.

**Files:**
- Modify: `Arcade Finder/RM_Datasync.js` (~line 602)

**Interfaces:**
- Consumes: Called implicitly on every script execution
- Produces: Trigger registration (should only happen once, not on every call)

- [ ] **Step 1: Remove the bare call**

Delete line 602:

```javascript
// DELETE THIS LINE:
initializeTriggerSystem();
```

- [ ] **Step 2: Add explicit initialization where needed**

If trigger initialization is needed, call it from `onOpen()` or a dedicated setup function instead:

```javascript
function onOpen() {
  initializeTriggerSystem();
  // ... existing onOpen logic
}
```

- [ ] **Step 3: Verify**

```bash
cd ~/Arcade\ Finder && clasp push
```

Test: Open the spreadsheet (triggers `onOpen`), verify triggers are still registered. Run `doGet()` and confirm it doesn't call `initializeTriggerSystem`.

---

### Task 4: Fix in-memory caches that reset every execution

`creatorFormCache` (RM_CreatorIntake.js:16) and `slackUserCache` (RM_Workflow.js:251) are `new Map()` at the module level. In Apps Script, module-level state resets on every execution, so these caches provide zero benefit and `creatorFormCache` gives a false sense of duplicate protection.

**Files:**
- Modify: `Arcade Finder/RM_CreatorIntake.js` (~line 16)
- Modify: `Arcade Finder/RM_Workflow.js` (~line 251)

**Interfaces:**
- Consumes: Spreadsheet data, Slack API
- Produces: Same behavior, but using `CacheService` for persistence

- [ ] **Step 1: Replace creatorFormCache with CacheService**

```javascript
// BEFORE:
const creatorFormCache = new Map();

// AFTER — use CacheService (persists up to 6 hours):
function getCreatorFormCache_() {
  return CacheService.getScriptCache();
}
```

Update the cache reads/writes to use `getCreatorFormCache_().get(key)` / `.put(key, value, 600)`.

- [ ] **Step 2: Replace slackUserCache with CacheService**

Same pattern for the Slack user ID lookup cache.

- [ ] **Step 3: Verify**

```bash
cd ~/Arcade\ Finder && clasp push
```

Test: Submit an intake → verify the workflow still processes. Check that Slack user lookups work.

---

## FINDER — Priority 3: Code Quality

### Task 5: Add Gemini retry to Finder's RM_Gemini.js

`RM_Gemini.js` (57 lines) calls `UrlFetchApp.fetch` with no retry on 429/503, same issue that was fixed in Intake's `callGemini_`.

**Files:**
- Modify: `Arcade Finder/RM_Gemini.js`

**Interfaces:**
- Consumes: Gemini API
- Produces: Generated text with retry on transient errors

- [ ] **Step 1: Add retry loop**

Apply the same pattern used in Intake's `callGemini_`: retry up to 3 times on 429/503 with exponential backoff, guard `JSON.parse`, detect safety-filter blocks.

- [ ] **Step 2: Verify**

```bash
cd ~/Arcade\ Finder && clasp push
```

---

## LIFECYCLE — Priority 1: Configuration

### Task 6: Move hardcoded SOURCE_SPREADSHEET_ID to Script Properties

`Code.js:14` has `SOURCE_SPREADSHEET_ID: '1t7TJtTL-jbUaCVKVLMMOahbKcL5b1IyCf3uUSCmQo4A'` hardcoded directly in source. If the spreadsheet ID ever changes, it requires a code deploy instead of a config change.

**Files:**
- Modify: `Arcade-Lifecycle-Management/Code.js` (~line 14)

**Interfaces:**
- Consumes: Script Properties `SOURCE_SPREADSHEET_ID`
- Produces: Same spreadsheet reference, but configurable

- [ ] **Step 1: Read from Script Properties with hardcoded fallback**

```javascript
// BEFORE:
SOURCE_SPREADSHEET_ID: '1t7TJtTL-jbUaCVKVLMMOahbKcL5b1IyCf3uUSCmQo4A',

// AFTER:
SOURCE_SPREADSHEET_ID: PropertiesService.getScriptProperties().getProperty('SOURCE_SPREADSHEET_ID') || '1t7TJtTL-jbUaCVKVLMMOahbKcL5b1IyCf3uUSCmQo4A',
```

- [ ] **Step 2: Set the Script Property**

In Apps Script editor > Project Settings > Script Properties, add:
- Key: `SOURCE_SPREADSHEET_ID`
- Value: `1t7TJtTL-jbUaCVKVLMMOahbKcL5b1IyCf3uUSCmQo4A`

- [ ] **Step 3: Verify**

```bash
cd ~/Arcade-Lifecycle-Management && clasp push
```

Test: Run any function that reads from the source spreadsheet — verify it still works.

---

### Task 7: Fix "Gemni" typo reference in Lifecycle

`RM_LifecycleScoring.js:201` references `"Demo Description (Gemni generated)"` — matching the typo in the sheet header. After the sheet header is fixed (planned in `2026-07-08-code-and-sheet-best-practices.md` Task 4), this code will break.

**Files:**
- Modify: `Arcade-Lifecycle-Management/RM_LifecycleScoring.js` (~line 201)

**Interfaces:**
- Consumes: Sheet header name
- Produces: Same column reference

- [ ] **Step 1: Update the header reference**

```javascript
// BEFORE:
"Demo Description (Gemni generated)"

// AFTER:
"Demo Description (Gemini generated)"
```

**Important:** Do this AFTER fixing the sheet header typo (Task 4 in code-and-sheet-best-practices plan). If you fix the code first, it will break until the sheet is also fixed.

- [ ] **Step 2: Verify**

```bash
cd ~/Arcade-Lifecycle-Management && clasp push
```

---

## INTAKE — Priority 3: Code Quality

### Task 8: Normalize var to const/let in Index.html

Index.html has 55 `var` declarations in its JavaScript. The existing var normalization plan only covered Code.js.

**Files:**
- Modify: `arcade-intake-app/Index.html`

**Interfaces:**
- No behavior change

- [ ] **Step 1: Convert var declarations**

Rules:
- `var` never reassigned → `const`
- `var` reassigned (loop counters, accumulators, conditionally set) → `let`
- Pay special attention to variables declared inside `<script>` tags at the top level — these are effectively global in the HTML context, so `const`/`let` is fine

Key variables to check for reassignment:
- `analyticsSessionId` (line 487) — set once → `const`
- `editedFields` (line 491) — likely a Set, set once → `const`
- `aiDraftGenerated` (line 492) — likely reassigned → `let`
- `sessionStartTime` (line 493) — set once → `const`
- `currentDraft` (line 1180) — likely reassigned → `let`

- [ ] **Step 2: Verify syntax**

Open the web app and check browser console for errors. Test the golden path.

- [ ] **Step 3: Commit**

```bash
cd ~/arcade-intake-app && git add Index.html && git commit -m "refactor: normalize var to const/let in Index.html"
```

---

## Summary

| # | Project | Fix | Risk | Impact |
|---|---------|-----|------|--------|
| 1 | Finder | Fix undefined variables in `createRequestOpenThread` | **None** — adding missing definitions | **Critical** — prevents runtime crash on Request Open |
| 2 | Finder | Fix duplicate `onEdit` namespace collision | **Low** — merge two handlers | **High** — one handler is silently ignored today |
| 3 | Finder | Remove auto-init on file load | **Low** — move to `onOpen` | **Medium** — reduces overhead on every execution |
| 4 | Finder | Fix in-memory caches with CacheService | **Low** — swap Map for CacheService | **Medium** — dedup actually works across executions |
| 5 | Finder | Add Gemini retry to RM_Gemini.js | **Low** — same pattern as Intake | **Low** — better error handling |
| 6 | Lifecycle | Move hardcoded spreadsheet ID to Script Properties | **None** — fallback preserves current behavior | **Low** — configurable without code deploy |
| 7 | Lifecycle | Fix "Gemni" typo reference | **None** — string change | **Low** — prevents breakage when sheet header is fixed |
| 8 | Intake | var→const/let in Index.html | **None** — mechanical conversion | **Low** — code consistency |

---

## Excluded from This Plan

These issues exist but are **medium risk** or require larger refactoring:

| Issue | Project | Why Deferred |
|-------|---------|-------------|
| 730 `var` declarations in Lifecycle (5 files) | Lifecycle | Large scope, medium risk of const/let bugs (same issue we hit in Intake) |
| `buildAdminDashboard` is ~600 lines | Lifecycle | Architecture change, not a targeted fix |
| Swapped filenames (RM_Utils↔RM_Datasync) | Finder | Renaming files risks breaking clasp push / Apps Script references |
| Hardcoded analysis results in RM_Analysis.js | Finder | ~300 lines of data — needs design decision on where to move it |
| SQL injection in RM_Utils.js | Finder | Table names from config, not user input — low actual risk |
| Sensitive data logging in RM_Utils.js | Finder | Needs audit of what's logged and whether it's sensitive |

---

## Verification

After all tasks:

**Intake:**
- `cd ~/arcade-intake-app && clasp push`
- Golden path: paste URL → extract → generate → review → submit
- Check browser console for errors after var conversion

**Finder:**
- `cd ~/Arcade\ Finder && clasp push`
- Trigger a "Request Open" workflow → verify Slack message has all fields
- Make a spreadsheet edit → verify both onEdit behaviors fire
- Submit an intake → verify workflow processes correctly

**Lifecycle:**
- `cd ~/Arcade-Lifecycle-Management && clasp push`
- Run any scoring or review function → verify it reads from the correct spreadsheet
