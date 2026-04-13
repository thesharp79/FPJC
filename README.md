# FPJC

Fleming Park Judo Club sign-in and payment application built on Google Apps Script, with Google Sheets as the operational store and Square as the payment platform.

## Working model (current)

- **GitHub** is the engineering source of truth.
- **Google Apps Script** is the current runtime and deployment layer.
- **Google Sheets** is the club operational data store.
- **Square** is the current payment platform.
- **DEV** is the integration branch for active work.

For the best concise snapshot of where the project is now and where it is going, read:
- `docs/current-state-and-direction.md`

## Runtime structure (current)

The original monolithic runtime has now largely been split into focused root-level files.

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
- `SignInApp.gs` (compatibility surface still present for remaining legacy paths)
- `Webhook.gs`
- `appsscript.json`

## Repository notes

- Runtime Apps Script files are kept **flat at repository root** for sync-tool safety.
- New project documentation should go under `docs/`.
- Avoid hardcoding environment values or secrets in source; use Script Properties where runtime or secret ownership is required.

## Direction of travel

The agreed product direction is:

- **central runtime**
- **one local spreadsheet per club**
- **club-facing configuration in each club sheet (`Club_Config`)**
- **runtime/secrets in Script Properties for the current Apps Script phase**
- **a migration path away from Apps Script hosting later, without breaking the local-sheet tenant model**
