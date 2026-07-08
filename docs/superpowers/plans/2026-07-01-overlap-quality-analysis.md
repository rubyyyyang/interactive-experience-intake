# Content Overlap Detection & Quality Rating Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add two new batch-processing functions to `Code.js` that analyze the `Request_Master` sheet: (1) detect content overlap between demos sharing the same TDP or topic, and (2) rate each demo's content quality on a 1–100 scale. Both write results to auto-created columns at the end of the sheet.

**Architecture:** Both functions follow the established `backfillDescriptions()` pattern — bulk-read eligible rows, process via `callGemini_()`, write results back per-row. Overlap detection reads all eligible rows first, groups them by TDP, then sends each group to Gemini in a single call to identify overlapping pairs. Quality rating processes rows individually. Both create their output columns automatically using the existing `ensureWorkflowTrackingColumns_()` pattern.

**Tech Stack:** Google Apps Script, Gemini 2.5 Flash API (via existing `callGemini_()`), Google Sheets API

## Global Constraints

- All new functions go in `Code.js` (single-file Apps Script project)
- Use existing `callGemini_()` for all Gemini API calls
- Use existing `getTargetSpreadsheet_()` for sheet access
- Apps Script 6-minute execution limit — functions must be re-runnable (skip already-processed rows)
- Deploy via `clasp push`
- Column numbers: A=1 (status), H=8 (title), AO=41 (primary product), AW=49 (TDP), BN=66 (description+highlights)
- Eligible rows: column A = "IE Published" or "IE Reviewed"
- Output columns: auto-created by header name at end of sheet

---

### Task 1: Add `ensureAnalysisColumns_()` helper

**Files:**
- Modify: `Code.js` (append after `ensureWorkflowTrackingColumns_()` at ~line 1617)

**Interfaces:**
- Consumes: Sheet object from `getTargetSpreadsheet_()`
- Produces: `ensureAnalysisColumns_(sheet)` — guarantees columns "Content Overlap" and "Quality Score" exist in row 1, returns `{ overlapCol: number, qualityCol: number }`

- [ ] **Step 1: Write the helper function**

```javascript
function ensureAnalysisColumns_(sheet) {
  const needed = ['Content Overlap', 'Quality Score'];
  const lastCol = sheet.getLastColumn();
  const headers = lastCol > 0
    ? sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(h => String(h || '').trim())
    : [];

  needed.forEach(header => {
    if (!headers.includes(header)) {
      sheet.getRange(1, headers.length + 1).setValue(header);
      headers.push(header);
    }
  });

  return {
    overlapCol: headers.indexOf('Content Overlap') + 1,
    qualityCol: headers.indexOf('Quality Score') + 1
  };
}
```

- [ ] **Step 2: Push and verify**

```bash
npx clasp push
```

Open Apps Script editor, confirm `ensureAnalysisColumns_` appears in the function list. Run it manually against the sheet to verify columns are created:

```javascript
function testEnsureColumns() {
  const ss = getTargetSpreadsheet_();
  const sheet = ss.getSheetByName('Request_Master');
  const cols = ensureAnalysisColumns_(sheet);
  Logger.log('Overlap col: ' + cols.overlapCol + ', Quality col: ' + cols.qualityCol);
}
```

- [ ] **Step 3: Commit**

```bash
git add Code.js
git commit -m "feat: add ensureAnalysisColumns_ helper for overlap and quality columns"
```

---

### Task 2: Content Overlap Detection — `detectContentOverlap()`

**Files:**
- Modify: `Code.js` (append after Task 1's helper)

**Interfaces:**
- Consumes: `ensureAnalysisColumns_()`, `callGemini_()`, `getTargetSpreadsheet_()`
- Produces: `detectContentOverlap()` — callable from Apps Script editor, writes overlap findings to the "Content Overlap" column

The key design decision: instead of comparing row-by-row (O(n²) API calls), this function groups all eligible demos by TDP and sends each TDP group to Gemini in a single call. With only 6 TDP values, this means at most 6–7 Gemini calls total regardless of row count.

- [ ] **Step 1: Write the `buildOverlapPrompt_()` helper**

This constructs the prompt for one TDP group. It sends all demos' titles + descriptions and asks Gemini to identify overlapping pairs.

```javascript
function buildOverlapPrompt_(demos) {
  const demoList = demos.map(function(d) {
    return 'Row ' + d.row + ' | Title: ' + d.title + ' | Product: ' + d.product + ' | Description: ' + d.description;
  }).join('\n\n');

  return 'You are reviewing a catalog of interactive demos to find content overlap.\n\n' +
    'Below are demos grouped under the same Technology Decision Point (TDP). ' +
    'Identify pairs or clusters of demos that cover substantially the same topic, workflow, or use case.\n\n' +
    'For each demo, return an overlap assessment.\n\n' +
    'Return ONLY valid JSON — an array of objects, one per demo row:\n' +
    '[\n' +
    '  {\n' +
    '    "row": <row number>,\n' +
    '    "overlaps_with": [<row numbers of overlapping demos>],\n' +
    '    "overlap_score": <0-100, 0=unique, 100=duplicate>,\n' +
    '    "note": "<1 sentence: what overlaps or why this is unique>"\n' +
    '  }\n' +
    ']\n\n' +
    'Rules:\n' +
    '- Two demos about the same product but different workflows (e.g., install vs. migrate) are NOT overlapping.\n' +
    '- Two demos covering the same workflow on the same product ARE overlapping even if titles differ.\n' +
    '- Score 0 = completely unique topic. Score 50+ = significant overlap worth reviewing. Score 80+ = near-duplicate.\n' +
    '- If a demo has no overlaps, return overlaps_with: [] and overlap_score: 0.\n' +
    '- Be specific in the note about WHAT overlaps (e.g., "both walk through VM migration from VMware to OpenShift Virtualization").\n\n' +
    'Demos:\n\n' + demoList;
}
```

- [ ] **Step 2: Write the main `detectContentOverlap()` function**

```javascript
function detectContentOverlap() {
  var SHEET_NAME = 'Request_Master';
  var STATUS_COL = 1;
  var TITLE_COL = 8;
  var PRODUCT_COL = 41;
  var TDP_COL = 49;
  var DESC_COL = 66;
  var ELIGIBLE_STATUSES = ['IE Published', 'IE Reviewed'];

  var ss = getTargetSpreadsheet_();
  var sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) throw new Error('Sheet "' + SHEET_NAME + '" not found.');

  var cols = ensureAnalysisColumns_(sheet);
  var overlapCol = cols.overlapCol;

  var lastRow = sheet.getLastRow();
  if (lastRow <= 1) { Logger.log('No data rows.'); return; }

  var statuses = sheet.getRange(2, STATUS_COL, lastRow - 1, 1).getValues();
  var titles = sheet.getRange(2, TITLE_COL, lastRow - 1, 1).getValues();
  var products = sheet.getRange(2, PRODUCT_COL, lastRow - 1, 1).getValues();
  var tdps = sheet.getRange(2, TDP_COL, lastRow - 1, 1).getValues();
  var descs = sheet.getRange(2, DESC_COL, lastRow - 1, 1).getValues();
  var existing = sheet.getRange(2, overlapCol, lastRow - 1, 1).getValues();

  var tdpGroups = {};
  for (var i = 0; i < statuses.length; i++) {
    var status = String(statuses[i][0] || '').trim();
    if (!ELIGIBLE_STATUSES.includes(status)) continue;

    var title = String(titles[i][0] || '').trim();
    var product = String(products[i][0] || '').trim();
    var tdp = String(tdps[i][0] || '').trim() || 'Unassigned';
    var desc = String(descs[i][0] || '').trim();

    if (!title && !desc) continue;

    var demo = {
      row: i + 2,
      title: title,
      product: product,
      tdp: tdp,
      description: (desc || '').slice(0, 300)
    };

    if (!tdpGroups[tdp]) tdpGroups[tdp] = [];
    tdpGroups[tdp].push(demo);
  }

  var tdpKeys = Object.keys(tdpGroups);
  Logger.log('Found ' + tdpKeys.length + ' TDP groups.');

  for (var g = 0; g < tdpKeys.length; g++) {
    var group = tdpGroups[tdpKeys[g]];

    if (group.length < 2) {
      sheet.getRange(group[0].row, overlapCol).setValue('No overlap (only demo in TDP: ' + tdpKeys[g] + ')');
      Logger.log('TDP "' + tdpKeys[g] + '": 1 demo, skipped.');
      continue;
    }

    var allExisting = true;
    for (var c = 0; c < group.length; c++) {
      if (!String(existing[group[c].row - 2][0] || '').trim()) {
        allExisting = false;
        break;
      }
    }
    if (allExisting) {
      Logger.log('TDP "' + tdpKeys[g] + '": all rows already have overlap data, skipping.');
      continue;
    }

    Logger.log('TDP "' + tdpKeys[g] + '": analyzing ' + group.length + ' demos...');

    try {
      var prompt = buildOverlapPrompt_(group);
      var raw = callGemini_(prompt, []);
      var results = parseModelJson('[' + raw.replace(/^\[/, '').replace(/\]$/, '') + ']');

      if (!Array.isArray(results)) results = [results];

      for (var r = 0; r < results.length; r++) {
        var item = results[r];
        var rowNum = item.row;
        var overlapRows = item.overlaps_with || [];
        var score = item.overlap_score || 0;
        var note = item.note || '';

        var output = 'Score: ' + score + '/100';
        if (overlapRows.length > 0) {
          var overlapTitles = overlapRows.map(function(oRow) {
            var match = group.find(function(d) { return d.row === oRow; });
            return match ? ('Row ' + oRow + ' "' + match.title + '"') : ('Row ' + oRow);
          });
          output += ' | Overlaps: ' + overlapTitles.join('; ');
        }
        if (note) output += ' | ' + note;

        sheet.getRange(rowNum, overlapCol).setValue(output);
      }

      Logger.log('TDP "' + tdpKeys[g] + '": done.');
    } catch (e) {
      Logger.log('TDP "' + tdpKeys[g] + '": ERROR - ' + e.message);
      for (var f = 0; f < group.length; f++) {
        if (!String(existing[group[f].row - 2][0] || '').trim()) {
          sheet.getRange(group[f].row, overlapCol).setValue('Error: ' + e.message);
        }
      }
    }
  }

  Logger.log('Overlap detection complete.');
}
```

- [ ] **Step 3: Push and test**

```bash
npx clasp push
```

Run `detectContentOverlap()` from the Apps Script editor. Verify:
- "Content Overlap" column is created
- TDP groups are logged
- Overlap scores appear in the correct rows
- Demos with no overlap show score 0
- Demos with overlap reference the correct overlapping row numbers and titles

- [ ] **Step 4: Commit**

```bash
git add Code.js
git commit -m "feat: add detectContentOverlap for TDP-grouped overlap analysis"
```

---

### Task 3: Content Quality Rating — `rateContentQuality()`

**Files:**
- Modify: `Code.js` (append after Task 2)

**Interfaces:**
- Consumes: `ensureAnalysisColumns_()`, `callGemini_()`, `getTargetSpreadsheet_()`
- Produces: `rateContentQuality()` — callable from Apps Script editor, writes quality score + rationale to the "Quality Score" column

This function processes rows individually (one Gemini call per row) since quality is an absolute assessment, not comparative. It uses existing sheet data (title, product, TDP, description from BN) — no guide re-fetching needed.

- [ ] **Step 1: Write the `buildQualityPrompt_()` helper**

```javascript
function buildQualityPrompt_(demo) {
  return 'You are rating the content quality of a Red Hat interactive demo based on its metadata.\n\n' +
    'Title: ' + demo.title + '\n' +
    'Primary Product: ' + demo.product + '\n' +
    'Technology Decision Point: ' + demo.tdp + '\n' +
    'Description + Tour Highlights:\n' + demo.description + '\n\n' +
    'Rate the overall content quality from 1 to 100 using this rubric:\n\n' +
    'Title (20 points):\n' +
    '- Is it specific and descriptive? Does it name the product and use case?\n' +
    '- Bad: "Product Overview" (vague). Good: "Deploying AI Models with Red Hat OpenShift AI and Developer Hub" (specific).\n\n' +
    'Description (30 points):\n' +
    '- Does the opening clearly explain WHY this demo matters and WHAT it covers?\n' +
    '- Is it concise (2-3 sentences) without being vague?\n' +
    '- Does it avoid listing specific actions (those belong in tour highlights)?\n\n' +
    'Tour Highlights (30 points):\n' +
    '- Are the bullet points specific? Do they name UI elements, tools, commands, metrics?\n' +
    '- Do they follow the demo flow from start to finish?\n' +
    '- Bad: "Shows the dashboard" (vague). Good: "Tracking per-pod cache hit rates and latency in Grafana" (specific).\n\n' +
    'Completeness (20 points):\n' +
    '- Does the demo appear to cover a full workflow from start to finish?\n' +
    '- Are there enough tour highlights (3-6) to give a clear picture of the demo?\n' +
    '- Is the product/TDP classification reasonable for the content described?\n\n' +
    'Return ONLY valid JSON:\n' +
    '{\n' +
    '  "score": <1-100>,\n' +
    '  "rationale": "<1 sentence explaining the score>",\n' +
    '  "top_issue": "<the single biggest quality improvement this demo could make, or empty string if score >= 80>"\n' +
    '}\n\n' +
    'Be calibrated: 90+ = excellent, specific, complete. 70-89 = good with minor gaps. 50-69 = mediocre, vague or incomplete. Below 50 = poor, missing critical info.';
}
```

- [ ] **Step 2: Write the main `rateContentQuality()` function**

```javascript
function rateContentQuality() {
  var SHEET_NAME = 'Request_Master';
  var STATUS_COL = 1;
  var TITLE_COL = 8;
  var PRODUCT_COL = 41;
  var TDP_COL = 49;
  var DESC_COL = 66;
  var ELIGIBLE_STATUSES = ['IE Published', 'IE Reviewed'];

  var ss = getTargetSpreadsheet_();
  var sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) throw new Error('Sheet "' + SHEET_NAME + '" not found.');

  var cols = ensureAnalysisColumns_(sheet);
  var qualityCol = cols.qualityCol;

  var lastRow = sheet.getLastRow();
  if (lastRow <= 1) { Logger.log('No data rows.'); return; }

  var statuses = sheet.getRange(2, STATUS_COL, lastRow - 1, 1).getValues();
  var titles = sheet.getRange(2, TITLE_COL, lastRow - 1, 1).getValues();
  var products = sheet.getRange(2, PRODUCT_COL, lastRow - 1, 1).getValues();
  var tdps = sheet.getRange(2, TDP_COL, lastRow - 1, 1).getValues();
  var descs = sheet.getRange(2, DESC_COL, lastRow - 1, 1).getValues();
  var existing = sheet.getRange(2, qualityCol, lastRow - 1, 1).getValues();

  var processed = 0, skipped = 0, errors = 0;

  for (var i = 0; i < statuses.length; i++) {
    var status = String(statuses[i][0] || '').trim();
    var title = String(titles[i][0] || '').trim();
    var desc = String(descs[i][0] || '').trim();
    var existingScore = String(existing[i][0] || '').trim();
    var rowIndex = i + 2;

    if (!ELIGIBLE_STATUSES.includes(status) || (!title && !desc) || existingScore) {
      skipped++;
      continue;
    }

    try {
      Logger.log('Row ' + rowIndex + ': Rating quality...');

      var demo = {
        title: title,
        product: String(products[i][0] || '').trim(),
        tdp: String(tdps[i][0] || '').trim(),
        description: desc
      };

      var prompt = buildQualityPrompt_(demo);
      var raw = callGemini_(prompt, []);
      var result = parseModelJson(raw);

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
      Logger.log('Row ' + rowIndex + ': ERROR - ' + e.message);
    }
  }

  Logger.log('Quality rating complete. Processed: ' + processed + ', Skipped: ' + skipped + ', Errors: ' + errors);
}
```

- [ ] **Step 3: Push and test**

```bash
npx clasp push
```

Run `rateContentQuality()` from the Apps Script editor. Verify:
- "Quality Score" column is created
- Scores appear as `85/100 — Clear title and specific highlights covering full OpenShift AI workflow.`
- Rows without title or description are skipped
- Re-running skips already-rated rows

- [ ] **Step 4: Commit**

```bash
git add Code.js
git commit -m "feat: add rateContentQuality for 1-100 content quality scoring"
```

---

### Task 4: Verification & Edge Cases

**Files:**
- Modify: `Code.js` (minor tweaks if needed)

- [ ] **Step 1: Test overlap detection with small TDP groups**

Manually check the "Content Overlap" column for a TDP group with 2-3 demos. Verify:
- Overlap scores are reasonable (0 for unique topics, 50+ for similar ones)
- Row references are correct
- Overlapping demo titles are included

- [ ] **Step 2: Test quality rating calibration**

Spot-check 5 rows across the quality spectrum:
- A row with a clear title + rich description + specific highlights → expect 80+
- A row with a vague title + short description → expect below 60
- A row with title only, no description → expect below 40

- [ ] **Step 3: Test re-runnability**

Run both functions a second time. Verify:
- Already-processed rows are skipped
- New rows added since last run are processed
- No duplicates or overwrites

- [ ] **Step 4: Final push and commit**

```bash
npx clasp push
git add Code.js
git commit -m "chore: verify overlap detection and quality rating"
```
