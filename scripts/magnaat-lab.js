#!/usr/bin/env node
/* HET BALANSLAB: honderden campagnes, en per speelstijl tien meters.

   WAAROM DIT NAAST DE STRATEEG STAAT EN HEM NIET VERVANGT. `magnaat-strateeg.js`
   stelt EEN vraag -- domineert er een stijl -- en beantwoordt hem met winst en
   verlies over een reeks startposities. Dat is de goedkoopste toets die er is en
   hij hoort te blijven. Maar hij heeft twee blinde vlekken, en ze zijn allebei
   duur:

   1. HIJ SPEELDE ALTIJD IN DEZELFDE WERELD. De partij-id voedt de conjunctuur
      (../server/kern/spellen/magnaat/cyclus.js), de krant (nieuws.js), de
      risico's en de onderzoeksuitkomsten. Die id stond vast op 'p'. Alle
      achthonderd campagnes van dat toernooi speelden zich dus af onder EEN
      hoogconjunctuur, EEN reeks gebeurtenissen en EEN reeks branden; de enige
      variatie was waar je begon. Een uitslag als "mobility wint 97%" kan dan
      een eigenschap van de stijl zijn of van dat ene weer, en aan de uitslag
      alleen is niet te zien welke van de twee.

   2. HIJ KEEK ALLEEN NAAR DE EINDSTAND. Twee stijlen die op hetzelfde vermogen
      uitkomen kunnen een totaal verschillende campagne hebben gehad: de een
      klom gestaag, de ander stond in maand twintig onder water en werd door een
      opleving gered. Voor de vraag "is dit leuk om te spelen" is dat verschil
      belangrijker dan de uitslag.

   WAT DIT LAB DOET. Het draait campagnes over drie assen tegelijk -- TAFELGROOTTE
   (twee, vier of zes spelers), WERELD (een andere partij-id, en dus een andere
   conjunctuur en krant) en OPSTELLING (wie waar begint) -- en meet per stijl:

     winrate, rendement, drawdown, insolventiekans, vestigingen, schuldgraad,
     contractafhankelijkheid, concernlast, tijd tot dominantie, counterbaarheid.

   WAT HET NIET IS. Geen bewijs dat het spel goed is; hetzelfde voorbehoud als
   bij de strateeg. Het is een meting van hoe SCHEEF het staat, met genoeg assen
   erbij om te zien of een scheefheid van de stijl komt of van de meetopstelling.
   Dat laatste is precies wat er ontbrak.

   HIJ IS DETERMINISTISCH, net als alles in deze map. Geen `Math.random()`: de
   lijst campagnes wordt opgesomd en niet getrokken, dus twee keer draaien geeft
   twee keer hetzelfde antwoord en een afwijking is een echte afwijking.

   Gebruik: node scripts/magnaat-lab.js [aantal-campagnes] [maanden]  */
'use strict';
const S = require('./magnaat-strateeg');

/* DE STIJLEN DIE MEEDOEN. Bewust de HELE breedte en niet alleen de goede: een
   balansmeting waarin de zwakke stijlen ontbreken meet of de winnaars onderling
   in evenwicht zijn, en dat is een andere vraag. `niets` staat erbij als vloer
   -- zolang die ergens wint, is er geen spel. */
const POOL = ['horeca', 'mobility', 'onderhoud', 'inkoper', 'toelever', 'keten',
  'uitvinder', 'handwerk', 'groei', 'voorzichtig', 'service', 'markt', 'zuinig',
  'verwaarlozen', 'passief', 'niets',
  /* De drie sectoren die de oude cast nooit speelde. Ze staan er sinds de
     sectorproef liet zien dat kantoor de sterkste sector van het spel is en
     nooit door iemand gespeeld werd; zonder deze drie meet de tabel hierboven
     de balans van zijn eigen cast. Zie de uitleg bij PROFIELEN in
     ./magnaat-strateeg.js. */
  'kantoorwijk', 'fabriek', 'uitgaan',
  /* En de twee die loondienst spelen (VERHAAL.md stap 1). Zonder deze twee meet
     het lab die laag helemaal niet -- dezelfde blinde vlek als de drie sectoren
     hierboven, en om dezelfde reden erg. */
  'werknemer', 'werkgever'];
/* De drie tafels. Twee spelers op 144 kavels lopen elkaar nooit tegen het lijf;
   zes willen er samen meer dan er zijn. Dat verschil is zelf een meetas: een
   stijl die alleen aan een lege tafel wint, wint niet. */
const TAFELS = [2, 4, 6];
/* Hoeveel verschillende werelden. Elke wereld is een andere partij-id en dus een
   andere conjunctuurlengte, een andere startfase, een andere krant en andere
   branden. Twaalf is genoeg om te zien of een uitslag over het weer heen staat;
   meer maakt de meting langzamer en niet scherper. */
const WERELDEN = 12;
/* Hoeveel startopstellingen per combinatie. */
const OPSTELLINGEN = 4;
/* De stap waarmee een tafel uit de pool wordt gevuld. Priem ten opzichte van de
   poolgrootte, zodat elke tafel verschillende stijlen krijgt en elke stijl op
   den duur iedereen tegenkomt. */
const STAP = 5;
/* Vanaf welk aandeel van al het vermogen aan tafel iemand DOMINANT heet, en tot
   wanneer hij dat moet volhouden: tot het eind. Wie in maand tien de helft heeft
   en in maand twintig niet meer, was aan het winnen en niet dominant.

   Aan een tafel van TWEE betekent "meer dan de helft" alleen "voor staan", en
   dan meet dit getal niets. Daarom wordt de tijd tot dominantie alleen over de
   tafels van vier en zes gerapporteerd. */
const DOMINANT = 0.5;
const DOM_TAFEL = 4;

/* Hoeveel verschillende campagnes er BESTAAN. Vier assen, en hun product is de
   hele ruimte: daarboven begint de opsomming zichzelf te herhalen.

   Dat is geen theoretische zorg. In de eerste versie van dit bestand liepen de
   assen op zo'n manier door elkaar dat de reeks al na 144 campagnes rondliep:
   een run van driehonderd speelde er honderdvierenveertig, en tweemaal. De
   uitslag was daarmee niet fout maar wel minder gemeten dan hij zei, en dat is
   precies de fout die dit lab bij anderen hoort te vinden. */
const RUIMTE = TAFELS.length * POOL.length * WERELDEN * OPSTELLINGEN;

/* Alle campagnes van dit lab, opgesomd en niet getrokken. Vier geneste assen, en
   de volgorde is zo gekozen dat een KLEINE run al over de belangrijkste twee
   spreidt: eerst rouleert de tafelgrootte, dan wie er aan tafel zit, dan de
   wereld, en als laatste de startopstelling. Een run van achtenveertig heeft
   daarmee elke tafelgrootte tegen elke samenstelling gezien; pas daarna gaat hij
   het weer verzitten. */
function opzet(aantal) {
  const lijst = [];
  for (let i = 0; lijst.length < Math.min(aantal, RUIMTE); i++) {
    const n = TAFELS[i % TAFELS.length];
    const start = Math.floor(i / TAFELS.length) % POOL.length;
    const wereld = 'w' + (Math.floor(i / (TAFELS.length * POOL.length)) % WERELDEN);
    const opstelling = Math.floor(i / (TAFELS.length * POOL.length * WERELDEN)) % OPSTELLINGEN;
    const namen = [];
    for (let j = 0; j < n; j++) namen.push(POOL[(start + j * STAP) % POOL.length]);
    lijst.push({ namen, wereld, opstelling, tafel: n });
  }
  return lijst;
}

/* ================= wat er per campagne uit komt ================= */

/* De diepste val van een vermogen ten opzichte van zijn eigen top. Dit is de
   meter die zegt hoe het VOELDE: twee stijlen kunnen op hetzelfde bedrag
   eindigen terwijl de een gestaag klom en de ander halverwege driekwart kwijt
   was. */
function drawdown(reeks, naam) {
  let top = 0, diepste = 0;
  for (const rij of reeks) {
    const v = rij[naam].vermogen;
    if (v > top) top = v;
    if (top > 0) diepste = Math.max(diepste, (top - v) / top);
  }
  return diepste;
}

/* VANAF WELKE MAAND IEMAND DE TAFEL BEZIT, of null als dat nooit gebeurt. Loopt
   van achteren naar voren: de eerste maand van de ONONDERBROKEN reeks tot het
   eind waarin hij boven de drempel zit. */
function dominantieVanaf(reeks, naam) {
  let vanaf = null;
  for (let i = reeks.length - 1; i >= 0; i--) {
    const totaal = Object.values(reeks[i]).reduce((n, x) => n + Math.max(0, x.vermogen), 0);
    const deel = totaal > 0 ? Math.max(0, reeks[i][naam].vermogen) / totaal : 0;
    if (deel <= DOMINANT) break;
    vanaf = i + 1;
  }
  return vanaf;
}

/* Een campagne uitspelen en er per stijl een rij meters uit halen. Alles wat
   hier wordt uitgerekend komt uit `reeks` en `stand`, en die komen uit de motor
   -- dit bestand rekent geen enkele economische grootheid zelf uit. */
function meetCampagne(c, maanden) {
  const r = S.veld(c.namen, c.opstelling, maanden, c.wereld);
  const volgorde = r.stand.map(x => x.profiel);
  const uit = [];
  for (const naam of c.namen) {
    const e = r.stand.find(x => x.profiel === naam);
    const omzet = r.reeks.reduce((n, rij) => n + rij[naam].omzet, 0);
    const bezit = e.waarde + e.geld;
    uit.push({
      naam, tafel: c.tafel, wereld: c.wereld,
      plaats: volgorde.indexOf(naam),
      won: volgorde[0] === naam,
      vermogen: e.vermogen,
      vestigingen: e.vestigingen,
      drawdown: drawdown(r.reeks, naam),
      /* INSOLVENT, en dat woord is met opzet niet "failliet". Deze economie kent
         geen faillissement: wie onder nul zakt gaat rood staan en betaalt daar
         de hoogste rente over (maand-lasten.js). Wat hier gemeten wordt is dus
         niet dat iemand omvalt maar dat zijn vermogen negatief werd, en dat is
         de eerlijke lezing van de vraag. */
      insolvent: r.reeks.some(rij => rij[naam].vermogen <= 0),
      schuldDeel: bezit > 0 ? e.schuld / bezit : 0,
      contractDeel: omzet > 0
        ? r.reeks.reduce((n, rij) => n + rij[naam].contractOmzet, 0) / omzet : 0,
      concernDeel: omzet > 0
        ? r.reeks.reduce((n, rij) => n + rij[naam].concern, 0) / omzet : 0,
      dominantVanaf: c.tafel >= DOM_TAFEL ? dominantieVanaf(r.reeks, naam) : null,
      /* WIE ER BOVEN HEM EINDIGDEN. Hieruit komt de counterbaarheid: niet
         "verloor hij" maar "van wie". Een stijl die door niemand in het bijzonder
         wordt verslagen is een andere zaak dan een stijl met een vaste beul. */
      boven: volgorde.slice(0, volgorde.indexOf(naam))
    });
  }
  return uit;
}

/* ================= optellen over alle campagnes ================= */

const gem = (rij, f) => (rij.length ? rij.reduce((n, x) => n + f(x), 0) / rij.length : 0);

function tel(rijen, start) {
  const perStijl = {}, perCampagne = {};
  for (const r of rijen) {
    (perStijl[r.naam] = perStijl[r.naam] || []).push(r);
    (perCampagne[r.campagne] = perCampagne[r.campagne] || []).push(r.naam);
  }
  const uit = [];
  for (const [naam, rij] of Object.entries(perStijl)) {
    /* DE COUNTER: de stijl die het vaakst boven hem eindigde, als deel van hun
       ONTMOETINGEN. Twee getallen en niet een: 60% van drie ontmoetingen is
       ruis, 60% van tachtig is een antwoord. Wie er aan tafel zaten komt uit de
       campagne zelf en wordt niet apart meegeschreven, want een tweede
       administratie van hetzelfde loopt uit elkaar. */
    const ontmoet = {}, verloren = {};
    for (const r of rij) {
      for (const ander of r.boven) verloren[ander] = (verloren[ander] || 0) + 1;
      for (const ander of perCampagne[r.campagne])
        if (ander !== naam) ontmoet[ander] = (ontmoet[ander] || 0) + 1;
    }
    const counter = Object.keys(ontmoet)
      .filter(a => ontmoet[a] >= Math.max(3, rij.length / 4))
      .map(a => ({ naam: a, deel: (verloren[a] || 0) / ontmoet[a], n: ontmoet[a] }))
      .sort((x, y) => y.deel - x.deel)[0] || null;
    const dom = rij.filter(r => r.dominantVanaf !== null);
    uit.push({
      naam, n: rij.length,
      winrate: gem(rij, r => (r.won ? 1 : 0)),
      rendement: gem(rij, r => r.vermogen) / start,
      drawdown: gem(rij, r => r.drawdown),
      ergsteDrawdown: rij.reduce((n, r) => Math.max(n, r.drawdown), 0),
      insolvent: gem(rij, r => (r.insolvent ? 1 : 0)),
      vestigingen: gem(rij, r => r.vestigingen),
      schuldDeel: gem(rij, r => r.schuldDeel),
      contractDeel: gem(rij, r => r.contractDeel),
      concernDeel: gem(rij, r => r.concernDeel),
      /* Twee getallen, want een gemiddelde over alleen de geslaagde gevallen
         verzwijgt hoe vaak het niet lukte. */
      domKans: rij.filter(r => r.tafel >= DOM_TAFEL).length
        ? dom.length / rij.filter(r => r.tafel >= DOM_TAFEL).length : 0,
      domMaand: dom.length ? gem(dom, r => r.dominantVanaf) : null,
      counter,
      perTafel: TAFELS.map(t => {
        const deel = rij.filter(r => r.tafel === t);
        return { tafel: t, n: deel.length, winrate: gem(deel, r => (r.won ? 1 : 0)) };
      })
    });
  }
  return uit.sort((a, b) => b.winrate - a.winrate);
}

/* ================= de sectorproef ================= */

/* WAAROM DEZE ERBIJ HOORT. De tabel hierboven meet STIJLEN, en een stijl is een
   sector plus een reeks buurten plus een manier van doen. Als er een uitspringt,
   zegt de meting niet WELK van die drie het deed -- en dat is precies de vraag
   die je daarna wilt beantwoorden. Deze proef haalt de andere twee weg: elke
   sector krijgt dezelfde simpele stijl (bouwen zolang het kan) in zijn EIGEN
   buurten, in zijn eentje aan tafel, een hele campagne lang.

   HIJ MEET IETS ANDERS DAN scripts/magnaat-balans.js, en dat verschil is de
   reden dat hij bestaat. Die meter zet EEN zaak op de beste plek neer en kijkt
   hoe snel hij zichzelf terugverdient; alle zeven sectoren zitten daar netjes op
   twaalf maanden. Deze proef speelt de hele campagne uit, en dan lopen dezelfde
   zeven sectoren tientallen keren uit elkaar. Terugverdientijd op een zaak is
   niet hetzelfde als samengestelde groei over een campagne, en dat verschil was
   nergens te zien. */
function sectorproef(werelden = 8, maanden = 36) {
  const { kaart } = require('../server/kern/spellen/magnaat/kaart');
  const { SECTOREN } = require('../server/kern/spellen/magnaat/sectoren');
  const k = kaart('ijmuiden');
  const zones = [...new Set(k.kavels.map(x => x.zone))];
  const uit = [];
  for (const sector of Object.keys(SECTOREN)) {
    /* IN ZIJN EIGEN BUURTEN, en die komen uit de KAART en niet uit een lijst
       hier: welke sectoren in een zone thuishoren staat op de zone zelf. Een
       tweede lijst zou stil uit de pas gaan lopen met de eerste. */
    const eigen = zones.filter(z => k.zone.get(z).sectoren.includes(sector));
    const naam = 'proef-' + sector;
    const extra = { [naam]: { naam: sector, zones: eigen.length ? eigen : zones, doe(s) { s.open(sector); } } };
    let vermogen = 0, vestigingen = 0;
    for (let w = 0; w < werelden; w++) {
      const r = S.veld([naam], 0, maanden, 'w' + w, extra);
      vermogen += r.stand[0].vermogen;
      vestigingen += r.stand[0].vestigingen;
    }
    uit.push({ sector, zones: eigen, vermogen: vermogen / werelden,
      vestigingen: vestigingen / werelden });
  }
  return uit.sort((a, b) => b.vermogen - a.vermogen);
}

/* ================= de keuring ================= */

/* Wat er MOET gelden, en alleen dingen die uit de meting volgen. Elke bevinding
   hieronder is een zin die je aan een speler zou kunnen uitleggen. */
const GRENS = {
  /* Boven dit deel van de campagnes winnen is dominantie en geen voorsprong.
     Aan een tafel van twee is 50% het midden, aan een tafel van zes 17%; de
     grens wordt daarom PER TAFEL gewogen (zie `keur`). */
  overwicht: 2.2,
  /* Elke stijl die meedoet hoort door IEMAND te verslaan zijn. Een stijl zonder
     counter is geen sterke stijl maar een ontbrekend antwoord. */
  counter: 0.55,
  /* En niets doen hoort nooit te winnen. */
  nietsdoen: 0.02,
  /* Hoeveel de beste sector over een hele campagne op de slechtste voor mag
     lopen. Niet 1: sectoren horen te verschillen, anders is de sectorkeuze
     decoratie. Wel eindig: bij een factor van tientallen is er geen keuze meer
     maar een goed antwoord en zes verkeerde.

     DIT GETAL IS EEN LAT EN GEEN METING. Op het moment dat deze proef er kwam
     stond de werkelijke spreiding op 47x, en die bevinding hoort zichtbaar te
     blijven totdat hij verholpen is -- niet weggeijkt te worden door de lat
     erboven te leggen. */
  sectorspreiding: 6
};

function keur(tabel, sectoren) {
  const klachten = [];
  for (const s of sectoren || []) {
    /* EEN SECTOR DIE NIET TE OPENEN IS, is geen zwakke keuze maar een deur die
       op slot zit. `industrie` was dat: de motor trekt elke zaak op naar
       minstens vier eenheden (../server/kern/spellen/magnaat/acties.js), en vier
       eenheden industrie kosten meer dan het startkapitaal. Wie die sector koos,
       deed zesendertig maanden lang niets. */
    if (s.vestigingen < 1)
      klachten.push('sector ' + s.sector + ' opent geen enkele zaak in een hele campagne');
  }
  if ((sectoren || []).length > 1) {
    /* Beste en slechtste worden HIER gezocht en niet uit de volgorde gelezen.
       `sectorproef` levert ze gesorteerd aan, maar een keuring die op de
       volgorde van zijn invoer vertrouwt, meet iets anders zodra iemand die
       lijst ergens anders vandaan haalt. */
    const op = [...sectoren].sort((a, b) => b.vermogen - a.vermogen);
    const beste = op[0], slechtste = op[op.length - 1];
    const maal = beste.vermogen / Math.max(1, slechtste.vermogen);
    if (maal > GRENS.sectorspreiding)
      klachten.push('de beste sector (' + beste.sector + ') levert ' + maal.toFixed(0)
        + 'x de slechtste (' + slechtste.sector + ') over een campagne');
  }
  for (const s of tabel) {
    /* HET OVERWICHT WORDT PER TAFEL GEMETEN, want een winrate over alle tafels
       heen is niet te lezen: dezelfde 40% is aan een tafel van twee onder het
       midden en aan een tafel van zes een monopolie. */
    for (const t of s.perTafel) {
      if (t.n < 8) continue;
      const eerlijk = 1 / t.tafel;
      if (t.winrate > eerlijk * GRENS.overwicht)
        klachten.push(s.naam + ' wint ' + pct(t.winrate) + ' aan een tafel van '
          + t.tafel + ' (eerlijk is ' + pct(eerlijk) + ')');
    }
    if (s.naam !== 'niets' && s.winrate > 0.05 && (!s.counter || s.counter.deel < GRENS.counter))
      klachten.push(s.naam + ' heeft geen tegenstijl: de beste is '
        + (s.counter ? s.counter.naam + ' met ' + pct(s.counter.deel) : 'geen enkele'));
  }
  const niets = tabel.find(s => s.naam === 'niets');
  if (niets && niets.winrate > GRENS.nietsdoen)
    klachten.push('niets doen wint ' + pct(niets.winrate) + ' van zijn campagnes');
  return klachten;
}

/* ================= draaien en tonen ================= */

const pct = (x) => Math.round(x * 100) + '%';
/* Met een decimaal, en dat is geen opmaak maar een bevinding. De
   contractafhankelijkheid rondde in hele procenten naar NUL af, en dan ziet een
   werkende meter er kapot uit; het echte antwoord is dat er wel getekend wordt
   maar dat het aandeel in de omzet klein is, en dat hoort leesbaar te zijn. */
const fijn = (x) => (x * 100).toFixed(1) + '%';
const bedrag = (x) => (x >= 1e6 ? (x / 1e6).toFixed(2) + 'M' : Math.round(x / 1000) + 'k');

function draai(aantal, maanden) {
  const lijst = opzet(aantal);
  const rijen = [];
  for (let i = 0; i < lijst.length; i++) {
    for (const r of meetCampagne(lijst[i], maanden)) rijen.push(Object.assign({ campagne: i }, r));
    if (process.stdout.isTTY && i % 10 === 0)
      process.stdout.write('\r  ' + (i + 1) + '/' + lijst.length + ' campagnes');
  }
  if (process.stdout.isTTY) process.stdout.write('\r' + ' '.repeat(40) + '\r');
  const START = require('../server/kern/spellen/magnaat/economie')({
    save() {}, crypto: require('crypto'), codenaamVan: (h) => h, nudge() {} }).START_GELD;
  const tabel = tel(rijen, START);
  const sectoren = sectorproef(Math.min(WERELDEN, 8), maanden);
  return { tabel, rijen, sectoren, campagnes: lijst.length, maanden,
    klachten: keur(tabel, sectoren) };
}

function toon(r) {
  console.log('\nBALANSLAB -- ' + r.campagnes + ' campagnes van ' + r.maanden
    + ' maanden, over ' + TAFELS.join('/') + '-tafels en ' + WERELDEN + ' werelden'
    + ' (van ' + RUIMTE + ' mogelijke)\n');
  const kop = ['stijl', 'n', 'win', 'rend', 'dd', 'insolv', 'vest', 'schuld', 'contr', 'concern', 'dom'];
  const breed = [13, 5, 5, 6, 5, 7, 5, 7, 8, 8, 8];
  console.log(kop.map((k, i) => k.padEnd(breed[i])).join(''));
  for (const s of r.tabel) console.log([
    s.naam, String(s.n), pct(s.winrate), s.rendement.toFixed(1) + 'x', pct(s.drawdown),
    pct(s.insolvent), s.vestigingen.toFixed(1), fijn(s.schuldDeel), fijn(s.contractDeel),
    fijn(s.concernDeel), (s.domMaand ? Math.round(s.domMaand) + 'm/' + pct(s.domKans) : '-')
  ].map((x, i) => String(x).padEnd(breed[i])).join(''));

  console.log('\nWINRATE PER TAFELGROOTTE (eerlijk = 50 / 25 / 17%)');
  for (const s of r.tabel.slice(0, 8))
    console.log('  ' + s.naam.padEnd(13) + s.perTafel.map(t => pct(t.winrate).padStart(5)).join(''));

  console.log('\nWIE VERSLAAT WIE (de sterkste tegenstijl per stijl)');
  for (const s of r.tabel.slice(0, 10))
    console.log('  ' + s.naam.padEnd(13) + (s.counter
      ? 'wordt ' + pct(s.counter.deel) + ' verslagen door ' + s.counter.naam
        + ' (' + s.counter.n + ' ontmoetingen)' : 'geen tegenstijl gemeten'));

  console.log('\nDE SECTOR ALLEEN (dezelfde stijl, eigen buurten, hele campagne)');
  for (const s of r.sectoren || [])
    console.log('  ' + s.sector.padEnd(12) + bedrag(s.vermogen).padStart(7)
      + '  ' + s.vestigingen.toFixed(1).padStart(5) + ' zaken   ' + s.zones.join(','));

  console.log('\n' + (r.klachten.length ? 'BEVINDINGEN' : 'GEEN BEVINDINGEN'));
  for (const k of r.klachten) console.log('  - ' + k);
  console.log('');
}

if (require.main === module) {
  /* De standaard is elke tafelgrootte tegen elke samenstelling in elke wereld:
     3 x 16 x 12. De vierde as (de startopstelling) komt er pas bij als je een
     groter aantal meegeeft, want die verandert het minst aan de uitslag. */
  const aantal = Number(process.argv[2]) || TAFELS.length * POOL.length * WERELDEN;
  const maanden = Number(process.argv[3]) || 36;
  toon(draai(aantal, maanden));
}

module.exports = { POOL, TAFELS, WERELDEN, DOMINANT, GRENS, RUIMTE, opzet, drawdown,
  dominantieVanaf, meetCampagne, tel, sectorproef, keur, draai, bedrag };
