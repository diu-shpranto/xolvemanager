# Demo Data Fix Report

## Root cause

Demo initialization returned as soon as it found a valid manifest, even when that manifest contained no record IDs and the Demo business arrays were empty. A legacy Demo business profile with a different business ID could also make initialization return without seeding. Both paths left the dashboard and reports without business records.

Initialization now checks the Demo-scoped records before treating a manifest as installed. It seeds only when business records are absent, repairs a legacy Demo profile ID while preserving its existing profile fields, and leaves populated or untagged workspace data unchanged. A stale manifest is replaced only when the corresponding business records are absent.

## Changes

- `src/services/demoWorkspaceService.ts` — guarded Demo-only initialization, empty/stale manifest recovery, and legacy Demo profile ID repair.
- `src/services/demoDataService.ts` — right-sized fictional sample data, explicit payment allocations, an advance-credit example, overdue invoice dates, and stricter installation status checks. Demo shop name is **XolveKart Demo**.
- `src/data/mockData.ts` — real-use business identity fields now start blank instead of carrying Demo/placeholder contact information.
- `src/context/AppContext.tsx` — guarded atomic Demo reset/reseed with reference and integrity validation.
- `src/components/views/SettingsView.tsx` — added a confirmed “Reset Demo Data” action with dependency-safety messaging.
- `src/services/demoWorkspaceService.test.ts` — initialization, legacy profile, idempotency, and Demo/Production isolation tests.
- `src/services/demoDataService.test.ts` — sample count, payment/invoice integrity, advance-credit, and reset/reseed tests.

## Seeded sample counts

The generator creates fictional, locally stored records:

| Record type | Count |
|---|---:|
| Customers | 15 |
| Services | 6 |
| Plans | 19 |
| Service accounts | 8 |
| Profiles | 24 |
| Subscriptions | 15 |
| Sales | 15 |
| Payments | 15 |
| Invoices | 15 |
| Receiving accounts | 5 |
| Expenses | 20 |
| Other income entries | 6 |
| Transfers | 4 |
| Daily closings | 3 |
| Reminders | 10 |
| Communications | 15 |
| Notifications | 6 |

The samples include paid and partial sales, pending and failed payment records, expired and upcoming subscriptions, overdue invoices, and customer advance credit.

## Dashboard and reports verification

Verified the first-time Demo entry in the local browser and inspected both Dashboard and Reports. The Demo dashboard showed:

- Customers: **15**
- Active plans: **7**
- Money received: **৳5,090.00**
- Money due: **৳1,800.00**
- Available advance: **৳350.00**
- Overdue invoices: **3**

Reports displayed the generated sales, payments, expenses, and overdue invoice rows. The invoice list included partial and unpaid overdue examples.

## Financial integrity

- Every generated sale links to one subscription, payment, and invoice.
- Invoice totals equal their sale totals; invoice paid and due amounts match the payment allocation calculations.
- Paid and partial payments have explicit sale allocations; pending and failed payments produce no received-payment ledger entries and do not increase paid totals.
- The advance example records the cash payment once, allocates the sale amount explicitly, and keeps **৳350.00** available as customer credit. The credit is not added as a second cash receipt.
- Reset/reseed tests verify that unrelated workspace records are retained and sample relationships remain valid.

## Production isolation

Automated in-memory storage tests verified Demo-to-Production and Production-to-Demo reads, preserved a Production customer sentinel, and confirmed initialization throws if called in Production Mode. No Production records were reset or modified during browser validation.

The existing browser Demo dataset contained unmarked records linked to Demo records. The reset action correctly stopped with an explicit dependency warning and made no changes. The clean isolated reset/reseed test passed.

## Test results

- `npm run lint` — **passed**
- `npm run build` — **passed**
- Targeted Demo/business-default tests — **11 passed**.
- `npm test` — **209 passed, 1 failed out of 210**. The remaining failure is the unrelated `upcoming and expired subscriptions create renewal follow-up candidates` test in `src/services/reminderEngine.test.ts:90`; the assertion fails at line 125 and was also present before this Demo-data work.
- `git diff --check` — **passed**
