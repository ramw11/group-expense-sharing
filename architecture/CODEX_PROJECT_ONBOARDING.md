# Codex Project Onboarding and Recommended Next Steps

## 1. Mission

Continue development of the Group Expense Sharing application without losing the product's deliberate simplicity or the v1.0 stabilization guarantees.

The current released product line is `1.2.0`. Continue to preserve the stabilization guarantees, self-hosted deployment boundary, production data, shared manager-code access, and event-scoped participant permissions.

## 2. Start every work session safely

1. Confirm the repository and branch:

   ```bash
   git remote -v
   git status --short --branch
   git branch -vv
   ```

2. Work on `dev` or a short-lived branch based on current `origin/dev`. Never start feature work from `deployment`.
3. Preserve unrelated working-tree changes. Do not reset, overwrite, or stage files that do not belong to the current task.
4. Read the architecture baseline before editing:
   - `architecture/Group_Expense_Sharing_PRD.md`
   - `architecture/System_Engineering_Improvement_Plan_v1.0.md`
   - `architecture/PROJECT_CONTEXT.md`
5. Inspect the current implementation instead of assuming the documents describe every detail.

## 3. Recommended learning order

Follow this order to understand the system quickly:

### Step 1 — Product and release intent

Read the three architecture documents in full. Extract the administrator workflow, participant workflow, SE requirements, QA gates, deferred scope, and branch/release policy.

### Step 2 — Repository operations

Read:

- `README.md`
- `package.json`
- `.github/workflows/deploy-pages.yml`
- `vite.config.ts`

Understand that `package.json` is the version source, GitHub Pages builds only from `deployment`, and the PWA caches application assets but not an offline business-state synchronization system.

### Step 3 — Domain and calculations

Read:

- `src/domain/models.ts`
- `src/domain/defaults.ts`
- `src/business/calculations.ts`
- `src/business/calculations.test.ts`

Confirm these invariants before changing calculations:

- only active, present members receive a share;
- member weight uses the event date and the event's calculation snapshot;
- family paid total is the sum of all expenses assigned to that billing unit, regardless of reporting member;
- allocated shares reconcile to total expenses under the event rounding policy;
- balance is `paid - share`;
- settlement transfers reconcile debtors and creditors;
- changing global defaults does not change a saved event.

### Step 4 — Supabase schema and persistence

Read all migrations in chronological order under `supabase/migrations/`, then read:

- `src/cloud/client.ts`
- `src/cloud/repository.ts`
- `src/cloud/repository.test.ts`

Trace one administrator write and one participant expense submission from UI to Supabase. Pay particular attention to Row Level Security, anonymous sessions, event tokens, realtime refresh, receipt upload paths, signed receipt URLs, and soft-deleted expenses.

Never edit an already-applied migration. Add a new timestamped migration and verify existing production data before and after applying it.

### Step 5 — Application state and migration

Read:

- `src/App.tsx`
- `src/storage/localStorage.ts`
- `src/storage/localStorage.test.ts`

Understand the three boot paths:

1. event link with a new access token;
2. already-accessible participant event;
3. deterministic administrator-group recovery.

Also understand the one-time migration from `group-expense-sharing:v1` and why business data must not return to LocalStorage.

### Step 6 — User journeys and responsive UI

Read the components in this order:

1. `src/components/groups/GroupHome.tsx`
2. `src/components/groups/GroupWorkspace.tsx`
3. `src/components/gathering/EventScreen.tsx`
4. `src/components/participant/ParticipantFlow.tsx`
5. `src/components/settings/SettingsScreen.tsx`
6. `src/i18n.ts`
7. `src/styles.css`

Review both Hebrew RTL and English LTR. Family/member management must remain compact and collapsible. Avoid large desktop tables on narrow screens.

### Step 7 — OCR and receipts

Read:

- `src/utils/image.ts`
- `src/utils/receiptOcr.ts`
- `src/utils/receiptOcr.test.ts`

OCR is allowed to suggest only. Manual amount entry is the guaranteed path. Receipt storage must retain `receiptPath`; signed URLs may expire and be regenerated.

## 4. Local development and quality gates

Install and run:

```bash
npm ci
npm run dev
```

Before committing any functional change, run:

```bash
npm test
npm run lint
npm run build
```

The build performs TypeScript checking before Vite production output. Do not suppress type or lint failures merely to make CI green.

For UI changes, verify at least:

- Hebrew RTL and English LTR;
- approximately 360 px phone width;
- tablet-sized width;
- desktop width;
- no horizontal overflow;
- reachable touch actions and dialogs;
- compact expense and settlement presentation.

## 5. Current recommended work plan

### Priority 0 — Complete v1.0 release acceptance

Do this before proposing new features.

#### Gate A — Real administrator migration

1. Record current production family, member, event, attendance, expense, and receipt counts.
2. Open the deployed site in the administrator's existing browser profile.
3. Confirm the administrator area and expected group load correctly.
4. Verify `state_migration_version` becomes 1.
5. Verify historical event calculation settings and calculated results are unchanged.
6. Verify the old business LocalStorage key is removed.

#### Gate B — Three physical clients

1. Administrator A opens or creates a test event and selects families/attendance.
2. A generates the event reporting link.
3. Clean participant device/browser B opens the link and submits expense #1.
4. A verifies expense #1 appears with correct family, reporter, amount, and receipt.
5. Clean participant device/browser C opens the same link and submits expense #2.
6. A verifies both expenses exist exactly once.
7. B and C submit near-concurrently in a second test.
8. Reload all clients and verify event identity, families, attendance, reporters, family paid totals, total expenses, calculations, settlements, receipts, and unrelated data.

#### Gate C — Camera and OCR fallback

1. Capture a real Hebrew receipt on an Android phone.
2. Confirm OCR proposes an amount when possible and the amount remains editable.
3. Force or reproduce OCR failure and confirm manual amount entry and submission remain available.
4. Open the submitted expense on another physical device and verify the correct receipt image is still associated.

#### Gate D — Mobile and RTL

Exercise administrator and participant flows on a narrow Android phone and a tablet. Check event cards, collapsible families/members, attendance, expense details, receipt previews, dialogs, summaries, settlements, report actions, and language switching. Record screenshots for failures, not merely subjective notes.

### Priority 1 — Fix only release-blocking findings

For each observed Critical or High failure:

1. reproduce it deterministically;
2. identify the violated SE/QA requirement;
3. add a focused regression test where possible;
4. implement the smallest safe fix;
5. run the full automated gates;
6. repeat the failed physical scenario.

Record Medium/Low observations separately. Do not expand the v1.0 scope while fixing a release blocker.

### Priority 2 — Prepare the actual v1.0.0 release

Only after every Critical and High gate genuinely passes:

1. ensure `dev` contains exactly the accepted code and documentation;
2. update `package.json` to `1.0.0` and update the lockfile through npm;
3. run tests, lint, and production build;
4. synchronize the accepted commit into `deployment`;
5. wait for and verify the GitHub Pages Action and live version display;
6. run a short production smoke test without modifying real event data;
7. create tag `v1.0.0` on the exact accepted `deployment` commit;
8. record the QA evidence and release commit in `PROJECT_CONTEXT.md`.

Do not create the tag in advance and do not tag a `dev`-only commit.

## 6. Required evidence format

When completing QA, report each item with evidence rather than a general statement:

```text
QA ID:
Date/time:
App version and commit:
Devices/browsers:
Supabase environment:
Preconditions/data counts:
Steps executed:
Expected result:
Actual result:
Screenshots/logs/test output:
Cleanup performed:
Status: PASS | FAIL | BLOCKED
```

Never report a physical-device check as passed when it was simulated, inferred from code, or covered only by unit tests.

## 7. Guardrails for future changes

- Do not rewrite the application or replace the approved stack during stabilization.
- Do not expose Supabase, ownership, repository, synchronization, or membership terminology to participants.
- Do not add participant login, approval, or anti-fraud workflows without a new approved requirement.
- Do not allow global settings to recalculate historical events.
- Do not store receipt images as base64 in the database or LocalStorage.
- Do not treat a temporary signed receipt URL as persistent metadata.
- Do not restore bidirectional LocalStorage/cloud merging.
- Do not redesign settlement mathematics without a failing invariant test.
- Do not perform a major visual redesign while closing v1.0 gates.
- Do not modify `deployment` until the candidate is accepted.

## 8. Useful operational references

- Live application: `https://ramw11.github.io/group-expense-sharing/`
- Repository: `https://github.com/ramw11/group-expense-sharing`
- Supabase project reference: `mmfliflzcprkaltxenmq`
- Stable stabilization commit: `305ce4cec076cb69d03c974e82810483c3cfe6b1`
- Successful stabilization deployment: `https://github.com/ramw11/group-expense-sharing/actions/runs/31323326256`

The Supabase publishable client key is intentionally public client configuration. Never place service-role keys, personal access tokens, or other privileged credentials in the repository or in this documentation.
