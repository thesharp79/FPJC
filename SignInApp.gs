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
