# Product Requirements Document (PRD)

## Group Expense Sharing Application (MVP)

### 1. Vision
Build a simple application for calculating shared expenses in any group. The first use case is family gatherings, but the design must support any kind of group. The product should prioritize simplicity, speed and maintainability over features.

> Note: the original PRD described an offline-first/localStorage MVP. The current product has evolved to shared multi-device events using Supabase. For the current stabilization baseline, `System_Engineering_Improvement_Plan_v1.0.md` governs architecture where it explicitly supersedes the original persistence/sharing assumptions.

### 2. Design Principles
- Follow KISS.
- Every screen should have a clear purpose.
- Calculations update instantly.
- Avoid unnecessary dialogs and configuration.
- Prefer simple solutions over clever ones.

### 3. Technology
- React + TypeScript + Vite
- Tailwind CSS
- Progressive Web App (PWA)
- Static deployment to GitHub Pages
- Architecture compatible with future Android packaging (Capacitor)
- Current shared-data implementation may use Supabase as defined by the System Engineering improvement plan.

### 4. Data Model

**Group**
- id
- name

**BillingUnit**
- id
- groupId
- name
- order

**Member**
- id
- billingUnitId
- name
- birthDate (optional)
- manualWeight (optional)
- active
- notes (optional)
- order

**Expense**
- id
- billingUnitId
- description (optional)
- amount

**Attendance**
- memberId
- present

**Settings**
- currency
- childAgeThreshold
- childWeight
- weightMode (automatic/manual)
- roundingMode
- reportFooter

### 5. Groups
Users can create independent groups. Examples: Family, Friends, Trip, Workplace, Sports team, Custom group.

### 6. Billing Units
A Billing Unit represents whoever pays together. Examples: Family, Couple, Individual, Team.

### 7. Members
Members belong to a Billing Unit. Weight can be determined automatically from birth date or manually from a configured weight. Only active members are shown by default.

### 8. Event / Gathering Workflow
1. Select a group.
2. Start a new event/gathering.
3. Choose attendees.
4. Enter expenses.
5. Review live calculations.
6. Copy/generate the report.
7. Finish/archive the event as supported by the current product.

### 9. Business Rules
- Weight is calculated using the event date.
- Automatic mode uses the configured child age threshold.
- Manual mode ignores birth date.
- Multiple expenses per Billing Unit are allowed.
- Share = participant weight × cost per weighted participant.
- Balance = paid - share.
- Positive balance receives money.
- Negative balance pays money.

### 10. Screens

**Home / Administration**
- Manage groups as supported by the current product baseline
- Create/Edit/Delete relevant master data

**Group / Family Management**
- Manage Billing Units
- Manage Members

**Event**
- Attendance
- Expenses
- Live Summary
- Settlement Table
- Report

**Settings**
- Currency
- Weight mode
- Child age threshold
- Child weight
- Rounding
- Report footer

### 11. Persistence
The original MVP persisted only Groups, Billing Units, Members and Settings locally and did not persist attendance or expenses. This assumption is superseded for shared events by the System Engineering improvement plan: shared business data required for multi-device operation must use the shared authoritative store.

### 12. Architecture
Separate UI, business calculations and storage. Business logic must not depend on a specific persistence mechanism so calculations remain independently testable.

### 13. Deployment
- Build successfully with npm.
- GitHub Actions for automatic deployment.
- Deploy to GitHub Pages.
- Include a clear README.

### 14. Future Expansion
Architecture may allow future additions without premature implementation: user accounts, Android/iOS packaging, payment integrations, PDF/Excel export, additional languages/currencies and other validated needs. Features not required by the current v1.0 stabilization plan remain out of scope.

### 15. Development Instructions
- Implement incrementally.
- Commit after completed milestones where practical.
- Ensure each milestone builds successfully before moving to the next.
- Keep the product focused and simple.

## Architecture precedence
For v1.0 architecture, persistence, event sharing, versioning and release acceptance criteria, see `architecture/System_Engineering_Improvement_Plan_v1.0.md`.