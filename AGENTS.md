# AGENTS.MD — Agent Verification Protocol

This file defines what Claude Code can verify autonomously and what requires human verification.

**Read CLAUDE.md first** — it contains the detailed project architecture, constraints, and high-risk changes. This file is a thin workflow guide only.

---
## DEFAULT WORKING FLOW

Use this workflow for implementation tasks. Scale the depth to the risk and
scope of the change. Do not create unnecessary planning artifacts for trivial
changes.

### 1. CONTEXT

Before editing:

- Read `CLAUDE.md`
- Read relevant source-of-truth docs
- Inspect the affected code and existing behavior
- Check current git status / branch

### 2. IMPACT

Before changing anything beyond a trivial edit, identify:

- What must change
- What must remain unchanged
- Which files/components are affected
- Whether there are downstream or cross-app dependencies
- Which assumptions are uncertain

Do not silently guess business semantics. Ask for human input only when the
answer cannot be derived from code/docs and requires a business or ownership
decision.

### 3. PLAN

For non-trivial changes, state briefly:

- Files expected to change
- Intended behavior
- Verification to run
- Anything requiring human verification

Keep the plan proportional to the task. Small changes do not need a separate
plan document.

### 4. BUILD

Implement only the agreed scope.

Do not perform unrelated cleanup, refactoring, or architecture changes unless
they are required to complete the task safely.

### 5. VERIFY

Run all applicable deterministic checks first.

Follow the detailed verification rules below.

Never claim verification for behavior that was not actually exercised.

### 6. REVIEW

Always inspect the final git diff for unintended changes.

Use an independent reviewer only when the change is high-risk, cross-system,
semantic, or difficult to validate deterministically.

Examples:
- shared field / schema changes
- AI prompt behavior changes
- cross-app contracts
- major workflow changes
- security-sensitive changes

### 7. EVIDENCE

Before declaring completion, report:

- Files changed
- Checks/tests actually run
- Pass/fail results
- What was NOT verified
- Remaining human verification, if any

Prefer evidence over statements such as "looks correct" or "should work."

### 8. STOP

Stop when the requested change is complete and adequately verified.

If unrelated issues are discovered:

- Report them as follow-up items
- Do not expand the current task unless they block correctness or safety


## VERIFICATION WORKFLOW

### 1. Claude Runs Automatically (No Human Needed)

**Before making changes:**
- Read CLAUDE.md for context and constraints
- Check git status (uncommitted files, current branch)
- Identify what verification is needed based on change type

**After making changes:**
- ✅ **Syntax validation** — Read all modified files, check for syntax errors
- ✅ **Schema validation** — Run `npm test` (local deterministic tests)
  - FIELD_OPTIONS structure
  - Column mapping references
  - Gemini JSON parsing (fixture)
  - Guide extraction format (fixture)
  - CTA link catalog format
- ✅ **CLAUDE.md compliance** — Verify high-risk changes are documented
- ✅ **Git state** — Verify no unintended file changes

**Commit preparation:**
- Claude prepares commit with checklist:
  ```
  ✓ Syntax valid
  ✓ Schema tests pass (npm test)
  ✓ CLAUDE.md updated (if architecture/constraints changed)
  ⏳ Smoke tests (human: npm run test:smoke)
  ⏳ Manual verification (human: see checklist below)
  ```

---

### 2. Human Runs on Request

**Authenticated /dev smoke tests (read-only):**
```bash
# One-time setup: authenticate with Red Hat SSO and save persistent profile
export INTAKE_WEB_APP_URL="https://script.google.com/a/macros/redhat.com/s/YOUR_DEPLOYMENT_ID/dev"
npm run test:auth-setup
# Browser opens → manually complete SSO/MFA → script auto-detects when app loads

# Run Playwright smoke tests (reuses saved authentication)
npm run test:smoke
```

**IMPORTANT:** Smoke tests verify the /dev Apps Script deployment (pre-production) is healthy. They do NOT validate new code before deploy. Run `npm test` for local deterministic regression checks.

**Manual verification checklist (context-specific):**

| Change Type | Verification Steps |
|-------------|--------------------|
| **UI changes (Index.html, StatusTracker.html)** | • `clasp push` to deploy to /dev<br>• `npm run test:smoke` to verify renders without errors<br>• Open /dev app in browser manually<br>• Test specific UI change interactively<br>• Verify form renders, no visual regressions<br>• Test in Chrome/Firefox/Safari if major change |
| **Backend logic (Code.js, IA_Gemini.js, IA_StatusTracker.js)** | • `clasp push` to deploy to /dev<br>• `npm run test:smoke` to verify pages load<br>• Open /dev app in browser<br>• Test full flow: paste URL → extract → generate → review<br>• Verify AI output quality (metadata suggestions accurate)<br>• Check spreadsheet tabs for correct writes |
| **AI prompt changes (buildMetadataPrompt)** | • `clasp push` to deploy to /dev<br>• Test with 3-5 diverse Arcade URLs<br>• Compare AI output quality before/after<br>• Verify field confidence scores reasonable<br>• Check for hallucinations or format regressions |
| **Field/column changes (FIELD_OPTIONS, STATUS_TRACKER_COLUMNS)** | • Verify CLAUDE.md "High-Risk Changes" section updated<br>• `clasp push` and `npm run test:smoke`<br>• Test form dropdown renders new options in browser<br>• Submit test form, verify spreadsheet write<br>• **Cross-repo coordination:** Notify Finder/Lifecycle teams if shared columns changed |
| **Config changes (IA_Config.js)** | • Verify schema tests pass (`npm test`)<br>• `clasp push` and `npm run test:smoke`<br>• Test affected UI/backend flows in browser<br>• Verify no syntax errors in Apps Script |
| **Analytics changes** | • `clasp push` to deploy to /dev<br>• Submit test form in browser<br>• Check Analytics_Log tab for events<br>• Verify event schema matches expectations |

---

## WHAT CLAUDE CAN VERIFY

### Automated Tests

**`npm test`** — Local deterministic regression tests:
- ✅ FIELD_OPTIONS structure validation
- ✅ Column mapping references
- ✅ Gemini JSON parsing (fixture-based)
- ✅ Guide extraction format validation (stored output shape)
- ✅ CTA link catalog format

**`npm run test:smoke`** — Authenticated Chromium smoke tests against Apps Script /dev:
- ✅ Intake page title rendered
- ✅ Intake heading "Interactive Experience Intake" visible
- ✅ "Extract Content" button visible
- ✅ Status Tracker page title rendered
- ✅ Status Tracker heading visible
- ✅ Valid final table/status state (not stuck in loading)
- ✅ No console errors
- ✅ No uncaught page errors

**Smoke test limitations:**
- Chromium only (not Firefox/WebKit)
- Read-only verification (no button clicks, form submission)
- Does NOT verify: Gemini API calls, spreadsheet writes, webhook triggers, data accuracy, visual appearance, or cross-browser behavior
- Requires initial setup: `npm run test:auth-setup` (only needed once or when auth expires)
- Uses local persistent profile: `playwright/.profile/` (gitignored)

**Manual inspection:**
- ✅ Syntax errors — Read all files
- ✅ Git state — Uncommitted files, branch, diff
- ✅ CLAUDE.md compliance — High-risk changes documented

**Test Scope Limitations:**
- **Gemini parsing tests** use hand-crafted fixture, not real Gemini responses
- **Guide extraction tests** validate stored output shape, not extraction parser logic
- **Smoke tests** verify UI renders but not interactive workflows
- Real API quality testing requires staging + live calls (Phase 2+)  

---

## WHAT REQUIRES HUMAN VERIFICATION

⏳ **UI rendering** — Visual correctness, responsive design, cross-browser  
⏳ **AI output quality** — Gemini suggestions accuracy, prompt effectiveness  
⏳ **Spreadsheet writes** — Data landed in correct columns with correct values  
⏳ **Webhook integration** — Finder received and processed payload  
⏳ **Analytics integrity** — Events logging correctly with valid schema  
⏳ **Security** — XSS, formula injection, secret handling  
⏳ **Cross-app coordination** — Finder/Lifecycle integration impacts  

---

## STAGING REQUIREMENTS

**When staging is required (Phase 2+):**
- Before any test that writes to spreadsheets
- Before any test that sends webhooks to Finder
- Before any test that calls Gemini API at scale
- Before automated submission/approval flow tests

**Staging setup decision documented in:** `docs/superpowers/specs/staging-requirements.md`

**Phase 1 scope:** Local deterministic tests + read-only smoke tests only. No staging needed yet.

---

## FALSE CONFIDENCE RISKS

**Where Claude should NOT claim verification:**

❌ **"Gemini prompt change verified"** — Claude can run fixture tests but cannot verify real AI output quality without calling Gemini  
❌ **"UI change verified"** — Claude cannot render the page to verify visual correctness  
❌ **"Spreadsheet write verified"** — Claude cannot read the actual spreadsheet to verify data integrity  
❌ **"Webhook verified"** — Claude cannot verify Finder received and processed the payload  
❌ **"Pre-deploy smoke test passed"** — Smoke tests run against deployed app, not new code  

**Correct phrasing:**
- ✅ "Schema tests pass (fixture-based)"
- ✅ "Syntax valid, no errors found"
- ✅ "Post-deploy smoke tests can verify deployment health (human to run)"
- ✅ "Manual verification required: [specific checklist items]"

---

## FIELD CONTRACT AUTHORITY

**Within Intake app:**
- `FIELD_OPTIONS` in `IA_Config.js` is authoritative for dropdown values
- `STATUS_TRACKER_COLUMNS` in `IA_Config.js` is authoritative for column names

**Cross-repository:**
- ❌ Do NOT assume IA_Config.js is canonical taxonomy for Finder or Lifecycle
- ⏳ Cross-repo field contract is unresolved (Phase 2+ work)
- ⏳ When changing shared fields, coordinate with Finder/Lifecycle teams manually

---

## DEPLOYMENT WORKFLOW

1. **Claude makes changes** → runs `npm test` → prepares commit
2. **Human reviews commit** → merges to main (if approved)
3. **Human deploys to /dev:** `clasp push`
4. **Human runs smoke tests:** `npm run test:smoke` (verify /dev deployment)
5. **Human runs manual verification:** Context-specific checklist above
6. **Human deploys to production:** `clasp deploy` (versioned /exec deployment)
7. **Monitor:** Check Analytics_Log for errors (first 24h after production deploy)

---

## COMMANDS REFERENCE

```bash
# Local deterministic tests (Claude can run)
npm test

# Read-only smoke tests (human runs post-deploy)
export INTAKE_WEB_APP_URL="https://script.google.com/macros/s/YOUR_ID/exec"
npm run test:smoke

# Deploy to production
clasp push

# Open Apps Script editor
clasp open
```

---

**Last updated:** 2026-08-31 (Phase 1 implementation)
