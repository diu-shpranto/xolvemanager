# Restore Failure Root-Cause Report

## Executive finding

The available file, `XolveManager_Full_Backup_2026-11-03_0302.json`, is a valid XolveManager v1 backup with valid checksums, but it contains **zero business records**. Customers, services, accounts, subscriptions, sales, invoices, payments, and financial collections are all empty. It contains only 3 activity logs and 2 notifications.

The file's local modification time and `exportedAt` agree at approximately 03:02 on November 3, 2026. The replacement flow creates a downloadable safety backup immediately before applying a restore, so this file is likely that safety copy; the available evidence cannot establish whether it was also the selected source file. Its empty contents do not, on their own, identify why the importer rejected the restore.

The exact historical exception and stack trace are **not recoverable** from the evidence available. The restore UI generated the reported generic message whenever `importDataJSON()` returned `false`; that importer also swallowed its internal exception and exposed no failure stage. The captured browser page is now disconnected, so its live storage and historical console stack cannot be inspected. It would be inaccurate to claim a specific past validation or storage exception.

## Backup inspection

The named file was parsed locally and checked using the repository's backup validators. Its JSON content was not modified.

| Check | Result |
|---|---|
| Application ID | `xolvemanager` |
| Backup/data version | 1 / 1 |
| Environment | Production |
| Business metadata | Present; business and settings IDs match |
| Manifest and checksum validation | Passed; no integrity errors |
| Raw-record data-integrity check | Passed in memory; 0 errors and 0 warnings |
| Customers / services / accounts | 0 / 0 / 0 |
| Subscriptions / sales / invoices / payments | 0 / 0 / 0 / 0 |
| Financial accounts and other financial records | 0 |
| Activity logs / notifications | 3 / 2 |
| Business-record total | 0 |
| Business storage | Browser `localStorage`; no IndexedDB business store is used |

This rules out a corrupt checksum, unsupported schema version, missing required collections, and an internal business/settings ID mismatch for this file. It does not prove which file was selected in the failed restore, nor whether the active browser profile had records at that time.

## Failure stage and historical data integrity

Before these changes, `SettingsView` replaced any importer failure with the message “Replace was not applied. Validation or transactional storage update failed; rollback was attempted.” The importer could return `false` for validation or integrity failures, and its catch block discarded the original exception. Consequently:

- The historical failure stage, original exception, and stack trace cannot be determined.
- The source code's old rollback path attempted to restore prior `localStorage` values but did not read them back to verify restoration.
- The failed operation's effect on the user's Production data cannot be verified from this session. The live browser page is unavailable, and no post-failure Production record counts or financial totals were accessible.
- No Production records were reset, restored, or changed during this investigation. Tests used isolated in-memory storage and synthetic records only.

## Changes made

| File | Change |
|---|---|
| `src/context/AppContext.tsx` | The importer now returns a structured failure with the stage and original error instead of returning an unexplained `false`. Schema, collection, relationship, integrity, storage, and in-memory update stages are distinguished. Original exceptions are logged with their stacks. |
| `src/services/localStorageStore.ts` | The atomic replacement helper now snapshots all target values before writing, preserves the original write exception, attempts rollback, and reads back every prior value. It reports rollback as verified only when all values match the snapshot. Snapshot failures are identified before any writes. |
| `src/components/views/SettingsView.tsx` | Restore failures display the stage, exact error description, data-integrity status, rollback status, and a recommended next action. Both Merge and Replace use this detail. |
| `src/services/dataBackupService.ts` | Blank business names are accepted for workspaces where identity is intentionally unset. Business ID resolution considers verified metadata and consistent record IDs without accepting conflicts. |
| `src/services/dataBackupService.test.ts` | Added regression tests for blank-name backup creation and safe Business ID resolution. |
| `src/services/localStorageStore.test.ts` | Added isolated coverage for verified rollback and rollback failure, including preservation of the original storage error. |
| `RESTORE_FAILURE_ROOT_CAUSE_REPORT.md` | Recorded evidence, limitations, code changes, and test results. |

Replace still validates and checks data integrity before storage writes and creates the pre-restore downloadable safety backup. A failure before writes reports existing data unchanged; a failed write reports data unchanged only after rollback is verified. If verification fails, the UI explicitly says the state is unknown and advises preserving the safety backup and stopping edits.

## Test results

| Test | Result |
|---|---|
| Named backup: schema, manifest, and checksum validation | Passed; valid v1 Production backup, zero business records, no integrity errors |
| Named backup: raw-record integrity validation | Passed in memory; healthy, 0 errors and 0 warnings |
| Empty backup warning/confirmation and backup counts | Covered by existing backup-service tests |
| Populated backup counts, business/profile Merge restrictions, conflicts, linked invoice/payment/advance-credit references, and voided invoice integrity | Covered by existing backup-service tests |
| Atomic storage write failure with rollback | Passed; original exception retained and rollback read-back verified |
| Atomic storage write and rollback failure | Passed; rollback reported unverified and data state marked unknown |
| Targeted backup and storage tests | **15 passed, 0 failed** |
| TypeScript lint/type-check (`npm run lint`) | Passed |
| Production build (`npm run build`) | Passed |
| Full test suite (`npm run test`) | **212 passed, 1 failed**. Existing unrelated failure: `src/services/reminderEngine.test.ts:125`, `upcoming and expired subscriptions create renewal follow-up candidates` (`false !== true`). |
| Production restore, rollback, and post-failure count comparison | Not run; no live Production storage was accessed |

The full test suite's single reminder failure is outside the files changed for this restore investigation and was also present in prior validation.

## Recommended next action

Do not treat the named zero-record file as a recovery source for a populated workspace. Preserve it as evidence, locate the intended populated backup, verify its per-collection counts and profile before restoring, and compare the current Production counts from the original browser/device before any further replacement. The original failed operation's data integrity remains unverified until that live workspace is safely inspected.

## Follow-up: selected 03:49 backup and screenshots

The later selected file, `XolveManager_Full_Backup_2026-11-03_0349.json`, was also available locally and inspected without changing it:

- It validates as a Production v1 backup with valid checksums and **30 total records**: 1 customer, 1 service, 1 subscription, 1 sale, 1 invoice, 1 payment, 3 reminders, 11 activity logs, and 10 notifications.
- It has no `business` object, no `settings.businessId`, and no `businessId` values on its records. Therefore its stable business identity cannot be verified. Merge must remain disabled; the UI now explains this explicitly. Do not infer identity or enable Merge for this file.
- Its `settings.storeName` is `XolveManager`; this is valid by length and does not explain the error in the screenshot.
- The screenshot's safety-backup exception is consistent with the production workspace allowing a blank business name while the backup validator rejected blank `settings.storeName`. The validator now permits a blank name but continues to reject non-empty names outside the supported length.
- Stable Business ID resolution now considers business metadata, settings metadata, and a single consistent Business ID present on records. Conflicting or multiple IDs remain unverifiable; this does not relax Merge protection.
- The selected 03:49 backup itself passes the backup validator and checksum verification. It was not restored.

Additional tests: blank-name safety-backup generation and conservative Business ID resolution pass. The latest targeted backup/storage run passed **15 tests**. The latest complete suite passed **212 of 213 tests**, with the same unrelated reminder-engine failure listed above. Production data remains untouched and its live counts are still not available for comparison.
