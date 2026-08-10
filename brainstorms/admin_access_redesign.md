# Administrator access and self-hosted instance redesign

The repository is generic and reusable, while every deployed site and database remain a private self-hosted instance.

## Decisions

- One deployment uses its own site, Supabase project and data.
- The maintainer's production database and site are not shared with other installations.
- Administration is accessible from a stable link and from the reporting flow after code entry.
- The administrator code is server-validated and may be changed by any authenticated administrator.
- Participants receive event-scoped access, not general group membership.
- Existing production data and the current deployed site must remain intact throughout the change.

## Q&A log

1. **Requested change:** Any authorized person should be able to open administration from any device using a shared code; administrators may change the code.
2. **Entry model:** Separate administration and reporting links, with a Manager action available from reporting.
3. **Hosting boundary:** The repository is generic, but other users must deploy their own site and Supabase project rather than use the maintainer's instance.
4. **Implementation approval:** Document and implement the redesign while keeping the live site online and preserving all existing database content.

## Open flags

- The initial production administrator code must be chosen during the legacy-owner bootstrap flow.
- Production promotion remains subject to explicit user approval after verification.
