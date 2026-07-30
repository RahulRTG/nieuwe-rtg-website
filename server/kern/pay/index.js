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

  // Schaduw-modus: spiegelt elke boeking naar de Rust-motor (RTG_MOTOR_SHADOW).
  // Uit = een no-op; JS blijft altijd de baas.
  const schaduw = require('./schaduw')();

  // CUTOVER-modus (RTG_MOTOR_GELD=motor): de Rust-motor wordt het ENIGE
  // autoritatieve grootboek. Standaard uit -> geldModus 'schaduw' = JS blijft de
  // baas, exact als voorheen. In 'motor' loopt elke boeking eerst geguard langs
  // de motor en past de JS-engine daarna dezelfde bevestigde regel toe (spiegel).
  const motorklant = require('./motorklant')();
  const geldModus = motorklant.aan ? 'motor' : 'schaduw';

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
  /* Per idem-sleutel een afdruk van het VERZOEK waarvoor hij gold. Zonder die
     binding geeft dezelfde sleutel met een ander verzoek stil het oude antwoord
     terug: de client krijgt "gelukt" voor iets wat nooit is geboekt. En dat is
     geen theorie -- de apps bouwen hun sleutel uit Date.now(), dus twee
     verschillende acties in dezelfde milliseconde krijgen echt dezelfde sleutel.
     Dezelfde afdrukvorm als de Rust-motor (motor/src/pay.rs), zodat beide
     engines dezelfde verzoeken als "gelijk" zien. */
  function idemAfdrukStore() {
    if (!d().payIdemAfdruk || typeof d().payIdemAfdruk !== 'object') d().payIdemAfdruk = {};
    return d().payIdemAfdruk;
  }
  async function metIdem(sleutel, afdruk, werk) {
    if (!sleutel) return werk();
    const s = idemStore();
    const a = idemAfdrukStore();
    if (sleutel in s && sleutel !== '_keys') {
      /* Een sleutel zonder bekende afdruk komt uit een database van voor deze
         binding: die laten we door zoals voorheen, anders zou een upgrade
         lopende idem-sleutels breken. */
      if (afdruk && typeof a[sleutel] === 'string' && a[sleutel] !== afdruk) {
        return { status: 409, error: 'Deze idem-sleutel is al gebruikt voor een ander verzoek.' };
      }
      return Object.assign({}, s[sleutel], { herhaald: true });
    }
    const r = await werk();
    if (r && r.ok) {
      s._keys.push(sleutel);
      if (s._keys.length > 20000) for (const weg of s._keys.splice(0, s._keys.length - 20000)) { delete s[weg]; delete a[weg]; }
      s[sleutel] = r;
      if (afdruk) a[sleutel] = afdruk;
      save();
    }
    return r;
  }

  /* ---------- het grootboek zelf ----------
     `pasToe` past een AL-goedgekeurde boeking toe op de saldi + het grootboek
     (geen guard meer). Gedeeld door de JS-guard (boek, schaduw-modus) en door de
     motor-spiegel (boekAsync, motor-modus past de door de motor bevestigde regel
     toe). */
  function pasToe(rij) {
    saldi()[rij.van] = saldoVan(rij.van) - rij.centen;
    saldi()[rij.naar] = saldoVan(rij.naar) + rij.centen;
    grootboek().unshift(rij);
    if (grootboek().length > 50000) grootboek().pop(); // weergavecap; de saldi blijven de waarheid
    save();
  }
  // De synchrone JS-guard. In motor-modus mag dit NIET: dan is de motor de
  // autoriteit en moet alles via boekAsync. Fail-closed (luid), nooit stil een
  // tweede grootboek naast de motor bijhouden (dat zou split-brain zijn).
  function boek({ van, naar, centen, soort, oms, ref }) {
    if (geldModus === 'motor') {
      const bron = (new Error().stack || '').split('\n')[2] || '';
      throw new Error('pay.boek (synchroon) is niet toegestaan in RTG_MOTOR_GELD=motor; gebruik boekAsync.' + bron);
    }
    const c = Math.round(Number(centen));
    if (!Number.isFinite(c) || c < MIN_CENTEN || c > MAX_CENTEN) return { status: 400, error: 'Dat bedrag kan niet.' };
    if (!van || !naar || van === naar) return { status: 400, error: 'Van en naar kloppen niet.' };
    if (!van.startsWith('extern:') && saldoVan(van) < c) return { status: 402, error: 'Onvoldoende saldo.' };
    const rij = { id: id('PB'), van, naar, centen: c, soort: soort || 'boeking', oms: schoon(oms, 120), ref: ref || null, at: nu() };
    pasToe(rij);
    schaduw.spiegel(rij); // schaduw-modus: naar de Rust-motor (no-op als uit)
    return { ok: true, boeking: rij };
  }
  /* De async boeking: het EEN choke-point voor de cutover. In schaduw-modus is
     dit exact de sync-guard (gewoon awaitbaar gemaakt) -- geen gedragsverandering.
     In motor-modus gaat de boeking geguard naar de motor (de autoriteit); pas als
     die hem bevestigt, spiegelt de JS-engine dezelfde regel. Weigert de motor
     (onvoldoende saldo) of is hij onbereikbaar, dan verandert er NIETS aan de
     JS-saldi -- de fout gaat netjes terug naar de caller. */
  async function boekAsync({ van, naar, centen, soort, oms, ref }) {
    if (geldModus !== 'motor') return boek({ van, naar, centen, soort, oms, ref });
    const r = await motorklant.boekGuard({ van, naar, centen, soort, oms, ref });
    if (!r || r.error) return { status: (r && r.status) || 502, error: (r && r.error) || 'Motor onbereikbaar.' };
    // Neem de door de motor bevestigde boeking exact over (id, at, bedragen).
    const b = r.boeking;
    const rij = { id: b.id, van: b.van, naar: b.naar, centen: Math.round(Number(b.centen)), soort: b.soort || 'boeking', oms: b.oms || '', ref: b.ref || null, at: b.at || nu() };
    pasToe(rij);
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

  /* Het oplaaddeel (laadOp, bankdekking, zorgSaldo, herstart-reconcile) staat
     in ./opladen.js; het krijgt de guard (boekAsync) en de helpers mee en
     raakt de boekingsregels zelf niet aan. */
  const { laadOp, koppelBank, reconcileVanMotor, zorgSaldo, bestaatLid } = require('./opladen').maakOpladen({
    betaal, metIdem, boekAsync, rekLid, saldoVan, nu, d, save,
    motorklant, geldModus, keyVanCodenaam,
    OPLAAD_MIN, MAX_CENTEN, AUTOLAAD_STAP
  });

  // de gedeelde ctx voor de deelbestanden
  const ctx = {
    db, save, crypto, betaal, schoon, nu, d,
    saldi, grootboek, klompjes, kascodes, tikcodes,
    rekLid, rekPartner, saldoVan, id, metIdem, boek, boekAsync, zorgSaldo, seintje, bestaatLid,
    betaaldienstKosten: betaaldienstKosten || (() => 0),
    MIN_CENTEN, MAX_CENTEN, KASCODE_MS, KASCODE_MAX
  };
  const api = { MIN_CENTEN, MAX_CENTEN, boek, boekAsync, geldModus, sluitcontrole, laadOp, saldoVan, koppelBank, reconcileVanMotor };
  // schaduw-stand voor het statusbord (drift-detector): vergelijkt de JS-stand
  // met de Rust-motor -- niet alleen de som maar ook een vingerafdruk over ALLE
  // saldi, zodat per-rekening-drift die de som mist er alsnog uit komt. De afdruk
  // wordt alleen hier berekend (statusbord-poll), niet in het warme geld-pad.
  // `aan` is false als RTG_MOTOR_SHADOW niet is gezet.
  const { vingerafdruk } = require('./vingerafdruk');
  api.schaduw = { aan: schaduw.aan, stand: () => schaduw.stand(sluitcontrole().som, vingerafdruk(saldi())) };
  Object.assign(api, require('./verzoeken')(ctx));
  Object.assign(api, require('./kassa')(ctx));
  return { pay: api };
};
