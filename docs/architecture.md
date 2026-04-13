# Architecture

## Objective

Provide a maintainable structure for the FPJC sign-in application so changes can be made safely through GitHub and Codex, while Apps Script remains the runtime platform.

## Runtime architecture

### Platform components

- **Apps Script Web App** provides the sign-in user experience
- **Google Sheets** holds members, attendance, baskets, payment options and payment records
- **Script Properties** hold environment and integration configuration
- **Square** provides catalogue data, payment links and payment reconciliation

## Current shape

### UI

- `Index.html` contains markup, styles and client-side JavaScript in one file

### Server-side application

- `SignInApp.gs` currently mixes:
  - configuration
  - utility functions
  - member lookup
  - basket lifecycle
  - payment option selection
  - attendance posting
  - cache management
  - payment resolution
  - housekeeping and admin helpers

### Integration

- `Square.gs` currently mixes:
  - Square config
  - raw API client behaviour
  - catalogue sync logic
  - basket payment link creation
  - payment status reconciliation

### Spreadsheet operations

- Spreadsheet access is currently spread across multiple files and is partly embedded inside service logic.

## Target module boundaries

The aim is **not** to move everything at once. The aim is to extract responsibilities gradually into focused files.

### Suggested future runtime split

#### `00_*` Shared config and bootstrap
- `00_ProjectConfig.gs`
- `01_RuntimeGuards.gs`

#### `10_*` App entry points and orchestration
- `10_SignInApi.gs`
- `11_AppInitialState.gs`

#### `20_*` Sheet repositories and shared spreadsheet helpers
- `20_SheetsShared.gs`
- `21_MembersRepository.gs`
- `22_AttendanceRepository.gs`
- `23_BasketsRepository.gs`
- `24_PaymentOptionsRepository.gs`
- `25_OtherPaymentsRepository.gs`

#### `30_*` Domain services
- `30_MemberLookupService.gs`
- `31_BasketService.gs`
- `32_AttendancePostingService.gs`
- `33_PaymentOptionService.gs`
- `34_CacheService.gs`

#### `40_*` Square and payment services
- `40_SquareConfig.gs`
- `41_SquareClient.gs`
- `42_SquareCatalogSync.gs`
- `43_SquareCheckout.gs`
- `44_PaymentResolutionService.gs`

#### `90_*` Admin and test utilities
- `90_AdminMenus.gs`
- `91_AdminCacheTools.gs`
- `95_TestHarness.gs`

## Current-to-target mapping

| Current file | Main future responsibility split |
|---|---|
| `SignInApp.gs` | `00_*`, `10_*`, `20_*`, `30_*`, `44_PaymentResolutionService.gs`, `91_AdminCacheTools.gs` |
| `Square.gs` | `40_SquareConfig.gs`, `41_SquareClient.gs`, `42_SquareCatalogSync.gs`, `43_SquareCheckout.gs` |
| `Index.html` | keep root for now; later split into `Index.html`, `Styles.html`, `App.html` only if sync workflow remains stable |
| `Code.gs` | keep as menu/bootstrap area or fold into `90_AdminMenus.gs` over time |
| `NotesSync.gs` | keep separate and stable unless changing note-sync behaviour |
| `90_AdminSettings.gs` | keep separate admin settings utilities |

## Design principles

- Keep spreadsheet header names as explicit contracts.
- Separate **sheet persistence** from **business logic**.
- Separate **Square raw API calls** from **payment business rules**.
- Keep **admin utilities** isolated from core user journey code.
- Minimise behavioural change during structural refactors.

## Immediate priority

The next safe refactor should be extracting shared configuration and sheet access concerns out of `SignInApp.gs`, then separating basket logic from payment resolution.
