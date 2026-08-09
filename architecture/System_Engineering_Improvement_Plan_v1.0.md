# System Engineering Improvement Plan — v1.0

**Product:** Group Expense Sharing Application  
**Status:** Engineering baseline incorporating System Engineering review and QA findings  
**Date:** 2026-08-09

## 1. Purpose
This document defines the approved improvement scope for stabilizing the application and preparing it for a reliable v1.0 release. It is a focused stabilization package, not a rewrite. The priorities are deterministic multi-device shared state, preservation of calculation history, a minimal administrator/participant workflow, mobile usability and explicit product versioning.

## 2. Product principles
- KISS is the primary design principle.
- One administrator manages families, members and events.
- The administrator assigns families to an event and distributes an event-specific reporting link.
- A participant selects family and reporting member, then submits an expense manually or with receipt/OCR assistance.
- Participants trust each other; conventional accounts, complex authorization and anti-fraud are not v1.0 requirements.
- Only the administrator produces the final calculation/settlement report.
- Do not add infrastructure, abstractions or services without a demonstrated requirement.

## 3. Engineering assessment
Retain the existing stack: React/TypeScript, GitHub Pages, Supabase database/Storage and client-side receipt OCR. The principal architectural weakness to remove is ambiguous ownership between local persistent business state and Supabase shared state. The existing domain model is sufficiently close to the target and should be incrementally stabilized rather than rewritten.

## 4. System Engineering requirements

### SE-01 — Supabase as authoritative shared state — CRITICAL
Supabase shall be authoritative for group, families, members, events, attendance, expenses, receipt metadata and event calculation configuration. localStorage shall be limited to device-local preferences or harmless cache information. Do not build an offline-first synchronization architecture for v1.0.

### SE-02 — Deterministic snapshot/synchronization — CRITICAL
Refactor snapshot loading and realtime refresh so cloud state cannot silently replace unrelated valid state. Remove ambiguous local/cloud ownership. If generic multi-group support creates unnecessary complexity, v1.0 may explicitly support one actively managed group.

### SE-03 — Event-specific sharing — HIGH
A reporting link shall identify a specific Event rather than conceptually joining a shared repository/group. Opening it shall lead directly to that event's reporting flow. Do not expose repository, ownership, synchronization or group-membership concepts to participants. Use the simplest event token mechanism compatible with GitHub Pages and the trust model.

### SE-04 — Deterministic administrator ownership/recovery — HIGH
Remove heuristic selection/recovery of the administrator's group. Administrator context must be deterministic. Anonymous Supabase authentication may remain as an invisible implementation detail.

### SE-05 — Correct Event terminology — REQUIRED MEDIUM
Where `GatheringDraft` represents the persisted/shared active event, refactor the domain terminology toward `Event`, including models, repositories, components, tests and migrations where safe. Avoid cosmetic renaming that adds risk without reducing ambiguity.

### SE-06 — Historical calculation configuration — HIGH
Snapshot calculation parameters into each event at creation: child age threshold, child weight, weight mode and rounding mode. Global settings are defaults for new events. Changing defaults must not change historical event calculations.

### SE-07 — Preserve settlement mathematics — HIGH
Do not redesign the calculation model unless tests prove a defect. Preserve attendance filtering, participant weights, family roll-up, balance = paid - allocated share, debtor-to-creditor settlements and rounding invariants.

### SE-08 — OCR remains simple — REQUIRED MEDIUM
Keep OCR client-side. OCR only suggests an amount and must be reviewable/correctable. OCR failure must never block manual entry. Do not introduce cloud OCR, Vision services or AI APIs for v1.0.

### SE-09 — Receipt persistence — HIGH
Continue using Supabase Storage. Receipt association must remain deterministic as Event -> Expense -> Receipt and survive reload/cross-device access where appropriate. Do not store receipt images as base64 in DB/localStorage.

### SE-10 — Participant flow — HIGH
Target: open event link -> event -> select family -> select reporting member -> enter expense/capture receipt -> review amount -> submit -> confirmation -> optionally add another expense. Do not route event-link participants through an unnecessary participant dashboard. Confirmation should clearly show amount, family, reporter and successful save.

### SE-11 — Administrator flow — REQUIRED MEDIUM
Focus administration on Families, Events and Settings. Inside an Event prioritize identity/date, participating families, attendance, expenses, reporting link, calculation summary and settlement/final report. Keep family/member management compact and collapsible on mobile.

### SE-12 — Mobile usability — REQUIRED MEDIUM
Validate narrow Android/mobile, tablet-ish and desktop viewports. Correct horizontal overflow, oversized expense sections, unusable tables, off-screen actions/dialogs, family/member collapsed sections, settlement presentation, receipt controls and Hebrew RTL. Prefer responsive rows/cards over desktop tables on narrow screens.

### SE-13 — Product versioning — HIGH
Introduce Semantic Versioning (`MAJOR.MINOR.PATCH`) with one canonical source, preferably `package.json`. Expose the version unobtrusively in Settings/About and consume it automatically from the build. Do not duplicate hard-coded versions. Git tags are sufficient for releases.

## 5. QA/Test findings and required verification

| ID | Priority | Verification |
|---|---|---|
| QA-01 | Critical | Multi-device consistency: Admin A creates/opens event; B submits expense #1; C submits expense #2; A sees both; refresh; all persisted state remains correct and unrelated data is not overwritten. |
| QA-02 | High | Concurrent/near-concurrent submissions from two devices create each expense exactly once. |
| QA-03 | High | Different reporters under the same family aggregate to the correct family paid total. |
| QA-04 | High | Allocated total reconciles to total expenses within rounding policy; balances and settlements reconcile. |
| QA-05 | High | Changing global defaults does not change a historical event calculation. |
| QA-06 | High | Receipt survives submission/reload and remains associated with the correct expense. |
| QA-07 | Required Medium | OCR failure leaves manual expense entry fully usable. |
| QA-08 | Required Medium | Primary admin/participant flows work on narrow mobile, tablet and desktop, including Hebrew RTL. |
| QA-09 | High | Existing production families, members, events and expenses are not silently deleted/corrupted by migration. |
| QA-10 | High | Displayed version comes from the canonical build version; do not tag v1.0.0 until release gates pass. |

## 6. Primary v1.0 acceptance scenario
1. Administrator Device A creates/opens an event and assigns participating families.
2. Administrator generates an event-specific reporting link.
3. Participant Device B opens it in a fresh browser/device, selects family/reporter and submits expense #1.
4. Administrator A sees expense #1 without losing event state.
5. Participant Device C opens the same link and submits expense #2.
6. Administrator A sees both expenses.
7. Refresh relevant devices.
8. Verify event, families, attendance, expenses, reporters, paid-per-family totals, total expenses, settlement and receipt associations.
9. Verify no data disappears, duplicates or overwrites unrelated state.
10. Repeat with concurrent or near-concurrent participant submissions.

**Release gate:** do not assign/tag `v1.0.0` merely because the build succeeds. The primary multi-device scenario and all Critical/High gates must pass.

## 7. Version/release policy
- PATCH: bug fixes only.
- MINOR: backward-compatible functionality or meaningful UX improvements.
- MAJOR: breaking product/data-model changes.
- Use one canonical version source.
- Git tags are sufficient; do not introduce an elaborate release platform.

## 8. Explicitly deferred/out of scope
Do not implement in this stabilization package: full login/accounts, complex roles/permissions, fraud prevention, cloud OCR/AI receipt processing, notifications, advanced offline mode, multi-admin collaboration, advanced multi-group support, analytics/dashboards, payment integrations, native Android application, major visual redesign, speculative features, or unrelated low-severity/cosmetic findings.

## 9. Implementation constraints
- Do not rewrite from scratch.
- Retain React, GitHub Pages, Supabase and client-side OCR unless a concrete blocker is documented.
- Inspect current Supabase schema/migrations and stored data before persistence changes.
- Use backward-compatible migrations where practical and never silently discard production data.
- Implement incrementally with logically separated changes.
- After each stage run tests, type checking, linting if configured, and production build.
- Record low-priority findings for later rather than expanding scope.

## 10. Required engineering deliverables
1. Before/after architecture summary.
2. Implemented changes mapped to SE IDs.
3. Database/schema migrations.
4. Versioning implementation and assigned version.
5. Automated tests added/changed.
6. Manual acceptance results mapped to QA IDs.
7. Remaining Critical/High issues.
8. Deferred Medium/Low backlog, separately listed and not implemented.
9. Explicit recommendation whether the build is ready to tag `v1.0.0`.

## 11. Approval baseline
**System Engineering:** proceed with focused architectural stabilization; do not add new product features until deterministic shared state and the v1.0 multi-device acceptance scenario are verified.

**QA:** block `v1.0.0` if any Critical/High requirement remains unresolved or the primary multi-device acceptance scenario fails.

## Related document
See `architecture/Group_Expense_Sharing_PRD.md` for the governing product requirements. Where the original PRD's offline/local persistence assumptions conflict with this v1.0 shared-event architecture, this document supersedes those architecture-specific assumptions.