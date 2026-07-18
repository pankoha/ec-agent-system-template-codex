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
            writeSynchronizationCheck_(spreadsheet, '売り切れ候補削除', orderNumberFromRow_(sheet.getRange(row, 1, 1, sheet.getLastColumn()).getValues()[0], columns), `${url} を削除しました（${inspected.reason || '販売終了'}）。`);
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
        appendUniqueMemo_(sheet, row, columns.memo, '候補URLの取得失敗があるため、削除せず手動確認対象として保持しました。');
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
    const inspected = inspections[selectedIndex] || { availability: 'unknown', reason: '確認結果なし' };
    if (inspected.availability === 'unavailable') {
      summary.removed += 1;
      summary.removals.push({ row: reference.row, column: reference.column, url: reference.url, reason: inspected.reason || '' });
      if (applyChanges) {
        const key = `${reference.row}:${reference.column}`;
        if (!removalsByCell[key]) removalsByCell[key] = { reference, blockIndexes: {} };
        removalsByCell[key].blockIndexes[reference.blockIndex] = true;
        affectedRows[reference.row] = true;
        writeSynchronizationCheck_(spreadsheet, '売り切れ候補削除', orderNumberFromRow_(sheet.getRange(reference.row, 1, 1, sheet.getLastColumn()).getValues()[0], columns), `${reference.url} を削除しました（${inspected.reason || '販売終了'}）。`);
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
  const accessoryTerms = '(?:水タンク|タンク|カバー|フィルター|リモコン|アダプター|コード|ケーブル|ホース|ノズル|ケース|キャップ|ふた|蓋|部品|パーツ|替え|交換品|消耗品)';
  return new RegExp(`(?:用|専用|対応|交換用).{0,24}${accessoryTerms}|${accessoryTerms}.{0,16}(?:用|専用|対応|交換|部品|パーツ|純正)`, 'i').test(text);
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
  const tokens = normalizedKeyword.split(/\s+/).filter((token) => token.length >= 2 && !/^(全|全巻|レンタル)$/.test(token));
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
    .filter((token) => token.length >= 2 && !/^(全|全巻|巻|セット|レンタル|落ち|dvd|中古)$/.test(token));
  return tokens.length ? tokens.filter((token) => normalizedTitle.indexOf(token) >= 0).length >= Math.ceil(tokens.length / 2) : false;
}

function broadDvdResearchTitle_(value) {
  return toHalfWidthNumber_(String(value || ''))
    .replace(/[【】]/g, ' ')
    .replace(/\[[^\]]*(?:レンタル落ち|レンタル用|マーケットプレイスDVDセット商品|DVD|Blu-ray|ブルーレイ|中古|セット商品)[^\]]*\]/gi, ' ')
    .replace(/[（(][^)）]*(?:全\s*[0-9]+\s*(?:枚|巻)|全巻|DVD|Blu-ray|ブルーレイ|レンタル落ち|レンタル用)[^)）]*[)）]/gi, ' ')
    .replace(/[0-9]+\s*[〜～~ー－-]\s*[0-9]+/g, ' ')
    .replace(/全\s*[0-9]+\s*(?:枚|巻)\s*セット?/g, ' ')
    .replace(/全巻セット|全巻|レンタル落ち|レンタル用|マーケットプレイスDVDセット商品/gi, ' ')
    .replace(/Blu-ray|ブルーレイ|DVD|中古|セット商品/gi, ' ')
    .replace(/[（(][^)）]*[)）]/g, ' ')
    .split(/\s*\+\s*/)[0]
    .replace(/\s+/g, ' ')
    .trim();
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
