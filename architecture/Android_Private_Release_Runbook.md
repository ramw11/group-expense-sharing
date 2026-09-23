# Android Private Release Runbook

## Product

- Display name: `מתחלקים`
- Application ID: `com.ramw11.groupexpenses`
- Version source: root `package.json`
- APK name: `mitchalkim-v<version>-release.apk`

## Build ownership

The release keystore and its password file live only under the ignored local
folder `release-artifacts/signing/`. Back up that entire folder in two secure
locations. Losing it prevents installation of future private upgrades over the
existing app.

Never send `keystore.properties` or the keystore through Git, GitHub, the APK,
or a public issue. The APK itself may be sent privately through WhatsApp.

## Release build

1. Run `npm ci`, `npm test`, `npm run lint`, and `npm run build`.
2. Run `npm run android:sync`.
3. From `android`, run `gradlew.bat :app:testDebugUnitTest :app:connectedDebugAndroidTest` with a target device or emulator available.
4. Run `gradlew.bat :app:assembleRelease`.
5. Verify the APK signature using Android SDK `apksigner verify --verbose`.
6. Record a SHA-256 checksum beside the APK.
7. Test clean installation, creation of data, restart persistence, and an in-place reinstall before sharing.

## Installation and upgrade

On the phone, allow APK installation for the application used to open the
WhatsApp attachment. Open the APK and choose Install. Future versions signed by
the same key can be installed directly over the current app and preserve its
SQLite database and private receipts.

Before every upgrade, create a full backup from Settings → Backup, restore, and
import, then save that `.gesbackup` file outside the phone.

## Moving existing web data

In the web manager, open Settings and choose **Download full backup**. This is a
read-only copy and does not alter Supabase. Transfer the resulting `.gesbackup`
file to the phone and select **Import backup from the website or app** on first
launch, or use Settings → Backup, restore, and import later.
