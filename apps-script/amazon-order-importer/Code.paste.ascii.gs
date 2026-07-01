/**
 * Gmail Amazon order importer for Google Sheets.
 *
 * Setup:
 * 1. Open the target spreadsheet.
 * 2. Extensions > Apps Script.
 * 3. Paste this file into Code.gs.
 * 4. Run setupAmazonOrderImporter once and approve permissions.
 */

const AMAZON_ORDER_IMPORTER_CONFIG = {
  spreadsheetId: '1bQCIpw74Rdz4Db8IXPNZXVCqr4qS3qVhCZY5dxRr6IU',
  spreadsheetTitle: '\u2605\u6CE8\u6587\u78BA\u5B9A\u5546\u54C1\u30EA\u30B5\u30FC\u30C1\u8868\u2605',
  orderSheetName: '\u6CE8\u6587\u78BA\u5B9A\u5546\u54C1\u30EA\u30B5\u30FC\u30C1\u8868',
  researchSheetName: '\u30EA\u30B5\u30FC\u30C1\u7BA1\u7406\u8868',
  reviewSheetName: '\u78BA\u8A8D\u7528',
  deletedOrderSheetName: '\u524A\u9664\u6E08\u307F\u6CE8\u6587',
  snapshotSheetName: '\u6CE8\u6587\u756A\u53F7\u30B9\u30CA\u30C3\u30D7\u30B7\u30E7\u30C3\u30C8',
  processedLabelName: 'Amazon\u6CE8\u6587\u78BA\u5B9A_\u51E6\u7406\u6E08\u307F',
  sender: 'seller-notification@amazon.co.jp',
  subjectKeyword: '\u6CE8\u6587\u78BA\u5B9A',
  targetTextKeywords: ['\u6CE8\u6587\u78BA\u5B9A', '\u65B0\u898F\u306E\u6CE8\u6587', '\u6CE8\u6587\u756A\u53F7'],
  threadLimitPerRun: 100,
  gmailSearchWindow: 'newer_than:30d',
  protectedDeleteStartRow: 132,
  autoDeleteProtectedRows: true,
  minShipDate: '2026/06/01',
  displayFromDate: '2026/06/30',
};

const COLOR_SUFFIX_PATTERN = /-(W|K|B|S|R|N|P|H|T|C)$/i;

function getTargetSpreadsheet_() {
  const properties = PropertiesService.getScriptProperties();
  const activeSpreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  if (activeSpreadsheet) {
    properties.setProperty('TARGET_SPREADSHEET_ID', activeSpreadsheet.getId());
    return activeSpreadsheet;
  }

  const spreadsheetId = properties.getProperty('TARGET_SPREADSHEET_ID')
    || AMAZON_ORDER_IMPORTER_CONFIG.spreadsheetId;
  if (!spreadsheetId) {
    throw new Error('\u5BFE\u8C61\u30B9\u30D7\u30EC\u30C3\u30C9\u30B7\u30FC\u30C8\u3092\u53D6\u5F97\u3067\u304D\u307E\u305B\u3093\u3002\u30B9\u30D7\u30EC\u30C3\u30C9\u30B7\u30FC\u30C8\u304B\u3089Apps Script\u3092\u958B\u3044\u3066\u521D\u671F\u8A2D\u5B9A\u3092\u5B9F\u884C\u3057\u3066\u304F\u3060\u3055\u3044\u3002');
  }
  return SpreadsheetApp.openById(spreadsheetId);
}

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Amazon\u6CE8\u6587\u30E1\u30FC\u30EB')
    .addItem('Amazon\u6CE8\u6587\u30E1\u30FC\u30EB\u3092\u53D6\u308A\u8FBC\u3080', 'importAmazonOrderEmails')
    .addSeparator()
    .addItem('\u521D\u671F\u30BB\u30C3\u30C8\u30A2\u30C3\u30D7', 'setupAmazonOrderImporter')
    .addItem('\u521D\u671F\u8A2D\u5B9A+30\u5206\u81EA\u52D5\u5B9F\u884C', 'setupAmazonOrderImporterAndTrigger')
    .addSeparator()
    .addItem('\u6CE8\u6587\u65E5\u3067\u6607\u9806\u30BD\u30FC\u30C8', 'sortAmazonResearchSheetAscending')
    .addItem('2026\u5E746\u670830\u65E5\u4EE5\u964D\u3060\u3051\u8868\u793A', 'showShipDatesFromJune2026')
    .addItem('132\u884C\u76EE\u4EE5\u964D\u3092\u524A\u9664\u6E08\u307F\u306B\u3057\u3066\u524A\u9664', 'deleteRowsFrom132AndRememberOrders')
    .addItem('\u65E2\u5B58\u884C\u306E\u6CE8\u6587\u60C5\u5831\u3092Gmail\u304B\u3089\u518D\u4F5C\u6210', 'refreshExistingOrderDetailsFromGmail')
    .addItem('\u78BA\u8A8D\u7528\u304B\u3089Gmail\u518D\u51E6\u7406', 'reprocessReviewRowsFromGmail')
    .addSeparator()
    .addItem('\u30EA\u30B5\u30FC\u30C1\u7BA1\u7406\u8868\u3092\u540C\u671F', 'syncResearchManagementSheet')
    .addItem('\u65E7\u30EA\u30B5\u30FC\u30C1\u7BA1\u7406\u30B7\u30FC\u30C8\u3092\u524A\u9664', 'deleteLegacyResearchManagementSheet')
    .addItem('\u30EA\u30B5\u30FC\u30C1\u3092\u624B\u52D5\u5B9F\u884C', 'researchAllVisibleManagementRowsNow')
    .addItem('\u8868\u793A\u4E2D\u306E\u5168\u884C\u3092\u4ECA\u3059\u3050\u30EA\u30B5\u30FC\u30C1', 'researchAllVisibleManagementRowsNow')
    .addItem('1\u6642\u9593\u30EA\u30B5\u30FC\u30C1\u30C8\u30EA\u30AC\u30FC\u3092\u8A2D\u5B9A', 'setupHourlyTrigger')
    .addItem('\u6CE8\u6587\u756A\u53F7\u9023\u52D5\u30C8\u30EA\u30AC\u30FC\u3092\u8A2D\u5B9A', 'setupOnChangeTrigger')
    .addToUi();
}

function setupAmazonOrderImporter() {
  const spreadsheet = getTargetSpreadsheet_();
  spreadsheet.rename(AMAZON_ORDER_IMPORTER_CONFIG.spreadsheetTitle);

  const orderSheet = getOrCreateSheet_(spreadsheet, AMAZON_ORDER_IMPORTER_CONFIG.orderSheetName);
  if (isSheetBlank_(orderSheet)) {
    ensureHeader_(orderSheet, [
      '\u6CE8\u6587\u65E5 / \u51FA\u8377\u4E88\u5B9A\u65E5',
      '\u6CE8\u6587\u60C5\u5831',
      '\u58F2\u4E0A\u91D1',
      '\u691C\u7D22\u30EF\u30FC\u30C9',
      '\u30EA\u30B5\u30FC\u30C1\u72B6\u6CC1',
      'Amazon',
      '\u30E4\u30D5\u30AA\u30AF',
      '\u30E1\u30EB\u30AB\u30EA',
      '\u30B8\u30E2\u30C6\u30A3',
      '\u305D\u306E\u4ED6\u30B5\u30A4\u30C8',
    ]);
    orderSheet.setFrozenRows(1);
    orderSheet.getRange('A:J').setWrap(true);
    orderSheet.setColumnWidths(1, 1, 120);
    orderSheet.setColumnWidths(2, 1, 520);
    orderSheet.setColumnWidths(3, 1, 110);
    orderSheet.setColumnWidths(4, 1, 260);
    orderSheet.setColumnWidths(5, 1, 120);
    orderSheet.setColumnWidths(6, 5, 230);
  }
  const reviewSheet = getOrCreateSheet_(spreadsheet, AMAZON_ORDER_IMPORTER_CONFIG.reviewSheetName);
  if (isSheetBlank_(reviewSheet)) {
    ensureHeader_(reviewSheet, [
      '\u51E6\u7406\u65E5\u6642',
      '\u30E1\u30FC\u30EB\u53D7\u4FE1\u65E5\u6642',
      '\u30E1\u30FC\u30EB\u4EF6\u540D',
      '\u53D6\u5F97\u3067\u304D\u305F\u60C5\u5831',
      '\u53D6\u5F97\u3067\u304D\u306A\u304B\u3063\u305F\u60C5\u5831',
      '\u30A8\u30E9\u30FC\u5185\u5BB9',
      '\u7A2E\u5225',
      '\u6CE8\u6587\u756A\u53F7',
      '\u5546\u54C1\u540D',
      '\u691C\u7D22\u30EF\u30FC\u30C9',
      '\u624B\u52D5\u78BA\u8A8D\u7528URL',
      '\u30E1\u30E2',
    ]);
    reviewSheet.setFrozenRows(1);
    reviewSheet.getRange('A:L').setWrap(true);
    reviewSheet.setColumnWidths(1, 3, 160);
    reviewSheet.setColumnWidths(4, 9, 260);
  }

  const deletedOrderSheet = getOrCreateSheet_(spreadsheet, AMAZON_ORDER_IMPORTER_CONFIG.deletedOrderSheetName);
  if (isSheetBlank_(deletedOrderSheet)) {
    ensureHeader_(deletedOrderSheet, [
      '\u8A18\u9332\u65E5\u6642',
      '\u6CE8\u6587\u756A\u53F7',
      '\u7406\u7531',
      '\u5143\u884C',
      '\u6CE8\u6587\u60C5\u5831',
    ]);
    deletedOrderSheet.setFrozenRows(1);
    deletedOrderSheet.getRange('A:E').setWrap(true);
    deletedOrderSheet.setColumnWidths(1, 1, 160);
    deletedOrderSheet.setColumnWidths(2, 1, 180);
    deletedOrderSheet.setColumnWidths(3, 3, 260);
  }

  const snapshotSheet = getOrCreateSheet_(spreadsheet, AMAZON_ORDER_IMPORTER_CONFIG.snapshotSheetName);
  if (isSheetBlank_(snapshotSheet)) {
    ensureHeader_(snapshotSheet, ['\u6CE8\u6587\u756A\u53F7']);
    if (typeof snapshotSheet.hideSheet === 'function') {
      snapshotSheet.hideSheet();
    }
  }

  enforceProtectedDeletedRows_(spreadsheet, orderSheet, '\u521D\u671F\u8A2D\u5B9A\u30FB\u81EA\u52D5\u53D6\u8FBC\u524D\u306E132\u884C\u76EE\u4EE5\u964D\u4FDD\u8B77');
  setupResearchManagementSheet_(spreadsheet);
}

function setupAmazonOrderImporterAndTrigger() {
  setupAmazonOrderImporter();
  installTimeDrivenTrigger_(30);
  setupHourlyTrigger();
  setupOnChangeTrigger();
}

function sortAmazonResearchSheetAscending() {
  const spreadsheet = getTargetSpreadsheet_();
  const orderSheet = getOrCreateSheet_(spreadsheet, AMAZON_ORDER_IMPORTER_CONFIG.orderSheetName);
  sortOrderSheet_(orderSheet);
}

function showShipDatesFromJune2026() {
  const spreadsheet = getTargetSpreadsheet_();
  const orderSheet = getOrCreateSheet_(spreadsheet, AMAZON_ORDER_IMPORTER_CONFIG.orderSheetName);
  hideRowsBeforeDisplayDate_(orderSheet);
}

function deleteRowsFrom132AndRememberOrders() {
  const spreadsheet = getTargetSpreadsheet_();
  const orderSheet = getOrCreateSheet_(spreadsheet, AMAZON_ORDER_IMPORTER_CONFIG.orderSheetName);
  return deleteRowsFromProtectedStartAndRememberOrders_(spreadsheet, orderSheet, '\u30E1\u30CB\u30E5\u30FC\u5B9F\u884C\u306B\u3088\u308B132\u884C\u76EE\u4EE5\u964D\u306E\u524A\u9664');
}

function repairRows2240To2440() {
  repairOrderRows_(2240, 2440);
}

function reprocessReviewRowsFromGmail() {
  const spreadsheet = getTargetSpreadsheet_();
  const orderSheet = getOrCreateSheet_(spreadsheet, AMAZON_ORDER_IMPORTER_CONFIG.orderSheetName);
  const reviewSheet = getOrCreateSheet_(spreadsheet, AMAZON_ORDER_IMPORTER_CONFIG.reviewSheetName);
  enforceProtectedDeletedRows_(spreadsheet, orderSheet, '\u78BA\u8A8D\u7528\u518D\u51E6\u7406\u524D\u306E132\u884C\u76EE\u4EE5\u964D\u4FDD\u8B77');
  recordDeletedOrdersSinceLastSnapshot_(spreadsheet, orderSheet, '\u78BA\u8A8D\u7528\u518D\u51E6\u7406\u524D\u306E\u524A\u9664\u691C\u77E5');
  const existingOrders = loadExistingOrders_(orderSheet);
  const lastRow = reviewSheet.getLastRow();
  if (lastRow < 2) {
    return;
  }

  const reviewValues = reviewSheet.getRange(2, 4, lastRow - 1, 1).getValues();
  const rowsToAppend = [];
  let checkedOrderCount = 0;
  let foundOrderCount = 0;
  let skippedOrderCount = 0;

  reviewValues.forEach((row) => {
    const orderNumberMatch = String(row[0] || '').match(/[0-9]{3}-[0-9]{7}-[0-9]{7}/);
    if (!orderNumberMatch) {
      return;
    }

    const orderNumber = orderNumberMatch[0];
    checkedOrderCount += 1;
    if (existingOrders.orderNumbers.has(orderNumber) || existingOrders.deletedOrderNumbers.has(orderNumber)) {
      skippedOrderCount += 1;
      return;
    }

    const fields = findOrderFieldsByOrderNumber_(orderNumber);
    if (!fields) {
      return;
    }
    if (!isDisplayShipDateAllowed_(fields.shipDate)) {
      skippedOrderCount += 1;
      return;
    }

    foundOrderCount += 1;
    existingOrders.orderNumbers.add(orderNumber);
    rowsToAppend.push(buildOrderRow_(fields));
  });

  if (rowsToAppend.length > 0) {
    sortOrderRowsForAppend_(rowsToAppend);
    const startRow = orderSheet.getLastRow() + 1;
    orderSheet.getRange(startRow, 1, rowsToAppend.length, 4).setValues(rowsToAppend);
    orderSheet.getRange(startRow, 1, rowsToAppend.length, 4).setWrap(true);
  }
  updateKnownOrderSnapshot_(orderSheet);

  Logger.log(`\u78BA\u8A8D\u7528\u518D\u51E6\u7406: ${rowsToAppend.length}\u4EF6 / Gmail\u691C\u51FA: ${foundOrderCount}\u6CE8\u6587 / \u91CD\u8907: ${skippedOrderCount}\u4EF6 / \u78BA\u8A8D: ${checkedOrderCount}\u6CE8\u6587`);
}

function refreshExistingOrderDetailsFromGmail() {
  const spreadsheet = getTargetSpreadsheet_();
  const orderSheet = getOrCreateSheet_(spreadsheet, AMAZON_ORDER_IMPORTER_CONFIG.orderSheetName);
  repairOrderRows_(2, orderSheet.getLastRow());
}

function repairOrderRows_(startRow, endRow) {
  const spreadsheet = getTargetSpreadsheet_();
  const orderSheet = getOrCreateSheet_(spreadsheet, AMAZON_ORDER_IMPORTER_CONFIG.orderSheetName);
  const lastRow = orderSheet.getLastRow();
  if (lastRow < 2) {
    return;
  }

  const firstRow = Math.max(2, startRow || 2);
  const finalRow = Math.min(lastRow, endRow || lastRow);
  if (finalRow < firstRow) {
    return;
  }

  const rowValues = orderSheet.getRange(firstRow, 1, finalRow - firstRow + 1, 4).getValues();
  const updatedValues = rowValues.map((row) => [row[0], row[1], row[2], row[3]]);
  let checkedOrderCount = 0;
  let foundOrderCount = 0;
  let updatedRowCount = 0;

  for (let index = 0; index < rowValues.length; index += 1) {
    const orderInfo = String(rowValues[index][1] || '');
    const orderNumberMatch = orderInfo.match(/[0-9]{3}-[0-9]{7}-[0-9]{7}/);
    if (!orderNumberMatch) {
      continue;
    }

    const fields = findOrderFieldsByOrderNumber_(orderNumberMatch[0]);
    checkedOrderCount += 1;
    if (!fields) {
      continue;
    }

    foundOrderCount += 1;
    const nextRow = buildOrderRow_(fields);

    if (updatedValues[index].some((value, column) => String(value) !== String(nextRow[column]))) {
      updatedValues[index] = nextRow;
      updatedRowCount += 1;
    }
  }

  orderSheet.getRange(firstRow, 1, updatedValues.length, 4).setValues(updatedValues);
  orderSheet.getRange(firstRow, 1, updatedValues.length, 4).setWrap(true);
  Logger.log(`\u6307\u5B9A\u884C\u306E\u6CE8\u6587\u60C5\u5831\u4FEE\u6B63: ${updatedRowCount}\u4EF6 / Gmail\u691C\u51FA: ${foundOrderCount}\u6CE8\u6587 / Gmail\u78BA\u8A8D: ${checkedOrderCount}\u6CE8\u6587 / \u5BFE\u8C61\u884C: ${firstRow}-${finalRow}`);
}

function findOrderFieldsByOrderNumber_(orderNumber) {
  const threads = GmailApp.search(`"${orderNumber}" from:${AMAZON_ORDER_IMPORTER_CONFIG.sender}`, 0, 10);
  for (const thread of threads) {
    for (const message of thread.getMessages()) {
      const text = getMessageText_(message);
      const result = parseAmazonOrderEmail_(text);
      if (result.ok && result.fields.orderNumber === orderNumber) {
        return result.fields;
      }
    }
  }
  return null;
}

function refreshExistingSalesAmountsFromGmail() {
  const spreadsheet = getTargetSpreadsheet_();
  const orderSheet = getOrCreateSheet_(spreadsheet, AMAZON_ORDER_IMPORTER_CONFIG.orderSheetName);
  const lastRow = orderSheet.getLastRow();
  if (lastRow < 2) {
    return;
  }

  const rowValues = orderSheet.getRange(2, 1, lastRow - 1, 3).getValues();
  const updatedValues = rowValues.map((row) => [row[2]]);
  const salesAmountCache = {};
  const maxOrdersPerRun = 80;
  let checkedOrderCount = 0;
  let foundSalesAmountCount = 0;
  let updatedRowCount = 0;

  for (let index = 0; index < rowValues.length && checkedOrderCount < maxOrdersPerRun; index += 1) {
    const shipDate = rowValues[index][0] instanceof Date
      ? Utilities.formatDate(rowValues[index][0], Session.getScriptTimeZone(), 'yyyy/MM/dd')
      : normalizeDate_(String(rowValues[index][0] || ''));
    if (shipDate && shipDate < AMAZON_ORDER_IMPORTER_CONFIG.minShipDate) {
      continue;
    }

    const orderInfo = String(rowValues[index][1] || '');
    const orderNumberMatch = orderInfo.match(/[0-9]{3}-[0-9]{7}-[0-9]{7}/);
    if (!orderNumberMatch) {
      continue;
    }

    const orderNumber = orderNumberMatch[0];
    if (!(orderNumber in salesAmountCache)) {
      salesAmountCache[orderNumber] = findSalesAmountByOrderNumber_(orderNumber);
      checkedOrderCount += 1;
      if (salesAmountCache[orderNumber]) {
        foundSalesAmountCount += 1;
      }
    }

    const salesAmount = salesAmountCache[orderNumber];
    if (!salesAmount) {
      continue;
    }

    const nextSalesAmount = salesAmountNumber_(salesAmount);

    if (nextSalesAmount && Number(updatedValues[index][0]) !== nextSalesAmount) {
      updatedValues[index][0] = nextSalesAmount;
      updatedRowCount += 1;
    }
  }

  orderSheet.getRange(2, 3, updatedValues.length, 1).setValues(updatedValues);
  orderSheet.getRange(2, 3, updatedValues.length, 1).setNumberFormat('#,##0');
  Logger.log(`\u65E2\u5B58\u884C\u306E\u58F2\u4E0A\u91D1\u66F4\u65B0: ${updatedRowCount}\u4EF6 / \u58F2\u4E0A\u91D1\u691C\u51FA: ${foundSalesAmountCount}\u6CE8\u6587 / Gmail\u78BA\u8A8D: ${checkedOrderCount}\u6CE8\u6587`);
}

function findSalesAmountByOrderNumber_(orderNumber) {
  const threads = GmailApp.search(`"${orderNumber}" from:${AMAZON_ORDER_IMPORTER_CONFIG.sender}`, 0, 10);
  let fallbackSalesAmount = '';
  for (const thread of threads) {
    for (const message of thread.getMessages()) {
      const text = getMessageText_(message);
      const labeledSalesAmount = extractLabeledSalesAmount_(text);
      if (labeledSalesAmount) {
        return labeledSalesAmount;
      }
      if (!fallbackSalesAmount) {
        fallbackSalesAmount = extractSalesAmount_(text);
      }
    }
  }
  return fallbackSalesAmount;
}

function importAmazonOrderEmails() {
  setupAmazonOrderImporter();

  const spreadsheet = getTargetSpreadsheet_();
  const orderSheet = spreadsheet.getSheetByName(AMAZON_ORDER_IMPORTER_CONFIG.orderSheetName);
  const reviewSheet = spreadsheet.getSheetByName(AMAZON_ORDER_IMPORTER_CONFIG.reviewSheetName);
  const processedLabel = getOrCreateGmailLabel_(AMAZON_ORDER_IMPORTER_CONFIG.processedLabelName);
  enforceProtectedDeletedRows_(spreadsheet, orderSheet, 'Gmail\u53D6\u8FBC\u524D\u306E132\u884C\u76EE\u4EE5\u964D\u4FDD\u8B77');
  recordDeletedOrdersSinceLastSnapshot_(spreadsheet, orderSheet, 'Gmail\u53D6\u8FBC\u524D\u306E\u524A\u9664\u691C\u77E5');
  const existingOrders = loadExistingOrders_(orderSheet);
  const rowsToAppend = [];
  const importedOrderNumbers = [];
  const reviewRows = [];

  const query = buildAmazonOrderGmailQuery_();

  const threads = GmailApp.search(query, 0, AMAZON_ORDER_IMPORTER_CONFIG.threadLimitPerRun);
  threads.forEach((thread) => {
    let shouldMarkProcessed = false;

    thread.getMessages().forEach((message) => {
      if (!isTargetMessage_(message)) {
        return;
      }

      const text = getMessageText_(message);
      const result = parseAmazonOrderEmail_(text);

      if (!result.ok) {
        reviewRows.push(buildReviewRow_(message, result.fields, result.missing, result.error));
        shouldMarkProcessed = true;
        return;
      }

      if (existingOrders.orderNumbers.has(result.fields.orderNumber)
        || existingOrders.deletedOrderNumbers.has(result.fields.orderNumber)) {
        shouldMarkProcessed = true;
        return;
      }

      if (!isDisplayShipDateAllowed_(result.fields.shipDate)) {
        shouldMarkProcessed = true;
        return;
      }

      existingOrders.orderNumbers.add(result.fields.orderNumber);
      rowsToAppend.push(buildOrderRow_(result.fields));
      importedOrderNumbers.push(result.fields.orderNumber);
      shouldMarkProcessed = true;
    });

    if (shouldMarkProcessed) {
      thread.addLabel(processedLabel);
    }
  });

  if (rowsToAppend.length > 0) {
    sortOrderRowsForAppend_(rowsToAppend);
    const startRow = orderSheet.getLastRow() + 1;
    orderSheet.getRange(startRow, 1, rowsToAppend.length, 4).setValues(rowsToAppend);
    orderSheet.getRange(startRow, 1, rowsToAppend.length, 4).setWrap(true);
  }

  if (reviewRows.length > 0) {
    const startRow = reviewSheet.getLastRow() + 1;
    reviewSheet.getRange(startRow, 1, reviewRows.length, 12).setValues(reviewRows);
    reviewSheet.getRange(startRow, 1, reviewRows.length, 12).setWrap(true);
  }
  updateKnownOrderSnapshot_(orderSheet);
  if (importedOrderNumbers.length > 0 && typeof researchImportedOrderRowsAfterImport_ === 'function') {
    researchImportedOrderRowsAfterImport_(spreadsheet, importedOrderNumbers);
  }

  Logger.log(`\u8FFD\u52A0: ${rowsToAppend.length}\u4EF6 / \u78BA\u8A8D\u7528: ${reviewRows.length}\u4EF6`);
}

function buildAmazonOrderGmailQuery_() {
  const keywords = (AMAZON_ORDER_IMPORTER_CONFIG.targetTextKeywords || [AMAZON_ORDER_IMPORTER_CONFIG.subjectKeyword])
    .map((keyword) => `"${keyword}"`)
    .join(' ');
  return [
    `from:${AMAZON_ORDER_IMPORTER_CONFIG.sender}`,
    AMAZON_ORDER_IMPORTER_CONFIG.gmailSearchWindow || '',
    `{subject:"${AMAZON_ORDER_IMPORTER_CONFIG.subjectKeyword}" ${keywords}}`,
  ].filter(Boolean).join(' ');
}

function installTimeDrivenTriggerEvery15Minutes() {
  installTimeDrivenTrigger_(15);
}

function installTimeDrivenTriggerEvery30Minutes() {
  installTimeDrivenTrigger_(30);
}

function installTimeDrivenTriggerEveryHour() {
  installTimeDrivenTrigger_(60);
}

function installTimeDrivenTrigger_(minutes) {
  ScriptApp.getProjectTriggers()
    .filter((trigger) => trigger.getHandlerFunction() === 'importAmazonOrderEmails')
    .forEach((trigger) => ScriptApp.deleteTrigger(trigger));

  if (minutes === 60) {
    ScriptApp.newTrigger('importAmazonOrderEmails').timeBased().everyHours(1).create();
    return;
  }

  ScriptApp.newTrigger('importAmazonOrderEmails').timeBased().everyMinutes(minutes).create();
}

function parseAmazonOrderEmail_(text) {
  const orderNumber = extractOrderNumber_(text);
  const productBlocks = splitProductBlocks_(text);
  const items = uniqueOrderItems_((productBlocks.length > 0 ? productBlocks : [text])
    .map((block) => {
      const item = {
        shipDate: extractShipDate_(block) || extractShipDate_(text),
        orderDate: extractOrderDate_(block) || extractOrderDate_(text),
        productName: extractProductName_(block),
        sku: extractSku_(block),
        salesAmount: extractSalesAmount_(block),
        searchWord: '',
      };

      item.searchWord = buildSearchWord_(item.productName);
      if (!item.sku) {
        item.sku = '\u53D6\u5F97\u4E0D\u53EF';
      }
      if (!item.salesAmount) {
        item.salesAmount = '\u53D6\u5F97\u4E0D\u53EF';
      }

      return item;
    })
    .filter((item) => item.shipDate && item.productName && item.searchWord));

  const fields = {
    shipDate: items[0] ? items[0].shipDate : '',
    orderDate: items[0] ? items[0].orderDate : extractOrderDate_(text),
    orderNumber,
    items,
  };

  const missing = [];
  if (!fields.shipDate) {
    missing.push('shipDate');
  }
  if (!fields.orderNumber) {
    missing.push('orderNumber');
  }
  if (items.length === 0) {
    missing.push('items');
  }
  if (missing.length > 0) {
    return {
      ok: false,
      fields,
      missing,
      error: `\u5FC5\u9808\u9805\u76EE\u3092\u53D6\u5F97\u3067\u304D\u307E\u305B\u3093\u3067\u3057\u305F: ${missing.join(', ')}`,
    };
  }

  return { ok: true, fields, missing: [], error: '' };
}

function uniqueOrderItems_(items) {
  const seen = new Set();
  return items.filter((item) => {
    const key = buildOrderItemDedupeKey_(item);
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function buildOrderItemDedupeKey_(item) {
  const sku = normalizeSku_(item.sku);
  if (sku && sku !== '\u53D6\u5F97\u4E0D\u53EF') {
    return `${sku}|${item.salesAmount}`;
  }

  return `${cleanDisplayProductName_(item.productName).replace(/\[[^\]]+\]/g, '')}|${item.salesAmount}`;
}

function normalizeSku_(value) {
  return String(value || '').replace(/^[\s*\uff0a\u30fb-]+/, '').replace(/\s+/g, ' ').trim();
}

function splitProductBlocks_(text) {
  const matches = [...String(text || '').matchAll(/(?:^|\n)(\u51FA\s*\u8377\s*\u4E88\s*\u5B9A\s*\u65E5[\s\S]*?)(?=\n\u51FA\s*\u8377\s*\u4E88\s*\u5B9A\s*\u65E5|$)/g)];
  return matches
    .map((match) => match[1])
    .filter((block) => /\u5546\s*\u54C1\s*(?:\u540D)?\s*[:\uFF1A]/.test(block));
}

function extractShipDate_(text) {
  const patterns = [
    /\u51FA\s*\u8377\s*\u4E88\s*\u5B9A\s*\u65E5\s*[:\uFF1A]?\s*([0-9]{4}[\/.\-\u5E74]\s*[0-9]{1,2}[\/.\-\u6708]\s*[0-9]{1,2}\u65E5?)/,
    /\u51FA\s*\u8377\s*\u4E88\s*\u5B9A\s*[:\uFF1A]?\s*([0-9]{4}[\/.\-\u5E74]\s*[0-9]{1,2}[\/.\-\u6708]\s*[0-9]{1,2}\u65E5?)/,
    /\u767A\s*\u9001\s*\u4E88\s*\u5B9A\s*\u65E5\s*[:\uFF1A]?\s*([0-9]{4}[\/.\-\u5E74]\s*[0-9]{1,2}[\/.\-\u6708]\s*[0-9]{1,2}\u65E5?)/,
  ];
  return normalizeDate_(firstMatch_(text, patterns));
}

function extractOrderDate_(text) {
  const patterns = [
    /\u6CE8\s*\u6587\s*\u65E5\s*[:\uFF1A]?\s*([0-9]{4}[\/.\-\u5E74]\s*[0-9]{1,2}[\/.\-\u6708]\s*[0-9]{1,2}\u65E5?)/,
    /\u3054\u6CE8\u6587\u65E5\s*[:\uFF1A]?\s*([0-9]{4}[\/.\-\u5E74]\s*[0-9]{1,2}[\/.\-\u6708]\s*[0-9]{1,2}\u65E5?)/,
    /\u6CE8\u6587\u65E5\u6642\s*[:\uFF1A]?\s*([0-9]{4}[\/.\-\u5E74]\s*[0-9]{1,2}[\/.\-\u6708]\s*[0-9]{1,2}\u65E5?)/,
  ];
  return normalizeDate_(firstMatch_(text, patterns));
}

function extractOrderNumber_(text) {
  return firstMatch_(text, [/\u6CE8\u6587\u756A\u53F7\s*[:\uFF1A]?\s*([0-9]{3}-[0-9]{7}-[0-9]{7})/, /\b([0-9]{3}-[0-9]{7}-[0-9]{7})\b/]);
}

function extractProductName_(text) {
  return firstMatch_(text, [
    /\u5546\s*\u54C1\s*\u540D\s*[:\uFF1A]\s*([\s\S]+?)(?=\n|\u30B3\u30F3\u30C7\u30A3\u30B7\u30E7\u30F3\s*[:\uFF1A]|S\s*K\s*U\s*[:\uFF1A]|\u6570\u91CF\s*[:\uFF1A]|\u4FA1\u683C\s*[:\uFF1A]|\u7A0E\u91D1\s*[:\uFF1A]|Amazon\u624B\u6570\u6599\s*[:\uFF1A]|\u58F2\s*\u4E0A\s*\u91D1\s*[:\uFF1A]|$)/,
    /\u5546\s*\u54C1\s*[:\uFF1A]\s*([\s\S]+?)(?=\n|\u30B3\u30F3\u30C7\u30A3\u30B7\u30E7\u30F3\s*[:\uFF1A]|S\s*K\s*U\s*[:\uFF1A]|\u6570\u91CF\s*[:\uFF1A]|\u4FA1\u683C\s*[:\uFF1A]|\u7A0E\u91D1\s*[:\uFF1A]|Amazon\u624B\u6570\u6599\s*[:\uFF1A]|\u58F2\s*\u4E0A\s*\u91D1\s*[:\uFF1A]|$)/,
    /\u30BF\u30A4\u30C8\u30EB\s*[:\uFF1A]\s*(.+)/,
    /(?:^|\n)\u4EF6\u540D\s*[:\uFF1A]\s*\u6CE8\u6587\u78BA\u5B9A\s*[:\uFF1A]\s*[^\s\u3000]+[\s\u3000]+(.+)/,
    /(?:^|\n)\u6CE8\u6587\u78BA\u5B9A\s*[:\uFF1A]\s*[^\s\u3000]+[\s\u3000]+(.+)/,
  ]).replace(/\s+/g, ' ').trim();
}

function extractSku_(text) {
  return normalizeSku_(firstMatch_(text, [
    /\bS\s*K\s*U\s*[:\uFF1A]?\s*([^\n]+)/i,
    /\u51FA\u54C1\u8005\s*S\s*K\s*U\s*[:\uFF1A]?\s*([^\n]+)/i,
    /\u5546\u54C1\s*S\s*K\s*U\s*[:\uFF1A]?\s*([^\n]+)/i,
    /(?:^|\n)\u4EF6\u540D\s*[:\uFF1A]\s*\u6CE8\u6587\u78BA\u5B9A\s*[:\uFF1A]\s*([^\s\u3000]+)/,
    /(?:^|\n)\u6CE8\u6587\u78BA\u5B9A\s*[:\uFF1A]\s*([^\s\u3000]+)/,
  ]));
}

function extractSalesAmount_(text) {
  const normalizedText = String(text || '');
  const labeledSalesAmount = extractLabeledSalesAmount_(normalizedText);
  if (labeledSalesAmount) {
    return labeledSalesAmount;
  }

  const matches = [...normalizedText.matchAll(/(?:[\uFFE5\u00A5]\s*)?([0-9]{1,3}(?:,[0-9]{3})+|[0-9]+)\s*\u5186|[\uFFE5\u00A5]\s*([0-9]{1,3}(?:,[0-9]{3})+|[0-9]+)/g)];
  if (matches.length === 0) {
    return '';
  }

  const lastMatch = matches[matches.length - 1];
  return `${lastMatch[1] || lastMatch[2]}\u5186`;
}

function extractLabeledSalesAmount_(text) {
  const labeledSalesMatches = [...String(text || '').matchAll(/\u58F2\s*\u4E0A\s*\u91D1\s*[:\uFF1A]?\s*(?:[\uFFE5\u00A5]\s*)?([0-9]{1,3}(?:,[0-9]{3})+|[0-9]+)\s*\u5186?/g)];
  if (labeledSalesMatches.length === 0) {
    return '';
  }

  return `${labeledSalesMatches[labeledSalesMatches.length - 1][1]}\u5186`;
}

function buildSearchWord_(productName) {
  if (!productName) {
    return '';
  }

  if (isDvdLikeProduct_(productName)) {
    return cleanSearchWord_(buildDvdSearchWords_(productName));
  }

  return cleanSearchWord_(extractModelNumber_(productName) || fallbackSearchWord_(productName));
}

function cleanSearchWord_(searchWord) {
  return String(searchWord || '')
    .split('\n')
    .map((line) => line.replace(/^[\s*\uFF0A\u30FB-]+/, '').trim())
    .join('\n')
    .trim();
}

function isDvdLikeProduct_(productName) {
  if (/\u30EC\u30B3\u30FC\u30C0\u30FC|\u30D7\u30EC\u30FC\u30E4\u30FC|\u30D7\u30EC\u30A4\u30E4\u30FC|\u30C7\u30A3\u30B9\u30AF\u30EC\u30B3\u30FC\u30C0\u30FC|\u30C7\u30A3\u30B9\u30AF\u30D7\u30EC\u30FC\u30E4\u30FC|\u30C7\u30A3\u30B9\u30AF\u30D7\u30EC\u30A4\u30E4\u30FC/i.test(productName)) {
    return false;
  }

  return /\u30EC\u30F3\u30BF\u30EB\u843D\u3061|\u5168\s*[0-9\uFF10-\uFF19]+\s*\u5DFB|\u5168\u5DFB\u30BB\u30C3\u30C8|DVD|Blu-ray|\u30D6\u30EB\u30FC\u30EC\u30A4|\u30DE\u30FC\u30B1\u30C3\u30C8\u30D7\u30EC\u30A4\u30B9DVD\u30BB\u30C3\u30C8\u5546\u54C1/i.test(productName);
}

function buildDvdSearchWords_(productName) {
  const volume = toHalfWidthNumber_((productName.match(/\u5168\s*([0-9\uFF10-\uFF19]+)\s*\u5DFB/) || [])[1] || '');
  const title = cleanDvdTitle_(productName);
  if (!title) {
    return '';
  }

  return [
    `${title} \u5168`,
    volume ? `${title} ${volume}` : `${title} \u5168\u5DFB`,
    `${title} \u30EC\u30F3\u30BF\u30EB`,
  ].join('\n');
}

function cleanDvdTitle_(productName) {
  let title = productName;
  title = title.replace(/[\u3010\u3011]/g, ' ');
  title = title.replace(/\[[^\]]*(\u30EC\u30F3\u30BF\u30EB\u843D\u3061|\u30DE\u30FC\u30B1\u30C3\u30C8\u30D7\u30EC\u30A4\u30B9DVD\u30BB\u30C3\u30C8\u5546\u54C1|DVD|Blu-ray|\u30D6\u30EB\u30FC\u30EC\u30A4|\u4E2D\u53E4|\u30BB\u30C3\u30C8\u5546\u54C1)[^\]]*\]/gi, ' ');
  title = title.replace(/\u30EC\u30F3\u30BF\u30EB\u843D\u3061/gi, ' ');
  title = title.replace(/\u30DE\u30FC\u30B1\u30C3\u30C8\u30D7\u30EC\u30A4\u30B9DVD\u30BB\u30C3\u30C8\u5546\u54C1/gi, ' ');
  title = title.replace(/Blu-ray|\u30D6\u30EB\u30FC\u30EC\u30A4|DVD/gi, ' ');
  title = title.replace(/\u4E2D\u53E4|\u30BB\u30C3\u30C8\u5546\u54C1/gi, ' ');
  title = title.replace(/\u5168\s*[0-9\uFF10-\uFF19]+\s*\u5DFB\s*\u30BB\u30C3\u30C8?/g, ' ');
  title = title.replace(/\u5168\u5DFB\u30BB\u30C3\u30C8/g, ' ');
  title = title.replace(/[\uFF08(][^)\uFF09]*[)\uFF09]/g, ' ');
  title = title.split(/\s*\+\s*/)[0];
  return title.replace(/\s+/g, ' ').trim();
}

function extractModelNumber_(productName) {
  const normalized = productName
    .replace(/[\uFF21-\uFF3A\uFF41-\uFF5A\uFF10-\uFF19]/g, (char) => String.fromCharCode(char.charCodeAt(0) - 0xfee0))
    .replace(/[\u3010\u3011\[\]]/g, ' ');

  const candidates = normalized.match(/\b[A-Z]{1,8}[A-Z0-9]*-[A-Z0-9-]+(?:\([A-Z0-9]+\))?\b|\b[A-Z]{1,6}[0-9]{1,5}[A-Z]?\b/gi) || [];
  const scored = candidates
    .map((candidate) => cleanModelNumber_(candidate))
    .filter((candidate) => /[0-9]/.test(candidate))
    .sort((a, b) => b.length - a.length);

  return scored[0] || '';
}

function fallbackSearchWord_(productName) {
  return String(productName || '')
    .replace(/[\u3010\u3011\[\]]/g, ' ')
    .replace(/[\uFF08(][^)\uFF09]*[)\uFF09]/g, ' ')
    .replace(/^[\s*\uFF0A\u30FB-]+/, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80);
}

function cleanModelNumber_(modelNumber) {
  let value = modelNumber.toUpperCase();
  value = value.replace(/[\uFF08(][A-Z0-9]+[)\uFF09]$/i, '');
  value = value.replace(COLOR_SUFFIX_PATTERN, '');
  return value;
}

function buildOrderSummary_(fields) {
  const rows = [`\u6CE8\u6587\u756A\u53F7\uFF1A${fields.orderNumber}`];
  fields.items.forEach((item, index) => {
    if (fields.items.length > 1) {
      rows.push(`\u3010${index + 1}\u3011`);
    }
    rows.push(
      `\u5546\u54C1\u540D\uFF1A${cleanDisplayProductName_(item.productName)}`,
      `SKU\uFF1A${item.sku}`,
    );
  });
  return rows.join('\n');
}

function buildOrderRow_(fields) {
  const amounts = fields.items
    .map((item) => salesAmountNumber_(item.salesAmount))
    .filter((amount) => amount > 0);
  return [
    buildOrderDateCell_(fields),
    buildOrderSummary_(fields),
    amounts.reduce((total, amount) => total + amount, 0) || '',
    buildSearchWords_(fields),
  ];
}

function buildOrderDateCell_(fields) {
  return [
    fields.orderDate ? `\u6CE8\u6587\u65E5\uFF1A${fields.orderDate}` : '',
    fields.shipDate ? `\u51FA\u8377\u4E88\u5B9A\u65E5\uFF1A${fields.shipDate}` : '',
  ].filter(Boolean).join('\n') || fields.shipDate || '';
}

function sortOrderRowsForAppend_(rows) {
  rows.sort((left, right) => {
    const leftDate = displayOrderDateNumber_(left[0]) || displayShipDateNumber_(left[0]);
    const rightDate = displayOrderDateNumber_(right[0]) || displayShipDateNumber_(right[0]);
    if (leftDate && rightDate && leftDate !== rightDate) {
      return leftDate - rightDate;
    }
    if (leftDate !== rightDate) {
      return leftDate ? -1 : 1;
    }
    const leftOrder = extractOrderNumber_(String(left[1] || ''));
    const rightOrder = extractOrderNumber_(String(right[1] || ''));
    return leftOrder.localeCompare(rightOrder);
  });
  return rows;
}

function salesAmountNumber_(value) {
  return Number(String(value || '').replace(/[^\d]/g, '')) || 0;
}

function buildSearchWords_(fields) {
  if (fields.items.length === 1) {
    return fields.items[0].searchWord;
  }

  return fields.items
    .map((item, index) => `\u3010${index + 1}\u3011\n${item.searchWord}`)
    .join('\n');
}

function cleanDisplayProductName_(productName) {
  return String(productName || '').replace(/^[\s*\uFF0A\u30FB-]+/, '').trim();
}

function loadExistingOrders_(sheet) {
  const values = sheet.getLastRow() < 2
    ? []
    : sheet.getRange(2, 2, sheet.getLastRow() - 1, 1).getValues().flat();
  const orders = {
    orderNumbers: new Set(),
    deletedOrderNumbers: loadDeletedOrderNumbers_(sheet.getParent()),
  };
  values.forEach((value) => {
    const text = String(value || '');
    const orderNumberMatch = text.match(/[0-9]{3}-[0-9]{7}-[0-9]{7}/);
    if (orderNumberMatch) {
      orders.orderNumbers.add(orderNumberMatch[0]);
    }
  });
  return orders;
}

function sortOrderSheet_(sheet) {
  const lastRow = sheet.getLastRow();
  if (lastRow <= 2) {
    return;
  }

  sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).sort({ column: 1, ascending: true });
}

function hideRowsBeforeDisplayDate_(sheet) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    return;
  }

  const displayFrom = Number(AMAZON_ORDER_IMPORTER_CONFIG.displayFromDate.replace(/[^\d]/g, ''));
  const values = sheet.getRange(2, 1, lastRow - 1, 1).getDisplayValues().flat();
  let startRow = 0;
  let rowsToHide = 0;

  for (let index = 0; index < values.length; index += 1) {
    const rowDate = displayShipDateNumber_(values[index]);
    const shouldHide = rowDate > 0 && rowDate < displayFrom;

    if (shouldHide) {
      if (!startRow) {
        startRow = index + 2;
      }
      rowsToHide += 1;
    } else if (startRow) {
      sheet.hideRows(startRow, rowsToHide);
      startRow = 0;
      rowsToHide = 0;
    }
  }

  if (startRow) {
    sheet.hideRows(startRow, rowsToHide);
  }
}

function displayShipDateNumber_(value) {
  const text = String(value || '');
  const labeled = text.match(/\u51FA\u8377(?:\u671F\u9650|\u4E88\u5B9A)\u65E5\s*[:\uFF1A]?\s*([0-9]{4}[\/.\-\u5E74]\s*[0-9]{1,2}[\/.\-\u6708]\s*[0-9]{1,2}\u65E5?)/);
  const fallback = text.match(/([0-9]{4}[\/.\-\u5E74]\s*[0-9]{1,2}[\/.\-\u6708]\s*[0-9]{1,2}\u65E5?)/);
  const normalized = normalizeDate_((labeled && labeled[1]) || (fallback && fallback[1]) || '');
  return Number(String(normalized || '').replace(/[^\d]/g, '')) || 0;
}

function displayOrderDateNumber_(value) {
  const text = String(value || '');
  const labeled = text.match(/\u6CE8\u6587\u65E5\s*[:\uFF1A]?\s*([0-9]{4}[\/.\-\u5E74]\s*[0-9]{1,2}[\/.\-\u6708]\s*[0-9]{1,2}\u65E5?)/);
  const normalized = normalizeDate_((labeled && labeled[1]) || '');
  return Number(String(normalized || '').replace(/[^\d]/g, '')) || 0;
}

function isDisplayShipDateAllowed_(value) {
  const displayFrom = Number(AMAZON_ORDER_IMPORTER_CONFIG.displayFromDate.replace(/[^\d]/g, ''));
  const rowDate = displayShipDateNumber_(value);
  return !rowDate || rowDate >= displayFrom;
}

function buildReviewRow_(message, fields, missing, error) {
  return [
    new Date(),
    message.getDate(),
    message.getSubject(),
    JSON.stringify(fields),
    missing.join(', '),
    error,
    '\u30E1\u30FC\u30EB\u53D6\u8FBC',
    fields.orderNumber || '',
    fields.items && fields.items[0] ? fields.items[0].productName : '',
    fields.items && fields.items[0] ? fields.items[0].searchWord : '',
    '',
    '',
  ];
}

function isTargetMessage_(message) {
  if (message.getFrom().toLowerCase().indexOf(AMAZON_ORDER_IMPORTER_CONFIG.sender) === -1) {
    return false;
  }

  const subject = message.getSubject() || '';
  if (subject.indexOf(AMAZON_ORDER_IMPORTER_CONFIG.subjectKeyword) !== -1) {
    return true;
  }

  const text = getMessageText_(message);
  const hasTargetKeyword = (AMAZON_ORDER_IMPORTER_CONFIG.targetTextKeywords || [])
    .some((keyword) => text.indexOf(keyword) !== -1 || subject.indexOf(keyword) !== -1);
  return hasTargetKeyword && !!extractOrderNumber_(text);
}

function getOrderNumberRecordsFromOrderSheet_(sheet, startRow, endRow) {
  const lastRow = sheet.getLastRow();
  const firstRow = Math.max(2, startRow || 2);
  const finalRow = Math.min(lastRow, endRow || lastRow);
  if (lastRow < 2 || finalRow < firstRow) {
    return [];
  }

  return sheet.getRange(firstRow, 1, finalRow - firstRow + 1, Math.min(4, Math.max(1, sheet.getLastColumn())))
    .getValues()
    .map((row, index) => {
      const orderInfo = String(row[1] || '');
      const orderNumber = extractOrderNumber_(orderInfo);
      return {
        orderNumber,
        rowNumber: firstRow + index,
        orderInfo,
      };
    })
    .filter((record) => record.orderNumber);
}

function loadDeletedOrderNumbers_(spreadsheet) {
  const sheet = getOrCreateSheet_(spreadsheet, AMAZON_ORDER_IMPORTER_CONFIG.deletedOrderSheetName);
  if (sheet.getLastRow() < 2) {
    return new Set();
  }

  return new Set(sheet.getRange(2, 2, sheet.getLastRow() - 1, 1)
    .getValues()
    .flat()
    .map((value) => String(value || '').trim())
    .filter(Boolean));
}

function appendDeletedOrderRecords_(spreadsheet, records, reason) {
  const sheet = getOrCreateSheet_(spreadsheet, AMAZON_ORDER_IMPORTER_CONFIG.deletedOrderSheetName);
  const deletedOrderNumbers = loadDeletedOrderNumbers_(spreadsheet);
  const rows = [];
  records.forEach((record) => {
    if (!record.orderNumber || deletedOrderNumbers.has(record.orderNumber)) {
      return;
    }
    deletedOrderNumbers.add(record.orderNumber);
    rows.push([
      new Date(),
      record.orderNumber,
      reason || '\u624B\u52D5\u524A\u9664\u691C\u77E5',
      record.rowNumber || '',
      record.orderInfo || '',
    ]);
  });

  if (rows.length) {
    sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, 5).setValues(rows).setWrap(true);
  }
  return rows.length;
}

function loadKnownOrderSnapshot_(spreadsheet) {
  const sheet = getOrCreateSheet_(spreadsheet, AMAZON_ORDER_IMPORTER_CONFIG.snapshotSheetName);
  if (sheet.getLastRow() < 2) {
    return new Set();
  }

  return new Set(sheet.getRange(2, 1, sheet.getLastRow() - 1, 1)
    .getValues()
    .flat()
    .map((value) => String(value || '').trim())
    .filter(Boolean));
}

function updateKnownOrderSnapshot_(orderSheet) {
  const spreadsheet = orderSheet.getParent();
  const snapshotSheet = getOrCreateSheet_(spreadsheet, AMAZON_ORDER_IMPORTER_CONFIG.snapshotSheetName);
  const orderNumbers = Array.from(new Set(getOrderNumberRecordsFromOrderSheet_(orderSheet)
    .map((record) => record.orderNumber)))
    .sort();

  if (snapshotSheet.getLastRow() > 1) {
    snapshotSheet.getRange(2, 1, snapshotSheet.getLastRow() - 1, 1).clearContent();
  }
  if (orderNumbers.length) {
    snapshotSheet.getRange(2, 1, orderNumbers.length, 1).setValues(orderNumbers.map((orderNumber) => [orderNumber]));
  }
  if (typeof snapshotSheet.hideSheet === 'function') {
    snapshotSheet.hideSheet();
  }
}

function recordDeletedOrdersSinceLastSnapshot_(spreadsheet, orderSheet, reason) {
  const previous = loadKnownOrderSnapshot_(spreadsheet);
  if (!previous.size) {
    updateKnownOrderSnapshot_(orderSheet);
    return 0;
  }

  const currentRecords = getOrderNumberRecordsFromOrderSheet_(orderSheet);
  const current = new Set(currentRecords.map((record) => record.orderNumber));
  const deletedRecords = Array.from(previous)
    .filter((orderNumber) => !current.has(orderNumber))
    .map((orderNumber) => ({
      orderNumber,
      rowNumber: '',
      orderInfo: '',
    }));
  const recorded = appendDeletedOrderRecords_(spreadsheet, deletedRecords, reason || '\u624B\u52D5\u524A\u9664\u691C\u77E5');
  updateKnownOrderSnapshot_(orderSheet);
  return recorded;
}

function enforceProtectedDeletedRows_(spreadsheet, orderSheet, reason) {
  if (!AMAZON_ORDER_IMPORTER_CONFIG.autoDeleteProtectedRows) {
    return 0;
  }
  const properties = PropertiesService.getScriptProperties();
  const cleanupKey = 'PROTECTED_ROWS_BASELINE_CLEANED';
  if (properties.getProperty(cleanupKey) !== 'true') {
    const deleted = deleteRowsFromProtectedStartAndRememberOrders_(
      spreadsheet,
      orderSheet,
      reason || '132\u884C\u76EE\u4EE5\u964D\u306E\u521D\u56DE\u81EA\u52D5\u4FDD\u8B77',
      true,
    );
    properties.setProperty(cleanupKey, 'true');
    return deleted;
  }
  return deleteKnownDeletedRowsFromProtectedStart_(spreadsheet, orderSheet);
}

function deleteKnownDeletedRowsFromProtectedStart_(spreadsheet, orderSheet) {
  const startRow = AMAZON_ORDER_IMPORTER_CONFIG.protectedDeleteStartRow || 132;
  const lastRow = orderSheet.getLastRow();
  if (lastRow < startRow) {
    updateKnownOrderSnapshot_(orderSheet);
    return 0;
  }

  const deletedOrderNumbers = loadDeletedOrderNumbers_(spreadsheet);
  const records = getOrderNumberRecordsFromOrderSheet_(orderSheet, startRow, lastRow)
    .filter((record) => deletedOrderNumbers.has(record.orderNumber));
  const rowsToDelete = Array.from(new Set(records.map((record) => record.rowNumber)))
    .sort((left, right) => right - left);
  rowsToDelete.forEach((rowNumber) => orderSheet.deleteRow(rowNumber));
  updateKnownOrderSnapshot_(orderSheet);
  return rowsToDelete.length;
}

function deleteRowsFromProtectedStartAndRememberOrders_(spreadsheet, orderSheet, reason, skipManagementSync) {
  const startRow = AMAZON_ORDER_IMPORTER_CONFIG.protectedDeleteStartRow || 132;
  const lastRow = orderSheet.getLastRow();
  if (lastRow < startRow) {
    updateKnownOrderSnapshot_(orderSheet);
    return 0;
  }

  const records = getOrderNumberRecordsFromOrderSheet_(orderSheet, startRow, lastRow);
  appendDeletedOrderRecords_(spreadsheet, records, reason || `${startRow}\u884C\u76EE\u4EE5\u964D\u306E\u524A\u9664\u6307\u5B9A`);
  orderSheet.deleteRows(startRow, lastRow - startRow + 1);
  updateKnownOrderSnapshot_(orderSheet);
  if (!skipManagementSync
    && typeof syncResearchManagementByOrderNumber_ === 'function'
    && typeof RESEARCH_AUTOMATION_CONFIG !== 'undefined'
    && spreadsheet.getSheetByName(RESEARCH_AUTOMATION_CONFIG.sheetName)) {
    syncResearchManagementByOrderNumber_(spreadsheet);
  }
  return lastRow - startRow + 1;
}

function getOrCreateSheet_(spreadsheet, sheetName) {
  return spreadsheet.getSheetByName(sheetName) || spreadsheet.insertSheet(sheetName);
}

function isSheetBlank_(sheet) {
  return sheet.getLastRow() === 0
    || (sheet.getLastRow() === 1 && sheet.getLastColumn() === 1 && sheet.getRange(1, 1).getValue() === '');
}

function ensureHeader_(sheet, headers) {
  const current = sheet.getRange(1, 1, 1, headers.length).getValues()[0];
  if (current.some((value) => String(value || '').trim())) {
    return;
  }

  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold').setBackground('#f3f4f6');
}

function getOrCreateGmailLabel_(labelName) {
  return GmailApp.getUserLabelByName(labelName) || GmailApp.createLabel(labelName);
}

function firstMatch_(text, patterns) {
  for (let index = 0; index < patterns.length; index += 1) {
    const match = text.match(patterns[index]);
    if (match && match[1]) {
      return match[1].trim();
    }
  }
  return '';
}

function normalizeEmailText_(text) {
  return String(text || '')
    .replace(/\r/g, '\n')
    .replace(/\u00a0/g, ' ')
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join('\n');
}

function getMessageText_(message) {
  return normalizeEmailText_(`\u4EF6\u540D\uFF1A${message.getSubject ? message.getSubject() || '' : ''}\n${message.getPlainBody() || ''}\n${stripHtml_(message.getBody() || '')}`);
}

function normalizeDate_(value) {
  if (!value) {
    return '';
  }

  const match = value.replace(/\s+/g, '').match(/([0-9]{4})[\/.\-\u5E74]([0-9]{1,2})[\/.\-\u6708]([0-9]{1,2})/);
  if (!match) {
    return value;
  }

  return `${match[1]}/${String(match[2]).padStart(2, '0')}/${String(match[3]).padStart(2, '0')}`;
}

function stripHtml_(html) {
  return String(html || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function toHalfWidthNumber_(value) {
  return String(value || '').replace(/[\uFF10-\uFF19]/g, (char) => String.fromCharCode(char.charCodeAt(0) - 0xfee0));
}

function testKeywordGeneration() {
  const cases = [
    ['\u3010\u5DE5\u4E8B\u4E0D\u8981\u3011 CORONA(\u30B3\u30ED\u30CA) \u30A6\u30A4\u30F3\u30C9\u30A8\u30A2\u30B3\u30F3 \u51B7\u623F\u5C02\u7528\u30BF\u30A4\u30D7 CW-16A(WS)', 'CW-16A'],
    ['Panasonic \u30D1\u30CA\u30BD\u30CB\u30C3\u30AF \u30D6\u30EB\u30FC\u30EC\u30A4\u30C7\u30A3\u30B9\u30AF\u30EC\u30B3\u30FC\u30C0\u30FC DMR-2W101-K', 'DMR-2W101'],
    ['SHARP \u30B7\u30E3\u30FC\u30D7 \u52A0\u6E7F\u7A7A\u6C17\u6E05\u6D44\u6A5F KI-PX75-W', 'KI-PX75'],
    ['ZOOM \u30BA\u30FC\u30E0 \u30DE\u30EB\u30C1\u30C8\u30E9\u30C3\u30AF\u30EC\u30B3\u30FC\u30C0\u30FC 8\u30C8\u30E9\u30C3\u30AF\u540C\u6642\u9332\u97F3 24\u30C8\u30E9\u30C3\u30AF\u540C\u6642\u518D\u751F R24', 'R24'],
    ['\u3010\u5883\u754C\u7DDA\u4E0A\u306E\u30DB\u30E9\u30A4\u30BE\u30F3 + II [\u30EC\u30F3\u30BF\u30EB\u843D\u3061] \u516812\u5DFB\u30BB\u30C3\u30C8 [\u30DE\u30FC\u30B1\u30C3\u30C8\u30D7\u30EC\u30A4\u30B9DVD\u30BB\u30C3\u30C8\u5546\u54C1]\u3011', '\u5883\u754C\u7DDA\u4E0A\u306E\u30DB\u30E9\u30A4\u30BE\u30F3 \u5168\n\u5883\u754C\u7DDA\u4E0A\u306E\u30DB\u30E9\u30A4\u30BE\u30F3 12\n\u5883\u754C\u7DDA\u4E0A\u306E\u30DB\u30E9\u30A4\u30BE\u30F3 \u30EC\u30F3\u30BF\u30EB'],
  ];

  cases.forEach(([input, expected]) => {
    const actual = buildSearchWord_(input);
    if (actual !== expected) {
      throw new Error(`Expected "${expected}", but got "${actual}" for "${input}"`);
    }
  });
}

/**
 * Continuous sourcing research for rows displayed in \u3010\u30EA\u30B5\u30FC\u30C1\u7BA1\u7406\u8868\u3011.
 *
 * Invariants:
 * - Every visible row remains eligible on every hourly run, regardless of status.
 * - Existing URLs are never deleted or overwritten.
 * - Only canonical, new, non-duplicate, better product URLs are appended.
 * - A candidate must be within the C-column sales amount.
 * - SKU containing "muza" accepts new items only.
 */

const RESEARCH_AUTOMATION_CONFIG = {
  sheetName: '\u30EA\u30B5\u30FC\u30C1\u7BA1\u7406\u8868',
  reviewSheetName: '\u78BA\u8A8D\u7528',
  maxRuntimeMs: 270000,
  maxRowsPerRun: 10000,
  requestTimeoutFallback: 30000,
  userAgent: 'Mozilla/5.0 (compatible; GoogleAppsScript sourcing-research/1.0)',
};

const LEGACY_RESEARCH_MANAGEMENT_SHEET_NAMES = ['\u30EA\u30B5\u30FC\u30C1\u7BA1\u7406\u30B7\u30FC\u30C8'];

const RESEARCH_HEADERS = [
  '\u6CE8\u6587\u65E5 / \u51FA\u8377\u4E88\u5B9A\u65E5',
  '\u6CE8\u6587\u60C5\u5831',
  '\u58F2\u4E0A\u91D1',
  '\u691C\u7D22\u30EF\u30FC\u30C9',
  '\u30EA\u30B5\u30FC\u30C1\u72B6\u6CC1',
  'Amazon',
  '\u30E4\u30D5\u30AA\u30AF',
  '\u30E1\u30EB\u30AB\u30EA',
  '\u30B8\u30E2\u30C6\u30A3',
  '\u697D\u5929\u5E02\u5834',
  '\u6700\u7D42\u30EA\u30B5\u30FC\u30C1\u65E5\u6642',
  '\u78BA\u8A8D\u30E1\u30E2',
];

const RESEARCH_COLUMN_ALIASES = {
  shipDate: ['\u6CE8\u6587\u65E5/\u51FA\u8377\u4E88\u5B9A\u65E5', '\u6CE8\u6587\u65E5 / \u51FA\u8377\u4E88\u5B9A\u65E5', '\u51FA\u8377\u671F\u9650\u65E5', '\u51FA\u8377\u4E88\u5B9A\u65E5'],
  orderInfo: ['\u6CE8\u6587\u60C5\u5831'],
  orderNumber: ['\u6CE8\u6587\u756A\u53F7'],
  maxPrice: ['\u58F2\u4E0A\u91D1'],
  keyword: ['\u691C\u7D22\u30EF\u30FC\u30C9'],
  status: ['\u30EA\u30B5\u30FC\u30C1\u72B6\u6CC1'],
  Amazon: ['Amazon'],
  Yahoo: ['\u30E4\u30D5\u30AA\u30AF'],
  Mercari: ['\u30E1\u30EB\u30AB\u30EA'],
  Jimoty: ['\u30B8\u30E2\u30C6\u30A3'],
  Rakuten: ['\u697D\u5929\u5E02\u5834', '\u305D\u306E\u4ED6\u30B5\u30A4\u30C8'],
  Other: ['\u305D\u306E\u4ED6\u30B5\u30A4\u30C8'],
  lastResearchedAt: ['\u6700\u7D42\u30EA\u30B5\u30FC\u30C1\u65E5\u6642', '\u6700\u7D42\u78BA\u8A8D\u65E5\u6642'],
  memo: ['\u78BA\u8A8D\u30E1\u30E2', '\u30E1\u30E2'],
};

const RESEARCH_RESULT_KEYS = ['Amazon', 'Yahoo', 'Mercari', 'Jimoty', 'Rakuten'];
const LEGACY_RESEARCH_RESULT_KEYS = RESEARCH_RESULT_KEYS.concat(['Other']);

const RESEARCH_STATUS = {
  pending: '\u672A\u30EA\u30B5\u30FC\u30C1',
  running: '\u30EA\u30B5\u30FC\u30C1\u4E2D',
  found: '\u5019\u88DC\u3042\u308A',
  empty: '\u5019\u88DC\u306A\u3057',
  review: '\u8981\u78BA\u8A8D',
  error: '\u30A8\u30E9\u30FC',
};

const JUNK_PATTERN = /\u30B8\u30E3\u30F3\u30AF|\u30B8\u30E3\u30F3\u30AF\u54C1|\u52D5\u4F5C\u672A\u78BA\u8A8D|\u52D5\u4F5C\u672A\u30C1\u30A7\u30C3\u30AF|\u4E0D\u52D5\u54C1?|\u901A\u96FB\u4E0D\u53EF|\u901A\u96FB\u672A\u78BA\u8A8D|\u90E8\u54C1\u53D6\u308A|\u7834\u640D(?:\u54C1|\u3042\u308A)?|\u58CA\u308C\u3066\u3044\u307E\u3059|\u4F7F\u3048\u307E\u305B\u3093|\u8A33\u3042\u308A|\u96E3\u3042\u308A|\u73FE\u72B6\u54C1|\u4FEE\u7406\u524D\u63D0|\u518D\u751F\u4E0D\u53EF|\u8AAD\u307F\u8FBC\u307F\u4E0D\u53EF|\u8AAD\u8FBC\u4E0D\u53EF|\u8996\u8074\u4E0D\u53EF|\u6B20\u54C1(?:\u3042\u308A)?|\u30C7\u30A3\u30B9\u30AF\u6B20\u54C1|\u5DFB\u6570\u4E0D\u8DB3|\u5DFB\u629C\u3051|\u4E00\u90E8\u6B20\u54C1/i;
const JIMOTY_REJECT_PATTERN = /\u30B8\u30E3\u30F3\u30AF|\u52D5\u4F5C\u672A\u78BA\u8A8D|\u4E0D\u52D5\u54C1?|\u901A\u96FB\u4E0D\u53EF|\u90E8\u54C1\u53D6\u308A|\u7834\u640D|\u58CA\u308C\u3066\u3044\u307E\u3059|\u4F7F\u3048\u307E\u305B\u3093|\u4FEE\u7406\u524D\u63D0|\u518D\u751F\u4E0D\u53EF|\u8AAD\u307F\u8FBC\u307F\u4E0D\u53EF|\u8AAD\u8FBC\u4E0D\u53EF|\u8996\u8074\u4E0D\u53EF|\u6B20\u54C1(?:\u3042\u308A)?|\u30C7\u30A3\u30B9\u30AF\u6B20\u54C1|\u5DFB\u6570\u4E0D\u8DB3|\u5DFB\u629C\u3051|\u4E00\u90E8\u6B20\u54C1/i;
const UNAVAILABLE_PATTERN = /\u58F2\u308A\u5207\u308C|\u58F2\u5207|SOLD\s*OUT|\bSOLD\b|\u8CA9\u58F2\u7D42\u4E86|\u63B2\u8F09\u7D42\u4E86|\u30AA\u30FC\u30AF\u30B7\u30E7\u30F3.{0,8}\u7D42\u4E86|\u3053\u306E\u5546\u54C1\u306F\u524A\u9664|\u30DA\u30FC\u30B8\u304C\u898B\u3064\u304B\u308A\u307E\u305B\u3093|404\s*Not\s*Found/i;
const NEW_CONDITION_PATTERN = /\u65B0\u54C1|\u65B0\u54C1\u672A\u4F7F\u7528|\u672A\u4F7F\u7528\u54C1|\u672A\u958B\u5C01|brand\s*new|new\b/i;
const USED_CONDITION_PATTERN = /\u4E2D\u53E4|\u30EC\u30F3\u30BF\u30EB\u843D\u3061|\u30EC\u30F3\u30BF\u30EB\u30A2\u30C3\u30D7|\u4F7F\u7528\u6E08|used\b/i;
const SEARCH_RESULT_NOISE_PATTERN = /\/com\/assets\/|\/search\/|\/category\/|favicon\.ico(?:$|[?#])/i;

const RESEARCH_SITES = [
  {
    key: 'Amazon',
    label: 'Amazon',
    column: 6,
    resultHost: /amazon\.co\.jp\/dp\//i,
    searchUrl: (keyword, maxPrice) => `https://www.amazon.co.jp/s?k=${encodeURIComponent(keyword)}&rh=p_36%3A-${Math.max(1, maxPrice) * 100}`,
  },
  {
    key: 'Yahoo',
    label: '\u30E4\u30D5\u30AA\u30AF',
    column: 7,
    resultHost: /page\.auctions\.yahoo\.co\.jp\/jp\/auction\//i,
    searchUrl: (keyword, maxPrice) => `https://auctions.yahoo.co.jp/search/search?p=${encodeURIComponent(keyword)}&aucmaxprice=${Math.max(1, maxPrice)}`,
  },
  {
    key: 'Mercari',
    label: '\u30E1\u30EB\u30AB\u30EA',
    column: 8,
    resultHost: /jp\.mercari\.com\/item\//i,
    searchUrl: (keyword, maxPrice) => `https://jp.mercari.com/search?keyword=${encodeURIComponent(keyword)}&price_max=${Math.max(1, maxPrice)}`,
  },
  {
    key: 'Jimoty',
    label: '\u30B8\u30E2\u30C6\u30A3',
    column: 9,
    resultHost: /jmty\.jp\/.+\/article-/i,
    searchUrl: (keyword) => `https://jmty.jp/all/sale?keyword=${encodeURIComponent(keyword)}`,
  },
  {
    key: 'Rakuten',
    label: '\u697D\u5929\u5E02\u5834',
    column: 10,
    resultHost: /item\.rakuten\.co\.jp\//i,
    searchUrl: (keyword) => `https://search.rakuten.co.jp/search/mall/${encodeURIComponent(keyword)}/`,
  },
];

const OTHER_RESEARCH_SITES = [
  {
    key: 'Surugaya',
    label: '\u99FF\u6CB3\u5C4B',
    resultHost: /suruga-ya\.jp\/product\/detail\//i,
    searchUrl: (keyword) => `https://www.suruga-ya.jp/search?search_word=${encodeURIComponent(keyword)}`,
  },
  {
    key: 'Offmall',
    label: '\u30AA\u30D5\u30E2\u30FC\u30EB',
    resultHost: /netmall\.hardoff\.co\.jp\/product\//i,
    searchUrl: (keyword) => `https://netmall.hardoff.co.jp/search/?q=${encodeURIComponent(keyword)}`,
  },
  {
    key: 'SecondStreet',
    label: '\u30BB\u30AB\u30F3\u30C9\u30B9\u30C8\u30EA\u30FC\u30C8',
    resultHost: /2ndstreet\.jp\/goods\/detail\/goodsId\//i,
    searchUrl: (keyword) => `https://www.2ndstreet.jp/search?keyword=${encodeURIComponent(keyword)}`,
  },
  {
    key: 'NetOff',
    label: '\u30CD\u30C3\u30C8\u30AA\u30D5',
    resultHost: /netoff\.co\.jp\/detail\/[0-9]+\//i,
    searchUrl: (keyword) => `https://www.netoff.co.jp/cmdtyallsearch/?word=${encodeURIComponent(keyword)}`,
  },
];

function setupResearchManagementSheet_(spreadsheet) {
  deleteUnusedLegacyResearchManagementSheets_(spreadsheet);
  const sheet = getOrCreateSheet_(spreadsheet, RESEARCH_AUTOMATION_CONFIG.sheetName);
  if (isSheetBlank_(sheet)) {
    ensureHeader_(sheet, RESEARCH_HEADERS);
    sheet.setFrozenRows(1);
    sheet.getRange('A:L').setWrap(true);
    sheet.setColumnWidth(1, 120);
    sheet.setColumnWidth(2, 440);
    sheet.setColumnWidth(3, 110);
    sheet.setColumnWidth(4, 260);
    sheet.setColumnWidth(5, 120);
    sheet.setColumnWidths(6, 5, 230);
    sheet.setColumnWidth(11, 160);
    sheet.setColumnWidth(12, 320);
  }
  enforceResearchManagementResultHeaders_(sheet);
  return sheet;
}

function enforceResearchManagementResultHeaders_(sheet) {
  const resultHeaders = ['Amazon', '\u30E4\u30D5\u30AA\u30AF', '\u30E1\u30EB\u30AB\u30EA', '\u30B8\u30E2\u30C6\u30A3', '\u697D\u5929\u5E02\u5834'];
  resultHeaders.forEach((header, index) => {
    const cell = sheet.getRange(1, 6 + index);
    if (String(cell.getValue() || '').trim() !== header) {
      cell.setValue(header);
    }
  });
}

function deleteLegacyResearchManagementSheet() {
  return deleteUnusedLegacyResearchManagementSheets_(getTargetSpreadsheet_());
}

function deleteUnusedLegacyResearchManagementSheets_(spreadsheet) {
  let deleted = 0;
  LEGACY_RESEARCH_MANAGEMENT_SHEET_NAMES.forEach((sheetName) => {
    if (sheetName === RESEARCH_AUTOMATION_CONFIG.sheetName) {
      return;
    }
    const sheet = spreadsheet.getSheetByName(sheetName);
    if (sheet && typeof spreadsheet.deleteSheet === 'function') {
      spreadsheet.deleteSheet(sheet);
      deleted += 1;
    }
  });
  Logger.log(`\u65E7\u30EA\u30B5\u30FC\u30C1\u7BA1\u7406\u30B7\u30FC\u30C8\u524A\u9664: ${deleted}\u4EF6`);
  return deleted;
}

function syncResearchManagementSheet() {
  return syncResearchManagementByOrderNumber();
}

function syncResearchManagementSheet_(spreadsheet) {
  return syncResearchManagementByOrderNumber_(spreadsheet).appended;
}

function syncResearchManagementByOrderNumber() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) {
    Logger.log('\u5225\u306E\u540C\u671F\u307E\u305F\u306F\u30EA\u30B5\u30FC\u30C1\u51E6\u7406\u304C\u5B9F\u884C\u4E2D\u306E\u305F\u3081\u3001\u6CE8\u6587\u756A\u53F7\u540C\u671F\u3092\u7D42\u4E86\u3057\u307E\u3057\u305F\u3002');
    return 0;
  }
  try {
    const result = syncResearchManagementByOrderNumber_(getTargetSpreadsheet_());
    Logger.log(`\u6CE8\u6587\u756A\u53F7\u540C\u671F: ${result.appended}\u884C\u8FFD\u52A0 / ${result.deleted}\u884C\u524A\u9664 / \u91CD\u8907${result.duplicates}\u4EF6`);
    return result.appended;
  } finally {
    lock.releaseLock();
  }
}

function syncResearchManagementByOrderNumber_(spreadsheet) {
  deleteUnusedLegacyResearchManagementSheets_(spreadsheet);
  const orderSheet = getOrCreateSheet_(spreadsheet, AMAZON_ORDER_IMPORTER_CONFIG.orderSheetName);
  const researchSheet = spreadsheet.getSheetByName(RESEARCH_AUTOMATION_CONFIG.sheetName);
  if (!researchSheet || (typeof researchSheet.isSheetHidden === 'function' && researchSheet.isSheetHidden())) {
    writeSynchronizationCheck_(
      spreadsheet,
      '\u8981\u78BA\u8A8D',
      '',
      researchSheet ? '\u30EA\u30B5\u30FC\u30C1\u7BA1\u7406\u8868\u304C\u975E\u8868\u793A\u306E\u305F\u3081\u3001\u30E1\u30A4\u30F3\u30B7\u30FC\u30C8\u306E\u307F\u51E6\u7406\u3057\u307E\u3059\u3002' : '\u30EA\u30B5\u30FC\u30C1\u7BA1\u7406\u8868\u304C\u5B58\u5728\u3057\u306A\u3044\u305F\u3081\u3001\u30E1\u30A4\u30F3\u30B7\u30FC\u30C8\u306E\u307F\u51E6\u7406\u3057\u307E\u3059\u3002',
    );
    return { appended: 0, deleted: 0, duplicates: 0, available: false };
  }

  const orderColumns = researchColumnMap_(orderSheet);
  enforceResearchManagementResultHeaders_(researchSheet);
  const researchColumns = researchColumnMap_(researchSheet);
  const orderLastRow = orderSheet.getLastRow();
  const mainOrders = new Map();
  let unresolvedMainOrderRows = 0;
  if (orderLastRow >= 2) {
    const rows = orderSheet.getRange(2, 1, orderLastRow - 1, Math.max(1, orderSheet.getLastColumn())).getValues();
    rows.forEach((row, index) => {
      const orderNumber = orderNumberFromRow_(row, orderColumns);
      if (!orderNumber) {
        if (row.some((value) => String(value || '').trim())) {
          unresolvedMainOrderRows += 1;
        }
        return;
      }
      if (!mainOrders.has(orderNumber)) {
        mainOrders.set(orderNumber, []);
      }
      mainOrders.get(orderNumber).push({ row: index + 2, values: row });
    });
  }

  let duplicates = 0;
  mainOrders.forEach((entries, orderNumber) => {
    if (entries.length > 1) {
      duplicates += 1;
      writeSynchronizationCheck_(spreadsheet, '\u6CE8\u6587\u756A\u53F7\u91CD\u8907', orderNumber, '\u6CE8\u6587\u78BA\u5B9A\u5546\u54C1\u30EA\u30B5\u30FC\u30C1\u8868\u306B\u540C\u3058\u6CE8\u6587\u756A\u53F7\u304C\u8907\u6570\u3042\u308A\u307E\u3059\u3002');
    }
  });

  const managementOrders = new Map();
  const researchLastRow = researchSheet.getLastRow();
  let researchValues = [];
  if (researchLastRow >= 2) {
    researchValues = researchSheet.getRange(2, 1, researchLastRow - 1, Math.max(1, researchSheet.getLastColumn())).getValues();
    researchValues.forEach((row, index) => {
      const orderNumber = orderNumberFromRow_(row, researchColumns);
      if (!orderNumber) {
        return;
      }
      if (!managementOrders.has(orderNumber)) {
        managementOrders.set(orderNumber, []);
      }
      managementOrders.get(orderNumber).push(index + 2);
    });
  }

  const rowsToDelete = [];
  managementOrders.forEach((rows, orderNumber) => {
    if (!mainOrders.has(orderNumber)) {
      if (!unresolvedMainOrderRows) {
        rows.forEach((rowNumber) => rowsToDelete.push(rowNumber));
      }
      return;
    }
    if (rows.length > 1) {
      duplicates += 1;
      writeSynchronizationCheck_(spreadsheet, '\u6CE8\u6587\u756A\u53F7\u91CD\u8907', orderNumber, '\u30EA\u30B5\u30FC\u30C1\u7BA1\u7406\u8868\u306B\u540C\u3058\u6CE8\u6587\u756A\u53F7\u304C\u8907\u6570\u3042\u308B\u305F\u3081\u3001\u81EA\u52D5\u66F4\u65B0\u3092\u4FDD\u7559\u3057\u307E\u3059\u3002');
    }
  });
  if (unresolvedMainOrderRows) {
    writeSynchronizationCheck_(
      spreadsheet,
      '\u8981\u78BA\u8A8D',
      '',
      `\u30E1\u30A4\u30F3\u30B7\u30FC\u30C8\u306B\u6CE8\u6587\u756A\u53F7\u3092\u53D6\u5F97\u3067\u304D\u306A\u3044\u884C\u304C${unresolvedMainOrderRows}\u4EF6\u3042\u308B\u305F\u3081\u3001\u7BA1\u7406\u8868\u306E\u524A\u9664\u540C\u671F\u3092\u4FDD\u7559\u3057\u307E\u3057\u305F\u3002`,
    );
  }
  const additions = [];
  const changedLinkedColumns = new Set();
  mainOrders.forEach((entries, orderNumber) => {
    if (entries.length !== 1) {
      return;
    }
    const source = entries[0].values;
    const managementRows = managementOrders.get(orderNumber) || [];
    if (managementRows.length === 1) {
      const managementRow = managementRows[0];
      const linkedValues = {
        shipDate: mappedValue_(source, orderColumns.shipDate),
        orderInfo: mappedValue_(source, orderColumns.orderInfo),
        orderNumber,
        maxPrice: salesAmountNumber_(mappedValue_(source, orderColumns.maxPrice)),
        keyword: mappedValue_(source, orderColumns.keyword),
      };
      Object.keys(linkedValues).forEach((key) => {
        if (researchColumns[key]) {
          const columnIndex = researchColumns[key] - 1;
          const currentValue = researchValues[managementRow - 2][columnIndex];
          if (String(currentValue == null ? '' : currentValue) !== String(linkedValues[key] == null ? '' : linkedValues[key])) {
            researchValues[managementRow - 2][columnIndex] = linkedValues[key];
            changedLinkedColumns.add(researchColumns[key]);
          }
        }
      });
      return;
    }
    if (managementRows.length > 1) {
      return;
    }
    const row = new Array(Math.max(1, researchSheet.getLastColumn())).fill('');
    setMappedValue_(row, researchColumns.shipDate, mappedValue_(source, orderColumns.shipDate));
    setMappedValue_(row, researchColumns.orderInfo, mappedValue_(source, orderColumns.orderInfo));
    setMappedValue_(row, researchColumns.orderNumber, orderNumber);
    setMappedValue_(row, researchColumns.maxPrice, salesAmountNumber_(mappedValue_(source, orderColumns.maxPrice)));
    setMappedValue_(row, researchColumns.keyword, mappedValue_(source, orderColumns.keyword));
    setMappedValue_(row, researchColumns.status, mappedValue_(source, orderColumns.status) || RESEARCH_STATUS.pending);
    RESEARCH_RESULT_KEYS.forEach((key) => {
      setMappedValue_(row, researchColumns[key], mappedValue_(source, orderColumns[key]));
    });
    additions.push(row);
  });

  changedLinkedColumns.forEach((columnNumber) => {
    researchSheet.getRange(2, columnNumber, researchValues.length, 1)
      .setValues(researchValues.map((row) => [row[columnNumber - 1]]));
  });
  if (additions.length) {
    researchSheet.getRange(researchSheet.getLastRow() + 1, 1, additions.length, additions[0].length).setValues(additions).setWrap(true);
  }
  rowsToDelete.sort((left, right) => right - left).forEach((rowNumber) => researchSheet.deleteRow(rowNumber));
  return {
    appended: additions.length,
    deleted: rowsToDelete.length,
    duplicates,
    available: true,
  };
}

function researchRowKey_(orderInfo, keyword) {
  const orderNumber = extractOrderNumberFromOrderInfo(orderInfo);
  const sku = (String(orderInfo || '').match(/SKU\s*[:\uFF1A]\s*([^\n]+)/i) || [])[1] || '';
  const base = orderNumber || String(orderInfo || '').replace(/\s/g, '').slice(0, 160);
  return base && keyword ? `${base}|${sku.trim()}|${String(keyword).replace(/\s/g, '').slice(0, 160)}` : '';
}

function researchColumnMap_(sheet) {
  const lastColumn = Math.max(1, sheet.getLastColumn());
  const headers = sheet.getRange(1, 1, 1, lastColumn).getDisplayValues()[0]
    .map((header) => String(header || '').replace(/\s/g, '').trim());
  const map = {};
  Object.keys(RESEARCH_COLUMN_ALIASES).forEach((key) => {
    const aliases = RESEARCH_COLUMN_ALIASES[key].map((alias) => String(alias).replace(/\s/g, ''));
    const index = headers.findIndex((header) => aliases.indexOf(header) >= 0);
    map[key] = index >= 0 ? index + 1 : 0;
  });
  return map;
}

function mappedValue_(row, columnNumber) {
  return columnNumber ? row[columnNumber - 1] : '';
}

function setMappedValue_(row, columnNumber, value) {
  if (columnNumber) {
    row[columnNumber - 1] = value;
  }
}

function extractOrderNumberFromOrderInfo(text) {
  return (String(text || '').match(/[0-9]{3}-[0-9]{7}-[0-9]{7}/) || [''])[0];
}

function orderNumberFromRow_(row, columns) {
  return extractOrderNumberFromOrderInfo(
    mappedValue_(row, columns.orderNumber) || mappedValue_(row, columns.orderInfo),
  );
}

function buildResearchManagementContext_(spreadsheet) {
  const sheet = spreadsheet.getSheetByName(RESEARCH_AUTOMATION_CONFIG.sheetName);
  const columns = sheet ? researchColumnMap_(sheet) : {};
  const rowsByOrderNumber = new Map();
  if (sheet && sheet.getLastRow() >= 2) {
    const values = sheet.getRange(2, 1, sheet.getLastRow() - 1, Math.max(1, sheet.getLastColumn())).getValues();
    values.forEach((row, index) => {
      const currentOrderNumber = orderNumberFromRow_(row, columns);
      if (!currentOrderNumber) {
        return;
      }
      if (!rowsByOrderNumber.has(currentOrderNumber)) {
        rowsByOrderNumber.set(currentOrderNumber, []);
      }
      rowsByOrderNumber.get(currentOrderNumber).push(index + 2);
    });
  }
  return { spreadsheet, sheet, columns, rowsByOrderNumber };
}

function findResearchManagementRowsByOrderNumber_(spreadsheet, orderNumber, context) {
  const current = context || buildResearchManagementContext_(spreadsheet);
  return {
    sheet: current.sheet,
    rows: orderNumber && current.rowsByOrderNumber ? (current.rowsByOrderNumber.get(orderNumber) || []) : [],
    columns: current.columns || {},
  };
}

function findResearchManagementRowByOrderNumber(orderNumber) {
  const spreadsheet = getTargetSpreadsheet_();
  const found = findResearchManagementRowsByOrderNumber_(spreadsheet, orderNumber);
  if (found.rows.length > 1) {
    writeSynchronizationCheck_(spreadsheet, '\u6CE8\u6587\u756A\u53F7\u91CD\u8907', orderNumber, '\u30EA\u30B5\u30FC\u30C1\u7BA1\u7406\u8868\u306B\u540C\u3058\u6CE8\u6587\u756A\u53F7\u304C\u8907\u6570\u3042\u308B\u305F\u3081\u3001\u81EA\u52D5\u66F4\u65B0\u3092\u4FDD\u7559\u3057\u307E\u3059\u3002');
    return 0;
  }
  return found.rows[0] || 0;
}

function deleteResearchManagementRowsByOrderNumber(orderNumber) {
  const spreadsheet = getTargetSpreadsheet_();
  const found = findResearchManagementRowsByOrderNumber_(spreadsheet, orderNumber);
  found.rows.slice().sort((left, right) => right - left).forEach((rowNumber) => found.sheet.deleteRow(rowNumber));
  return found.rows.length;
}

function researchResultColumn_(columns, siteName) {
  const aliases = {
    Amazon: 'Amazon',
    Yahoo: 'Yahoo',
    '\u30E4\u30D5\u30AA\u30AF': 'Yahoo',
    Mercari: 'Mercari',
    '\u30E1\u30EB\u30AB\u30EA': 'Mercari',
    Jimoty: 'Jimoty',
    '\u30B8\u30E2\u30C6\u30A3': 'Jimoty',
    Rakuten: 'Rakuten',
    '\u697D\u5929\u5E02\u5834': 'Rakuten',
    Other: 'Other',
    '\u305D\u306E\u4ED6\u30B5\u30A4\u30C8': 'Other',
  };
  return columns[aliases[siteName] || siteName] || 0;
}

function appendUrlToResearchManagementSheet(orderNumber, siteName, resultText) {
  const spreadsheet = getTargetSpreadsheet_();
  const found = findResearchManagementRowsByOrderNumber_(spreadsheet, orderNumber);
  if (!found.sheet || found.rows.length !== 1) {
    if (found.rows.length > 1) {
      writeSynchronizationCheck_(spreadsheet, '\u6CE8\u6587\u756A\u53F7\u91CD\u8907', orderNumber, '\u30EA\u30B5\u30FC\u30C1\u7BA1\u7406\u8868\u306B\u540C\u3058\u6CE8\u6587\u756A\u53F7\u304C\u8907\u6570\u3042\u308B\u305F\u3081\u3001\u5019\u88DCURL\u3092\u8FFD\u8A18\u3057\u307E\u305B\u3093\u3067\u3057\u305F\u3002');
    }
    return 0;
  }
  return appendResearchLinesToSheet_(
    found.sheet,
    found.rows[0],
    researchResultColumn_(found.columns, siteName),
    resultText,
  );
}

function isDuplicateUrlInResearchManagement(orderNumber, url) {
  const spreadsheet = getTargetSpreadsheet_();
  const found = findResearchManagementRowsByOrderNumber_(spreadsheet, orderNumber);
  if (!found.sheet || found.rows.length !== 1) {
    return false;
  }
  return LEGACY_RESEARCH_RESULT_KEYS.some((key) => {
    const columnNumber = found.columns[key];
    return columnNumber && isDuplicateUrlInCell_(found.sheet.getRange(found.rows[0], columnNumber).getValue(), url);
  });
}

function researchManagementHasCandidates_(orderNumber, context) {
  const spreadsheet = context ? context.spreadsheet : getTargetSpreadsheet_();
  const found = findResearchManagementRowsByOrderNumber_(spreadsheet, orderNumber, context);
  if (!found.sheet || found.rows.length !== 1) {
    return false;
  }
  return LEGACY_RESEARCH_RESULT_KEYS.some((key) => {
    const columnNumber = found.columns[key];
    return columnNumber && String(found.sheet.getRange(found.rows[0], columnNumber).getDisplayValue() || '').trim();
  });
}

function appendUniqueMemo_(sheet, rowNumber, columnNumber, memo) {
  if (!sheet || !columnNumber || !String(memo || '').trim()) {
    return false;
  }
  const cell = sheet.getRange(rowNumber, columnNumber);
  const current = String(cell.getValue() || '');
  const lines = current.split('\n').map((line) => line.trim()).filter(Boolean);
  const next = String(memo).trim();
  if (lines.indexOf(next) >= 0) {
    return false;
  }
  cell.setValue(current ? `${current}\n${next}` : next).setWrap(true);
  return true;
}

function writeResearchManagementCheckMemo(orderNumber, memo) {
  const spreadsheet = getTargetSpreadsheet_();
  const found = findResearchManagementRowsByOrderNumber_(spreadsheet, orderNumber);
  if (!found.sheet || found.rows.length !== 1 || !found.columns.memo) {
    writeSynchronizationCheck_(spreadsheet, '\u8981\u78BA\u8A8D', orderNumber, memo);
    return false;
  }
  return appendUniqueMemo_(found.sheet, found.rows[0], found.columns.memo, memo);
}

function updateResearchManagementRowByOrderNumber(orderNumber, resultInfo, context) {
  const spreadsheet = context ? context.spreadsheet : getTargetSpreadsheet_();
  const found = findResearchManagementRowsByOrderNumber_(spreadsheet, orderNumber, context);
  if (!found.sheet || (typeof found.sheet.isSheetHidden === 'function' && found.sheet.isSheetHidden())) {
    return false;
  }
  if (found.rows.length !== 1) {
    if (found.rows.length > 1) {
      writeSynchronizationCheck_(spreadsheet, '\u6CE8\u6587\u756A\u53F7\u91CD\u8907', orderNumber, '\u30EA\u30B5\u30FC\u30C1\u7BA1\u7406\u8868\u306B\u540C\u3058\u6CE8\u6587\u756A\u53F7\u304C\u8907\u6570\u3042\u308B\u305F\u3081\u3001\u7D50\u679C\u540C\u671F\u3092\u4FDD\u7559\u3057\u307E\u3059\u3002');
    }
    return false;
  }

  const rowNumber = found.rows[0];
  const info = resultInfo || {};
  Object.keys(info.resultsBySite || {}).forEach((siteName) => {
    appendResearchLinesToSheet_(
      found.sheet,
      rowNumber,
      researchResultColumn_(found.columns, siteName),
      info.resultsBySite[siteName],
    );
  });
  if (info.status) {
    setManagedResearchStatusAtColumn_(found.sheet, rowNumber, found.columns.status, info.status);
  }
  if (found.columns.lastResearchedAt) {
    found.sheet.getRange(rowNumber, found.columns.lastResearchedAt).setValue(new Date());
  }
  (info.memos || []).forEach((memo) => {
    if (found.columns.memo) {
      appendUniqueMemo_(found.sheet, rowNumber, found.columns.memo, memo);
    } else {
      writeSynchronizationCheck_(spreadsheet, '\u8981\u78BA\u8A8D', orderNumber, memo);
    }
  });
  return true;
}

function syncMainAndResearchManagementAfterResearch(orderNumber, mainRowNumber, results, context) {
  if (!orderNumber || !mainRowNumber) {
    return false;
  }
  return updateResearchManagementRowByOrderNumber(orderNumber, results, context);
}

function writeSynchronizationCheck_(spreadsheet, type, orderNumber, message) {
  const reviewSheet = getOrCreateSheet_(spreadsheet, AMAZON_ORDER_IMPORTER_CONFIG.reviewSheetName);
  reviewSheet.appendRow([
    new Date(),
    '',
    '',
    JSON.stringify({ orderNumber: orderNumber || '' }),
    '',
    message,
    type,
    orderNumber || '',
    '',
    '',
    '',
    '',
  ]);
}

function setupHourlyTrigger() {
  ScriptApp.getProjectTriggers()
    .filter((trigger) => trigger.getHandlerFunction() === 'researchListedItemsHourly')
    .forEach((trigger) => ScriptApp.deleteTrigger(trigger));
  ScriptApp.newTrigger('researchListedItemsHourly').timeBased().everyHours(1).create();
}

function setupOnChangeTrigger() {
  const spreadsheet = getTargetSpreadsheet_();
  ScriptApp.getProjectTriggers()
    .filter((trigger) => trigger.getHandlerFunction() === 'syncResearchManagementOnChange')
    .forEach((trigger) => ScriptApp.deleteTrigger(trigger));
  ScriptApp.newTrigger('syncResearchManagementOnChange').forSpreadsheet(spreadsheet).onChange().create();
}

function syncResearchManagementOnChange(event) {
  const changeType = String(event && event.changeType ? event.changeType : '');
  if (!changeType || ['REMOVE_ROW', 'INSERT_ROW', 'OTHER'].indexOf(changeType) >= 0) {
    const spreadsheet = getTargetSpreadsheet_();
    const orderSheet = getOrCreateSheet_(spreadsheet, AMAZON_ORDER_IMPORTER_CONFIG.orderSheetName);
    if (typeof enforceProtectedDeletedRows_ === 'function') {
      enforceProtectedDeletedRows_(spreadsheet, orderSheet, `onChange:${changeType || 'UNKNOWN'} 132\u884C\u76EE\u4EE5\u964D\u4FDD\u8B77`);
    }
    if (typeof recordDeletedOrdersSinceLastSnapshot_ === 'function') {
      recordDeletedOrdersSinceLastSnapshot_(spreadsheet, orderSheet, `onChange:${changeType || 'UNKNOWN'}`);
    }
    syncResearchManagementByOrderNumber();
  }
}

function researchImportedOrderRowsAfterImport_(spreadsheet, orderNumbers) {
  const uniqueOrderNumbers = Array.from(new Set((orderNumbers || []).filter(Boolean)));
  if (!uniqueOrderNumbers.length) {
    return { synced: 0, processed: 0, added: 0, errors: 0, skipped: 0 };
  }

  const lock = LockService.getScriptLock();
  if (!lock.tryLock(1000)) {
    Logger.log('\u5225\u306E\u30EA\u30B5\u30FC\u30C1\u51E6\u7406\u304C\u5B9F\u884C\u4E2D\u306E\u305F\u3081\u3001Gmail\u81EA\u52D5\u53D6\u5F97\u76F4\u5F8C\u30EA\u30B5\u30FC\u30C1\u3092\u4FDD\u7559\u3057\u307E\u3057\u305F\u3002');
    return { synced: 0, processed: 0, added: 0, errors: 0, skipped: uniqueOrderNumbers.length };
  }

  try {
    return researchImportedOrderRowsAfterImportCore_(spreadsheet, uniqueOrderNumbers);
  } finally {
    lock.releaseLock();
  }
}

function researchImportedOrderRowsAfterImportCore_(spreadsheet, orderNumbers) {
  const uniqueOrderNumbers = Array.from(new Set((orderNumbers || []).filter(Boolean)));
  if (!uniqueOrderNumbers.length) {
    return { synced: 0, processed: 0, added: 0, errors: 0, skipped: 0 };
  }

  const syncResult = syncResearchManagementByOrderNumber_(spreadsheet);
  if (!syncResult.available) {
    return { synced: 0, processed: 0, added: 0, errors: 0, skipped: uniqueOrderNumbers.length };
  }

  const managementContext = buildResearchManagementContext_(spreadsheet);
  const sheet = managementContext.sheet;
  if (!sheet || (typeof sheet.isSheetHidden === 'function' && sheet.isSheetHidden())) {
    return { synced: syncResult.appended, processed: 0, added: 0, errors: 0, skipped: uniqueOrderNumbers.length };
  }
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    return { synced: syncResult.appended, processed: 0, added: 0, errors: 0, skipped: uniqueOrderNumbers.length };
  }

  const columns = managementContext.columns;
  const values = sheet.getRange(2, 1, lastRow - 1, Math.max(1, sheet.getLastColumn())).getValues();
  const rowsByOrderNumber = new Map();
  values.forEach((row, index) => {
    const orderNumber = orderNumberFromRow_(row, columns);
    if (!orderNumber || uniqueOrderNumbers.indexOf(orderNumber) < 0) {
      return;
    }
    if (!rowsByOrderNumber.has(orderNumber)) {
      rowsByOrderNumber.set(orderNumber, []);
    }
    rowsByOrderNumber.get(orderNumber).push({ rowNumber: index + 2, values: row });
  });

  let processed = 0;
  let added = 0;
  let errors = 0;
  let skipped = 0;
  uniqueOrderNumbers.forEach((orderNumber) => {
    const matches = rowsByOrderNumber.get(orderNumber) || [];
    if (matches.length !== 1) {
      skipped += 1;
      if (matches.length > 1) {
        writeSynchronizationCheck_(spreadsheet, '\u6CE8\u6587\u756A\u53F7\u91CD\u8907', orderNumber, 'Gmail\u81EA\u52D5\u53D6\u5F97\u76F4\u5F8C\u30EA\u30B5\u30FC\u30C1\u306F\u3001\u540C\u3058\u6CE8\u6587\u756A\u53F7\u306E\u884C\u304C\u8907\u6570\u3042\u308B\u305F\u3081\u4FDD\u7559\u3057\u307E\u3057\u305F\u3002');
      }
      return;
    }

    const target = matches[0];
    if (!isResearchRowVisibleForAutomation_(sheet, target.rowNumber)) {
      skipped += 1;
      writeSynchronizationCheck_(spreadsheet, '\u8981\u78BA\u8A8D', orderNumber, 'Gmail\u81EA\u52D5\u53D6\u5F97\u76F4\u5F8C\u30EA\u30B5\u30FC\u30C1\u306F\u3001\u5BFE\u8C61\u884C\u304C\u975E\u8868\u793A\u306E\u305F\u3081\u4FDD\u7559\u3057\u307E\u3057\u305F\u3002');
      return;
    }

    const rowData = buildResearchRowDataFromSheet_(target.rowNumber, target.values, columns, sheet);
    if (!rowData.keywordLines.length || !rowData.maxPrice) {
      setManagedResearchStatusAtColumn_(sheet, target.rowNumber, columns.status, RESEARCH_STATUS.review);
      writeResearchCheck_(rowData, '\u5165\u529B\u4E0D\u8DB3', 'C\u5217\u306E\u58F2\u4E0A\u91D1\u307E\u305F\u306FD\u5217\u306E\u691C\u7D22\u30EF\u30FC\u30C9\u304C\u3042\u308A\u307E\u305B\u3093\u3002', '');
      syncMainAndResearchManagementAfterResearch(rowData.orderNumber, target.rowNumber, {
        status: RESEARCH_STATUS.review,
        resultsBySite: {},
        memos: ['C\u5217\u306E\u58F2\u4E0A\u91D1\u307E\u305F\u306FD\u5217\u306E\u691C\u7D22\u30EF\u30FC\u30C9\u304C\u3042\u308A\u307E\u305B\u3093\u3002'],
      }, managementContext);
      processed += 1;
      return;
    }

    setManagedResearchStatusAtColumn_(sheet, target.rowNumber, columns.status, RESEARCH_STATUS.running);
    try {
      const result = researchOneOrder(rowData);
      added += result.added;
      const hasCandidates = rowHasResearchCandidates_(sheet, target.rowNumber, columns)
        || researchManagementHasCandidates_(rowData.orderNumber, managementContext)
        || Object.keys(result.resultsBySite || {}).some((key) => (result.resultsBySite[key] || []).length);
      result.status = hasCandidates ? RESEARCH_STATUS.found : (result.needsReview ? RESEARCH_STATUS.review : RESEARCH_STATUS.empty);
      setManagedResearchStatusAtColumn_(sheet, target.rowNumber, columns.status, result.status);
      syncMainAndResearchManagementAfterResearch(rowData.orderNumber, target.rowNumber, result, managementContext);
    } catch (error) {
      errors += 1;
      const message = String(error && error.message ? error.message : error);
      setManagedResearchStatusAtColumn_(sheet, target.rowNumber, columns.status, RESEARCH_STATUS.error);
      writeResearchCheck_(rowData, '\u30A8\u30E9\u30FC', message, '');
      syncMainAndResearchManagementAfterResearch(rowData.orderNumber, target.rowNumber, {
        status: RESEARCH_STATUS.error,
        resultsBySite: {},
        memos: [message],
      }, managementContext);
    }
    processed += 1;
  });

  Logger.log(`Gmail\u81EA\u52D5\u53D6\u5F97\u76F4\u5F8C\u30EA\u30B5\u30FC\u30C1\u5B8C\u4E86: \u540C\u671F\u8FFD\u52A0 ${syncResult.appended} / \u4ECA\u56DE\u51E6\u7406 ${processed} / \u65B0\u898FURL ${added} / \u30A8\u30E9\u30FC ${errors} / \u4FDD\u7559 ${skipped}`);
  return { synced: syncResult.appended, processed, added, errors, skipped };
}

function isResearchRowVisibleForAutomation_(sheet, rowNumber) {
  const hiddenByUser = typeof sheet.isRowHiddenByUser === 'function' && sheet.isRowHiddenByUser(rowNumber);
  const hiddenByFilter = typeof sheet.isRowHiddenByFilter === 'function' && sheet.isRowHiddenByFilter(rowNumber);
  return !hiddenByUser && !hiddenByFilter;
}

function researchListedItemsHourly() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(1000)) {
    Logger.log('\u5225\u306E\u30EA\u30B5\u30FC\u30C1\u51E6\u7406\u304C\u5B9F\u884C\u4E2D\u306E\u305F\u3081\u3001\u4ECA\u56DE\u306E\u5B9F\u884C\u3092\u7D42\u4E86\u3057\u307E\u3057\u305F\u3002');
    return;
  }

  try {
    const startedAt = Date.now();
    const spreadsheet = getTargetSpreadsheet_();
    const syncResult = syncResearchManagementByOrderNumber_(spreadsheet);
    if (!syncResult.available) {
      return;
    }
    const managementContext = buildResearchManagementContext_(spreadsheet);
    const sheet = managementContext.sheet;
    if (!sheet || (typeof sheet.isSheetHidden === 'function' && sheet.isSheetHidden())) {
      return;
    }
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) {
      return;
    }

    const columns = managementContext.columns;
    const visibleRows = visibleResearchRows_(sheet, lastRow);
    const properties = PropertiesService.getScriptProperties();
    const cursorKey = 'managementResearchVisibleRowCursor';
    const cursor = Math.max(0, Number(properties.getProperty(cursorKey)) || 0);
    const orderedRows = rotateRows_(visibleRows, cursor);
    let processed = 0;
    let added = 0;
    let errors = 0;

    for (let index = 0; index < orderedRows.length; index += 1) {
      if (processed >= RESEARCH_AUTOMATION_CONFIG.maxRowsPerRun || Date.now() - startedAt >= RESEARCH_AUTOMATION_CONFIG.maxRuntimeMs) {
        break;
      }
      const rowNumber = orderedRows[index];
      const values = sheet.getRange(rowNumber, 1, 1, Math.max(1, sheet.getLastColumn())).getValues()[0];
      const rowData = buildResearchRowDataFromSheet_(rowNumber, values, columns, sheet);
      if (!rowData.keywordLines.length || !rowData.maxPrice) {
        setManagedResearchStatusAtColumn_(sheet, rowNumber, columns.status, RESEARCH_STATUS.review);
        writeResearchCheck_(rowData, '\u5165\u529B\u4E0D\u8DB3', 'C\u5217\u306E\u58F2\u4E0A\u91D1\u307E\u305F\u306FD\u5217\u306E\u691C\u7D22\u30EF\u30FC\u30C9\u304C\u3042\u308A\u307E\u305B\u3093\u3002', '');
        syncMainAndResearchManagementAfterResearch(rowData.orderNumber, rowNumber, {
          status: RESEARCH_STATUS.review,
          resultsBySite: {},
          memos: ['C\u5217\u306E\u58F2\u4E0A\u91D1\u307E\u305F\u306FD\u5217\u306E\u691C\u7D22\u30EF\u30FC\u30C9\u304C\u3042\u308A\u307E\u305B\u3093\u3002'],
        }, managementContext);
        processed += 1;
        continue;
      }
      if (!rowData.orderNumber) {
        setManagedResearchStatusAtColumn_(sheet, rowNumber, columns.status, RESEARCH_STATUS.review);
        writeResearchCheck_(rowData, '\u5165\u529B\u4E0D\u8DB3', 'B\u5217\u306E\u6CE8\u6587\u60C5\u5831\u304B\u3089\u6CE8\u6587\u756A\u53F7\u3092\u53D6\u5F97\u3067\u304D\u307E\u305B\u3093\u3002', '');
        processed += 1;
        continue;
      }

      setManagedResearchStatusAtColumn_(sheet, rowNumber, columns.status, RESEARCH_STATUS.running);
      try {
        const result = researchOneOrder(rowData);
        added += result.added;
        const hasCandidates = rowHasResearchCandidates_(sheet, rowNumber, columns)
          || researchManagementHasCandidates_(rowData.orderNumber, managementContext)
          || Object.keys(result.resultsBySite || {}).some((key) => (result.resultsBySite[key] || []).length);
        result.status = hasCandidates ? RESEARCH_STATUS.found : (result.needsReview ? RESEARCH_STATUS.review : RESEARCH_STATUS.empty);
        setManagedResearchStatusAtColumn_(sheet, rowNumber, columns.status, result.status);
        syncMainAndResearchManagementAfterResearch(rowData.orderNumber, rowNumber, result, managementContext);
      } catch (error) {
        errors += 1;
        const message = String(error && error.message ? error.message : error);
        setManagedResearchStatusAtColumn_(sheet, rowNumber, columns.status, RESEARCH_STATUS.error);
        writeResearchCheck_(rowData, '\u30A8\u30E9\u30FC', message, '');
        syncMainAndResearchManagementAfterResearch(rowData.orderNumber, rowNumber, {
          status: RESEARCH_STATUS.error,
          resultsBySite: {},
          memos: [message],
        }, managementContext);
      }
      processed += 1;
    }

    if (visibleRows.length) {
      properties.setProperty(cursorKey, String((cursor + processed) % visibleRows.length));
    }
    Logger.log(`\u7D99\u7D9A\u30EA\u30B5\u30FC\u30C1\u5B8C\u4E86: \u8868\u793A\u884C ${visibleRows.length} / \u4ECA\u56DE\u51E6\u7406 ${processed} / \u65B0\u898FURL ${added} / \u30A8\u30E9\u30FC ${errors}`);
  } finally {
    lock.releaseLock();
  }
}

function researchAllVisibleManagementRowsNow() {
  PropertiesService.getScriptProperties().setProperty('managementResearchVisibleRowCursor', '0');
  Logger.log('\u30EA\u30B5\u30FC\u30C1\u7BA1\u7406\u8868\u306E\u8868\u793A\u4E2D\u306E\u5168\u884C\u3092\u3001\u73FE\u5728\u306E\u5B9F\u884C\u3067\u5148\u982D\u304B\u3089\u30EA\u30B5\u30FC\u30C1\u3057\u307E\u3059\u3002');
  return researchListedItemsHourly();
}

function setManagedResearchStatus_(sheet, rowNumber, nextStatus) {
  return setManagedResearchStatusAtColumn_(sheet, rowNumber, 5, nextStatus);
}

function setManagedResearchStatusAtColumn_(sheet, rowNumber, columnNumber, nextStatus) {
  if (!columnNumber) {
    return false;
  }
  const cell = sheet.getRange(rowNumber, columnNumber);
  const current = String(cell.getValue() || '').trim();
  const managedStatuses = Object.keys(RESEARCH_STATUS).map((key) => RESEARCH_STATUS[key]);
  if (!current || managedStatuses.indexOf(current) >= 0) {
    cell.setValue(nextStatus);
    return true;
  }
  return false;
}

function visibleResearchRows_(sheet, lastRow) {
  const rows = [];
  for (let row = 2; row <= lastRow; row += 1) {
    const hiddenByUser = sheet.isRowHiddenByUser(row);
    const hiddenByFilter = typeof sheet.isRowHiddenByFilter === 'function' && sheet.isRowHiddenByFilter(row);
    if (!hiddenByUser && !hiddenByFilter) {
      rows.push(row);
    }
  }
  return rows;
}

function rotateRows_(rows, cursor) {
  if (!rows.length) {
    return [];
  }
  const start = cursor % rows.length;
  return rows.slice(start).concat(rows.slice(0, start));
}

function buildResearchRowData_(rowNumber, values) {
  const orderInfo = String(values[1] || '');
  const sku = ((orderInfo.match(/SKU\s*[:\uFF1A]\s*([^\n]+)/i) || [])[1] || '').trim();
  const productName = ((orderInfo.match(/\u5546\u54C1\u540D\s*[:\uFF1A]\s*([^\n]+)/) || [])[1] || '').trim();
  const keywordLines = String(values[3] || '')
    .split('\n')
    .map((line) => line.replace(/^\u3010\d+\u3011\s*/, '').trim())
    .filter(Boolean);
  return {
    row: rowNumber,
    shipDate: values[0],
    orderInfo,
    productName,
    sku,
    maxPrice: salesAmountNumber_(values[2]),
    keywordLines,
    isDvd: isDvdLikeProduct_(`${orderInfo}\n${values[3] || ''}`),
    expectedVolume: expectedVolumeCount_(`${orderInfo}\n${values[3] || ''}`),
    newOnly: /muza/i.test(sku),
    orderNumber: extractOrderNumberFromOrderInfo(orderInfo),
  };
}

function buildResearchRowDataFromSheet_(rowNumber, values, columns, sheet) {
  const canonicalValues = [
    mappedValue_(values, columns.shipDate),
    mappedValue_(values, columns.orderInfo) || mappedValue_(values, columns.orderNumber),
    mappedValue_(values, columns.maxPrice),
    mappedValue_(values, columns.keyword),
  ];
  const rowData = buildResearchRowData_(rowNumber, canonicalValues);
  rowData.orderNumber = orderNumberFromRow_(values, columns);
  rowData.sheet = sheet;
  rowData.columns = columns;
  return rowData;
}

function rowHasResearchCandidates_(sheet, rowNumber, columns) {
  return RESEARCH_RESULT_KEYS.some((key) => {
    const columnNumber = columns[key];
    return columnNumber && String(sheet.getRange(rowNumber, columnNumber).getDisplayValue() || '').trim();
  });
}

function isResearchManagementSheet_(sheet) {
  return !sheet
    || typeof sheet.getName !== 'function'
    || sheet.getName() === RESEARCH_AUTOMATION_CONFIG.sheetName;
}

function researchOneOrder(rowData) {
  if (!isResearchManagementSheet_(rowData.sheet)) {
    writeResearchCheck_(
      rowData,
      '\u66F8\u304D\u8FBC\u307F\u5148\u4E0D\u4E00\u81F4',
      `\u5019\u88DCURL\u306E\u8FFD\u8A18\u5148\u306F${RESEARCH_AUTOMATION_CONFIG.sheetName}\u306E\u307F\u306B\u9650\u5B9A\u3057\u3066\u3044\u307E\u3059\u3002`,
      '',
    );
    return {
      added: 0,
      needsReview: true,
      resultsBySite: {},
      memos: ['\u5019\u88DCURL\u306E\u8FFD\u8A18\u5148\u304C\u30EA\u30B5\u30FC\u30C1\u7BA1\u7406\u8868\u3067\u306F\u306A\u3044\u305F\u3081\u8FFD\u8A18\u3092\u505C\u6B62\u3057\u307E\u3057\u305F\u3002'],
    };
  }
  let added = 0;
  let needsReview = false;
  const seenThisRun = new Set();
  const resultsBySite = {};
  const memos = [];

  RESEARCH_SITES.forEach((site) => {
    const siteResult = researchSiteForKeywords_(site, rowData);
    const accepted = filterItemsByPriceAndCondition(siteResult.items, rowData.maxPrice, site.key, rowData.isDvd, rowData);
    const uniqueItems = accepted.filter((item) => {
        const canonical = canonicalResearchUrl_(item.url);
        if (!canonical || seenThisRun.has(canonical)) {
          return false;
        }
        seenThisRun.add(canonical);
        item.url = canonical;
        return true;
      });
    const lines = uniqueItems.map((item) => formatResearchResult_(item, false));
    resultsBySite[site.key] = lines;
    const addedForSite = appendResearchLinesToSheet_(
      rowData.sheet,
      rowData.row,
      rowData.columns[site.key],
      lines,
    );
    added += addedForSite;
    const unknownShipping = uniqueItems.find((item) => !item.shippingKnown);
    if (addedForSite > 0 && unknownShipping) {
      needsReview = true;
      memos.push(`${site.label}: \u9001\u6599\u8981\u78BA\u8A8D ${unknownShipping.url}`);
      writeResearchCheck_(
        rowData,
        '\u8981\u78BA\u8A8D',
        `${site.label}: \u9001\u6599\u4E0D\u660E\u306E\u305F\u3081\u5546\u54C1\u4FA1\u683C\u3060\u3051\u3067\u4EEE\u5224\u5B9A\u3057\u307E\u3057\u305F\u3002`,
        unknownShipping.url,
      );
    }
    if (!siteResult.ok || siteResult.rejectedForMissingData > 0) {
      needsReview = true;
      memos.push(`${site.label}: \u81EA\u52D5\u5224\u5B9A\u4E0D\u53EF \u624B\u52D5\u78BA\u8A8DURL ${siteResult.manualUrl}`);
      writeResearchCheck_(rowData, '\u8981\u78BA\u8A8D', `${site.label}: \u81EA\u52D5\u5224\u5B9A\u3067\u304D\u306A\u3044\u5019\u88DC\u307E\u305F\u306F\u53D6\u5F97\u5236\u9650\u304C\u3042\u308A\u307E\u3059\u3002`, siteResult.manualUrl);
    }
  });

  const otherItems = [];
  [].forEach((site) => {
    const siteResult = researchSiteForKeywords_(site, rowData);
    const accepted = filterItemsByPriceAndCondition(siteResult.items, rowData.maxPrice, site.key, rowData.isDvd, rowData);
    accepted.forEach((item) => {
      const canonical = canonicalResearchUrl_(item.url);
      if (!canonical || seenThisRun.has(canonical)) {
        return;
      }
      seenThisRun.add(canonical);
      item.url = canonical;
      otherItems.push(item);
    });
    if (!siteResult.ok || siteResult.rejectedForMissingData > 0) {
      needsReview = true;
      memos.push(`${site.label}: \u81EA\u52D5\u5224\u5B9A\u4E0D\u53EF \u624B\u52D5\u78BA\u8A8DURL ${siteResult.manualUrl}`);
      writeResearchCheck_(rowData, '\u8981\u78BA\u8A8D', `${site.label}: \u81EA\u52D5\u5224\u5B9A\u3067\u304D\u306A\u3044\u5019\u88DC\u307E\u305F\u306F\u53D6\u5F97\u5236\u9650\u304C\u3042\u308A\u307E\u3059\u3002`, siteResult.manualUrl);
    }
  });
  resultsBySite.Other = otherItems.map((item) => formatResearchResult_(item, true));
  const addedOther = appendResearchLinesToSheet_(
    rowData.sheet,
    rowData.row,
    rowData.columns.Other,
    resultsBySite.Other,
  );
  added += addedOther;
  const unknownOtherShipping = otherItems.find((item) => !item.shippingKnown);
  if (addedOther > 0 && unknownOtherShipping) {
    needsReview = true;
    memos.push(`${unknownOtherShipping.siteLabel || unknownOtherShipping.site}: \u9001\u6599\u8981\u78BA\u8A8D ${unknownOtherShipping.url}`);
    writeResearchCheck_(
      rowData,
      '\u8981\u78BA\u8A8D',
      `${unknownOtherShipping.siteLabel || unknownOtherShipping.site}: \u9001\u6599\u4E0D\u660E\u306E\u305F\u3081\u5546\u54C1\u4FA1\u683C\u3060\u3051\u3067\u4EEE\u5224\u5B9A\u3057\u307E\u3057\u305F\u3002`,
      unknownOtherShipping.url,
    );
  }

  return { added, needsReview, resultsBySite, memos };
}

function searchAmazon(keyword, maxPrice, isDvd) {
  return searchSingleSite_('Amazon', keyword, maxPrice, isDvd);
}

function searchYahooAuction(keyword, maxPrice, isDvd) {
  return searchSingleSite_('Yahoo', keyword, maxPrice, isDvd);
}

function searchMercari(keyword, maxPrice, isDvd) {
  return searchSingleSite_('Mercari', keyword, maxPrice, isDvd);
}

function searchJimoty(keyword, maxPrice, isDvd) {
  return searchSingleSite_('Jimoty', keyword, maxPrice, isDvd);
}

function searchOtherSites(keyword, maxPrice, isDvd) {
  return OTHER_RESEARCH_SITES.reduce((items, site) => (
    items.concat(searchSiteDefinition_(site, keyword, maxPrice, isDvd))
  ), []);
}

function searchSingleSite_(siteKey, keyword, maxPrice, isDvd) {
  const site = RESEARCH_SITES.find((definition) => definition.key === siteKey);
  return site ? searchSiteDefinition_(site, keyword, maxPrice, isDvd) : [];
}

function searchSiteDefinition_(site, keyword, maxPrice, isDvd) {
  const result = fetchSearchResults_(site, site.searchUrl(keyword, maxPrice), keyword);
  const rowData = { expectedVolume: 0, newOnly: false };
  return filterItemsByPriceAndCondition(result.items, maxPrice, site.key, isDvd, rowData);
}

function createManualSearchUrl(siteName, keyword, maxPrice) {
  const definitions = RESEARCH_SITES.concat(OTHER_RESEARCH_SITES);
  const site = definitions.find((definition) => definition.key === siteName || definition.label === siteName);
  return site ? site.searchUrl(keyword, maxPrice) : `https://www.google.com/search?q=${encodeURIComponent(keyword || '')}`;
}

function researchSiteForKeywords_(site, rowData) {
  const combined = [];
  let ok = true;
  let rejectedForMissingData = 0;
  let manualUrl = '';

  rowData.keywordLines.forEach((keyword) => {
    const url = site.searchUrl(keyword, rowData.maxPrice);
    manualUrl = manualUrl || url;
    const result = fetchSearchResults_(site, url, keyword);
    ok = ok && result.ok;
    rejectedForMissingData += result.rejectedForMissingData;
    result.items.forEach((item) => combined.push(item));
  });

  return { ok, items: combined, rejectedForMissingData, manualUrl };
}

function fetchSearchResults_(site, url, keyword) {
  try {
    const response = UrlFetchApp.fetch(url, {
      muteHttpExceptions: true,
      followRedirects: true,
      headers: {
        'User-Agent': RESEARCH_AUTOMATION_CONFIG.userAgent,
        'Accept-Language': 'ja-JP,ja;q=0.9',
      },
    });
    const status = response.getResponseCode();
    if (status < 200 || status >= 400) {
      return { ok: false, items: [], rejectedForMissingData: 0 };
    }
    return extractCandidateItems_(String(response.getContentText() || ''), site, keyword);
  } catch (error) {
    return { ok: false, items: [], rejectedForMissingData: 0 };
  }
}

function extractCandidateItems_(html, site, keyword) {
  const items = [];
  const seen = new Set();
  let rejectedForMissingData = 0;
  const anchorPattern = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match;

  while ((match = anchorPattern.exec(String(html || ''))) !== null && items.length < 40) {
    const url = normalizeResearchProductUrl_(match[1], site.key);
    if (!url || seen.has(url) || !site.resultHost.test(url)) {
      continue;
    }
    const context = String(html).slice(Math.max(0, match.index - 700), Math.min(String(html).length, match.index + match[0].length + 1100));
    const anchorTitle = stripResearchHtml_(match[2]);
    const altTitle = decodeResearchHtml_(((match[0].match(/\b(?:alt|title)=["']([^"']+)["']/i) || [])[1] || ''));
    const title = (anchorTitle || altTitle || stripResearchHtml_(context).slice(0, 300)).trim();
    if (!title || !matchesResearchKeyword_(title, keyword)) {
      continue;
    }
    seen.add(url);

    const price = priceNear_(context);
    const shipping = shippingNear_(context);
    const condition = conditionNear_(context, site.key);
    if (!price) {
      rejectedForMissingData += 1;
      continue;
    }
    items.push({
      site: site.key,
      siteLabel: site.label,
      title,
      url,
      price,
      shipping: shipping.amount,
      shippingKnown: shipping.known,
      condition,
      contextText: stripResearchHtml_(context),
    });
  }

  return { ok: true, items, rejectedForMissingData };
}

function filterItemsByPriceAndCondition(items, maxPrice, siteName, isDvd, rowData) {
  return (items || []).filter((item) => {
    if (!item || !item.url || !item.price || item.price <= 0) {
      return false;
    }
    const text = `${item.title || ''} ${item.condition || ''} ${item.contextText || ''}`;
    const rejectedCondition = siteName === 'Jimoty'
      ? JIMOTY_REJECT_PATTERN.test(text)
      : JUNK_PATTERN.test(text);
    if (rejectedCondition || UNAVAILABLE_PATTERN.test(text)) {
      return false;
    }
    if (isDvd && !isCompleteDvdCandidate_(text, rowData.expectedVolume)) {
      return false;
    }
    if (!isAllowedSiteCondition_(siteName, item.condition, text, rowData.newOnly)) {
      return false;
    }
    // \u6307\u793A\u66F816\u30FB31: \u9001\u6599\u4E0D\u660E\u6642\u306F\u5546\u54C1\u4FA1\u683C\u3060\u3051\u3067\u4EEE\u5224\u5B9A\u3057\u3001
    // \u51FA\u529B\u5074\u3067\u300C\u9001\u6599\u8981\u78BA\u8A8D\u300D\u3092\u660E\u8A18\u3059\u308B\u3002
    const total = Number(item.price) + (item.shippingKnown ? Number(item.shipping || 0) : 0);
    return total <= Number(maxPrice);
  });
}

function isAllowedSiteCondition_(siteName, condition, text, newOnly) {
  const value = `${condition || ''} ${text || ''}`;
  if (newOnly) {
    return NEW_CONDITION_PATTERN.test(value) && !USED_CONDITION_PATTERN.test(value);
  }

  if (siteName === 'Amazon') {
    return NEW_CONDITION_PATTERN.test(value)
      || /\u4E2D\u53E4\u54C1?\s*[-\uFF0D]?\s*(\u307B\u307C\u65B0\u54C1|\u975E\u5E38\u306B\u826F\u3044|\u826F\u3044|\u53EF)|\u4E2D\u53E4\s*[-\uFF0D]?\s*(\u307B\u307C\u65B0\u54C1|\u975E\u5E38\u306B\u826F\u3044|\u826F\u3044|\u53EF)/i.test(value);
  }
  if (siteName === 'Yahoo' || siteName === 'Mercari') {
    return /\u65B0\u54C1|\u672A\u4F7F\u7528\u306B\u8FD1\u3044|\u76EE\u7ACB\u3063\u305F\u50B7\u3084\u6C5A\u308C\u306A\u3057|\u3084\u3084\u50B7\u3084\u6C5A\u308C\u3042\u308A|\u50B7\u3084\u6C5A\u308C\u3042\u308A/i.test(value);
  }
  if (siteName === 'Jimoty') {
    // \u6307\u793A\u66F819: \u30B8\u30E2\u30C6\u30A3\u306F\u30B8\u30E3\u30F3\u30AF\u7B49\u306E\u9664\u5916\u8A9E\u304C\u306A\u3051\u308C\u3070\u5019\u88DC\u5316\u3067\u304D\u308B\u3002
    // \u30B8\u30E3\u30F3\u30AF\u30FB\u8CA9\u58F2\u7D42\u4E86\u306E\u5224\u5B9A\u306F\u547C\u3073\u51FA\u3057\u5143\u3067\u5148\u306B\u5B9F\u65BD\u6E08\u307F\u3002
    return true;
  }
  return NEW_CONDITION_PATTERN.test(value) || USED_CONDITION_PATTERN.test(value);
}

function isCompleteDvdCandidate_(text, expectedVolume) {
  if (!expectedVolume) {
    return true;
  }
  const half = toHalfWidthNumber_(String(text || ''));
  return new RegExp(`\u5168\\s*${expectedVolume}\\s*\u5DFB|${expectedVolume}\\s*\u5DFB\\s*\u30BB\u30C3\u30C8|\u5168\u5DFB`).test(half);
}

function expectedVolumeCount_(text) {
  const half = toHalfWidthNumber_(String(text || ''));
  const match = half.match(/\u5168\s*([0-9]+)\s*\u5DFB|([0-9]+)\s*\u5DFB\s*\u30BB\u30C3\u30C8/);
  return Number((match && (match[1] || match[2])) || 0);
}

function appendResearchLinesToSheet_(sheet, rowNumber, columnNumber, resultLines) {
  const lines = Array.isArray(resultLines) ? resultLines.filter(Boolean) : String(resultLines || '').split('\n').filter(Boolean);
  if (!sheet || !columnNumber || !lines.length) {
    return 0;
  }

  const cell = sheet.getRange(rowNumber, columnNumber);
  const current = String(cell.getValue() || '');
  const currentUrls = new Set(extractUrls_(current).map(canonicalResearchUrl_).filter(Boolean));
  const currentComparableResults = current
    .split('\n')
    .map(parseResearchLineForComparison_)
    .filter((result) => result.url || result.price || result.conditionRank);
  const additions = [];

  lines.forEach((line) => {
    const normalizedLine = String(line);
    const url = canonicalResearchUrl_((normalizedLine.match(/https?:\/\/\S+/) || [''])[0]);
    if (!url || currentUrls.has(url)) {
      return;
    }
    const nextComparable = parseResearchLineForComparison_(normalizedLine);
    if (!isBetterResearchCandidate_(nextComparable, currentComparableResults)) {
      return;
    }
    currentUrls.add(url);
    currentComparableResults.push(nextComparable);
    additions.push(normalizedLine.replace(/https?:\/\/\S+/, url));
  });

  if (additions.length) {
    cell.setValue(current ? `${current}\n${additions.join('\n')}` : additions.join('\n')).setWrap(true);
  }
  return additions.length;
}

function appendUrlToMainSheet_(rowNumber, columnNumber, resultLines) {
  Logger.log(`\u5019\u88DCURL\u306E\u8FFD\u8A18\u5148\u306F${RESEARCH_AUTOMATION_CONFIG.sheetName}\u306E\u307F\u306B\u9650\u5B9A\u3057\u3066\u3044\u308B\u305F\u3081\u3001\u30E1\u30A4\u30F3\u30B7\u30FC\u30C8\u3078\u306E\u8FFD\u8A18\u306F\u30B9\u30AD\u30C3\u30D7\u3057\u307E\u3057\u305F\u3002`);
  return 0;
}

function appendUrlToMainSheet(rowNumber, columnNumber, resultText) {
  return appendUrlToMainSheet_(rowNumber, columnNumber, resultText);
}

function isDuplicateUrlInCell_(cellValue, url) {
  const target = canonicalResearchUrl_(url);
  return !!target && extractUrls_(cellValue).map(canonicalResearchUrl_).indexOf(target) >= 0;
}

function isDuplicateUrlInCell(cellValue, url) {
  return isDuplicateUrlInCell_(cellValue, url);
}

function extractUrls_(text) {
  return String(text || '').match(/https?:\/\/\S+/g) || [];
}

function parseResearchLineForComparison_(line) {
  const text = String(line || '');
  const priceParts = text.match(/([0-9\uFF10-\uFF19,\uFF0C]+)\s*\u5186/g) || [];
  const prices = priceParts
    .map((part) => Number(toHalfWidthNumber_(part).replace(/[^\d]/g, '')))
    .filter((price) => price > 0);
  const shippingKnown = /\u9001\u6599\u8981\u78BA\u8A8D/.test(text) ? false : prices.length > 1 || /\u9001\u6599\u7121\u6599/.test(text);
  const price = prices.length
    ? prices[0] + (shippingKnown && prices.length > 1 ? prices[1] : 0)
    : 0;
  return {
    url: canonicalResearchUrl_((text.match(/https?:\/\/\S+/) || [''])[0]),
    price,
    conditionRank: researchConditionRank_(text),
  };
}

function researchConditionRank_(text) {
  const value = String(text || '');
  if (/\u307B\u307C\u65B0\u54C1|\u672A\u4F7F\u7528\u306B\u8FD1\u3044/i.test(value)) {
    return 90;
  }
  if (/\u65B0\u54C1|\u672A\u4F7F\u7528\u54C1|\u672A\u4F7F\u7528|brand\s*new|new\b/i.test(value)) {
    return 100;
  }
  if (/\u975E\u5E38\u306B\u826F\u3044|\u76EE\u7ACB\u3063\u305F\u50B7\u3084\u6C5A\u308C\u306A\u3057/i.test(value)) {
    return 80;
  }
  if (/\u826F\u3044|\u3084\u3084\u50B7\u3084\u6C5A\u308C\u3042\u308A/i.test(value)) {
    return 60;
  }
  if (/\u53EF|\u50B7\u3084\u6C5A\u308C\u3042\u308A/i.test(value)) {
    return 40;
  }
  if (/\u4E2D\u53E4|\u4F7F\u7528\u6E08|used/i.test(value)) {
    return 30;
  }
  if (/\u72B6\u614B\u8981\u78BA\u8A8D|\u9001\u6599\u8981\u78BA\u8A8D/.test(value)) {
    return 20;
  }
  return 0;
}

function isBetterResearchCandidate_(candidate, existingResults) {
  const existing = (existingResults || []).filter((result) => result.price || result.conditionRank);
  if (!existing.length) {
    return true;
  }
  const bestPrice = Math.min(...existing.map((result) => result.price).filter((price) => price > 0));
  const bestConditionRank = Math.max(...existing.map((result) => result.conditionRank || 0));
  const cheaper = candidate.price > 0 && Number.isFinite(bestPrice) && candidate.price < bestPrice;
  const betterCondition = (candidate.conditionRank || 0) > bestConditionRank;
  return cheaper || betterCondition;
}

function formatResearchResult_(item, includeSiteName) {
  const price = `${Number(item.price).toLocaleString('ja-JP')}\u5186`;
  const shipping = item.shippingKnown
    ? (item.shipping ? `\uFF0B\u9001\u6599${Number(item.shipping).toLocaleString('ja-JP')}\u5186` : '\uFF0B\u9001\u6599\u7121\u6599')
    : '\uFF5C\u9001\u6599\u8981\u78BA\u8A8D';
  const condition = item.condition || '\u72B6\u614B\u8981\u78BA\u8A8D';
  const prefix = includeSiteName ? `${item.siteLabel || item.site}\uFF5C` : '';
  return `${prefix}${price}${shipping}\uFF5C${condition}\uFF5C${item.url}`;
}

function normalizeResearchProductUrl_(rawUrl, siteName) {
  let url = decodeResearchHtml_(String(rawUrl || '')).trim();
  if (!url || /^javascript:|^#/.test(url) || SEARCH_RESULT_NOISE_PATTERN.test(url)) {
    return '';
  }
  if (url.startsWith('//')) {
    url = `https:${url}`;
  }
  if (url.startsWith('/')) {
    const hosts = {
      Amazon: 'https://www.amazon.co.jp',
      Yahoo: 'https://page.auctions.yahoo.co.jp',
      Mercari: 'https://jp.mercari.com',
      Jimoty: 'https://jmty.jp',
      Rakuten: 'https://item.rakuten.co.jp',
      Surugaya: 'https://www.suruga-ya.jp',
      Offmall: 'https://netmall.hardoff.co.jp',
      SecondStreet: 'https://www.2ndstreet.jp',
      NetOff: 'https://www.netoff.co.jp',
    };
    url = `${hosts[siteName] || ''}${url}`;
  }

  let match;
  if (siteName === 'Amazon' && (match = url.match(/\/(?:dp|gp\/product)\/([A-Z0-9]{10})/i))) {
    return `https://www.amazon.co.jp/dp/${match[1].toUpperCase()}`;
  }
  if (siteName === 'Yahoo' && (match = url.match(/auctions\.yahoo\.co\.jp\/jp\/auction\/([A-Za-z0-9]+)/i))) {
    return `https://page.auctions.yahoo.co.jp/jp/auction/${match[1]}`;
  }
  if (siteName === 'Mercari' && (match = url.match(/jp\.mercari\.com\/item\/([A-Za-z0-9_-]+)/i))) {
    return `https://jp.mercari.com/item/${match[1]}`;
  }
  if (siteName === 'Jimoty' && /jmty\.jp\/[^"'\s]+\/article-[A-Za-z0-9_-]+/i.test(url)) {
    return url.split(/[?#]/)[0];
  }
  if (siteName === 'Rakuten' && /item\.rakuten\.co\.jp\/[^/\s"']+\/[^/\s"']+/i.test(url)) {
    return url.split(/[?#]/)[0].replace(/\/?$/, '/');
  }
  if (siteName === 'Surugaya' && (match = url.match(/suruga-ya\.jp\/product\/detail\/([A-Za-z0-9_-]+)/i))) {
    return `https://www.suruga-ya.jp/product/detail/${match[1]}`;
  }
  if (siteName === 'Offmall' && (match = url.match(/netmall\.hardoff\.co\.jp\/product\/([0-9]+)/i))) {
    return `https://netmall.hardoff.co.jp/product/${match[1]}/`;
  }
  if (siteName === 'SecondStreet' && (match = url.match(/2ndstreet\.jp\/goods\/detail\/goodsId\/([0-9]+)\/shopsId\/([0-9]+)/i))) {
    return `https://www.2ndstreet.jp/goods/detail/goodsId/${match[1]}/shopsId/${match[2]}`;
  }
  if (siteName === 'NetOff' && (match = url.match(/netoff\.co\.jp\/detail\/([0-9]+)/i))) {
    return `https://www.netoff.co.jp/detail/${match[1]}/`;
  }
  return '';
}

function canonicalResearchUrl_(url) {
  const siteNames = ['Amazon', 'Yahoo', 'Mercari', 'Jimoty', 'Rakuten', 'Surugaya', 'Offmall', 'SecondStreet', 'NetOff'];
  for (let index = 0; index < siteNames.length; index += 1) {
    const normalized = normalizeResearchProductUrl_(url, siteNames[index]);
    if (normalized) {
      return normalized;
    }
  }
  return '';
}

function priceNear_(html) {
  const raw = decodeResearchHtml_(String(html || ''));
  const text = stripResearchHtml_(html);
  const structuredPatterns = [
    /"(?:price|lowPrice)"\s*:\s*"?([0-9]{2,7}(?:\.[0-9]+)?)"?/i,
    /\bdata-(?:price|item-price)=["']([0-9]{2,7})["']/i,
  ];
  for (let index = 0; index < structuredPatterns.length; index += 1) {
    const match = raw.match(structuredPatterns[index]);
    if (match) {
      return Number(String(match[1]).replace(/,/g, '')) || 0;
    }
  }
  const textPatterns = [
    /(?:\u8CA9\u58F2\u4FA1\u683C|\u5546\u54C1\u4FA1\u683C|\u73FE\u5728\u4FA1\u683C|\u5373\u6C7A\u4FA1\u683C|\u4FA1\u683C)\s*[:\uFF1A]?\s*[\uFFE5\u00A5]?\s*([0-9]{1,3}(?:,[0-9]{3})+|[0-9]{2,7})\s*\u5186?/i,
    /[\uFFE5\u00A5]\s*([0-9]{1,3}(?:,[0-9]{3})+|[0-9]{2,7})(?:\s*\u5186)?/i,
  ];
  for (let index = 0; index < textPatterns.length; index += 1) {
    const match = text.match(textPatterns[index]);
    if (match) {
      return Number(String(match[1]).replace(/,/g, '')) || 0;
    }
  }
  return 0;
}

function shippingNear_(html) {
  const text = stripResearchHtml_(html);
  if (/\u9001\u6599\u7121\u6599|\u9001\u6599\s*(?:\u306F)?\s*0\s*\u5186|\u914D\u9001\u6599\u7121\u6599/.test(text)) {
    return { known: true, amount: 0 };
  }
  const match = text.match(/(?:\u9001\u6599|\u914D\u9001\u6599)[^\d]{0,15}([0-9]{1,3}(?:,[0-9]{3})+|[0-9]{2,6})\s*\u5186/);
  return match
    ? { known: true, amount: Number(match[1].replace(/,/g, '')) || 0 }
    : { known: false, amount: 0 };
}

function conditionNear_(html, siteName) {
  const text = stripResearchHtml_(html);
  const patterns = [
    /\u4E2D\u53E4\u54C1?\s*[-\uFF0D]?\s*(?:\u307B\u307C\u65B0\u54C1|\u975E\u5E38\u306B\u826F\u3044|\u826F\u3044|\u53EF)/,
    /\u672A\u4F7F\u7528\u306B\u8FD1\u3044|\u76EE\u7ACB\u3063\u305F\u50B7\u3084\u6C5A\u308C\u306A\u3057|\u3084\u3084\u50B7\u3084\u6C5A\u308C\u3042\u308A|\u50B7\u3084\u6C5A\u308C\u3042\u308A/,
    /\u65B0\u54C1\u672A\u4F7F\u7528|\u65B0\u54C1|\u672A\u958B\u5C01|\u4E2D\u53E4[ABC]?|\u72B6\u614B\u8981\u78BA\u8A8D/,
  ];
  for (let index = 0; index < patterns.length; index += 1) {
    const match = text.match(patterns[index]);
    if (match) {
      return match[0];
    }
  }
  return siteName === 'Jimoty' ? '\u72B6\u614B\u8981\u78BA\u8A8D' : '';
}

function matchesResearchKeyword_(title, keyword) {
  const normalizedTitle = normalizeResearchText_(title);
  const normalizedKeyword = normalizeResearchText_(keyword);
  const modelTokens = normalizedKeyword.match(/[a-z]{1,8}[a-z0-9-]*[0-9][a-z0-9-]*/g) || [];
  if (modelTokens.length) {
    return modelTokens.some((token) => normalizedTitle.indexOf(token) >= 0);
  }
  const tokens = normalizedKeyword.split(/\s+/).filter((token) => token.length >= 2 && !/^(\u5168|\u5168\u5DFB|\u30EC\u30F3\u30BF\u30EB)$/.test(token));
  return tokens.length ? tokens.filter((token) => normalizedTitle.indexOf(token) >= 0).length >= Math.ceil(tokens.length / 2) : false;
}

function normalizeResearchText_(value) {
  return toHalfWidthNumber_(String(value || ''))
    .toLowerCase()
    .replace(/[\uFF21-\uFF3A\uFF41-\uFF5A]/g, (character) => String.fromCharCode(character.charCodeAt(0) - 0xfee0))
    .replace(/[^a-z0-9\u4E00-\u9FA0\u3041-\u3093\u30A1-\u30F6\u30FC-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function stripResearchHtml_(html) {
  return decodeResearchHtml_(String(html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();
}

function decodeResearchHtml_(value) {
  return String(value || '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ');
}

function writeResearchCheck_(rowData, type, message, manualUrl) {
  const spreadsheet = getTargetSpreadsheet_();
  const reviewSheet = getOrCreateSheet_(spreadsheet, AMAZON_ORDER_IMPORTER_CONFIG.reviewSheetName);
  const productName = rowData.productName || '';
  reviewSheet.appendRow([
    new Date(),
    '',
    '',
    JSON.stringify({ maxPrice: rowData.maxPrice, sku: rowData.sku }),
    '',
    message,
    type,
    rowData.orderNumber || '',
    productName,
    rowData.keywordLines.join('\n'),
    manualUrl || '',
    rowData.newOnly ? 'SKU\u306Bmuza\u3092\u542B\u3080\u305F\u3081\u65B0\u54C1\u9650\u5B9A' : '',
  ]);
}
