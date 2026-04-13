/**
 * Shared project configuration and Script Property access helpers.
 *
 * Keep this file prefixed with 00_ so Apps Script loads config before runtime code.
 */
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
