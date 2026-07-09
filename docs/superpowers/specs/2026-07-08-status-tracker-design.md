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
| `Email Received Sent` | Checkmark | Prevents duplicate email |
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
- From success screen: "Track your submission" link

## Email Notifications

### Trigger Points

Emails are sent from Finder's `processStatusWorkflow()` in `RM_Workflow.js`, right after the existing Slack notification for each status.

| Status Change | Email To | Subject Line |
|---------------|----------|-------------|
| Request Open | Requestor | "Your interactive demo request has been received" |
| Request Approved | Requestor | "Your interactive demo request has been approved" |
| IE Received | Creator + Requestor (if exists) | "Your interactive demo submission has been received" |
| IE Published | Creator + Requestor (if exists) | "Your interactive demo is now live" |
| Closed | Requestor + Creator (if exists) | "Your interactive demo request has been closed" |

### Email Content

Each email includes:
- Demo title
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
| `Code.js` | Generate tracking token in `submitIntakeForReview()`. Add `getSubmissionStatus(token)` and `getMySubmissions()` functions. Update `doGet()` to route `?page=status`. Pass tracking token through webhook payload. |
| `Index.html` | Add "Track your submission" link to success section. Add "Check Status" navigation link. |
| `StatusTracker.html` | **New file.** Status page with My Submissions list view and single submission detail view. CSS consistent with existing Intake app styling. |

### Finder App (`Arcade Finder/`)

| File | Changes |
|------|---------|
| `RM_Workflow.js` | Add `sendStatusEmail_()` helper. Call it from `processStatusWorkflow()` at Request Open, Request Approved, IE Received, IE Published, and Closed transitions. Add duplicate-prevention logic using "Email X Sent" columns. |
| `RM_Config.js` | Add email-related column name constants. Add sender alias config. |
| `RM_CreatorIntake.js` | Read tracking token from webhook payload and store in `Request_Master` during `onCreatorFormSubmit()`. |

### Master Spreadsheet

| Sheet | Changes |
|-------|---------|
| `Creator_Form_Raw` | Add `Tracking Token` column |
| `Request_Master` | Add `Tracking Token` column. Add 5 email "sent?" columns. |

## Scope Boundaries

### In scope (this project)
- Status page (read-only) in Intake app
- Email notifications from Finder on 5 status transitions
- Tracking token generation and storage
- My Submissions view (logged-in) and single-token view

### Out of scope (future projects)
- Editing submissions from the status page
- Lifecycle ratings/comments surfaced on the status page
- Creator feedback or rating system
- Push notifications (Slack DM, etc.)
