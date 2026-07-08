# Collaboration Setup Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Set up the three Arcade Apps Script projects so Claude Code can work on them effectively — with context, safe deployment, and a PR workflow.

**Architecture:** Add CLAUDE.md files (using Finder's as template) and a .env.example. No changes to Apps Script code or Google Sheets. Deployment is via `clasp push`; revert via local git history or `clasp versions`/`clasp deploy`.

**Tech Stack:** Git (local only), clasp, Google Apps Script

## Global Constraints

- Apps Script projects stay as-is — no code changes in this plan
- Google Sheets stay as-is — read-only API access, no writes
- Finder's CLAUDE.md is the quality bar — match its depth and structure
- All three projects on this machine, authenticated via clasp and gcloud

---

### Task 1: Create CLAUDE.md for Intake App

The most impactful single change. Every future Claude Code session starts with this context.

**Files:**
- Create: `/Users/rubyyang/arcade-intake-app/CLAUDE.md`
- Modify: `/Users/rubyyang/arcade-intake-app/.claspignore` (add CLAUDE.md exclusion)

**Interfaces:**
- Consumes: Existing `Code.js` structure, `appsscript.json`, `.clasp.json`
- Produces: CLAUDE.md that future sessions auto-load

- [ ] **Step 1: Write CLAUDE.md**

Model after Finder's CLAUDE.md (`/Users/rubyyang/Arcade Finder/CLAUDE.md`). Must cover:

1. **Project Overview** — what the Intake app does (AI-assisted metadata form for Arcade demos)
2. **Development Workflow** — `clasp push/pull/deploy/open` and local dev server (`cd local-dev && node server.js`)
3. **Architecture table** — `Code.js` (all server logic, 2258 lines), `Index.html` (all frontend, 1530 lines), `local-dev/server.js` (Node mirror, diverged — Code.js is canonical)
4. **Apps Script Constraints** — same as Finder: HtmlService, SpreadsheetApp, google.script.run, global namespace, underscore convention
5. **Data Flow** — URL → extract → Gemini draft → review → submit → Creator_Form_Raw → webhook → Finder
6. **Key Spreadsheets** — Master (`1t7TJtTL...`: `Creator_Form_Raw`, `Request_Master`), Analytics (`1Krzrseza...`: `Analytics_Log`, `Analytics_Summary`)
7. **Script Properties** — GEMINI_API_KEY, MASTER_SPREADSHEET_ID, ANALYTICS_SPREADSHEET_ID, WORKFLOW_WEBHOOK_URL, AI_WORKFLOW_SECRET
8. **Cross-App Integration** — webhook POST to Finder's `doPost` with secret auth, shared Master sheet
9. **Configuration** — FIELD_OPTIONS, CTA_LINK_CATALOG, FOLLOW_UP_QUESTIONS in Code.js
10. **High-Risk Changes** — doGet, buildMetadataPrompt, FIELD_OPTIONS, saveSubmissionToSheet_, triggerOldCreatorWorkflow_, google.script.run signatures, analytics events
11. **Testing** — no automated tests; manual: clasp push → open web app → paste URL → generate → submit → check sheet

- [ ] **Step 2: Add CLAUDE.md to .claspignore**

Append `CLAUDE.md` line to `.claspignore` so it doesn't get pushed to Apps Script.

- [ ] **Step 3: Verify clasp status**

Run: `clasp status`
Expected: CLAUDE.md appears under "Untracked files", not "Tracked files"

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md .claspignore
git commit -m "docs: add CLAUDE.md for Claude Code context"
```

---

### Task 2: Create CLAUDE.md for Lifecycle Management

**Files:**
- Create: `/Users/rubyyang/Arcade-Lifecycle-Management/CLAUDE.md`
- Modify: `/Users/rubyyang/Arcade-Lifecycle-Management/.claspignore` (add CLAUDE.md exclusion if missing)
- Reference: `/Users/rubyyang/Arcade-Lifecycle-Management/docs/Lifecycle_Operations_Guide.md`

**Interfaces:**
- Consumes: Existing code structure, ops guide
- Produces: CLAUDE.md that future sessions auto-load

- [ ] **Step 1: Read ops guide and scan code**

Read `docs/Lifecycle_Operations_Guide.md` and all `.js` files to understand project structure.

- [ ] **Step 2: Write CLAUDE.md**

Same structure as Task 1, tailored to Lifecycle Management:
1. **Project Overview** — lifecycle scoring, review workflow, admin dashboard for Arcade demos
2. **Development Workflow** — clasp commands
3. **Architecture table** — `Code.js`, `RM_LifecycleScoring.js`, `RM_SystemTabs.js`, `RM_ClaudeIntegration.js`, `RM_AdminDashboard.js`, `LifecycleClaudeImportDialog.html`
4. **Data Flow** — reads Master sheet → scores with Claude → writes to Lifecycle spreadsheet (`1FrC6DYL...`)
5. **Spreadsheets** — Lifecycle (`1FrC6DYL...`: 7 tabs), Master (`1t7TJtTL...`: reads `Request_Master`)
6. **Script Properties**
7. **High-Risk Changes**
8. **Reference the existing ops guide** for operational procedures (don't duplicate it)

- [ ] **Step 3: Add CLAUDE.md to .claspignore**

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md .claspignore
git commit -m "docs: add CLAUDE.md for Claude Code context"
```

---

### Task 3: Add .env.example to Intake App

So future sessions know what environment variables the local dev server needs.

**Files:**
- Create: `/Users/rubyyang/arcade-intake-app/.env.example`

- [ ] **Step 1: Create .env.example**

```env
# Local development server configuration
# Copy to .env and fill in values

# Red Hat internal Gemini API endpoint
MODEL_API=https://your-gemini-api-endpoint

# Gemini model ID
MODEL_ID=gemini-2.5-flash

# API key for the Gemini endpoint
USER_KEY=your-api-key-here

# Local server port
PORT=3000
```

- [ ] **Step 2: Commit**

```bash
git add .env.example
git commit -m "docs: add .env.example for local dev setup"
```

---

## Summary: What Changes vs. What Stays

### Changes (this plan)

| What | Where | Why |
|------|-------|-----|
| CLAUDE.md | Intake app, Lifecycle app | Claude Code auto-loads this — provides full project context every session |
| .env.example | Intake app | Documents required env vars for local dev |
| .claspignore update | Intake app, Lifecycle app | Prevents CLAUDE.md from deploying to Apps Script |

### No changes needed

| What | Why it's fine as-is |
|------|---------------------|
| **Apps Script code** | Working in production; architecture changes are a separate plan |
| **Google Sheets** | Structure is good; Claude reads via API, writes via Apps Script runtime |
| **Script Properties** | Already configured correctly in each project |
| **Finder's CLAUDE.md** | Already excellent — 200 lines of thorough guidance |
| **clasp configuration** | All 3 projects connected and authenticated |
| **gcloud auth** | Working — Sheets API reads confirmed |
| **GitHub remotes** | Not needed — deploy via `clasp push`, revert via local git |

## How to Work With Me After This Plan

### Day-to-day workflow
1. **Tell me what to change** — reference a feature, bug, or plan
2. **I edit locally and commit** — local git tracks changes for revert
3. **I `clasp push` to deploy** — changes go live in Apps Script
4. **You verify in the browser** — test the web app, check sheet data
5. **To revert** — `git revert` or `git checkout` the change, then `clasp push` again

### For sheet questions
- Ask me to read any tab by name — I pull it via Sheets API
- For writes: you do it manually, or I write Apps Script code that runs at runtime

### For cross-app changes
- I read both codebases, update receiver (Finder) first, then sender (Intake)
- You verify end-to-end: submit in Intake → check Finder processes it

---

## Verification

After all 3 tasks:
- `clasp status` in Intake and Lifecycle shows CLAUDE.md as untracked (not pushed to Apps Script)
- Start a new Claude Code session in the Intake app — confirm CLAUDE.md loads in context
- `git log` shows clean commits for each change
- Revert test: `git revert HEAD` then `clasp push` — confirm previous version is restored
