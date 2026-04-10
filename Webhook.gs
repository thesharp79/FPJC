function doPost(e) {
  try {
    const params = e && e.parameter ? e.parameter : {};
    const token = String(params.token || '').trim();

    const expected = String(
      PropertiesService.getScriptProperties().getProperty('WEBHOOK_TOKEN') || ''
    ).trim();

    if (!expected || token !== expected) {
      return jsonOutput_({ ok: false, error: 'Unauthorised' });
    }

    const raw = (e && e.postData && e.postData.contents) ? e.postData.contents : '';
    if (!raw) {
      return jsonOutput_({ ok: false, error: 'Empty body' });
    }

    const event = JSON.parse(raw);
    const result = handleSquareWebhookEvent_(event);

    return jsonOutput_({ ok: true, result: result || {} });
  } catch (err) {
    return jsonOutput_({
      ok: false,
      error: String(err && err.message ? err.message : err)
    });
  }
}

function jsonOutput_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function handleSquareWebhookEvent_(event) {
  if (!event) return { ignored: true, reason: 'no event' };

  const eventType = String(event.type || '').trim();
  if (eventType !== 'payment.updated') {
    return { ignored: true, reason: 'unsupported event type', eventType: eventType };
  }

  const payment = (((event.data || {}).object || {}).payment) || {};
  const paymentStatus = String(payment.status || '').trim().toUpperCase();
  const orderId = String(payment.order_id || '').trim();
  const paymentId = String(payment.id || '').trim();

  if (!orderId) {
    return { ignored: true, reason: 'missing order id' };
  }

  if (paymentStatus !== 'COMPLETED') {
    return { ignored: true, reason: 'payment not completed', paymentStatus: paymentStatus };
  }

  const basket = getBasketBySquareOrderId_(orderId);
  if (!basket) {
    return { ignored: true, reason: 'basket not found for order', orderId: orderId };
  }

  const result = resolveBasketPaymentApp(basket.basketId, paymentId);

  return {
    resolved: true,
    basketId: basket.basketId,
    orderId: orderId,
    paymentId: paymentId,
    result: result
  };
}

function getBasketBySquareOrderId_(orderId) {
  if (!orderId) return null;

  const sheet = getBasketsSheet_();
  const payload = getSheetPayload_(sheet);
  const idx = payload.headerMap;

  const basketIdCol = requireHeader_(idx, SIGNIN_CFG.basketHeaders.basketId);
  const orderIdCol = requireHeader_(idx, SIGNIN_CFG.basketHeaders.squareOrderId);
  const sessionDateCol = requireHeader_(idx, SIGNIN_CFG.basketHeaders.sessionDate);
  const statusCol = requireHeader_(idx, SIGNIN_CFG.basketHeaders.status);

  for (let r = 1; r < payload.values.length; r++) {
    const row = payload.values[r];
    if (String(row[orderIdCol] || '').trim() !== orderId) continue;

    return {
      rowNumber: r + 1,
      basketId: String(row[basketIdCol] || '').trim(),
      sessionDateIso: normaliseSheetDateToIso_(row[sessionDateCol]),
      status: String(row[statusCol] || '').trim()
    };
  }

  return null;
}
