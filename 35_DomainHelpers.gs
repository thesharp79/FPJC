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
