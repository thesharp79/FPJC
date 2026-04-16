/* ==============================\
   Shared sheet/runtime helpers
   - request-scoped spreadsheet/sheet caches
   - cached sheet payloads with invalidation
   - header-only reads for append/update paths
\============================== */

var SIGNIN_RUNTIME_CACHE_ = {
  spreadsheet: null,
  sheets: {},
  sheetPayloads: {},
  sheetHeaders: {},
  members: null,
  membersByKey: null,
  membersByRow: null,
  paymentOptions: null,
  attendanceSignedInSet: null
};

function getHeaderMap_(headers) {
  const map = {};
  for (let i = 0; i < headers.length; i++) {
    map[String(headers[i] || '').trim()] = i;
  }
  return map;
}

function requireHeader_(headerMap, headerName) {
  if (!(headerName in headerMap)) {
    throw new Error('Missing header: ' + headerName);
  }
  return headerMap[headerName];
}

function getSpreadsheet_() {
  if (!SIGNIN_RUNTIME_CACHE_.spreadsheet) {
    SIGNIN_RUNTIME_CACHE_.spreadsheet = SpreadsheetApp.openById(SIGNIN_CFG.spreadsheetId);
  }
  return SIGNIN_RUNTIME_CACHE_.spreadsheet;
}

function getMembersSheet_() {
  return getSheetByNameCached_(SIGNIN_CFG.sheetNames.members);
}

function getAttendanceSheet_() {
  return getSheetByNameCached_(SIGNIN_CFG.sheetNames.attendance);
}

function getPaymentOptionsSheet_() {
  return getSheetByNameCached_(SIGNIN_CFG.sheetNames.paymentOptions);
}

function getBasketsSheet_() {
  return getSheetByNameCached_(SIGNIN_CFG.sheetNames.baskets);
}

function getBasketLinesSheet_() {
  return getSheetByNameCached_(SIGNIN_CFG.sheetNames.basketLines);
}

function getOtherPaymentsSheet_() {
  return getSheetByNameCached_(SIGNIN_CFG.sheetNames.otherPayments);
}

function getSheetByNameCached_(sheetName) {
  if (!SIGNIN_RUNTIME_CACHE_.sheets[sheetName]) {
    const sheet = getSpreadsheet_().getSheetByName(sheetName);
    if (!sheet) throw new Error('Sheet not found: ' + sheetName);
    SIGNIN_RUNTIME_CACHE_.sheets[sheetName] = sheet;
  }
  return SIGNIN_RUNTIME_CACHE_.sheets[sheetName];
}

function getSheetPayload_(sheet, forceRefresh) {
  const key = sheet.getName();
  if (!forceRefresh && SIGNIN_RUNTIME_CACHE_.sheetPayloads[key]) {
    return SIGNIN_RUNTIME_CACHE_.sheetPayloads[key];
  }

  const values = sheet.getDataRange().getValues();
  if (!values || !values.length) throw new Error('Sheet "' + key + '" needs a header row.');

  const payload = {
    values: values,
    headerMap: getHeaderMap_(values[0])
  };

  SIGNIN_RUNTIME_CACHE_.sheetPayloads[key] = payload;
  SIGNIN_RUNTIME_CACHE_.sheetHeaders[key] = {
    headerMap: payload.headerMap,
    lastColumn: values[0].length
  };
  return payload;
}

function getHeaderMeta_(sheet) {
  const key = sheet.getName();
  if (SIGNIN_RUNTIME_CACHE_.sheetHeaders[key]) {
    return SIGNIN_RUNTIME_CACHE_.sheetHeaders[key];
  }

  const lastColumn = Math.max(sheet.getLastColumn(), 1);
  const headers = sheet.getRange(1, 1, 1, lastColumn).getValues()[0];
  const meta = {
    headerMap: getHeaderMap_(headers),
    lastColumn: headers.length
  };
  SIGNIN_RUNTIME_CACHE_.sheetHeaders[key] = meta;
  return meta;
}

function invalidateSheetRuntimeCache_(sheetOrName) {
  const key = typeof sheetOrName === 'string' ? sheetOrName : sheetOrName.getName();
  delete SIGNIN_RUNTIME_CACHE_.sheetPayloads[key];
  delete SIGNIN_RUNTIME_CACHE_.sheetHeaders[key];

  if (key === SIGNIN_CFG.sheetNames.members) {
    SIGNIN_RUNTIME_CACHE_.members = null;
    SIGNIN_RUNTIME_CACHE_.membersByKey = null;
    SIGNIN_RUNTIME_CACHE_.membersByRow = null;
    try {
      CacheService.getScriptCache().remove('signin_members_v2');
    } catch (e) {}
  }

  if (key === SIGNIN_CFG.sheetNames.paymentOptions) {
    SIGNIN_RUNTIME_CACHE_.paymentOptions = null;
    try {
      CacheService.getScriptCache().remove('signin_payment_options_v2');
    } catch (e) {}
  }

  if (key === SIGNIN_CFG.sheetNames.attendance) {
    SIGNIN_RUNTIME_CACHE_.attendanceSignedInSet = null;
  }
}

function appendSheetRowByHeaders_(sheet, orderedHeaders, record) {
  const meta = getHeaderMeta_(sheet);
  const idx = meta.headerMap;
  const row = new Array(meta.lastColumn).fill('');

  for (let i = 0; i < orderedHeaders.length; i++) {
    const header = orderedHeaders[i];
    if (!(header in idx)) continue;
    row[idx[header]] = typeof record[header] === 'undefined' ? '' : record[header];
  }

  let rowNumber;
  if (typeof writeAttendanceRow_ === 'function') {
    rowNumber = writeAttendanceRow_(sheet, row);
  } else {
    sheet.appendRow(row);
    rowNumber = sheet.getLastRow();
  }

  invalidateSheetRuntimeCache_(sheet);
  return rowNumber;
}
