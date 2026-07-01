const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const importerDir = path.join(root, 'apps-script', 'amazon-order-importer');
const codeSource = fs.readFileSync(path.join(importerDir, 'Code.gs'), 'utf8');
const researchSource = fs.readFileSync(path.join(importerDir, 'Research.gs'), 'utf8');
const expectedBundle = `${codeSource.trimEnd()}\n\n${researchSource.trimEnd()}\n`;

assert.equal(
  fs.readFileSync(path.join(importerDir, 'Code.paste.gs'), 'utf8'),
  expectedBundle,
  'Code.paste.gs must stay synchronized with Code.gs and Research.gs',
);
assert.equal(
  fs.readFileSync(path.join(importerDir, 'Code.compact.gs'), 'utf8'),
  expectedBundle,
  'Code.compact.gs must stay synchronized with Code.gs and Research.gs',
);

const sandbox = {
  console,
  Logger: { log() {} },
  Utilities: {},
  Session: {},
  PropertiesService: {
    getScriptProperties() {
      return {
        getProperty(key) {
          return sandbox.__properties[key] || null;
        },
        setProperty(key, value) {
          sandbox.__properties[key] = String(value);
        },
      };
    },
  },
  SpreadsheetApp: {
    getActiveSpreadsheet() {
      return sandbox.__activeSpreadsheet;
    },
    openById() {
      throw new Error('openById must not be used while a bound spreadsheet is active');
    },
  },
  __properties: {},
  __activeSpreadsheet: {
    getId() {
      return 'current-bound-spreadsheet-id';
    },
  },
  setTimeout,
  clearTimeout,
};
vm.createContext(sandbox);
vm.runInContext(codeSource, sandbox, { filename: 'Code.gs' });
vm.runInContext(researchSource, sandbox, { filename: 'Research.gs' });

assert.equal(
  sandbox.getTargetSpreadsheet_(),
  sandbox.__activeSpreadsheet,
  'setup must use the spreadsheet that the bound Apps Script is currently attached to',
);
assert.equal(
  sandbox.__properties.TARGET_SPREADSHEET_ID,
  'current-bound-spreadsheet-id',
  'setup must save the bound spreadsheet ID for later time-driven triggers',
);

const hiddenRanges = [];
const dateVisibilitySheet = {
  getLastRow() {
    return 5;
  },
  getRange() {
    return {
      getDisplayValues() {
        return [['2026/06/28'], ['出荷予定日：2026/06/29'], ['2026/06/30'], ['2026/07/01']];
      },
    };
  },
  hideRows(startRow, rowCount) {
    hiddenRanges.push([startRow, rowCount]);
  },
  showRows() {
    throw new Error('manually hidden rows must never be shown automatically');
  },
};
sandbox.hideRowsBeforeDisplayDate_(dateVisibilitySheet);
assert.deepEqual(
  hiddenRanges,
  [[2, 2]],
  'both sheets must hide only rows before 2026/06/30',
);

const protectedHeaderSheet = {
  getRange() {
    return {
      getValues() {
        return [['手入力ヘッダー', '', '', '']];
      },
      setValues() {
        throw new Error('existing headers must not be overwritten');
      },
      setFontWeight() {
        throw new Error('existing formatting must not be changed');
      },
      setBackground() {
        throw new Error('user colors must not be changed');
      },
    };
  },
};
sandbox.ensureHeader_(protectedHeaderSheet, ['A', 'B', 'C', 'D']);

const manualStatusCell = {
  value: '担当者確認中',
  getValue() {
    return this.value;
  },
  setValue(value) {
    this.value = value;
    return this;
  },
};
sandbox.setManagedResearchStatus_({ getRange: () => manualStatusCell }, 2, 'リサーチ中');
assert.equal(manualStatusCell.value, '担当者確認中', 'manual status input must be preserved');

sandbox.testKeywordGeneration();
assert.deepEqual(
  Array.from(sandbox.buildOrderRow_({
    shipDate: '2026/07/01',
    orderNumber: '123-1234567-1234567',
    items: [{
      productName: 'Panasonic DMR-2W101-K',
      sku: 'sku-1',
      salesAmount: '12,800円',
      searchWord: 'DMR-2W101',
    }],
  })),
  [
    '2026/07/01',
    '注文番号：123-1234567-1234567\n商品名：Panasonic DMR-2W101-K\nSKU：sku-1',
    12800,
    'DMR-2W101',
  ],
  'order rows must use A:ship date, B:order info, C:numeric sales, D:keyword',
);

function candidate(overrides = {}) {
  return {
    site: 'Mercari',
    siteLabel: 'メルカリ',
    title: 'Panasonic DMR-2W101 ブルーレイレコーダー',
    url: 'https://jp.mercari.com/item/m123',
    price: 8000,
    shipping: 750,
    shippingKnown: true,
    condition: '傷や汚れあり',
    contextText: '',
    ...overrides,
  };
}

function filter(items, maxPrice = 10000, site = 'Mercari', rowData = {}) {
  return sandbox.filterItemsByPriceAndCondition(
    items,
    maxPrice,
    site,
    Boolean(rowData.isDvd),
    {
      expectedVolume: 0,
      newOnly: false,
      ...rowData,
    },
  );
}

assert.equal(filter([candidate()]).length, 1, 'price + shipping within the cap must pass');
assert.equal(
  filter([candidate({ shipping: 2500 })]).length,
  0,
  'price + shipping above the C-column cap must fail',
);
assert.equal(
  filter([candidate({ shippingKnown: false, shipping: 0 })]).length,
  1,
  'unknown shipping must use the item price for provisional cap evaluation',
);
assert.equal(
  filter([candidate({ price: 12000, shippingKnown: false, shipping: 0 })]).length,
  0,
  'unknown shipping must still reject an item whose price alone exceeds the cap',
);
assert.match(
  sandbox.formatResearchResult_(candidate({ shippingKnown: false, shipping: 0 }), false),
  /送料要確認/,
  'unknown shipping must be labeled',
);

assert.equal(
  filter([candidate({ title: 'ジャンク 動作未確認 DMR-2W101' })]).length,
  0,
  'junk and untested items must be excluded',
);
assert.equal(
  filter([candidate({ condition: '状態要確認' })]).length,
  0,
  'Mercari candidates with an unsupported/unknown condition must not be appended',
);
assert.equal(
  filter([candidate({ site: 'Jimoty', condition: '状態要確認' })], 10000, 'Jimoty').length,
  1,
  'Jimoty candidates may pass without a recognized condition when they are not junk',
);
assert.equal(
  filter([candidate({ site: 'Jimoty', condition: '中古' })], 10000, 'Jimoty').length,
  1,
  'Jimoty candidates may pass when condition and shipping are explicit',
);
assert.equal(
  filter([candidate({ site: 'Jimoty', condition: '現状品' })], 10000, 'Jimoty').length,
  1,
  'Jimoty ambiguous condition wording must remain eligible for manual review',
);
assert.equal(
  filter([candidate({ site: 'Jimoty', title: '動作未確認 DMR-2W101' })], 10000, 'Jimoty').length,
  0,
  'Jimoty candidates with explicit prohibited wording must be rejected',
);

assert.equal(
  filter(
    [candidate({ site: 'Amazon', condition: '中古品 - 非常に良い' })],
    10000,
    'Amazon',
    { newOnly: true },
  ).length,
  0,
  'muza rows must reject used Amazon items',
);
assert.equal(
  filter(
    [candidate({ site: 'Amazon', condition: '新品' })],
    10000,
    'Amazon',
    { newOnly: true },
  ).length,
  1,
  'muza rows may accept explicitly new Amazon items',
);

assert.equal(
  filter(
    [candidate({ title: '作品名 全12巻セット DVD', condition: '傷や汚れあり' })],
    10000,
    'Mercari',
    { isDvd: true, expectedVolume: 12 },
  ).length,
  1,
  'complete DVD sets must pass',
);
assert.equal(
  filter(
    [candidate({ title: '作品名 1-11巻 DVD', condition: '傷や汚れあり' })],
    10000,
    'Mercari',
    { isDvd: true, expectedVolume: 12 },
  ).length,
  0,
  'incomplete DVD sets must fail',
);

assert.equal(
  sandbox.matchesResearchKeyword_('Panasonic DMR-2W101-K レコーダー', 'DMR-2W101'),
  true,
  'D-column model numbers must match candidate titles',
);
assert.equal(
  sandbox.matchesResearchKeyword_('Panasonic DMR-4W101 レコーダー', 'DMR-2W101'),
  false,
  'different model numbers must not match',
);

assert.equal(
  sandbox.canonicalResearchUrl_('https://www.amazon.co.jp/gp/product/B0ABCDEFGHI?tag=x'),
  'https://www.amazon.co.jp/dp/B0ABCDEFGH',
  'Amazon URLs must be canonicalized',
);
assert.equal(
  sandbox.canonicalResearchUrl_('https://www.2ndstreet.jp/goods/detail/goodsId/2219310049359/shopsId/30298?x=1'),
  'https://www.2ndstreet.jp/goods/detail/goodsId/2219310049359/shopsId/30298',
  'Second Street product URLs must be canonicalized',
);
assert.equal(
  sandbox.canonicalResearchUrl_('https://www.netoff.co.jp/detail/0014218084/?track=x'),
  'https://www.netoff.co.jp/detail/0014218084/',
  'NetOff product URLs must be canonicalized',
);
assert.equal(
  sandbox.canonicalResearchUrl_('https://item.rakuten.co.jp/com/assets/domain-resources/favicon.ico'),
  '',
  'search-page assets must never be treated as product URLs',
);
assert.equal(sandbox.priceNear_('発売日 2009年 価格 1,513円'), 1513, 'labeled prices must be parsed');
assert.equal(sandbox.priceNear_('<div data-price="9555">商品</div>'), 9555, 'structured prices must be parsed');
assert.equal(sandbox.priceNear_('発売日 2009年 21ポイント'), 0, 'years and points must not be parsed as prices');
assert.equal(
  sandbox.isDuplicateUrlInCell_(
    '8,000円｜中古｜https://jp.mercari.com/item/m123?tracking=abc',
    'https://jp.mercari.com/item/m123',
  ),
  true,
  'canonical duplicate URLs must be detected',
);

const visibilitySheet = {
  isRowHiddenByUser(row) {
    return row === 3;
  },
  isRowHiddenByFilter(row) {
    return row === 5;
  },
};
assert.deepEqual(
  Array.from(sandbox.visibleResearchRows_(visibilitySheet, 6)),
  [2, 4, 6],
  'only rows displayed in 【リサーチ管理表】 may be researched',
);
assert.deepEqual(
  Array.from(sandbox.rotateRows_([2, 4, 6], 1)),
  [4, 6, 2],
  'the cursor must rotate so every displayed row keeps being researched',
);
const completedStatusRow = sandbox.buildResearchRowData_(2, [
  '2026/07/01',
  '注文番号：123-1234567-1234567\n商品名：テスト DMR-2W101\nSKU：muza_B0ABCDEFGH',
  10000,
  'DMR-2W101',
  '候補あり',
  '',
  '',
  '',
  '',
  '',
]);
assert.equal(completedStatusRow.keywordLines[0], 'DMR-2W101');
assert.equal(completedStatusRow.newOnly, true);
assert.equal(
  Object.prototype.hasOwnProperty.call(completedStatusRow, 'status'),
  false,
  'candidate status must not become a stop condition for continuous research',
);

const existingLine = '手動｜9,000円｜中古｜https://jp.mercari.com/item/m111';
const cell = {
  value: existingLine,
  getValue() {
    return this.value;
  },
  setValue(value) {
    this.value = value;
    return this;
  },
  setWrap() {
    return this;
  },
};
sandbox.__testSheet = {
  getRange() {
    return cell;
  },
};
sandbox.SpreadsheetApp = {
  getActiveSpreadsheet() {
    return sandbox.__activeSpreadsheet;
  },
  openById() {
    return {};
  },
};
vm.runInContext('setupResearchManagementSheet_ = function () { return __testSheet; };', sandbox);

assert.equal(
  sandbox.appendUrlToMainSheet_(
    2,
    8,
    [
      '8,000円｜中古｜https://jp.mercari.com/item/m111',
      '7,500円｜中古｜https://jp.mercari.com/item/m222',
    ],
  ),
  1,
  'only a new URL must be appended',
);
assert.ok(cell.value.startsWith(existingLine), 'existing URLs and manual lines must remain untouched');
assert.equal((cell.value.match(/m111/g) || []).length, 1, 'the same URL must not be appended twice');
assert.equal((cell.value.match(/m222/g) || []).length, 1, 'the new URL must be appended once');

assert.match(researchSource, /候補あり・候補なし等の状態にかかわらず|regardless of status/);
assert.doesNotMatch(
  researchSource,
  /remove(?:Stale|Auto|Unavailable).*Url|clearContent\(\).*URL/i,
  'research implementation must not contain URL-removal behavior',
);
assert.doesNotMatch(
  `${codeSource}\n${researchSource}`,
  /\.showRows\(|\.showColumns\(|\.insertColumn/i,
  'manually hidden rows and deleted columns must never be restored automatically',
);
assert.doesNotMatch(
  researchSource,
  /hideRowsBeforeDisplayDate_\(/,
  'hourly research and synchronization must preserve the current row visibility',
);
assert.equal(
  (codeSource.match(/hideRowsBeforeDisplayDate_\(/g) || []).length,
  2,
  'date-based hiding must only exist as one explicit menu action plus its helper definition',
);

console.log('amazon-order-importer research tests: PASS');
