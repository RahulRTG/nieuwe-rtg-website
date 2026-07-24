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
  const { db, save, crypto, schoon, betaal, pay, bankregie, keyVanCodenaam, accounts, sseToCustomer, sseToOffice, anthropic } = deps;
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

  /* De grootboek-guard: de VOLLEDIGE regelcontrole (bedrag, bestaan, bevroren,
     bodem/rood-staan). Retourneert een fout-object of null (mag door). Dit is de
     enige plek waar de bank-policy leeft -- in schaduw-modus draait hij synchroon
     vóór het toepassen; in motor-modus draait hij hier in JS vóór de rauwe apply
     op de motor (die de metadata niet kent). */
  function guardCheck({ van, naar, c }) {
    if (!Number.isFinite(c) || c < MIN_CENTEN || c > MAX_CENTEN) return { status: 400, error: 'Dat bedrag kan niet.' };
    if (!van || !naar || van === naar) return { status: 400, error: 'Van en naar kloppen niet.' };
    if (!isExtern(van)) { const mv = rekMeta(van); if (!mv) return { status: 404, error: 'De rekening bestaat niet.' }; if (mv.bevroren) return { status: 423, error: 'Deze rekening is bevroren.' }; }
    if (!isExtern(naar) && !rekMeta(naar)) return { status: 404, error: 'De tegenrekening bestaat niet.' };
    if (saldoVan(van) - c < bodem(van)) return { status: 402, error: 'Onvoldoende saldo of rood-staan-ruimte.' };
    return null;
  }
  /* Een AL-goedgekeurde boeking toepassen op de saldi + het grootboek (geen guard
     meer). Gedeeld door de sync-guard (boek) en de motor-spiegel (boekMotor). */
  function pasToe(rij) {
    saldi()[rij.van] = saldoVan(rij.van) - rij.centen;
    saldi()[rij.naar] = saldoVan(rij.naar) + rij.centen;
    grootboek().unshift(rij);
    if (grootboek().length > 100000) grootboek().pop();  // weergavecap; de saldi zijn de waarheid
    save();
    bordSeintje();
  }

  /* De synchrone grootboekmotor. Boekt van -> naar, bewaakt de bodem en de dubbele
     boeking. Bevroren rekeningen kunnen niet betalen (wel ontvangen). In motor-modus
     mag dit NIET: dan is de motor het autoritatieve saldi-grootboek en moet alles via
     boekAsync (fail-closed, luid -- nooit stil een tweede grootboek naast de motor). */
  function boek({ van, naar, centen, soort, oms, ref }) {
    if (geldModus === 'motor') {
      throw new Error('bank.boek (synchroon) is niet toegestaan in RTG_MOTOR_GELD=motor; gebruik boekAsync.');
    }
    const c = Math.round(Number(centen));
    const fout = guardCheck({ van, naar, c });
    if (fout) return fout;
    const rij = { id: id('BB'), van, naar, centen: c, soort: soort || 'boeking', oms: schoon(oms, 140), ref: ref || null, at: nu() };
    pasToe(rij);
    return { ok: true, boeking: rij };
  }

  /* De serialisatie-slot voor de bank-schrijfacties in motor-modus. De guard leest
     de spiegel-saldi en pas ná de motor-bevestiging past hij ze aan; zonder slot
     konden twee gelijktijdige overboekingen van dezelfde rekening allebei dezelfde
     verouderde bodem-check passeren (TOCTOU) en samen door de bodem zakken. Door
     alle bank-schrijfacties door één belofte-keten te trekken ziet elke guard altijd
     de laatst toegepaste stand. */
  let schrijfKeten = Promise.resolve();
  function metSlot(werk) {
    const uit = schrijfKeten.then(werk, werk);
    schrijfKeten = uit.then(() => {}, () => {}); // de keten breekt nooit op een fout
    return uit;
  }
  /* De async boeking: HET choke-point voor de cutover. In schaduw-modus is dit exact
     de sync-guard (gewoon awaitbaar) -- geen gedragsverandering. In motor-modus draait
     de JS-guard (metadata!) eerst; pas als die doorlaat gaat de boeking rauw naar de
     motor (autoriteit voor de saldi). Bevestigt de motor, dan spiegelt JS dezelfde
     regel; weigert of hapert de motor, dan verandert er NIETS aan de spiegel. Alle
     motor-schrijfacties lopen door het slot (geen TOCTOU op de bodem). */
  async function boekAsync(args) {
    if (geldModus !== 'motor') return boek(args);
    return metSlot(() => boekMotor(args));
  }
  async function boekMotor({ van, naar, centen, soort, oms, ref }) {
    const c = Math.round(Number(centen));
    const fout = guardCheck({ van, naar, c });
    if (fout) return fout;
    const r = await motorklant.bankBoek({ van, naar, centen: c, soort, oms, ref });
    if (!r || r.error) return { status: (r && r.status) || 502, error: (r && r.error) || 'Motor onbereikbaar.' };
    const b = r.boeking;
    const rij = { id: b.id, van: b.van, naar: b.naar, centen: Math.round(Number(b.centen)), soort: b.soort || 'boeking', oms: b.oms || '', ref: b.ref || null, at: b.at || nu() };
    pasToe(rij);
    return { ok: true, boeking: rij };
  }

  /* Herstart-reconcile (cutover): bij het opstarten in motor-modus is de motor de
     autoriteit voor de bank-saldi, dus de JS-spiegel neemt zijn saldi over uit de
     motor-snapshot i.p.v. uit zijn eigen (mogelijk verouderde) snapshot. Zo start de
     spiegel altijd in lockstep met de motor, ook na een crash. Vereist RTG_MOTOR_SALDI=1
     op de motor. No-op buiten motor-modus. */
  async function reconcileVanMotor() {
    if (geldModus !== 'motor') return { ok: true, overgeslagen: true };
    const r = await motorklant.bankSaldiSnapshot();
    if (!r || r.error) return { ok: false, error: (r && r.error) || 'Geen saldi van de motor.' };
    const nieuw = {};
    for (const k in r.saldi) {
      if (!Object.prototype.hasOwnProperty.call(r.saldi, k)) continue;
      const v = Math.round(Number(r.saldi[k]) || 0);
      if (v !== 0) nieuw[k] = v; // nul-saldi laten we weg (schone spiegel)
    }
    d().bankSaldi = nieuw;
    save();
    let som = 0; for (const k in nieuw) som += nieuw[k];
    return { ok: true, rekeningen: Object.keys(nieuw).length, som };
  }

  // de sluitcontrole: som van alle saldi is nul, en niemand zit onder zijn bodem
  function sluitcontrole() {
    let som = 0; const onderBodem = [];
    for (const [rek, c] of Object.entries(saldi())) { som += c; if (c < bodem(rek)) onderBodem.push(rek); }
    return { klopt: som === 0 && !onderBodem.length, som, onderBodem };
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

  // de gedeelde context voor de deelbestanden
  const ctx = { db, save, crypto, schoon, betaal, pay, bankregie, keyVanCodenaam, accounts, anthropic,
    nu, d, MIN_CENTEN, MAX_CENTEN, SOORTEN, saldi, grootboek, rekeningen, rekMeta, saldoVan, isExtern, id, boek, boekAsync, geldModus, bodem, seintje };

  const rek = require('./rekeningen')(ctx);
  const over = require('./overboeken')(ctx);
  const spaar = require('./sparen')(ctx);
  const pas = require('./passen')(ctx);
  const krediet = require('./krediet')(ctx);
  const incasso = require('./incasso')(ctx);
  const zakelijk = require('./zakelijk')(ctx);
  const advies = require('./advies')(ctx);

  /* ---- afschrift: de boekingen die een rekening raken, nieuwste eerst ---- */
  function afschrift({ iban, limit = 50, offset = 0 }) {
    const m = rekMeta(iban);
    if (!m) return { status: 404, error: 'De rekening bestaat niet.' };
    const raakt = grootboek().filter(b => b.van === iban || b.naar === iban);
    const regels = raakt.slice(offset, offset + Math.min(200, Math.max(1, limit))).map(b => ({
      id: b.id, af: b.van === iban, centen: b.centen, soort: b.soort, oms: b.oms,
      tegen: b.van === iban ? b.naar : b.van, at: b.at
    }));
    return { ok: true, iban, saldoCenten: saldoVan(iban), aantal: raakt.length, regels };
  }

  /* ---- de bank-gezondheid + het boardroom-overzicht (achter de office-inlog) ---- */
  function gezondheid() {
    const s = saldi();
    let deposito = 0, krediet = 0;
    for (const [r, c] of Object.entries(s)) { if (isExtern(r)) continue; if (c >= 0) deposito += c; else krediet += -c; }
    const emissie = -saldoVan('extern:emissie');  // wat de eigen bank heeft uitgegeven (positief = in omloop)
    const rekN = Object.keys(rekeningen()).length;
    return { status: 200, sluit: sluitcontrole(), depositoCenten: deposito, kredietCenten: krediet,
      inOmloopCenten: emissie, reserveCenten: saldoVan('rtg:reserve'), renteBetaaldCenten: -saldoVan('rtg:rente'),
      foundationCenten: saldoVan('extern:foundation'),
      aantalRekeningen: rekN, boekingenVandaag: grootboek().filter(b => nu() - b.at < 86400000).length };
  }
  function overzicht() {
    const g = gezondheid();
    const lijst = Object.values(rekeningen()).sort((a, b) => b.geopend - a.geopend).slice(0, 100)
      .map(m => ({ iban: m.iban, codenaam: m.codenaam, soort: m.soort, naam: m.naam, saldoCenten: saldoVan(m.iban), bevroren: !!m.bevroren, roodLimiet: m.roodLimiet || 0 }));
    return { status: 200, regie: bankregie.bankregieOverzicht(), gezondheid: g, rekeningen: lijst };
  }

  const api = { MIN_CENTEN, MAX_CENTEN, SOORTEN, boek, boekAsync, geldModus, saldoVan, sluitcontrole, afschrift, gezondheid, overzicht, reconcileVanMotor };
  Object.assign(api, rek, over, spaar, pas, krediet, incasso, zakelijk, advies);

  /* Drift-stand voor het statusbord (cutover): vergelijkt de JS-spiegel met de
     Rust-motor -- niet alleen de som maar ook een vingerafdruk over ALLE bank-saldi,
     zodat per-rekening-drift die de som mist er alsnog uitkomt. Alleen berekend op
     een statusbord-poll (nooit in het warme geld-pad). Deelt de afdruk-code met pay
     (byte-voor-byte gelijk aan de motor). `aan` = we draaien in motor-modus. */
  const { vingerafdruk } = require('../pay/vingerafdruk');
  api.motorStand = {
    aan: geldModus === 'motor', modus: geldModus,
    stand: async () => {
      const s = sluitcontrole();
      const jsAfdruk = vingerafdruk(saldi());
      if (geldModus !== 'motor') return { modus: geldModus, jsSom: s.som, jsVingerafdruk: jsAfdruk };
      const r = await motorklant.bankSaldiSnapshot();
      if (!r || r.error) return { modus: geldModus, jsSom: s.som, jsVingerafdruk: jsAfdruk, fout: (r && r.error) || 'geen motor-saldi' };
      let motorSom = 0; for (const k in r.saldi) motorSom += Math.round(Number(r.saldi[k]) || 0);
      const motorAfdruk = vingerafdruk(r.saldi);
      return { modus: geldModus, jsSom: s.som, motorSom, gelijk: motorSom === s.som,
        jsVingerafdruk: jsAfdruk, motorVingerafdruk: motorAfdruk, gelijkAlle: jsAfdruk === motorAfdruk };
    },
  };

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

  return { bank: api };
};
