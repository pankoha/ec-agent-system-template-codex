---
name: research-management-browser-automation
description: Use Codex browser control plus Google Sheets to run browser-based Mercari research on the リサーチ管理表 and safely repair missed Mercari or Rakuten candidates in the live sheet.
---

# Research management browser automation

Use this skill when:

- running Mercari browser research against `リサーチ管理表`
- investigating why a user-reported candidate was missed
- correcting a verified Mercari or Rakuten candidate in the management sheet

## Required read order

1. Read `docs/mercari-browser-research-automation.md` fully from top to bottom before taking action.
2. If the task is a missed-candidate investigation or sheet correction, read `references/missed-candidate-repair.md`.
3. If the user is preparing another PC, also read `docs/別PCセットアップ手順.md`.

Do not partially read the automation doc and do not summarize from memory.

## Core rules

- Confirm spreadsheet metadata first, then read `A:M` in bounded chunks across the full live data range.
- Never read only the first 25 rows and never reuse only the same front range.
- Exclude hidden rows, purchased rows, deleted rows, and duplicate-order anomalies before consuming target slots.
- For Mercari research, use browser-rendered DOM. Do not use Apps Script `UrlFetchApp` as the source of truth.
- Collect both `/item/` and `/shops/product/` links. Do not exclude Mercari Shops.
- Prefer same-tab click navigation from search results to the product page. Use direct navigation only as a fallback.
- Write Mercari candidates only to `H`, Rakuten candidates only to `J`.
- Update `L` only when the marketplace verification completed end-to-end.
- Before and after every write, reread the exact target cells and confirm row alignment, URL uniqueness, and no neighboring-cell damage.

## Mercari execution

- Follow `docs/mercari-browser-research-automation.md` exactly.
- Use at most 10 search variants per order.
- Check up to 60 sale candidates or 3 pages per query.
- If a search page renders HTTP 200 but exposes no usable candidate links and no explicit zero-results state, treat it as a DOM failure and run the required fallback queries before concluding failure.
- For incomplete browser runs such as DOM failure, CAPTCHA, login wall, access restriction, or URL-policy block, leave `L` unchanged and append the failure stage and URL to `M`.

## Missed-candidate repair flow

1. Re-identify the live row by order number, SKU, or ASIN. Do not trust stale row numbers.
2. Reread the exact row cells before browsing.
3. Reproduce the current marketplace candidate and verify title/model/media/volume/price/status on the live product page.
4. Write the verified candidate to the correct marketplace column only.
5. Promote `E` to `候補あり` when a qualified candidate is present.
6. Update `L` only if the recheck really completed.
7. Append a concise correction reason to `M`.
8. Reread the row after writing and confirm no collateral changes.
