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
  const allHeaders = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(h => String(h || '').trim());

  // Find Guide Extraction JSON column to exclude from cache (large read-only field)
  const guideJsonColIdx = allHeaders.indexOf('Guide Extraction JSON');

  let headers, rows;

  if (guideJsonColIdx === -1) {
    // No Guide JSON column - read all columns normally
    headers = allHeaders;
    rows = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
  } else {
    // Exclude Guide JSON column from cache to stay under 100KB limit
    // Read all other columns and reconstruct rows without Guide JSON
    headers = allHeaders.filter((_, idx) => idx !== guideJsonColIdx);

    const allRows = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
    rows = allRows.map(row => row.filter((_, idx) => idx !== guideJsonColIdx));
  }

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

function buildSubmissionFromRow_(row, headerMap, userEmail) {
  const col = STATUS_TRACKER_COLUMNS;
  const get = (name) => {
    const idx = headerMap[name];
    return idx != null ? String(row[idx] || '') : '';
  };

  // Numeric getter: preserves 0 as "0", only returns empty string for null/undefined/blank
  const getNumeric = (name) => {
    const idx = headerMap[name];
    if (idx == null) return '';
    const val = row[idx];
    if (val === null || val === undefined || val === '') return '';
    return String(val);
  };

  var meta = {};
  for (var fi = 0; fi < EDITABLE_METADATA_FIELDS_.length; fi++) {
    // Exclude Guide Extraction JSON from initial payload (read-only field, never edited)
    if (EDITABLE_METADATA_FIELDS_[fi].key === 'Guide Extraction JSON') continue;
    meta[EDITABLE_METADATA_FIELDS_[fi].key] = get(EDITABLE_METADATA_FIELDS_[fi].key);
  }

  // Calculate ownership using actual email values from source row
  // Do not expose email fields to frontend - ownership is calculated server-side only
  const creatorEmail = get(col.CREATOR_EMAIL).toLowerCase().trim();
  const requestorEmail = get(col.REQUESTOR_EMAIL).toLowerCase().trim();
  const lowerUserEmail = userEmail ? userEmail.toLowerCase().trim() : '';
  const isMine = lowerUserEmail && (creatorEmail === lowerUserEmail || requestorEmail === lowerUserEmail);

  return {
    title: get(col.FINAL_DEMO_TITLE) || get(col.SUGGESTED_DEMO_TITLE) || get('Video Title'),
    status: get(col.STATUS),
    dateSubmitted: get(col.CREATOR_SUBMITTED_TS) || get(col.STATUS_RECEIVED_TS),
    primaryProduct: get(col.PRIMARY_PRODUCT),
    primaryTopic: get(col.PRIMARY_TOPIC),
    otherTopics: get(col.TOPIC),
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
    playersPerMonth: getNumeric(col.PLAYERS_PER_MONTH),
    completionRate: getNumeric(col.COMPLETION_RATE),
    mtOpportunity: getNumeric(col.MT_OPPORTUNITY),
    mtWon: getNumeric(col.MT_WON),
    contentAge: getNumeric(col.CONTENT_AGE),
    metricsLastSync: get(col.METRICS_LAST_SYNC),
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
    // guideExtractionJson: REMOVED - large read-only field excluded from initial payload
    metadata: meta,
    isMine: isMine  // Server-calculated ownership flag
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
          submissions.push(buildSubmissionFromRow_(rows[i], headerMap, email));
        }
      } else if (admin) {
        submissions.push(buildSubmissionFromRow_(rows[i], headerMap, email));
      } else {
        if (creatorEmail === lowerEmail || requestorEmail === lowerEmail) {
          submissions.push(buildSubmissionFromRow_(rows[i], headerMap, email));
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
            submissions.push(buildSubmissionFromRow_(ytData.rows[yi], ytData.headerMap, email));
          }
        } else if (admin) {
          submissions.push(buildSubmissionFromRow_(ytData.rows[yi], ytData.headerMap, email));
        } else {
          if (ytCe === lowerEmail) {
            submissions.push(buildSubmissionFromRow_(ytData.rows[yi], ytData.headerMap, email));
          }
        }
      }
    }

    submissions.sort((a, b) => {
      const dateA = a.dateSubmitted ? new Date(a.dateSubmitted).getTime() : 0;
      const dateB = b.dateSubmitted ? new Date(b.dateSubmitted).getTime() : 0;
      return dateB - dateA;
    });

    // isMine is now calculated server-side in buildSubmissionFromRow_()

    return {
      success: true,
      submissions,
      userEmail: lowerEmail,
      isAdmin: admin,
      editableFields: EDITABLE_METADATA_FIELDS_,
      fieldOptions: FIELD_OPTIONS
    };
  } catch (e) {
    return { success: false, error: e.message || String(e) };
  }
}

function getAllSubmissions() {
  try {
    const email = Session.getActiveUser().getEmail();
    if (!email) return { success: false, error: 'Could not determine your email. Please make sure you are logged in.' };

    // All Submissions is now accessible to all authenticated users
    // Admin-only pendingResponse data is conditionally included based on isAdmin check

    const { rows, headerMap } = getRequestMasterData_();
    const lowerEmail = email.toLowerCase();
    const isUserAdmin = isAdmin_(email);
    const submissions = [];
    const seenGlobalIds = new Set();

    for (let i = 0; i < rows.length; i++) {
      const sub = buildSubmissionFromRow_(rows[i], headerMap, email);
      if (!sub.status) continue;
      if (sub.globalId) seenGlobalIds.add(sub.globalId);
      submissions.push(sub);
    }

    const ytData = getYouTubeResponsesData_();
    if (ytData.rows && ytData.rows.length) {
      for (let yi = 0; yi < ytData.rows.length; yi++) {
        const ytSub = buildSubmissionFromRow_(ytData.rows[yi], ytData.headerMap, email);
        if (!ytSub.status) continue;
        if (ytSub.globalId) seenGlobalIds.add(ytSub.globalId);
        submissions.push(ytSub);
      }
    }

    const pending = getPendingIntakeSubmissions_(seenGlobalIds, lowerEmail);
    for (let i = 0; i < pending.length; i++) {
      submissions.push(pending[i]);
    }

    // Admin-only: attach pending review queue data
    if (isUserAdmin) {
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
    }

    submissions.sort((a, b) => {
      const da = a.dateSubmitted ? new Date(a.dateSubmitted).getTime() : 0;
      const db = b.dateSubmitted ? new Date(b.dateSubmitted).getTime() : 0;
      return db - da;
    });

    return { success: true, submissions, userEmail: lowerEmail, isAdmin: isUserAdmin, editableFields: EDITABLE_METADATA_FIELDS_, fieldOptions: FIELD_OPTIONS };
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

    // Open collaboration model: All authenticated Red Hat users can submit responses
    // Authorization is at the admin approval layer, not at the submission layer
    const { rows, headerMap } = getRequestMasterData_();
    const numIdx = headerMap[STATUS_TRACKER_COLUMNS.NUMBER];
    const actionStatusIdx = headerMap[STATUS_TRACKER_COLUMNS.ACTION_STATUS];
    const statusIdx = headerMap[STATUS_TRACKER_COLUMNS.STATUS];

    if (numIdx == null) return { success: false, error: 'Configuration error.' };

    const isUserAdmin = isAdmin_(email);
    let currentActionStatus = '';
    let currentStatus = '';

    // Require explicit lifecycle_response type from frontend
    if (payload.type !== 'lifecycle_response') {
      return { success: false, error: 'Only lifecycle responses are supported. Please select an action and response.' };
    }

    // Read current status for validation
    const targetNumber = String(payload.number).trim();
    for (let i = 0; i < rows.length; i++) {
      if (String(rows[i][numIdx] || '').trim() === targetNumber) {
        if (actionStatusIdx != null) {
          currentActionStatus = normalizeActionStatus_(String(rows[i][actionStatusIdx] || '').trim());
        }
        if (statusIdx != null) {
          currentStatus = String(rows[i][statusIdx] || '').trim();
        }
        break;
      }
    }

    // RETIRED GUARD: Lifecycle responses not allowed for retired demos
    if (currentStatus === 'Retired') {
      return { success: false, error: 'This demo is retired and no longer accepts lifecycle responses.' };
    }

    // PENDING LOCK: If Action Status is "Pending Review", only admin can submit/overwrite
    // Creator must wait until admin moves it to "Resubmit" state
    if (currentActionStatus === 'Pending review' && !isUserAdmin) {
      return { success: false, error: 'Response is pending admin review. You can resubmit after admin feedback.' };
    }

    if (payload.type === 'metadata_edit') {
      return { success: false, error: 'Metadata editing is not supported. Please use lifecycle action responses only.' };
    }

    const hasMetadata = payload.metadataChanges && typeof payload.metadataChanges === 'object'
      && Object.keys(payload.metadataChanges).length > 0;

    // Metadata editing is not supported in Status Tracker
    if (hasMetadata) {
      return { success: false, error: 'Metadata editing is not supported. Please use lifecycle action responses only.' };
    }

    // Validate lifecycle response based on action
    let hasResponse = false;
    if (payload.response) {
      const lifecycleValues = payload.action === 'Improve completion'
        ? ['Updated', 'Need help']
        : payload.action === 'Consider retirement'
          ? ['Keep active', 'Retire', 'Need help']
          : [];
      hasResponse = lifecycleValues.indexOf(payload.response) !== -1;
    }

    if (!hasResponse) {
      return { success: false, error: 'Please select a response.' };
    }

    const type = 'lifecycle_response';

    const metadataJson = '';

    const lock = LockService.getScriptLock();
    lock.waitLock(10000);

    try {
      // CRITICAL: Direct sheet read after acquiring lock bypasses both caches
      // Read only the target row's Action Status, Status, Number, and metadata fields
      // This prevents stale-cache race where both runtime memo AND CacheService are outdated
      const masterSheet = getTargetSpreadsheet_().getSheetByName('Request_Master');
      if (!masterSheet) {
        throw new Error('Request_Master sheet not found.');
      }

      const allHeaders = masterSheet.getRange(1, 1, 1, masterSheet.getLastColumn()).getValues()[0]
        .map(h => String(h || '').trim());

      const masterNumIdx = allHeaders.indexOf(STATUS_TRACKER_COLUMNS.NUMBER);
      const masterAssignedIdx = allHeaders.indexOf(STATUS_TRACKER_COLUMNS.ASSIGNED);
      const masterCreatorNameIdx = allHeaders.indexOf(STATUS_TRACKER_COLUMNS.CREATOR_NAME);
      const masterCreatorEmailIdx = allHeaders.indexOf(STATUS_TRACKER_COLUMNS.CREATOR_EMAIL);
      const masterActionStatusIdx = allHeaders.indexOf(STATUS_TRACKER_COLUMNS.ACTION_STATUS);
      const masterStatusIdx = allHeaders.indexOf(STATUS_TRACKER_COLUMNS.STATUS);
      const masterRecommendedActionIdx = allHeaders.indexOf(STATUS_TRACKER_COLUMNS.RECOMMENDED_ACTION);
      const guideJsonColIdx = allHeaders.indexOf('Guide Extraction JSON');

      // PREFLIGHT: Validate required columns exist before any write
      if (masterNumIdx === -1 || masterActionStatusIdx === -1) {
        throw new Error('Required Master columns not found for status update.');
      }

      // Optimize: Exclude Guide Extraction JSON column from post-lock read
      // Build column subset for efficient read (exclude large read-only field)
      const columnsToRead = allHeaders
        .map((h, idx) => ({ header: h, idx: idx }))
        .filter(col => col.idx !== guideJsonColIdx);

      const headers = columnsToRead.map(col => col.header);
      const columnIndices = columnsToRead.map(col => col.idx);

      // Read all rows but only required columns (exclude Guide JSON)
      const lastRow = masterSheet.getLastRow();
      const allData = masterSheet.getRange(2, 1, lastRow - 1, masterSheet.getLastColumn()).getValues()
        .map(row => columnIndices.map(colIdx => row[colIdx]));

      // Rebuild column index mapping for the filtered data
      const filteredNumIdx = headers.indexOf(STATUS_TRACKER_COLUMNS.NUMBER);
      const filteredAssignedIdx = headers.indexOf(STATUS_TRACKER_COLUMNS.ASSIGNED);
      const filteredCreatorNameIdx = headers.indexOf(STATUS_TRACKER_COLUMNS.CREATOR_NAME);
      const filteredCreatorEmailIdx = headers.indexOf(STATUS_TRACKER_COLUMNS.CREATOR_EMAIL);
      const filteredActionStatusIdx = headers.indexOf(STATUS_TRACKER_COLUMNS.ACTION_STATUS);
      const filteredStatusIdx = headers.indexOf(STATUS_TRACKER_COLUMNS.STATUS);
      const filteredRecommendedActionIdx = headers.indexOf(STATUS_TRACKER_COLUMNS.RECOMMENDED_ACTION);

      // Find the target row by Number (direct sheet lookup - no cache)
      let masterRowIndex = -1;
      let masterAssigned = '';
      let masterCreatorName = '';
      let masterCreatorEmail = '';
      let masterActionStatus = '';
      let masterStatus = '';
      let masterRecommendedAction = '';

      for (let i = 0; i < allData.length; i++) {
        if (String(allData[i][filteredNumIdx] || '').trim() === String(payload.number)) {
          masterRowIndex = i;
          if (filteredAssignedIdx !== -1) {
            masterAssigned = String(allData[i][filteredAssignedIdx] || '').trim();
          }
          if (filteredCreatorNameIdx !== -1) {
            masterCreatorName = String(allData[i][filteredCreatorNameIdx] || '').trim();
          }
          if (filteredCreatorEmailIdx !== -1) {
            masterCreatorEmail = String(allData[i][filteredCreatorEmailIdx] || '').trim();
          }
          if (filteredActionStatusIdx !== -1) {
            masterActionStatus = normalizeActionStatus_(String(allData[i][filteredActionStatusIdx] || '').trim());
          }
          if (filteredStatusIdx !== -1) {
            masterStatus = String(allData[i][filteredStatusIdx] || '').trim();
          }
          if (filteredRecommendedActionIdx !== -1) {
            masterRecommendedAction = String(allData[i][filteredRecommendedActionIdx] || '').trim();
          }
          break;
        }
      }

      if (masterRowIndex < 0) {
        throw new Error('Demo #' + payload.number + ' not found on Master. Cannot submit response.');
      }

      // RE-CHECK after acquiring lock with fresh sheet data to prevent race condition
      // Ensures no user (including Admin) creates duplicate pending lifecycle responses via this endpoint
      // Admin review and approval are separate operations with their own authorization
      if (masterActionStatus === 'Pending review') {
        return { success: false, error: 'Response is pending admin review. You can resubmit after admin feedback.' };
      }

      if (masterActionStatus === 'Complete') {
        return { success: false, error: 'This action is already complete. No further responses accepted.' };
      }

      if (masterStatus === 'Retired') {
        return { success: false, error: 'This demo is retired and no longer accepts lifecycle responses.' };
      }

      // CRITICAL: Validate requested action matches authoritative Recommended action
      // Prevents submitting retirement request for demo whose actual recommendation is different
      if (payload.action && masterRecommendedAction) {
        const normalizedPayloadAction = payload.action.trim();
        const normalizedMasterAction = masterRecommendedAction.trim();

        // Only supported actions: "Improve completion", "Consider retirement"
        const supportedActions = ['Improve completion', 'Consider retirement'];
        if (supportedActions.indexOf(normalizedPayloadAction) === -1) {
          return { success: false, error: 'Unsupported lifecycle action. Please use an action from the recommendation.' };
        }

        if (normalizedPayloadAction !== normalizedMasterAction) {
          return {
            success: false,
            error: 'Your selected action ("' + normalizedPayloadAction + '") does not match the current recommendation ("' + normalizedMasterAction + '"). Please refresh and respond to the current recommendation.'
          };
        }
      }

      // Preflight passed - now safe to append to Queue
      const sheet = getResponseQueueSheet_();

      // Always append a new row (history-preserving model)
      // Each creator submission is a new review attempt
      const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0]
        .map(h => String(h || '').trim());

      // Build row data matching actual Response Queue schema
      const col = (name) => headers.indexOf(name);
      const rowData = new Array(headers.length).fill('');

      function set(name, value) {
        const idx = col(name);
        if (idx >= 0) rowData[idx] = value;
      }

      // Migration-compatible: Response Queue uses "Review Status" (target name)
      // but physical sheet may still have "Action Status" (pre-rename)
      const reviewStatusHeader = col('Review Status') >= 0 ? 'Review Status' : 'Action Status';

      set('Demo Number', String(payload.number));
      set('Number', String(payload.number));
      set('Assigned', masterAssigned);  // Copy from Master
      set('email', email);  // Actual submitting user email (current user)
      set('Creator Email', masterCreatorEmail);  // Copy from Master
      set('Creator Name', masterCreatorName);  // Copy from Master
      set('Demo Title', payload.title || '');
      set(reviewStatusHeader, 'Pending review');  // Initial state for new submission
      set('Timestamp', new Date().toISOString());
      set('Action Taken', payload.response || '');
      set('New Creation Link', payload.newLink || '');
      set('Additional Comments', payload.notes || '');
      set('Recommended Action', payload.action || '');

      // Metadata snapshot - store if present
      if (metadataJson && metadataJson !== '{}') {
        // Store in a suitable text column if available
        const metaCol = col('Target Update Date');  // Repurpose for metadata JSON
        if (metaCol >= 0) rowData[metaCol] = metadataJson;
      }

      sheet.appendRow(rowData);

      // Update Master Action Status - use validated index from preflight
      // CRITICAL: If this fails, Queue entry is already written (partial-write state)
      try {
        masterSheet.getRange(masterRowIndex + 2, masterActionStatusIdx + 1).setValue('Pending review');
      } catch (masterWriteError) {
        // Queue entry succeeded, Master write failed - partial state
        // Do NOT return success - user must know Master update failed
        // DO NOT retry - would create duplicate Queue entry
        throw new Error('Your response was recorded in Response_Queue but Request_Master could not be updated (' +
          masterWriteError.message + '). Contact an administrator to reconcile. Do NOT retry.');
      }

      invalidateStatusTrackerCache_();

      // Return minimal authoritative update for client-side state merge
      return {
        success: true,
        statusUpdate: {
          number: String(payload.number),
          perfActionStatus: 'Pending review'
        }
      };
    } finally {
      lock.releaseLock();
    }
  } catch (e) {
    return { success: false, error: e.message || String(e) };
  }
}

function getLatestPendingQueueEntry(demoNumber) {
  try {
    const email = Session.getActiveUser().getEmail();
    if (!email || !isAdmin_(email)) {
      return { success: false, error: 'Admin access required.' };
    }

    const sheet = getResponseQueueSheet_();
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) return { success: true, entry: null };

    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0]
      .map(h => String(h || '').trim());
    const data = sheet.getRange(2, 1, lastRow - 1, headers.length).getValues();

    const col = (name) => headers.indexOf(name);
    const numCol = col('Number');

    // Migration-compatible: look for "Review Status" first, fall back to "Action Status"
    const reviewStatusCol = col('Review Status') >= 0 ? col('Review Status') : col('Action Status');

    if (numCol < 0) return { success: false, error: 'Number column not found.' };
    if (reviewStatusCol < 0) return { success: false, error: 'Review Status or Action Status column not found.' };

    // Find latest matching row with Review Status = 'Pending review'
    for (let i = data.length - 1; i >= 0; i--) {
      const rowNumber = String(data[i][numCol] || '').trim();
      const reviewStatus = String(data[i][reviewStatusCol] || '').trim();

      if (rowNumber === String(demoNumber).trim() && reviewStatus === 'Pending review') {
        const rowIndex = i + 2;  // 1-indexed + header row
        const entry = {
          rowIndex: rowIndex,
          demoNumber: rowNumber,
          actionTaken: String(data[i][col('Action Taken')] || ''),
          newCreationLink: String(data[i][col('New Creation Link')] || ''),
          additionalComments: String(data[i][col('Additional Comments')] || ''),
          timestamp: String(data[i][col('Timestamp')] || ''),
          recommendedAction: String(data[i][col('Recommended Action')] || '')
        };
        return { success: true, entry: entry, action: entry.recommendedAction };
      }
    }

    return { success: true, entry: null };
  } catch (e) {
    return { success: false, error: e.message || String(e) };
  }
}

function getSubmittedResponse(demoNumber) {
  try {
    const email = Session.getActiveUser().getEmail();
    if (!email) {
      return { success: false, error: 'Authentication required.' };
    }

    // Open collaboration model: All authenticated users can view submitted responses
    const sheet = getResponseQueueSheet_();
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) return { success: true, response: null };

    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0]
      .map(h => String(h || '').trim());
    const data = sheet.getRange(2, 1, lastRow - 1, headers.length).getValues();

    const col = (name) => headers.indexOf(name);
    const numCol = col('Number');

    // Migration-compatible: look for "Review Status" first, fall back to "Action Status"
    const reviewStatusCol = col('Review Status') >= 0 ? col('Review Status') : col('Action Status');

    if (numCol < 0) return { success: false, error: 'Number column not found.' };
    if (reviewStatusCol < 0) return { success: false, error: 'Review Status or Action Status column not found.' };

    // Find latest matching row with Review Status = 'Pending review'
    for (let i = data.length - 1; i >= 0; i--) {
      const rowNumber = String(data[i][numCol] || '').trim();
      const reviewStatus = String(data[i][reviewStatusCol] || '').trim();

      if (rowNumber === String(demoNumber).trim() && reviewStatus === 'Pending review') {
        const submitterEmail = String(data[i][col('email')] || data[i][col('Creator Email')] || '').trim();
        // Note: submitterName is NOT in Response_Queue schema
        // We only have submitterEmail to identify who submitted this response
        const timestamp = String(data[i][col('Timestamp')] || '');
        const actionTaken = String(data[i][col('Action Taken')] || '');
        const newLink = String(data[i][col('New Creation Link')] || '');
        const notes = String(data[i][col('Additional Comments')] || '');
        const recommendedAction = String(data[i][col('Recommended Action')] || '');

        return {
          success: true,
          response: {
            submitterEmail: submitterEmail,
            timestamp: timestamp,
            actionTaken: actionTaken,
            newLink: newLink,
            notes: notes,
            recommendedAction: recommendedAction
          }
        };
      }
    }

    return { success: true, response: null };
  } catch (e) {
    return { success: false, error: e.message || String(e) };
  }
}

function getLatestAdminFeedback(demoNumber) {
  try {
    const email = Session.getActiveUser().getEmail();
    if (!email) {
      return { success: false, error: 'Authentication required.' };
    }

    // Open collaboration model: All authenticated users can view feedback for any demo
    // This allows collaborators who submitted responses to see admin guidance

    const sheet = getResponseQueueSheet_();
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) return { success: true, feedback: null };

    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0]
      .map(h => String(h || '').trim());
    const data = sheet.getRange(2, 1, lastRow - 1, headers.length).getValues();

    const col = (name) => headers.indexOf(name);
    const numCol = col('Number');

    // Migration-compatible: look for "Review Status" first, fall back to "Action Status"
    const reviewStatusCol = col('Review Status') >= 0 ? col('Review Status') : col('Action Status');
    const adminNotesCol = col('Admin Notes');

    if (numCol < 0) return { success: false, error: 'Number column not found.' };
    if (reviewStatusCol < 0) return { success: false, error: 'Review Status or Action Status column not found.' };

    // Find latest matching row with Review Status = 'Follow-up needed' (or legacy 'Resubmit required')
    for (let i = data.length - 1; i >= 0; i--) {
      const rowNumber = String(data[i][numCol] || '').trim();
      const reviewStatus = String(data[i][reviewStatusCol] || '').trim();

      if (rowNumber === String(demoNumber).trim() && (reviewStatus === 'Follow-up needed' || reviewStatus === 'Resubmit required')) {
        const adminNotes = String(data[i][adminNotesCol] || '').trim();
        const timestamp = String(data[i][col('Timestamp')] || '');

        return {
          success: true,
          feedback: {
            adminNotes: adminNotes,
            timestamp: timestamp
          }
        };
      }
    }

    return { success: true, feedback: null };
  } catch (e) {
    return { success: false, error: e.message || String(e) };
  }
}

function approveResponse(queueRowIndex, adminNotes) {
  try {
    const email = Session.getActiveUser().getEmail();
    if (!email || !isAdmin_(email)) {
      return { success: false, error: 'Admin access required.' };
    }

    const lock = LockService.getScriptLock();
    lock.waitLock(15000);

    try {
      // ===== PREFLIGHT: Validate all preconditions before any writes =====

      const sheet = getResponseQueueSheet_();
      const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0]
        .map(h => String(h || '').trim());

      // Validate required Queue headers
      const col = (name) => headers.indexOf(name);

      // Migration-compatible: look for "Review Status" first, fall back to "Action Status"
      const reviewStatusIdx = col('Review Status') >= 0 ? col('Review Status') : col('Action Status');
      const numberIdx = col('Number');
      const adminNotesIdx = col('Admin Notes');
      const queueCompletedIdx = col('Action Completed Date');
      const newLinkIdx = col('New Creation Link');

      if (reviewStatusIdx < 0 || numberIdx < 0) {
        return { success: false, error: 'Required Queue columns not found.' };
      }

      // Validate target Queue row exists and matches expected state
      const queueRow = sheet.getRange(queueRowIndex, 1, 1, headers.length).getValues()[0];

      const queueReviewStatus = String(queueRow[reviewStatusIdx] || '').trim();
      const number = String(queueRow[numberIdx] || '').trim();
      const queueDemoNumber = String(queueRow[col('Demo Number')] || '').trim();

      // Verify Queue row is in expected Pending review state
      if (queueReviewStatus !== 'Pending review') {
        return { success: false, error: 'Queue row is not Pending review (current: ' + queueReviewStatus + '). Refresh and retry.' };
      }

      if (!number) {
        return { success: false, error: 'No demo number found in Queue row.' };
      }

      // Validate Request_Master row exists and matches expected state
      const { rows, headerMap } = getRequestMasterData_();
      const numIdx = headerMap[STATUS_TRACKER_COLUMNS.NUMBER];
      const actionStatusIdx = headerMap[STATUS_TRACKER_COLUMNS.ACTION_STATUS];
      const completedDateIdx = headerMap[STATUS_TRACKER_COLUMNS.ACTION_COMPLETED_DATE];
      const creationLinkIdx = headerMap[STATUS_TRACKER_COLUMNS.CREATION_LINK];

      if (numIdx == null || actionStatusIdx == null) {
        return { success: false, error: 'Required Master columns not found.' };
      }

      let masterRowIdx = -1;
      let masterActionStatus = '';
      for (let i = 0; i < rows.length; i++) {
        if (String(rows[i][numIdx] || '').trim() === number) {
          masterRowIdx = i;
          masterActionStatus = String(rows[i][actionStatusIdx] || '').trim();
          break;
        }
      }

      if (masterRowIdx < 0) {
        return { success: false, error: 'Demo #' + number + ' not found on Request_Master.' };
      }

      // Verify Master is in expected Pending review state
      if (masterActionStatus !== 'Pending review') {
        return { success: false, error: 'Master Action Status is not Pending review (current: ' + masterActionStatus + '). Workflow out of sync. Refresh and retry.' };
      }

      // Check if this is a retirement completion
      const actionTakenIdx = col('Action Taken');
      const actionTaken = actionTakenIdx >= 0 ? String(queueRow[actionTakenIdx] || '').trim() : '';
      const isRetirement = (actionTaken === 'Retire');

      // ===== PREFLIGHT PASSED: Perform writes =====

      const masterSheet = getTargetSpreadsheet_().getSheetByName('Request_Master');
      const masterRow = masterRowIdx + 2;
      const timestamp = new Date().toISOString();

      try {
        // Write Master updates
        masterSheet.getRange(masterRow, actionStatusIdx + 1).setValue('Complete');

        if (completedDateIdx != null) {
          masterSheet.getRange(masterRow, completedDateIdx + 1).setValue(timestamp);
        }

        // If this is a retirement, update Status and Status Retired Timestamp
        if (isRetirement) {
          const statusIdx = headerMap[STATUS_TRACKER_COLUMNS.STATUS];
          const retiredTsIdx = headerMap[STATUS_TRACKER_COLUMNS.STATUS_RETIRED_TS];

          if (statusIdx != null) {
            masterSheet.getRange(masterRow, statusIdx + 1).setValue('Retired');
          }

          if (retiredTsIdx != null) {
            masterSheet.getRange(masterRow, retiredTsIdx + 1).setValue(timestamp);
          }
        }

        const newLinkColIdx = col('New Creation Link');
        const newLink = newLinkColIdx >= 0 ? String(queueRow[newLinkColIdx] || '').trim() : '';
        if (newLink && creationLinkIdx != null) {
          masterSheet.getRange(masterRow, creationLinkIdx + 1).setValue(newLink);
        }

        // Write Queue updates
        sheet.getRange(queueRowIndex, reviewStatusIdx + 1).setValue('Complete');

        if (adminNotesIdx >= 0 && adminNotes) {
          sheet.getRange(queueRowIndex, adminNotesIdx + 1).setValue(adminNotes);
        }

        if (queueCompletedIdx >= 0) {
          sheet.getRange(queueRowIndex, queueCompletedIdx + 1).setValue(timestamp);
        }

      } catch (writeErr) {
        // Rollback: attempt to restore Master to Pending review if Queue write failed
        try {
          masterSheet.getRange(masterRow, actionStatusIdx + 1).setValue('Pending review');
          if (completedDateIdx != null) {
            masterSheet.getRange(masterRow, completedDateIdx + 1).setValue('');
          }
        } catch (rollbackErr) {
          Logger.log('Rollback failed after partial write: ' + rollbackErr.message);
        }

        return { success: false, error: 'Write failed: ' + writeErr.message + '. Attempted rollback. Refresh and retry.' };
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

function requestChanges(queueRowIndex, adminNotes) {
  try {
    const email = Session.getActiveUser().getEmail();
    if (!email || !isAdmin_(email)) {
      return { success: false, error: 'Admin access required.' };
    }

    if (!adminNotes || !adminNotes.trim()) {
      return { success: false, error: 'Admin Notes required when requesting changes.' };
    }

    const lock = LockService.getScriptLock();
    lock.waitLock(10000);

    try {
      // ===== PREFLIGHT: Validate all preconditions before any writes =====

      const sheet = getResponseQueueSheet_();
      const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0]
        .map(h => String(h || '').trim());

      // Validate required Queue headers
      const col = (name) => headers.indexOf(name);

      // Migration-compatible: look for "Review Status" first, fall back to "Action Status"
      const reviewStatusIdx = col('Review Status') >= 0 ? col('Review Status') : col('Action Status');
      const numberIdx = col('Number');
      const adminNotesIdx = col('Admin Notes');

      if (reviewStatusIdx < 0 || numberIdx < 0) {
        return { success: false, error: 'Required Queue columns not found.' };
      }

      // Validate target Queue row exists and matches expected state
      const queueRow = sheet.getRange(queueRowIndex, 1, 1, headers.length).getValues()[0];
      const number = String(queueRow[numberIdx] || '').trim();
      const queueReviewStatus = String(queueRow[reviewStatusIdx] || '').trim();

      // Verify Queue row is in expected Pending review state
      if (queueReviewStatus !== 'Pending review') {
        return { success: false, error: 'Queue row is not Pending review (current: ' + queueReviewStatus + '). Refresh and retry.' };
      }

      if (!number) {
        return { success: false, error: 'No demo number found in Queue row.' };
      }

      // Validate Request_Master row exists and matches expected state
      const { rows, headerMap } = getRequestMasterData_();
      const numIdx = headerMap[STATUS_TRACKER_COLUMNS.NUMBER];
      const actionStatusIdx = headerMap[STATUS_TRACKER_COLUMNS.ACTION_STATUS];

      if (numIdx == null || actionStatusIdx == null) {
        return { success: false, error: 'Required Master columns not found.' };
      }

      let masterRowIdx = -1;
      let masterActionStatus = '';
      for (let i = 0; i < rows.length; i++) {
        if (String(rows[i][numIdx] || '').trim() === number) {
          masterRowIdx = i;
          masterActionStatus = String(rows[i][actionStatusIdx] || '').trim();
          break;
        }
      }

      if (masterRowIdx < 0) {
        return { success: false, error: 'Demo #' + number + ' not found on Request_Master.' };
      }

      // Verify Master is in expected Pending review state
      if (masterActionStatus !== 'Pending review') {
        return { success: false, error: 'Master Action Status is not Pending review (current: ' + masterActionStatus + '). Workflow out of sync. Refresh and retry.' };
      }

      // ===== PREFLIGHT PASSED: Perform writes =====

      const masterSheet = getTargetSpreadsheet_().getSheetByName('Request_Master');
      const masterRow = masterRowIdx + 2;

      try {
        // Write Queue updates first
        sheet.getRange(queueRowIndex, reviewStatusIdx + 1).setValue('Follow-up needed');

        if (adminNotesIdx >= 0) {
          sheet.getRange(queueRowIndex, adminNotesIdx + 1).setValue(adminNotes.trim());
        }

        // Write Master update
        masterSheet.getRange(masterRow, actionStatusIdx + 1).setValue('Follow-up needed');

      } catch (writeErr) {
        // Rollback: attempt to restore Queue to Pending review if Master write failed
        try {
          sheet.getRange(queueRowIndex, reviewStatusIdx + 1).setValue('Pending review');
          if (adminNotesIdx >= 0) {
            sheet.getRange(queueRowIndex, adminNotesIdx + 1).setValue('');
          }
        } catch (rollbackErr) {
          Logger.log('Rollback failed after partial write: ' + rollbackErr.message);
        }

        return { success: false, error: 'Write failed: ' + writeErr.message + '. Attempted rollback. Refresh and retry.' };
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

// Alias for backward compatibility
function rejectResponse(queueRowIndex, adminNotes) {
  return requestChanges(queueRowIndex, adminNotes);
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
