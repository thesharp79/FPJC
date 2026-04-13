function loadMembers_() {
  if (SIGNIN_RUNTIME_CACHE_.members) return SIGNIN_RUNTIME_CACHE_.members;

  const cache = CacheService.getScriptCache();
  try {
    const cached = cache.get('signin_members_v2');
    if (cached) {
      const parsed = JSON.parse(cached);
      SIGNIN_RUNTIME_CACHE_.members = parsed;
      return parsed;
    }
  } catch (e) {}

  const sheet = getMembersSheet_();
  const payload = getSheetPayload_(sheet);
  if (payload.values.length < 2) return [];

  const idx = payload.headerMap;
  const members = [];

  for (let r = 1; r < payload.values.length; r++) {
    const row = payload.values[r];
    const fullName = String(row[requireHeader_(idx, SIGNIN_CFG.membersHeaders.fullName)] || '').trim();
    if (!fullName) continue;

    const member = {
      rowNumber: r + 1,
      status: String(row[requireHeader_(idx, SIGNIN_CFG.membersHeaders.status)] || '').trim(),
      fullName: fullName,
      dobRaw: row[requireHeader_(idx, SIGNIN_CFG.membersHeaders.dob)],
      dobIso: normaliseSheetDateToIso_(row[requireHeader_(idx, SIGNIN_CFG.membersHeaders.dob)]),
      sessionName: String(row[requireHeader_(idx, SIGNIN_CFG.membersHeaders.sessionName)] || '').trim(),
      bjaNumber: String(row[requireHeader_(idx, SIGNIN_CFG.membersHeaders.bjaNumber)] || '').trim(),
      ddStartDate: row[requireHeader_(idx, SIGNIN_CFG.membersHeaders.ddStartDate)],
      concessionary: asBoolean_(row[requireHeader_(idx, SIGNIN_CFG.membersHeaders.concessionary)]),
      prePayRemaining: normaliseWholeNumber_(row[requireHeader_(idx, SIGNIN_CFG.membersHeaders.prePayRemaining)]),
      notes: String(row[requireHeader_(idx, SIGNIN_CFG.membersHeaders.notes)] || '').trim()
    };

    member.memberKey = buildMemberKey_(member);
    member.initials = toInitials_(member.fullName);
    members.push(member);
  }

  SIGNIN_RUNTIME_CACHE_.members = members;
  try {
    cache.put('signin_members_v2', JSON.stringify(members), 120);
  } catch (e) {}
  return members;
}

function getMembersByKey_() {
  if (SIGNIN_RUNTIME_CACHE_.membersByKey) return SIGNIN_RUNTIME_CACHE_.membersByKey;
  const members = loadMembers_();
  const map = {};
  for (let i = 0; i < members.length; i++) {
    map[members[i].memberKey] = members[i];
  }
  SIGNIN_RUNTIME_CACHE_.membersByKey = map;
  return map;
}

function getMemberByRow_(rowNumber) {
  if (!SIGNIN_RUNTIME_CACHE_.membersByRow) {
    const members = loadMembers_();
    const map = {};
    for (let i = 0; i < members.length; i++) {
      map[members[i].rowNumber] = members[i];
    }
    SIGNIN_RUNTIME_CACHE_.membersByRow = map;
  }
  const member = SIGNIN_RUNTIME_CACHE_.membersByRow[Number(rowNumber)];
  if (!member) throw new Error('Selected member was not found.');
  return member;
}

function setMemberPrePayRemaining_(memberKey, newValue) {
  const member = getMemberByKey_(memberKey);
  if (!member) throw new Error('Could not update PrePay Remaining for member.');

  const sheet = getMembersSheet_();
  const meta = getHeaderMeta_(sheet);
  const idx = meta.headerMap;
  const prePayCol = requireHeader_(idx, SIGNIN_CFG.membersHeaders.prePayRemaining);
  sheet.getRange(member.rowNumber, prePayCol + 1).setValue(Number(newValue || 0));

  invalidateSheetRuntimeCache_(sheet);
}

function updateMemberPrePayRemainingBatch_(updates) {
  if (!updates || !updates.length) return;

  const sheet = getMembersSheet_();
  const meta = getHeaderMeta_(sheet);
  const idx = meta.headerMap;
  const colIndex = requireHeader_(idx, SIGNIN_CFG.membersHeaders.prePayRemaining) + 1;

  for (let i = 0; i < updates.length; i++) {
    const u = updates[i];
    if (!u || !u.memberKey) continue;
    const member = getMemberByKey_(u.memberKey);
    sheet.getRange(member.rowNumber, colIndex).setValue(Number(u.newValue || 0));
  }

  invalidateSheetRuntimeCache_(sheet);
}
