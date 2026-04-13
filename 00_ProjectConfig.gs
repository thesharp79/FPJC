/**
 * Shared project configuration and Script Property access helpers.
 *
 * Keep this file prefixed with 00_ so Apps Script loads config before runtime code.
 */
const SIGNIN_CFG = {
  spreadsheetId: getScriptPropertyRequired_('SPREADSHEET_ID'),
  membersFormUrl: getClubConfigValueOrFallback_('member_form_url', 'MEMBERS_FORM_URL'),
  bannerUrl: getClubConfigValueOrFallback_('banner_url', 'BANNER_URL'),
  clubName: getClubConfigValueOrFallback_('club_name', ''),
  sessionNamesJson: getClubConfigValueOrFallback_('session_names_json', ''),
  featureFlagsJson: getClubConfigValueOrFallback_('feature_flags_json', ''),
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

function getClubConfigValueOrFallback_(configKey, fallbackPropertyName) {
  try {
    const ss = SpreadsheetApp.openById(getScriptPropertyRequired_('SPREADSHEET_ID'));
    const sheet = ss.getSheetByName('Club_Config');
    if (!sheet || sheet.getLastRow() < 2) return fallbackPropertyName ? getOptionalScriptProperty_(fallbackPropertyName) : '';

    const lastCol = Math.max(sheet.getLastColumn(), 2);
    const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(function (header) {
      return String(header || '').trim().toLowerCase();
    });
    const keyCol = headers.indexOf('key');
    const valueCol = headers.indexOf('value');
    if (keyCol === -1 || valueCol === -1) return fallbackPropertyName ? getOptionalScriptProperty_(fallbackPropertyName) : '';

    const rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, lastCol).getValues();
    for (let i = 0; i < rows.length; i++) {
      const key = String(rows[i][keyCol] || '').trim();
      if (key === configKey) return String(rows[i][valueCol] || '').trim();
    }
  } catch (err) {
    console.warn('Club_Config lookup failed for key "' + configKey + '": ' + err.message);
  }
  return fallbackPropertyName ? getOptionalScriptProperty_(fallbackPropertyName) : '';
}
