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
  spreadsheetTitle: '★注文確定商品リサーチ表★',
  orderSheetName: '注文確定商品リサーチ表',
  researchSheetName: 'リサーチ管理表',
  reviewSheetName: '確認用',
  deletedOrderSheetName: '削除済み注文',
  snapshotSheetName: '注文番号スナップショット',
  processedLabelName: 'Amazon注文確定_処理済み',
  sender: 'seller-notification@amazon.co.jp',
  subjectKeyword: '注文確定',
  threadLimitPerRun: 100,
  gmailSearchWindow: 'newer_than:30d',
  protectedDeleteStartRow: 132,
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
    throw new Error('対象スプレッドシートを取得できません。スプレッドシートからApps Scriptを開いて初期設定を実行してください。');
  }
  return SpreadsheetApp.openById(spreadsheetId);
}

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Amazon注文メール')
    .addItem('Amazon注文メールを取り込む', 'importAmazonOrderEmails')
    .addSeparator()
    .addItem('初期セットアップ', 'setupAmazonOrderImporter')
    .addItem('初期設定+30分自動実行', 'setupAmazonOrderImporterAndTrigger')
    .addSeparator()
    .addItem('出荷予定日で昇順ソート', 'sortAmazonResearchSheetAscending')
    .addItem('2026年6月30日以降だけ表示', 'showShipDatesFromJune2026')
    .addItem('132行目以降を削除済みにして削除', 'deleteRowsFrom132AndRememberOrders')
    .addItem('既存行の注文情報をGmailから再作成', 'refreshExistingOrderDetailsFromGmail')
    .addItem('確認用からGmail再処理', 'reprocessReviewRowsFromGmail')
    .addSeparator()
    .addItem('リサーチ管理表を同期', 'syncResearchManagementSheet')
    .addItem('リサーチを手動実行', 'researchListedItemsHourly')
    .addItem('1時間リサーチトリガーを設定', 'setupHourlyTrigger')
    .addItem('注文番号連動トリガーを設定', 'setupOnChangeTrigger')
    .addToUi();
}

function setupAmazonOrderImporter() {
  const spreadsheet = getTargetSpreadsheet_();
  spreadsheet.rename(AMAZON_ORDER_IMPORTER_CONFIG.spreadsheetTitle);

  const orderSheet = getOrCreateSheet_(spreadsheet, AMAZON_ORDER_IMPORTER_CONFIG.orderSheetName);
  if (isSheetBlank_(orderSheet)) {
    ensureHeader_(orderSheet, [
      '出荷期限日',
      '注文情報',
      '売上金',
      '検索ワード',
      'リサーチ状況',
      'Amazon',
      'ヤフオク',
      'メルカリ',
      'ジモティ',
      'その他サイト',
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
      '処理日時',
      'メール受信日時',
      'メール件名',
      '取得できた情報',
      '取得できなかった情報',
      'エラー内容',
      '種別',
      '注文番号',
      '商品名',
      '検索ワード',
      '手動確認用URL',
      'メモ',
    ]);
    reviewSheet.setFrozenRows(1);
    reviewSheet.getRange('A:L').setWrap(true);
    reviewSheet.setColumnWidths(1, 3, 160);
    reviewSheet.setColumnWidths(4, 9, 260);
  }

  const deletedOrderSheet = getOrCreateSheet_(spreadsheet, AMAZON_ORDER_IMPORTER_CONFIG.deletedOrderSheetName);
  if (isSheetBlank_(deletedOrderSheet)) {
    ensureHeader_(deletedOrderSheet, [
      '記録日時',
      '注文番号',
      '理由',
      '元行',
      '注文情報',
    ]);
    deletedOrderSheet.setFrozenRows(1);
    deletedOrderSheet.getRange('A:E').setWrap(true);
    deletedOrderSheet.setColumnWidths(1, 1, 160);
    deletedOrderSheet.setColumnWidths(2, 1, 180);
    deletedOrderSheet.setColumnWidths(3, 3, 260);
  }

  const snapshotSheet = getOrCreateSheet_(spreadsheet, AMAZON_ORDER_IMPORTER_CONFIG.snapshotSheetName);
  if (isSheetBlank_(snapshotSheet)) {
    ensureHeader_(snapshotSheet, ['注文番号']);
    if (typeof snapshotSheet.hideSheet === 'function') {
      snapshotSheet.hideSheet();
    }
  }

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
  return deleteRowsFromProtectedStartAndRememberOrders_(spreadsheet, orderSheet);
}

function repairRows2240To2440() {
  repairOrderRows_(2240, 2440);
}

function reprocessReviewRowsFromGmail() {
  const spreadsheet = getTargetSpreadsheet_();
  const orderSheet = getOrCreateSheet_(spreadsheet, AMAZON_ORDER_IMPORTER_CONFIG.orderSheetName);
  const reviewSheet = getOrCreateSheet_(spreadsheet, AMAZON_ORDER_IMPORTER_CONFIG.reviewSheetName);
  recordDeletedOrdersSinceLastSnapshot_(spreadsheet, orderSheet, '確認用再処理前の削除検知');
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
    const startRow = orderSheet.getLastRow() + 1;
    orderSheet.getRange(startRow, 1, rowsToAppend.length, 4).setValues(rowsToAppend);
    orderSheet.getRange(startRow, 1, rowsToAppend.length, 4).setWrap(true);
  }
  updateKnownOrderSnapshot_(orderSheet);

  Logger.log(`確認用再処理: ${rowsToAppend.length}件 / Gmail検出: ${foundOrderCount}注文 / 重複: ${skippedOrderCount}件 / 確認: ${checkedOrderCount}注文`);
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
  Logger.log(`指定行の注文情報修正: ${updatedRowCount}件 / Gmail検出: ${foundOrderCount}注文 / Gmail確認: ${checkedOrderCount}注文 / 対象行: ${firstRow}-${finalRow}`);
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
  Logger.log(`既存行の売上金更新: ${updatedRowCount}件 / 売上金検出: ${foundSalesAmountCount}注文 / Gmail確認: ${checkedOrderCount}注文`);
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
  recordDeletedOrdersSinceLastSnapshot_(spreadsheet, orderSheet, 'Gmail取込前の削除検知');
  const existingOrders = loadExistingOrders_(orderSheet);
  const rowsToAppend = [];
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
      shouldMarkProcessed = true;
    });

    if (shouldMarkProcessed) {
      thread.addLabel(processedLabel);
    }
  });

  if (rowsToAppend.length > 0) {
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

  Logger.log(`追加: ${rowsToAppend.length}件 / 確認用: ${reviewRows.length}件`);
}

function buildAmazonOrderGmailQuery_() {
  return [
    `from:${AMAZON_ORDER_IMPORTER_CONFIG.sender}`,
    AMAZON_ORDER_IMPORTER_CONFIG.gmailSearchWindow || '',
    `{subject:"${AMAZON_ORDER_IMPORTER_CONFIG.subjectKeyword}" "${AMAZON_ORDER_IMPORTER_CONFIG.subjectKeyword}"}`,
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
        productName: extractProductName_(block),
        sku: extractSku_(block),
        salesAmount: extractSalesAmount_(block),
        searchWord: '',
      };

      item.searchWord = buildSearchWord_(item.productName);
      if (!item.sku) {
        item.sku = '取得不可';
      }
      if (!item.salesAmount) {
        item.salesAmount = '取得不可';
      }

      return item;
    })
    .filter((item) => item.shipDate && item.productName && item.searchWord));

  const fields = {
    shipDate: items[0] ? items[0].shipDate : '',
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
      error: `必須項目を取得できませんでした: ${missing.join(', ')}`,
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
  if (sku && sku !== '取得不可') {
    return `${sku}|${item.salesAmount}`;
  }

  return `${cleanDisplayProductName_(item.productName).replace(/\[[^\]]+\]/g, '')}|${item.salesAmount}`;
}

function normalizeSku_(value) {
  return String(value || '').replace(/^[\s*\uff0a\u30fb-]+/, '').replace(/\s+/g, ' ').trim();
}

function splitProductBlocks_(text) {
  const matches = [...String(text || '').matchAll(/(?:^|\n)(出\s*荷\s*予\s*定\s*日[\s\S]*?)(?=\n出\s*荷\s*予\s*定\s*日|$)/g)];
  return matches
    .map((match) => match[1])
    .filter((block) => /商\s*品\s*(?:名)?\s*[:：]/.test(block));
}

function extractShipDate_(text) {
  const patterns = [
    /出\s*荷\s*予\s*定\s*日\s*[:：]?\s*([0-9]{4}[\/.\-年]\s*[0-9]{1,2}[\/.\-月]\s*[0-9]{1,2}日?)/,
    /出\s*荷\s*予\s*定\s*[:：]?\s*([0-9]{4}[\/.\-年]\s*[0-9]{1,2}[\/.\-月]\s*[0-9]{1,2}日?)/,
    /発\s*送\s*予\s*定\s*日\s*[:：]?\s*([0-9]{4}[\/.\-年]\s*[0-9]{1,2}[\/.\-月]\s*[0-9]{1,2}日?)/,
  ];
  return normalizeDate_(firstMatch_(text, patterns));
}

function extractOrderNumber_(text) {
  return firstMatch_(text, [/注文番号\s*[:：]?\s*([0-9]{3}-[0-9]{7}-[0-9]{7})/, /\b([0-9]{3}-[0-9]{7}-[0-9]{7})\b/]);
}

function extractProductName_(text) {
  return firstMatch_(text, [
    /商\s*品\s*名\s*[:：]\s*([\s\S]+?)(?=\n|コンディション\s*[:：]|S\s*K\s*U\s*[:：]|数量\s*[:：]|価格\s*[:：]|税金\s*[:：]|Amazon手数料\s*[:：]|売\s*上\s*金\s*[:：]|$)/,
    /商\s*品\s*[:：]\s*([\s\S]+?)(?=\n|コンディション\s*[:：]|S\s*K\s*U\s*[:：]|数量\s*[:：]|価格\s*[:：]|税金\s*[:：]|Amazon手数料\s*[:：]|売\s*上\s*金\s*[:：]|$)/,
    /タイトル\s*[:：]\s*(.+)/,
  ]).replace(/\s+/g, ' ').trim();
}

function extractSku_(text) {
  return normalizeSku_(firstMatch_(text, [/\bS\s*K\s*U\s*[:：]?\s*([^\n]+)/i, /出品者\s*S\s*K\s*U\s*[:：]?\s*([^\n]+)/i, /商品\s*S\s*K\s*U\s*[:：]?\s*([^\n]+)/i]));
}

function extractSalesAmount_(text) {
  const normalizedText = String(text || '');
  const labeledSalesAmount = extractLabeledSalesAmount_(normalizedText);
  if (labeledSalesAmount) {
    return labeledSalesAmount;
  }

  const matches = [...normalizedText.matchAll(/(?:[￥¥]\s*)?([0-9]{1,3}(?:,[0-9]{3})+|[0-9]+)\s*円|[￥¥]\s*([0-9]{1,3}(?:,[0-9]{3})+|[0-9]+)/g)];
  if (matches.length === 0) {
    return '';
  }

  const lastMatch = matches[matches.length - 1];
  return `${lastMatch[1] || lastMatch[2]}円`;
}

function extractLabeledSalesAmount_(text) {
  const labeledSalesMatches = [...String(text || '').matchAll(/売\s*上\s*金\s*[:：]?\s*(?:[￥¥]\s*)?([0-9]{1,3}(?:,[0-9]{3})+|[0-9]+)\s*円?/g)];
  if (labeledSalesMatches.length === 0) {
    return '';
  }

  return `${labeledSalesMatches[labeledSalesMatches.length - 1][1]}円`;
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
    .map((line) => line.replace(/^[\s*＊・-]+/, '').trim())
    .join('\n')
    .trim();
}

function isDvdLikeProduct_(productName) {
  if (/レコーダー|プレーヤー|プレイヤー|ディスクレコーダー|ディスクプレーヤー|ディスクプレイヤー/i.test(productName)) {
    return false;
  }

  return /レンタル落ち|全\s*[0-9０-９]+\s*巻|全巻セット|DVD|Blu-ray|ブルーレイ|マーケットプレイスDVDセット商品/i.test(productName);
}

function buildDvdSearchWords_(productName) {
  const volume = toHalfWidthNumber_((productName.match(/全\s*([0-9０-９]+)\s*巻/) || [])[1] || '');
  const title = cleanDvdTitle_(productName);
  if (!title) {
    return '';
  }

  return [
    `${title} 全`,
    volume ? `${title} ${volume}` : `${title} 全巻`,
    `${title} レンタル`,
  ].join('\n');
}

function cleanDvdTitle_(productName) {
  let title = productName;
  title = title.replace(/[【】]/g, ' ');
  title = title.replace(/\[[^\]]*(レンタル落ち|マーケットプレイスDVDセット商品|DVD|Blu-ray|ブルーレイ|中古|セット商品)[^\]]*\]/gi, ' ');
  title = title.replace(/レンタル落ち/gi, ' ');
  title = title.replace(/マーケットプレイスDVDセット商品/gi, ' ');
  title = title.replace(/Blu-ray|ブルーレイ|DVD/gi, ' ');
  title = title.replace(/中古|セット商品/gi, ' ');
  title = title.replace(/全\s*[0-9０-９]+\s*巻\s*セット?/g, ' ');
  title = title.replace(/全巻セット/g, ' ');
  title = title.replace(/[（(][^)）]*[)）]/g, ' ');
  title = title.split(/\s*\+\s*/)[0];
  return title.replace(/\s+/g, ' ').trim();
}

function extractModelNumber_(productName) {
  const normalized = productName
    .replace(/[Ａ-Ｚａ-ｚ０-９]/g, (char) => String.fromCharCode(char.charCodeAt(0) - 0xfee0))
    .replace(/[【】\[\]]/g, ' ');

  const candidates = normalized.match(/\b[A-Z]{1,8}[A-Z0-9]*-[A-Z0-9-]+(?:\([A-Z0-9]+\))?\b|\b[A-Z]{1,6}[0-9]{1,5}[A-Z]?\b/gi) || [];
  const scored = candidates
    .map((candidate) => cleanModelNumber_(candidate))
    .filter((candidate) => /[0-9]/.test(candidate))
    .sort((a, b) => b.length - a.length);

  return scored[0] || '';
}

function fallbackSearchWord_(productName) {
  return String(productName || '')
    .replace(/[【】\[\]]/g, ' ')
    .replace(/[（(][^)）]*[)）]/g, ' ')
    .replace(/^[\s*＊・-]+/, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80);
}

function cleanModelNumber_(modelNumber) {
  let value = modelNumber.toUpperCase();
  value = value.replace(/[（(][A-Z0-9]+[)）]$/i, '');
  value = value.replace(COLOR_SUFFIX_PATTERN, '');
  return value;
}

function buildOrderSummary_(fields) {
  const rows = [`注文番号：${fields.orderNumber}`];
  fields.items.forEach((item, index) => {
    if (fields.items.length > 1) {
      rows.push(`【${index + 1}】`);
    }
    rows.push(
      `商品名：${cleanDisplayProductName_(item.productName)}`,
      `SKU：${item.sku}`,
    );
  });
  return rows.join('\n');
}

function buildOrderRow_(fields) {
  const amounts = fields.items
    .map((item) => salesAmountNumber_(item.salesAmount))
    .filter((amount) => amount > 0);
  return [
    fields.shipDate,
    buildOrderSummary_(fields),
    amounts.reduce((total, amount) => total + amount, 0) || '',
    buildSearchWords_(fields),
  ];
}

function salesAmountNumber_(value) {
  return Number(String(value || '').replace(/[^\d]/g, '')) || 0;
}

function buildSearchWords_(fields) {
  if (fields.items.length === 1) {
    return fields.items[0].searchWord;
  }

  return fields.items
    .map((item, index) => `【${index + 1}】\n${item.searchWord}`)
    .join('\n');
}

function cleanDisplayProductName_(productName) {
  return String(productName || '').replace(/^[\s*＊・-]+/, '').trim();
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
  const labeled = text.match(/出荷(?:期限|予定)日\s*[:：]?\s*([0-9]{4}[\/.\-年]\s*[0-9]{1,2}[\/.\-月]\s*[0-9]{1,2}日?)/);
  const fallback = text.match(/([0-9]{4}[\/.\-年]\s*[0-9]{1,2}[\/.\-月]\s*[0-9]{1,2}日?)/);
  const normalized = normalizeDate_((labeled && labeled[1]) || (fallback && fallback[1]) || '');
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
    'メール取込',
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
  return text.indexOf(AMAZON_ORDER_IMPORTER_CONFIG.subjectKeyword) !== -1
    && !!extractOrderNumber_(text);
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
      reason || '手動削除検知',
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
  const recorded = appendDeletedOrderRecords_(spreadsheet, deletedRecords, reason || '手動削除検知');
  updateKnownOrderSnapshot_(orderSheet);
  return recorded;
}

function deleteRowsFromProtectedStartAndRememberOrders_(spreadsheet, orderSheet) {
  const startRow = AMAZON_ORDER_IMPORTER_CONFIG.protectedDeleteStartRow || 132;
  const lastRow = orderSheet.getLastRow();
  if (lastRow < startRow) {
    updateKnownOrderSnapshot_(orderSheet);
    return 0;
  }

  const records = getOrderNumberRecordsFromOrderSheet_(orderSheet, startRow, lastRow);
  appendDeletedOrderRecords_(spreadsheet, records, `${startRow}行目以降の削除指定`);
  orderSheet.deleteRows(startRow, lastRow - startRow + 1);
  updateKnownOrderSnapshot_(orderSheet);
  if (typeof syncResearchManagementByOrderNumber_ === 'function'
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
  return normalizeEmailText_(`${message.getPlainBody() || ''}\n${stripHtml_(message.getBody() || '')}`);
}

function normalizeDate_(value) {
  if (!value) {
    return '';
  }

  const match = value.replace(/\s+/g, '').match(/([0-9]{4})[\/.\-年]([0-9]{1,2})[\/.\-月]([0-9]{1,2})/);
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
  return String(value || '').replace(/[０-９]/g, (char) => String.fromCharCode(char.charCodeAt(0) - 0xfee0));
}

function testKeywordGeneration() {
  const cases = [
    ['【工事不要】 CORONA(コロナ) ウインドエアコン 冷房専用タイプ CW-16A(WS)', 'CW-16A'],
    ['Panasonic パナソニック ブルーレイディスクレコーダー DMR-2W101-K', 'DMR-2W101'],
    ['SHARP シャープ 加湿空気清浄機 KI-PX75-W', 'KI-PX75'],
    ['ZOOM ズーム マルチトラックレコーダー 8トラック同時録音 24トラック同時再生 R24', 'R24'],
    ['【境界線上のホライゾン + II [レンタル落ち] 全12巻セット [マーケットプレイスDVDセット商品]】', '境界線上のホライゾン 全\n境界線上のホライゾン 12\n境界線上のホライゾン レンタル'],
  ];

  cases.forEach(([input, expected]) => {
    const actual = buildSearchWord_(input);
    if (actual !== expected) {
      throw new Error(`Expected "${expected}", but got "${actual}" for "${input}"`);
    }
  });
}

/**
 * Continuous sourcing research for rows displayed in 【リサーチ管理表】.
 *
 * Invariants:
 * - Every visible row remains eligible on every hourly run, regardless of status.
 * - Existing URLs are never deleted or overwritten.
 * - Only canonical, new, non-duplicate product URLs are appended.
 * - A candidate must be within the C-column sales amount.
 * - SKU containing "muza" accepts new items only.
 */

const RESEARCH_AUTOMATION_CONFIG = {
  sheetName: 'リサーチ管理表',
  reviewSheetName: '確認用',
  maxRuntimeMs: 270000,
  maxRowsPerRun: 10000,
  requestTimeoutFallback: 30000,
  userAgent: 'Mozilla/5.0 (compatible; GoogleAppsScript sourcing-research/1.0)',
};

const RESEARCH_HEADERS = [
  '出荷期限日',
  '注文情報',
  '売上金',
  '検索ワード',
  'リサーチ状況',
  'Amazon',
  'ヤフオク',
  'メルカリ',
  'ジモティ',
  'その他サイト',
  '最終リサーチ日時',
  '確認メモ',
];

const RESEARCH_COLUMN_ALIASES = {
  shipDate: ['出荷期限日', '出荷予定日'],
  orderInfo: ['注文情報'],
  orderNumber: ['注文番号'],
  maxPrice: ['売上金'],
  keyword: ['検索ワード'],
  status: ['リサーチ状況'],
  Amazon: ['Amazon'],
  Yahoo: ['ヤフオク'],
  Mercari: ['メルカリ'],
  Jimoty: ['ジモティ'],
  Other: ['その他サイト'],
  lastResearchedAt: ['最終リサーチ日時', '最終確認日時'],
  memo: ['確認メモ', 'メモ'],
};

const RESEARCH_STATUS = {
  pending: '未リサーチ',
  running: 'リサーチ中',
  found: '候補あり',
  empty: '候補なし',
  review: '要確認',
  error: 'エラー',
};

const JUNK_PATTERN = /ジャンク|ジャンク品|動作未確認|動作未チェック|不動品?|通電不可|通電未確認|部品取り|破損(?:品|あり)?|壊れています|使えません|訳あり|難あり|現状品|修理前提|再生不可|読み込み不可|読込不可|視聴不可|欠品(?:あり)?|ディスク欠品|巻数不足|巻抜け|一部欠品/i;
const JIMOTY_REJECT_PATTERN = /ジャンク|動作未確認|不動品?|通電不可|部品取り|破損|壊れています|使えません|修理前提|再生不可|読み込み不可|読込不可|視聴不可|欠品(?:あり)?|ディスク欠品|巻数不足|巻抜け|一部欠品/i;
const UNAVAILABLE_PATTERN = /売り切れ|売切|SOLD\s*OUT|\bSOLD\b|販売終了|掲載終了|オークション.{0,8}終了|この商品は削除|ページが見つかりません|404\s*Not\s*Found/i;
const NEW_CONDITION_PATTERN = /新品|新品未使用|未使用品|未開封|brand\s*new|new\b/i;
const USED_CONDITION_PATTERN = /中古|レンタル落ち|レンタルアップ|使用済|used\b/i;
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
    label: 'ヤフオク',
    column: 7,
    resultHost: /page\.auctions\.yahoo\.co\.jp\/jp\/auction\//i,
    searchUrl: (keyword, maxPrice) => `https://auctions.yahoo.co.jp/search/search?p=${encodeURIComponent(keyword)}&aucmaxprice=${Math.max(1, maxPrice)}`,
  },
  {
    key: 'Mercari',
    label: 'メルカリ',
    column: 8,
    resultHost: /jp\.mercari\.com\/item\//i,
    searchUrl: (keyword, maxPrice) => `https://jp.mercari.com/search?keyword=${encodeURIComponent(keyword)}&price_max=${Math.max(1, maxPrice)}`,
  },
  {
    key: 'Jimoty',
    label: 'ジモティ',
    column: 9,
    resultHost: /jmty\.jp\/.+\/article-/i,
    searchUrl: (keyword) => `https://jmty.jp/all/sale?keyword=${encodeURIComponent(keyword)}`,
  },
];

const OTHER_RESEARCH_SITES = [
  {
    key: 'Rakuten',
    label: '楽天市場',
    resultHost: /item\.rakuten\.co\.jp\//i,
    searchUrl: (keyword) => `https://search.rakuten.co.jp/search/mall/${encodeURIComponent(keyword)}/`,
  },
  {
    key: 'Surugaya',
    label: '駿河屋',
    resultHost: /suruga-ya\.jp\/product\/detail\//i,
    searchUrl: (keyword) => `https://www.suruga-ya.jp/search?search_word=${encodeURIComponent(keyword)}`,
  },
  {
    key: 'Offmall',
    label: 'オフモール',
    resultHost: /netmall\.hardoff\.co\.jp\/product\//i,
    searchUrl: (keyword) => `https://netmall.hardoff.co.jp/search/?q=${encodeURIComponent(keyword)}`,
  },
  {
    key: 'SecondStreet',
    label: 'セカンドストリート',
    resultHost: /2ndstreet\.jp\/goods\/detail\/goodsId\//i,
    searchUrl: (keyword) => `https://www.2ndstreet.jp/search?keyword=${encodeURIComponent(keyword)}`,
  },
  {
    key: 'NetOff',
    label: 'ネットオフ',
    resultHost: /netoff\.co\.jp\/detail\/[0-9]+\//i,
    searchUrl: (keyword) => `https://www.netoff.co.jp/cmdtyallsearch/?word=${encodeURIComponent(keyword)}`,
  },
];

function setupResearchManagementSheet_(spreadsheet) {
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
  return sheet;
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
    Logger.log('別の同期またはリサーチ処理が実行中のため、注文番号同期を終了しました。');
    return 0;
  }
  try {
    const result = syncResearchManagementByOrderNumber_(getTargetSpreadsheet_());
    Logger.log(`注文番号同期: ${result.appended}行追加 / ${result.deleted}行削除 / 重複${result.duplicates}件`);
    return result.appended;
  } finally {
    lock.releaseLock();
  }
}

function syncResearchManagementByOrderNumber_(spreadsheet) {
  const orderSheet = getOrCreateSheet_(spreadsheet, AMAZON_ORDER_IMPORTER_CONFIG.orderSheetName);
  const researchSheet = spreadsheet.getSheetByName(RESEARCH_AUTOMATION_CONFIG.sheetName);
  if (!researchSheet || (typeof researchSheet.isSheetHidden === 'function' && researchSheet.isSheetHidden())) {
    writeSynchronizationCheck_(
      spreadsheet,
      '要確認',
      '',
      researchSheet ? 'リサーチ管理表が非表示のため、メインシートのみ処理します。' : 'リサーチ管理表が存在しないため、メインシートのみ処理します。',
    );
    return { appended: 0, deleted: 0, duplicates: 0, available: false };
  }

  const orderColumns = researchColumnMap_(orderSheet);
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
      writeSynchronizationCheck_(spreadsheet, '注文番号重複', orderNumber, '注文確定商品リサーチ表に同じ注文番号が複数あります。');
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
      writeSynchronizationCheck_(spreadsheet, '注文番号重複', orderNumber, 'リサーチ管理表に同じ注文番号が複数あるため、自動更新を保留します。');
    }
  });
  if (unresolvedMainOrderRows) {
    writeSynchronizationCheck_(
      spreadsheet,
      '要確認',
      '',
      `メインシートに注文番号を取得できない行が${unresolvedMainOrderRows}件あるため、管理表の削除同期を保留しました。`,
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
    ['Amazon', 'Yahoo', 'Mercari', 'Jimoty', 'Other'].forEach((key) => {
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
  const sku = (String(orderInfo || '').match(/SKU\s*[:：]\s*([^\n]+)/i) || [])[1] || '';
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
    writeSynchronizationCheck_(spreadsheet, '注文番号重複', orderNumber, 'リサーチ管理表に同じ注文番号が複数あるため、自動更新を保留します。');
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
    'ヤフオク': 'Yahoo',
    Mercari: 'Mercari',
    'メルカリ': 'Mercari',
    Jimoty: 'Jimoty',
    'ジモティ': 'Jimoty',
    Other: 'Other',
    'その他サイト': 'Other',
  };
  return columns[aliases[siteName] || siteName] || 0;
}

function appendUrlToResearchManagementSheet(orderNumber, siteName, resultText) {
  const spreadsheet = getTargetSpreadsheet_();
  const found = findResearchManagementRowsByOrderNumber_(spreadsheet, orderNumber);
  if (!found.sheet || found.rows.length !== 1) {
    if (found.rows.length > 1) {
      writeSynchronizationCheck_(spreadsheet, '注文番号重複', orderNumber, 'リサーチ管理表に同じ注文番号が複数あるため、候補URLを追記しませんでした。');
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
  return ['Amazon', 'Yahoo', 'Mercari', 'Jimoty', 'Other'].some((key) => {
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
  return ['Amazon', 'Yahoo', 'Mercari', 'Jimoty', 'Other'].some((key) => {
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
    writeSynchronizationCheck_(spreadsheet, '要確認', orderNumber, memo);
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
      writeSynchronizationCheck_(spreadsheet, '注文番号重複', orderNumber, 'リサーチ管理表に同じ注文番号が複数あるため、結果同期を保留します。');
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
      writeSynchronizationCheck_(spreadsheet, '要確認', orderNumber, memo);
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
    if (typeof recordDeletedOrdersSinceLastSnapshot_ === 'function') {
      recordDeletedOrdersSinceLastSnapshot_(spreadsheet, orderSheet, `onChange:${changeType || 'UNKNOWN'}`);
    }
    syncResearchManagementByOrderNumber();
  }
}

function researchListedItemsHourly() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(1000)) {
    Logger.log('別のリサーチ処理が実行中のため、今回の実行を終了しました。');
    return;
  }

  try {
    const startedAt = Date.now();
    const spreadsheet = getTargetSpreadsheet_();
    syncResearchManagementByOrderNumber_(spreadsheet);
    const managementContext = buildResearchManagementContext_(spreadsheet);
    const sheet = getOrCreateSheet_(spreadsheet, AMAZON_ORDER_IMPORTER_CONFIG.orderSheetName);
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) {
      return;
    }

    const columns = researchColumnMap_(sheet);
    const visibleRows = visibleResearchRows_(sheet, lastRow);
    const properties = PropertiesService.getScriptProperties();
    const cursorKey = 'mainResearchVisibleRowCursor';
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
        writeResearchCheck_(rowData, '入力不足', 'C列の売上金またはD列の検索ワードがありません。', '');
        syncMainAndResearchManagementAfterResearch(rowData.orderNumber, rowNumber, {
          status: RESEARCH_STATUS.review,
          resultsBySite: {},
          memos: ['C列の売上金またはD列の検索ワードがありません。'],
        }, managementContext);
        processed += 1;
        continue;
      }
      if (!rowData.orderNumber) {
        setManagedResearchStatusAtColumn_(sheet, rowNumber, columns.status, RESEARCH_STATUS.review);
        writeResearchCheck_(rowData, '入力不足', 'B列の注文情報から注文番号を取得できません。', '');
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
        writeResearchCheck_(rowData, 'エラー', message, '');
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
    Logger.log(`継続リサーチ完了: 表示行 ${visibleRows.length} / 今回処理 ${processed} / 新規URL ${added} / エラー ${errors}`);
  } finally {
    lock.releaseLock();
  }
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
  const sku = ((orderInfo.match(/SKU\s*[:：]\s*([^\n]+)/i) || [])[1] || '').trim();
  const productName = ((orderInfo.match(/商品名\s*[:：]\s*([^\n]+)/) || [])[1] || '').trim();
  const keywordLines = String(values[3] || '')
    .split('\n')
    .map((line) => line.replace(/^【\d+】\s*/, '').trim())
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
  return ['Amazon', 'Yahoo', 'Mercari', 'Jimoty', 'Other'].some((key) => {
    const columnNumber = columns[key];
    return columnNumber && String(sheet.getRange(rowNumber, columnNumber).getDisplayValue() || '').trim();
  });
}

function researchOneOrder(rowData) {
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
      memos.push(`${site.label}: 送料要確認 ${unknownShipping.url}`);
      writeResearchCheck_(
        rowData,
        '要確認',
        `${site.label}: 送料不明のため商品価格だけで仮判定しました。`,
        unknownShipping.url,
      );
    }
    if (!siteResult.ok || siteResult.rejectedForMissingData > 0) {
      needsReview = true;
      memos.push(`${site.label}: 自動判定不可 手動確認URL ${siteResult.manualUrl}`);
      writeResearchCheck_(rowData, '要確認', `${site.label}: 自動判定できない候補または取得制限があります。`, siteResult.manualUrl);
    }
  });

  const otherItems = [];
  OTHER_RESEARCH_SITES.forEach((site) => {
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
      memos.push(`${site.label}: 自動判定不可 手動確認URL ${siteResult.manualUrl}`);
      writeResearchCheck_(rowData, '要確認', `${site.label}: 自動判定できない候補または取得制限があります。`, siteResult.manualUrl);
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
    memos.push(`${unknownOtherShipping.siteLabel || unknownOtherShipping.site}: 送料要確認 ${unknownOtherShipping.url}`);
    writeResearchCheck_(
      rowData,
      '要確認',
      `${unknownOtherShipping.siteLabel || unknownOtherShipping.site}: 送料不明のため商品価格だけで仮判定しました。`,
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
    // 指示書16・31: 送料不明時は商品価格だけで仮判定し、
    // 出力側で「送料要確認」を明記する。
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
      || /中古品?\s*[-－]?\s*(ほぼ新品|非常に良い|良い|可)|中古\s*[-－]?\s*(ほぼ新品|非常に良い|良い|可)/i.test(value);
  }
  if (siteName === 'Yahoo' || siteName === 'Mercari') {
    return /新品|未使用に近い|目立った傷や汚れなし|やや傷や汚れあり|傷や汚れあり/i.test(value);
  }
  if (siteName === 'Jimoty') {
    // 指示書19: ジモティはジャンク等の除外語がなければ候補化できる。
    // ジャンク・販売終了の判定は呼び出し元で先に実施済み。
    return true;
  }
  return NEW_CONDITION_PATTERN.test(value) || USED_CONDITION_PATTERN.test(value);
}

function isCompleteDvdCandidate_(text, expectedVolume) {
  if (!expectedVolume) {
    return true;
  }
  const half = toHalfWidthNumber_(String(text || ''));
  return new RegExp(`全\\s*${expectedVolume}\\s*巻|${expectedVolume}\\s*巻\\s*セット|全巻`).test(half);
}

function expectedVolumeCount_(text) {
  const half = toHalfWidthNumber_(String(text || ''));
  const match = half.match(/全\s*([0-9]+)\s*巻|([0-9]+)\s*巻\s*セット/);
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
  const additions = [];

  lines.forEach((line) => {
    const url = canonicalResearchUrl_((String(line).match(/https?:\/\/\S+/) || [''])[0]);
    if (!url || currentUrls.has(url)) {
      return;
    }
    currentUrls.add(url);
    additions.push(String(line).replace(/https?:\/\/\S+/, url));
  });

  if (additions.length) {
    cell.setValue(current ? `${current}\n${additions.join('\n')}` : additions.join('\n')).setWrap(true);
  }
  return additions.length;
}

function appendUrlToMainSheet_(rowNumber, columnNumber, resultLines) {
  const spreadsheet = getTargetSpreadsheet_();
  const sheet = getOrCreateSheet_(spreadsheet, AMAZON_ORDER_IMPORTER_CONFIG.orderSheetName);
  return appendResearchLinesToSheet_(sheet, rowNumber, columnNumber, resultLines);
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

function formatResearchResult_(item, includeSiteName) {
  const price = `${Number(item.price).toLocaleString('ja-JP')}円`;
  const shipping = item.shippingKnown
    ? (item.shipping ? `＋送料${Number(item.shipping).toLocaleString('ja-JP')}円` : '＋送料無料')
    : '｜送料要確認';
  const condition = item.condition || '状態要確認';
  const prefix = includeSiteName ? `${item.siteLabel || item.site}｜` : '';
  return `${prefix}${price}${shipping}｜${condition}｜${item.url}`;
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
    /(?:販売価格|商品価格|現在価格|即決価格|価格)\s*[:：]?\s*[￥¥]?\s*([0-9]{1,3}(?:,[0-9]{3})+|[0-9]{2,7})\s*円?/i,
    /[￥¥]\s*([0-9]{1,3}(?:,[0-9]{3})+|[0-9]{2,7})(?:\s*円)?/i,
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
  if (/送料無料|送料\s*(?:は)?\s*0\s*円|配送料無料/.test(text)) {
    return { known: true, amount: 0 };
  }
  const match = text.match(/(?:送料|配送料)[^\d]{0,15}([0-9]{1,3}(?:,[0-9]{3})+|[0-9]{2,6})\s*円/);
  return match
    ? { known: true, amount: Number(match[1].replace(/,/g, '')) || 0 }
    : { known: false, amount: 0 };
}

function conditionNear_(html, siteName) {
  const text = stripResearchHtml_(html);
  const patterns = [
    /中古品?\s*[-－]?\s*(?:ほぼ新品|非常に良い|良い|可)/,
    /未使用に近い|目立った傷や汚れなし|やや傷や汚れあり|傷や汚れあり/,
    /新品未使用|新品|未開封|中古[ABC]?|状態要確認/,
  ];
  for (let index = 0; index < patterns.length; index += 1) {
    const match = text.match(patterns[index]);
    if (match) {
      return match[0];
    }
  }
  return siteName === 'Jimoty' ? '状態要確認' : '';
}

function matchesResearchKeyword_(title, keyword) {
  const normalizedTitle = normalizeResearchText_(title);
  const normalizedKeyword = normalizeResearchText_(keyword);
  const modelTokens = normalizedKeyword.match(/[a-z]{1,8}[a-z0-9-]*[0-9][a-z0-9-]*/g) || [];
  if (modelTokens.length) {
    return modelTokens.some((token) => normalizedTitle.indexOf(token) >= 0);
  }
  const tokens = normalizedKeyword.split(/\s+/).filter((token) => token.length >= 2 && !/^(全|全巻|レンタル)$/.test(token));
  return tokens.length ? tokens.filter((token) => normalizedTitle.indexOf(token) >= 0).length >= Math.ceil(tokens.length / 2) : false;
}

function normalizeResearchText_(value) {
  return toHalfWidthNumber_(String(value || ''))
    .toLowerCase()
    .replace(/[Ａ-Ｚａ-ｚ]/g, (character) => String.fromCharCode(character.charCodeAt(0) - 0xfee0))
    .replace(/[^a-z0-9一-龠ぁ-んァ-ヶー-]+/g, ' ')
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
    rowData.newOnly ? 'SKUにmuzaを含むため新品限定' : '',
  ]);
}
