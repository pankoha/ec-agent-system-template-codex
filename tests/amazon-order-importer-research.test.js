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
  setTimeout,
  clearTimeout,
};
vm.createContext(sandbox);
vm.runInContext(codeSource, sandbox, { filename: 'Code.gs' });
vm.runInContext(researchSource, sandbox, { filename: 'Research.gs' });

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
  'unknown shipping may use the product price for provisional judgment',
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
  'Jimoty may retain a non-junk uncertain condition',
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

console.log('amazon-order-importer research tests: PASS');
