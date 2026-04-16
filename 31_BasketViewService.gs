function getBasketView(basketId) {
  const t0 = perfNow_();
  if (!basketId) return null;
  const view = buildBasketView_(basketId);
  perfLog_('getBasketView', 'total', t0, 'basketId=' + basketId + ' members=' + ((view && view.memberCount) || 0));
  return view;
}

function buildBasketView_(basketId) {
  const t0 = perfNow_();
  const basket = getBasketRecord_(basketId);
  if (!basket) return null;
  const lines = getBasketLineRows_(basketId);
  perfLog_('buildBasketView', 'load basket + lines', t0, 'basketId=' + basketId + ' lines=' + lines.length);

  const t1 = perfNow_();
  const view = buildBasketViewFromLines_(basket, lines);
  perfLog_('buildBasketView', 'from lines', t1, 'basketId=' + basketId + ' members=' + ((view && view.memberCount) || 0));
  perfLog_('buildBasketView', 'total', t0, 'basketId=' + basketId);
  return view;
}

function buildBasketViewFromLines_(basket, lines) {
  if (!basket) return null;

  const membersByKey = getMembersByKey_();
  const memberMap = {};
  const memberList = [];
  const extrasBySession = {};
  let totalAmount = 0;
  let hasChargeLines = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!memberMap[line.memberKey]) {
      const member = membersByKey[line.memberKey] || null;
      const payment = member ? describeMemberPayment_(member) : { shortLabel: '' };

      memberMap[line.memberKey] = {
        memberKey: line.memberKey,
        initials: toInitials_(line.fullName),
        sessionName: line.sessionName,
        paymentStatusLabel: payment.shortLabel || '',
        lines: [],
        availableExtras: []
      };
      memberList.push(memberMap[line.memberKey]);
    }

    if (line.lineType !== 'ATTENDANCE') {
      memberMap[line.memberKey].lines.push({
        lineId: line.lineId,
        lineType: line.lineType,
        description: line.description,
        amount: line.amount,
        formattedAmount: formatCurrency_(line.amount),
        paymentOptionCode: line.paymentOptionCode
      });

      if (isFiniteNumber_(line.amount)) {
        totalAmount += Number(line.amount);
      }
      hasChargeLines = true;
    }
  }

  for (let i = 0; i < memberList.length; i++) {
    const entry = memberList[i];
    const member = membersByKey[entry.memberKey];
    if (!member) continue;

    const sessionKey = normaliseText_(member.sessionName);
    if (!extrasBySession[sessionKey]) {
      extrasBySession[sessionKey] = getAvailablePaymentOptions_(basket.sessionDateIso, 'DESK', member.sessionName, ['GRADING', 'COMPETITION', 'OTHER']);
    }

    const chosenCodes = {};
    for (let j = 0; j < entry.lines.length; j++) {
      const line = entry.lines[j];
      if (line.paymentOptionCode) chosenCodes[line.paymentOptionCode] = true;
    }

    const extras = [];
    const available = extrasBySession[sessionKey];
    for (let j = 0; j < available.length; j++) {
      if (chosenCodes[available[j].code]) continue;
      extras.push({
        code: available[j].code,
        label: available[j].label,
        chargeType: available[j].chargeType,
        amount: available[j].amount,
        formattedAmount: formatCurrency_(available[j].amount)
      });
    }
    entry.availableExtras = extras;
  }

  memberList.sort(function(a, b) {
    return a.initials.localeCompare(b.initials, 'en-GB');
  });

  return {
    basketId: basket.basketId,
    sessionDate: basket.sessionDateIso,
    status: basket.status,
    memberCount: memberList.length,
    totalAmount: roundMoney_(totalAmount),
    formattedTotal: formatCurrency_(totalAmount),
    hasChargeLines: hasChargeLines,
    members: memberList
  };
}
