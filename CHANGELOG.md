# Changelog

## Unreleased

## 2.0.1 - 2026-09-23

- Fixed Android backup import by opening the native system document picker, including Google Drive and other document providers, for `.gesbackup` files.
- Prevented Android upgrades from loading stale website PWA assets by packaging a service-worker-free native bundle on an isolated internal origin.

## 2.0.0 - 2026-09-23

- Added a complete single-administrator Android edition that runs locally in Capacitor without loading the Supabase application.
- Added versioned SQLite persistence and application-private receipt files with serialized writes and restart-safe state.
- Added direct offline management of families, members, events, attendance, expenses, receipts, calculations, dashboard, and settlements.
- Made the expense reporter mandatory in Android and derive the paying family from that reporter; editing the reporter updates the family.
- Added Android Sharesheet export for dashboard PDFs, calculation PDFs, images, and text reports.
- Added checksummed portable backup, transactional restore with a private safety copy, first-run import, and non-destructive web export for migration from Supabase.
- Added branded Android launcher icons and splash screens, semantic Android version codes, and named APK output files.
- Preserved the deployed web edition and existing Supabase data without schema or production-data changes.

- Replaced the dashboard PDF's canvas text renderer with browser-native DOM image capture to prevent Hebrew bold-text clipping throughout the report.
- Corrected vertical alignment and clipping inside exported balance badges and bold family labels.
- Fixed clipped Hebrew glyphs and overflowing headings in dashboard PDF exports.
- Replaced the paid-versus-share bar chart with a separate two-segment pie chart for every family.
- Replaced the dashboard gradient donut with an export-safe SVG family pie chart and changed reporter analytics to a clear table.
- Fixed dashboard PDF exports to use a consistent desktop-width layout, preserve readable scale across pages, and include the full family balance table.
- Added a standalone PDF export of the dashboard with charts, insights, and the final payment summary, without calculation details.
- Added PNG and multi-page PDF export for the full visual calculation audit report.
- Added a manager dashboard with family expense share, paid-versus-share balances, reporter totals, and largest-expense insights.
- Changed participant weighting to always prefer a configured manual weight (including zero), then age-based weight, then the default weight of one.
- Added a full manager calculation audit report with formulas, attendee weights, family breakdowns, reconciliation checks, and copy/download output.
- Added manager and reporter editing of expense titles and notes.
- Added late receipt upload and receipt replacement for existing expense reports.
- Added manager-side expense filtering by family and sorting by family or reporter.
- Fixed expense-row alignment and bidirectional text isolation in Hebrew report metadata.

## 1.2.0 - 2026-08-10

- Added shared manager-code access from any device, including code rotation by an authenticated manager.
- Added separate manager and event-reporting entry flows for self-hosted deployments.
- Isolated participant access to the invited event while preserving the existing production data.
- Added manager and reporter correction of expense amounts with database-enforced ownership.
- Made amount saving explicit beside each expense in the manager interface.
- Moved Supabase deployment configuration to environment variables and GitHub repository variables.
