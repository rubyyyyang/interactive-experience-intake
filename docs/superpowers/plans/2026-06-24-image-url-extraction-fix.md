# Fix Image URL Extraction for Arcade CDN Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract fetchable worker URLs from Arcade guide images instead of broken CDN-wrapped URLs, deduplicate them, and skip the watermark logo.

**Architecture:** Arcade guide `<img>` tags use a CDN wrapper pattern: `https://cdn.arcade.software/cdn-cgi/image/.../https://worker.arcade.software/image-transform?image=...`. The CDN wrapper returns 502 for these nested URLs, but the inner `worker.arcade.software` URLs return images successfully (~90KB each). The fix extracts the inner URL, deduplicates by source image, and filters out the watermark logo. Also raises the per-image size limit from 512KB to 1MB since worker URLs return smaller images anyway.

**Tech Stack:** Node.js, Cheerio, Express

## Global Constraints

- All changes in `server.js` only
- Zero new dependencies
- Backward-compatible: if a guide has no CDN-wrapped images, behavior is unchanged
- Watermark images (path contains `watermark-logos/`) are excluded
- Dedup by source image identity (same mux video ID or same extension-upload UUID = same image)

---

### Task 1: Fix image URL extraction and deduplication in `fetchGuideContent()`

**Files:**
- Modify: `server.js:515-527` (the `$('img').each(...)` loop that collects `imageUrls`)

**Interfaces:**
- Consumes: Cheerio `$('img')` elements from parsed guide HTML
- Produces: `imageUrls: string[]` — deduplicated, fetchable URLs (worker URLs when CDN-wrapped, original URL otherwise). Used by `fetchImagesAsBase64()` in the `/api/generate` handler.

- [ ] **Step 1: Replace the image URL extraction loop**

The current code at `server.js:515-527` pushes raw `src` attributes. Replace with logic that:
1. Extracts the inner `https://worker.arcade.software/...` URL from CDN-wrapped `src` values
2. Strips `&hotspot=...` query params (used for click-target overlays, not image content)
3. Skips watermark logo images
4. Deduplicates by source image identity

Replace the block at `server.js:515-527`:

```js
  const imageTexts = [];
  const imageUrls = [];
  const seenImageKeys = new Set();
  $('img').each((_, el) => {
    const alt = cleanText($(el).attr('alt'));
    if (alt) imageTexts.push(alt);

    let src = $(el).attr('src');
    if (!src) return;

    if (src.includes('watermark-logos/')) return;

    const innerIdx = src.indexOf('/https://');
    if (innerIdx !== -1) {
      src = src.slice(innerIdx + 1);
    }

    src = src.replace(/&hotspot=[^&]*/g, '');

    let dedupKey = src;
    try {
      const parsed = new URL(src);
      const imageParam = parsed.searchParams.get('image');
      if (imageParam) {
        const imgUrl = new URL(imageParam);
        dedupKey = imgUrl.origin + imgUrl.pathname;
      }
    } catch {}

    if (!seenImageKeys.has(dedupKey)) {
      seenImageKeys.add(dedupKey);
      imageUrls.push(src);
    }
  });
```

- [ ] **Step 2: Raise the per-image size limit in `fetchImagesAsBase64()`**

The current default `maxBytesPerImage` is `512 * 1024` (512KB). The worker URLs return smaller images (~90KB), but some extension-upload PNGs can be larger. Raise to 1MB for safety.

In `server.js`, inside `fetchImagesAsBase64()`, change:

```js
    maxBytesPerImage = 512 * 1024,   // old
```

to:

```js
    maxBytesPerImage = 1024 * 1024,
```

- [ ] **Step 3: Kill the running dev server, restart, and test extraction**

```bash
pkill -f 'node server.js' 2>/dev/null; sleep 1; node server.js &
sleep 2

curl -s http://localhost:3000/api/extract-guide \
  -H 'Content-Type: application/json' \
  -d '{"arcadeId":"nmHfJpq1H0Uyu6L5Bxd2"}' | node -e "
const d = JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));
const eg = d.extractedGuide;
console.log('Image URLs:', eg.imageUrls.length);
eg.imageUrls.forEach((u,i) => console.log(i+1, u.slice(0,120)));
console.log('Has watermark?', eg.imageUrls.some(u => u.includes('watermark')));
console.log('Has cdn-cgi wrapper?', eg.imageUrls.some(u => u.includes('cdn-cgi')));
console.log('All worker URLs?', eg.imageUrls.every(u => u.startsWith('https://worker.arcade.software/')));
"
```

Expected:
- `Image URLs: 8` (deduplicated, no watermark)
- `Has watermark? false`
- `Has cdn-cgi wrapper? false`
- `All worker URLs? true`

- [ ] **Step 4: Test the full generate flow with images**

```bash
curl -s http://localhost:3000/api/extract-guide \
  -H 'Content-Type: application/json' \
  -d '{"arcadeId":"nmHfJpq1H0Uyu6L5Bxd2"}' > /tmp/extracted.json

BODY=$(node -e "const d=JSON.parse(require('fs').readFileSync('/tmp/extracted.json','utf8')); console.log(JSON.stringify({extractedGuide: d.extractedGuide}))")

curl -s http://localhost:3000/api/generate \
  -H 'Content-Type: application/json' \
  -d "$BODY" | node -e "
const d = JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));
console.log('Success:', d.success);
console.log('Images used:', d.imagesUsed);
console.log('Title:', d.draft?.demo_title);
console.log('Product:', d.draft?.primary_product_suggestion);
"
```

Expected:
- `Success: true`
- `Images used:` 5 (fetches top 5 of the ~8 unique URLs)
- Draft fields populated with visually-informed metadata

- [ ] **Step 5: Commit**

```bash
git add server.js
git commit -m "fix: extract worker URLs from Arcade CDN wrapper for image vision

Strip CDN prefix to get fetchable worker.arcade.software URLs,
deduplicate by source image, skip watermark logos, raise size limit to 1MB."
```
