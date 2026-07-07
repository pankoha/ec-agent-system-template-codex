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
    .addItem('Gmail\u53D6\u8FBC\u8A3A\u65AD', 'debugAmazonOrderImportStatus')
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
      '\u697D\u5929\u5E02\u5834',
      '\u305D\u306E\u4ED6\u30B5\u30A4\u30C8',
    ]);
    orderSheet.setFrozenRows(1);
    orderSheet.getRange('A:K').setWrap(true);
    orderSheet.setColumnWidths(1, 1, 120);
    orderSheet.setColumnWidths(2, 1, 520);
    orderSheet.setColumnWidths(3, 1, 110);
    orderSheet.setColumnWidths(4, 1, 260);
    orderSheet.setColumnWidths(5, 1, 120);
    orderSheet.setColumnWidths(6, 6, 230);
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

function debugAmazonOrderImportStatus() {
  const spreadsheet = getTargetSpreadsheet_();
  const orderSheet = spreadsheet.getSheetByName(AMAZON_ORDER_IMPORTER_CONFIG.orderSheetName);
  const reviewSheet = spreadsheet.getSheetByName(AMAZON_ORDER_IMPORTER_CONFIG.reviewSheetName);
  const query = buildAmazonOrderGmailQuery_();
  const threads = GmailApp.search(query, 0, 20);
  let messageCount = 0;
  let targetMessageCount = 0;
  let parsedOkCount = 0;
  let duplicateOrDeletedCount = 0;
  const sampleOrderNumbers = [];
  const existingOrders = orderSheet ? loadExistingOrders_(orderSheet) : { orderNumbers: new Set(), deletedOrderNumbers: new Set() };

  threads.forEach((thread) => {
    thread.getMessages().forEach((message) => {
      messageCount += 1;
      if (!isTargetMessage_(message)) {
        return;
      }
      targetMessageCount += 1;
      const result = parseAmazonOrderEmail_(getMessageText_(message));
      if (!result.ok) {
        return;
      }
      parsedOkCount += 1;
      const orderNumber = result.fields.orderNumber;
      if (orderNumber && sampleOrderNumbers.length < 5) {
        sampleOrderNumbers.push(orderNumber);
      }
      if (
        existingOrders.orderNumbers.has(orderNumber)
        || existingOrders.deletedOrderNumbers.has(orderNumber)
      ) {
        duplicateOrDeletedCount += 1;
      }
    });
  });

  const report = [
    'Amazon\u6CE8\u6587\u30E1\u30FC\u30EB\u53D6\u8FBC \u8A3A\u65AD',
    `Spreadsheet ID: ${spreadsheet.getId()}`,
    `\u6CE8\u6587\u30B7\u30FC\u30C8: ${orderSheet ? `\u3042\u308A / \u6700\u7D42\u884C ${orderSheet.getLastRow()}` : '\u306A\u3057'}`,
    `\u78BA\u8A8D\u7528\u30B7\u30FC\u30C8: ${reviewSheet ? `\u3042\u308A / \u6700\u7D42\u884C ${reviewSheet.getLastRow()}` : '\u306A\u3057'}`,
    `Gmail\u691C\u7D22\u30AF\u30A8\u30EA: ${query}`,
    `\u691C\u7D22\u30B9\u30EC\u30C3\u30C9\u6570: ${threads.length}`,
    `\u691C\u7D22\u30E1\u30C3\u30BB\u30FC\u30B8\u6570: ${messageCount}`,
    `\u5BFE\u8C61\u30E1\u30C3\u30BB\u30FC\u30B8\u6570: ${targetMessageCount}`,
    `\u89E3\u6790\u6210\u529F\u6570: ${parsedOkCount}`,
    `\u65E2\u5B58\u307E\u305F\u306F\u524A\u9664\u6E08\u307F\u3067\u8FFD\u52A0\u5BFE\u8C61\u5916: ${duplicateOrDeletedCount}`,
    `\u30B5\u30F3\u30D7\u30EB\u6CE8\u6587\u756A\u53F7: ${sampleOrderNumbers.join(', ') || '\u306A\u3057'}`,
  ];
  Logger.log(report.join('\n'));
  return report.join('\n');
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

  return cleanSearchWord_(buildNonDvdSearchWords_(productName));
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

  if (!isCompleteDvdSetProduct_(productName, volume)) {
    const broadTitle = cleanSingleDvdTitle_(title);
    const keywordTitle = broadTitle || title;
    return uniqueLines_([
      keywordTitle,
      `${keywordTitle} \u30EC\u30F3\u30BF\u30EB`,
      `${keywordTitle} DVD`,
      `${keywordTitle} \u4E2D\u53E4`,
      broadTitle && broadTitle !== title ? title : '',
    ]).join('\n');
  }

  return [
    `${title} \u5168`,
    volume ? `${title} ${volume}` : `${title} \u5168\u5DFB`,
    `${title} \u30EC\u30F3\u30BF\u30EB`,
  ].join('\n');
}

function isCompleteDvdSetProduct_(productName, volume) {
  return Boolean(volume) || /\u5168\u5DFB\u30BB\u30C3\u30C8|\u5168\s*[0-9\uFF10-\uFF19]+\s*\u5DFB|\u5168\u5DFB|\u30B3\u30F3\u30D7\u30EA\u30FC\u30C8|complete\s*(?:box|set)?/i.test(String(productName || ''));
}

function cleanSingleDvdTitle_(title) {
  return String(title || '')
    .replace(/\[[^\]]+\]/g, ' ')
    .replace(/[\uFF08(][^)\uFF09]*(?:\u5E74|\u7248|\u5B57\u5E55|\u5439\u66FF|\u65E5\u672C\u8A9E|\u82F1\u8A9E|20[0-9]{2}|19[0-9]{2})[^)\uFF09]*[)\uFF09]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function uniqueLines_(lines) {
  const seen = {};
  return (lines || [])
    .map((line) => String(line || '').trim())
    .filter((line) => {
      if (!line || seen[line]) {
        return false;
      }
      seen[line] = true;
      return true;
    });
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

function buildNonDvdSearchWords_(productName) {
  const modelSearchWords = extractModelSearchWords_(productName);
  if (modelSearchWords.length) {
    return uniqueLines_(modelSearchWords.concat(buildProductCategorySearchWords_(productName))).join('\n');
  }

  return fallbackSearchWord_(productName);
}

function extractModelNumber_(productName) {
  return extractModelSearchWords_(productName)[0] || '';
}

function extractModelSearchWords_(productName) {
  const normalized = productName
    .replace(/[\uFF21-\uFF3A\uFF41-\uFF5A\uFF10-\uFF19]/g, (char) => String.fromCharCode(char.charCodeAt(0) - 0xfee0))
    .replace(/[\u3010\u3011\[\]]/g, ' ');

  const candidates = normalized.match(/\b[A-Z]{1,10}[A-Z0-9]*[0-9][A-Z0-9]*(?:\/[A-Z0-9]+)?\b|\b[A-Z]{1,10}[A-Z0-9]*(?:-[A-Z0-9]+(?:\([A-Z0-9]+\))?)+(?:-[A-Z0-9]+)*\b/gi) || [];
  const words = [];
  candidates
    .map((candidate) => cleanModelNumber_(candidate))
    .filter((candidate) => /[0-9]/.test(candidate))
    .filter((candidate) => isUsableModelNumber_(candidate))
    .forEach((candidate) => {
      words.push(candidate);
      buildModelNumberVariants_(candidate).forEach((variant) => words.push(variant));
    });

  return uniqueLines_(words);
}

function isUsableModelNumber_(modelNumber) {
  const value = String(modelNumber || '');
  if (/^(?:HDD|SSD|DVD|BD|CD)[0-9]*$/i.test(value)) {
    return false;
  }
  return value.length >= 5 || /^[A-Z]{1,8}[0-9]{1,4}[A-Z0-9]*$/i.test(value);
}

function buildModelNumberVariants_(modelNumber) {
  const variants = [];
  const value = String(modelNumber || '').toUpperCase();
  let parenthesizedBase = '';
  if (value.indexOf('/') >= 0) {
    variants.push(value.replace(/\/[A-Z0-9]+$/i, ''));
  }
  if (/\([A-Z0-9]+\)-[A-Z0-9]+$/i.test(value)) {
    parenthesizedBase = value.replace(/(\([A-Z0-9]+\))-[A-Z0-9]+$/i, '$1');
    variants.push(parenthesizedBase);
  }
  if (/\([A-Z0-9]+\)/i.test(value)) {
    variants.push((parenthesizedBase || value).replace(/\([A-Z0-9]+\)/gi, ''));
  }
  return variants.filter((variant) => variant && variant !== value && variant.length >= 5);
}

function buildProductCategorySearchWords_(productName) {
  const normalized = String(productName || '')
    .replace(/[\uFF21-\uFF3A\uFF41-\uFF5A\uFF10-\uFF19]/g, (char) => String.fromCharCode(char.charCodeAt(0) - 0xfee0))
    .replace(/\s+/g, ' ')
    .trim();
  const words = [];
  const brandMatch = normalized.match(/^([A-Za-z][A-Za-z0-9]+|[\u4E00-\u9FA0\u3041-\u3093\u30A1-\u30F6\u30FC]{2,})\s+/);
  const bracketCategory = normalized.match(/([^\s\u3010\u3011\[\]\uFF08\uFF09()]+)\s*\[([^\]]*(?:HDD|SSD|\u30CF\u30FC\u30C9\u30C7\u30A3\u30B9\u30AF|\u5BB6\u96FB|\u96FB\u5316|\u4E7E\u71E5\u6A5F|\u6D17\u6FEF\u6A5F|\u51B7\u8535\u5EAB|\u708A\u98EF\u5668|\u96FB\u5B50\u30EC\u30F3\u30B8|\u6383\u9664\u6A5F|\u30A8\u30A2\u30B3\u30F3|\u30C6\u30EC\u30D3|\u30EC\u30B3\u30FC\u30C0\u30FC|\u30D7\u30EA\u30F3\u30BF\u30FC|\u30AB\u30E1\u30E9)[^\]]*)\]/i);
  if (bracketCategory) {
    words.push(`${brandMatch ? brandMatch[1] : bracketCategory[1]} [${bracketCategory[2]}]`);
  }
  const categoryMatch = normalized.match(/(\u30AC\u30B9\u8863\u985E\u4E7E\u71E5\u6A5F|\u8863\u985E\u4E7E\u71E5\u6A5F|\u4E7E\u71E5\u6A5F|\u6D17\u6FEF\u6A5F|\u51B7\u8535\u5EAB|\u708A\u98EF\u5668|\u96FB\u5B50\u30EC\u30F3\u30B8|\u6383\u9664\u6A5F|\u30A8\u30A2\u30B3\u30F3|\u30D7\u30EA\u30F3\u30BF\u30FC|\u30AB\u30E1\u30E9|HDD|SSD|\u30CF\u30FC\u30C9\u30C7\u30A3\u30B9\u30AF)/i);
  if (brandMatch && categoryMatch && !bracketCategory) {
    words.push(`${brandMatch[1]} ${categoryMatch[1]}`);
  }
  return uniqueLines_(words);
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
  value = value.replace(/[\uFF08\uFF09]/g, (char) => (char === '\uFF08' ? '(' : ')'));
  if (!/\([A-Z0-9]+\)/i.test(value)) {
    value = value.replace(COLOR_SUFFIX_PATTERN, '');
  }
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

function deleteKnownDeletedOrderRows_(spreadsheet, orderSheet) {
  const deletedOrderNumbers = loadDeletedOrderNumbers_(spreadsheet);
  if (!deletedOrderNumbers.size || orderSheet.getLastRow() < 2) {
    updateKnownOrderSnapshot_(orderSheet);
    return 0;
  }

  const rowsToDelete = getOrderNumberRecordsFromOrderSheet_(orderSheet)
    .filter((record) => deletedOrderNumbers.has(record.orderNumber))
    .map((record) => record.rowNumber)
    .sort((left, right) => right - left);
  Array.from(new Set(rowsToDelete)).forEach((rowNumber) => orderSheet.deleteRow(rowNumber));
  updateKnownOrderSnapshot_(orderSheet);
  return rowsToDelete.length;
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
  return deleteKnownDeletedOrderRows_(spreadsheet, orderSheet);
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
