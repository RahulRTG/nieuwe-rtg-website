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
   de Klompjes/tik/p2p in ./verzoeken, de kassa en de partnerkant in ./kassa,
   het tegoed dat een lid voor een ander koopt in ./tegoed, en het afrekenen
   met een zaak in ./zaakbetaling. */

module.exports = ({ db, save, bijeen, crypto, betaal, keyVanCodenaam, sseToCustomer, schoon, betaaldienstKosten, betaalOpdrachten }) => {
  const nu = () => Date.now();
  const d = () => db.data;
  /* De stand van deze laag -- de drie schakelaars uit de omgeving en de zeven
     bedragen -- staat in ./stand.js. Een keer bepaald bij het opstarten, en
     daarna onveranderlijk; alles hieronder werkt per boeking. */
  const { betalingenUit, uitFout, schaduw, motorklant, geldModus,
    MIN_CENTEN, MAX_CENTEN, WALLET_MAX, OPLAAD_MIN, AUTOLAAD_STAP, KASCODE_MS, KASCODE_MAX } = require('./stand')();

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
     (dubbeltik, haperend netwerk, retry) geeft exact hetzelfde antwoord en boekt
     nooit dubbel -- en dezelfde sleutel met een ANDER verzoek geeft een 409 in
     plaats van stil het oude antwoord. Zie ../../lib/idem.js. */
  /* Met de save-bundel (db.bijeen) landen de boeking en de idem-sleutel als
     EEN commit; de bundel is context-gebonden, dus ook met echte I/O in het
     werk (motor, kaart-naad) raakt hij geen saves van andere verzoeken. */
  /* duurzaam: geld is de enige laag waar bevestigen vóór duurzaamheid een belofte
     is die de opslag nog niet heeft gedaan. Boeking en idem-sleutel zitten al in
     EEN bundel (zie lib/idem.js); deze vlag maakt die bundel ook duurzaam. */
  const metIdem = require('../../lib/idem')({ d, save, naam: 'payIdem', bijeen, duurzaam: true });

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
  /* Het plafond per wallet -- de tweede helft van de voorwaarde waarop
     kern/bevoegdheid/lijst.js het walletsaldo toestaat -- staat in ./plafond.js,
     inclusief waar het bedrag vandaan komt en waarom hij vóór de motor valt. */
  const { plafondFout, walletRuimte, koppelPlafond, walletMax } =
    require('./plafond')({ saldoVan, rekLid, standaard: WALLET_MAX });

  // De synchrone JS-guard. In motor-modus mag dit NIET: dan is de motor de
  // autoriteit en moet alles via boekAsync. Fail-closed (luid), nooit stil een
  // tweede grootboek naast de motor bijhouden (dat zou split-brain zijn).
  function boek({ van, naar, centen, soort, oms, ref }) {
    if (betalingenUit) return uitFout();
    if (geldModus === 'motor') {
      const bron = (new Error().stack || '').split('\n')[2] || '';
      throw new Error('pay.boek (synchroon) is niet toegestaan in RTG_MOTOR_GELD=motor; gebruik boekAsync.' + bron);
    }
    const c = Math.round(Number(centen));
    if (!Number.isFinite(c) || c < MIN_CENTEN || c > MAX_CENTEN) return { status: 400, error: 'Dat bedrag kan niet.' };
    if (!van || !naar || van === naar) return { status: 400, error: 'Van en naar kloppen niet.' };
    if (!van.startsWith('extern:') && saldoVan(van) < c) return { status: 402, error: 'Onvoldoende saldo.' };
    const vol = plafondFout(naar, c);
    if (vol) return vol;
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
    if (betalingenUit) return uitFout();
    if (geldModus !== 'motor') return boek({ van, naar, centen, soort, oms, ref });
    // Het walletplafond valt VOOR de motor; zie de reden bij plafondFout.
    const vol = plafondFout(naar, Math.round(Number(centen)));
    if (vol) return vol;
    const r = await motorklant.boekGuard({ van, naar, centen, soort, oms, ref });
    if (!r || r.error) return { status: (r && r.status) || 502, error: (r && r.error) || 'Motor onbereikbaar.' };
    // Neem de door de motor bevestigde boeking exact over (id, at, bedragen).
    const b = r.boeking;
    const rij = { id: b.id, van: b.van, naar: b.naar, centen: Math.round(Number(b.centen)), soort: b.soort || 'boeking', oms: b.oms || '', ref: b.ref || null, at: b.at || nu() };
    pasToe(rij);
    return { ok: true, boeking: rij };
  }
  /* Het oplaaddeel (laadOp, bankdekking, zorgSaldo, herstart-reconcile) staat
     in ./opladen.js; het krijgt de guard (boekAsync) en de helpers mee en
     raakt de boekingsregels zelf niet aan. */
  const { laadOp, oplaadAfronden, koppelBank, reconcileVanMotor, zorgSaldo, bestaatLid } = require('./opladen').maakOpladen({
    betaal, metIdem, boekAsync, rekLid, saldoVan, nu, d, save,
    motorklant, geldModus, keyVanCodenaam, plafondFout,
    OPLAAD_MIN, MAX_CENTEN, AUTOLAAD_STAP
  });

  /* Alles wat uit deze laag komt zonder dat er geld beweegt -- de twee vragen
     aan het grootboek, het seintje naar het lid en de schaduwstand voor het
     statusbord -- staat in ./kijken.js. Daar komen save noch boek binnen: wie
     er iets verandert kan per definitie geen geld verplaatsen. */
  const { sluitcontrole, boekingenVan, seintje, schaduwStand } =
    require('./kijken')({ saldi, grootboek, keyVanCodenaam, sseToCustomer, schaduw });

  // de gedeelde ctx voor de deelbestanden
  const ctx = {
    db, save, crypto, betaal, schoon, nu, d,
    saldi, grootboek, klompjes, kascodes, tikcodes,
    rekLid, rekPartner, saldoVan, walletRuimte, id, metIdem, boek, boekAsync, zorgSaldo, seintje, bestaatLid,
    betaaldienstKosten: betaaldienstKosten || (() => 0),
    opdrachten: betaalOpdrachten,
    MIN_CENTEN, MAX_CENTEN, KASCODE_MS, KASCODE_MAX,
    walletMax
  };
  /* rekLid hoort bij het koppelvlak: de vorm 'lid:' + codenaam is een regel
     van dit domein, en wie hem nodig heeft (ov, mobiliteit, geldwereld) tikte
     hem tot nu toe letterlijk na. Een naamregel die op vier plekken staat, is
     op dag een al drie keer bijna fout gegaan. */
  /* KASCODE_MS staat erbij omdat de capability eromheen (./kassacode.js) exact
     dezelfde termijn moet aanhouden; een tweede getal is een tweede waarheid. */
  /* De motorzekering en de schaduwstand: ./statusbord.js (alleen voor het bord). */
  const { motorZekering, schaduwMetAfdruk } = require('./statusbord')({ motorklant, schaduw, sluitcontrole, saldi });
  const api = { MIN_CENTEN, MAX_CENTEN, KASCODE_MS, WALLET_MAX, walletMax, koppelPlafond, walletRuimte, boek, boekAsync, geldModus, sluitcontrole, laadOp, oplaadAfronden, saldoVan, rekLid, boekingenVan, koppelBank, reconcileVanMotor, motorZekering };
  api.schaduw = schaduwMetAfdruk;   // de drift-detector; zie ./statusbord.js
  Object.assign(api, require('./verzoeken')(ctx));
  Object.assign(api, require('./kassa')(ctx));
  Object.assign(api, require('./tegoed')(ctx));
  Object.assign(api, require('./zaakbetaling')(ctx));
  /* De verkoop met inhoudingen (./verkoop.js): een lid koopt van een partner en
     wat er af moet -- btw, een afdracht -- volgt als eigen regel in hetzelfde
     grootboek. Staat na ./kassa omdat het hetzelfde patroon is, en apart omdat
     de teruggang erin zit en kassa.js daar met opzet anders mee omgaat. */
  Object.assign(api, require('./verkoop')(ctx));
  return { pay: api };
};
