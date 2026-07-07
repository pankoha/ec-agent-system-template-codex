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

