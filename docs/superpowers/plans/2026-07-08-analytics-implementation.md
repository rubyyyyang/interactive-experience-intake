# Analytics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add comprehensive real-time event logging and on-demand summary analytics to the Apps Script production deployment.

**Architecture:** A `logAnalyticsEvent_()` function appends rows to an `Analytics_Log` sheet in an auto-created separate spreadsheet (stored via Script Properties). A `computeAnalyticsSummary()` function reads that log and writes computed metrics to an `Analytics_Summary` sheet. The frontend generates a session ID and tracks edited fields, passing both with every server call.

**Tech Stack:** Google Apps Script, Google Sheets API (SpreadsheetApp), client-side JavaScript in Index.html

## Global Constraints

- All analytics code must be wrapped in try/catch — analytics failures must never break the main intake form flow.
- The analytics spreadsheet is separate from the `MASTER_SPREADSHEET_ID` spreadsheet. It is auto-created on first use.
- No new npm dependencies or external services.
- All new private functions use trailing underscore convention (e.g., `getAnalyticsSpreadsheet_()`) per existing codebase style.
- Apps Script environment — no ES modules, no `import`, no `crypto.randomUUID()` on server side.

---

### Task 1: Analytics Spreadsheet Access & Event Logging Core

**Files:**
- Modify: `Code.js` (append new functions after line 956, after `getTargetSpreadsheet_()`)

**Interfaces:**
- Consumes: `PropertiesService.getScriptProperties()` (Apps Script built-in)
- Produces:
  - `getAnalyticsSpreadsheet_()` → returns `Spreadsheet` object
  - `logAnalyticsEvent_(eventType: string, data: object)` → returns `void` (never throws)
  - `logAnalyticsEventFromClient(eventType: string, data: object)` → returns `{success: true}` (public, callable from frontend)

- [ ] **Step 1: Add the `ANALYTICS_SPREADSHEET_ID` constant**

Add at the top of `Code.js`, after the existing constants on line 14:

```javascript
const ANALYTICS_SPREADSHEET_ID_PROP = 'ANALYTICS_SPREADSHEET_ID';
const ANALYTICS_LOG_SHEET = 'Analytics_Log';
const ANALYTICS_SUMMARY_SHEET = 'Analytics_Summary';
```

- [ ] **Step 2: Add `getAnalyticsSpreadsheet_()`**

Insert after `getTargetSpreadsheet_()` (after line 956):

```javascript
function getAnalyticsSpreadsheet_() {
  var props = PropertiesService.getScriptProperties();
  var ssId = props.getProperty(ANALYTICS_SPREADSHEET_ID_PROP);

  if (ssId) {
    try {
      return SpreadsheetApp.openById(ssId);
    } catch (e) {
      Logger.log('Stored analytics spreadsheet not accessible (' + ssId + '): ' + e.message);
    }
  }

  var ss = SpreadsheetApp.create('Arcade Intake Analytics');
  props.setProperty(ANALYTICS_SPREADSHEET_ID_PROP, ss.getId());
  Logger.log('Analytics spreadsheet created: ' + ss.getUrl());
  return ss;
}
```

- [ ] **Step 3: Add `ensureAnalyticsLogSheet_()`**

Insert immediately after `getAnalyticsSpreadsheet_()`:

```javascript
function ensureAnalyticsLogSheet_(ss) {
  var sheet = ss.getSheetByName(ANALYTICS_LOG_SHEET);
  if (sheet) return sheet;

  sheet = ss.insertSheet(ANALYTICS_LOG_SHEET);
  sheet.appendRow([
    'Timestamp', 'Session ID', 'Event Type', 'User Email',
    'Arcade ID', 'Duration (ms)', 'Status', 'Metadata'
  ]);
  sheet.setFrozenRows(1);
  return sheet;
}
```

- [ ] **Step 4: Add `logAnalyticsEvent_()`**

Insert immediately after `ensureAnalyticsLogSheet_()`:

```javascript
function logAnalyticsEvent_(eventType, data) {
  try {
    var ss = getAnalyticsSpreadsheet_();
    var sheet = ensureAnalyticsLogSheet_(ss);
    var d = data || {};

    var userEmail = '';
    try { userEmail = Session.getActiveUser().getEmail(); } catch (e) {}

    sheet.appendRow([
      new Date().toISOString(),
      d.sessionId || '',
      eventType,
      userEmail,
      d.arcadeId || '',
      d.durationMs || '',
      d.status || 'success',
      d.metadata ? JSON.stringify(d.metadata) : ''
    ]);
  } catch (e) {
    Logger.log('Analytics logging failed: ' + e.message);
  }
}
```

- [ ] **Step 5: Add `logAnalyticsEventFromClient()`**

Insert immediately after `logAnalyticsEvent_()`. This is the public function callable from the frontend via `google.script.run`:

```javascript
function logAnalyticsEventFromClient(eventType, data) {
  logAnalyticsEvent_(eventType, data);
  return { success: true };
}
```

- [ ] **Step 6: Verify manually in Apps Script editor**

Open the Apps Script editor, run this test function to verify spreadsheet creation and logging:

```javascript
function testAnalyticsLogging() {
  logAnalyticsEvent_('test_event', {
    sessionId: 'test-session-123',
    arcadeId: 'test-arcade',
    durationMs: 1500,
    status: 'success',
    metadata: { source: 'manual_test' }
  });
  Logger.log('Test event logged. Check Analytics spreadsheet.');
  Logger.log('Spreadsheet URL: ' + getAnalyticsSpreadsheet_().getUrl());
}
```

Run `testAnalyticsLogging` from the editor. Expected: a new "Arcade Intake Analytics" spreadsheet is created with an `Analytics_Log` tab containing headers and one test row. The URL appears in the execution log.

- [ ] **Step 7: Commit**

```bash
git add Code.js
git commit -m "feat: add analytics spreadsheet access and event logging core"
```

---

### Task 2: Instrument Server-Side Functions with Analytics Events

**Files:**
- Modify: `Code.js` — functions `doGet()` (line 513), `extractGuideContent()` (line 535), `generateDraftFromGuide()` (line 551), `refineDraftWithAnswers()` (line 612), `submitIntakeForReview()` (line 628)

**Interfaces:**
- Consumes: `logAnalyticsEvent_(eventType, data)` from Task 1
- Produces: Each existing function now accepts an optional `sessionId` in its payload and logs analytics events. Return values unchanged.

- [ ] **Step 1: Instrument `extractGuideContent()`**

Replace the current `extractGuideContent` function (lines 535-549) with:

```javascript
function extractGuideContent(payload) {
  var arcadeUrl = typeof payload === 'string'
    ? payload
    : payload && (payload.arcadeUrl || payload.arcadeId || payload.url);
  var sessionId = (typeof payload === 'object' && payload) ? payload.sessionId : '';

  if (!arcadeUrl) {
    throw new Error('Please enter an interactive demo share URL. Preferred format: ' + PREFERRED_ARCADE_SHARE_URL_EXAMPLE);
  }

  logAnalyticsEvent_('guide_extraction_start', {
    sessionId: sessionId,
    arcadeId: arcadeUrl,
    metadata: { submittedUrl: arcadeUrl }
  });

  var startTime = Date.now();
  var extractedGuide = fetchGuideContent_(arcadeUrl);
  var durationMs = Date.now() - startTime;

  var imageCount = (extractedGuide.imageUrls || []).length;
  var stepCount = (extractedGuide.steps || []).length
    || (extractedGuide.stepTexts || []).length;

  logAnalyticsEvent_('guide_extraction_complete', {
    sessionId: sessionId,
    arcadeId: extractedGuide.arcadeId || arcadeUrl,
    durationMs: durationMs,
    metadata: { durationMs: durationMs, imageCount: imageCount, stepCount: stepCount }
  });

  return {
    success: true,
    extractedGuide: extractedGuide
  };
}
```

- [ ] **Step 2: Instrument `generateDraftFromGuide()`**

Replace the current `generateDraftFromGuide` function (lines 551-598) with:

```javascript
function generateDraftFromGuide(payload) {
  var extractedGuide = payload && payload.extractedGuide;
  var sessionId = payload && payload.sessionId || '';
  if (!extractedGuide) throw new Error('Missing extractedGuide');

  logAnalyticsEvent_('ai_generation_start', {
    sessionId: sessionId,
    arcadeId: extractedGuide.arcadeId || '',
    metadata: { model: MODEL_ID, promptVersion: PROMPT_VERSION }
  });

  var startTime = Date.now();

  var steps = extractedGuide.steps || [];
  var stepImageUrls = steps.map(function(s) { return s.imageUrl; });
  var imagesUsed = 0;

  var interleavedParts = [];
  if (stepImageUrls.length > 0) {
    var imageResult = fetchImagesAsBase64_(stepImageUrls);
    if (imageResult.errors.length > 0) {
      console.warn('Some images failed to fetch: ' + imageResult.errors.join(', '));
    }
    for (var i = 0; i < steps.length; i++) {
      var stepLabel = 'Step ' + (i + 1) + ': ' + (steps[i].text || '(no description)');
      interleavedParts.push({ text: stepLabel });
      if (imageResult.images[i]) {
        interleavedParts.push({
          inlineData: {
            mimeType: imageResult.images[i].mimeType,
            data: imageResult.images[i].base64
          }
        });
        imagesUsed++;
      }
    }
  } else if (extractedGuide.imageUrls && extractedGuide.imageUrls.length > 0) {
    var fallbackResult = fetchImagesAsBase64_(extractedGuide.imageUrls);
    fallbackResult.images.forEach(function(img) {
      interleavedParts.push({ inlineData: { mimeType: img.mimeType, data: img.base64 } });
    });
    imagesUsed = fallbackResult.images.length;
  }

  try {
    var prompt = buildMetadataPrompt(extractedGuide);
    var content = callGemini_(prompt, interleavedParts);
    var draft = normalizeDraft(parseModelJson(content));
    var durationMs = Date.now() - startTime;

    logAnalyticsEvent_('ai_generation_complete', {
      sessionId: sessionId,
      arcadeId: extractedGuide.arcadeId || '',
      durationMs: durationMs,
      metadata: { durationMs: durationMs, fieldConfidences: draft.field_confidence || {} }
    });

    return {
      success: true,
      draft: draft,
      modelUsed: MODEL_ID,
      promptVersion: PROMPT_VERSION,
      generatedAt: new Date().toISOString(),
      imagesUsed: imagesUsed
    };
  } catch (e) {
    var errorDurationMs = Date.now() - startTime;

    logAnalyticsEvent_('ai_generation_error', {
      sessionId: sessionId,
      arcadeId: extractedGuide.arcadeId || '',
      durationMs: errorDurationMs,
      status: 'error',
      metadata: { errorMessage: e.message, durationMs: errorDurationMs }
    });

    throw e;
  }
}
```

- [ ] **Step 3: Instrument `refineDraftWithAnswers()`**

Replace the current `refineDraftWithAnswers` function (lines 612-626) with:

```javascript
function refineDraftWithAnswers(payload) {
  var originalDraft = payload.originalDraft;
  var creatorAnswers = payload.creatorAnswers;
  var sessionId = payload.sessionId || '';

  logAnalyticsEvent_('refinement_requested', {
    sessionId: sessionId,
    metadata: { fieldsRefined: Object.keys(creatorAnswers || {}) }
  });

  var prompt = buildRefinementPrompt_(originalDraft, creatorAnswers);
  var content = callGemini_(prompt, []);
  var draft = normalizeDraft(parseModelJson(content));
  return {
    success: true,
    draft: draft,
    modelUsed: MODEL_ID,
    promptVersion: PROMPT_VERSION,
    generatedAt: new Date().toISOString(),
    refined: true
  };
}
```

- [ ] **Step 4: Instrument `submitIntakeForReview()`**

Add analytics logging at the end of `submitIntakeForReview()`, just before the `return` statement (before line 713). Insert after `const saveResult = saveSubmissionToSheet_(submission);` (line 711):

```javascript
  logAnalyticsEvent_('form_submitted', {
    sessionId: (payload && payload.sessionId) || '',
    arcadeId: form.arcadeId || '',
    metadata: {
      fieldsEditedCount: (payload.editedFields || []).length,
      editedFieldNames: payload.editedFields || [],
      sessionDurationMs: payload.sessionDurationMs || '',
      team: creatorTeamFinal,
      product: primaryProductFinal,
      contentType: contentTypeFinal
    }
  });
```

- [ ] **Step 5: Instrument `doGet()`**

Replace `doGet()` (lines 513-517) with:

```javascript
function doGet(e) {
  logAnalyticsEvent_('session_start', {});
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('Interactive Demo Intake Assistant')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}
```

- [ ] **Step 6: Commit**

```bash
git add Code.js
git commit -m "feat: instrument server-side functions with analytics events"
```

---

### Task 3: Frontend Session Tracking & Field Edit Detection

**Files:**
- Modify: `Index.html` — JavaScript section (inside `<script>` tag)

**Interfaces:**
- Consumes: `logAnalyticsEventFromClient(eventType, data)` from Task 1, `gasCall()` helper (line 487 of Index.html)
- Produces: `sessionId` string available to all frontend functions, `editedFields` Set tracking which fields the user changed after AI generation, both passed through to server calls

- [ ] **Step 1: Add session ID and edit tracking variables**

After the existing variables `currentExtractedGuide` and `currentAiMeta` (after line 485 in Index.html), add:

```javascript
    var analyticsSessionId = (function() {
      try { return crypto.randomUUID(); }
      catch (e) { return 'ses-' + Math.random().toString(36).slice(2) + Date.now().toString(36); }
    })();
    var editedFields = new Set();
    var aiDraftGenerated = false;
    var sessionStartTime = Date.now();
```

- [ ] **Step 2: Pass `sessionId` through `apiPost()`**

Replace the `apiPost` function (lines 498-512) with:

```javascript
    async function apiPost(path, payload) {
      var payloadWithSession = Object.assign({}, payload, { sessionId: analyticsSessionId });

      if (path === '/api/extract-guide') {
        return gasCall('extractGuideContent', payloadWithSession);
      }

      if (path === '/api/generate') {
        return gasCall('generateDraftFromGuide', payloadWithSession);
      }

      if (path === '/api/submit') {
        payloadWithSession.editedFields = Array.from(editedFields);
        payloadWithSession.sessionDurationMs = Date.now() - sessionStartTime;
        return gasCall('submitIntakeForReview', payloadWithSession);
      }

      throw new Error('Unknown API path: ' + path);
    }
```

- [ ] **Step 3: Track field edits after AI generation**

Add the following function after the `updateWordCounts` function (after line 709), and wire it up inside `generateDraft()`:

```javascript
    function attachFieldEditTracking() {
      var trackableFields = [
        'demoTitle', 'descriptionWithoutGid', 'descriptionForSeo', 'seoKeywords',
        'contentType', 'primaryProduct', 'otherProducts', 'vertical', 'event',
        'tdp', 'salesTactic', 'marketingProgram', 'ctaLink1', 'ctaLink2', 'ctaLink3',
        'language', 'duration', 'group'
      ];

      trackableFields.forEach(function(fieldId) {
        var el = document.getElementById(fieldId);
        if (!el) return;
        el.addEventListener('input', function() { editedFields.add(fieldId); });
        el.addEventListener('change', function() { editedFields.add(fieldId); });
      });
    }
```

- [ ] **Step 4: Wire edit tracking into `generateDraft()` and reset on "Start Another"**

In `generateDraft()`, after the line `populateFormFromDraft(draft);` (line 1252), add:

```javascript
        editedFields.clear();
        aiDraftGenerated = true;
        attachFieldEditTracking();
```

In `startAnotherSubmission()`, after the line `isSubmitting = false;` (line 1404), add:

```javascript
  editedFields.clear();
  aiDraftGenerated = false;
  analyticsSessionId = (function() {
    try { return crypto.randomUUID(); }
    catch (e) { return 'ses-' + Math.random().toString(36).slice(2) + Date.now().toString(36); }
  })();
  sessionStartTime = Date.now();
```

- [ ] **Step 5: Add best-effort `session_abandoned` beacon**

At the bottom of the `<script>` tag, before the closing `</script>` (before line 1476), add:

```javascript
    window.addEventListener('beforeunload', function() {
      if (!isSubmitting && aiDraftGenerated) {
        try {
          google.script.run.logAnalyticsEventFromClient('session_abandoned', {
            sessionId: analyticsSessionId,
            metadata: { timeSpentMs: Date.now() - sessionStartTime }
          });
        } catch (e) {}
      }
    });
```

- [ ] **Step 6: Commit**

```bash
git add Index.html
git commit -m "feat: add frontend session tracking and field edit detection"
```

---

### Task 4: Analytics Summary Computation

**Files:**
- Modify: `Code.js` (append new functions after the analytics logging functions added in Task 1)

**Interfaces:**
- Consumes: `getAnalyticsSpreadsheet_()`, `ANALYTICS_LOG_SHEET`, `ANALYTICS_SUMMARY_SHEET` from Task 1
- Produces:
  - `computeAnalyticsSummary()` → writes to `Analytics_Summary` sheet, returns summary object
  - `getAnalyticsSummary()` → returns summary object as JSON (callable from frontend)

- [ ] **Step 1: Add `computeAnalyticsSummary()`**

Insert after `logAnalyticsEventFromClient()` in Code.js:

```javascript
function computeAnalyticsSummary() {
  var ss = getAnalyticsSpreadsheet_();
  var logSheet = ss.getSheetByName(ANALYTICS_LOG_SHEET);
  if (!logSheet || logSheet.getLastRow() <= 1) {
    return { message: 'No analytics data yet.' };
  }

  var data = logSheet.getRange(2, 1, logSheet.getLastRow() - 1, 8).getValues();
  var now = new Date();
  var sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  var thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  var events = data.map(function(row) {
    var meta = {};
    try { meta = row[7] ? JSON.parse(row[7]) : {}; } catch (e) {}
    return {
      timestamp: new Date(row[0]),
      sessionId: row[1],
      eventType: row[2],
      userEmail: row[3],
      arcadeId: row[4],
      durationMs: row[5],
      status: row[6],
      metadata: meta
    };
  });

  var submissions = events.filter(function(e) { return e.eventType === 'form_submitted'; });
  var submissions7d = submissions.filter(function(e) { return e.timestamp >= sevenDaysAgo; });
  var submissions30d = submissions.filter(function(e) { return e.timestamp >= thirtyDaysAgo; });

  var allUsers = {};
  var users30d = {};
  submissions.forEach(function(e) { allUsers[e.userEmail] = true; });
  submissions30d.forEach(function(e) { users30d[e.userEmail] = true; });

  var teamCounts = {};
  var productCounts = {};
  var contentTypeCounts = {};
  submissions.forEach(function(e) {
    var team = (e.metadata.team || 'Unknown');
    var product = (e.metadata.product || 'Unknown');
    var ct = (e.metadata.contentType || 'Unknown');
    teamCounts[team] = (teamCounts[team] || 0) + 1;
    productCounts[product] = (productCounts[product] || 0) + 1;
    contentTypeCounts[ct] = (contentTypeCounts[ct] || 0) + 1;
  });

  var sessionDurations = submissions
    .map(function(e) { return e.metadata.sessionDurationMs; })
    .filter(function(d) { return d && d > 0; });
  var avgSessionDuration = sessionDurations.length
    ? Math.round(sessionDurations.reduce(function(a, b) { return a + b; }, 0) / sessionDurations.length)
    : 0;

  var sessionsWithStart = {};
  var sessionsWithSubmit = {};
  events.forEach(function(e) {
    if (e.eventType === 'session_start') sessionsWithStart[e.sessionId || e.timestamp] = true;
    if (e.eventType === 'form_submitted') sessionsWithSubmit[e.sessionId] = true;
  });
  var totalSessions = Object.keys(sessionsWithStart).length || 1;
  var abandonedSessions = totalSessions - Object.keys(sessionsWithSubmit).length;
  var abandonmentRate = Math.round((abandonedSessions / totalSessions) * 100);

  var genComplete = events.filter(function(e) { return e.eventType === 'ai_generation_complete'; });
  var genError = events.filter(function(e) { return e.eventType === 'ai_generation_error'; });
  var genStart = events.filter(function(e) { return e.eventType === 'ai_generation_start'; });
  var genSuccessRate = genStart.length
    ? Math.round((genComplete.length / genStart.length) * 100)
    : 0;
  var genLatencies = genComplete
    .map(function(e) { return e.durationMs || (e.metadata && e.metadata.durationMs); })
    .filter(function(d) { return d && d > 0; });
  var avgGenLatency = genLatencies.length
    ? Math.round(genLatencies.reduce(function(a, b) { return a + b; }, 0) / genLatencies.length)
    : 0;

  var fieldEditCounts = {};
  submissions.forEach(function(e) {
    (e.metadata.editedFieldNames || []).forEach(function(f) {
      fieldEditCounts[f] = (fieldEditCounts[f] || 0) + 1;
    });
  });
  var sortedEdits = Object.keys(fieldEditCounts).sort(function(a, b) {
    return fieldEditCounts[b] - fieldEditCounts[a];
  });

  var confidenceTotals = {};
  var confidenceCounts = {};
  genComplete.forEach(function(e) {
    var fc = e.metadata.fieldConfidences || {};
    Object.keys(fc).forEach(function(field) {
      var val = fc[field] === 'high' ? 3 : fc[field] === 'medium' ? 2 : 1;
      confidenceTotals[field] = (confidenceTotals[field] || 0) + val;
      confidenceCounts[field] = (confidenceCounts[field] || 0) + 1;
    });
  });
  var avgConfidence = {};
  Object.keys(confidenceTotals).forEach(function(field) {
    var avg = confidenceTotals[field] / confidenceCounts[field];
    avgConfidence[field] = avg >= 2.5 ? 'high' : avg >= 1.5 ? 'medium' : 'low';
  });

  var refinements = events.filter(function(e) { return e.eventType === 'refinement_requested'; });
  var refinementRate = submissions.length
    ? Math.round((refinements.length / submissions.length) * 100)
    : 0;

  var extractComplete = events.filter(function(e) { return e.eventType === 'guide_extraction_complete'; });
  var extractLatencies = extractComplete
    .map(function(e) { return e.durationMs || (e.metadata && e.metadata.durationMs); })
    .filter(function(d) { return d && d > 0; });
  var avgExtractLatency = extractLatencies.length
    ? Math.round(extractLatencies.reduce(function(a, b) { return a + b; }, 0) / extractLatencies.length)
    : 0;

  var allErrors = events.filter(function(e) { return e.status === 'error'; });
  var allApiCalls = events.filter(function(e) {
    return ['guide_extraction_start', 'ai_generation_start'].indexOf(e.eventType) !== -1;
  });
  var errorRate = allApiCalls.length
    ? Math.round((allErrors.length / allApiCalls.length) * 100)
    : 0;

  var errorsByType = {};
  allErrors.forEach(function(e) {
    errorsByType[e.eventType] = (errorsByType[e.eventType] || 0) + 1;
  });

  var dailySubmissions = {};
  submissions30d.forEach(function(e) {
    var day = e.timestamp.toISOString().split('T')[0];
    dailySubmissions[day] = (dailySubmissions[day] || 0) + 1;
  });

  var summary = {
    generatedAt: now.toISOString(),
    usage: {
      totalSubmissions: submissions.length,
      submissions7d: submissions7d.length,
      submissions30d: submissions30d.length,
      uniqueUsersAllTime: Object.keys(allUsers).length,
      uniqueUsers30d: Object.keys(users30d).length,
      byTeam: teamCounts,
      byProduct: productCounts,
      byContentType: contentTypeCounts,
      avgSessionDurationMs: avgSessionDuration,
      abandonmentRate: abandonmentRate + '%'
    },
    aiQuality: {
      avgConfidenceByField: avgConfidence,
      mostEditedFields: sortedEdits.slice(0, 10),
      leastEditedFields: sortedEdits.slice(-5).reverse(),
      generationSuccessRate: genSuccessRate + '%',
      avgGenerationLatencyMs: avgGenLatency,
      refinementRate: refinementRate + '%'
    },
    operations: {
      errorRate: errorRate + '%',
      errorsByType: errorsByType,
      avgExtractionTimeMs: avgExtractLatency,
      avgGenerationTimeMs: avgGenLatency,
      dailySubmissions30d: dailySubmissions
    }
  };

  writeAnalyticsSummarySheet_(ss, summary);
  return summary;
}
```

- [ ] **Step 2: Add `writeAnalyticsSummarySheet_()`**

Insert immediately after `computeAnalyticsSummary()`:

```javascript
function writeAnalyticsSummarySheet_(ss, summary) {
  var sheet = ss.getSheetByName(ANALYTICS_SUMMARY_SHEET);
  if (!sheet) {
    sheet = ss.insertSheet(ANALYTICS_SUMMARY_SHEET);
  }
  sheet.clear();

  var rows = [];

  rows.push(['Analytics Summary', 'Generated: ' + summary.generatedAt]);
  rows.push(['', '']);

  rows.push(['=== USAGE METRICS ===', '']);
  rows.push(['Total Submissions (All Time)', summary.usage.totalSubmissions]);
  rows.push(['Submissions (Last 7 Days)', summary.usage.submissions7d]);
  rows.push(['Submissions (Last 30 Days)', summary.usage.submissions30d]);
  rows.push(['Unique Users (All Time)', summary.usage.uniqueUsersAllTime]);
  rows.push(['Unique Users (Last 30 Days)', summary.usage.uniqueUsers30d]);
  rows.push(['Avg Session Duration (ms)', summary.usage.avgSessionDurationMs]);
  rows.push(['Abandonment Rate', summary.usage.abandonmentRate]);
  rows.push(['', '']);

  rows.push(['--- Submissions by Team ---', '']);
  Object.keys(summary.usage.byTeam).forEach(function(team) {
    rows.push([team, summary.usage.byTeam[team]]);
  });
  rows.push(['', '']);

  rows.push(['--- Submissions by Product ---', '']);
  Object.keys(summary.usage.byProduct).forEach(function(product) {
    rows.push([product, summary.usage.byProduct[product]]);
  });
  rows.push(['', '']);

  rows.push(['--- Submissions by Content Type ---', '']);
  Object.keys(summary.usage.byContentType).forEach(function(ct) {
    rows.push([ct, summary.usage.byContentType[ct]]);
  });
  rows.push(['', '']);

  rows.push(['=== AI QUALITY METRICS ===', '']);
  rows.push(['Generation Success Rate', summary.aiQuality.generationSuccessRate]);
  rows.push(['Avg Generation Latency (ms)', summary.aiQuality.avgGenerationLatencyMs]);
  rows.push(['Refinement Request Rate', summary.aiQuality.refinementRate]);
  rows.push(['', '']);

  rows.push(['--- Most Edited Fields (AI Weakest) ---', '']);
  summary.aiQuality.mostEditedFields.forEach(function(field, i) {
    rows.push([(i + 1) + '. ' + field, '']);
  });
  rows.push(['', '']);

  rows.push(['--- Avg Confidence by Field ---', '']);
  Object.keys(summary.aiQuality.avgConfidenceByField).forEach(function(field) {
    rows.push([field, summary.aiQuality.avgConfidenceByField[field]]);
  });
  rows.push(['', '']);

  rows.push(['=== OPERATIONAL METRICS ===', '']);
  rows.push(['Error Rate', summary.operations.errorRate]);
  rows.push(['Avg Extraction Time (ms)', summary.operations.avgExtractionTimeMs]);
  rows.push(['Avg Generation Time (ms)', summary.operations.avgGenerationTimeMs]);
  rows.push(['', '']);

  rows.push(['--- Errors by Type ---', '']);
  Object.keys(summary.operations.errorsByType).forEach(function(type) {
    rows.push([type, summary.operations.errorsByType[type]]);
  });
  rows.push(['', '']);

  rows.push(['--- Daily Submissions (Last 30 Days) ---', '']);
  var days = Object.keys(summary.operations.dailySubmissions30d).sort();
  days.forEach(function(day) {
    rows.push([day, summary.operations.dailySubmissions30d[day]]);
  });

  sheet.getRange(1, 1, rows.length, 2).setValues(rows);

  sheet.setColumnWidth(1, 320);
  sheet.setColumnWidth(2, 200);
  sheet.getRange(1, 1, 1, 2).setFontWeight('bold');
}
```

- [ ] **Step 3: Add `getAnalyticsSummary()`**

Insert immediately after `writeAnalyticsSummarySheet_()`:

```javascript
function getAnalyticsSummary() {
  return computeAnalyticsSummary();
}
```

- [ ] **Step 4: Verify manually in Apps Script editor**

Run `computeAnalyticsSummary` from the Apps Script editor (after the test event from Task 1). Expected: the `Analytics_Summary` sheet is created and populated with section headers and the one test event's data.

- [ ] **Step 5: Commit**

```bash
git add Code.js
git commit -m "feat: add analytics summary computation and sheet output"
```

---

### Task 5: End-to-End Verification

**Files:**
- No new files — verification of Tasks 1-4 working together

**Interfaces:**
- Consumes: All functions from Tasks 1-4

- [ ] **Step 1: Deploy and test the full flow**

Push to Apps Script via clasp:

```bash
clasp push
```

- [ ] **Step 2: Open the deployed web app and perform a full intake**

1. Open the web app URL
2. Paste a demo URL and extract content
3. Generate a draft
4. Edit a few fields (e.g., change the title, pick a different product)
5. Submit the form

- [ ] **Step 3: Verify the Analytics_Log sheet**

Open the analytics spreadsheet (URL from the Apps Script execution log). The `Analytics_Log` sheet should have rows for:
- `session_start`
- `guide_extraction_start`
- `guide_extraction_complete`
- `ai_generation_start`
- `ai_generation_complete`
- `form_submitted` (with `editedFieldNames` in metadata)

All rows should share the same Session ID.

- [ ] **Step 4: Run `computeAnalyticsSummary()` and verify**

Run from the Apps Script editor. The `Analytics_Summary` sheet should show:
- Usage section with 1 submission
- AI Quality section with generation stats
- Operations section with latency data

- [ ] **Step 5: Delete the test event row from Task 1**

Remove the `test_event` row from `Analytics_Log` so it doesn't skew real data.

- [ ] **Step 6: Commit any fixes**

```bash
git add Code.js Index.html
git commit -m "fix: adjustments from end-to-end analytics verification"
```
