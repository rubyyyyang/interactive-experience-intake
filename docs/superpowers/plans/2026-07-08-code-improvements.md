# Code Improvements Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix bugs, performance issues, and security gaps found during deep code review of Code.js

**Architecture:** Targeted fixes to existing functions. No file splitting or new features.

**Tech Stack:** Google Apps Script, UrlFetchApp, LockService, Gemini API

## Global Constraints

- No file splitting or architecture changes
- Sheets: read-only via API; all writes through Apps Script runtime
- Test after each change: `clasp push` → verify web app works
- Each task is independent — can be done in any order

---

## Priority 1: Bugs & Security

### Task 1: Fix race condition in saveSubmissionToSheet_ (Code.js ~line 1028)

`appendRow()` then `getLastRow()` is a TOCTOU race — a concurrent request between the two calls makes `rowIndex` point to the wrong row. That `rowIndex` tells Finder which submission to process.

**Files:**
- Modify: `Code.js` (~lines 1028-1033)

**Interfaces:**
- Consumes: `sheet.appendRow()`, `LockService`
- Produces: `{ rowIndex, workflowQueued }` — same shape, correct row number

- [ ] **Step 1: Add LockService and compute row before append**

Replace the appendRow + getLastRow pattern:

```javascript
// BEFORE:
sheet.appendRow(row);
return {
    rowIndex: sheet.getLastRow(),
    workflowQueued: true
};

// AFTER:
const lock = LockService.getScriptLock();
lock.waitLock(10000);
try {
  sheet.appendRow(row);
  var rowIndex = sheet.getLastRow();
} finally {
  lock.releaseLock();
}
return {
    rowIndex: rowIndex,
    workflowQueued: true
};
```

- [ ] **Step 2: Verify**

`clasp push` → submit a test intake → confirm the correct row appears in Creator_Form_Raw and Finder processes the right row.

---

### Task 2: Fix XSS risk in decodeHtml_ (Code.js ~line 1655)

`stripHtml_` strips tags first, then `decodeHtml_` converts entities back to real characters — so `&lt;script&gt;` survives stripping and becomes `<script>` after decoding. If the frontend uses `innerHTML` with these values, it's exploitable via a malicious guide page.

**Files:**
- Modify: `Code.js` (~lines 1646-1664)

**Interfaces:**
- Consumes: HTML strings from fetched guide pages
- Produces: Plain text (no HTML allowed in output)

- [ ] **Step 1: Decode entities BEFORE stripping tags**

Swap the order in `stripHtml_` so entities are decoded first, then tags are stripped:

```javascript
function stripHtml_(html) {
  let text = String(html || '');
  // Decode entities first so encoded tags become real tags
  text = decodeHtml_(text);
  // Now strip all tags (including previously-encoded ones)
  text = text
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return text;
}
```

- [ ] **Step 2: Sanitize href values in link extraction**

In the link extraction (~line 1489), reject `javascript:` protocol URLs:

```javascript
const href = cleanText(decodeHtml_(rawHref));
if (/^javascript:/i.test(href)) continue;
```

- [ ] **Step 3: Verify**

`clasp push` → extract a guide → confirm title, body text, and links render correctly.

---

### Task 3: Fix contradictory vertical/event instructions in AI prompt (Code.js ~lines 1755-1805)

The prompt tells the AI both "return empty string for vertical_suggestion" AND "use 'No, it is applicable to multiple verticals' for vertical_suggestion". Same contradiction for event_or_project_suggestion. The AI picks one nondeterministically.

**Files:**
- Modify: `Code.js` (~lines 1755-1805)

**Interfaces:**
- Consumes: Guide content
- Produces: Consistent AI draft with predictable vertical/event fields

- [ ] **Step 1: Remove the contradictory fallback rules**

Delete the lines in the taxonomy fallback section (~lines 1801-1803) that contradict the earlier empty-string instructions:

```
DELETE: - If the guide is not tied to a specific event or project, use "No" for event_or_project_suggestion.
DELETE: - If the guide applies across industries, use "No, it is applicable to multiple verticals" for vertical_suggestion.
```

Or, if the preferred behavior is to use descriptive values (not empty strings), delete lines 1755-1757 instead and keep the fallback rules. Pick one approach and make it consistent.

- [ ] **Step 2: Verify**

`clasp push` → generate a draft from a guide → check that vertical_suggestion and event_or_project_suggestion are consistent (always empty OR always descriptive, not randomly mixed).

---

## Priority 2: Reliability

### Task 4: Add retry logic for failed workflow rows (Code.js ~line 2130)

Rows that fail in `processPendingWorkflowRows` get `'Error'` status and are permanently abandoned. Transient failures (network timeouts, Finder being down) should be retried.

**Files:**
- Modify: `Code.js` (~lines 2094-2152)

**Interfaces:**
- Consumes: `AI Workflow Status` column values
- Produces: Retried rows or permanently failed rows with attempt count

- [ ] **Step 1: Add retry with attempt tracking**

Add an `AI Workflow Attempts` column (or reuse the error column). Change the error handler to:

```javascript
// In the catch block (~line 2140):
const attempts = sheet.getRange(rowIndex, columnMap['AI Workflow Attempts']).getValue() || 0;
if (attempts < 3) {
  sheet.getRange(rowIndex, columnMap['AI Workflow Status']).setValue('Pending');
  sheet.getRange(rowIndex, columnMap['AI Workflow Attempts']).setValue(attempts + 1);
  sheet.getRange(rowIndex, columnMap['AI Workflow Error']).setValue(error.message || String(error));
} else {
  sheet.getRange(rowIndex, columnMap['AI Workflow Status']).setValue('Failed');
  sheet.getRange(rowIndex, columnMap['AI Workflow Error']).setValue('Max retries exceeded: ' + (error.message || String(error)));
}
```

- [ ] **Step 2: Add the tracking column**

In `ensureWorkflowTrackingColumns_`, add `'AI Workflow Attempts'` to the columns list.

- [ ] **Step 3: Verify**

`clasp push` → simulate a failure (e.g., temporarily set a bad webhook URL) → confirm the row retries up to 3 times then shows `'Failed'`.

---

### Task 5: Add retry and safety-filter detection to callGemini_ (Code.js ~line 947)

No retry on 429/503, no detection of safety-blocked prompts, and `JSON.parse` can throw a confusing error on non-JSON 200 responses.

**Files:**
- Modify: `Code.js` (~lines 947-995)

**Interfaces:**
- Consumes: Gemini API
- Produces: Generated text or descriptive error

- [ ] **Step 1: Add retry for transient errors**

```javascript
function callGemini_(payload) {
  const apiKey = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_ID}:generateContent?key=${apiKey}`;
  const options = {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  let lastError;
  for (let attempt = 0; attempt < 3; attempt++) {
    const resp = UrlFetchApp.fetch(url, options);
    const status = resp.getResponseCode();

    if (status === 429 || status === 503) {
      lastError = new Error('Gemini API error ' + status + ' (attempt ' + (attempt + 1) + ')');
      Utilities.sleep(1000 * Math.pow(2, attempt));
      continue;
    }

    if (status !== 200) {
      throw new Error('Gemini API error ' + status);
    }

    let result;
    try {
      result = JSON.parse(resp.getContentText());
    } catch (e) {
      throw new Error('Gemini returned invalid JSON');
    }

    // Check for safety block
    if (result.promptFeedback && result.promptFeedback.blockReason) {
      throw new Error('Gemini blocked prompt: ' + result.promptFeedback.blockReason);
    }

    const content = result.candidates && result.candidates[0] &&
        result.candidates[0].content && result.candidates[0].content.parts &&
        result.candidates[0].content.parts[0] && result.candidates[0].content.parts[0].text;

    if (!content) throw new Error('Gemini returned empty content.');
    return content;
  }
  throw lastError;
}
```

- [ ] **Step 2: Verify**

`clasp push` → generate a draft → confirm it still works. Test with a temporarily invalid API key to confirm error messages are descriptive.

---

## Priority 3: Performance

### Task 6: Batch image fetching with UrlFetchApp.fetchAll() (Code.js ~line 1579)

`fetchImagesAsBase64_` fetches images one at a time in a `for` loop. A guide with 10-15 screenshots takes 15-45 seconds of sequential HTTP calls. `UrlFetchApp.fetchAll()` does them in parallel.

**Files:**
- Modify: `Code.js` (~lines 1579-1629)

**Interfaces:**
- Consumes: Array of image URLs
- Produces: Same `{ url, base64, mimeType }` array, fetched in parallel

- [ ] **Step 1: Replace sequential fetch with fetchAll**

```javascript
function fetchImagesAsBase64_(imageUrls) {
  if (!imageUrls || !imageUrls.length) return [];

  const requests = imageUrls.map(function(url) {
    return { url: url, muteHttpExceptions: true };
  });

  const responses = UrlFetchApp.fetchAll(requests);
  const results = [];

  for (let i = 0; i < responses.length; i++) {
    try {
      const resp = responses[i];
      if (resp.getResponseCode() !== 200) continue;

      const blob = resp.getBlob();
      const mimeType = blob.getContentType();
      if (!mimeType || !mimeType.startsWith('image/')) continue;

      const base64 = Utilities.base64Encode(blob.getBytes());
      if (base64.length > 500000) continue; // skip very large images

      results.push({
        url: imageUrls[i],
        base64: base64,
        mimeType: mimeType
      });
    } catch (e) {
      // skip failed images
    }
  }
  return results;
}
```

- [ ] **Step 2: Verify**

`clasp push` → extract a guide with multiple steps → confirm all step images load and extraction is noticeably faster.

---

### Task 7: Optimize computeAnalyticsSummary to single-pass (Code.js ~line 1148)

The function loads the entire analytics log and iterates over it 13+ times. At scale this will hit the 6-minute Apps Script limit. Refactor to a single pass.

**Files:**
- Modify: `Code.js` (~lines 1148-1317)

**Interfaces:**
- Consumes: Analytics log sheet data
- Produces: Same summary object, computed in one pass

- [ ] **Step 1: Replace multi-pass with single forEach**

Accumulate all metrics in a single `events.forEach()` loop instead of separate `.filter().map().reduce()` chains. Track counters, maps, and accumulators as you go.

This is a larger refactor — extract the current output shape from `writeAnalyticsSummarySheet_` and ensure the single-pass version produces identical output.

- [ ] **Step 2: Add date filter to only process recent data**

Instead of loading the entire log, filter to last 30 days:

```javascript
const now = new Date();
const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
// Only read rows with timestamp >= thirtyDaysAgo
```

Or, use a cursor/bookmark approach: store the last-processed row in Script Properties and only process new rows on each hourly run.

- [ ] **Step 3: Verify**

`clasp push` → run `computeAnalyticsSummary()` from Apps Script editor → confirm output matches the previous version.

---

## Priority 4: Data Quality

### Task 8: Connect extracted duration to submission flow (Code.js ~line 880)

`extractDuration_` parses duration from the guide HTML and returns it in `extractedGuide.duration`, but the submission uses `form.duration` from the frontend. The server-extracted value is only used in `backfillDescriptions`. Either:
- (A) Pass `extractedGuide.duration` to the frontend as a pre-filled suggestion, or
- (B) Remove `extractDuration_` if the frontend already handles duration

**Files:**
- Modify: `Code.js` (~line 880) and possibly `Index.html`

- [ ] **Step 1: Check if the frontend uses extractedGuide.duration**

Search Index.html for references to `duration` in the guide extraction success handler.

- [ ] **Step 2: Either wire it up or remove dead code**

If the frontend doesn't use it: either add it as a pre-filled field suggestion (like other extracted fields), or remove the extraction call to reduce confusion.

---

## Summary

| # | Fix | Priority | Risk | Impact |
|---|-----|----------|------|--------|
| 1 | Race condition in saveSubmissionToSheet_ | P1 Bug | Low | Prevents wrong-row processing |
| 2 | XSS via decodeHtml_ entity re-encoding | P1 Security | Low | Prevents script injection from malicious guides |
| 3 | Contradictory AI prompt instructions | P1 Bug | None | Consistent vertical/event suggestions |
| 4 | Retry logic for failed workflow rows | P2 Reliability | Low | Transient failures auto-recover |
| 5 | Gemini API retry + safety detection | P2 Reliability | Low | Better error handling, fewer silent failures |
| 6 | Batch image fetching | P3 Performance | Low | 5-10x faster guide extraction |
| 7 | Single-pass analytics computation | P3 Performance | Med | Prevents timeout at scale |
| 8 | Wire up extracted duration | P4 Data | None | Eliminates dead code / connects useful data |

---

## Verification

After all tasks:
- `clasp push` succeeds
- Golden path works: paste URL → extract guide → generate AI draft → review → submit → row appears in Creator_Form_Raw → workflow trigger fires
- `processPendingWorkflowRows` retries transient failures up to 3 times
- Guide extraction with 10+ images completes in under 15 seconds (was 30-45s)
- Analytics summary computes without timeout on large datasets
