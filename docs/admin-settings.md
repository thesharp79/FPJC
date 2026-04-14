# Admin settings

## Purpose

The Admin menu provides an operational settings workflow so volunteers can maintain club settings and runtime settings without editing code.

## Ownership model

### Club-facing values (owned in sheet)
Maintain in `Club_Config` via **Admin → Settings → Club settings**.

Current keys managed by the UI:
- `club_name` (required)
- `session_names_json` (required)
- `feature_flags_json` (required)
- `banner_url` (optional)

These are expected to remain club-facing and should not be moved back to Script Properties.

### Runtime/secrets values (owned in Script Properties)
Maintain via **Admin → Settings → Square settings**.

Current fields exposed by the UI:
- `SPREADSHEET_ID` (required)
- `SQUARE_BASE_URL` (required)
- `SQUARE_APPLICATION_ID` (required)
- `SQUARE_ACCESS_TOKEN` (required)
- `SQUARE_LOCATION_ID` (required)
- `SQUARE_VERSION` (required)
- `SQUARE_CURRENCY` (required)
- `SQUARE_SYNC_ROOT_CATEGORY_ID` (optional)
- `SQUARE_SYNC_ROOT_CATEGORY_NAME` (optional)
- `ENABLE_SUPPORT_MENU` (optional)

## Menu model (current)

Top-level custom menu in the spreadsheet:

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

## `ENABLE_SUPPORT_MENU`

- Location: Script Property
- Behaviour: when set to `true` (case-insensitive), `Support tools` is shown under `Admin`.
- Default behaviour: hidden when missing or not `true`.

## Validation expectations

`Validate configuration` checks:
- required sheets exist (`Members`, `Attendance`, `PaymentOptions`, `Baskets`, `BasketLines`, `OtherPayments`, `Club_Config`)
- required `Club_Config` keys are present
- required Script Properties are present
- optional warnings for useful-but-missing optional values

## Operational rule of thumb

- Put club-editable operational values in `Club_Config`.
- Keep secrets and runtime-owned integration values in Script Properties.
- Do not duplicate the same setting in both places unless there is an explicit temporary fallback reason.
