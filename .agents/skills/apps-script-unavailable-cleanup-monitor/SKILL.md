---
name: apps-script-unavailable-cleanup-monitor
description: Monitor and finish the production Google Apps Script cleanup that removes sold-out, listing-ended, and auction-ended URLs from the リサーチ管理表 sheet. Use when checking the unavailable-research dry-run/apply workflow, its continuation triggers, execution history, or final sheet deletion result.
---

# Apps Script unavailable cleanup monitor

Use the logged-in in-app browser and the browser-control skill. Keep the existing heartbeat active until every completion condition is verified.

## Target

- Apps Script project: the project containing `startApplyUnavailableResearchCleanupAuto` and bound to the Google account currently being operated.
- Spreadsheet: the bound or `TARGET_SPREADSHEET_ID`-configured spreadsheet for that Google/Amazon account. Never reuse another account's spreadsheet ID.
- Sheet: `リサーチ管理表`

## Workflow

1. Open the target Apps Script project and inspect both `実行数` and `トリガー`.
2. Treat dry-run as complete only when no `continueDryRunUnavailableResearchCleanupAuto` trigger remains and the latest relevant execution is no longer running.
3. If dry-run is incomplete, do not start apply. Keep monitoring and return a quiet status.
4. When dry-run is complete, inspect whether `continueApplyUnavailableResearchCleanupAuto` already exists or `startApplyUnavailableResearchCleanupAuto` has already run. Never start a duplicate apply.
5. If apply has not started, select and run `startApplyUnavailableResearchCleanupAuto` from the editor.
6. Monitor until no `continueApplyUnavailableResearchCleanupAuto` trigger remains and the latest relevant apply execution is complete. A historical timeout alone is not failure when later batches progress successfully.
7. Open the target spreadsheet and verify `リサーチ管理表` no longer contains the URLs classified by the run as sold out, listing ended, or auction ended. Accept a deletion log or before/after candidate comparison only when it identifies the affected URLs or a trustworthy deleted count. Do not treat trigger removal alone as sheet verification.
8. On full completion, delete the heartbeat automation and notify the user with dry-run status, apply status, trigger status, and deletion evidence.

## Heartbeat behavior

- Incomplete: keep the automation active and return `DONT_NOTIFY` with one short status sentence.
- Complete: delete the automation first, then return `NOTIFY` with the verified result.
- Preserve the Apps Script tab as a handoff tab between checks.
