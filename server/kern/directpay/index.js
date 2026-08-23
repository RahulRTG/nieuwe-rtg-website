/* Kern-module "directpay": rechtstreeks betalen van klant naar leverancier.

   Elk betalend RTG-lid regelt alles via de AI (concierge) en de Salon en rekent
   af met Face ID, precies zoals overal in de app. Het geld gaat RECHTSTREEKS
   van de klant naar de leverancier, niet via een tussenpot:

   - In de demo boeken we dat als een betaling die de ontvangst-teller van de
     leverancier direct ophoogt (zijn uitbetaalbare saldo).
   - In productie is dit een Stripe "destination charge": betaal.maakBetaling
     krijgt dan de connected-account van de leverancier als bestemming mee, zodat
     Stripe het bedrag direct naar de leverancier routeert. De naad (server/
     betaal.js) blijft gelijk; alleen de bestemming komt erbij.

   Veilig: bedrag begrensd, leverancier moet echt bestaan, idempotent (twee keer
   tikken of een herhaald verzoek schrijft nooit dubbel af), en de betaalstatus
   komt uit de betaal-naad, niet van de client. Dit is de orkestrator: het
   grootboek, de idempotentie-index en de tempolimiet wonen hier; het afrekenen
   zelf in ./betalen, de betaalverzoeken en de ontvangsten-teller in ./verzoek. */

const MIN_CENTEN = 50;          // € 0,50 ondergrens
const MAX_CENTEN = 5000000;     // € 50.000 bovengrens per transactie
const rtgKlok = require('../../lib/klok');

/* De transactie-hulpjes die deze module NODIG heeft. Ze staan hier als lijst en
   niet alleen in de handtekening, zodat ze te controleren zijn. */
const TX_NODIG = ['directBetalingMetRef', 'directBetalingenVanKlant', 'directBetalingenVanZaak', 'directBetalingenVoegToe',
  'betaalVerzoekMetRef', 'betaalVerzoekenVoorCodenaam', 'betaalVerzoekenVanZaak', 'betaalVerzoekenVoegToe'];

function maakDirectpay(ctxIn) {
  /* WEIGEREN BIJ HET BOUWEN, NIET OMVALLEN BIJ DE EERSTE BETALING.

     Toen deze module op de transactie-index werd aangesloten, bleef er een
     aanroeper achter die de hulpjes niet meegaf (een toets met een eigen ctx).
     Het gevolg kwam pas naar buiten toen er echt betaald werd:
     "directBetalingenVoegToe is not a function", middenin vastleggen(). Dat is
     de verkeerde plek en het verkeerde moment -- een betaalmodule die zich laat
     bouwen zonder de weg waarlangs betalingen worden opgeslagen, belooft iets
     wat ze niet kan waarmaken.

     Zelfde vorm als kern/aipoort.js, dat bij het bouwen weigert zonder
     resolveSession. Wie een afhankelijkheid vergeet, hoort dat te horen bij het
     opstarten van de server en niet bij de eerste klant. */
  const ontbreekt = TX_NODIG.filter(n => typeof ctxIn[n] !== 'function');
  if (ontbreekt.length)
    throw new Error('directpay: de transactie-index ontbreekt (' + ontbreekt.join(', ') +
      '). Zonder die hulpjes worden betalingen niet geindexeerd en valt de staart stil weg.');

  const { db, save, crypto, findSupplier, betaal, notify, notifySupplier, sseToSupplier, sseToCustomer, sseToOffice, logActivity,
    directBetalingMetRef, directBetalingenVanKlant, directBetalingenVanZaak, directBetalingenVoegToe,
    betaalVerzoekMetRef, betaalVerzoekenVoorCodenaam, betaalVerzoekenVanZaak, betaalVerzoekenVoegToe } = ctxIn;
  const nuMs = rtgKlok.nu;
  const nu = () => rtgKlok.datum().toISOString();
  const id = (p) => (p || 'x') + crypto.randomBytes(5).toString('hex').toUpperCase();
  const schoon = (v, n) => String(v == null ? '' : v).replace(/[<>]/g, '').trim().slice(0, n || 120);

  function ensure() {
    if (!Array.isArray(db.data.directBetalingen)) db.data.directBetalingen = [];
    if (!Array.isArray(db.data.betaalVerzoeken)) db.data.betaalVerzoeken = [];
    if (!db.data.directOntvangsten || typeof db.data.directOntvangsten !== 'object') db.data.directOntvangsten = {};
    return db.data;
  }
  const centenVan = (v) => { const n = Math.round(Number(v)); return Number.isFinite(n) ? n : NaN; };

  /* Idempotentie voor het MAKEN van een betaalverzoek (TAKEN.md 4.55). Het
     AFREKENEN had het al, via idemZoek/idemBewaar hieronder; het aanmaken niet,
     en daar kost een dubbeltik echt geld: twee verzoeken van hetzelfde bedrag
     kan de gast allebei betalen. Dezelfde module als RTG Pay en RTG Bank, met
     een eigen store zodat de sleutelruimtes gescheiden blijven. */
  const metIdem = require('../../lib/idem')({ d: () => db.data, save, naam: 'dpIdem', bijeen: db.bijeen });

  /* O(1)-index op de idempotentiesleutel: het dubbeltik-antwoord hoeft niet
     door tweehonderdduizend betalingen te scannen. Lui opgebouwd uit de
     opgeslagen data, daarna bij elke insert bijgehouden. */
  let idemIndex = null; // idemSleutel -> betaling
  function idemZoek(sleutel) {
    if (!idemIndex) {
      idemIndex = new Map();
      for (const b of ensure().directBetalingen) if (b.idem) idemIndex.set(b.idem, b);
    }
    return sleutel ? (idemIndex.get(sleutel) || null) : null;
  }
  function idemBewaar(b) {
    if (!b.idem) return;
    idemZoek(null); // index bestaat zeker
    idemIndex.set(b.idem, b);
    if (idemIndex.size > 250000) { idemIndex = null; idemZoek(null); } // hersynchroniseer met de gecapte lijst
  }

  /* Tempolimiet per lid: hooguit 12 betaalpogingen per minuut. Een herhaalde
     idempotente tik telt niet mee (die geeft gewoon het bestaande resultaat
     terug), dus een nette retry wordt nooit geblokkeerd. */
  const RATE_MAX = 12, RATE_VENSTER_MS = 60000;
  const betaalTempo = new Map(); // key -> [tijdstippen]
  function tempoOk(key) {
    const nu2 = nuMs();
    const lijst = (betaalTempo.get(key) || []).filter(t => nu2 - t < RATE_VENSTER_MS);
    if (lijst.length >= RATE_MAX) { betaalTempo.set(key, lijst); return false; }
    lijst.push(nu2);
    betaalTempo.set(key, lijst);
    if (betaalTempo.size > 50000) betaalTempo.clear(); // bots de kaart bij extreem veel sleutels
    return true;
  }

  // de payout-teller van een leverancier: wat er rechtstreeks binnenkwam
  function ledger(code) {
    ensure();
    if (!db.data.directOntvangsten[code]) db.data.directOntvangsten[code] = { som: 0, aantal: 0, uitbetaald: 0 };
    return db.data.directOntvangsten[code];
  }

  function publiek(b) {
    return { ref: b.ref, supplierCode: b.supplierCode, supplierName: b.supplierName, bedrag: b.bedrag,
      omschrijving: b.omschrijving, bron: b.bron, codename: b.codename, betaalwijze: b.betaalwijze || 'kaart', at: b.at };
  }

  /* HIER STOND EEN SCAN. `verzamel(db.data.directBetalingen, b => b.key === key,
     100, publiek)` loopt de array van voren af aan door tot hij honderd treffers
     heeft. Voor een lid met veel betalingen valt dat mee; voor een lid met twee
     betalingen tussen tweehonderdduizend andere loopt hij de hele collectie
     door -- en dat is precies het geval dat je in productie het vaakst hebt. De
     early exit hielp alleen de drukke gebruiker.
     De index geeft de betalingen van dit lid meteen, nieuwste eerst. */
  function mijnBetalingen(key) {
    ensure();
    return directBetalingenVanKlant(key).slice(0, 100).map(publiek);
  }

  // de gedeelde ctx voor de deelbestanden
  const ctx = { db, save, crypto, betaal, ensure, centenVan, id, schoon, nu, nuMs, ledger, publiek,
    idemZoek, idemBewaar, metIdem, tempoOk, findSupplier, notify, notifySupplier, logActivity,
    sseToSupplier, sseToCustomer, sseToOffice, MIN_CENTEN, MAX_CENTEN,
    directBetalingMetRef, directBetalingenVanKlant, directBetalingenVanZaak, directBetalingenVoegToe,
    betaalVerzoekMetRef, betaalVerzoekenVoorCodenaam, betaalVerzoekenVanZaak, betaalVerzoekenVoegToe };
  // het afrekenen zelf staat in ./betalen; ctx.betaalDirect erbij omdat ./verzoek
  // een goedgekeurd betaalverzoek langs dezelfde weg afrekent
  const { betaalDirect, registreerMuntBetaling, registreerBevestigdeBetaling } = require('./betalen')(ctx);
  ctx.betaalDirect = betaalDirect;
  const api = {
    DP_MIN_CENTEN: MIN_CENTEN, DP_MAX_CENTEN: MAX_CENTEN,
    dpBetaalDirect: betaalDirect, dpMijnBetalingen: mijnBetalingen, dpRegistreerMunt: registreerMuntBetaling,
    dpRegistreerBevestigd: registreerBevestigdeBetaling
  };
  Object.assign(api, require('./verzoek')(ctx));
  return api;
}

module.exports = { maakDirectpay };
