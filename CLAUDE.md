# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Project Overview

Arcade Intake Assistant is an internal Red Hat tool that runs as a Google Apps Script web app. Creators paste an Arcade demo share URL, the app extracts guide content (steps, screenshots, links, duration), sends it to Gemini 2.5 Flash for AI-assisted metadata generation, and the creator reviews and submits the result to the `Creator_Form_Raw` sheet.

This is a Google Apps Script project. Do not modernize it into Node, React, Express, or REST API. Preserve Apps Script compatibility and make small, targeted changes.

## Development Workflow

The project uses `clasp` for local editing and deployment:

```bash
clasp push         # sync local files to Apps Script
clasp pull         # pull remote changes locally
clasp deploy       # publish a new deployment version
clasp open         # open in Apps Script editor
clasp status       # see tracked/untracked files
```

Clasp uses `.js` extensions (not `.gs`). The `.clasp.json` links this folder to the Apps Script project. There is no CI/CD pipeline — deploy with `clasp push`.

## Architecture

### Deployed to Apps Script

| File | Purpose |
|------|---------|
| `Code.js` | Web app entry points, intake form processing, analytics, workflow queue, backfill utilities |
| `IA_Config.js` | Constants, FIELD_OPTIONS, STATUS_TRACKER_COLUMNS, CTA catalog, config helpers |
| `IA_Gemini.js` | Gemini API integration, guide extraction, prompt building, JSON parsing |
| `IA_StatusTracker.js` | Status tracker data endpoints, review queue, submission building |
| `Index.html` | Intake form frontend |
| `StatusTracker.html` | Status tracker frontend |

### Local Verification (excluded via .claspignore)

| File | Purpose |
|------|---------|
| `tests/` | Deterministic schema tests, Playwright smoke tests, test fixtures |
| `package.json` | npm test scripts for local verification |

## Google Apps Script Constraints

Preserve compatibility with these services:

* `HtmlService`, `SpreadsheetApp`, `PropertiesService`, `Session`, `Utilities`, `DriveApp`
* `google.script.run` on the frontend (do not replace with `fetch()` or API routes)
* `UrlFetchApp` for Gemini API calls, guide page fetching, and webhook triggers

All server-side Apps Script files (Code.js, IA_Config.js, IA_Gemini.js, IA_StatusTracker.js) share a single project/global namespace. Constants and functions defined in one file are accessible in others without imports. Avoid duplicate top-level declarations — name collisions will silently shadow each other.

## Server and Client Communication

The frontend calls server-side functions through:

```js
google.script.run
  .withSuccessHandler(...)
  .withFailureHandler(...)
  .functionName(...);
```

Public functions have no trailing underscore. Private helpers use a trailing underscore by convention.

Key public server functions:

| Function | Purpose |
|----------|---------|
| `doGet()` | Serves `Index.html` as a web app |
| `getUserEmail()` | Returns the active user's email |
| `getOptions()` | Returns FIELD_OPTIONS for form dropdowns |
| `extractGuideContent(payload)` | Fetches and parses an Arcade guide page |
| `generateDraftFromGuide(payload)` | Sends extracted guide to Gemini, returns AI metadata draft with confidence scores |
| `refineDraftWithAnswers(payload)` | Re-prompts Gemini with creator's follow-up answers |
| `submitIntakeForReview(payload)` | Saves submission to `Creator_Form_Raw` sheet and queues webhook |
| `logAnalyticsEventFromClient(type, data)` | Logs analytics events from the frontend |
| `getAnalyticsSummary()` | Returns computed analytics summary |

## Data Flow

1. Creator pastes Arcade share URL → `extractGuideContent()` fetches and parses guide HTML
2. Extracted content (steps, images, links, duration) → `generateDraftFromGuide()` sends to Gemini via `buildMetadataPrompt()`
3. Gemini returns metadata draft with per-field confidence scores (high/medium/low) → frontend renders with color-coded confidence
4. Creator reviews, edits, answers follow-up questions → optional `refineDraftWithAnswers()` for AI refinement
5. Submit → `submitIntakeForReview()` → `saveSubmissionToSheet_()` writes to `Creator_Form_Raw` tab
6. Async: `processPendingWorkflowRows()` (1-min trigger) POSTs to Arcade Finder's `doPost` webhook handler

## Spreadsheets

| Spreadsheet | Script Property | Tabs Used |
|-------------|-----------------|-----------|
| Master (shared with Finder + Lifecycle) | `MASTER_SPREADSHEET_ID` | `Creator_Form_Raw` (write), `Request_Master` (backfill read/write) |
| Analytics (Intake only) | `ANALYTICS_SPREADSHEET_ID` | `Analytics_Log`, `Analytics_Summary` |

## Script Properties

Set in Apps Script editor > Project Settings > Script Properties:

| Property | Purpose |
|----------|---------|
| `GEMINI_API_KEY` | API key for Gemini 2.5 Flash |
| `MASTER_SPREADSHEET_ID` | Shared spreadsheet ID (optional if script is bound to it) |
| `ANALYTICS_SPREADSHEET_ID` | Auto-created on first analytics event |
| `WORKFLOW_WEBHOOK_URL` | URL of Arcade Finder's doPost webhook |
| `AI_WORKFLOW_SECRET` | Shared secret for webhook authentication |

## Cross-App Integration

This app is one of three in the Arcade ecosystem:

| App | Location | Role |
|-----|----------|------|
| **Intake** (this project) | `/Users/rubyyang/arcade-intake-app/` | AI-assisted metadata intake form |
| **Finder** | `/Users/rubyyang/Arcade Finder/` | Discovery web app + request management backend |
| **Lifecycle Management** | `/Users/rubyyang/Arcade-Lifecycle-Management/` | Lifecycle scoring + review workflow |

All three share the same Master Spreadsheet. Communication:
- Intake → Finder: HTTP webhook POST to `WORKFLOW_WEBHOOK_URL` with `AI_WORKFLOW_SECRET` auth. Sends `{secret, sheetName, rowIndex}`. Finder's `RM_CreatorIntake.js` handles via `doPost`.
- No code imports between apps — communication is via spreadsheet and webhook only.

## Configuration

`FIELD_OPTIONS` (in `IA_Config.js`) — hardcoded product lists, TDPs, sales tactics, marketing programs, content types, quarters, languages, verticals, events. This is the canonical source within the Intake app.

`CTA_LINK_CATALOG` (in `IA_Config.js`) — allowed call-to-action links with URL templates and descriptions.

`FOLLOW_UP_QUESTIONS` (in `IA_Config.js`) — clarification questions the AI can ask the creator.

## Analytics

Events log to a separate Analytics spreadsheet via `logAnalyticsEvent_()`. Always wrapped in try/catch so failures never break the main flow. An hourly trigger (`installAnalyticsSummaryTrigger()`) computes summary metrics.

The frontend tracks which fields the creator edits after AI generation using a session ID, sent at submission time.

## High-Risk Changes

Explain impact before editing any of these:

* `doGet()` or the served HTML filename
* `buildMetadataPrompt()` — affects all AI output quality
* `FIELD_OPTIONS` — must stay in sync with what Finder expects in `Request_Master`
* `saveSubmissionToSheet_()` — column mapping to `Creator_Form_Raw`
* `triggerOldCreatorWorkflow_()` — webhook contract with Finder
* `google.script.run` calls or public function signatures
* Analytics event names or schema
* Workflow trigger logic (`processPendingWorkflowRows`)

## Verification

**See AGENTS.md for the complete verification protocol.**

**Automated tests:**
- Local deterministic tests: `npm test` (schema validation, Gemini parsing, config integrity)
- Read-only smoke tests: `npm run test:smoke` (post-deploy health checks)

**Manual verification (required):**
1. `clasp push` to deploy
2. Open the web app and test: paste URL → extract → generate → review → submit
3. Check `Creator_Form_Raw` for the new row
4. Check `Analytics_Log` for session events
5. For webhook changes: verify the workflow trigger fires and Finder processes it

**Staging:** Not implemented yet. See `docs/superpowers/specs/staging-requirements.md` for Phase 2 setup.

## Style Conventions

* Public Apps Script functions: no trailing underscore
* Private helpers: trailing underscore (e.g., `fetchGuideContent_()`)
* V8 runtime — use `const`/`let` (not `var`, though some legacy `var` remains)
* Single-file HTML structure for the frontend
* Escape user-visible dynamic HTML before DOM insertion
