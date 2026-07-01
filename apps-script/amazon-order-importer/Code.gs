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
