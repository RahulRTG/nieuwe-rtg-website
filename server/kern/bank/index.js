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
  const { db, save, crypto, schoon, betaal, pay, bankregie, keyVanCodenaam, sseToCustomer, anthropic } = deps;
  const nu = () => Date.now();
  const d = () => db.data;

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

  /* De grootboekmotor. Boekt van -> naar, bewaakt de bodem en de dubbele
     boeking. Bevroren rekeningen kunnen niet betalen (wel ontvangen). */
  function boek({ van, naar, centen, soort, oms, ref }) {
    const c = Math.round(Number(centen));
    if (!Number.isFinite(c) || c < MIN_CENTEN || c > MAX_CENTEN) return { status: 400, error: 'Dat bedrag kan niet.' };
    if (!van || !naar || van === naar) return { status: 400, error: 'Van en naar kloppen niet.' };
    if (!isExtern(van)) { const mv = rekMeta(van); if (!mv) return { status: 404, error: 'De rekening bestaat niet.' }; if (mv.bevroren) return { status: 423, error: 'Deze rekening is bevroren.' }; }
    if (!isExtern(naar) && !rekMeta(naar)) return { status: 404, error: 'De tegenrekening bestaat niet.' };
    if (saldoVan(van) - c < bodem(van)) return { status: 402, error: 'Onvoldoende saldo of rood-staan-ruimte.' };
    saldi()[van] = saldoVan(van) - c;
    saldi()[naar] = saldoVan(naar) + c;
    const rij = { id: id('BB'), van, naar, centen: c, soort: soort || 'boeking', oms: schoon(oms, 140), ref: ref || null, at: nu() };
    grootboek().unshift(rij);
    if (grootboek().length > 100000) grootboek().pop();  // weergavecap; de saldi zijn de waarheid
    save();
    return { ok: true, boeking: rij };
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

  // de gedeelde context voor de deelbestanden
  const ctx = { db, save, crypto, schoon, betaal, pay, bankregie, keyVanCodenaam, anthropic,
    nu, d, MIN_CENTEN, MAX_CENTEN, SOORTEN, saldi, grootboek, rekeningen, rekMeta, saldoVan, isExtern, id, boek, bodem, seintje };

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
      aantalRekeningen: rekN, boekingenVandaag: grootboek().filter(b => nu() - b.at < 86400000).length };
  }
  function overzicht() {
    const g = gezondheid();
    const lijst = Object.values(rekeningen()).sort((a, b) => b.geopend - a.geopend).slice(0, 100)
      .map(m => ({ iban: m.iban, codenaam: m.codenaam, soort: m.soort, naam: m.naam, saldoCenten: saldoVan(m.iban), bevroren: !!m.bevroren, roodLimiet: m.roodLimiet || 0 }));
    return { status: 200, regie: bankregie.bankregieOverzicht(), gezondheid: g, rekeningen: lijst };
  }

  const api = { MIN_CENTEN, MAX_CENTEN, SOORTEN, boek, saldoVan, sluitcontrole, afschrift, gezondheid, overzicht };
  Object.assign(api, rek, over, spaar, pas, krediet, incasso, zakelijk, advies);

  /* De bankrondes lopen vanzelf: elk uur een tik die de spaarrente (idempotent
     op de klok: alleen hele verstreken dagen) en de vervallen vaste betalingen
     afhandelt. De boardroom-knoppen blijven bestaan voor een handmatige ronde;
     unref() zodat de timer een proces nooit wakker houdt (zelfde patroon als de
     tx-veegronde). */
  const RONDE_MS = Number(process.env.BANK_RONDE_MS || 3600000);
  const rondeTimer = setInterval(() => {
    try { api.bankRenteRonde({}); api.bankIncassoRonde({}); }
    catch (e) { console.warn('[bank] ronde mislukt:', e.message); }
  }, RONDE_MS);
  if (rondeTimer.unref) rondeTimer.unref();

  return { bank: api };
};
