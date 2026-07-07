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
    // \u6307\u793A\u66F816\u30FB31: \u9001\u6599\u4E0D\u660E\u6642\u306F\u5546\u54C1\u4FA1\u683C\u3060\u3051\u3067\u4EEE\u5224\u5B9A\u3057\u3001
    // \u51FA\u529B\u5074\u3067\u300C\u9001\u6599\u8981\u78BA\u8A8D\u300D\u3092\u660E\u8A18\u3059\u308B\u3002
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
    // \u6307\u793A\u66F819: \u30B8\u30E2\u30C6\u30A3\u306F\u30B8\u30E3\u30F3\u30AF\u7B49\u306E\u9664\u5916\u8A9E\u304C\u306A\u3051\u308C\u3070\u5019\u88DC\u5316\u3067\u304D\u308B\u3002
    // \u30B8\u30E3\u30F3\u30AF\u30FB\u8CA9\u58F2\u7D42\u4E86\u306E\u5224\u5B9A\u306F\u547C\u3073\u51FA\u3057\u5143\u3067\u5148\u306B\u5B9F\u65BD\u6E08\u307F\u3002
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
  return new RegExp(`\u5168\\s*${expectedVolume}\\s*\u5DFB|${expectedVolume}\\s*\u5DFB\\s*\u30BB\u30C3\u30C8|\u5168\u5DFB`).test(half);
}

function isRejectedDvdPaperGoods_(text) {
  return /\u30D7\u30EC\u30B9\u30D6\u30C3\u30AF|\u30D7\u30EC\u30B9\u30B7\u30FC\u30C8|\u30D1\u30F3\u30D5\u30EC\u30C3\u30C8|\u30D1\u30F3\u30D5\b|\u30C1\u30E9\u30B7|\u3061\u3089\u3057|\u30D5\u30E9\u30A4\u30E4\u30FC|\u6620\u753B\u534A\u5238|\u534A\u5238/i.test(String(text || ''));
}

function expectedVolumeCount_(text) {
  const half = toHalfWidthNumber_(String(text || ''));
  const match = half.match(/\u5168\s*([0-9]+)\s*\u5DFB|([0-9]+)\s*\u5DFB\s*\u30BB\u30C3\u30C8/);
  return Number((match && (match[1] || match[2])) || 0);
}

function buildAmazonAsinResearchLines_(rowData) {
  const asin = extractAmazonAsinFromResearchRow_(rowData);
  if (!asin) {
    return [];
  }
  return [`ASIN\u78BA\u8A8DURL ${asin}\nhttps://www.amazon.co.jp/dp/${asin}`];
}

function extractAmazonAsinFromResearchRow_(rowData) {
  const text = [
    rowData && rowData.orderInfo,
    rowData && rowData.sku,
    rowData && rowData.productName,
  ].filter(Boolean).join('\n');
  const patterns = [
    /\bASIN\s*[:\uFF1A]\s*([A-Z0-9]{10})\b/i,
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
  Logger.log(`\u5019\u88DCURL\u306E\u8FFD\u8A18\u5148\u306F${RESEARCH_AUTOMATION_CONFIG.sheetName}\u306E\u307F\u306B\u9650\u5B9A\u3057\u3066\u3044\u308B\u305F\u3081\u3001\u30E1\u30A4\u30F3\u30B7\u30FC\u30C8\u3078\u306E\u8FFD\u8A18\u306F\u30B9\u30AD\u30C3\u30D7\u3057\u307E\u3057\u305F\u3002`);
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
  const priceParts = text.match(/([0-9\uFF10-\uFF19,\uFF0C]+)\s*\u5186/g) || [];
  const prices = priceParts
    .map((part) => Number(toHalfWidthNumber_(part).replace(/[^\d]/g, '')))
    .filter((price) => price > 0);
  const shippingKnown = /\u9001\u6599\u8981\u78BA\u8A8D/.test(text) ? false : prices.length > 1 || /\u9001\u6599\u7121\u6599/.test(text);
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
  return 0;
}

function shippingNear_(html) {
  const text = stripResearchHtml_(html);
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

function matchesResearchKeyword_(title, keyword) {
  const normalizedTitle = normalizeResearchText_(title);
  const normalizedKeyword = normalizeResearchText_(keyword);
  const modelTokens = normalizedKeyword.match(/[a-z]{1,8}[a-z0-9-]*[0-9][a-z0-9-]*/g) || [];
  if (modelTokens.length) {
    return modelTokens.some((token) => normalizedTitle.indexOf(token) >= 0);
  }
  const tokens = normalizedKeyword.split(/\s+/).filter((token) => token.length >= 2 && !/^(\u5168|\u5168\u5DFB|\u30EC\u30F3\u30BF\u30EB)$/.test(token));
  return tokens.length ? tokens.filter((token) => normalizedTitle.indexOf(token) >= 0).length >= Math.ceil(tokens.length / 2) : false;
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

