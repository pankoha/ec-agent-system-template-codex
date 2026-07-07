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
  '\u305D\u306E\u4ED6\u30B5\u30A4\u30C8',
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
  Rakuten: ['\u697D\u5929\u5E02\u5834'],
  Other: ['\u305D\u306E\u4ED6\u30B5\u30A4\u30C8'],
  lastResearchedAt: ['\u6700\u7D42\u30EA\u30B5\u30FC\u30C1\u65E5\u6642', '\u6700\u7D42\u78BA\u8A8D\u65E5\u6642'],
  memo: ['\u78BA\u8A8D\u30E1\u30E2', '\u30E1\u30E2'],
};

const RESEARCH_RESULT_KEYS = ['Amazon', 'Yahoo', 'Mercari', 'Jimoty', 'Rakuten', 'Other'];
const LEGACY_RESEARCH_RESULT_KEYS = RESEARCH_RESULT_KEYS;

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
    sheet.getRange('A:M').setWrap(true);
    sheet.setColumnWidth(1, 120);
    sheet.setColumnWidth(2, 440);
    sheet.setColumnWidth(3, 110);
    sheet.setColumnWidth(4, 260);
    sheet.setColumnWidth(5, 120);
    sheet.setColumnWidths(6, 6, 230);
    sheet.setColumnWidth(12, 160);
    sheet.setColumnWidth(13, 320);
  }
  upgradeResearchManagementHeaders_(sheet);
  enforceResearchManagementResultHeaders_(sheet);
  return sheet;
}

function enforceResearchManagementResultHeaders_(sheet) {
  const resultHeaders = ['Amazon', '\u30E4\u30D5\u30AA\u30AF', '\u30E1\u30EB\u30AB\u30EA', '\u30B8\u30E2\u30C6\u30A3', '\u697D\u5929\u5E02\u5834', '\u305D\u306E\u4ED6\u30B5\u30A4\u30C8'];
  resultHeaders.forEach((header, index) => {
    const cell = sheet.getRange(1, 6 + index);
    if (String(cell.getValue() || '').trim() !== header) {
      cell.setValue(header);
    }
  });
}

function upgradeResearchManagementHeaders_(sheet) {
  const lastColumn = Math.max(13, sheet.getLastColumn());
  const headers = sheet.getRange(1, 1, 1, lastColumn).getDisplayValues()[0]
    .map((header) => String(header || '').trim());
  const columnK = headers[10] || '';
  const columnL = headers[11] || '';

  if (columnK === '\u6700\u7D42\u30EA\u30B5\u30FC\u30C1\u65E5\u6642' || columnK === '\u6700\u7D42\u78BA\u8A8D\u65E5\u6642') {
    const lastRow = Math.max(1, sheet.getLastRow());
    const metadataValues = sheet.getRange(1, 11, lastRow, 2).getValues();
    sheet.getRange(1, 12, lastRow, 2).setValues(metadataValues).setWrap(true);
    sheet.getRange(1, 11, lastRow, 1).clearContent();
  } else if (!columnL && sheet.getLastColumn() < 12) {
    sheet.getRange(1, 12).setValue('\u6700\u7D42\u30EA\u30B5\u30FC\u30C1\u65E5\u6642');
    sheet.getRange(1, 13).setValue('\u78BA\u8A8D\u30E1\u30E2');
  }
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
  const canUseDeletedOrderRegistry = spreadsheet.getSheetByName(AMAZON_ORDER_IMPORTER_CONFIG.deletedOrderSheetName)
    || typeof spreadsheet.insertSheet === 'function';
  if (canUseDeletedOrderRegistry && typeof deleteKnownDeletedOrderRows_ === 'function') {
    deleteKnownDeletedOrderRows_(spreadsheet, orderSheet);
  }
  const deletedOrderNumbers = canUseDeletedOrderRegistry && typeof loadDeletedOrderNumbers_ === 'function'
    ? loadDeletedOrderNumbers_(spreadsheet)
    : new Set();
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
      if (deletedOrderNumbers.has(orderNumber)) {
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
  const deletedRecordsFromManagement = [];
  managementOrders.forEach((rows, orderNumber) => {
    if (deletedOrderNumbers.has(orderNumber)) {
      rows.forEach((rowNumber) => rowsToDelete.push(rowNumber));
      return;
    }
    if (!mainOrders.has(orderNumber)) {
      if (!unresolvedMainOrderRows) {
        rows.forEach((rowNumber) => {
          rowsToDelete.push(rowNumber);
          const row = researchValues[rowNumber - 2] || [];
          deletedRecordsFromManagement.push({
            orderNumber,
            rowNumber,
            orderInfo: mappedValue_(row, researchColumns.orderInfo),
          });
        });
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
  if (canUseDeletedOrderRegistry && deletedRecordsFromManagement.length && typeof appendDeletedOrderRecords_ === 'function') {
    appendDeletedOrderRecords_(spreadsheet, deletedRecordsFromManagement, '\u30EA\u30B5\u30FC\u30C1\u7BA1\u7406\u8868\u3068\u306E\u540C\u671F\u3067\u524A\u9664\u691C\u77E5');
  }
  rowsToDelete.sort((left, right) => right - left).forEach((rowNumber) => researchSheet.deleteRow(rowNumber));
  return {
    appended: additions.length,
    deleted: rowsToDelete.length,
    duplicates,
    available: true,
  };
}

