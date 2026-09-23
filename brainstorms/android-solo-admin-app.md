# Android solo-admin app

## Summary

Design a phone-first Android edition of the group-expense application for one local administrator, without a shared database or participant-facing reporting flow.

## Key decisions so far

- The product will run as an application on the administrator's Android phone.
- Only the phone owner administers events and enters all expenses.
- Participants send their expense details to the administrator through WhatsApp; WhatsApp is not yet defined as an automated integration.
- No shared database is required.
- The application must produce the final calculation, including who pays whom and how much.
- Design work is isolated on branch `feature/android-solo-admin-app`, created from `dev`.
- No implementation has started.
- The existing React/TypeScript calculation engine is independent of React, Supabase, and LocalStorage, so it can be reused without changing the approved settlement mathematics.
- The current project is already a PWA and was intentionally kept compatible with future Capacitor packaging.
- The current Supabase repository and participant flow should be replaced or excluded in this edition, not mixed with local persistence.
- The Android edition will be a real installable Android application, not an installed website/PWA.
- The recommended packaging approach is Capacitor so the existing React UI and tested calculation engine can be reused inside a native Android application.
- The architecture must support future Google Play distribution, even if initial installation is private.
- Google Play publication is explicitly Phase C. Phase A produces a privately installable APK while preserving a standard Android project, stable package identity, and an upgrade path to a future signed AAB.
- Phase B upgrades expense intake, beginning with Android Share Target support for content received through WhatsApp.

## Q&A log

1. **What is the requested product direction?**
   - A personal Android application for a single event administrator. The administrator receives expense information from participants, records it, and generates the final settlement report.
2. **Should this be an installed website or a real Android application?**
   - A real Android application. Capacitor is the recommended packaging layer.
3. **Is future public distribution required?**
   - Yes. The application should be designed so it can later be published through Google Play without a rewrite.
4. **Is Google Play publication part of the first implementation phase?**
   - No. It is a future Phase C concern; Phase A focuses on a private APK.

## Open flags

- Decide whether the application must work fully offline and where local data is stored and backed up.
- Decide whether WhatsApp input is manual only or whether sharing/import automation is desired.
- Define installation and distribution method: PWA, installable APK, or Play Store package.
- Define whether existing web data must be migrated into the Android edition.
- Define device-change, backup, restore, and export requirements.
- Define which existing product capabilities remain in scope.
- Decide the expense-intake workflow, including how reporter and family identity are captured without a shared database.

## Proposed expense-intake architecture

- **Recommended Phase A:** WhatsApp remains the transport between participants and the administrator; the Android app becomes a system Share Target for receipt images and shared text.
- Sharing a receipt into the app opens an expense draft, stores a private local copy, and runs optional on-device OCR to suggest merchant, description, and amount.
- The administrator confirms the reporting member. The family is then derived from that member's master-data relationship rather than entered independently.
- WhatsApp does not provide reliable sender/contact identity to the receiving expense app, so shared content must never be treated as proof of reporter identity.
- Reports without a receipt are entered manually, with recent reporters and search reducing repeated work.
- **Not recommended for Phase A:** a participant client connecting directly to the administrator's phone. It would turn the phone into a server and introduce reachability, security, availability, and synchronization complexity.
- **Possible later enhancement:** a stateless participant form that creates a structured report package and sends it to the administrator through WhatsApp, without storing shared data on a server.
