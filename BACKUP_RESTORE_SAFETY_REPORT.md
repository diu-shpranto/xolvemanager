# Backup and Restore Safety Report

## Root cause

Backup preview counts the records actually present in the selected file. It does not filter records by Business ID or Demo/Production profile. A valid backup whose collection arrays are empty therefore previews as zero records; its manifest must agree with those empty arrays. The preview code alone cannot establish why a particular file is empty.

The selected backup file was not provided for inspection, so its origin cannot be proven. The reported Business ID and profile mismatch are consistent with a backup from another business or workspace, but do not prove that explanation. New backups now include the active storage environment explicitly, including when record IDs cannot be used to infer a profile.

## Safety changes

- Added explicit active Demo/Production metadata to app exports and preserve it in versioned backups.
- Show current and selected-backup category counts and top-level record totals without double-counting nested plans or account profiles. Empty backups display: “Your backup contains no business records. Check whether you selected the correct file.”
- Replacing populated data with an empty backup requires an additional confirmation. Business ID mismatch or unverifiable identity also requires an explicit confirmation.
- Block cross-profile replacement and Merge. Merge additionally requires a matching stable Business ID; it does not rewrite IDs or financial relationships.
- Clear the previous preview and confirmations before processing another file, including oversized or unreadable files.
- When Demo workspace metadata is missing, recover a manifest only from records with app-owned Demo ID prefixes. Preserve untagged business records and allow Demo sign-in instead of blocking access. If only a Demo business profile or non-business metadata remains, restore sample data without replacing the existing profile or metadata.
- Keep the pre-replacement safety-backup download and the existing transactional restore/rollback behavior. A browser download can be started but the application cannot verify that the user retained the downloaded file. Rollback failures are surfaced rather than reported as success.
- Clarify persistent-storage Granted, Denied, and Unavailable states and that browser persistence is not a substitute for regular backups.

## Merge and data integrity

Merge preserves current conflicting records and skips duplicates. Tests verify that customer, sale, invoice, payment allocation, and advance-credit references remain unchanged. Existing backup validation continues to check manifests, checksums, and linked business records. No ID remapping is performed.

## Files changed

- `src/context/AppContext.tsx` — include active storage environment in backup source data.
- `src/services/dataBackupService.ts` — preserve explicit environment metadata and provide record-count and restore-safety predicates.
- `src/components/views/SettingsView.tsx` — improve count accuracy, preview reset behavior, restore confirmations, mismatch messaging, and persistence protection wording.
- `src/services/dataBackupService.test.ts` — test populated/empty counts, profile and identity compatibility, corrupt manifests, and linked-reference preservation.
- `src/services/localStorageStore.test.ts` — test rollback after a simulated partial storage write failure.
- `src/services/demoWorkspaceService.ts` and `src/services/demoWorkspaceService.test.ts` — recover missing Demo manifests safely and test sign-in with legacy and partial Demo workspace state.
- `BACKUP_RESTORE_SAFETY_REPORT.md` — this report.

## Validation results

- Focused backup, storage, persistence, and Demo recovery tests: **19 passed, 0 failed**.
- Full test suite (run before the Demo recovery tests were added): **198 passed, 1 failed**. The failing test is the unrelated `upcoming and expired subscriptions create renewal follow-up candidates` test in `src/services/reminderEngine.test.ts:90`; it also fails when run alone. No reminder code was changed. The full suite was not rerun for this follow-up.
- `npm run lint`: **passed**.
- `npm run build`: **passed**.
- `git diff --check`: **passed**.

Tests use in-memory storage and fixtures. A browser check confirmed Demo sign-in reaches the dashboard without the manifest error. No production data was changed; the existing Demo records were preserved. The selected backup itself and browser file-picker interactions were not available for direct end-to-end testing. No deployment was performed.
