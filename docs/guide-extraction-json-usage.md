# Using Guide Extraction JSON for AI Features

The `Guide Extraction JSON` column in `Request_Master` stores each demo's extracted content as structured JSON — step-by-step text, screenshot URLs, links, and metadata. This guide shows how to read it and feed it to an AI model.

## Where the Data Lives

| Sheet | Column | Populated by |
|-------|--------|-------------|
| `Request_Master` | `Guide Extraction JSON` | `backfillGuideExtractions()` (batch) |
| `Creator_Form_Raw` | `Guide Extraction JSON` | Intake submission flow (automatic) |

## JSON Structure

Each cell contains a JSON string with this shape:

```json
{
  "arcadeId": "abc123",
  "title": "Getting started with OpenShift AI",
  "guideUrl": "https://app.arcade.software/flows/abc123/guide",
  "shareUrl": "https://app.arcade.software/share/abc123",
  "duration": "3 min",
  "steps": [
    {
      "stepNumber": 1,
      "text": "Navigate to the OpenShift console and click on AI/ML",
      "imageUrl": "https://cdn.arcade.software/...",
      "imageAlt": "OpenShift console screenshot"
    },
    {
      "stepNumber": 2,
      "text": "Select your data science project",
      "imageUrl": "https://cdn.arcade.software/...",
      "imageAlt": "Project selection screen"
    }
  ],
  "links": [
    { "label": "Try it free", "href": "https://console.redhat.com/..." }
  ],
  "bodyText": "Full body text from the guide page...",
  "extractedAt": "2026-07-28T12:00:00Z"
}
```

### Field Reference

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
| `imageUrl` | string | URL to the screenshot on Arcade's CDN |
| `imageAlt` | string | Image alt text (often shorter than `text`) |

## Reading the JSON

```js
function getGuideExtraction(sheetName, rowIndex) {
  const ss = SpreadsheetApp.openById('YOUR_SPREADSHEET_ID');
  const sheet = ss.getSheetByName(sheetName);
  
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const jsonCol = headers.indexOf('Guide Extraction JSON') + 1;
  
  const raw = sheet.getRange(rowIndex, jsonCol).getValue();
  if (!raw) return null;
  
  return JSON.parse(raw);
}
```

## Using with AI — Text Only

If your AI feature only needs text (descriptions, summaries, categorization, search indexing), you can use the JSON directly — no image fetching needed. Build your prompt from the step texts:

```js
const guide = getGuideExtraction('Request_Master', rowIndex);

const stepsText = guide.steps
  .map(s => s.stepNumber + '. ' + s.text)
  .join('\n');

const prompt = 'Your prompt here.\n\n'
  + 'Title: ' + guide.title + '\n'
  + 'Duration: ' + (guide.duration || 'unknown') + '\n\n'
  + 'Steps:\n' + stepsText;

// Send `prompt` to your AI model of choice.
```

**Note:** The existing `callGemini_(prompt)` in Code.js is configured for structured JSON responses (`responseMimeType: 'application/json'`). If you need plain text responses, you'll need your own Gemini call function or a wrapper that sets a different `responseMimeType`.

## Using with AI — Text + Images

To send screenshots to the AI model, you need to fetch the image URLs and convert them to base64 first. Code.js has a helper `fetchImagesAsBase64_(imageUrls)` that does this:

```js
// 1. Collect image URLs from steps
const imageUrls = guide.steps
  .map(s => s.imageUrl)
  .filter(url => url);

// 2. Fetch images as base64
const fetchResult = fetchImagesAsBase64_(imageUrls);
// Returns { images: [...], errors: [...] }
// Each image: { base64: '...', mimeType: 'image/png', sizeBytes: 12345 } or null on failure

// 3. Build interleaved parts: step text + screenshot pairs
const parts = [];
let imageIdx = 0;
for (const step of guide.steps) {
  parts.push({ text: 'Step ' + step.stepNumber + ': ' + step.text });

  if (step.imageUrl && fetchResult.images[imageIdx]) {
    const img = fetchResult.images[imageIdx];
    parts.push({
      inlineData: {
        mimeType: img.mimeType,
        data: img.base64
      }
    });
  }
  if (step.imageUrl) imageIdx++;
}

// 4. Send `parts` as interleavedParts to your AI model.
// The existing callGemini_(prompt, parts) works for JSON responses.
// See generateDraftFromGuide() in Code.js for a working example.
```

### About `fetchImagesAsBase64_()`

- Defined in `Code.js` (line 1982) — private helper (trailing underscore), usable within the same script file
- Fetches all image URLs in parallel using `UrlFetchApp.fetchAll()`
- Returns `{ images: [...], errors: [...] }`
- Each image is `{ base64: '...', mimeType: 'image/png', sizeBytes: 12345 }` or `null` on failure
- Skips images over 1MB

## Batch Processing Pattern

To process multiple demos (e.g. generate card descriptions for all published demos):

```js
function batchProcess() {
  const ss = SpreadsheetApp.openById('YOUR_SPREADSHEET_ID');
  const sheet = ss.getSheetByName('Request_Master');
  const lastRow = sheet.getLastRow();

  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const jsonCol = headers.indexOf('Guide Extraction JSON') + 1;
  const statusCol = headers.indexOf('Status') + 1;

  const data = sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).getValues();

  for (let i = 0; i < data.length; i++) {
    const status = String(data[i][statusCol - 1] || '');
    const raw = String(data[i][jsonCol - 1] || '');
    if (status !== 'IE Published' || !raw) continue;

    try {
      const guide = JSON.parse(raw);
      // Your AI logic here — guide.steps, guide.title, etc.
    } catch (e) {
      Logger.log('Row ' + (i + 2) + ': ' + e.message);
    }
  }
}
```

## Tips

- **Check `truncated`**: If `true`, the demo had too many steps to fit in the cell. The text fields and early steps are still there, but later steps may be missing.
- **Image URL fetch failures**: If an image URL fails to fetch, `fetchImagesAsBase64_()` returns `null` for that image and logs the error. The step text is still available.
- **Text is usually enough**: For categorization, search, and description generation, the step text alone gives the AI enough context. Only fetch images when visual analysis is needed.
- **Rate limits**: When batch-processing with image fetches, add `Utilities.sleep(1000)` between rows to avoid hitting Arcade CDN rate limits.
- **Re-extract if needed**: If a demo's guide page changes, you can re-extract by clearing the `Guide Extraction JSON` cell and re-running `backfillGuideExtractions()`.
