/**
 * Continuous sourcing research for rows displayed in 【リサーチ管理表】.
 *
 * Invariants:
 * - Every visible row remains eligible on every hourly run, regardless of status.
 * - Existing URLs are never deleted or overwritten.
 * - Only canonical, new, non-duplicate, better product URLs are appended.
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

function syncResearchManagementOnChange(event) {
  const changeType = String(event && event.changeType ? event.changeType : '');
  if (!changeType || ['REMOVE_ROW', 'INSERT_ROW', 'OTHER'].indexOf(changeType) >= 0) {
    const spreadsheet = getTargetSpreadsheet_();
    const orderSheet = getOrCreateSheet_(spreadsheet, AMAZON_ORDER_IMPORTER_CONFIG.orderSheetName);
    if (typeof enforceProtectedDeletedRows_ === 'function') {
      enforceProtectedDeletedRows_(spreadsheet, orderSheet, `onChange:${changeType || 'UNKNOWN'} 132行目以降保護`);
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
    Logger.log('別のリサーチ処理が実行中のため、Gmail自動取得直後リサーチを保留しました。');
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
        writeSynchronizationCheck_(spreadsheet, '注文番号重複', orderNumber, 'Gmail自動取得直後リサーチは、同じ注文番号の行が複数あるため保留しました。');
      }
      return;
    }

    const target = matches[0];
    if (!isResearchRowVisibleForAutomation_(sheet, target.rowNumber)) {
      skipped += 1;
      writeSynchronizationCheck_(spreadsheet, '要確認', orderNumber, 'Gmail自動取得直後リサーチは、対象行が非表示のため保留しました。');
      return;
    }

    const rowData = buildResearchRowDataFromSheet_(target.rowNumber, target.values, columns, sheet);
    if (!rowData.keywordLines.length || !rowData.maxPrice) {
      setManagedResearchStatusAtColumn_(sheet, target.rowNumber, columns.status, RESEARCH_STATUS.review);
      writeResearchCheck_(rowData, '入力不足', 'C列の売上金またはD列の検索ワードがありません。', '');
      syncMainAndResearchManagementAfterResearch(rowData.orderNumber, target.rowNumber, {
        status: RESEARCH_STATUS.review,
        resultsBySite: {},
        memos: ['C列の売上金またはD列の検索ワードがありません。'],
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
      writeResearchCheck_(rowData, 'エラー', message, '');
      syncMainAndResearchManagementAfterResearch(rowData.orderNumber, target.rowNumber, {
        status: RESEARCH_STATUS.error,
        resultsBySite: {},
        memos: [message],
      }, managementContext);
    }
    processed += 1;
  });

  Logger.log(`Gmail自動取得直後リサーチ完了: 同期追加 ${syncResult.appended} / 今回処理 ${processed} / 新規URL ${added} / エラー ${errors} / 保留 ${skipped}`);
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
    Logger.log('別のリサーチ処理が実行中のため、今回の実行を終了しました。');
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

function researchAllVisibleManagementRowsNow() {
  PropertiesService.getScriptProperties().setProperty('managementResearchVisibleRowCursor', '0');
  Logger.log('リサーチ管理表の表示中の全行を、現在の実行で先頭からリサーチします。');
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
  return RESEARCH_RESULT_KEYS.some((key) => {
    const columnNumber = columns[key];
    return columnNumber && hasConfirmedResearchCandidateText_(sheet.getRange(rowNumber, columnNumber).getDisplayValue());
  });
}

function hasConfirmedResearchCandidateText_(value) {
  return String(value || '')
    .split('\n')
    .some((line) => {
      const text = String(line || '').trim();
      return text && !/^\[SEARCH\]/.test(text);
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
      '書き込み先不一致',
      `候補URLの追記先は${RESEARCH_AUTOMATION_CONFIG.sheetName}のみに限定しています。`,
      '',
    );
    return {
      added: 0,
      needsReview: true,
      resultsBySite: {},
      memos: ['候補URLの追記先がリサーチ管理表ではないため追記を停止しました。'],
    };
  }
  let added = 0;
  let needsReview = false;
  const seenThisRun = new Set();
  const resultsBySite = {};
  const memos = [];

  RESEARCH_SITES.forEach((site) => {
    const siteResult = researchSiteForKeywords_(site, rowData);
    const accepted = uniqueAcceptedResearchItems_(
      filterItemsByPriceAndCondition(siteResult.items, rowData.maxPrice, site.key, rowData.isDvd, rowData),
      seenThisRun,
    );
    const directAmazonLines = site.key === 'Amazon' ? buildAmazonAsinResearchLines_(rowData) : [];
    const lines = accepted.map((item) => formatResearchResult_(item, false)).concat(directAmazonLines);
    resultsBySite[site.key] = lines;
    const addedForSite = appendResearchLinesToSheet_(
      rowData.sheet,
      rowData.row,
      rowData.columns[site.key],
      lines,
    );
    added += addedForSite;
    const unknownShipping = accepted.find((item) => !item.shippingKnown);
    if (addedForSite > 0 && unknownShipping) {
      needsReview = true;
      memos.push(`${site.label}: 送料要確認 ${unknownShipping.url}`);
      writeResearchCheck_(rowData, '要確認', `${site.label}: 送料不明のため商品価格だけで仮判定しました。`, unknownShipping.url);
    }
    const unknownCondition = accepted.find((item) => isUnknownResearchCondition_(item.condition));
    if (addedForSite > 0 && unknownCondition) {
      needsReview = true;
      memos.push(`${site.label}: 状態要確認 ${unknownCondition.url}`);
      writeResearchCheck_(rowData, '要確認', `${site.label}: 検索結果で状態を自動判定できないため、候補URLで状態確認が必要です。`, unknownCondition.url);
    }
    if (addedForSite === 0 && (!siteResult.ok || siteResult.rejectedForMissingData > 0)) {
      needsReview = true;
      memos.push(`${site.label}: 自動判定不可 手動確認URL ${siteResult.manualUrl}`);
      writeResearchCheck_(rowData, '要確認', `${site.label}: 価格・送料・状態のいずれかを自動判定できない候補、または取得制限があります。条件合格候補としては追記していません。`, siteResult.manualUrl);
    }
  });

  const otherItems = [];
  OTHER_RESEARCH_SITES.forEach((site) => {
    const siteResult = researchSiteForKeywords_(site, rowData);
    const accepted = uniqueAcceptedResearchItems_(
      filterItemsByPriceAndCondition(siteResult.items, rowData.maxPrice, site.key, rowData.isDvd, rowData),
      seenThisRun,
    );
    accepted.forEach((item) => otherItems.push(item));
    if (!accepted.length && (!siteResult.ok || siteResult.rejectedForMissingData > 0)) {
      needsReview = true;
      memos.push(`${site.label}: 自動判定不可 手動確認URL ${siteResult.manualUrl}`);
      writeResearchCheck_(rowData, '要確認', `${site.label}: 価格・送料・状態のいずれかを自動判定できない候補、または取得制限があります。条件合格候補としては追記していません。`, siteResult.manualUrl);
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
  const unknownOtherCondition = otherItems.find((item) => isUnknownResearchCondition_(item.condition));
  if (addedOther > 0 && unknownOtherCondition) {
    needsReview = true;
    memos.push(`${unknownOtherCondition.siteLabel || unknownOtherCondition.site}: 状態要確認 ${unknownOtherCondition.url}`);
    writeResearchCheck_(
      rowData,
      '要確認',
      `${unknownOtherCondition.siteLabel || unknownOtherCondition.site}: 検索結果で状態を自動判定できないため、候補URLで状態確認が必要です。`,
      unknownOtherCondition.url,
    );
  }

  return { added, needsReview, resultsBySite, memos };
}

function uniqueAcceptedResearchItems_(items, seenThisRun) {
  return (items || []).filter((item) => {
    const canonical = canonicalResearchUrl_(item.url);
    if (!canonical || seenThisRun.has(canonical)) {
      return false;
    }
    seenThisRun.add(canonical);
    item.url = canonical;
    return true;
  });
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
  const result = fetchSearchResults_(site, site.searchUrl(keyword, maxPrice), keyword, maxPrice);
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
    const result = fetchSearchResults_(site, url, keyword, rowData.maxPrice);
    ok = ok && result.ok;
    rejectedForMissingData += result.rejectedForMissingData;
    result.items.forEach((item) => combined.push(item));
  });

  return { ok, items: combined, rejectedForMissingData, manualUrl };
}

function fetchSearchResults_(site, url, keyword, maxPrice) {
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
    const htmlText = String(html);
    const contextBefore = 1400;
    const contextAfter = 5200;
    const contextStart = Math.max(0, match.index - contextBefore);
    let contextEnd = Math.min(htmlText.length, match.index + match[0].length + contextAfter);
    const nextProductAnchorIndex = nextResearchProductAnchorIndex_(htmlText.slice(match.index + match[0].length), site, url);
    if (nextProductAnchorIndex >= 0) {
      contextEnd = Math.min(contextEnd, match.index + match[0].length + nextProductAnchorIndex);
    }
    const context = String(html).slice(
      contextStart,
      contextEnd,
    );
    const anchorTitle = stripResearchHtml_(match[2]);
    const altTitle = extractResearchAnchorAttributeTitle_(match[0]);
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

function extractResearchAnchorAttributeTitle_(anchorHtml) {
  const value = String(anchorHtml || '');
  const attributes = ['aria-label', 'alt', 'title'];
  for (let index = 0; index < attributes.length; index += 1) {
    const pattern = new RegExp(`\\b${attributes[index]}=["']([^"']+)["']`, 'i');
    const match = value.match(pattern);
    if (match && match[1]) {
      return decodeResearchHtml_(match[1]).trim();
    }
  }
  return '';
}

function nextResearchProductAnchorIndex_(htmlFragment, site, currentUrl) {
  const anchorPattern = /<a\b[^>]*href=["']([^"']+)["'][^>]*>/gi;
  const currentCanonicalUrl = canonicalResearchUrl_(currentUrl);
  let match;
  while ((match = anchorPattern.exec(String(htmlFragment || ''))) !== null) {
    const url = normalizeResearchProductUrl_(match[1], site.key);
    if (url && site.resultHost.test(url) && canonicalResearchUrl_(url) !== currentCanonicalUrl) {
      return match.index;
    }
  }
  return -1;
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
    if (isDvd && (isRejectedDvdPaperGoods_(text) || !isCompleteDvdCandidate_(text, rowData.expectedVolume))) {
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
    return true;
  }
  if (siteName === 'Yahoo' || siteName === 'Mercari') {
    return true;
  }
  if (siteName === 'Jimoty') {
    // 指示書19: ジモティはジャンク等の除外語がなければ候補化できる。
    // ジャンク・販売終了の判定は呼び出し元で先に実施済み。
    return true;
  }
  if (siteName === 'Rakuten') {
    return true;
  }
  return true;
}

function isCompleteDvdCandidate_(text, expectedVolume) {
  if (!expectedVolume) {
    return true;
  }
  const half = toHalfWidthNumber_(String(text || ''));
  return new RegExp(`全\\s*${expectedVolume}\\s*巻|${expectedVolume}\\s*巻\\s*セット|全巻`).test(half);
}

function isRejectedDvdPaperGoods_(text) {
  return /プレスブック|プレスシート|パンフレット|パンフ\b|チラシ|ちらし|フライヤー|映画半券|半券/i.test(String(text || ''));
}

function expectedVolumeCount_(text) {
  const half = toHalfWidthNumber_(String(text || ''));
  const match = half.match(/全\s*([0-9]+)\s*巻|([0-9]+)\s*巻\s*セット/);
  return Number((match && (match[1] || match[2])) || 0);
}

function buildAmazonAsinResearchLines_(rowData) {
  const asin = extractAmazonAsinFromResearchRow_(rowData);
  if (!asin) {
    return [];
  }
  return [`ASIN確認URL ${asin}\nhttps://www.amazon.co.jp/dp/${asin}`];
}

function extractAmazonAsinFromResearchRow_(rowData) {
  const text = [
    rowData && rowData.orderInfo,
    rowData && rowData.sku,
    rowData && rowData.productName,
  ].filter(Boolean).join('\n');
  const patterns = [
    /\bASIN\s*[:：]\s*([A-Z0-9]{10})\b/i,
    /\/(?:dp|gp\/product)\/([A-Z0-9]{10})\b/i,
    /(?:^|[^A-Z0-9])(B[0-9A-Z]{9})(?=$|[^A-Z0-9])/i,
  ];
  for (let index = 0; index < patterns.length; index += 1) {
    const match = String(text || '').match(patterns[index]);
    if (match) {
      return match[1].toUpperCase();
    }
  }
  return '';
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
    const normalizedLine = String(line);
    const url = canonicalResearchUrl_((normalizedLine.match(/https?:\/\/\S+/) || [''])[0]);
    if (!url || currentUrls.has(url)) {
      return;
    }
    currentUrls.add(url);
    additions.push(normalizedLine.replace(/https?:\/\/\S+/, url));
  });

  if (additions.length) {
    cell.setValue(current ? `${current}\n${additions.join('\n')}` : additions.join('\n')).setWrap(true);
  }
  return additions.length;
}

function splitResearchResultBlocks_(text) {
  const value = String(text || '');
  const matches = Array.from(value.matchAll(/https?:\/\/\S+/g));
  if (!matches.length) {
    return value.split('\n');
  }
  let blockStart = 0;
  return matches.map((match) => {
    const blockEnd = match.index + match[0].length;
    const block = value.slice(blockStart, blockEnd).trim();
    blockStart = blockEnd;
    return block;
  }).filter(Boolean);
}

function appendUrlToMainSheet_(rowNumber, columnNumber, resultLines) {
  Logger.log(`候補URLの追記先は${RESEARCH_AUTOMATION_CONFIG.sheetName}のみに限定しているため、メインシートへの追記はスキップしました。`);
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
  const priceParts = text.match(/([0-9０-９,，]+)\s*円/g) || [];
  const prices = priceParts
    .map((part) => Number(toHalfWidthNumber_(part).replace(/[^\d]/g, '')))
    .filter((price) => price > 0);
  const shippingKnown = /送料要確認/.test(text) ? false : prices.length > 1 || /送料無料/.test(text);
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
  if (/ほぼ新品|未使用に近い/i.test(value)) {
    return 90;
  }
  if (/新品|未使用品|未使用|brand\s*new|new\b/i.test(value)) {
    return 100;
  }
  if (/非常に良い|目立った傷や汚れなし/i.test(value)) {
    return 80;
  }
  if (/良い|やや傷や汚れあり/i.test(value)) {
    return 60;
  }
  if (/可|傷や汚れあり/i.test(value)) {
    return 40;
  }
  if (/中古|使用済|used/i.test(value)) {
    return 30;
  }
  if (/状態要確認|送料要確認/.test(value)) {
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
  const title = shortenResearchTitle_(item.title || item.siteLabel || item.site || '候補');
  const price = `${Number(item.price).toLocaleString('ja-JP')}円`;
  const shipping = item.shippingKnown
    ? (item.shipping ? `+${Number(item.shipping).toLocaleString('ja-JP')}円` : '+送料無料')
    : ' 送料要確認';
  const condition = item.condition ? ` ${item.condition}` : '';
  const prefix = includeSiteName ? `${item.siteLabel || item.site} ` : '';
  return `${prefix}${title}  ${price}${shipping}${condition}\n${item.url}`;
}

function shortenResearchTitle_(title) {
  return String(title || '')
    .replace(/\s+/g, ' ')
    .replace(/\s*[|｜].*$/, '')
    .trim()
    .slice(0, 42);
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
    /([0-9]{1,3}(?:,[0-9]{3})+|[0-9]{2,7})\s*円/i,
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
  return siteName === 'Rakuten' ? '' : '状態要確認';
}

function isUnknownResearchCondition_(condition) {
  return /状態要確認/.test(String(condition || ''));
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
