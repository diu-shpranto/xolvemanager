# Public Beta Rollback Plan

## Purpose
This rollback plan protects the public beta release from accidental public exposure or deployment mistakes while preserving user trust and preventing data loss.

## Conditions for rollback
Rollback should be triggered if any of the following occurs:
- a security issue or privacy disclosure gap is identified before launch,
- a critical data-integrity issue is discovered,
- a deployment target is misconfigured or not approved,
- public-facing content makes unsupported claims,
- or production deployment proceeds without a confirmed owner decision.

## Steps
1. Stop any planned or active production deployment.
2. Confirm whether the release has reached a live environment.
3. Revert to the last reviewed release-safe commit if a public environment is already exposed.
4. Keep the reviewed source branch unchanged until the issue is triaged.
5. Notify the project owner and stakeholders of the issue and the rollback decision.
6. Re-run core validation checks before re-trying deployment.

## Safety rules
- Do not reset local browser data.
- Do not overwrite user business records.
- Do not push or merge changes without review.
- Do not deploy to Vercel production during review unless explicitly approved.

## Recovery actions for data safety
- Encourage users to maintain regular backups.
- Preserve local browser data and avoid automated resets.
- Keep legal/privacy disclosures updated before any broader public access.

## Post-rollback follow-up
- Record the failing condition.
- Update the public beta disclosure documents.
- Re-run build/test checks.
- Confirm the branch and deployment target before resuming any launch work.
