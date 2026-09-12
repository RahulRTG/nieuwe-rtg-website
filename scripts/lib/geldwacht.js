/* DE GELDWACHT: de waarnemer die tijdens een ECHTE draai vastlegt wie er aan
   een geldcollectie komt, en of die schrijfactie door de waardepoort ging.

   WAAROM DIT BESTAAT, EN WAAROM HET NIET STATISCH KON.
   De vraag "gaat elke geldbeweging door kern/pay/poort.js" is hier eerst
   statisch geprobeerd en dat mislukte op een manier die het vermelden waard is:
   AANROEPGRAAF.json heeft 23.716 kanten en er wijst er EEN naar server/kern/pay/.
   Niet omdat de betaallaag ongebruikt is, maar omdat routes `pay` uit de
   kernzak krijgen (server/routes/pay.js regel 7) en een statische lezer die
   injectie niet volgt. Een meter die daarop antwoordt, meldt nul geldpaden en
   ziet eruit alsof hij werkt. Dat is precies de faalvorm die CODE.md beschrijft:
   de fout zat in de METER en niet in de code.

   DE UITWEG IS DE SCHRIJFKANT ZELF. Een geldbeweging eindigt altijd in een
   collectie in db.data -- `paySaldi` is de saldostand, `payBoekingen` het
   grootboek. Wie daaraan komt, komt langs een property-set, en daar staat een
   stack die zegt WIE het deed. Dat is geen afleiding maar een waarneming, en
   hij werkt ongeacht hoe de aanroeper aan zijn `pay` kwam.

   WAT DE WACHT WEL EN NIET BEWIJST, en dat verschil is de hele waarde.
   Hij bewijst iets over de paden die tijdens de draai ECHT zijn uitgevoerd. Een
   geldpad dat niemand aanroept, ziet hij niet -- dus `0 stille geldpaden` betekent
   "geen gevonden in wat er liep", nooit "er zijn er geen". Daarom schrijft hij
   altijd op HOEVEEL er langskwam: een nul zonder noemer is een geruststelling
   zonder grond, en dat is de fout die dit huis bij `VERTROUWEN.json` al een keer
   heeft gemaakt.

   DE INDELING IS BINAIR EN DAT IS MET OPZET. Een schrijfactie is `beheerst` als
   haar stack door de guard van kern/pay/boeking.js loopt -- dat is de functie
   waar de waardepoort in hangt, en dus het enige punt waar saldo, beleid,
   plafond en reservering samen zijn getoetst. Al het andere heet `buiten-kern`
   en dat is een VRAAG en geen beschuldiging: er staan legitieme redenen tussen
   (een seed die de wereld opzet, een herstart-reconcile die de motorstand
   overneemt). Wie hier een oordeel van maakt, krijgt een lijst die niemand meer
   leest. De indeling zegt waar iemand moet kijken, niet wie er fout zit. */
'use strict';

const fs = require('fs');
const path = require('path');

/* De collecties die geld dragen komen NIET uit een eigen lijst hier. Ze komen
   uit kern/isolatie/effectcollecties.js, het register dat er al is en per
   collectie een grond draagt. Een tweede lijst geldcollecties is precies de
   dubbeling die SEMANTIEK.json meet -- en de twee zouden binnen een maand
   uiteenlopen. */
let GELD;
try {
  const { PER_COLLECTIE } = require('../../server/kern/isolatie/effectcollecties.js');
  GELD = new Set(Object.keys(PER_COLLECTIE).filter(k => PER_COLLECTIE[k][0] === 'GELD_BEWEGEN'));
} catch (e) {
  /* Fail-closed op de MELDING en niet op de draai: zonder register weet deze
     wacht niet waar hij naar kijkt, en dan hoort hij dat te zeggen in plaats van
     stil nul geldcollecties te bewaken. */
  GELD = new Set();
  process.env.RTG_GELDWACHT_KLACHT = 'effectcollecties.js niet leesbaar: ' + e.message;
}

/* DE POORTEN. Er zijn er TWEE en dat is de belangrijkste vondst van deze meter.

   De eerste versie kende alleen kern/pay/boeking.js en noemde daardoor 984
   schrijfacties van RTG Bank `buiten-kern`. Dat was onwaar: kern/bank/grootboek.js
   draagt een eigen volledige guard (bedrag, bestaan, bevroren, rood-staan-bodem)
   en zegt in zijn eigen kop "dezelfde tucht als RTG Pay". Een meter die een
   bewaakte laag als onbewaakt aanmerkt, roept wolf en wordt na twee keer
   genegeerd.

   MAAR ZE ZIJN NIET HETZELFDE, en daarom staan ze hier apart in plaats van
   samengevoegd tot "een poort". De betaalpoort toetst de waardeklasse, de
   reservering, het oormerk, het beleid van uitgever en houder, het walletplafond
   en de eigen geldgrens van het lid. De bankpoort toetst bedrag, bestaan,
   bevroren en bodem -- en raadpleegt kern/waarde NUL keer (nagetrokken: geen
   enkele verwijzing in kern/bank/grootboek.js). Een oormerk dat RTG Pay afdwingt,
   bestaat in het bankgrootboek niet.

   Wie die twee onder een naam schuift, verliest precies het verschil waar een
   toekomstige gedeelde laag over zou moeten gaan. Vandaar: elke schrijfactie
   draagt WELKE poort hem doorliet, en de kaart telt ze nooit samen. */
const POORTEN = Object.freeze({
  pay:  { bestand: 'server/kern/pay/boeking.js',    naam: 'RTG Pay-waardepoort' },
  bank: { bestand: 'server/kern/bank/grootboek.js', naam: 'RTG Bank-grootboekguard' }
});
for (const [sleutel, p] of Object.entries(POORTEN)) {
  if (!fs.existsSync(path.join(__dirname, '..', '..', p.bestand))) {
    process.env.RTG_GELDWACHT_KLACHT = 'poort ' + sleutel + ' (' + p.bestand +
      ') bestaat niet meer; de indeling is zinloos geworden';
  }
}

/* UITZONDERINGEN, met naam en reden, en ZE WORDEN GETELD. Een uitzonderingslijst
   is de manier waarop een meter stilletjes wordt uitgekleed, dus hij staat hier
   met drie grendels: hij noemt het bestand EN de collectie (niet "alles van deze
   module"), hij draagt een reden die een tweede lezer kan betwisten, en elke
   toepassing komt in de uitslag terecht. Wie een ratel omzeilt zonder het te
   zeggen, sloopt de ratel zelf. */
const UITZONDERINGEN = [{
  bestand: 'server/db/tx/topup.js',
  collecties: ['payBoekingen', 'betaalVerzoeken', 'bankBoekingen'],
  reden: 'vensterTopUp vult bij een herstart het WEERGAVEvenster aan uit het ' +
    'transactiegrootboek. Er verandert geen saldo -- kern/pay/boeken.js schrijft dat ' +
    'met zoveel woorden: de saldi zijn de waarheid, dit is de lijst die je terugleest.'
}];
function uitgezonderd(frames, collectie) {
  for (const u of UITZONDERINGEN) {
    if (!u.collecties.includes(collectie)) continue;
    if (frames.some(f => f.startsWith(u.bestand))) return u;
  }
  return null;
}

const UIT = process.env.RTG_GELDWACHT_UIT || path.join(process.cwd(), '.geldwacht.jsonl');
const regels = [];
let gezien = 0;

/* De stack van de schrijver, zonder de wacht zelf. Vier frames is genoeg om te
   zien wie het deed en waar hij vandaan kwam, en kort genoeg om een miljoen
   regels niet te laten ontploffen. */
function herkomst() {
  const rauw = (new Error().stack || '').split('\n').slice(3);
  const frames = [];
  for (const r of rauw) {
    const m = r.match(/\(?([^()\s]+\.js):(\d+):\d+\)?$/);
    if (!m) continue;
    let f = m[1];
    if (f.includes('node:internal')) continue;
    f = path.relative(process.cwd(), f);
    if (f.startsWith('scripts/lib/geldwacht')) continue;
    frames.push(f + ':' + m[2]);
    if (frames.length >= 6) break;
  }
  return frames;
}

function noteer(collectie, sleutel, soort) {
  gezien++;
  const frames = herkomst();
  let poort = null;
  for (const [s, p] of Object.entries(POORTEN)) if (frames.some(f => f.startsWith(p.bestand))) { poort = s; break; }
  const vrij = poort ? null : uitgezonderd(frames, collectie);
  /* De volgorde is streng: een poort wint altijd, daarna een genoemde
     uitzondering, daarna de containerstand, en pas dan `buiten-kern`. Zou
     `container` vóór de poort komen, dan verdween de motor-reconcile uit beeld
     juist omdat hij de hele bak vervangt. */
  const stand = poort ? 'beheerst' : vrij ? 'uitgezonderd' : soort === 'vervang' ? 'container' : 'buiten-kern';
  regels.push({
    collectie,
    sleutel: String(sleutel).slice(0, 60),
    soort,
    stand,
    poort,
    uitzondering: vrij ? vrij.reden : null,
    /* De eerste frame BUITEN de paylaag is wie hem aanriep -- dat is het adres
       waar een mens moet kijken, en niet de regel in boeking.js die elke keer
       hetzelfde is. */
    door: frames.find(f => !f.startsWith('server/kern/pay/') && !f.startsWith('server/kern/bank/')) || frames[0] || 'onbekend',
    stack: frames.slice(0, 4)
  });
}

/* De Proxy per collectie, gedeeld per onderliggend object. Zonder die cache
   krijgt elke leesbeurt een NIEUWE proxy, en dan is `db.data.paySaldi ===
   db.data.paySaldi` onwaar -- wat elders in het huis een identiteitsvergelijking
   stilletjes laat omvallen. Een meter die het gedrag verandert dat hij meet, is
   geen meter. */
const wikkels = new WeakMap();
function wikkel(doel, naam) {
  if (!doel || typeof doel !== 'object') return doel;
  if (wikkels.has(doel)) return wikkels.get(doel);
  const p = new Proxy(doel, {
    set(t, k, v, r) { if (typeof k !== 'symbol') noteer(naam, k, 'zet'); return Reflect.set(t, k, v, r); },
    deleteProperty(t, k) { if (typeof k !== 'symbol') noteer(naam, k, 'weg'); return Reflect.deleteProperty(t, k); }
  });
  wikkels.set(doel, p);
  return p;
}

/* De wortel: db.data zelf. Een `get` op een geldcollectie levert de bewaakte
   versie; een `set` OP de wortel (d().paySaldi = nieuw, zoals de herstart-
   reconcile in kern/pay/opladen.js doet) is zelf een geldbeweging en wordt als
   zodanig genoteerd -- die vervangt de hele saldostand in een keer, en dat is de
   zwaarste schrijfactie die er is. */
const wortels = new WeakMap();
function wikkelWortel(d) {
  if (!d || typeof d !== 'object') return d;
  if (wortels.has(d)) return wortels.get(d);
  const p = new Proxy(d, {
    get(t, k, r) {
      const v = Reflect.get(t, k, r);
      return (typeof k === 'string' && GELD.has(k)) ? wikkel(v, k) : v;
    },
    set(t, k, v, r) {
      if (typeof k === 'string' && GELD.has(k)) noteer(k, '(hele collectie)', 'vervang');
      return Reflect.set(t, k, v, r);
    }
    /* Let op het verschil dat hieronder in noteer() wordt vastgelegd: dit is een
       schrijfactie op de COLLECTIE, niet op een waarde erin. Geld verplaatsen
       schrijft altijd een SLEUTEL binnen paySaldi of bankSaldi; de hele bak
       vervangen is iets anders -- meestal opslagwerk (een lege bak aanmaken, een
       transactie publiceren), maar NIET altijd: kern/pay/opladen.js vervangt bij
       een herstart in motor-modus de complete saldostand, en dat verandert wel
       degelijk geld. Daarom krijgen containerschrijfacties een EIGEN stand in
       plaats van een vrijbrief, en staan ze met schrijver en al in de uitslag. */
  });
  wortels.set(d, p);
  return p;
}

try {
  const state = require('../../server/db/state.js');
  const db = state.db;
  const oud = Object.getOwnPropertyDescriptor(db, 'data');
  if (oud && typeof oud.get === 'function') {
    Object.defineProperty(db, 'data', {
      enumerable: true, configurable: true,
      get() { return wikkelWortel(oud.get.call(db)); },
      set: oud.set
    });
  } else {
    process.env.RTG_GELDWACHT_KLACHT = 'db.data is geen getter meer; de wacht kan zich niet inhangen';
  }
} catch (e) {
  process.env.RTG_GELDWACHT_KLACHT = 'db/state.js niet laadbaar: ' + e.message;
}

/* Wegschrijven bij het afsluiten. Append en niet overschrijven: één draai kan
   meerdere serverprocessen starten (de toetsen doen dat per bestand), en die
   moeten samen EEN waarneming vormen. */
function leeg(slot) {
  if (!regels.length && !slot) return;
  const uit = regels.splice(0).map(r => JSON.stringify(r));
  if (slot) uit.push(JSON.stringify({ soort: 'proces', gezien, pid: process.pid,
    klacht: process.env.RTG_GELDWACHT_KLACHT || null }));
  if (!uit.length) return;
  try { fs.appendFileSync(UIT, uit.join('\n') + '\n'); }
  catch (e) { /* een meter mag een draai nooit laten vallen */ }
}

/* TUSSENTIJDS WEGSCHRIJVEN, EN DAT IS GEEN NETHEID MAAR DE HELE METING.
   De eerste versie schreef alleen bij `exit`, en dat leverde een LEEG bestand op
   terwijl de toetsen groen langskwamen: test/helper.js stopt zijn server met een
   hard sein, en dan vuurt `exit` niet. Een meter die zijn waarneming pas aan het
   graf afgeeft, meet niets zodra het proces niet vredig sterft -- en hij ziet
   eruit als een meter die nul vond. Vandaar een klok van een kwart seconde,
   losgelaten met unref zodat hij zelf nooit een proces openhoudt. */
const klok = setInterval(() => leeg(false), 250);
if (typeof klok.unref === 'function') klok.unref();
process.on('exit', () => leeg(true));
for (const sein of ['SIGINT', 'SIGTERM']) process.on(sein, () => { leeg(true); process.exit(0); });

module.exports = { leeg, POORTEN, UITZONDERINGEN, GELD };
