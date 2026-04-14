# FPJC v1 sheet contract (runtime workbook)

## Scope

This document defines the **application-to-sheet contract** for FPJC runtime v1.

- It applies to the workbook used by the running sign-in/payment application.
- It is intentionally separate from tenant-registry design and onboarding registry work.
- Runtime tab names and headers in this contract follow live code in `00_ProjectConfig.gs`.
- Runtime validation resolves operational tab names from `SIGNIN_CFG.sheetNames` before applying header and per-sheet diagnostics.

## Required tabs

The workbook must contain these tabs:

- `Members`
- `Attendance`
- `PaymentOptions`
- `Baskets`
- `BasketLines`
- `OtherPayments`
- `Club_Config`

## Required headers by tab

### `Members`

For `Members`, the current runtime still depends on the broader legacy form-submit/upsert schema.
These headers are required for v1 and are order-sensitive in live validation paths.

- `TimeStamp`
- `Status`
- `Concessionary`
- `DD Start Date`
- `PrePay Remaining`
- `Session Name`
- `First Name`
- `Last Name`
- `Last Session`
- `Full Name`
- `Date of Birth`
- `Contact email address`
- `Address`
- `British Judo Association (BJA) License number`
- `BJA License expiry date`
- `Medical conditions / learning difficulties`
- `First Aid`
- `Email contact`
- `Photographs and videos`
- `Gradings / Records of success`
- `Contact 1 - Name`
- `Contact 1 - Telephone Number`
- `Contact 1 - Relationship to member`
- `Contact 2 - Name`
- `Contact 2 - Telephone Number`
- `Contact 2 - Relationship to member`
- `Data storage`
- `How did you hear about Fleming Park Judo Club`
- `Notes`

### `Attendance`

`Attendance` headers are also order-sensitive in legacy runtime validation paths.

- `Timestamp`
- `Session Date`
- `Session Name`
- `Full Name`
- `Intended Payment`
- `Payment Received`
- `PrePay Remaining`
- `Notes`

### `PaymentOptions`

- `Active`
- `Code`
- `Label`
- `Charge Type`
- `Amount`
- `Square Variation ID`
- `Session Filter`
- `Start Date`
- `End Date`
- `App Allowed`
- `Display Order`
- `Notes`

### `Baskets`

- `Basket ID`
- `Created At`
- `Session Date`
- `Status`
- `Settlement Method`
- `Total Amount`
- `Member Count`
- `Posted At`
- `Square Order ID`
- `Square Payment Link ID`
- `Square Payment ID`
- `Payment Resolved At`
- `Notes`

### `BasketLines`

- `Basket ID`
- `Line ID`
- `Member Key`
- `BJA Licence Number`
- `Full Name`
- `Date of Birth`
- `Session Date`
- `Session Name`
- `Line Type`
- `Payment Category`
- `Description`
- `Amount`
- `Payment Required`
- `Paid`
- `Payment Method`
- `Payment Option Code`
- `Square Variation ID`
- `Attendance Row Ref`
- `Posted At`
- `Notes`

### `OtherPayments`

- `Timestamp`
- `Basket ID`
- `Member Key`
- `BJA Licence Number`
- `Full Name`
- `Date of Birth`
- `Session Date`
- `Session Name`
- `Payment Category`
- `Description`
- `Amount`
- `Paid`
- `Payment Method`
- `Line ID`
- `Payment Option Code`
- `Square Variation ID`
- `Notes`

## `Club_Config` contract

### Required columns

- `Key`
- `Value`
- `Type`
- `Description`
- `Managed By`
- `Required`

### Required keys (blocking if missing/blank)

- `club_name`
- `session_names_json`
- `feature_flags_json`

### Recommended keys (warning if missing/blank)

- `club_id`
- `schema_version`
- `timezone`
- `payment_provider_type`
- `payments_enabled`
- `desk_payments_enabled`

### Optional keys (allowed blank)

- `banner_url`
- `support_email`
- `support_phone`
- `welcome_text`
- `privacy_notice_url`
- `club_website_url`
- `notes_to_desk_staff`

### JSON value requirements

- `session_names_json` must be valid JSON and must be a JSON array.
- `feature_flags_json` must be valid JSON and must be a JSON object.

## Supported enum values

### Basket statuses

- `BUILDING`
- `READY`
- `SIGNED_IN_AWAITING_PAYMENT`
- `PAYMENT_RESOLVED`
- `CANCELLED`
- `POSTED`

### Payment / settlement methods

- `APP`
- `DESK`
- `CARD`
- `CASH`
- `BANK_TRANSFER`
- `FREE`

## Runtime validation behaviour

Validation reports:

For `Members` and `Attendance`, validation checks both presence and leading-column header order to match current live dependencies.

- `errors`: blocking contract failures
- `warnings`: non-blocking but operationally important findings
- `checkedAt`: ISO timestamp of the validation run
- `schemaVersion`: value from `Club_Config.schema_version` when present

The v1 validator also raises warnings for duplicate operational identifiers:

- duplicate `Code` values in `PaymentOptions`
- duplicate `Basket ID` values in `Baskets`
