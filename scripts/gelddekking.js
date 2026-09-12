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
function bouw({ kaart, contract, herstelproef, herstelbesluit, padproef }) {
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

  /* DE VERTICALE PADPROEVEN ALS VIERDE MEETBRON.

     IDEMPROEF.json meet van BUITEN: geeft een tweede aanroep een ander antwoord.
     Er zijn geldpaden waar dat niets zegt -- een route mag keurig 409 weigeren
     terwijl er onderweg al twee collecties zijn aangeraakt. scripts/factuurproef.js
     meet daar de TOESTAND, en die meting hoort hier mee te tellen.

     WAAROM DIT GEEN VERKLARING MAG WORDEN. Het mutatiecontract zet voor dat pad
     nu `PROTECTED`, maar die stand is een DECLARATIE van een mens. Zou de
     classificatie daarop groen worden, dan is de as te halen door een woord te
     typen. Hij leest daarom de PROEF en niet de stand -- alleen een uitslag die
     een instrument heeft opgeschreven telt als bewijs. */
  const perPadproef = new Map();
  for (const bron of (Array.isArray(padproef) ? padproef : [padproef]).filter(Boolean)) {
    const s3 = (bron.stappen || []).find(x => x.nr === 3);
    if (bron.route && s3) perPadproef.set(bron.route, { stand: s3.stand, instrument: bron.instrument || null });
  }

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
      /* Wat een verticale padproef over de TWEEDE AANROEP van deze route zag.
         `null` betekent: geen proef gedraaid -- nooit "niets gevonden". */
      padproef: (perPadproef.get(g.methode + ' ' + g.pad) || {}).stand || null,
      padproefInstrument: (perPadproef.get(g.methode + ' ' + g.pad) || {}).instrument || null,
      terugweg: h ? h.uitslag : 'geen tegenhanger beproefd',
      /* TWEE KOLOMMEN DIE NOOIT SAMENVALLEN. `terugweg` is wat de proef ZAG toen
         zij de tegenhanger uitvoerde; `herstelKlasse` is wat een mens heeft
         VERKLAARD dat het correctiemodel is. De vraag is niet "heeft dit een
         undo?" maar "is er een expliciet en bewezen fout-/correctiemodel?" --
         en die twee kunnen elkaar tegenspreken. */
      /* `klasse` was de oude veldnaam en `stand` is die van het besluit van
         12 september; allebei lezen, want een register mag niet stil van vorm
         veranderen onder een meter die er maar een kent. */
      herstelKlasse: (besloten[g.methode + ' ' + g.pad] && (besloten[g.methode + ' ' + g.pad].stand || besloten[g.methode + ' ' + g.pad].klasse))
        || (besloten[g.pad] && (besloten[g.pad].stand || besloten[g.pad].klasse)) || 'UNKNOWN',
      herstelGrond: (besloten[g.methode + ' ' + g.pad] && (besloten[g.methode + ' ' + g.pad].reden || besloten[g.methode + ' ' + g.pad].grond))
        || (besloten[g.pad] && (besloten[g.pad].reden || besloten[g.pad].grond)) || null,
      /* EEN VERKLAARDE STAND IS GEEN BEWEZEN TERUGWEG, en dat is de scherpste
         kant van het besluit van 12 september. Zonder dit veld zou een route
         PROVEN worden op de dag dat iemand `COMPENSATABLE` tikt. */
      herstelBewijs: ((besloten[g.methode + ' ' + g.pad] || besloten[g.pad] || {}).bewijs || {}).stand || null
    });
  }

  /* ================= DE VIJFDELING PER AS =================
     Een kale teller ("32/42 bewezen") vertelt niet WAAROM de rest ontbreekt, en
     dat verschil is hier groot: van de tien ongemeten idempotentiepaden is er
     GEEN ENKELE onbewezen omdat hij faalde -- alle tien staan geblokkeerd op een
     ontbrekende testwereld. "10 ontbreken" en "10 geblokkeerd, 0 gefaald" zijn
     twee totaal verschillende verhalen over hetzelfde getal.

     Elke as verklaart daarom hieronder haar eigen standen. En ze verklaart ook
     welke standen zij UBERHAUPT KAN produceren: een as die `FAILED` altijd op
     nul houdt omdat er geen weg is om te falen, meldt een nul die niets betekent
     -- en dat is precies de geruststelling zonder grond die deze hele meter moet
     uitsluiten. `kan` staat daarom in de uitslag naast de telling. */
  function vijfdeling(kan, classificeer) {
    const uit = {};
    for (const stand of kan) uit[stand] = 0;
    for (const r of rijen) {
      const stand = classificeer(r);
      if (!(stand in uit)) throw new Error('as gaf stand "' + stand + '" die niet in `kan` staat');
      uit[stand]++;
    }
    return { kan, telling: uit };
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

  /* DE VIER ASSEN, elk met haar eigen standen en haar eigen precedentie.

     BEVOEGDHEID. Een waargenomen niet-publieke route is BEWEZEN afgeschermd --
     de router zag het. PUBLIC is een echte FAILED en geen ontbrekend bewijs.
     Geen rij in het mutatiecontract is ONBEKEND.

     IDEMPOTENTIE. De METING gaat voor de verklaring: `beschermd` betekent dat de
     proef het zag houden (dezelfde sleutel gaf hetzelfde antwoord, een VERSE
     sleutel iets anders). Pas als er niet gemeten is, telt wat het
     mutatiecontract zegt over WAAROM niet.

     SEMANTIEK. Hier bestaat geen FAILED: een verklaring kan ontbreken of er zijn,
     maar niet "mislukken". Die stand staat dus niet in `kan`.

     CORRECTIEMODEL. Idem -- FINAL en NOT_APPLICABLE zijn geldige uitkomsten en
     geen tekort, en er is niets dat kan falen. */
  const assen = {
    bevoegdheid: vijfdeling(['PROVEN', 'FAILED', 'UNKNOWN'], (r) =>
      r.toegang === null ? 'UNKNOWN' : r.toegang === 'PUBLIC' ? 'FAILED' : 'PROVEN'),
    idempotentie: vijfdeling(['PROVEN', 'FAILED', 'BLOCKED', 'NOT_APPLICABLE', 'UNKNOWN'], (r) => {
      if (r.idempotentie === 'beschermd') return 'PROVEN';
      if (r.idempotentie === 'onbeschermd') return 'FAILED';
      /* De verticale padproef staat NA de idemproef en VOOR elke stand: het is
         een meting en geen verklaring, en ze meet strenger (de toestand van de
         geldcollecties in plaats van het antwoord). Een FAILED van de proef is
         daarom ook echt FAILED -- een strengere meter die iets vindt, wordt niet
         overstemd door een zachtere die niets zag. */
      if (r.padproef === 'PROVEN') return 'PROVEN';
      if (r.padproef === 'FAILED') return 'FAILED';
      if (r.padproef === 'BLOCKED') return 'BLOCKED';
      if (r.stand === 'BLOCKED_BY_TEST_FIXTURE') return 'BLOCKED';
      /* Structureel niet van buiten te beproeven is iets anders dan een
         ontbrekende fixture, maar voor DEZE as komen ze op hetzelfde neer: er
         valt niet te meten, en dat is bekend en verklaard. */
      if (r.stand === 'UNTESTABLE_WITH_JUSTIFIED_REASON') return 'BLOCKED';
      /* EEN BEWUST NIET-IDEMPOTENTE ROUTE IS GEEN OPEN VRAAG. De vraag "is
         herhalen veilig?" is daar beantwoord met "nee, en dat hoort zo" -- een
         teller, een journaalregel, een bericht dat je verstuurt. Dat als UNKNOWN
         tellen zou een beantwoorde vraag als een gat laten lezen, en dan daalt
         het getal alleen nog door routes te herclassificeren. */
      if (r.stand === 'INTENTIONALLY_NON_IDEMPOTENT') return 'NOT_APPLICABLE';
      if (r.stand === 'NOT_APPLICABLE') return 'NOT_APPLICABLE';
      return 'UNKNOWN';
    }),
    semantiek: vijfdeling(['PROVEN', 'UNKNOWN'], (r) =>
      (r.semantiek && r.semantiek !== 'onbekend') ? 'PROVEN' : 'UNKNOWN'),
    terugweg: vijfdeling(['PROVEN', 'BLOCKED', 'UNKNOWN'], (r) =>
      (r.terugweg === 'exact' || r.terugweg === 'compensatie') ? 'PROVEN'
        : r.terugweg === 'wereldOntbreekt' ? 'BLOCKED' : 'UNKNOWN'),
    /* CORRECTIEMODEL. Vier standen, en `BLOCKED` is er sinds het besluit van
       12 september 2026 bij gekomen. De reden staat in HERSTELBESLUIT.json:
       een VERKLAARDE COMPENSATABLE zegt wat de bedoeling is, niet dat die
       bedoeling ergens is uitgevoerd. Zonder dat onderscheid wordt deze as
       groen door te typen -- precies de faalvorm die de idempotentie-as al
       kent (een `stand` in een contract telt daar ook niet als meting).

       FINAL en NOT_APPLICABLE blijven geldige uitkomsten en geen tekort; er
       valt daar niets uit te voeren en dus ook niets te bewijzen. */
    correctiemodel: vijfdeling(['PROVEN', 'BLOCKED', 'NOT_APPLICABLE', 'UNKNOWN'], (r) => {
      if (r.herstelKlasse === 'UNKNOWN') return 'UNKNOWN';
      if (r.herstelKlasse === 'NOT_APPLICABLE') return 'NOT_APPLICABLE';
      if (r.herstelKlasse === 'FINAL') return 'NOT_APPLICABLE';
      if (r.herstelBewijs === 'BLOCKED') return 'BLOCKED';
      if (r.herstelBewijs === 'uitgevoerd' || r.herstelBewijs === 'PROVEN') return 'PROVEN';
      return 'UNKNOWN';
    })
  };

  const ratel = {
    geldRoutesPubliek: rijen.filter(r => r.toegang === 'PUBLIC').length,
    geldRoutesZonderSemantiek: rijen.filter(r => r.semantiek === 'onbekend' || r.semantiek === null).length,
    /* DEZE TAND LEEST DEZELFDE TWEE BRONNEN ALS DE AS, en dat is een correctie.
       Hij telde alleen IDEMPROEF.json, terwijl de as sinds de verticale
       padproeven een tweede meting kent. Daardoor konden een as en zijn ratel
       iets anders zeggen over dezelfde route -- twee plekken die een waarheid
       vasthouden, en de eerste die uit de pas loopt doet dat stil (LAT.md
       regel 4). De ratel gaat er niet door omhoog: hij telt er precies een
       minder, en dat is een gemeten verbetering en geen versoepeling. */
    geldRoutesZonderIdemBewijs: rijen.filter(r => r.idempotentie !== 'beschermd' && r.padproef !== 'PROVEN').length,
    geldRoutesZonderTerugweg: rijen.filter(r => r.terugweg !== 'exact' && r.terugweg !== 'compensatie').length,
    /* HIER STOND EEN TEGENSPRAAKTELLER VOOR IDEMPOTENTIE, EN HIJ WAS FOUT.
       Hij meldde de vijf routes die het mutatiecontract INTENTIONALLY_NON_IDEMPOTENT
       noemt terwijl de proef `beschermd` mat, met de redenering: als een tweede
       aanroep een tweede ding hoort te doen, hoe kan hij dan beschermd zijn?

       Die redenering klopt niet, en CLAUDE.md waarschuwt er bij naam voor:
       "`code-maker` naast een gemeten `beschermd` is GEEN bug, want de proef kent
       `beschermd` pas toe als de VERSE sleutel iets anders gaf." Nagetrokken in
       IDEMBESLUIT.json: /api/pay/kascode en /tikcode zijn `code-maker`,
       /api/bank/rekening/open en /api/wallet/voeg zijn `creatie`.

       De twee uitspraken gaan over verschillende dingen en zijn allebei waar.
       INTENTIONALLY_NON_IDEMPOTENT zegt: een tweede AANROEP hoort een tweede ding
       te doen. `beschermd` zegt: met DEZELFDE SLEUTEL gebeurt dat niet, met een
       verse sleutel wel. Dat is geen botsing maar precies de gewenste stand --
       een inherent niet-idempotente route met een idem-slot ervoor, zodat een
       dubbeltik geen tweede rekening opent.

       Een meter die dit als bevinding meldt, roept wolf op de vijf routes die het
       goed doen. Hij staat hier als commentaar en niet als code, zodat de
       volgende die deze kruistabel ziet niet dezelfde conclusie trekt. */
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
    assen,
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
  herstelbesluit: lees('HERSTELBESLUIT.json'),
  /* Ontbreekt hij, dan is `padproef` overal null en verandert er niets aan de
     uitslag: een ontbrekende meting maakt een as nooit slechter dan hij was. */
  padproef: [lees('FACTUURPROEF.json')].filter(Boolean)
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
/* HET SCHERM TOONT DE VIJFDELING EN NOOIT EEN KALE TELLER. Wie hier weer
   "26/42" van maakt, geeft de lezer een noemer zonder verhaal terug. */
const KLEUR = { PROVEN: '\x1b[32m', FAILED: '\x1b[31m', BLOCKED: '\x1b[33m',
  NOT_APPLICABLE: '\x1b[2m', UNKNOWN: '\x1b[33m' };
for (const [naam, a] of Object.entries(register.assen)) {
  const som = a.kan.map(st => a.telling[st] + ' ' + st).join(', ');
  console.log('  ' + naam.toUpperCase());
  for (const st of a.kan) {
    const n = a.telling[st];
    console.log('    ' + (n ? KLEUR[st] : '\x1b[2m') + st.padEnd(16) +
      String(n).padStart(4) + '\x1b[0m' + (st === 'UNKNOWN' && n ? '   \x1b[2m<- hier zit het werk\x1b[0m' : ''));
  }
  void som;
}
console.log('');
console.log('  crash-herstel                   ' + 'ONBEKEND'.padStart(8) + '   geen meting in dit huis');
console.log('  externe settlement              ' + 'ONBEKEND'.padStart(8) + '   geen providersleutel gezet');
console.log('');
if (ratel.geldRoutesHerstelTegenspraak) {
  console.log('  TEGENSPRAAK correctiemodel:');
  for (const t of register.tegenspraken) console.log('    ' + t.pad + ' -- ' + t.wat);
  console.log('');
}
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
