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
    let removed = 0;
    let errors = 0;
    const runBudgetMs = Math.min(Number(RESEARCH_AUTOMATION_CONFIG.maxRuntimeMs) || 60000, 60000);
    const maxRowsThisRun = Math.min(Number(RESEARCH_AUTOMATION_CONFIG.maxRowsPerRun) || 1, 1);
    const deadlineMs = startedAt + runBudgetMs;

    for (let index = 0; index < orderedRows.length; index += 1) {
      if (processed >= maxRowsThisRun || isResearchDeadlineReached_({ deadlineMs })) {
        break;
      }
      const rowNumber = orderedRows[index];
      const values = sheet.getRange(rowNumber, 1, 1, Math.max(1, sheet.getLastColumn())).getValues()[0];
      const rowData = buildResearchRowDataFromSheet_(rowNumber, values, columns, sheet);
      rowData.deadlineMs = deadlineMs;
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
        const cleanup = removeUnavailableResearchResultsFromRow_(spreadsheet, sheet, rowNumber, columns, rowData);
        removed += cleanup.removed;
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
      if (visibleRows.length) {
        properties.setProperty(cursorKey, String((cursor + processed) % visibleRows.length));
      }
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
  Logger.log('リサーチ管理表の表示中の全行を、現在の実行で先頭からリサーチします。');
  return researchListedItemsHourly();
}

function researchOrder25026888213232625Now() {
  return researchManagementOrderNumberNow_('250-2688821-3232625');
}

function researchOrder50322812319095046Now() {
  return researchManagementOrderNumberNow_('503-2281231-9095046');
}

function researchOrder24947864940001414Now() {
  return researchManagementOrderNumberNow_('249-4786494-0001414');
}

function researchManagementOrderNumberNow_(orderNumber) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(1000)) {
    Logger.log('Another research run is active. Skipped.');
    return { processed: 0, added: 0, errors: 0 };
  }

  try {
    const spreadsheet = getTargetSpreadsheet_();
    const syncResult = syncResearchManagementByOrderNumber_(spreadsheet);
    if (!syncResult.available) {
      return { processed: 0, added: 0, errors: 0 };
    }
    const managementContext = buildResearchManagementContext_(spreadsheet);
    const found = findResearchManagementRowsByOrderNumber_(spreadsheet, orderNumber, managementContext);
    if (!found.sheet || found.rows.length !== 1) {
      writeSynchronizationCheck_(spreadsheet, 'TARGET_ORDER_NOT_FOUND', orderNumber, 'Target order was not found as a unique row in the research management sheet.');
      return { processed: 0, added: 0, errors: 1 };
    }

    const rowNumber = found.rows[0];
    const values = found.sheet.getRange(rowNumber, 1, 1, Math.max(1, found.sheet.getLastColumn())).getValues()[0];
    const rowData = buildResearchRowDataFromSheet_(rowNumber, values, found.columns, found.sheet);
    rowData.deadlineMs = Date.now() + 150000;
    setManagedResearchStatusAtColumn_(found.sheet, rowNumber, found.columns.status, RESEARCH_STATUS.running);
    const result = researchOneOrder(rowData);
    const hasCandidates = rowHasResearchCandidates_(found.sheet, rowNumber, found.columns)
      || Object.keys(result.resultsBySite || {}).some((key) => (result.resultsBySite[key] || []).length);
    result.status = hasCandidates ? RESEARCH_STATUS.found : (result.needsReview ? RESEARCH_STATUS.review : RESEARCH_STATUS.empty);
    setManagedResearchStatusAtColumn_(found.sheet, rowNumber, found.columns.status, result.status);
    updateResearchManagementRowByOrderNumber(orderNumber, result, managementContext);
    Logger.log(`Target research done: ${orderNumber} / added ${result.added}`);
    return { processed: 1, added: result.added, errors: 0 };
  } catch (error) {
    Logger.log(`Target research error: ${error && error.message ? error.message : error}`);
    return { processed: 0, added: 0, errors: 1 };
  } finally {
    lock.releaseLock();
  }
}

function setManagedResearchStatus_(sheet, rowNumber, nextStatus) {
  return setManagedResearchStatusAtColumn_(sheet, rowNumber, 5, nextStatus);
}

function isResearchDeadlineReached_(rowData) {
  return rowData && rowData.deadlineMs && Date.now() >= rowData.deadlineMs;
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
    if (isResearchDeadlineReached_(rowData)) {
      return;
    }
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
    if (isResearchDeadlineReached_(rowData)) {
      return;
    }
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
  const rowData = { expectedVolume: 0, newOnly: false };
  const result = fetchSearchResults_(site, site.searchUrl(keyword, maxPrice), keyword, maxPrice, rowData);
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

  expandedResearchKeywordsForSite_(site, rowData).forEach((keyword) => {
    if (isResearchDeadlineReached_(rowData)) {
      return;
    }
    const url = site.searchUrl(keyword, rowData.maxPrice);
    manualUrl = manualUrl || url;
    const result = fetchSearchResults_(site, url, keyword, rowData.maxPrice, rowData);
    ok = ok && result.ok;
    rejectedForMissingData += result.rejectedForMissingData;
    result.items.forEach((item) => combined.push(item));
  });

  return { ok, items: combined, rejectedForMissingData, manualUrl };
}

function expandedResearchKeywordsForSite_(site, rowData) {
  const keywords = (rowData && rowData.keywordLines) || [];
  const extra = [];
  if (site && site.key === 'Mercari' && rowData && rowData.isDvd) {
    const broadTitle = broadDvdResearchTitle_(rowData.productName || keywords.join(' '));
    if (broadTitle) {
      extra.push(broadTitle, `${broadTitle} 全巻`, `${broadTitle} レンタル`, `${broadTitle} DVD`);
    }
    return uniqueResearchKeywordLines_(extra.concat(keywords)).slice(0, 4);
  }
  return uniqueResearchKeywordLines_(keywords.concat(extra));
}

function uniqueResearchKeywordLines_(keywords) {
  const seen = new Set();
  return (keywords || []).map((keyword) => String(keyword || '').trim()).filter((keyword) => {
    const key = normalizeResearchText_(keyword);
    if (!key || seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

