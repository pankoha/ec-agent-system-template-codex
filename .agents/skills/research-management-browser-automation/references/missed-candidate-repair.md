# Missed candidate repair

Use this reference when the user says a candidate exists but the row was not surfaced or not written back correctly.

## Scope

- Mercari misses in `H`
- Rakuten misses in `J`
- sheet-state inconsistencies such as `M` saying a candidate was reflected while the marketplace column is blank

## Workflow

1. Resolve the live row first.
   - Search by order number, SKU, or ASIN.
   - If the user gives a row number, treat it as a hint only.
   - When the current row differs from the user-reported row, state the exact live row number.

2. Ground the current cell state.
   - Reread `B:M` for the target row.
   - Note the current values in `E`, the marketplace column, `L`, and `M`.
   - If the marketplace cell already contains a canonical duplicate URL, stop and report that the row is already corrected.

3. Reproduce the candidate on the live marketplace.
   - For Mercari, prefer rendered DOM plus same-tab click from search results.
   - For Rakuten, verify the live product page title and price, not only a search snippet.
   - Confirm the candidate matches the ordered product, model, media, set size, and max price constraints for that row.

4. Decide whether the miss was a search miss or a write miss.
   - If the candidate existed but the row column stayed blank, record it as a write/state inconsistency.
   - If the candidate was filtered out because of title-token order or strict matching, record it as a matching miss.
   - If the run was blocked by browser or DOM failure, record it as an incomplete verification and do not advance `L`.

5. Apply the correction safely.
   - Mercari candidate: write to `H`.
   - Rakuten candidate: write to `J`.
   - Set `E` to `候補あり` when a qualified candidate is present.
   - Update `L` only when the verification completed normally.
   - Append a one-line note to `M` with the date, marketplace, and correction reason.

6. Verify after write.
   - Reread the same row immediately.
   - Confirm the intended column changed, the URL is present once, and adjacent columns were preserved.

## Notes

- For Rakuten rows, a legitimate candidate may use different Japanese phrase order from the ordered product name. Check the actual product semantics before rejecting it as a mismatch.
- When a model number exists, exact model agreement is stronger evidence than broad title-token overlap.
- If the row already contains a manual-search memo and no verified candidate, preserve the memo and append the new note rather than replacing it wholesale unless the marketplace column is now being populated.
