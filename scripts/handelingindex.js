#!/usr/bin/env node
/* ============================================================================
   DE HANDELINGINDEX -- wat je in een app kunt DOEN, vindbaar vanaf elk scherm.

   WAAROM DIT ER IS. scripts/vindbaar.js meet of je een functie terugvindt met
   een woord dat er zelf op staat, en de eerste meting was 21%. De reden bleek
   niet te zijn dat de namen slecht zijn: de gemiste woorden waren bijna
   allemaal HANDELINGEN -- "fooi verdelen", "gang vrijgeven", "tegoed klaarzetten"
   -- en die stonden nergens in een index. De sprong kende alleen de handelingen
   van het scherm waar je toevallig al stond (shared/appmenu.js).

   Wat hier gegenereerd wordt is dus geen tweede lijst apps maar een laag
   eronder: per bestemming de etiketten van zijn eigen knoppen en tabs, gelezen
   uit het scherm zelf. Verandert een knop, dan verandert deze lijst mee zodra
   iemand hem opnieuw draait; en scripts/check.js zakt als hij achterloopt.

   WAT EEN RIJ BELOOFT, en wat niet. Een rij zegt: "deze handeling woont daar",
   en een tik brengt je naar dat scherm. Hij VOERT NIETS UIT. Dat is geen
   halfheid maar de grens uit GRAMMATICA.md en LIFE.md: klaarzetten mag, doen
   doet de mens -- en een handeling op afstand uitvoeren zonder het scherm te
   zien is precies wat je nooit wilt.

   ALLEEN ONDERSCHEIDENDE ETIKETTEN. "Open", "Sluiten" en "Zoeken" staan overal;
   die als handeling aanbieden maakt elke zoekopdracht een lijst van alles.

   Draai: node scripts/handelingindex.js            (schrijft public/shared/handelingindex.json)
          node scripts/handelingindex.js --controle (zakt als hij achterloopt)
   ========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');
const { etikettenVan } = require('./lib/schermwoorden');

const WORTEL = path.join(__dirname, '..');
const INDEX = path.join(WORTEL, 'public', 'shared', 'sprongindex.json');
const DOEL = path.join(WORTEL, 'public', 'shared', 'handelingindex.json');
const controle = process.argv.includes('--controle');

const DREMPEL = 3;      // op hoeveel schermen een etiket hoogstens mag staan
/* ACHTTIEN WERD ZESENTWINTIG op 31 augustus 2026, en niet om een cijfer te
   redden. De lezer werd vervangen (scripts/lib/ontleed.js) en haalt sindsdien
   schonere en meer etiketten uit een scherm -- een knop met een icoon erin
   leverde eerst rommel en nu zijn tekst. Daarmee groeide ook de woordenschat
   waar scripts/vindbaar.js tegen meet, en dan hoort er meer geindexeerd te
   worden, niet minder. Gemeten: 18 gaf 59,9%, 26 geeft 62,8%, 34 geeft 63,9% --
   de winst vlakt af, dus 26. */
const PER_SCHERM = 26;  // hoeveel handelingen we per app tonen

function bouw() {
  const index = JSON.parse(fs.readFileSync(INDEX, 'utf8'));
  const doelen = index.items.filter((i) => i.url && !i.huis);
  const ruw = new Map();
  const telling = new Map();
  for (const item of doelen) {
    const et = etikettenVan(WORTEL, item.url);
    ruw.set(item, et);
    for (const e of et) telling.set(e.toLowerCase(), (telling.get(e.toLowerCase()) || 0) + 1);
  }
  const items = [];
  for (const item of doelen) {
    const eigen = ruw.get(item).filter((e) => telling.get(e.toLowerCase()) <= DREMPEL).slice(0, PER_SCHERM);
    for (const label of eigen) items.push({ label, app: item.naam, wereld: item.wereld, url: item.url });
  }
  return { uitleg: 'Gegenereerd door scripts/handelingindex.js uit de knoppen en tabs van de schermen zelf. Een rij zegt waar een handeling woont en brengt je erheen; hij voert niets uit. Bewerk dit bestand niet met de hand.',
    items: items.sort((a, b) => a.app.localeCompare(b.app) || a.label.localeCompare(b.label)) };
}

const nieuw = JSON.stringify(bouw(), null, 2) + '\n';
if (controle) {
  const oud = fs.existsSync(DOEL) ? fs.readFileSync(DOEL, 'utf8') : '';
  if (oud !== nieuw) { console.error('public/shared/handelingindex.json loopt achter op de schermen. Draai: npm run handelingindex'); process.exit(1); }
  console.log('handelingindex: gelijk aan de schermen.');
} else {
  fs.writeFileSync(DOEL, nieuw);
  console.log('public/shared/handelingindex.json geschreven (' + JSON.parse(nieuw).items.length + ' handelingen).');
}
