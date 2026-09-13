/* DRAAGT OF BEWAAKT? -- de twee relaties die `handhaver` samen droeg.

   LAT.md regel 14: een bewijsveld draagt een bewijsrelatie. `handhaver` in
   WETTEN.json droeg er twee, en dat is twee keer onafhankelijk misgegaan (zie de
   regel zelf). Sinds deze splitsing heet elk pad wat het is:

     bewaaktDoor   iets dat DRAAIT en rood wordt als de wet wordt overtreden
     draagt        de plek waar de regel in het PRODUCT wordt uitgevoerd

   WAAROM DIT MODULE IS EN GEEN VELD MET EEN NAAM ERBIJ. Twee kolommen maken is
   niet genoeg: zonder controle kun je een servertbestand onder `bewaaktDoor`
   zetten en een toets onder `draagt`, en dan staat de oude foutklasse er weer,
   alleen netter opgemaakt. Deze module beslist MECHANISCH welke kant een pad op
   hoort, zodat test/wetrelatie.test.js een verkeerde plaatsing kan afwijzen.

   HET SIGNAAL IS "KAN DIT UIT ZICHZELF DRAAIEN", en dat is te zien zonder te
   raden:

     - een toetsbestand (test/*.test.js, test/*.e2e.js) draait en kan zakken
     - een script dat in package.json als opdracht staat, is aan te roepen
     - alles wat alleen door een ANDER wordt aangeroepen (scripts/lib/, een
       helper, een css- of json-bestand, server/ of public/) kan nooit uit
       zichzelf rood worden en is dus een drager

   EEN EERDERE POGING GEBRUIKTE `require.main === module` ALS SIGNAAL en zette
   scripts/check.js -- de keuring van dit huis, onmiskenbaar een wachter -- op
   `onbeslist`. Het bestand heeft die guard niet. package.json is het betere
   signaal omdat het VERKLAARD is: er staat letterlijk dat je dit kunt draaien.

   ONBESLIST IS EEN UITSLAG EN GEEN GAT. Waar de mechanische toets er niet
   uitkomt, staat het pad in BESLOTEN met een reden van een mens. Drie paden
   staan daar vandaag, en alle drie om dezelfde reden. */
'use strict';
const fs = require('fs');
const path = require('path');

const WORTEL = path.join(__dirname, '..', '..');

/* Scripts die een wet bewaken maar die je niet rechtstreeks aanroept: ze zijn de
   MEETMODULE van een wachter (scripts/check.js draait ze). Ze horen niet bij
   `draagt`, want ze voeren de regel niet uit in het product -- ze zijn de
   apparatuur die hem betrapt. Dat is een besluit en geen afleiding, en daarom
   staat het hier met naam en reden in plaats van in een regexp. */
const BESLOTEN = {
  'scripts/ai-oproepen.js': { kant: 'bewaaktDoor',
    waarom: 'meetmodule van de AI-ingangencontrole; wordt door test/menscontext.test.js gedraaid en voert zelf geen productregel uit' },
  'scripts/kruisscan.js': { kant: 'bewaaktDoor',
    waarom: 'meetmodule van het bedradingscontract; wordt door scripts/check.js gedraaid en staat niet in het product' },
  'scripts/schakelbaar.js': { kant: 'bewaaktDoor',
    waarom: 'meetmodule van de routepadcontrole; wordt door check.js, norm.js en isolatieproef.js gedraaid' },
};

let _aanroepbaar = null;
/* Welke scripts verklaart package.json als aan te roepen? Dat is het verschil
   tussen een ingang en een bibliotheek, en het staat er met zoveel woorden. */
function aanroepbareScripts() {
  if (_aanroepbaar) return _aanroepbaar;
  _aanroepbaar = new Set();
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(WORTEL, 'package.json'), 'utf8'));
    for (const cmd of Object.values(pkg.scripts || {})) {
      for (const m of String(cmd).matchAll(/(scripts\/[A-Za-z0-9_/-]+\.js)/g)) _aanroepbaar.add(m[1]);
    }
  } catch (e) { /* geen package.json: dan blijft alles wat script is onbeslist */ }
  return _aanroepbaar;
}

/* De mechanische uitspraak: welke kant hoort dit pad op?
   Geeft 'bewaaktDoor', 'draagt' of 'onbeslist'. */
function kantVan(pad) {
  const p = String(pad || '');
  if (BESLOTEN[p]) return BESLOTEN[p].kant;

  /* Een toets draait en kan zakken. Een helper in test/ doet dat niet. */
  if (/^test\/.+\.(test|e2e)\.js$/.test(p)) return 'bewaaktDoor';
  if (/^test\//.test(p)) return 'draagt';

  /* Een bibliotheek wordt door een ander aangeroepen -- nooit uit zichzelf rood. */
  if (/^scripts\/lib\//.test(p)) return 'draagt';
  if (/^scripts\//.test(p)) return aanroepbareScripts().has(p) ? 'bewaaktDoor' : 'onbeslist';

  /* Het product zelf, en de gegevens waar een regel op staat. */
  if (/^(server|public)\//.test(p)) return 'draagt';
  if (/\.(css|json|md|html)$/.test(p)) return 'draagt';
  return 'onbeslist';
}

/* Lees de twee relaties van een wet. Accepteert het OUDE veld `handhaver` nog,
   maar meldt het als legacy: test/wetrelatie.test.js laat zakken zodra een wet
   er weer een draagt, zodat de migratie niet stilletjes terugloopt. */
function relatiesVan(wet) {
  const uit = { bewaaktDoor: [], draagt: [], legacy: [], onbeslist: [] };
  for (const p of (wet.bewaaktDoor || [])) uit.bewaaktDoor.push(p);
  for (const p of (wet.draagt || [])) uit.draagt.push(p);
  for (const p of (wet.handhaver || [])) uit.legacy.push(p);
  for (const p of [...uit.bewaaktDoor, ...uit.draagt]) {
    if (kantVan(p) === 'onbeslist') uit.onbeslist.push(p);
  }
  return uit;
}

/* Alle paden van een wet, ongeacht in welk veld ze staan. Voor lezers die niet
   om de RELATIE geven maar om het bestaan van het bestand (scripts/wetten.js).
   Accepteert het oude `handhaver` nog, zodat de keuring niet omvalt tijdens een
   migratie -- test/wetrelatie.test.js zorgt dat die legacy leeg blijft. */
function alleHandhavers(wet) {
  return [...(wet.bewaaktDoor || []), ...(wet.draagt || []), ...(wet.handhaver || [])];
}

module.exports = { kantVan, relatiesVan, alleHandhavers, aanroepbareScripts, BESLOTEN, WORTEL };
