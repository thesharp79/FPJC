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

function getSheetContractSignInCfg_() {
  if (typeof SIGNIN_CFG !== 'undefined') return SIGNIN_CFG;

  return {
    sheetNames: {
      members: 'Members',
      attendance: 'Attendance',
      paymentOptions: 'PaymentOptions',
      baskets: 'Baskets',
      basketLines: 'BasketLines',
      otherPayments: 'OtherPayments'
    },
    attendanceHeaders: {
      timestamp: 'Timestamp',
      sessionDate: 'Session Date',
      sessionName: 'Session Name',
      fullName: 'Full Name',
      intendedPayment: 'Intended Payment',
      paymentReceived: 'Payment Received',
      prePayRemaining: 'PrePay Remaining',
      notes: 'Notes'
    },
    paymentOptionHeaders: {
      active: 'Active',
      code: 'Code',
      label: 'Label',
      chargeType: 'Charge Type',
      amount: 'Amount',
      squareVariationId: 'Square Variation ID',
      sessionFilter: 'Session Filter',
      startDate: 'Start Date',
      endDate: 'End Date',
      appAllowed: 'App Allowed',
      displayOrder: 'Display Order',
      notes: 'Notes'
    },
    basketHeaders: {
      basketId: 'Basket ID',
      createdAt: 'Created At',
      sessionDate: 'Session Date',
      status: 'Status',
      settlementMethod: 'Settlement Method',
      totalAmount: 'Total Amount',
      memberCount: 'Member Count',
      postedAt: 'Posted At',
      squareOrderId: 'Square Order ID',
      squarePaymentLinkId: 'Square Payment Link ID',
      squarePaymentId: 'Square Payment ID',
      paymentResolvedAt: 'Payment Resolved At',
      notes: 'Notes'
    },
    basketLineHeaders: {
      basketId: 'Basket ID',
      lineId: 'Line ID',
      memberKey: 'Member Key',
      bjaNumber: 'BJA Licence Number',
      fullName: 'Full Name',
      dob: 'Date of Birth',
      sessionDate: 'Session Date',
      sessionName: 'Session Name',
      lineType: 'Line Type',
      paymentCategory: 'Payment Category',
      description: 'Description',
      amount: 'Amount',
      paymentRequired: 'Payment Required',
      paid: 'Paid',
      paymentMethod: 'Payment Method',
      paymentOptionCode: 'Payment Option Code',
      squareVariationId: 'Square Variation ID',
      attendanceRowRef: 'Attendance Row Ref',
      postedAt: 'Posted At',
      notes: 'Notes'
    },
    otherPaymentHeaders: {
      timestamp: 'Timestamp',
      basketId: 'Basket ID',
      memberKey: 'Member Key',
      bjaNumber: 'BJA Licence Number',
      fullName: 'Full Name',
      dob: 'Date of Birth',
      sessionDate: 'Session Date',
      sessionName: 'Session Name',
      paymentCategory: 'Payment Category',
      description: 'Description',
      amount: 'Amount',
      paid: 'Paid',
      paymentMethod: 'Payment Method',
      lineId: 'Line ID',
      paymentOptionCode: 'Payment Option Code',
      squareVariationId: 'Square Variation ID',
      notes: 'Notes'
    },
    basketStatuses: {
      building: 'BUILDING',
      ready: 'READY',
      signedInAwaitingPayment: 'SIGNED_IN_AWAITING_PAYMENT',
      paymentResolved: 'PAYMENT_RESOLVED',
      cancelled: 'CANCELLED',
      posted: 'POSTED'
    },
    paymentMethods: {
      app: 'APP',
      desk: 'DESK',
      card: 'CARD',
      cash: 'CASH',
      bankTransfer: 'BANK_TRANSFER',
      free: 'FREE'
    }
  };
}

function getSheetContractV1_(cfg) {
  const attendanceHeaders = Object.keys(cfg.attendanceHeaders).map(function (key) {
    return cfg.attendanceHeaders[key];
  });

  return {
    version: 'v1',
    clubConfigSheetName: 'Club_Config',
    requiredSheetNames: [
      cfg.sheetNames.members,
      cfg.sheetNames.attendance,
      cfg.sheetNames.paymentOptions,
      cfg.sheetNames.baskets,
      cfg.sheetNames.basketLines,
      cfg.sheetNames.otherPayments,
      'Club_Config'
    ],
    requiredHeadersBySheet: {
      [cfg.sheetNames.members]: SHEET_CONTRACT_V1_MEMBERS_HEADERS,
      [cfg.sheetNames.attendance]: attendanceHeaders,
      [cfg.sheetNames.paymentOptions]: Object.keys(cfg.paymentOptionHeaders).map(function (key) { return cfg.paymentOptionHeaders[key]; }),
      [cfg.sheetNames.baskets]: Object.keys(cfg.basketHeaders).map(function (key) { return cfg.basketHeaders[key]; }),
      [cfg.sheetNames.basketLines]: Object.keys(cfg.basketLineHeaders).map(function (key) { return cfg.basketLineHeaders[key]; }),
      [cfg.sheetNames.otherPayments]: Object.keys(cfg.otherPaymentHeaders).map(function (key) { return cfg.otherPaymentHeaders[key]; })
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
      basketStatuses: Object.keys(cfg.basketStatuses).map(function (key) { return cfg.basketStatuses[key]; }),
      paymentMethods: Object.keys(cfg.paymentMethods).map(function (key) { return cfg.paymentMethods[key]; })
    }
  };
}

function validateSheetContractV1_(spreadsheet) {
  const cfg = getSheetContractSignInCfg_();
  const contract = getSheetContractV1_(cfg);
  const ss = spreadsheet;
  const errors = [];
  const warnings = [];
  const checkedAt = new Date().toISOString();

  contract.requiredSheetNames.forEach(function (sheetName) {
    if (!ss.getSheetByName(sheetName)) errors.push('Missing required sheet: ' + sheetName);
  });

  Object.keys(contract.requiredHeadersBySheet).forEach(function (sheetName) {
    const sheet = ss.getSheetByName(sheetName);
    if (!sheet) return;

    const headers = getSheetHeaders_(sheet);
    findMissingValues_(contract.requiredHeadersBySheet[sheetName], headers).forEach(function (header) {
      errors.push('Sheet "' + sheetName + '" missing required header: ' + header);
    });

    if (sheetName === cfg.sheetNames.members || sheetName === cfg.sheetNames.attendance) {
      const expectedHeaders = contract.requiredHeadersBySheet[sheetName];
      const orderMismatch = findHeaderOrderMismatch_(headers, expectedHeaders);
      if (orderMismatch) {
        errors.push('Sheet "' + sheetName + '" header order mismatch at column ' + orderMismatch.column +
          '. Expected "' + orderMismatch.expected + '", found "' + orderMismatch.actual + '".');
      }
    }

    if (sheetName === cfg.sheetNames.paymentOptions) {
      findDuplicateValuesInColumn_(sheet, cfg.paymentOptionHeaders.code).forEach(function (value) {
        warnings.push('Sheet "' + sheetName + '" has duplicate Code value: ' + value);
      });
    }

    if (sheetName === cfg.sheetNames.baskets) {
      findDuplicateValuesInColumn_(sheet, cfg.basketHeaders.basketId).forEach(function (value) {
        warnings.push('Sheet "' + sheetName + '" has duplicate Basket ID value: ' + value);
      });

      findInvalidEnumValuesInColumn_(sheet, cfg.basketHeaders.status, contract.enumValues.basketStatuses).forEach(function (value) {
        warnings.push('Sheet "' + sheetName + '" has non-contract Status value: ' + value);
      });

      findInvalidEnumValuesInColumn_(sheet, cfg.basketHeaders.settlementMethod, contract.enumValues.paymentMethods).forEach(function (value) {
        warnings.push('Sheet "' + sheetName + '" has non-contract Settlement Method value: ' + value);
      });
    }
  });

  const clubConfigSheet = ss.getSheetByName(contract.clubConfigSheetName);
  let schemaVersion = '';

  if (clubConfigSheet) {
    const headers = getSheetHeaders_(clubConfigSheet);
    findMissingValues_(contract.requiredClubConfigColumns, headers).forEach(function (header) {
      errors.push('Sheet "Club_Config" missing required column: ' + header);
    });

    try {
      const state = readClubConfigMapWithRowIndex_(clubConfigSheet);
      const config = state.config;

      contract.requiredClubConfigKeys.forEach(function (key) {
        if (!String(config[key] || '').trim()) {
          errors.push('Missing required Club_Config key: ' + key);
        }
      });

      contract.warningClubConfigKeys.forEach(function (key) {
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
