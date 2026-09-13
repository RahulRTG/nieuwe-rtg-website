#!/usr/bin/env node
'use strict';
/* ============================================================================
   DE REFUNDMIGRATIE -- welke lezer van `paid` kan mee naar de tegenboeking?

   WAAR DIT UIT KOMT. De eigenaar heeft besloten dat een terugstorting een
   TEGENBOEKING is en geen wisser: een eenmaal geboekte verkoop is historische
   waarheid, en de terugbetaling is een nieuwe economische gebeurtenis die ernaar
   verwijst, met een eigen datum. Voor BESTELLINGEN is dat op 13 september 2026
   uitgevoerd (kern/fiscaal/index.js telt twee gebeurtenissen per bon).

   Rides, tickets en boekingen zijn NIET mee, en dat is geen vergeetpost. `paid`
   betekent daar nog "het geld staat bij de zaak", en hun annuleerweg zet die
   vlag op false. Zet je die semantiek om zonder de lezers na te lopen, dan
   verandert er van alles stil: een omzet die niet meer daalt, een uitgave die
   blijft staan, en -- het duurst -- een grendel die aan `paid` hing en nu open
   staat.

   DAT LAATSTE IS GEEN THEORIE. Bij de ORDERS is het gebeurd: de grendel op een
   tweede terugstorting hing aan `paid`, en zonder een eigen grendel op
   `refunded` had dezelfde bon twee keer geld teruggestuurd. Vier van de
   order-lezers braken; de rest sloot `terugbetaald` al uit via de status. Dat
   verschil was niet te raden -- het moest gelezen worden.

   WAT DIT SCRIPT DOET, EN WAT NIET. Het TELT de lezers per collectie en wijst
   ze per bestand aan. Het VERKLAART ze niet: elke lezer staat op `onbekend` tot
   iemand hem met de hand heeft ingedeeld, precies zoals in
   scripts/ritmigratie.js. Een kaart waarvan je niet weet welke regel zorgvuldig
   is, is gevaarlijker dan geen kaart -- dus staat er liever `onbekend` dan een
   gok.

   DRIE SOORTEN LEZER, en het onderscheid bepaalt het RISICO:

     toont      laat aan een mens zien of er betaald is. Breekt zichtbaar:
                iemand ziet "betaald" bij een teruggestorte bon.
     telt       telt geld op (omzet, uitgaven, meters). Breekt STIL: een
                bedrag dat niet meer daalt valt niemand op.
     grendel    beslist of iets mag (nog een keer betalen, nog een keer
                terugstorten). Breekt het duurst: geld beweegt twee keer.

   Draaien:  npm run refundmigratie        (print)
             npm run refundmigratie:vast   (schrijft REFUNDMIGRATIE.json)
   ============================================================================ */
const fs = require('fs');
const path = require('path');
const { stempel } = require('./lib/stempel');

const WORTEL = path.join(__dirname, '..');
const DOEL = path.join(WORTEL, 'REFUNDMIGRATIE.json');
const VAST = process.argv.includes('--vastleggen');

/* De vier collecties waar `paid` een betaalstand draagt. `orders` staat erbij
   omdat de kaart moet laten zien dat DIE af is -- een migratiekaart die alleen
   het openstaande werk toont, verliest zijn nulpunt. */
const COLLECTIES = ['orders', 'rides', 'tickets', 'boekingen'];

/* HANDGESCHREVEN, EN ALLEEN WAT GELEZEN IS. Wat een regel DOET met `paid` is te
   zien; of hij na de omzetting nog klopt is een oordeel. Elke regel draagt
   daarom een reden. Dit script controleert alleen dat de plek nog bestaat --
   niet dat het oordeel klopt (dezelfde grens als scripts/ritmigratie.js). */
const LEZERS = {
  /* --- orders: OM, op 13 september 2026 --- */
  'server/kern/fiscaal/index.js': { collectie: 'orders', soort: 'telt', stand: 'om',
    wat: 'de omzet van de maand, en sinds deze ronde de tegenboeking ernaast',
    gedaan: 'telt twee gebeurtenissen per bon: de verkoop op paidAt, de terugstorting negatief op refundedAt' },
  'server/routes/supplier/orders/afhandeling.js': { collectie: 'orders', soort: 'grendel', stand: 'om',
    wat: 'de terugstortroute van de zaak',
    gedaan: 'de grendel hangt nu aan `refunded`; hing hij aan `paid`, dan kon dezelfde bon twee keer geld terugsturen' },
  'server/kern/lidacties/betalen.js': { collectie: 'orders', soort: 'grendel', stand: 'om',
    wat: 'weigert een tweede betaling van dezelfde bon',
    gedaan: 'de `refunded`-grendel staat nu VOOR die op `paid`, anders leest een teruggestorte bon als "Al betaald"' },
  'server/kern/ervaring/leden/annuleren.js': { collectie: 'orders', soort: 'grendel', stand: 'om',
    wat: 'de tweede terugstortweg: het LID annuleert',
    gedaan: 'zet `paid` niet meer op false, anders gaf dezelfde gebeurtenis twee cijfers al naar gelang wie annuleerde' },
  'server/kern/live.js': { collectie: 'orders', soort: 'toont', stand: 'om',
    wat: 'de betaalstand in de live-stand van het lid',
    gedaan: 'leest nu `paid && !refunded`; anders zag het lid "betaald" bij een teruggestorte bon' },
  'server/kern/eten/orderbeeld-legacy.js': { collectie: 'orders', soort: 'toont', stand: 'om',
    wat: 'betaald/openstaand bedrag op het orderbeeld',
    gedaan: 'beide nul bij een terugstorting; een teruggestorte bon is niet betaald en ook niet openstaand' },
  'server/routes/member/zakelijk.js': { collectie: 'orders', soort: 'telt', stand: 'om',
    wat: 'de zakelijke horeca-uitgaven van een lid',
    gedaan: 'sluit `refunded` uit; een teruggestorte bon is geen uitgave meer' },
  'server/kern/kantoor/index.js': { collectie: 'orders', soort: 'telt', stand: 'geen-werk',
    wat: 'omzet in het kantoorbeeld',
    gedaan: 'sloot `terugbetaald` al uit via de status en bewoog vanzelf mee' },
  'server/routes/supplier/backoffice.js': { collectie: 'orders', soort: 'telt', stand: 'geen-werk',
    wat: 'betaalde bestellingen in de backoffice van een zaak',
    gedaan: 'idem: sluit `terugbetaald` al uit via de status' },
  'server/kern/kantoor/metrics.js': { collectie: 'orders', soort: 'telt', stand: 'geen-werk',
    wat: 'lopende bestellingen in de kantoormeters',
    gedaan: 'filtert op status nieuw/in bereiding; een terugstorting zet die op terugbetaald' },
  'server/routes/supplier/pda/vloer.js': { collectie: 'orders', soort: 'toont', stand: 'geen-werk',
    wat: 'trage tafels op de PDA',
    gedaan: 'filtert op status nieuw/in bereiding en beweegt daarom vanzelf mee' },
  'server/routes/office/toegang.js': { collectie: 'orders', soort: 'toont', stand: 'om',
    wat: 'de projectie onder de kantoortijdlijn',
    gedaan: 'stuurt sinds deze ronde `teruggestort`; zonder dat veld KON het scherm de waarheid niet tonen' },

  /* --- orders op een scherm. Ze lezen dezelfde stand en breken ZICHTBAAR, en
         twee ervan braken werkelijk: gevonden door deze kaart, niet door een
         toets. De bundels (app-main.js, leverancier.js) staan er niet bij --
         die zijn de som van deze delen. --- */
  'public/apps/leverancier/leverancier-58.js': { collectie: 'orders', soort: 'telt', stand: 'om',
    wat: '"Ontvangen" op het beginscherm van de ondernemer',
    gedaan: 'telde een teruggestorte bon mee in de ontvangen omzet -- stil, want er stond gewoon een bedrag; leest nu `paid && !refunded`' },
  'public/apps/app-main/app-main-43.js': { collectie: 'orders', soort: 'telt', stand: 'om',
    wat: 'de betaalgeschiedenis van een gratis gebruiker',
    gedaan: 'telde het teruggestorte bedrag bij wat je hebt betaald; er zijn nu drie bakken (betaald, open, teruggestort)' },
  'public/apps/backoffice/backoffice-04.js': { collectie: 'orders', soort: 'toont', stand: 'om',
    wat: 'betaald/onbetaald op de kantoortijdlijn',
    gedaan: 'zei "betaald" naast een status "terugbetaald"; toont nu de derde stand uit `teruggestort`' },
  'public/apps/leverancier/leverancier-59.js': { collectie: 'orders', soort: 'toont', stand: 'geen-werk',
    wat: 'de betaalpil en de terugstortknop bij een bon van de zaak',
    gedaan: 'las `refunded` al -- dit is het scherm waar de terugstorting vandaan komt' },
  'public/apps/app-main/app-main-20.js': { collectie: 'orders', soort: 'toont', stand: 'geen-werk',
    wat: 'de bestellingen van het lid ter plaatse',
    gedaan: 'filtert status `terugbetaald` weg voordat het `paid` leest' },
  'public/apps/leverancier/leverancier-08.js': { collectie: 'orders', soort: 'toont', stand: 'geen-werk',
    wat: 'de bonnen op het keuken- en barscherm',
    gedaan: 'krijgt alleen open bonnen: leverancier-09 filtert `terugbetaald` weg' },
  'public/apps/leverancier/leverancier-03b.js': { collectie: 'orders', soort: 'toont', stand: 'geen-werk',
    wat: 'de kolom "betaald" in de bonnenexport',
    gedaan: 'blijft `ja`, en dat is juist: er IS betaald. De kolom `status` ernaast draagt `terugbetaald`' }
};

/* Plekken die `paid` noemen zonder er een betaalstand uit te lezen. Ze staan
   hier zodat de telling klopt en niemand ze aanziet voor werk. */
const GEEN_LEZER = {
  'server/kern/mall/bestellingen.js': 'de mall heeft een eigen bestelwereld met een eigen betaalstand; niet db.data.orders',
  'public/apps/app-main/app-main-48.js': 'leest `delen[].paid` van een GESPLITSTE rekening (/splitsen/mijn) -- een eigen betaalstand, geen bestelling',
  'public/apps/app-main/app-main-34.js': 'leest `ride.paid`; ritten wissen hun betaalstand nog en gaan met hun eigen kaart om'
};

/* STAM EN GEEN NAAM. De collectie van een bestand werd eerst gezocht op de naam
   zelf (`\borders\b`), en dat miste precies de twee vormen die het vaakst
   voorkomen: het enkelvoud (`order.paid`) en een hulpfunctie (`ordersVanZaak`,
   waar geen woordgrens achter `orders` staat). Twee verklaarde lezers vielen
   daardoor buiten de telling en werden gemeld als VERDWENEN -- een kaart die
   zijn eigen werk kwijtraakt. Nu wordt de STAM gezocht aan het begin van een
   woord, dus `order`, `orders`, `orderMetRef` en `Order` tellen alle vier. */
const STAM = { orders: 'order', rides: 'ride', tickets: 'ticket', boekingen: 'boeking' };

/* `'payout.paid'` is de naam van een GEBEURTENIS bij de betaalprovider en geen
   veld van ons. Deze filter haalt vandaag NUL rijen weg -- de twee
   webhookbestanden die hem noemen, vallen toch al af omdat ze geen enkele
   collectie noemen. Hij staat er omdat dat een toevalligheid is: zodra een
   webhookbestand ook maar een bestelling aanraakt, telt `'payout.paid'` mee als
   lezer en staat er werk in de kaart dat niet bestaat. Gemeten met de filter
   uit: dezelfde 60 rijen. */
const GEEN_VELD = /payout\.paid/;

/* De schermen lezen dezelfde betaalstand en breken ZICHTBAAR: een lid dat
   "betaald" ziet staan bij een teruggestorte bon. Ze staan er daarom bij, met
   hun laag erbij -- het werk is een ander soort werk (een scherm leest wat de
   server stuurt), maar een kaart die ze weglaat, telt het werk te laag. En te
   laag tellen is bij een migratiekaart de gevaarlijke kant. */
const BOMEN = [{ map: 'server', laag: 'server' }, { map: 'public', laag: 'scherm' }];

/* DE BUNDELS TELLEN NIET MEE. `public/apps/app-main.js` is de aaneengeplakte som
   van `public/apps/app-main/*.js` (scripts/bundel.js), dus elke lezer stond er
   twee keer in: een keer als deel en een keer als bundel. Dat maakt de kaart
   niet alleen te groot -- het maakt hem ONEERLIJK, want het werk lijkt dubbel
   zo groot als het is. De lijst komt uit de bundelaar zelf en niet uit een
   tweede lijst hier: wie er een bundel bij maakt, hoeft hier niets te doen. */
const BUNDELPADEN = Object.keys(require('./bundel').bundels);
const BUNDELS = new Set(BUNDELPADEN.flatMap(b => [
  'public/' + b,
  'public/dist/min/' + b
]));

/* HOE SCHERP IS DE TOEWIJZING? Twee bereiken, en het smalste dat iets vindt
   wint. Een VENSTER van vijftien regels rond de treffer vindt meestal de plek
   waar de variabele vandaan komt (`ordersVanZaak(...)` staat zelden dertig
   regels verderop); gemeten zakt dat van 2,08 naar 1,60 collecties per bestand.
   Maar bij zes bestanden vindt het venster NIETS, en een bestand zonder
   collectie valt uit de kaart -- precies de faalvorm die deze meter net heeft
   gehad. Daarom valt hij terug op het hele bestand, en draagt elke rij WELK
   bereik hem heeft toegewezen: `venster` is scherp, `bestand` is ruim. */
const VENSTER = 15;

function collectiesVan(regels, hit) {
  const uit = new Set();
  for (const i of hit) {
    const v = regels.slice(Math.max(0, i - VENSTER), i + VENSTER + 1).join('\n');
    for (const c of COLLECTIES) if (new RegExp('\\b' + STAM[c], 'i').test(v)) uit.add(c);
  }
  if (uit.size) return { collecties: [...uit], bereik: 'venster' };
  const heel = regels.join('\n');
  return { collecties: COLLECTIES.filter(c => new RegExp('\\b' + STAM[c], 'i').test(heel)), bereik: 'bestand' };
}

function bestandenMetPaid() {
  const uit = new Map();
  function loop(map, laag) {
    for (const naam of fs.readdirSync(map)) {
      if (naam === 'node_modules' || naam === 'data') continue;
      const p = path.join(map, naam);
      const st = fs.statSync(p);
      if (st.isDirectory()) { loop(p, laag); continue; }
      if (!naam.endsWith('.js')) continue;
      const regels = fs.readFileSync(p, 'utf8').split('\n');
      const hit = regels.map((r, i) => i)
        .filter(i => /\.paid\b/.test(regels[i]) && !/paidAt/.test(regels[i]) && !GEEN_VELD.test(regels[i]));
      if (!hit.length) continue;
      const rel = path.relative(WORTEL, p).replace(/\\/g, '/');
      if (rel.startsWith('public/dist/min/')) continue;
      if (BUNDELS.has(rel)) continue;
      const c = collectiesVan(regels, hit);
      if (!c.collecties.length) continue;
      uit.set(rel, { treffers: hit.length, collecties: c.collecties, bereik: c.bereik, laag });
    }
  }
  for (const b of BOMEN) loop(path.join(WORTEL, b.map), b.laag);
  return uit;
}

function meet() {
  const gevonden = bestandenMetPaid();
  const rijen = [], onbekend = [], verdwenen = [];
  for (const [rel, info] of gevonden) {
    if (GEEN_LEZER[rel]) continue;
    const l = LEZERS[rel];
    const kop = { bestand: rel, treffers: info.treffers, laag: info.laag, bereik: info.bereik };
    if (!l) { onbekend.push(Object.assign(kop, { collecties: info.collecties })); continue; }
    rijen.push(Object.assign(kop, l));
  }
  for (const rel of Object.keys(LEZERS)) if (!gevonden.has(rel)) verdwenen.push(rel);

  const leeg = () => ({ verklaard: 0, onbekend: 0, om: 0, geenWerk: 0, scherm: 0 });
  const perCollectie = {};
  for (const c of COLLECTIES) perCollectie[c] = leeg();
  for (const r of rijen) {
    const p = perCollectie[r.collectie]; if (!p) continue;
    p.verklaard++;
    if (r.stand === 'om') p.om++;
    if (r.stand === 'geen-werk') p.geenWerk++;
    if (r.laag === 'scherm') p.scherm++;
  }
  for (const o of onbekend) for (const c of o.collecties) {
    if (!perCollectie[c]) continue;
    perCollectie[c].onbekend++;
    if (o.laag === 'scherm') perCollectie[c].scherm++;
  }

  const alle = rijen.concat(onbekend);
  return {
    stempel: stempel(),
    soort: 'meting',
    uitleg: 'Welke lezer van een betaalstand (`paid`) kan mee naar de tegenboeking. Orders zijn om; ' +
      'rides, tickets en boekingen niet. Dit telt de lezers en wijst ze aan; het VERKLAART ze niet -- ' +
      'een lezer staat op onbekend tot iemand hem met de hand heeft ingedeeld.',
    grens: 'De toewijzing van een bestand aan een collectie is lexicaal en dus een BOVENgrens: een bestand ' +
      'dat twee collecties noemt, staat bij allebei. Elke rij draagt daarom zijn `bereik` -- `venster` is ' +
      'toegewezen uit vijftien regels rond de treffer en is scherp, `bestand` uit het hele bestand en is ruim. ' +
      'Het zegt ook niets over of een verklaring KLOPT -- alleen dat de plek nog bestaat. En het ziet geen ' +
      'lezer die de betaalstand via een hulpfunctie leest zonder `.paid` te noemen; dat is een ONDERgrens ' +
      'die naast de bovengrens staat en er niet tegen wegvalt.',
    perCollectie, verklaard: rijen, onbekend, verdwenen,
    telling: {
      bestanden: gevonden.size, verklaard: rijen.length, onbekend: onbekend.length, verdwenen: verdwenen.length,
      server: alle.filter(r => r.laag === 'server').length, scherm: alle.filter(r => r.laag === 'scherm').length,
      scherp: alle.filter(r => r.bereik === 'venster').length, ruim: alle.filter(r => r.bereik === 'bestand').length
    }
  };
}

function druk(u) {
  console.log('\nDE REFUNDMIGRATIE -- ' + u.telling.bestanden + ' bestanden met een betaalstand, ' +
    u.telling.verklaard + ' verklaard, ' + u.telling.onbekend + ' onbekend');
  console.log('  ' + u.telling.server + ' op de server, ' + u.telling.scherm + ' op een scherm  |  ' +
    u.telling.scherp + ' scherp toegewezen (venster), ' + u.telling.ruim + ' ruim (heel bestand)\n');
  console.log('  collectie    verklaard  om  geen-werk  onbekend   scherm');
  for (const [c, p] of Object.entries(u.perCollectie))
    console.log('  ' + c.padEnd(12) + String(p.verklaard).padStart(6) + String(p.om).padStart(5) +
      String(p.geenWerk).padStart(10) + String(p.onbekend).padStart(10) + String(p.scherm).padStart(9));
  if (u.verdwenen.length) console.log('\n  LET OP -- verklaard maar niet meer gevonden: ' + u.verdwenen.join(', '));
  console.log('\n  nog te verklaren:');
  for (const o of u.onbekend.slice(0, 40))
    console.log('    ' + o.bestand + '  (' + o.treffers + 'x, ' + o.collecties.join('/') +
      (o.bereik === 'bestand' ? ', ruim' : '') + ')');
  if (u.onbekend.length > 40) console.log('    ... en nog ' + (u.onbekend.length - 40));
  console.log('\n  ' + u.grens + '\n');
}

module.exports = { meet, DOEL, LEZERS, GEEN_LEZER, COLLECTIES };

if (require.main !== module) return;
const u = meet();
druk(u);
if (VAST) { fs.writeFileSync(DOEL, JSON.stringify(u, null, 1) + '\n'); console.log('geschreven: REFUNDMIGRATIE.json'); }
