/* Domein "office" (aparte module op de gedeelde kern). Alleen de routes;
   de helpers blijven in de kern (server.js) en komen via het kern-object binnen. */
module.exports = (kern) => {
  const { OFFICE_CODE, UPLOAD_DIR, accounts, app, appUrl, archief, broadcastSync, conciergeInbox, crypto, db, eigenaar, ensureSupplierDefaults, fs, loginFails, mail, makeSupplierCode, noteFailedTry, notify, notifySupplier, officeAuth, officeState, path, talen, trChat, pendingVerifications, rememberSession, save, schoon, sessionFor, sseClients, sseToOffice, sseToSupplier, tooManyTries, totpOk, veiligGelijk, logInlog, paspoortIncidenten, paspoortBeoordeel, salonProfielCompleet, salonItemsVan, ontmoetKantoorState, ontmoetSosAf, ontmoetSignaalLid } = kern;

  // backoffice-toegang via een query-token (stream/export/doc): een echte
  // office-sessie, OF de eigenaar met zijn eigen accountlogin.
  const officeQueryMag = (token) => {
    const sess = sessionFor(String(token || ''));
    if (sess && sess.role === 'office') return true;
    try { return eigenaar.isEigenaar(accounts, accounts.verifyToken(String(token || ''))); } catch (e) { return false; }
  };

  /* De vier domeindelen draaien als submodules op de gedeelde kern plus de
     query-toegangshelper, een keer gemount bij het opstarten. */
  const octx = { kern, officeQueryMag };
  require('./office/veiligheid')(octx);
  require('./office/partners')(octx);
  require('./office/toegang')(octx);
  require('./office/werk')(octx);
  require('./office/concierge')(octx);
};
