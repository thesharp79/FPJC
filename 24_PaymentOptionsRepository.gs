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
