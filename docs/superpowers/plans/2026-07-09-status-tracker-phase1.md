# Status Tracker Phase 1 — Status Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a read-only status tracking page to the Intake app so creators and requestors can see where their interactive demo submissions are in the review pipeline.

**Architecture:** The Intake app's `doGet()` gains a `?page=status` route that serves a new `StatusTracker.html`. Two new server functions (`getSubmissionStatus`, `getMySubmissions`) read from `Request_Master` in the shared Master Spreadsheet (read-only). A tracking token (UUID) is generated at submission time and stored in `Creator_Form_Raw`, then passed to Finder via the webhook for storage in `Request_Master`. The success screen gets "Submit Another" and "Finish" buttons, with "Finish" linking to the status page.

**Tech Stack:** Google Apps Script (V8), HtmlService, SpreadsheetApp, google.script.run

## Global Constraints

- Google Apps Script only — no Node, React, Express, or REST API
- Never use "Arcade" in user-facing text — always "interactive demo" or "interactive experience"
- All reads from Master Spreadsheet are read-only — never write to `Request_Master` from Intake
- Public functions: no trailing underscore. Private helpers: trailing underscore
- Frontend uses `google.script.run` for server calls, not `fetch()`
- CSS must be consistent with existing `Index.html` styling (Arial, max-width 1120px, card pattern)
- Escape user-visible dynamic HTML before DOM insertion

---

### Task 1: Generate and Store Tracking Token on Submission

**Files:**
- Modify: `Code.js:709-818` (`submitIntakeForReview` function)
- Modify: `Code.js:1084-1088` (webhook payload in `triggerOldCreatorWorkflow_`)
- Modify: `Code.js:2089-2112` (`ensureWorkflowTrackingColumns_`)

**Interfaces:**
- Consumes: existing `submitIntakeForReview(payload)` function, `Utilities.getUuid()`
- Produces: `submission['Tracking Token']` — UUID string stored in `Creator_Form_Raw` row. Webhook payload gains `trackingToken` field. Return value gains `trackingToken` field.

- [ ] **Step 1: Add tracking token generation to `submitIntakeForReview`**

In `Code.js`, add the UUID generation after line 716 (`const submittedAt = ...`) and add it to the submission object:

```js
// After line 716:
const trackingToken = Utilities.getUuid();
```

Then add to the `submission` object (after the `'Raw Extracted Text'` line, before the closing `}`):

```js
'Tracking Token': trackingToken,
```

- [ ] **Step 2: Add `Tracking Token` to `ensureWorkflowTrackingColumns_`**

In `Code.js`, add `'Tracking Token'` to the `neededHeaders` array in `ensureWorkflowTrackingColumns_`:

```js
const neededHeaders = [
  'Tracking Token',
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

- [ ] **Step 3: Pass tracking token through the webhook payload**

In `Code.js`, update the `triggerOldCreatorWorkflow_` function to accept and pass the tracking token. Change the function signature and payload:

```js
function triggerOldCreatorWorkflow_(rowIndex, trackingToken) {
```

And update the payload JSON (around line 1084):

```js
payload: JSON.stringify({
  secret: secret,
  sheetName: 'Creator_Form_Raw',
  rowIndex: rowIndex,
  trackingToken: trackingToken || ''
}),
```

- [ ] **Step 4: Return tracking token from `submitIntakeForReview`**

Update the return value at the bottom of `submitIntakeForReview` (around line 811):

```js
return {
  success: true,
  message: 'Submission received. Your intake has been saved and the review workflow will start shortly.',
  submission,
  rowIndex: saveResult.rowIndex,
  workflowQueued: true,
  trackingToken: trackingToken
};
```

- [ ] **Step 5: Pass tracking token in `processPendingWorkflowRows`**

In `Code.js`, update `processPendingWorkflowRows` to read the tracking token from the row and pass it to `triggerOldCreatorWorkflow_`. After line 2171 where `triggerOldCreatorWorkflow_(rowIndex)` is called, change to:

```js
const trackingToken = columnMap['Tracking Token']
  ? String(values[i][columnMap['Tracking Token'] - 1] || '')
  : '';
const result = triggerOldCreatorWorkflow_(rowIndex, trackingToken);
```

- [ ] **Step 6: Verify manually**

Run: `clasp push`

Then open the web app, submit a test demo, and check `Creator_Form_Raw` to confirm:
- The `Tracking Token` column exists
- The submitted row has a UUID value
- The return data in the browser console includes `trackingToken`

- [ ] **Step 7: Commit**

```bash
git add Code.js
git commit -m "feat: generate tracking token on submission and pass through webhook"
```

---

### Task 2: Server-Side Status Lookup Functions

**Files:**
- Modify: `Code.js` — add new functions after `getOptions()` (around line 540)

**Interfaces:**
- Consumes: `MASTER_SPREADSHEET_ID_PROP`, `SpreadsheetApp.openById()`, `Session.getActiveUser()`
- Produces:
  - `getSubmissionStatus(token)` → `{ success: boolean, submission: object | null }` where `submission` has keys: `title`, `status`, `dateSubmitted`, `primaryProduct`, `contentType`, `creatorName`, `requestorName`, `creationLink`, `drupalPageUrl`, `publishedDate`, `trackingToken`
  - `getMySubmissions()` → `{ success: boolean, submissions: object[] }` — array of the same submission shape, sorted newest first

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
  TRACKING_TOKEN: 'Tracking Token'
};
```

- [ ] **Step 2: Add `getRequestMasterData_` private helper**

After the `getOptions()` function (around line 540), add a helper that reads `Request_Master` and builds a header map:

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

Add a helper that extracts the display fields from a row:

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
    trackingToken: get(col.TRACKING_TOKEN)
  };
}
```

- [ ] **Step 4: Add `getSubmissionStatus` public function**

```js
function getSubmissionStatus(token) {
  if (!token) return { success: false, error: 'No tracking token provided.' };

  try {
    const { rows, headerMap } = getRequestMasterData_();
    const tokenIdx = headerMap[STATUS_TRACKER_COLUMNS.TRACKING_TOKEN];
    if (tokenIdx == null) return { success: false, error: 'Tracking Token column not found.' };

    for (let i = 0; i < rows.length; i++) {
      if (String(rows[i][tokenIdx] || '').trim() === token) {
        return { success: true, submission: buildSubmissionFromRow_(rows[i], headerMap) };
      }
    }

    return { success: false, error: 'Submission not found.' };
  } catch (e) {
    return { success: false, error: e.message || String(e) };
  }
}
```

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

- [ ] **Step 6: Verify manually**

Run: `clasp push`

In the Apps Script editor, run this test in the execution log:

```js
function testStatusFunctions() {
  Logger.log(getMySubmissions());
}
```

Confirm it returns submission objects with the expected fields.

- [ ] **Step 7: Commit**

```bash
git add Code.js
git commit -m "feat: add getSubmissionStatus and getMySubmissions server functions"
```

---

### Task 3: Update `doGet()` to Route Status Page

**Files:**
- Modify: `Code.js:519-524` (`doGet` function)

**Interfaces:**
- Consumes: `HtmlService.createHtmlOutputFromFile()`, query parameter `e.parameter.page`
- Produces: Updated `doGet(e)` that serves `StatusTracker` when `?page=status`, otherwise serves `Index`

- [ ] **Step 1: Update `doGet` to handle page routing**

Replace the existing `doGet` function:

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

- [ ] **Step 2: Commit**

```bash
git add Code.js
git commit -m "feat: add page routing to doGet for status tracker"
```

---

### Task 4: Build `StatusTracker.html`

**Files:**
- Create: `StatusTracker.html`

**Interfaces:**
- Consumes: `google.script.run.getSubmissionStatus(token)`, `google.script.run.getMySubmissions()`, URL parameter `token` (via `google.script.history`)
- Produces: Complete status page with two views — token-based single card and logged-in list

- [ ] **Step 1: Create `StatusTracker.html`**

Create the file `StatusTracker.html` with the full status page implementation:

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

  function loadByToken(token) {
    document.getElementById('pageTitle').textContent = 'Submission Status';
    google.script.run
      .withSuccessHandler(function(result) {
        if (result && result.success && result.submission) {
          renderSubmissions([result.submission]);
        } else {
          showError((result && result.error) || 'Submission not found.');
        }
      })
      .withFailureHandler(function(err) {
        showError(err && err.message ? err.message : String(err));
      })
      .getSubmissionStatus(token);
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
    loadByToken(token);
  } else {
    loadMySubmissions();
  }
</script>
</body>
</html>
```

- [ ] **Step 2: Verify manually**

Run: `clasp push`

Open the web app with `?page=status` appended to the URL. Confirm:
- The page loads and shows your submissions (or empty state if none)
- Each card expands on click to show details
- The "Submit a new interactive demo" link navigates back to the main form
- Status badges show correct colors

If you have a tracking token from Task 1 testing, also test `?page=status&token=<uuid>` to confirm the single-submission view works.

- [ ] **Step 3: Commit**

```bash
git add StatusTracker.html
git commit -m "feat: add StatusTracker.html for submission status page"
```

---

### Task 5: Update Success Screen and Add Check Status Navigation

**Files:**
- Modify: `Index.html:470-477` (success section HTML)
- Modify: `Index.html:1329-1362` (`setSubmitSuccessStatus` function)
- Modify: `Index.html:264-268` (add Check Status link near the top)

**Interfaces:**
- Consumes: `data.trackingToken` from `submitIntakeForReview` return value. Session submissions tracked in JS array.
- Produces: Updated success screen with "Submit Another" and "Finish" buttons. "Check Status" link in header area.

- [ ] **Step 1: Add session submissions tracking to JS state**

In `Index.html`, after the existing state variables (around line 487-494, after `let sessionStartTime = Date.now();`), add:

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

- [ ] **Step 3: Track submissions in `setSubmitSuccessStatus`**

In `Index.html`, update `setSubmitSuccessStatus` (line 1329) to store the submission title and token:

```js
function setSubmitSuccessStatus(data) {
  const workflowResult = data.workflowResult || {};
  const workflowPayload = workflowResult.result || {};

  const requestNumber = workflowPayload.number || '';
  const action = workflowPayload.action || '';
  const trackingToken = data.trackingToken || '';
  const demoTitle = (data.submission && data.submission['Final Demo Title']) || '';

  sessionSubmissions.push({
    title: demoTitle,
    trackingToken: trackingToken,
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

- [ ] **Step 5: Reset session submissions in `startAnotherSubmission`**

In `startAnotherSubmission`, do NOT clear `sessionSubmissions` — the array persists across submissions in the same session. But the rest of the existing reset logic stays the same. No code change needed here; just confirming the existing function is compatible.

- [ ] **Step 6: Add "Check Status" link near the top of the page**

In `Index.html`, after the pilot warning banner (around line 267, after the closing `</div>` of the pilot warning card), add:

```html
<div style="text-align: right; margin-bottom: 12px;">
  <a href="#" onclick="window.top.location.href = (window.location.href.split('?')[0] || '') + '?page=status'; return false;"
     style="color: #0066cc; font-size: 0.9rem; text-decoration: none;">Check submission status</a>
</div>
```

- [ ] **Step 7: Verify manually**

Run: `clasp push`

Open the web app and test:
1. Submit a demo → success screen shows "Submit Another" and "Finish" buttons
2. Click "Submit Another" → form resets, submit another demo
3. Success screen shows count "(2 submitted this session)"
4. Click "Finish" → navigates to the status page
5. "Check submission status" link near the top works

- [ ] **Step 8: Commit**

```bash
git add Index.html
git commit -m "feat: add Submit Another / Finish flow and Check Status link"
```

---

### Task 6: Store Tracking Token in Finder's `Request_Master`

**Files:**
- Modify: `/Users/rubyyang/Arcade Finder/RM_Config.js` — add `TRACKING_TOKEN` column constant
- Modify: `/Users/rubyyang/Arcade Finder/RM_CreatorIntake.js` — read token from webhook payload, store in `Request_Master`

**Interfaces:**
- Consumes: `payload.trackingToken` from webhook POST (added in Task 1)
- Produces: `Tracking Token` column populated in `Request_Master` rows created via the webhook path

- [ ] **Step 1: Add column constant to Finder's config**

In `/Users/rubyyang/Arcade Finder/RM_Config.js`, add `TRACKING_TOKEN` to the COLUMNS object. After the `METADATA` line (around line 166):

```js
TRACKING_TOKEN: "Tracking Token",
```

- [ ] **Step 2: Thread tracking token through `doPost` → `onCreatorFormSubmit` → payload builders**

Three files need small changes in `/Users/rubyyang/Arcade Finder/RM_CreatorIntake.js`:

**In `doPost` (line 649):** After `const rowIndex = Number(payload.rowIndex);` (around line 676), add:

```js
const trackingToken = payload.trackingToken || '';
```

Then add it to `fakeEvent` (around line 700, after the `namedValues` line):

```js
const fakeEvent = {
  range: range,
  source: ss,
  values: range.getValues()[0],
  namedValues: buildNamedValuesFromRow_(sheet, rowIndex),
  trackingToken: trackingToken
};
```

**In `onCreatorFormSubmit` (line 59):** After `const formData = extractCreatorFormData(event);` (line 78), add:

```js
const trackingToken = event.trackingToken || '';
```

Then in each branch, after the payload is built, inject the token:

In the `handleCreatorWithExistingGlobalId` path (line 281), find where `buildCreatorPayload(formData)` is called (line 291) and after the payload is assigned, add:

```js
if (trackingToken) creatorPayload[ENHANCED_CONFIG.COLUMNS.TRACKING_TOKEN] = trackingToken;
```

In the `handleCreatorWithoutGlobalId` path (line 413), find where `buildCreatorOnlyMasterPayload(formData, docUrl)` is called (line 423) and after the payload is assigned, add:

```js
if (trackingToken) masterPayload[ENHANCED_CONFIG.COLUMNS.TRACKING_TOKEN] = trackingToken;
```

Note: the `trackingToken` variable needs to be accessible in both handler functions. The simplest approach is to pass it as a parameter: change `handleCreatorWithExistingGlobalId(formData)` to `handleCreatorWithExistingGlobalId(formData, trackingToken)` and `handleCreatorWithoutGlobalId(formData)` to `handleCreatorWithoutGlobalId(formData, trackingToken)` — then update both call sites and function signatures accordingly.

- [ ] **Step 3: Verify manually**

Run: `clasp push` in the Finder project directory.

Submit a test demo through Intake, wait for the webhook to process (check `AI Workflow Status` = Completed in `Creator_Form_Raw`), then check `Request_Master` for the new row — confirm the `Tracking Token` column has the UUID.

- [ ] **Step 4: Commit (in Finder repo)**

```bash
cd "/Users/rubyyang/Arcade Finder"
git add RM_Config.js RM_CreatorIntake.js
git commit -m "feat: store tracking token from Intake webhook in Request_Master"
```
