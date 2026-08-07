# Group Expense Sharing

A polished, offline-first Progressive Web App for splitting gathering expenses fairly across families, couples, individuals, teams, or any other group, with optional shared groups powered by Supabase.

The app stores reusable group data on the device and keeps each gathering temporary. There is no backend or account. The architecture is ready for future Capacitor-based Android packaging without coupling business rules to the UI or storage implementation.

## Features

- Multiple independent groups
- Billing units for people who pay together
- Member profiles with active status, birth date, notes, and optional manual weight
- Automatic child weighting based on the gathering date
- Manual participant weights
- Touch-friendly attendance selection
- Resumable event drafts saved on the device
- Custom names for individual events
- Multiple expenses per billing unit
- Camera-based receipt capture with on-device OCR amount detection
- Instant weighted-share and balance calculations
- Suggested payments between billing units
- Copyable settlement report
- Configurable currency, rounding, child threshold, child weight, and report footer
- LocalStorage persistence for groups, billing units, members, and settings
- Shareable group links and real-time multi-device synchronization
- Installable PWA with offline support
- Hebrew-first interface with an English option and full RTL support
- Responsive mobile and desktop interface

Cloud sync, accounts, shared editing, payment integrations, and exports are intentionally outside the v1.0 MVP.

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

Attendance and expenses can be saved as a per-group draft and resumed later. Resetting an event clears its draft. Business functions do not import React or LocalStorage.

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

Unshared groups stay in the browser's LocalStorage. When a group is explicitly shared, its group data, events, attendance, expenses, and compressed receipt photos are synchronized to the connected Supabase project. OCR processing itself stays in the browser.
