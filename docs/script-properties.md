# Script properties

This project relies on Apps Script **Script Properties** for environment-specific configuration.

## Core application

| Property | Required | Purpose |
|---|---:|---|
| `SPREADSHEET_ID` | Yes | Target spreadsheet used by the application |
| `MEMBERS_FORM_URL` | No (legacy fallback) | Fallback URL for the member registration form if `Club_Config.member_form_url` is blank |
| `BANNER_URL` | No (legacy fallback) | Fallback banner URL if `Club_Config.banner_url` is blank |

## Square integration

| Property | Required | Purpose |
|---|---:|---|
| `APP_ENV` | Yes | Environment label such as `DEV` or `PROD` |
| `SQUARE_BASE_URL` | Yes | Square API base URL |
| `SQUARE_APPLICATION_ID` | Yes | Square application ID |
| `SQUARE_ACCESS_TOKEN` | Yes | Square API access token |
| `SQUARE_LOCATION_ID` | Yes | Square location ID |
| `SQUARE_VERSION` | Yes | Square API version header value |
| `SQUARE_CURRENCY` | No | Currency code, defaults to `GBP` |
| `SQUARE_SYNC_ROOT_CATEGORY_ID` | No | Optional Square category ID filter for catalogue sync |
| `SQUARE_SYNC_ROOT_CATEGORY_NAME` | No | Optional Square category name filter for catalogue sync |

## Environment guidance

Use different property values for DEV and production deployments.

### DEV
- Use a DEV spreadsheet copy
- Use Square sandbox or DEV-aligned credentials
- Use DEV deployment URL where relevant

### PROD
- Use the live spreadsheet
- Use live Square configuration only when the payment flow is validated
- Apply changes via controlled promotion from `DEV`

## Rules

- Do not commit real secrets into GitHub.
- Do not hardcode environment values into `.gs` or `.html` files.
- Any new script property introduced in code must also be documented here and in the PR description.
