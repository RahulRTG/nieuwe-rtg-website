#!/usr/bin/env node
/* DE KAARTIMPORTEUR VAN MAGNAAT: van open adresdata naar speelbare kavels.

   Magnaat speelt op echte geografie. Dat is een productbesluit (een speler uit
   IJmuiden hoort IJmuiden te herkennen) en het brengt precies een risico mee:
   een echt adres is vaak iemands huis.

   DIT SCRIPT IS DE ZEEF, en dat is de hele reden dat het bestaat.

   DE REGEL: ALLES MET EEN WOONFUNCTIE VALT ERUIT. De BAG kent per
   verblijfsobject een `gebruiksdoel` uit een gesloten lijst -- woonfunctie,
   winkelfunctie, kantoorfunctie, industriefunctie, logiesfunctie,
   bijeenkomstfunctie, sportfunctie, onderwijsfunctie, gezondheidszorgfunctie,
   celfunctie, overige gebruiksfunctie. Alleen de niet-woonfuncties worden een
   speelbaar kavel. Een adres in de spelwereld is dus per definitie een adres
   waar geen huishouden op staat ingeschreven.

   Dat is een CONTROLEERBARE regel en geen goede bedoeling. Een object met
   meerdere gebruiksdoelen waarvan er een woonfunctie is (een winkel met een
   bovenwoning) valt er ook uit: bij twijfel geen kavel. Dat kost speelbare
   plekken in een winkelstraat, en dat is de goede kant om op te falen.

   WAT DIT SCRIPT NIET DOET: bedenken. Het leest een extract, zeeft, en schrijft
   een stadsbestand met een `bron`-veld erin. Wat niet uit de data komt, komt er
   niet in -- ook geen "ongeveer" huisnummer.

   GEBRUIK
     node scripts/kaart-import.js <stad> <extract.json> [uit.js]

   Het extract is een JSON-lijst met per object minimaal:
     { straat, huisnummer, gebruiksdoel: [..], lat, lon, oppervlak?, postcode? }
   Zo levert PDOK/BAG hem (via de BAG-API of een gedownloade extractie), en zo
   is een Overpass-antwoord er met een paar regels naartoe te vormen. De vorm
   staat hier en niet in een leverancierspecifieke lezer, want dan is er maar
   EEN plek die weet wat een kavel nodig heeft.

   WAAROM ER VANDAAG GEEN OPEN-DATA-STAD IN DE REPO STAAT: de omgeving waarin
   dit geschreven is laat geen verkeer naar PDOK of Overpass toe. De stad die er
   wel staat draagt `bron: 'handmatig'` en heeft daarom GEEN huisnummers -- zie
   de kop van server/kern/spellen/magnaat/kaart-data/ijmuiden.js. */
'use strict';
const fs = require('fs');
const path = require('path');

/* De gesloten lijst uit de BAG. Hij staat hier voluit omdat de zeef ERUIT
   redeneert: alles wat niet in deze lijst staat is onbekend, en onbekend telt
   als woonfunctie -- dus als "niet speelbaar". Een nieuw gebruiksdoel in de BAG
   laat dus kavels wegvallen in plaats van er stilletjes bijkomen. */
const GEBRUIKSDOELEN = new Set(['woonfunctie', 'bijeenkomstfunctie', 'celfunctie',
  'gezondheidszorgfunctie', 'industriefunctie', 'kantoorfunctie', 'logiesfunctie',
  'onderwijsfunctie', 'sportfunctie', 'winkelfunctie', 'overige gebruiksfunctie']);

// welke functie op welke sector uitkomt; 'overige' blijft breed inzetbaar
const SECTOR = {
  winkelfunctie: 'retail', logiesfunctie: 'hotel', bijeenkomstfunctie: 'horeca',
  kantoorfunctie: 'kantoor', industriefunctie: 'industrie', sportfunctie: 'vrije-tijd',
  onderwijsfunctie: 'publiek', gezondheidszorgfunctie: 'publiek', celfunctie: 'publiek',
  'overige gebruiksfunctie': 'gemengd'
};

/* DE ZEEF. Geeft terug waarom iets afvalt, want een importeur die stil weggooit
   is een importeur waarvan niemand weet wat hij deed. */
function zeef(obj) {
  const doelen = Array.isArray(obj.gebruiksdoel) ? obj.gebruiksdoel.map(d => String(d).toLowerCase().trim())
    : String(obj.gebruiksdoel || '').toLowerCase().trim().split(/\s*,\s*/).filter(Boolean);
  if (!doelen.length) return { weg: 'geen gebruiksdoel' };
  if (doelen.includes('woonfunctie')) return { weg: 'woonfunctie' };
  const onbekend = doelen.filter(d => !GEBRUIKSDOELEN.has(d));
  if (onbekend.length) return { weg: 'onbekend gebruiksdoel: ' + onbekend.join('/') };
  if (!obj.straat || obj.huisnummer == null) return { weg: 'geen volledig adres' };
  if (!(Number.isFinite(obj.lat) && Number.isFinite(obj.lon))) return { weg: 'geen positie' };
  return { sector: SECTOR[doelen[0]] || 'gemengd', doelen };
}

function importeer(stad, objecten) {
  const kavels = [], afgevallen = {};
  for (const o of objecten) {
    const r = zeef(o);
    if (r.weg) { afgevallen[r.weg] = (afgevallen[r.weg] || 0) + 1; continue; }
    kavels.push({
      straat: String(o.straat).trim(),
      nr: String(o.huisnummer).trim() + (o.toevoeging ? String(o.toevoeging).trim() : ''),
      lat: Math.round(o.lat * 1e6) / 1e6, lon: Math.round(o.lon * 1e6) / 1e6,
      sector: r.sector,
      m2: Number.isFinite(o.oppervlak) ? Math.round(o.oppervlak) : null
    });
  }
  // dubbele adressen (meerdere verblijfsobjecten in een pand) tellen als een kavel
  const uniek = new Map();
  for (const k of kavels) uniek.set(k.straat + '|' + k.nr, k);
  return { kavels: [...uniek.values()].sort((a, b) => (a.straat + a.nr).localeCompare(b.straat + b.nr)), afgevallen };
}

function schrijf(stad, uit, resultaat, bronTekst) {
  const kop = `/* Magnaat, kaartdata: ${stad}. GEGENEREERD door scripts/kaart-import.js --\n` +
    `   niet met de hand bijwerken, want dan loopt hij uiteen met de bron.\n\n` +
    `   Bron: ${bronTekst}\n` +
    `   Gezeefd: alles met een woonfunctie is eruit (zie de kop van de importeur).\n` +
    `   Kavels: ${resultaat.kavels.length}. Afgevallen: ` +
    Object.entries(resultaat.afgevallen).map(([r, n]) => `${r} (${n})`).join(', ') + '. */\n';
  fs.writeFileSync(uit, kop + 'module.exports = ' +
    JSON.stringify({ stad, bron: 'open-data', bronTekst, kavels: resultaat.kavels }, null, 1) + ';\n');
}

if (require.main === module) {
  const [stad, extract, uit] = process.argv.slice(2);
  if (!stad || !extract) {
    console.error('gebruik: node scripts/kaart-import.js <stad> <extract.json> [uit.js]');
    process.exit(2);
  }
  const objecten = JSON.parse(fs.readFileSync(extract, 'utf8'));
  const r = importeer(stad, Array.isArray(objecten) ? objecten : (objecten.objecten || []));
  const doel = uit || path.join(__dirname, '..', 'server', 'kern', 'spellen', 'magnaat', 'kaart-data',
    stad.toLowerCase().replace(/[^a-z0-9]/g, '') + '.js');
  schrijf(stad, doel, r, 'open data, geimporteerd uit ' + path.basename(extract));
  console.log(r.kavels.length + ' kavels geschreven naar ' + doel);
  for (const [reden, n] of Object.entries(r.afgevallen)) console.log('  afgevallen: ' + reden + ' (' + n + ')');
}

module.exports = { zeef, importeer, GEBRUIKSDOELEN, SECTOR };
