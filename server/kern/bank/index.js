/* RTG Bank: de eigen bank van het huis, gebouwd OP het RTG Pay-grootboek en met
   dezelfde tucht: elke beweging is een dubbele boeking, de som van alle saldi is
   altijd exact nul, en klantrekeningen kunnen nooit verder onder nul dan hun
   rood-staan-limiet. Dit is de laag die RTG straks in staat stelt de eigen bank
   te zijn; de 3-standen knop in de boardroom (kern/bankregie) bepaalt of stortingen
   clearen via de externe kaart-naad (partner), via eigen emissie (eigen) of allebei
   (hybride).

   Waarom een EIGEN grootboek naast RTG Pay, en niet hetzelfde? Pay is de wallet
   voor het dagelijkse tikken (kleine bedragen, harde caps, nooit rood). De bank is
   de rekening: hogere bedragen, rood staan, sparen met rente, zakelijk. Ze delen
   de boekhoud-tucht, niet de plafonds. Een brug (kern/bank/overboeken) verhuist
   geld netjes tussen de wallet en de betaalrekening, elk grootboek blijft sluiten.

   Rekening-identiteit hangt aan de codenaam (dezelfde sociale identiteit als de
   wallet); het IBAN is het adres. Dit is de orkestrator: de grootboekmotor, de
   gezondheid/afschriften en het boardroom-overzicht wonen hier; de rekeningen en
   IBAN-uitgifte in ./rekeningen, het overboeken/storten in ./overboeken, sparen +
   rente in ./sparen. */

module.exports = (deps) => {
  const { db, save, crypto, schoon, betaal, pay, bankregie, keyVanCodenaam, accounts, sseToCustomer, sseToOffice, anthropic, betaalOpdrachten } = deps;
  const nu = () => Date.now();
  const d = () => db.data;

  // CUTOVER-modus (RTG_MOTOR_GELD=motor): de Rust-motor wordt OOK voor de bank het
  // autoritatieve saldi-grootboek (tweede, aparte Ledger naast pay). Anders dan pay
  // doet de motor een RAUWE apply: de rijke bank-guard (rekening bestaat, bevroren,
  // rood-staan-bodem) blijft hier in JS, want die leunt op de rekening-metadata die
  // hier woont. Standaard uit -> geldModus 'schaduw' = JS blijft de baas, exact als
  // voorheen (de synchrone boek-guard).
  const motorklant = require('./motorklant')();
  const geldModus = motorklant.aan ? 'motor' : 'schaduw';

  const MIN_CENTEN = 1;
  const MAX_CENTEN = 100000000;      // tot 1 miljoen euro per boeking (bank, geen wallet)
  const SOORTEN = { betaal: 'Betaalrekening', spaar: 'Spaarrekening', zakelijk: 'Zakelijke rekening' };

  function saldi() { if (!d().bankSaldi || typeof d().bankSaldi !== 'object') d().bankSaldi = {}; return d().bankSaldi; }
  function grootboek() { if (!Array.isArray(d().bankBoekingen)) d().bankBoekingen = []; return d().bankBoekingen; }
  function rekeningen() { if (!d().bankRekeningen || typeof d().bankRekeningen !== 'object') d().bankRekeningen = {}; return d().bankRekeningen; }

  const isExtern = rek => rek.startsWith('extern:') || rek.startsWith('rtg:');
  const saldoVan = rek => Math.round(saldi()[rek] || 0);
  const rekMeta = iban => rekeningen()[iban] || null;
  const id = p => (p || 'BB') + crypto.randomBytes(5).toString('hex').toUpperCase();

  // de bodem van een rekening: extern/rtg mag onbeperkt negatief (dat IS de bank);
  // een betaalrekening mag tot haar rood-staan-limiet; sparen/zakelijk nooit rood.
  function bodem(rek) {
    if (isExtern(rek)) return -Infinity;
    const m = rekMeta(rek);
    if (m && m.soort === 'betaal') return -Math.max(0, Math.round(m.roodLimiet || 0));
    return 0;
  }

  function seintje(codenaam) {
    try { Promise.resolve(keyVanCodenaam(codenaam)).then(t => { if (t && t.key) sseToCustomer(t.key, 'sync', { scope: 'bank' }); }).catch(() => {}); } catch (e) {}
  }

  /* Het office-bord live houden: elke boeking geeft een seintje naar de open
     boardroom-schermen. Gedebounced (een korte tik na de laatste boeking),
     zodat een bulkrun van duizenden posten niet duizenden events stuurt. */
  let bordTimer = null;
  function bordSeintje() {
    if (!sseToOffice || bordTimer) return;
    bordTimer = setTimeout(() => { bordTimer = null; try { sseToOffice('sync', { scope: 'bank' }); } catch (e) {} }, 250);
    if (bordTimer.unref) bordTimer.unref();
  }

  /* De boekhoudmotor + de cutover-naad naar de Rust-motor leven in ./grootboek:
     de guard/apply, de synchrone `boek`, het async choke-point `boekAsync` met
     het serialisatie-slot, de herstart-reconcile, de sluitcontrole en de drift-
     stand voor het statusbord. */
  const { boek, boekAsync, reconcileVanMotor, sluitcontrole, motorStand } = require('./grootboek')({
    MIN_CENTEN, MAX_CENTEN, saldi, grootboek, saldoVan, rekMeta, isExtern, bodem,
    id, schoon, nu, save, d, geldModus, motorklant, bordSeintje });

  /* DE BETAALOPDRACHTEN: alles wat het huis verlaat krijgt een eigen rij naast
     de boeking, want "geboekt" en "de rail heeft het aangenomen" zijn twee
     gebeurtenissen die los van elkaar mislukken. De bedrading naar de rail staat
     in ./uitgang; het gat dat dit dicht in ../betaalopdracht/index.js. */
  const opdrachten = require('./uitgang')({ opdrachten: betaalOpdrachten, boekAsync, rekMeta, seintje });

  // de gedeelde context voor de deelbestanden
  const ctx = { db, save, crypto, schoon, betaal, pay, bankregie, keyVanCodenaam, accounts, anthropic,
    nu, d, MIN_CENTEN, MAX_CENTEN, SOORTEN, saldi, grootboek, rekeningen, rekMeta, saldoVan, isExtern, id, boek, boekAsync, geldModus, bodem, seintje, opdrachten };

  const rek = require('./rekeningen')(ctx);
  const over = require('./overboeken')(ctx);
  const brug = require('./walletbrug')(ctx);
  const spaar = require('./sparen')(ctx);
  const pas = require('./passen')(ctx);
  const krediet = require('./krediet')(ctx);
  const incasso = require('./incasso')(ctx);
  const zakelijk = require('./zakelijk')(ctx);
  const advies = require('./advies')(ctx);
  // het financiele hart leunt op de rekening-opening (auto-spaarpot bij de veeg)
  ctx.rekeningOpen = rek.rekeningOpen;
  const hart = require('./hart')(ctx);

  /* Het afschrift, de gezondheid en het boardroom-overzicht: alleen lezen,
     en daarom apart in ./bord. */
  const { afschrift, gezondheid, overzicht } = require('./bord')(
    Object.assign({}, ctx, { sluitcontrole, opdrachten }));

  const api = { MIN_CENTEN, MAX_CENTEN, SOORTEN, boek, boekAsync, geldModus, saldoVan, sluitcontrole, afschrift, gezondheid, overzicht, reconcileVanMotor, motorStand,
    bankOpdrachten: (f) => opdrachten.lijst(f || {}),
    bankOpdrachtenOpen: () => opdrachten.openstaand(),
    bankOpdrachtenRonde: (a) => opdrachten.ronde(a || {}),
    bankOpdrachtOpnieuw: (id) => opdrachten.dienIn(id),
    bankOpdrachtBevestig: (a) => opdrachten.bevestig(a || {}) };
  Object.assign(api, rek, over, brug, spaar, pas, krediet, incasso, zakelijk, advies, hart);

  /* De bankrondes lopen vanzelf: elk uur een tik die de spaarrente (idempotent
     op de klok: alleen hele verstreken dagen) en de vervallen vaste betalingen
     afhandelt. De boardroom-knoppen blijven bestaan voor een handmatige ronde;
     unref() zodat de timer een proces nooit wakker houdt (zelfde patroon als de
     tx-veegronde). */
  const RONDE_MS = Number(process.env.BANK_RONDE_MS || 3600000);
  const rondeTimer = setInterval(() => {
    // de rondes zijn async (ze kunnen via de motor lopen); ketenen en de fouten
    // opvangen zodat een hapering het proces nooit omver trekt.
    Promise.resolve()
      .then(() => api.bankRenteRonde({}))
      .then(() => api.bankIncassoRonde({}))
      .catch(e => console.warn('[bank] ronde mislukt:', e.message));
  }, RONDE_MS);
  if (rondeTimer.unref) rondeTimer.unref();

  /* De opdrachtenronde loopt VEEL vaker dan de uurtik: een mislukte inzending is
     geen maandelijkse rente maar geld dat vaststaat, en een uur wachten op de
     eerste herhaling is voor wie net op "verstuur" drukte een storing. De
     backoff in de opdracht bepaalt wie aan de beurt is; deze tik kijkt alleen. */
  const OPDRACHT_RONDE_MS = Number(process.env.BANK_OPDRACHT_RONDE_MS || 60000);
  const opdrachtTimer = setInterval(() => {
    opdrachten.ronde({}).catch(e => console.warn('[bank] opdrachtenronde mislukt:', e.message));
  }, OPDRACHT_RONDE_MS);
  if (opdrachtTimer.unref) opdrachtTimer.unref();

  return { bank: api };
};
