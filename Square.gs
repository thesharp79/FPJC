function getSquareConfig_() {
  const props = PropertiesService.getScriptProperties();

  const cfg = {
    env: String(props.getProperty('APP_ENV') || '').trim(),
    baseUrl: String(props.getProperty('SQUARE_BASE_URL') || '').trim(),
    applicationId: String(props.getProperty('SQUARE_APPLICATION_ID') || '').trim(),
    accessToken: String(props.getProperty('SQUARE_ACCESS_TOKEN') || '').trim(),
    locationId: String(props.getProperty('SQUARE_LOCATION_ID') || '').trim(),
    version: String(props.getProperty('SQUARE_VERSION') || '').trim(),
    currency: String(props.getProperty('SQUARE_CURRENCY') || 'GBP').trim(),
    syncRootCategoryId: String(props.getProperty('SQUARE_SYNC_ROOT_CATEGORY_ID') || '').trim(),
    syncRootCategoryName: String(props.getProperty('SQUARE_SYNC_ROOT_CATEGORY_NAME') || '').trim()
  };

  const missing = [];
  if (!cfg.env) missing.push('APP_ENV');
  if (!cfg.baseUrl) missing.push('SQUARE_BASE_URL');
  if (!cfg.applicationId) missing.push('SQUARE_APPLICATION_ID');
  if (!cfg.accessToken) missing.push('SQUARE_ACCESS_TOKEN');
  if (!cfg.locationId) missing.push('SQUARE_LOCATION_ID');
  if (!cfg.version) missing.push('SQUARE_VERSION');
  if (!cfg.currency) missing.push('SQUARE_CURRENCY');

  if (missing.length) {
    throw new Error('Missing Script Properties: ' + missing.join(', '));
  }

  return cfg;
}

function squareRequest_(path, method, body) {
  const cfg = getSquareConfig_();

  const options = {
    method: method || 'get',
    muteHttpExceptions: true,
    headers: {
      Authorization: 'Bearer ' + cfg.accessToken,
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'Square-Version': cfg.version
    }
  };

  if (body !== undefined && body !== null) {
    options.payload = JSON.stringify(body);
  }

  const url = cfg.baseUrl + path;
  const response = UrlFetchApp.fetch(url, options);
  const status = response.getResponseCode();
  const text = response.getContentText();

  let parsed;
  try {
    parsed = text ? JSON.parse(text) : {};
  } catch (err) {
    parsed = { raw: text };
  }

  if (status < 200 || status >= 300) {
    throw new Error(
      'Square API error ' + status + ' for ' + path + ': ' +
      JSON.stringify(parsed, null, 2)
    );
  }

  return parsed;
}

function testSquareConnection() {
  const result = squareRequest_('/locations', 'get');

  Logger.log(JSON.stringify(result, null, 2));

  return {
    ok: true,
    locationCount: Array.isArray(result.locations) ? result.locations.length : 0,
    locations: (result.locations || []).map(function(loc) {
      return {
        id: loc.id,
        name: loc.name,
        status: loc.status,
        country: loc.country
      };
    })
  };
}

function createQuickPayLink_(name, amountPence, note) {
  const cfg = getSquareConfig_();

  if (!name) throw new Error('Payment name is required.');
  if (!Number.isFinite(amountPence) || amountPence <= 0) {
    throw new Error('Amount must be a positive integer in pence.');
  }

  const body = {
    idempotency_key: Utilities.getUuid(),
    quick_pay: {
      name: name,
      price_money: {
        amount: Math.round(amountPence),
        currency: cfg.currency
      },
      location_id: cfg.locationId
    }
  };

  if (note) {
    body.note = note;
  }

  const result = squareRequest_('/online-checkout/payment-links', 'post', body);
  const paymentLink = result.payment_link || {};

  Logger.log(JSON.stringify(result, null, 2));

  return {
    ok: true,
    paymentLinkId: paymentLink.id || '',
    paymentLinkUrl: paymentLink.url || '',
    orderId: paymentLink.order_id || '',
    raw: result
  };
}

function testCreateQuickPayLink() {
  const output = createQuickPayLink_(
    'FPJC DEV test payment',
    500,
    'DEV smoke test from Apps Script'
  );

  Logger.log(JSON.stringify(output, null, 2));
  console.log(JSON.stringify(output, null, 2));

  return output;
}

function buildSquareCommercialLabel_(itemName, variationName) {
  const item = String(itemName || '').trim();
  const variation = String(variationName || '').trim();

  if (!variation || variation.toLowerCase() === 'regular') {
    return item;
  }

  if (!item) return variation;
  return item + ' - ' + variation;
}

function inferChargeTypeFromCode_(code) {
  const normalised = String(code || '').trim().toUpperCase();

  if (normalised.indexOf('SESSION_') === 0) return 'SESSION';
  if (normalised.indexOf('GRADING_') === 0) return 'GRADING';
  if (normalised.indexOf('COMPETITION_') === 0) return 'COMPETITION';
  if (normalised.indexOf('OTHER_') === 0) return 'OTHER';

  return '';
}

function isSquareVariationSellableAtLocation_(catalogObject, locationId) {
  if (!catalogObject || !locationId) return false;
  if (catalogObject.is_deleted === true) return false;

  const presentAtAllLocations = catalogObject.present_at_all_locations !== false;
  const presentAtLocationIds = catalogObject.present_at_location_ids || [];
  const absentAtLocationIds = catalogObject.absent_at_location_ids || [];

  if (absentAtLocationIds.indexOf(locationId) !== -1) {
    return false;
  }

  if (presentAtAllLocations) {
    return true;
  }

  if (presentAtLocationIds.length > 0) {
    return presentAtLocationIds.indexOf(locationId) !== -1;
  }

  return false;
}

function getSquareSyncRootCategoryId_() {
  return String(
    PropertiesService.getScriptProperties().getProperty('SQUARE_SYNC_ROOT_CATEGORY_ID') || ''
  ).trim();
}

function getSquareSyncRootCategoryName_() {
  return String(
    PropertiesService.getScriptProperties().getProperty('SQUARE_SYNC_ROOT_CATEGORY_NAME') || ''
  ).trim();
}

function getItemCategoryId_(itemData) {
  if (!itemData) return '';

  if (itemData.category_id) {
    return String(itemData.category_id).trim();
  }

  if (Array.isArray(itemData.categories) && itemData.categories.length) {
    const first = itemData.categories[0];
    if (typeof first === 'string') return String(first).trim();
    if (first && first.id) return String(first.id).trim();
  }

  return '';
}

function buildSquareCategoryMap_(allObjects) {
  const categoriesById = {};

  for (let i = 0; i < allObjects.length; i++) {
    const obj = allObjects[i];
    if (obj.type !== 'CATEGORY') continue;

    const data = obj.category_data || {};
    categoriesById[obj.id] = {
      id: obj.id,
      name: String(data.name || '').trim(),
      parentCategoryId: String(
        (data.parent_category && data.parent_category.id) ||
        data.parent_category_id ||
        ''
      ).trim()
    };
  }

  return categoriesById;
}

function categoryTreeContainsId_(categoryId, categoriesById, targetId) {
  const wanted = String(targetId || '').trim();
  if (!categoryId || !wanted) return false;

  let currentId = categoryId;
  const seen = {};

  while (currentId && !seen[currentId]) {
    seen[currentId] = true;

    if (currentId === wanted) {
      return true;
    }

    const cat = categoriesById[currentId];
    if (!cat) return false;

    currentId = cat.parentCategoryId || '';
  }

  return false;
}

function categoryTreeContainsName_(categoryId, categoriesById, targetName) {
  const wanted = String(targetName || '').trim().toLowerCase();
  if (!categoryId || !wanted) return false;

  let currentId = categoryId;
  const seen = {};

  while (currentId && !seen[currentId]) {
    seen[currentId] = true;

    const cat = categoriesById[currentId];
    if (!cat) return false;

    if (String(cat.name || '').trim().toLowerCase() === wanted) {
      return true;
    }

    currentId = cat.parentCategoryId || '';
  }

  return false;
}

function shouldIncludeSquareItemByCategory_(itemData, categoriesById, cfg) {
  const itemCategoryId = getItemCategoryId_(itemData);

  if (!cfg.syncRootCategoryId && !cfg.syncRootCategoryName) {
    return true;
  }

  if (!itemCategoryId) {
    return false;
  }

  if (cfg.syncRootCategoryId) {
    return categoryTreeContainsId_(itemCategoryId, categoriesById, cfg.syncRootCategoryId);
  }

  return categoryTreeContainsName_(itemCategoryId, categoriesById, cfg.syncRootCategoryName);
}

function fetchSquareCatalogVariations_() {
  const cfg = getSquareConfig_();
  const allObjects = [];
  let cursor = null;

  do {
    let path = '/catalog/list';
    if (cursor) {
      path += '?cursor=' + encodeURIComponent(cursor);
    }

    const result = squareRequest_(path, 'get');
    const objects = result.objects || [];

    for (let i = 0; i < objects.length; i++) {
      allObjects.push(objects[i]);
    }

    cursor = result.cursor || null;
  } while (cursor);

  const categoriesById = buildSquareCategoryMap_(allObjects);
  const itemsById = {};
  const collected = {};
  const seenVariationIds = {};

  for (let i = 0; i < allObjects.length; i++) {
    const obj = allObjects[i];
    if (obj.type !== 'ITEM') continue;
    itemsById[obj.id] = obj;
  }

  for (let i = 0; i < allObjects.length; i++) {
    const obj = allObjects[i];
    if (obj.type !== 'ITEM') continue;

    const itemData = obj.item_data || {};
    const itemName = String(itemData.name || '').trim();

    if (!shouldIncludeSquareItemByCategory_(itemData, categoriesById, cfg)) {
      continue;
    }

    const nestedVariations = itemData.variations || [];
    for (let j = 0; j < nestedVariations.length; j++) {
      const vObj = nestedVariations[j];
      const vData = vObj.item_variation_data || {};
      const priceMoney = vData.price_money || {};
      const sku = String(vData.sku || '').trim().toUpperCase();
      const variationName = String(vData.name || '').trim();
      const amountMinor = Number(priceMoney.amount || 0);
      const amountMajor = amountMinor / 100;

      if (!sku) continue;
      if (seenVariationIds[vObj.id]) continue;

      seenVariationIds[vObj.id] = true;
      collected[vObj.id] = {
        variationId: vObj.id,
        itemId: obj.id,
        itemName: itemName,
        variationName: variationName,
        sku: sku,
        label: buildSquareCommercialLabel_(itemName, variationName),
        amountMinor: amountMinor,
        amount: roundMoney_(amountMajor),
        currency: String(priceMoney.currency || cfg.currency || 'GBP').trim(),
        sellableAtLocation: isSquareVariationSellableAtLocation_(vObj, cfg.locationId),
        isDeleted: vObj.is_deleted === true
      };
    }
  }

  for (let i = 0; i < allObjects.length; i++) {
    const obj = allObjects[i];
    if (obj.type !== 'ITEM_VARIATION') continue;
    if (seenVariationIds[obj.id]) continue;

    const vData = obj.item_variation_data || {};
    const priceMoney = vData.price_money || {};
    const itemId = String(vData.item_id || '').trim();
    const itemObj = itemsById[itemId];
    const itemData = itemObj ? (itemObj.item_data || {}) : null;
    const itemName = itemData ? String(itemData.name || '').trim() : '';
    const sku = String(vData.sku || '').trim().toUpperCase();
    const variationName = String(vData.name || '').trim();
    const amountMinor = Number(priceMoney.amount || 0);
    const amountMajor = amountMinor / 100;

    if (!sku) continue;
    if (itemData && !shouldIncludeSquareItemByCategory_(itemData, categoriesById, cfg)) {
      continue;
    }

    seenVariationIds[obj.id] = true;
    collected[obj.id] = {
      variationId: obj.id,
      itemId: itemId,
      itemName: itemName,
      variationName: variationName,
      sku: sku,
      label: buildSquareCommercialLabel_(itemName, variationName),
      amountMinor: amountMinor,
      amount: roundMoney_(amountMajor),
      currency: String(priceMoney.currency || cfg.currency || 'GBP').trim(),
      sellableAtLocation: isSquareVariationSellableAtLocation_(obj, cfg.locationId),
      isDeleted: obj.is_deleted === true
    };
  }

  const variations = Object.keys(collected).map(function(key) {
    return collected[key];
  });

  variations.sort(function(a, b) {
    if (a.itemName !== b.itemName) {
      return a.itemName.localeCompare(b.itemName, 'en-GB');
    }
    if (a.variationName !== b.variationName) {
      return a.variationName.localeCompare(b.variationName, 'en-GB');
    }
    return a.sku.localeCompare(b.sku, 'en-GB');
  });

  return variations;
}

function previewSquareCommercialSync() {
  const cfg = getSquareConfig_();
  const sheet = getPaymentOptionsSheet_();
  const data = sheet.getDataRange().getValues();
  if (!data.length) throw new Error('PaymentOptions needs a header row.');

  const headers = data[0];
  const idx = getHeaderMap_(headers);
  const codeCol = requireHeader_(idx, 'Code');

  const existingCodes = {};
  for (let r = 1; r < data.length; r++) {
    const code = String(data[r][codeCol] || '').trim().toUpperCase();
    if (!code) continue;
    existingCodes[code] = r + 1;
  }

  const variations = fetchSquareCatalogVariations_();
  const bySku = {};
  const duplicateSkus = [];
  const missingSku = [];
  const matched = [];
  const newInSquare = [];

  for (let i = 0; i < variations.length; i++) {
    const v = variations[i];

    if (!v.sku) {
      missingSku.push({
        itemName: v.itemName,
        variationName: v.variationName,
        variationId: v.variationId
      });
      continue;
    }

    if (bySku[v.sku]) {
      duplicateSkus.push(v.sku);
      continue;
    }
    bySku[v.sku] = v;

    if (existingCodes[v.sku]) {
      matched.push({
        code: v.sku,
        row: existingCodes[v.sku],
        label: v.label,
        amount: v.amount,
        variationId: v.variationId
      });
    } else {
      newInSquare.push({
        code: v.sku,
        label: v.label,
        amount: v.amount,
        variationId: v.variationId
      });
    }
  }

  const missingInSquare = [];
  const sheetCodes = Object.keys(existingCodes);
  for (let i = 0; i < sheetCodes.length; i++) {
    const code = sheetCodes[i];
    if (!bySku[code]) {
      missingInSquare.push(code);
    }
  }

  return {
    ok: true,
    filterRootCategoryId: cfg.syncRootCategoryId || '',
    filterRootCategoryName: cfg.syncRootCategoryName || '',
    squareVariationCount: variations.length,
    matchedCount: matched.length,
    newInSquareCount: newInSquare.length,
    missingInSquareCount: missingInSquare.length,
    missingSkuCount: missingSku.length,
    duplicateSkuCount: duplicateSkus.length,
    matched: matched,
    newInSquare: newInSquare,
    missingInSquare: missingInSquare,
    missingSku: missingSku,
    duplicateSkus: duplicateSkus
  };
}

function syncSquareCommercialToPaymentOptions(options) {
  options = options || {};

  const appendNew = options.appendNew === true;
  const deactivateMissing = options.deactivateMissing === true;

  const sheet = getPaymentOptionsSheet_();
  const data = sheet.getDataRange().getValues();
  if (!data.length) throw new Error('PaymentOptions needs a header row.');

  const headers = data[0];
  const idx = getHeaderMap_(headers);

  const activeCol = requireHeader_(idx, 'Active');
  const codeCol = requireHeader_(idx, 'Code');
  const labelCol = requireHeader_(idx, 'Label');
  const chargeTypeCol = requireHeader_(idx, 'Charge Type');
  const amountCol = requireHeader_(idx, 'Amount');
  const squareVariationIdCol = requireHeader_(idx, 'Square Variation ID');
  const appAllowedCol = requireHeader_(idx, 'App Allowed');
  const displayOrderCol = requireHeader_(idx, 'Display Order');
  const notesCol = requireHeader_(idx, 'Notes');

  const rows = data.slice(1);
  const rowByCode = {};
  let maxDisplayOrder = 0;

  for (let i = 0; i < rows.length; i++) {
    const code = String(rows[i][codeCol] || '').trim().toUpperCase();
    if (code) {
      rowByCode[code] = i;
    }

    const displayOrder = Number(rows[i][displayOrderCol] || 0);
    if (!isNaN(displayOrder) && displayOrder > maxDisplayOrder) {
      maxDisplayOrder = displayOrder;
    }
  }

  const variations = fetchSquareCatalogVariations_();
  const bySku = {};
  const duplicateSkus = [];

  for (let i = 0; i < variations.length; i++) {
    const v = variations[i];
    if (!v.sku) continue;

    if (bySku[v.sku]) {
      duplicateSkus.push(v.sku);
      continue;
    }

    bySku[v.sku] = v;
  }

  if (duplicateSkus.length) {
    throw new Error('Duplicate Square SKUs found: ' + duplicateSkus.join(', '));
  }

  const matchedCodes = {};
  const updatedRows = [];
  const appendedRows = [];
  const missingInSquare = [];

  const squareCodes = Object.keys(bySku);
  for (let i = 0; i < squareCodes.length; i++) {
    const code = squareCodes[i];
    const v = bySku[code];
    const existingIndex = rowByCode[code];
    const squareActive = v.sellableAtLocation === true && v.isDeleted !== true;

    if (typeof existingIndex === 'number') {
      const row = rows[existingIndex];

      row[activeCol] = squareActive;
      row[labelCol] = v.label;
      row[amountCol] = v.amount;
      row[squareVariationIdCol] = v.variationId;

      matchedCodes[code] = true;
      updatedRows.push({
        code: code,
        rowNumber: existingIndex + 2,
        label: v.label,
        amount: v.amount,
        variationId: v.variationId
      });
      continue;
    }

    if (appendNew) {
      maxDisplayOrder += 1;

      const newRow = new Array(headers.length).fill('');
      newRow[activeCol] = false;
      newRow[codeCol] = code;
      newRow[labelCol] = v.label;
      newRow[chargeTypeCol] = inferChargeTypeFromCode_(code);
      newRow[amountCol] = v.amount;
      newRow[squareVariationIdCol] = v.variationId;
      newRow[appAllowedCol] = false;
      newRow[displayOrderCol] = maxDisplayOrder;
      newRow[notesCol] = 'Imported from Square. Review local rule columns before enabling.';

      rows.push(newRow);
      matchedCodes[code] = true;
      appendedRows.push({
        code: code,
        label: v.label,
        amount: v.amount,
        variationId: v.variationId
      });
    }
  }

  const existingCodes = Object.keys(rowByCode);
  for (let i = 0; i < existingCodes.length; i++) {
    const code = existingCodes[i];
    if (matchedCodes[code]) continue;

    missingInSquare.push(code);

    if (deactivateMissing) {
      const row = rows[rowByCode[code]];
      row[activeCol] = false;
      row[squareVariationIdCol] = '';
    }
  }

  if (rows.length > 0) {
    sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
    sheet.getRange(2, amountCol + 1, rows.length, 1).setNumberFormat('£0.00');
  }

  invalidateSheetRuntimeCache_(sheet);

  return {
    ok: true,
    appendNew: appendNew,
    deactivateMissing: deactivateMissing,
    updatedCount: updatedRows.length,
    appendedCount: appendedRows.length,
    missingInSquareCount: missingInSquare.length,
    updatedRows: updatedRows,
    appendedRows: appendedRows,
    missingInSquare: missingInSquare
  };
}

function buildSquareSyncSummaryMessage_(preview, result) {
  const lines = [];

  if (preview) {
    lines.push('Square items in scope: ' + preview.squareVariationCount);
    lines.push('Matched existing rows: ' + preview.matchedCount);
    lines.push('New items in Square: ' + preview.newInSquareCount);
    lines.push('Rows in sheet missing from Square: ' + preview.missingInSquareCount);
    lines.push('Duplicate SKUs: ' + preview.duplicateSkuCount);
    lines.push('Missing SKUs: ' + preview.missingSkuCount);
  }

  if (result) {
    lines.push('');
    lines.push('Rows updated: ' + result.updatedCount);
    lines.push('Rows appended: ' + result.appendedCount);
    lines.push('Rows missing in Square: ' + result.missingInSquareCount);
  }

  return lines.join('\n');
}

function previewSquareCommercialSyncFromMenu() {
  const ui = SpreadsheetApp.getUi();

  try {
    const preview = previewSquareCommercialSync();

    Logger.log(JSON.stringify(preview, null, 2));
    console.log(JSON.stringify(preview, null, 2));

    ui.alert(
      'Square sync preview',
      buildSquareSyncSummaryMessage_(preview, null),
      ui.ButtonSet.OK
    );
  } catch (err) {
    console.error(err);
    ui.alert(
      'Square sync preview failed',
      String(err && err.message ? err.message : err),
      ui.ButtonSet.OK
    );
  }
}

function runSquareCommercialSyncFromMenu() {
  const ui = SpreadsheetApp.getUi();

  try {
    const preview = previewSquareCommercialSync();
    const result = syncSquareCommercialToPaymentOptions({
      appendNew: true,
      deactivateMissing: false
    });

    Logger.log(JSON.stringify({
      preview: preview,
      result: result
    }, null, 2));
    console.log(JSON.stringify({
      preview: preview,
      result: result
    }, null, 2));

    ui.alert(
      'Square sync complete',
      buildSquareSyncSummaryMessage_(preview, result),
      ui.ButtonSet.OK
    );
  } catch (err) {
    console.error(err);
    ui.alert(
      'Square sync failed',
      String(err && err.message ? err.message : err),
      ui.ButtonSet.OK
    );
  }
}

function showSquareSyncSettingsFromMenu() {
  const ui = SpreadsheetApp.getUi();
  const cfg = getSquareConfig_();

  ui.alert(
    'Square sync settings',
    'Root category ID: ' + (cfg.syncRootCategoryId || '(not set)') + '\n' +
    'Root category name: ' + (cfg.syncRootCategoryName || '(not set)') + '\n' +
    'Location ID: ' + cfg.locationId + '\n' +
    'Environment: ' + cfg.env,
    ui.ButtonSet.OK
  );
}

function setSquareSyncRootCategoryNameFromMenu() {
  const ui = SpreadsheetApp.getUi();
  const props = PropertiesService.getScriptProperties();
  const currentName = String(props.getProperty('SQUARE_SYNC_ROOT_CATEGORY_NAME') || '').trim();
  const currentId = String(props.getProperty('SQUARE_SYNC_ROOT_CATEGORY_ID') || '').trim();

  const response = ui.prompt(
    'Set Square sync root category',
    'Enter the top-level Square category NAME to sync from.\n\n' +
    'Example: Mat Fee\n\n' +
    'Current name: ' + (currentName || '(not set)') + '\n' +
    'Current ID: ' + (currentId || '(not set)') + '\n\n' +
    'Saving a name here will clear the category ID override.',
    ui.ButtonSet.OK_CANCEL
  );

  if (response.getSelectedButton() !== ui.Button.OK) {
    return;
  }

  const newName = String(response.getResponseText() || '').trim();
  if (!newName) {
    ui.alert('No change made.', ui.ButtonSet.OK);
    return;
  }

  props.setProperty('SQUARE_SYNC_ROOT_CATEGORY_NAME', newName);
  props.deleteProperty('SQUARE_SYNC_ROOT_CATEGORY_ID');

  ui.alert(
    'Square sync setting updated',
    'Root category name is now set to: ' + newName,
    ui.ButtonSet.OK
  );
}

function runSquareCommercialSyncAppendNew() {
  const output = syncSquareCommercialToPaymentOptions({
    appendNew: true,
    deactivateMissing: false
  });

  Logger.log(JSON.stringify(output, null, 2));
  console.log(JSON.stringify(output, null, 2));

  return output;
}

function runSquareCommercialSyncUpdateOnly() {
  const output = syncSquareCommercialToPaymentOptions({
    appendNew: false,
    deactivateMissing: false
  });

  Logger.log(JSON.stringify(output, null, 2));
  console.log(JSON.stringify(output, null, 2));

  return output;
}

function runSquareCommercialSyncAppendAndDeactivateMissing() {
  const output = syncSquareCommercialToPaymentOptions({
    appendNew: true,
    deactivateMissing: true
  });

  Logger.log(JSON.stringify(output, null, 2));
  console.log(JSON.stringify(output, null, 2));

  return output;
}

function getBasketExtendedRecord_(basketId) {
  const basket = getBasketRecord_(basketId);
  if (!basket) return null;

  const sheet = getBasketsSheet_();
  const meta = getHeaderMeta_(sheet);
  const idx = meta.headerMap;
  const row = sheet.getRange(basket.rowNumber, 1, 1, meta.lastColumn).getValues()[0];

  return {
    rowNumber: basket.rowNumber,
    basketId: basket.basketId,
    sessionDateIso: basket.sessionDateIso,
    status: basket.status,
    settlementMethod: String(row[requireHeader_(idx, SIGNIN_CFG.basketHeaders.settlementMethod)] || '').trim(),
    totalAmount: normaliseMoneyValue_(row[requireHeader_(idx, SIGNIN_CFG.basketHeaders.totalAmount)]),
    memberCount: normaliseWholeNumber_(row[requireHeader_(idx, SIGNIN_CFG.basketHeaders.memberCount)]),
    postedAt: row[requireHeader_(idx, SIGNIN_CFG.basketHeaders.postedAt)],
    squareOrderId: String(row[requireHeader_(idx, SIGNIN_CFG.basketHeaders.squareOrderId)] || '').trim(),
    squarePaymentLinkId: String(row[requireHeader_(idx, SIGNIN_CFG.basketHeaders.squarePaymentLinkId)] || '').trim(),
    squarePaymentId: String(row[requireHeader_(idx, SIGNIN_CFG.basketHeaders.squarePaymentId)] || '').trim(),
    paymentResolvedAt: row[requireHeader_(idx, SIGNIN_CFG.basketHeaders.paymentResolvedAt)],
    notes: String(row[requireHeader_(idx, SIGNIN_CFG.basketHeaders.notes)] || '').trim()
  };
}

function getBasketPayableLines_(basketId) {
  const total = perfNow_();
  const perfScope = withPerfRequestScope_('getBasketPayableLines_', newPerfRequestId_());
  let t = perfNow_();
  const basket = getBasketExtendedRecord_(basketId);
  perfLog_(perfScope, 'getBasketExtendedRecord_', t, 'basketId=' + basketId + ' found=' + !!basket);
  if (!basket) {
    throw new Error('Basket not found.');
  }

  if (basket.status !== SIGNIN_CFG.basketStatuses.signedInAwaitingPayment) {
    throw new Error('Basket must be in SIGNED_IN_AWAITING_PAYMENT before creating a Square payment link.');
  }

  t = perfNow_();
  const lines = getBasketLineRows_(basketId);
  perfLog_(perfScope, 'getBasketLineRows_', t, 'basketId=' + basketId + ' lines=' + lines.length);
  const payableLines = [];

  t = perfNow_();
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.lineType === 'ATTENDANCE') continue;
    if (line.paymentRequired !== true) continue;
    if (line.paid === true) continue;

    if (!String(line.squareVariationId || '').trim()) {
      throw new Error('Basket line "' + (line.description || line.lineId || 'Unknown') + '" is missing a Square Variation ID.');
    }

    payableLines.push(line);
  }
  perfLog_(perfScope, 'filter payable lines', t, 'basketId=' + basketId + ' payable=' + payableLines.length + ' from=' + lines.length);

  if (!payableLines.length) {
    throw new Error('Basket has no unpaid Square-payable lines.');
  }

  perfLog_(perfScope, 'total', total, 'basketId=' + basketId + ' payable=' + payableLines.length);

  return {
    basket: basket,
    lines: payableLines
  };
}

function buildSquareOrderLineItemsFromBasketLines_(lines) {
  const lineItems = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    lineItems.push({
      catalog_object_id: line.squareVariationId,
      quantity: '1',
      note: 'Basket ' + line.basketId + ' | Line ' + line.lineId + ' | ' + (line.fullName || '')
    });
  }

  return lineItems;
}

function appendBasketNote_(existingText, extraText) {
  const current = String(existingText || '').trim();
  const extra = String(extraText || '').trim();

  if (!extra) return current;
  if (!current) return extra;
  return current + ' | ' + extra;
}

function createBasketPaymentLink(basketId) {
  const total = perfNow_();
  const perfScope = withPerfRequestScope_('createBasketPaymentLink', newPerfRequestId_());
  let t = perfNow_();
  const cfg = getSquareConfig_();
  perfLog_(perfScope, 'getSquareConfig_', t, '');
  t = perfNow_();
  const payable = getBasketPayableLines_(basketId);
  perfLog_(perfScope, 'getBasketPayableLines_', t, 'basketId=' + basketId + ' lines=' + payable.lines.length);
  const basket = payable.basket;
  const lines = payable.lines;
  t = perfNow_();
  const lineItems = buildSquareOrderLineItemsFromBasketLines_(lines);
  perfLog_(perfScope, 'buildSquareOrderLineItemsFromBasketLines_', t, 'lineItems=' + lineItems.length);

  let totalAmount = 0;
  for (let i = 0; i < lines.length; i++) {
    if (isFiniteNumber_(lines[i].amount)) {
      totalAmount += Number(lines[i].amount);
    }
  }
  totalAmount = roundMoney_(totalAmount);

  const appUrl = ScriptApp.getService().getUrl();
  const returnUrl =
    appUrl +
    '?returnFrom=square&basketId=' + encodeURIComponent(basketId);

  const body = {
    idempotency_key: 'basket-link-' + basketId,
    order: {
      location_id: cfg.locationId,
      line_items: lineItems
    },
    checkout_options: {
      redirect_url: returnUrl,
      enable_coupon: false,
      enable_loyalty: false
    }
  };

  t = perfNow_();
  const result = squareRequest_('/online-checkout/payment-links', 'post', body);
  perfLog_(perfScope, 'squareRequest_', t, 'endpoint=/online-checkout/payment-links');
  const paymentLink = result.payment_link || {};

  t = perfNow_();
  updateBasketRow_(basket.rowNumber, {
    'Settlement Method': SIGNIN_CFG.paymentMethods.app,
    'Total Amount': totalAmount,
    'Square Order ID': paymentLink.order_id || '',
    'Square Payment Link ID': paymentLink.id || '',
    'Notes': appendBasketNote_(
      basket.notes,
      'Square payment link created on ' +
        Utilities.formatDate(new Date(), SIGNIN_CFG.timezone, 'dd/MM/yyyy HH:mm:ss')
    )
  });
  perfLog_(perfScope, 'updateBasketRow_', t, 'basketId=' + basketId + ' linkId=' + (paymentLink.id || ''));
  perfLog_(perfScope, 'total', total, 'basketId=' + basketId + ' lines=' + lines.length + ' amount=' + totalAmount);

  return {
    ok: true,
    basketId: basketId,
    paymentLinkId: paymentLink.id || '',
    paymentLinkUrl: paymentLink.url || '',
    orderId: paymentLink.order_id || '',
    amount: totalAmount,
    formattedAmount: formatCurrency_(totalAmount),
    returnUrl: returnUrl
  };
}

function getSquareOrder_(orderId) {
  const cfg = getSquareConfig_();
  if (!orderId) {
    throw new Error('Square Order ID is required.');
  }

  return squareRequest_(
    '/orders/' + encodeURIComponent(orderId) + '?location_id=' + encodeURIComponent(cfg.locationId),
    'get'
  );
}

function extractPaymentIdFromSquareOrder_(order) {
  if (!order) return '';

  if (Array.isArray(order.tenders) && order.tenders.length) {
    for (let i = 0; i < order.tenders.length; i++) {
      const tender = order.tenders[i];
      if (tender && tender.id) {
        return String(tender.id).trim();
      }
    }
  }

  return '';
}

function checkBasketPaymentStatus(basketId) {
  const total = perfNow_();
  const perfScope = withPerfRequestScope_('checkBasketPaymentStatus', newPerfRequestId_());
  let t = perfNow_();
  const basket = getBasketExtendedRecord_(basketId);
  perfLog_(perfScope, 'getBasketExtendedRecord_', t, 'basketId=' + basketId + ' found=' + !!basket);
  if (!basket) {
    throw new Error('Basket not found.');
  }

  if (!basket.squareOrderId) {
    throw new Error('Basket does not yet have a Square Order ID.');
  }

  t = perfNow_();
  const response = getSquareOrder_(basket.squareOrderId);
  perfLog_(perfScope, 'getSquareOrder_', t, 'basketId=' + basketId + ' orderId=' + basket.squareOrderId);
  t = perfNow_();
  const order = response.order || {};
  const orderState = String(order.state || '').trim().toUpperCase();
  const amountDueMinor = Number(((order.net_amount_due_money || {}).amount) || 0);
  const squarePaymentId = extractPaymentIdFromSquareOrder_(order);

  const isPaid = (orderState === 'COMPLETED') || (amountDueMinor === 0 && orderState !== 'CANCELED');
  perfLog_(perfScope, 'evaluate payment state', t, 'basketId=' + basketId + ' orderState=' + orderState + ' due=' + amountDueMinor + ' isPaid=' + isPaid);

  let resolved = false;
  if (
    isPaid &&
    basket.status !== SIGNIN_CFG.basketStatuses.paymentResolved &&
    basket.status !== SIGNIN_CFG.basketStatuses.posted
  ) {
    t = perfNow_();
    resolveBasketPaymentApp(basketId, squarePaymentId);
    perfLog_(perfScope, 'resolveBasketPaymentApp', t, 'basketId=' + basketId + ' paymentId=' + (squarePaymentId || ''));
    resolved = true;
  }

  perfLog_(perfScope, 'total', total, 'basketId=' + basketId + ' resolved=' + resolved + ' orderState=' + orderState);

  return {
    ok: true,
    basketId: basketId,
    orderId: basket.squareOrderId,
    orderState: orderState,
    amountDueMinor: amountDueMinor,
    isPaid: isPaid,
    resolved: resolved,
    squarePaymentId: squarePaymentId
  };
}

function checkBasketPaymentStatusFromMenu() {
  const ui = SpreadsheetApp.getUi();

  const response = ui.prompt(
    'Reconcile Square basket payment',
    'Enter the Basket ID to check and reconcile if paid.',
    ui.ButtonSet.OK_CANCEL
  );

  if (response.getSelectedButton() !== ui.Button.OK) {
    return;
  }

  const basketId = String(response.getResponseText() || '').trim();
  if (!basketId) {
    ui.alert('No Basket ID entered.');
    return;
  }

  try {
    const result = checkBasketPaymentStatus(basketId);

    ui.alert(
      'Basket payment status',
      'Basket: ' + basketId + '\n' +
      'Order state: ' + result.orderState + '\n' +
      'Paid: ' + (result.isPaid ? 'Yes' : 'No') + '\n' +
      'Resolved now: ' + (result.resolved ? 'Yes' : 'No'),
      ui.ButtonSet.OK
    );
  } catch (err) {
    ui.alert(
      'Square payment check failed',
      String(err && err.message ? err.message : err),
      ui.ButtonSet.OK
    );
  }
}

function testSquareCatalogList() {
  const variations = fetchSquareCatalogVariations_();

  const output = {
    ok: true,
    count: variations.length,
    sample: variations.slice(0, 10)
  };

  Logger.log(JSON.stringify(output, null, 2));
  console.log(JSON.stringify(output, null, 2));

  return output;
}

function testPreviewSquareCommercialSync() {
  const output = previewSquareCommercialSync();

  Logger.log(JSON.stringify(output, null, 2));
  console.log(JSON.stringify(output, null, 2));

  return output;
}

function debugSquareCatalogSkus() {
  const cfg = getSquareConfig_();

  const rows = fetchSquareCatalogVariations_().map(function(v) {
    return {
      sku: v.sku,
      itemName: v.itemName,
      variationName: v.variationName,
      label: v.label,
      amount: v.amount,
      variationId: v.variationId
    };
  });

  const output = {
    ok: true,
    filterRootCategoryId: cfg.syncRootCategoryId || '',
    filterRootCategoryName: cfg.syncRootCategoryName || '',
    count: rows.length,
    rows: rows
  };

  Logger.log(JSON.stringify(output, null, 2));
  console.log(JSON.stringify(output, null, 2));

  return output;
}
