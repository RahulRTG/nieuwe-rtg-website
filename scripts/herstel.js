#!/usr/bin/env node
/* DE TERUGWEG PER ROUTE -- en de eerlijke uitkomst dat hij niet af te leiden is.

   EXECUTIE.md blok 5 vraagt twee eigenschappen per capability: HERHALING (wat
   doet een tweede aanroep) en HERSTEL (hoe krijg je het terug). De eerste heeft
   dit huis al: IDEMPROEF.json meet hem en IDEMBESLUIT.json verklaart hem, met
   zeven klassen waaronder het eerlijke `tebeslissen`. De tweede bestaat niet, en
   `bon.js` zegt precies waarom dat gat pijn doet: *een terugweg beloven die niet
   bestaat is erger dan geen terugweg tonen.*

   DE VERLEIDING is om de tegenhanger af te leiden uit de naam: /toevoegen hoort
   bij /verwijder, /publiceer bij /offline. Dit script doet dat, en het RESULTAAT
   IS EEN NEGATIEF: van de 3282 routes heeft er ongeveer 2% een kandidaat, en van
   die kandidaten is een deel aantoonbaar fout. /api/agenda/bewaar wordt gekoppeld
   aan /api/agenda/verwijder terwijl bewaren een wijziging is en geen aanmaak, en
   /api/asset/herroep past even goed op /koop als op /gebruik.

   DAAROM STAAT ER NERGENS `exact`. Elke gevonden tegenhanger draagt de graad
   `vermoed` (BESTUUR.md: onbekend / vermoed / gemeten / bewezen), en een vermoeden
   mag nooit een terugweg beloven aan een gebruiker. Wat hier uitkomt is bruikbaar
   als AANWIJZING voor de mens die de klasse vaststelt, en voor niets anders.

   DE CONCLUSIE HOORT BIJ DE METING: herstel heeft een VERKLARINGSregister nodig
   zoals IDEMBESLUIT.json, ingevuld door mensen, met dezelfde eerlijke klasse voor
   "hier is nog niet over besloten". Dit script is de voorbereiding daarop, geen
   vervanging ervan.

   Draaien: npm run herstel */
'use strict';
const fs = require('fs');
const path = require('path');
const WORTEL = path.join(__dirname, '..');

/* Woordparen die in het Nederlands elkaars omkering ZOUDEN kunnen zijn. Dit is
   taal en geen routekennis: er staat geen pad in. Elk woord moet ook echt als
   laatste segment voorkomen, anders wijst het paar nergens heen -- dat toetst
   test/herstel.test.js, net als bij de bruggen van de resolver. */
const PAREN = Object.freeze([
  ['toevoegen', 'verwijder'], ['maak', 'weg'], ['open', 'sluit'], ['start', 'stop'],
  ['zet', 'stop'], ['publiceer', 'offline'], ['live', 'offline'], ['koop', 'herroep'],
  ['kom', 'verlaat'], ['aanmelden', 'afmelden'], ['inschrijf', 'uitstap'],
  ['uitgeven', 'sluit'], ['gebruik', 'herroep'],
  ['bewaar', 'verwijder'], ['plaats', 'annuleer'], ['boek', 'annuleer'],
  ['reserveer', 'annuleer'], ['verzoek', 'intrek'], ['uitnodig', 'intrek']
]);

const laatste = p => p.split('/').pop();
const prefix = p => p.split('/').slice(0, -1).join('/');

function routes() {
  let reg;
  try { reg = JSON.parse(fs.readFileSync(path.join(WORTEL, 'IDEMPROEF.json'), 'utf8')); }
  catch (e) { return null; }
  return [...new Set((reg.perRoute || [])
    .filter(r => r && r.methode === 'POST' && typeof r.pad === 'string').map(r => r.pad))].sort();
}

function bouw() {
  const alle = routes();
  if (!alle) return { fout: 'IDEMPROEF.json ontbreekt -- draai eerst: npm run idemproef' };
  const buren = {};
  for (const p of alle) (buren[prefix(p)] = buren[prefix(p)] || []).push(laatste(p));

  const per = {};
  let vermoed = 0, dubbelzinnig = 0;
  for (const p of alle) {
    const l = laatste(p), pre = prefix(p);
    const doelen = new Set();
    for (const [a, b] of PAREN) {
      if (l === a && (buren[pre] || []).includes(b)) doelen.add(b);
      if (l === b && (buren[pre] || []).includes(a)) doelen.add(a);
    }
    if (doelen.size === 1) {
      vermoed++;
      per[p] = { graad: 'vermoed', tegenhanger: pre + '/' + [...doelen][0],
        reden: 'de namen zijn elkaars omkering; niemand heeft bevestigd dat de handeling dat ook is' };
    } else if (doelen.size > 1) {
      dubbelzinnig++;
      per[p] = { graad: 'onbepaald', kandidaten: [...doelen].map(d => pre + '/' + d),
        reden: 'meer dan een naam past; welke de echte omkering is, kan alleen een mens zeggen' };
    }
  }
  return {
    uitleg: 'Kandidaat-tegenhangers per route, afgeleid uit de NAMEN. Niets hierin is bevestigd: ' +
      'de hoogste graad is `vermoed`. Een terugweg beloven op grond van een vermoeden is precies wat ' +
      'server/kern/stuur/bon.js weigert. Herstel heeft een verklaringsregister nodig zoals IDEMBESLUIT.json.',
    gemeten: { routes: alle.length, vermoed, dubbelzinnig, zonderKandidaat: alle.length - vermoed - dubbelzinnig,
      dekkingPct: Math.round(1000 * (vermoed + dubbelzinnig) / alle.length) / 10 },
    grens: 'Deze afleiding kijkt alleen naar het LAATSTE segment binnen hetzelfde voorvoegsel. Zij mist ' +
      'elke terugweg die anders heet (een compensatie, een creditnota, een annulering bij een derde) en ' +
      'zij vindt paren die geen omkering zijn -- /agenda/bewaar is een wijziging en geen aanmaak. ' +
      'Het percentage is dus een bovengrens van wat NAMEN kunnen zeggen, niet van wat waar is. ' +
      'En zij mist een hele VORM: een schakelaar. Het paar bevries/ontdooi stond hier eerst in en werd ' +
      'door de toets verworpen omdat `ontdooi` nergens als route-einde bestaat -- /api/bank/bevries zet ' +
      'de stand vermoedelijk in EEN route met een vlag in het lichaam. Zo n terugweg is per definitie ' +
      'onzichtbaar voor een vergelijking van namen.',
    bevestigd: [],
    bevestigdUitleg: 'Leeg, en dat is de stand: niemand heeft een tegenhanger bevestigd. Zolang deze ' +
      'lijst leeg is, mag geen enkel scherm en geen enkele bon een terugweg beloven.',
    per
  };
}

function main() {
  const r = bouw();
  if (r.fout) { console.error(r.fout); process.exit(2); }
  const g = r.gemeten;
  console.log('DE TERUGWEG PER ROUTE\n');
  console.log('  routes                ' + g.routes);
  console.log('  vermoede tegenhanger  ' + g.vermoed);
  console.log('  dubbelzinnig          ' + g.dubbelzinnig);
  console.log('  geen kandidaat        ' + g.zonderKandidaat);
  console.log('  dekking               ' + g.dekkingPct + '%  <- dit is de uitkomst, en het is een negatief\n');
  const dub = Object.entries(r.per).filter(([, v]) => v.graad === 'onbepaald');
  if (dub.length) {
    console.log('  dubbelzinnig, want meer dan een naam past:');
    for (const [p, v] of dub) console.log('    ' + p + ' -> ' + v.kandidaten.join(' OF '));
  }
  console.log('\n  bevestigd: ' + r.bevestigd.length + ' -- ' + r.bevestigdUitleg);
  fs.writeFileSync(path.join(WORTEL, 'HERSTEL.json'), JSON.stringify(r, null, 1) + '\n');
  console.log('\nHERSTEL.json geschreven.');
}

if (require.main === module) main();
module.exports = { bouw, PAREN, laatste, prefix };
