# Changelog

## Unreleased

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
