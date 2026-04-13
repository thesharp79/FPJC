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

function perfNow_() {
  return Date.now();
}

function perfLog_(scope, step, startedAt, extra) {
  if (!PERF_ENABLED) return;
  const ms = Date.now() - startedAt;
  const suffix = extra ? ' | ' + extra : '';
  console.log('[PERF][' + scope + '] ' + step + ': ' + ms + 'ms' + suffix);
}



/* ==============================
   Stage 1 speed + profiling patch v5
   - faster basket header lookup with cache
   - batch attendance posting in finalise
   - batch basket line updates in finalise
   - preserves profiling
\============================== */



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


// ===== v9 cache-safety patch =====
// ===== v11 patch: robust basket-line removal and safer batch updates =====



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

function getInitialState() {
  maybeAutoCancelStaleBaskets_();
  return {
    today: Utilities.formatDate(new Date(), SIGNIN_CFG.timezone, 'yyyy-MM-dd')
  };
}
