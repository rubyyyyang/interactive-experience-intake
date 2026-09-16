# Interactive Experience Intake User Guide

This guide covers the Interactive Experience Intake application for submitting Interactive Demos and Video Demos.

---

## What is Interactive Experience Intake?

Interactive Experience Intake is an internal Red Hat tool that streamlines the submission of Interactive Demos and Video Demos for inclusion in the Interactive Experiences library. The tool uses AI (Google Gemini) to analyze your demo content and automatically generate suggested metadata, significantly reducing the manual effort required to complete intake forms.

**Note:** The current pilot uses Gemini 2.5 Flash.

## How the Tool Works

1. **Paste your URL** — Provide an Arcade demo share URL from interact.redhat.com or a YouTube video URL
2. **Extract content** — The tool fetches guide content including title, steps, screenshots, and duration
3. **AI generates draft** — Gemini analyzes the extracted content and suggests metadata fields like:
   - Description and SEO description
   - Product classifications (Primary Product, other related products)
   - Topic classifications (Primary Topic, other related topics) — **Interactive Demo only**
   - Technology Decision Points (TDPs)
   - Sales tactics and marketing programs
   - Keywords
   - Call-to-action links
4. **Review and edit** — You review all AI-generated suggestions, make corrections, and submit
5. **Track status** — Monitor your submission through the Status Tracker

## Example Use Case

**Scenario:** You've created an Interactive Demo showing how to set up OpenShift Virtualization.

1. Copy the share URL from Arcade (e.g., `https://interact.redhat.com/share/abc123`)
2. Paste it into the Intake Assistant
3. Click "Extract Content" — the tool reads your demo title, steps, and screenshots
4. Click "Generate Draft" — Gemini analyzes your demo and suggests:
   - Primary Product: "OpenShift Virtualization"
   - Primary Topic: "Virtualization"
   - TDP: "Modernize and optimize IT"
   - Description draft based on your demo steps
   - SEO keywords related to virtualization
5. Review each field — correct any inaccuracies (e.g., Gemini might guess the wrong TDP or Topic)
6. Submit for review

## Important: AI Output May Be Inaccurate

**The AI-generated content is a draft suggestion only.** Gemini analyzes your demo content but may:

- Misclassify products or TDPs
- Generate descriptions that miss key points or include irrelevant details
- Suggest inappropriate keywords or CTAs
- Make incorrect assumptions about audience or technical level

**You are responsible for verifying all AI-generated content before submission.**

## How to Use AI-Generated Values

**Always review AI generated content prior to use.**

For each AI-suggested field, you can:

- **Accept** — If the suggestion is accurate, leave it as-is
- **Edit** — Modify the suggestion to correct errors or improve clarity
- **Replace** — Clear the field and write your own content from scratch
- **Discard** — Ignore the AI suggestion and enter your own value

The tool shows confidence indicators (colored left border on form fields):
- **Green** = High confidence (but still verify!)
- **Orange** = Medium confidence — worth a quick check
- **Red** = Low confidence — please review carefully

## Human Review is Required

**You must review all AI-generated content before submitting.** Do not submit the intake form without:

1. Reading each AI-generated field
2. Verifying accuracy against your demo content
3. Correcting any errors or unclear suggestions
4. Ensuring the description accurately represents your demo

**Significant human authorship is required when working with AI-generated content, designs, and assets.** You are responsible for the accuracy and appropriateness of all submitted content, including any AI-generated suggestions you choose to use.

Submissions are sent to the admin team for final review before publication.

## Data Privacy and Sensitive Information

**Do not intentionally submit:**

- Confidential or proprietary Red Hat information
- Customer data or personally identifiable information (PII)
- Credentials, API keys, secrets, or passwords
- Sensitive personal information

The tool is in pilot mode. Only submit publicly-shareable demo content.

## Red Hat AI Content Guidelines

All AI-generated content must comply with Red Hat's guidelines for acceptable use of AI-generated content. You are responsible for ensuring:

- Content accuracy and factual correctness
- Appropriate tone and messaging
- Compliance with brand standards
- No inappropriate or harmful content

**Red Hat AI Acceptable Use Guidance:**  
https://source.redhat.com/departments/legal/legal_compliance_ethics/compliance_folder/appendix_1_to_policy_on_the_use_of_ai_technologypdf

Consult Red Hat's internal AI use policies for complete guidelines.

## Metadata Fields

The intake form includes several types of metadata to help organize and discover your content:

### Product Classification
- **Primary Product** (required) — The main Red Hat product featured in your demo
- **Product** (optional) — Other related products shown or mentioned

### Topic Classification — Interactive Demo Only
- **Primary Topic** (required for Interactive Demo) — The main subject area or use case
- **Topic** (optional for Interactive Demo) — Additional related topics

Topic fields appear only for Interactive Demo submissions and are used to organize content on interact.redhat.com. Video Demo submissions do not include Topic fields.

### Other Metadata
- **Technology Decision Point (TDP)** — Strategic business driver
- **Sales Tactic** — Sales methodology alignment
- **Marketing Program** — Campaign or program association
- **Content Type** — Format/style classification

The AI will suggest values for most fields. You can accept, edit, or replace any suggestion.

## Support and Contact

**Need help?**
- Email: interactive-experiences@redhat.com
- Slack: [#forum-arcade-creators](https://redhat.enterprise.slack.com/archives/C07HQMHFWQG)
- Questions about the tool, AI suggestions, or submission status

**Found a bug or have a feature request?**
- Use the "Give feedback" link in the app
- Email: interactive-experiences@redhat.com
- Post in #forum-arcade-creators

## How to Provide Feedback

Click "Give feedback" in the app header to report:

- AI suggestions that were inaccurate
- Fields that need better options
- Workflow improvements
- Bugs or unexpected behavior

Your feedback helps improve the tool for everyone.

## FAQ

**Q: Can I edit the AI suggestions?**  
A: Yes! Edit any field. You can also replace AI content entirely with your own text.

**Q: What if Gemini gets it wrong?**  
A: Correct the field before submitting. The AI is not perfect — your review ensures accuracy.

**Q: Can I skip the AI and fill the form manually?**  
A: You must extract content from your demo URL first. After extraction, you can replace any or all AI suggestions with your own input.

**Q: Who reviews my submission?**  
A: The admin team reviews all submissions before publishing to the Interactive Experiences library.

**Q: How long does review take?**  
A: Check the Status Tracker for real-time updates on your submission status.

**Q: Can I submit Video Demos?**  
A: Yes! Paste a YouTube watch URL instead of an Arcade link. Some fields are specific to Interactive Demos (like Primary Topic and Topic) and will not appear for Video Demo submissions.

**Q: What's the difference between "Primary Product" and "Product" in the Status Tracker?**  
A: "Primary Product" is the main product featured in your demo. "Product" lists any additional related products. Similarly, "Primary Topic" is the main subject area, and "Topic" lists additional related topics (Interactive Demo only).

---

*Last updated: 2026-08-31*  
*Tool version: Pilot*
