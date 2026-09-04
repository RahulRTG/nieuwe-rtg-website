/* Kantoren, deel "bank": RTG Bank vanuit de boardroom. De 3-standen knop
   (partner -> hybride -> eigen) waarmee RTG in de toekomst met één druk de eigen
   bank + het eigen betaalsysteem aanzet, plus de bank-gezondheid, de rekeningen,
   de rood-staan-ruimte, de spaarrente en de renteronde. Alles achter de office-
   inlog; elke schakeling komt in het auditlog. Afgesplitst uit kantoren/index.js. */
/* Wie handelt hier: uit de canonieke envelop en niet uit req.boardroomKey
   (TAKEN.md 4.72). Zie server/opzet/envelop.js voor waarom die lezer bestaat. */
const { wie: envelopWie } = require('../../opzet/envelop');

module.exports = (ctx) => {
  const { app, officeAuth, boardroomAuth, veilig, afdelingen, sseToOffice, kern } = ctx;
  const bank = kern.bank;
  /* WIE DOET DIT? UIT DE SESSIE, NOOIT UIT DE BODY.

     Hier stond `req.body.naam ? String(req.body.naam) : 'boardroom'`: een vrij
     tekstveld met een vaste terugval. Daarmee was het auditspoor te vervalsen,
     en -- erger -- bestond het VIER-OGEN-PRINCIPE op het opschalen van RTG Bank
     feitelijk niet. autorisatie.js vergelijkt aanvrager en bevestiger, maar
     allebei kwamen ze hiervandaan: aanvragen als 'Alice', bevestigen als 'Bob',
     met EEN sessie. Je hoefde niet eens een tweede naam te verzinnen, want
     zonder veld viel hij terug op 'boardroom'. Twee calls, en de clearing van
     het hele huis lag om: modus 'eigen' zet de bank operationeel en de
     kaart-rails uit.

     De oorzaak zat niet in de vergelijking maar in de BRON: officeAuth hangt aan
     een sessie zonder identiteit -- een gedeelde code, geen persoon. Alles wat
     opschaalt staat daarom achter boardroomAuth, die req.boardroomKey levert.
     Blijft een route op de gedeelde code, dan zeggen we dat ook zo; precies wat
     routes/office/werk.js al deed. */
  const naam = req => envelopWie(req) || 'backoffice (gedeelde code)';
  const sync = () => sseToOffice('sync', { scope: 'bank' });

  // het volledige bord: regie (de knop), gezondheid en de rekeningen
  app.post('/api/office/bank', officeAuth, (req, res) => veilig(res, () => bank.overzicht()));
  app.post('/api/office/bank/gezond', officeAuth, (req, res) => veilig(res, () => bank.gezondheid()));

  /* De knop: een stand kiezen, één slag verder/terug draaien, en de bank aan-
     of uitzetten als uitgevende partij. Verder draaien kan alleen als de bank
     operationeel is; dat bewaakt de bankregie zelf. */
  /* De knop schakelt via vier-ogen bij het OPSCHALEN: opschalen levert
     needsAuth (wacht op een tweede persoon), afschalen gaat direct. */
  function relais(req, r, wat) {
    if (!r || r.error) return r;
    if (r.needsAuth) afdelingen.audit(naam(req), wat + ' AANGEVRAAGD -- wacht op een tweede persoon');
    else if (!r.ongewijzigd) { afdelingen.audit(naam(req), wat + ' uitgevoerd'); sync(); }
    return r;
  }
  app.post('/api/office/bank/modus', boardroomAuth, (req, res) => veilig(res, () =>
    relais(req, kern.bankModusZet({ modus: String(req.body.modus || ''), wie: naam(req) }), 'RTG Bank-stand "' + String(req.body.modus || '') + '"')));
  app.post('/api/office/bank/draai', boardroomAuth, (req, res) => veilig(res, () => req.body.terug === true
    ? relais(req, kern.bankDraaiTerug({ wie: naam(req) }), 'RTG Bank-knop terug')
    : relais(req, kern.bankDraai({ wie: naam(req) }), 'RTG Bank-knop een slag verder')));
  app.post('/api/office/bank/operationeel', boardroomAuth, (req, res) => veilig(res, () =>
    relais(req, kern.bankOperationeelZet({ aan: req.body.aan === true, wie: naam(req) }), 'RTG Bank ' + (req.body.aan === true ? 'operationeel aan' : 'operationeel uit'))));

  // de tweede persoon bevestigt (of iemand trekt in) een openstaande autorisatie
  app.post('/api/office/bank/autoriseer/bevestig', boardroomAuth, (req, res) => veilig(res, () => {
    const r = kern.bankAutoriseerBevestig({ id: String(req.body.id || ''), door: naam(req) });
    if (r.ok) { afdelingen.audit(naam(req), 'RTG Bank-autorisatie bevestigd (2e persoon): ' + r.uitgevoerd + ' -> stand ' + r.modus + (r.operationeel ? ', operationeel' : '')); sync(); }
    return r;
  }));
  app.post('/api/office/bank/autoriseer/annuleer', boardroomAuth, (req, res) => veilig(res, () => {
    const r = kern.bankAutoriseerAnnuleer({ wie: naam(req) });
    if (r.ok) { afdelingen.audit(naam(req), 'RTG Bank-autorisatie ingetrokken'); sync(); }
    return r;
  }));

  /* Nood-fallback: noodstop (clearing valt terug op de kaart-rails), herstel, en
     het melden van een mislukte clearing (trip automatisch nood bij de drempel). */
  app.post('/api/office/bank/nood', officeAuth, (req, res) => veilig(res, () => {
    const r = kern.bankNoodMeld({ reden: req.body.reden, wie: naam(req) });
    if (r.ok) { afdelingen.audit(naam(req), 'RTG Bank NOODSTOP -- clearing valt terug op de kaart-rails'); sync(); }
    return r;
  }));
  app.post('/api/office/bank/herstel', officeAuth, (req, res) => veilig(res, () => {
    const r = kern.bankNoodHerstel({ wie: naam(req) });
    if (r.ok) { afdelingen.audit(naam(req), 'RTG Bank noodstop hersteld -- clearing volgt weer de stand'); sync(); }
    return r;
  }));
  app.post('/api/office/bank/mislukking', officeAuth, (req, res) => veilig(res, () => {
    // `sleutel` hoort bij de mislukte clearing zelf, niet bij de oproep (4.56)
    const r = kern.bankClearingMislukt(req.body.reden, req.body.sleutel || req.body.idem);
    if (r.getript) { afdelingen.audit(naam(req), 'RTG Bank AUTOMATISCH in nood na ' + r.mislukt + ' mislukte clearings'); sync(); }
    return { ok: true, ...r };
  }));

  // de leden-bank live zetten (zichtbaar in de app) of weer sluiten
  app.post('/api/office/bank/leden', officeAuth, (req, res) => veilig(res, () => {
    const r = kern.bankLedenZet({ aan: req.body.aan === true, wie: naam(req) });
    if (r.ok) { afdelingen.audit(naam(req), 'RTG Bank voor leden ' + (r.ledenAan ? 'LIVE gezet' : 'gesloten')); sync(); }
    return r;
  }));
  app.post('/api/office/bank/instellingen', officeAuth, (req, res) => veilig(res, () => {
    const r = kern.bankInstellingenZet(req.body || {});
    /* De plafonds staan APART in het auditspoor en niet samengevat als
       "instellingen gewijzigd": ze zijn de grond onder een besluit, en wie
       later vraagt wanneer die grond is verzet, hoort dat te kunnen lezen. */
    if (r.ok) { afdelingen.audit(naam(req), 'RTG Bank-instellingen gewijzigd (spaarrente ' + (r.spaarrenteBp / 100) +
      '%, walletplafond EUR ' + (r.walletPlafondCenten / 100) + ', punten-tegoedplafond EUR ' + (r.puntenTegoedMaxCenten / 100) + ')'); sync(); }
    return r;
  }));

  // rekeningen: voor een lid openen, rood-staan-ruimte zetten, bevriezen, afschrift
  /* De bankZAKEN -- rekeningen, rood staan, afschriften, rente, krediet,
     salaris en incasso -- staan in ./bank-rekeningen. Dit bestand gaat over de
     REGIE: de drie-standen-knop, het vier-ogen-principe erop en de noodstop.
     Twee onderwerpen, en samen pasten ze niet meer onder de 10 KB. */
  /* De RECONCILIATIE (wat is er geboekt maar nog niet buiten RTG afgerond) en
     de BEVOEGDHEID (wat mag RTG zelf) staan in ./bank-bevoegd. Allebei gaan ze
     over de grens tussen RTG en de buitenwereld; dit bestand gaat over de
     stand van het huis zelf. */
  require('./bank-bevoegd')(Object.assign({}, ctx, { naam }));
  require('./bank-rekeningen')(Object.assign({}, ctx, { naam }));
};
