# Group Expense Sharing

A polished, Hebrew-first Progressive Web App for collecting and settling group expenses across families, couples, individuals, teams, or any other group.

The app has two deliberately simple flows. One manager maintains reusable families, events, attendance, calculations, and the final report. Participants open an event-specific reporting link, choose their family and name, then submit an expense manually or from a receipt photo. No participant account or password is required. Supabase is the authoritative store for shared business data; LocalStorage contains device preferences only. The architecture remains suitable for future Capacitor-based Android packaging without coupling business rules to the UI or persistence layer.

## Features

- Reusable families and groups, managed separately from events
- Multiple independent events with a name, date, and linked families
- Link families from either the event screen or the family repository
- Billing units for people who pay together
- Member profiles with active status, birth date, notes, and optional manual weight
- Automatic child weighting based on the gathering date
- Manual participant weights
- Touch-friendly attendance selection
- Resumable events saved in Supabase
- Custom names for individual events
- Multiple expenses per billing unit
- Camera-based receipt capture with on-device OCR amount detection
- Participant reporting flow with event, family, and member selection
- Reporter identity stored alongside each submitted expense
- Manager-only family, event, attendance, and settlement controls
- Instant weighted-share and balance calculations
- Suggested payments between billing units
- Copyable settlement report
- Configurable currency, rounding, child threshold, child weight, and report footer
- Event-specific reporting links with real-time expense delivery to the manager
- Calculation settings snapshotted per event so historical results do not change
- Installable PWA with offline support
- Hebrew-first interface with an English option and full RTL support
- Responsive mobile and desktop interface

Named user accounts, participant passwords, approval workflows, payment integrations, and exports are intentionally outside the v1.0 MVP.

## Architecture

Engineering and product handoff documents:

- [`architecture/Group_Expense_Sharing_PRD.md`](architecture/Group_Expense_Sharing_PRD.md) — product requirements baseline
- [`architecture/System_Engineering_Improvement_Plan_v1.0.md`](architecture/System_Engineering_Improvement_Plan_v1.0.md) — v1.0 stabilization and QA baseline
- [`architecture/PROJECT_CONTEXT.md`](architecture/PROJECT_CONTEXT.md) — approved decisions, completed work, and current release status
- [`architecture/CODEX_PROJECT_ONBOARDING.md`](architecture/CODEX_PROJECT_ONBOARDING.md) — recommended learning order and next steps for coding agents

```text
src/
├── business/    Pure calculation and settlement functions
├── components/  React UI grouped by feature
├── domain/      Data model and defaults
├── cloud/       Supabase persistence and realtime refresh
├── storage/     Device preferences and one-time legacy migration
└── utils/       Framework-independent utilities
```

Attendance and expenses are saved per event and can be resumed later. The `event_families` relation links reusable families and events without nesting either inside the other. Participants may open the linked event and insert expenses; only the group owner may change setup or existing data. Business functions do not import React, Supabase, or LocalStorage.

## Installation

Requirements: Node.js 22 or later and npm.

```bash
git clone https://github.com/ramw11/group-expense-sharing.git
cd group-expense-sharing
npm ci
```

## Development

```bash
npm run dev
```

Run automated checks:

```bash
npm test
npm run lint
```

## Build

```bash
npm run build
npm run preview
```

The production output is written to `dist/`.

## Deployment

The workflow in `.github/workflows/deploy-pages.yml` tests, lints, builds, and deploys the application automatically whenever the stable `deployment` branch is updated. Ongoing development is kept on `dev`.

The connected Supabase project uses the migrations in `supabase/migrations`. Anonymous sign-ins must be enabled under Authentication settings for passwordless group invitations.

In the repository settings, select **GitHub Actions** as the GitHub Pages source. The Vite base path is derived automatically from the repository name during the workflow.

## Data and privacy

Families, members, events, attendance, expenses, reporter identity, calculation snapshots, and receipt associations are stored in Supabase. Compressed receipt images are stored in the private Supabase Storage bucket and loaded with signed URLs. OCR processing itself stays in the participant's browser and only suggests an editable amount. LocalStorage is limited to language, active-manager context, and the last opened participant event; legacy business data is removed after its one-time migration. Participants cannot change families, events, attendance, settlement settings, or existing expenses.

## Versioning

The canonical application version is the `version` field in `package.json`; the build injects it into Settings/About. Releases follow Semantic Versioning. A `v1.0.0` tag is created only after all Critical and High release gates in the engineering plan pass.
