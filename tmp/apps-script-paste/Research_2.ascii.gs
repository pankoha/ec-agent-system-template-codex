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
        writeResearchCheck_(rowData, '\u30A8\u30E9\u30FC', message, '');
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
    Logger.log(`\u7D99\u7D9A\u30EA\u30B5\u30FC\u30C1\u5B8C\u4E86: \u8868\u793A\u884C ${visibleRows.length} / \u4ECA\u56DE\u51E6\u7406 ${processed} / \u65B0\u898FURL ${added} / \u30A8\u30E9\u30FC ${errors}`);
  } finally {
    lock.releaseLock();
  }
}

function researchAllVisibleManagementRowsNow() {
  Logger.log('\u30EA\u30B5\u30FC\u30C1\u7BA1\u7406\u8868\u306E\u8868\u793A\u4E2D\u306E\u5168\u884C\u3092\u3001\u73FE\u5728\u306E\u5B9F\u884C\u3067\u5148\u982D\u304B\u3089\u30EA\u30B5\u30FC\u30C1\u3057\u307E\u3059\u3002');
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
      memos.push(`${site.label}: \u9001\u6599\u8981\u78BA\u8A8D ${unknownShipping.url}`);
      writeResearchCheck_(rowData, '\u8981\u78BA\u8A8D', `${site.label}: \u9001\u6599\u4E0D\u660E\u306E\u305F\u3081\u5546\u54C1\u4FA1\u683C\u3060\u3051\u3067\u4EEE\u5224\u5B9A\u3057\u307E\u3057\u305F\u3002`, unknownShipping.url);
    }
    const unknownCondition = accepted.find((item) => isUnknownResearchCondition_(item.condition));
    if (addedForSite > 0 && unknownCondition) {
      needsReview = true;
      memos.push(`${site.label}: \u72B6\u614B\u8981\u78BA\u8A8D ${unknownCondition.url}`);
      writeResearchCheck_(rowData, '\u8981\u78BA\u8A8D', `${site.label}: \u691C\u7D22\u7D50\u679C\u3067\u72B6\u614B\u3092\u81EA\u52D5\u5224\u5B9A\u3067\u304D\u306A\u3044\u305F\u3081\u3001\u5019\u88DCURL\u3067\u72B6\u614B\u78BA\u8A8D\u304C\u5FC5\u8981\u3067\u3059\u3002`, unknownCondition.url);
    }
    if (addedForSite === 0 && (!siteResult.ok || siteResult.rejectedForMissingData > 0)) {
      needsReview = true;
      memos.push(`${site.label}: \u81EA\u52D5\u5224\u5B9A\u4E0D\u53EF \u624B\u52D5\u78BA\u8A8DURL ${siteResult.manualUrl}`);
      writeResearchCheck_(rowData, '\u8981\u78BA\u8A8D', `${site.label}: \u4FA1\u683C\u30FB\u9001\u6599\u30FB\u72B6\u614B\u306E\u3044\u305A\u308C\u304B\u3092\u81EA\u52D5\u5224\u5B9A\u3067\u304D\u306A\u3044\u5019\u88DC\u3001\u307E\u305F\u306F\u53D6\u5F97\u5236\u9650\u304C\u3042\u308A\u307E\u3059\u3002\u6761\u4EF6\u5408\u683C\u5019\u88DC\u3068\u3057\u3066\u306F\u8FFD\u8A18\u3057\u3066\u3044\u307E\u305B\u3093\u3002`, siteResult.manualUrl);
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
      memos.push(`${site.label}: \u81EA\u52D5\u5224\u5B9A\u4E0D\u53EF \u624B\u52D5\u78BA\u8A8DURL ${siteResult.manualUrl}`);
      writeResearchCheck_(rowData, '\u8981\u78BA\u8A8D', `${site.label}: \u4FA1\u683C\u30FB\u9001\u6599\u30FB\u72B6\u614B\u306E\u3044\u305A\u308C\u304B\u3092\u81EA\u52D5\u5224\u5B9A\u3067\u304D\u306A\u3044\u5019\u88DC\u3001\u307E\u305F\u306F\u53D6\u5F97\u5236\u9650\u304C\u3042\u308A\u307E\u3059\u3002\u6761\u4EF6\u5408\u683C\u5019\u88DC\u3068\u3057\u3066\u306F\u8FFD\u8A18\u3057\u3066\u3044\u307E\u305B\u3093\u3002`, siteResult.manualUrl);
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
  const unknownOtherCondition = otherItems.find((item) => isUnknownResearchCondition_(item.condition));
  if (addedOther > 0 && unknownOtherCondition) {
    needsReview = true;
    memos.push(`${unknownOtherCondition.siteLabel || unknownOtherCondition.site}: \u72B6\u614B\u8981\u78BA\u8A8D ${unknownOtherCondition.url}`);
    writeResearchCheck_(
      rowData,
      '\u8981\u78BA\u8A8D',
      `${unknownOtherCondition.siteLabel || unknownOtherCondition.site}: \u691C\u7D22\u7D50\u679C\u3067\u72B6\u614B\u3092\u81EA\u52D5\u5224\u5B9A\u3067\u304D\u306A\u3044\u305F\u3081\u3001\u5019\u88DCURL\u3067\u72B6\u614B\u78BA\u8A8D\u304C\u5FC5\u8981\u3067\u3059\u3002`,
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
      extra.push(broadTitle, `${broadTitle} \u5168\u5DFB`, `${broadTitle} \u30EC\u30F3\u30BF\u30EB`, `${broadTitle} DVD`);
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

function fetchSearchResults_(site, url, keyword, maxPrice, rowData) {
  if (isResearchDeadlineReached_(rowData)) {
    return { ok: true, items: [], rejectedForMissingData: 0 };
  }
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
    const extracted = extractCandidateItems_(String(response.getContentText() || ''), site, keyword);
    const enriched = enrichSearchResultsFromProductPages_(extracted, site, keyword, rowData || {});
    enriched.items = enriched.items.filter((item) => isCompatibleResearchProductCandidate_(item, rowData || {}, keyword));
    return enriched;
  } catch (error) {
    return { ok: false, items: [], rejectedForMissingData: 0 };
  }
}

