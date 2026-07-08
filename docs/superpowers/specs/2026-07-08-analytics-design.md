# Arcade Intake App — Analytics Design Spec

## Overview

Add comprehensive analytics to the Apps Script production deployment (Code.js / Index.html) covering usage patterns, AI quality metrics, and operational health. Analytics data is logged in real time and summarized on demand.

## Storage

**Auto-created Google Spreadsheet** — on first analytics event, the code creates a new spreadsheet titled "Arcade Intake Analytics" via `SpreadsheetApp.create()` and stores its ID in Script Properties (`ANALYTICS_SPREADSHEET_ID`). Subsequent calls reuse the stored ID. The URL is logged on creation so the user can bookmark it.

This spreadsheet is **separate** from the `MASTER_SPREADSHEET_ID` spreadsheet where `Creator_Form_Raw` lives.

**Two tabs in the analytics spreadsheet:**

1. **`Analytics_Log`** — raw event log, one row per event
2. **`Analytics_Summary`** — computed metrics, refreshed on demand

## Event Model

### Analytics_Log Schema

| Column | Type | Description |
|--------|------|-------------|
| Timestamp | ISO 8601 string | When the event occurred |
| Session ID | string | Random UUID generated per page load, ties events in one session together |
| Event Type | string | One of the defined event types below |
| User Email | string | From `Session.getActiveUser().getEmail()` |
| Arcade ID | string | The demo's Arcade ID, if applicable |
| Duration (ms) | number | For timed events (API calls, generation) |
| Status | string | `success` or `error` |
| Metadata | JSON string | Event-specific details |

### Event Types

| Event Type | Trigger | Metadata |
|------------|---------|----------|
| `session_start` | Page load (`doGet`) | — |
| `guide_extraction_start` | `extractGuideContent()` called | `{ arcadeId, submittedUrl }` |
| `guide_extraction_complete` | Extraction finishes | `{ durationMs, imageCount, stepCount }` |
| `ai_generation_start` | `generateDraftFromGuide()` called | `{ model, promptVersion }` |
| `ai_generation_complete` | Gemini returns successfully | `{ durationMs, fieldConfidences }` |
| `ai_generation_error` | Gemini call fails | `{ errorMessage, statusCode }` |
| `field_edited` | User edits AI-filled field (batched) | `{ fieldName, wasAiGenerated, confidenceLevel }` |
| `form_submitted` | `submitIntakeForReview()` succeeds | `{ fieldsEditedCount, editedFieldNames, sessionDurationMs, team, product, contentType }` |
| `session_abandoned` | Page unload without submission (best-effort — `google.script.run` may not complete on unload) | `{ lastEvent, timeSpentMs }` |
| `refinement_requested` | `refineDraftWithAnswers()` called | `{ fieldsRefined }` |

## Analytics Summary

The `computeAnalyticsSummary()` function reads `Analytics_Log` and writes to `Analytics_Summary` with these sections:

### Usage Metrics
- Total submissions: all time, last 7 days, last 30 days
- Unique users: all time, last 30 days
- Submissions by team (breakdown)
- Submissions by product (breakdown)
- Submissions by content type (breakdown)
- Average session duration (generation to submission)
- Abandonment rate (sessions with no `form_submitted`)

### AI Quality Metrics
- Average confidence score by field
- Most-edited fields (ranked by edit frequency — shows where AI is weakest)
- Least-edited fields (ranked — shows where AI is strongest)
- AI generation success rate (completions / total attempts)
- Average generation latency (ms)
- Refinement request rate

### Operational Metrics
- Error rate (API failures / total API attempts)
- Errors by type (extraction failures, Gemini errors, submission errors)
- Average extraction time (ms)
- Average generation time (ms)
- Submissions per day (last 30 days, one row per day)

## Implementation Architecture

### New Functions in Code.js

#### `getAnalyticsSpreadsheet_()`
- Checks Script Properties for `ANALYTICS_SPREADSHEET_ID`
- If not found, creates a new spreadsheet via `SpreadsheetApp.create('Arcade Intake Analytics')`
- Stores the new spreadsheet's ID in Script Properties
- Logs the URL on creation: `Logger.log('Analytics spreadsheet created: ' + ss.getUrl())`
- Returns the spreadsheet object

#### `logAnalyticsEvent_(eventType, data)`
- Core logging function — appends one row to `Analytics_Log`
- `data` object contains: `sessionId`, `userEmail`, `arcadeId`, `durationMs`, `status`, `metadata`
- Wrapped in `try/catch` — analytics failures must never break the main application flow
- Creates the `Analytics_Log` sheet with headers if it doesn't exist on first call

#### `computeAnalyticsSummary()`
- Reads all rows from `Analytics_Log`
- Computes all metrics described in the Analytics Summary section above
- Clears and rewrites the `Analytics_Summary` sheet with formatted sections
- Can be run manually from the Apps Script editor or via a time-driven trigger
- Returns a summary object for programmatic use

#### `getAnalyticsSummary()`
- Callable from the frontend (future in-app dashboard)
- Returns the latest summary as a JSON object
- Calls `computeAnalyticsSummary()` if `Analytics_Summary` is empty

### Integration Points in Existing Code

| Existing Function | Analytics Added |
|-------------------|-----------------|
| `doGet()` | Log `session_start` |
| `extractGuideContent()` | Log `guide_extraction_start` at entry, `guide_extraction_complete` on success |
| `generateDraftFromGuide()` | Log `ai_generation_start` at entry, `ai_generation_complete` on success, `ai_generation_error` on failure |
| `refineDraftWithAnswers()` | Log `refinement_requested` |
| `submitIntakeForReview()` | Log `form_submitted` with edit stats from the payload |

### Frontend Changes (Index.html)

- Generate `sessionId` via `crypto.randomUUID()` (with `Math.random()` fallback) on page load
- Pass `sessionId` with every `google.script.run` call (added to payloads)
- Track edited fields client-side: maintain a `Set` of field names that the user modifies after AI generation
- Send `editedFields` array with the submission payload (batched, not per-keystroke)
- `beforeunload` listener: if no submission occurred, call `google.script.run.logAnalyticsEvent_('session_abandoned', ...)` as a best-effort beacon

### Key Design Decisions

1. **Analytics never break the app** — every `logAnalyticsEvent_()` call is wrapped in `try/catch`. If the analytics spreadsheet is inaccessible, the intake form continues working normally.
2. **Separate spreadsheet** — analytics data lives in its own auto-created spreadsheet, keeping `Creator_Form_Raw` clean.
3. **Batched field edits** — field edit tracking collects a Set of edited field names client-side and sends them once at submission time, not per-keystroke. This avoids excessive API calls.
4. **Session ID from client** — generated client-side to correlate events across multiple server calls within one form session.
5. **On-demand summary** — `computeAnalyticsSummary()` is run manually or via trigger, not on every event. This keeps logging fast and summary computation separate.

## Out of Scope

- Local Express MVP analytics (future work)
- In-app analytics dashboard UI (future — `getAnalyticsSummary()` is ready for it)
- Automated alerting on error spikes
- Data archival / rotation for the raw log
