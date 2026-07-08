# Form Text UX Review Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every user-facing label, title, placeholder, helper text, and section subtitle on the intake form clear, friendly, and self-explanatory from a creator's perspective.

**Architecture:** Pure text changes across both frontends (Index.html, public/index.html). No logic, layout, or ID changes. Every edit is a string replacement — no JS behavior changes.

**Tech Stack:** HTML (vanilla), Apps Script (clasp push)

## Global Constraints

- Both frontends (Index.html and public/index.html) must stay exactly in sync for every text change.
- No element IDs may change (they are referenced by JS logic, confidence mapping, and submission).
- No structural HTML changes — only text content inside tags.
- All `<label>`, placeholder, helper, subtitle, and heading text is in scope. Button text and validation messages are in scope.
- Required-note `*` markers must remain on the same fields.
- After all tasks, run `npx clasp push` to deploy.

---

## Text Changes Summary

Below is the complete mapping of current → new text. Each task groups related changes by section.

### Page-level text

| Location | Current | New | Why |
|----------|---------|-----|-----|
| `<h1>` | Interactive Demo Intake Assistant | Interactive Demo Intake | Shorter, less robotic |
| `<title>` | Interactive Demo Intake Assistant | Interactive Demo Intake | Match h1 |
| Subtitle `<p>` | Create an intake draft from an interactive demo URL. AI will suggest fields based on the guide content, and you can review everything before submitting. | Paste your demo URL below. AI will pre-fill most fields — you just review and submit. | Shorter, action-oriented, friendlier |
| Sandbox banner | Sandbox pilot notice: Please do not enter sensitive or confidential information. | Pilot mode — please don't enter sensitive or confidential information. | Less formal |

### Section headers & subtitles

| Location | Current | New | Why |
|----------|---------|-----|-----|
| URL section h2 | 1. Enter Interactive Demo URL | 1. Paste your demo URL | Direct action verb, shorter |
| URL helper | Before submitting, please make sure your interactive demo has been moved from your private space to the **Red Hat Workspace**. | Make sure your demo is in the **Red Hat Workspace** (not a private space) before submitting. | Shorter, clearer structure |
| URL label | Interactive Demo URL * | Demo URL * | Redundant — "Interactive" is obvious from context |
| Extract card h2 | 2. Review pulled content | 2. Review extracted content | "Pulled" is dev jargon; "extracted" is clearer |
| Extract card subtitle | AI will use the guide title and step text below to suggest intake fields. Review the content before generating the draft. | AI uses this content to pre-fill your intake. Check that it looks right, then generate the draft. | Simpler, friendlier |
| Form section h2 | 3. Complete AI-assisted intake submission | 3. Review and submit | Much shorter — the rest is obvious |
| Form subtitle | AI-suggested fields are editable. Some fields must be completed by the creator. | AI filled in what it could. Fields marked yellow still need your input. | Plain language |
| Details summary | How this draft was generated | How AI generated this draft | Clearer subject |
| Demo subtitle | Details about the interactive experience | About the demo itself | Shorter |
| Audience subtitle | Who this demo is for and how it fits the sales motion | Target audience and sales alignment | Shorter |
| Publishing subtitle | SEO, links, and discoverability | Search optimization and links | "SEO" is fine for this audience but "discoverability" is vague |
| Creator Details subtitle | Your info and compliance checks | About you | Much shorter — "compliance" is intimidating |
| Success h2 | Submission received | You're all set! | Friendlier |

### Demo section fields

| Location | Current | New | Why |
|----------|---------|-----|-----|
| Label | Final Demo Title * | Title * | "Final Demo" is confusing — is there a non-final one? |
| Label | Description (30-100 words) * | Description * | Word count is shown by the counter below; no need in label |
| Label | Asset Type * | Content type * | "Asset Type" is internal jargon; "Content type" matches dropdown values |
| Helper | Business Intro: 90s or less, non-technical. Technical Walkthrough: around 5 minutes, technical. | Business Intro = under 90 seconds, non-technical. Technical Walkthrough = ~5 minutes, technical. | Clearer formatting |
| Label | Language * | Language(s) * | Plural since multi-select |
| Helper | Hold Command on Mac to select multiple. | Hold Cmd (Mac) or Ctrl (Windows) to select multiple. | Include Windows users |
| Label | Duration | Estimated duration | Clarify it's an estimate |
| Placeholder | e.g. ~3 minutes | e.g., 3 minutes | Drop tilde — it's already labeled "estimated" |
| Label | Primary product featured? * | Primary product * | Remove question mark — it's a dropdown, not a yes/no |
| Placeholder | Enter other primary product | Product name not in the list | Clearer what to type |
| Label | Optional: Other related products? | Other related products | Remove "Optional:" — no asterisk already signals optional |
| Placeholder | Enter other related products | Product name(s) not in the list | Clearer |
| Helper | Hold Command on Mac to select multiple products. | Hold Cmd (Mac) or Ctrl (Windows) to select multiple. | Consistent with Language helper |

### Audience section fields

| Location | Current | New | Why |
|----------|---------|-----|-----|
| Label | Vertical * | Industry vertical * | "Vertical" alone is ambiguous |
| Label | Is this for a specific event or project? * | Event or project * | Shorter, not a question |
| Label | Related Technology Decision Point? * | Technology decision point * | Remove "Related" and "?" — it's a dropdown |
| Label | Related Sales Tactic? * | Sales tactic * | Same cleanup |
| Label | Related Marketing Program? * | Marketing program * | Same cleanup |

### Publishing section fields

| Location | Current | New | Why |
|----------|---------|-----|-----|
| Label | Description for SEO * | SEO description * | Shorter |
| Placeholder | SEO-focused description for search results and page metadata | Short description for search results | Simpler |
| Label | Keywords for SEO * | SEO keywords * | Shorter, matches common terminology |
| Placeholder | e.g., cloud computing, automation, AI | e.g., ansible automation, openshift virtualization | More relevant examples |
| Label | Links for next step call to action * | Call-to-action links * | Shorter |
| Helper | AI suggests 3 official Red Hat links from an approved CTA catalog. Review and edit if needed. | AI suggests 3 links from the approved catalog. Edit if needed. | Shorter |
| Labels | CTA Link 1/2/3 * | Link 1/2/3 * | "CTA" is jargon |
| Placeholder (x3) | Official Red Hat link | https://... | Simpler — the helper already explains these are official |
| h3 | Optional | Optional fields | Clearer as a heading |
| Label | Optional: Should this IE be grouped with another or part of a larger collection? | Group or collection | Drop question format, remove "IE" jargon, remove "Optional:" (section header says it) |
| Label | Optional: Have an Employee Advocacy link? Add it here. | Employee Advocacy link | Drop question format, remove "Optional:" |

### Creator Details fields

| Location | Current | New | Why |
|----------|---------|-----|-----|
| Label | Email Address * | Your email * | Friendlier |
| Label | Creator Name(s) * | Your name(s) * | Friendlier |
| Placeholder | Creator name(s) | First Last | Clearer example |
| Label | Creator Team(s) * | Your team * | Friendlier |
| Placeholder | Enter other creator team | Team name not in the list | Clearer |
| Label | What quarter was this content created in? * | Quarter created * | Much shorter |
| Placeholder | Enter other quarter | e.g., Q3 2026 | Concrete example |
| Checkbox label | No synthetic voice was used in this asset | No synthetic voice was used | "in this asset" is redundant |
| Checkbox label | No translation was used in this asset | No translation was used | Same |
| Checkbox label | I have read the list of requirements and ensured this asset meets brand standards, includes English and Spanish translations for accessibility, and have considered mobile-friendly design. * | I confirm this demo meets brand standards, includes English and Spanish captions, and is mobile-friendly. * | Much shorter — same meaning |

### Buttons

| Location | Current | New | Why |
|----------|---------|-----|-----|
| Extract button | Pull Content | Extract Content | Consistent with "extracted content" heading |
| Generate button | Generate Intake Draft | Generate Draft | Shorter |
| Submit button | Submit for Review | Submit | Shorter — "for review" is implied by the workflow |
| Success button | Submit another intake | Start another | Shorter |

### Status & banner messages

| Location | Current | New | Why |
|----------|---------|-----|-----|
| Extract loading | Pulling guide content... | Extracting content... | Consistent with button rename |
| Extract success | Guide content pulled successfully. | Content extracted successfully. | Consistent |
| Generate loading | Generating intake draft... | Generating draft... | Shorter |
| Generate loading sub | Can take up to 10 seconds. | This may take a few seconds. | Less precise = less wrong |
| Generate success | Draft generated from guide steps texts. Review and edit all required fields before submitting. | Draft ready! Review the fields below before submitting. | Friendlier |
| Submit loading | Submitting for review...\nSaving to Creator_Form_Raw and triggering the existing workflow. | Submitting... | "Creator_Form_Raw" is internal |
| Banner: header | AI confidence: | Draft confidence: | "AI" prefix adds nothing |
| Banner: low message | Review needed: **fields** | These fields need attention: **fields** | Clearer |
| Banner: medium message | Looks good — just double-check the medium-confidence fields. | Looks good — a few fields are worth a quick check. | Simpler |
| Banner: all-good message | All fields look good. Quick review recommended. | All fields look good! | Drop the hedging |
| URL error | Please paste an interactive demo share URL. | Please paste a demo URL to get started. | Friendlier |

---

### Task 1: Page-level and section header text changes (Index.html)

**Files:**
- Modify: `Index.html`

**Interfaces:**
- No ID changes. No JS changes. Text-only edits.

- [ ] **Step 1: Update page title and h1**

Replace line 6:
```html
<title>Interactive Demo Intake</title>
```

Replace line 249:
```html
<h1>Interactive Demo Intake</h1>
```

- [ ] **Step 2: Update subtitle paragraph**

Replace lines 250-252:
```html
<p class="subtle">
  Paste your demo URL below. AI will pre-fill most fields — you just review and submit.
</p>
```

- [ ] **Step 3: Update sandbox banner**

Replace line 255:
```html
<strong>Pilot mode</strong> — please don't enter sensitive or confidential information.
```

- [ ] **Step 4: Update section headers and subtitles**

URL section h2 (line 259):
```html
<h2>1. Paste your demo URL</h2>
```

URL helper (lines 261-263):
```html
<p class="helper" style="margin-bottom:12px;">
  Make sure your demo is in the <strong>Red Hat Workspace</strong> (not a private space) before submitting.
</p>
```

URL label (line 265):
```html
<label for="arcadeUrl">Demo URL <span class="required-note">*</span></label>
```

Extract card h2 (line 274):
```html
<h2>2. Review extracted content</h2>
```

Extract card subtitle (lines 275-277):
```html
<p class="subtle">
  AI uses this content to pre-fill your intake. Check that it looks right, then generate the draft.
</p>
```

Form section h2 (line 301):
```html
<h2>3. Review and submit</h2>
```

Form subtitle (lines 302-304):
```html
<p class="subtle">
  AI filled in what it could. Fields marked yellow still need your input.
</p>
```

Details summary (line 314):
```html
<summary>How AI generated this draft</summary>
```

Demo subtitle (line 326):
```html
<p class="form-section-subtitle">About the demo itself</p>
```

Audience subtitle (line 371):
```html
<p class="form-section-subtitle">Target audience and sales alignment</p>
```

Publishing subtitle (line 392):
```html
<p class="form-section-subtitle">Search optimization and links</p>
```

Creator Details subtitle (line 427):
```html
<p class="form-section-subtitle">About you</p>
```

Success h2 (line 473):
```html
<h2>You're all set!</h2>
```

- [ ] **Step 5: Verify no element IDs were changed**

Search for all `id=` attributes and confirm they are unchanged.

---

### Task 2: Field labels, placeholders, and helpers — Demo & Audience sections (Index.html)

**Files:**
- Modify: `Index.html`

**Interfaces:**
- No ID changes. Text-only.

- [ ] **Step 1: Demo section field labels and placeholders**

Line 328 — Final Demo Title → Title:
```html
<label>Title <span class="required-note">*</span></label>
```

Line 331 — Description label:
```html
<label>Description <span class="required-note">*</span></label>
```

Line 337 — Asset Type → Content type:
```html
<label>Content type <span class="required-note">*</span></label>
```

Lines 340-342 — Asset type helper:
```html
<div class="helper">
  Business Intro = under 90 seconds, non-technical. Technical Walkthrough = ~5 minutes, technical.
</div>
```

Line 346 — Language → Language(s):
```html
<label>Language(s) <span class="required-note">*</span></label>
```

Line 349 — Language helper:
```html
<div class="helper">Hold Cmd (Mac) or Ctrl (Windows) to select multiple.</div>
```

Line 354 — Duration → Estimated duration:
```html
<label>Estimated duration</label>
```

Line 355 — Duration placeholder:
```html
<input id="duration" placeholder="e.g., 3 minutes">
```

Line 357 — Primary product:
```html
<label>Primary product <span class="required-note">*</span></label>
```

Line 359 — Primary product Other placeholder:
```html
<input id="primaryProductOther" placeholder="Product name not in the list" style="display:none;">
```

Line 361 — Other products label:
```html
<label>Other related products</label>
```

Line 363 — Other products placeholder:
```html
<input id="otherProductsOther" placeholder="Product name(s) not in the list" style="display:none;">
```

Line 364 — Other products helper:
```html
<div class="helper">Hold Cmd (Mac) or Ctrl (Windows) to select multiple.</div>
```

- [ ] **Step 2: Audience section field labels**

Line 373:
```html
<label>Industry vertical <span class="required-note">*</span></label>
```

Line 376:
```html
<label>Event or project <span class="required-note">*</span></label>
```

Line 379:
```html
<label>Technology decision point <span class="required-note">*</span></label>
```

Line 382:
```html
<label>Sales tactic <span class="required-note">*</span></label>
```

Line 385:
```html
<label>Marketing program <span class="required-note">*</span></label>
```

---

### Task 3: Field labels, placeholders, and helpers — Publishing & Creator Details sections (Index.html)

**Files:**
- Modify: `Index.html`

**Interfaces:**
- No ID changes. Text-only.

- [ ] **Step 1: Publishing section**

Line 394:
```html
<label>SEO description <span class="required-note">*</span></label>
```

Line 395 placeholder:
```html
<textarea id="descriptionForSeo" oninput="updateWordCounts()" placeholder="Short description for search results"></textarea>
```

Line 398:
```html
<label>SEO keywords <span class="required-note">*</span></label>
```

Line 399 placeholder:
```html
<textarea id="seoKeywords" placeholder="e.g., ansible automation, openshift virtualization"></textarea>
```

Line 401:
```html
<label>Call-to-action links <span class="required-note">*</span></label>
```

Lines 402-404 helper:
```html
<div class="helper">
  AI suggests 3 links from the approved catalog. Edit if needed.
</div>
```

Lines 406, 409, 412 — CTA Link labels:
```html
<label>Link 1 <span class="required-note">*</span></label>
```
```html
<label>Link 2 <span class="required-note">*</span></label>
```
```html
<label>Link 3 <span class="required-note">*</span></label>
```

Lines 407, 410, 413 — CTA Link placeholders:
```html
<input id="ctaLink1" placeholder="https://...">
```
```html
<input id="ctaLink2" placeholder="https://...">
```
```html
<input id="ctaLink3" placeholder="https://...">
```

Line 415:
```html
<h3>Optional fields</h3>
```

Line 417:
```html
<label>Group or collection</label>
```

Line 420:
```html
<label>Employee Advocacy link</label>
```

- [ ] **Step 2: Creator Details section**

Line 431:
```html
<label>Your email <span class="required-note">*</span></label>
```

Line 436:
```html
<label>Your name(s) <span class="required-note">*</span></label>
```

Line 437 placeholder:
```html
<input id="creatorName" placeholder="First Last">
```

Line 441:
```html
<label>Your team <span class="required-note">*</span></label>
```

Line 443 placeholder:
```html
<input id="creatorTeamOther" placeholder="Team name not in the list" style="display:none;">
```

Line 445:
```html
<label>Quarter created <span class="required-note">*</span></label>
```

Line 447 placeholder:
```html
<input id="quarterOther" placeholder="e.g., Q3 2026" style="display:none;">
```

Line 451:
```html
<label for="syntheticVoice">No synthetic voice was used</label>
```

Line 456:
```html
<label for="translation">No translation was used</label>
```

Lines 461-463:
```html
<label for="requirementsConfirmed">
  I confirm this demo meets brand standards, includes English and Spanish captions, and is mobile-friendly.
  <span class="required-note">*</span>
</label>
```

---

### Task 4: Button text and dynamic status messages (Index.html)

**Files:**
- Modify: `Index.html`

**Interfaces:**
- No ID changes. Button `onclick` handlers unchanged. Only inner text changes.

- [ ] **Step 1: Button text**

Line 269:
```html
<button onclick="extractGuide()">Extract Content</button>
```

Line 295:
```html
<button onclick="generateDraft()">Generate Draft</button>
```

Line 468:
```html
<button id="submitButton" onclick="submitForReview()">Submit</button>
```

Line 478:
```html
<button type="button" onclick="startAnotherSubmission()">Start another</button>
```

- [ ] **Step 2: Status messages in JavaScript**

Find the `extractGuide()` function — update the error and loading messages:

Change `"Please paste an interactive demo share URL."` to:
```javascript
"Please paste a demo URL to get started."
```

Change `"Pulling guide content..."` to:
```javascript
"Extracting content..."
```

Change `"Guide content pulled successfully."` to:
```javascript
"Content extracted successfully."
```

Change `"Guide URL"` (the link text in success status) to:
```javascript
"Demo URL"
```

- [ ] **Step 3: Generate draft status messages**

Change `"Generating intake draft..."` to:
```javascript
"Generating draft..."
```

Change `"Can take up to 10 seconds."` to:
```javascript
"This may take a few seconds."
```

Change the success message `"Draft generated from guide steps texts. Review and edit all required fields before submitting."` to:
```javascript
"Draft ready! Review the fields below before submitting."
```

- [ ] **Step 4: Submit status messages**

Change the loading message `"Submitting for review...\nSaving to Creator_Form_Raw and triggering the existing workflow."` to:
```javascript
"Submitting..."
```

Change the submit button loading text `"Submitting..."` — this one stays the same (already short).

- [ ] **Step 5: Banner messages in showReviewBanner()**

Change `'<strong>AI confidence:</strong> '` to:
```javascript
'<strong>Draft confidence:</strong> '
```

Change `'Review needed: <strong>'` to:
```javascript
'These fields need attention: <strong>'
```

Change `'Looks good — just double-check the medium-confidence fields.'` to:
```javascript
'Looks good — a few fields are worth a quick check.'
```

Change `'All fields look good. Quick review recommended.'` to:
```javascript
'All fields look good!'
```

---

### Task 5: Mirror all changes to public/index.html

**Files:**
- Modify: `public/index.html`

**Interfaces:**
- Same text changes as Tasks 1-4, applied to public/index.html. The HTML structure is nearly identical but line numbers differ.

- [ ] **Step 1: Apply all page-level text changes from Task 1**

Apply every heading, subtitle, section header, and helper text change from Task 1 to public/index.html. Use the same old → new string pairs.

- [ ] **Step 2: Apply all field label/placeholder/helper changes from Tasks 2-3**

Apply every label, placeholder, and helper text change from Tasks 2 and 3 to public/index.html. Use the same old → new string pairs.

- [ ] **Step 3: Apply all button and status message changes from Task 4**

Apply every button text, status message, and banner message change from Task 4 to public/index.html. Use the same old → new string pairs.

- [ ] **Step 4: Verify both files have identical user-facing text**

Run a diff of key text patterns between the two files to confirm sync:
```bash
diff <(grep -oP '(?<=<label[^>]*>)[^<]+' Index.html | sort) <(grep -oP '(?<=<label[^>]*>)[^<]+' public/index.html | sort)
```

---

### Task 6: Push and verify

**Files:**
- No modifications — deployment step only.

- [ ] **Step 1: Push via clasp**

```bash
npx clasp push
```

- [ ] **Step 2: Verify in browser**

Open the app and check:
1. Page title and h1 read "Interactive Demo Intake"
2. Three section headers: "1. Paste your demo URL", "2. Review extracted content", "3. Review and submit"
3. All field labels match the new text (Title, Content type, Language(s), etc.)
4. Placeholders show new text (e.g., "First Last", "Product name not in the list")
5. Helpers show updated text (e.g., "Hold Cmd (Mac) or Ctrl (Windows)...")
6. Buttons: "Extract Content", "Generate Draft", "Submit", "Start another"
7. Pull a demo → status shows "Extracting content..." then "Content extracted successfully."
8. Generate draft → status shows "Generating draft..." then "Draft ready!"
9. Banner shows "Draft confidence:" (not "AI confidence:")
10. Checkboxes show shortened text
11. Success screen shows "You're all set!"

---

## Files to modify
- `Index.html` — all user-facing text (Tasks 1-4)
- `public/index.html` — mirror of all changes (Task 5)

## Verification
1. All labels, placeholders, helpers, and buttons show new text
2. No element IDs changed
3. Both frontends display identical text
4. Form still submits successfully
5. Confidence indicators and banners still work
6. Validation error messages reference correct field names
