# Using Guide Extraction JSON for AI Features

The `Guide Extraction JSON` column in `Request_Master` stores each demo's extracted content as structured JSON — step-by-step text, screenshot URLs, links, and metadata.

**Apps Script project:** Open with `clasp open` from the arcade-intake-app repo, or see `Code.js` directly.

## Where the Data Lives

| Sheet | Column | Populated by |
|-------|--------|-------------|
| `Request_Master` | `Guide Extraction JSON` | `backfillGuideExtractions()` (batch) |
| `Creator_Form_Raw` | `Guide Extraction JSON` | Intake submission flow (automatic) |

## Current Data (as of 2026-07-29)

- **255 rows populated** out of 300 in Request_Master
- **45 rows empty** (status not `IE Published`/`IE Reviewed`, or no Arcade URL)
- **4 rows truncated** (steps trimmed to fit the 50K cell limit — marked with `"truncated": true`)

## JSON Field Reference

| Field | Type | Description |
|-------|------|-------------|
| `arcadeId` | string | Arcade demo identifier |
| `title` | string | Demo title extracted from the guide page |
| `guideUrl` | string | URL of the guide page that was scraped |
| `shareUrl` | string | Shareable Arcade URL |
| `duration` | string | Demo duration (e.g. "3 min"), empty if unknown |
| `steps` | array | Ordered list of demo steps (see below) |
| `links` | array | Links found on the guide page (up to 12) |
| `bodyText` | string | Full page text, up to 3000 chars |
| `extractedAt` | string | ISO timestamp of when extraction happened |
| `truncated` | boolean | Only present (set to `true`) if steps were trimmed to fit the 50K cell limit |

### Step Object

| Field | Type | Description |
|-------|------|-------------|
| `stepNumber` | number | 1-indexed position in the demo |
| `text` | string | What the user does in this step |
| `imageUrl` | string | URL to the screenshot (not base64 — needs fetching for AI image input) |
| `imageAlt` | string | Image alt text (often shorter than `text`) |

### Real Example

```json
{
  "arcadeId": "TjY9dlrUlZJhhKLvz98I",
  "title": "Updating Software with Web Console in Red Hat Enterprise Linux",
  "guideUrl": "https://interact.redhat.com/share/TjY9dlrUlZJhhKLvz98I/guide",
  "shareUrl": "https://interact.redhat.com/share/TjY9dlrUlZJhhKLvz98I",
  "duration": "",
  "steps": [
    {
      "stepNumber": 1,
      "text": "Find out more",
      "imageUrl": "https://worker.arcade.software/image-transform?image=https%3A%2F%2Fcdn.arcade.software%2F...",
      "imageAlt": "Step 1"
    },
    {
      "stepNumber": 2,
      "text": "Updating Software with Web Console in Red Hat Enterprise Linux",
      "imageUrl": "https://worker.arcade.software/image-transform?image=https%3A%2F%2Fcdn.arcade.software%2F...",
      "imageAlt": "Step 2"
    },
    {
      "stepNumber": 3,
      "text": "Our Red Hat Enterprise Linux system is now up to date.",
      "imageUrl": "https://worker.arcade.software/image-transform?image=https%3A%2F%2Fcdn.arcade.software%2F...",
      "imageAlt": "Step 3"
    }
  ],
  "links": [
    { "label": "", "href": "https://www.redhat.com/" },
    { "label": "Find out more", "href": "https://www.redhat.com/en" }
  ],
  "bodyText": "Updating Software with Web Console in Red Hat Enterprise Linux | Guide ...",
  "extractedAt": "2026-07-29T00:46:20.386Z"
}
```

## Key Functions in Code.js

| Function | What it does |
|----------|-------------|
| `buildGuideExtractionJson_(extractedGuide)` | Converts raw extraction into the step-centric JSON structure above |
| `fetchGuideContent_(url)` | Fetches an Arcade guide page and extracts steps, images, text, links, duration |
| `fetchImagesAsBase64_(imageUrls)` | Converts image URLs to base64 for sending to AI models. Returns `{ images: [{base64, mimeType, sizeBytes}], errors: [] }` |
| `callGemini_(prompt, interleavedParts)` | Sends prompt + optional image parts to Gemini. **Returns JSON** (`responseMimeType: 'application/json'`) |
| `backfillGuideExtractions()` | Batch-populates the column for existing demos. Run from Apps Script editor |
| `generateDraftFromGuide(payload)` | **Working example** of the full flow: reads extraction → fetches images as base64 → interleaves step text + screenshots → sends to Gemini |

## Using the Data

- **Text only:** Parse the JSON, build a prompt from `steps[].text`. No image fetching needed.
- **Text + images:** Use `fetchImagesAsBase64_()` to convert `steps[].imageUrl` to base64, then interleave with step text as `inlineData` parts. See `generateDraftFromGuide()` in Code.js for the exact pattern.
- **Re-extract:** Clear the cell and re-run `backfillGuideExtractions()`.
