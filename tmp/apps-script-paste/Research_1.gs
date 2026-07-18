/**
 * Continuous sourcing research for rows displayed in 【リサーチ管理表】.
 *
 * Invariants:
 * - Every visible row remains eligible on every hourly run, regardless of status.
 * - Existing URLs are rechecked on the hourly run; confirmed unavailable results are removed.
 * - Unknown availability (for example 403 or a temporary fetch failure) is preserved.
 * - Only canonical, new, non-duplicate, better product URLs are appended.
 * - A candidate must be within the C-column sales amount.
 * - SKU containing "muza" accepts new items only.
 */

const RESEARCH_AUTOMATION_CONFIG = {
  sheetName: 'リサーチ管理表',
  reviewSheetName: '確認用',
  maxRuntimeMs: 180000,
  maxRowsPerRun: 25,
  requestTimeoutFallback: 30000,
  userAgent: 'Mozilla/5.0 (compatible; GoogleAppsScript sourcing-research/1.0)',
};

const LEGACY_RESEARCH_MANAGEMENT_SHEET_NAMES = ['リサーチ管理シート'];

const RESEARCH_HEADERS = [
  '注文日 / 出荷予定日',
  '注文情報',
  '売上金',
  '検索ワード',
  'リサーチ状況',
  'Amazon',
  'ヤフオク',
  'メルカリ',
  'ジモティ',
  '楽天市場',
  'その他サイト',
  '最終リサーチ日時',
  '確認メモ',
];

const RESEARCH_COLUMN_ALIASES = {
  shipDate: ['注文日/出荷予定日', '注文日 / 出荷予定日', '出荷期限日', '出荷予定日'],
  orderInfo: ['注文情報'],
  orderNumber: ['注文番号'],
  maxPrice: ['売上金'],
  keyword: ['検索ワード'],
  status: ['リサーチ状況'],
  Amazon: ['Amazon'],
  Yahoo: ['ヤフオク'],
  Mercari: ['メルカリ'],
  Jimoty: ['ジモティ'],
  Rakuten: ['楽天市場'],
  Other: ['その他サイト'],
  lastResearchedAt: ['最終リサーチ日時', '最終確認日時'],
  memo: ['確認メモ', 'メモ'],
};

const RESEARCH_RESULT_KEYS = ['Amazon', 'Yahoo', 'Mercari', 'Jimoty', 'Rakuten', 'Other'];
const LEGACY_RESEARCH_RESULT_KEYS = RESEARCH_RESULT_KEYS;

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
const UNAVAILABLE_PATTERN = /売り切れ|売切れ|売切|SOLD[\s_-]*OUT|\bSOLD\b|販売終了|掲載終了|オークション.{0,8}終了|お問い合わせの受け(?:付け|つけ|付)は終了しました|この商品は削除|ページが見つかりません|404\s*Not\s*Found|410\s*Gone/i;
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
    key: 'YahooFleamarket',
    label: 'Yahoo!フリマ',
    column: 7,
    resultHost: /paypayfleamarket\.yahoo\.co\.jp\/item\//i,
    searchUrl: (keyword, maxPrice) => `https://paypayfleamarket.yahoo.co.jp/search/${encodeURIComponent(keyword)}?maxPrice=${Math.max(1, maxPrice)}`,
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
  {
    key: 'Rakuten',
    label: '楽天市場',
    column: 10,
    resultHost: /item\.rakuten\.co\.jp\//i,
    searchUrl: (keyword) => `https://search.rakuten.co.jp/search/mall/${encodeURIComponent(keyword)}/`,
  },
];

const OTHER_RESEARCH_SITES = [
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
  const resultHeaders = ['Amazon', 'ヤフオク', 'メルカリ', 'ジモティ', '楽天市場', 'その他サイト'];
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

  if (columnK === '最終リサーチ日時' || columnK === '最終確認日時') {
    const lastRow = Math.max(1, sheet.getLastRow());
    const metadataValues = sheet.getRange(1, 11, lastRow, 2).getValues();
    sheet.getRange(1, 12, lastRow, 2).setValues(metadataValues).setWrap(true);
    sheet.getRange(1, 11, lastRow, 1).clearContent();
  } else if (!columnL && sheet.getLastColumn() < 12) {
    sheet.getRange(1, 12).setValue('最終リサーチ日時');
    sheet.getRange(1, 13).setValue('確認メモ');
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
  Logger.log(`旧リサーチ管理シート削除: ${deleted}件`);
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
      '要確認',
      '',
      researchSheet ? 'リサーチ管理表が非表示のため、メインシートのみ処理します。' : 'リサーチ管理表が存在しないため、メインシートのみ処理します。',
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
    appendDeletedOrderRecords_(spreadsheet, deletedRecordsFromManagement, 'リサーチ管理表との同期で削除検知');
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
    YahooFleamarket: 'Yahoo',
    'Yahoo!フリマ': 'Yahoo',
    'Yahooフリマ': 'Yahoo',
    Mercari: 'Mercari',
    'メルカリ': 'Mercari',
    Jimoty: 'Jimoty',
    'ジモティ': 'Jimoty',
    Rakuten: 'Rakuten',
    '楽天市場': 'Rakuten',
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

