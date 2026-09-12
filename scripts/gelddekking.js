#!/usr/bin/env node
/* DE ECONOMISCHE DEKKING: wat weten we van elke weg die waarde beweegt?

   WAAROM DEZE METER NAAST DE GELDKAART STAAT EN ER NIET IN ZIT. Ze beantwoorden
   twee verschillende vragen en hebben daarom twee verschillende noemers.
   scripts/geldkaart.js vraagt: gaat elke MUTATIE door haar poort -- geteld in
   schrijfacties, waargenomen tijdens een draai. Dit vraagt: wat is er van elke
   ROUTE bewezen -- geteld in routes, samengesteld uit registers. Wie die twee in
   een bestand stopt, telt vroeg of laat een schrijfactie bij een route op.

   ER KOMT GEEN SAMENGESTELD CIJFER, en dat is de belangrijkste regel hier.
   Een enkel "Economic Coverage: 78%" boven deze tabel is precies wat
   keuringsregel 48 en LAT.md regel 11 verbieden: losse eerlijke getallen die
   samen een gevaarlijk gevoel geven. 42 van 42 bevoegdheden bewezen en 3 van 42
   terugwegen beproefd zijn geen 53%; het zijn twee uitspraken waarvan de tweede
   alarmerend is en de eerste geruststellend, en een gemiddelde maakt van allebei
   niets. Elke as draagt hieronder haar eigen teller EN haar eigen noemer.

   DE BRONNEN, EN WAT ELKE BRON WEL EN NIET KAN ZEGGEN:

     GELDKAART.json        WELKE routes waarde bewegen (as 1). Zelf een
                           ONDERgrens: alleen routes waar de idempotentieproef
                           langskwam hebben een gemeten collectie.
     MUTATIECONTRACT.json  per route de semantiek (wat doet een tweede aanroep),
                           de waargenomen TOEGANG en het idempotentiebewijs.
     IDEMPROEF.json        de gemeten idempotentie (via de geldkaart meegereisd).
     HERSTELPROEF.json     of een tegenhanger werkelijk ongedaan maakt wat de
                           heenweg deed -- BEPROEFD, niet afgeleid uit een naam.

   WAT ER NIET IN STAAT, MET REDEN. Twee assen die er horen te staan en waarvoor
   in dit huis geen meting bestaat, staan hieronder als ONBEKEND en niet als nul:
   crash-herstel (wat gebeurt er als het proces sterft tussen providercommit en
   grootboekcommit) en externe settlement (geen providersleutel staat gezet, dus
   geen extern betaalpad is ooit uitgevoerd). Een lege as die als 0 wordt geteld,
   leest als een gemeten nul -- en dat is het tegenovergestelde van wat hij is.

   Draai los:  npm run gelddekking  */
'use strict';

const fs = require('fs');
const path = require('path');

const WORTEL = path.join(__dirname, '..');

function lees(naam) {
  try { return JSON.parse(fs.readFileSync(path.join(WORTEL, naam), 'utf8')); }
  catch (e) { return null; }
}

/* HET STEMPEL KOMT UIT scripts/lib/stempel.js EN IS NIET ZELFGEMAAKT. De eerste
   versie zette hier datum + commit, en dat ziet er compleet uit terwijl het veld
   ontbreekt waar het om draait: `boomVuil`. Een meting uit een werkboom met
   ongecommitte code is NIET te herhalen, en een register dat daarover zwijgt
   leest als een reproduceerbare meting. De norm telt zulke registers apart
   (`registersUitVuileBoom`) -- en dat werkt alleen als het veld er staat. */
const { stempel } = require('./lib/stempel');

/* DE BOUWER IS EEN PURE FUNCTIE, en dat is geen netheid maar een eis van dit
   huis. Zolang dit bestand zijn werk deed bij het laden, kon test/gelddekking.test.js
   hem alleen LEZEN via het register -- en dan toetst hij de uitkomst van gisteren
   in plaats van de code van vandaag. De mutatiemotor zag dat meteen: hij vond
   geen enkele bruikbare mutatie, want er was geen module die de toets werkelijk
   uitvoert. Een toets die de rekensom niet draait, merkt een fout in die
   rekensom nooit op.

   `bouw` krijgt de drie registers als gewone argumenten. Geen fs, geen paden,
   geen process.exit -- dat staat allemaal onder require.main hieronder. */
function bouw({ kaart, contract, herstelproef, herstelbesluit }) {
  const klachten = [];
  if (!kaart) klachten.push('GELDKAART.json ontbreekt -- draai npm run geldkaart');
  if (!contract) klachten.push('MUTATIECONTRACT.json ontbreekt');
  if (!herstelproef) klachten.push('HERSTELPROEF.json ontbreekt');
  if (!herstelbesluit) klachten.push('HERSTELBESLUIT.json ontbreekt -- zonder verklaringsregister is elk correctiemodel UNKNOWN');

  const geldroutes = (kaart && kaart.as1Kaart && kaart.as1Kaart.geldroutes) || [];

  /* De indexen. Het mutatiecontract sleutelt op "METHODE /api/pad", de
     herstelproef op het kale heen-pad -- twee vormen, en ze worden hier apart
     gehouden in plaats van een van beide te normaliseren. Een sleutel die je
     verbouwt om hem te laten passen, laat je stilletjes de verkeerde rij vinden. */
  const perRoute = new Map();
  for (const r of (contract && contract.rijen) || []) perRoute.set(r.route, r);
  const perHeen = new Map();
  for (const p of (herstelproef && herstelproef.per) || []) perHeen.set(p.heen, p);
  /* De VERKLARING staat los van de METING en wordt er nooit uit afgeleid. Een
     route die hier niet in staat is UNKNOWN -- de eerlijke restklasse, en de
     enige die vanzelf ontstaat. */
  const besloten = (herstelbesluit && herstelbesluit.routes) || {};

  const rijen = [];
  for (const g of geldroutes) {
    const m = perRoute.get(g.methode + ' ' + g.pad) || null;
    const h = perHeen.get(g.pad) || null;
    rijen.push({
      methode: g.methode, pad: g.pad, rol: g.rol, collecties: g.collecties,
      /* `null` betekent hier overal: deze bron zegt niets over deze route. Dat is
         iets anders dan een slechte uitslag, en de tellers hieronder houden die
         twee uit elkaar. */
      semantiek: m ? ((m.semantiek && m.semantiek.klasse) || 'onbekend') : null,
      toegang: m ? ((m.toegang && m.toegang.waargenomen) || 'onbekend') : null,
      stand: m ? m.stand : null,
      idempotentie: g.idempotentie || 'ongemeten',
      terugweg: h ? h.uitslag : 'geen tegenhanger beproefd',
      /* TWEE KOLOMMEN DIE NOOIT SAMENVALLEN. `terugweg` is wat de proef ZAG toen
         zij de tegenhanger uitvoerde; `herstelKlasse` is wat een mens heeft
         VERKLAARD dat het correctiemodel is. De vraag is niet "heeft dit een
         undo?" maar "is er een expliciet en bewezen fout-/correctiemodel?" --
         en die twee kunnen elkaar tegenspreken. */
      herstelKlasse: (besloten[g.pad] && besloten[g.pad].klasse) || 'UNKNOWN',
      herstelGrond: (besloten[g.pad] && besloten[g.pad].grond) || null
    });
  }

  const tel = (veld) => {
    const uit = {};
    for (const r of rijen) { const k = String(r[veld]); uit[k] = (uit[k] || 0) + 1; }
    return uit;
  };

  /* DE RATELTANDEN. Vier getallen die alleen omlaag mogen, elk met zijn eigen
     noemer ernaast in `gemeten`. De eerste is de scherpste en hoort nul te zijn:
     een route die geld beweegt en die een onbekende mag aanroepen. */
  /* TEGENSPRAAK TUSSEN METING EN VERKLARING. Beide zijn geldig op zichzelf; dat
     ze botsen is de bevinding. `FINAL` naast een gemeten `exact` zegt dat de
     route WEL terug te draaien is terwijl een mens hem definitief noemde --
     precies het soort stilte waar een correctiemodel op stukloopt. En
     `NOT_APPLICABLE` op een route die paySaldi of bankSaldi raakt, is de
     makkelijkste verkeerde indeling van allemaal. */
  const KERNBAKKEN = ['paySaldi', 'payBoekingen', 'bankSaldi', 'bankBoekingen'];
  const tegenspraken = [];
  for (const r of rijen) {
    if (r.herstelKlasse === 'FINAL' && (r.terugweg === 'exact' || r.terugweg === 'compensatie'))
      tegenspraken.push({ pad: r.pad, wat: 'verklaard FINAL, maar de proef herstelde hem (' + r.terugweg + ')' });
    if (r.herstelKlasse === 'NOT_APPLICABLE' && r.collecties.some(c => KERNBAKKEN.includes(c)))
      tegenspraken.push({ pad: r.pad, wat: 'verklaard NOT_APPLICABLE, maar raakt een kernbak (' +
        r.collecties.filter(c => KERNBAKKEN.includes(c)).join(', ') + ')' });
  }

  const ratel = {
    geldRoutesPubliek: rijen.filter(r => r.toegang === 'PUBLIC').length,
    geldRoutesZonderSemantiek: rijen.filter(r => r.semantiek === 'onbekend' || r.semantiek === null).length,
    geldRoutesZonderIdemBewijs: rijen.filter(r => r.idempotentie !== 'beschermd').length,
    geldRoutesZonderTerugweg: rijen.filter(r => r.terugweg !== 'exact' && r.terugweg !== 'compensatie').length,
    /* Niet "zonder terugweg" maar "zonder VERKLAARD correctiemodel". Een route
       mag FINAL zijn; wat niet mag is dat niemand het heeft opgeschreven. */
    geldRoutesHerstelOnbesloten: rijen.filter(r => r.herstelKlasse === 'UNKNOWN').length,
    geldRoutesHerstelTegenspraak: tegenspraken.length
  };

  return {
    soort: 'meting',
    uitleg: 'Economische dekking: wat er van elke waardebewegende ROUTE bewezen is, ' +
      'samengesteld uit GELDKAART.json (welke routes), MUTATIECONTRACT.json (semantiek ' +
      'en toegang), IDEMPROEF.json (idempotentie) en HERSTELPROEF.json (de terugweg).',
    stempel: stempel(),
    grens: 'Er komt met opzet GEEN samengesteld dekkingspercentage. Elke as draagt haar ' +
      'eigen teller en noemer; ze worden nooit gemiddeld. De noemer zelf is een ONDERgrens: ' +
      'hij komt uit de geldkaart, die alleen routes ziet waar de idempotentieproef langskwam. ' +
      'Een as waarvoor geen meting bestaat staat in nietGemeten en telt nergens als nul mee.',
    klachten,
    gemeten: {
      geldroutes: rijen.length,
      inMutatiecontract: rijen.filter(r => r.semantiek !== null).length,
      semantiek: tel('semantiek'), toegang: tel('toegang'),
      idempotentie: tel('idempotentie'), terugweg: tel('terugweg')
    },
    ratel,
    tegenspraken,
    herstelKlassen: (() => { const u = {}; for (const r of rijen) u[r.herstelKlasse] = (u[r.herstelKlasse] || 0) + 1; return u; })(),
    nietGemeten: {
      crashHerstel: 'Wat er gebeurt als het proces sterft tussen de bevestiging van een ' +
        'provider en de grootboekregel, is in dit huis nergens beproefd. Geen meting, dus ' +
        'geen getal -- en nadrukkelijk geen nul.',
      externeSettlement: 'Geen providersleutel staat gezet (server/betaal.js weigert dan ' +
        'fail-closed), dus er is nooit een extern betaalpad uitgevoerd om over te rapporteren.'
    },
    rijen
  };
}

module.exports = { bouw };

if (require.main === module) main();

function main() {
const register = bouw({
  kaart: lees('GELDKAART.json'),
  contract: lees('MUTATIECONTRACT.json'),
  herstelproef: lees('HERSTELPROEF.json'),
  herstelbesluit: lees('HERSTELBESLUIT.json')
});
const { klachten, ratel, rijen } = register;
const N = register.gemeten.geldroutes;

fs.writeFileSync(path.join(WORTEL, 'GELDDEKKING.json'), JSON.stringify(register, null, 2) + '\n');

/* ---------------------------------------------------------------- scherm */
const g = n => String(n).padStart(4);
const staaf = (aantal) => aantal + '/' + N;
console.log('\nRTG ECONOMISCHE DEKKING   ' + String(register.stempel.op).slice(0, 10) + '  ' + register.stempel.commit);
console.log('─'.repeat(68));
if (klachten.length) { for (const k of klachten) console.log('  KLACHT: ' + k); console.log(''); }
console.log('  wegen die waarde bewegen        ' + g(N) + '   (ONDERgrens: uit de geldkaart)');
console.log('  gevonden in het mutatiecontract ' + g(register.gemeten.inMutatiecontract));
console.log('');
const as = (naam, goed, toelichting) => {
  console.log('  ' + naam.padEnd(30) + staaf(goed).padStart(7) + '   ' + toelichting);
};
as('bevoegdheid: niet publiek', N - ratel.geldRoutesPubliek,
  ratel.geldRoutesPubliek ? 'LET OP: ' + ratel.geldRoutesPubliek + ' publiek aanroepbaar' : 'geen enkele route is publiek');
as('semantiek geclassificeerd', N - ratel.geldRoutesZonderSemantiek,
  ratel.geldRoutesZonderSemantiek + ' zonder verklaarde tweede-aanroep');
as('idempotentie bewezen', N - ratel.geldRoutesZonderIdemBewijs,
  ratel.geldRoutesZonderIdemBewijs + ' ongemeten');
as('terugweg beproefd', N - ratel.geldRoutesZonderTerugweg,
  ratel.geldRoutesZonderTerugweg + ' zonder beproefde tegenhanger');
as('correctiemodel verklaard', N - ratel.geldRoutesHerstelOnbesloten,
  ratel.geldRoutesHerstelOnbesloten + ' op UNKNOWN (HERSTELBESLUIT.json)');
console.log('  \x1b[2m    ' + Object.entries(register.herstelKlassen)
  .map(([k, v]) => k + ':' + v).join('  ') + '\x1b[0m');
if (ratel.geldRoutesHerstelTegenspraak) {
  console.log('\n  TEGENSPRAAK tussen meting en verklaring:');
  for (const t of register.tegenspraken) console.log('    ' + t.pad + ' -- ' + t.wat);
}
console.log('  crash-herstel                   ' + 'ONBEKEND'.padStart(7) + '   geen meting in dit huis');
console.log('  externe settlement              ' + 'ONBEKEND'.padStart(7) + '   geen providersleutel gezet');
console.log('');
console.log('  \x1b[2mgeen samengesteld cijfer: 42/42 bevoegd en 3/42 terugweg zijn geen 53%\x1b[0m');
console.log('\ngeschreven: GELDDEKKING.json\n');

/* De meter zakt alleen op de harde as. De andere drie zijn voorraden die via de
   ratel in NORM.json alleen mogen dalen; hier rood worden zou van deze meter een
   sirene maken die binnen twee weken wordt uitgezet. */
if (ratel.geldRoutesPubliek) {
  console.error('ZAKT: ' + ratel.geldRoutesPubliek + ' route(s) bewegen waarde en zijn publiek aanroepbaar.');
  for (const r of rijen.filter(x => x.toegang === 'PUBLIC'))
    console.error('  ' + r.methode + ' ' + r.pad + '  ->  ' + r.collecties.join(', '));
  process.exit(1);
}
if (ratel.geldRoutesHerstelTegenspraak) {
  console.error('ZAKT: ' + ratel.geldRoutesHerstelTegenspraak +
    ' route(s) waar de verklaring en de meting elkaar tegenspreken.');
  process.exit(1);
}
if (klachten.length) { console.error('ZAKT: een bron ontbreekt; de tellers hierboven zijn onvolledig.'); process.exit(1); }
process.exit(0);
}
