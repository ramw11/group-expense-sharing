# Project Context and Engineering Handoff

**Project:** Group Expense Sharing  
**Repository:** `ramw11/group-expense-sharing`  
**Current application version:** `1.2.0`
**Last updated:** 2026-08-10  
**Status:** v1.2.0 release prepared with shared manager access and protected expense corrections

## 1. Purpose of this document

This document preserves product decisions, operational constraints, implementation history, and release status that cannot be inferred reliably from the source code alone. It is intended as durable context for developers and coding agents continuing work on the project.

The governing documents are:

1. `architecture/Group_Expense_Sharing_PRD.md` — product requirements baseline.
2. `architecture/System_Engineering_Improvement_Plan_v1.0.md` — authoritative v1.0 architecture, stabilization, QA, and release plan where it supersedes older PRD assumptions.
3. This document — implementation history, approved decisions, and current handoff state.

If these documents appear to conflict, do not silently choose an implementation. Apply the precedence above and update the relevant architecture document when a material architectural decision changes.

## 2. Product intent

The application exists to make trusted group expense reporting and settlement simple. The first use case is extended-family gatherings, but the product language and data model remain generic enough for other groups.

There are two intentionally different workflows:

### Administrator

Families -> Events -> Event setup -> participating families -> attendance -> event reporting link -> submitted expenses -> calculation -> final settlement/report.

The administrator owns master data, event configuration, attendance, calculation settings, and the final report.

### Participant

Open an event link -> select family -> select reporting member -> enter an expense or photograph a receipt -> review/correct the suggested amount -> submit -> receive confirmation -> optionally add another expense.

Participants do not manage events, families, attendance, settings, or settlements.

## 3. Approved decisions not fully expressed by code

### 3.1 KISS is a release constraint

Simplicity is not merely a UI preference. Do not introduce accounts, roles infrastructure, approval queues, fraud controls, a synchronization engine, new backend services, or speculative abstractions unless a new approved requirement demonstrates the need.

### 3.2 Trusted-participant model

Participants are known people and their reports are trusted. They do not need conventional accounts or passwords. Anonymous Supabase authentication is an invisible technical mechanism and must not appear in participant-facing terminology.

### 3.3 One administrator and one actively managed group for v1.0

The supported v1.0 operating model is one administrator managing one active group. The schema retains group identifiers, but advanced multi-group administration and multi-administrator collaboration are deferred. Administrator recovery must remain deterministic and must not use heuristic data selection.

The administrator identity currently depends on the anonymous Supabase session stored by the browser. Clearing site data or changing the administrator browser can therefore remove that browser's ownership context. This is an accepted v1.0 limitation, not a reason to add a login system during stabilization. Any future recovery design requires an explicit product decision.

### 3.4 Supabase is the only authority for shared business state

Families, members, events, attendance, expenses, reporter identity, calculation snapshots, and receipt paths belong in Supabase. LocalStorage is limited to language and harmless device context. The PWA may cache application assets, but v1.0 does not promise offline business-data creation or offline-to-cloud synchronization.

### 3.5 Event sharing is event-specific

A reporting link identifies one event and opens its participant reporting flow directly. The URL format is conceptually `?event=<event-id>&access=<token>`. Generating a new link revokes the previous active link for that event. Group/repository membership and synchronization concepts must remain hidden from participants.

Legacy invitation parsing exists only as a compatibility bridge. New functionality must use event-specific links.

### 3.6 Historical calculations are immutable by default changes

Child age threshold, child weight, weight mode, and rounding mode are copied into the event when it is created. Global settings are defaults for future events only. Never calculate a historical event from current global defaults.

The existing settlement algorithm is approved. It may be changed only when a focused failing test demonstrates a real mathematical defect.

### 3.7 OCR is assistive, not authoritative

Receipt OCR remains client-side. It suggests an amount, with emphasis on receipt totals/payable amounts, but the participant must be able to inspect and correct it. Manual amount entry must work even when OCR fails or is unavailable. Do not add external OCR or AI services for v1.0.

### 3.8 Receipt persistence model

Receipt images are compressed in the browser, uploaded to the private Supabase Storage `receipts` bucket, and associated through `Event -> Expense -> receipt_path`. The storage path is canonical; signed URLs are temporary presentation values and must never replace the stored path.

### 3.9 Hebrew-first, bilingual product

Hebrew and RTL are the default experience. English remains available. Mobile Android browsers are a primary environment, not a secondary responsive target. Functional clarity and touch usability take priority over decorative redesign.

### 3.10 Version and release policy

`package.json` is the only canonical application version. Vite injects it into the UI. Do not copy the version into source files or documentation as an additional runtime source.

`v1.0.0` is a release gate, not a label for completed coding. It must not be tagged until all Critical and High acceptance gates pass, including the required physical multi-device scenario. A previously premature `v1.0.0` tag was removed.

### 3.11 Branch and deployment policy

- `dev` contains ongoing development commits.
- `deployment` contains only accepted stable releases.
- GitHub Pages deploys only from `deployment`.
- Promotion should be a deliberate synchronization of an accepted `dev` state into `deployment`.
- Release tags belong on the accepted `deployment` commit.
- Do not deploy feature or documentation work by pushing it directly to `deployment`.

### 3.12 Database migration policy

Production data must not be silently deleted, reclassified, or reconstructed from guesses. Applied migration files are historical records and should not be edited. Add a new forward migration for future schema changes, make it backward-compatible where practical, and verify production counts and associations before and after applying it.

## 4. Stabilization work completed

The approved v1.0 stabilization plan was implemented at application version `0.9.0`.

### 4.1 Implemented System Engineering requirements

- **SE-01:** Supabase is authoritative for shared business data; LocalStorage no longer stores the active business model.
- **SE-02:** Cloud snapshots deterministically replace only the selected group snapshot; the ambiguous local/cloud merge architecture was removed.
- **SE-03:** Event-specific reporting tokens and direct participant entry were implemented.
- **SE-04:** Administrator group recovery uses the preferred owned group ID or deterministic lexical selection, not heuristic scoring.
- **SE-05:** Persisted gathering terminology was moved toward `Event`, including the main model and UI component.
- **SE-06:** Calculation settings are snapshotted per event and existing events were backfilled.
- **SE-07:** Settlement mathematics was preserved and focused invariants were tested.
- **SE-08:** OCR remains client-side, editable, and optional; manual entry remains available.
- **SE-09:** Receipt paths are persisted in Supabase Storage and retained across signed-URL refreshes.
- **SE-10:** The participant follows a direct event/family/member/expense/confirmation flow.
- **SE-11:** Administration is centered on Families, Events, and Settings; family/member content is collapsible.
- **SE-12:** Mobile and RTL overflow, expense, summary, settlement, receipt, action, and dialog presentation were corrected without a major redesign.
- **SE-13:** Semantic versioning has one canonical source and the version is displayed unobtrusively in Settings/About.

### 4.2 Material implementation areas

- Application orchestration: `src/App.tsx`
- Domain model and defaults: `src/domain/`
- Pure calculation engine: `src/business/calculations.ts`
- Supabase persistence, realtime refresh, invitations, and receipts: `src/cloud/`
- One-time legacy migration and device preferences: `src/storage/localStorage.ts`
- Administrator UI: `src/components/groups/` and `src/components/gathering/EventScreen.tsx`
- Participant UI: `src/components/participant/ParticipantFlow.tsx`
- Settings/version display: `src/components/settings/SettingsScreen.tsx`
- Responsive/RTL styling: `src/styles.css`
- Database history: `supabase/migrations/`
- Build/release automation: `.github/workflows/deploy-pages.yml`

Obsolete generic persistent-storage hooks and the former local/cloud synchronization layer were removed.

### 4.3 Supabase migration status

`supabase/migrations/20260809183000_v1_stabilization.sql` was applied to the connected Supabase project. It:

- added group calculation defaults and `state_migration_version`;
- added and backfilled event calculation snapshots;
- added event-specific invitation association and indexes;
- added `create_event_invite` and `join_shared_event` RPC functions;
- restricted RPC execution to authenticated sessions while retaining invisible anonymous authentication.

Production data was checked before and after migration. The verified data remained: one group, five families, 32 members, one event, 32 attendance rows, nine active expenses, and four receipt associations. Temporary QA records were removed.

The existing administrator group may still have `state_migration_version = 0` until the real administrator browser opens version `0.9.0`. That first owner open migrates any historical local calculation settings into the cloud, sets migration version 1, and removes the old business-data LocalStorage entry.

### 4.4 LocalStorage architecture after stabilization

The only current key is `group-expense-sharing:preferences`, containing:

- UI language;
- active administrator group ID;
- last participant event ID.

The legacy `group-expense-sharing:v1` key is read only by the one-time migration and then deleted. Do not reintroduce business-state persistence or bidirectional synchronization into LocalStorage.

### 4.5 Verification already completed

- ESLint passed.
- TypeScript compilation passed through the production build.
- Vitest passed 23 tests across four test files.
- The production Vite/PWA build passed.
- GitHub Pages build and deployment passed.
- The deployed bundle was verified to contain version `0.9.0`.
- A database transaction test verified event-token creation and exact event resolution.
- A production-safe automated scenario used three independent anonymous Supabase clients: an administrator created an event, two participant clients submitted distinct expenses with receipts near-concurrently, and the administrator reload observed both expenses exactly once with correct reporter IDs, receipt paths, totals, attendance, and calculation snapshot.
- Temporary QA data was deleted after verification.
- The live participant flow was opened from a clean browser session and completed through family/member selection, manual amount entry, submission, and confirmation.
- Calculation tests cover aggregation for multiple reporters in one family, allocation reconciliation, settlement reconciliation, rounding, and unchanged historical calculations after default-setting changes.

### 4.6 Deployment status

The stable application is available at:

`https://ramw11.github.io/group-expense-sharing/`

The stabilization baseline is commit:

`305ce4cec076cb69d03c974e82810483c3cfe6b1`

The corresponding successful GitHub Actions run is:

`https://github.com/ramw11/group-expense-sharing/actions/runs/31323326256`

Both `dev` and `deployment` pointed to that baseline before this documentation handoff. This documentation should be committed to `dev` only until the next accepted deployment promotion.

## 5. Release gates still open

The application is not yet approved for `v1.0.0`. The following checks require real devices or the actual administrator browser and must not be reported as passed until performed:

1. Run the primary scenario on three physical devices/browsers: administrator A, participant B, and participant C. Confirm realtime visibility and then reload every relevant client.
2. Verify the full administrator and participant flows on a narrow Android phone and a tablet-sized viewport/device, including RTL, dialogs, receipt controls, expense details, summaries, and settlements.
3. Capture a real receipt with the phone camera, verify an OCR suggestion can be corrected, deliberately exercise OCR failure, submit manually, and reopen the receipt from another physical device.
4. Open deployed `0.9.0` in the actual administrator browser and verify the one-time legacy migration completes without changing families, events, attendance, expenses, calculation history, or receipt associations.

If any Critical or High failure is found, fix it on `dev`, add a regression test where possible, and repeat the relevant gate before promotion.

## 6. Known non-blocking or deferred findings

- The OCR dependency contributes a bundle larger than Vite's default 500 KB warning threshold. This is expected and is not currently a release blocker.
- Supabase security advisors warn about anonymous-access policies and SECURITY DEFINER functions. These are intentional for the trusted anonymous participant model. The RPCs use an empty `search_path`, verify authentication, verify owner access for link creation, and validate a hashed token for event joining.
- Some database indexes are currently reported as unused. Do not remove them during v1.0 stabilization without production evidence.
- Full accounts/login, multi-admin support, advanced multi-group administration, fraud prevention, cloud OCR, notifications, advanced offline mode, analytics, payments, exports, and native Android packaging remain out of scope.
- Storage cleanup for receipt objects orphaned by deleted events can be considered later; it is not part of the current v1.0 gate unless it causes an observed functional defect.

## 7. Definition of the next safe release action

Do not add new product features now. Complete the four manual gates, record evidence by QA ID, fix only observed Critical/High defects, and rerun `npm test`, `npm run lint`, and `npm run build`. If every release gate passes, update the canonical version to `1.0.0`, promote the exact accepted commit from `dev` to `deployment`, verify GitHub Pages, and create tag `v1.0.0` on that deployment commit.
