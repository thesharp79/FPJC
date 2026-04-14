# Club sheet configuration contract

## Objective

Define the minimum contract for club-owned configuration stored in the local club spreadsheet.

The aim is to remove dependence on manual Apps Script project properties for club-specific setup and to create a stable data contract that can survive a future migration away from Apps Script hosting.

## Ownership model

### Club-owned
The club should be able to maintain these values without touching code:
- club identity and contact wording
- class names
- banner / branding values
- local feature flags that are safe to expose
- local payment option catalogue values that fit the defined schema

### Platform-owned
The club sheet should not hold:
- platform secrets
- Square access tokens
- central API keys
- tenant registry state
- platform routing data other than the club's own identifier if needed

## Required tabs

Recommended required tabs for each tenant sheet:
- `Club_Config`
- `Members`
- `Attendance`
- `Baskets`
- `Basket_Lines`
- `Payment_Options`
- `Other_Payments`

Optional later tabs:
- `Branding`
- `Admin_Audit`
- `Diagnostics`

## `Club_Config` tab

This tab should be treated as a key/value configuration table.

Recommended columns:
- `Key`
- `Value`
- `Type`
- `Description`
- `Managed By`
- `Required`

### Suggested required keys

| Key | Type | Purpose | Managed By |
|---|---|---|---|
| `club_id` | text | Stable tenant identifier | platform |
| `club_name` | text | Club display name | club |
| `schema_version` | text | Sheet schema version | platform |
| `timezone` | text | Club timezone | platform default / club review |
| `banner_url` | text | Banner image URL | club |
| `support_email` | text | Contact shown in UI or support text | club |
| `support_phone` | text | Optional support phone | club |
| `session_names_json` | json | Ordered list of club class names | club |
| `default_signin_session` | text | Optional default class/session | club |
| `feature_flags_json` | json | Safe feature toggles | platform / club depending on flag |
| `branding_primary_colour` | text | Optional branding colour | club |
| `branding_secondary_colour` | text | Optional branding colour | club |
| `branding_logo_url` | text | Optional logo URL | club |
| `payment_provider_type` | text | Current provider, e.g. `square` | platform |
| `payments_enabled` | boolean | Whether digital payment paths are enabled | platform |
| `desk_payments_enabled` | boolean | Whether desk settlement is allowed | platform / club |

### Recommended optional keys

| Key | Type | Purpose |
|---|---|---|
| `welcome_text` | text | Optional landing text |
| `privacy_notice_url` | text | Club privacy notice link |
| `club_address` | text | Optional club address |
| `club_website_url` | text | Optional website |
| `notes_to_desk_staff` | text | Optional operator-facing note |

## `session_names_json`

Recommended format:

```json
["Vipers", "Juniors", "Youths", "Seniors"]
```

This allows class names to vary by club without changing application code.

## `feature_flags_json`

Recommended format:

```json
{
  "allow_banner": true,
  "allow_branding": true,
  "enable_square_checkout": true,
  "enable_competition_items": true,
  "enable_grading_items": true
}
```

Only expose flags that are safe and supported by the product.

## `Payment_Options` tab

This tab remains the club's local operational catalogue for chargeable items.

Recommended required columns:
- `Code`
- `Label`
- `Charge Type`
- `Amount`
- `Enabled`
- `Start Date`
- `End Date`
- `Allowed Channels`
- `Session Filter`
- `Square Variation ID`
- `Notes`

Notes:
- class/session names can vary by club, but `Session Filter` should still map to the club's configured session names
- provider-specific fields such as `Square Variation ID` should remain optional but supported

## `Members` tab

This remains the club-owned operational member dataset.
The product should continue to treat the current member schema as the contract, with schema versioning added to support future controlled change.

Key rule:
- the product owns the header contract
- the club owns the row data

## `Attendance` tab

This remains the audit trail for sign-in and settlement state from the club's point of view.
The application should continue to treat headers as contractual schema.

## Validation rules

The runtime should validate at tenant load time that:
- all required tabs exist
- `Club_Config` exists and contains required keys
- `schema_version` is supported
- required headers exist on operational tabs
- `payment_provider_type` is supported

If validation fails, the runtime should fail clearly with an operator-friendly message.

## Versioning

Every tenant sheet should carry a `schema_version` in `Club_Config`.

Use this to:
- detect incompatible old sheets
- support upgrade scripts later
- support a migration path to future hosting without losing tenant compatibility

## Product design rule

Any value that a club admin may reasonably need to change should be driven from the club sheet, not from Apps Script project properties.
