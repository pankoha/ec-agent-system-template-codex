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
  LockService: {
    getScriptLock() {
      return {
        tryLock() {
          return true;
        },
        releaseLock() {},
      };
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
assert.equal(sandbox.isDisplayShipDateAllowed_('2026/06/29'), false, 'orders before 2026/06/30 must not be imported as visible rows');
assert.equal(sandbox.isDisplayShipDateAllowed_('出荷予定日：2026/06/30'), true, 'orders on 2026/06/30 must be eligible');
assert.equal(
  sandbox.buildAmazonOrderGmailQuery_().includes('-label:'),
  false,
  'Gmail import must be able to re-check recent processed threads without re-adding excluded orders',
);
assert.equal(
  sandbox.buildAmazonOrderGmailQuery_().includes('newer_than:30d'),
  true,
  'Gmail import must stay bounded to recent Amazon seller notifications',
);
assert.equal(
  sandbox.buildAmazonOrderGmailQuery_().includes('"新規の注文"'),
  true,
  'Gmail import must search the newer Amazon seller notification wording',
);
const newOrderNoticeMessage = {
  getFrom: () => 'seller-notification@amazon.co.jp',
  getSubject: () => '出品者向け通知',
  getPlainBody: () => [
    'Amazonで新規の注文がありました。 出荷予定日2026/07/09までに商品の出荷を完了してください。',
    '注文の詳細',
    '注文番号：249-8883596-5682228',
    '注文日：2026/07/01',
    '商品名：Panasonic DMR-2W101-K',
    'SKU：sku-249',
    '売上金：12,800円',
  ].join('\n'),
  getBody: () => '',
};
assert.equal(
  sandbox.isTargetMessage_(newOrderNoticeMessage),
  true,
  'seller notifications whose body says 新規の注文 and includes an order number must be imported',
);
const newOrderNoticeResult = sandbox.parseAmazonOrderEmail_(sandbox.getMessageText_(newOrderNoticeMessage));
assert.equal(newOrderNoticeResult.ok, true, 'new-order seller notification wording must parse');
assert.equal(newOrderNoticeResult.fields.orderNumber, '249-8883596-5682228');
assert.equal(newOrderNoticeResult.fields.orderDate, '2026/07/01');
assert.equal(newOrderNoticeResult.fields.shipDate, '2026/07/09');
const subjectFallbackMessage = {
  getFrom: () => 'seller-notification@amazon.co.jp',
  getSubject: () => '注文確定： pricetar-dvdr-3715 鉄のラインバレル [レンタル落ち] 全13巻セット [マーケットプレイスDVDセット商品',
  getPlainBody: () => [
    'Amazonで新規の注文がありました。出荷予定日2026/07/09までに商品の出荷を完了してください。',
    '注文番号：249-8883596-5682228',
    '注文日：2026/07/01',
    '売上金：5,980円',
  ].join('\n'),
  getBody: () => '',
};
const subjectFallbackText = sandbox.getMessageText_(subjectFallbackMessage);
const subjectFallbackResult = sandbox.parseAmazonOrderEmail_(subjectFallbackText);
assert.equal(
  subjectFallbackResult.ok,
  true,
  '注文確定 subject lines must supply SKU/product when the body omits 商品名 and SKU labels',
);
assert.equal(subjectFallbackResult.fields.items[0].sku, 'pricetar-dvdr-3715');
assert.equal(
  subjectFallbackResult.fields.items[0].productName,
  '鉄のラインバレル [レンタル落ち] 全13巻セット [マーケットプレイスDVDセット商品',
);
assert.match(
  subjectFallbackResult.fields.items[0].searchWord,
  /鉄のラインバレル/,
  'DVD subject fallback must still generate a usable search word',
);
const unsortedRows = [
  ['注文日：2026/07/09\n出荷予定日：2026/07/10', '注文番号：249-8883596-5682228', 12800, 'DMR-2W101'],
  ['注文日：2026/07/02\n出荷予定日：2026/07/09', '注文番号：111-1111111-1111111', 10000, 'ABC-1'],
];
sandbox.sortOrderRowsForAppend_(unsortedRows);
assert.deepEqual(
  unsortedRows.map((row) => sandbox.displayOrderDateNumber_(row[0])),
  [20260702, 20260709],
  'newly imported order rows must be appended in ascending order-date order',
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
    orderDate: '2026/07/01',
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
    '注文日：2026/07/01\n出荷予定日：2026/07/01',
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

assert.equal(
  sandbox.appendResearchLinesToSheet_(
    sandbox.__testSheet,
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
assert.equal(
  sandbox.appendResearchLinesToSheet_(
    sandbox.__testSheet,
    2,
    8,
    [
      '8,500円｜中古｜https://jp.mercari.com/item/m333',
      '9,500円｜未使用に近い｜https://jp.mercari.com/item/m444',
    ],
  ),
  1,
  'only cheaper or better-condition candidates should be appended after an existing candidate',
);
assert.equal((cell.value.match(/m333/g) || []).length, 0, 'worse candidates must not be appended');
assert.equal((cell.value.match(/m444/g) || []).length, 1, 'better-condition candidates must be appended');

function makeSheet(headers, rows, hidden = false) {
  const grid = [headers.slice(), ...rows.map((row) => row.slice())];
  return {
    grid,
    name: '',
    getName() {
      return this.name;
    },
    getLastRow() {
      return this.grid.length;
    },
    getLastColumn() {
      return Math.max(...this.grid.map((row) => row.length), 1);
    },
    isSheetHidden() {
      return hidden;
    },
    isRowHiddenByUser() {
      return false;
    },
    isRowHiddenByFilter() {
      return false;
    },
    getParent() {
      return this.parent;
    },
    getRange(startRow, startColumn, rowCount = 1, columnCount = 1) {
      const sheet = this;
      const read = () => Array.from({ length: rowCount }, (_, rowIndex) => (
        Array.from({ length: columnCount }, (_, columnIndex) => (
          (sheet.grid[startRow - 1 + rowIndex] || [])[startColumn - 1 + columnIndex] || ''
        ))
      ));
      return {
        getValues: read,
        getDisplayValues: () => read().map((row) => row.map(String)),
        getValue: () => read()[0][0],
        getDisplayValue: () => String(read()[0][0] || ''),
        setValue(value) {
          while (sheet.grid.length < startRow) sheet.grid.push([]);
          sheet.grid[startRow - 1][startColumn - 1] = value;
          return this;
        },
        setValues(values) {
          values.forEach((row, rowIndex) => {
            while (sheet.grid.length < startRow + rowIndex) sheet.grid.push([]);
            row.forEach((value, columnIndex) => {
              sheet.grid[startRow - 1 + rowIndex][startColumn - 1 + columnIndex] = value;
            });
          });
          return this;
        },
        setWrap() {
          return this;
        },
        clearContent() {
          for (let rowIndex = 0; rowIndex < rowCount; rowIndex += 1) {
            for (let columnIndex = 0; columnIndex < columnCount; columnIndex += 1) {
              if (sheet.grid[startRow - 1 + rowIndex]) {
                sheet.grid[startRow - 1 + rowIndex][startColumn - 1 + columnIndex] = '';
              }
            }
          }
          return this;
        },
      };
    },
    deleteRow(rowNumber) {
      this.grid.splice(rowNumber - 1, 1);
    },
    deleteRows(startRow, rowCount) {
      this.grid.splice(startRow - 1, rowCount);
    },
    hideSheet() {
      hidden = true;
    },
  };
}

function makeSpreadsheet(sheets) {
  const spreadsheet = {
    getId() {
      return 'fake-spreadsheet';
    },
    getSheetByName(name) {
      return sheets[name] || null;
    },
    insertSheet(name) {
      const sheet = makeSheet([''], []);
      sheet.name = name;
      sheet.parent = spreadsheet;
      sheets[name] = sheet;
      return sheet;
    },
    deleteSheet(sheetToDelete) {
      const sheetName = Object.keys(sheets).find((name) => sheets[name] === sheetToDelete);
      if (sheetName) {
        delete sheets[sheetName];
      }
    },
  };
  Object.entries(sheets).forEach(([name, sheet]) => {
    sheet.name = name;
    sheet.parent = spreadsheet;
  });
  return spreadsheet;
}

const legacyManagementSheet = makeSheet(['旧'], [['不要']]);
const activeManagementSheet = makeSheet(['既存'], []);
const legacySheetMap = {
  リサーチ管理シート: legacyManagementSheet,
  リサーチ管理表: activeManagementSheet,
};
const legacySpreadsheet = makeSpreadsheet(legacySheetMap);
sandbox.setupResearchManagementSheet_(legacySpreadsheet);
assert.equal(
  legacySpreadsheet.getSheetByName('リサーチ管理シート'),
  null,
  'unused legacy リサーチ管理シート must be deleted during setup',
);
assert.ok(
  legacySpreadsheet.getSheetByName('リサーチ管理表'),
  'active リサーチ管理表 must remain available',
);

const mainAppendSheet = makeSheet(['A', 'B', 'C', 'D', 'E', 'F'], [['', '', '', '', '', '']]);
assert.equal(
  sandbox.appendUrlToMainSheet_(2, 6, ['1,000円｜中古｜https://example.com/main-only']),
  0,
  'research URL appends must not write to the main order sheet',
);
assert.equal(
  mainAppendSheet.grid[1][5],
  '',
  'main order sheet cells must remain unchanged by research URL append API',
);

const deletedProtectedOrder = '444-4444444-4444444';
const keptProtectedOrder = '555-5555555-5555555';
const deleteMainSheet = makeSheet(
  ['出荷期限日', '注文情報', '売上金', '検索ワード'],
  Array.from({ length: 131 }, (_, index) => (
    index === 0
      ? ['2026/07/01', `注文番号：${keptProtectedOrder}`, 10000, 'KEEP']
      : ['', '', '', '']
  )).concat([
    ['2026/07/02', `注文番号：${deletedProtectedOrder}\n商品名：削除対象`, 9000, 'DELETE'],
  ]),
);
const deleteDeletedSheet = makeSheet(['記録日時', '注文番号', '理由', '元行', '注文情報'], []);
const deleteSnapshotSheet = makeSheet(['注文番号'], [[keptProtectedOrder], [deletedProtectedOrder]]);
const deleteSpreadsheet = makeSpreadsheet({
  注文確定商品リサーチ表: deleteMainSheet,
  削除済み注文: deleteDeletedSheet,
  注文番号スナップショット: deleteSnapshotSheet,
});
sandbox.deleteRowsFromProtectedStartAndRememberOrders_(deleteSpreadsheet, deleteMainSheet);
assert.equal(
  deleteMainSheet.grid.some((row) => String(row[1] || '').includes(deletedProtectedOrder)),
  false,
  '132nd and later rows must be deletable after their order numbers are remembered',
);
assert.equal(
  deleteDeletedSheet.grid.some((row) => row[1] === deletedProtectedOrder),
  true,
  'deleted orders must be stored so Gmail import will never recreate them',
);
assert.equal(
  sandbox.loadExistingOrders_(deleteMainSheet).deletedOrderNumbers.has(deletedProtectedOrder),
  true,
  'deleted-order registry must be part of duplicate/exclusion checks',
);

const autoDeletedOrder = '666-6666666-6666666';
const autoProtectMainSheet = makeSheet(
  ['出荷期限日', '注文情報', '売上金', '検索ワード'],
  Array.from({ length: 130 }, () => ['', '', '', '']).concat([
    ['2026/07/03', `注文番号：${autoDeletedOrder}\n商品名：自動削除対象`, 7000, 'AUTO'],
  ]),
);
const autoProtectDeletedSheet = makeSheet(['記録日時', '注文番号', '理由', '元行', '注文情報'], []);
const autoProtectSnapshotSheet = makeSheet(['注文番号'], [[autoDeletedOrder]]);
const autoProtectSpreadsheet = makeSpreadsheet({
  注文確定商品リサーチ表: autoProtectMainSheet,
  削除済み注文: autoProtectDeletedSheet,
  注文番号スナップショット: autoProtectSnapshotSheet,
});
assert.equal(
  sandbox.enforceProtectedDeletedRows_(autoProtectSpreadsheet, autoProtectMainSheet, '自動保護テスト'),
  1,
  'automatic protection must delete row 132+ without requiring a menu click',
);
assert.equal(
  autoProtectDeletedSheet.grid.some((row) => row[1] === autoDeletedOrder),
  true,
  'automatic protection must remember row 132+ order numbers as deleted',
);
assert.equal(
  autoProtectMainSheet.grid.some((row) => String(row[1] || '').includes(autoDeletedOrder)),
  false,
  'automatic protection must remove reappeared deleted rows',
);
const futureNewOrder = '777-7777777-7777777';
const secondAutoProtectMainSheet = makeSheet(
  ['出荷期限日', '注文情報', '売上金', '検索ワード'],
  Array.from({ length: 130 }, () => ['', '', '', '']).concat([
    ['2026/07/09', `注文番号：${futureNewOrder}\n商品名：新規注文`, 8800, 'FUTURE'],
    ['2026/07/01', `注文番号：${autoDeletedOrder}\n商品名：削除済み再表示`, 7000, 'AUTO'],
  ]),
);
const secondAutoProtectDeletedSheet = makeSheet(
  ['記録日時', '注文番号', '理由', '元行', '注文情報'],
  [[new Date(), autoDeletedOrder, '初回自動保護', 132, '']],
);
const secondAutoProtectSnapshotSheet = makeSheet(['注文番号'], [[futureNewOrder], [autoDeletedOrder]]);
const secondAutoProtectSpreadsheet = makeSpreadsheet({
  注文確定商品リサーチ表: secondAutoProtectMainSheet,
  削除済み注文: secondAutoProtectDeletedSheet,
  注文番号スナップショット: secondAutoProtectSnapshotSheet,
});
assert.equal(
  sandbox.enforceProtectedDeletedRows_(secondAutoProtectSpreadsheet, secondAutoProtectMainSheet, '2回目自動保護テスト'),
  1,
  'after the first cleanup, automatic protection must delete only order numbers already marked as deleted',
);
assert.equal(
  secondAutoProtectMainSheet.grid.some((row) => String(row[1] || '').includes(futureNewOrder)),
  true,
  'new valid orders that land at row 132+ must not be marked deleted on later runs',
);
assert.equal(
  secondAutoProtectMainSheet.grid.some((row) => String(row[1] || '').includes(autoDeletedOrder)),
  false,
  'known deleted orders must still be removed if they reappear',
);

const legacyColumns = sandbox.researchColumnMap_(
  makeSheet(['出荷期限日', '注文情報', '売上金', '検索ワード', 'お届け先', 'リサーチ状況', 'Amazon', 'ヤフオク', 'メルカリ', 'ジモティ', 'その他サイト'], []),
);
assert.deepEqual(
  JSON.parse(JSON.stringify({
    status: legacyColumns.status,
    Amazon: legacyColumns.Amazon,
    Yahoo: legacyColumns.Yahoo,
    Mercari: legacyColumns.Mercari,
    Jimoty: legacyColumns.Jimoty,
    Rakuten: legacyColumns.Rakuten,
    Other: legacyColumns.Other,
  })),
  { status: 6, Amazon: 7, Yahoo: 8, Mercari: 9, Jimoty: 10, Rakuten: 11, Other: 11 },
  'header mapping must preserve the existing A:K layout with a recipient column',
);

const orderOne = '111-1111111-1111111';
const orderTwo = '222-2222222-2222222';
const orphanOrder = '333-3333333-3333333';
const mainSheet = makeSheet(
  ['出荷期限日', '注文情報', '売上金', '検索ワード', 'リサーチ状況', 'Amazon', 'ヤフオク', 'メルカリ', 'ジモティ', 'その他サイト'],
  [
    ['2026/07/01', `注文番号：${orderOne}\n商品名：商品1\nSKU：sku1`, 10000, 'ABC-1', '未リサーチ', '', '', '', '', ''],
    ['2026/07/02', `注文番号：${orderTwo}\n商品名：商品2\nSKU：sku2`, 12000, 'ABC-2', '未リサーチ', '', '', '', '', ''],
  ],
);
const managementSheet = makeSheet(
  ['出荷期限日', '注文情報', '売上金', '検索ワード', 'リサーチ状況', 'Amazon', 'ヤフオク', 'メルカリ', 'ジモティ', 'その他サイト', '最終リサーチ日時', '確認メモ'],
  [
    ['2026/07/01', `注文番号：${orderOne}\n商品名：商品1\nSKU：sku1`, 10000, 'ABC-1', '未リサーチ', '', '', '', '', '', '', ''],
    ['2026/06/30', `注文番号：${orphanOrder}\n商品名：削除対象\nSKU：sku3`, 9000, 'ABC-3', '候補あり', '', '', '', '', '', '', ''],
  ],
);
const reviewRows = [];
const reviewSheet = {
  appendRow(row) {
    reviewRows.push(row);
  },
};
const linkedSpreadsheet = {
  getId() {
    return 'linked-spreadsheet';
  },
  getSheetByName(name) {
    return {
      注文確定商品リサーチ表: mainSheet,
      リサーチ管理表: managementSheet,
      確認用: reviewSheet,
    }[name] || null;
  },
};

const syncResult = sandbox.syncResearchManagementByOrderNumber_(linkedSpreadsheet);
assert.deepEqual(
  JSON.parse(JSON.stringify(syncResult)),
  { appended: 1, deleted: 1, duplicates: 0, available: true },
  'order-number synchronization must append missing orders and delete orphan management rows',
);
assert.equal(
  managementSheet.grid.some((row) => String(row[1] || '').includes(orphanOrder)),
  false,
  'deleting an order from the main sheet must remove the same order from management',
);
assert.equal(
  managementSheet.grid.filter((row) => String(row[1] || '').includes(orderTwo)).length,
  1,
  'a missing management order must be added exactly once',
);
assert.equal(
  managementSheet.grid.find((row) => String(row[1] || '').includes(orderTwo))[0],
  '2026/07/02',
  'management A column must mirror the main A column exactly',
);

const unresolvedMainSheet = makeSheet(
  ['出荷期限日', '注文情報', '売上金', '検索ワード'],
  [['2026/07/03', '注文番号を取得できない手入力行', 5000, 'UNKNOWN']],
);
const protectedManagementSheet = makeSheet(
  ['出荷期限日', '注文情報', '売上金', '検索ワード', 'リサーチ状況'],
  [['2026/07/01', `注文番号：${orderOne}`, 10000, 'ABC-1', '候補あり']],
);
const safetyReviewRows = [];
const unresolvedSpreadsheet = {
  getSheetByName(name) {
    return {
      注文確定商品リサーチ表: unresolvedMainSheet,
      リサーチ管理表: protectedManagementSheet,
      確認用: { appendRow: (row) => safetyReviewRows.push(row) },
    }[name] || null;
  },
};
const unresolvedResult = sandbox.syncResearchManagementByOrderNumber_(unresolvedSpreadsheet);
assert.equal(unresolvedResult.deleted, 0, 'management deletion must pause when a nonempty main row has no order number');
assert.equal(protectedManagementSheet.getLastRow(), 2, 'uncertain order identity must never delete existing research');
assert.ok(
  safetyReviewRows.some((row) => String(row[5] || '').includes('削除同期を保留')),
  'uncertain deletion must be recorded for manual review',
);

const hiddenReviewRows = [];
const hiddenSpreadsheet = {
  getSheetByName(name) {
    return {
      注文確定商品リサーチ表: mainSheet,
      リサーチ管理表: makeSheet(['注文情報'], [[`注文番号：${orderOne}`]], true),
      確認用: { appendRow: (row) => hiddenReviewRows.push(row) },
    }[name] || null;
  },
};
const hiddenResult = sandbox.syncResearchManagementByOrderNumber_(hiddenSpreadsheet);
assert.equal(hiddenResult.available, false, 'a hidden management sheet must not stop or mutate main-sheet processing');
assert.ok(
  hiddenReviewRows.some((row) => String(row[5] || '').includes('非表示')),
  'a hidden management sheet must be recorded for manual review',
);

sandbox.__activeSpreadsheet = linkedSpreadsheet;
assert.equal(
  sandbox.updateResearchManagementRowByOrderNumber(orderOne, {
    status: '候補あり',
    resultsBySite: {
      Mercari: ['8,000円｜傷や汚れあり｜https://jp.mercari.com/item/m999'],
    },
    memos: ['送料要確認 https://jp.mercari.com/item/m999'],
  }),
  true,
  'research results must synchronize to the unique matching management row',
);
assert.equal(managementSheet.grid[1][4], '候補あり');
assert.match(managementSheet.grid[1][7], /m999/);
assert.match(managementSheet.grid[1][11], /送料要確認/);
assert.equal(
  Object.prototype.toString.call(managementSheet.grid[1][10]),
  '[object Date]',
  'last researched timestamp must be updated',
);
assert.equal(
  sandbox.appendUrlToResearchManagementSheet(
    orderOne,
    'Mercari',
    '8,000円｜傷や汚れあり｜https://jp.mercari.com/item/m999',
  ),
  0,
  'the same management URL must not be appended twice',
);
assert.equal(
  sandbox.extractOrderNumberFromOrderInfo(`注文番号：${orderOne}\n商品名：商品1`),
  orderOne,
  'the shared order-number parser must read B-column order information',
);

const importedOrder = '777-7777777-7777777';
const importedMainSheet = makeSheet(
  ['出荷期限日', '注文情報', '売上金', '検索ワード', 'リサーチ状況', 'Amazon', 'ヤフオク', 'メルカリ', 'ジモティ', 'その他サイト'],
  [
    ['注文日：2026/07/01\n出荷予定日：2026/07/09', `注文番号：${importedOrder}\n商品名：自動取得商品\nSKU：sku777`, 9800, 'AUTO-777', '', '', '', '', '', ''],
  ],
);
const importedManagementSheet = makeSheet(
  ['出荷期限日', '注文情報', '売上金', '検索ワード', 'リサーチ状況', 'Amazon', 'ヤフオク', 'メルカリ', 'ジモティ', '楽天市場', '最終リサーチ日時', '確認メモ'],
  [],
);
const importedReviewRows = [];
const importedSpreadsheet = makeSpreadsheet({
  注文確定商品リサーチ表: importedMainSheet,
  リサーチ管理表: importedManagementSheet,
  確認用: { appendRow: (row) => importedReviewRows.push(row) },
});
const originalResearchOneOrder = sandbox.researchOneOrder;
sandbox.researchOneOrder = (rowData) => {
  assert.equal(rowData.orderNumber, importedOrder, 'only the newly imported order should be researched immediately');
  assert.equal(
    rowData.sheet,
    importedManagementSheet,
    'immediate research must run on the synchronized management row',
  );
  rowData.sheet.getRange(rowData.row, rowData.columns.Mercari).setValue('7,000円｜中古｜https://jp.mercari.com/item/imported777');
  return {
    added: 1,
    needsReview: false,
    resultsBySite: {
      Mercari: ['7,000円｜中古｜https://jp.mercari.com/item/imported777'],
    },
    memos: [],
  };
};
const immediateResearchResult = sandbox.researchImportedOrderRowsAfterImport_(importedSpreadsheet, [importedOrder]);
sandbox.researchOneOrder = originalResearchOneOrder;
assert.deepEqual(
  JSON.parse(JSON.stringify(immediateResearchResult)),
  { synced: 1, processed: 1, added: 1, errors: 0, skipped: 0 },
  'new Gmail imports must sync to management and start research immediately',
);
assert.equal(importedManagementSheet.getLastRow(), 2, 'the imported order must be appended to the management sheet');
assert.equal(importedManagementSheet.grid[1][0], '注文日：2026/07/01\n出荷予定日：2026/07/09', 'management A column must mirror the two-line main A column');
assert.equal(importedManagementSheet.grid[1][4], '候補あり', 'the imported management row status must be updated by immediate research');
assert.match(importedManagementSheet.grid[1][7], /imported777/, 'immediate research results must sync to management');
assert.equal(
  Object.prototype.toString.call(importedManagementSheet.grid[1][10]),
  '[object Date]',
  'immediate research must update the management last-researched timestamp',
);

const hourlyOrder = '888-8888888-8888888';
const hourlyMainSheet = makeSheet(
  ['出荷期限日', '注文情報', '売上金', '検索ワード', 'リサーチ状況', 'Amazon', 'ヤフオク', 'メルカリ', 'ジモティ', '楽天市場'],
  [
    ['注文日：2026/07/01\n出荷予定日：2026/07/10', `注文番号：${hourlyOrder}\n商品名：毎時対象\nSKU：sku888`, 11000, 'AUTO-888', '', '', '', '', '', ''],
  ],
);
const hourlyManagementSheet = makeSheet(
  ['出荷期限日', '注文情報', '売上金', '検索ワード', 'リサーチ状況', 'Amazon', 'ヤフオク', 'メルカリ', 'ジモティ', '楽天市場', '最終リサーチ日時', '確認メモ'],
  [
    ['注文日：2026/07/01\n出荷予定日：2026/07/10', `注文番号：${hourlyOrder}\n商品名：毎時対象\nSKU：sku888`, 11000, 'AUTO-888', '', '', '', '', '', '', '', ''],
  ],
);
const hourlySpreadsheet = makeSpreadsheet({
  注文確定商品リサーチ表: hourlyMainSheet,
  リサーチ管理表: hourlyManagementSheet,
  確認用: { appendRow: () => {} },
});
sandbox.__activeSpreadsheet = hourlySpreadsheet;
sandbox.__properties = {};
sandbox.researchOneOrder = (rowData) => {
  assert.equal(rowData.sheet, hourlyManagementSheet, 'hourly research must process displayed management rows');
  assert.equal(rowData.orderNumber, hourlyOrder);
  rowData.sheet.getRange(rowData.row, rowData.columns.Rakuten).setValue('6,000円｜中古｜https://item.rakuten.co.jp/shop/hourly888/');
  return {
    added: 1,
    needsReview: false,
    resultsBySite: {
      Rakuten: ['6,000円｜中古｜https://item.rakuten.co.jp/shop/hourly888/'],
    },
    memos: [],
  };
};
sandbox.researchListedItemsHourly();
sandbox.researchOneOrder = originalResearchOneOrder;
assert.equal(hourlyManagementSheet.grid[1][4], '候補あり', 'hourly management row status must be updated');
assert.match(hourlyManagementSheet.grid[1][9], /hourly888/, 'hourly Rakuten result must be written to J column');

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
