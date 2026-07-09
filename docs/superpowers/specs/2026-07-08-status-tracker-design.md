# Status Tracker for Interactive Demo Submissions

## Overview

A status tracking system that lets creators and requestors see where their interactive demo submissions are in the review pipeline, with email notifications at key milestones. The status page lives inside the Intake app. Email notifications are sent from Finder (where status transitions happen).

**Terminology rule:** Never use "Arcade" in user-facing text. Always refer to submissions as "interactive demo" or "interactive experience."

## Audience

- **Creators**: People who submit interactive demos through the Intake app
- **Requestors**: People who request demos to be made via the Request Form

Both should be able to track status and receive emails.

## Architecture (Approach A: Intake-Only)

```
Intake App                          Finder App
┌─────────────────────┐             ┌──────────────────────────┐
│ doGet(?page=status)  │             │ processStatusWorkflow()  │
│ StatusTracker.html   │──reads──▶   │   + email notification   │
│ getSubmissionStatus()│  Master     │   on status transitions  │
│ getMySubmissions()   │  Sheet      │                          │
└─────────────────────┘             └──────────────────────────┘
```

- **Status page**: New route in Intake's `doGet()`, served from `StatusTracker.html`
- **Email sending**: Added to Finder's `RM_Workflow.js` `processStatusWorkflow()`, alongside existing Slack notifications
- **Data source**: Intake reads `Request_Master` from the shared Master Spreadsheet (read-only, same pattern as Lifecycle)
- **Sender address**: `interactive-experiences@redhat.com` (Gmail alias on deploying account)

## Data Model

### New Column in `Creator_Form_Raw`

| Column | Value | Purpose |
|--------|-------|---------|
| `Tracking Token` | UUID | Unique identifier for status lookup |

Generated in `submitIntakeForReview()` at submission time. Passed through the webhook to Finder so it can be stored in `Request_Master` too (needed for email links).

### New Column in `Request_Master`

| Column | Value | Purpose |
|--------|-------|---------|
| `Tracking Token` | UUID (from Intake) | Links back to status page |
| `Email Open Sent` | Checkmark | Prevents duplicate email |
| `Email Approved Sent` | Checkmark | Prevents duplicate email |
| `Email Published Sent` | Checkmark | Prevents duplicate email |
| `Email Closed Sent` | Checkmark | Prevents duplicate email |

The "sent?" columns follow the same pattern as existing Slack notification flags (e.g., `Approved sent?`, `Received sent?`).

## Status Page

### Access Methods

1. **By token**: `?page=status&token=<uuid>` — shows a single submission card, no login needed
2. **By login**: `?page=status` — uses `Session.getActiveUser()` email to look up all submissions where `Creator Email` or `Requestor Email` matches

### Entry Points

- **Success screen**: After submitting in Intake, show a "Track your submission" link
- **Email notifications**: Each email includes a link to `?page=status` (the full My Submissions view)

### Server-Side Functions (Intake `Code.js`)

| Function | Purpose |
|----------|---------|
| `getSubmissionStatus(token)` | Returns single submission data by tracking token |
| `getMySubmissions()` | Returns all submissions for the logged-in user's email |

Both read from `Request_Master` in the Master Spreadsheet (read-only). Uses `SpreadsheetApp.openById()` with the existing `MASTER_SPREADSHEET_ID` script property.

### Columns Displayed

| Column | Source (`Request_Master`) |
|--------|--------------------------|
| Demo title | `Final Demo Title` or `Suggested Demo Title` |
| Current status | `Status` |
| Date submitted | `Status Received Timestamp` |
| Primary Product | `Primary Product` |
| Content Type | `Final Content Type` or `Content Type` |
| Creator Name | `Creator Name` |
| Requestor Name | `Requestor Name` |
| Creation Link | `Creation Link` |
| Drupal Page URL | `Public Site Link` (or `RHAC Page`) |
| Published date | `Status Published Timestamp` |

### UI Design

**Logged-in view (`?page=status`)**: A simple card list of all submissions, sorted most recent first. Each card shows demo title, current status, date submitted, and primary product. Click to expand and see full details.

**Token view (`?page=status&token=xxx`)**: Single submission detail card with all columns above.

**Future expansion considerations** (not built now):
- `lifecycle_recommendation` and `quality_grade` fields can be added to the detail view later
- A "Feedback" or "Edit" tab can be added to the detail card in a follow-up project
- Comment/rating from Lifecycle review can surface here when ready

### Navigation

- From main Intake form: link/tab to "Check Status"
- From status page: "Submit another" link back to main form
- From success screen: **"Submit Another"** (resets form, no email yet) and **"Finish"** (sends batched email, shows status page link)

## Email Notifications

### Submission Batching (IE Received)

Creators often submit multiple demos in one session. Instead of sending a separate email per submission, the Intake app batches them:

1. After submitting, the success screen shows **"Submit Another"** and **"Finish"**
2. **"Submit Another"** resets the form for the next demo — no email sent yet
3. **"Finish"** triggers one combined email covering all submissions from that session

The batched email is sent directly from the **Intake app** (not Finder), since this is a submission-time event. Intake already tracks the session via `analyticsSessionId` and knows all submissions in the current session.

Example batched email:
> **Subject:** "Your interactive demo submissions have been received"
>
> You submitted 3 interactive demos:
> - Demo Title A
> - Demo Title B
> - Demo Title C
>
> Track their status: [View My Submissions]

For single submissions, the email simply says "Your interactive demo submission has been received" with the demo title.

### Status Change Emails (from Finder)

Later status transitions are emailed individually from Finder's `processStatusWorkflow()` in `RM_Workflow.js`, since those happen one-at-a-time as statuses change in the sheet.

| Status Change | Email To | Subject Line |
|---------------|----------|-------------|
| Request Open | Requestor | "Your interactive demo request has been received" |
| Request Approved | Requestor | "Your interactive demo request has been approved" |
| IE Published | Creator + Requestor (if exists) | "Your interactive demo is now live" |
| Closed | Requestor + Creator (if exists) | "Your interactive demo request has been closed" |

Note: IE Received is handled by the Intake batching above, not by Finder.

### Email Content

Each email includes:
- Demo title(s)
- Current status with a human-friendly message
- Link to the status page: `https://<intake-app-url>?page=status`
- For IE Published: include the Drupal Page URL directly so they can visit the live page

### Sending Infrastructure

- **Method**: `GmailApp.sendEmail()` with `from` option set to alias
- **Sender**: `interactive-experiences@redhat.com` (Gmail alias on deploying account)
- **Duplicate prevention**: "Email X Sent" columns in `Request_Master` (same pattern as Slack "sent?" flags)
- **Email addresses**: Read from `Creator Email` and `Requestor Email` columns in `Request_Master`

### Prerequisite

Add `interactive-experiences@redhat.com` as a sending alias in the deploying Google account's Gmail settings (Settings > Accounts > Send mail as).

## Changes By File

### Intake App (`arcade-intake-app/`)

| File | Changes |
|------|---------|
| `Code.js` | Generate tracking token in `submitIntakeForReview()`. Add `getSubmissionStatus(token)` and `getMySubmissions()` functions. Update `doGet()` to route `?page=status`. Pass tracking token through webhook payload. Add `sendBatchedSubmissionEmail(sessionSubmissions)` to send one combined email when creator clicks "Finish". |
| `Index.html` | Replace current success screen with **"Submit Another"** and **"Finish"** buttons. Track session submissions in JS array. "Finish" calls `sendBatchedSubmissionEmail()` then shows status page link. Add "Check Status" navigation link. |
| `StatusTracker.html` | **New file.** Status page with My Submissions list view and single submission detail view. CSS consistent with existing Intake app styling. |

### Finder App (`Arcade Finder/`)

| File | Changes |
|------|---------|
| `RM_Workflow.js` | Add `sendStatusEmail_()` helper. Call it from `processStatusWorkflow()` at Request Open, Request Approved, IE Published, and Closed transitions. Add duplicate-prevention logic using "Email X Sent" columns. (IE Received email is handled by Intake's batching, not here.) |
| `RM_Config.js` | Add email-related column name constants. Add sender alias config. |
| `RM_CreatorIntake.js` | Read tracking token from webhook payload and store in `Request_Master` during `onCreatorFormSubmit()`. |

### Master Spreadsheet

| Sheet | Changes |
|-------|---------|
| `Creator_Form_Raw` | Add `Tracking Token` column |
| `Request_Master` | Add `Tracking Token` column. Add 5 email "sent?" columns. |

## Implementation Phases

### Phase 1: Status Page (build first)
- Status page (read-only) in Intake app
- Tracking token generation and storage
- My Submissions view (logged-in) and single-token view
- "Submit Another" / "Finish" flow on success screen
- "Check Status" navigation link

### Phase 2: Email Notifications (build later)
- Batched submission email from Intake on "Finish"
- Status change emails from Finder (Request Open, Approved, Published, Closed)
- Gmail alias setup for `interactive-experiences@redhat.com`
- Email "sent?" columns in `Request_Master`

### Out of scope (future projects)
- Editing submissions from the status page
- Lifecycle ratings/comments surfaced on the status page
- Creator feedback or rating system
- Push notifications (Slack DM, etc.)
