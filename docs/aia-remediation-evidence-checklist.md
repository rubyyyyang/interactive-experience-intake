# AIA Remediation Evidence Checklist

**Application:** Arcade Intake Assistant  
**Remediation Date:** 2026-08-31  
**Reviewer:** TBD (provide to AIA reviewer)

---

## Instructions for Evidence Collection

After deployment to production, collect the following screenshots and documentation links. Provide this checklist and all evidence files to the AIA reviewer.

---

## 1. AI-Generated Content Labeling

**Requirement:** Clear label near the Gemini-generated metadata section stating "AI-generated draft"

**Evidence Type:** Screenshot

**How to capture:**
1. Open the Arcade Intake Assistant production web app
2. Paste an Arcade demo URL (e.g., any demo from `https://interact.redhat.com/share/...`)
3. Click "Extract Content"
4. Click "Generate Draft"
5. Wait for the form section to appear (section "3. Review and submit")
6. Take a full-page screenshot showing:
   - The blue banner with "AI-generated draft" heading
   - The text "Always review AI generated content prior to use"
   - At least a few of the AI-generated form fields visible below the banner

**Screenshot filename:** `evidence-1-ai-generated-label.png`

**Verification checklist:**
- [ ] "AI-generated draft" text is clearly visible
- [ ] Banner appears immediately when form section loads (before user scrolls)
- [ ] Text is distinguishable from other UI elements (blue background)

---

## 2. Persistent Human-Review Disclaimer

**Requirement:** Persistent notice with text "Always review AI generated content prior to use" that remains visible during the workflow

**Evidence Type:** Screenshot (same as #1, demonstrates persistence)

**How to capture:**
1. Continue from the previous screenshot
2. Scroll down to show form fields
3. Scroll back up to confirm the disclaimer is still visible
4. Take a screenshot showing the disclaimer remains persistent (not a dismissible popup)

**Screenshot filename:** `evidence-2-persistent-disclaimer.png`

**Verification checklist:**
- [ ] Disclaimer is not a temporary popup (remains visible)
- [ ] Disclaimer does not auto-hide after a timeout
- [ ] Disclaimer is visible throughout the "Review and submit" section

**Note:** The disclaimer is the same as the "AI-generated draft" banner — this demonstrates both requirements #1 and #2 in a single UI element.

---

## 3. User Guide Link

**Requirement:** Easily visible "User Guide" link in the app

**Evidence Type:** Screenshot + Link to User Guide document

**How to capture:**
1. Open the Arcade Intake Assistant production web app
2. Take a screenshot showing the header area with:
   - "User Guide" link visible in the top-right navigation area
   - Link is next to "Give feedback" and "Need help?" links
3. Click the "User Guide" link
4. Verify it opens the Google Doc in a new tab
5. Take a screenshot of the User Guide Google Doc (first page)

**Screenshot filenames:**
- `evidence-3a-user-guide-link.png` (header with link visible)
- `evidence-3b-user-guide-page.png` (User Guide Google Doc)

**Document link:**
- **Canonical User Guide (Google Doc):** https://docs.google.com/document/d/15NOQvsdNdalxsxmmFEKPeCaH9khH1Um7uMjzsjqZf3Y/edit?tab=t.0
- Developer reference (Markdown): `/Users/rubyyang/arcade-intake-app/docs/user-guide.md`

**Verification checklist:**
- [ ] "User Guide" link is visible without scrolling (in header)
- [ ] Link is clickable and opens in a new tab
- [ ] User Guide document covers all required topics (see #4 below)

---

## 4. User Guide Content

**Requirement:** User Guide must cover:
- What Arcade Intake Assistant does
- That it uses AI/Gemini
- How to use the tool
- Example use case
- That AI output may be inaccurate
- How users can edit, replace, or ignore generated values
- That human review is required before submission/use
- That users should not intentionally submit confidential information, customer data, credentials, or sensitive personal information
- Support/contact information
- How to provide feedback
- A note that Red Hat guidelines for acceptable use of AI-generated content apply

**Evidence Type:** Link to User Guide document (same as #3)

**Verification checklist (review User Guide document):**
- [ ] Section exists: "What is Arcade Intake Assistant?"
- [ ] Mentions use of Google Gemini 2.5 Flash
- [ ] Section exists: "How the Tool Works" (with numbered steps)
- [ ] Section exists: "Example Use Case" (with concrete scenario)
- [ ] Section exists: "AI Output May Be Inaccurate" (explicit warning)
- [ ] Section exists: "How to Use AI-Generated Values" (Accept/Edit/Replace/Ignore)
- [ ] Section exists: "Human Review is Required" (with explicit must-review language)
- [ ] Section exists: "Data Privacy and Sensitive Information" (lists prohibited data types)
- [ ] Section exists: "Support and Contact" (Slack channel link)
- [ ] Section exists: "How to Provide Feedback" (references "Give feedback" link)
- [ ] Section exists: "Red Hat AI Content Guidelines" (mentions compliance requirement)

---

## 5. Give Feedback Link

**Requirement:** Visible "Give feedback" link that allows users to report: which demo/URL, which field was inaccurate, what was wrong, optional comments

**Evidence Type:** Screenshot + description of feedback mechanism

**How to capture:**
1. Open the Arcade Intake Assistant production web app
2. Take a screenshot showing the header area with:
   - "Give feedback" link visible next to "User Guide"
3. Click the "Give feedback" link
4. Take a screenshot of the feedback prompt dialog that appears
5. Verify the prompt asks for:
   - Demo URL (auto-populated if available)
   - Demo Title (auto-populated if available)
   - "What field was inaccurate?"
   - "What was wrong?"
   - "Additional comments"

**Screenshot filenames:**
- `evidence-5a-give-feedback-link.png` (header with link visible)
- `evidence-5b-feedback-dialog.png` (feedback prompt)

**Mechanism description:**
The feedback mechanism uses a browser `prompt()` dialog that:
- Captures feedback text from the user
- Logs feedback to the Analytics spreadsheet via `logAnalyticsEventFromClient('feedback_submitted', ...)`
- Includes demo URL and title if available
- Provides confirmation message to the user

**Verification checklist:**
- [ ] "Give feedback" link is visible in header (both Intake and Status Tracker pages)
- [ ] Clicking link opens a prompt dialog (not navigates to a form)
- [ ] Prompt includes pre-filled demo URL/title if available
- [ ] Prompt asks for field name, issue description, and comments
- [ ] Submitting feedback shows confirmation message

---

## 6. Monitoring Plan

**Requirement:** Document describing how AI output quality will be monitored

**Evidence Type:** Link to monitoring plan document

**Document link:**
- GitHub path: `/Users/rubyyang/arcade-intake-app/docs/ai-monitoring-plan.md`

**Verification checklist (review monitoring plan document):**
- [ ] Defines monitoring scope (which AI-generated fields are monitored)
- [ ] Specifies monitoring schedule (monthly during beta, quarterly after stable)
- [ ] Describes review process (sampling, accuracy metrics, data sources)
- [ ] Lists response actions (when to update prompts, taxonomy, validation)
- [ ] Identifies responsible parties (product owner, admin team)
- [ ] Includes success criteria (accuracy thresholds, trend stability)

---

## 7. Access Control Documentation

**Requirement:** Document current access-control mechanism and annual revalidation plan

**Evidence Type:** Link to access control document + screenshot of Apps Script deployment settings

**Document link:**
- GitHub path: `/Users/rubyyang/arcade-intake-app/docs/access-control.md`

**How to capture Apps Script deployment evidence:**
1. Log into Google Apps Script editor for the Arcade Intake project
2. Navigate to **Deploy → Manage Deployments**
3. Click on the active web app deployment
4. Take a screenshot showing:
   - "Execute as" setting (should be "User accessing the web app")
   - "Who has access" setting (should be "Anyone within Red Hat")
5. **DO NOT include** deployment URLs or Script IDs in the screenshot (redact if necessary)

**Screenshot filename:** `evidence-7-apps-script-deployment.png`

**Verification checklist (review access control document):**
- [ ] Documents current access mechanism (Apps Script deployment + Session.getActiveUser())
- [ ] Explains domain restriction (redhat.com only)
- [ ] Describes spreadsheet-level access control
- [ ] Describes Apps Script editor access control
- [ ] Describes repository access control
- [ ] Defines annual access revalidation process (who, when, how)
- [ ] Lists responsible parties for access reviews

**Verification checklist (review Apps Script deployment screenshot):**
- [ ] "Who has access" is set to "Anyone within Red Hat" (NOT "Anyone with the link")
- [ ] "Execute as" is set to "User accessing the web app"

---

## 8. Additional Evidence (Optional but Recommended)

### Status Tracker Links

**Evidence Type:** Screenshot

**How to capture:**
1. Navigate to the Status Tracker page (`?page=status`)
2. Take a screenshot showing the header with:
   - "User Guide" link visible
   - "Give feedback" link visible
3. Verify both links work on the Status Tracker page

**Screenshot filename:** `evidence-8-status-tracker-links.png`

---

## Evidence Submission Package

**Provide to AIA reviewer:**

1. **Screenshots:**
   - `evidence-1-ai-generated-label.png`
   - `evidence-2-persistent-disclaimer.png` (or note: same as #1)
   - `evidence-3a-user-guide-link.png`
   - `evidence-3b-user-guide-page.png`
   - `evidence-5a-give-feedback-link.png`
   - `evidence-5b-feedback-dialog.png`
   - `evidence-7-apps-script-deployment.png`
   - `evidence-8-status-tracker-links.png` (optional)

2. **Document Links (GitHub or deployed docs):**
   - User Guide: `docs/user-guide.md`
   - Monitoring Plan: `docs/ai-monitoring-plan.md`
   - Access Control: `docs/access-control.md`

3. **This Checklist:**
   - `docs/aia-remediation-evidence-checklist.md`

---

## Review Approval

**Reviewer Name:** ___________________________  
**Review Date:** ___________________________  
**Approval Status:** [ ] Approved  [ ] Needs Revision  
**Comments:**

---

*Checklist created: 2026-08-31*  
*For AIA remediation compliance review*
