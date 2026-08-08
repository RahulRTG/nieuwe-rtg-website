/* Domein "office" (aparte module op de gedeelde kern). Alleen de routes;
   de helpers blijven in de kern (server.js) en komen via het kern-object binnen. */
module.exports = (kern) => {
  const { accounts, eigenaar, sessionFor } = kern;

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
  require('./office/bewaarverzoek')(octx);
  require('./office/concierge')(octx);
  /* De ledenbalie: de derde poort van het kantoor. Zie ./office/balie.js. */
  /* De ledenbalie hangt in server/routes/ledenbalie.js, met een eigen zetel en
     een eigen kern (kern/ledenbalie*.js). Hier stond een TWEEDE balie uit een
     andere tak die dezelfde routes registreerde -- en dan wint de eerste stil
     terwijl de rest dode code is. scripts/check.js ving dat. Een deur per
     kamer. */
};
