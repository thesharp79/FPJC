# Current state and future direction

## Purpose

This document captures the current working state of the FPJC project and the intended direction after the recent runtime refactor and admin/settings changes.

It should be treated as the current reference point where older documentation still reflects earlier stages of the refactor.

## Current working model

- **GitHub** is the engineering source of truth.
- **Google Apps Script** is the current runtime and deployment layer.
- **Google Sheets** is the club operational data store.
- **Square** is the current payment platform.
- **DEV** is the active integration branch.

## Current runtime structure

The original monolithic sign-in runtime has now largely been split into focused root-level files.

### Bootstrap and configuration
- `00_ProjectConfig.gs`
- `01_RuntimeState.gs`

### Shared sheet/runtime helpers
- `20_SheetsShared.gs`

### Repository layer
- `21_MembersRepository.gs`
- `22_BasketsRepository.gs`
- `23_BasketLinesRepository.gs`
- `24_PaymentOptionsRepository.gs`

### Service layer
- `30_BasketService.gs`
- `31_BasketViewService.gs`
- `33_AttendancePostingService.gs`
- `34_PaymentResolutionService.gs`
- `35_DomainHelpers.gs`

### Admin / spreadsheet host integration
- `Code.gs`
- `90_AdminSettings.gs`
- `AdminSettings.html`

### Other runtime files
- `Index.html`
- `NotesSync.gs`
- `Square.gs`
- `SignInApp.gs`

## What has changed recently

### 1. Legacy Google Form refresh path removed
The old process that rebuilt Google Form member-name lists has been retired.
The current sign-in approach no longer depends on that flow.

### 2. Admin settings UI introduced
A settings surface now exists so operators can maintain:
- club-facing settings in `Club_Config`
- runtime/secret settings in Script Properties

This reduces reliance on direct Apps Script project-property editing.

### 3. `Club_Config` introduced
Club-facing values are now expected to live in the spreadsheet rather than in raw Script Properties where practical.

Current club-facing keys include:
- `club_name`
- `banner_url`
- `session_names_json`
- `feature_flags_json`

### 4. Script Properties still used for runtime/secrets
Script Properties remain the right place for:
- `SPREADSHEET_ID`
- Square credentials and environment values
- `ENABLE_SUPPORT_MENU`
- other runtime-owned values

## Intended menu model

The intended spreadsheet custom menu model is:

- one top-level `Admin` menu
  - `Settings` submenu
    - `Club settings`
    - `Square settings`
    - `Show settings summary`
    - `Validate configuration`
  - `Square` submenu
    - `Sync Square payment options`
    - `Reconcile Square basket payment`
  - optional `Support tools` submenu
    - `Preview Square payment sync`

`Support tools` should only be shown when `ENABLE_SUPPORT_MENU=true`.

## Current product direction

The longer-term product model is:
- **one centrally hosted runtime**
- **one local spreadsheet per club**
- **club-facing settings stored with the club sheet**
- **runtime/secrets managed centrally**
- **a future migration path away from Apps Script hosting without breaking the local sheet model**

## Architectural implication

The main code-separation exercise is largely complete.
The next value is now in product architecture and operational hardening, not in endlessly splitting files.

## Near-term priorities

1. stabilise the admin/settings and menu model
2. protect and hide `Club_Config` appropriately for non-admin users
3. reduce manual setup of Script Properties where safe
4. harden configuration validation and support tooling
5. document the club sheet contract clearly
6. prepare for a future central tenant registry/shared-runtime model

## What is deliberately deferred

These are recognised future concerns but not the immediate next step:
- full tenant registry implementation
- deeper Square/provider abstraction
- migration to external hosting
- deeper front-end split beyond the current `Index.html`

## Rule of thumb

Do not optimise the codebase for theoretical cleanliness ahead of operational value.
Prefer:
- narrow changes
- stable behaviour
- clearer admin controls
- safer onboarding and support paths
