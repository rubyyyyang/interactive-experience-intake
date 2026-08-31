# AI Output Quality Monitoring Plan

**Tool:** Arcade Intake Assistant  
**AI Model:** Google Gemini 2.5 Flash  
**Purpose:** Ensure AI-generated metadata suggestions remain accurate, helpful, and aligned with user expectations.

---

## Monitoring Scope

The AI generates draft suggestions for the following fields:

- **Description** (descriptionWithoutGid and descriptionForSeo)
- **Primary Product** (primaryProductSuggestion)
- **Other Products** (otherProductsSuggestion)
- **Technology Decision Point (TDP)**
- **Sales Tactic**
- **Marketing Program**
- **SEO Keywords**
- **Call-to-Action (CTA) Links** (from approved catalog)
- **Language suggestions** (for Arcade demos)
- **Tour Highlights** (appended to description)

Each field includes a confidence score (high/medium/low) to guide user review.

---

## Monitoring Schedule

### Phase: Beta / Pilot
- **Frequency:** Monthly
- **Responsibility:** Product owner or designated admin
- **First review:** One month after deployment to production

### Phase: Stable Production
- **Frequency:** Quarterly
- **Responsibility:** Product owner or designated admin
- **Review months:** January, April, July, October (or fiscal quarter alignment)

### Ad-hoc Reviews
- Triggered by:
  - User feedback reporting recurring AI errors
  - Significant changes to FIELD_OPTIONS taxonomy
  - Gemini model upgrade or prompt changes
  - New content types or product launches

---

## Review Process

### 1. Sample Selection
- **Sampling method:** Random selection of recent submissions (last 30 days for monthly, last 90 days for quarterly)
- **Sample size:** Minimum 20 submissions, or 10% of total submissions (whichever is greater)
- **Stratification:** Include mix of:
  - Different products (RHEL, OpenShift, Ansible, AAP, etc.)
  - Different confidence levels (high/medium/low)
  - Arcade demos and YouTube videos (if applicable)

### 2. Accuracy Assessment

For each sampled submission, compare AI-generated values against:

- **Ground truth:** Final submitted values after creator review
- **Admin corrections:** Changes made during admin review
- **User feedback:** Explicit feedback from creators about inaccurate fields

**Accuracy metrics to track:**

| Field | Metric | Acceptable Threshold |
|-------|--------|---------------------|
| Primary Product | Exact match rate | ≥ 70% |
| TDP | Exact match rate | ≥ 60% |
| Sales Tactic | Exact match rate | ≥ 50% |
| Description quality | Subjective review (clear, relevant, no hallucinations) | ≥ 80% acceptable |
| SEO Keywords | Relevance (manual assessment) | ≥ 75% relevant |
| CTA Links | Appropriate suggestions from catalog | ≥ 70% |

### 3. Data Sources

- **Creator_Form_Raw tab:** Final submitted values
- **Analytics_Log:** Field edit tracking (which fields creators changed post-AI generation)
- **Feedback events:** Analytics events tagged `feedback_submitted`
- **Admin review notes:** Notes from admin team during approval process

### 4. Analysis Questions

- Which fields have the highest edit rate (creators changed AI suggestion)?
- Which fields consistently receive "low confidence" scores but are accurate?
- Which fields have "high confidence" scores but are frequently wrong?
- Are certain products or TDPs more error-prone than others?
- Do YouTube videos have different accuracy patterns than Arcade demos?

---

## Response Actions

### If accuracy meets thresholds:
- **Action:** No changes required
- **Documentation:** Record review date, sample size, and summary in `docs/ai-monitoring-log.md`

### If accuracy falls below thresholds:
- **Immediate action:** Investigate root cause
  - Is the taxonomy outdated? (Update FIELD_OPTIONS)
  - Is the prompt unclear? (Refine `buildMetadataPrompt()`)
  - Is the model hallucinating? (Add validation rules or constraints)
  - Is the confidence scoring wrong? (Adjust scoring logic)

- **Corrective action:** Implement one or more of:
  - Update prompt instructions in `IA_Gemini.js`
  - Add new products/TDPs to `FIELD_OPTIONS`
  - Add post-processing validation (e.g., reject invalid products)
  - Lower confidence thresholds for problematic fields
  - Add user-facing guidance (help text, examples)

- **Re-test:** Deploy changes to /dev and test with 5-10 diverse demos before production rollout

- **Follow-up:** Re-assess accuracy within 1 month of changes

### If recurring user feedback identifies patterns:
- **Triage:** Weekly review of feedback analytics events
- **Escalate:** If 3+ users report the same field as consistently wrong, trigger an immediate review (don't wait for scheduled review)

---

## Monitoring Log

Maintain a lightweight log at `docs/ai-monitoring-log.md`:

```markdown
# AI Monitoring Log

## 2026-09-30 — Monthly Review (Beta)
- Sample size: 25 submissions
- Primary Product accuracy: 76% ✓
- TDP accuracy: 58% ⚠️ (below threshold)
- Action: Updated TDP prompt to clarify "Modernize and optimize IT" vs "Build cloud-native apps"
- Re-test: Scheduled for 2026-10-15

## 2026-10-30 — Monthly Review (Beta)
- Sample size: 30 submissions
- TDP accuracy: 68% ✓ (improved)
- No action required
```

---

## Responsible Parties

- **Primary reviewer:** Product owner (current: Ruby Yang)
- **Backup reviewer:** Admin team lead
- **Escalation contact:** Slack #forum-arcade-creators

---

## Success Criteria

This monitoring plan is effective if:

1. **Accuracy trends remain stable or improve** over time
2. **User feedback volume decreases** (fewer complaints about AI errors)
3. **Creator edit rate decreases** (AI suggestions accepted more often)
4. **Reviews complete on schedule** (no skipped months/quarters)

If reviews are consistently skipped or accuracy degrades without response, escalate to stakeholders for additional resourcing or process changes.

---

*Plan established: 2026-08-31*  
*Next scheduled review: 2026-09-30 (monthly, beta phase)*
