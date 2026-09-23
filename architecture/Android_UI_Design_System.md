# Android UI Design System

## Direction

The Android edition keeps the established Split brand but removes the web
edition's public-entry and shared-administration chrome. It is a compact,
phone-first working ledger for one administrator.

## Visual language

- Ink `#182a20`: primary surfaces, text, and app background sections.
- Paper `#f6f2e8`: reading surfaces and forms.
- Lime `#c7f36a`: primary action and positive/paid values.
- Coral `#ff7657`: destructive action and debt emphasis.
- Violet `#8060e8`: proportional share and secondary data.
- Muted green `#6f7c72`: supporting labels.
- The existing split-circle mark is the launcher icon, splash mark, and the
  memorable brand element inside the application.

## Mobile layout

- One primary column, minimum 44px touch targets, and RTL-first flow.
- A compact top toolbar replaces the desktop hero/orbit.
- Family, attendance, expense, report, and settlement sections remain clearly
  separated, but decorative cards are reduced where they do not add hierarchy.
- Financial totals use tabular numerals and never depend on color alone.
- Long Hebrew names wrap; amount badges and controls must not clip at 360px.

## Interaction principles

- The administrator enters directly; there is no manager code or participant
  entry in the Android edition.
- Every expense starts with a reporter; family is derived and shown read-only.
- Destructive changes require confirmation.
- Save state is explicit, while repository writes remain serialized and local.
- Export, backup, and restore always describe where the resulting file goes.

## Export layout

PDF rendering uses a dedicated A4 layout with fixed page margins and explicit
page breaks. It must not shrink a screenshot of the phone UI. Hebrew text,
tables, pies, balance badges, and settlement rows are verified independently
of the responsive application layout.
