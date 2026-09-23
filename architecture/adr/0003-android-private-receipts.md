# ADR 0003: Private receipt file storage

**Status:** Accepted

**Date:** 2026-09-23

## Context

Receipt images are potentially large and sensitive. They must survive application restarts and participate in backup/restore without inflating or corrupting the structured database.

## Decision

Copy accepted receipt images into application-private storage through the Capacitor Filesystem API. Store only metadata and a relative managed path in SQLite. Use the Android photo picker/camera through the Capacitor Camera API. Share files externally only through temporary content URIs with scoped grants.

Disable Android automatic cloud backup and device-transfer extraction for the live database and private files. Product backup is explicit, versioned, and user initiated.

## Consequences

- Receipt bytes are not stored as base64 database columns.
- Imported content is owned by the app after the source URI permission expires.
- Orphan cleanup, missing-file recovery, backup manifests, and file integrity checks are required.
