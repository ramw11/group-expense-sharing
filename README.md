# Group Expense Sharing

A polished, Hebrew-first Progressive Web App for collecting and settling group expenses across families, couples, individuals, teams, or any other group.

The app has two deliberately simple flows. One manager maintains reusable families, events, attendance, calculations, and the final report. Participants open one reporting link, choose an event, family, and their name, then submit an expense manually or from a receipt photo. No participant account or password is required. Supabase stores reports from all devices while LocalStorage keeps manager drafts and settings. The architecture is ready for future Capacitor-based Android packaging without coupling business rules to the UI or storage implementation.

## Features

- Reusable families and groups, managed separately from events
- Multiple independent events with a name, date, and linked families
- Link families from either the event screen or the family repository
- Billing units for people who pay together
- Member profiles with active status, birth date, notes, and optional manual weight
- Automatic child weighting based on the gathering date
- Manual participant weights
- Touch-friendly attendance selection
- Resumable event drafts saved on the device
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
- LocalStorage persistence for families, events, members, and settings
- One reusable participant link with real-time expense delivery to the manager
- Installable PWA with offline support
- Hebrew-first interface with an English option and full RTL support
- Responsive mobile and desktop interface

Named user accounts, participant passwords, approval workflows, payment integrations, and exports are intentionally outside the v1.0 MVP.

## Architecture

```text
src/
├── business/    Pure calculation and settlement functions
├── components/  React UI grouped by feature
├── domain/      Data model and defaults
├── hooks/       React state integration
├── storage/     Replaceable persistence adapter
└── utils/       Framework-independent utilities
```

Attendance and expenses are saved per event and can be resumed later. The `event_families` relation links reusable families and events without nesting either inside the other. Participants may read the shared event and insert expenses; only the group owner may change setup or existing data. Business functions do not import React, Supabase, or LocalStorage.

## Installation

Requirements: Node.js 22 or later and npm.

```bash
git clone https://github.com/ramw11/group-expense-sharing.git
cd group-expense-sharing
npm install
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

The workflow in `.github/workflows/deploy-pages.yml` tests, lints, builds, and deploys the application automatically whenever `main` is updated.

The connected Supabase project uses the migrations in `supabase/migrations`. Anonymous sign-ins must be enabled under Authentication settings for passwordless group invitations.

In the repository settings, select **GitHub Actions** as the GitHub Pages source. The Vite base path is derived automatically from the repository name during the workflow.

## Data and privacy

Unshared manager drafts stay in the browser's LocalStorage. After the manager creates the participant link, group data, events, attendance, expenses, reporter identity, and compressed receipt photos are synchronized to the connected Supabase project. OCR processing itself stays in the participant's browser. Participants cannot change families, events, attendance, settlement settings, or existing expenses.
