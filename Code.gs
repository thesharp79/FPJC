/**
 * Main entry point - installable trigger: From spreadsheet -> On form submit
 *
 * Supports BOTH forms:
 *
 * 1) Attendance form
 *    - writes a row to Attendance
 *    - if the attendee is a new member, also inserts/updates Members
 *
 * 2) Member-only form
 *    - does NOT write to Attendance
 *    - only inserts/updates Members
 *
 * Important behaviour:
 * - If attendance form user picks "I'm a new member", Attendance will store the REAL name
 *   from First Name + Last Name, not the literal text "I'm a new member".
 * - For new member rows in Members, formulas are written into:
 *     F = Session Name (derived from age / DOB)
 *     I = Last Session (MAXIFS against Attendance table)
 * - Attendance is hydrated from Members after write via syncAttendanceRowFromMembers_()
 *   so Attendance gets:
 *     - Session Name
 *     - Notes
 *     - PrePay Remaining
 *     - Intended Payment
 */
function onFormSubmit(e) {
  if (!e || !e.namedValues) {
    throw new Error("This function must be run by a form-submit trigger (missing event object).");
  }


  const ss = e.source;
  validateHeadersOrThrow_(ss);


  const nv = e.namedValues;


  // ---- DESTINATION SHEETS ----
  const attendance = ss.getSheetByName("Attendance");
  const members = ss.getSheetByName("Members");


  if (!attendance) throw new Error('Missing sheet: Attendance');
  if (!members) throw new Error('Missing sheet: Members');


  // ---- FORM HEADER NAMES ----
  const F = {
    timestamp: "Timestamp",
    sessionDate: "Session Date",
    sessionName: "Session Name",


    viperName: "Viper Name",
    viperPay: "Viper Payment",
    juniorName: "Junior Name",
    juniorPay: "Junior Payment",
    youthName: "Youth Name",
    youthPay: "Youth Payment",
    seniorName: "Senior Name",
    seniorPay: "Senior Payment",


    firstName: "First Name",
    lastName: "Last Name",
    dob: "Date of Birth",
    contactEmail: "Contact email address",
    address: "Address",
    bjaNumber: "British Judo Association (BJA) License number",
    bjaExpiry: "BJA License expiry date",
    medical: "Medical conditions / learning difficulties",
    firstAid: "First Aid",
    emailContact: "Email contact",
    photosVideos: "Photographs and videos",
    gradings: "Gradings / Records of success",
    c1Name: "Contact 1 - Name",
    c1Tel: "Contact 1 - Telephone Number",
    c1Rel: "Contact 1 - Relationship to member",
    c2Name: "Contact 2 - Name",
    c2Tel: "Contact 2 - Telephone Number",
    c2Rel: "Contact 2 - Relationship to member",
    dataStorage: "Data storage",
    heardAbout: "How did you hear about Fleming Park Judo Club"
  };


  /**
   * Safe getter for a named value from the event object.
   * Google Forms sends namedValues as arrays, so we take the first value.
   */
  const get = (key) => {
    const arr = nv[key];
    if (!arr || !arr.length) return "";
    return String(arr[0] ?? "").trim();
  };


  // ---- COMMON VALUES ----
  const ts = get(F.timestamp) || (e.values && e.values[0]) || "";
  const sessionDate = get(F.sessionDate);
  const sessionName = get(F.sessionName);


  const pick = pickNameAndPayment_(get, F);
  const selectedName = pick.fullName;
  const intendedPayment = pick.payment;


  const firstName = get(F.firstName);
  const lastName = get(F.lastName);
  const computedFullName = [firstName, lastName].filter(Boolean).join(" ").trim();


  // ---- DETECT WHAT TYPE OF SUBMISSION THIS IS ----
  const hasAttendanceData = Boolean(sessionDate || sessionName || selectedName || intendedPayment);
  const hasMemberData = hasAnyMemberData_(get, F);


  const isNewMemberFromAttendanceForm =
    normalise_(selectedName) === normalise_("I'm a new member") ||
    Boolean(firstName || lastName);


  // =========================================================
  // 1) ATTENDANCE WRITE
  // =========================================================
  if (hasAttendanceData) {
    const attendanceName = isNewMemberFromAttendanceForm ? computedFullName : selectedName;


    if (attendanceName) {
      const attendanceRow = writeAttendanceRow_(attendance, [
        ts,              // A Timestamp
        sessionDate,     // B Session Date
        sessionName,     // C Session Name
        attendanceName,  // D Full Name
        intendedPayment, // E Intended Payment (may be overwritten by sync)
        false,           // F Payment Received
        "",              // G PrePay Remaining
        ""               // H Notes
      ]);


      // Hydrate Attendance from Members:
      // Session Name, Notes, PrePay Remaining, Intended Payment
      syncAttendanceRowFromMembers_(ss, attendanceRow);
    }
  }


  // =========================================================
  // 2) MEMBERS UPSERT
  // =========================================================
  if (!hasMemberData) return;


  const memberRecord = {
    "TimeStamp": ts,
    "Status": "", // only used on insert; update logic preserves existing Status
    "Concessionary": false, // admin-managed field; preserve existing on update
    "DD Start Date": "", // admin-managed field; preserve existing on update
    "PrePay Remaining": "", // admin-managed field; preserve existing on update
    "Session Name": sessionName, // may be overwritten by formula for certain cases
    "First Name": firstName,
    "Last Name": lastName,
    "Full Name": computedFullName,


    "Date of Birth": get(F.dob),
    "Contact email address": get(F.contactEmail),
    "Address": get(F.address),
    "British Judo Association (BJA) License number": get(F.bjaNumber),
    "BJA License expiry date": get(F.bjaExpiry),
    "Medical conditions / learning difficulties": get(F.medical),
    "First Aid": get(F.firstAid),
    "Email contact": get(F.emailContact),
    "Photographs and videos": get(F.photosVideos),
    "Gradings / Records of success": get(F.gradings),
    "Contact 1 - Name": get(F.c1Name),
    "Contact 1 - Telephone Number": get(F.c1Tel),
    "Contact 1 - Relationship to member": get(F.c1Rel),
    "Contact 2 - Name": get(F.c2Name),
    "Contact 2 - Telephone Number": get(F.c2Tel),
    "Contact 2 - Relationship to member": get(F.c2Rel),
    "Data storage": get(F.dataStorage),
    "How did you hear about Fleming Park Judo Club": get(F.heardAbout)
    // Notes deliberately excluded so we never overwrite volunteer-entered notes
  };


  const memberRow = upsertMember_(members, memberRecord, {
    bjaKey: "British Judo Association (BJA) License number",
    fallbackKeys: ["First Name", "Last Name", "Date of Birth"],
    statusHeader: "Status",
    defaultStatus: "Active",
    notesHeader: "Notes",
    ddStartHeader: "DD Start Date",
    concessionaryHeader: "Concessionary",
    prePayRemainingHeader: "PrePay Remaining"
  });


  // =========================================================
  // 3) APPLY MEMBERS FORMULAS
  // =========================================================
  const shouldSetDerivedSessionFormula =
    !hasAttendanceData || isNewMemberFromAttendanceForm;


  if (memberRow >= 2) {
    // Column F = Session Name
    // Uses DOB in column K on the Members sheet
    if (shouldSetDerivedSessionFormula) {
      members.getRange(memberRow, 6).setFormula(
        `=IF(ISBLANK(K${memberRow}),"",IFS(DATEDIF(K${memberRow},TODAY(),"Y")<8,"Vipers",DATEDIF(K${memberRow},TODAY(),"Y")<12,"Juniors",DATEDIF(K${memberRow},TODAY(),"Y")<16,"Youths",TRUE,"Seniors"))`
      );
    }


    // Column I = Last Session
    // Looks up latest Attendance date where Attendance Full Name matches Members Full Name in column J
    members.getRange(memberRow, 9).setFormula(
      `=IFERROR(MAXIFS(AttendanceTable[Session Date],AttendanceTable[Full Name],J${memberRow}),"")`
    );
  }
}


/**
 * Returns true if the submission contains any member-detail data.
 * This allows the member-only form to update Members without touching Attendance.
 */
function hasAnyMemberData_(get, F) {
  const memberFields = [
    F.firstName,
    F.lastName,
    F.dob,
    F.contactEmail,
    F.address,
    F.bjaNumber,
    F.bjaExpiry,
    F.medical,
    F.firstAid,
    F.emailContact,
    F.photosVideos,
    F.gradings,
    F.c1Name,
    F.c1Tel,
    F.c1Rel,
    F.c2Name,
    F.c2Tel,
    F.c2Rel,
    F.dataStorage,
    F.heardAbout
  ];


  return memberFields.some(header => String(get(header)).trim() !== "");
}


/**
 * Picks the first non-empty class name field and returns its matching payment field.
 * Priority order: Viper -> Junior -> Youth -> Senior
 */
function pickNameAndPayment_(get, F) {
  const pairs = [
    { name: get(F.viperName),  pay: get(F.viperPay) },
    { name: get(F.juniorName), pay: get(F.juniorPay) },
    { name: get(F.youthName),  pay: get(F.youthPay) },
    { name: get(F.seniorName), pay: get(F.seniorPay) }
  ];


  for (const p of pairs) {
    if (String(p.name || "").trim() !== "") {
      return {
        fullName: String(p.name).trim(),
        payment: String(p.pay || "").trim()
      };
    }
  }


  return { fullName: "", payment: "" };
}


/**
 * Normalises values for reliable text comparison.
 */
function normalise_(v) {
  return String(v || "").trim().toLowerCase();
}


/**
 * Attendance: write to first blank in column A (Timestamp), not appendRow()
 * Returns the row number that was written so callers can do follow-up updates.
 */
function writeAttendanceRow_(sheet, rowValues) {
  const colA = sheet.getRange(2, 1, Math.max(sheet.getLastRow() - 1, 1), 1).getValues();
  let nextRow = colA.findIndex(r => String(r[0]).trim() === "") + 2;
  if (nextRow === 1) nextRow = sheet.getLastRow() + 1;


  sheet.getRange(nextRow, 1, 1, rowValues.length).setValues([rowValues]);
  return nextRow;
}


/**
 * Upsert Member:
 * - Match on BJA number if present
 * - Else match on First+Last+DOB
 * - Insert: Status=Active, Notes blank, DD Start Date preserved blank,
 *   Concessionary preserved false, PrePay Remaining preserved blank
 * - Update: do not overwrite Status, Notes, DD Start Date,
 *   Concessionary, or PrePay Remaining
 */
function upsertMember_(sheet, record, cfg) {
  const lastCol = sheet.getLastColumn();
  const lastRow = sheet.getLastRow();


  if (lastRow < 1) throw new Error("Members sheet needs a header row (row 1)");


  const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(h => String(h).trim());
  const colIndex = new Map(headers.map((h, i) => [h, i + 1]));
  const col = (h) => colIndex.get(h) || 0;


  const bjaCol = col(cfg.bjaKey);
  const fbCols = cfg.fallbackKeys.map(col);
  const statusCol = col(cfg.statusHeader);
  const notesCol = col(cfg.notesHeader);
  const ddCol = col(cfg.ddStartHeader);
  const concessionaryCol = col(cfg.concessionaryHeader);
  const prePayRemainingCol = col(cfg.prePayRemainingHeader);


  if (lastRow === 1) {
    const row = headers.map(h => {
      if (h === cfg.statusHeader) return cfg.defaultStatus;
      if (h === cfg.notesHeader) return "";
      if (h === cfg.ddStartHeader) return "";
      if (h === cfg.concessionaryHeader) return false;
      if (h === cfg.prePayRemainingHeader) return "";
      return record[h] ?? "";
    });
    return writeMembersRowByFirstName_(sheet, row, headers.length);
  }


  const data = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();


  const bjaVal = normalise_(record[cfg.bjaKey]);
  const fbVals = cfg.fallbackKeys.map(k => normalise_(record[k]));


  let matchRow = -1;


  if (bjaVal && bjaCol) {
    for (let i = 0; i < data.length; i++) {
      const existing = normalise_(data[i][bjaCol - 1]);
      if (existing && existing === bjaVal) {
        matchRow = i + 2;
        break;
      }
    }
  }


  if (matchRow === -1 && fbCols.every(c => c > 0) && fbVals.every(v => v)) {
    for (let i = 0; i < data.length; i++) {
      const rowKey = fbCols.map(c => normalise_(data[i][c - 1]));
      if (rowKey[0] === fbVals[0] && rowKey[1] === fbVals[1] && rowKey[2] === fbVals[2]) {
        matchRow = i + 2;
        break;
      }
    }
  }


  if (matchRow === -1) {
    const row = headers.map(h => {
      if (h === cfg.statusHeader) return cfg.defaultStatus;
      if (h === cfg.notesHeader) return "";
      if (h === cfg.ddStartHeader) return "";
      if (h === cfg.concessionaryHeader) return false;
      if (h === cfg.prePayRemainingHeader) return "";
      return record[h] ?? "";
    });
    return writeMembersRowByFirstName_(sheet, row, headers.length);
  }


  headers.forEach((h, idx) => {
    const targetCol = idx + 1;


    if (targetCol === notesCol) return;
    if (targetCol === statusCol) return;
    if (targetCol === ddCol) return;
    if (targetCol === concessionaryCol) return;
    if (targetCol === prePayRemainingCol) return;


    const val = record[h];
    if (val !== undefined && String(val).trim() !== "") {
      sheet.getRange(matchRow, targetCol).setValue(val);
    }
  });


  const fullNameCol = col("Full Name");
  const fnCol = col("First Name");
  const lnCol = col("Last Name");


  if (fullNameCol && fnCol && lnCol) {
    const fn = sheet.getRange(matchRow, fnCol).getValue();
    const ln = sheet.getRange(matchRow, lnCol).getValue();
    const full = [fn, ln].filter(Boolean).join(" ").trim();


    if (full) {
      sheet.getRange(matchRow, fullNameCol).setValue(full);
    }
  }


  return matchRow;
}


/**
 * Insert a row into Members.
 *
 * We anchor on the first blank "First Name" cell rather than Timestamp,
 * because admin staff may manually create rows without timestamps.
 *
 * Members layout:
 * A TimeStamp
 * B Status
 * C Concessionary
 * D DD Start Date
 * E PrePay Remaining
 * F Session Name
 * G First Name   <-- anchor column
 * H Last Name
 * I Last Session
 * J Full Name
 * ...
 */
function writeMembersRowByFirstName_(sheet, rowValues, width) {
  const FIRST_NAME_COL = 7; // column G


  const colG = sheet.getRange(2, FIRST_NAME_COL, Math.max(sheet.getLastRow() - 1, 1), 1).getValues();
  let nextRow = colG.findIndex(r => String(r[0]).trim() === "") + 2;


  if (nextRow === 1) nextRow = sheet.getLastRow() + 1;


  sheet.getRange(nextRow, 1, 1, width).setValues([rowValues]);
  return nextRow;
}


/**
 * Validates the expected headers on Attendance and Members.
 */
function validateHeadersOrThrow_(ss) {
  const attendance = ss.getSheetByName("Attendance");
  const members = ss.getSheetByName("Members");
  if (!attendance) throw new Error('Missing sheet "Attendance"');
  if (!members) throw new Error('Missing sheet "Members"');


  const attendanceHeaders = [
    "Timestamp",
    "Session Date",
    "Session Name",
    "Full Name",
    "Intended Payment",
    "Payment Received",
    "PrePay Remaining",
    "Notes"
  ];


  const membersHeaders = [
    "TimeStamp",
    "Status",
    "Concessionary",
    "DD Start Date",
    "PrePay Remaining",
    "Session Name",
    "First Name",
    "Last Name",
    "Last Session",
    "Full Name",
    "Date of Birth",
    "Contact email address",
    "Address",
    "British Judo Association (BJA) License number",
    "BJA License expiry date",
    "Medical conditions / learning difficulties",
    "First Aid",
    "Email contact",
    "Photographs and videos",
    "Gradings / Records of success",
    "Contact 1 - Name",
    "Contact 1 - Telephone Number",
    "Contact 1 - Relationship to member",
    "Contact 2 - Name",
    "Contact 2 - Telephone Number",
    "Contact 2 - Relationship to member",
    "Data storage",
    "How did you hear about Fleming Park Judo Club",
    "Notes"
  ];


  assertHeaderRow_(attendance, attendanceHeaders);
  assertHeaderRow_(members, membersHeaders);
}


function assertHeaderRow_(sheet, expected) {
  const actual = sheet.getRange(1, 1, 1, expected.length).getDisplayValues()[0]
    .map(s => String(s).trim());


  for (let i = 0; i < expected.length; i++) {
    if (actual[i] !== expected[i]) {
      throw new Error(
        `Header mismatch in "${sheet.getName()}" col ${i + 1}. Expected "${expected[i]}", found "${actual[i] || "(blank)"}"`
      );
    }
  }
}


/**
 * Button action: add a manual Attendance row for desk staff.
 * Populates Timestamp (now) + Session Date (now).
 * Finds the first empty row by looking for a blank Full Name (column D).
 */
function addManualAttendanceRow() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("Attendance");
  if (!sheet) throw new Error('Missing sheet "Attendance"');


  const now = new Date();


  // Attendance headers:
  // A Timestamp | B Session Date | C Session Name | D Full Name | E Intended Payment | F Payment Received | G PrePay Remaining | H Notes
  const FULL_NAME_COL = 4;


  const lastRow = Math.max(sheet.getLastRow(), 2);
  const colD = sheet.getRange(2, FULL_NAME_COL, lastRow - 1, 1).getValues();


  let nextRow = colD.findIndex(r => String(r[0]).trim() === "") + 2;
  if (nextRow === 1) nextRow = sheet.getLastRow() + 1;


  const rowValues = [
    now,   // Timestamp
    now,   // Session Date
    "",    // Session Name
    "",    // Full Name
    "",    // Intended Payment
    false, // Payment Received
    "",    // PrePay Remaining
    ""     // Notes
  ];


  sheet.getRange(nextRow, 1, 1, rowValues.length).setValues([rowValues]);
}


/**
 * Adds a custom menu to the spreadsheet each time it is opened.
 */
function onOpen(e) {
  SpreadsheetApp.getUi()
    .createMenu('Admin')
    .addItem('Update Google Form name lists', 'runFormRefreshFromSheet')
    .addSeparator()
    .addItem('Preview Square payment sync', 'previewSquareCommercialSyncFromMenu')
    .addItem('Sync Square payment options', 'runSquareCommercialSyncFromMenu')
    .addItem('Check Square basket payment', 'checkBasketPaymentStatusFromMenu')
    .addSeparator()
    .addItem('Show Square sync settings', 'showSquareSyncSettingsFromMenu')
    .addItem('Set Square root category', 'setSquareSyncRootCategoryNameFromMenu')
    .addToUi();
}


/**
 * Wrapper that runs the Form refresh and shows a user-friendly result.
 */
function runFormRefreshFromSheet() {
  const ui = SpreadsheetApp.getUi();
  try {
    ui.alert('Updating…', 'Refreshing Google Form name lists. Please wait.', ui.ButtonSet.OK);


    buildOrRefreshForm();


    ui.alert('Done', 'Google Form name lists have been refreshed successfully.', ui.ButtonSet.OK);
  } catch (err) {
    console.error(err);


    ui.alert(
      'Update failed',
      'The refresh did not complete.\n\n' +
      'What to do:\n' +
      '1) Check you are signed into the correct Google account.\n' +
      '2) Check the "Calc" tab headers are unchanged.\n' +
      '3) If it still fails, share this message with the admin:\n\n' +
      String(err && err.message ? err.message : err),
      ui.ButtonSet.OK
    );
  }
}

