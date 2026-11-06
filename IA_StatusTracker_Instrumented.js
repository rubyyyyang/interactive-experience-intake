/**
 * INSTRUMENTED VERSION - For cache verification only
 * Replace getRequestMasterData_() with this temporarily
 * Check Apps Script logs after running Status Tracker
 */

function getRequestMasterData_() {
  const startTime = new Date().getTime();

  if (ST_RUNTIME_MEMO_) {
    Logger.log('[CACHE] Runtime memo HIT (0ms)');
    return ST_RUNTIME_MEMO_;
  }

  // Check cache
  const cacheCheckStart = new Date().getTime();
  try {
    const cached = CacheService.getScriptCache().get(ST_CACHE_KEY_);
    const cacheCheckTime = new Date().getTime() - cacheCheckStart;

    if (cached) {
      const parseStart = new Date().getTime();
      const parsed = JSON.parse(cached);
      const parseTime = new Date().getTime() - parseStart;

      if (parsed && parsed.headers && parsed.rows) {
        ST_RUNTIME_MEMO_ = parsed;
        const totalTime = new Date().getTime() - startTime;

        Logger.log('========================================');
        Logger.log('[CACHE] HIT - Data loaded from cache');
        Logger.log('[CACHE]   Cache lookup: ' + cacheCheckTime + 'ms');
        Logger.log('[CACHE]   JSON parse: ' + parseTime + 'ms');
        Logger.log('[CACHE]   Total time: ' + totalTime + 'ms');
        Logger.log('[CACHE]   Cached size: ' + (cached.length / 1024).toFixed(2) + ' KB');
        Logger.log('[CACHE]   Row count: ' + parsed.rows.length);
        Logger.log('[CACHE]   Has Guide JSON column: ' + (parsed.headers.indexOf('Guide Extraction JSON') !== -1 ? 'YES' : 'NO'));
        Logger.log('========================================');

        return parsed;
      }
    } else {
      Logger.log('[CACHE] MISS - Cache empty');
    }
  } catch (e) {
    Logger.log('[CACHE] ERROR during cache check: ' + e.message);
  }

  // Read from Sheets
  const sheetsStart = new Date().getTime();

  const spreadsheetId = PropertiesService.getScriptProperties().getProperty(MASTER_SPREADSHEET_ID_PROP);
  if (!spreadsheetId) throw new Error('MASTER_SPREADSHEET_ID is not configured.');

  const openStart = new Date().getTime();
  const ss = SpreadsheetApp.openById(spreadsheetId);
  const sheet = ss.getSheetByName('Request_Master');
  if (!sheet) throw new Error('Request_Master sheet not found.');
  const openTime = new Date().getTime() - openStart;

  const metaStart = new Date().getTime();
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) {
    Logger.log('[CACHE] Empty sheet - no data');
    return { headers: [], rows: [], headerMap: {} };
  }
  const lastCol = sheet.getLastColumn();
  const metaTime = new Date().getTime() - metaStart;

  const headerStart = new Date().getTime();
  const allHeaders = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(h => String(h || '').trim());
  const headerTime = new Date().getTime() - headerStart;

  // Find Guide Extraction JSON column to exclude from cache (large read-only field)
  const guideJsonColIdx = allHeaders.indexOf('Guide Extraction JSON');

  const rowReadStart = new Date().getTime();
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
  const rowReadTime = new Date().getTime() - rowReadStart;

  const headerMap = {};
  headers.forEach((h, i) => { if (h) headerMap[h] = i; });

  const result = { headers, rows, headerMap };
  ST_RUNTIME_MEMO_ = result;

  const sheetsTime = new Date().getTime() - sheetsStart;

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
    Logger.log('[CACHE] Write FAILED: ' + e.message);
  }
  const cacheWriteTime = new Date().getTime() - cacheWriteStart;

  const totalTime = new Date().getTime() - startTime;

  Logger.log('========================================');
  Logger.log('[CACHE] MISS - Full sheet read');
  Logger.log('========================================');
  Logger.log('[SHEETS] Timing breakdown:');
  Logger.log('[SHEETS]   Open spreadsheet: ' + openTime + 'ms');
  Logger.log('[SHEETS]   Get row/col metadata: ' + metaTime + 'ms');
  Logger.log('[SHEETS]   Read headers: ' + headerTime + 'ms');
  Logger.log('[SHEETS]   Read rows: ' + rowReadTime + 'ms');
  Logger.log('[SHEETS]   Total sheet time: ' + sheetsTime + 'ms');
  Logger.log('[DATA] Dataset info:');
  Logger.log('[DATA]   Row count: ' + rows.length);
  Logger.log('[DATA]   Column count: ' + headers.length);
  Logger.log('[DATA]   Guide JSON excluded: ' + (guideJsonColIdx !== -1 ? 'YES (was column ' + guideJsonColIdx + ')' : 'NO (column not found)'));
  Logger.log('[CACHE] Write attempt:');
  Logger.log('[CACHE]   Serialized size: ' + (serializedSize / 1024).toFixed(2) + ' KB');
  Logger.log('[CACHE]   Cache limit: 100 KB');
  Logger.log('[CACHE]   Fits in cache: ' + (serializedSize <= 100000 ? 'YES' : 'NO'));
  Logger.log('[CACHE]   Write result: ' + (cacheWriteSuccess ? 'SUCCESS' : 'FAILED'));
  Logger.log('[CACHE]   Write time: ' + cacheWriteTime + 'ms');
  Logger.log('[PERF] Total execution time: ' + totalTime + 'ms');
  Logger.log('========================================');

  return result;
}
