# Self-Hosted Instance and Administrator Access Design

**Status:** Approved implementation design  
**Date:** 2026-08-10  
**Scope:** Post-stabilization architecture required before v1.0.0

## 1. Product boundary

The repository is a generic, reusable, self-hosted group-expense application. It is not a public SaaS service and the maintainer's deployed site and Supabase project are not shared infrastructure for other installations.

Each deployment is an independent private instance with its own:

- static site;
- Supabase project and data;
- administrator access code;
- families, members, events, expenses and receipts.

Anyone who wants another instance must fork or clone the repository, create their own Supabase project, configure their own deployment and host it wherever they choose.

## 2. Instance configuration

Supabase project details and the public application URL must not be hard-coded as repository-specific source values. Runtime build configuration is supplied through environment variables and documented in `.env.example`:

- `VITE_SUPABASE_URL`;
- `VITE_SUPABASE_PUBLISHABLE_KEY`.

The publishable key is intentionally client-visible, but each installation must provide its own value. Privileged keys must never be exposed to the client or committed.

## 3. Entry points

The static application exposes two conceptual entry links using query parameters compatible with GitHub Pages:

- stable administration entry: `?view=admin`;
- event-specific reporting entry: `?event=<event-id>&access=<token>`.

The reporting screen includes an explicit "Manager" action. It opens administrator-code authentication and never silently creates a group.

## 4. Administrator authentication

Anonymous Supabase authentication remains an invisible transport identity. It is not administrator authority.

Administrator authority is granted by a server-validated shared code:

1. The code is stored only as a password hash in Supabase.
2. A successful code check creates an administrator session associated with the current anonymous Supabase user and the instance group.
3. Administrator RLS and privileged RPCs require a valid administrator session.
4. Any active administrator may change the code.
5. Changing the code revokes prior administrator sessions and creates a fresh session for the administrator performing the change.
6. Failed attempts are throttled in the database.
7. The UI never exposes authentication, ownership, Supabase or session terminology.

For the existing production instance, the current legacy owner session may bootstrap the first code. A fresh installation must set its initial code through an explicit deployment/setup procedure; an arbitrary first public visitor must never be able to claim administration.

## 5. Participant access

An event reporting token grants access only to its event. It must not create group-wide participant membership.

Participant access is represented as event-level access associated with the anonymous Supabase user. Participant read policies expose only the reporting context needed for the event:

- event identity and date;
- linked families;
- active members of linked families.

Participants may insert a new expense and optional receipt for that event. They may not read unrelated events, administrator settings, settlement data, other groups or unrestricted expense history, and may not update or delete existing business data.

Legacy group-wide participant memberships remain temporarily compatible for existing links during migration, but new event links use event-scoped access. Removal of obsolete access is performed only after verification.

## 6. Data preservation and migration

The production database already contains valuable family, member, event, attendance, expense and receipt data. Migration rules are:

- no destructive table recreation;
- no modification of applied migration files;
- forward-only, additive migration;
- record production counts and relationships before and after migration;
- preserve all existing identifiers and foreign-key associations;
- retain legacy owner access until administrator-code bootstrap is verified;
- retain the current deployed `deployment` branch until the replacement passes automated and browser acceptance;
- do not promote or tag until the user explicitly approves deployment.

## 7. Target database additions

The migration adds, without replacing existing business tables:

- administrator credential metadata per group;
- administrator sessions tied to authenticated anonymous users;
- administrator login-attempt throttling;
- event access tied to authenticated anonymous users;
- RPCs for initial-code bootstrap, administrator login, code rotation, session lookup and event joining;
- helper predicates used by RLS for administrator and event-scoped access.

All new exposed tables have explicit grants and RLS policies. `SECURITY DEFINER` RPCs use an empty `search_path`, validate `auth.uid()`, constrain inputs, and have explicit execution grants.

## 8. Application behavior

### Administration entry

1. Open `?view=admin` or choose Manager from reporting.
2. If the browser has a valid administrator session, load administration.
3. Otherwise show code entry.
4. On valid code, create a session and load the existing group.
5. Never create a new group merely by opening Manager.

### Existing-instance bootstrap

1. Existing legacy owner opens administration.
2. If no administrator code exists, show a one-time code-creation screen.
3. The server verifies legacy ownership before storing the first hash.
4. The new administrator session becomes the authority for subsequent access.

### Participant entry

1. Open the event link.
2. Exchange the token for event-level access.
3. Load only the event reporting context.
4. Select family and reporter, then submit an expense.
5. Optionally choose Manager and authenticate with the administrator code.

## 9. Generic installation contract

The README must describe:

1. creating a separate Supabase project;
2. applying migrations in chronological order;
3. configuring environment variables and GitHub Actions secrets/variables;
4. deploying the static application;
5. setting the first administrator code through the safe setup path;
6. verifying that the installation does not reference another operator's Supabase project.

## 10. Acceptance gates

- Existing production row counts and associations are unchanged by migration.
- The current production site remains available until promotion.
- A new browser can open the stable administrator link and authenticate with the shared code.
- An administrator can rotate the code and old sessions lose administrator access.
- An event link exposes only its event reporting flow.
- Reporting includes a Manager entry that requires the code.
- A participant cannot access unrelated events or administrator data through the Data API.
- Existing event calculations, expenses and receipt paths remain unchanged.
- Tests, lint, type checking and production build pass.
- Hebrew RTL and English LTR work at phone, tablet and desktop widths.

## 11. Precedence

This document supersedes the single-browser administrator-ownership and group-wide participant-membership assumptions in `System_Engineering_Improvement_Plan_v1.0.md` and `PROJECT_CONTEXT.md`. The remaining stabilization principles, calculation rules, data-preservation requirements and release gates continue to apply.
