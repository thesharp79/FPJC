const SIGNIN_CFG = {
  spreadsheetId: getScriptPropertyRequired_('SPREADSHEET_ID'),
  membersFormUrl: getOptionalScriptProperty_('MEMBERS_FORM_URL'),
  bannerUrl: getOptionalScriptProperty_('BANNER_URL'),
  timezone: Session.getScriptTimeZone() || 'Europe/London',

  sheetNames: {
    members: 'Members',
    attendance: 'Attendance',
    paymentOptions: 'PaymentOptions',
    baskets: 'Baskets',
    basketLines: 'BasketLines',
    otherPayments: 'OtherPayments'
  },

  membersHeaders: {
    status: 'Status',
    fullName: 'Full Name',
    dob: 'Date of Birth',
    sessionName: 'Session Name',
    bjaNumber: 'British Judo Association (BJA) License number',
    ddStartDate: 'DD Start Date',
    concessionary: 'Concessionary',
    prePayRemaining: 'PrePay Remaining',
    notes: 'Notes'
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

  activeStatusValue: 'Active',
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

function getScriptPropertyRequired_(propertyName) {
  const value = PropertiesService.getScriptProperties().getProperty(propertyName);
  if (value === null || String(value).trim() === '') {
    throw new Error('Missing required Script Property: ' + propertyName);
  }
  return String(value).trim();
}

function getOptionalScriptProperty_(propertyName) {
  const value = PropertiesService.getScriptProperties().getProperty(propertyName);
  return value === null ? '' : String(value).trim();
}

function doGet(e) {
  const params = (e && e.parameter) ? e.parameter : {};

  const template = HtmlService.createTemplateFromFile('Index');
  template.INITIAL_ROUTE_JSON = JSON.stringify({
    returnFrom: String(params.returnFrom || '').trim(),
    basketId: String(params.basketId || '').trim()
  });
  template.MEMBERS_FORM_URL_JSON = JSON.stringify(SIGNIN_CFG.membersFormUrl || '');
  template.BANNER_URL = SIGNIN_CFG.bannerUrl || '';

  return template
    .evaluate()
    .setTitle('Judo Sign-In')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}












function addExtraToBasket(basketId, memberKey, optionCode) {
  if (!basketId || !memberKey || !optionCode) {
    throw new Error('Basket, member and payment option are required.');
  }

  const basket = getBasketRecord_(basketId);
  ensureBasketEditable_(basket);

  const member = getMemberByKey_(memberKey);
  const option = getPaymentOptionByCode_(optionCode, basket.sessionDateIso, 'DESK', member.sessionName);

  if (option.chargeType === 'SESSION') {
    throw new Error('Session payment rows are added automatically from the member session.');
  }

  if (!isFiniteNumber_(option.amount) || option.amount <= 0) {
    throw new Error('Payment option "' + option.code + '" needs a valid amount.');
  }

  const existingLines = getBasketLineRows_(basketId);
  if (basketAlreadyHasOptionForMember_(basketId, memberKey, option.code)) {
    return {
      basketId: basketId,
      message: option.label + ' is already in the basket for ' + member.initials + '.',
      basket: buildBasketViewFromLines_(basket, existingLines)
    };
  }

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

  appendBasketLines_([newLine]);

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

  const summary = updateBasketTotalsFromLines_(basket.rowNumber, combinedLines);
  basket.status = summary.status;

  return {
    basketId: basketId,
    message: option.label + ' added for ' + member.initials + '.',
    basket: buildBasketViewFromLines_(basket, combinedLines)
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








function appendBasketLine_(record) {
  const sheet = getBasketLinesSheet_();
  appendSheetRowByHeaders_(sheet, [
    'Basket ID',
    'Line ID',
    'Member Key',
    'BJA Licence Number',
    'Full Name',
    'Date of Birth',
    'Session Date',
    'Session Name',
    'Line Type',
    'Payment Category',
    'Description',
    'Amount',
    'Payment Required',
    'Paid',
    'Payment Method',
    'Payment Option Code',
    'Square Variation ID',
    'Attendance Row Ref',
    'Posted At',
    'Notes'
  ], {
    'Basket ID': record.basketId,
    'Line ID': record.lineId,
    'Member Key': record.memberKey,
    'BJA Licence Number': record.bjaNumber || '',
    'Full Name': record.fullName,
    'Date of Birth': record.dob ? new Date(record.dob + 'T00:00:00') : '',
    'Session Date': record.sessionDate ? new Date(record.sessionDate + 'T00:00:00') : '',
    'Session Name': record.sessionName || '',
    'Line Type': record.lineType,
    'Payment Category': record.paymentCategory || '',
    'Description': record.description || '',
    'Amount': record.amount === '' ? '' : roundMoney_(record.amount),
    'Payment Required': record.paymentRequired === true,
    'Paid': record.paid === true,
    'Payment Method': record.paymentMethod || '',
    'Payment Option Code': record.paymentOptionCode || '',
    'Square Variation ID': record.squareVariationId || '',
    'Attendance Row Ref': record.attendanceRowRef || '',
    'Posted At': record.postedAt || '',
    'Notes': record.notes || ''
  });
}









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

function getSessionPaymentOption_(sessionName, sessionDateIso, channel) {
  const options = getAvailablePaymentOptions_(sessionDateIso, channel, sessionName, ['SESSION']);
  if (!options.length) {
    throw new Error('No active SESSION payment option is configured for ' + sessionName + ' on ' + sessionDateIso + '. Add one in PaymentOptions before using the basket flow.');
  }
  return options[0];
}

function getPaymentOptionByCode_(optionCode, sessionDateIso, channel, sessionName) {
  const options = loadPaymentOptions_();
  const target = normaliseText_(optionCode);

  for (let i = 0; i < options.length; i++) {
    const option = options[i];
    if (normaliseText_(option.code) !== target) continue;
    if (!option.active) continue;
    if (!isPaymentOptionInDateRange_(option, sessionDateIso)) continue;
    if (!paymentOptionAllowsChannel_(option, channel)) continue;
    if (!paymentOptionMatchesSession_(option, sessionName)) continue;
    return option;
  }

  throw new Error('Payment option "' + optionCode + '" is not active for this session.');
}

function getAvailablePaymentOptions_(sessionDateIso, channel, sessionName, allowedChargeTypes) {
  const options = loadPaymentOptions_();
  const allowSet = {};
  for (let i = 0; i < allowedChargeTypes.length; i++) {
    allowSet[allowedChargeTypes[i]] = true;
  }

  const filtered = [];
  for (let i = 0; i < options.length; i++) {
    const option = options[i];
    if (!option.active) continue;
    if (!allowSet[option.chargeType]) continue;
    if (!isPaymentOptionInDateRange_(option, sessionDateIso)) continue;
    if (!paymentOptionAllowsChannel_(option, channel)) continue;
    if (!paymentOptionMatchesSession_(option, sessionName)) continue;
    filtered.push(option);
  }

  filtered.sort(function(a, b) {
    if (a.displayOrder !== b.displayOrder) return a.displayOrder - b.displayOrder;
    return a.label.localeCompare(b.label, 'en-GB');
  });

  return filtered;
}



function isPaymentOptionInDateRange_(option, sessionDateIso) {
  if (option.startDateIso && sessionDateIso < option.startDateIso) return false;
  if (option.endDateIso && sessionDateIso > option.endDateIso) return false;
  return true;
}

function paymentOptionAllowsChannel_(option, channel) {
  return option.appAllowed === true;
}

function parseSessionFilterValues_(value) {
  const text = String(value || '').trim();
  if (!text) return [];

  return text
    .split(/[,\n;|]/)
    .map(function(part) {
      return normaliseText_(part);
    })
    .filter(function(part) {
      return part !== '';
    });
}

function paymentOptionMatchesSession_(option, sessionName) {
  const allowedSessions = parseSessionFilterValues_(option.sessionFilter);

  // Blank filter means the option applies to all sessions
  if (!allowedSessions.length) return true;

  const target = normaliseText_(sessionName);
  if (!target) return false;

  return allowedSessions.indexOf(target) !== -1;
}



function getMemberByKey_(memberKey) {
  const membersByKey = getMembersByKey_();
  const member = membersByKey[memberKey];
  if (!member) throw new Error('Member was not found.');
  return member;
}





function describeMemberPayment_(member) {
  if (member.concessionary === true) {
    return {
      paymentRequired: false,
      intendedPayment: 'Concessionary',
      prePayRemaining: '',
      usesPrePay: false,
      shortLabel: 'Concessionary'
    };
  }

  const prePayRemaining = Number(member.prePayRemaining || 0);
  if (prePayRemaining > 0) {
    return {
      paymentRequired: false,
      intendedPayment: 'PrePaid',
      prePayRemaining: prePayRemaining,
      usesPrePay: true,
      shortLabel: 'PrePay Remaining: ' + prePayRemaining
    };
  }

  if (hasMeaningfulValue_(member.ddStartDate)) {
    return {
      paymentRequired: false,
      intendedPayment: 'Direct Debit',
      prePayRemaining: '',
      usesPrePay: false,
      shortLabel: 'Direct Debit'
    };
  }

  return {
    paymentRequired: true,
    intendedPayment: '',
    prePayRemaining: '',
    usesPrePay: false,
    shortLabel: 'Payment Required'
  };
}























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

function buildMemberKey_(member) {
  const bja = normaliseBjaNumber_(member.bjaNumber);
  if (bja) return 'bja:' + bja;

  const fullName = normaliseName_(member.fullName);
  const dobIso = normaliseSheetDateToIso_(member.dobIso || member.dobRaw || member.dob);
  if (fullName && dobIso) {
    return 'name_dob:' + fullName + '|' + dobIso;
  }

  if (member.rowNumber) {
    return 'row:' + String(member.rowNumber);
  }

  throw new Error('Member "' + (member.fullName || '(blank)') + '" cannot be keyed because it has no BJA number and no usable fallback.');
}

function normaliseBjaNumber_(value) {
  const v = String(value || '').trim();
  if (!v) return '';
  const lowered = v.toLowerCase();
  if (lowered === 'non' || lowered === 'none' || lowered === 'n/a') return '';
  return v.replace(/\s+/g, '').toUpperCase();
}

function normaliseName_(value) {
  return String(value || '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

function normaliseText_(value) {
  return String(value || '').trim().toLowerCase();
}

function normaliseSheetDateToIso_(value) {
  if (!value) return '';

  if (Object.prototype.toString.call(value) === '[object Date]' && !isNaN(value)) {
    return Utilities.formatDate(value, SIGNIN_CFG.timezone, 'yyyy-MM-dd');
  }

  const text = String(value).trim();
  if (!text) return '';

  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    return text;
  }

  const uk = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (uk) {
    const d = Number(uk[1]);
    const m = Number(uk[2]);
    const y = Number(uk[3]);
    const dt = new Date(y, m - 1, d);
    if (!isNaN(dt)) {
      return Utilities.formatDate(dt, SIGNIN_CFG.timezone, 'yyyy-MM-dd');
    }
  }

  const parsed = new Date(text);
  if (!isNaN(parsed)) {
    return Utilities.formatDate(parsed, SIGNIN_CFG.timezone, 'yyyy-MM-dd');
  }

  return '';
}

function assertIsoDate_(value, label) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || '').trim())) {
    throw new Error(label + ' is required.');
  }
}

function toInitials_(fullName) {
  const parts = String(fullName || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '';
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase() + '.';
  return parts.slice(0, 2).map(function(p) {
    return p.charAt(0).toUpperCase() + '.';
  }).join('');
}

function disambiguateDuplicateInitials_(items) {
  const counts = {};
  for (let i = 0; i < items.length; i++) {
    counts[items[i].initials] = (counts[items[i].initials] || 0) + 1;
  }

  const running = {};
  const output = [];
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (counts[item.initials] === 1) {
      output.push(item);
      continue;
    }

    running[item.initials] = (running[item.initials] || 0) + 1;
    const clone = {};
    for (const key in item) clone[key] = item[key];
    clone.initials = item.initials + ' ' + running[item.initials];
    output.push(clone);
  }
  return output;
}

function asBoolean_(value) {
  if (value === true) return true;
  if (value === false) return false;
  const text = String(value || '').trim().toLowerCase();
  return text === 'true' || text === 'yes' || text === 'y' || text === '1';
}

function normaliseWholeNumber_(value) {
  if (value === '' || value === null || typeof value === 'undefined') return 0;
  const num = Number(value);
  return isNaN(num) ? 0 : Math.round(num);
}

function normaliseMoneyValue_(value) {
  if (value === '' || value === null || typeof value === 'undefined') return '';
  const num = Number(value);
  return isNaN(num) ? '' : roundMoney_(num);
}

function roundMoney_(value) {
  return Math.round(Number(value || 0) * 100) / 100;
}

function isFiniteNumber_(value) {
  return typeof value === 'number' && isFinite(value);
}

function formatCurrency_(value) {
  const amount = Number(value || 0);
  return '£' + amount.toFixed(2);
}

function newBasketId_() {
  return 'BASK-' + Utilities.getUuid().slice(0, 8).toUpperCase();
}

function newLineId_() {
  return 'LINE-' + Utilities.getUuid().slice(0, 8).toUpperCase();
}

function isDeskSettlementMethod_(value) {
  return value === SIGNIN_CFG.paymentMethods.desk ||
         value === SIGNIN_CFG.paymentMethods.card ||
         value === SIGNIN_CFG.paymentMethods.cash ||
         value === SIGNIN_CFG.paymentMethods.bankTransfer;
}

function toTitleCaseLabel_(value) {
  switch (value) {
    case SIGNIN_CFG.paymentMethods.app: return 'app payment';
    case SIGNIN_CFG.paymentMethods.desk: return 'pay at desk';
    case SIGNIN_CFG.paymentMethods.card: return 'card';
    case SIGNIN_CFG.paymentMethods.cash: return 'cash';
    case SIGNIN_CFG.paymentMethods.bankTransfer: return 'bank transfer';
    case SIGNIN_CFG.paymentMethods.free: return 'no charge';
    default: return String(value || '').toLowerCase();
  }
}

function toAttendancePaymentLabel_(paymentMethod) {
  switch (paymentMethod) {
    case SIGNIN_CFG.paymentMethods.app: return 'App Payment';
    case SIGNIN_CFG.paymentMethods.desk: return 'Desk Payment';
    case SIGNIN_CFG.paymentMethods.card: return 'Card';
    case SIGNIN_CFG.paymentMethods.cash: return 'Cash';
    case SIGNIN_CFG.paymentMethods.bankTransfer: return 'Bank transfer';
    default: return '';
  }
}

function attendanceIntendedPaymentToBasketMethod_(value) {
  switch (String(value || '').trim().toLowerCase()) {
    case 'direct debit': return 'DIRECT_DEBIT';
    case 'prepaid':
    case 'pre-paid': return 'PREPAY';
    case 'concessionary': return 'CONCESSION';
    case 'free': return 'FREE';
    case 'app payment': return 'APP';
    case 'desk payment':
    case 'pay at desk': return 'DESK';
    case 'card': return 'CARD';
    case 'cash': return 'CASH';
    case 'bank transfer': return 'BANK_TRANSFER';
    default: return '';
  }
}


/* ==============================\
   Stage 1 performance patch
   - request-scoped spreadsheet/sheet caches
   - cached Members / PaymentOptions
   - cached Attendance signed-in index
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



function loadMembers_() {
  if (SIGNIN_RUNTIME_CACHE_.members) return SIGNIN_RUNTIME_CACHE_.members;

  const cache = CacheService.getScriptCache();
  try {
    const cached = cache.get('signin_members_v2');
    if (cached) {
      const parsed = JSON.parse(cached);
      SIGNIN_RUNTIME_CACHE_.members = parsed;
      return parsed;
    }
  } catch (e) {}

  const sheet = getMembersSheet_();
  const payload = getSheetPayload_(sheet);
  if (payload.values.length < 2) return [];

  const idx = payload.headerMap;
  const members = [];

  for (let r = 1; r < payload.values.length; r++) {
    const row = payload.values[r];
    const fullName = String(row[requireHeader_(idx, SIGNIN_CFG.membersHeaders.fullName)] || '').trim();
    if (!fullName) continue;

    const member = {
      rowNumber: r + 1,
      status: String(row[requireHeader_(idx, SIGNIN_CFG.membersHeaders.status)] || '').trim(),
      fullName: fullName,
      dobRaw: row[requireHeader_(idx, SIGNIN_CFG.membersHeaders.dob)],
      dobIso: normaliseSheetDateToIso_(row[requireHeader_(idx, SIGNIN_CFG.membersHeaders.dob)]),
      sessionName: String(row[requireHeader_(idx, SIGNIN_CFG.membersHeaders.sessionName)] || '').trim(),
      bjaNumber: String(row[requireHeader_(idx, SIGNIN_CFG.membersHeaders.bjaNumber)] || '').trim(),
      ddStartDate: row[requireHeader_(idx, SIGNIN_CFG.membersHeaders.ddStartDate)],
      concessionary: asBoolean_(row[requireHeader_(idx, SIGNIN_CFG.membersHeaders.concessionary)]),
      prePayRemaining: normaliseWholeNumber_(row[requireHeader_(idx, SIGNIN_CFG.membersHeaders.prePayRemaining)]),
      notes: String(row[requireHeader_(idx, SIGNIN_CFG.membersHeaders.notes)] || '').trim()
    };

    member.memberKey = buildMemberKey_(member);
    member.initials = toInitials_(member.fullName);
    members.push(member);
  }

  SIGNIN_RUNTIME_CACHE_.members = members;
  try {
    cache.put('signin_members_v2', JSON.stringify(members), 120);
  } catch (e) {}
  return members;
}

function getMembersByKey_() {
  if (SIGNIN_RUNTIME_CACHE_.membersByKey) return SIGNIN_RUNTIME_CACHE_.membersByKey;
  const members = loadMembers_();
  const map = {};
  for (let i = 0; i < members.length; i++) {
    map[members[i].memberKey] = members[i];
  }
  SIGNIN_RUNTIME_CACHE_.membersByKey = map;
  return map;
}

function getMemberByRow_(rowNumber) {
  if (!SIGNIN_RUNTIME_CACHE_.membersByRow) {
    const members = loadMembers_();
    const map = {};
    for (let i = 0; i < members.length; i++) {
      map[members[i].rowNumber] = members[i];
    }
    SIGNIN_RUNTIME_CACHE_.membersByRow = map;
  }
  const member = SIGNIN_RUNTIME_CACHE_.membersByRow[Number(rowNumber)];
  if (!member) throw new Error('Selected member was not found.');
  return member;
}

function loadPaymentOptions_() {
  if (SIGNIN_RUNTIME_CACHE_.paymentOptions) return SIGNIN_RUNTIME_CACHE_.paymentOptions;

  const cache = CacheService.getScriptCache();
  try {
    const cached = cache.get('signin_payment_options_v2');
    if (cached) {
      const parsed = JSON.parse(cached);
      SIGNIN_RUNTIME_CACHE_.paymentOptions = parsed;
      return parsed;
    }
  } catch (e) {}

  const sheet = getPaymentOptionsSheet_();
  const payload = getSheetPayload_(sheet);
  if (payload.values.length < 2) return [];

  const idx = payload.headerMap;
  const options = [];

  for (let r = 1; r < payload.values.length; r++) {
    const row = payload.values[r];
    const code = String(row[requireHeader_(idx, SIGNIN_CFG.paymentOptionHeaders.code)] || '').trim();
    const label = String(row[requireHeader_(idx, SIGNIN_CFG.paymentOptionHeaders.label)] || '').trim();
    const chargeType = String(row[requireHeader_(idx, SIGNIN_CFG.paymentOptionHeaders.chargeType)] || '').trim().toUpperCase();

    if (!code || !label || !chargeType) continue;

    options.push({
      rowNumber: r + 1,
      active: asBoolean_(row[requireHeader_(idx, SIGNIN_CFG.paymentOptionHeaders.active)]),
      code: code,
      label: label,
      chargeType: chargeType,
      amount: normaliseMoneyValue_(row[requireHeader_(idx, SIGNIN_CFG.paymentOptionHeaders.amount)]),
      squareVariationId: String(row[requireHeader_(idx, SIGNIN_CFG.paymentOptionHeaders.squareVariationId)] || '').trim(),
      sessionFilter: String(row[requireHeader_(idx, SIGNIN_CFG.paymentOptionHeaders.sessionFilter)] || '').trim(),
      startDateIso: normaliseSheetDateToIso_(row[requireHeader_(idx, SIGNIN_CFG.paymentOptionHeaders.startDate)]),
      endDateIso: normaliseSheetDateToIso_(row[requireHeader_(idx, SIGNIN_CFG.paymentOptionHeaders.endDate)]),
      appAllowed: asBoolean_(row[requireHeader_(idx, SIGNIN_CFG.paymentOptionHeaders.appAllowed)]),
      displayOrder: normaliseWholeNumber_(row[requireHeader_(idx, SIGNIN_CFG.paymentOptionHeaders.displayOrder)]),
      notes: String(row[requireHeader_(idx, SIGNIN_CFG.paymentOptionHeaders.notes)] || '').trim()
    });
  }

  SIGNIN_RUNTIME_CACHE_.paymentOptions = options;
  try {
    cache.put('signin_payment_options_v2', JSON.stringify(options), 120);
  } catch (e) {}
  return options;
}

function setMemberPrePayRemaining_(memberKey, newValue) {
  const member = getMemberByKey_(memberKey);
  if (!member) throw new Error('Could not update PrePay Remaining for member.');

  const sheet = getMembersSheet_();
  const meta = getHeaderMeta_(sheet);
  const idx = meta.headerMap;
  const prePayCol = requireHeader_(idx, SIGNIN_CFG.membersHeaders.prePayRemaining);
  sheet.getRange(member.rowNumber, prePayCol + 1).setValue(Number(newValue || 0));

  invalidateSheetRuntimeCache_(sheet);
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





/* ==============================\
   Stage 1 speed + profiling patch v3
   - uses the faster in-memory add-member path
   - date-scoped attendance duplicate cache
   - row-batch basket updates
   - log-only profiling
\============================== */

const DEBUG_PERF = false;
const PERF_ENABLED = DEBUG_PERF;
const AUTO_CANCEL_STALE_BUILDING_BASKETS = true;
const STALE_BUILDING_BASKET_HOURS = 12;
const STALE_BASKET_CLEANUP_BATCH_LIMIT = 25;
const STALE_BASKET_CLEANUP_THROTTLE_SECONDS = 900;

var SIGNIN_PERF_RUNTIME_ = {
  attendanceByDate: {}
};

function perfNow_() {
  return Date.now();
}

function perfLog_(scope, step, startedAt, extra) {
  if (!PERF_ENABLED) return;
  const ms = Date.now() - startedAt;
  const suffix = extra ? ' | ' + extra : '';
  console.log('[PERF][' + scope + '] ' + step + ': ' + ms + 'ms' + suffix);
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
  assertIsoDate_(dobIso, 'Date of birth');
  if (sessionDateIso) assertIsoDate_(sessionDateIso, 'Session date');

  const members = loadMembers_();
  const matches = [];

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

  matches.sort(function(a, b) {
    if (a.initials !== b.initials) return a.initials.localeCompare(b.initials, 'en-GB');
    return a.memberRow - b.memberRow;
  });

  if (matches.length && sessionDateIso) {
    prewarmAttendanceDateCache_(sessionDateIso);
  }

  perfLog_('findMembersByDob', 'total', t0, 'dob=' + dobIso + ' matches=' + matches.length + (sessionDateIso ? ' sessionDate=' + sessionDateIso : ''));
  return disambiguateDuplicateInitials_(matches);
}

function getBasketView(basketId) {
  const t0 = perfNow_();
  if (!basketId) return null;
  const view = buildBasketView_(basketId);
  perfLog_('getBasketView', 'total', t0, 'basketId=' + basketId + ' members=' + ((view && view.memberCount) || 0));
  return view;
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
    CacheService.getScriptCache().put(cacheKey, JSON.stringify(set), 120);
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





function putAttendanceSignedInSetForDate_(sessionDateIso, setObj) {
  SIGNIN_PERF_RUNTIME_.attendanceByDate[sessionDateIso] = setObj || {};
  try {
    CacheService.getScriptCache().put(
      'signin_attendance_date_' + sessionDateIso,
      JSON.stringify(SIGNIN_PERF_RUNTIME_.attendanceByDate[sessionDateIso]),
      120
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





/* ==============================
   Stage 1 speed + profiling patch v5
   - faster basket header lookup with cache
   - batch attendance posting in finalise
   - batch basket line updates in finalise
   - preserves profiling
\============================== */

if (!SIGNIN_PERF_RUNTIME_.basketById) {
  SIGNIN_PERF_RUNTIME_.basketById = {};
}

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



function updateMemberPrePayRemainingBatch_(updates) {
  if (!updates || !updates.length) return;

  const sheet = getMembersSheet_();
  const meta = getHeaderMeta_(sheet);
  const idx = meta.headerMap;
  const colIndex = requireHeader_(idx, SIGNIN_CFG.membersHeaders.prePayRemaining) + 1;

  for (let i = 0; i < updates.length; i++) {
    const u = updates[i];
    if (!u || !u.memberKey) continue;
    const member = getMemberByKey_(u.memberKey);
    sheet.getRange(member.rowNumber, colIndex).setValue(Number(u.newValue || 0));
  }

  invalidateSheetRuntimeCache_(sheet);
}

function finaliseBasketDesk(basketId, paymentMethod) {
  const total = perfNow_();
  if (!basketId) throw new Error('Basket is required.');

  let t = perfNow_();
  const basket = getBasketRecord_(basketId);
  perfLog_('finaliseBasketDesk', 'getBasketRecord_', t, 'basketId=' + basketId);
  ensureBasketEditable_(basket);

  t = perfNow_();
  const basketLinesSheet = getBasketLinesSheet_();
  const basketLinesPayload = getSheetPayload_(basketLinesSheet);
  const basketLinesIdx = basketLinesPayload.headerMap;
  const basketLineRows = getBasketLineRows_(basketId);
  perfLog_('finaliseBasketDesk', 'getBasketLineRows_', t, 'basketId=' + basketId + ' lines=' + basketLineRows.length);

  t = perfNow_();
  const basketView = buildBasketViewFromLines_(basket, basketLineRows);
  perfLog_('finaliseBasketDesk', 'buildBasketViewFromLines_', t, 'basketId=' + basketId + ' members=' + ((basketView && basketView.memberCount) || 0) + ' total=' + ((basketView && basketView.totalAmount) || 0));

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
  perfLog_('finaliseBasketDesk', 'prepareAttendanceSets_', t, 'attendanceLines=' + attendanceLines.length + ' uniqueDates=' + Object.keys(attendanceSetsByDate).length);

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
  perfLog_('finaliseBasketDesk', 'postAttendanceLines_', t, 'count=' + attendanceLines.length);

  t = perfNow_();
  for (const dateIso in attendanceSetsByDate) {
    if (Object.prototype.hasOwnProperty.call(attendanceSetsByDate, dateIso)) {
      putAttendanceSignedInSetForDate_(dateIso, attendanceSetsByDate[dateIso]);
    }
  }
  perfLog_('finaliseBasketDesk', 'writeAttendanceCaches_', t, 'dates=' + Object.keys(attendanceSetsByDate).length);

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
  perfLog_('finaliseBasketDesk', 'postOtherPaymentLines_', t, 'count=' + extraLines.length);

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
  perfLog_('finaliseBasketDesk', 'updateBasketRow_', t, 'basketId=' + basketId + ' method=' + paymentMethod);

  perfLog_('finaliseBasketDesk', 'total', total, 'basketId=' + basketId + ' members=' + basketView.memberCount + ' extras=' + extraLines.length);
  return {
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
}


function prewarmSession(sessionDateIso) {
  const t0 = perfNow_();
  if (sessionDateIso) assertIsoDate_(sessionDateIso, 'Session date');

  let t = perfNow_();
  const members = loadMembers_();
  perfLog_('prewarmSession', 'loadMembers_', t, 'count=' + members.length);

  t = perfNow_();
  const options = loadPaymentOptions_();
  perfLog_('prewarmSession', 'loadPaymentOptions_', t, 'count=' + options.length);

  t = perfNow_();
  try {
    getHeaderMeta_(getBasketsSheet_());
    getHeaderMeta_(getBasketLinesSheet_());
    perfLog_('prewarmSession', 'warm basket sheet meta', t, 'ok=true');
  } catch (e) {
    perfLog_('prewarmSession', 'warm basket sheet meta failed', t, 'err=' + String(e));
  }

  if (sessionDateIso) {
    t = perfNow_();
    getAttendanceSignedInSetForDate_(sessionDateIso);
    perfLog_('prewarmSession', 'warm attendance date cache', t, 'date=' + sessionDateIso);
  }

  perfLog_('prewarmSession', 'total', t0, sessionDateIso ? 'date=' + sessionDateIso : '');
  return { ok: true, sessionDate: sessionDateIso || '' };
}


/* ==============================\
   Track A hardening patch v8
   - basket line caching by basketId
   - incremental basket totals updates
   - lighter basket row updates
   - keeps profiling branch behaviour unchanged
\============================== */

if (!SIGNIN_PERF_RUNTIME_.basketLinesById) {
  SIGNIN_PERF_RUNTIME_.basketLinesById = {};
}
if (!SIGNIN_PERF_RUNTIME_.basketSummaryById) {
  SIGNIN_PERF_RUNTIME_.basketSummaryById = {};
}

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

function updateBasketTotalsFromLines_(basketRowNumber, lines) {
  const summary = buildBasketSummaryFromLines_(lines || []);
  const sheet = getBasketsSheet_();
  const meta = getHeaderMeta_(sheet);
  const idx = meta.headerMap;
  const startIdx = requireHeader_(idx, SIGNIN_CFG.basketHeaders.status);
  const endIdx = requireHeader_(idx, SIGNIN_CFG.basketHeaders.memberCount);
  const rowValues = sheet.getRange(basketRowNumber, startIdx + 1, 1, endIdx - startIdx + 1).getValues()[0];

  rowValues[idx[SIGNIN_CFG.basketHeaders.status] - startIdx] = summary.status;
  rowValues[idx[SIGNIN_CFG.basketHeaders.totalAmount] - startIdx] = summary.totalAmount;
  rowValues[idx[SIGNIN_CFG.basketHeaders.memberCount] - startIdx] = summary.memberCount;

  sheet.getRange(basketRowNumber, startIdx + 1, 1, endIdx - startIdx + 1).setValues([rowValues]);
  invalidateSheetRuntimeCache_(sheet);
  updateBasketRecordCacheByRow_(basketRowNumber, {
    Status: summary.status
  });
  return summary;
}

function addMemberToBasket(basketId, memberRow, sessionDateIso) {
  const total = perfNow_();
  if (!memberRow) throw new Error('Member selection is required.');
  assertIsoDate_(sessionDateIso, 'Session date');

  let t = perfNow_();
  const member = getMemberByRow_(memberRow);
  perfLog_('addMemberToBasket', 'getMemberByRow_', t, 'memberRow=' + memberRow + ' initials=' + member.initials);

  if (member.status !== SIGNIN_CFG.activeStatusValue) throw new Error('Selected member is not active.');
  if (!member.fullName || !member.sessionName) throw new Error('Selected member record is incomplete.');

  t = perfNow_();
  let basket = basketId ? getBasketRecord_(basketId) : null;
  perfLog_('addMemberToBasket', 'getBasketRecord_', t, 'basketId=' + (basketId || 'NEW'));

  let existingLines = [];
  if (basket) {
    ensureBasketEditable_(basket);
    if (basket.sessionDateIso && basket.sessionDateIso !== sessionDateIso) {
      throw new Error('This basket is already tied to a different session date. Cancel it and start a new basket.');
    }

    t = perfNow_();
    existingLines = getBasketLineRows_(basketId);
    perfLog_('addMemberToBasket', 'getBasketLineRows_', t, 'basketId=' + basketId + ' lines=' + existingLines.length);

    t = perfNow_();
    if (basketContainsMemberInLines_(existingLines, member.memberKey)) {
      perfLog_('addMemberToBasket', 'basketContainsMemberInLines_', t, 'already=true');
      const basketViewDup = buildBasketViewFromLines_(basket, existingLines);
      perfLog_('addMemberToBasket', 'total', total, 'basketId=' + basketId + ' member=' + member.initials + ' duplicateInBasket=true');
      return { basketId: basketId, message: member.initials + ' is already in the basket.', basket: basketViewDup };
    }
    perfLog_('addMemberToBasket', 'basketContainsMemberInLines_', t, 'already=false');
  }

  t = perfNow_();
  if (alreadySignedIn_(getAttendanceSheet_(), member.fullName, sessionDateIso)) {
    perfLog_('addMemberToBasket', 'alreadySignedIn_', t, 'already=true date=' + sessionDateIso);
    return {
      basketId: basketId || '',
      message: member.initials + ' is already signed in for ' + sessionDateIso + '.',
      basket: basket ? buildBasketViewFromLines_(basket, existingLines) : null
    };
  }
  perfLog_('addMemberToBasket', 'alreadySignedIn_', t, 'already=false date=' + sessionDateIso);

  if (!basket) {
    t = perfNow_();
    basket = createBasket_(sessionDateIso);
    basketId = basket.basketId;
    perfLog_('addMemberToBasket', 'createBasket_', t, 'basketId=' + basketId);
    existingLines = [];
  }

  t = perfNow_();
  const payment = describeMemberPayment_(member);
  perfLog_('addMemberToBasket', 'describeMemberPayment_', t, 'required=' + payment.paymentRequired + ' label=' + payment.shortLabel);

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
    perfLog_('addMemberToBasket', 'getSessionPaymentOption_', t, 'session=' + member.sessionName + ' code=' + sessionOption.code);
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
  perfLog_('addMemberToBasket', 'appendBasketLines_', t, 'basketId=' + basketId + ' rows=' + newLines.length);

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
  perfLog_('addMemberToBasket', 'updateBasketTotalsFromLines_', t, 'basketId=' + basketId + ' lines=' + combinedLines.length);

  t = perfNow_();
  const basketView = buildBasketViewFromLines_(basket, combinedLines);
  perfLog_('addMemberToBasket', 'buildBasketViewFromLines_', t, 'basketId=' + basketId + ' members=' + basketView.memberCount + ' total=' + basketView.totalAmount);

  perfLog_('addMemberToBasket', 'total', total, 'basketId=' + basketId + ' member=' + member.initials);
  return {
    basketId: basketId,
    message: member.initials + ' added to basket.',
    basket: basketView
  };
}


// ===== v9 cache-safety patch =====
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
    CacheService.getScriptCache().put('signin_attendance_date_' + sessionDateIso, JSON.stringify(set), 120);
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


// ===== v11 patch: robust basket-line removal and safer batch updates =====
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


/* ==============================
   Stage 1 housekeeping patch v12
   - profiling gated behind DEBUG_PERF
   - stale BUILDING basket cleanup
   - admin cache reset helpers
\============================== */

function maybeAutoCancelStaleBaskets_() {
  if (!AUTO_CANCEL_STALE_BUILDING_BASKETS) return { ran: false, reason: 'disabled', cancelled: 0 };
  try {
    const cache = CacheService.getScriptCache();
    const throttleKey = 'signin_stale_cleanup_throttle_v1';
    if (cache.get(throttleKey)) {
      return { ran: false, reason: 'throttled', cancelled: 0 };
    }
    const cancelled = cancelStaleBuildingBaskets_(STALE_BUILDING_BASKET_HOURS, STALE_BASKET_CLEANUP_BATCH_LIMIT);
    cache.put(throttleKey, '1', STALE_BASKET_CLEANUP_THROTTLE_SECONDS);
    return { ran: true, reason: 'ok', cancelled: cancelled };
  } catch (e) {
    return { ran: false, reason: 'error', cancelled: 0, error: String(e) };
  }
}

function cancelStaleBuildingBaskets_(hoursOld, limit) {
  const maxAgeHours = Math.max(Number(hoursOld) || STALE_BUILDING_BASKET_HOURS, 1);
  const batchLimit = Math.max(Number(limit) || STALE_BASKET_CLEANUP_BATCH_LIMIT, 1);
  const cutoffMs = Date.now() - (maxAgeHours * 60 * 60 * 1000);

  const sheet = getBasketsSheet_();
  const payload = getSheetPayload_(sheet, true);
  const idx = payload.headerMap;
  const basketIdIdx = requireHeader_(idx, SIGNIN_CFG.basketHeaders.basketId);
  const createdIdx = requireHeader_(idx, SIGNIN_CFG.basketHeaders.createdAt);
  const statusIdx = requireHeader_(idx, SIGNIN_CFG.basketHeaders.status);
  const notesIdx = requireHeader_(idx, SIGNIN_CFG.basketHeaders.notes);

  let cancelled = 0;
  for (let r = 1; r < payload.values.length; r++) {
    if (cancelled >= batchLimit) break;

    const row = payload.values[r];
    const basketId = String(row[basketIdIdx] || '').trim();
    const status = String(row[statusIdx] || '').trim();
    if (!basketId || status !== SIGNIN_CFG.basketStatuses.building) continue;

    const createdAt = row[createdIdx];
    const createdMs = createdAt instanceof Date ? createdAt.getTime() : new Date(createdAt).getTime();
    if (!createdMs || isNaN(createdMs) || createdMs > cutoffMs) continue;

    const existingNotes = String(row[notesIdx] || '').trim();
    const stamp = Utilities.formatDate(new Date(), SIGNIN_CFG.timezone, 'dd/MM/yyyy HH:mm:ss');
    const cleanupNote = 'Auto-cancelled stale BUILDING basket at ' + stamp;
    const mergedNotes = existingNotes ? (existingNotes + ' | ' + cleanupNote) : cleanupNote;

    updateBasketRow_(r + 1, {
      'Status': SIGNIN_CFG.basketStatuses.cancelled,
      'Notes': mergedNotes
    });
    clearBasketRecordCache_(basketId);
    invalidateBasketLinesCache_(basketId);
    cancelled++;
  }
  return cancelled;
}

function adminCancelStaleBuildingBaskets(hoursOld, limit) {
  const cancelled = cancelStaleBuildingBaskets_(hoursOld, limit);
  return {
    ok: true,
    cancelled: cancelled,
    hoursOld: Math.max(Number(hoursOld) || STALE_BUILDING_BASKET_HOURS, 1)
  };
}

function adminClearSignInCaches(sessionDateIso, basketId) {
  const dateIso = sessionDateIso || Utilities.formatDate(new Date(), SIGNIN_CFG.timezone, 'yyyy-MM-dd');

  if (SIGNIN_RUNTIME_CACHE_) {
    SIGNIN_RUNTIME_CACHE_.sheetPayloads = {};
    SIGNIN_RUNTIME_CACHE_.sheetHeaders = {};
    SIGNIN_RUNTIME_CACHE_.members = null;
    SIGNIN_RUNTIME_CACHE_.membersByKey = null;
    SIGNIN_RUNTIME_CACHE_.membersByRow = null;
    SIGNIN_RUNTIME_CACHE_.paymentOptions = null;
    SIGNIN_RUNTIME_CACHE_.attendanceSignedInSet = null;
  }

  if (SIGNIN_PERF_RUNTIME_) {
    SIGNIN_PERF_RUNTIME_.attendanceByDate = {};
    SIGNIN_PERF_RUNTIME_.basketById = {};
    SIGNIN_PERF_RUNTIME_.basketLinesById = {};
    SIGNIN_PERF_RUNTIME_.basketSummaryById = {};
  }

  invalidateAttendanceDateCache_(dateIso);

  if (basketId) {
    clearBasketRecordCache_(basketId);
    invalidateBasketLinesCache_(basketId);
  }

  try {
    const cache = CacheService.getScriptCache();
    cache.remove('signin_members_v2');
    cache.remove('signin_payment_options_v2');
    cache.remove('signin_attendance_date_' + dateIso);
    if (basketId) {
      cache.remove(getBasketRecordCacheKey_(basketId));
      cache.remove(getBasketLinesCacheKey_(basketId));
      cache.remove(getBasketSummaryCacheKey_(basketId));
    }
  } catch (e) {}

  return {
    ok: true,
    clearedDateCache: dateIso,
    clearedBasketId: basketId || '',
    message: 'Sign-in caches cleared.'
  };
}

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

function getInitialState() {
  maybeAutoCancelStaleBaskets_();
  return {
    today: Utilities.formatDate(new Date(), SIGNIN_CFG.timezone, 'yyyy-MM-dd')
  };
}

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

function resolveBasketPaymentCard(basketId) {
  return resolveBasketPayment(
    basketId,
    SIGNIN_CFG.paymentMethods.card,
    ''
  );
}

