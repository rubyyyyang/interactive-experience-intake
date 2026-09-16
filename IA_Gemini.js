// IA_Gemini.js — Gemini API, prompt building, response parsing, and HTML/guide extraction

const MODEL_ID = 'gemini-3.5-flash';
const FALLBACK_MODEL_ID = 'gemini-flash-latest';
const GEMINI_API_KEY_PROP = 'GEMINI_API_KEY';

const PROMPT_VERSION = 'guide-intake-v0.6-field-confidence';

function normalizeArcadeUrlInput_(value) {
  const raw = cleanText(value);
  if (!raw) {
    throw new Error(`Please enter an interactive demo share URL. Preferred format: ${PREFERRED_ARCADE_SHARE_URL_EXAMPLE}`);
  }

  let url = raw;
  if (!/^https?:\/\//i.test(url)) {
    url = 'https://' + url;
  }

  const cleanUrl = url.split('#')[0];
  const withoutQuery = cleanUrl.split('?')[0].replace(/\/+$/, '');

  let match;

  match = withoutQuery.match(/^https?:\/\/interact\.redhat\.com\/share\/([^\/?#]+)(?:\/guide)?$/i);
  if (match) {
    const arcadeId = decodeURIComponent(match[1]);
    return buildArcadeUrlInfo_(raw, arcadeId, 'interact-share');
  }

  match = withoutQuery.match(/^https?:\/\/app\.arcade\.software\/share\/([^\/?#]+)(?:\/guide)?$/i);
  if (match) {
    const arcadeId = decodeURIComponent(match[1]);
    return buildArcadeUrlInfo_(raw, arcadeId, 'arcade-share');
  }

  match = withoutQuery.match(/^https?:\/\/app\.arcade\.software\/flows\/([^\/?#]+)(?:\/edit)?$/i);
  if (match) {
    const arcadeId = decodeURIComponent(match[1]);
    const info = buildArcadeUrlInfo_(raw, arcadeId, 'arcade-edit');
    info.warnings.push(
      'This looks like an edit URL. I will try to use the flow ID, but if extraction fails, use the share URL instead.'
    );
    return info;
  }

  throw new Error(
    `I could not identify the URL. Please paste an Arcade share URL (${PREFERRED_ARCADE_SHARE_URL_EXAMPLE}) or a YouTube URL (https://youtube.com/watch?v=...)`
  );
}

function buildArcadeUrlInfo_(originalUrl, arcadeId, urlType) {
  const encodedId = encodeURIComponent(arcadeId);
  const interactShareUrl = `https://interact.redhat.com/share/${encodedId}`;
  const arcadeShareUrl = `https://app.arcade.software/share/${encodedId}`;

  const candidates = [];

  if (urlType === 'interact-share') {
    candidates.push(`${interactShareUrl}/guide`);
    candidates.push(interactShareUrl);
    candidates.push(`${arcadeShareUrl}/guide`);
    candidates.push(arcadeShareUrl);
  } else {
    candidates.push(`${arcadeShareUrl}/guide`);
    candidates.push(arcadeShareUrl);
    candidates.push(`${interactShareUrl}/guide`);
    candidates.push(interactShareUrl);
  }

  return {
    originalUrl,
    arcadeId,
    urlType,
    shareUrl: urlType === 'interact-share' ? interactShareUrl : arcadeShareUrl,
    preferredShareUrl: interactShareUrl,
    guideCandidates: candidates,
    warnings: []
  };
}

function extractYouTubeContent_(url, videoId) {
  var resp = YouTube.Videos.list('snippet,contentDetails', { id: videoId });
  if (!resp.items || resp.items.length === 0) {
    throw new Error('YouTube video not found or is private.');
  }
  var snippet = resp.items[0].snippet;
  var details = resp.items[0].contentDetails;
  var description = snippet.description || '';
  var durMatch = (details.duration || '').match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  var secs = durMatch
    ? (parseInt(durMatch[1]||0)*3600 + parseInt(durMatch[2]||0)*60 + parseInt(durMatch[3]||0))
    : 0;
  var duration = Math.floor(secs/60) + ':' + (secs%60 < 10 ? '0' : '') + secs%60;
  return {
    extractedGuide: {
      isYouTube: true,
      arcadeId: videoId,
      sourceUrl: url,
      shareUrl: url,
      guideUrl: url,
      title: snippet.title || '',
      stepTexts: description
        ? description.substring(0, 1500).split('\n').filter(function(l) { return l.trim(); })
        : [],
      imageTexts: [],
      imageUrls: [],
      steps: [],
      links: [],
      bodyText: description,
      warnings: [],
      youtubeChannel: snippet.channelTitle || '',
      youtubeDuration: duration,
      youtubePublishedAt: snippet.publishedAt ? snippet.publishedAt.substring(0, 10) : ''
    }
  };
}

function extractGuideContent(payload) {
  var inputUrl = ((typeof payload === 'object' ? payload.arcadeUrl || payload.url : payload) || '').trim();
  var ytMatch = inputUrl.match(/(?:youtu\.be\/|watch\?v=|&v=|embed\/)([A-Za-z0-9_\-]{11})/);
  if (ytMatch) return extractYouTubeContent_(inputUrl, ytMatch[1]);

  const arcadeUrl = typeof payload === 'string'
    ? payload
    : payload && (payload.arcadeUrl || payload.arcadeId || payload.url);
  const sessionId = (typeof payload === 'object' && payload) ? payload.sessionId : '';

  if (!arcadeUrl) {
    throw new Error('Please enter an interactive demo share URL. Preferred format: ' + PREFERRED_ARCADE_SHARE_URL_EXAMPLE);
  }

  logAnalyticsEvent_('guide_extraction_start', {
    sessionId: sessionId,
    arcadeId: arcadeUrl,
    metadata: { submittedUrl: arcadeUrl }
  });

  const startTime = Date.now();

  let extractedGuide;
  try {
    extractedGuide = fetchGuideContent_(arcadeUrl);
  } catch (e) {
    const errorDurationMs = Date.now() - startTime;
    logAnalyticsEvent_('guide_extraction_error', {
      sessionId: sessionId,
      arcadeId: arcadeUrl,
      durationMs: errorDurationMs,
      status: 'error',
      metadata: { errorMessage: e.message, durationMs: errorDurationMs }
    });
    throw e;
  }

  const durationMs = Date.now() - startTime;

  const imageCount = (extractedGuide.imageUrls || []).length;
  const stepCount = (extractedGuide.steps || []).length
    || (extractedGuide.stepTexts || []).length;

  logAnalyticsEvent_('guide_extraction_complete', {
    sessionId: sessionId,
    arcadeId: extractedGuide.arcadeId || arcadeUrl,
    durationMs: durationMs,
    metadata: { durationMs: durationMs, imageCount: imageCount, stepCount: stepCount }
  });

  return {
    success: true,
    extractedGuide: extractedGuide
  };
}

function generateDraftFromGuide(payload) {
  const extractedGuide = payload && payload.extractedGuide;
  const sessionId = payload && payload.sessionId || '';
  if (!extractedGuide) throw new Error('Missing extractedGuide');

  logAnalyticsEvent_('ai_generation_start', {
    sessionId: sessionId,
    arcadeId: extractedGuide.arcadeId || '',
    metadata: { model: MODEL_ID, promptVersion: PROMPT_VERSION }
  });

  const startTime = Date.now();

  const steps = extractedGuide.steps || [];
  const stepImageUrls = steps.map(function(s) { return s.imageUrl; });
  let imagesUsed = 0;

  const interleavedParts = [];
  if (stepImageUrls.length > 0) {
    const imageResult = fetchImagesAsBase64_(stepImageUrls);
    if (imageResult.errors.length > 0) {
      console.warn('Some images failed to fetch: ' + imageResult.errors.join(', '));
    }
    for (let i = 0; i < steps.length; i++) {
      const stepLabel = 'Step ' + (i + 1) + ': ' + (steps[i].text || '(no description)');
      interleavedParts.push({ text: stepLabel });
      if (imageResult.images[i]) {
        interleavedParts.push({
          inlineData: {
            mimeType: imageResult.images[i].mimeType,
            data: imageResult.images[i].base64
          }
        });
        imagesUsed++;
      }
    }
  } else if (extractedGuide.imageUrls && extractedGuide.imageUrls.length > 0) {
    const fallbackResult = fetchImagesAsBase64_(extractedGuide.imageUrls);
    fallbackResult.images.forEach(function(img) {
      interleavedParts.push({ inlineData: { mimeType: img.mimeType, data: img.base64 } });
    });
    imagesUsed = fallbackResult.images.length;
  }

  try {
    const prompt = buildMetadataPrompt(extractedGuide);
    const content = callGemini_(prompt, interleavedParts);
    const draft = normalizeDraft(parseModelJson(content));
    const durationMs = Date.now() - startTime;

    logAnalyticsEvent_('ai_generation_complete', {
      sessionId: sessionId,
      arcadeId: extractedGuide.arcadeId || '',
      durationMs: durationMs,
      metadata: { durationMs: durationMs, fieldConfidences: draft.field_confidence || {} }
    });

    return {
      success: true,
      draft: draft,
      modelUsed: MODEL_ID,
      promptVersion: PROMPT_VERSION,
      generatedAt: new Date().toISOString(),
      imagesUsed: imagesUsed
    };
  } catch (e) {
    const errorDurationMs = Date.now() - startTime;

    logAnalyticsEvent_('ai_generation_error', {
      sessionId: sessionId,
      arcadeId: extractedGuide.arcadeId || '',
      durationMs: errorDurationMs,
      status: 'error',
      metadata: { errorMessage: e.message, durationMs: errorDurationMs }
    });

    throw e;
  }
}

function buildRefinementPrompt_(originalDraft, creatorAnswers) {
  const answersText = Object.keys(creatorAnswers).map(function(field) {
    return '- ' + field + ': ' + creatorAnswers[field];
  }).join('\n');

  return 'You previously generated this intake draft:\n' +
    JSON.stringify(originalDraft, null, 2) +
    '\n\nThe creator has provided these additional details:\n' + answersText +
    '\n\nUpdate the draft based on the creator\'s answers. Adjust all related fields — for example, if the creator specified the product, also update the TDP, sales tactic, description, and SEO keywords accordingly.' +
    '\n\nReturn the complete updated JSON in the exact same format. Include updated field_confidence values (answers from the creator should raise confidence to "high" for answered fields and may improve related fields).';
}

function refineDraftWithAnswers(payload) {
  const originalDraft = payload.originalDraft;
  const creatorAnswers = payload.creatorAnswers;
  const sessionId = payload.sessionId || '';

  logAnalyticsEvent_('refinement_requested', {
    sessionId: sessionId,
    metadata: { fieldsRefined: Object.keys(creatorAnswers || {}) }
  });

  const prompt = buildRefinementPrompt_(originalDraft, creatorAnswers);
  const content = callGemini_(prompt, []);
  const draft = normalizeDraft(parseModelJson(content));
  return {
    success: true,
    draft: draft,
    modelUsed: MODEL_ID,
    promptVersion: PROMPT_VERSION,
    generatedAt: new Date().toISOString(),
    refined: true
  };
}

function extractDuration_(html) {
  const source = String(html || '');

  const metaDuration = extractMetaContent_(source, 'property', 'og:video:duration')
    || extractMetaContent_(source, 'name', 'duration');
  if (metaDuration) {
    const secs = parseInt(metaDuration, 10);
    if (secs > 0) {
      const mins = Math.ceil(secs / 60);
      return mins + ' min';
    }
  }

  const durationAttrMatch = source.match(/\bduration["']?\s*[:=]\s*["']?(\d+(?:\.\d+)?)\s*(min|sec|s|m)/i);
  if (durationAttrMatch) {
    let val = parseFloat(durationAttrMatch[1]);
    const unit = durationAttrMatch[2].toLowerCase();
    if (unit === 'sec' || unit === 's') val = Math.ceil(val / 60);
    if (val > 0) return Math.ceil(val) + ' min';
  }

  const textMatch = source.match(/(\d+(?:\.\d+)?)\s*(?:min(?:ute)?s?)\b/i);
  if (textMatch) {
    const m = Math.ceil(parseFloat(textMatch[1]));
    if (m > 0 && m < 120) return m + ' min';
  }

  return '';
}

function fetchGuideContent_(arcadeUrlOrId) {
  const parsed = normalizeArcadeUrlInput_(arcadeUrlOrId);
  const fetchResult = fetchFirstWorkingGuidePage_(parsed);

  const html = fetchResult.html;

  const links = extractLinks_(html).slice(0, 12);
  const imageTexts = extractImageAltTexts_(html).slice(0, 15);
  const imageUrls = extractImageUrls_(html, fetchResult.guideUrl);
  const steps = extractStepsWithImages_(html);
  const possibleStepTexts = extractPossibleStepTexts_(html).slice(0, 20);
  const bodyText = cleanText(stripHtml_(html));
  const duration = extractDuration_(html);

  const title = cleanText(
    extractBestGuideTitle_(html) ||
    possibleStepTexts[0] ||
    ''
  );

  return {
    arcadeId: parsed.arcadeId,
    sourceUrl: parsed.originalUrl,
    shareUrl: parsed.shareUrl,
    preferredShareUrl: parsed.preferredShareUrl,
    urlType: parsed.urlType,
    guideUrl: fetchResult.guideUrl,
    title,
    bodyText: bodyText.slice(0, 3000),
    stepTexts: possibleStepTexts,
    imageTexts,
    imageUrls,
    steps,
    links,
    duration,
    warnings: parsed.warnings || []
  };
}


function fetchFirstWorkingGuidePage_(parsed) {
  const errors = [];

  for (let i = 0; i < parsed.guideCandidates.length; i++) {
    const guideUrl = parsed.guideCandidates[i];

    try {
      const response = UrlFetchApp.fetch(guideUrl, {
        method: 'get',
        followRedirects: true,
        muteHttpExceptions: true,
        headers: {
          'User-Agent': 'Interactive Experience Intake Assistant'
        }
      });

      const status = response.getResponseCode();
      const html = response.getContentText();

      if (status >= 200 && status < 300 && html && html.length > 200) {
        return { guideUrl, html, status };
      }

      errors.push(`${guideUrl} returned ${status}`);
    } catch (error) {
      errors.push(`${guideUrl}: ${error.message || error}`);
    }
  }

  const editUrlNote = parsed.urlType === 'arcade-edit'
    ? ' The URL you entered looks like an edit URL, which may not be accessible for guide extraction.'
    : '';

  throw new Error(
    `I recognized the interactive demo ID (${parsed.arcadeId}), but could not fetch the guide content.${editUrlNote} ` +
    `Please use the share URL in this format: ${PREFERRED_ARCADE_SHARE_URL_EXAMPLE}`
  );
}

function callGemini_(prompt, interleavedParts) {
  const apiKey = PropertiesService.getScriptProperties().getProperty(GEMINI_API_KEY_PROP);
  if (!apiKey) throw new Error('Missing GEMINI_API_KEY in Script Properties.');

  const result = callGeminiWithModel_(MODEL_ID, apiKey, prompt, interleavedParts);
  if (result.deprecatedModel) {
    const fallbackResult = callGeminiWithModel_(FALLBACK_MODEL_ID, apiKey, prompt, interleavedParts);
    notifyModelDeprecation_(MODEL_ID, FALLBACK_MODEL_ID);
    return fallbackResult.content;
  }
  return result.content;
}

function callGeminiWithModel_(modelId, apiKey, prompt, interleavedParts) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${apiKey}`;

  const parts = [{ text: prompt }];
  if (interleavedParts && interleavedParts.length > 0) {
    interleavedParts.forEach(function(part) {
      parts.push(part);
    });
  }

  const requestPayload = {
    contents: [
      {
        role: 'user',
        parts: parts
      }
    ],
    generationConfig: {
      temperature: 0.1,
      maxOutputTokens: 8192,
      responseMimeType: 'application/json'
    }
  };

  const options = {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(requestPayload),
    muteHttpExceptions: true
  };

  let lastError;
  for (let attempt = 0; attempt < 3; attempt++) {
    const response = UrlFetchApp.fetch(url, options);
    const status = response.getResponseCode();
    const body = response.getContentText();

    if (status === 404) {
      return { deprecatedModel: true };
    }

    if (status === 429 || status === 503) {
      lastError = new Error('Gemini API error ' + status + ' (attempt ' + (attempt + 1) + '/3)');
      Utilities.sleep(1000 * Math.pow(2, attempt));
      continue;
    }

    if (status !== 200) {
      throw new Error('Gemini API error ' + status + ': ' + body);
    }

    let result;
    try {
      result = JSON.parse(body);
    } catch (e) {
      throw new Error('Gemini returned invalid JSON response');
    }

    if (result.promptFeedback && result.promptFeedback.blockReason) {
      throw new Error('Gemini blocked prompt: ' + result.promptFeedback.blockReason);
    }

    const content = result.candidates && result.candidates[0] &&
      result.candidates[0].content && result.candidates[0].content.parts &&
      result.candidates[0].content.parts[0] && result.candidates[0].content.parts[0].text;

    if (!content) throw new Error('Gemini returned empty content.');
    return { content: content };
  }
  throw lastError;
}

function notifyModelDeprecation_(oldModel, fallbackModel) {
  const props = PropertiesService.getScriptProperties();
  const notifiedKey = 'MODEL_DEPRECATION_NOTIFIED_' + oldModel;
  if (props.getProperty(notifiedKey)) return;

  try {
    const ownerEmail = props.getProperty('ADMIN_NOTIFY_EMAIL') || Session.getEffectiveUser().getEmail();
    MailApp.sendEmail({
      to: ownerEmail,
      subject: '[Arcade Intake] Gemini model "' + oldModel + '" has been deprecated',
      body: 'The Gemini model "' + oldModel + '" returned a 404 (not found) error.\n\n' +
        'The app automatically fell back to "' + fallbackModel + '" so creators are not affected, ' +
        'but you should update MODEL_ID in Code.js to a specific stable model.\n\n' +
        'Current fallback: ' + fallbackModel + '\n' +
        'Time: ' + new Date().toISOString()
    });
  } catch (e) {
    Logger.log('Failed to send deprecation notification: ' + e.message);
  }

  props.setProperty(notifiedKey, new Date().toISOString());
}

function extractFirstTagText_(html, tagName) {
  const safeTag = String(tagName || '').replace(/[^\w-]/g, '');
  if (!safeTag) return '';

  const re = new RegExp(
    '<' + safeTag + '\\b[^>]*>([\\s\\S]*?)<\\/' + safeTag + '>',
    'i'
  );

  const match = String(html || '').match(re);
  return match ? cleanText(stripHtml_(match[1])) : '';
}

function extractTitle_(html) {
  return extractFirstTagText_(html, 'title')
    .replace(/\s*\|\s*Arcade\s*$/i, '')
    .replace(/\s*-\s*Arcade\s*$/i, '')
    .trim();
}
function extractBestGuideTitle_(html) {
  const candidates = [
    extractFirstTagText_(html, 'h1'),
    extractMetaContent_(html, 'property', 'og:title'),
    extractMetaContent_(html, 'name', 'twitter:title'),
    extractMetaContent_(html, 'name', 'title'),
    extractTitle_(html)
  ];

  for (let i = 0; i < candidates.length; i++) {
    const title = cleanText(candidates[i]);

    if (
      title &&
      title.length > 2 &&
      !/^arcade$/i.test(title) &&
      !/^interactive guide$/i.test(title)
    ) {
      return title;
    }
  }

  return '';
}

function extractMetaContent_(html, attrName, attrValue) {
  const source = String(html || '');
  const attr = String(attrName || '').replace(/[^\w-]/g, '');
  const value = String(attrValue || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  if (!attr || !value) return '';

  const re = new RegExp(
    '<meta\\b[^>]*\\b' + attr + '=["\\\']' + value + '["\\\'][^>]*>',
    'i'
  );

  const match = source.match(re);
  if (!match) return '';

  const tag = match[0];
  const contentMatch = tag.match(/\bcontent=["']([^"']*)["']/i);

  return contentMatch ? decodeHtml_(contentMatch[1]) : '';
}
function extractLinks_(html) {
  const out = [];
  const re = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match;
  while ((match = re.exec(String(html || ''))) !== null) {
    const href = cleanText(decodeHtml_(match[1]));
    const label = cleanText(stripHtml_(match[2]));
    if (href) out.push({ label, href });
  }
  return out;
}

function extractImageAltTexts_(html) {
  const out = [];
  const re = /<img\b[^>]*alt=["']([^"']+)["'][^>]*>/gi;
  let match;
  while ((match = re.exec(String(html || ''))) !== null) {
    const alt = cleanText(decodeHtml_(match[1]));
    if (alt && !out.includes(alt)) out.push(alt);
  }
  return out;
}

function extractImageUrls_(html, baseUrl) {
  const re = /<img\b[^>]*src=["']([^"']+)["'][^>]*>/gi;
  const seenKeys = {};
  const out = [];
  let match;

  while ((match = re.exec(String(html || ''))) !== null) {
    let src = decodeHtml_(match[1]);

    if (src.indexOf('watermark-logos/') !== -1) continue;

    const innerIdx = src.indexOf('/https://');
    if (innerIdx !== -1) {
      src = src.slice(innerIdx + 1);
    }

    src = src.replace(/&hotspot=[^&]*/g, '');

    let dedupKey = src;
    try {
      const qIdx = src.indexOf('image=');
      if (qIdx !== -1) {
        const imageParam = decodeURIComponent(src.slice(qIdx + 6).split('&')[0]);
        const pathEnd = imageParam.indexOf('?');
        dedupKey = pathEnd !== -1 ? imageParam.slice(0, pathEnd) : imageParam;
      }
    } catch (e) {}

    if (!seenKeys[dedupKey]) {
      seenKeys[dedupKey] = true;
      out.push(src);
    }
  }

  return out;
}

function extractStepsWithImages_(html) {
  const re = /<img\b[^>]*?\bsrc=["']([^"']+)["'][^>]*?\balt=["']([^"']*)["'][^>]*>|<img\b[^>]*?\balt=["']([^"']*)["'][^>]*?\bsrc=["']([^"']+)["'][^>]*>/gi;
  const seenKeys = {};
  const steps = [];
  let match;

  while ((match = re.exec(String(html || ''))) !== null) {
    let src = decodeHtml_(match[1] || match[4]);
    const alt = decodeHtml_(match[2] != null ? match[2] : (match[3] || ''));

    if (src.indexOf('watermark-logos/') !== -1) continue;

    const innerIdx = src.indexOf('/https://');
    if (innerIdx !== -1) src = src.slice(innerIdx + 1);
    src = src.replace(/&hotspot=[^&]*/g, '');

    let dedupKey = src;
    try {
      const qIdx = src.indexOf('image=');
      if (qIdx !== -1) {
        const imageParam = decodeURIComponent(src.slice(qIdx + 6).split('&')[0]);
        const pathEnd = imageParam.indexOf('?');
        dedupKey = pathEnd !== -1 ? imageParam.slice(0, pathEnd) : imageParam;
      }
    } catch (e) {}

    if (!seenKeys[dedupKey]) {
      seenKeys[dedupKey] = true;
      steps.push({ text: alt, imageUrl: src });
    }
  }

  return steps;
}

function fetchImagesAsBase64_(imageUrls) {
  const images = [];
  const errors = [];

  if (!imageUrls || !imageUrls.length) return { images: images, errors: errors };

  const requests = imageUrls.map(function(url) {
    return {
      url: url,
      method: 'get',
      muteHttpExceptions: true,
      headers: { 'User-Agent': 'Interactive Experience Intake Assistant' }
    };
  });

  const responses = UrlFetchApp.fetchAll(requests);

  for (let i = 0; i < responses.length; i++) {
    try {
      const resp = responses[i];
      const status = resp.getResponseCode();
      if (status < 200 || status >= 300) {
        errors.push('HTTP ' + status + ' for image ' + (i + 1));
        images.push(null);
        continue;
      }

      const contentType = resp.getHeaders()['Content-Type'] || '';
      if (contentType.indexOf('image/') !== 0) {
        errors.push('Not an image: ' + contentType);
        images.push(null);
        continue;
      }

      const blob = resp.getBlob();
      const bytes = blob.getBytes();

      if (bytes.length > 1024 * 1024) {
        errors.push('Image too large: ' + bytes.length + ' bytes');
        images.push(null);
        continue;
      }

      const base64 = Utilities.base64Encode(bytes);
      const mime = contentType.split(';')[0].trim() || 'image/png';

      images.push({
        base64: base64,
        mimeType: mime,
        sizeBytes: bytes.length
      });
    } catch (e) {
      errors.push('Image ' + (i + 1) + ': ' + (e.message || String(e)));
      images.push(null);
    }
  }

  return { images: images, errors: errors };
}

function extractPossibleStepTexts_(html) {
  const out = [];
  const tags = 'h1|h2|h3|p|li|figcaption|button|span|div';
  const re = new RegExp(`<(${tags})\\b[^>]*>([\\s\\S]*?)<\\/\\1>`, 'gi');
  let match;
  while ((match = re.exec(String(html || ''))) !== null) {
    const text = cleanText(stripHtml_(match[2]));
    if (text && text.length > 12 && text.length < 500 && !out.includes(text)) {
      out.push(text);
    }
    if (out.length >= 80) break;
  }
  return out;
}

function stripHtml_(html) {
  return decodeHtml_(String(html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\\n')
    .replace(/<\/(p|li|h1|h2|h3|div|figcaption|button|span)>/gi, '\n')
    .replace(/<[^>]+>/g, ' '));
}

function decodeHtml_(value) {
  return String(value || '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function buildMetadataPrompt(extractedGuide) {
  const isYouTube = extractedGuide.isYouTube === true;
  const contentTypePhrase = isYouTube ? 'YouTube video' : 'interactive demo';

  Logger.log('buildMetadataPrompt - isYouTube: ' + isYouTube);
  Logger.log('buildMetadataPrompt - extractedGuide.isYouTube: ' + extractedGuide.isYouTube);

  return `
You are helping prepare an intake submission for a Red Hat ${contentTypePhrase}.

Use only the guide content provided below. Do not invent product features, metrics, customer names, claims, or unsupported benefits.

${isYouTube
  ? 'This is a YouTube video. Base your analysis on the video title and description provided below.'
  : 'The guide\'s step-by-step screenshots are attached in sequence. Treat them as if you are watching the full demo video from start to finish. Each image is labeled with its step number and text description. Go through every step in order and build a complete mental picture of:\n- What product or solution is being demonstrated\n- What the user does at each stage (install, configure, connect, create, deploy, etc.)\n- What UI screens, dialogs, and navigation elements appear\n- What the end result or outcome of the demo is'}
Use this full understanding of the demo flow to inform every field in your response — especially the description, product suggestions, and SEO keywords.

Return ONLY valid JSON that can be parsed by JSON.parse().
Do not include markdown fences.
Do not include comments.
Do not include explanation.
Do not include text before or after the JSON.
Use double quotes for all JSON keys and string values.
Do not use trailing commas.
Escape any quotes or special characters so the JSON remains valid.

Keep all values concise.
Each confidence note must be under 20 words.
Each field needing confirmation must be only the field name, not a sentence.
Do not include long explanations.

The response must be a single JSON object with exactly these fields:
{
  "demo_title": "",
  "content_type_suggestion": "",
  "description_without_gid": "",
  "description_for_seo": "",
  "language_suggestions": [],
  "cta_link_suggestions": [],
  "seo_keywords": [],
  "vertical_suggestion": "",
  "event_or_project_suggestion": "",
  "primary_product_suggestion": "",
  "other_products_suggestion": [],
  "other_products_other_text": "",
  "primary_topic_suggestion": "",
  "other_topics_suggestion": [],
  "tdp_suggestion": "",
  "sales_tactic_suggestion": "",
  "marketing_program_suggestion": "",
  "group_suggestion": "",
  "tour_highlights": [],
  "field_confidence": {},
  "confidence_notes": [],
  "fields_needing_creator_confirmation": []
}

Description + tour highlights (these two fields are displayed together as one combined block — write them as a pair):

description_without_gid — the opening paragraph (high-level "what and why"):
- EXACTLY 2 sentences, 30-50 words. No third sentence allowed.
- Sentence 1: Focus on WHY this matters — what the user gains or what problem it solves. ${isYouTube ? 'E.g., "This YouTube video shows how [product] [solves problem / enables outcome] for [audience]."' : 'E.g., "This interactive demo helps [audience] [benefit/value] with [product]." or "See how [product] [solves problem / enables outcome] for [audience]."'}
- Sentence 2: Briefly state the scope at a high level WITHOUT naming steps. E.g., "It walks through the full [setup / onboarding / workflow] experience from start to finish."
- BANNED patterns — if ANY appear, rewrite before returning:
  * Action verbs from the demo (installing, configuring, connecting, enabling, activating, generating, deploying, creating, setting up, signing in, reviewing, accepting, providing, migrating, building)
  * "It covers" followed by anything
  * "from [action] to [action]" (e.g., "from installing to generating")
  * Listing actions with "and" (e.g., "installing X and connecting Y")
  ${isYouTube ? '* Using "This interactive demo" when the content is a YouTube video (must use "This YouTube video" instead)' : ''}

tour_highlights — the bullet list (specific "how"):
- 3 to 6 bullets listing every key step, tool, and action the demo shows.
- Each bullet: sentence fragment starting with a verb or "How to..." phrasing.
- Be specific: name UI elements, dashboard panels, commands, config values, metrics, and tools visible in the screenshots.
- Order bullets to follow the demo flow from start to finish.
- Bad: "Shows the product dashboard" — too vague.
- Good: "Tracking per-pod cache hit rates, token throughput, and latency in Grafana" — specific.

The rule that connects them: description says the "what and why" with ZERO specifics. tour_highlights say ALL the specifics. There must be ZERO overlap. If the description names an action, the tour highlight for that action becomes redundant — so the description must never name actions.

CORRECT example (write them as a pair like this):
  ${isYouTube
    ? 'description_without_gid: "This YouTube video shows how Red Hat AI helps organizations safely transition autonomous AI agents from developer laptops to secure, production-ready environments. It walks through the complete enterprise architecture and governance workflow from start to finish."\n  tour_highlights: ["Deploying autonomous multi-agent systems using Kagenti to bring your own agent", "Applying zero-trust flow with SPIFFE and SPIRE for secure workload identity", "Establishing a secure gateway using the Model Context Protocol (MCP)", "Delivering full model traceability in a private AI environment with Models-as-a-Service powered by llm-d", "Implementing agent guardrails to block biased or harmful responses"]'
    : 'description_without_gid: "See how Ansible Lightspeed brings AI-assisted automation to your Ansible workflows in Visual Studio Code. This interactive demo walks through the full setup and first-use experience from start to finish."\n  tour_highlights: ["Installing the Red Hat Ansible extension from the VS Code Extensions Marketplace", "Enabling Ansible Lightspeed and inline suggestions in the extension settings", "Connecting to Ansible Lightspeed using a Red Hat customer portal account", "Activating the 90-day trial by accepting terms and conditions", "Generating an Ansible playbook using natural language prompts"]'}

WRONG example (DO NOT do this):
  description_without_gid: "This guide walks developers through activating a 90-day trial of Ansible Lightspeed within Visual Studio Code. It covers the full setup from installing the extension and connecting a Red Hat account to generating AI-powered Ansible playbooks."
  — WRONG: 3 banned verbs (installing, connecting, generating), uses "It covers", uses "from X to Y" pattern. The tour_highlights would just repeat everything the description already said.

SEO rules:
- description_for_seo: 25-45 words, one concise search-focused summary of what the page helps users do.
- Identify one primary SEO keyword phrase. Use it naturally in description_for_seo.
- Include 5-8 SEO keyword phrases specific to the product, use case, and user intent.
- Always include the primary product name and its common variations as keywords.
- Avoid keyword stuffing, vague standalone keywords ("cloud", "AI"), and unsupported claims.
- Do not include competitor names unless the guide content clearly mentions them.

Important field rules:
- Do not decide content_type_suggestion. Return an empty string for content_type_suggestion. The creator must choose Content Type.
- Do not decide vertical_suggestion. Return an empty string for vertical_suggestion. The creator must choose the Vertical.
- Do not decide event_or_project_suggestion. Return an empty string for event_or_project_suggestion. The creator must choose the Event or Project.
- Do not make a group_suggestion. Return an empty string for group_suggestion. The creator must decide grouping manually.
- Do not include Group, Vertical, or Event/Project in fields_needing_creator_confirmation.
- For language_suggestions, choose one or more values only from the allowed Language options.
- For primary_product_suggestion, choose only from the allowed Product options.
- For other_products_suggestion, choose zero or more values only from the allowed Product options.
- If the guide references a product not in the allowed list, include "Other" in other_products_suggestion AND set other_products_other_text to the actual product name(s) (e.g., "Veeam Kasten, Portworx"). If "Other" is selected but you cannot identify the product name, set other_products_other_text to "" and include "other_products_suggestion" in fields_needing_creator_confirmation.
${isYouTube
  ? '- Do NOT generate primary_topic_suggestion or other_topics_suggestion for YouTube videos. Return empty string and empty array respectively. Topics are only used for interactive demos.'
  : '- For primary_topic_suggestion, choose only from the allowed Topic options.\n- For other_topics_suggestion, choose zero or more values only from the allowed Topic options.'}
- For tdp_suggestion, choose only from the allowed Technology Decision Point options.
- For sales_tactic_suggestion, choose only from the allowed Sales Tactic options.
- For marketing_program_suggestion, choose only from the allowed Marketing Program options.
- If there is not enough evidence, choose "N/A" where available and add the field name to fields_needing_creator_confirmation.
- Do not create new taxonomy values.
- Do not use CTA links found in the guide page.
- For cta_link_suggestions, choose exactly 3 links from the approved CTA link catalog below.
- Each CTA link must be an object with "label", "url", and "reason".
- Only use URLs exactly as provided in the approved CTA link catalog.
- Prefer links that match the guide's primary product, TDP, and use case.
- Prefer this order when relevant: trial, interactive lab, learning hub, documentation, product page.
- Do not invent URLs.

field_confidence rules:
- Return a "field_confidence" object where each key is a field name and the value is "high", "medium", or "low".
- Include confidence for: demo_title, description_without_gid, description_for_seo, language_suggestions, seo_keywords, primary_product_suggestion, other_products_suggestion, ${isYouTube ? '' : 'primary_topic_suggestion, other_topics_suggestion, '}tdp_suggestion, sales_tactic_suggestion, marketing_program_suggestion, cta_link_suggestions, tour_highlights.
- "high" = strong direct evidence from guide text and screenshots.
- "medium" = reasonable inference but some assumptions were made.
- "low" = weak or no evidence, best guess or taxonomy fallback used.
- Do not include confidence for content_type_suggestion, group_suggestion, vertical_suggestion, or event_or_project_suggestion.
- If a field uses a fallback value like "N/A" or "No", its confidence should be "low" unless the guide clearly supports that answer.

AI generation details rules:
* confidence_notes will be shown in the "How this draft was generated" section.
* Include 4 to 6 short notes.
* The FIRST note must be a brief demo flow summary: describe the full journey the demo takes the user through, from beginning to end, in one sentence. For example: "Demo walks through installing the Ansible VS Code extension, enabling Lightspeed, connecting a Red Hat account, activating a 90-day trial, and generating a playbook."
* The SECOND note should mention what was visually identified from the screenshots that text alone would not reveal (e.g., product branding, UI layout, specific dialog screens, navigation paths).
* Remaining notes: focus on how the guide content was interpreted.
* Mention the main content signal, such as setup flow, migration flow, backup workflow, trial activation, or product overview.
* Mention any important assumptions made from the guide title, step text, or repeated product terms.
* Mention weak or missing evidence only if it affects review.
* Do not comment on every field.
* Do not mention fields left blank by instruction, such as Content Type or Group.
* Do not say "as per instructions."
* Do not use generic notes like "Generated from guide content" or "Please review all fields."
* Good notes explain what the model saw in the pulled content and how that shaped the draft.

Taxonomy fallback rules:
- If a field has "N/A" as an allowed option and the guide does not provide enough evidence, use "N/A".
- If a product is clearly mentioned but not available in the allowed Product options, use "Other" and add "Primary Product" or "Other Products" to fields_needing_creator_confirmation.
- Do not guess a Sales Tactic or Marketing Program only from the product name. Use the guide's use case, task, and audience as evidence.

CTA fallback rules:
- Always return exactly 3 CTA links.
- If there is not enough guide-specific evidence for 3 product-specific links, fill the remaining slots with approved general links from the catalog.
- Prefer this fallback order when relevant:
  1. Product trial or product learning hub
  2. Red Hat interactive labs
  3. Product documentation
  4. Product page
  5. All Red Hat products
- Never return fewer than 3 CTA links.
- Never use duplicate CTA URLs.

Approved CTA link catalog:
${toCtaCatalogText(CTA_LINK_CATALOG)}

Allowed Content Type options:
${toOptionList(FIELD_OPTIONS.contentTypes)}

Allowed Language options:
${toOptionList(FIELD_OPTIONS.languages)}

Allowed Vertical options:
${toOptionList(FIELD_OPTIONS.verticals)}

Allowed Event options:
${toOptionList(FIELD_OPTIONS.events)}

Allowed Product options:
${toOptionList(FIELD_OPTIONS.products)}

Allowed Topic options:
${toOptionList(FIELD_OPTIONS.topics)}

Allowed Technology Decision Point options:
${toOptionList(FIELD_OPTIONS.tdps)}

Allowed Sales Tactic options:
${toOptionList(FIELD_OPTIONS.salesTactics)}

Allowed Marketing Program options:
${toOptionList(FIELD_OPTIONS.marketingPrograms)}

Guide URL:
${extractedGuide.guideUrl}

Guide title:
${extractedGuide.title}

Extracted step text:
${(extractedGuide.stepTexts || []).map((text, index) => `${index + 1}. ${text}`).join('\n')}

Image alt/caption text:
${(extractedGuide.imageTexts || []).map((text, index) => `${index + 1}. ${text}`).join('\n')}

Links:
${(extractedGuide.links || []).map((link, index) => `${index + 1}. ${link.label}: ${link.href}`).join('\n')}

Full body text excerpt:
${extractedGuide.bodyText || ''}
`;
}

function parseModelJson(content) {
  if (!content) {
    throw new Error('Empty model content');
  }

  let cleaned = String(content)
    .replace(/^﻿/, '')
    .trim();

  cleaned = cleaned
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  const start = cleaned.indexOf('{');

  if (start === -1) {
    throw new Error('No opening JSON brace found');
  }

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < cleaned.length; i++) {
    const char = cleaned[i];

    if (escaped) {
      escaped = false;
      continue;
    }

    if (char === '\\' && inString) {
      escaped = true;
      continue;
    }

    if (char === '"') {
      inString = !inString;
      continue;
    }

    if (!inString) {
      if (char === '{') depth++;
      if (char === '}') depth--;

      if (depth === 0) {
        const jsonText = cleaned.slice(start, i + 1);
        const repaired = jsonText.replace(/,\s*([}\]])/g, '$1');
        return JSON.parse(repaired);
      }
    }
  }

  throw new Error('No complete JSON object found');
}

function normalizeStringArray(value) {
  if (Array.isArray(value)) {
    return value.filter(Boolean).map(String);
  }

  if (typeof value === 'string' && value.trim()) {
    return [value.trim()];
  }

  return [];
}

function normalizeCtaSuggestions_(draft) {
  const rawCtas = Array.isArray(draft.cta_link_suggestions)
    ? draft.cta_link_suggestions
    : [];

  const allowedUrlSet = new Set(CTA_LINK_CATALOG.map(item => item.url));
  const usedUrls = new Set();

  const normalized = [];

  rawCtas.forEach(item => {
    if (!item || !item.url) return;
    if (!allowedUrlSet.has(item.url)) return;
    if (usedUrls.has(item.url)) return;

    const catalogItem = CTA_LINK_CATALOG.find(c => c.url === item.url);

    normalized.push({
      label: item.label || catalogItem.label,
      url: item.url,
      reason: item.reason || 'Recommended next step'
    });

    usedUrls.add(item.url);
  });

  const primaryProduct = String(draft.primary_product_suggestion || '').trim();

  const productFallbacks = CTA_LINK_CATALOG.filter(item => {
    return item.products.includes(primaryProduct);
  });

  const generalFallbacks = CTA_LINK_CATALOG.filter(item => {
    return item.products.includes('general');
  });

  const fallbackCandidates = [
    ...productFallbacks,
    ...generalFallbacks
  ];

  fallbackCandidates.forEach(item => {
    if (normalized.length >= 3) return;
    if (usedUrls.has(item.url)) return;

    normalized.push({
      label: item.label,
      url: item.url,
      reason: 'Added as a fallback CTA'
    });

    usedUrls.add(item.url);
  });

  return normalized.slice(0, 3);
}

function normalizeDraft(draft) {
  return {
    demo_title: draft.demo_title || '',
    content_type_suggestion: '',
    description_without_gid: draft.description_without_gid || draft.description_with_gid || '',
    description_for_seo: draft.description_for_seo || '',
    language_suggestions: normalizeStringArray(draft.language_suggestions || draft.language_suggestion),
cta_link_suggestions: normalizeCtaSuggestions_(draft),
    seo_keywords: normalizeStringArray(draft.seo_keywords),
    vertical_suggestion: draft.vertical_suggestion || '',
    event_or_project_suggestion: draft.event_or_project_suggestion || '',
    primary_product_suggestion: draft.primary_product_suggestion || '',
    other_products_suggestion: normalizeStringArray(draft.other_products_suggestion),
    other_products_other_text: draft.other_products_other_text || '',
    primary_topic_suggestion: draft.primary_topic_suggestion || '',
    other_topics_suggestion: normalizeStringArray(draft.other_topics_suggestion),
    tdp_suggestion: draft.tdp_suggestion || '',
    sales_tactic_suggestion: draft.sales_tactic_suggestion || '',
    marketing_program_suggestion: draft.marketing_program_suggestion || '',
    group_suggestion: '',
    tour_highlights: normalizeStringArray(draft.tour_highlights),
    field_confidence: draft.field_confidence && typeof draft.field_confidence === 'object'
      ? draft.field_confidence
      : {},
    confidence_notes: normalizeStringArray(draft.confidence_notes),
    fields_needing_creator_confirmation: normalizeStringArray(draft.fields_needing_creator_confirmation)
      .filter(field => String(field).toLowerCase() !== 'group')
  };
}

function buildGuideExtractionJson_(extractedGuide) {
  const stepTexts = extractedGuide.stepTexts || [];
  const stepsWithImages = extractedGuide.steps || [];
  const maxLen = Math.max(stepTexts.length, stepsWithImages.length);

  const steps = [];
  for (let i = 0; i < maxLen; i++) {
    const imgStep = stepsWithImages[i] || {};
    steps.push({
      stepNumber: i + 1,
      text: stepTexts[i] || imgStep.text || '',
      imageUrl: imgStep.imageUrl || '',
      imageAlt: imgStep.text || ''
    });
  }

  return {
    arcadeId: extractedGuide.arcadeId || '',
    title: extractedGuide.title || '',
    guideUrl: extractedGuide.guideUrl || '',
    shareUrl: extractedGuide.shareUrl || '',
    duration: extractedGuide.duration || '',
    steps: steps,
    links: extractedGuide.links || [],
    bodyText: extractedGuide.bodyText || '',
    extractedAt: new Date().toISOString()
  };
}

function truncateGuideJson_(json) {
  const MAX_CHARS = 49000;
  if (json.length <= MAX_CHARS) return json;

  const obj = JSON.parse(json);
  obj.bodyText = '';
  let trimmed = JSON.stringify(obj);
  if (trimmed.length <= MAX_CHARS) return trimmed;

  while (obj.steps.length > 0 && trimmed.length > MAX_CHARS) {
    obj.steps.pop();
    trimmed = JSON.stringify(obj);
  }
  obj.truncated = true;
  return JSON.stringify(obj);
}
