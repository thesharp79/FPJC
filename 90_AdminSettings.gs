/**
 * Admin settings UI and persistence helpers.
 *
 * Club-facing values are stored in Club_Config.
 * Secret/runtime values stay in Script Properties.
 */
const ADMIN_CLUB_CONFIG_REQUIRED_KEYS = [
  'club_name',
  'session_names_json',
  'feature_flags_json'
];

const ADMIN_CLUB_CONFIG_OPTIONAL_KEYS = [
  'banner_url',
  'member_form_url',
];

const ADMIN_CLUB_CONFIG_KEYS = ADMIN_CLUB_CONFIG_REQUIRED_KEYS.concat(ADMIN_CLUB_CONFIG_OPTIONAL_KEYS);

const ADMIN_SCRIPT_PROPERTY_FIELDS = [
  { key: 'SPREADSHEET_ID', required: true },
  { key: 'SQUARE_BASE_URL', required: true },
  { key: 'SQUARE_APPLICATION_ID', required: true },
  { key: 'SQUARE_ACCESS_TOKEN', required: true, secret: true },
  { key: 'SQUARE_LOCATION_ID', required: true },
  { key: 'SQUARE_VERSION', required: true },
  { key: 'SQUARE_CURRENCY', required: true },
  { key: 'SQUARE_SYNC_ROOT_CATEGORY_ID', required: false },
  { key: 'SQUARE_SYNC_ROOT_CATEGORY_NAME', required: false },
  { key: 'ENABLE_SUPPORT_MENU', required: false }
];

function openClubSettingsFromMenu() {
  openAdminSettingsDialog_('club');
}

function openSquareSettingsFromMenu() {
  openAdminSettingsDialog_('square');
}

function showSettingsSummaryFromMenu() {
  const summary = getSettingsSummary_();
  SpreadsheetApp.getUi().alert('Settings summary', summary, SpreadsheetApp.getUi().ButtonSet.OK);
}

function validateConfigurationFromMenu() {
  const result = validateConfigurationNow_();
  const lines = [];
  lines.push(result.ok ? 'Configuration looks good.' : 'Configuration has issues.');
  lines.push('Checked at: ' + result.checkedAt);
  lines.push('Schema version: ' + (result.schemaVersion || '(not set)'));
  if (result.errors.length) {
    lines.push('');
    lines.push('Blocking errors:');
    result.errors.forEach(function (error) { lines.push('- ' + error); });
  }
  if (result.warnings.length) {
    lines.push('');
    lines.push('Warnings:');
    result.warnings.forEach(function (warning) { lines.push('- ' + warning); });
  }

  SpreadsheetApp.getUi().alert('Validate configuration', lines.join('\n'), SpreadsheetApp.getUi().ButtonSet.OK);
}

function openAdminSettingsDialog_(mode) {
  const template = HtmlService.createTemplateFromFile('AdminSettings');
  template.mode = mode;
  const html = template.evaluate().setWidth(680).setHeight(560);
  SpreadsheetApp.getUi().showModalDialog(html, mode === 'square' ? 'Square settings' : 'Club settings');
}

function getAdminSettingsData(mode) {
  const currentMode = mode || 'club';
  let clubConfig = {};
  let clubConfigLoadError = '';

  try {
    clubConfig = readClubConfigValues_(ADMIN_CLUB_CONFIG_KEYS);
  } catch (err) {
    if (currentMode !== 'square') throw err;
    clubConfigLoadError = String(err && err.message ? err.message : err);
  }

  const props = PropertiesService.getScriptProperties();
  const scriptProps = {};

  ADMIN_SCRIPT_PROPERTY_FIELDS.forEach(function (field) {
    scriptProps[field.key] = String(props.getProperty(field.key) || '').trim();
  });

  let summary = '';
  try {
    summary = getSettingsSummary_();
  } catch (err) {
    if (currentMode !== 'square') throw err;
    summary = 'Settings summary unavailable: ' + String(err && err.message ? err.message : err);
  }

  return {
    mode: currentMode,
    clubConfig: clubConfig,
    clubConfigLoadError: clubConfigLoadError,
    scriptProperties: scriptProps,
    scriptPropertyFields: ADMIN_SCRIPT_PROPERTY_FIELDS,
    summary: summary,
    validation: validateConfigurationNow_()
  };
}

function saveClubSettings(payload) {
  const values = payload || {};

  if (values.session_names_json) JSON.parse(values.session_names_json);
  if (values.feature_flags_json) JSON.parse(values.feature_flags_json);

  writeClubConfigValues_(values);
  return getAdminSettingsData('club');
}

function saveSquareSettings(payload) {
  const values = payload || {};
  const props = PropertiesService.getScriptProperties();

  ADMIN_SCRIPT_PROPERTY_FIELDS.forEach(function (field) {
    if (!Object.prototype.hasOwnProperty.call(values, field.key)) return;
    props.setProperty(field.key, String(values[field.key] || '').trim());
  });

  return getAdminSettingsData('square');
}

function runConfigurationValidation() {
  return validateConfigurationNow_();
}

function readClubConfigValues_(keys) {
  const sheet = getClubConfigSheetRequired_();
  const config = readClubConfigMapWithRowIndex_(sheet).config;
  const out = {};
  keys.forEach(function (key) {
    out[key] = Object.prototype.hasOwnProperty.call(config, key) ? config[key] : '';
  });
  return out;
}

function writeClubConfigValues_(values) {
  const sheet = getClubConfigSheetRequired_();
  const state = readClubConfigMapWithRowIndex_(sheet);
  const now = new Date();

  ADMIN_CLUB_CONFIG_KEYS.forEach(function (key) {
    if (!Object.prototype.hasOwnProperty.call(values, key)) return;

    const value = String(values[key] || '').trim();
    const row = state.rowByKey[key];
    if (row) {
      sheet.getRange(row, state.valueCol).setValue(value);
      if (state.updatedAtCol > 0) sheet.getRange(row, state.updatedAtCol).setValue(now);
      return;
    }

    const newRow = sheet.getLastRow() + 1;
    sheet.getRange(newRow, state.keyCol).setValue(key);
    sheet.getRange(newRow, state.valueCol).setValue(value);
    if (state.typeCol > 0) sheet.getRange(newRow, state.typeCol).setValue(key.endsWith('_json') ? 'json' : 'text');
    if (state.managedByCol > 0) sheet.getRange(newRow, state.managedByCol).setValue('admin_ui');
    if (state.requiredCol > 0) sheet.getRange(newRow, state.requiredCol).setValue('TRUE');
    if (state.updatedAtCol > 0) sheet.getRange(newRow, state.updatedAtCol).setValue(now);
  });
}

function getClubConfigSheetRequired_() {
  const ss = SpreadsheetApp.openById(getCurrentSpreadsheetIdForAdmin_());
  const sheet = ss.getSheetByName('Club_Config');
  if (!sheet) throw new Error('Missing required sheet "Club_Config".');
  return sheet;
}

function getCurrentSpreadsheetIdForAdmin_() {
  const spreadsheetId = String(PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID') || '').trim();
  if (!spreadsheetId) throw new Error('Missing required Script Property: SPREADSHEET_ID');
  return spreadsheetId;
}

function readClubConfigMapWithRowIndex_(sheet) {
  const lastRow = sheet.getLastRow();
  const lastCol = Math.max(sheet.getLastColumn(), 2);
  if (lastRow < 1) throw new Error('Sheet "Club_Config" must include a header row.');

  const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(function (header) {
    return String(header || '').trim();
  });

  const keyCol = findRequiredColumnIndex_(headers, ['Key', 'key']);
  const valueCol = findRequiredColumnIndex_(headers, ['Value', 'value']);
  const typeCol = findOptionalColumnIndex_(headers, ['Type', 'type']);
  const managedByCol = findOptionalColumnIndex_(headers, ['Managed By', 'ManagedBy', 'managed_by']);
  const requiredCol = findOptionalColumnIndex_(headers, ['Required', 'required']);
  const updatedAtCol = findOptionalColumnIndex_(headers, ['Updated At', 'updated_at']);

  const config = {};
  const rowByKey = {};

  if (lastRow > 1) {
    const rows = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
    rows.forEach(function (row, idx) {
      const key = String(row[keyCol - 1] || '').trim();
      if (!key) return;
      config[key] = String(row[valueCol - 1] || '').trim();
      rowByKey[key] = idx + 2;
    });
  }

  return {
    config: config,
    rowByKey: rowByKey,
    keyCol: keyCol,
    valueCol: valueCol,
    typeCol: typeCol,
    managedByCol: managedByCol,
    requiredCol: requiredCol,
    updatedAtCol: updatedAtCol
  };
}

function findRequiredColumnIndex_(headers, names) {
  const idx = findOptionalColumnIndex_(headers, names);
  if (idx < 1) throw new Error('Club_Config missing required column. Expected one of: ' + names.join(', '));
  return idx;
}

function findOptionalColumnIndex_(headers, names) {
  for (let i = 0; i < headers.length; i++) {
    const header = String(headers[i] || '').trim();
    if (names.indexOf(header) !== -1) return i + 1;
  }
  return -1;
}

function getSettingsSummary_() {
  const clubConfig = readClubConfigValues_(ADMIN_CLUB_CONFIG_KEYS);
  const props = PropertiesService.getScriptProperties();
  const lines = [];

  lines.push('Club_Config keys');
  ADMIN_CLUB_CONFIG_KEYS.forEach(function (key) {
    const value = String(clubConfig[key] || '').trim();
    lines.push('- ' + key + ': ' + (value ? 'set' : '(blank)'));
  });

  lines.push('');
  lines.push('Script Properties');
  ADMIN_SCRIPT_PROPERTY_FIELDS.forEach(function (field) {
    const value = String(props.getProperty(field.key) || '').trim();
    if (field.secret) {
      lines.push('- ' + field.key + ': ' + (value ? 'set (hidden)' : '(blank)'));
    } else {
      lines.push('- ' + field.key + ': ' + (value ? 'set' : '(blank)'));
    }
  });

  return lines.join('\n');
}

function validateConfigurationNow_() {
  const errors = [];
  const warnings = [];

  let ss;
  try {
    ss = SpreadsheetApp.openById(getCurrentSpreadsheetIdForAdmin_());
  } catch (err) {
    errors.push('Unable to open spreadsheet from SPREADSHEET_ID. ' + err.message);
    return {
      ok: false,
      errors: errors,
      warnings: warnings,
      checkedAt: new Date().toISOString(),
      schemaVersion: ''
    };
  }

  const contractResult = validateSheetContractV1_(ss);
  errors.push.apply(errors, contractResult.errors);
  warnings.push.apply(warnings, contractResult.warnings);

  const props = PropertiesService.getScriptProperties();
  ADMIN_SCRIPT_PROPERTY_FIELDS.forEach(function (field) {
    const value = String(props.getProperty(field.key) || '').trim();
    if (field.required && !value) {
      errors.push('Missing required Script Property: ' + field.key);
    }
  });

  if (!String(props.getProperty('SQUARE_SYNC_ROOT_CATEGORY_ID') || '').trim() &&
      !String(props.getProperty('SQUARE_SYNC_ROOT_CATEGORY_NAME') || '').trim()) {
    warnings.push('Square sync root category is optional but currently unset.');
  }

  return {
    ok: errors.length === 0,
    errors: errors,
    warnings: warnings,
    checkedAt: contractResult.checkedAt,
    schemaVersion: contractResult.schemaVersion
  };
}
