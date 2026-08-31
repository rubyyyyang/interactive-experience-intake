# Staging Environment Requirements

## When Staging Is Required

Staging is required before implementing any tests that:
- Write to spreadsheets (Creator_Form_Raw, Request_Master, Response_Queue)
- Send webhooks to Finder's `doPost` endpoint
- Call Gemini API at scale (>10 requests per test run)
- Test submission → approval → Master update flow end-to-end

**Phase 1 does NOT require staging** — local deterministic tests + read-only smoke tests only.

**Phase 2+ trigger:** First mutation-based test approved for implementation.

---

## Staging Architecture

### Apps Script Project
- **Name:** "Arcade Intake (Staging)"
- **Source:** Copy from production Apps Script project
- **Deployment:** Separate web app URL for E2E tests
- **Configuration:** `.clasp-staging.json` with staging Script ID

### Spreadsheet
- **Name:** "Arcade Master (Test)"
- **Source:** Copy from production Master spreadsheet
- **Data:** Headers only, no production data rows
- **Tabs:** Creator_Form_Raw, Request_Master, Response_Queue (matching production schema)

### Script Properties (Staging-Specific)
| Property | Value |
|----------|-------|
| `MASTER_SPREADSHEET_ID` | Test spreadsheet ID |
| `GEMINI_API_KEY` | Production key (shared quota) or separate test key |
| `WORKFLOW_WEBHOOK_URL` | Mock endpoint or empty (skip webhook) |
| `AI_WORKFLOW_SECRET` | Test value (not production secret) |
| `ANALYTICS_SPREADSHEET_ID` | Omit (let staging auto-create) |

### Playwright Configuration
- **File:** `playwright.config.staging.ts`
- **baseURL:** Staging web app URL from env var `STAGING_WEB_APP_URL`
- **Mutation tests:** Run against staging only, never production

---

## Setup Decision Criteria

**Cost:** Free (Google Workspace quota, no additional cloud services)

**Time:**
- First setup: 2-3 hours (copy project, spreadsheet, configure properties, deploy, test)
- Recreate: <30 minutes (if test data corrupted)

**Maintenance:**
- **Low** — Only recreate if test data corrupted or schema changes
- **Schema sync** — When production columns change, update staging headers manually

**When to recreate:**
- Test data corrupted (bad submissions, failed test state)
- Major schema change (new columns added to production)
- Performance degradation (too many test rows, clear data)

---

## What Staging Enables (Phase 2+)

### Live Integration Tests
- **Guide extraction** — Real Arcade URLs, not fixtures
- **Gemini API** — Real prompt/response, validate AI quality
- **Submission E2E** — Form → spreadsheet write verification
- **Admin approval E2E** — Review queue → Master update verification
- **Webhook delivery** — POST to mock endpoint, verify payload format

### Spreadsheet Verification
- **Column integrity** — Verify STATUS_TRACKER_COLUMNS values match actual headers
- **Write correctness** — Verify data lands in correct columns with correct format
- **Formula validation** — If formulas used, verify they compute correctly

### Regression Testing
- **Field changes** — Verify new options appear in form, write correctly
- **AI prompt changes** — Compare output quality before/after with real Gemini calls
- **Workflow changes** — Verify trigger logic, queue processing

---

## Limitations of Staging

### Cannot Test
- **Cross-app integration** — Staging doesn't connect to real Finder/Lifecycle (requires coordination)
- **Production scale** — Staging has low data volume, can't test performance at scale
- **Real user sessions** — No real creator sessions, can't test SSO/auth edge cases

### Manual Coordination Still Required
- **Finder webhook integration** — Staging webhook goes to mock endpoint, not real Finder
- **Lifecycle queries** — Lifecycle queries production Master, not staging
- **Field taxonomy sync** — Finder/Lifecycle field expectations require manual verification

---

## Phase 2 Implementation Checklist

When staging is needed, follow these steps:

- [ ] Copy production Apps Script project → "Arcade Intake (Staging)"
- [ ] Copy production Master spreadsheet → "Arcade Master (Test)"
- [ ] Clear all data rows, keep headers only
- [ ] Create `.clasp-staging.json` with staging Script ID
- [ ] Configure staging Script Properties (see table above)
- [ ] Deploy staging as web app (Execute as "Me", access "Anyone with link")
- [ ] Create `playwright.config.staging.ts` with staging baseURL
- [ ] Add staging web app URL to `STAGING_WEB_APP_URL` env var
- [ ] Write first mutation test (submission E2E)
- [ ] Run mutation test against staging, verify correctness
- [ ] Document staging URL + spreadsheet ID in CLAUDE.md
- [ ] Add staging deploy/test workflow to AGENTS.md

---

## Staging Workflow (Phase 2+)

```bash
# Deploy to staging
clasp push --project .clasp-staging.json

# Run mutation tests (against staging)
export STAGING_WEB_APP_URL="https://script.google.com/macros/s/STAGING_ID/exec"
npm run test:staging

# If tests pass, deploy to production
clasp push

# Run read-only smoke tests (against production)
export INTAKE_WEB_APP_URL="https://script.google.com/macros/s/PROD_ID/exec"
npm run test:smoke
```

---

**Decision:** Staging NOT implemented in Phase 1. Requirements documented for Phase 2 decision.

**Last updated:** 2026-08-31 (Phase 1)
