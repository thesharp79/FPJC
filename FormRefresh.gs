/**
 * ============================================================
 * Google Form Membership Dropdown Refresher (Calc-driven)
 * ============================================================
 *
 * WHAT THIS SCRIPT DOES
 *   1) Reads four member lists from the spreadsheet tab "Calc":
 *        - Viper Active
 *        - Junior Active
 *        - Youth Active
 *        - Senior Active
 *
 *   2) Updates the corresponding Google Form dropdown questions:
 *        - "Viper Name"   inside "Vipers Class"
 *        - "Junior Name"  inside "Juniors Class"
 *        - "Youth Name"   inside "Youths Class"
 *        - "Senior Name"  inside "Seniors Class"
 *
 *   3) Updates the "Session Name" multiple choice question so each option
 *      branches to the right class section (Page Break).
 *
 * IMPORTANT DESIGN POINT
 *   All business logic (Active filtering, session allocation, sorting, etc.)
 *   lives in the Sheet formulas on "Calc". This script ONLY reads results and
 *   pushes them into the Form. That keeps code simple and maintainable.
 *
 * MAINTENANCE NOTES FOR VOLUNTEERS
 *   - If names look wrong, fix the formulas/data on the "Calc" tab first.
 *   - If the Form item titles change, update CONFIG titles below.
 *   - If the Calc headers change, update CONFIG.calcHeaders below.
 */

/**
 * MAIN ENTRY POINT
 * Run this manually, or on a time-based trigger (e.g. nightly).
 */
function buildOrRefreshForm() {
  const spreadsheetId = getScriptPropertyRequiredForFormRefresh_('SPREADSHEET_ID');
  const CONFIG = {
    // IDs for the specific form and sheet we manage
    formId: '1RCPr7e2KfCvfdFSENZrL_8t0PUY93NYBqR77CxmYb38',
    sheetId: spreadsheetId,

    // The tab that contains the 4 pre-built name lists
    calcTabName: 'Calc',

    // Column headers in Calc (row 1) that contain the active names for each class
    // These MUST match the Calc header text exactly.
    calcHeaders: {
      Vipers:  'Viper Active',
      Juniors: 'Junior Active',
      Youths:  'Youth Active',
      Seniors: 'Senior Active',
    },

    // Form titles - the script matches these EXACTLY (including spacing/case).
    // If you rename questions/sections in the Form, update these strings.
    section1DateTitle: 'Session Date',
    section1ClassTitle: 'Session Name',
    newMemberSectionTitle: 'New Member Details',

    // The classes we support and where to route each one in the Form
    classes: [
      { key: 'Vipers',  page: 'Vipers Class',  payment: 'Viper Payment',  name: 'Viper Name'  },
      { key: 'Juniors', page: 'Juniors Class', payment: 'Junior Payment', name: 'Junior Name' },
      { key: 'Youths',  page: 'Youths Class',  payment: 'Youth Payment',  name: 'Youth Name'  },
      { key: 'Seniors', page: 'Seniors Class', payment: 'Senior Payment', name: 'Senior Name' },
    ],

    // Sentinel option shown at the top of each name dropdown
    sentinelNewMember: "I'm a new member",

    // Payment config (currently NOT applied because you commented it out previously)
    fixedPaymentChoices: ['Free', 'Direct Debit', 'Card', 'Cash', 'Pre-Paid'],
    freeValue: 'Free'
  };

  Logger.log('--- buildOrRefreshForm START ---');

  // ------------------------------------------------------------
  // 1) Open Form + Spreadsheet and validate required tabs exist
  // ------------------------------------------------------------
  const form = FormApp.openById(CONFIG.formId);
  const ss   = SpreadsheetApp.openById(CONFIG.sheetId);
  const calc = ss.getSheetByName(CONFIG.calcTabName);
  if (!calc) throw new Error(`Missing sheet "${CONFIG.calcTabName}"`);

  Logger.log(`Using Form ID: ${CONFIG.formId}`);
  Logger.log(`Using Sheet ID: ${CONFIG.sheetId}`);
  Logger.log(`Reading from tab: ${CONFIG.calcTabName}`);

  // ------------------------------------------------------------
  // 2) Ensure "Session Date" exists (safe to create)
  //    If you want "no creation ever", replace with a throw.
  // ------------------------------------------------------------
  let sessionDate = findItem_(form, FormApp.ItemType.DATE, CONFIG.section1DateTitle)?.asDateItem();
  if (!sessionDate) {
    Logger.log(`"${CONFIG.section1DateTitle}" not found; creating Date item.`);
    sessionDate = form.addDateItem().setTitle(CONFIG.section1DateTitle).setRequired(true);
  }

  // ------------------------------------------------------------
  // 3) "Session Name" must exist (we DO NOT create it)
  //    This drives branching to the correct class section.
  // ------------------------------------------------------------
  const sessionNameItem = findItem_(form, FormApp.ItemType.MULTIPLE_CHOICE, CONFIG.section1ClassTitle)
    ?.asMultipleChoiceItem();

  if (!sessionNameItem) {
    throw new Error(`Missing "${CONFIG.section1ClassTitle}" (Multiple choice). Add it to Section 1 and re-run.`);
  }

  // ------------------------------------------------------------
  // 4) New Member Details section must exist (for routing from payment "Free")
  // ------------------------------------------------------------
  const newMemberPage = findItem_(form, FormApp.ItemType.PAGE_BREAK, CONFIG.newMemberSectionTitle)
    ?.asPageBreakItem();
  if (!newMemberPage) throw new Error(`Missing section "${CONFIG.newMemberSectionTitle}".`);

  // ------------------------------------------------------------
  // 5) Read Calc data and locate column indexes by header name
  // ------------------------------------------------------------
  const calcData = calc.getDataRange().getValues();  // includes header row
  if (calcData.length < 2) {
    throw new Error(`"${CONFIG.calcTabName}" has headers but no data rows.`);
  }

  const headers = calcData[0].map(h => String(h || '').trim());
  const headerIndex = {};
  headers.forEach((h, i) => headerIndex[h] = i);

  // Confirm every required header exists, and build a lookup for column index per class
  const colIndexByClass = {};
  for (const cls of CONFIG.classes) {
    const expectedHeader = CONFIG.calcHeaders[cls.key];
    if (!expectedHeader) throw new Error(`CONFIG.calcHeaders missing mapping for class "${cls.key}"`);

    if (!(expectedHeader in headerIndex)) {
      throw new Error(
        `Calc tab missing header "${expectedHeader}". ` +
        `Found headers: ${headers.join(' | ')}`
      );
    }

    colIndexByClass[cls.key] = headerIndex[expectedHeader];
  }

  Logger.log('Calc headers validated and column indexes resolved.');

  // ------------------------------------------------------------
  // 6) Build member sets per class from Calc columns
  //    - Uses Set() to dedupe
  //    - Ignores blanks
  // ------------------------------------------------------------
  const namesByClass = new Map(CONFIG.classes.map(c => [c.key, new Set()]));

  // Start at row index 1 (row 2 in the sheet) because index 0 is headers
  for (let r = 1; r < calcData.length; r++) {
    const row = calcData[r];

    for (const cls of CONFIG.classes) {
      const ci = colIndexByClass[cls.key];
      const name = String(row[ci] || '').trim();
      if (name) namesByClass.get(cls.key).add(name);
    }
  }

  // Log count per class (helps detect formula issues quickly)
  for (const cls of CONFIG.classes) {
    Logger.log(`${cls.key}: ${namesByClass.get(cls.key).size} names loaded from Calc`);
  }

  // ------------------------------------------------------------
  // 7) Map PageBreak sections by title so we can branch correctly
  // ------------------------------------------------------------
  const pageBreaksByTitle = new Map();
  for (const it of form.getItems(FormApp.ItemType.PAGE_BREAK)) {
    pageBreaksByTitle.set(String(it.getTitle() || '').trim(), it.asPageBreakItem());
  }

  // ------------------------------------------------------------
  // 8) Configure "Session Name" branching to each class page
  // ------------------------------------------------------------
  const sessionChoices = CONFIG.classes.map(c => {
    const page = pageBreaksByTitle.get(c.page);
    if (!page) {
      throw new Error(`Missing section "${c.page}". Create it in the Form and re-run.`);
    }
    return sessionNameItem.createChoice(c.key, page);
  });
  sessionNameItem.setChoices(sessionChoices).setRequired(true);

  Logger.log(`Updated "${CONFIG.section1ClassTitle}" branching choices.`);

  // ------------------------------------------------------------
  // 9) Update each class Name dropdown from Calc list
  // ------------------------------------------------------------
  const newIdx = getItemIndex_(form, newMemberPage);

  for (const c of CONFIG.classes) {
    const page = pageBreaksByTitle.get(c.page);
    const classIdx = getItemIndex_(form, page);

    // Used only if you later re-enable payment branching logic
    const canJumpForward = (newIdx !== -1 && classIdx !== -1 && newIdx > classIdx);

    // Validate required form items exist (update-only, no creation here)
    const nameItem = findItem_(form, FormApp.ItemType.LIST, c.name)?.asListItem();
    if (!nameItem) {
      throw new Error(`Missing item "${c.name}" inside "${c.page}". Add it and re-run.`);
    }

    const payItem = findItem_(form, FormApp.ItemType.MULTIPLE_CHOICE, c.payment)?.asMultipleChoiceItem();
    if (!payItem) {
      throw new Error(`Missing item "${c.payment}" inside "${c.page}". Add it and re-run.`);
    }

    // Create sorted list of names
    const namesSorted = Array.from(namesByClass.get(c.key) || [])
      .sort((a, b) => a.localeCompare(b, 'en-GB'));

    // Final dropdown labels: sentinel first
    const labels = [CONFIG.sentinelNewMember, ...namesSorted];

    // Defensive two-step refresh (helps Form UI reliably reflect latest)
    nameItem.setChoices([nameItem.createChoice(CONFIG.sentinelNewMember)]);
    nameItem.setChoices(labels.map(l => nameItem.createChoice(l))).setRequired(true);

    Logger.log(`Updated "${c.name}" with ${labels.length} choices (${namesSorted.length} members + sentinel).`);

    // Payment overwrite is currently disabled to avoid clobbering manual form tweaks.
    // Uncomment if you want the script to enforce payment options again.
    /*
    const payChoices = CONFIG.fixedPaymentChoices.map(opt => {
      const nav = (opt === CONFIG.freeValue && canJumpForward)
        ? newMemberPage
        : FormApp.PageNavigationType.CONTINUE;
      return payItem.createChoice(opt, nav);
    });
    payItem.setChoices(payChoices).setRequired(true);
    */
  }

  Logger.log('--- buildOrRefreshForm END ---');
}

function getScriptPropertyRequiredForFormRefresh_(propertyName) {
  const value = PropertiesService.getScriptProperties().getProperty(propertyName);
  if (value === null || String(value).trim() === '') {
    throw new Error('Missing required Script Property: ' + propertyName);
  }
  return String(value).trim();
}


/**
 * findItem_()
 * Find a form item by exact title and type.
 * This avoids accidental updates to similarly named fields.
 */
function findItem_(form, type, title) {
  const items = form.getItems(type);
  const target = String(title || '').trim();
  for (const it of items) {
    if (String(it.getTitle() || '').trim() === target) return it;
  }
  return null;
}


/**
 * getItemIndex_()
 * Return the zero-based index of an item in the full form item order.
 * Used for determining "forward navigation" (when enabled).
 */
function getItemIndex_(form, item) {
  const items = form.getItems();
  return items.findIndex(it => it.getId() === item.getId());
}
