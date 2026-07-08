# Content Overlap & Quality Analysis — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add content overlap detection and quality rating functions to the Arcade Finder Apps Script project (`~/Arcade Finder/`), writing results to auto-created columns on the `Request_Master` sheet.

**Architecture:** A new `RM_Analysis.js` file follows the project's existing patterns — `getMasterSheet()`, `getHeaderMapFromSheet()`, `safeGetByName()`, `ENHANCED_CONFIG.COLUMNS`, `logError()`. A small `RM_Gemini.js` file wraps the Gemini API. Overlap detection groups demos by TDP and sends each group to Gemini in a single call (~6 calls total). Quality rating processes rows individually. Both auto-create their output columns and skip already-processed rows for re-runnability.

**Tech Stack:** Google Apps Script, Gemini 2.5 Flash, Google Sheets (bound spreadsheet)

## Global Constraints

- Project root: `/Users/rubyyang/Arcade Finder/`
- Deploy via: `npx clasp push` (scriptId `1j9kP2ZqJpQoUdszg4-X1Nvc0BaMG23KB2uMKLvf3T35k4KfpoZac_xpQ`)
- Follow existing patterns: `ENHANCED_CONFIG`, header-based column lookups, `logError()` for error handling
- Column access via `ENHANCED_CONFIG.COLUMNS` constants + `safeGetByName()` — no hardcoded column numbers
- Eligible rows: `Status` = "IE Published" or "IE Reviewed" (use `ENHANCED_CONFIG.STATUS`)
- Data columns: `FINAL_DEMO_TITLE` (title), `PRODUCT` (primary product), `TDP` (technology decision point)
- Description column: header name "Demo Description" (from `ENHANCED_CONFIG.COLUMNS.DEMO_DESCRIPTION`)
- Output columns: auto-created "Content Overlap" and "Quality Score" at end of sheet
- Apps Script 6-min execution limit — functions must be re-runnable
- Gemini API key: add `GEMINI_API_KEY` to Script Properties (same key as intake app)
- Add `https://www.googleapis.com/auth/script.external_request` to `appsscript.json` oauthScopes if not present

---

### Task 1: Create `RM_Gemini.js` — Gemini API wrapper

**Files:**
- Create: `RM_Gemini.js`

**Interfaces:**
- Consumes: `getConfigProperty()` from `RM_Config.js`
- Produces: `callGemini(prompt)` — sends a text prompt to Gemini, returns parsed JSON object

- [ ] **Step 1: Create `RM_Gemini.js`**

```javascript
/************************************************************
 * RM_Gemini.gs - Gemini API Integration
 *
 * WHAT THIS FILE DOES:
 * Wraps calls to the Gemini API for AI-powered analysis.
 *
 * SETUP:
 * Add GEMINI_API_KEY to Script Properties.
 ************************************************************/

const GEMINI_CONFIG = {
  MODEL_ID: 'gemini-2.5-flash',
  MAX_OUTPUT_TOKENS: 8192,
  TEMPERATURE: 0.1
};

function callGemini(prompt) {
  var apiKey = getConfigProperty('GEMINI_API_KEY');
  if (!apiKey) throw new Error('Missing GEMINI_API_KEY in Script Properties.');

  var url = 'https://generativelanguage.googleapis.com/v1beta/models/'
    + GEMINI_CONFIG.MODEL_ID + ':generateContent?key=' + apiKey;

  var payload = {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: GEMINI_CONFIG.TEMPERATURE,
      maxOutputTokens: GEMINI_CONFIG.MAX_OUTPUT_TOKENS,
      responseMimeType: 'application/json'
    }
  };

  var response = UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });

  var status = response.getResponseCode();
  var body = response.getContentText();

  if (status !== 200) {
    throw new Error('Gemini API error ' + status + ': ' + body);
  }

  var result = JSON.parse(body);
  var content = result.candidates && result.candidates[0] &&
    result.candidates[0].content && result.candidates[0].content.parts &&
    result.candidates[0].content.parts[0] && result.candidates[0].content.parts[0].text;

  if (!content) throw new Error('Gemini returned empty content.');

  return JSON.parse(content);
}

function testGeminiConnection() {
  var result = callGemini('Return only valid JSON: {"status":"ok"}');
  Logger.log(result);
  return result;
}
```

- [ ] **Step 2: Add `GEMINI_API_KEY` to Script Properties**

In the Apps Script editor for project `1j9kP2...`:
1. Go to Project Settings > Script Properties
2. Add property: `GEMINI_API_KEY` = (same key used in the intake app)

- [ ] **Step 3: Verify `script.external_request` scope exists**

Check `appsscript.json` — this project doesn't have explicit oauthScopes, which means it uses auto-detected scopes. Since `RM_Workflow.js` already calls `UrlFetchApp.fetch()` for Slack, the external request scope is already available. No change needed.

- [ ] **Step 4: Push and test**

```bash
cd "/Users/rubyyang/Arcade Finder" && npx clasp push
```

Run `testGeminiConnection()` from the Apps Script editor. Expected: `{status: "ok"}` in the log.

- [ ] **Step 5: Commit**

```bash
cd "/Users/rubyyang/Arcade Finder" && git add RM_Gemini.js && git commit -m "feat: add Gemini API wrapper for AI analysis"
```

---

### Task 2: Create `RM_Analysis.js` — overlap detection and quality rating

**Files:**
- Create: `RM_Analysis.js`

**Interfaces:**
- Consumes: `callGemini()` from `RM_Gemini.js`, `getMasterSheet()` / `getHeaderMapFromSheet()` / `safeGetByName()` / `logError()` from `RM_Triggers.js`, `ENHANCED_CONFIG` from `RM_Config.js`
- Produces: `detectContentOverlap()`, `rateContentQuality()`, `clearOverlapResults()`, `clearQualityResults()`, `runFullAnalysis()`

- [ ] **Step 1: Create `RM_Analysis.js` with the column helper**

```javascript
/************************************************************
 * RM_Analysis.gs - Content Overlap & Quality Analysis
 *
 * WHAT THIS FILE DOES:
 * - Detects content overlap between demos sharing the same TDP
 * - Rates content quality on a 1-100 scale
 * - Writes results to auto-created columns on Request_Master
 *
 * USAGE:
 * Run detectContentOverlap() or rateContentQuality() from the
 * Apps Script editor. Both skip already-processed rows.
 * Run runFullAnalysis() to run both in sequence.
 * Run clearOverlapResults() / clearQualityResults() to re-run.
 ************************************************************/

var ANALYSIS_COLUMNS = {
  OVERLAP: 'Content Overlap',
  QUALITY: 'Quality Score'
};

function ensureAnalysisColumns_(sheet) {
  var needed = [ANALYSIS_COLUMNS.OVERLAP, ANALYSIS_COLUMNS.QUALITY];
  var lastCol = sheet.getLastColumn();
  var headers = lastCol > 0
    ? sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(function(h) { return String(h || '').trim(); })
    : [];

  needed.forEach(function(header) {
    if (headers.indexOf(header) === -1) {
      sheet.getRange(1, headers.length + 1).setValue(header);
      headers.push(header);
    }
  });

  return {
    overlapCol: headers.indexOf(ANALYSIS_COLUMNS.OVERLAP) + 1,
    qualityCol: headers.indexOf(ANALYSIS_COLUMNS.QUALITY) + 1
  };
}
```

- [ ] **Step 2: Add the overlap detection functions**

Append to `RM_Analysis.js`:

```javascript
/* =========================
   CONTENT OVERLAP DETECTION
========================= */

function buildOverlapPrompt_(demos) {
  var demoList = demos.map(function(d) {
    return 'Row ' + d.row + ' | Title: ' + d.title + ' | Product: ' + d.product +
      ' | Description: ' + d.description;
  }).join('\n\n');

  return 'You are reviewing a catalog of interactive demos to find content overlap.\n\n' +
    'Below are demos grouped under the same Technology Decision Point. ' +
    'Identify pairs or clusters that cover substantially the same topic, workflow, or use case.\n\n' +
    'Return a JSON array with one object per demo row:\n' +
    '[{"row": <number>, "overlaps_with": [<row numbers>], "overlap_score": <0-100>, "note": "<1 sentence>"}]\n\n' +
    'Rules:\n' +
    '- Same product but different workflows = NOT overlapping.\n' +
    '- Same workflow on same product = overlapping even if titles differ.\n' +
    '- 0 = unique. 50+ = significant overlap. 80+ = near-duplicate.\n' +
    '- If no overlaps, return overlaps_with: [] and overlap_score: 0.\n' +
    '- Be specific about WHAT overlaps.\n\n' +
    'Demos:\n\n' + demoList;
}

function detectContentOverlap() {
  var sheet = getMasterSheet();
  var headerMap = getHeaderMapFromSheet(sheet, ENHANCED_CONFIG.SHEETS.HEADER_ROW);
  var cols = ensureAnalysisColumns_(sheet);
  var overlapCol = cols.overlapCol;

  var lastRow = sheet.getLastRow();
  if (lastRow <= ENHANCED_CONFIG.SHEETS.HEADER_ROW) {
    Logger.log('No data rows.');
    return;
  }

  var dataRows = lastRow - ENHANCED_CONFIG.SHEETS.HEADER_ROW;
  var allData = sheet.getRange(ENHANCED_CONFIG.SHEETS.HEADER_ROW + 1, 1, dataRows, sheet.getLastColumn()).getValues();
  var existingOverlaps = sheet.getRange(ENHANCED_CONFIG.SHEETS.HEADER_ROW + 1, overlapCol, dataRows, 1).getValues();

  var tdpGroups = {};

  for (var i = 0; i < allData.length; i++) {
    var row = allData[i];
    var status = String(safeGetByName(row, headerMap, ENHANCED_CONFIG.COLUMNS.STATUS) || '').trim();

    if (status !== ENHANCED_CONFIG.STATUS.IE_PUBLISHED && status !== ENHANCED_CONFIG.STATUS.IE_REVIEWED) continue;

    var title = String(safeGetByName(row, headerMap, ENHANCED_CONFIG.COLUMNS.FINAL_DEMO_TITLE) || '').trim();
    var desc = String(safeGetByName(row, headerMap, ENHANCED_CONFIG.COLUMNS.DEMO_DESCRIPTION) || '').trim();
    if (!title && !desc) continue;

    var tdp = String(safeGetByName(row, headerMap, ENHANCED_CONFIG.COLUMNS.TDP) || '').trim() || 'Unassigned';
    var product = String(safeGetByName(row, headerMap, ENHANCED_CONFIG.COLUMNS.PRODUCT) || '').trim();
    var rowIndex = i + ENHANCED_CONFIG.SHEETS.HEADER_ROW + 1;

    var demo = {
      row: rowIndex,
      title: title,
      product: product,
      tdp: tdp,
      description: (desc || title).slice(0, 300),
      dataIndex: i
    };

    if (!tdpGroups[tdp]) tdpGroups[tdp] = [];
    tdpGroups[tdp].push(demo);
  }

  var tdpKeys = Object.keys(tdpGroups);
  Logger.log('Found ' + tdpKeys.length + ' TDP groups.');

  for (var g = 0; g < tdpKeys.length; g++) {
    var group = tdpGroups[tdpKeys[g]];

    if (group.length < 2) {
      var solo = group[0];
      if (!String(existingOverlaps[solo.dataIndex][0] || '').trim()) {
        sheet.getRange(solo.row, overlapCol).setValue('Score: 0/100 | Only demo in TDP: ' + tdpKeys[g]);
      }
      continue;
    }

    var allExisting = group.every(function(d) {
      return String(existingOverlaps[d.dataIndex][0] || '').trim() !== '';
    });
    if (allExisting) {
      Logger.log('TDP "' + tdpKeys[g] + '": all rows done, skipping.');
      continue;
    }

    Logger.log('TDP "' + tdpKeys[g] + '": analyzing ' + group.length + ' demos...');

    try {
      var prompt = buildOverlapPrompt_(group);
      var results = callGemini(prompt);
      if (!Array.isArray(results)) results = [results];

      for (var r = 0; r < results.length; r++) {
        var item = results[r];
        var overlapRows = item.overlaps_with || [];
        var score = item.overlap_score || 0;
        var note = item.note || '';

        var output = 'Score: ' + score + '/100';
        if (overlapRows.length > 0) {
          var overlapTitles = overlapRows.map(function(oRow) {
            var match = group.filter(function(d) { return d.row === oRow; })[0];
            return match ? ('Row ' + oRow + ' "' + match.title + '"') : ('Row ' + oRow);
          });
          output += ' | Overlaps: ' + overlapTitles.join('; ');
        }
        if (note) output += ' | ' + note;

        sheet.getRange(item.row, overlapCol).setValue(output);
      }

      Logger.log('TDP "' + tdpKeys[g] + '": done.');
    } catch (e) {
      logError('detectContentOverlap', e, { tdp: tdpKeys[g] });
      Logger.log('TDP "' + tdpKeys[g] + '": ERROR - ' + e.message);
    }
  }

  Logger.log('Overlap detection complete.');
}
```

- [ ] **Step 3: Add the quality rating functions**

Append to `RM_Analysis.js`:

```javascript
/* =========================
   CONTENT QUALITY RATING
========================= */

function buildQualityPrompt_(demo) {
  return 'Rate the content quality of this Red Hat interactive demo.\n\n' +
    'Title: ' + demo.title + '\n' +
    'Primary Product: ' + demo.product + '\n' +
    'Technology Decision Point: ' + demo.tdp + '\n' +
    'Description:\n' + demo.description + '\n\n' +
    'Rubric (100 points total):\n' +
    '- Title (20pts): Specific and descriptive? Names product and use case?\n' +
    '- Description (30pts): Clearly explains WHY this matters and WHAT it covers? Concise?\n' +
    '- Tour Highlights (30pts): Specific bullets naming UI elements, tools, commands, metrics? Follows demo flow?\n' +
    '- Completeness (20pts): Covers full workflow? Enough detail? Product/TDP classification reasonable?\n\n' +
    'Calibration: 90+ excellent, 70-89 good, 50-69 mediocre, <50 poor.\n\n' +
    'Return JSON: {"score": <1-100>, "rationale": "<1 sentence>", "top_issue": "<biggest improvement, or empty if score >= 80>"}';
}

function rateContentQuality() {
  var sheet = getMasterSheet();
  var headerMap = getHeaderMapFromSheet(sheet, ENHANCED_CONFIG.SHEETS.HEADER_ROW);
  var cols = ensureAnalysisColumns_(sheet);
  var qualityCol = cols.qualityCol;

  var lastRow = sheet.getLastRow();
  if (lastRow <= ENHANCED_CONFIG.SHEETS.HEADER_ROW) {
    Logger.log('No data rows.');
    return;
  }

  var dataRows = lastRow - ENHANCED_CONFIG.SHEETS.HEADER_ROW;
  var allData = sheet.getRange(ENHANCED_CONFIG.SHEETS.HEADER_ROW + 1, 1, dataRows, sheet.getLastColumn()).getValues();
  var existingScores = sheet.getRange(ENHANCED_CONFIG.SHEETS.HEADER_ROW + 1, qualityCol, dataRows, 1).getValues();

  var processed = 0, skipped = 0, errors = 0;

  for (var i = 0; i < allData.length; i++) {
    var row = allData[i];
    var status = String(safeGetByName(row, headerMap, ENHANCED_CONFIG.COLUMNS.STATUS) || '').trim();
    var rowIndex = i + ENHANCED_CONFIG.SHEETS.HEADER_ROW + 1;

    if (status !== ENHANCED_CONFIG.STATUS.IE_PUBLISHED && status !== ENHANCED_CONFIG.STATUS.IE_REVIEWED) {
      skipped++;
      continue;
    }

    var title = String(safeGetByName(row, headerMap, ENHANCED_CONFIG.COLUMNS.FINAL_DEMO_TITLE) || '').trim();
    var desc = String(safeGetByName(row, headerMap, ENHANCED_CONFIG.COLUMNS.DEMO_DESCRIPTION) || '').trim();
    var existingScore = String(existingScores[i][0] || '').trim();

    if ((!title && !desc) || existingScore) {
      skipped++;
      continue;
    }

    try {
      Logger.log('Row ' + rowIndex + ': Rating...');

      var demo = {
        title: title,
        product: String(safeGetByName(row, headerMap, ENHANCED_CONFIG.COLUMNS.PRODUCT) || '').trim(),
        tdp: String(safeGetByName(row, headerMap, ENHANCED_CONFIG.COLUMNS.TDP) || '').trim(),
        description: desc || title
      };

      var result = callGemini(buildQualityPrompt_(demo));
      var score = result.score || 0;
      var rationale = result.rationale || '';
      var topIssue = result.top_issue || '';

      var output = score + '/100 — ' + rationale;
      if (topIssue) output += ' | Improve: ' + topIssue;

      sheet.getRange(rowIndex, qualityCol).setValue(output);
      processed++;
      Logger.log('Row ' + rowIndex + ': ' + score + '/100');
    } catch (e) {
      errors++;
      logError('rateContentQuality', e, { rowIndex: rowIndex });
      Logger.log('Row ' + rowIndex + ': ERROR - ' + e.message);
    }
  }

  Logger.log('Quality complete. Processed: ' + processed + ', Skipped: ' + skipped + ', Errors: ' + errors);
}
```

- [ ] **Step 4: Add clear and run-all helpers**

Append to `RM_Analysis.js`:

```javascript
/* =========================
   UTILITIES
========================= */

function clearAnalysisResults_(phase) {
  var sheet = getMasterSheet();
  var cols = ensureAnalysisColumns_(sheet);
  var lastRow = sheet.getLastRow();
  if (lastRow <= ENHANCED_CONFIG.SHEETS.HEADER_ROW) return;

  var dataRows = lastRow - ENHANCED_CONFIG.SHEETS.HEADER_ROW;

  if (!phase || phase === 'overlap') {
    sheet.getRange(ENHANCED_CONFIG.SHEETS.HEADER_ROW + 1, cols.overlapCol, dataRows, 1).clearContent();
    Logger.log('Cleared overlap column.');
  }
  if (!phase || phase === 'quality') {
    sheet.getRange(ENHANCED_CONFIG.SHEETS.HEADER_ROW + 1, cols.qualityCol, dataRows, 1).clearContent();
    Logger.log('Cleared quality column.');
  }
}

function clearOverlapResults() { clearAnalysisResults_('overlap'); }
function clearQualityResults() { clearAnalysisResults_('quality'); }
function clearAllAnalysisResults() { clearAnalysisResults_(); }

function runFullAnalysis() {
  Logger.log('=== Full Analysis Started ===');

  try {
    detectContentOverlap();
  } catch (e) {
    logError('runFullAnalysis', e, { phase: 'overlap' });
  }

  try {
    rateContentQuality();
  } catch (e) {
    logError('runFullAnalysis', e, { phase: 'quality' });
  }

  Logger.log('=== Full Analysis Complete ===');
}
```

- [ ] **Step 5: Push and test**

```bash
cd "/Users/rubyyang/Arcade Finder" && npx clasp push
```

Run from Apps Script editor in this order:
1. `testGeminiConnection()` — verify Gemini works
2. `detectContentOverlap()` — check "Content Overlap" column populates
3. `rateContentQuality()` — check "Quality Score" column populates

- [ ] **Step 6: Commit**

```bash
cd "/Users/rubyyang/Arcade Finder" && git add RM_Analysis.js && git commit -m "feat: add content overlap detection and quality rating"
```

---

### Task 3: Verify column name for descriptions

**Files:**
- No changes — verification only

The intake app writes descriptions to column BN using a hardcoded column number. This project uses header names. Before running, verify the header name in column BN matches what the analysis functions expect.

- [ ] **Step 1: Check what header is at column BN on Request_Master**

Run from Apps Script editor:

```javascript
function checkDescriptionColumn() {
  var sheet = getMasterSheet();
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  // Log headers around columns 64-68 (BL through BR)
  for (var i = 63; i < Math.min(68, headers.length); i++) {
    Logger.log('Col ' + (i+1) + ': "' + headers[i] + '"');
  }
  // Also check what DEMO_DESCRIPTION maps to
  var headerMap = getHeaderMapFromSheet(sheet, 1);
  Logger.log('DEMO_DESCRIPTION column index: ' + headerMap[ENHANCED_CONFIG.COLUMNS.DEMO_DESCRIPTION]);
}
```

If the header at BN is different from `ENHANCED_CONFIG.COLUMNS.DEMO_DESCRIPTION` ("Demo Description"), update the analysis functions to use the actual header name. The fix would be adding a new constant to `ENHANCED_CONFIG.COLUMNS`:

```javascript
AI_DESCRIPTION: "AI Generated Description",  // or whatever BN's header is
```

And updating the `safeGetByName` calls in `RM_Analysis.js` to fall back:

```javascript
var desc = String(
  safeGetByName(row, headerMap, ENHANCED_CONFIG.COLUMNS.AI_DESCRIPTION) ||
  safeGetByName(row, headerMap, ENHANCED_CONFIG.COLUMNS.DEMO_DESCRIPTION) || ''
).trim();
```

- [ ] **Step 2: Commit if changes needed**

```bash
cd "/Users/rubyyang/Arcade Finder" && git add RM_Config.js RM_Analysis.js && git commit -m "fix: align description column name with actual sheet header"
```
