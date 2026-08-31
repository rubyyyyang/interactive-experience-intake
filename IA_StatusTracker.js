/**
 * IA_StatusTracker.js
 * StatusTracker data endpoint functions called by StatusTracker.html via google.script.run.
 */

const ST_CACHE_KEY_ = 'st_master_data';
const ST_YT_CACHE_KEY_ = 'st_youtube_data';
const ST_CACHE_TTL_ = 90;
var ST_RUNTIME_MEMO_ = null;
var ST_YT_RUNTIME_MEMO_ = null;

function getRequestMasterData_() {
  if (ST_RUNTIME_MEMO_) return ST_RUNTIME_MEMO_;

  try {
    const cached = CacheService.getScriptCache().get(ST_CACHE_KEY_);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (parsed && parsed.headers && parsed.rows) {
        ST_RUNTIME_MEMO_ = parsed;
        return parsed;
      }
    }
  } catch (e) {}

  const spreadsheetId = PropertiesService.getScriptProperties().getProperty(MASTER_SPREADSHEET_ID_PROP);
  if (!spreadsheetId) throw new Error('MASTER_SPREADSHEET_ID is not configured.');

  const ss = SpreadsheetApp.openById(spreadsheetId);
  const sheet = ss.getSheetByName('Request_Master');
  if (!sheet) throw new Error('Request_Master sheet not found.');

  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return { headers: [], rows: [], headerMap: {} };

  const lastCol = sheet.getLastColumn();
  const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(h => String(h || '').trim());
  const rows = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();

  const headerMap = {};
  headers.forEach((h, i) => { if (h) headerMap[h] = i; });

  const result = { headers, rows, headerMap };
  ST_RUNTIME_MEMO_ = result;

  try {
    CacheService.getScriptCache().put(ST_CACHE_KEY_, JSON.stringify(result), ST_CACHE_TTL_);
  } catch (e) {}

  return result;
}

function invalidateStatusTrackerCache_() {
  ST_RUNTIME_MEMO_ = null;
  ST_YT_RUNTIME_MEMO_ = null;
  try { CacheService.getScriptCache().remove(ST_CACHE_KEY_); } catch (e) {}
  try { CacheService.getScriptCache().remove(ST_YT_CACHE_KEY_); } catch (e) {}
}

function getYouTubeResponsesData_() {
  if (ST_YT_RUNTIME_MEMO_) return ST_YT_RUNTIME_MEMO_;

  try {
    const cached = CacheService.getScriptCache().get(ST_YT_CACHE_KEY_);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (parsed && parsed.headers && parsed.rows) {
        ST_YT_RUNTIME_MEMO_ = parsed;
        return parsed;
      }
    }
  } catch (e) {}

  const spreadsheetId = PropertiesService.getScriptProperties().getProperty(MASTER_SPREADSHEET_ID_PROP);
  if (!spreadsheetId) return { headers: [], rows: [], headerMap: {} };

  try {
    const ss = SpreadsheetApp.openById(spreadsheetId);
    const sheet = ss.getSheetByName(YOUTUBE_RESPONSES_SHEET);
    if (!sheet) return { headers: [], rows: [], headerMap: {} };

    const lastRow = sheet.getLastRow();
    if (lastRow <= 1) return { headers: [], rows: [], headerMap: {} };

    const lastCol = sheet.getLastColumn();
    const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(h => String(h || '').trim());
    const rows = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();

    const headerMap = {};
    headers.forEach((h, i) => { if (h) headerMap[h] = i; });

    const result = { headers, rows, headerMap };
    ST_YT_RUNTIME_MEMO_ = result;

    try {
      CacheService.getScriptCache().put(ST_YT_CACHE_KEY_, JSON.stringify(result), ST_CACHE_TTL_);
    } catch (e) {}

    return result;
  } catch (e) {
    return { headers: [], rows: [], headerMap: {} };
  }
}

function buildSubmissionFromRow_(row, headerMap) {
  const col = STATUS_TRACKER_COLUMNS;
  const get = (name) => {
    const idx = headerMap[name];
    return idx != null ? String(row[idx] || '') : '';
  };

  var meta = {};
  for (var fi = 0; fi < EDITABLE_METADATA_FIELDS_.length; fi++) {
    meta[EDITABLE_METADATA_FIELDS_[fi].key] = get(EDITABLE_METADATA_FIELDS_[fi].key);
  }

  return {
    title: get(col.FINAL_DEMO_TITLE) || get(col.SUGGESTED_DEMO_TITLE) || get('Video Title'),
    status: get(col.STATUS),
    dateSubmitted: get(col.CREATOR_SUBMITTED_TS) || get(col.STATUS_RECEIVED_TS),
    primaryProduct: get(col.PRIMARY_PRODUCT),
    contentType: get(col.CONTENT_TYPE),
    creatorName: get(col.CREATOR_NAME),
    requestorName: get(col.REQUESTOR_NAME),
    creationLink: extractLastLine_(get(col.CREATION_LINK)) || (get('YouTube Video ID') ? 'https://www.youtube.com/watch?v=' + get('YouTube Video ID') : ''),
    drupalPageUrl: get(col.DRUPAL_PAGE_URL) || get(col.PUBLIC_SITE_LINK) || get(col.RHAC_PAGE),
    publishedDate: get(col.STATUS_PUBLISHED_TS),
    globalId: get(col.GLOBAL_ID),
    requestNumber: get(col.NUMBER),
    description: get(col.DESCRIPTION),
    productionLink: extractLastLine_(get(col.PRODUCTION_LINK)),
    duration: get(col.DURATION),
    quarter: get(col.QUARTER),
    creatorTeam: get(col.CREATOR_TEAM),
    requestorTeam: get(col.REQUESTOR_TEAM),
    originType: get(col.ORIGIN_TYPE),
    language: get(col.LANGUAGE),
    vertical: get(col.VERTICAL),
    event: get(col.EVENT),
    ctaLink: get(col.CTA_LINK),
    tdp: get(col.TDP),
    salesTactic: get(col.SALES_TACTIC),
    marketingProgram: get(col.MARKETING_PROGRAM),
    syntheticVoice: get(col.SYNTHETIC_VOICE),
    translation: get(col.TRANSLATION),
    mobileFriendly: get(col.MOBILE_FRIENDLY),
    group: get(col.GROUP),
    employeeAdvocacy: get(col.EMPLOYEE_ADVOCACY),
    otherProducts: get(col.PRODUCT),
    descriptionForSeo: get(col.DESCRIPTION_FOR_SEO),
    creationBriefDocUrl: get(col.CREATION_BRIEF_DOC_URL),
    statusTimestamps: {
      open: get(col.STATUS_OPEN_TS),
      approved: get(col.STATUS_APPROVED_TS),
      received: get(col.STATUS_RECEIVED_TS),
      reviewed: get(col.STATUS_REVIEWED_TS),
      published: get(col.STATUS_PUBLISHED_TS),
      retired: get(col.STATUS_RETIRED_TS),
      closed: get(col.STATUS_CLOSED_TS)
    },
    perfAction: get(col.RECOMMENDED_ACTION),
    perfActionReason: get(col.ACTION_REASON),
    perfActionPriority: get(col.ACTION_PRIORITY),
    perfAssigned: get(col.ASSIGNED),
    perfActionStatus: get(col.ACTION_STATUS),
    actionCompletedDate: get(col.ACTION_COMPLETED_DATE),
    perfScore: get(col.PERF_SCORE),
    perfTier: get(col.PERF_TIER),
    perfTrend: get(col.PERF_TREND),
    perfSignals: get(col.PERF_SIGNALS),
    perfFlags: get(col.PERF_FLAGS),
    priority: get(col.PRIORITY),
    deadline: get(col.DEADLINE),
    contactedBu: get(col.CONTACTED_BU),
    checkedExisting: get(col.CHECKED_EXISTING),
    primaryAudience: get(col.PRIMARY_AUDIENCE),
    personas: get(col.PERSONAS),
    painPoints: get(col.PAIN_POINTS),
    relevantLinks: get(col.RELEVANT_LINKS),
    destinationChannels: get(col.DESTINATION_CHANNELS),
    contextDescription: get(col.CONTEXT_DESCRIPTION),
    requestAdvocacy: get(col.REQUEST_ADVOCACY),
    demoDescCreator: get(col.DEMO_DESC_CREATOR),
    seoWords: get(col.SEO_WORDS),
    guideExtractionJson: get(col.GUIDE_EXTRACTION_JSON),
    metadata: meta
  };
}

function getSubmissionStatus(globalId) {
  if (!globalId) return { success: false, error: 'No ID provided.' };

  try {
    const { rows, headerMap } = getRequestMasterData_();
    const idIdx = headerMap[STATUS_TRACKER_COLUMNS.GLOBAL_ID];
    if (idIdx == null) return { success: false, error: 'Global ID column not found.' };

    for (let i = 0; i < rows.length; i++) {
      if (String(rows[i][idIdx] || '').trim() === globalId) {
        return { success: true, submission: buildSubmissionFromRow_(rows[i], headerMap) };
      }
    }

    return { success: true, submission: null, processing: true };
  } catch (e) {
    return { success: false, error: e.message || String(e) };
  }
}

function getMySubmissions(searchName) {
  try {
    const email = Session.getActiveUser().getEmail();
    if (!email) return { success: false, error: 'Could not determine your email. Please make sure you are logged in.' };

    const { rows, headerMap } = getRequestMasterData_();
    const creatorEmailIdx = headerMap[STATUS_TRACKER_COLUMNS.CREATOR_EMAIL];
    const requestorEmailIdx = headerMap[STATUS_TRACKER_COLUMNS.REQUESTOR_EMAIL];
    const creatorNameIdx = headerMap[STATUS_TRACKER_COLUMNS.CREATOR_NAME];

    const lowerEmail = email.toLowerCase();
    const admin = isAdmin_(email);
    const lowerSearch = searchName ? searchName.toLowerCase().trim() : '';
    const submissions = [];

    for (let i = 0; i < rows.length; i++) {
      const creatorEmail = creatorEmailIdx != null ? String(rows[i][creatorEmailIdx] || '').toLowerCase().trim() : '';
      const requestorEmail = requestorEmailIdx != null ? String(rows[i][requestorEmailIdx] || '').toLowerCase().trim() : '';
      const creatorName = creatorNameIdx != null ? String(rows[i][creatorNameIdx] || '').toLowerCase().trim() : '';

      if (lowerSearch) {
        if (creatorName.includes(lowerSearch)) {
          submissions.push(buildSubmissionFromRow_(rows[i], headerMap));
        }
      } else if (admin) {
        submissions.push(buildSubmissionFromRow_(rows[i], headerMap));
      } else {
        if (creatorEmail === lowerEmail || requestorEmail === lowerEmail) {
          submissions.push(buildSubmissionFromRow_(rows[i], headerMap));
        }
      }
    }

    const ytData = getYouTubeResponsesData_();
    if (ytData.rows && ytData.rows.length) {
      const ytCreatorEmailIdx = ytData.headerMap[STATUS_TRACKER_COLUMNS.CREATOR_EMAIL];
      const ytCreatorNameIdx = ytData.headerMap[STATUS_TRACKER_COLUMNS.CREATOR_NAME];
      for (let yi = 0; yi < ytData.rows.length; yi++) {
        const ytCe = ytCreatorEmailIdx != null ? String(ytData.rows[yi][ytCreatorEmailIdx] || '').toLowerCase().trim() : '';
        const ytCn = ytCreatorNameIdx != null ? String(ytData.rows[yi][ytCreatorNameIdx] || '').toLowerCase().trim() : '';

        if (lowerSearch) {
          if (ytCn.includes(lowerSearch)) {
            submissions.push(buildSubmissionFromRow_(ytData.rows[yi], ytData.headerMap));
          }
        } else if (admin) {
          submissions.push(buildSubmissionFromRow_(ytData.rows[yi], ytData.headerMap));
        } else {
          if (ytCe === lowerEmail) {
            submissions.push(buildSubmissionFromRow_(ytData.rows[yi], ytData.headerMap));
          }
        }
      }
    }

    submissions.sort((a, b) => {
      const dateA = a.dateSubmitted ? new Date(a.dateSubmitted).getTime() : 0;
      const dateB = b.dateSubmitted ? new Date(b.dateSubmitted).getTime() : 0;
      return dateB - dateA;
    });

    return { success: true, submissions, isAdmin: admin };
  } catch (e) {
    return { success: false, error: e.message || String(e) };
  }
}

function getAllSubmissions() {
  try {
    const email = Session.getActiveUser().getEmail();
    if (!email) return { success: false, error: 'Could not determine your email. Please make sure you are logged in.' };

    const { rows, headerMap } = getRequestMasterData_();
    const creatorEmailIdx = headerMap[STATUS_TRACKER_COLUMNS.CREATOR_EMAIL];
    const requestorEmailIdx = headerMap[STATUS_TRACKER_COLUMNS.REQUESTOR_EMAIL];
    const lowerEmail = email.toLowerCase();
    const submissions = [];
    const seenGlobalIds = new Set();

    for (let i = 0; i < rows.length; i++) {
      const ce = creatorEmailIdx != null ? String(rows[i][creatorEmailIdx] || '').toLowerCase().trim() : '';
      const re = requestorEmailIdx != null ? String(rows[i][requestorEmailIdx] || '').toLowerCase().trim() : '';
      const sub = buildSubmissionFromRow_(rows[i], headerMap);
      if (!sub.status) continue;
      sub.isMine = (ce === lowerEmail || re === lowerEmail);
      if (sub.globalId) seenGlobalIds.add(sub.globalId);
      submissions.push(sub);
    }

    const ytData = getYouTubeResponsesData_();
    if (ytData.rows && ytData.rows.length) {
      const ytCreatorEmailIdx = ytData.headerMap[STATUS_TRACKER_COLUMNS.CREATOR_EMAIL];
      for (let yi = 0; yi < ytData.rows.length; yi++) {
        const ytSub = buildSubmissionFromRow_(ytData.rows[yi], ytData.headerMap);
        if (!ytSub.status) continue;
        const ytCe = ytCreatorEmailIdx != null ? String(ytData.rows[yi][ytCreatorEmailIdx] || '').toLowerCase().trim() : '';
        ytSub.isMine = (ytCe === lowerEmail);
        if (ytSub.globalId) seenGlobalIds.add(ytSub.globalId);
        submissions.push(ytSub);
      }
    }

    const pending = getPendingIntakeSubmissions_(seenGlobalIds, lowerEmail);
    for (let i = 0; i < pending.length; i++) {
      submissions.push(pending[i]);
    }

    const queueEntries = getResponseQueueData_();
    const pendingByNumber = {};
    for (let q = 0; q < queueEntries.length; q++) {
      const entry = queueEntries[q];
      if (entry.processed) continue;
      pendingByNumber[entry.number] = entry;
    }
    for (let q2 = queueEntries.length - 1; q2 >= 0; q2--) {
      var rej = queueEntries[q2];
      if (rej.processed && rej.approval === 'Rejected' && !pendingByNumber[rej.number]) {
        pendingByNumber[rej.number] = rej;
      }
    }
    for (let s = 0; s < submissions.length; s++) {
      const num = submissions[s].requestNumber;
      if (num && pendingByNumber[num]) {
        submissions[s].pendingResponse = pendingByNumber[num];
      }
    }

    submissions.sort((a, b) => {
      const da = a.dateSubmitted ? new Date(a.dateSubmitted).getTime() : 0;
      const db = b.dateSubmitted ? new Date(b.dateSubmitted).getTime() : 0;
      return db - da;
    });

    return { success: true, submissions, userEmail: lowerEmail, isAdmin: isAdmin_(email), editableFields: EDITABLE_METADATA_FIELDS_, fieldOptions: FIELD_OPTIONS };
  } catch (e) {
    return { success: false, error: e.message || String(e) };
  }
}

function getPendingIntakeSubmissions_(seenGlobalIds, userEmail) {
  try {
    const ss = getTargetSpreadsheet_();
    const sheet = ss.getSheetByName(INTAKE_SUBMISSIONS_SHEET);
    if (!sheet) return [];

    const lastRow = sheet.getLastRow();
    if (lastRow <= 1) return [];

    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0]
      .map(h => String(h || '').trim());

    const col = (name) => headers.indexOf(name);

    const globalIdIdx = col('Global ID');
    const titleIdx = col('Final Demo Title');
    const emailIdx = col('Email Address');
    const creatorIdx = col('Creator Name(s)');
    const creatorTeamIdx = col('Creator Team(s)');
    const timestampIdx = col('Creator Submission Timestamp');
    const contentTypeIdx = col('Content Type');
    const productIdx = col('Primary product featured?');
    const durationIdx = col('Duration');
    const languageIdx = col('Language');
    const quarterIdx = col('What quarter was this content created in?');
    const creationLinkIdx = col('Creation Link');
    const descIdx = col('Description (50-150 words)');
    const tdpIdx = col('Related Technology Decision Point?');

    const data = sheet.getRange(2, 1, lastRow - 1, headers.length).getValues();
    const results = [];

    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const gid = globalIdIdx >= 0 ? String(row[globalIdIdx] || '').trim() : '';
      if (!gid || seenGlobalIds.has(gid)) continue;

      const rowEmail = emailIdx >= 0 ? String(row[emailIdx] || '').toLowerCase().trim() : '';
      const get = (idx) => idx >= 0 ? String(row[idx] || '').trim() : '';

      results.push({
        title: get(titleIdx),
        status: 'Processing',
        dateSubmitted: get(timestampIdx),
        primaryProduct: get(productIdx),
        contentType: get(contentTypeIdx),
        creatorName: get(creatorIdx),
        creatorTeam: get(creatorTeamIdx),
        requestorName: '',
        requestorTeam: '',
        creationLink: extractLastLine_(get(creationLinkIdx)),
        drupalPageUrl: '',
        publishedDate: '',
        globalId: gid,
        description: get(descIdx),
        duration: get(durationIdx),
        quarter: get(quarterIdx),
        language: get(languageIdx),
        tdp: get(tdpIdx),
        originType: '',
        productionLink: '',
        vertical: '',
        event: '',
        ctaLink: '',
        requestNumber: '',
        isMine: rowEmail === userEmail,
        statusTimestamps: {}
      });
    }

    return results;
  } catch (e) {
    return [];
  }
}

function getDemoMetadata(requestNumber) {
  try {
    if (!requestNumber) return { success: false, error: 'No demo number.' };

    const { rows, headerMap } = getRequestMasterData_();
    const numIdx = headerMap[STATUS_TRACKER_COLUMNS.NUMBER];
    if (numIdx == null) return { success: false, error: 'Number column not found.' };

    const target = String(requestNumber).trim();
    for (let i = 0; i < rows.length; i++) {
      if (String(rows[i][numIdx] || '').trim() === target) {
        const meta = {};
        for (let j = 0; j < EDITABLE_METADATA_FIELDS_.length; j++) {
          const f = EDITABLE_METADATA_FIELDS_[j];
          const idx = headerMap[f.key];
          meta[f.key] = idx != null ? String(rows[i][idx] || '') : '';
        }
        return { success: true, metadata: meta };
      }
    }
    return { success: false, error: 'Demo not found.' };
  } catch (e) {
    return { success: false, error: e.message || String(e) };
  }
}

function getResponseQueueSheet_() {
  const ss = getTargetSpreadsheet_();
  let sheet = ss.getSheetByName(RESPONSE_QUEUE_SHEET);
  if (!sheet) {
    sheet = ss.insertSheet(RESPONSE_QUEUE_SHEET);
    sheet.getRange(1, 1, 1, RESPONSE_QUEUE_HEADERS_.length).setValues([RESPONSE_QUEUE_HEADERS_]);
    sheet.getRange(1, 1, 1, RESPONSE_QUEUE_HEADERS_.length).setFontWeight('bold');
  }
  return sheet;
}

function getResponseQueueData_() {
  try {
    const ss = getTargetSpreadsheet_();
    const sheet = ss.getSheetByName(RESPONSE_QUEUE_SHEET);
    if (!sheet) return [];

    const lastRow = sheet.getLastRow();
    if (lastRow <= 1) return [];

    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0]
      .map(h => String(h || '').trim());
    const data = sheet.getRange(2, 1, lastRow - 1, headers.length).getValues();

    const col = (name) => headers.indexOf(name);
    const results = [];

    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const get = (name) => {
        const idx = col(name);
        return idx >= 0 ? String(row[idx] || '') : '';
      };
      results.push({
        queueRowIndex: i + 2,
        timestamp: get('Timestamp'),
        submitterEmail: get('Submitter Email'),
        number: get('Number'),
        demoTitle: get('Demo Title'),
        type: get('Type'),
        action: get('Recommended Action'),
        response: get('Response'),
        newLink: get('New Link'),
        notes: get('Notes'),
        metadataChanges: get('Metadata Changes'),
        approval: get('Approval'),
        processed: get('Processed'),
        adminNotes: get('Admin Notes')
      });
    }
    return results;
  } catch (e) {
    console.error('getResponseQueueData_ error: ' + e.message);
    return [];
  }
}

function submitCreatorResponse(payload) {
  try {
    const email = Session.getActiveUser().getEmail();
    if (!email) return { success: false, error: 'Not authenticated.' };

    if (!payload || !payload.number) {
      return { success: false, error: 'Missing required fields.' };
    }

    const hasResponse = payload.response && ['Done', 'Declined', 'Need help'].indexOf(payload.response) !== -1;
    const hasMetadata = payload.metadataChanges && typeof payload.metadataChanges === 'object'
      && Object.keys(payload.metadataChanges).length > 0;

    if (!hasResponse && !hasMetadata) {
      return { success: false, error: 'Please select a response or make metadata changes.' };
    }

    let type = 'response';
    if (hasResponse && hasMetadata) type = 'response+metadata';
    else if (hasMetadata && !hasResponse) type = 'metadata_edit';

    const metadataJson = hasMetadata ? JSON.stringify(payload.metadataChanges) : '';

    const lock = LockService.getScriptLock();
    lock.waitLock(10000);

    try {
      const sheet = getResponseQueueSheet_();
      const lastRow = sheet.getLastRow();

      let existingRow = -1;
      if (lastRow > 1) {
        const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0]
          .map(h => String(h || '').trim());
        const numCol = headers.indexOf('Number');
        const processedCol = headers.indexOf('Processed');
        if (numCol >= 0 && processedCol >= 0) {
          const data = sheet.getRange(2, 1, lastRow - 1, headers.length).getValues();
          for (let i = data.length - 1; i >= 0; i--) {
            if (String(data[i][numCol] || '').trim() === String(payload.number).trim()
                && !String(data[i][processedCol] || '').trim()) {
              existingRow = i + 2;
              break;
            }
          }
        }
      }

      const rowData = [
        new Date().toISOString(),
        email,
        String(payload.number),
        payload.title || '',
        type,
        payload.action || '',
        payload.response || '',
        payload.newLink || '',
        payload.notes || '',
        metadataJson,
        '',
        ''
      ];

      if (existingRow > 0) {
        sheet.getRange(existingRow, 1, 1, rowData.length).setValues([rowData]);
      } else {
        sheet.appendRow(rowData);
      }

      try {
        var masterData = getRequestMasterData_();
        var numIdx = masterData.headerMap[STATUS_TRACKER_COLUMNS.NUMBER];
        var actionStatusIdx = masterData.headerMap[STATUS_TRACKER_COLUMNS.ACTION_STATUS];
        if (numIdx != null && actionStatusIdx != null) {
          var masterSheet = getTargetSpreadsheet_().getSheetByName('Request_Master');
          for (var mi = 0; mi < masterData.rows.length; mi++) {
            if (String(masterData.rows[mi][numIdx] || '').trim() === String(payload.number)) {
              masterSheet.getRange(mi + 2, actionStatusIdx + 1).setValue('Pending review');
              break;
            }
          }
        }
      } catch (e) {
        Logger.log('Failed to update Action Status on Master: ' + e.message);
      }

      invalidateStatusTrackerCache_();
      return { success: true };
    } finally {
      lock.releaseLock();
    }
  } catch (e) {
    return { success: false, error: e.message || String(e) };
  }
}

function approveResponse(queueRowIndex, adminNotes, metadataOverrides) {
  try {
    const email = Session.getActiveUser().getEmail();
    if (!email || !isAdmin_(email)) {
      return { success: false, error: 'Admin access required.' };
    }

    const lock = LockService.getScriptLock();
    lock.waitLock(15000);

    try {
      const sheet = getResponseQueueSheet_();
      const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0]
        .map(h => String(h || '').trim());
      const queueRow = sheet.getRange(queueRowIndex, 1, 1, headers.length).getValues()[0];

      const col = (name) => headers.indexOf(name);
      const get = (name) => {
        const idx = col(name);
        return idx >= 0 ? String(queueRow[idx] || '') : '';
      };

      if (get('Processed')) {
        return { success: false, error: 'This response has already been processed.' };
      }

      const number = get('Number').trim();
      if (!number) return { success: false, error: 'No demo number found.' };

      const { rows, headerMap } = getRequestMasterData_();
      const numIdx = headerMap[STATUS_TRACKER_COLUMNS.NUMBER];
      let masterRowIdx = -1;
      for (let i = 0; i < rows.length; i++) {
        if (String(rows[i][numIdx] || '').trim() === number) {
          masterRowIdx = i;
          break;
        }
      }
      if (masterRowIdx < 0) {
        return { success: false, error: 'Demo #' + number + ' not found on Request_Master.' };
      }

      const masterSheet = getTargetSpreadsheet_().getSheetByName('Request_Master');
      const masterRow = masterRowIdx + 2;

      const actionStatusIdx = headerMap[STATUS_TRACKER_COLUMNS.ACTION_STATUS];
      if (actionStatusIdx != null) {
        masterSheet.getRange(masterRow, actionStatusIdx + 1).setValue('Complete');
      }

      var completedDateIdx = headerMap[STATUS_TRACKER_COLUMNS.ACTION_COMPLETED_DATE];
      if (completedDateIdx != null) {
        masterSheet.getRange(masterRow, completedDateIdx + 1).setValue(new Date().toISOString());
      }

      const response = get('Response');
      const responseColIdx = headerMap['Response'];
      if (response && responseColIdx != null) {
        masterSheet.getRange(masterRow, responseColIdx + 1).setValue(response);
      }

      const notes = get('Notes');
      if (notes && responseColIdx != null) {
        const existing = String(masterSheet.getRange(masterRow, responseColIdx + 1).getValue() || '');
        const combined = existing ? existing + ' | ' + notes : notes;
        masterSheet.getRange(masterRow, responseColIdx + 1).setValue(combined);
      }

      const newLink = get('New Link').trim();
      const creationLinkIdx = headerMap[STATUS_TRACKER_COLUMNS.CREATION_LINK];
      if (newLink && creationLinkIdx != null) {
        masterSheet.getRange(masterRow, creationLinkIdx + 1).setValue(newLink);
      }

      var skipped = [];
      var changes = metadataOverrides || null;
      if (!changes) {
        var metaJson = get('Metadata Changes');
        if (metaJson) {
          try { changes = JSON.parse(metaJson); } catch (parseErr) {
            console.error('Failed to parse metadata changes: ' + parseErr.message);
          }
        }
      }
      if (changes) {
        var keys = Object.keys(changes);
        for (var m = 0; m < keys.length; m++) {
          var optionsKey = FIELD_TO_OPTIONS_[keys[m]];
          if (optionsKey && FIELD_OPTIONS[optionsKey]) {
            if (FIELD_OPTIONS[optionsKey].indexOf(changes[keys[m]]) === -1) {
              skipped.push(keys[m] + ': "' + changes[keys[m]] + '" is not an allowed value');
              continue;
            }
          }
          var cIdx = headerMap[keys[m]];
          if (cIdx != null) {
            masterSheet.getRange(masterRow, cIdx + 1).setValue(changes[keys[m]]);
          }
        }
      }

      const approvalIdx = col('Approval');
      const processedIdx = col('Processed');
      if (approvalIdx >= 0) sheet.getRange(queueRowIndex, approvalIdx + 1).setValue('Approved');
      if (processedIdx >= 0) sheet.getRange(queueRowIndex, processedIdx + 1).setValue(new Date().toISOString());

      var adminNotesIdx = col('Admin Notes');
      if (adminNotesIdx >= 0 && adminNotes) {
        sheet.getRange(queueRowIndex, adminNotesIdx + 1).setValue(adminNotes);
      }

      invalidateStatusTrackerCache_();
      return { success: true, skipped: skipped.length > 0 ? skipped : undefined };
    } finally {
      lock.releaseLock();
    }
  } catch (e) {
    return { success: false, error: e.message || String(e) };
  }
}

function rejectResponse(queueRowIndex, adminNotes) {
  try {
    const email = Session.getActiveUser().getEmail();
    if (!email || !isAdmin_(email)) {
      return { success: false, error: 'Admin access required.' };
    }

    const lock = LockService.getScriptLock();
    lock.waitLock(10000);

    try {
      const sheet = getResponseQueueSheet_();
      const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0]
        .map(h => String(h || '').trim());

      const col = (name) => headers.indexOf(name);
      const queueRow = sheet.getRange(queueRowIndex, 1, 1, headers.length).getValues()[0];
      const number = String(queueRow[col('Number')] || '').trim();

      const approvalIdx = col('Approval');
      const processedIdx = col('Processed');
      if (approvalIdx >= 0) sheet.getRange(queueRowIndex, approvalIdx + 1).setValue('Rejected');
      if (processedIdx >= 0) sheet.getRange(queueRowIndex, processedIdx + 1).setValue(new Date().toISOString());

      var adminNotesIdx = col('Admin Notes');
      if (adminNotesIdx >= 0 && adminNotes) {
        sheet.getRange(queueRowIndex, adminNotesIdx + 1).setValue(adminNotes);
      }

      if (number) {
        const { rows, headerMap } = getRequestMasterData_();
        const numIdx = headerMap[STATUS_TRACKER_COLUMNS.NUMBER];
        const actionStatusIdx = headerMap[STATUS_TRACKER_COLUMNS.ACTION_STATUS];
        if (numIdx != null && actionStatusIdx != null) {
          const masterSheet = getTargetSpreadsheet_().getSheetByName('Request_Master');
          for (let i = 0; i < rows.length; i++) {
            if (String(rows[i][numIdx] || '').trim() === number) {
              masterSheet.getRange(i + 2, actionStatusIdx + 1).setValue('Resubmit required');
              break;
            }
          }
        }
      }

      invalidateStatusTrackerCache_();
      return { success: true };
    } finally {
      lock.releaseLock();
    }
  } catch (e) {
    return { success: false, error: e.message || String(e) };
  }
}

function getReviewQueue() {
  try {
    var email = Session.getActiveUser().getEmail();
    if (!email || !isAdmin_(email)) {
      return { success: false, error: 'Admin access required.' };
    }

    var queueEntries = getResponseQueueData_();
    var pending = [];
    for (var q = 0; q < queueEntries.length; q++) {
      if (!queueEntries[q].processed) pending.push(queueEntries[q]);
    }

    if (pending.length === 0) return { success: true, items: [] };

    var masterData = getRequestMasterData_();
    var numIdx = masterData.headerMap[STATUS_TRACKER_COLUMNS.NUMBER];
    var masterByNumber = {};
    if (numIdx != null) {
      for (var i = 0; i < masterData.rows.length; i++) {
        var num = String(masterData.rows[i][numIdx] || '').trim();
        if (num) masterByNumber[num] = buildSubmissionFromRow_(masterData.rows[i], masterData.headerMap);
      }
    }

    var items = [];
    for (var p = 0; p < pending.length; p++) {
      var entry = pending[p];
      var sub = masterByNumber[entry.number] || null;
      items.push({
        queueRowIndex: entry.queueRowIndex,
        timestamp: entry.timestamp,
        submitterEmail: entry.submitterEmail,
        number: entry.number,
        demoTitle: entry.demoTitle || (sub ? sub.title : ''),
        type: entry.type,
        action: entry.action,
        response: entry.response,
        newLink: entry.newLink,
        notes: entry.notes,
        metadataChanges: entry.metadataChanges,
        submission: sub
      });
    }

    return { success: true, items: items };
  } catch (e) {
    return { success: false, error: e.message || String(e) };
  }
}
