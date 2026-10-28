function enrichSearchResultsFromProductPages_(extracted, site, keyword, rowData) {
  const items = [];
  const seen = new Set();
  const sourceItems = (extracted.items || []).concat(extracted.needsDetail || []);
  let rejectedForAvailability = 0;
  const detailFetchLimit = site.key === 'Rakuten' ? 18 : 12;

  sourceItems.slice(0, detailFetchLimit).forEach((item) => {
    if (isResearchDeadlineReached_(rowData || {})) {
      rejectedForAvailability += 1;
      return;
    }
    const canonicalUrl = canonicalResearchUrl_(item.url) || item.url;
    if (!canonicalUrl || seen.has(canonicalUrl)) {
      return;
    }
    seen.add(canonicalUrl);
    const detail = fetchResearchProductDetail_(item, site, keyword);
    if (detail.availability === 'available' && detail.item && detail.item.price) {
      items.push(detail.item);
    } else {
      rejectedForAvailability += 1;
    }
  });
  rejectedForAvailability += Math.max(0, sourceItems.length - detailFetchLimit);

  return {
    ok: extracted.ok,
    items,
    rejectedForMissingData: (extracted.rejectedForMissingData || 0) + rejectedForAvailability,
  };
}

function shouldFetchResearchProductDetail_(item, site, rowData) {
  if (!item || !item.url) {
    return false;
  }
  if (!item.price) {
    return true;
  }
  const text = `${item.title || ''} ${item.condition || ''} ${item.contextText || ''}`;
  return site.key === 'Rakuten'
    && rowData
    && rowData.isDvd
    && rowData.expectedVolume
    && !isCompleteDvdCandidate_(text, rowData.expectedVolume);
}

function fetchResearchProductDetail_(item, site, keyword) {
  const inspected = inspectResearchUrlAvailability_(item.url);
  if (inspected.availability !== 'available') {
    return inspected;
  }
  try {
    const html = inspected.html;
    const title = extractResearchDetailTitle_(html) || item.title || '';
    if (!title || !matchesResearchKeyword_(title, keyword)) {
      return { availability: 'unknown', status: inspected.status };
    }
    const shipping = shippingNear_(html);
    return { availability: 'available', status: inspected.status, item: {
      site: item.site,
      siteLabel: item.siteLabel,
      title,
      url: item.url,
      price: priceNear_(html) || item.price || 0,
      shipping: shipping.known ? shipping.amount : item.shipping,
      shippingKnown: shipping.known || item.shippingKnown,
      condition: conditionNear_(html, site.key) || item.condition,
      contextText: stripResearchHtml_(html).slice(0, 8000),
      availability: 'available',
    } };
  } catch (error) {
    return { availability: 'unknown', error: String(error) };
  }
}

function extractCandidateItems_(html, site, keyword) {
  const items = [];
  const needsDetail = [];
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
    const forwardContext = String(html).slice(match.index, contextEnd);
    const anchorTitle = stripResearchHtml_(match[2]);
    const altTitle = extractResearchAnchorAttributeTitle_(match[0]);
    const title = (anchorTitle || altTitle || stripResearchHtml_(context).slice(0, 300)).trim();
    if (!title || !matchesResearchKeyword_(title, keyword)) {
      continue;
    }
    seen.add(url);

    const price = priceNear_(forwardContext) || priceNear_(context);
    const shipping = shippingNear_(forwardContext);
    const condition = conditionNear_(forwardContext, site.key);
    if (!price) {
      needsDetail.push({
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

  extractLinkedTextCandidateItems_(html, site, keyword, seen).forEach((item) => {
    if (items.length >= 40) {
      return;
    }
    if (!item.price) {
      needsDetail.push(item);
      return;
    }
    items.push(item);
  });
  extractStructuredCandidateItems_(html, site, keyword, seen).forEach((item) => {
    if (items.length >= 40) {
      return;
    }
    if (!item.price) {
      needsDetail.push(item);
      return;
    }
    items.push(item);
  });
  extractUrlOnlyCandidateItems_(html, site, keyword, seen).forEach((item) => {
    if (items.length + needsDetail.length >= 60) {
      return;
    }
    if (!item.price) {
      needsDetail.push(item);
      return;
    }
    items.push(item);
  });

  return { ok: true, items, needsDetail, rejectedForMissingData };
}

function extractLinkedTextCandidateItems_(html, site, keyword, seen) {
  const items = [];
  const htmlText = String(html || '').replace(/\\u002F/g, '/').replace(/\\\//g, '/');
  const escapedUrlPattern = /https?:\/\/[^"'\s<>]+/gi;
  let match;
  while ((match = escapedUrlPattern.exec(htmlText)) !== null && items.length < 40) {
    const rawUrl = match[0];
    const url = normalizeResearchProductUrl_(rawUrl, site.key);
    if (!url || seen.has(url) || !site.resultHost.test(url)) {
      continue;
    }
    const contextStart = Math.max(0, match.index - 1600);
    const contextEnd = Math.min(htmlText.length, match.index + match[0].length + 5200);
    const context = htmlText.slice(contextStart, contextEnd);
    const forwardContext = htmlText.slice(match.index, contextEnd);
    const title = extractResearchJsonTitleNear_(context);
    if (!title || !matchesResearchKeyword_(title, keyword)) {
      continue;
    }
    seen.add(url);
    items.push({
      site: site.key,
      siteLabel: site.label,
      title,
      url,
      price: priceNear_(forwardContext) || priceNear_(context),
      shipping: shippingNear_(forwardContext).amount,
      shippingKnown: shippingNear_(forwardContext).known,
      condition: conditionNear_(forwardContext, site.key),
      contextText: stripResearchHtml_(context),
    });
  }
  return items;
}

function extractStructuredCandidateItems_(html, site, keyword, seen) {
  const items = [];
  const htmlText = normalizeResearchEscapedText_(html);
  const objectPattern = /\{[^{}]{0,3000}\}/g;
  let match;
  while ((match = objectPattern.exec(htmlText)) !== null && items.length < 40) {
    const objectText = match[0];
    const title = extractResearchJsonTitleNear_(objectText);
    if (!title || !matchesResearchKeyword_(title, keyword)) {
      continue;
    }
    const url = extractResearchStructuredUrl_(objectText, site.key);
    if (!url || seen.has(url) || !site.resultHost.test(url)) {
      continue;
    }
    seen.add(url);
    items.push({
      site: site.key,
      siteLabel: site.label,
      title,
      url,
      price: priceNear_(objectText),
      shipping: shippingNear_(objectText).amount,
      shippingKnown: shippingNear_(objectText).known,
      condition: conditionNear_(objectText, site.key),
      contextText: stripResearchHtml_(objectText),
    });
  }
  return items;
}

function extractUrlOnlyCandidateItems_(html, site, keyword, seen) {
  const items = [];
  const htmlText = normalizeResearchEscapedText_(html);
  const urlPattern = /https?:\/\/[^"'\s<>\\]+/gi;
  let match;
  while ((match = urlPattern.exec(htmlText)) !== null && items.length < 30) {
    const url = normalizeResearchProductUrl_(match[0], site.key);
    if (!url || seen.has(url) || !site.resultHost.test(url)) {
      continue;
    }
    const contextStart = Math.max(0, match.index - 2400);
    const contextEnd = Math.min(htmlText.length, match.index + match[0].length + 6200);
    const context = htmlText.slice(contextStart, contextEnd);
    const title = extractResearchCandidateTitleFromContext_(context, keyword);
    const contextText = stripResearchHtml_(context);
    if (!title && site.key !== 'Rakuten') {
      continue;
    }
    const matchesContext = title
      ? matchesResearchKeyword_(title, keyword)
      : matchesResearchKeyword_(contextText, keyword);
    if (!matchesContext && site.key !== 'Rakuten' && !shouldProbeUrlOnlyResearchCandidate_(site, contextText, keyword)) {
      continue;
    }
    seen.add(url);
    const forwardContext = htmlText.slice(match.index, contextEnd);
    const shipping = shippingNear_(forwardContext);
    const mustFetchDetail = !title || !matchesContext;
    items.push({
      site: site.key,
      siteLabel: site.label,
      title: title || keyword,
      url,
      price: mustFetchDetail ? 0 : (priceNear_(forwardContext) || priceNear_(context)),
      shipping: mustFetchDetail ? 0 : shipping.amount,
      shippingKnown: !mustFetchDetail && shipping.known,
      condition: mustFetchDetail ? '' : conditionNear_(forwardContext, site.key),
      contextText: mustFetchDetail ? '' : contextText,
      detailPriority: matchesContext ? 2 : 1,
    });
  }
  return items;
}

function extractResearchCandidateTitleFromContext_(context, keyword) {
  const jsonTitle = extractResearchJsonTitleNear_(context);
  if (jsonTitle) {
    return jsonTitle;
  }
  const value = normalizeResearchEscapedText_(context);
  const patterns = [
    /<h[1-3]\b[^>]*>([\s\S]{2,500}?)<\/h[1-3]>/i,
    /<img\b[^>]*(?:alt|title)=["']([^"']{2,260})["'][^>]*>/i,
    /"(?:alt|imageAlt|itemCaption|catchcopy)"\s*:\s*"([^"]{2,260})"/i,
  ];
  for (let index = 0; index < patterns.length; index += 1) {
    const match = value.match(patterns[index]);
    if (match && match[1]) {
      return stripResearchHtml_(normalizeResearchEscapedText_(match[1])).trim();
    }
  }
  return '';
}

function shouldProbeUrlOnlyResearchCandidate_(site, contextText, keyword) {
  if (!site || site.key !== 'Rakuten') {
    return false;
  }
  const normalizedContext = normalizeResearchText_(contextText);
  const normalizedKeyword = normalizeResearchText_(keyword);
  const tokens = normalizedKeyword.split(/\s+/).filter((token) => token.length >= 2);
  if (!tokens.length) {
    return false;
  }
  return tokens.some((token) => normalizedContext.indexOf(token) >= 0)
    || /item\.rakuten\.co\.jp/i.test(String(contextText || ''));
}

function extractResearchStructuredUrl_(objectText, siteName) {
  const value = normalizeResearchEscapedText_(objectText);
  const urlMatch = value.match(/"(?:url|href|itemUrl|productUrl)"\s*:\s*"([^"]+)"/i);
  if (urlMatch) {
    const url = normalizeResearchProductUrl_(urlMatch[1], siteName);
    if (url) {
      return url;
    }
  }
  if (siteName === 'Mercari') {
    const idMatch = value.match(/"(?:id|itemId|productId)"\s*:\s*"(m[0-9A-Za-z_-]+)"/i);
    if (idMatch) {
      return `https://jp.mercari.com/item/${idMatch[1]}`;
    }
  }
  if (siteName === 'YahooFleamarket') {
    const idMatch = value.match(/"(?:id|itemId|productId)"\s*:\s*"(z[0-9A-Za-z_-]+)"/i);
    if (idMatch) {
      return `https://paypayfleamarket.yahoo.co.jp/item/${idMatch[1]}`;
    }
  }
  return '';
}

function extractResearchJsonTitleNear_(context) {
  const value = normalizeResearchEscapedText_(context);
  const patterns = [
    /"(?:name|title|itemName|productName)"\s*:\s*"([^"]{2,240})"/i,
    /&quot;(?:name|title|itemName|productName)&quot;\s*:\s*&quot;([^&]{2,240})&quot;/i,
  ];
  for (let index = 0; index < patterns.length; index += 1) {
    const match = value.match(patterns[index]);
    if (match && match[1]) {
      return normalizeResearchEscapedText_(match[1]).trim();
    }
  }
  return '';
}

function extractResearchDetailTitle_(html) {
  const value = normalizeResearchEscapedText_(html);
  const patterns = [
    /<meta\b[^>]*(?:property|name)=["']og:title["'][^>]*content=["']([^"']{2,300})["'][^>]*>/i,
    /<meta\b[^>]*content=["']([^"']{2,300})["'][^>]*(?:property|name)=["']og:title["'][^>]*>/i,
    /"(?:name|title|itemName|productName)"\s*:\s*"([^"]{2,300})"/i,
    /<h1\b[^>]*>([\s\S]{2,500}?)<\/h1>/i,
    /<title\b[^>]*>([\s\S]{2,500}?)<\/title>/i,
  ];
  for (let index = 0; index < patterns.length; index += 1) {
    const match = value.match(patterns[index]);
    if (match && match[1]) {
      return stripResearchHtml_(normalizeResearchEscapedText_(match[1])).trim();
    }
  }
  return stripResearchHtml_(value).slice(0, 300).trim();
}

function normalizeResearchEscapedText_(value) {
  return decodeResearchHtml_(String(value || '')
    .replace(/\\u002F/g, '/')
    .replace(/\\\//g, '/')
    .replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16))));
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
  const zen = String.fromCharCode(0x5168);
  const kan = String.fromCharCode(0x5DFB);
  const set = String.fromCharCode(0x30BB, 0x30C3, 0x30C8);
  if (new RegExp(`${zen}\\s*${expectedVolume}\\s*${kan}|${expectedVolume}\\s*${kan}\\s*${set}|${zen}${kan}`).test(half)) {
    return true;
  }
  if (new RegExp(`\\u5168\\s*${expectedVolume}\\s*\\u5DFB|${expectedVolume}\\s*\\u5DFB\\s*\\u30BB\\u30C3\\u30C8|\\u5168\\u5DFB`).test(half)) {
    return true;
  }
  return new RegExp(`\u5168\\s*${expectedVolume}\\s*\u5DFB|${expectedVolume}\\s*\u5DFB\\s*\u30BB\u30C3\u30C8|\u5168\u5DFB`).test(half);
}

function isRejectedDvdPaperGoods_(text) {
  return /\u30D7\u30EC\u30B9\u30D6\u30C3\u30AF|\u30D7\u30EC\u30B9\u30B7\u30FC\u30C8|\u30D1\u30F3\u30D5\u30EC\u30C3\u30C8|\u30D1\u30F3\u30D5\b|\u30C1\u30E9\u30B7|\u3061\u3089\u3057|\u30D5\u30E9\u30A4\u30E4\u30FC|\u6620\u753B\u534A\u5238|\u534A\u5238/i.test(String(text || ''));
}

function expectedVolumeCount_(text) {
  const half = toHalfWidthNumber_(String(text || ''));
  const zen = String.fromCharCode(0x5168);
  const kan = String.fromCharCode(0x5DFB);
  const set = String.fromCharCode(0x30BB, 0x30C3, 0x30C8);
  const plainJapaneseMatch = half.match(new RegExp(`${zen}\\s*([0-9]+)\\s*${kan}|([0-9]+)\\s*${kan}\\s*${set}`));
  if (plainJapaneseMatch) {
    return Number(plainJapaneseMatch[1] || plainJapaneseMatch[2]) || 0;
  }
  const japaneseMatch = half.match(/\u5168\s*([0-9]+)\s*\u5DFB|([0-9]+)\s*\u5DFB\s*\u30BB\u30C3\u30C8/);
  if (japaneseMatch) {
    return Number(japaneseMatch[1] || japaneseMatch[2]) || 0;
  }
  const match = half.match(/\u5168\s*([0-9]+)\s*\u5DFB|([0-9]+)\s*\u5DFB\s*\u30BB\u30C3\u30C8/);
  return Number((match && (match[1] || match[2])) || 0);
}

function buildAmazonAsinResearchLines_(rowData) {
  const asin = extractAmazonAsinFromResearchRow_(rowData);
  if (!asin) {
    return [];
  }
  const url = `https://www.amazon.co.jp/dp/${asin}`;
  const availability = inspectResearchUrlAvailability_(url);
  if (availability.availability !== 'available') {
    return [];
  }
  return [`ASIN\u78BA\u8A8DURL ${asin}\n${url}`];
}

function inspectResearchUrlAvailability_(url) {
  const trustedUrl = canonicalResearchUrl_(url);
  if (!trustedUrl) return { availability: 'unknown', reason: '\u8A31\u53EF\u3055\u308C\u3066\u3044\u306A\u3044\u5546\u54C1URL' };
  try {
    const response = UrlFetchApp.fetch(trustedUrl, {
      muteHttpExceptions: true,
      followRedirects: false,
      headers: {
        'User-Agent': RESEARCH_AUTOMATION_CONFIG.userAgent,
        'Accept-Language': 'ja-JP,ja;q=0.9',
      },
    });
    const status = response.getResponseCode();
    if (status === 404 || status === 410) {
      return { availability: 'unavailable', status, reason: `HTTP ${status}` };
    }
    if (status < 200 || status >= 400) {
      return { availability: 'unknown', status, reason: `HTTP ${status}` };
    }
    const html = String(response.getContentText() || '');
    const text = stripResearchHtml_(html);
    if (UNAVAILABLE_PATTERN.test(text)) {
      return { availability: 'unavailable', status, reason: '\u8CA9\u58F2\u7D42\u4E86\u8868\u793A' };
    }
    return { availability: 'available', status, html };
  } catch (error) {
    return { availability: 'unknown', reason: String(error) };
  }
}

function inspectResearchUrlsAvailability_(urls) {
  const targets = (urls || []).filter(Boolean);
  if (!targets.length) return [];
  // Preserve result ordering; reject invalid targets before any batch network call.
  if (targets.some((url) => !canonicalResearchUrl_(url))) {
    return targets.map(inspectResearchUrlAvailability_);
  }
  if (!UrlFetchApp.fetchAll) return targets.map(inspectResearchUrlAvailability_);
  try {
    const responses = UrlFetchApp.fetchAll(targets.map((url) => ({
      url: canonicalResearchUrl_(url),
      muteHttpExceptions: true,
      followRedirects: false,
      headers: {
        'User-Agent': RESEARCH_AUTOMATION_CONFIG.userAgent,
        'Accept-Language': 'ja-JP,ja;q=0.9',
      },
    })));
    return responses.map((response) => {
      const status = response.getResponseCode();
      if (status === 404 || status === 410) return { availability: 'unavailable', status, reason: `HTTP ${status}` };
      if (status < 200 || status >= 400) return { availability: 'unknown', status, reason: `HTTP ${status}` };
      const html = String(response.getContentText() || '');
      const text = stripResearchHtml_(html);
      return UNAVAILABLE_PATTERN.test(text)
        ? { availability: 'unavailable', status, reason: '\u8CA9\u58F2\u7D42\u4E86\u8868\u793A' }
        : { availability: 'available', status, html };
    });
  } catch (error) {
    return targets.map(() => ({ availability: 'unknown', reason: String(error) }));
  }
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

function removeUnavailableResearchResultsFromRow_(spreadsheet, sheet, rowNumber, columns, rowData) {
  const summary = { inspected: 0, removed: 0, unknown: 0, removals: [] };
  if (!sheet || !rowNumber || !columns) {
    return summary;
  }

  RESEARCH_RESULT_KEYS.map((key) => columns[key]).filter(Boolean).forEach((columnNumber) => {
    const cell = sheet.getRange(rowNumber, columnNumber);
    const current = String(cell.getValue() || '');
    if (!current || isResearchDeadlineReached_(rowData)) {
      return;
    }

    const kept = [];
    splitResearchResultBlocks_(current).forEach((block) => {
      const url = canonicalResearchUrl_((String(block).match(/https?:\/\/\S+/) || [''])[0]);
      if (!url || isResearchDeadlineReached_(rowData)) {
        kept.push(block);
        return;
      }
      summary.inspected += 1;
      const inspected = inspectResearchUrlAvailability_(url);
      if (inspected.availability === 'unavailable') {
        summary.removed += 1;
        summary.removals.push({ row: rowNumber, column: columnNumber, url, reason: inspected.reason || '' });
        writeSynchronizationCheck_(
          spreadsheet,
          '\u58F2\u308A\u5207\u308C\u5019\u88DC\u524A\u9664',
          rowData && rowData.orderNumber ? rowData.orderNumber : '',
          `${url} \u3092\u524A\u9664\u3057\u307E\u3057\u305F\uFF08${inspected.reason || '\u8CA9\u58F2\u7D42\u4E86'}\uFF09`,
        );
        return;
      }
      if (inspected.availability === 'unknown') {
        summary.unknown += 1;
      }
      kept.push(block);
    });

    const next = kept.join('\n');
    if (next !== current) {
      cell.setValue(next).setWrap(true);
    }
  });
  return summary;
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

