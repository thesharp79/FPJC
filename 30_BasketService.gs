function addExtraToBasket(basketId, memberKey, optionCode) {
  const total = perfNow_();
  const perfScope = withPerfRequestScope_('addExtraToBasket', newPerfRequestId_());
  if (!basketId || !memberKey || !optionCode) {
    throw new Error('Basket, member and payment option are required.');
  }

  let t = perfNow_();
  const basket = getBasketRecord_(basketId);
  perfLog_(perfScope, 'getBasketRecord_', t, 'basketId=' + basketId);
  ensureBasketEditable_(basket);

  t = perfNow_();
  const member = getMemberByKey_(memberKey);
  perfLog_(perfScope, 'getMemberByKey_', t, 'member=' + member.initials);
  t = perfNow_();
  const option = getPaymentOptionByCode_(optionCode, basket.sessionDateIso, 'DESK', member.sessionName);
  perfLog_(perfScope, 'getPaymentOptionByCode_', t, 'code=' + option.code + ' member=' + member.initials);

  if (option.chargeType === 'SESSION') {
    throw new Error('Session payment rows are added automatically from the member session.');
  }

  if (!isFiniteNumber_(option.amount) || option.amount <= 0) {
    throw new Error('Payment option "' + option.code + '" needs a valid amount.');
  }

  t = perfNow_();
  const existingLines = getBasketLineRows_(basketId);
  perfLog_(perfScope, 'getBasketLineRows_', t, 'basketId=' + basketId + ' lines=' + existingLines.length);
  t = perfNow_();
  if (basketAlreadyHasOptionForMember_(basketId, memberKey, option.code)) {
    perfLog_(perfScope, 'basketAlreadyHasOptionForMember_', t, 'duplicate=true code=' + option.code + ' member=' + member.initials);
    t = perfNow_();
    const basketViewDup = buildBasketViewFromLines_(basket, existingLines);
    perfLog_(perfScope, 'buildBasketViewFromLines_', t, 'basketId=' + basketId + ' members=' + basketViewDup.memberCount + ' total=' + basketViewDup.totalAmount);
    perfLog_(perfScope, 'total', total, 'basketId=' + basketId + ' duplicate=true');
    return {
      basketId: basketId,
      message: option.label + ' is already in the basket for ' + member.initials + '.',
      basket: basketViewDup
    };
  }
  perfLog_(perfScope, 'basketAlreadyHasOptionForMember_', t, 'duplicate=false code=' + option.code + ' member=' + member.initials);

  const newLine = {
    basketId: basketId,
    lineId: newLineId_(),
    memberKey: member.memberKey,
    bjaNumber: member.bjaNumber,
    fullName: member.fullName,
    dob: member.dobIso,
    sessionDate: basket.sessionDateIso,
    sessionName: member.sessionName,
    lineType: option.chargeType,
    paymentCategory: option.chargeType,
    description: option.label,
    amount: option.amount,
    paymentRequired: true,
    paid: false,
    paymentMethod: '',
    paymentOptionCode: option.code,
    squareVariationId: option.squareVariationId,
    attendanceRowRef: '',
    postedAt: '',
    notes: ''
  };

  t = perfNow_();
  appendBasketLines_([newLine]);
  perfLog_(perfScope, 'appendBasketLines_', t, 'basketId=' + basketId + ' rows=1');

  const combinedLines = existingLines.concat([{
    rowNumber: 0,
    basketId: newLine.basketId,
    lineId: newLine.lineId,
    memberKey: newLine.memberKey,
    bjaNumber: newLine.bjaNumber || '',
    fullName: newLine.fullName || '',
    dobIso: newLine.dob || '',
    sessionDateIso: newLine.sessionDate || '',
    sessionName: newLine.sessionName || '',
    lineType: newLine.lineType || '',
    paymentCategory: newLine.paymentCategory || '',
    description: newLine.description || '',
    amount: newLine.amount === '' ? '' : roundMoney_(newLine.amount),
    paymentRequired: newLine.paymentRequired === true,
    paid: newLine.paid === true,
    paymentMethod: newLine.paymentMethod || '',
    paymentOptionCode: newLine.paymentOptionCode || '',
    squareVariationId: newLine.squareVariationId || '',
    attendanceRowRef: newLine.attendanceRowRef || '',
    postedAt: newLine.postedAt || '',
    notes: newLine.notes || ''
  }]);

  t = perfNow_();
  const summary = updateBasketTotalsFromLines_(basket.rowNumber, combinedLines);
  basket.status = summary.status;
  perfLog_(perfScope, 'updateBasketTotalsFromLines_', t, 'basketId=' + basketId + ' lines=' + combinedLines.length);

  t = perfNow_();
  const basketView = buildBasketViewFromLines_(basket, combinedLines);
  perfLog_(perfScope, 'buildBasketViewFromLines_', t, 'basketId=' + basketId + ' members=' + basketView.memberCount + ' total=' + basketView.totalAmount);
  perfLog_(perfScope, 'total', total, 'basketId=' + basketId + ' member=' + member.initials + ' option=' + option.code);

  return {
    basketId: basketId,
    message: option.label + ' added for ' + member.initials + '.',
    basket: basketView
  };
}

function cancelBasket(basketId) {
  if (!basketId) return { ok: true };

  const basket = getBasketRecord_(basketId);
  ensureBasketEditable_(basket);

  updateBasketRow_(basket.rowNumber, {
    Status: SIGNIN_CFG.basketStatuses.cancelled,
    Notes: 'Cancelled from sign-in app on ' + Utilities.formatDate(new Date(), SIGNIN_CFG.timezone, 'dd/MM/yyyy HH:mm:ss')
  });

  return { ok: true };
}

function basketContainsMemberInLines_(lines, memberKey) {
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].memberKey === memberKey && lines[i].lineType === 'ATTENDANCE') {
      return true;
    }
  }
  return false;
}

function refreshBasketTotals_(basketId) {
  const basket = getBasketRecord_(basketId);
  if (!basket) throw new Error('Basket not found.');
  updateBasketTotalsFromLines_(basket.rowNumber, getBasketLineRows_(basketId));
}

function basketContainsMember_(basketId, memberKey) {
  const lines = getBasketLineRows_(basketId);
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].memberKey === memberKey && lines[i].lineType === 'ATTENDANCE') {
      return true;
    }
  }
  return false;
}

function basketAlreadyHasOptionForMember_(basketId, memberKey, optionCode) {
  const lines = getBasketLineRows_(basketId);
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].memberKey !== memberKey) continue;
    if (lines[i].paymentOptionCode !== optionCode) continue;
    return true;
  }
  return false;
}

function ensureBasketEditable_(basket) {
  if (!basket) throw new Error('Basket not found.');

  const editableStatuses = [
    SIGNIN_CFG.basketStatuses.building,
    SIGNIN_CFG.basketStatuses.ready
  ];

  if (editableStatuses.indexOf(basket.status) !== -1) {
    return;
  }

  if (basket.status === SIGNIN_CFG.basketStatuses.cancelled) {
    throw new Error('This basket has been cancelled.');
  }

  if (basket.status === SIGNIN_CFG.basketStatuses.signedInAwaitingPayment) {
    throw new Error('This basket has already been signed in and is awaiting payment resolution.');
  }

  if (basket.status === SIGNIN_CFG.basketStatuses.paymentResolved ||
      basket.status === SIGNIN_CFG.basketStatuses.posted) {
    throw new Error('This basket has already been completed.');
  }

  throw new Error('This basket is not editable in its current status.');
}

function addMemberToBasket(basketId, memberRow, sessionDateIso) {
  const total = perfNow_();
  const perfScope = withPerfRequestScope_('addMemberToBasket', newPerfRequestId_());
  if (!memberRow) throw new Error('Member selection is required.');
  assertIsoDate_(sessionDateIso, 'Session date');

  let t = perfNow_();
  const member = getMemberByRow_(memberRow);
  perfLog_(perfScope, 'getMemberByRow_', t, 'memberRow=' + memberRow + ' initials=' + member.initials);

  if (member.status !== SIGNIN_CFG.activeStatusValue) throw new Error('Selected member is not active.');
  if (!member.fullName || !member.sessionName) throw new Error('Selected member record is incomplete.');

  t = perfNow_();
  let basket = basketId ? getBasketRecord_(basketId) : null;
  perfLog_(perfScope, 'getBasketRecord_', t, 'basketId=' + (basketId || 'NEW'));

  let existingLines = [];
  if (basket) {
    ensureBasketEditable_(basket);
    if (basket.sessionDateIso && basket.sessionDateIso !== sessionDateIso) {
      throw new Error('This basket is already tied to a different session date. Cancel it and start a new basket.');
    }

    t = perfNow_();
    existingLines = getBasketLineRows_(basketId);
    perfLog_(perfScope, 'getBasketLineRows_', t, 'basketId=' + basketId + ' lines=' + existingLines.length);

    t = perfNow_();
    if (basketContainsMemberInLines_(existingLines, member.memberKey)) {
      perfLog_(perfScope, 'basketContainsMemberInLines_', t, 'already=true');
      const basketViewDup = buildBasketViewFromLines_(basket, existingLines);
      perfLog_(perfScope, 'total', total, 'basketId=' + basketId + ' member=' + member.initials + ' duplicateInBasket=true');
      return { basketId: basketId, message: member.initials + ' is already in the basket.', basket: basketViewDup };
    }
    perfLog_(perfScope, 'basketContainsMemberInLines_', t, 'already=false');
  }

  t = perfNow_();
  if (alreadySignedIn_(getAttendanceSheet_(), member.fullName, sessionDateIso)) {
    perfLog_(perfScope, 'alreadySignedIn_', t, 'already=true date=' + sessionDateIso);
    return {
      basketId: basketId || '',
      message: member.initials + ' is already signed in for ' + sessionDateIso + '.',
      basket: basket ? buildBasketViewFromLines_(basket, existingLines) : null
    };
  }
  perfLog_(perfScope, 'alreadySignedIn_', t, 'already=false date=' + sessionDateIso);

  if (!basket) {
    t = perfNow_();
    basket = createBasket_(sessionDateIso);
    basketId = basket.basketId;
    perfLog_(perfScope, 'createBasket_', t, 'basketId=' + basketId);
    existingLines = [];
  }

  t = perfNow_();
  const payment = describeMemberPayment_(member);
  perfLog_(perfScope, 'describeMemberPayment_', t, 'required=' + payment.paymentRequired + ' label=' + payment.shortLabel);

  const newLines = [{
    basketId: basketId,
    lineId: newLineId_(),
    memberKey: member.memberKey,
    bjaNumber: member.bjaNumber,
    fullName: member.fullName,
    dob: member.dobIso,
    sessionDate: sessionDateIso,
    sessionName: member.sessionName,
    lineType: 'ATTENDANCE',
    paymentCategory: 'SESSION',
    description: member.sessionName + ' attendance',
    amount: '',
    paymentRequired: payment.paymentRequired,
    paid: false,
    paymentMethod: '',
    paymentOptionCode: '',
    squareVariationId: '',
    attendanceRowRef: '',
    postedAt: '',
    notes: payment.shortLabel
  }];

  if (payment.paymentRequired) {
    t = perfNow_();
    const sessionOption = getSessionPaymentOption_(member.sessionName, sessionDateIso, 'DESK');
    perfLog_(perfScope, 'getSessionPaymentOption_', t, 'session=' + member.sessionName + ' code=' + sessionOption.code);
    newLines.push({
      basketId: basketId,
      lineId: newLineId_(),
      memberKey: member.memberKey,
      bjaNumber: member.bjaNumber,
      fullName: member.fullName,
      dob: member.dobIso,
      sessionDate: sessionDateIso,
      sessionName: member.sessionName,
      lineType: 'SESSION_CHARGE',
      paymentCategory: 'SESSION',
      description: sessionOption.label || (member.sessionName + ' session fee'),
      amount: sessionOption.amount,
      paymentRequired: true,
      paid: false,
      paymentMethod: '',
      paymentOptionCode: sessionOption.code,
      squareVariationId: sessionOption.squareVariationId,
      attendanceRowRef: '',
      postedAt: '',
      notes: ''
    });
  }

  t = perfNow_();
  appendBasketLines_(newLines);
  perfLog_(perfScope, 'appendBasketLines_', t, 'basketId=' + basketId + ' rows=' + newLines.length);

  const combinedLines = existingLines.concat(newLines.map(function(line) {
    return {
      rowNumber: 0,
      basketId: line.basketId,
      lineId: line.lineId,
      memberKey: line.memberKey,
      bjaNumber: line.bjaNumber || '',
      fullName: line.fullName || '',
      dobIso: line.dob || '',
      sessionDateIso: line.sessionDate || '',
      sessionName: line.sessionName || '',
      lineType: line.lineType || '',
      paymentCategory: line.paymentCategory || '',
      description: line.description || '',
      amount: line.amount === '' ? '' : roundMoney_(line.amount),
      paymentRequired: line.paymentRequired === true,
      paid: line.paid === true,
      paymentMethod: line.paymentMethod || '',
      paymentOptionCode: line.paymentOptionCode || '',
      squareVariationId: line.squareVariationId || '',
      attendanceRowRef: line.attendanceRowRef || '',
      postedAt: line.postedAt || '',
      notes: line.notes || ''
    };
  }));

  t = perfNow_();
  const summary = updateBasketTotalsFromLines_(basket.rowNumber, combinedLines);
  basket.status = summary.status;
  perfLog_(perfScope, 'updateBasketTotalsFromLines_', t, 'basketId=' + basketId + ' lines=' + combinedLines.length);

  t = perfNow_();
  const basketView = buildBasketViewFromLines_(basket, combinedLines);
  perfLog_(perfScope, 'buildBasketViewFromLines_', t, 'basketId=' + basketId + ' members=' + basketView.memberCount + ' total=' + basketView.totalAmount);

  perfLog_(perfScope, 'total', total, 'basketId=' + basketId + ' member=' + member.initials);
  return {
    basketId: basketId,
    message: member.initials + ' added to basket.',
    basket: basketView
  };
}

function refreshBasketAfterLineRemoval_(basketId) {
  invalidateBasketLinesCache_(basketId);
  const basket = getBasketRecord_(basketId);
  const freshLines = getBasketLineRows_(basketId);
  updateBasketTotalsFromLines_(basket.rowNumber, freshLines);
  const refreshedBasket = getBasketRecord_(basketId);
  return buildBasketViewFromLines_(refreshedBasket, freshLines);
}

function removeMemberFromBasket(basketId, memberKey) {
  if (!basketId || !memberKey) throw new Error('Basket and member are required.');

  const basket = getBasketRecord_(basketId);
  ensureBasketEditable_(basket);

  const lines = getBasketLineRows_(basketId);
  const toRemove = lines.filter(function(line) {
    return String(line.memberKey || '').trim() === String(memberKey || '').trim();
  });

  if (!toRemove.length) {
    return {
      basketId: basketId,
      message: 'Member is not in the basket.',
      basket: buildBasketViewFromLines_(basket, lines)
    };
  }

  clearBasketLineRows_(toRemove.map(function(line) { return line.rowNumber; }));
  const basketView = refreshBasketAfterLineRemoval_(basketId);

  return {
    basketId: basketId,
    message: 'Member removed from basket.',
    basket: basketView
  };
}

function removeBasketLine(basketId, lineId) {
  if (!basketId || !lineId) throw new Error('Basket and line are required.');

  const basket = getBasketRecord_(basketId);
  ensureBasketEditable_(basket);

  const lines = getBasketLineRows_(basketId);
  const line = lines.find(function(item) {
    return String(item.lineId || '').trim() === String(lineId || '').trim();
  });

  if (!line) {
    return {
      basketId: basketId,
      message: 'Charge is no longer in the basket.',
      basket: buildBasketViewFromLines_(basket, lines)
    };
  }

  if (String(line.lineType || '').trim() === 'ATTENDANCE') {
    throw new Error('Use the member remove action to remove attendance rows.');
  }

  clearBasketLineRows_([line.rowNumber]);
  const basketView = refreshBasketAfterLineRemoval_(basketId);

  return {
    basketId: basketId,
    message: 'Charge removed from basket.',
    basket: basketView
  };
}
