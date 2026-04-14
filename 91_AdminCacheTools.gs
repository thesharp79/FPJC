/**
 * Support tooling for cache maintenance and repeatable sign-in testing.
 */
function clearSignInCachesFromMenu() {
  const ui = SpreadsheetApp.getUi();
  const todayIso = Utilities.formatDate(new Date(), SIGNIN_CFG.timezone, 'yyyy-MM-dd');

  const dateResponse = ui.prompt(
    'Clear sign-in caches',
    'Enter session date (YYYY-MM-DD). Leave blank to use today (' + todayIso + ').',
    ui.ButtonSet.OK_CANCEL
  );
  if (dateResponse.getSelectedButton() !== ui.Button.OK) {
    return;
  }

  let sessionDateIso = String(dateResponse.getResponseText() || '').trim();
  if (!sessionDateIso) {
    sessionDateIso = todayIso;
  }

  const basketResponse = ui.prompt(
    'Clear sign-in caches',
    'Optional: enter a Basket ID to clear basket-specific caches. Leave blank to skip.',
    ui.ButtonSet.OK_CANCEL
  );
  if (basketResponse.getSelectedButton() !== ui.Button.OK) {
    return;
  }

  const basketId = String(basketResponse.getResponseText() || '').trim();

  try {
    const result = adminClearSignInCaches(sessionDateIso, basketId);
    ui.alert(
      'Sign-in caches cleared',
      'Session date cache: ' + result.clearedDateCache + '\n' +
      'Basket cache: ' + (result.clearedBasketId || 'Not requested') + '\n\n' +
      'Tip: use this after manually deleting Attendance rows during repeat testing.',
      ui.ButtonSet.OK
    );
  } catch (err) {
    ui.alert(
      'Clear sign-in caches failed',
      String(err && err.message ? err.message : err),
      ui.ButtonSet.OK
    );
  }
}
