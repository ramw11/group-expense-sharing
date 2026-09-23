# Android Solo Admin Edition — Implementation Plan and Sprints

**Plan version:** 1.0

**Companion PRD:** `architecture/Android_Solo_Admin_PRD_v1.0.md`

**Working branch:** `feature/android-solo-admin-app` created from `dev`

## 1. Delivery strategy

The work is divided into three independently releasable phases:

- **Phase A:** a local, privately installed Android application.
- **Phase B:** upgraded intake of reports, first through Android sharing and later, if justified, through a structured participant aid.
- **Phase C:** Google Play readiness and publication.

A sprint below is a scope and quality gate, not a promise of a fixed calendar duration. A sprint is complete only when its acceptance checks pass. The existing deployed web product stays available throughout Phase A; Android work must not require a production cutover.

## 2. Repository and branch policy

Follow the repository workflow:

1. `deployment` is the release branch; `dev` is the integration branch.
2. Implement each bounded capability on `feature/<name>` created from `dev`.
3. Commit and verify locally; do not push temporary feature branches.
4. Merge a completed feature into `dev`, delete the temporary branch, then push `dev`.
5. At a release gate, merge `dev` into `deployment`, bump the semantic product version, create an annotated tag, and push `deployment` and the tag.
6. Never commit APK/AAB files, signing keys, keystores, secrets, local databases, receipts, or exported backups.

The current umbrella branch may hold the planning documents. Before code implementation begins, split work into the smaller feature branches listed per sprint so reviews and rollback remain manageable.

## 3. Target code organization

The exact folders may be adjusted after Sprint A0, but dependencies must flow inward:

```text
src/
  domain/          models, validation, calculation rules
  application/     use cases and repository/platform interfaces
  infrastructure/
    cloud/         existing web/Supabase adapters
    local/         SQLite repositories and file metadata
  platforms/
    web/           web composition and web-only services
    android/       Capacitor/native service adapters
  ui/              reusable components and edition-specific screens
android/            generated/maintained Capacitor Android project
```

The calculation engine must not import React, Capacitor, Supabase, SQLite, or browser storage. Local and cloud persistence must never be selected by scattered runtime conditionals; each edition gets one explicit composition root.

## 4. Cross-cutting definition of done

Every sprint requires:

- acceptance criteria demonstrated against the sprint scope;
- automated tests for new domain/application behavior;
- migration and rollback consideration for data or schema changes;
- no uncommitted generated or sensitive artifacts;
- Hebrew RTL and English smoke checks for changed UI;
- documentation updated when a decision or operational step changes;
- `npm` quality gates and Android build/tests passing where applicable;
- physical-device verification for native integrations;
- no regression in the existing web build unless a deliberate change is separately approved.

## 5. Phase A sprints — Local Android application

### Sprint A0 — Architecture runway and native spike

**Branch:** `feature/android-foundation-spike`

**Objectives**

- Confirm Capacitor compatibility with the current Vite/React build.
- Choose and record the stable Android application ID, display name, minimum SDK, target SDK, and signing ownership.
- Evaluate maintained Capacitor-compatible SQLite and file-system options.
- Prove one write/read round trip in SQLite and one selected-image copy into private storage on a physical device.
- Create ADRs for persistence, files, Android identity/signing, and edition composition.
- Define ignored/generated paths and secret-handling rules before adding the Android project.

**Exit gate**

- A disposable spike launches on a physical Android device and works offline.
- Plugin maintenance, license, migration support, supported SDKs, and backup implications are documented.
- No production feature or existing data is changed.

### Sprint A1 — Shared core and edition boundaries

**Branches:** `feature/application-ports`, then `feature/android-composition`

**Objectives**

- Inventory domain logic currently coupled to Supabase, browser routing, or localStorage.
- Introduce repository and platform interfaces around events, families, members, expenses, receipts, settings, reports, and exports.
- Preserve the existing web composition with its cloud adapters.
- Add an Android composition root that cannot initialize Supabase or participant/admin authentication flows.
- Add regression fixtures for the approved calculation engine, settlement rules, explicit zero/fractional weights, and rounding.

**Exit gate**

- Domain/application tests run without browser, Supabase, or Android dependencies.
- Existing web tests and build pass with unchanged calculation results.
- Android composition can start against in-memory fake repositories.

### Sprint A2 — Local database, receipts, and migrations

**Branches:** `feature/android-local-database`, then `feature/android-local-receipts`

**Objectives**

- Implement the versioned SQLite schema and transaction-safe repositories.
- Implement forward migrations and database integrity checks.
- Implement application-private receipt storage with metadata, thumbnails where needed, and orphan cleanup.
- Implement Android camera/photo/file selection and secure file sharing adapters.
- Add repository contract tests shared by in-memory and SQLite implementations.

**Exit gate**

- CRUD and migration tests pass on emulator and physical device.
- Process restart and application upgrade preserve records and receipts.
- Missing/corrupt receipt recovery behavior is demonstrated.

### Sprint A3 — Administrator-only offline workflows

**Branches:** one feature branch per bounded area, such as `feature/android-event-management` and `feature/android-expense-entry`

**Objectives**

- Replace web landing, participant links, manager code, and shared-admin UI with direct administrator navigation.
- Deliver local family/member/event/attendance management.
- Deliver manual expense entry, reporter selection, derived family, receipt attachment, full edit/delete, filter, and sort.
- Provide explicit empty, error, loading, and offline states.
- Preserve accessible RTL phone layouts.

**Exit gate**

- A complete event can be built and edited in airplane mode on a physical phone.
- Every expense has a valid reporter/family relationship.
- Closing and reopening the app does not lose or duplicate changes.

### Sprint A4 — Calculation, dashboard, PDF, and sharing

**Branches:** `feature/android-reports`, then `feature/android-pdf-export`

**Objectives**

- Connect local event data to the existing calculation engine.
- Deliver explainable detailed report, family summaries, balances, and settlement instructions.
- Deliver dashboard cards, one pie/donut visualization per family, reporter table, and summary.
- Generate device-safe PDFs using a deterministic print/export layout rather than screenshot scaling.
- Share generated PDFs through Android's Sharesheet.

**Exit gate**

- Calculation fixtures match approved web results exactly.
- Detailed and dashboard PDFs are visually approved in Hebrew on representative phone and PDF viewers.
- Long names, negative balances, multiple pages, charts, tables, and page breaks do not clip or squash text.

### Sprint A5 — Backup, restore, and legacy import

**Branches:** `feature/android-backup-restore`, then `feature/web-export-android-import`

**Objectives**

- Define and version the portable backup/import manifest.
- Export structured data and receipts as one user-selected package.
- Validate and restore transactionally, with pre-replacement safety backup and clear summary.
- Add a non-destructive web export path and Android one-time import.
- Cover duplicate IDs, missing receipts, unsupported versions, corrupt packages, cancellation, and low-storage failures.

**Exit gate**

- A full round trip restores identical records, totals, calculation snapshot, and receipt hashes.
- Existing Supabase data remains unchanged after export.
- Import failures leave the destination database in its previous valid state.

### Sprint A6 — Private Android release

**Branch:** `feature/android-release-hardening`

**Objectives**

- Run full regression, offline, upgrade, storage, permissions, RTL, accessibility, and recovery tests.
- Produce release signing and recovery runbooks; store keys outside Git under the owner's control.
- Create a signed private release APK and installation/upgrade instructions.
- Update product context, release notes, and known limitations.

**Exit gate**

- All Phase A PRD acceptance criteria pass.
- A clean install and an in-place upgrade are verified on physical hardware.
- The release APK is archived outside Git with checksum; source is merged and released through the prescribed branch/tag workflow.

## 6. Phase B sprints — Reporting upgrade

### Sprint B1 — Share Target and local inbox

**Branches:** `feature/android-share-target`, then `feature/android-report-inbox`

**Objectives**

- Accept supported `ACTION_SEND` content types from WhatsApp and other applications.
- Normalize incoming text/URI content into a local draft and temporary private copy.
- Build an inbox/draft screen with original content, editable fields, reporter confirmation, derived family, Save, and Discard.
- Add retention/cleanup rules and robust handling for expired URI permissions.
- Add non-blocking likely-duplicate warnings.

**Exit gate**

- Real-device tests cover text, image, text+image where available, unsupported type, repeated share, cancellation, and app-cold-start share.
- Nothing enters authoritative expense storage before explicit administrator save.

### Sprint B2 — On-device extraction assistance

**Branch:** `feature/android-receipt-extraction`

**Objectives**

- Evaluate on-device OCR for Hebrew/English, privacy, app size, speed, and maintenance.
- Suggest merchant/title, amount, and date while preserving original content.
- Show confidence/ambiguity and require confirmation.
- Measure suggestion accuracy on a representative private test set without committing receipts to Git.

**Exit gate**

- Extraction failure never prevents manual entry.
- No image or extracted text is sent to a remote service unless separately approved and disclosed.
- Accuracy and false-positive results justify keeping the feature; otherwise ship B1 without OCR.

### Sprint B3 — Optional structured participant aid

**Status:** Conditional; requires a new product decision after B1 usage.

**Objectives**

- Define a versioned, validated, size-bounded report package.
- Prototype a stateless participant form that sends the package through WhatsApp without direct database access.
- Prevent silent import and provide clear event/reporter mismatch warnings.

**Exit gate**

- The prototype materially reduces administrator effort compared with B1.
- Security, identity limitations, maintenance cost, and user instructions are accepted before productization.

### Sprint B4 — Reporting release hardening

- Complete share-source compatibility matrix and device testing.
- Verify upgrade and backup compatibility with all Phase A data.
- Update privacy text, help, release notes, version, and signed release artifacts.
- Release only after all selected Phase B requirements pass.

## 7. Phase C sprints — Google Play distribution

### Sprint C0 — Policy and store readiness audit

**Branch:** `feature/play-readiness`

**Objectives**

- Re-check current Google Play target SDK, testing, account, content, privacy, data-safety, and developer-verification requirements.
- Audit permissions and remove any not strictly required.
- Finalize privacy policy, support path, store copy, screenshots, icon, feature graphic, and localization.
- Decide whether broader distribution changes backup encryption or application-lock requirements.

**Exit gate**

- A dated compliance checklist cites current official requirements.
- Store declarations match actual runtime behavior and dependencies.

### Sprint C1 — AAB, signing, update, and testing tracks

**Branch:** `feature/play-build-release`

**Objectives**

- Produce the signed AAB and configure Play App Signing/upload key procedures.
- Run pre-launch checks and internal testing.
- Test Play-delivered clean installation and upgrade from the latest private APK.
- Validate database migrations, receipt access, backup/restore, and PDF sharing after update.

**Exit gate**

- Internal-track build passes technical and data-preservation tests.
- Signing recovery and release ownership are documented outside the repository.

### Sprint C2 — Closed test and production rollout

**Objectives**

- Complete any required closed test period and resolve feedback.
- Use staged rollout with defined halt criteria.
- Monitor crashes and user-reported data issues without collecting sensitive expense content.
- Publish release notes and verify restore/rollback guidance.

**Exit gate**

- All Phase C PRD acceptance criteria pass.
- Production rollout is complete or intentionally held at an approved stage with no data-loss issue.

## 8. Verification matrix

| Area | Automated | Emulator | Physical device | Manual visual |
|---|---:|---:|---:|---:|
| Calculation and settlement | Yes | Optional | Smoke | Report review |
| SQLite repositories/migrations | Yes | Yes | Yes | — |
| Receipt camera/picker/files | Partial | Yes | Yes | Yes |
| Backup/restore/import | Yes | Yes | Yes | Summary review |
| Share Target/WhatsApp | Partial | Limited | Yes | Yes |
| PDF/dashboard | Snapshot/data checks | Yes | Yes | Required |
| RTL/accessibility | Partial | Yes | Yes | Required |
| Install/upgrade/signing | Build checks | Yes | Yes | Required |

## 9. Data-safety and rollback plan

- Never migrate or delete the existing Supabase data as part of Android development.
- Treat migration to Android as copy/import, not cutover.
- Back up a local database before any destructive schema or restore operation.
- Keep backup and database readers backward-compatible within the documented support window; reject unknown future formats safely.
- Every release candidate must prove upgrade from the previous released schema.
- If a sprint introduces a data defect, stop release, preserve the affected files, and fix via a forward migration rather than destructive reset.

## 10. Immediate next action after approval

Start Sprint A0 only. Create `feature/android-foundation-spike` from the current `dev` integration state (after merging these approved planning documents as appropriate), then produce the four ADRs and a disposable on-device proof for Capacitor, SQLite, and private receipt storage. Do not change or remove the deployed web application.
