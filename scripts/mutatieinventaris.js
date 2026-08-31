#!/usr/bin/env node
/* ============================================================================
   DE VIJF INVENTARISSEN, EN WAAROM ZE VAN ELKAAR VERSCHILLEN.

   WAAROM DIT BESTAND ER IS, EN WAAROM HET VOOR DE REST KOMT.

   Er circuleerden vier getallen die alle vier "het aantal routes" heetten:

     4103  routes in de bron              (CREATE.md, par. 10)
     3074  routes met een rol             (CREATE.md, kern/mutatie.js)
     4564  schrijfroutes                  (IDEMSCHULD.json)
     4643  routes aangeroepen             (IDEMPROEF.json)

   Ze zijn geen van vieren fout. Ze tellen alleen niet hetzelfde, en dat stond
   nergens. Zolang dat zo is, is elk percentage dat je erop bouwt onbruikbaar:
   845 van 3074 en 845 van 4643 zijn hetzelfde werk met een verschil van tien
   procentpunt, en niemand kan zien welke van de twee hij voor zich heeft.

   Dit script leidt ze alle vijf af uit EEN bron (de routekaart uit de draaiende
   router, zie scripts/lib/routes.js) en zegt per stap hoeveel er afvallen en
   waarom. Zo is elk verschil een REGEL met een reden, en geen restpost.

   DE VIJF, van breed naar smal:

     1. ROUTE INVENTORY        alles wat de router kent, elk werkwoord.
     2. MUTATION INVENTORY     daarvan alles wat kan SCHRIJVEN (niet-GET, /api).
     3. AUTHORIZATION INVENTORY  wie de deur bewaakt, per soort.
     4. IDEMPOTENCY INVENTORY  wat de idemproef kon AANROEPEN.
     5. EVIDENCE INVENTORY     waarover werkelijk een uitspraak is gedaan.

   De trap loopt maar een kant op: elke laag is een deelverzameling van de vorige,
   en waar dat NIET zo is, is dat zelf de bevinding. Dat gebeurde: de idemproef
   sluit paden met een parameter uit (/api/x/:id) en de schuldteller niet, dus de
   vierde was op een punt BREDER dan de tweede. Zulke kruisingen staan hieronder
   apart, want ze zijn de plek waar twee tellingen elkaar tegenspreken.

   Draaien:  node scripts/mutatieinventaris.js [--vastleggen]
   ========================================================================== */
'use strict';

const fs = require('fs');
const path = require('path');
const { alleRoutes, isSchakel, bewakerskaart } = require('./lib/routes');
const { stempel } = require('./lib/stempel');

const WORTEL = path.join(__dirname, '..');
const UITSLAG = path.join(WORTEL, 'MUTATIEINVENTARIS.json');
const vastleggen = process.argv.includes('--vastleggen');

const sleutel = (r) => String(r.methode || 'POST').toUpperCase() + ' ' + r.pad;

/* ---------------------------------------------------------------------------
   1. ROUTE INVENTORY -- alles wat de router kent.
   ------------------------------------------------------------------------- */
const alles = alleRoutes();

/* ---------------------------------------------------------------------------
   2. MUTATION INVENTORY -- wat kan schrijven.

   Drie zeven, elk met een reden die het waard is te kennen:

     - GET valt af. Lezen is per definitie herhaalbaar; daar is geen contract
       over duplicaatgedrag te sluiten. (Een GET die schrijft is een fout van een
       andere soort, en scripts/check.js jaagt daar apart op.)
     - alles buiten /api/ valt af: dat zijn pagina's en bestanden.
     - de SCHAKELPADEN vallen af. Dat is de platformbrede schakelkast; een proef
       die daar rommel heen stuurt zet onderweg functies uit en meet daarna een
       platform dat hij zelf half heeft afgebroken.
   ------------------------------------------------------------------------- */
const schrijf = alles.filter(r => r.pad.startsWith('/api/') && String(r.methode).toUpperCase() !== 'GET');
const schrijfBuitenSchakel = schrijf.filter(r => !isSchakel(r.pad));

/* ---------------------------------------------------------------------------
   3. AUTHORIZATION INVENTORY -- wie bewaakt de deur.

   Niet "wel of geen rol", maar de zeven soorten uit scripts/lib/bewakers.js. Een
   route zonder bewakerslaag is namelijk geen route zonder beveiliging: hij kan
   bewaakt worden in zijn handler, of met opzet open staan. Dat verschil is
   precies wat een restcategorie wegneemt.
   ------------------------------------------------------------------------- */
const perBewakerssoort = {};
const zonderLaag = [];
for (const r of schrijfBuitenSchakel) {
  const namen = Array.isArray(r.bewakers) ? r.bewakers : [];
  if (!r.bewakersBekend) { perBewakerssoort['(router noemt geen bewakers)'] = (perBewakerssoort['(router noemt geen bewakers)'] || 0) + 1; continue; }
  if (!namen.length) { zonderLaag.push(r); perBewakerssoort['(geen bewakerslaag)'] = (perBewakerssoort['(geen bewakerslaag)'] || 0) + 1; continue; }
  /* De ZWAARSTE soort telt, net als in bewakers.js: een verfijner zegt niets
     over wie er binnenkomt, en `mw` (een rem) mag een echte deur niet
     overschrijven. */
  const RANG = { rol: 6, eigenrol: 5, lichaamssleutel: 4, objectpoort: 3, omgeving: 2, geenBewaker: 1, verfijner: 0, onbekend: 0 };
  const soorten = namen.map(n => bewakerskaart.soortVan(n));
  const zwaarste = soorten.slice().sort((a, b) => (RANG[b] || 0) - (RANG[a] || 0))[0] || 'onbekend';
  perBewakerssoort[zwaarste] = (perBewakerssoort[zwaarste] || 0) + 1;
}

/* ---------------------------------------------------------------------------
   4. IDEMPOTENCY INVENTORY -- wat de idemproef kon aanroepen.

   Hij slaat paden met een PARAMETER over (/api/x/:id). Dat is geen slordigheid:
   zo'n pad is geen adres maar een vorm, en er een verzinnen levert een 404 op
   die niets meet. Ze horen bij een proef die eerst een object aanmaakt en dan
   zijn eigen id invult -- en die bestaat nog niet.
   ------------------------------------------------------------------------- */
const metParameter = schrijfBuitenSchakel.filter(r => r.pad.includes(':'));
const aanroepbaar = schrijfBuitenSchakel.filter(r => !r.pad.includes(':'));

/* ---------------------------------------------------------------------------
   5. EVIDENCE INVENTORY -- waarover werkelijk iets is vastgesteld.
   ------------------------------------------------------------------------- */
let proef = null;
try { proef = JSON.parse(fs.readFileSync(path.join(WORTEL, 'IDEMPROEF.json'), 'utf8')); } catch (e) {}
const gemetenRijen = (proef && proef.perRoute) || [];
const gemeten = new Map(gemetenRijen.map(r => [sleutel(r), r]));
const metUitspraak = gemetenRijen.filter(r => r.idempotentie !== 'ongemeten');
const metKaleUitspraak = gemetenRijen.filter(r => r.zonderSleutel && r.zonderSleutel.stand !== 'ongemeten');

/* De verklaringen: het enige universum dat NIET uit de router komt maar uit een
   besluit van een mens. */
let verklaard = {};
try { verklaard = require('../server/lib/idemsleutels').SLEUTELS; } catch (e) {}
const verklaardeSleutels = new Set(Object.keys(verklaard));

/* ---------------------------------------------------------------------------
   DE KRUISINGEN -- waar twee tellingen elkaar tegenspreken.
   ------------------------------------------------------------------------- */
const aanroepbaarSet = new Set(aanroepbaar.map(sleutel));
const schrijfSet = new Set(schrijfBuitenSchakel.map(sleutel));

/* Gemeten maar niet in de schrijflijst: dat hoort niet te kunnen. */
const gemetenBuitenInventaris = [...gemeten.keys()].filter(k => !schrijfSet.has(k));
/* Verklaard maar niet bestaand: een verklaring die het schuldgetal kunstmatig
   laag houdt (scripts/idemschuld.js noemt ze weesverklaringen). */
const weesVerklaringen = [...verklaardeSleutels].filter(k => !schrijfSet.has(k));
/* In de schuld maar met een schakelpad: die telt IDEMSCHULD wel mee en de proef
   niet. */
const schakelInSchuld = schrijf.filter(r => isSchakel(r.pad)).map(sleutel);

const rij = (n, wat) => String(n).padStart(6) + '  ' + wat;

console.log('\n=== DE VIJF INVENTARISSEN ===\n');
console.log(rij(alles.length, '1. ROUTE INVENTORY -- alles wat de router kent'));
console.log(rij(-(alles.length - schrijf.length), '   af: GET, en alles buiten /api/ (lezen is per definitie herhaalbaar)'));
console.log(rij(schrijf.length, '2. MUTATION INVENTORY -- schrijfroutes onder /api/  <- dit is de noemer van IDEMSCHULD'));
console.log(rij(-(schrijf.length - schrijfBuitenSchakel.length), '   af: de schakelkast (een proef die daar rommel heen stuurt, breekt zijn eigen meting)'));
console.log(rij(schrijfBuitenSchakel.length, '   schrijfroutes buiten de schakelkast'));
console.log(rij(-metParameter.length, '   af: paden met een parameter (/api/x/:id) -- een verzonnen id meet niets'));
console.log(rij(aanroepbaar.length, '4. IDEMPOTENCY INVENTORY -- wat de idemproef kan aanroepen  <- de noemer van IDEMPROEF'));
console.log('');
console.log(rij(gemetenRijen.length, '   daarvan werkelijk aangeroepen in de laatste ronde'));
console.log(rij(metUitspraak.length, '5. EVIDENCE INVENTORY -- met een uitspraak MET sleutel (de platformlaag)'));
console.log(rij(metKaleUitspraak.length, '   met een uitspraak ZONDER sleutel (de dubbeltik -- de route zelf)'));
console.log(rij(verklaardeSleutels.size, '   met een VERKLARING in server/lib/idemsleutels.js (een besluit, geen meting)'));

console.log('\n=== 3. AUTHORIZATION INVENTORY (over de ' + schrijfBuitenSchakel.length + ' schrijfroutes) ===\n');
for (const [soort, n] of Object.entries(perBewakerssoort).sort((a, b) => b[1] - a[1])) {
  console.log(rij(n, soort));
}

console.log('\n=== DE KRUISINGEN -- waar twee tellingen elkaar tegenspreken ===\n');
console.log(rij(metParameter.length, 'schrijfroutes met een parameter: WEL in de schuld, NIET in de proef'));
console.log(rij(schakelInSchuld.length, 'schakelpaden: WEL in de schuld, NIET in de proef'));
console.log(rij(gemetenBuitenInventaris.length, 'gemeten maar niet in de mutatie-inventaris (hoort 0 te zijn)'));
console.log(rij(weesVerklaringen.length, 'verklaringen voor een route die niet bestaat (houdt de schuld kunstmatig laag)'));
for (const w of weesVerklaringen.slice(0, 10)) console.log('        ' + w);
if (gemetenBuitenInventaris.length) {
  console.log('\n  LET OP: er is gemeten buiten de inventaris. Dan telt de ene meter iets');
  console.log('  dat de andere niet kent, en elk percentage tussen die twee is fictie.');
  for (const g of gemetenBuitenInventaris.slice(0, 10)) console.log('        ' + g);
}

if (vastleggen) {
  fs.writeFileSync(UITSLAG, JSON.stringify({
    stempel: stempel(),
    uitleg: 'De vijf inventarissen uit EEN bron, met per stap hoeveel er afvallen en waarom. ' +
      'Zonder dit bestand heten vier verschillende getallen allemaal "het aantal routes", en is elk ' +
      'percentage dat erop rust niet na te rekenen.',
    grens: 'Dit telt wat de ROUTER kent. Een mutatie die niet over HTTP binnenkomt -- een taak, een ' +
      'achtergrondlus, een migratie -- staat hier niet in en is daarmee niet geteld, niet veilig.',
    inventarissen: {
      route: alles.length,
      mutatie: schrijf.length,
      mutatieBuitenSchakel: schrijfBuitenSchakel.length,
      idempotentieAanroepbaar: aanroepbaar.length,
      werkelijkAangeroepen: gemetenRijen.length,
      bewijsMetSleutel: metUitspraak.length,
      bewijsZonderSleutel: metKaleUitspraak.length,
      verklaard: verklaardeSleutels.size
    },
    autorisatie: perBewakerssoort,
    kruisingen: {
      metParameter: metParameter.length,
      schakelpaden: schakelInSchuld.length,
      gemetenBuitenInventaris,
      weesVerklaringen
    }
  }, null, 1) + '\n');
  console.log('\n  MUTATIEINVENTARIS.json geschreven.');
} else {
  console.log('\n  (niets weggeschreven -- draai met --vastleggen)');
}
