/* ==============================
   Basket lines repository + cache helpers
   Extracted from SignInApp.gs to keep persistence concerns isolated.
\============================== */

function getBasketLinesCacheKey_(basketId) {
  return 'signin_basket_lines_' + basketId;
}

function getBasketSummaryCacheKey_(basketId) {
  return 'signin_basket_summary_' + basketId;
}

function cloneJsonSafe_(value) {
  return JSON.parse(JSON.stringify(value));
}

function parseBasketLineRowFromValues_(row, rowNumber, idx) {
  return {
    rowNumber: rowNumber,
    basketId: String(row[requireHeader_(idx, SIGNIN_CFG.basketLineHeaders.basketId)] || '').trim(),
    lineId: String(row[requireHeader_(idx, SIGNIN_CFG.basketLineHeaders.lineId)] || '').trim(),
    memberKey: String(row[requireHeader_(idx, SIGNIN_CFG.basketLineHeaders.memberKey)] || '').trim(),
    bjaNumber: String(row[requireHeader_(idx, SIGNIN_CFG.basketLineHeaders.bjaNumber)] || '').trim(),
    fullName: String(row[requireHeader_(idx, SIGNIN_CFG.basketLineHeaders.fullName)] || '').trim(),
    dobIso: normaliseSheetDateToIso_(row[requireHeader_(idx, SIGNIN_CFG.basketLineHeaders.dob)]),
    sessionDateIso: normaliseSheetDateToIso_(row[requireHeader_(idx, SIGNIN_CFG.basketLineHeaders.sessionDate)]),
    sessionName: String(row[requireHeader_(idx, SIGNIN_CFG.basketLineHeaders.sessionName)] || '').trim(),
    lineType: String(row[requireHeader_(idx, SIGNIN_CFG.basketLineHeaders.lineType)] || '').trim(),
    paymentCategory: String(row[requireHeader_(idx, SIGNIN_CFG.basketLineHeaders.paymentCategory)] || '').trim(),
    description: String(row[requireHeader_(idx, SIGNIN_CFG.basketLineHeaders.description)] || '').trim(),
    amount: normaliseMoneyValue_(row[requireHeader_(idx, SIGNIN_CFG.basketLineHeaders.amount)]),
    paymentRequired: asBoolean_(row[requireHeader_(idx, SIGNIN_CFG.basketLineHeaders.paymentRequired)]),
    paid: asBoolean_(row[requireHeader_(idx, SIGNIN_CFG.basketLineHeaders.paid)]),
    paymentMethod: String(row[requireHeader_(idx, SIGNIN_CFG.basketLineHeaders.paymentMethod)] || '').trim(),
    paymentOptionCode: String(row[requireHeader_(idx, SIGNIN_CFG.basketLineHeaders.paymentOptionCode)] || '').trim(),
    squareVariationId: String(row[requireHeader_(idx, SIGNIN_CFG.basketLineHeaders.squareVariationId)] || '').trim(),
    attendanceRowRef: String(row[requireHeader_(idx, SIGNIN_CFG.basketLineHeaders.attendanceRowRef)] || '').trim(),
    postedAt: row[requireHeader_(idx, SIGNIN_CFG.basketLineHeaders.postedAt)],
    notes: String(row[requireHeader_(idx, SIGNIN_CFG.basketLineHeaders.notes)] || '').trim()
  };
}

function buildBasketSummaryFromLines_(lines) {
  const memberKeys = {};
  let memberCount = 0;
  let totalAmount = 0;
  let hasChargeLines = false;

  for (let i = 0; i < (lines || []).length; i++) {
    const line = lines[i];
    if (line.lineType === 'ATTENDANCE') {
      if (line.memberKey && !memberKeys[line.memberKey]) {
        memberKeys[line.memberKey] = true;
        memberCount++;
      }
      continue;
    }

    hasChargeLines = true;
    if (isFiniteNumber_(line.amount)) {
      totalAmount += Number(line.amount);
    }
  }

  return {
    memberCount: memberCount,
    totalAmount: roundMoney_(totalAmount),
    hasChargeLines: hasChargeLines,
    status: memberCount > 0 ? SIGNIN_CFG.basketStatuses.ready : SIGNIN_CFG.basketStatuses.building
  };
}

function putBasketSummaryCache_(basketId, summary) {
  if (!basketId) return;
  SIGNIN_PERF_RUNTIME_.basketSummaryById[basketId] = summary || null;
  try {
    CacheService.getScriptCache().put(getBasketSummaryCacheKey_(basketId), JSON.stringify(summary || null), 300);
  } catch (e) {}
}

function getCachedBasketSummary_(basketId) {
  if (!basketId) return null;
  if (Object.prototype.hasOwnProperty.call(SIGNIN_PERF_RUNTIME_.basketSummaryById, basketId)) {
    return SIGNIN_PERF_RUNTIME_.basketSummaryById[basketId];
  }
  try {
    const cached = CacheService.getScriptCache().get(getBasketSummaryCacheKey_(basketId));
    if (cached) {
      const parsed = JSON.parse(cached);
      SIGNIN_PERF_RUNTIME_.basketSummaryById[basketId] = parsed;
      return parsed;
    }
  } catch (e) {}
  return null;
}

function putBasketLinesCache_(basketId, lines) {
  if (!basketId) return;
  const cloned = cloneJsonSafe_(lines || []);
  SIGNIN_PERF_RUNTIME_.basketLinesById[basketId] = cloned;
  try {
    CacheService.getScriptCache().put(getBasketLinesCacheKey_(basketId), JSON.stringify(cloned), 300);
  } catch (e) {}
  putBasketSummaryCache_(basketId, buildBasketSummaryFromLines_(cloned));
}

function getCachedBasketLines_(basketId) {
  if (!basketId) return null;
  if (SIGNIN_PERF_RUNTIME_.basketLinesById[basketId]) {
    return cloneJsonSafe_(SIGNIN_PERF_RUNTIME_.basketLinesById[basketId]);
  }
  try {
    const cached = CacheService.getScriptCache().get(getBasketLinesCacheKey_(basketId));
    if (cached) {
      const parsed = JSON.parse(cached);
      SIGNIN_PERF_RUNTIME_.basketLinesById[basketId] = parsed;
      return cloneJsonSafe_(parsed);
    }
  } catch (e) {}
  return null;
}

function invalidateBasketLinesCache_(basketId) {
  if (!basketId) return;
  delete SIGNIN_PERF_RUNTIME_.basketLinesById[basketId];
  delete SIGNIN_PERF_RUNTIME_.basketSummaryById[basketId];
  try {
    const cache = CacheService.getScriptCache();
    cache.remove(getBasketLinesCacheKey_(basketId));
    cache.remove(getBasketSummaryCacheKey_(basketId));
  } catch (e) {}
}

function getBasketLineRows_(basketId) {
  const cached = getCachedBasketLines_(basketId);
  if (cached) return cached;

  const sheet = getBasketLinesSheet_();
  const payload = getSheetPayload_(sheet);
  const idx = payload.headerMap;
  const rows = [];

  for (let r = 1; r < payload.values.length; r++) {
    const row = payload.values[r];
    if (String(row[requireHeader_(idx, SIGNIN_CFG.basketLineHeaders.basketId)] || '').trim() !== basketId) continue;
    rows.push(parseBasketLineRowFromValues_(row, r + 1, idx));
  }

  putBasketLinesCache_(basketId, rows);
  return cloneJsonSafe_(rows);
}

function appendBasketLines_(records) {
  if (!records || !records.length) return [];

  const sheet = getBasketLinesSheet_();
  const meta = getHeaderMeta_(sheet);
  const idx = meta.headerMap;
  const rows = [];

  for (let i = 0; i < records.length; i++) {
    const record = records[i];
    const row = new Array(meta.lastColumn).fill('');
    row[requireHeader_(idx, SIGNIN_CFG.basketLineHeaders.basketId)] = record.basketId;
    row[requireHeader_(idx, SIGNIN_CFG.basketLineHeaders.lineId)] = record.lineId;
    row[requireHeader_(idx, SIGNIN_CFG.basketLineHeaders.memberKey)] = record.memberKey;
    row[requireHeader_(idx, SIGNIN_CFG.basketLineHeaders.bjaNumber)] = record.bjaNumber || '';
    row[requireHeader_(idx, SIGNIN_CFG.basketLineHeaders.fullName)] = record.fullName;
    row[requireHeader_(idx, SIGNIN_CFG.basketLineHeaders.dob)] = record.dob ? new Date(record.dob + 'T00:00:00') : '';
    row[requireHeader_(idx, SIGNIN_CFG.basketLineHeaders.sessionDate)] = record.sessionDate ? new Date(record.sessionDate + 'T00:00:00') : '';
    row[requireHeader_(idx, SIGNIN_CFG.basketLineHeaders.sessionName)] = record.sessionName || '';
    row[requireHeader_(idx, SIGNIN_CFG.basketLineHeaders.lineType)] = record.lineType;
    row[requireHeader_(idx, SIGNIN_CFG.basketLineHeaders.paymentCategory)] = record.paymentCategory || '';
    row[requireHeader_(idx, SIGNIN_CFG.basketLineHeaders.description)] = record.description || '';
    row[requireHeader_(idx, SIGNIN_CFG.basketLineHeaders.amount)] = record.amount === '' ? '' : roundMoney_(record.amount);
    row[requireHeader_(idx, SIGNIN_CFG.basketLineHeaders.paymentRequired)] = record.paymentRequired === true;
    row[requireHeader_(idx, SIGNIN_CFG.basketLineHeaders.paid)] = record.paid === true;
    row[requireHeader_(idx, SIGNIN_CFG.basketLineHeaders.paymentMethod)] = record.paymentMethod || '';
    row[requireHeader_(idx, SIGNIN_CFG.basketLineHeaders.paymentOptionCode)] = record.paymentOptionCode || '';
    row[requireHeader_(idx, SIGNIN_CFG.basketLineHeaders.squareVariationId)] = record.squareVariationId || '';
    row[requireHeader_(idx, SIGNIN_CFG.basketLineHeaders.attendanceRowRef)] = record.attendanceRowRef || '';
    row[requireHeader_(idx, SIGNIN_CFG.basketLineHeaders.postedAt)] = record.postedAt || '';
    row[requireHeader_(idx, SIGNIN_CFG.basketLineHeaders.notes)] = record.notes || '';
    rows.push(row);
  }

  const startRow = sheet.getLastRow() + 1;
  sheet.getRange(startRow, 1, rows.length, meta.lastColumn).setValues(rows);
  invalidateSheetRuntimeCache_(sheet);

  const rowNumbers = [];
  const appendedByBasket = {};
  for (let i = 0; i < records.length; i++) {
    const rowNumber = startRow + i;
    rowNumbers.push(rowNumber);
    const record = records[i];
    const parsed = {
      rowNumber: rowNumber,
      basketId: record.basketId,
      lineId: record.lineId,
      memberKey: record.memberKey,
      bjaNumber: record.bjaNumber || '',
      fullName: record.fullName || '',
      dobIso: record.dob || '',
      sessionDateIso: record.sessionDate || '',
      sessionName: record.sessionName || '',
      lineType: record.lineType || '',
      paymentCategory: record.paymentCategory || '',
      description: record.description || '',
      amount: record.amount === '' ? '' : roundMoney_(record.amount),
      paymentRequired: record.paymentRequired === true,
      paid: record.paid === true,
      paymentMethod: record.paymentMethod || '',
      paymentOptionCode: record.paymentOptionCode || '',
      squareVariationId: record.squareVariationId || '',
      attendanceRowRef: record.attendanceRowRef || '',
      postedAt: record.postedAt || '',
      notes: record.notes || ''
    };
    if (!appendedByBasket[record.basketId]) appendedByBasket[record.basketId] = [];
    appendedByBasket[record.basketId].push(parsed);
  }

  const basketIds = Object.keys(appendedByBasket);
  for (let i = 0; i < basketIds.length; i++) {
    const basketId = basketIds[i];
    const existing = getCachedBasketLines_(basketId) || [];
    putBasketLinesCache_(basketId, existing.concat(appendedByBasket[basketId]));
  }

  return rowNumbers;
}

function clearBasketLineRows_(rowNumbers) {
  if (!rowNumbers || !rowNumbers.length) return;
  const sheet = getBasketLinesSheet_();
  const meta = getHeaderMeta_(sheet);
  const unique = Array.from(new Set(rowNumbers.map(function(v) { return Number(v); }).filter(function(v) { return !!v; })));
  unique.sort(function(a, b) { return a - b; });
  if (!unique.length) return;

  let blockStart = unique[0];
  let blockEnd = unique[0];
  for (let i = 1; i < unique.length; i++) {
    const rowNumber = unique[i];
    if (rowNumber === blockEnd + 1) {
      blockEnd = rowNumber;
      continue;
    }
    sheet.getRange(blockStart, 1, blockEnd - blockStart + 1, meta.lastColumn).clearContent();
    blockStart = rowNumber;
    blockEnd = rowNumber;
  }
  sheet.getRange(blockStart, 1, blockEnd - blockStart + 1, meta.lastColumn).clearContent();
  invalidateSheetRuntimeCache_(sheet);
}

function applyBasketLineUpdatesBatch_(sheet, idx, updates) {
  if (!updates || !updates.length) return;

  let payload = getSheetPayload_(sheet);
  const meta = getHeaderMeta_(sheet);
  const byRow = {};
  const touchedRows = [];
  let didReloadPayload = false;

  for (let i = 0; i < updates.length; i++) {
    const u = updates[i];
    if (!u || !u.rowNumber) continue;
    const rowNumber = Number(u.rowNumber);
    if (!byRow[rowNumber]) {
      let baseRow = payload.values[rowNumber - 1];
      if (!baseRow && !didReloadPayload) {
        invalidateSheetRuntimeCache_(sheet);
        payload = getSheetPayload_(sheet);
        didReloadPayload = true;
        baseRow = payload.values[rowNumber - 1];
      }
      if (!baseRow) {
        console.log('[PERF][applyBasketLineUpdatesBatch_] skipped missing row: ' + rowNumber);
        continue;
      }
      byRow[rowNumber] = baseRow.slice();
      touchedRows.push(rowNumber);
    }
    const row = byRow[rowNumber];
    if (typeof u.paid !== 'undefined') {
      row[requireHeader_(idx, SIGNIN_CFG.basketLineHeaders.paid)] = u.paid === true;
    }
    if (typeof u.paymentMethod !== 'undefined') {
      row[requireHeader_(idx, SIGNIN_CFG.basketLineHeaders.paymentMethod)] = u.paymentMethod || '';
    }
    if (typeof u.attendanceRowRef !== 'undefined') {
      row[requireHeader_(idx, SIGNIN_CFG.basketLineHeaders.attendanceRowRef)] = u.attendanceRowRef || '';
    }
    if (typeof u.postedAt !== 'undefined') {
      row[requireHeader_(idx, SIGNIN_CFG.basketLineHeaders.postedAt)] = u.postedAt || '';
    }
  }

  touchedRows.sort(function(a, b) { return a - b; });
  if (!touchedRows.length) return;

  let blockStart = touchedRows[0];
  let blockRows = [byRow[blockStart]];
  for (let i = 1; i < touchedRows.length; i++) {
    const rowNumber = touchedRows[i];
    if (rowNumber === touchedRows[i - 1] + 1) {
      blockRows.push(byRow[rowNumber]);
      continue;
    }
    sheet.getRange(blockStart, 1, blockRows.length, meta.lastColumn).setValues(blockRows);
    blockStart = rowNumber;
    blockRows = [byRow[rowNumber]];
  }
  sheet.getRange(blockStart, 1, blockRows.length, meta.lastColumn).setValues(blockRows);
  invalidateSheetRuntimeCache_(sheet);

  const touchedBasketIds = {};
  for (let i = 0; i < touchedRows.length; i++) {
    const rowNumber = touchedRows[i];
    const row = byRow[rowNumber];
    const basketId = String(row[requireHeader_(idx, SIGNIN_CFG.basketLineHeaders.basketId)] || '').trim();
    if (!basketId) continue;
    touchedBasketIds[basketId] = true;
  }

  const basketIds = Object.keys(touchedBasketIds);
  for (let i = 0; i < basketIds.length; i++) {
    const basketId = basketIds[i];
    const cached = getCachedBasketLines_(basketId);
    if (!cached) {
      invalidateBasketLinesCache_(basketId);
      continue;
    }
    const byRowNum = {};
    for (let j = 0; j < cached.length; j++) {
      byRowNum[cached[j].rowNumber] = cached[j];
    }
    for (let j = 0; j < updates.length; j++) {
      const u = updates[j];
      if (!u || !u.rowNumber) continue;
      const line = byRowNum[Number(u.rowNumber)];
      if (!line) continue;
      if (typeof u.paid !== 'undefined') line.paid = u.paid === true;
      if (typeof u.paymentMethod !== 'undefined') line.paymentMethod = u.paymentMethod || '';
      if (typeof u.attendanceRowRef !== 'undefined') line.attendanceRowRef = u.attendanceRowRef || '';
      if (typeof u.postedAt !== 'undefined') line.postedAt = u.postedAt || '';
    }
    putBasketLinesCache_(basketId, cached);
  }
}
