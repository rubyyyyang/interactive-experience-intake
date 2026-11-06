/**
 * Performance Instrumentation for Status Tracker
 *
 * Add this to IA_StatusTracker.js temporarily to measure actual bottlenecks.
 * Instructions:
 * 1. Copy these instrumented functions into IA_StatusTracker.js
 * 2. Deploy via clasp push (test deployment only)
 * 3. Open Status Tracker and check Apps Script logs
 * 4. Report the timing measurements
 */

// Instrumented version of getRequestMasterData_()
function getRequestMasterData_INSTRUMENTED() {
  const startTotal = new Date().getTime();

  // Check runtime memo
  if (ST_RUNTIME_MEMO_) {
    Logger.log('[PERF] getRequestMasterData: Runtime memo hit (0ms)');
    return ST_RUNTIME_MEMO_;
  }

  // Check cache
  const cacheStart = new Date().getTime();
  try {
    const cached = CacheService.getScriptCache().get(ST_CACHE_KEY_);
    const cacheElapsed = new Date().getTime() - cacheStart;

    if (cached) {
      const parseStart = new Date().getTime();
      const parsed = JSON.parse(cached);
      const parseElapsed = new Date().getTime() - parseStart;

      if (parsed && parsed.headers && parsed.rows) {
        ST_RUNTIME_MEMO_ = parsed;
        const totalElapsed = new Date().getTime() - startTotal;

        Logger.log('[PERF] getRequestMasterData: Cache HIT');
        Logger.log('[PERF]   - Cache lookup: ' + cacheElapsed + 'ms');
        Logger.log('[PERF]   - JSON parse: ' + parseElapsed + 'ms');
        Logger.log('[PERF]   - Total: ' + totalElapsed + 'ms');
        Logger.log('[PERF]   - Cached size: ' + (cached.length / 1024).toFixed(1) + ' KB');
        Logger.log('[PERF]   - Row count: ' + parsed.rows.length);

        return parsed;
      }
    } else {
      Logger.log('[PERF] getRequestMasterData: Cache MISS (cache empty)');
      Logger.log('[PERF]   - Cache lookup: ' + cacheElapsed + 'ms');
    }
  } catch (e) {
    const cacheElapsed = new Date().getTime() - cacheStart;
    Logger.log('[PERF] getRequestMasterData: Cache ERROR - ' + e.message);
    Logger.log('[PERF]   - Cache lookup: ' + cacheElapsed + 'ms');
  }

  // Read from Sheets
  const sheetStart = new Date().getTime();

  const spreadsheetId = PropertiesService.getScriptProperties().getProperty(MASTER_SPREADSHEET_ID_PROP);
  if (!spreadsheetId) throw new Error('MASTER_SPREADSHEET_ID is not configured.');

  const openStart = new Date().getTime();
  const ss = SpreadsheetApp.openById(spreadsheetId);
  const openElapsed = new Date().getTime() - openStart;

  const getSheetStart = new Date().getTime();
  const sheet = ss.getSheetByName('Request_Master');
  if (!sheet) throw new Error('Request_Master sheet not found.');
  const getSheetElapsed = new Date().getTime() - getSheetStart;

  const metadataStart = new Date().getTime();
  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();
  const metadataElapsed = new Date().getTime() - metadataStart;

  if (lastRow <= 1) {
    Logger.log('[PERF] getRequestMasterData: Empty sheet');
    return { headers: [], rows: [], headerMap: {} };
  }

  const headerStart = new Date().getTime();
  const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(h => String(h || '').trim());
  const headerElapsed = new Date().getTime() - headerStart;

  const rowsStart = new Date().getTime();
  const rows = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
  const rowsElapsed = new Date().getTime() - rowsStart;

  const headerMapStart = new Date().getTime();
  const headerMap = {};
  headers.forEach((h, i) => { if (h) headerMap[h] = i; });
  const headerMapElapsed = new Date().getTime() - headerMapStart;

  const result = { headers, rows, headerMap };
  ST_RUNTIME_MEMO_ = result;

  const sheetElapsed = new Date().getTime() - sheetStart;

  // Cache write
  const cacheWriteStart = new Date().getTime();
  let cacheWriteSuccess = false;
  let serializedSize = 0;

  try {
    const serialized = JSON.stringify(result);
    serializedSize = serialized.length;
    CacheService.getScriptCache().put(ST_CACHE_KEY_, serialized, ST_CACHE_TTL_);
    cacheWriteSuccess = true;
  } catch (e) {
    Logger.log('[PERF] Cache write FAILED: ' + e.message);
  }

  const cacheWriteElapsed = new Date().getTime() - cacheWriteStart;
  const totalElapsed = new Date().getTime() - startTotal;

  // Calculate Guide JSON impact
  let guideJsonSize = 0;
  const guideJsonIdx = headerMap['Guide Extraction JSON'];
  if (guideJsonIdx != null) {
    for (let i = 0; i < Math.min(rows.length, 10); i++) {
      const val = rows[i][guideJsonIdx];
      if (val) guideJsonSize += String(val).length;
    }
    guideJsonSize = guideJsonSize / Math.min(rows.length, 10); // average per row
  }

  Logger.log('[PERF] ========================================');
  Logger.log('[PERF] getRequestMasterData: Full sheet read');
  Logger.log('[PERF] ========================================');
  Logger.log('[PERF] Sheet operations:');
  Logger.log('[PERF]   - Open spreadsheet: ' + openElapsed + 'ms');
  Logger.log('[PERF]   - Get sheet: ' + getSheetElapsed + 'ms');
  Logger.log('[PERF]   - Get metadata (lastRow/lastCol): ' + metadataElapsed + 'ms');
  Logger.log('[PERF]   - Read headers: ' + headerElapsed + 'ms');
  Logger.log('[PERF]   - Read rows: ' + rowsElapsed + 'ms');
  Logger.log('[PERF]   - Build headerMap: ' + headerMapElapsed + 'ms');
  Logger.log('[PERF]   - Total sheet time: ' + sheetElapsed + 'ms');
  Logger.log('[PERF] Data size:');
  Logger.log('[PERF]   - Rows: ' + rows.length);
  Logger.log('[PERF]   - Columns: ' + lastCol);
  Logger.log('[PERF]   - Serialized size: ' + (serializedSize / 1024).toFixed(1) + ' KB');
  Logger.log('[PERF]   - Guide JSON avg per row: ' + (guideJsonSize / 1024).toFixed(1) + ' KB');
  Logger.log('[PERF]   - Estimated Guide JSON total: ' + (guideJsonSize * rows.length / 1024).toFixed(1) + ' KB');
  Logger.log('[PERF] Cache:');
  Logger.log('[PERF]   - Cache write: ' + (cacheWriteSuccess ? 'SUCCESS' : 'FAILED') + ' (' + cacheWriteElapsed + 'ms)');
  Logger.log('[PERF]   - Cache limit: 100 KB per key');
  Logger.log('[PERF]   - Actual size: ' + (serializedSize / 1024).toFixed(1) + ' KB');
  Logger.log('[PERF]   - Over limit: ' + (serializedSize > 100000 ? 'YES - CACHE DISABLED' : 'NO'));
  Logger.log('[PERF] Total time: ' + totalElapsed + 'ms');
  Logger.log('[PERF] ========================================');

  return result;
}

// Instrumented version of getMySubmissions()
function getMySubmissions_INSTRUMENTED(searchQuery) {
  const startTotal = new Date().getTime();

  try {
    const email = Session.getActiveUser().getEmail();
    if (!email) return { success: false, error: 'Could not determine your email.' };

    const admin = isAdmin_(email);
    const lowerEmail = email.toLowerCase();
    const lowerSearch = searchQuery ? searchQuery.toLowerCase() : '';

    const dataStart = new Date().getTime();
    const { rows, headerMap } = getRequestMasterData_();
    const dataElapsed = new Date().getTime() - dataStart;

    const buildStart = new Date().getTime();
    const submissions = [];
    const creatorEmailIdx = headerMap[STATUS_TRACKER_COLUMNS.CREATOR_EMAIL];
    const requestorEmailIdx = headerMap[STATUS_TRACKER_COLUMNS.REQUESTOR_EMAIL];
    const creatorNameIdx = headerMap[STATUS_TRACKER_COLUMNS.CREATOR_NAME];

    for (let i = 0; i < rows.length; i++) {
      const ce = creatorEmailIdx != null ? String(rows[i][creatorEmailIdx] || '').toLowerCase().trim() : '';
      const re = requestorEmailIdx != null ? String(rows[i][requestorEmailIdx] || '').toLowerCase().trim() : '';
      const cn = creatorNameIdx != null ? String(rows[i][creatorNameIdx] || '').toLowerCase().trim() : '';

      if (lowerSearch) {
        if (cn.includes(lowerSearch)) {
          submissions.push(buildSubmissionFromRow_(rows[i], headerMap));
        }
      } else if (admin) {
        submissions.push(buildSubmissionFromRow_(rows[i], headerMap));
      } else {
        if (ce === lowerEmail || re === lowerEmail) {
          submissions.push(buildSubmissionFromRow_(rows[i], headerMap));
        }
      }
    }

    const buildElapsed = new Date().getTime() - buildStart;

    const ytStart = new Date().getTime();
    const ytData = getYouTubeResponsesData_();
    const ytElapsed = new Date().getTime() - ytStart;

    const ytBuildStart = new Date().getTime();
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
    const ytBuildElapsed = new Date().getTime() - ytBuildStart;

    const sortStart = new Date().getTime();
    submissions.sort((a, b) => {
      const dateA = a.dateSubmitted ? new Date(a.dateSubmitted).getTime() : 0;
      const dateB = b.dateSubmitted ? new Date(b.dateSubmitted).getTime() : 0;
      return dateB - dateA;
    });
    const sortElapsed = new Date().getTime() - sortStart;

    const markStart = new Date().getTime();
    for (let s = 0; s < submissions.length; s++) {
      const ce = submissions[s].creatorEmail ? submissions[s].creatorEmail.toLowerCase() : '';
      const re = submissions[s].requestorEmail ? submissions[s].requestorEmail.toLowerCase() : '';
      submissions[s].isMine = (ce === lowerEmail || re === lowerEmail);
    }
    const markElapsed = new Date().getTime() - markStart;

    const totalElapsed = new Date().getTime() - startTotal;

    Logger.log('[PERF] ========================================');
    Logger.log('[PERF] getMySubmissions breakdown:');
    Logger.log('[PERF] ========================================');
    Logger.log('[PERF]   - getRequestMasterData: ' + dataElapsed + 'ms');
    Logger.log('[PERF]   - Build Master submissions: ' + buildElapsed + 'ms (' + rows.length + ' rows)');
    Logger.log('[PERF]   - getYouTubeResponsesData: ' + ytElapsed + 'ms');
    Logger.log('[PERF]   - Build YouTube submissions: ' + ytBuildElapsed + 'ms');
    Logger.log('[PERF]   - Sort submissions: ' + sortElapsed + 'ms');
    Logger.log('[PERF]   - Mark mine: ' + markElapsed + 'ms');
    Logger.log('[PERF]   - Total submissions returned: ' + submissions.length);
    Logger.log('[PERF]   - Total time: ' + totalElapsed + 'ms');
    Logger.log('[PERF] ========================================');

    return {
      success: true,
      submissions,
      userEmail: lowerEmail,
      isAdmin: admin,
      editableFields: EDITABLE_METADATA_FIELDS_,
      fieldOptions: FIELD_OPTIONS
    };
  } catch (e) {
    Logger.log('[PERF] ERROR in getMySubmissions: ' + e.message);
    return { success: false, error: e.message || String(e) };
  }
}

/**
 * DEPLOYMENT INSTRUCTIONS:
 *
 * 1. Replace getRequestMasterData_() with getRequestMasterData_INSTRUMENTED()
 * 2. Replace getMySubmissions() with getMySubmissions_INSTRUMENTED()
 * 3. Deploy to test deployment: clasp push
 * 4. Open Status Tracker in browser
 * 5. Check Apps Script logs: https://script.google.com/home/executions
 * 6. Report the measurements here
 *
 * KEY METRICS TO REPORT:
 * - Cache hit or miss?
 * - Serialized size vs 100KB limit
 * - Time spent reading sheets
 * - Time spent building submissions
 * - Guide JSON size in cache
 * - Total execution time
 */
