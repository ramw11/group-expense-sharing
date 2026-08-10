# Changelog

## Unreleased

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
