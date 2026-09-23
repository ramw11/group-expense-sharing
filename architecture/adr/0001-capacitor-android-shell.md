# ADR 0001: Capacitor Android shell

**Status:** Accepted

**Date:** 2026-09-23

## Context

The existing product is a React 19, TypeScript, and Vite application with a framework-independent calculation engine. The Android edition must be a real installed application, work offline, access native storage and sharing, and remain eligible for future Google Play distribution.

## Decision

Use Capacitor 8 as the native Android shell and retain the existing web toolchain. Commit the generated `android/` project because it contains application configuration and may require reviewed native changes. Keep generated web assets, build outputs, local SDK paths, APK/AAB files, and signing material out of Git.

The Android edition receives an explicit composition root. Web-only cloud and participant behavior must not be selected through scattered platform checks.

## Consequences

- The existing UI and calculation code can be reused.
- Native Android features are available through plugins or small reviewed native bridges.
- Android Studio, JDK 21, and Android SDK tooling become build prerequisites.
- Capacitor core, CLI, and Android versions must remain aligned.
