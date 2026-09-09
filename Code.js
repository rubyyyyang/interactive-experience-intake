/***************************************
 * Code.js - Web app entry points, intake form processing,
 * analytics, workflow queue, and backfill utilities.
 *
 * Split from original monolith. Related files:
 * - IA_Config.js — constants, column definitions, config helpers
 * - IA_Gemini.js — Gemini API, prompt building, response parsing
 * - IA_StatusTracker.js — StatusTracker data endpoints
 ***************************************/

function doGet(e) {
  const page = e && e.parameter && e.parameter.page;
  const baseUrl = ScriptApp.getService().getUrl() || '';

  if (page === 'status') {
    const template = HtmlService.createTemplateFromFile('StatusTracker');
    template.webAppBaseUrl = baseUrl;
    template.token = (e && e.parameter && e.parameter.token) || '';
    return template.evaluate()
      .setTitle('Interactive Experience Status Tracker')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }

  logAnalyticsEvent_('session_start', {});
  const template = HtmlService.createTemplateFromFile('Index');
  template.webAppBaseUrl = baseUrl;
  return template.evaluate()
    .setTitle('Interactive Experience Intake')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function getUserEmail() {
  try {
    const email = Session.getActiveUser().getEmail();
    return { success: true, email: email || '' };
  } catch (e) {
    return { success: true, email: '' };
  }
}

function getOptions() {
  return {
    success: true,
    options: FIELD_OPTIONS
  };
}

function submitIntakeForReview(payload) {
  const form = payload && payload.form;
  const extractedGuide = payload && payload.extractedGuide;
  const aiMeta = payload && payload.aiMeta;

  if (!form) throw new Error('Missing form data');

  const submittedAt = new Date().toISOString();
  const globalId = Utilities.getUuid();

  const creatorTeamFinal = form.creatorTeams === 'Other'
    ? `Other: ${form.creatorTeamOther || ''}`
    : form.creatorTeams || '';

  const contentTypeFinal = form.contentType === 'Other'
    ? `Other: ${form.contentTypeOther || ''}`
    : form.contentType || '';

  const quarterFinal = form.quarter === 'Other'
    ? `Other: ${form.quarterOther || ''}`
    : form.quarter || '';

  const eventFinal = form.event === 'Other'
    ? `Other: ${form.eventOther || ''}`
    : form.event || '';

  const languageFinal = [
    ...(Array.isArray(form.language) ? form.language.filter(item => item !== 'Other') : []),
    form.languageOther ? `Other: ${form.languageOther}` : ''
  ].filter(Boolean).join(', ');

  const primaryProductFinal = form.primaryProduct === 'Other'
    ? `Other: ${form.primaryProductOther || ''}`
    : form.primaryProduct || '';

  const otherProductsFinal = [
    ...(Array.isArray(form.otherProducts) ? form.otherProducts.filter(item => item !== 'Other') : []),
    form.otherProductsOther ? `Other: ${form.otherProductsOther}` : ''
  ].filter(Boolean).join(', ');

  const ctaLinksFinal = Array.isArray(form.ctaLinks)
    ? form.ctaLinks.join('\n')
    : form.ctaLink || '';

  const submission = {
    'Timestamp': submittedAt,
    'Email Address': form.email || '',
    'Creator Name(s)': stripFormulaPrefix_(form.creatorName),
    'Creator Team(s)': stripFormulaPrefix_(creatorTeamFinal),
    'Final Demo Title': stripFormulaPrefix_(form.demoTitle),
    'Creation Link': form.creationLink || '',
    'Submitted Arcade URL': form.arcadeUrl || '',
    'Normalized Share URL': extractedGuide && extractedGuide.shareUrl || form.creationLink || '',
    'Content Type': stripFormulaPrefix_(contentTypeFinal),
    'What quarter was this content created in?': stripFormulaPrefix_(quarterFinal),
    'Interactive Experience Description (50-150 words)': stripFormulaPrefix_(form.descriptionWithoutGid),
    'Description (50-150 words)': stripFormulaPrefix_(form.descriptionWithGid || form.descriptionWithoutGid),
    'Description for SEO': stripFormulaPrefix_(form.descriptionForSeo),
    'Language': stripFormulaPrefix_(languageFinal),
    'Links for next step call to action': ctaLinksFinal,
    'Keywords for SEO': stripFormulaPrefix_(form.seoKeywords),
    'Vertical': stripFormulaPrefix_(form.vertical),
    'Is this for a specific event or project?': stripFormulaPrefix_(eventFinal),
    'Primary product featured?': stripFormulaPrefix_(primaryProductFinal),
    'Optional: Other related products?': stripFormulaPrefix_(otherProductsFinal),
    'Related Technology Decision Point?': stripFormulaPrefix_(form.tdp),
    'Related Sales Tactic?': stripFormulaPrefix_(form.salesTactic),
    'Related Marketing Program?': stripFormulaPrefix_(form.marketingProgram),
    'Synthetic Voice Used?': form.syntheticVoice || '',
    'Translation Used?': form.translation || '',
    'Mobile-friendly design considered?': form.mobileFriendly || '',
    'Duration': form.duration || '',
    'Optional: Should this IE be grouped with another or part of a larger collection? If yes, add the name of the IE it belongs with.': stripFormulaPrefix_(form.group),
    'Optional: Have an Employee Advocacy link? Add it here.': form.employeeAdvocacy || '',
    'Destination Channels': Array.isArray(form.distributionChannels) ? form.distributionChannels.join(', ') : '',
    'Requirements confirmed': form.requirementsConfirmed ? 'Yes' : 'No',
    'Arcade ID': form.arcadeId || '',
    'Guide URL': extractedGuide && extractedGuide.guideUrl || form.creationLink || '',
    'AI Model Used': aiMeta && aiMeta.modelUsed || '',
    'AI Prompt Version': aiMeta && aiMeta.promptVersion || '',
    'AI Generated At': aiMeta && aiMeta.generatedAt || '',
    'AI Suggestion Notes': form.aiConfidenceNotes || '',
    'Fields Creator Should Double-check': form.aiFieldsNeedingConfirmation || '',
    'Submission Status': 'Submitted for review',
    'Source': 'apps-script-pilot',
    'Raw Extracted Title': extractedGuide && extractedGuide.title || '',
    'Raw Extracted Text': extractedGuide && extractedGuide.bodyText || '',
    'Global ID': globalId,
    'Creator Submission Timestamp': submittedAt
  };

  try {
    if (extractedGuide) {
      submission['Guide Extraction JSON'] = truncateGuideJson_(JSON.stringify(buildGuideExtractionJson_(extractedGuide)));
    }
  } catch (e) {
    Logger.log('Guide extraction JSON storage failed: ' + e.message);
  }

  const _demoUrl = submission['Submitted Arcade URL'] || submission['Creation Link'] || '';
  var saveResult = null;
  var isYouTube = /(?:youtu\.be\/|watch\?v=|&v=)([A-Za-z0-9_\-]{11})/.test(_demoUrl);
  var ytResult = null;
  if (isYouTube) {
    ytResult = routeYouTubeSubmission_(submission);

    // Slack + creator email notifications handled by Finder via webhook
    try { notifyYouTubeViaWebhook_(submission, _demoUrl, ytResult); } catch (e) { Logger.log('YouTube webhook failed: ' + e.message); }
  } else {
    // Arcade Creator Intake: save and immediately process workflow
    saveResult = saveSubmissionToSheet_(submission);

    // Immediate workflow processing (polling will retry on failure)
    if (saveResult && saveResult.rowIndex) {
      try {
        console.log('Immediate workflow processing for row ' + saveResult.rowIndex);
        processWorkflowRow_(saveResult.rowIndex, null, null);
      } catch (error) {
        console.log('Immediate workflow processing failed, polling will retry: ' + error.message);
        // Row is left in Pending or retryable state - polling fallback will handle it
      }
    }
  }

  logAnalyticsEvent_('form_submitted', {
    sessionId: (payload && payload.sessionId) || '',
    arcadeId: form.arcadeId || '',
    metadata: {
      fieldsEditedCount: (payload.editedFields || []).length,
      editedFieldNames: payload.editedFields || [],
      sessionDurationMs: payload.sessionDurationMs || '',
      team: creatorTeamFinal,
      product: primaryProductFinal,
      contentType: contentTypeFinal
    }
  });

  if (isYouTube && ytResult && ytResult.skipped) {
    var ytMsg = {
      duplicate: 'This YouTube video already exists in the tracker (ID: ' + (ytResult.videoId || '') + ').',
      api_no_results: 'Could not fetch video details from YouTube API for ID: ' + (ytResult.videoId || '') + '.',
      sheet_not_found: 'YouTube_Responses sheet tab not found in the spreadsheet.',
      no_youtube_url: 'No YouTube URL found in submission data.',
      invalid_url: 'Could not parse YouTube video ID from the URL.'
    };
    return {
      success: false,
      message: ytMsg[ytResult.reason] || 'Could not process YouTube URL.',
      globalId: globalId
    };
  }

  return {
    success: true,
    message: isYouTube ? 'YouTube submission saved.' : 'Submission received.',
    submission,
    rowIndex: saveResult ? saveResult.rowIndex : null,
    workflowQueued: !!saveResult,
    globalId: globalId
  };

}

function installWorkflowQueueTrigger() {
  ScriptApp.getProjectTriggers()
    .filter(trigger => trigger.getHandlerFunction() === 'processPendingWorkflowRows')
    .forEach(trigger => ScriptApp.deleteTrigger(trigger));

  ScriptApp.newTrigger('processPendingWorkflowRows')
    .timeBased()
    .everyMinutes(5)
    .create();

  console.log('Workflow queue trigger installed: processPendingWorkflowRows every 5 minutes');
}

function testGeminiFromAppsScript() {
  const output = callGemini_('Return only valid JSON: {"status":"ok","message":"Gemini API is working"}');
  Logger.log(output);
  return output;
}

function saveSubmissionToSheet_(submission) {
  const ss = getTargetSpreadsheet_();
  const sheet = ss.getSheetByName(INTAKE_SUBMISSIONS_SHEET);

  if (!sheet) {
    throw new Error(
      'Could not find sheet "' + INTAKE_SUBMISSIONS_SHEET + '". Please check the sheet tab name.'
    );
  }

  ensureWorkflowTrackingColumns_(sheet);

  const lastColumn = sheet.getLastColumn();
  const headers = sheet
    .getRange(1, 1, 1, lastColumn)
    .getValues()[0]
    .map(header => String(header || '').trim());

  const queuedSubmission = {
    ...submission,
    'AI Workflow Status': 'Pending',
    'AI Workflow Queued At': new Date().toISOString(),
    'AI Workflow Started At': '',
    'AI Workflow Completed At': '',
    'AI Workflow Error': '',
    'AI Workflow Result': ''
  };

  const row = headers.map(header => {
    return queuedSubmission[header] == null ? '' : queuedSubmission[header];
  });

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    sheet.appendRow(row);
    var appendedRow = sheet.getLastRow();
  } finally {
    lock.releaseLock();
  }

  return {
    rowIndex: appendedRow,
    workflowQueued: true
  };
}

function triggerOldCreatorWorkflow_(rowIndex) {
  const webhookUrl = PropertiesService
    .getScriptProperties()
    .getProperty('WORKFLOW_WEBHOOK_URL');

  const secret = PropertiesService
    .getScriptProperties()
    .getProperty('AI_WORKFLOW_SECRET');

  if (!webhookUrl || !secret) {
    console.log('Workflow webhook is not configured. Skipping old workflow trigger.');
    return null;
  }

  const response = UrlFetchApp.fetch(webhookUrl, {
    method: 'post',
    contentType: 'application/json',
    headers: {
      Authorization: 'Bearer ' + ScriptApp.getOAuthToken()
    },
    payload: JSON.stringify({
      secret: secret,
      sheetName: 'Creator_Form_Raw',
      rowIndex: rowIndex
    }),
    muteHttpExceptions: true
  });

  const text = response.getContentText();
  const status = response.getResponseCode();

  if (status < 200 || status >= 300) {
    throw new Error('Workflow webhook failed ' + status + ': ' + text);
  }

  const result = JSON.parse(text);

  if (!result.success) {
    throw new Error('Workflow webhook error: ' + (result.error || text));
  }

  return result;
}

function getAnalyticsSpreadsheet_() {
  const props = PropertiesService.getScriptProperties();
  const ssId = props.getProperty(ANALYTICS_SPREADSHEET_ID_PROP);

  if (ssId) {
    try {
      return SpreadsheetApp.openById(ssId);
    } catch (e) {
      Logger.log('Stored analytics spreadsheet not accessible (' + ssId + '): ' + e.message);
    }
  }

  const ss = SpreadsheetApp.create('Arcade Intake Analytics');
  props.setProperty(ANALYTICS_SPREADSHEET_ID_PROP, ss.getId());
  Logger.log('Analytics spreadsheet created: ' + ss.getUrl());
  return ss;
}

function ensureAnalyticsLogSheet_(ss) {
  let sheet = ss.getSheetByName(ANALYTICS_LOG_SHEET);
  if (sheet) return sheet;

  sheet = ss.insertSheet(ANALYTICS_LOG_SHEET);
  sheet.appendRow([
    'Timestamp', 'Session ID', 'Event Type', 'User Email',
    'Arcade ID', 'Duration (ms)', 'Status', 'Metadata'
  ]);
  sheet.setFrozenRows(1);
  return sheet;
}

function logAnalyticsEvent_(eventType, data) {
  try {
    const ss = getAnalyticsSpreadsheet_();
    const sheet = ensureAnalyticsLogSheet_(ss);
    const d = data || {};

    let userEmail = '';
    try { userEmail = Session.getActiveUser().getEmail(); } catch (e) {}

    sheet.appendRow([
      new Date().toISOString(),
      d.sessionId || '',
      eventType,
      userEmail,
      d.arcadeId || '',
      d.durationMs || '',
      d.status || 'success',
      d.metadata ? JSON.stringify(d.metadata) : ''
    ]);
  } catch (e) {
    Logger.log('Analytics logging failed: ' + e.message);
  }
}

function logAnalyticsEventFromClient(eventType, data) {
  logAnalyticsEvent_(eventType, data);
  return { success: true };
}

function computeAnalyticsSummary() {
  const ss = getAnalyticsSpreadsheet_();
  const logSheet = ss.getSheetByName(ANALYTICS_LOG_SHEET);
  if (!logSheet || logSheet.getLastRow() <= 1) {
    return { message: 'No analytics data yet.' };
  }

  const data = logSheet.getRange(2, 1, logSheet.getLastRow() - 1, 8).getValues();
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const events = data.map(function(row) {
    let meta = {};
    try { meta = row[7] ? JSON.parse(row[7]) : {}; } catch (e) {}
    return {
      timestamp: new Date(row[0]),
      sessionId: row[1],
      eventType: row[2],
      userEmail: row[3],
      arcadeId: row[4],
      durationMs: row[5],
      status: row[6],
      metadata: meta
    };
  });

  const submissions = events.filter(function(e) { return e.eventType === 'form_submitted'; });
  const submissions7d = submissions.filter(function(e) { return e.timestamp >= sevenDaysAgo; });
  const submissions30d = submissions.filter(function(e) { return e.timestamp >= thirtyDaysAgo; });

  const allUsers = {};
  const users30d = {};
  submissions.forEach(function(e) { allUsers[e.userEmail] = true; });
  submissions30d.forEach(function(e) { users30d[e.userEmail] = true; });

  const teamCounts = {};
  const productCounts = {};
  const contentTypeCounts = {};
  submissions.forEach(function(e) {
    const team = (e.metadata.team || 'Unknown');
    const product = (e.metadata.product || 'Unknown');
    const ct = (e.metadata.contentType || 'Unknown');
    teamCounts[team] = (teamCounts[team] || 0) + 1;
    productCounts[product] = (productCounts[product] || 0) + 1;
    contentTypeCounts[ct] = (contentTypeCounts[ct] || 0) + 1;
  });

  const sessionDurations = submissions
    .map(function(e) { return e.metadata.sessionDurationMs; })
    .filter(function(d) { return d && d > 0; });
  const avgSessionDuration = sessionDurations.length
    ? Math.round(sessionDurations.reduce(function(a, b) { return a + b; }, 0) / sessionDurations.length)
    : 0;

  const sessionsWithStart = {};
  const sessionsWithSubmit = {};
  events.forEach(function(e) {
    if (e.eventType === 'session_start') sessionsWithStart[e.sessionId || e.timestamp] = true;
    if (e.eventType === 'form_submitted') sessionsWithSubmit[e.sessionId] = true;
  });
  const totalSessions = Object.keys(sessionsWithStart).length || 1;
  const abandonedSessions = totalSessions - Object.keys(sessionsWithSubmit).length;
  const abandonmentRate = Math.round((abandonedSessions / totalSessions) * 100);

  const genComplete = events.filter(function(e) { return e.eventType === 'ai_generation_complete'; });
  const genError = events.filter(function(e) { return e.eventType === 'ai_generation_error'; });
  const genStart = events.filter(function(e) { return e.eventType === 'ai_generation_start'; });
  const genSuccessRate = genStart.length
    ? Math.round((genComplete.length / genStart.length) * 100)
    : 0;
  const genLatencies = genComplete
    .map(function(e) { return e.durationMs || (e.metadata && e.metadata.durationMs); })
    .filter(function(d) { return d && d > 0; });
  const avgGenLatency = genLatencies.length
    ? Math.round(genLatencies.reduce(function(a, b) { return a + b; }, 0) / genLatencies.length)
    : 0;

  const fieldEditCounts = {};
  submissions.forEach(function(e) {
    (e.metadata.editedFieldNames || []).forEach(function(f) {
      fieldEditCounts[f] = (fieldEditCounts[f] || 0) + 1;
    });
  });
  const sortedEdits = Object.keys(fieldEditCounts).sort(function(a, b) {
    return fieldEditCounts[b] - fieldEditCounts[a];
  });

  const confidenceTotals = {};
  const confidenceCounts = {};
  genComplete.forEach(function(e) {
    const fc = e.metadata.fieldConfidences || {};
    Object.keys(fc).forEach(function(field) {
      const val = fc[field] === 'high' ? 3 : fc[field] === 'medium' ? 2 : 1;
      confidenceTotals[field] = (confidenceTotals[field] || 0) + val;
      confidenceCounts[field] = (confidenceCounts[field] || 0) + 1;
    });
  });
  const avgConfidence = {};
  Object.keys(confidenceTotals).forEach(function(field) {
    const avg = confidenceTotals[field] / confidenceCounts[field];
    avgConfidence[field] = avg >= 2.5 ? 'high' : avg >= 1.5 ? 'medium' : 'low';
  });

  const refinements = events.filter(function(e) { return e.eventType === 'refinement_requested'; });
  const refinementRate = submissions.length
    ? Math.round((refinements.length / submissions.length) * 100)
    : 0;

  const extractComplete = events.filter(function(e) { return e.eventType === 'guide_extraction_complete'; });
  const extractLatencies = extractComplete
    .map(function(e) { return e.durationMs || (e.metadata && e.metadata.durationMs); })
    .filter(function(d) { return d && d > 0; });
  const avgExtractLatency = extractLatencies.length
    ? Math.round(extractLatencies.reduce(function(a, b) { return a + b; }, 0) / extractLatencies.length)
    : 0;

  const allErrors = events.filter(function(e) { return e.status === 'error'; });
  const allApiCalls = events.filter(function(e) {
    return ['guide_extraction_start', 'ai_generation_start'].indexOf(e.eventType) !== -1;
  });
  const errorRate = allApiCalls.length
    ? Math.round((allErrors.length / allApiCalls.length) * 100)
    : 0;

  const errorsByType = {};
  allErrors.forEach(function(e) {
    errorsByType[e.eventType] = (errorsByType[e.eventType] || 0) + 1;
  });

  const dailySubmissions = {};
  submissions30d.forEach(function(e) {
    const day = e.timestamp.toISOString().split('T')[0];
    dailySubmissions[day] = (dailySubmissions[day] || 0) + 1;
  });

  const summary = {
    generatedAt: now.toISOString(),
    usage: {
      totalSubmissions: submissions.length,
      submissions7d: submissions7d.length,
      submissions30d: submissions30d.length,
      uniqueUsersAllTime: Object.keys(allUsers).length,
      uniqueUsers30d: Object.keys(users30d).length,
      byTeam: teamCounts,
      byProduct: productCounts,
      byContentType: contentTypeCounts,
      avgSessionDurationMs: avgSessionDuration,
      abandonmentRate: abandonmentRate + '%'
    },
    aiQuality: {
      avgConfidenceByField: avgConfidence,
      mostEditedFields: sortedEdits.slice(0, 10),
      leastEditedFields: sortedEdits.slice(-5).reverse(),
      generationSuccessRate: genSuccessRate + '%',
      avgGenerationLatencyMs: avgGenLatency,
      refinementRate: refinementRate + '%'
    },
    operations: {
      errorRate: errorRate + '%',
      errorsByType: errorsByType,
      avgExtractionTimeMs: avgExtractLatency,
      avgGenerationTimeMs: avgGenLatency,
      dailySubmissions30d: dailySubmissions
    }
  };

  writeAnalyticsSummarySheet_(ss, summary);
  return summary;
}

function writeAnalyticsSummarySheet_(ss, summary) {
  let sheet = ss.getSheetByName(ANALYTICS_SUMMARY_SHEET);
  if (!sheet) {
    sheet = ss.insertSheet(ANALYTICS_SUMMARY_SHEET);
  }
  sheet.clear();

  const rows = [];

  rows.push(['Analytics Summary', 'Generated: ' + summary.generatedAt]);
  rows.push(['', '']);

  rows.push(['USAGE METRICS', '']);
  rows.push(['Total Submissions (All Time)', summary.usage.totalSubmissions]);
  rows.push(['Submissions (Last 7 Days)', summary.usage.submissions7d]);
  rows.push(['Submissions (Last 30 Days)', summary.usage.submissions30d]);
  rows.push(['Unique Users (All Time)', summary.usage.uniqueUsersAllTime]);
  rows.push(['Unique Users (Last 30 Days)', summary.usage.uniqueUsers30d]);
  rows.push(['Avg Session Duration (ms)', summary.usage.avgSessionDurationMs]);
  rows.push(['Abandonment Rate', summary.usage.abandonmentRate]);
  rows.push(['', '']);

  rows.push(['--- Submissions by Team ---', '']);
  Object.keys(summary.usage.byTeam).forEach(function(team) {
    rows.push([team, summary.usage.byTeam[team]]);
  });
  rows.push(['', '']);

  rows.push(['--- Submissions by Product ---', '']);
  Object.keys(summary.usage.byProduct).forEach(function(product) {
    rows.push([product, summary.usage.byProduct[product]]);
  });
  rows.push(['', '']);

  rows.push(['--- Submissions by Content Type ---', '']);
  Object.keys(summary.usage.byContentType).forEach(function(ct) {
    rows.push([ct, summary.usage.byContentType[ct]]);
  });
  rows.push(['', '']);

  rows.push(['AI QUALITY METRICS', '']);
  rows.push(['Generation Success Rate', summary.aiQuality.generationSuccessRate]);
  rows.push(['Avg Generation Latency (ms)', summary.aiQuality.avgGenerationLatencyMs]);
  rows.push(['Refinement Request Rate', summary.aiQuality.refinementRate]);
  rows.push(['', '']);

  rows.push(['--- Most Edited Fields (AI Weakest) ---', '']);
  summary.aiQuality.mostEditedFields.forEach(function(field, i) {
    rows.push([(i + 1) + '. ' + field, '']);
  });
  rows.push(['', '']);

  rows.push(['--- Avg Confidence by Field ---', '']);
  Object.keys(summary.aiQuality.avgConfidenceByField).forEach(function(field) {
    rows.push([field, summary.aiQuality.avgConfidenceByField[field]]);
  });
  rows.push(['', '']);

  rows.push(['OPERATIONAL METRICS', '']);
  rows.push(['Error Rate', summary.operations.errorRate]);
  rows.push(['Avg Extraction Time (ms)', summary.operations.avgExtractionTimeMs]);
  rows.push(['Avg Generation Time (ms)', summary.operations.avgGenerationTimeMs]);
  rows.push(['', '']);

  rows.push(['--- Errors by Type ---', '']);
  Object.keys(summary.operations.errorsByType).forEach(function(type) {
    rows.push([type, summary.operations.errorsByType[type]]);
  });
  rows.push(['', '']);

  rows.push(['--- Daily Submissions (Last 30 Days) ---', '']);
  const days = Object.keys(summary.operations.dailySubmissions30d).sort();
  days.forEach(function(day) {
    rows.push([day, summary.operations.dailySubmissions30d[day]]);
  });

  sheet.getRange(1, 1, rows.length, 2).setValues(rows);

  sheet.setColumnWidth(1, 320);
  sheet.setColumnWidth(2, 200);
  sheet.getRange(1, 1, 1, 2).setFontWeight('bold');
}

function getAnalyticsSummary() {
  return computeAnalyticsSummary();
}

function installAnalyticsSummaryTrigger() {
  ScriptApp.getProjectTriggers()
    .filter(function(trigger) { return trigger.getHandlerFunction() === 'computeAnalyticsSummary'; })
    .forEach(function(trigger) { ScriptApp.deleteTrigger(trigger); });

  ScriptApp.newTrigger('computeAnalyticsSummary')
    .timeBased()
    .everyHours(1)
    .create();

  Logger.log('Analytics summary trigger installed (hourly).');
}

function testWorkflowWebhookHealth() {
  const webhookUrl = PropertiesService
    .getScriptProperties()
    .getProperty('WORKFLOW_WEBHOOK_URL');

  const secret = PropertiesService
    .getScriptProperties()
    .getProperty('AI_WORKFLOW_SECRET');

  const response = UrlFetchApp.fetch(webhookUrl, {
    method: 'post',
    contentType: 'application/json',
    headers: {
      Authorization: 'Bearer ' + ScriptApp.getOAuthToken()
    },
    payload: JSON.stringify({
      action: 'health',
      secret: secret
    }),
    muteHttpExceptions: true
  });

  Logger.log(response.getResponseCode());
  Logger.log(response.getContentText());
}
function debugWorkflowWebhookUrl() {
  const url = PropertiesService
    .getScriptProperties()
    .getProperty('WORKFLOW_WEBHOOK_URL');

  Logger.log(url);
}


function ensureWorkflowTrackingColumns_(sheet) {
  const neededHeaders = [
    'Global ID',
    'Duration',
    'Description for SEO',
    'Destination Channels',
    'AI Workflow Status',
    'AI Workflow Queued At',
    'AI Workflow Started At',
    'AI Workflow Completed At',
    'AI Workflow Error',
    'AI Workflow Result',
    'AI Workflow Attempts'
  ];

  let headers = sheet
    .getRange(1, 1, 1, sheet.getLastColumn())
    .getValues()[0]
    .map(header => String(header || '').trim());

  neededHeaders.forEach(header => {
    if (!headers.includes(header)) {
      sheet.getRange(1, sheet.getLastColumn() + 1).setValue(header);
      headers.push(header);
    }
  });
}

function getWorkflowColumnMap_(sheet) {
  const headers = sheet
    .getRange(1, 1, 1, sheet.getLastColumn())
    .getValues()[0]
    .map(header => String(header || '').trim());

  const map = {};
  headers.forEach((header, index) => {
    if (header) map[header] = index + 1;
  });

  return map;
}

/**
 * Process a single workflow row with atomic claim under lock
 * Shared by both immediate submission processing and polling fallback
 * Returns true if processed, false if row was not claimed (already processing/completed)
 */
function processWorkflowRow_(rowIndex, sheet, columnMap) {
  if (!sheet) {
    const ss = getTargetSpreadsheet_();
    sheet = ss.getSheetByName(INTAKE_SUBMISSIONS_SHEET);
  }

  if (!columnMap) {
    columnMap = getWorkflowColumnMap_(sheet);
  }

  // Acquire lock for atomic claim operation
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(1000)) {
    console.log('Could not acquire lock for row ' + rowIndex + ', skipping');
    return false;
  }

  let claimed = false;
  let currentAttempts = 0;

  try {
    // Under lock: atomically read status, verify Pending, claim by setting Processing
    const currentStatus = String(
      sheet.getRange(rowIndex, columnMap['AI Workflow Status']).getValue() || ''
    ).trim();

    if (currentStatus !== 'Pending') {
      // Already claimed or completed by another execution
      return false;
    }

    // Read current attempts count
    currentAttempts = Number(
      sheet.getRange(rowIndex, columnMap['AI Workflow Attempts']).getValue() || 0
    );

    // Atomically claim the row
    sheet.getRange(rowIndex, columnMap['AI Workflow Status']).setValue('Processing');
    sheet.getRange(rowIndex, columnMap['AI Workflow Started At']).setValue(new Date().toISOString());
    sheet.getRange(rowIndex, columnMap['AI Workflow Error']).setValue('');

    claimed = true;
  } finally {
    lock.releaseLock();
  }

  // If we didn't claim the row, exit
  if (!claimed) {
    return false;
  }

  // Now outside the lock, process the workflow
  try {
    const result = triggerOldCreatorWorkflow_(rowIndex);

    sheet.getRange(rowIndex, columnMap['AI Workflow Status']).setValue('Completed');
    sheet.getRange(rowIndex, columnMap['AI Workflow Completed At']).setValue(new Date().toISOString());
    sheet.getRange(rowIndex, columnMap['AI Workflow Result']).setValue(formatWorkflowResult_(result));

    console.log('Workflow completed for row ' + rowIndex);
    return true;

  } catch (error) {
    const attempts = currentAttempts + 1;
    sheet.getRange(rowIndex, columnMap['AI Workflow Attempts']).setValue(attempts);
    sheet.getRange(rowIndex, columnMap['AI Workflow Error']).setValue(error.message || String(error));

    if (attempts < 3) {
      sheet.getRange(rowIndex, columnMap['AI Workflow Status']).setValue('Pending');
      console.log('Workflow failed for row ' + rowIndex + ', attempt ' + attempts + '/3, will retry');
    } else {
      sheet.getRange(rowIndex, columnMap['AI Workflow Status']).setValue('Failed');
      console.log('Workflow failed permanently for row ' + rowIndex + ' after 3 attempts');
    }

    throw error; // Propagate error to caller
  }
}

function processPendingWorkflowRows() {
  // No lock here - processWorkflowRow_() owns row-level locking
  const ss = getTargetSpreadsheet_();
  const sheet = ss.getSheetByName(INTAKE_SUBMISSIONS_SHEET);

  if (!sheet) {
    throw new Error('Could not find sheet: ' + INTAKE_SUBMISSIONS_SHEET);
  }

  ensureWorkflowTrackingColumns_(sheet);

  const columnMap = getWorkflowColumnMap_(sheet);
  const lastRow = sheet.getLastRow();

  if (lastRow <= 1) return;

  const values = sheet
    .getRange(2, 1, lastRow - 1, sheet.getLastColumn())
    .getValues();

  let processed = 0;
  const maxPerRun = 3;

  for (let i = 0; i < values.length; i++) {
    if (processed >= maxPerRun) break;

    const rowIndex = i + 2;
    const status = String(values[i][columnMap['AI Workflow Status'] - 1] || '').trim();

    if (status !== 'Pending') continue;

    try {
      const wasProcessed = processWorkflowRow_(rowIndex, sheet, columnMap);
      if (wasProcessed) {
        processed++;
      }
    } catch (error) {
      // Error already logged and handled by processWorkflowRow_
      processed++;
    }
  }

  console.log('Polling processed ' + processed + ' workflow rows');
}

function resetFailedWorkflowRows() {
  const ss = getTargetSpreadsheet_();
  const sheet = ss.getSheetByName(INTAKE_SUBMISSIONS_SHEET);
  const columnMap = getWorkflowColumnMap_(sheet);
  const lastRow = sheet.getLastRow();
  const values = sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).getValues();
  let count = 0;
  for (let i = 0; i < values.length; i++) {
    const status = String(values[i][columnMap['AI Workflow Status'] - 1] || '').trim();
    if (status === 'Failed') {
      const rowIndex = i + 2;
      sheet.getRange(rowIndex, columnMap['AI Workflow Status']).setValue('Pending');
      sheet.getRange(rowIndex, columnMap['AI Workflow Attempts']).setValue(0);
      sheet.getRange(rowIndex, columnMap['AI Workflow Error']).setValue('');
      sheet.getRange(rowIndex, columnMap['AI Workflow Started At']).setValue('');
      count++;
    }
  }
  Logger.log('Reset ' + count + ' failed rows to Pending.');
  return count;
}

function formatWorkflowResult_(result) {
  const payload = result && result.result ? result.result : {};
  const parts = [];

  if (payload.number) parts.push('Request #' + payload.number);
  if (payload.action) parts.push(payload.action);

  return parts.length ? parts.join(' | ') : JSON.stringify(result).slice(0, 500);
}

function backfillSubmittedDates() {
  const SHEET_NAME = 'Request_Master';
  const ss = getTargetSpreadsheet_();
  const sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) throw new Error('Sheet "' + SHEET_NAME + '" not found.');

  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) { Logger.log('No data rows.'); return; }

  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0]
    .map(function(h) { return String(h || '').trim(); });

  const receivedTsCol = headers.indexOf('Status Received Timestamp') + 1;
  const publishedTsCol = headers.indexOf('Status Published Timestamp') + 1;
  const openTsCol = headers.indexOf('Status Open Timestamp') + 1;
  const quarterCol = headers.indexOf('Quarter') + 1;

  if (!receivedTsCol) throw new Error('Column "Status Received Timestamp" not found.');

  const data = sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).getValues();
  let filled = 0;

  for (let i = 0; i < data.length; i++) {
    const existing = String(data[i][receivedTsCol - 1] || '').trim();
    if (existing) continue;

    let fallback = '';
    if (publishedTsCol) fallback = String(data[i][publishedTsCol - 1] || '').trim();
    if (!fallback && openTsCol) fallback = String(data[i][openTsCol - 1] || '').trim();

    if (!fallback && quarterCol) {
      const q = String(data[i][quarterCol - 1] || '').trim();
      const m = q.match(/CY(\d{2})Q([1-4])/i);
      if (m) {
        const year = 2000 + parseInt(m[1], 10);
        const month = (parseInt(m[2], 10) - 1) * 3;
        fallback = new Date(year, month, 1).toISOString();
      }
    }

    if (fallback) {
      sheet.getRange(i + 2, receivedTsCol).setValue(fallback);
      filled++;
      Logger.log('Row ' + (i + 2) + ': set to ' + fallback);
    }
  }

  Logger.log('Backfill complete. Filled ' + filled + ' rows.');
}

function backfillDescriptions() {
  const SHEET_NAME = 'Request_Master';
  const ELIGIBLE_STATUSES = ['Published', 'Demo Published', 'Demo Reviewed'];

  const ss = getTargetSpreadsheet_();
  const sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) throw new Error('Sheet "' + SHEET_NAME + '" not found.');

  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) {
    Logger.log('No data rows found.');
    return;
  }

  const headers = sheet
    .getRange(1, 1, 1, sheet.getLastColumn())
    .getValues()[0]
    .map(function(h) { return String(h || '').trim(); });

  const statusCol = headers.indexOf('Status') + 1;
  const primaryUrlCol = headers.indexOf('Production Link') + 1;
  const fallbackUrlCol = headers.indexOf('Creation Link') + 1;
  const descCol = headers.indexOf('Demo Description') + 1;
  let durationCol = headers.indexOf('Duration') + 1;
  let seoDescCol = headers.indexOf('Description for SEO') + 1;
  if (!seoDescCol) seoDescCol = headers.indexOf('SEODescription') + 1;

  if (!statusCol || !primaryUrlCol || !descCol) {
    throw new Error('Required columns (Status, Production Link, Demo Description) not found in ' + SHEET_NAME);
  }

  const statuses = sheet.getRange(2, statusCol, lastRow - 1, 1).getValues();
  const primaryUrls = sheet.getRange(2, primaryUrlCol, lastRow - 1, 1).getValues();
  const fallbackUrls = fallbackUrlCol ? sheet.getRange(2, fallbackUrlCol, lastRow - 1, 1).getValues() : [];
  const descriptions = sheet.getRange(2, descCol, lastRow - 1, 1).getValues();

  let processed = 0;
  let skipped = 0;
  let errors = 0;

  for (let i = 0; i < primaryUrls.length; i++) {
    const status = String(statuses[i][0] || '').trim();
    const fallbackVal = fallbackUrls.length ? String(fallbackUrls[i][0] || '').trim() : '';
    const rawUrl = String(primaryUrls[i][0] || '').trim() || fallbackVal;
    const arcadeUrl = rawUrl.split(/[\n\r]/)[0].trim();
    const existingDesc = String(descriptions[i][0] || '').trim();
    const rowIndex = i + 2;

    if (!ELIGIBLE_STATUSES.includes(status) || !arcadeUrl || existingDesc) {
      skipped++;
      continue;
    }

    try {
      Logger.log('Row ' + rowIndex + ': Processing ' + arcadeUrl);

      const extractedGuide = fetchGuideContent_(arcadeUrl);

      let draft = null;
      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          const result = generateDraftFromGuide({ extractedGuide: extractedGuide });
          draft = result.draft;
          break;
        } catch (parseErr) {
          if (attempt < 2) {
            Logger.log('Row ' + rowIndex + ': Retry (attempt ' + attempt + ' failed: ' + parseErr.message + ')');
          } else {
            throw parseErr;
          }
        }
      }

      const highlights = (draft.tour_highlights || [])
        .map(function(h) { return '• ' + h; })
        .join('\n');

      const combined = draft.description_without_gid +
        (highlights ? '\n\n' + highlights : '');

      sheet.getRange(rowIndex, descCol).setValue(combined);

      if (seoDescCol && draft.description_for_seo) {
        sheet.getRange(rowIndex, seoDescCol).setValue(draft.description_for_seo);
      }

      if (durationCol && extractedGuide.duration) {
        sheet.getRange(rowIndex, durationCol).setValue(extractedGuide.duration);
      }

      processed++;

      Logger.log('Row ' + rowIndex + ': Done');
    } catch (e) {
      errors++;
      Logger.log('Row ' + rowIndex + ': ERROR - ' + e.message);
    }
  }

  Logger.log('Backfill complete. Processed: ' + processed + ', Skipped: ' + skipped + ', Errors: ' + errors);
}

function backfillGuideExtractions() {
  const SHEET_NAME = 'Request_Master';
  const ELIGIBLE_STATUSES = ['Published', 'Demo Published', 'Demo Reviewed'];

  const ss = getTargetSpreadsheet_();
  const sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) throw new Error('Sheet "' + SHEET_NAME + '" not found.');

  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) {
    Logger.log('No data rows found.');
    return;
  }

  const headers = sheet
    .getRange(1, 1, 1, sheet.getLastColumn())
    .getValues()[0]
    .map(function(h) { return String(h || '').trim(); });

  const statusCol = headers.indexOf('Status') + 1;
  const primaryUrlCol = headers.indexOf('Production Link') + 1;
  const fallbackUrlCol = headers.indexOf('Creation Link') + 1;
  const jsonCol = headers.indexOf('Guide Extraction JSON') + 1;

  if (!statusCol || !primaryUrlCol || !jsonCol) {
    throw new Error('Required columns (Status, Production Link, Guide Extraction JSON) not found in ' + SHEET_NAME);
  }

  const statuses = sheet.getRange(2, statusCol, lastRow - 1, 1).getValues();
  const primaryUrls = sheet.getRange(2, primaryUrlCol, lastRow - 1, 1).getValues();
  const fallbackUrls = fallbackUrlCol ? sheet.getRange(2, fallbackUrlCol, lastRow - 1, 1).getValues() : [];
  const existingJson = sheet.getRange(2, jsonCol, lastRow - 1, 1).getValues();

  let processed = 0;
  let skipped = 0;
  let errors = 0;

  for (let i = 0; i < statuses.length; i++) {
    const status = String(statuses[i][0] || '').trim();
    const fallbackVal = fallbackUrls.length ? String(fallbackUrls[i][0] || '').trim() : '';
    const rawUrl = String(primaryUrls[i][0] || '').trim() || fallbackVal;
    const arcadeUrl = rawUrl.split(/[\n\r]/)[0].trim();
    const existing = String(existingJson[i][0] || '').trim();
    const rowIndex = i + 2;

    if (!ELIGIBLE_STATUSES.includes(status) || !arcadeUrl || existing) {
      skipped++;
      continue;
    }

    try {
      Logger.log('Row ' + rowIndex + ': Processing ' + arcadeUrl);

      const extractedGuide = fetchGuideContent_(arcadeUrl);
      const json = truncateGuideJson_(JSON.stringify(buildGuideExtractionJson_(extractedGuide)));

      sheet.getRange(rowIndex, jsonCol).setValue(json);

      processed++;
      Logger.log('Row ' + rowIndex + ': Done (' + json.length + ' chars)');
    } catch (e) {
      errors++;
      Logger.log('Row ' + rowIndex + ': ERROR - ' + e.message);
    }
  }

  Logger.log('Backfill complete. Processed: ' + processed + ', Skipped: ' + skipped + ', Errors: ' + errors);
}

// ── YouTube routing ──────────────────────────────────────────────────────

function routeYouTubeSubmission_(submission) {
  var ss = getTargetSpreadsheet_();
  var sheet = ss.getSheetByName(YOUTUBE_RESPONSES_SHEET);
  if (!sheet) {
    Logger.log('YouTube routing skipped: tab "' + YOUTUBE_RESPONSES_SHEET + '" not found');
    return { skipped: true, reason: 'sheet_not_found' };
  }
  var values = Object.values(submission);
  for (var i = 0; i < values.length; i++) {
    var val = String(values[i] || '');
    var match = val.match(/(?:youtu\.be\/|watch\?v=|&v=)([A-Za-z0-9_\-]{11})/);
    if (!match) continue;
    return writeToYouTubeRepo_('https://www.youtube.com/watch?v=' + match[1], sheet, submission);
  }
  return { skipped: true, reason: 'no_youtube_url' };
}

function writeToYouTubeRepo_(youtubeUrl, sheet, submission) {
  submission = submission || {};
  var lastCol = sheet.getLastColumn();
  var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(function(h) { return String(h || '').trim(); });
  var headerMap = {};
  headers.forEach(function(h, i) { if (h) headerMap[h] = i; });

  var ytVideoIdIdx = headerMap['YouTube Video ID'];
  var lastRow = sheet.getLastRow();
  var vidMatchDup = youtubeUrl.match(/(?:youtu\.be\/|watch\?v=|&v=)([A-Za-z0-9_\-]{11})/);
  if (lastRow > 1 && ytVideoIdIdx != null && vidMatchDup) {
    var existing = sheet.getRange(2, ytVideoIdIdx + 1, lastRow - 1, 1).getValues();
    for (var i = 0; i < existing.length; i++) {
      if ((existing[i][0] || '').toString() === vidMatchDup[1]) {
        Logger.log('YouTube duplicate — skipping: ' + youtubeUrl);
        return { skipped: true, reason: 'duplicate', videoId: vidMatchDup[1] };
      }
    }
  }
  var vidMatch = youtubeUrl.match(/(?:youtu\.be\/|watch\?v=|&v=)([A-Za-z0-9_\-]{11})/);
  if (!vidMatch) { Logger.log('Could not parse video ID: ' + youtubeUrl); return { skipped: true, reason: 'invalid_url' }; }
  var videoId = vidMatch[1];
  var resp = YouTube.Videos.list('snippet,contentDetails', { id: videoId });
  if (!resp || !resp.items || !resp.items.length) { Logger.log('No YouTube API results for: ' + videoId); return { skipped: true, reason: 'api_no_results', videoId: videoId }; }
  var video = resp.items[0], snippet = video.snippet;
  var title    = snippet.title        || '';
  var desc     = snippet.description  || '';
  var channel  = snippet.channelTitle || '';
  var pubDate  = snippet.publishedAt  ? snippet.publishedAt.substring(0, 10) : '';
  var duration = ytFormatDuration_(ytParseDuration_(video.contentDetails.duration || ''));
  var quarter  = ytGetQuarter_(pubDate);
  var ctaLinks = submission['Links for next step call to action'] ||
    [submission['Link 1'], submission['Link 2'], submission['Link 3']].filter(Boolean).join('\n') || '';
  var language    = submission['Language'] || submission['Language(s)'] || submission['language'] || '';
  var translation = submission['Translation Used?'] || submission['translation'] || '';

  var values = {
    'Number': sheet.getLastRow(),
    'Status': 'Published',
    'Video Title': submission['Final Demo Title'] || submission['demoTitle'] || title,
    'YouTube URL': youtubeUrl,
    'Content Type': submission['Content Type'] || submission['contentType'] || '',
    'Origin Type': 'Intake Form',
    'Global ID': submission['Global ID'] || '',
    'Publish states': '',
    'Status Published Timestamp': new Date().toISOString(),
    'Status Retired Timestamp': '',
    'Creator Submitted Timestamp': submission['Creator Submission Timestamp'] || new Date().toISOString(),
    'Primary Product': submission['Primary product featured?'] || submission['primaryProduct'] || '',
    'Destination Channels': submission['Destination Channels'] || '',
    'Marketing Program': submission['Related Marketing Program?'] || submission['marketingProgram'] || '',
    'TDP': submission['Related Technology Decision Point?'] || submission['tdp'] || '',
    'Sales Tactic': submission['Related Sales Tactic?'] || submission['salesTactic'] || '',
    'Verticals': submission['vertical'] || submission['Vertical'] || '',
    'Event': submission['Is this for a specific event or project?'] || submission['Event'] || '',
    'Relevant Links / CTAs': ctaLinks,
    'Quarter': submission['What quarter was this content created in?'] || submission['quarter'] || quarter,
    'Creator Name': submission['Creator Name(s)'] || submission['creatorName'] || '',
    'Creator Email': submission['Email Address'] || submission['email'] || '',
    'Creator Team': submission['Creator Team(s)'] || submission['creatorTeams'] || '',
    'Demo Description': submission['Description (50-150 words)'] || submission['descriptionWithoutGid'] || desc.substring(0, 500),
    'Duration': duration,
    'YouTube Video ID': videoId,
    'YouTube Channel': channel,
    'Note': ''
  };

  var row = headers.map(function(h) { return values[h] != null ? values[h] : ''; });
  sheet.appendRow(row);
  Logger.log('Written to YouTube tab: ' + title + ' (' + videoId + ')');
  return { number: values['Number'] };
}

function notifyYouTubeViaWebhook_(submission, youtubeUrl, ytResult) {
  var webhookUrl = PropertiesService.getScriptProperties().getProperty('WORKFLOW_WEBHOOK_URL');
  var secret = PropertiesService.getScriptProperties().getProperty('AI_WORKFLOW_SECRET');
  if (!webhookUrl || !secret) {
    Logger.log('YouTube webhook skipped: missing WORKFLOW_WEBHOOK_URL or AI_WORKFLOW_SECRET');
    return;
  }

  Logger.log('Calling YouTube Slack webhook...');
  var resp = UrlFetchApp.fetch(webhookUrl, {
    method: 'post',
    contentType: 'application/json',
    headers: {
      Authorization: 'Bearer ' + ScriptApp.getOAuthToken()
    },
    payload: JSON.stringify({
      action: 'youtubeNotification',
      secret: secret,
      number: ytResult && ytResult.number || '',
      title: submission['Final Demo Title'] || '',
      creator: submission['Creator Name(s)'] || '',
      creatorTeam: submission['Creator Team(s)'] || '',
      destination: submission['Destination Channels'] || '',
      youtubeUrl: youtubeUrl
    }),
    muteHttpExceptions: true
  });
  Logger.log('YouTube webhook response: ' + resp.getContentText());
}

function ytParseDuration_(iso) {
  var m = (iso || '').match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return 0;
  return (parseInt(m[1]||0)*3600) + (parseInt(m[2]||0)*60) + parseInt(m[3]||0);
}

function ytFormatDuration_(secs) {
  if (!secs) return '';
  var m = Math.floor(secs / 60), s = secs % 60;
  return m + ':' + (s < 10 ? '0' : '') + s;
}

function ytGetQuarter_(dateStr) {
  if (!dateStr) return '';
  var parts = dateStr.split('-');
  if (parts.length < 2) return '';
  return 'CY' + parts[0].slice(2) + 'Q' + Math.ceil(parseInt(parts[1]) / 3);
}
