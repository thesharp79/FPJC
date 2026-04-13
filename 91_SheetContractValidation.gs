/**
 * FPJC workbook sheet-contract v1 validation helpers.
 *
 * This contract covers the runtime workbook schema only.
 * It does not include tenant-registry concerns.
 */
const SHEET_CONTRACT_V1_MEMBERS_HEADERS = [
  'TimeStamp',
  'Status',
  'Concessionary',
  'DD Start Date',
  'PrePay Remaining',
  'Session Name',
  'First Name',
  'Last Name',
  'Last Session',
  'Full Name',
  'Date of Birth',
  'Contact email address',
  'Address',
  'British Judo Association (BJA) License number',
  'BJA License expiry date',
  'Medical conditions / learning difficulties',
  'First Aid',
  'Email contact',
  'Photographs and videos',
  'Gradings / Records of success',
  'Contact 1 - Name',
  'Contact 1 - Telephone Number',
  'Contact 1 - Relationship to member',
  'Contact 2 - Name',
  'Contact 2 - Telephone Number',
  'Contact 2 - Relationship to member',
  'Data storage',
  'How did you hear about Fleming Park Judo Club',
  'Notes'
];

const SHEET_CONTRACT_V1_ATTENDANCE_HEADERS = Object.keys(SIGNIN_CFG.attendanceHeaders).map(function (key) {
  return SIGNIN_CFG.attendanceHeaders[key];
});

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
    [SIGNIN_CFG.sheetNames.members]: SHEET_CONTRACT_V1_MEMBERS_HEADERS,
    [SIGNIN_CFG.sheetNames.attendance]: SHEET_CONTRACT_V1_ATTENDANCE_HEADERS,
    [SIGNIN_CFG.sheetNames.paymentOptions]: Object.keys(SIGNIN_CFG.paymentOptionHeaders).map(function (key) { return SIGNIN_CFG.paymentOptionHeaders[key]; }),
    [SIGNIN_CFG.sheetNames.baskets]: Object.keys(SIGNIN_CFG.basketHeaders).map(function (key) { return SIGNIN_CFG.basketHeaders[key]; }),
    [SIGNIN_CFG.sheetNames.basketLines]: Object.keys(SIGNIN_CFG.basketLineHeaders).map(function (key) { return SIGNIN_CFG.basketLineHeaders[key]; }),
    [SIGNIN_CFG.sheetNames.otherPayments]: Object.keys(SIGNIN_CFG.otherPaymentHeaders).map(function (key) { return SIGNIN_CFG.otherPaymentHeaders[key]; })
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

    if (sheetName === SIGNIN_CFG.sheetNames.members || sheetName === SIGNIN_CFG.sheetNames.attendance) {
      const expectedHeaders = SHEET_CONTRACT_V1.requiredHeadersBySheet[sheetName];
      const orderMismatch = findHeaderOrderMismatch_(headers, expectedHeaders);
      if (orderMismatch) {
        errors.push('Sheet "' + sheetName + '" header order mismatch at column ' + orderMismatch.column +
          '. Expected "' + orderMismatch.expected + '", found "' + orderMismatch.actual + '".');
      }
    }

    if (sheetName === SIGNIN_CFG.sheetNames.paymentOptions) {
      findDuplicateValuesInColumn_(sheet, SIGNIN_CFG.paymentOptionHeaders.code).forEach(function (value) {
        warnings.push('Sheet "' + sheetName + '" has duplicate Code value: ' + value);
      });
    }

    if (sheetName === SIGNIN_CFG.sheetNames.baskets) {
      findDuplicateValuesInColumn_(sheet, SIGNIN_CFG.basketHeaders.basketId).forEach(function (value) {
        warnings.push('Sheet "' + sheetName + '" has duplicate Basket ID value: ' + value);
      });

      findInvalidEnumValuesInColumn_(sheet, SIGNIN_CFG.basketHeaders.status, SHEET_CONTRACT_V1.enumValues.basketStatuses).forEach(function (value) {
        warnings.push('Sheet "' + sheetName + '" has non-contract Status value: ' + value);
      });

      findInvalidEnumValuesInColumn_(sheet, SIGNIN_CFG.basketHeaders.settlementMethod, SHEET_CONTRACT_V1.enumValues.paymentMethods).forEach(function (value) {
        warnings.push('Sheet "' + sheetName + '" has non-contract Settlement Method value: ' + value);
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


function findHeaderOrderMismatch_(actualHeaders, expectedHeaders) {
  for (let i = 0; i < expectedHeaders.length; i++) {
    const expected = String(expectedHeaders[i] || '').trim();
    const actual = String(actualHeaders[i] || '').trim();
    if (expected !== actual) {
      return {
        column: i + 1,
        expected: expected,
        actual: actual || '(blank)'
      };
    }
  }
  return null;
}
