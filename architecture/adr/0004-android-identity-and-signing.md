# ADR 0004: Android identity and signing ownership

**Status:** Accepted

**Date:** 2026-09-23

## Decision

- Application ID: `com.ramw11.groupexpenses`
- Display name: `מתחלקים`
- Minimum Android API: 24, matching Capacitor 8 support.
- Compile and target API for the initial project: 36; revalidate at every release and before Google Play submission.
- Development builds use the normal debug key only.
- The owner will create and retain the stable release/upload key outside the repository before the first privately distributed release APK.
- Keystores, passwords, signing properties, APKs, and AABs are ignored by Git and must be backed up separately under the owner's control.

## Rationale

The application ID and signing identity determine upgrade continuity. Fixing them before a real release allows private APK installations to upgrade later and supports migration to Play App Signing without changing the application namespace.

## Consequences

Losing the release key may prevent upgrades to privately installed builds. Signing setup and recovery instructions are therefore Phase A release blockers, even though Google Play publication remains Phase C.
