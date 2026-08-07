# Group Expense Sharing

A polished, offline-first Progressive Web App for splitting gathering expenses fairly across families, couples, individuals, teams, or any other group.

The app stores reusable group data on the device and keeps each gathering temporary. There is no backend or account. The architecture is ready for future Capacitor-based Android packaging without coupling business rules to the UI or storage implementation.

## Features

- Multiple independent groups
- Billing units for people who pay together
- Member profiles with active status, birth date, notes, and optional manual weight
- Automatic child weighting based on the gathering date
- Manual participant weights
- Touch-friendly attendance selection
- Multiple expenses per billing unit
- Camera-based receipt capture with on-device OCR amount detection
- Instant weighted-share and balance calculations
- Suggested payments between billing units
- Copyable settlement report
- Configurable currency, rounding, child threshold, child weight, and report footer
- LocalStorage persistence for groups, billing units, members, and settings
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

Attendance, expenses, and calculations are held only in memory and are discarded when a gathering is reset or left. Business functions do not import React or LocalStorage.

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

In the repository settings, select **GitHub Actions** as the GitHub Pages source. The Vite base path is derived automatically from the repository name during the workflow.

## Data and privacy

All persistent data stays in the browser's LocalStorage on the current device. Receipt photos and OCR processing stay in the browser and are discarded with the gathering. The OCR language model may be downloaded on the first scan and is then cached by the OCR engine. Clearing site data removes saved app data.
