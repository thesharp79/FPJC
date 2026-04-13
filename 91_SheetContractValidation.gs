/**
 * FPJC workbook sheet-contract v1 validation helpers.
 *
 * This contract covers the runtime workbook schema only.
 * It does not include tenant-registry concerns.
 */
const SHEET_CONTRACT_V1 = {
  version: 'v1',
  clubConfigSheetName: 'Club_Config',
  requiredSheetNames: [
    SIGNIN_CFG.sheetNames.members,
    SIGNIN_CFG.sheetNames.attendance,
    SIGNIN_CFG.sheetNames.paymentOptions,
    SIGNIN_CFG.sheetNames.baskets,
    SIGNIN_CFG.sheetNames.basketLines,
    SIGNIN_CFG.sheetNames.otherPayments,
    'Club_Config'
  ],
  requiredHeadersBySheet: {
    Members: Object.keys(SIGNIN_CFG.membersHeaders).map(function (key) { return SIGNIN_CFG.membersHeaders[key]; }),
    Attendance: Object.keys(SIGNIN_CFG.attendanceHeaders).map(function (key) { return SIGNIN_CFG.attendanceHeaders[key]; }),
    PaymentOptions: Object.keys(SIGNIN_CFG.paymentOptionHeaders).map(function (key) { return SIGNIN_CFG.paymentOptionHeaders[key]; }),
    Baskets: Object.keys(SIGNIN_CFG.basketHeaders).map(function (key) { return SIGNIN_CFG.basketHeaders[key]; }),
    BasketLines: Object.keys(SIGNIN_CFG.basketLineHeaders).map(function (key) { return SIGNIN_CFG.basketLineHeaders[key]; }),
    OtherPayments: Object.keys(SIGNIN_CFG.otherPaymentHeaders).map(function (key) { return SIGNIN_CFG.otherPaymentHeaders[key]; })
  },
  requiredClubConfigColumns: ['Key', 'Value', 'Type', 'Description', 'Managed By', 'Required'],
  requiredClubConfigKeys: ['club_name', 'session_names_json', 'feature_flags_json'],
  warningClubConfigKeys: [
    'club_id',
    'schema_version',
    'timezone',
    'payment_provider_type',
    'payments_enabled',
    'desk_payments_enabled'
  ],
  enumValues: {
    basketStatuses: Object.keys(SIGNIN_CFG.basketStatuses).map(function (key) { return SIGNIN_CFG.basketStatuses[key]; }),
    paymentMethods: Object.keys(SIGNIN_CFG.paymentMethods).map(function (key) { return SIGNIN_CFG.paymentMethods[key]; })
  }
};

function validateSheetContractV1_(spreadsheet) {
  const ss = spreadsheet;
  const errors = [];
  const warnings = [];
  const checkedAt = new Date().toISOString();

  SHEET_CONTRACT_V1.requiredSheetNames.forEach(function (sheetName) {
    if (!ss.getSheetByName(sheetName)) errors.push('Missing required sheet: ' + sheetName);
  });

  Object.keys(SHEET_CONTRACT_V1.requiredHeadersBySheet).forEach(function (sheetName) {
    const sheet = ss.getSheetByName(sheetName);
    if (!sheet) return;

    const headers = getSheetHeaders_(sheet);
    findMissingValues_(SHEET_CONTRACT_V1.requiredHeadersBySheet[sheetName], headers).forEach(function (header) {
      errors.push('Sheet "' + sheetName + '" missing required header: ' + header);
    });

    if (sheetName === SIGNIN_CFG.sheetNames.paymentOptions) {
      findDuplicateValuesInColumn_(sheet, SIGNIN_CFG.paymentOptionHeaders.code).forEach(function (value) {
        warnings.push('Sheet "PaymentOptions" has duplicate Code value: ' + value);
      });
    }

    if (sheetName === SIGNIN_CFG.sheetNames.baskets) {
      findDuplicateValuesInColumn_(sheet, SIGNIN_CFG.basketHeaders.basketId).forEach(function (value) {
        warnings.push('Sheet "Baskets" has duplicate Basket ID value: ' + value);
      });

      findInvalidEnumValuesInColumn_(sheet, SIGNIN_CFG.basketHeaders.status, SHEET_CONTRACT_V1.enumValues.basketStatuses).forEach(function (value) {
        warnings.push('Sheet "Baskets" has non-contract Status value: ' + value);
      });

      findInvalidEnumValuesInColumn_(sheet, SIGNIN_CFG.basketHeaders.settlementMethod, SHEET_CONTRACT_V1.enumValues.paymentMethods).forEach(function (value) {
        warnings.push('Sheet "Baskets" has non-contract Settlement Method value: ' + value);
      });
    }
  });

  const clubConfigSheet = ss.getSheetByName(SHEET_CONTRACT_V1.clubConfigSheetName);
  let schemaVersion = '';

  if (clubConfigSheet) {
    const headers = getSheetHeaders_(clubConfigSheet);
    findMissingValues_(SHEET_CONTRACT_V1.requiredClubConfigColumns, headers).forEach(function (header) {
      errors.push('Sheet "Club_Config" missing required column: ' + header);
    });

    try {
      const state = readClubConfigMapWithRowIndex_(clubConfigSheet);
      const config = state.config;

      SHEET_CONTRACT_V1.requiredClubConfigKeys.forEach(function (key) {
        if (!String(config[key] || '').trim()) {
          errors.push('Missing required Club_Config key: ' + key);
        }
      });

      SHEET_CONTRACT_V1.warningClubConfigKeys.forEach(function (key) {
        if (!String(config[key] || '').trim()) {
          warnings.push('Recommended Club_Config key is missing or blank: ' + key);
        }
      });

      schemaVersion = String(config.schema_version || '').trim();

      validateClubConfigJsonField_(config, 'session_names_json', true, 'array', errors);
      validateClubConfigJsonField_(config, 'feature_flags_json', true, 'object', errors);
    } catch (err) {
      errors.push('Club_Config validation failed: ' + err.message);
    }
  }

  return {
    ok: errors.length === 0,
    errors: errors,
    warnings: warnings,
    checkedAt: checkedAt,
    schemaVersion: schemaVersion
  };
}

function getSheetHeaders_(sheet) {
  const lastCol = sheet.getLastColumn();
  if (lastCol < 1) return [];
  return sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(function (header) {
    return String(header || '').trim();
  });
}

function findMissingValues_(requiredValues, actualValues) {
  const actualMap = {};
  actualValues.forEach(function (value) {
    actualMap[value] = true;
  });
  return requiredValues.filter(function (requiredValue) {
    return !actualMap[requiredValue];
  });
}

function validateClubConfigJsonField_(config, key, required, expectedType, errors) {
  const raw = String(config[key] || '').trim();
  if (!raw) {
    if (required) errors.push('Club_Config key "' + key + '" must not be blank.');
    return;
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    errors.push('Club_Config key "' + key + '" must be valid JSON.');
    return;
  }

  if (expectedType === 'array' && !Array.isArray(parsed)) {
    errors.push('Club_Config key "' + key + '" must be a JSON array.');
  }

  if (expectedType === 'object' && (parsed === null || Array.isArray(parsed) || typeof parsed !== 'object')) {
    errors.push('Club_Config key "' + key + '" must be a JSON object.');
  }
}

function findDuplicateValuesInColumn_(sheet, headerName) {
  const headers = getSheetHeaders_(sheet);
  const headerIndex = headers.indexOf(headerName);
  if (headerIndex === -1) return [];

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];

  const values = sheet.getRange(2, headerIndex + 1, lastRow - 1, 1).getValues();
  const countByValue = {};
  values.forEach(function (row) {
    const value = String(row[0] || '').trim();
    if (!value) return;
    countByValue[value] = (countByValue[value] || 0) + 1;
  });

  return Object.keys(countByValue).filter(function (value) {
    return countByValue[value] > 1;
  });
}

function findInvalidEnumValuesInColumn_(sheet, headerName, allowedValues) {
  const headers = getSheetHeaders_(sheet);
  const headerIndex = headers.indexOf(headerName);
  if (headerIndex === -1) return [];

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];

  const allowed = {};
  allowedValues.forEach(function (value) { allowed[value] = true; });

  const values = sheet.getRange(2, headerIndex + 1, lastRow - 1, 1).getValues();
  const invalid = {};
  values.forEach(function (row) {
    const value = String(row[0] || '').trim();
    if (!value) return;
    if (!allowed[value]) invalid[value] = true;
  });

  return Object.keys(invalid);
}
