/* RTG Pay: de interne betaallaag van het hele huis. Een wallet per lid, een
   grootboek dat elke cent dubbel boekt, en alles frictieloos: EEN knop.

   De regels van het grootboek (dit is de kern van elk betaalbedrijf):
   - Elke beweging is een boeking VAN een rekening NAAR een rekening. Geld
     ontstaat nooit uit het niets: opladen komt van 'extern:oplaad' (daar
     staat de echte kaartbetaling via de betaal-naad tegenover), uitbetalen
     gaat naar 'extern:uitbetaald' (daar staat een echte payout tegenover).
   - De som van ALLE saldi is altijd exact nul (dubbel boekhouden). De
     sluitcontrole bewaakt dat, en /api/pay/gezond meldt het aan de bewaking.
   - Leden- en partnerrekeningen kunnen nooit onder nul; alleen de
     extern-rekeningen mogen negatief staan (dat IS de belofte van de bank).

   Frictieloos, EEN knop:
   - Betalen met te weinig saldo? De wallet laadt zelf bij (in stappen van
     tien euro) via de betaal-naad (Apple Pay/kaart) en betaalt door. Het lid
     tikt een keer, klaar.

   Identiteit: de wallet hangt aan de codenaam (dezelfde sociale identiteit
   als de vriendenlaag en de chats, over RTG en RTF heen). In productie hangt
   hij aan het account-id en is de codenaam alleen het adres.

   In productie wordt het saldo aangehouden bij de betaalpartner (Stripe
   Connect / Adyen for Platforms): zij houden het geld, dit grootboek blijft
   de waarheid over wie wat heeft. De naad (server/betaal.js) is er al. Dit is
   de orkestrator: het grootboek, de idempotentie en het opladen wonen hier;
   de Klompjes/tik/p2p in ./verzoeken, de kassa en de partnerkant in ./kassa. */

module.exports = ({ db, save, crypto, betaal, keyVanCodenaam, sseToCustomer, schoon, betaaldienstKosten }) => {
  const nu = () => Date.now();
  const d = () => db.data;

  const MIN_CENTEN = 1;              // vanaf 1 cent (een rondje delen mag klein zijn)
  const MAX_CENTEN = 500000;         // tot 5000 euro per boeking
  const OPLAAD_MIN = 100;            // opladen vanaf 1 euro
  const AUTOLAAD_STAP = 1000;        // zelf bijladen in stappen van 10 euro
  const KASCODE_MS = 5 * 60 * 1000;  // een kassacode leeft vijf minuten
  const KASCODE_MAX = 50000;         // standaardplafond kassacode: 500 euro

  function saldi() { if (!d().paySaldi || typeof d().paySaldi !== 'object') d().paySaldi = {}; return d().paySaldi; }
  function grootboek() { if (!Array.isArray(d().payBoekingen)) d().payBoekingen = []; return d().payBoekingen; }
  function klompjes() { if (!Array.isArray(d().payVerzoeken)) d().payVerzoeken = []; return d().payVerzoeken; }
  function kascodes() { if (!Array.isArray(d().payCodes)) d().payCodes = []; return d().payCodes; }
  function tikcodes() { if (!Array.isArray(d().payTikCodes)) d().payTikCodes = []; return d().payTikCodes; }

  const rekLid = c => 'lid:' + c;
  const rekPartner = c => 'partner:' + c;
  const saldoVan = rek => Math.round(saldi()[rek] || 0);
  const id = p => (p || 'P') + crypto.randomBytes(5).toString('hex').toUpperCase();

  /* Idempotentie die een herstart overleeft: dezelfde knop twee keer indrukken
     (dubbeltik, haperend netwerk, retry) geeft exact hetzelfde antwoord en
     boekt nooit dubbel. */
  function idemStore() {
    if (!d().payIdem || typeof d().payIdem !== 'object') d().payIdem = { _keys: [] };
    if (!Array.isArray(d().payIdem._keys)) d().payIdem._keys = [];
    return d().payIdem;
  }
  async function metIdem(sleutel, werk) {
    if (!sleutel) return werk();
    const s = idemStore();
    if (sleutel in s && sleutel !== '_keys') return Object.assign({}, s[sleutel], { herhaald: true });
    const r = await werk();
    if (r && r.ok) {
      s._keys.push(sleutel);
      if (s._keys.length > 20000) for (const weg of s._keys.splice(0, s._keys.length - 20000)) delete s[weg];
      s[sleutel] = r;
      save();
    }
    return r;
  }

  /* ---------- het grootboek zelf ---------- */
  function boek({ van, naar, centen, soort, oms, ref }) {
    const c = Math.round(Number(centen));
    if (!Number.isFinite(c) || c < MIN_CENTEN || c > MAX_CENTEN) return { status: 400, error: 'Dat bedrag kan niet.' };
    if (!van || !naar || van === naar) return { status: 400, error: 'Van en naar kloppen niet.' };
    if (!van.startsWith('extern:') && saldoVan(van) < c) return { status: 402, error: 'Onvoldoende saldo.' };
    saldi()[van] = saldoVan(van) - c;
    saldi()[naar] = saldoVan(naar) + c;
    const rij = { id: id('PB'), van, naar, centen: c, soort: soort || 'boeking', oms: schoon(oms, 120), ref: ref || null, at: nu() };
    grootboek().unshift(rij);
    if (grootboek().length > 50000) grootboek().pop(); // weergavecap; de saldi blijven de waarheid
    save();
    return { ok: true, boeking: rij };
  }
  // de sluitcontrole: som van alle saldi is nul, en niemand staat rood
  function sluitcontrole() {
    let som = 0;
    const rood = [];
    for (const [rek, c] of Object.entries(saldi())) {
      som += c;
      if (!rek.startsWith('extern:') && c < 0) rood.push(rek);
    }
    return { klopt: som === 0 && !rood.length, som, rood };
  }

  // een zachte melding naar het lid (best effort; de app pollt sowieso)
  function seintje(codenaam) {
    try {
      Promise.resolve(keyVanCodenaam(codenaam))
        .then(t => { if (t && t.key) sseToCustomer(t.key, 'sync', { scope: 'pay' }); })
        .catch(() => {});
    } catch (e) {}
  }

  /* ---------- opladen (Apple Pay / kaart via de betaal-naad) ---------- */
  async function laadOp({ codenaam, centen, idem, oms }) {
    const c = Math.round(Number(centen));
    if (!Number.isFinite(c) || c < OPLAAD_MIN || c > MAX_CENTEN) return { status: 400, error: 'Opladen kan van 1 tot 5000 euro.' };
    return metIdem(idem ? 'oplaad:' + codenaam + ':' + idem : null, async () => {
      let betaling;
      try {
        betaling = await betaal.maakBetaling({
          bedrag: c, referentie: 'pay-oplaad-' + codenaam + '-' + nu(),
          idempotentieSleutel: idem ? 'pay-oplaad:' + codenaam + ':' + idem : undefined,
          omschrijving: oms || 'RTG Pay opladen'
        });
      } catch (e) { return { status: 502, error: 'De betaling lukte niet: ' + e.message }; }
      if (betaling.status !== 'betaald' && betaling.status !== 'succeeded') {
        // bij een echte aanbieder rondt de klant het af (Apple Pay-sheet); de
        // webhook crediteert daarna. In de demo is hij altijd meteen betaald.
        return { status: 402, error: 'De betaling wacht op bevestiging.', betaalStatus: betaling.status };
      }
      const b = boek({ van: 'extern:oplaad', naar: rekLid(codenaam), centen: c, soort: 'oplaad', oms: oms || 'Opladen', ref: betaling.id });
      if (b.error) return b;
      return { ok: true, saldo: saldoVan(rekLid(codenaam)), geladen: c };
    });
  }
  /* De eigen bank als eerste dekking: is de RTG Bank live en heeft het lid
     daar een betaalrekening met ruimte, dan komt een saldotekort DAAR vandaan
     (eigen rails) in plaats van via de kaart-naad. De koppeling komt na het
     opstarten binnen (de bank bouwt op pay, dus late binding). */
  let bankDekking = null;
  function koppelBank(dekking) { bankDekking = typeof dekking === 'function' ? dekking : null; }

  /* Het hart van "EEN knop": is er te weinig saldo, dan laadt de wallet zelf
     bij en betaalt door. Eerst via de eigen bank (exact het tekort), anders
     via de kaart-naad (afgerond op tientjes). Het lid merkt er niets van
     behalve een regel "bijgeladen" in het overzicht. */
  async function zorgSaldo({ codenaam, centen, idem }) {
    const tekort = Math.round(centen) - saldoVan(rekLid(codenaam));
    if (tekort <= 0) return { ok: true, bijgeladen: 0 };
    if (bankDekking) {
      try { const b = bankDekking({ codenaam, centen: tekort }); if (b && b.ok) return { ok: true, bijgeladen: tekort, via: 'bank' }; }
      catch (e) { /* de bank kon niet dekken: gewoon door naar de kaart */ }
    }
    const stap = Math.ceil(tekort / AUTOLAAD_STAP) * AUTOLAAD_STAP;
    const r = await laadOp({ codenaam, centen: stap, idem: idem ? idem + ':autolaad' : null, oms: 'Automatisch bijgeladen' });
    if (r.error) return r;
    return { ok: true, bijgeladen: stap, via: 'kaart' };
  }
  async function bestaatLid(codenaam) {
    try { return !!(await keyVanCodenaam(codenaam)); } catch (e) { return false; }
  }

  // de gedeelde ctx voor de deelbestanden
  const ctx = {
    db, save, crypto, betaal, schoon, nu, d,
    saldi, grootboek, klompjes, kascodes, tikcodes,
    rekLid, rekPartner, saldoVan, id, metIdem, boek, zorgSaldo, seintje, bestaatLid,
    betaaldienstKosten: betaaldienstKosten || (() => 0),
    MIN_CENTEN, MAX_CENTEN, KASCODE_MS, KASCODE_MAX
  };
  const api = { MIN_CENTEN, MAX_CENTEN, boek, sluitcontrole, laadOp, saldoVan, koppelBank };
  Object.assign(api, require('./verzoeken')(ctx));
  Object.assign(api, require('./kassa')(ctx));
  return { pay: api };
};
