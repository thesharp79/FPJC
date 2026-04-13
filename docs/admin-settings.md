# Admin settings surface

The Admin menu now provides a safer settings workflow so volunteers do not need to edit Apps Script project settings directly.

## Menu actions

- `Club settings` - edit club-facing values in `Club_Config`
- `Square settings` - edit runtime/secret Script Properties used by Square and sheet binding
- `Show settings summary` - show set/blank status for managed keys
- `Validate configuration` - run operational checks for tabs, config keys, and Script Properties

## Club_Config keys managed in UI

- `club_name`
- `banner_url`
- `member_form_url`
- `session_names_json`
- `feature_flags_json`

These values are stored in the `Club_Config` sheet and should remain club-editable via admin tools (not through Script Properties).

Validation currently treats these as required:
- `club_name`
- `session_names_json`
- `feature_flags_json`

Validation currently treats these as optional (can be blank):
- `banner_url`
- `member_form_url`

## Script Properties managed in UI

- `SPREADSHEET_ID`
- `SQUARE_BASE_URL`
- `SQUARE_APPLICATION_ID`
- `SQUARE_ACCESS_TOKEN`
- `SQUARE_LOCATION_ID`
- `SQUARE_VERSION`
- `SQUARE_CURRENCY`
- `SQUARE_SYNC_ROOT_CATEGORY_ID` (optional)
- `SQUARE_SYNC_ROOT_CATEGORY_NAME` (optional)

Secrets stay in Script Properties and are not persisted into sheet tabs.
