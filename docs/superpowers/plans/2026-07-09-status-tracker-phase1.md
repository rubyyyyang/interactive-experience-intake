# Status Tracker Phase 1 — Status Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a read-only status tracking page to the Intake app so creators and requestors can see where their interactive demo submissions are in the review pipeline.

**Architecture:** The Intake app generates a UUID (Global ID) at submission time and stores it in `Creator_Form_Raw`. When the webhook fires, Finder's `extractCreatorFormData` picks up the Global ID from the row automatically. A small fallback is added to Finder so that a new (unrecognized) Global ID creates a new row instead of erroring. The Intake app's `doGet()` gains a `?page=status` route serving `StatusTracker.html`, which reads status from `Request_Master` by Global ID or by email. The success screen gets "Submit Another" and "Finish" buttons.

**Tech Stack:** Google Apps Script (V8), HtmlService, SpreadsheetApp, google.script.run

## Global Constraints

- Google Apps Script only — no Node, React, Express, or REST API
- Never use "Arcade" in user-facing text — always "interactive demo" or "interactive experience"
- All reads from Master Spreadsheet are read-only — never write to `Request_Master` from Intake
- Public functions: no trailing underscore. Private helpers: trailing underscore
- Frontend uses `google.script.run` for server calls, not `fetch()`
- CSS must be consistent with existing `Index.html` styling (Arial, max-width 1120px, card pattern)
- Escape user-visible dynamic HTML before DOM insertion
- Unified Global ID: Intake generates the UUID, Finder uses it as the row's primary key — no separate Tracking Token

---

### Task 1: Generate Global ID in Intake and Store on Submission

**Files:**
- Modify: `Code.js:709-818` (`submitIntakeForReview` function)
- Modify: `Code.js:2089-2112` (`ensureWorkflowTrackingColumns_`)

**Interfaces:**
- Consumes: existing `submitIntakeForReview(payload)` function, `Utilities.getUuid()`
- Produces: `submission['Global ID']` — UUID string stored in `Creator_Form_Raw` row. Return value gains `globalId` field.

- [ ] **Step 1: Add Global ID generation to `submitIntakeForReview`**

In `Code.js`, add the UUID generation after line 716 (`const submittedAt = ...`):

```js
const globalId = Utilities.getUuid();
```

Then add to the `submission` object (after the `'Raw Extracted Text'` line, before the closing `}`):

```js
'Global ID': globalId,
```

- [ ] **Step 2: Add `Global ID` to `ensureWorkflowTrackingColumns_`**

In `Code.js`, add `'Global ID'` to the `neededHeaders` array in `ensureWorkflowTrackingColumns_` (line 2089):

```js
const neededHeaders = [
  'Global ID',
  'Duration',
  'Description for SEO',
  'AI Workflow Status',
  'AI Workflow Queued At',
  'AI Workflow Started At',
  'AI Workflow Completed At',
  'AI Workflow Error',
  'AI Workflow Result',
  'AI Workflow Attempts'
];
```

- [ ] **Step 3: Return Global ID from `submitIntakeForReview`**

Update the return value at the bottom of `submitIntakeForReview` (around line 811):

```js
return {
  success: true,
  message: 'Submission received. Your intake has been saved and the review workflow will start shortly.',
  submission,
  rowIndex: saveResult.rowIndex,
  workflowQueued: true,
  globalId: globalId
};
```

- [ ] **Step 4: Verify**

Run: `clasp push`

Then open the web app, submit a test demo, and check `Creator_Form_Raw`:
- The `Global ID` column exists
- The submitted row has a UUID value (e.g., `7ee49e6d-7ce2-4cea-96f1-3cb1f1a7b14f`)
- Open browser dev tools, in the console check the response from the submit call includes `globalId`

Expected: `Creator_Form_Raw` row has a UUID in the `Global ID` column.

- [ ] **Step 5: Commit**

```bash
git add Code.js
git commit -m "feat: generate Global ID on submission for status tracking"
```

---

### Task 2: Add Fallback in Finder for New Global IDs

**Files:**
- Modify: `/Users/rubyyang/Arcade Finder/RM_CreatorIntake.js:281-327` (`handleCreatorWithExistingGlobalId`)

**Interfaces:**
- Consumes: `formData.globalId` from `extractCreatorFormData` (line 263: reads `"Global ID"` column from `Creator_Form_Raw`)
- Produces: When a Global ID is present but no matching row exists in `Request_Master`, falls through to the "create new" path instead of throwing an error.

**Context:** Currently, `extractCreatorFormData` (line 215-218) already reads `"Global ID"` from the `Creator_Form_Raw` row. When Intake writes a UUID to this column, Finder will pick it up automatically. The branching at line 81 sends it to PATH 1, which errors at line 286-287 because no row exists yet. We need a fallback.

- [ ] **Step 1: Add fallback to `handleCreatorWithExistingGlobalId`**

In `/Users/rubyyang/Arcade Finder/RM_CreatorIntake.js`, replace lines 281-327 of `handleCreatorWithExistingGlobalId`:

```js
function handleCreatorWithExistingGlobalId(formData) {
  try {
    console.log(`Processing creator submission for existing Global ID: ${formData.globalId}`);

    const existingRequest = getMasterRowByGlobalId(formData.globalId);

    if (!existingRequest || existingRequest.rowIndex === -1) {
      console.log(`No existing request found for Global ID: ${formData.globalId}. Treating as new creator-only submission.`);
      return handleCreatorWithoutGlobalId(formData);
    }

    const creatorPayload = buildCreatorPayload(formData);
    const upsertResult = upsertMasterRowByGlobalId(formData.globalId, creatorPayload);

    if (upsertResult.rowIndex && typeof syncRequestMasterRowToVersion === "function") {
      try {
        syncRequestMasterRowToVersion(upsertResult.rowIndex);
        console.log(`✅ Version sync triggered for row ${upsertResult.rowIndex} after creator submission with Global ID`);
      } catch (error) {
        logError("handleCreatorWithGlobalId_version_sync", error, {
          globalId: formData.globalId,
          rowIndex: upsertResult.rowIndex
        });
      }
    }

    updateRequestDocumentWithCreatorInfo(existingRequest, formData);

    const workflowResult = handleRequestMasterByGlobalId(formData.globalId);

    logWorkflowEvent("creator_updated_existing_request", {
      globalId: formData.globalId,
      creatorName: formData.creatorName,
      number: upsertResult.number
    });

    return {
      globalId: formData.globalId,
      number: upsertResult.number,
      action: "updated_existing_request",
      workflow: workflowResult,
      ...upsertResult
    };

  } catch (error) {
    logError("handleCreatorWithExistingGlobalId", error, formData);
    throw error;
  }
}
```

The only change from the original: lines 286-288 changed from `throw new Error(...)` to `return handleCreatorWithoutGlobalId(formData);`. This way, `handleCreatorWithoutGlobalId` will **reuse** the existing `formData.globalId` (the UUID from Intake) instead of generating a new one — because line 417-418 checks `const newGlobalId = Utilities.getUuid()` but then line 418 does `formData.globalId = newGlobalId`. We need to preserve the Intake-provided UUID.

- [ ] **Step 2: Preserve the Intake-provided Global ID in PATH 2**

In `/Users/rubyyang/Arcade Finder/RM_CreatorIntake.js`, update `handleCreatorWithoutGlobalId` (line 413) to only generate a new UUID if one isn't already present:

Replace lines 417-418:

```js
    const newGlobalId = Utilities.getUuid();
    formData.globalId = newGlobalId;
```

With:

```js
    const newGlobalId = formData.globalId || Utilities.getUuid();
    formData.globalId = newGlobalId;
```

This is a one-character change (`formData.globalId || `) that preserves any existing UUID while still generating one for submissions that truly have no Global ID.

- [ ] **Step 3: Verify**

Run: `clasp push` in the Finder project directory.

**Test the fallback path:**
1. Submit a test demo through Intake
2. Wait for `AI Workflow Status` = `Completed` in `Creator_Form_Raw`
3. Check `Request_Master` for the new row
4. Confirm: the `Global ID` column in `Request_Master` matches the `Global ID` in `Creator_Form_Raw` (same UUID)
5. Confirm: status is `IE Received`, doc was created, no errors in execution log

**Test existing path still works (regression):**
1. Find a row in `Request_Master` that already has a Global ID
2. Submit a Creator Form with that Global ID via the Google Form (if possible)
3. Confirm: it updates the existing row (PATH 1), doesn't create a duplicate

Expected: Both paths work — new Global IDs create new rows, existing Global IDs update existing rows.

- [ ] **Step 4: Commit (in Finder repo)**

```bash
cd "/Users/rubyyang/Arcade Finder"
git add RM_CreatorIntake.js
git commit -m "feat: fall through to create-new path when Global ID has no existing row"
```

---

### Task 3: Server-Side Status Lookup Functions

**Files:**
- Modify: `Code.js` — add constants after line 18, add functions after `getOptions()` (around line 540)

**Interfaces:**
- Consumes: `MASTER_SPREADSHEET_ID_PROP`, `SpreadsheetApp.openById()`, `Session.getActiveUser()`
- Produces:
  - `getSubmissionStatus(globalId)` → `{ success: boolean, submission: object | null, processing: boolean }` where `submission` has keys: `title`, `status`, `dateSubmitted`, `primaryProduct`, `contentType`, `creatorName`, `requestorName`, `creationLink`, `drupalPageUrl`, `publishedDate`, `globalId`
  - `getMySubmissions()` → `{ success: boolean, submissions: object[] }` — array of the same shape, sorted newest first

- [ ] **Step 1: Add column constants for status tracker**

At the top of `Code.js`, after the `ANALYTICS_SUMMARY_SHEET` constant (line 18), add:

```js
const STATUS_TRACKER_COLUMNS = {
  FINAL_DEMO_TITLE: 'Final Demo Title',
  SUGGESTED_DEMO_TITLE: 'Suggested Demo Title',
  STATUS: 'Status',
  STATUS_RECEIVED_TS: 'Status Received Timestamp',
  STATUS_PUBLISHED_TS: 'Status Published Timestamp',
  PRIMARY_PRODUCT: 'Primary Product',
  CONTENT_TYPE: 'Content Type',
  FINAL_CONTENT_TYPE: 'Final Content Type',
  CREATOR_NAME: 'Creator Name',
  REQUESTOR_NAME: 'Requestor Name',
  CREATOR_EMAIL: 'Creator Email',
  REQUESTOR_EMAIL: 'Requestor Email',
  CREATION_LINK: 'Creation Link',
  PUBLIC_SITE_LINK: 'Public Site Link',
  RHAC_PAGE: 'RHAC page',
  GLOBAL_ID: 'Global ID'
};
```

- [ ] **Step 2: Add `getRequestMasterData_` private helper**

After the `getOptions()` function (around line 540), add:

```js
function getRequestMasterData_() {
  const spreadsheetId = PropertiesService.getScriptProperties().getProperty(MASTER_SPREADSHEET_ID_PROP);
  if (!spreadsheetId) throw new Error('MASTER_SPREADSHEET_ID is not configured.');

  const ss = SpreadsheetApp.openById(spreadsheetId);
  const sheet = ss.getSheetByName('Request_Master');
  if (!sheet) throw new Error('Request_Master sheet not found.');

  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return { headers: [], rows: [], headerMap: {} };

  const lastCol = sheet.getLastColumn();
  const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(h => String(h || '').trim());
  const rows = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();

  const headerMap = {};
  headers.forEach((h, i) => { if (h) headerMap[h] = i; });

  return { headers, rows, headerMap };
}
```

- [ ] **Step 3: Add `buildSubmissionFromRow_` private helper**

```js
function buildSubmissionFromRow_(row, headerMap) {
  const col = STATUS_TRACKER_COLUMNS;
  const get = (name) => {
    const idx = headerMap[name];
    return idx != null ? String(row[idx] || '') : '';
  };

  return {
    title: get(col.FINAL_DEMO_TITLE) || get(col.SUGGESTED_DEMO_TITLE),
    status: get(col.STATUS),
    dateSubmitted: get(col.STATUS_RECEIVED_TS),
    primaryProduct: get(col.PRIMARY_PRODUCT),
    contentType: get(col.FINAL_CONTENT_TYPE) || get(col.CONTENT_TYPE),
    creatorName: get(col.CREATOR_NAME),
    requestorName: get(col.REQUESTOR_NAME),
    creationLink: get(col.CREATION_LINK),
    drupalPageUrl: get(col.PUBLIC_SITE_LINK) || get(col.RHAC_PAGE),
    publishedDate: get(col.STATUS_PUBLISHED_TS),
    globalId: get(col.GLOBAL_ID)
  };
}
```

- [ ] **Step 4: Add `getSubmissionStatus` public function**

```js
function getSubmissionStatus(globalId) {
  if (!globalId) return { success: false, error: 'No ID provided.' };

  try {
    const { rows, headerMap } = getRequestMasterData_();
    const idIdx = headerMap[STATUS_TRACKER_COLUMNS.GLOBAL_ID];
    if (idIdx == null) return { success: false, error: 'Global ID column not found.' };

    for (let i = 0; i < rows.length; i++) {
      if (String(rows[i][idIdx] || '').trim() === globalId) {
        return { success: true, submission: buildSubmissionFromRow_(rows[i], headerMap) };
      }
    }

    return { success: true, submission: null, processing: true };
  } catch (e) {
    return { success: false, error: e.message || String(e) };
  }
}
```

Note: when the Global ID isn't found in `Request_Master`, we return `{ success: true, submission: null, processing: true }` instead of an error — the row may not exist yet because the webhook hasn't fired (1-2 min delay).

- [ ] **Step 5: Add `getMySubmissions` public function**

```js
function getMySubmissions() {
  try {
    const email = Session.getActiveUser().getEmail();
    if (!email) return { success: false, error: 'Could not determine your email. Please make sure you are logged in.' };

    const { rows, headerMap } = getRequestMasterData_();
    const creatorIdx = headerMap[STATUS_TRACKER_COLUMNS.CREATOR_EMAIL];
    const requestorIdx = headerMap[STATUS_TRACKER_COLUMNS.REQUESTOR_EMAIL];

    const lowerEmail = email.toLowerCase();
    const submissions = [];

    for (let i = 0; i < rows.length; i++) {
      const creatorEmail = creatorIdx != null ? String(rows[i][creatorIdx] || '').toLowerCase().trim() : '';
      const requestorEmail = requestorIdx != null ? String(rows[i][requestorIdx] || '').toLowerCase().trim() : '';

      if (creatorEmail === lowerEmail || requestorEmail === lowerEmail) {
        submissions.push(buildSubmissionFromRow_(rows[i], headerMap));
      }
    }

    submissions.sort((a, b) => {
      const dateA = a.dateSubmitted ? new Date(a.dateSubmitted).getTime() : 0;
      const dateB = b.dateSubmitted ? new Date(b.dateSubmitted).getTime() : 0;
      return dateB - dateA;
    });

    return { success: true, submissions };
  } catch (e) {
    return { success: false, error: e.message || String(e) };
  }
}
```

- [ ] **Step 6: Verify**

Run: `clasp push`

In the Apps Script editor, run these tests:

```js
function testGetMySubmissions() {
  const result = getMySubmissions();
  Logger.log('getMySubmissions: ' + JSON.stringify(result).slice(0, 500));
  Logger.log('Count: ' + (result.submissions ? result.submissions.length : 0));
}

function testGetSubmissionStatus() {
  // Use a known Global ID from Request_Master
  const result = getSubmissionStatus('PASTE_A_REAL_GLOBAL_ID_HERE');
  Logger.log('getSubmissionStatus: ' + JSON.stringify(result));
}

function testGetSubmissionStatusNotFound() {
  const result = getSubmissionStatus('nonexistent-uuid-12345');
  Logger.log('Not found result: ' + JSON.stringify(result));
  // Expected: { success: true, submission: null, processing: true }
}
```

Expected:
- `testGetMySubmissions` returns your submissions sorted newest first
- `testGetSubmissionStatus` returns a submission object with all fields populated
- `testGetSubmissionStatusNotFound` returns `processing: true` (not an error)

- [ ] **Step 7: Commit**

```bash
git add Code.js
git commit -m "feat: add getSubmissionStatus and getMySubmissions server functions"
```

---

### Task 4: Update `doGet()` to Route Status Page

**Files:**
- Modify: `Code.js:519-524` (`doGet` function)

**Interfaces:**
- Consumes: `HtmlService.createHtmlOutputFromFile()`, query parameter `e.parameter.page`, `e.parameter.token`
- Produces: Updated `doGet(e)` that serves `StatusTracker` when `?page=status`, otherwise serves `Index`

- [ ] **Step 1: Update `doGet` to handle page routing**

Replace the existing `doGet` function (lines 519-524):

```js
function doGet(e) {
  const page = e && e.parameter && e.parameter.page;

  if (page === 'status') {
    return HtmlService.createHtmlOutputFromFile('StatusTracker')
      .setTitle('My Submissions — Interactive Demo Intake')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }

  logAnalyticsEvent_('session_start', {});
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('Interactive Demo Intake Assistant')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}
```

- [ ] **Step 2: Verify**

Run: `clasp push`

Open the deployed web app URL with `?page=status` appended. Expected: blank page loads without errors (StatusTracker.html doesn't exist yet, so this will error — that's OK, just confirming the routing logic works by checking the Apps Script execution log shows it tried to load `StatusTracker`).

- [ ] **Step 3: Commit**

```bash
git add Code.js
git commit -m "feat: add page routing to doGet for status tracker"
```

---

### Task 5: Build `StatusTracker.html`

**Files:**
- Create: `StatusTracker.html`

**Interfaces:**
- Consumes: `google.script.run.getSubmissionStatus(globalId)`, `google.script.run.getMySubmissions()`, URL parameter `token` via `window.location.search`
- Produces: Complete status page with two views — single submission (by Global ID) and logged-in list (by email)

- [ ] **Step 1: Create `StatusTracker.html`**

Create the file `StatusTracker.html`:

```html
<!DOCTYPE html>
<html>
<head>
  <base target="_top">
  <meta charset="UTF-8">
  <title>My Submissions</title>

  <style>
    body {
      font-family: Arial, sans-serif;
      max-width: 1120px;
      margin: 32px auto;
      padding: 0 20px;
      color: #1f1f1f;
      background: #fafafa;
    }

    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 24px;
      flex-wrap: wrap;
      gap: 12px;
    }

    .header h1 {
      font-size: 1.5rem;
      margin: 0;
    }

    .header-actions a {
      color: #0066cc;
      text-decoration: none;
      font-size: 0.9rem;
    }

    .header-actions a:hover {
      text-decoration: underline;
    }

    .card {
      background: #fff;
      border: 1px solid #ddd;
      border-radius: 8px;
      padding: 20px 24px;
      margin-bottom: 16px;
    }

    .card-clickable {
      cursor: pointer;
      transition: box-shadow 0.15s;
    }

    .card-clickable:hover {
      box-shadow: 0 2px 8px rgba(0,0,0,0.08);
    }

    .card-summary {
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 8px;
    }

    .card-title {
      font-size: 1.05rem;
      font-weight: 600;
      margin: 0;
      color: #1f1f1f;
    }

    .card-meta {
      font-size: 0.85rem;
      color: #666;
      margin-top: 4px;
    }

    .card-detail {
      display: none;
      margin-top: 16px;
      border-top: 1px solid #eee;
      padding-top: 16px;
    }

    .card-detail.expanded {
      display: block;
    }

    .detail-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px 24px;
    }

    @media (max-width: 600px) {
      .detail-grid {
        grid-template-columns: 1fr;
      }
    }

    .detail-item label {
      display: block;
      font-size: 0.75rem;
      color: #888;
      text-transform: uppercase;
      letter-spacing: 0.03em;
      margin-bottom: 2px;
    }

    .detail-item span {
      font-size: 0.95rem;
      color: #1f1f1f;
      word-break: break-word;
    }

    .detail-item a {
      color: #0066cc;
      text-decoration: none;
    }

    .detail-item a:hover {
      text-decoration: underline;
    }

    .status-badge {
      display: inline-block;
      padding: 3px 10px;
      border-radius: 12px;
      font-size: 0.8rem;
      font-weight: 600;
      white-space: nowrap;
    }

    .status-request-open { background: #e8f0fe; color: #1a73e8; }
    .status-request-approved { background: #e6f4ea; color: #137333; }
    .status-ie-received { background: #fef7e0; color: #b06000; }
    .status-ie-reviewed { background: #e8f0fe; color: #1a73e8; }
    .status-ie-published { background: #e6f4ea; color: #137333; }
    .status-ie-retired { background: #f4e8e8; color: #a33; }
    .status-closed { background: #eee; color: #666; }

    .loading {
      text-align: center;
      padding: 40px;
      color: #888;
    }

    .error-message {
      text-align: center;
      padding: 40px;
      color: #c00;
    }

    .empty-state {
      text-align: center;
      padding: 60px 20px;
      color: #888;
    }

    .empty-state p {
      margin: 8px 0;
    }

    .processing-message {
      text-align: center;
      padding: 40px 20px;
      color: #666;
    }

    .processing-message p {
      margin: 8px 0;
    }
  </style>
</head>
<body>

<div class="header">
  <h1 id="pageTitle">My Submissions</h1>
  <div class="header-actions">
    <a id="backLink" href="#" onclick="navigateToIntake(); return false;">Submit a new interactive demo</a>
  </div>
</div>

<div id="loadingState" class="loading">Loading your submissions...</div>
<div id="errorState" class="error-message" style="display:none;"></div>
<div id="processingState" class="processing-message" style="display:none;">
  <p>Your submission is being processed.</p>
  <p>This usually takes a minute or two. Check back shortly.</p>
</div>
<div id="emptyState" class="empty-state" style="display:none;">
  <p>No submissions found.</p>
  <p>Once you submit an interactive demo, you can track its status here.</p>
</div>
<div id="submissionsList"></div>

<script>
  function navigateToIntake() {
    var baseUrl = getBaseUrl();
    window.top.location.href = baseUrl;
  }

  function getBaseUrl() {
    var url = '';
    try {
      url = window.location.href.split('?')[0];
    } catch (e) {}
    return url || '';
  }

  function getUrlParam(name) {
    try {
      var params = new URLSearchParams(window.location.search);
      return params.get(name) || '';
    } catch (e) {
      return '';
    }
  }

  function escapeHtml(str) {
    var div = document.createElement('div');
    div.appendChild(document.createTextNode(str || ''));
    return div.innerHTML;
  }

  function getStatusClass(status) {
    var s = (status || '').toLowerCase().replace(/\s+/g, '-');
    return 'status-' + s;
  }

  function formatDate(dateStr) {
    if (!dateStr) return '';
    try {
      var d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    } catch (e) {
      return dateStr;
    }
  }

  function renderLink(url, label) {
    if (!url) return '<span style="color:#aaa;">—</span>';
    return '<a href="' + escapeHtml(url) + '" target="_blank">' + escapeHtml(label || url) + '</a>';
  }

  function renderSubmissionCard(sub, index) {
    var card = document.createElement('div');
    card.className = 'card card-clickable';
    card.setAttribute('data-index', index);

    var summary = document.createElement('div');
    summary.className = 'card-summary';
    summary.innerHTML =
      '<div>' +
        '<p class="card-title">' + escapeHtml(sub.title || 'Untitled Submission') + '</p>' +
        '<p class="card-meta">' +
          escapeHtml(sub.primaryProduct || '') +
          (sub.primaryProduct && sub.dateSubmitted ? ' · ' : '') +
          (sub.dateSubmitted ? 'Submitted ' + formatDate(sub.dateSubmitted) : '') +
        '</p>' +
      '</div>' +
      '<span class="status-badge ' + getStatusClass(sub.status) + '">' +
        escapeHtml(sub.status || 'Unknown') +
      '</span>';

    var detail = document.createElement('div');
    detail.className = 'card-detail';
    detail.id = 'detail-' + index;
    detail.innerHTML =
      '<div class="detail-grid">' +
        '<div class="detail-item"><label>Content Type</label><span>' + escapeHtml(sub.contentType || '—') + '</span></div>' +
        '<div class="detail-item"><label>Primary Product</label><span>' + escapeHtml(sub.primaryProduct || '—') + '</span></div>' +
        '<div class="detail-item"><label>Creator</label><span>' + escapeHtml(sub.creatorName || '—') + '</span></div>' +
        '<div class="detail-item"><label>Requestor</label><span>' + escapeHtml(sub.requestorName || '—') + '</span></div>' +
        '<div class="detail-item"><label>Creation Link</label>' + renderLink(sub.creationLink, 'Open in editor') + '</div>' +
        '<div class="detail-item"><label>Drupal Page</label>' + renderLink(sub.drupalPageUrl, 'View live page') + '</div>' +
        '<div class="detail-item"><label>Date Submitted</label><span>' + escapeHtml(formatDate(sub.dateSubmitted) || '—') + '</span></div>' +
        '<div class="detail-item"><label>Published Date</label><span>' + escapeHtml(formatDate(sub.publishedDate) || '—') + '</span></div>' +
      '</div>';

    card.appendChild(summary);
    card.appendChild(detail);

    card.addEventListener('click', function() {
      var d = document.getElementById('detail-' + index);
      d.classList.toggle('expanded');
    });

    return card;
  }

  function renderSubmissions(submissions) {
    var list = document.getElementById('submissionsList');
    var loading = document.getElementById('loadingState');
    var empty = document.getElementById('emptyState');

    loading.style.display = 'none';

    if (!submissions || submissions.length === 0) {
      empty.style.display = 'block';
      return;
    }

    for (var i = 0; i < submissions.length; i++) {
      list.appendChild(renderSubmissionCard(submissions[i], i));
    }
  }

  function showError(message) {
    document.getElementById('loadingState').style.display = 'none';
    var el = document.getElementById('errorState');
    el.textContent = message;
    el.style.display = 'block';
  }

  function showProcessing() {
    document.getElementById('loadingState').style.display = 'none';
    document.getElementById('processingState').style.display = 'block';
  }

  function loadByGlobalId(globalId) {
    document.getElementById('pageTitle').textContent = 'Submission Status';
    google.script.run
      .withSuccessHandler(function(result) {
        if (result && result.success && result.submission) {
          renderSubmissions([result.submission]);
        } else if (result && result.processing) {
          showProcessing();
        } else {
          showError((result && result.error) || 'Submission not found.');
        }
      })
      .withFailureHandler(function(err) {
        showError(err && err.message ? err.message : String(err));
      })
      .getSubmissionStatus(globalId);
  }

  function loadMySubmissions() {
    google.script.run
      .withSuccessHandler(function(result) {
        if (result && result.success) {
          renderSubmissions(result.submissions);
        } else {
          showError((result && result.error) || 'Could not load submissions.');
        }
      })
      .withFailureHandler(function(err) {
        showError(err && err.message ? err.message : String(err));
      })
      .getMySubmissions();
  }

  var token = getUrlParam('token');
  if (token) {
    loadByGlobalId(token);
  } else {
    loadMySubmissions();
  }
</script>
</body>
</html>
```

- [ ] **Step 2: Verify**

Run: `clasp push`

**Test 1 — Logged-in view:**
Open `<app-url>?page=status`. Expected:
- Shows all your submissions (by email match) as expandable cards
- Each card shows title, product, date, status badge
- Click expands to show detail grid (content type, creator, links, dates)
- Empty state shows if no submissions match your email
- "Submit a new interactive demo" link goes back to the main form

**Test 2 — Global ID view:**
Open `<app-url>?page=status&token=<paste-a-real-global-id>`. Expected:
- Page title changes to "Submission Status"
- Shows the single matching submission card
- Card expands with full detail

**Test 3 — Processing state:**
Open `<app-url>?page=status&token=nonexistent-uuid`. Expected:
- Shows "Your submission is being processed. This usually takes a minute or two."

**Test 4 — Status badge colors:**
Verify each status has the correct color:
- Request Open → blue
- Request Approved → green
- IE Received → amber
- IE Reviewed → blue
- IE Published → green
- IE Retired → red
- Closed → grey

- [ ] **Step 3: Commit**

```bash
git add StatusTracker.html
git commit -m "feat: add StatusTracker.html for submission status page"
```

---

### Task 6: Update Success Screen and Add Check Status Navigation

**Files:**
- Modify: `Index.html:470-477` (success section HTML)
- Modify: `Index.html:479-494` (JS state variables)
- Modify: `Index.html:1329-1362` (`setSubmitSuccessStatus` function)
- Modify: `Index.html:1364-1446` (after `startAnotherSubmission`)
- Modify: `Index.html:264-268` (add Check Status link)

**Interfaces:**
- Consumes: `data.globalId` from `submitIntakeForReview` return value
- Produces: Updated success screen with "Submit Another" and "Finish" buttons. Session submissions tracked in JS array. "Check Status" link in header area.

- [ ] **Step 1: Add session submissions tracking to JS state**

In `Index.html`, after the existing state variables (around line 493, after `let sessionStartTime = Date.now();`), add:

```js
    let sessionSubmissions = [];
```

- [ ] **Step 2: Update success section HTML**

Replace the success section HTML (lines 470-477):

```html
  <div id="successSection" class="card" style="display:none;">
  <h2>You're all set!</h2>
  <p id="successMainMessage" class="subtle"></p>

  <div id="successReference" style="margin-top:14px;"></div>

  <div style="margin-top: 20px; display: flex; gap: 12px; flex-wrap: wrap;">
    <button type="button" onclick="startAnotherSubmission()">Submit Another</button>
    <button type="button" onclick="finishSession()" style="background:#fff; color:#1f1f1f; border:1px solid #ccc;">Finish</button>
  </div>
</div>
```

- [ ] **Step 3: Update `setSubmitSuccessStatus` to track submissions**

Replace the `setSubmitSuccessStatus` function (lines 1329-1362):

```js
function setSubmitSuccessStatus(data) {
  const workflowResult = data.workflowResult || {};
  const workflowPayload = workflowResult.result || {};

  const requestNumber = workflowPayload.number || '';
  const action = workflowPayload.action || '';
  const globalId = data.globalId || '';
  const demoTitle = (data.submission && data.submission['Final Demo Title']) || '';

  sessionSubmissions.push({
    title: demoTitle,
    globalId: globalId,
    requestNumber: requestNumber
  });

  document.getElementById('urlSection').style.display = 'none';
  document.getElementById('extractedCard').style.display = 'none';
  document.getElementById('formSection').style.display = 'none';

  const successSection = document.getElementById('successSection');
  const mainMessage = document.getElementById('successMainMessage');
  const reference = document.getElementById('successReference');

  let friendlyAction = 'Your interactive demo has been submitted and sent into the review workflow.';

  if (action === 'created_new_creator_only') {
    friendlyAction = 'Your interactive demo has been submitted as a new request and sent into the review workflow.';
  }

  if (action === 'updated_existing_request') {
    friendlyAction = 'Your interactive demo has been added to the existing request and sent back into the review workflow.';
  }

  if (sessionSubmissions.length > 1) {
    friendlyAction += ' (' + sessionSubmissions.length + ' submitted this session)';
  }

  mainMessage.textContent = friendlyAction;

  reference.innerHTML = requestNumber
    ? '<strong>Reference:</strong> Request #' + escapeHtml(requestNumber)
    : '';

  successSection.style.display = 'block';
  successSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
```

- [ ] **Step 4: Add `finishSession` function**

After the `startAnotherSubmission` function (around line 1446), add:

```js
function finishSession() {
  var baseUrl = '';
  try {
    baseUrl = window.location.href.split('?')[0];
  } catch (e) {}
  window.top.location.href = baseUrl + '?page=status';
}
```

- [ ] **Step 5: Add "Check Status" link near the top of the page**

In `Index.html`, after the pilot warning banner (around line 267, after the closing `</div>` of the pilot warning card), add:

```html
<div style="text-align: right; margin-bottom: 12px;">
  <a href="#" onclick="window.top.location.href = (window.location.href.split('?')[0] || '') + '?page=status'; return false;"
     style="color: #0066cc; font-size: 0.9rem; text-decoration: none;">Check submission status</a>
</div>
```

- [ ] **Step 6: Verify**

Run: `clasp push`

**Test 1 — Submit and see new success screen:**
1. Open the web app and submit a demo
2. Success screen shows "Submit Another" and "Finish" buttons
3. Click "Submit Another" → form resets, ready for next submission
4. Submit a second demo → success screen says "(2 submitted this session)"
5. Click "Finish" → navigates to `?page=status`

**Test 2 — Check Status link:**
1. Open the web app main form
2. "Check submission status" link appears near the top
3. Clicking it navigates to the status page

**Test 3 — Full end-to-end:**
1. Submit a demo via Intake
2. Click "Finish" → status page loads
3. If the webhook hasn't fired yet: your new submission may not show in the list yet (this is expected — it appears within 1-2 minutes)
4. Wait 2 minutes, refresh the status page → new submission appears with status "IE Received"

- [ ] **Step 7: Commit**

```bash
git add Index.html
git commit -m "feat: add Submit Another / Finish flow and Check Status link"
```

---

## End-to-End Test Plan

After all 6 tasks are complete, run these integration tests:

### Test A: New Submission → Status Tracking

1. Open the Intake web app
2. Paste a valid interactive demo URL, extract, generate, review
3. Submit the demo
4. **Verify** success screen shows "Submit Another" and "Finish"
5. Click "Finish" → status page loads
6. **Verify** the processing message shows (webhook hasn't fired yet)
7. Wait 2 minutes, refresh the page
8. **Verify** the submission appears with status "IE Received"
9. Check `Creator_Form_Raw` → `Global ID` column has a UUID
10. Check `Request_Master` → same UUID in `Global ID` column

### Test B: Multiple Submissions in One Session

1. Submit demo #1 → click "Submit Another"
2. Submit demo #2 → success screen shows "(2 submitted this session)"
3. Click "Finish" → status page shows both submissions (after webhook processing)

### Test C: Direct Status Lookup by Global ID

1. Copy a Global ID from `Request_Master`
2. Open `<app-url>?page=status&token=<global-id>`
3. **Verify** single submission card appears with correct details
4. **Verify** clicking the card expands the detail grid

### Test D: Logged-in View Shows All Submissions

1. Open `<app-url>?page=status` (no token)
2. **Verify** all submissions where your email matches Creator Email or Requestor Email appear
3. **Verify** sorted newest first
4. **Verify** cards expand with correct details

### Test E: Status Badge Colors

Open the status page and verify submissions at different statuses show correct badge colors:
- Request Open → blue
- IE Received → amber
- IE Published → green
- Closed → grey

### Test F: Finder Regression — Existing Global IDs Still Work

1. Find an existing row in `Request_Master` with a Global ID
2. Submit a Creator Form (via Google Form, not Intake) with that Global ID
3. **Verify** the existing row is updated (PATH 1), not a new row created
4. **Verify** status advances to "IE Received" and Jira notification fires (if configured)

### Test G: Navigation

1. From main form → "Check submission status" link → status page loads
2. From status page → "Submit a new interactive demo" link → main form loads
3. From success screen → "Finish" → status page loads
4. From success screen → "Submit Another" → form resets for new submission
