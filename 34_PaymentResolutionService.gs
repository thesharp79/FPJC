function updateAttendancePaymentReceivedByRowRefs_(rowRefs) {
  if (!rowRefs || !rowRefs.length) return;

  const uniqueRowRefs = Array.from(new Set(
    rowRefs
      .map(function(ref) { return Number(ref); })
      .filter(function(ref) { return ref > 1; })
  ));

  if (!uniqueRowRefs.length) return;

  const sheet = getAttendanceSheet_();
  const meta = getHeaderMeta_(sheet);
  const idx = meta.headerMap;
  const paymentReceivedCol = requireHeader_(idx, SIGNIN_CFG.attendanceHeaders.paymentReceived) + 1;

  for (let i = 0; i < uniqueRowRefs.length; i++) {
    sheet.getRange(uniqueRowRefs[i], paymentReceivedCol).setValue(true);
  }

  invalidateSheetRuntimeCache_(sheet);
}

function updateAttendanceIntendedPaymentByRowRefs_(rowRefs, intendedPaymentLabel) {
  if (!rowRefs || !rowRefs.length) return;

  const uniqueRowRefs = Array.from(new Set(
    rowRefs
      .map(function(ref) { return Number(ref); })
      .filter(function(ref) { return ref > 1; })
  ));

  if (!uniqueRowRefs.length) return;

  const sheet = getAttendanceSheet_();
  const meta = getHeaderMeta_(sheet);
  const idx = meta.headerMap;
  const intendedPaymentCol = requireHeader_(idx, SIGNIN_CFG.attendanceHeaders.intendedPayment) + 1;

  for (let i = 0; i < uniqueRowRefs.length; i++) {
    sheet.getRange(uniqueRowRefs[i], intendedPaymentCol).setValue(intendedPaymentLabel || '');
  }

  invalidateSheetRuntimeCache_(sheet);
}

function updateOtherPaymentsResolvedByLineIds_(basketId, lineIds, paymentMethod) {
  if (!basketId || !lineIds || !lineIds.length) return;

  const lineIdSet = {};
  for (let i = 0; i < lineIds.length; i++) {
    const lineId = String(lineIds[i] || '').trim();
    if (lineId) lineIdSet[lineId] = true;
  }

  if (!Object.keys(lineIdSet).length) return;

  const sheet = getOtherPaymentsSheet_();
  const payload = getSheetPayload_(sheet);
  const idx = payload.headerMap;

  const basketIdCol = requireHeader_(idx, SIGNIN_CFG.otherPaymentHeaders.basketId);
  const lineIdCol = requireHeader_(idx, SIGNIN_CFG.otherPaymentHeaders.lineId);
  const paidCol = requireHeader_(idx, SIGNIN_CFG.otherPaymentHeaders.paid) + 1;
  const paymentMethodCol = requireHeader_(idx, SIGNIN_CFG.otherPaymentHeaders.paymentMethod) + 1;

  let changed = false;

  for (let r = 1; r < payload.values.length; r++) {
    const row = payload.values[r];
    if (String(row[basketIdCol] || '').trim() !== basketId) continue;

    const lineId = String(row[lineIdCol] || '').trim();
    if (!lineIdSet[lineId]) continue;

    sheet.getRange(r + 1, paidCol).setValue(true);
    sheet.getRange(r + 1, paymentMethodCol).setValue(paymentMethod || '');
    changed = true;
  }

  if (changed) {
    invalidateSheetRuntimeCache_(sheet);
  }
}

function updateOtherPaymentsMethodByLineIds_(basketId, lineIds, paymentMethod) {
  if (!basketId || !lineIds || !lineIds.length) return;

  const lineIdSet = {};
  for (let i = 0; i < lineIds.length; i++) {
    const lineId = String(lineIds[i] || '').trim();
    if (lineId) lineIdSet[lineId] = true;
  }

  if (!Object.keys(lineIdSet).length) return;

  const sheet = getOtherPaymentsSheet_();
  const payload = getSheetPayload_(sheet);
  const idx = payload.headerMap;

  const basketIdCol = requireHeader_(idx, SIGNIN_CFG.otherPaymentHeaders.basketId);
  const lineIdCol = requireHeader_(idx, SIGNIN_CFG.otherPaymentHeaders.lineId);
  const paymentMethodCol = requireHeader_(idx, SIGNIN_CFG.otherPaymentHeaders.paymentMethod) + 1;

  let changed = false;

  for (let r = 1; r < payload.values.length; r++) {
    const row = payload.values[r];
    if (String(row[basketIdCol] || '').trim() !== basketId) continue;

    const lineId = String(row[lineIdCol] || '').trim();
    if (!lineIdSet[lineId]) continue;

    sheet.getRange(r + 1, paymentMethodCol).setValue(paymentMethod || '');
    changed = true;
  }

  if (changed) {
    invalidateSheetRuntimeCache_(sheet);
  }
}

function resolveBasketPayment(basketId, paymentMethod, squarePaymentId) {
  if (!basketId) throw new Error('Basket ID is required.');

  const basket = getBasketRecord_(basketId);
  if (!basket) throw new Error('Basket not found.');

  if (basket.status === SIGNIN_CFG.basketStatuses.cancelled) {
    throw new Error('This basket has been cancelled.');
  }

  if (basket.status === SIGNIN_CFG.basketStatuses.paymentResolved ||
      basket.status === SIGNIN_CFG.basketStatuses.posted) {
    return {
      ok: true,
      basketId: basketId,
      message: 'Basket is already resolved.'
    };
  }

  paymentMethod = paymentMethod || SIGNIN_CFG.paymentMethods.app;

  const lines = getBasketLineRows_(basketId);
  const basketLinesSheet = getBasketLinesSheet_();
  const basketLinesPayload = getSheetPayload_(basketLinesSheet);
  const basketLinesIdx = basketLinesPayload.headerMap;

  const basketLineUpdates = [];
  const attendanceRowRefsToResolve = [];
  const otherPaymentLineIdsToResolve = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.paymentRequired === true) {
      basketLineUpdates.push({
        rowNumber: line.rowNumber,
        paid: true,
        paymentMethod: paymentMethod
      });
    }

    if (line.lineType === 'ATTENDANCE' && line.paymentRequired === true && line.attendanceRowRef) {
      attendanceRowRefsToResolve.push(line.attendanceRowRef);
    }

    if (line.lineType !== 'ATTENDANCE' &&
        line.lineType !== 'SESSION_CHARGE' &&
        line.paymentRequired === true) {
      otherPaymentLineIdsToResolve.push(line.lineId);
    }
  }

  if (basketLineUpdates.length) {
    applyBasketLineUpdatesBatch_(basketLinesSheet, basketLinesIdx, basketLineUpdates);
  }

  updateAttendancePaymentReceivedByRowRefs_(attendanceRowRefsToResolve);
  updateOtherPaymentsResolvedByLineIds_(basketId, otherPaymentLineIdsToResolve, paymentMethod);

  const resolvedAt = new Date();
  const basketUpdates = {
    'Status': SIGNIN_CFG.basketStatuses.paymentResolved,
    'Settlement Method': paymentMethod,
    'Payment Resolved At': resolvedAt
  };

  if (squarePaymentId) {
    basketUpdates['Square Payment ID'] = squarePaymentId;
  }

  updateBasketRow_(basket.rowNumber, basketUpdates);

  return {
    ok: true,
    basketId: basketId,
    message: 'Basket payment resolved.',
    paymentMethod: paymentMethod
  };
}

function resolveBasketPaymentApp(basketId, squarePaymentId) {
  return resolveBasketPayment(
    basketId,
    SIGNIN_CFG.paymentMethods.app,
    squarePaymentId || ''
  );
}

function markBasketPendingAsDeskPayment(basketId) {
  if (!basketId) throw new Error('Basket ID is required.');

  const basket = getBasketRecord_(basketId);
  if (!basket) throw new Error('Basket not found.');

  if (basket.status !== SIGNIN_CFG.basketStatuses.signedInAwaitingPayment) {
    return {
      ok: true,
      basketId: basketId,
      message: 'Basket is already not awaiting payment.'
    };
  }

  const lines = getBasketLineRows_(basketId);
  const basketLinesSheet = getBasketLinesSheet_();
  const basketLinesPayload = getSheetPayload_(basketLinesSheet);
  const basketLinesIdx = basketLinesPayload.headerMap;

  const basketLineUpdates = [];
  const attendanceRowRefs = [];
  const otherPaymentLineIds = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.paymentRequired !== true) continue;

    basketLineUpdates.push({
      rowNumber: line.rowNumber,
      paymentMethod: SIGNIN_CFG.paymentMethods.desk
    });

    if (line.lineType === 'ATTENDANCE' && line.attendanceRowRef) {
      attendanceRowRefs.push(line.attendanceRowRef);
    }

    if (line.lineType !== 'ATTENDANCE' && line.lineType !== 'SESSION_CHARGE') {
      otherPaymentLineIds.push(line.lineId);
    }
  }

  if (basketLineUpdates.length) {
    applyBasketLineUpdatesBatch_(basketLinesSheet, basketLinesIdx, basketLineUpdates);
  }

  if (attendanceRowRefs.length) {
    updateAttendanceIntendedPaymentByRowRefs_(attendanceRowRefs, 'Desk Payment');
  }

  if (otherPaymentLineIds.length) {
    updateOtherPaymentsMethodByLineIds_(basketId, otherPaymentLineIds, SIGNIN_CFG.paymentMethods.desk);
  }

  updateBasketRow_(basket.rowNumber, {
    'Settlement Method': SIGNIN_CFG.paymentMethods.desk
  });

  return {
    ok: true,
    basketId: basketId,
    message: 'Payment marked as desk payment.'
  };
}

function resolveBasketPaymentCard(basketId) {
  return resolveBasketPayment(
    basketId,
    SIGNIN_CFG.paymentMethods.card,
    ''
  );
}
