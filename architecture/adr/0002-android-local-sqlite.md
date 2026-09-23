# ADR 0002: Local SQLite persistence

**Status:** Accepted for Phase A

**Date:** 2026-09-23

## Context

The Android edition has one administrator, no shared operational database, and must preserve relational event data across offline use and application upgrades.

## Decision

Use SQLite in Android application-private storage through `@capacitor-community/sqlite` 8.1.1. Place all SQL behind repository interfaces and forward-only schema migrations. Use transactions for aggregate writes and imports. The live Android runtime must not initialize Supabase.

The plugin is MIT licensed, supports Capacitor 8, schema upgrade statements, and JSON import/export. It uses SQLCipher native dependencies even for unencrypted databases; the resulting encryption-export and store-declaration implications must be reviewed again before Phase C.

## Consequences

- Data remains queryable, transactional, and independent of network availability.
- Repository contract tests can protect behavior across local and cloud adapters.
- Schema/version discipline is required from the first production database.
- Web debugging support from the plugin is not part of the Android product and will not become an implicit browser database.
