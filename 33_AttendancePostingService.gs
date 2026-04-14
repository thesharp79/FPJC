/* Attendance posting and sign-in completion helpers extracted from SignInApp.gs. */

const ATTENDANCE_DATE_CACHE_TTL_SECONDS = 900;

function appendOtherPaymentRow_(sheet, record) {
  appendSheetRowByHeaders_(sheet, [
    'Timestamp',
    'Basket ID',
    'Member Key',
    'BJA Licence Number',
    'Full Name',
    'Date of Birth',
    'Session Date',
    'Session Name',
    'Payment Category',
    'Description',
    'Amount',
    'Paid',
    'Payment Method',
    'Line ID',
    'Payment Option Code',
    'Square Variation ID',
    'Notes'
  ], {
    'Timestamp': record.timestamp,
    'Basket ID': record.basketId,
    'Member Key': record.memberKey,
    'BJA Licence Number': record.bjaNumber || '',
    'Full Name': record.fullName,
    'Date of Birth': record.dob ? new Date(record.dob + 'T00:00:00') : '',
    'Session Date': record.sessionDateIso ? new Date(record.sessionDateIso + 'T00:00:00') : '',
    'Session Name': record.sessionName || '',
    'Payment Category': record.paymentCategory || '',
    'Description': record.description || '',
    'Amount': record.amount === '' ? '' : roundMoney_(record.amount),
    'Paid': record.paid === true,
    'Payment Method': record.paymentMethod || '',
    'Line ID': record.lineId || '',
    'Payment Option Code': record.paymentOptionCode || '',
    'Square Variation ID': record.squareVariationId || '',
    'Notes': record.notes || ''
  });
}

function markBasketLinePosted_(sheet, idx, lineId, updates) {
  const payload = getSheetPayload_(sheet);
  const lineIdCol = requireHeader_(idx, SIGNIN_CFG.basketLineHeaders.lineId);

  for (let r = 1; r < payload.values.length; r++) {
    const row = payload.values[r];
    if (String(row[lineIdCol] || '').trim() !== lineId) continue;

    if (typeof updates.paid !== 'undefined') {
      sheet.getRange(r + 1, requireHeader_(idx, SIGNIN_CFG.basketLineHeaders.paid) + 1).setValue(updates.paid === true);
    }
    if (typeof updates.paymentMethod !== 'undefined') {
      sheet.getRange(r + 1, requireHeader_(idx, SIGNIN_CFG.basketLineHeaders.paymentMethod) + 1).setValue(updates.paymentMethod || '');
    }
    if (typeof updates.attendanceRowRef !== 'undefined') {
      sheet.getRange(r + 1, requireHeader_(idx, SIGNIN_CFG.basketLineHeaders.attendanceRowRef) + 1).setValue(updates.attendanceRowRef || '');
    }
    if (typeof updates.postedAt !== 'undefined') {
      sheet.getRange(r + 1, requireHeader_(idx, SIGNIN_CFG.basketLineHeaders.postedAt) + 1).setValue(updates.postedAt || '');
    }
    invalidateSheetRuntimeCache_(sheet);
    return;
  }
}

function markLinkedSessionChargePosted_(sheet, idx, basketId, memberKey, attendanceRowRef, paymentMethod, postedAt) {
  const payload = getSheetPayload_(sheet);
  const basketIdCol = requireHeader_(idx, SIGNIN_CFG.basketLineHeaders.basketId);
  const memberKeyCol = requireHeader_(idx, SIGNIN_CFG.basketLineHeaders.memberKey);
  const lineTypeCol = requireHeader_(idx, SIGNIN_CFG.basketLineHeaders.lineType);
  let changed = false;

  for (let r = 1; r < payload.values.length; r++) {
    const row = payload.values[r];
    if (String(row[basketIdCol] || '').trim() !== basketId) continue;
    if (String(row[memberKeyCol] || '').trim() !== memberKey) continue;
    if (String(row[lineTypeCol] || '').trim() !== 'SESSION_CHARGE') continue;

    sheet.getRange(r + 1, requireHeader_(idx, SIGNIN_CFG.basketLineHeaders.paid) + 1).setValue(true);
    sheet.getRange(r + 1, requireHeader_(idx, SIGNIN_CFG.basketLineHeaders.paymentMethod) + 1).setValue(paymentMethod || '');
    sheet.getRange(r + 1, requireHeader_(idx, SIGNIN_CFG.basketLineHeaders.attendanceRowRef) + 1).setValue(attendanceRowRef || '');
    sheet.getRange(r + 1, requireHeader_(idx, SIGNIN_CFG.basketLineHeaders.postedAt) + 1).setValue(postedAt || '');
    changed = true;
  }

  if (changed) invalidateSheetRuntimeCache_(sheet);
}



function getAttendanceSignedInSet_() {
  if (SIGNIN_RUNTIME_CACHE_.attendanceSignedInSet) {
    return SIGNIN_RUNTIME_CACHE_.attendanceSignedInSet;
  }

  const sheet = getAttendanceSheet_();
  const payload = getSheetPayload_(sheet);
  const set = {};
  if (payload.values.length >= 2) {
    const idx = payload.headerMap;
    const fullNameCol = requireHeader_(idx, SIGNIN_CFG.attendanceHeaders.fullName);
    const sessionDateCol = requireHeader_(idx, SIGNIN_CFG.attendanceHeaders.sessionDate);

    for (let r = 1; r < payload.values.length; r++) {
      const row = payload.values[r];
      const rowName = String(row[fullNameCol] || '').trim();
      const rowDateIso = normaliseSheetDateToIso_(row[sessionDateCol]);
      if (!rowName || !rowDateIso) continue;
      set[buildAttendanceSignInKey_(rowName, rowDateIso)] = true;
    }
  }

  SIGNIN_RUNTIME_CACHE_.attendanceSignedInSet = set;
  return set;
}

function buildAttendanceSignInKey_(fullName, sessionDateIso) {
  return normaliseName_(fullName) + '|' + String(sessionDateIso || '').trim();
}





function prewarmAttendanceDateCache_(sessionDateIso) {
  if (!sessionDateIso) return;
  const t = perfNow_();
  try {
    getAttendanceSignedInSetForDate_(sessionDateIso);
    perfLog_('findMembersByDob', 'prewarmAttendanceDateCache_', t, 'date=' + sessionDateIso);
  } catch (e) {
    perfLog_('findMembersByDob', 'prewarmAttendanceDateCache_ failed', t, 'date=' + sessionDateIso + ' err=' + String(e));
  }
}

function findMembersByDob(dobIso, sessionDateIso) {
  const t0 = perfNow_();
  const perfScope = withPerfRequestScope_('findMembersByDob', newPerfRequestId_());
  assertIsoDate_(dobIso, 'Date of birth');
  if (sessionDateIso) assertIsoDate_(sessionDateIso, 'Session date');

  let t = perfNow_();
  const members = loadMembers_();
  perfLog_(perfScope, 'loadMembers_', t, 'count=' + members.length);
  const matches = [];

  t = perfNow_();
  for (let i = 0; i < members.length; i++) {
    const member = members[i];
    if (member.status !== SIGNIN_CFG.activeStatusValue) continue;
    if (member.dobIso !== dobIso) continue;

    const payment = describeMemberPayment_(member);

    matches.push({
      memberRow: member.rowNumber,
      memberKey: member.memberKey,
      initials: member.initials,
      sessionName: member.sessionName,
      paymentStatusLabel: payment.shortLabel,
      paymentRequired: payment.paymentRequired
    });
  }
  perfLog_(perfScope, 'matchMembers', t, 'dob=' + dobIso + ' matches=' + matches.length);

  t = perfNow_();
  matches.sort(function(a, b) {
    if (a.initials !== b.initials) return a.initials.localeCompare(b.initials, 'en-GB');
    return a.memberRow - b.memberRow;
  });
  perfLog_(perfScope, 'sortMatches', t, 'matches=' + matches.length);

  if (matches.length && sessionDateIso) {
    t = perfNow_();
    prewarmAttendanceDateCache_(sessionDateIso);
    perfLog_(perfScope, 'prewarmAttendanceDateCache_', t, 'date=' + sessionDateIso);
  }

  t = perfNow_();
  const resolved = disambiguateDuplicateInitials_(matches);
  perfLog_(perfScope, 'disambiguateDuplicateInitials_', t, 'matches=' + resolved.length);
  perfLog_(perfScope, 'total', t0, 'dob=' + dobIso + ' matches=' + resolved.length + (sessionDateIso ? ' sessionDate=' + sessionDateIso : ''));
  return resolved;
}

function getAttendanceSignedInSetForDate_(sessionDateIso) {
  const total = perfNow_();

  if (SIGNIN_PERF_RUNTIME_.attendanceByDate[sessionDateIso]) {
    const runtimeSet = SIGNIN_PERF_RUNTIME_.attendanceByDate[sessionDateIso];
    perfLog_('alreadySignedIn_', 'runtime cache hit', total, 'date=' + sessionDateIso + ' size=' + Object.keys(runtimeSet).length);
    return runtimeSet;
  }

  const cacheKey = 'signin_attendance_date_' + sessionDateIso;
  let t = perfNow_();
  try {
    const cached = CacheService.getScriptCache().get(cacheKey);
    if (cached) {
      const parsed = JSON.parse(cached);
      SIGNIN_PERF_RUNTIME_.attendanceByDate[sessionDateIso] = parsed;
      perfLog_('alreadySignedIn_', 'script cache hit', t, 'date=' + sessionDateIso + ' size=' + Object.keys(parsed).length);
      perfLog_('alreadySignedIn_', 'build set total', total, 'date=' + sessionDateIso + ' source=script-cache');
      return parsed;
    }
    perfLog_('alreadySignedIn_', 'script cache miss', t, 'date=' + sessionDateIso);
  } catch (e) {
    perfLog_('alreadySignedIn_', 'script cache read failed', t, 'date=' + sessionDateIso + ' err=' + String(e));
  }

  t = perfNow_();
  const sheet = getAttendanceSheet_();
  const meta = getHeaderMeta_(sheet);
  const idx = meta.headerMap;
  const lastRow = sheet.getLastRow();
  const set = {};
  perfLog_('alreadySignedIn_', 'sheet meta + lastRow', t, 'date=' + sessionDateIso + ' lastRow=' + lastRow);

  if (lastRow >= 2) {
    const fullNameCol = requireHeader_(idx, SIGNIN_CFG.attendanceHeaders.fullName) + 1;
    const sessionDateCol = requireHeader_(idx, SIGNIN_CFG.attendanceHeaders.sessionDate) + 1;

    t = perfNow_();
    const nameValues = sheet.getRange(2, fullNameCol, lastRow - 1, 1).getValues();
    const dateValues = sheet.getRange(2, sessionDateCol, lastRow - 1, 1).getValues();
    perfLog_('alreadySignedIn_', 'read name/date columns', t, 'date=' + sessionDateIso + ' rows=' + (lastRow - 1));

    t = perfNow_();
    for (let i = 0; i < nameValues.length; i++) {
      const rowName = String(nameValues[i][0] || '').trim();
      const rowDateIso = normaliseSheetDateToIso_(dateValues[i][0]);
      if (!rowName || rowDateIso !== sessionDateIso) continue;
      set[normaliseName_(rowName)] = true;
    }
    perfLog_('alreadySignedIn_', 'build date set', t, 'date=' + sessionDateIso + ' matches=' + Object.keys(set).length);
  }

  SIGNIN_PERF_RUNTIME_.attendanceByDate[sessionDateIso] = set;
  t = perfNow_();
  try {
    CacheService.getScriptCache().put(cacheKey, JSON.stringify(set), ATTENDANCE_DATE_CACHE_TTL_SECONDS);
    perfLog_('alreadySignedIn_', 'script cache write', t, 'date=' + sessionDateIso + ' size=' + Object.keys(set).length);
  } catch (e) {
    perfLog_('alreadySignedIn_', 'script cache write failed', t, 'date=' + sessionDateIso + ' err=' + String(e));
  }
  perfLog_('alreadySignedIn_', 'build set total', total, 'date=' + sessionDateIso + ' source=sheet');
  return set;
}



function invalidateAttendanceDateCache_(sessionDateIso) {
  delete SIGNIN_PERF_RUNTIME_.attendanceByDate[sessionDateIso];
  try {
    CacheService.getScriptCache().remove('signin_attendance_date_' + sessionDateIso);
  } catch (e) {}
}

function appendAttendanceSettlementRow_(sheet, record) {
  const meta = getHeaderMeta_(sheet);
  const idx = meta.headerMap;
  const row = new Array(meta.lastColumn).fill('');

  row[requireHeader_(idx, SIGNIN_CFG.attendanceHeaders.timestamp)] = record.timestamp;
  row[requireHeader_(idx, SIGNIN_CFG.attendanceHeaders.sessionDate)] = new Date(record.sessionDateIso + 'T00:00:00');
  row[requireHeader_(idx, SIGNIN_CFG.attendanceHeaders.sessionName)] = record.sessionName;
  row[requireHeader_(idx, SIGNIN_CFG.attendanceHeaders.fullName)] = record.fullName;
  row[requireHeader_(idx, SIGNIN_CFG.attendanceHeaders.intendedPayment)] = record.intendedPayment || '';
  row[requireHeader_(idx, SIGNIN_CFG.attendanceHeaders.paymentReceived)] = record.paymentReceived === true;
  row[requireHeader_(idx, SIGNIN_CFG.attendanceHeaders.prePayRemaining)] = record.prePayRemaining === '' ? '' : record.prePayRemaining;
  row[requireHeader_(idx, SIGNIN_CFG.attendanceHeaders.notes)] = record.notes || '';

  const rowNumber = (typeof writeAttendanceRow_ === 'function')
    ? writeAttendanceRow_(sheet, row)
    : (sheet.appendRow(row), sheet.getLastRow());

  invalidateSheetRuntimeCache_(sheet);
  invalidateAttendanceDateCache_(record.sessionDateIso);
  return rowNumber;
}


function putAttendanceSignedInSetForDate_(sessionDateIso, setObj) {
  SIGNIN_PERF_RUNTIME_.attendanceByDate[sessionDateIso] = setObj || {};
  try {
    CacheService.getScriptCache().put(
      'signin_attendance_date_' + sessionDateIso,
      JSON.stringify(SIGNIN_PERF_RUNTIME_.attendanceByDate[sessionDateIso]),
      ATTENDANCE_DATE_CACHE_TTL_SECONDS
    );
  } catch (e) {
    // Ignore cache write failures during normal flow.
  }
}

function appendAttendanceSettlementRowNoCacheInvalidation_(sheet, record) {
  const meta = getHeaderMeta_(sheet);
  const idx = meta.headerMap;
  const row = new Array(meta.lastColumn).fill('');

  row[requireHeader_(idx, SIGNIN_CFG.attendanceHeaders.timestamp)] = record.timestamp;
  row[requireHeader_(idx, SIGNIN_CFG.attendanceHeaders.sessionDate)] = new Date(record.sessionDateIso + 'T00:00:00');
  row[requireHeader_(idx, SIGNIN_CFG.attendanceHeaders.sessionName)] = record.sessionName;
  row[requireHeader_(idx, SIGNIN_CFG.attendanceHeaders.fullName)] = record.fullName;
  row[requireHeader_(idx, SIGNIN_CFG.attendanceHeaders.intendedPayment)] = record.intendedPayment || '';
  row[requireHeader_(idx, SIGNIN_CFG.attendanceHeaders.paymentReceived)] = record.paymentReceived === true;
  row[requireHeader_(idx, SIGNIN_CFG.attendanceHeaders.prePayRemaining)] = record.prePayRemaining === '' ? '' : record.prePayRemaining;
  row[requireHeader_(idx, SIGNIN_CFG.attendanceHeaders.notes)] = record.notes || '';

  const rowNumber = (typeof writeAttendanceRow_ === 'function')
    ? writeAttendanceRow_(sheet, row)
    : (sheet.appendRow(row), sheet.getLastRow());

  invalidateSheetRuntimeCache_(sheet);
  return rowNumber;
}





function findFirstWritableBlockStartRow_(sheet, rowCountNeeded) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return 2;

  const colAValues = sheet.getRange(2, 1, Math.max(lastRow - 1, 1), 1).getValues();
  let run = 0;
  for (let i = 0; i < colAValues.length; i++) {
    const blank = String(colAValues[i][0] || '').trim() === '';
    run = blank ? (run + 1) : 0;
    if (run >= rowCountNeeded) {
      return (i - rowCountNeeded + 1) + 2;
    }
  }

  return lastRow + 1;
}

function appendAttendanceSettlementRowsBatch_(sheet, records) {
  if (!records || !records.length) return [];

  const meta = getHeaderMeta_(sheet);
  const idx = meta.headerMap;
  const rows = [];

  for (let i = 0; i < records.length; i++) {
    const record = records[i];
    const row = new Array(meta.lastColumn).fill('');
    row[requireHeader_(idx, SIGNIN_CFG.attendanceHeaders.timestamp)] = record.timestamp;
    row[requireHeader_(idx, SIGNIN_CFG.attendanceHeaders.sessionDate)] = new Date(record.sessionDateIso + 'T00:00:00');
    row[requireHeader_(idx, SIGNIN_CFG.attendanceHeaders.sessionName)] = record.sessionName;
    row[requireHeader_(idx, SIGNIN_CFG.attendanceHeaders.fullName)] = record.fullName;
    row[requireHeader_(idx, SIGNIN_CFG.attendanceHeaders.intendedPayment)] = record.intendedPayment || '';
    row[requireHeader_(idx, SIGNIN_CFG.attendanceHeaders.paymentReceived)] = record.paymentReceived === true;
    row[requireHeader_(idx, SIGNIN_CFG.attendanceHeaders.prePayRemaining)] = record.prePayRemaining === '' ? '' : record.prePayRemaining;
    row[requireHeader_(idx, SIGNIN_CFG.attendanceHeaders.notes)] = record.notes || '';
    rows.push(row);
  }

  const startRow = findFirstWritableBlockStartRow_(sheet, rows.length);
  sheet.getRange(startRow, 1, rows.length, meta.lastColumn).setValues(rows);
  invalidateSheetRuntimeCache_(sheet);

  const rowNumbers = [];
  for (let i = 0; i < rows.length; i++) {
    rowNumbers.push(startRow + i);
  }
  return rowNumbers;
}

function appendOtherPaymentRowsBatch_(sheet, records) {
  if (!records || !records.length) return [];

  const meta = getHeaderMeta_(sheet);
  const idx = meta.headerMap;
  const rows = [];

  for (let i = 0; i < records.length; i++) {
    const record = records[i];
    const row = new Array(meta.lastColumn).fill('');
    row[requireHeader_(idx, SIGNIN_CFG.otherPaymentHeaders.timestamp)] = record.timestamp;
    row[requireHeader_(idx, SIGNIN_CFG.otherPaymentHeaders.basketId)] = record.basketId || '';
    row[requireHeader_(idx, SIGNIN_CFG.otherPaymentHeaders.memberKey)] = record.memberKey || '';
    row[requireHeader_(idx, SIGNIN_CFG.otherPaymentHeaders.bjaNumber)] = record.bjaNumber || '';
    row[requireHeader_(idx, SIGNIN_CFG.otherPaymentHeaders.fullName)] = record.fullName || '';
    row[requireHeader_(idx, SIGNIN_CFG.otherPaymentHeaders.dob)] = record.dob ? new Date(record.dob + 'T00:00:00') : '';
    row[requireHeader_(idx, SIGNIN_CFG.otherPaymentHeaders.sessionDate)] = record.sessionDateIso ? new Date(record.sessionDateIso + 'T00:00:00') : '';
    row[requireHeader_(idx, SIGNIN_CFG.otherPaymentHeaders.sessionName)] = record.sessionName || '';
    row[requireHeader_(idx, SIGNIN_CFG.otherPaymentHeaders.paymentCategory)] = record.paymentCategory || '';
    row[requireHeader_(idx, SIGNIN_CFG.otherPaymentHeaders.description)] = record.description || '';
    row[requireHeader_(idx, SIGNIN_CFG.otherPaymentHeaders.amount)] = record.amount === '' ? '' : roundMoney_(record.amount);
    row[requireHeader_(idx, SIGNIN_CFG.otherPaymentHeaders.paid)] = record.paid === true;
    row[requireHeader_(idx, SIGNIN_CFG.otherPaymentHeaders.paymentMethod)] = record.paymentMethod || '';
    row[requireHeader_(idx, SIGNIN_CFG.otherPaymentHeaders.lineId)] = record.lineId || '';
    row[requireHeader_(idx, SIGNIN_CFG.otherPaymentHeaders.paymentOptionCode)] = record.paymentOptionCode || '';
    row[requireHeader_(idx, SIGNIN_CFG.otherPaymentHeaders.squareVariationId)] = record.squareVariationId || '';
    row[requireHeader_(idx, SIGNIN_CFG.otherPaymentHeaders.notes)] = record.notes || '';
    rows.push(row);
  }

  const startRow = sheet.getLastRow() + 1;
  sheet.getRange(startRow, 1, rows.length, meta.lastColumn).setValues(rows);
  invalidateSheetRuntimeCache_(sheet);

  const rowNumbers = [];
  for (let i = 0; i < rows.length; i++) {
    rowNumbers.push(startRow + i);
  }
  return rowNumbers;
}



function finaliseBasketDeskInternal_(basketId, paymentMethod, options) {
  options = options || {};
  const total = perfNow_();
  const perfScope = options.perfScope || withPerfRequestScope_('finaliseBasketDesk', newPerfRequestId_());
  if (!basketId) throw new Error('Basket is required.');

  let t = perfNow_();
  const basket = getBasketRecord_(basketId);
  perfLog_(perfScope, 'getBasketRecord_', t, 'basketId=' + basketId);
  t = perfNow_();
  ensureBasketEditable_(basket);
  perfLog_(perfScope, 'ensureBasketEditable_', t, 'basketId=' + basketId + ' status=' + basket.status);

  t = perfNow_();
  const basketLinesSheet = getBasketLinesSheet_();
  const basketLinesMeta = getHeaderMeta_(basketLinesSheet);
  const basketLinesIdx = basketLinesMeta.headerMap;
  const basketLineRows = getBasketLineRows_(basketId);
  perfLog_(perfScope, 'getBasketLineRows_', t, 'basketId=' + basketId + ' lines=' + basketLineRows.length);

  t = perfNow_();
  const basketView = buildBasketViewFromLines_(basket, basketLineRows);
  perfLog_(perfScope, 'buildBasketViewFromLines_', t, 'basketId=' + basketId + ' members=' + ((basketView && basketView.memberCount) || 0) + ' total=' + ((basketView && basketView.totalAmount) || 0));

  if (!basketView || basketView.memberCount === 0) {
    throw new Error('Add at least one member before completing sign-in.');
  }

  const totalAmount = Number(basketView.totalAmount || 0);
  const hasChargeLines = basketView.hasChargeLines === true;
  paymentMethod = hasChargeLines ? SIGNIN_CFG.paymentMethods.app : SIGNIN_CFG.paymentMethods.free;

  const attendanceSheet = getAttendanceSheet_();
  const otherPaymentsSheet = getOtherPaymentsSheet_();
  const membersByKey = getMembersByKey_();
  const now = new Date();

  const attendanceLines = [];
  const extraLines = [];
  const sessionChargeByMemberKey = {};

  for (let i = 0; i < basketLineRows.length; i++) {
    const line = basketLineRows[i];
    if (line.lineType === 'ATTENDANCE') {
      attendanceLines.push(line);
    } else if (line.lineType === 'SESSION_CHARGE') {
      sessionChargeByMemberKey[line.memberKey] = line;
    } else {
      extraLines.push(line);
    }
  }

  t = perfNow_();
  const attendanceSetsByDate = {};
  for (let i = 0; i < attendanceLines.length; i++) {
    const line = attendanceLines[i];
    const dateIso = line.sessionDateIso;
    if (!attendanceSetsByDate[dateIso]) {
      attendanceSetsByDate[dateIso] = getAttendanceSignedInSetForDate_(dateIso);
    }
    const key = normaliseName_(line.fullName);
    if (attendanceSetsByDate[dateIso][key] === true) {
      throw new Error(toInitials_(line.fullName) + ' is already signed in for ' + line.sessionDateIso + '.');
    }
    attendanceSetsByDate[dateIso][key] = true;
  }
  perfLog_(perfScope, 'prepareAttendanceSets_', t, 'attendanceLines=' + attendanceLines.length + ' uniqueDates=' + Object.keys(attendanceSetsByDate).length);

  t = perfNow_();
  const attendanceRecords = [];
  const memberPrepayUpdates = [];
  const attendanceLineUpdateData = [];

  for (let i = 0; i < attendanceLines.length; i++) {
    const line = attendanceLines[i];
    const member = membersByKey[line.memberKey];
    if (!member) {
      throw new Error('Member not found when completing sign-in for ' + toInitials_(line.fullName) + '.');
    }

    const payment = describeMemberPayment_(member);
    let attendanceIntendedPayment = payment.intendedPayment;
    let attendancePrePayRemaining = payment.prePayRemaining;
    let attendancePaymentReceived = true;

    if (payment.usesPrePay) {
      attendancePrePayRemaining = Math.max(0, Number(payment.prePayRemaining || 0) - 1);
      memberPrepayUpdates.push({
        memberKey: member.memberKey,
        newValue: attendancePrePayRemaining
      });
    }

    if (payment.paymentRequired) {
      attendanceIntendedPayment = 'App Payment';
      attendancePaymentReceived = false;
    }

    attendanceRecords.push({
      timestamp: now,
      sessionDateIso: line.sessionDateIso,
      sessionName: member.sessionName,
      fullName: member.fullName,
      intendedPayment: attendanceIntendedPayment,
      paymentReceived: attendancePaymentReceived,
      prePayRemaining: attendancePrePayRemaining === '' ? '' : attendancePrePayRemaining,
      notes: member.notes || ''
    });

    attendanceLineUpdateData.push({
      attendanceLine: line,
      paid: payment.paymentRequired ? false : true,
      paymentMethod: payment.paymentRequired
        ? SIGNIN_CFG.paymentMethods.app
        : attendanceIntendedPaymentToBasketMethod_(attendanceIntendedPayment)
    });
  }

  const attendanceRowNumbers = appendAttendanceSettlementRowsBatch_(attendanceSheet, attendanceRecords);
  if (memberPrepayUpdates.length) {
    updateMemberPrePayRemainingBatch_(memberPrepayUpdates);
  }

  const basketLineUpdates = [];
  for (let i = 0; i < attendanceLineUpdateData.length; i++) {
    const item = attendanceLineUpdateData[i];
    const attendanceRowRef = String(attendanceRowNumbers[i]);

    basketLineUpdates.push({
      rowNumber: item.attendanceLine.rowNumber,
      paid: item.paid,
      paymentMethod: item.paymentMethod,
      attendanceRowRef: attendanceRowRef,
      postedAt: now
    });

    const chargeLine = sessionChargeByMemberKey[item.attendanceLine.memberKey];
    if (chargeLine) {
      basketLineUpdates.push({
        rowNumber: chargeLine.rowNumber,
        paid: item.paid,
        paymentMethod: item.paymentMethod,
        attendanceRowRef: attendanceRowRef,
        postedAt: now
      });
    }
  }

  applyBasketLineUpdatesBatch_(basketLinesSheet, basketLinesIdx, basketLineUpdates);
  perfLog_(perfScope, 'postAttendanceLines_', t, 'count=' + attendanceLines.length);

  t = perfNow_();
  for (const dateIso in attendanceSetsByDate) {
    if (Object.prototype.hasOwnProperty.call(attendanceSetsByDate, dateIso)) {
      putAttendanceSignedInSetForDate_(dateIso, attendanceSetsByDate[dateIso]);
    }
  }
  perfLog_(perfScope, 'writeAttendanceCaches_', t, 'dates=' + Object.keys(attendanceSetsByDate).length);

  t = perfNow_();
  if (extraLines.length) {
    const otherPaymentRecords = [];
    const extraLineUpdates = [];

    for (let i = 0; i < extraLines.length; i++) {
      const line = extraLines[i];

      otherPaymentRecords.push({
        timestamp: now,
        basketId: basketId,
        memberKey: line.memberKey,
        bjaNumber: line.bjaNumber,
        fullName: line.fullName,
        dob: line.dobIso,
        sessionDateIso: line.sessionDateIso,
        sessionName: line.sessionName,
        paymentCategory: line.paymentCategory,
        description: line.description,
        amount: line.amount,
        paid: false,
        paymentMethod: SIGNIN_CFG.paymentMethods.app,
        lineId: line.lineId,
        paymentOptionCode: line.paymentOptionCode,
        squareVariationId: line.squareVariationId,
        notes: line.notes
      });

      extraLineUpdates.push({
        rowNumber: line.rowNumber,
        paid: false,
        paymentMethod: SIGNIN_CFG.paymentMethods.app,
        attendanceRowRef: '',
        postedAt: now
      });
    }

    appendOtherPaymentRowsBatch_(otherPaymentsSheet, otherPaymentRecords);
    applyBasketLineUpdatesBatch_(basketLinesSheet, basketLinesIdx, extraLineUpdates);
  }
  perfLog_(perfScope, 'postOtherPaymentLines_', t, 'count=' + extraLines.length);

  t = perfNow_();
  updateBasketRow_(basket.rowNumber, {
    'Status': hasChargeLines
      ? SIGNIN_CFG.basketStatuses.signedInAwaitingPayment
      : SIGNIN_CFG.basketStatuses.paymentResolved,
    'Settlement Method': paymentMethod,
    'Total Amount': totalAmount,
    'Member Count': basketView.memberCount,
    'Posted At': now,
    'Payment Resolved At': hasChargeLines ? '' : now
  });
  perfLog_(perfScope, 'updateBasketRow_', t, 'basketId=' + basketId + ' method=' + paymentMethod);

  perfLog_(perfScope, 'total', total, 'basketId=' + basketId + ' members=' + basketView.memberCount + ' extras=' + extraLines.length);
  const result = {
    ok: true,
    basketId: basketId,
    paymentPending: hasChargeLines,
    status: hasChargeLines
      ? SIGNIN_CFG.basketStatuses.signedInAwaitingPayment
      : SIGNIN_CFG.basketStatuses.paymentResolved,
    totalAmount: totalAmount,
    formattedTotal: formatCurrency_(totalAmount),
    message: hasChargeLines
      ? 'Sign-in completed. Payment is still pending.'
      : 'Sign-in completed.'
  };

  if (options.includeAppCheckoutContext === true && hasChargeLines) {
    result.appCheckoutContext = {
      basketId: basketId,
      basketRowNumber: basket.rowNumber,
      basketNotes: basket.notes,
      basketLineRows: basketLineRows
    };
  }

  return result;
}

function finaliseBasketDesk(basketId, paymentMethod) {
  return finaliseBasketDeskInternal_(basketId, paymentMethod);
}

function finaliseBasketForAppCheckout(basketId) {
  const total = perfNow_();
  const perfScope = withPerfRequestScope_('finaliseBasketForAppCheckout', newPerfRequestId_());
  let t = perfNow_();
  const result = finaliseBasketDeskInternal_(basketId, SIGNIN_CFG.paymentMethods.app, {
    perfScope: perfScope,
    includeAppCheckoutContext: true
  });
  perfLog_(perfScope, 'finaliseBasketDeskInternal_', t, 'basketId=' + basketId + ' paymentPending=' + result.paymentPending);

  if (!result.paymentPending || !result.appCheckoutContext) {
    perfLog_(perfScope, 'total', total, 'basketId=' + basketId + ' paymentPending=false');
    return result;
  }

  const checkoutContext = result.appCheckoutContext;
  t = perfNow_();
  const payableLines = getPayableSquareLinesFromBasketLines_(basketId, checkoutContext.basketLineRows);
  perfLog_(perfScope, 'prepareSquarePayableLines_', t, 'basketId=' + basketId + ' lines=' + payableLines.length);

  try {
    t = perfNow_();
    const payment = createBasketPaymentLinkFromPayableContext_({
      basketId: basketId,
      basketRowNumber: checkoutContext.basketRowNumber,
      basketNotes: checkoutContext.basketNotes,
      lines: payableLines,
      perfScope: perfScope
    });
    perfLog_(perfScope, 'createBasketPaymentLinkFromPayableContext_', t, 'basketId=' + basketId + ' ok=true');
    result.payment = payment;
  } catch (err) {
    perfLog_(perfScope, 'createBasketPaymentLinkFromPayableContext_', t, 'basketId=' + basketId + ' ok=false err=' + String(err && err.message ? err.message : err));
    result.paymentError = err && err.message ? err.message : 'Unknown error.';
  }

  delete result.appCheckoutContext;
  perfLog_(perfScope, 'total', total, 'basketId=' + basketId + ' paymentPending=' + result.paymentPending);
  return result;
}


function liveAttendanceHasMemberOnDate_(fullName, sessionDateIso) {
  const t = perfNow_();
  const sheet = getAttendanceSheet_();
  const meta = getHeaderMeta_(sheet);
  const idx = meta.headerMap;
  const dateCol = requireHeader_(idx, SIGNIN_CFG.attendanceHeaders.sessionDate) + 1;
  const nameCol = requireHeader_(idx, SIGNIN_CFG.attendanceHeaders.fullName) + 1;
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) {
    perfLog_('alreadySignedIn_', 'live verify', t, 'date=' + sessionDateIso + ' result=false rows=0');
    return false;
  }

  const rowCount = lastRow - 1;
  const dateValues = sheet.getRange(2, dateCol, rowCount, 1).getValues();
  const nameValues = sheet.getRange(2, nameCol, rowCount, 1).getValues();
  const targetName = normaliseName_(fullName);
  let result = false;

  for (let i = 0; i < rowCount; i++) {
    if (normaliseSheetDateToIso_(dateValues[i][0]) !== sessionDateIso) continue;
    if (normaliseName_(nameValues[i][0]) !== targetName) continue;
    result = true;
    break;
  }

  perfLog_('alreadySignedIn_', 'live verify', t, 'date=' + sessionDateIso + ' result=' + result + ' rows=' + rowCount + ' name=' + toInitials_(fullName));
  return result;
}

function writeAttendanceDateCache_(sessionDateIso, set) {
  SIGNIN_PERF_RUNTIME_.attendanceByDate[sessionDateIso] = set;
  try {
    CacheService.getScriptCache().put('signin_attendance_date_' + sessionDateIso, JSON.stringify(set), ATTENDANCE_DATE_CACHE_TTL_SECONDS);
  } catch (e) {}
}

function alreadySignedIn_(attendanceSheet, fullName, sessionDateIso) {
  const t = perfNow_();
  const set = getAttendanceSignedInSetForDate_(sessionDateIso);
  const key = normaliseName_(fullName);
  const cachedResult = set[key] === true;

  if (!cachedResult) {
    perfLog_('alreadySignedIn_', 'lookup in set', t, 'date=' + sessionDateIso + ' result=false name=' + toInitials_(fullName));
    return false;
  }

  // Defensive live verification for stale positive cache results.
  const verifyStart = perfNow_();
  const liveResult = liveAttendanceHasMemberOnDate_(fullName, sessionDateIso);
  perfLog_('alreadySignedIn_', 'verify cached positive', verifyStart, 'date=' + sessionDateIso + ' live=' + liveResult + ' name=' + toInitials_(fullName));

  if (!liveResult) {
    delete set[key];
    writeAttendanceDateCache_(sessionDateIso, set);
    perfLog_('alreadySignedIn_', 'stale cache corrected', t, 'date=' + sessionDateIso + ' name=' + toInitials_(fullName));
    return false;
  }

  perfLog_('alreadySignedIn_', 'lookup in set', t, 'date=' + sessionDateIso + ' result=true name=' + toInitials_(fullName));
  return true;
}
