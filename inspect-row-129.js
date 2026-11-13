/**
 * Read-only inspection of Request_Master row 129 and column headers
 * Run via Apps Script to diagnose partial write from failed approval
 */

function inspectRow129() {
  const spreadsheetId = PropertiesService.getScriptProperties().getProperty('MASTER_SPREADSHEET_ID');
  const ss = SpreadsheetApp.openById(spreadsheetId);
  const sheet = ss.getSheetByName('Request_Master');

  // Get all headers
  const lastCol = sheet.getLastColumn();
  const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];

  // Find physical column positions for DH through DL
  const dhCol = 112; // DH = column 112
  const diCol = 113; // DI = column 113
  const djCol = 114; // DJ = column 114
  const dkCol = 115; // DK = column 115
  const dlCol = 116; // DL = column 116

  console.log('=== PHYSICAL COLUMN HEADERS (DH-DL) ===');
  console.log(`DH (col ${dhCol}): ${headers[dhCol - 1]}`);
  console.log(`DI (col ${diCol}): ${headers[diCol - 1]}`);
  console.log(`DJ (col ${djCol}): ${headers[djCol - 1]}`);
  console.log(`DK (col ${dkCol}): ${headers[dkCol - 1]}`);
  console.log(`DL (col ${dlCol}): ${headers[dlCol - 1]}`);

  // Get row 129 values for DH through DL
  const row129 = sheet.getRange(129, dhCol, 1, 5).getValues()[0];

  console.log('\n=== ROW 129 VALUES (DH-DL) ===');
  console.log(`DH129: "${row129[0]}"`);
  console.log(`DI129: "${row129[1]}"`);
  console.log(`DJ129: "${row129[2]}"`);
  console.log(`DK129: "${row129[3]}"`);
  console.log(`DL129: "${row129[4]}"`);

  // Get demo number and related info
  const numberColIdx = headers.indexOf('Number');
  const statusColIdx = headers.indexOf('Status');
  const creatorNameIdx = headers.indexOf('Creator Name');
  const titleIdx = headers.indexOf('Final Demo Title') >= 0 ? headers.indexOf('Final Demo Title') : headers.indexOf('Suggested Demo Title');

  const row129Full = sheet.getRange(129, 1, 1, lastCol).getValues()[0];

  console.log('\n=== ROW 129 IDENTIFYING INFO ===');
  console.log(`Number: ${row129Full[numberColIdx]}`);
  console.log(`Title: ${row129Full[titleIdx]}`);
  console.log(`Status: ${row129Full[statusColIdx]}`);
  console.log(`Creator: ${row129Full[creatorNameIdx]}`);

  // Find Guide Extraction JSON position
  const guideJsonIdx = headers.indexOf('Guide Extraction JSON');
  const actionStatusIdx = headers.indexOf('Action Status');
  const actionCompletedIdx = headers.indexOf('Action Completed Date');
  const creationLinkIdx = headers.indexOf('Creation Link');

  console.log('\n=== CRITICAL COLUMN POSITIONS ===');
  console.log(`Guide Extraction JSON: index ${guideJsonIdx}, column ${guideJsonIdx + 1}`);
  console.log(`Action Status: index ${actionStatusIdx}, column ${actionStatusIdx + 1}`);
  console.log(`Action Completed Date: index ${actionCompletedIdx}, column ${actionCompletedIdx + 1}`);
  console.log(`Creation Link: index ${creationLinkIdx}, column ${creationLinkIdx + 1}`);

  // Check Response_Queue for matching entry
  const queueSheet = ss.getSheetByName('Response_Queue');
  if (queueSheet) {
    const queueHeaders = queueSheet.getRange(1, 1, 1, queueSheet.getLastColumn()).getValues()[0];
    const queueData = queueSheet.getRange(2, 1, queueSheet.getLastRow() - 1, queueSheet.getLastColumn()).getValues();

    const queueNumIdx = queueHeaders.indexOf('Number') >= 0 ? queueHeaders.indexOf('Number') : queueHeaders.indexOf('Demo Number');
    const queueReviewStatusIdx = queueHeaders.indexOf('Review Status') >= 0 ? queueHeaders.indexOf('Review Status') : queueHeaders.indexOf('Action Status');

    console.log('\n=== RESPONSE QUEUE ENTRIES FOR THIS DEMO ===');
    const demoNumber = row129Full[numberColIdx];

    queueData.forEach((qRow, idx) => {
      if (String(qRow[queueNumIdx]) === String(demoNumber)) {
        const reviewStatus = qRow[queueReviewStatusIdx];
        const timestamp = qRow[queueHeaders.indexOf('Timestamp')];
        const actionTaken = qRow[queueHeaders.indexOf('Action Taken')];

        console.log(`Queue row ${idx + 2}: Review Status="${reviewStatus}", Action="${actionTaken}", Time=${timestamp}`);
      }
    });
  }

  console.log('\n=== INSPECTION COMPLETE ===');
}
