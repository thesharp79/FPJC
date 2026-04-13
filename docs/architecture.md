# Architecture

## Objective

Document the FPJC runtime architecture as it exists today, and the agreed direction for product evolution.

## Current platform shape

- **Runtime host:** Google Apps Script web app
- **Operational data store:** Google Sheets
- **Payments platform:** Square
- **Engineering source of truth:** GitHub

## Current runtime layers

The runtime has been split into focused root-level files.

### 1) Bootstrap and configuration
- `00_ProjectConfig.gs`
- `01_RuntimeState.gs`

Responsibilities:
- shared configuration reads
- runtime-level state and guards
- environment-aware defaults

### 2) Shared sheet/runtime helpers
- `20_SheetsShared.gs`

Responsibilities:
- common spreadsheet access and helpers used across repositories/services

### 3) Repository layer
- `21_MembersRepository.gs`
- `22_BasketsRepository.gs`
- `23_BasketLinesRepository.gs`
- `24_PaymentOptionsRepository.gs`

Responsibilities:
- tab-level read/write operations
- sheet schema/header contract handling
- persistence boundaries separated from business decisions

### 4) Service layer
- `30_BasketService.gs`
- `31_BasketViewService.gs`
- `33_AttendancePostingService.gs`
- `34_PaymentResolutionService.gs`
- `35_DomainHelpers.gs`

Responsibilities:
- basket lifecycle and totals
- basket presentation shaping
- attendance posting and settlement flow
- payment resolution decisions
- domain-level helpers

### 5) Admin/settings and host integration
- `Code.gs`
- `90_AdminSettings.gs`
- `AdminSettings.html`

Responsibilities:
- spreadsheet custom menu wiring
- admin settings dialogs and persistence helpers
- configuration validation/summaries
- support tool gating via `ENABLE_SUPPORT_MENU`

### 6) Remaining integration/runtime files
- `Square.gs`
- `NotesSync.gs`
- `SignInApp.gs` (legacy compatibility surface for remaining paths)
- `Index.html`
- `Webhook.gs`

## Configuration model (current)

### Club-facing configuration
Stored in the club spreadsheet `Club_Config` sheet (for example `club_name`, `session_names_json`, `feature_flags_json`, optional banner/member-form fields).

### Runtime/secrets configuration
Stored in Script Properties (for example `SPREADSHEET_ID`, Square credentials/environment values, support-menu toggle, and other runtime-owned keys).

## Menu model (current)

Top-level spreadsheet menu:
- `Admin`
  - `Settings`
    - `Club settings`
    - `Square settings`
    - `Show settings summary`
    - `Validate configuration`
  - `Square`
    - `Sync Square payment options`
    - `Reconcile Square basket payment`
  - optional `Support tools`
    - `Preview Square payment sync`

`Support tools` is shown only when `ENABLE_SUPPORT_MENU=true` in Script Properties.

## Immediate priorities (current)

1. Stabilise the admin/settings workflow and menu behaviour.
2. Keep `Club_Config` as the club-facing settings surface.
3. Reduce manual Script Properties setup where safe, without moving secrets into sheets.
4. Harden validation, diagnostics, and support operations.
5. Keep sheet schema and header contracts explicit and documented.

## Product direction (agreed)

- Move toward **one central runtime** serving clubs.
- Keep **one local spreadsheet per club** for operational control.
- Keep **club-facing configuration in the local sheet**.
- Keep **secrets/runtime-owned values in centrally managed runtime configuration** (Script Properties in the current Apps Script phase).
- Preserve a **migration path away from Apps Script hosting** to a future platform without breaking club sheet contracts.

## What this means for change planning

- The main structural file-splitting phase is largely complete.
- Prefer operational hardening and product-architecture steps over further theoretical reshuffling.
- Keep changes narrow, additive, and safe for live spreadsheet operations.
