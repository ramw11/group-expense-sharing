# Android Foundation Spike Report

**Date:** 2026-09-23

**Branch:** `feature/android-foundation-spike`

**Status:** Complete; emulator and physical-device verification passed

## Scope

Sprint A0 verifies that the existing React/Vite application can run inside a native Android shell and use the native persistence and receipt-storage capabilities required by Phase A without connecting the Android runtime to Supabase.

## Selected baseline

| Item | Decision |
|---|---|
| Android shell | Capacitor 8.5.2 |
| Application ID | `com.ramw11.groupexpenses` |
| Display name | `מתחלקים` |
| Android API range | minimum 24, compile/target 36 |
| Java | Android Studio bundled JDK 21.0.8 |
| Structured storage | `@capacitor-community/sqlite` 8.1.1 |
| Receipt selection | `@capacitor/camera` 8.2.4 using Android photo picker |
| Private files | `@capacitor/filesystem` 8.1.3, `Directory.Data` |
| Automatic Android backup | Disabled; product-controlled backup will be implemented later |

## Verification performed

### Web and TypeScript regression

- `npm run build`: passed.
- `npm run lint`: passed.
- `npm test`: 4 test files and 23 tests passed.
- `npm audit --omit=dev --audit-level=high`: 0 vulnerabilities.
- `npx cap doctor`: Android configuration reported healthy.
- `:app:testDebugUnitTest`: passed.
- `:app:connectedDebugAndroidTest`: passed on API 34 emulator.

### Native build

- Gradle `assembleDebug`: passed with 189 tasks.
- Debug APK created at `android/app/build/outputs/apk/debug/app-debug.apk`.
- APK size during the spike: 17,678,215 bytes.
- The APK is a local build artifact and is excluded from Git.

### Android runtime

Verified on the existing Android Studio AVD `poco_x5_pro_5g`:

1. Installed and launched package `com.ramw11.groupexpenses`.
2. Created private SQLite database `solo-admin-foundation-spikeSQLite.db`.
3. Created a table, inserted a timestamped row, queried it by ID, compared its value, and closed the connection successfully.
4. Opened the Android photo picker without broad media-library permission.
5. Selected a test image, read the scoped URI, and copied it to application-private `files/receipts/` storage.
6. Verified the private copy existed and contained 95,243 bytes.
7. Installed a rebuilt APK over the existing installation and verified that both the SQLite database and private receipt remained intact.
8. Repeated the SQLite write/read operation after the in-place upgrade.
9. No fatal application exception was observed.

## Security and packaging observations

- Database and receipt storage are inside the application sandbox.
- Android automatic backup/device transfer is disabled for the application; explicit portable backup remains a later Phase A deliverable.
- Keystores, signing properties, APKs, and AABs are ignored by Git.
- The SQLite plugin packages SQLCipher native code even in non-encrypted mode. Phase C must re-check export-compliance and Google Play declarations.
- The initial Gradle build emitted upstream unchecked/deprecation warnings from Capacitor plugins but completed successfully.
- Capacitor SystemBars uses recommended native inset handling to avoid early CSS injection errors and layout glitches.

## Physical-device gate

The administrator installed the spike APK on the target Android phone and confirmed
that the Sprint A0 smoke test passed on 2026-09-23. Sprint A0 is therefore approved
for integration into `dev`.
