# Script Properties

This project uses Apps Script **Script Properties** for runtime-owned values and secrets.

## Policy

- Keep **club-facing settings** in `Club_Config` (for example club name, session names, feature flags, banner/member form values).
- Keep **runtime/secrets/integration values** in Script Properties.
- Do not move club-editable values back into Script Properties unless there is a clear runtime or secret-management reason.

## Expected properties (current)

### Core runtime

| Property | Required | Notes |
|---|---:|---|
| `SPREADSHEET_ID` | Yes | Spreadsheet binding for runtime operations. |
| `ENABLE_SUPPORT_MENU` | No | Shows `Admin → Support tools` when set to `true`. |
| `ENABLE_PERF_LOGS` | No | Enables server-side perf timing logs when value is literal `true` (case-insensitive after trim). Default is disabled. |

### Square integration

| Property | Required | Notes |
|---|---:|---|
| `APP_ENV` | Yes | Runtime environment label used by Square configuration checks (for example `DEV`, `PROD`). |
| `SQUARE_BASE_URL` | Yes | Square API base URL. |
| `SQUARE_APPLICATION_ID` | Yes | Square application ID. |
| `SQUARE_ACCESS_TOKEN` | Yes | Square access token (secret). |
| `SQUARE_LOCATION_ID` | Yes | Square location ID. |
| `SQUARE_VERSION` | Yes | Square API version header value. |
| `SQUARE_CURRENCY` | Yes | Currency code (runtime defaults to `GBP` if blank, but set explicitly). |
| `SQUARE_SYNC_ROOT_CATEGORY_ID` | No | Optional catalogue sync filter. |
| `SQUARE_SYNC_ROOT_CATEGORY_NAME` | No | Optional catalogue sync filter name. |

### Other integration/runtime

| Property | Required | Notes |
|---|---:|---|
| `WEBHOOK_TOKEN` | Conditional | Required when using `Webhook.gs` endpoint protection. |

## Temporary fallback properties

These are legacy fallbacks and should be treated as transitional:

| Property | Status | Fallback behaviour |
|---|---|---|
| `MEMBERS_FORM_URL` | Legacy fallback | Used only when `Club_Config.member_form_url` is blank. |
| `BANNER_URL` | Legacy fallback | Used only when `Club_Config.banner_url` is blank. |

Preferred source for these values is `Club_Config`.

## Admin UI coverage

The Admin Settings UI currently manages most runtime properties used day-to-day, but **`APP_ENV`**, **`WEBHOOK_TOKEN`**, and **`ENABLE_PERF_LOGS`** are not currently exposed there and may still require direct Script Properties management.

## Environment guidance

- Keep separate values for DEV and production runtimes.
- Never commit secrets to GitHub.
- Document any newly introduced property in this file and in the PR notes.
