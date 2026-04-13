/* ==============================\
   Basket record persistence repository
\============================== */

function getBasketRecordCacheKey_(basketId) {
  return 'signin_basket_v1_' + basketId;
}

function putBasketRecordCache_(basket) {
  if (!basket || !basket.basketId) return;
  SIGNIN_PERF_RUNTIME_.basketById[basket.basketId] = basket;
  try {
    CacheService.getScriptCache().put(getBasketRecordCacheKey_(basket.basketId), JSON.stringify(basket), 120);
  } catch (e) {}
}

function clearBasketRecordCache_(basketId) {
  if (!basketId) return;
  delete SIGNIN_PERF_RUNTIME_.basketById[basketId];
  try {
    CacheService.getScriptCache().remove(getBasketRecordCacheKey_(basketId));
  } catch (e) {}
}

function getBasketRecord_(basketId) {
  if (!basketId) return null;

  if (SIGNIN_PERF_RUNTIME_.basketById[basketId]) {
    return SIGNIN_PERF_RUNTIME_.basketById[basketId];
  }

  try {
    const cached = CacheService.getScriptCache().get(getBasketRecordCacheKey_(basketId));
    if (cached) {
      const parsed = JSON.parse(cached);
      SIGNIN_PERF_RUNTIME_.basketById[basketId] = parsed;
      return parsed;
    }
  } catch (e) {}

  const sheet = getBasketsSheet_();
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return null;

  // Baskets headers are fixed in this workbook and the required fields are in A:D.
  const rows = sheet.getRange(2, 1, lastRow - 1, 4).getValues();
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (String(row[0] || '').trim() !== basketId) continue;

    const basket = {
      rowNumber: i + 2,
      basketId: basketId,
      sessionDateIso: normaliseSheetDateToIso_(row[2]),
      status: String(row[3] || '').trim()
    };
    putBasketRecordCache_(basket);
    return basket;
  }

  return null;
}



function updateBasketRecordCacheByRow_(rowNumber, updates) {
  if (!SIGNIN_PERF_RUNTIME_.basketById) return;
  const basketIds = Object.keys(SIGNIN_PERF_RUNTIME_.basketById);
  for (let i = 0; i < basketIds.length; i++) {
    const basketId = basketIds[i];
    const basket = SIGNIN_PERF_RUNTIME_.basketById[basketId];
    if (!basket || basket.rowNumber !== rowNumber) continue;
    if (Object.prototype.hasOwnProperty.call(updates, SIGNIN_CFG.basketHeaders.status)) {
      basket.status = String(updates[SIGNIN_CFG.basketHeaders.status] || '').trim();
    }
    if (Object.prototype.hasOwnProperty.call(updates, SIGNIN_CFG.basketHeaders.sessionDate)) {
      basket.sessionDateIso = normaliseSheetDateToIso_(updates[SIGNIN_CFG.basketHeaders.sessionDate]);
    }
    putBasketRecordCache_(basket);
    return;
  }
}

function createBasket_(sessionDateIso) {
  const sheet = getBasketsSheet_();
  const meta = getHeaderMeta_(sheet);
  const idx = meta.headerMap;
  const basketId = newBasketId_();
  const row = new Array(meta.lastColumn).fill('');

  row[requireHeader_(idx, SIGNIN_CFG.basketHeaders.basketId)] = basketId;
  row[requireHeader_(idx, SIGNIN_CFG.basketHeaders.createdAt)] = new Date();
  row[requireHeader_(idx, SIGNIN_CFG.basketHeaders.sessionDate)] = new Date(sessionDateIso + 'T00:00:00');
  row[requireHeader_(idx, SIGNIN_CFG.basketHeaders.status)] = SIGNIN_CFG.basketStatuses.building;
  row[requireHeader_(idx, SIGNIN_CFG.basketHeaders.settlementMethod)] = '';
  row[requireHeader_(idx, SIGNIN_CFG.basketHeaders.totalAmount)] = '';
  row[requireHeader_(idx, SIGNIN_CFG.basketHeaders.memberCount)] = 0;
  row[requireHeader_(idx, SIGNIN_CFG.basketHeaders.postedAt)] = '';
  row[requireHeader_(idx, SIGNIN_CFG.basketHeaders.squareOrderId)] = '';
  row[requireHeader_(idx, SIGNIN_CFG.basketHeaders.squarePaymentLinkId)] = '';
  row[requireHeader_(idx, SIGNIN_CFG.basketHeaders.squarePaymentId)] = '';
  row[requireHeader_(idx, SIGNIN_CFG.basketHeaders.notes)] = '';

  const rowNumber = sheet.getLastRow() + 1;
  sheet.getRange(rowNumber, 1, 1, meta.lastColumn).setValues([row]);
  invalidateSheetRuntimeCache_(sheet);

  const basket = {
    rowNumber: rowNumber,
    basketId: basketId,
    sessionDateIso: sessionDateIso,
    status: SIGNIN_CFG.basketStatuses.building
  };
  putBasketRecordCache_(basket);
  putBasketLinesCache_(basketId, []);
  return basket;
}

function updateBasketRow_(rowNumber, updates) {
  const sheet = getBasketsSheet_();
  const meta = getHeaderMeta_(sheet);
  const idx = meta.headerMap;

  const headers = Object.keys(updates || {}).filter(function(header) {
    return Object.prototype.hasOwnProperty.call(idx, header);
  });
  if (!headers.length) return;

  let minIdx = null;
  let maxIdx = null;
  for (let i = 0; i < headers.length; i++) {
    const colIdx = idx[headers[i]];
    minIdx = minIdx === null ? colIdx : Math.min(minIdx, colIdx);
    maxIdx = maxIdx === null ? colIdx : Math.max(maxIdx, colIdx);
  }

  const startCol = minIdx + 1;
  const width = (maxIdx - minIdx) + 1;
  const rowValues = sheet.getRange(rowNumber, startCol, 1, width).getValues()[0];
  for (let i = 0; i < headers.length; i++) {
    const header = headers[i];
    rowValues[idx[header] - minIdx] = updates[header];
  }

  sheet.getRange(rowNumber, startCol, 1, width).setValues([rowValues]);
  invalidateSheetRuntimeCache_(sheet);
  updateBasketRecordCacheByRow_(rowNumber, updates);
}

