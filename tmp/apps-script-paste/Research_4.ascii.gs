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
  const title = shortenResearchTitle_(item.title || item.siteLabel || item.site || '\u5019\u88DC');
  const price = `${Number(item.price).toLocaleString('ja-JP')}\u5186`;
  const shipping = item.shippingKnown
    ? (item.shipping ? `+${Number(item.shipping).toLocaleString('ja-JP')}\u5186` : '+\u9001\u6599\u7121\u6599')
    : ' \u9001\u6599\u8981\u78BA\u8A8D';
  const condition = item.condition ? ` ${item.condition}` : '';
  const prefix = includeSiteName ? `${item.siteLabel || item.site} ` : '';
  return `${prefix}${title}  ${price}${shipping}${condition}\n${item.url}`;
}

function shortenResearchTitle_(title) {
  return String(title || '')
    .replace(/\s+/g, ' ')
    .replace(/\s*[|\uFF5C].*$/, '')
    .trim()
    .slice(0, 42);
}

function normalizeResearchProductUrl_(rawUrl, siteName) {
  let url = decodeResearchHtml_(String(rawUrl || '')).trim();
  url = url.replace(/\\u002F/g, '/').replace(/\\\//g, '/');
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
      YahooFleamarket: 'https://paypayfleamarket.yahoo.co.jp',
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

  // A matching domain substring in a query/path is not proof of the URL's host.
  // This list also prevents external sites from being fetched under a trusted label.
  const allowedHosts = {
    Amazon: ['www.amazon.co.jp', 'amazon.co.jp'],
    Yahoo: ['page.auctions.yahoo.co.jp', 'auctions.yahoo.co.jp'],
    YahooFleamarket: ['paypayfleamarket.yahoo.co.jp'],
    Mercari: ['jp.mercari.com'],
    Jimoty: ['jmty.jp', 'www.jmty.jp'],
    Rakuten: ['item.rakuten.co.jp'],
    Surugaya: ['www.suruga-ya.jp', 'suruga-ya.jp'],
    Offmall: ['netmall.hardoff.co.jp'],
    SecondStreet: ['www.2ndstreet.jp', '2ndstreet.jp'],
    NetOff: ['www.netoff.co.jp', 'netoff.co.jp'],
  };
  const authority = url.match(/^https:\/\/([^/?#]+)(?:[/?#]|$)/i);
  if (!authority || !allowedHosts[siteName] ||
      !allowedHosts[siteName].includes(authority[1].toLowerCase())) {
    return '';
  }

  let match;
  if (siteName === 'Amazon' && (match = url.match(/\/(?:dp|gp\/product)\/([A-Z0-9]{10})/i))) {
    return `https://www.amazon.co.jp/dp/${match[1].toUpperCase()}`;
  }
  if (siteName === 'Yahoo' && (match = url.match(/auctions\.yahoo\.co\.jp\/jp\/auction\/([A-Za-z0-9]+)/i))) {
    return `https://page.auctions.yahoo.co.jp/jp/auction/${match[1]}`;
  }
  if ((siteName === 'Yahoo' || siteName === 'YahooFleamarket') && (match = url.match(/paypayfleamarket\.yahoo\.co\.jp\/item\/([A-Za-z0-9_-]+)/i))) {
    return `https://paypayfleamarket.yahoo.co.jp/item/${match[1]}`;
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
  const siteNames = ['Amazon', 'Yahoo', 'YahooFleamarket', 'Mercari', 'Jimoty', 'Rakuten', 'Surugaya', 'Offmall', 'SecondStreet', 'NetOff'];
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
    /([0-9]{1,3}(?:,[0-9]{3})+|[0-9]{2,7})\s*\u5186/i,
  ];
  for (let index = 0; index < textPatterns.length; index += 1) {
    const match = text.match(textPatterns[index]);
    if (match) {
      return Number(String(match[1]).replace(/,/g, '')) || 0;
    }
  }
  const yenMatch = text.match(/([0-9]{1,3}(?:,[0-9]{3})+|[0-9]{2,7})\s*\u5186/);
  if (yenMatch) {
    return Number(String(yenMatch[1]).replace(/,/g, '')) || 0;
  }
  return 0;
}

function dryRunUnavailableResearchCleanup() {
  return cleanupUnavailableResearchResults_(getTargetSpreadsheet_(), false, true);
}

function applyUnavailableResearchCleanup() {
  return cleanupUnavailableResearchResults_(getTargetSpreadsheet_(), true, true);
}

function startDryRunUnavailableResearchCleanupAuto() {
  resetUnavailableResearchCleanupTrigger_('continueDryRunUnavailableResearchCleanupAuto');
  ScriptApp.newTrigger('continueDryRunUnavailableResearchCleanupAuto').timeBased().everyMinutes(1).create();
  return continueDryRunUnavailableResearchCleanupAuto();
}

function continueDryRunUnavailableResearchCleanupAuto() {
  return continueUnavailableResearchCleanupAuto_('continueDryRunUnavailableResearchCleanupAuto', false);
}

function startApplyUnavailableResearchCleanupAuto() {
  resetUnavailableResearchCleanupTrigger_('continueApplyUnavailableResearchCleanupAuto');
  ScriptApp.newTrigger('continueApplyUnavailableResearchCleanupAuto').timeBased().everyMinutes(1).create();
  return continueApplyUnavailableResearchCleanupAuto();
}

function continueApplyUnavailableResearchCleanupAuto() {
  return continueUnavailableResearchCleanupAuto_('continueApplyUnavailableResearchCleanupAuto', true);
}

function continueUnavailableResearchCleanupAuto_(handlerName, applyChanges) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(1000)) {
    return { applyChanges: !!applyChanges, skipped: true, reason: 'another cleanup run is active' };
  }
  try {
    const result = cleanupUnavailableResearchResults_(getTargetSpreadsheet_(), !!applyChanges, true);
    if (result.completed) resetUnavailableResearchCleanupTrigger_(handlerName);
    return result;
  } finally {
    lock.releaseLock();
  }
}

function resetUnavailableResearchCleanupTrigger_(handlerName) {
  ScriptApp.getProjectTriggers().forEach((trigger) => {
    if (trigger.getHandlerFunction() === handlerName) ScriptApp.deleteTrigger(trigger);
  });
}

function cleanupUnavailableResearchResults_(spreadsheet, applyChanges, useSavedCursor) {
  if (useSavedCursor) {
    return cleanupUnavailableResearchBatch_(spreadsheet, applyChanges);
  }
  const sheet = spreadsheet.getSheetByName(RESEARCH_AUTOMATION_CONFIG.sheetName);
  if (!sheet || sheet.getLastRow() < 2) {
    return { applyChanges: !!applyChanges, inspected: 0, removed: 0, unknown: 0, removals: [] };
  }
  const columns = researchColumnMap_(sheet);
  const resultColumns = RESEARCH_RESULT_KEYS.map((key) => columns[key]).filter(Boolean);
  const propertyKey = `UNAVAILABLE_RESEARCH_CLEANUP_CURSOR_${applyChanges ? 'APPLY' : 'DRY_RUN'}`;
  const properties = useSavedCursor ? PropertiesService.getScriptProperties() : null;
  const savedCursor = properties ? JSON.parse(properties.getProperty(propertyKey) || '{}') : {};
  const startedAt = Date.now();
  const deadlineMs = startedAt + (4 * 60 * 1000);
  const maxCellsPerRun = 6;
  let processedCells = 0;
  let startRow = Math.max(2, Number(savedCursor.row) || 2);
  let startColumnIndex = Math.max(0, Number(savedCursor.columnIndex) || 0);
  const summary = { applyChanges: !!applyChanges, inspected: 0, removed: 0, unknown: 0, removals: [], completed: false, nextRow: startRow, nextColumnIndex: startColumnIndex };
  for (let row = startRow; row <= sheet.getLastRow(); row += 1) {
    let rowUnknown = false;
    const firstColumnIndex = row === startRow ? startColumnIndex : 0;
    for (let columnIndex = firstColumnIndex; columnIndex < resultColumns.length; columnIndex += 1) {
      if (processedCells >= maxCellsPerRun || Date.now() >= deadlineMs) {
        if (properties) properties.setProperty(propertyKey, JSON.stringify({ row, columnIndex }));
        summary.nextRow = row;
        summary.nextColumnIndex = columnIndex;
        Logger.log(JSON.stringify(summary));
        return summary;
      }
      const column = resultColumns[columnIndex];
      const cell = sheet.getRange(row, column);
      const current = String(cell.getValue() || '');
      processedCells += 1;
      if (!current) continue;
      const kept = [];
      splitResearchResultBlocks_(current).forEach((block) => {
        const url = canonicalResearchUrl_((String(block).match(/https?:\/\/\S+/) || [''])[0]);
        if (!url) {
          kept.push(block);
          return;
        }
        summary.inspected += 1;
        const inspected = inspectResearchUrlAvailability_(url);
        if (inspected.availability === 'unavailable') {
          summary.removed += 1;
          summary.removals.push({ row, column, url, reason: inspected.reason || '' });
          if (applyChanges) {
            writeSynchronizationCheck_(spreadsheet, '\u58F2\u308A\u5207\u308C\u5019\u88DC\u524A\u9664', orderNumberFromRow_(sheet.getRange(row, 1, 1, sheet.getLastColumn()).getValues()[0], columns), `${url} \u3092\u524A\u9664\u3057\u307E\u3057\u305F\uFF08${inspected.reason || '\u8CA9\u58F2\u7D42\u4E86'}\uFF09\u3002`);
          }
          return;
        }
        if (inspected.availability === 'unknown') {
          summary.unknown += 1;
          rowUnknown = true;
        }
        kept.push(block);
      });
      if (applyChanges && kept.join('\n') !== current) {
        cell.setValue(kept.join('\n')).setWrap(true);
      }
    }
    if (applyChanges) {
      const hasCandidates = rowHasResearchCandidates_(sheet, row, columns);
      setManagedResearchStatusAtColumn_(sheet, row, columns.status, rowUnknown ? RESEARCH_STATUS.review : (hasCandidates ? RESEARCH_STATUS.found : RESEARCH_STATUS.empty));
      if (rowUnknown && columns.memo) {
        appendUniqueMemo_(sheet, row, columns.memo, '\u5019\u88DCURL\u306E\u53D6\u5F97\u5931\u6557\u304C\u3042\u308B\u305F\u3081\u3001\u524A\u9664\u305B\u305A\u624B\u52D5\u78BA\u8A8D\u5BFE\u8C61\u3068\u3057\u3066\u4FDD\u6301\u3057\u307E\u3057\u305F\u3002');
      }
    }
  }
  if (properties) properties.deleteProperty(propertyKey);
  summary.completed = true;
  summary.nextRow = null;
  summary.nextColumnIndex = null;
  Logger.log(JSON.stringify(summary));
  return summary;
}

function cleanupUnavailableResearchBatch_(spreadsheet, applyChanges) {
  const sheet = spreadsheet.getSheetByName(RESEARCH_AUTOMATION_CONFIG.sheetName);
  if (!sheet || sheet.getLastRow() < 2) {
    return { applyChanges: !!applyChanges, inspected: 0, removed: 0, unknown: 0, removals: [], completed: true };
  }
  const columns = researchColumnMap_(sheet);
  const resultColumns = RESEARCH_RESULT_KEYS.map((key) => columns[key]).filter(Boolean);
  const references = [];
  for (let row = 2; row <= sheet.getLastRow(); row += 1) {
    resultColumns.forEach((column) => {
      const current = String(sheet.getRange(row, column).getValue() || '');
      splitResearchResultBlocks_(current).forEach((block, blockIndex) => {
        const url = canonicalResearchUrl_((String(block).match(/https?:\/\/\S+/) || [''])[0]);
        if (url) references.push({ row, column, blockIndex, url, current });
      });
    });
  }
  const propertyKey = `UNAVAILABLE_RESEARCH_CLEANUP_REVERSE_CURSOR_${applyChanges ? 'APPLY' : 'DRY_RUN'}`;
  const properties = PropertiesService.getScriptProperties();
  const savedCursorValue = properties.getProperty(propertyKey);
  const endIndex = savedCursorValue !== null
    ? Math.min(Math.max(0, Number(savedCursorValue) || 0), references.length)
    : references.length;
  const startIndex = Math.max(0, endIndex - 100);
  const selected = references.slice(startIndex, endIndex);
  const summary = { applyChanges: !!applyChanges, inspected: 0, removed: 0, unknown: 0, removals: [], completed: startIndex === 0, remaining: startIndex };
  const removalsByCell = {};
  const affectedRows = {};
  // Advance before external requests so one permanently slow URL cannot stall every later batch.
  // A timed-out batch is treated conservatively as unknown and its sheet values remain unchanged.
  properties.setProperty(propertyKey, String(startIndex));
  const inspections = inspectResearchUrlsAvailability_(selected.map((reference) => reference.url));
  selected.forEach((reference, selectedIndex) => {
    summary.inspected += 1;
    const inspected = inspections[selectedIndex] || { availability: 'unknown', reason: '\u78BA\u8A8D\u7D50\u679C\u306A\u3057' };
    if (inspected.availability === 'unavailable') {
      summary.removed += 1;
      summary.removals.push({ row: reference.row, column: reference.column, url: reference.url, reason: inspected.reason || '' });
      if (applyChanges) {
        const key = `${reference.row}:${reference.column}`;
        if (!removalsByCell[key]) removalsByCell[key] = { reference, blockIndexes: {} };
        removalsByCell[key].blockIndexes[reference.blockIndex] = true;
        affectedRows[reference.row] = true;
        writeSynchronizationCheck_(spreadsheet, '\u58F2\u308A\u5207\u308C\u5019\u88DC\u524A\u9664', orderNumberFromRow_(sheet.getRange(reference.row, 1, 1, sheet.getLastColumn()).getValues()[0], columns), `${reference.url} \u3092\u524A\u9664\u3057\u307E\u3057\u305F\uFF08${inspected.reason || '\u8CA9\u58F2\u7D42\u4E86'}\uFF09\u3002`);
      }
    } else if (inspected.availability === 'unknown') {
      summary.unknown += 1;
      if (applyChanges) affectedRows[reference.row] = true;
    }
  });
  Object.keys(removalsByCell).forEach((key) => {
    const entry = removalsByCell[key];
    const cell = sheet.getRange(entry.reference.row, entry.reference.column);
    const blocks = splitResearchResultBlocks_(String(cell.getValue() || ''));
    cell.setValue(blocks.filter((block, index) => !entry.blockIndexes[index]).join('\n')).setWrap(true);
  });
  if (applyChanges) {
    Object.keys(affectedRows).forEach((rowKey) => {
      const row = Number(rowKey);
      const hasCandidates = rowHasResearchCandidates_(sheet, row, columns);
      setManagedResearchStatusAtColumn_(sheet, row, columns.status, hasCandidates ? RESEARCH_STATUS.found : RESEARCH_STATUS.empty);
    });
  }
  if (summary.completed) properties.deleteProperty(propertyKey);
  else properties.setProperty(propertyKey, String(startIndex));
  Logger.log(JSON.stringify(summary));
  return summary;
}

function shippingNear_(html) {
  const text = stripResearchHtml_(html);
  if (/\u9001\u6599\u7121\u6599|\u9001\u6599\s*(?:\u306F)?\s*0\s*\u5186/.test(text)) {
    return { known: true, amount: 0 };
  }
  const japaneseMatch = text.match(/(?:\u9001\u6599|\u914D\u9001\u6599)[^\d]{0,15}([0-9]{1,3}(?:,[0-9]{3})+|[0-9]{2,6})\s*\u5186/);
  if (japaneseMatch) {
    return { known: true, amount: Number(japaneseMatch[1].replace(/,/g, '')) || 0 };
  }
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
  return siteName === 'Rakuten' ? '' : '\u72B6\u614B\u8981\u78BA\u8A8D';
}

function isUnknownResearchCondition_(condition) {
  return /\u72B6\u614B\u8981\u78BA\u8A8D/.test(String(condition || ''));
}

function isCompatibleResearchProductCandidate_(item, rowData, keyword) {
  const productName = String((rowData && rowData.productName) || '').trim();
  if (!productName || !item) {
    return true;
  }
  const titleText = `${item.title || ''} ${item.contextText || ''}`;
  if (!matchesResearchKeyword_(titleText, keyword)) {
    return false;
  }
  if (isResearchAccessoryCandidateForMainProduct_(item, rowData)) {
    return false;
  }
  if (isCompatibleDvdResearchTitleCandidate_(titleText, rowData)) {
    return true;
  }

  const normalizedTitle = normalizeResearchText_(titleText);
  const normalizedProductName = normalizeResearchText_(productName);
  const productModelTokens = normalizedProductName.match(/[a-z]{1,8}[a-z0-9-]*[0-9][a-z0-9-]*/g) || [];
  const strongModelTokens = productModelTokens.filter((token) => token.length >= 5);
  if (strongModelTokens.some((token) => normalizedTitle.indexOf(token) >= 0)) {
    return true;
  }

  const keywordModelTokens = normalizeResearchText_(keyword).match(/[a-z]{1,8}[a-z0-9-]*[0-9][a-z0-9-]*/g) || [];
  const onlyShortKeywordModelMatched = keywordModelTokens.length > 0
    && keywordModelTokens.every((token) => token.length <= 4)
    && keywordModelTokens.some((token) => normalizedTitle.indexOf(token) >= 0);
  const productTerms = significantResearchProductTerms_(productName);
  const matchedTerms = productTerms.filter((term) => normalizedTitle.indexOf(term) >= 0);

  if (onlyShortKeywordModelMatched) {
    return matchedTerms.length >= 1;
  }
  if (productTerms.length >= 3) {
    return matchedTerms.length >= 2;
  }
  return matchedTerms.length >= Math.max(1, Math.ceil(productTerms.length / 2));
}

function isResearchAccessoryCandidateForMainProduct_(item, rowData) {
  const productName = String((rowData && rowData.productName) || '');
  const title = String((item && item.title) || '');
  if (!title || isResearchAccessoryLikeTitle_(productName)) {
    return false;
  }
  return isResearchAccessoryLikeTitle_(title);
}

function isCompatibleDvdResearchTitleCandidate_(titleText, rowData) {
  if (!rowData || !rowData.isDvd) {
    return false;
  }
  const productTitle = broadDvdResearchTitle_(rowData.productName);
  const candidateTitle = broadDvdResearchTitle_(titleText);
  if (!productTitle || !candidateTitle) {
    return false;
  }
  return normalizeResearchText_(candidateTitle).indexOf(normalizeResearchText_(productTitle)) >= 0
    || normalizeResearchText_(productTitle).indexOf(normalizeResearchText_(candidateTitle)) >= 0;
}

function isResearchAccessoryLikeTitle_(value) {
  const text = toHalfWidthNumber_(String(value || '')).replace(/\s+/g, ' ').trim();
  const accessoryTerms = '(?:\u6C34\u30BF\u30F3\u30AF|\u30BF\u30F3\u30AF|\u30AB\u30D0\u30FC|\u30D5\u30A3\u30EB\u30BF\u30FC|\u30EA\u30E2\u30B3\u30F3|\u30A2\u30C0\u30D7\u30BF\u30FC|\u30B3\u30FC\u30C9|\u30B1\u30FC\u30D6\u30EB|\u30DB\u30FC\u30B9|\u30CE\u30BA\u30EB|\u30B1\u30FC\u30B9|\u30AD\u30E3\u30C3\u30D7|\u3075\u305F|\u84CB|\u90E8\u54C1|\u30D1\u30FC\u30C4|\u66FF\u3048|\u4EA4\u63DB\u54C1|\u6D88\u8017\u54C1)';
  return new RegExp(`(?:\u7528|\u5C02\u7528|\u5BFE\u5FDC|\u4EA4\u63DB\u7528).{0,24}${accessoryTerms}|${accessoryTerms}.{0,16}(?:\u7528|\u5C02\u7528|\u5BFE\u5FDC|\u4EA4\u63DB|\u90E8\u54C1|\u30D1\u30FC\u30C4|\u7D14\u6B63)`, 'i').test(text);
}

function significantResearchProductTerms_(value) {
  const normalized = normalizeResearchText_(value);
  const tokens = normalized
    .split(/\s+/)
    .filter((token) => token.length >= 3)
    .filter((token) => !/^(the|and|with|for|set|style|type|dvd|led|new|used)$/.test(token))
    .filter((token) => !/^[0-9]+$/.test(token))
    .filter((token) => !/^[a-z]?[0-9]+$/.test(token))
    .filter((token) => !/^[a-z]{1,2}$/.test(token));
  const seen = new Set();
  return tokens.filter((token) => {
    if (seen.has(token)) {
      return false;
    }
    seen.add(token);
    return true;
  });
}

function matchesResearchKeyword_(title, keyword) {
  const normalizedTitle = normalizeResearchText_(title);
  const normalizedKeyword = normalizeResearchText_(keyword);
  if (matchesPlainJapaneseResearchKeyword_(title, keyword)) {
    return true;
  }
  const modelTokens = normalizedKeyword.match(/[a-z]{1,8}[a-z0-9-]*[0-9][a-z0-9-]*/g) || [];
  if (modelTokens.length) {
    return modelTokens.some((token) => normalizedTitle.indexOf(token) >= 0);
  }
  const tokens = normalizedKeyword.split(/\s+/).filter((token) => token.length >= 2 && !/^(\u5168|\u5168\u5DFB|\u30EC\u30F3\u30BF\u30EB)$/.test(token));
  return tokens.length ? tokens.filter((token) => normalizedTitle.indexOf(token) >= 0).length >= Math.ceil(tokens.length / 2) : false;
}

function matchesPlainJapaneseResearchKeyword_(title, keyword) {
  if (String(keyword || '').match(/[A-Za-z]{1,8}[A-Za-z0-9-]*[0-9][A-Za-z0-9-]*/)) {
    return false;
  }
  const normalizedTitle = toHalfWidthNumber_(String(title || '')).toLowerCase();
  const normalizedKeyword = toHalfWidthNumber_(String(keyword || '')).toLowerCase();
  if (!/[\u3040-\u30ff\u3400-\u9fff]/.test(normalizedTitle + normalizedKeyword)) {
    return false;
  }
  const tokens = normalizedKeyword
    .replace(/[^\u3040-\u30ff\u3400-\u9fffA-Za-z0-9]+/g, ' ')
    .split(/\s+/)
    .filter((token) => token.length >= 2 && !/^(\u5168|\u5168\u5DFB|\u5DFB|\u30BB\u30C3\u30C8|\u30EC\u30F3\u30BF\u30EB|\u843D\u3061|dvd|\u4E2D\u53E4)$/.test(token));
  return tokens.length ? tokens.filter((token) => normalizedTitle.indexOf(token) >= 0).length >= Math.ceil(tokens.length / 2) : false;
}

function broadDvdResearchTitle_(value) {
  return toHalfWidthNumber_(String(value || ''))
    .replace(/[\u3010\u3011]/g, ' ')
    .replace(/\[[^\]]*(?:\u30EC\u30F3\u30BF\u30EB\u843D\u3061|\u30EC\u30F3\u30BF\u30EB\u7528|\u30DE\u30FC\u30B1\u30C3\u30C8\u30D7\u30EC\u30A4\u30B9DVD\u30BB\u30C3\u30C8\u5546\u54C1|DVD|Blu-ray|\u30D6\u30EB\u30FC\u30EC\u30A4|\u4E2D\u53E4|\u30BB\u30C3\u30C8\u5546\u54C1)[^\]]*\]/gi, ' ')
    .replace(/[\uFF08(][^)\uFF09]*(?:\u5168\s*[0-9]+\s*(?:\u679A|\u5DFB)|\u5168\u5DFB|DVD|Blu-ray|\u30D6\u30EB\u30FC\u30EC\u30A4|\u30EC\u30F3\u30BF\u30EB\u843D\u3061|\u30EC\u30F3\u30BF\u30EB\u7528)[^)\uFF09]*[)\uFF09]/gi, ' ')
    .replace(/[0-9]+\s*[\u301C\uFF5E~\u30FC\uFF0D-]\s*[0-9]+/g, ' ')
    .replace(/\u5168\s*[0-9]+\s*(?:\u679A|\u5DFB)\s*\u30BB\u30C3\u30C8?/g, ' ')
    .replace(/\u5168\u5DFB\u30BB\u30C3\u30C8|\u5168\u5DFB|\u30EC\u30F3\u30BF\u30EB\u843D\u3061|\u30EC\u30F3\u30BF\u30EB\u7528|\u30DE\u30FC\u30B1\u30C3\u30C8\u30D7\u30EC\u30A4\u30B9DVD\u30BB\u30C3\u30C8\u5546\u54C1/gi, ' ')
    .replace(/Blu-ray|\u30D6\u30EB\u30FC\u30EC\u30A4|DVD|\u4E2D\u53E4|\u30BB\u30C3\u30C8\u5546\u54C1/gi, ' ')
    .replace(/[\uFF08(][^)\uFF09]*[)\uFF09]/g, ' ')
    .split(/\s*\+\s*/)[0]
    .replace(/\s+/g, ' ')
    .trim();
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
