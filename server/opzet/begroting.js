/* ============================================================================
   DE BEGROTING -- de eerste laag die een handeling kan WEIGEREN.

   WAAROM DIT ER IS. server/opzet/handeling.js meet ACHTERAF wat een verzoek
   heeft veranderd: een massamutatie is daarmee te zien en te melden, maar niet
   tegen te houden -- als de logregel er staat, zijn de rijen al weg. Detecteren
   is niet tegenhouden, en dit bestand is het verschil.

   HOE HET KAN ZONDER HET SCHRIJFPAD TE HERSCHRIJVEN, en dat is de hele vondst.
   Een echte voorproef -- de handeling eerst tegen een kopie draaien -- kan niet:
   een route stuurt post, roept een betaaldienst aan, schrijft bestanden. Die
   twee keer draaien is gevaarlijker dan wat het voorkomt.

   Maar een massamutatie ziet er hier bijna altijd hetzelfde uit: `db.data.X`
   krijgt een filter, een slice of een lege lijst toegewezen. De telling per vorm
   staat in README.md ("De begroting"), en die is de enige -- hij stond hier ook
   als tabel en dat zijn twee plekken voor een waarheid (LAT.md regel 4).

   De set-val kent oude en nieuwe lengte vóór de toekenning. Een ontbrekende
   collectie aanmaken is geen massaverwijdering; alleen vervanging van een
   bestaande array valt hieronder.

   WAT DAT NIET IS: dekking. Deze laag dekt de VORM van een massaverwijdering,
   niet elke plek waar dit huis rijen kwijtraakt.

   WAT ER NIET ONDER VALT, en dat hoort er hard bij: de drie splice-plekken, elke
   wijziging BINNEN een rij, en alles wat via push groeit. Groei is bewust geen
   weigering -- te hard groeien is opslag en geen verlies, en er een grens op
   zetten breekt legitiem werk zonder dat er iets onherstelbaars tegenover staat.

   EN DE BELANGRIJKSTE KEUZE: HIJ STAAT STANDAARD OP MELDEN. Meten, ratelen, dan
   handhaven; met RTG_BEGROTING=weigeren gaat de tand erin. Wat er gemeten is
   staat in KRIMP.json, wat er per collectie besloten is in BEGROTING.json --
   inclusief waar een grens NIET mag staan, en waarom.

   BUITEN EEN VERZOEK GEBEURT ER NIETS. Een cronjob, de veger, een migratie en de
   seed hebben geen handelingscontext en horen nooit geweigerd te worden: dat is
   geen actor met een budget maar het huis dat zijn eigen werk doet.
   ========================================================================== */
'use strict';

const handeling = require('./handeling');

/* De grens. Hier stond dat een tabel per collectie verzonnen zou zijn en uit de
   meting moest komen; dat is precies wat er gebeurde. KRIMP.json meet,
   BEGROTING.json besluit, ./begrotingsgrenzen.js leest. Hier blijft de
   STANDAARD -- de noodrem voor alles waarover niets besloten is. */
const STANDAARDGRENS = 1000;
const grenzen = require('./begrotingsgrenzen');
const GRENS_OMGEVING = (() => {
  const n = Number(process.env.RTG_BEGROTING_KRIMP);
  return Number.isFinite(n) && n > 0 ? n : null;
})();
const KRIMPGRENS = GRENS_OMGEVING != null ? GRENS_OMGEVING : STANDAARDGRENS;

const MODUS = process.env.RTG_BEGROTING === 'weigeren' ? 'weigeren' : 'melden';

/* HET LEVENSTEKEN -- de regel die bewijst DAT deze val aanstond. Zonder hem
   betekent "nul meldingen" twee onvergelijkbare dingen: er kromp niets, of de
   val stond niet aan. scripts/krimpronde.js zocht dat verschil eerst in het
   woord "begroting:" en trapte in twee toetsnamen; het verhaal staat in zijn
   kop (LAT.md regel 3). Een verlaagde grens of de weigerstand krijgt warn (dus
   stderr); de gewone stand DEBUG en geen info, want info gaat naar stdout en
   daar zet scripts/routekaart.js zijn JSON neer -- dat brak npm run norm meteen.
   Een keer per proces: redis.js vervangt db.data bij elke externe wijziging. */
let gewaakt = false;
function levensteken(meld, modus, grens) {
  if (gewaakt) return;
  gewaakt = true;
  meld(modus === 'melden' && grens === STANDAARDGRENS ? 'debug' : 'warn',
    'begroting: waakt', { modus, grens });
}

/* Wat er is tegengehouden of zou zijn, sinds het opstarten. Dit getal bouwt de
   catalogus: zolang er legitieme handelingen in staan, kan de tand er niet in. */
const teller = { gezien: 0, overschreden: 0, geweigerd: 0, laatste: [] };
const weigert = (collectie, krimp, grens, modus) => krimp > grens && modus === 'weigeren' && grenzen.handhaaft(collectie);

function onthoud(rij) {
  teller.laatste.unshift(rij);
  if (teller.laatste.length > 25) teller.laatste.length = 25;
}

/* De fout van een geweigerde handeling. Een eigen klasse zodat een route hem
   herkent en er een net antwoord van maakt in plaats van een 500, en zodat hij
   in een log niet op een programmeerfout lijkt. */
class BegrotingOverschreden extends Error {
  constructor(collectie, krimp, grens) {
    super('[begroting] deze handeling neemt ' + krimp + ' rijen weg uit "' + collectie +
      '" en de grens ligt op ' + grens + '. Splits hem op, of laat hem door iemand met dat budget doen.');
    this.name = 'BegrotingOverschreden';
    this.collectie = collectie;
    this.krimp = krimp;
    this.grens = grens;
    this.status = 409;
  }
}

/* De beoordeling, los van de Proxy: zo kan een toets hem voeden zonder database,
   en is wat een toets ijkt hetzelfde als wat er echt gebeurt (LAT.md regel 10). */
function beoordeel(collectie, oudeLengte, nieuweLengte, opties) {
  const o = opties || {};
  /* Rangorde: een expliciete grens wint van een meetronde, en die van het
     register -- anders meet een ronde op een halve rij niets meer zodra er een
     tabel bestaat. */
  const grens = Number.isFinite(o.grens) ? o.grens
    : (GRENS_OMGEVING != null ? GRENS_OMGEVING : grenzen.grensVoor(collectie));
  const modus = o.modus || MODUS;
  const krimp = oudeLengte - nieuweLengte;
  if (!(krimp > 0)) return { oordeel: 'door', krimp: krimp };
  teller.gezien++;
  if (krimp <= grens) return { oordeel: 'door', krimp: krimp };
  teller.overschreden++;
  const rij = { collectie, krimp, grens, modus, pad: o.pad || null, correlatie: o.correlatie || null };
  onthoud(rij);
  /* WEIGEREN IS NIET OVERAL VEILIG: de zes collecties van het vergeetpad melden
     ook in de weigerstand, want daar haalt een handeling alles van een lid weg
     en is de omvang per ontwerp onbegrensd. Zie BEGROTING.json. */
  if (weigert(collectie, krimp, grens, modus)) {
    teller.geweigerd++; return { oordeel: 'weiger', krimp, grens, rij };
  }
  return { oordeel: 'meld', krimp, grens, rij };
}

/* Een Proxy per data-object: `db.data === db.data` blijft kloppen. */
const wikkels = new WeakMap();
const instellingen = new WeakMap();
const inventaris = require('./begroting-inventaris');
const { collectieSleutels, rijSleutels } = inventaris;

// Een opslagcommit toetst zijn latere publicatie vooraf. Geen uitzondering op
// het budget: dezelfde predicate, vóór SQLite de transactie onomkeerbaar maakt.
function toetsOpslag(data, sleutel, waarde) {
  const i = instellingen.get(data), oud = data?.[sleutel];
  if (!i || !Array.isArray(oud) || !Array.isArray(waarde) || !i.nu.huidige()) return;
  const krimp = oud.length - waarde.length;
  if (krimp > 0 && weigert(String(sleutel), krimp, i.grens, i.modus))
    throw new BegrotingOverschreden(String(sleutel), krimp, i.grens);
}

function bewaak(data, deps) {
  if (!data || typeof data !== 'object') return data;
  if (wikkels.has(data)) return wikkels.get(data);
  const meld = (deps && deps.log) || ((niveau, bericht, velden) => {
    try { require('../log').log[niveau](bericht, velden); } catch (e) {}
  });
  const nu = (deps && deps.handeling) || handeling;
  /* DE MODUS IS HIER OVERSCHRIJFBAAR, en dat is geen testluik maar een eis. Las
     deze wikkel alleen de module-constante, dan was de WEIGERSTAND niet te
     beproeven zonder de hele suite met een omgevingsvlag te draaien -- en een
     poort die je niet dicht hebt zien gaan, is een poort waarvan niemand weet of
     hij dichtgaat (LAT.md regel 10). */
  const modus = (deps && deps.modus) || MODUS;
  const grens = (deps && Number.isFinite(deps.grens)) ? deps.grens : KRIMPGRENS;
  levensteken(meld, modus, grens);

  const vorm = { nu, modus, grens, doel: data };
  inventaris.registreer(data, data);

  const wikkel = new Proxy(data, {
    set(doel, sleutel, waarde) {
      const oud = doel[sleutel];
      /* Alleen een collectie die door een ANDERE collectie wordt vervangen telt
         hier. Al het andere -- een teller, een object, een nieuwe sleutel --
         gaat ongemoeid door. */
      if (!Array.isArray(oud) || !Array.isArray(waarde)) return inventaris.vervang(doel, sleutel, waarde);
      /* Buiten een verzoek doet het huis zijn eigen werk (veger, migratie,
         seed); daar hoort geen budget op. */
      const h = nu.huidige();
      if (!h) return inventaris.vervang(doel, sleutel, waarde);

      const uit = beoordeel(String(sleutel), oud.length, waarde.length,
        { pad: h.pad, correlatie: h.correlatie, modus, grens });
      if (uit.oordeel === 'door') return inventaris.vervang(doel, sleutel, waarde);

      if (uit.oordeel === 'weiger') {
        meld('error', 'begroting: handeling geweigerd', {
          id: h.correlatie, p: h.pad, collectie: String(sleutel), rijen: uit.krimp, grens: uit.grens });
        throw new BegrotingOverschreden(String(sleutel), uit.krimp, uit.grens);
      }
      /* MELDEN: hij gaat door, maar niet stil -- dit getal bouwt de catalogus
         van wat er legitiem groot is (LAT.md regel 5). */
      meld('warn', 'begroting: zou zijn geweigerd', {
        id: h.correlatie, p: h.pad, collectie: String(sleutel), rijen: uit.krimp, grens: uit.grens });
      return inventaris.vervang(doel, sleutel, waarde);
    },
    deleteProperty: inventaris.verwijder,
    defineProperty: inventaris.definieer
  });
  wikkels.set(data, wikkel);
  wikkels.set(wikkel, wikkel);   // bewaak(bewaakt) geeft dezelfde wikkel terug
  instellingen.set(wikkel, vorm);
  inventaris.registreer(wikkel, data);
  return wikkel;
}

function stand() {
  return { modus: MODUS, grens: KRIMPGRENS, waakt: gewaakt,
    gezien: teller.gezien, overschreden: teller.overschreden, geweigerd: teller.geweigerd,
    laatste: teller.laatste.slice(0, 10) };
}

module.exports = { bewaak, beoordeel, toetsOpslag, collectieSleutels, rijSleutels, stand, BegrotingOverschreden, KRIMPGRENS, STANDAARDGRENS, MODUS };
