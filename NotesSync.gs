/**
 * Attendance desk workflow:
 * - When Full Name is selected/changed in Attendance, ALWAYS overwrite:
 *   - Attendance Session Name from Members Session Name
 *   - Attendance Notes from Members Notes
 *   - Attendance DD Start Date from Members DD Start Date
 *
 * - When Attendance Notes is edited, push Notes back to Members Notes
 *   (non-blank + changed only).
 *
 * IMPORTANT:
 * - Session Name is one-way only: Members -> Attendance
 * - DD Start Date is one-way only: Members -> Attendance
 * - Notes are two-way: Members -> Attendance on name select, and Attendance -> Members on note edit
 *
 * NEW:
 * - syncAttendanceRowFromMembers_(ss, row) can be called by the web app
 *   after it appends a row, because script writes do not trigger onEdit(e).
 */
function onEdit(e) {
  if (!e || !e.range) return;

  const CFG = getNotesSyncConfig_();

  const sheet = e.range.getSheet();
  if (sheet.getName() !== CFG.attendanceSheetName) return;

  if (e.range.getNumRows() !== 1 || e.range.getNumColumns() !== 1) return;

  const row = e.range.getRow();
  if (row <= CFG.headerRow) return;

  const attendanceCols = getHeaderIndexMap_(sheet, CFG.headerRow);
  const fullNameCol = attendanceCols[CFG.attendanceFullNameHeader];
  const notesCol = attendanceCols[CFG.attendanceNotesHeader];
  const prePayRemainingCol = attendanceCols[CFG.attendancePrePayRemainingHeader];

  if (!fullNameCol || !notesCol || !prePayRemainingCol) return;

  const editedCol = e.range.getColumn();

  const props = PropertiesService.getScriptProperties();
  const suppressNotesKey = 'SUPPRESS_ATT_NOTES_ROW';
  const suppressPrePayKey = 'SUPPRESS_ATT_PREPAY_ROW';

  const suppressNotesRow = Number(props.getProperty(suppressNotesKey) || 0);
  const suppressPrePayRow = Number(props.getProperty(suppressPrePayKey) || 0);

  // ============================================================
  // 1) Full Name changed -> overwrite Attendance from Members
  // ============================================================
  if (editedCol === fullNameCol) {
    syncAttendanceRowFromMembersBySheet_(sheet, row);
    return;
  }

  // ============================================================
  // 2) Notes edited -> push back to Members
  // ============================================================
  if (editedCol === notesCol) {
    if (suppressNotesRow === row) {
      props.deleteProperty(suppressNotesKey);
      return;
    }

    const fullName = String(sheet.getRange(row, fullNameCol).getValue() || '').trim();
    if (!fullName) return;

    const newNotes = String(e.range.getValue() || '').trim();
    const oldNotes = String(e.oldValue || '').trim();

    if (!newNotes) return;
    if (newNotes === oldNotes) return;

    try {
      writeNotesToMembers_(e.source, fullName, newNotes);
    } catch (err) {
      console.error(err);
      try {
        SpreadsheetApp.getUi().alert(
          'Notes sync failed',
          'Could not write notes back to Members.\n\n' +
          'Technical message:\n' + String(err && err.message ? err.message : err),
          SpreadsheetApp.getUi().ButtonSet.OK
        );
      } catch (_) {}
    }
    return;
  }

  // ============================================================
  // 3) PrePay Remaining edited -> push back to Members
  // ============================================================
  if (editedCol === prePayRemainingCol) {
    if (suppressPrePayRow === row) {
      props.deleteProperty(suppressPrePayKey);
      return;
    }

    const fullName = String(sheet.getRange(row, fullNameCol).getValue() || '').trim();
    if (!fullName) return;

    const rawValue = e.range.getValue();

    // Allow blank to clear the value
    if (rawValue === '' || rawValue === null) {
      try {
        writePrePayRemainingToMembers_(e.source, fullName, '');
      } catch (err) {
        console.error(err);
        try {
          SpreadsheetApp.getUi().alert(
            'PrePay sync failed',
            'Could not write PrePay Remaining back to Members.\n\n' +
            'Technical message:\n' + String(err && err.message ? err.message : err),
            SpreadsheetApp.getUi().ButtonSet.OK
          );
        } catch (_) {}
      }
      return;
    }

    const num = Number(rawValue);
    if (isNaN(num)) {
      try {
        SpreadsheetApp.getUi().alert(
          'Invalid PrePay Remaining',
          'PrePay Remaining must be a number or blank.',
          SpreadsheetApp.getUi().ButtonSet.OK
        );
      } catch (_) {}
      e.range.setValue(e.oldValue || '');
      return;
    }

    try {
      writePrePayRemainingToMembers_(e.source, fullName, num);
    } catch (err) {
      console.error(err);
      try {
        SpreadsheetApp.getUi().alert(
          'PrePay sync failed',
          'Could not write PrePay Remaining back to Members.\n\n' +
          'Technical message:\n' + String(err && err.message ? err.message : err),
          SpreadsheetApp.getUi().ButtonSet.OK
        );
      } catch (_) {}
    }
  }
}

/**
 * Public helper for other script files, including the web app.
 * Syncs one Attendance row from Members based on Attendance Full Name.
 */
function syncAttendanceRowFromMembers_(ss, attendanceRow) {
  const CFG = getNotesSyncConfig_();
  const attendanceSheet = ss.getSheetByName(CFG.attendanceSheetName);
  if (!attendanceSheet) throw new Error(`Missing sheet "${CFG.attendanceSheetName}"`);

  syncAttendanceRowFromMembersBySheet_(attendanceSheet, attendanceRow);
}

/**
 * Internal worker: given the Attendance sheet and a row number,
 * overwrite Session Name, Notes and DD Start Date from Members.
 */
function syncAttendanceRowFromMembersBySheet_(attendanceSheet, attendanceRow) {
  const CFG = getNotesSyncConfig_();

  if (!attendanceSheet) throw new Error('Attendance sheet not supplied.');
  if (attendanceRow <= CFG.headerRow) return;

  const ss = attendanceSheet.getParent();
  const membersSheet = ss.getSheetByName(CFG.membersSheetName);
  if (!membersSheet) throw new Error(`Missing sheet "${CFG.membersSheetName}"`);

  const attendanceCols = getHeaderIndexMap_(attendanceSheet, CFG.headerRow);
  const fullNameCol = attendanceCols[CFG.attendanceFullNameHeader];
  const sessionNameCol = attendanceCols[CFG.attendanceSessionNameHeader];
  const notesCol = attendanceCols[CFG.attendanceNotesHeader];
  const intendedPaymentCol = attendanceCols[CFG.attendanceIntendedPaymentHeader];
  const prePayRemainingCol = attendanceCols[CFG.attendancePrePayRemainingHeader];

  if (!fullNameCol) throw new Error(`Attendance missing header "${CFG.attendanceFullNameHeader}"`);
  if (!sessionNameCol) throw new Error(`Attendance missing header "${CFG.attendanceSessionNameHeader}"`);
  if (!notesCol) throw new Error(`Attendance missing header "${CFG.attendanceNotesHeader}"`);
  if (!intendedPaymentCol) throw new Error(`Attendance missing header "${CFG.attendanceIntendedPaymentHeader}"`);
  if (!prePayRemainingCol) throw new Error(`Attendance missing header "${CFG.attendancePrePayRemainingHeader}"`);

  const fullName = String(attendanceSheet.getRange(attendanceRow, fullNameCol).getValue() || '').trim();
  const sessionNameCell = attendanceSheet.getRange(attendanceRow, sessionNameCol);
  const notesCell = attendanceSheet.getRange(attendanceRow, notesCol);
  const intendedPaymentCell = attendanceSheet.getRange(attendanceRow, intendedPaymentCol);
  const prePayRemainingCell = attendanceSheet.getRange(attendanceRow, prePayRemainingCol);

  const props = PropertiesService.getScriptProperties();
  const suppressNotesKey = 'SUPPRESS_ATT_NOTES_ROW';
  const suppressPrePayKey = 'SUPPRESS_ATT_PREPAY_ROW';

  if (!fullName) {
    props.setProperty(suppressNotesKey, String(attendanceRow));
    props.setProperty(suppressPrePayKey, String(attendanceRow));
    try {
      sessionNameCell.setValue('');
      notesCell.setValue('');
      intendedPaymentCell.setValue('');
      prePayRemainingCell.setValue('');
    } finally {
      props.deleteProperty(suppressNotesKey);
      props.deleteProperty(suppressPrePayKey);
    }
    return;
  }

  const member = getMemberRecordByFullName_(membersSheet, fullName);
  const intendedPayment = deriveIntendedPayment_(member);

  props.setProperty(suppressNotesKey, String(attendanceRow));
  props.setProperty(suppressPrePayKey, String(attendanceRow));
  try {
    sessionNameCell.setValue(String(member.sessionName || ''));
    notesCell.setValue(String(member.notes || ''));
    prePayRemainingCell.setValue(member.prePayRemaining === '' ? '' : member.prePayRemaining);
    intendedPaymentCell.setValue(intendedPayment);
  } finally {
    props.deleteProperty(suppressNotesKey);
    props.deleteProperty(suppressPrePayKey);
  }
}

/**
 * Writes a notes string into Members for the given Full Name.
 * Updates the first matching row only.
 */
function writeNotesToMembers_(ss, fullName, notes) {
  const CFG = getNotesSyncConfig_();

  const membersSheet = ss.getSheetByName(CFG.membersSheetName);
  if (!membersSheet) throw new Error(`Missing sheet "${CFG.membersSheetName}"`);

  const membersCols = getHeaderIndexMap_(membersSheet, CFG.headerRow);
  const fullNameCol = membersCols[CFG.membersFullNameHeader];
  const notesCol = membersCols[CFG.membersNotesHeader];

  if (!fullNameCol) throw new Error(`Members missing header "${CFG.membersFullNameHeader}"`);
  if (!notesCol) throw new Error(`Members missing header "${CFG.membersNotesHeader}"`);

  const lastRow = membersSheet.getLastRow();
  if (lastRow <= CFG.headerRow) throw new Error('Members sheet has no data rows.');

  const values = membersSheet
    .getRange(CFG.headerRow + 1, fullNameCol, lastRow - CFG.headerRow, 1)
    .getValues()
    .map(r => String(r[0] || '').trim());

  const target = fullName.trim().toLowerCase();
  const matches = [];

  for (let i = 0; i < values.length; i++) {
    if (values[i].toLowerCase() === target) matches.push(i);
  }

  if (matches.length === 0) {
    throw new Error(`No match in Members for Full Name: "${fullName}"`);
  }

  if (matches.length > 1) {
    console.warn(`Multiple Members matches for "${fullName}". Updating the first match only.`);
  }

  const memberRow = (CFG.headerRow + 1) + matches[0];
  membersSheet.getRange(memberRow, notesCol).setValue(notes);
}

function writePrePayRemainingToMembers_(ss, fullName, prePayRemaining) {
  const CFG = getNotesSyncConfig_();

  const membersSheet = ss.getSheetByName(CFG.membersSheetName);
  if (!membersSheet) throw new Error(`Missing sheet "${CFG.membersSheetName}"`);

  const membersCols = getHeaderIndexMap_(membersSheet, CFG.headerRow);
  const fullNameCol = membersCols[CFG.membersFullNameHeader];
  const prePayRemainingCol = membersCols[CFG.membersPrePayRemainingHeader];

  if (!fullNameCol) throw new Error(`Members missing header "${CFG.membersFullNameHeader}"`);
  if (!prePayRemainingCol) throw new Error(`Members missing header "${CFG.membersPrePayRemainingHeader}"`);

  const lastRow = membersSheet.getLastRow();
  if (lastRow <= CFG.headerRow) throw new Error('Members sheet has no data rows.');

  const values = membersSheet
    .getRange(CFG.headerRow + 1, fullNameCol, lastRow - CFG.headerRow, 1)
    .getValues()
    .map(r => String(r[0] || '').trim());

  const target = fullName.trim().toLowerCase();
  const matches = [];

  for (let i = 0; i < values.length; i++) {
    if (values[i].toLowerCase() === target) matches.push(i);
  }

  if (matches.length === 0) {
    throw new Error(`No match in Members for Full Name: "${fullName}"`);
  }

  if (matches.length > 1) {
    console.warn(`Multiple Members matches for "${fullName}". Updating the first match only.`);
  }

  const memberRow = (CFG.headerRow + 1) + matches[0];
  membersSheet.getRange(memberRow, prePayRemainingCol).setValue(prePayRemaining);
}


/**
 * Builds a header->columnIndex map from a sheet.
 * Column index returned is 1-based (Apps Script convention).
 */
function getHeaderIndexMap_(sheet, headerRow) {
  const lastCol = sheet.getLastColumn();
  const headers = sheet.getRange(headerRow, 1, 1, lastCol).getValues()[0]
    .map(h => String(h || '').trim());

  const map = {};
  for (let i = 0; i < headers.length; i++) {
    if (headers[i]) map[headers[i]] = i + 1;
  }
  return map;
}

/**
 * Central config (single place to change wiring)
 */
function getNotesSyncConfig_() {
  return {
    attendanceSheetName: 'Attendance',
    membersSheetName: 'Members',
    headerRow: 1,

    attendanceFullNameHeader: 'Full Name',
    attendanceSessionNameHeader: 'Session Name',
    attendanceNotesHeader: 'Notes',
    attendanceIntendedPaymentHeader: 'Intended Payment',
    attendancePrePayRemainingHeader: 'PrePay Remaining',

    membersFullNameHeader: 'Full Name',
    membersSessionNameHeader: 'Session Name',
    membersNotesHeader: 'Notes',
    membersDdStartHeader: 'DD Start Date',
    membersConcessionaryHeader: 'Concessionary',
    membersPrePayRemainingHeader: 'PrePay Remaining'
  };
}

/**
 * Returns the first matching member record by exact Full Name match.
 * If not found, returns blank values so the attendance row is cleared.
 */
function getMemberRecordByFullName_(membersSheet, fullName) {
  const CFG = getNotesSyncConfig_();

  const lastCol = membersSheet.getLastColumn();
  const lastRow = membersSheet.getLastRow();
  if (lastRow <= CFG.headerRow) {
    return {
      sessionName: '',
      notes: '',
      ddStartDate: '',
      concessionary: false,
      prePayRemaining: ''
    };
  }

  const headers = membersSheet
    .getRange(CFG.headerRow, 1, 1, lastCol)
    .getValues()[0]
    .map(h => String(h || '').trim());

  const fullNameCol = headers.indexOf(CFG.membersFullNameHeader) + 1;
  const sessionNameCol = headers.indexOf(CFG.membersSessionNameHeader) + 1;
  const notesCol = headers.indexOf(CFG.membersNotesHeader) + 1;
  const ddCol = headers.indexOf(CFG.membersDdStartHeader) + 1;
  const concessionaryCol = headers.indexOf(CFG.membersConcessionaryHeader) + 1;
  const prePayRemainingCol = headers.indexOf(CFG.membersPrePayRemainingHeader) + 1;

  if (!fullNameCol) throw new Error(`Members sheet missing header "${CFG.membersFullNameHeader}"`);
  if (!sessionNameCol) throw new Error(`Members sheet missing header "${CFG.membersSessionNameHeader}"`);
  if (!notesCol) throw new Error(`Members sheet missing header "${CFG.membersNotesHeader}"`);
  if (!ddCol) throw new Error(`Members sheet missing header "${CFG.membersDdStartHeader}"`);
  if (!concessionaryCol) throw new Error(`Members sheet missing header "${CFG.membersConcessionaryHeader}"`);
  if (!prePayRemainingCol) throw new Error(`Members sheet missing header "${CFG.membersPrePayRemainingHeader}"`);

  const data = membersSheet.getRange(CFG.headerRow + 1, 1, lastRow - CFG.headerRow, lastCol).getValues();
  const target = String(fullName || '').trim().toLowerCase();

  for (let i = 0; i < data.length; i++) {
    const existing = String(data[i][fullNameCol - 1] || '').trim().toLowerCase();
    if (existing && existing === target) {
      return {
        sessionName: data[i][sessionNameCol - 1] || '',
        notes: data[i][notesCol - 1] || '',
        ddStartDate: data[i][ddCol - 1] || '',
        concessionary: data[i][concessionaryCol - 1] === true,
        prePayRemaining: normalisePrePayRemaining_(data[i][prePayRemainingCol - 1])
      };
    }
  }

  return {
    sessionName: '',
    notes: '',
    ddStartDate: '',
    concessionary: false,
    prePayRemaining: ''
  };
}

function deriveIntendedPayment_(member) {
  if (member.concessionary === true) return 'Concessionary';
  if (Number(member.prePayRemaining || 0) > 0) return 'PrePaid';
  if (hasMeaningfulValue_(member.ddStartDate)) return 'Direct Debit';
  return '';
}

function normalisePrePayRemaining_(value) {
  if (value === '' || value === null || typeof value === 'undefined') return '';
  const num = Number(value);
  return isNaN(num) ? '' : num;
}

function hasMeaningfulValue_(value) {
  if (value === null || typeof value === 'undefined' || value === '') return false;

  if (Object.prototype.toString.call(value) === '[object Date]') {
    return !isNaN(value);
  }

  return String(value).trim() !== '';
}



/**
 * Backward-compatible wrappers if anything else still calls these.
 */
function getMemberSessionNameByFullName_(membersSheet, fullName) {
  return getMemberRecordByFullName_(membersSheet, fullName).sessionName || '';
}

function getMemberNotesByFullName_(membersSheet, fullName) {
  return getMemberRecordByFullName_(membersSheet, fullName).notes || '';
}

function getMemberDdStartDateByFullName_(membersSheet, fullName) {
  return getMemberRecordByFullName_(membersSheet, fullName).ddStartDate || '';
}