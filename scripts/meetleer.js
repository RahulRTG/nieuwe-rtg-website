#!/usr/bin/env node
/* ============================================================================
   DE MEETLEER -- MAG DE LEZER DIT GELOVEN, EN HOEVEEL?

   scripts/meetkeuring.js vraagt of een INSTRUMENT zich aan zijn regels houdt.
   Dit vraagt iets anders, en het is de vraag die daarna komt: kan iemand die
   alleen het REGISTER heeft, er meer uit concluderen dan erin zit?

   WAAROM DIT BESTAAT. `VERSTRENGELING.json` meldt "0 onverklaarde randen". Dat
   is waar, en het betekent iets veel kleiners dan het klinkt: elke rand DRAAGT
   een reden, niet elke reden is goed -- en de meter ziet de kern-tas helemaal
   niet. Wie dat getal op een bord zet als "architectuur in orde", liegt niet en
   heeft toch ongelijk. Het bronregister hoort die lezing onmogelijk te maken.

   Dat is geen nieuwe gedachte hier. TOETSDUUR.json mocht niet suggereren dat een
   modus op deze machine gemeten was terwijl dat niet zo was. Dit is dezelfde
   regel, een stap verder: een register mag niet liegen over waar zijn bewijs
   vandaan komt, EN het mag de lezer niet meer laten concluderen dan het aantoont.

   DE ZEVEN SLOTS. Niet verzonnen maar gezocht: welke velden dragen vandaag al
   welke betekenis? De uitkomst staat in SLOTS hieronder, met per slot de namen
   die in deze boom werkelijk voorkomen.

   DRIE UITSLAGEN PER SLOT, en het verschil tussen de eerste twee is het hele
   punt van dit instrument:

     veld      machinaal leesbaar. Een dashboard KAN de beperking tonen.
     proza     de betekenis staat er, maar in een vrije zin (meestal `uitleg`).
               Een zorgvuldige lezer wordt niet misleid; een dashboard wel,
               want dat leest geen proza. Dit is GEEN overtreding en telt apart.
     ontbreekt er staat niets.

   WAT DIT INSTRUMENT NIET DOET, en dat is met opzet: het leest niet of een zin
   INHOUDELIJK klopt. `grens: "geen"` haalt hier de toets. Dat een mens de
   grenzen schrijft is de aanname waar deze hele laag op rust; hier wordt alleen
   gemeten of er iets STAAT waar een machine bij kan.

   HET PAAR. `bewijst` zonder `grens` is geen vooruitgang maar een verslechtering:
   een positieve claim zonder de bijbehorende beperking is precies de vorm waarin
   overclaiming ontstaat. Zo'n register wordt hier apart geteld (`losseClaim`) en
   telt NOOIT als gevuld slot.

   HIJ BLOKKEERT NIETS. CONTROLPLANE.md: je kunt niet afdwingen wat nooit in de
   schaduw heeft gelopen. Eerst zichtbaar dalen, dan pas een regel in
   scripts/meetkeuring.js.

   Draai:  node scripts/meetleer.js
           node scripts/meetleer.js --vastleggen
   ========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');
const { stempel } = require('./lib/stempel');

const WORTEL = path.join(__dirname, '..');

/* DE DRIE NAMEN VOOR EEN TIJDSTIP ZIJN EEN BOTSING, GEEN KEUZE. `stempel` (41),
   `gemeten` (42) en `gemetenOp` (6) dragen alle drie "wanneer is dit gemeten".
   Ze staan hier alle drie omdat dit instrument MEET en niet opruimt; een vierde
   naam bijzetten zou de botsing verergeren. SEMANTIEK.json noemt dit patroon
   duur, en dit is er een binnen de meetlaag zelf. */
const SLOTS = [
  { id: 'watMeetIk', velden: ['wat', 'onderwerp', 'meet'],
    zegt: 'waarover dit register gaat' },
  { id: 'hoeGemeten', velden: ['hoe', 'methode', 'instrument'],
    zegt: 'met welk commando het opnieuw te maken is' },
  { id: 'gemetenOp', velden: ['stempel', 'gemeten', 'gemetenOp'],
    zegt: 'wanneer, en tegen welke commit',
    botsing: 'drie namen voor dezelfde waarheid; hier geteld, niet opgelost' },
  { id: 'resultaat', velden: null, zegt: 'de uitslag zelf (een getal of een lijst)' },
  { id: 'watBewijstDit', velden: ['bewijst', 'aantoont'],
    zegt: 'wat je hieruit MAG concluderen', paart: 'watBewijstDitNiet' },
  { id: 'watBewijstDitNiet', velden: ['grens', 'nietBewezen'],
    zegt: 'wat je hieruit NIET mag concluderen' },
  { id: 'blindeVlekken', velden: ['blindeVlekken', 'ongemeten', 'nietGemeten'],
    zegt: 'wat deze meter met opzet of noodgedwongen niet ziet' }
];

/* Proza telt alleen als de zin werkelijk BEPERKT. "meet alles" is geen grens. */
const BEPERKT = /\b(niet|geen|alleen|nooit|behalve|ondergrens|steekproef|bewijst niet)\b/i;

function prozaVan(j) {
  return [j.uitleg, j.let, j.waarom, j.toelichting]
    .filter(v => typeof v === 'string').join(' ');
}

/* Heeft dit register een uitslag? Een register zonder enig getal en zonder enige
   lijst meet niets -- dat is zeldzaam maar het bestaat, en het hoort te blijken. */
function heeftResultaat(j) {
  return Object.entries(j).some(([k, v]) =>
    !SLOTS.some(s => (s.velden || []).includes(k)) &&
    (typeof v === 'number' || Array.isArray(v)));
}

function keurRegister(naam) {
  let j;
  try { j = JSON.parse(fs.readFileSync(path.join(WORTEL, naam), 'utf8')); }
  catch (e) { return null; }
  if (!j || typeof j !== 'object' || Array.isArray(j)) return null;

  const proza = prozaVan(j);
  const slots = {};
  for (const s of SLOTS) {
    if (s.id === 'resultaat') { slots[s.id] = heeftResultaat(j) ? 'veld' : 'ontbreekt'; continue; }
    const veld = s.velden.find(v => j[v] !== undefined && j[v] !== null && j[v] !== '');
    if (veld) { slots[s.id] = 'veld'; continue; }
    /* PROZA TELT MAAR VOOR EEN SLOT, en die grens moest ik in mijn eigen meter
       repareren. Eerst vulde een beperkende zin zowel `watBewijstDitNiet` als
       `blindeVlekken` -- 46 en 59 -- maar dat is EEN zin die als antwoord op
       TWEE vragen wordt geteld. Wat een meting niet aantoont en wat zij niet
       ZIET zijn verschillende dingen, en de tweede staat vrijwel nooit in dat
       soort zinnen. Bij alles behalve `watBewijstDitNiet` zou "staat vast ergens
       in een zin" dus een gok zijn, en een gok die als gevuld telt maakt dit
       instrument waardeloos -- precies de zelfvleierij die het moet vinden. */
    slots[s.id] = s.id === 'watBewijstDitNiet' && BEPERKT.test(proza)
      ? 'proza' : 'ontbreekt';
  }

  /* HET PAAR. Een positieve claim zonder bijbehorende beperking is geen
     vooruitgang; hij wordt hier ongedaan gemaakt en apart geteld. */
  const losseClaim = slots.watBewijstDit === 'veld' && slots.watBewijstDitNiet === 'ontbreekt';
  if (losseClaim) slots.watBewijstDit = 'ontbreekt';

  const tel = (w) => Object.values(slots).filter(v => v === w).length;
  return { register: naam, slots, losseClaim,
    velden: tel('veld'), proza: tel('proza'), ontbreekt: tel('ontbreekt') };
}

function meet() {
  const namen = fs.readdirSync(WORTEL)
    .filter(n => /^[A-Z0-9_]+\.json$/.test(n)).sort();
  const rijen = namen.map(keurRegister).filter(Boolean);

  const perSlot = {};
  for (const s of SLOTS) {
    perSlot[s.id] = { veld: 0, proza: 0, ontbreekt: 0 };
    for (const r of rijen) perSlot[s.id][r.slots[s.id]]++;
  }

  /* DE TWEE GETALLEN DIE ERTOE DOEN, en ze zijn met opzet gescheiden.
     `onleesbaar` telt slots waar een machine niet bij kan (proza + ontbreekt) --
     dat is het getal waar een dashboard op stukloopt, en het daalt ook als een
     zin een veld wordt. `blind` is strenger en kleiner: registers die NERGENS
     zeggen wat ze niet aantonen, veld noch zin. Daar wordt zelfs een mens die
     goed leest niet geremd, en dat is het gevaarlijke geval. De twee worden
     nooit opgeteld: het eerste gaat over leesbaarheid, het tweede over of de
     beperking uberhaupt is opgeschreven. */
  const onleesbaar = rijen.reduce((n, r) => n + r.proza + r.ontbreekt, 0);
  const blind = rijen.filter(r => r.slots.watBewijstDitNiet === 'ontbreekt').length;

  return {
    /* DIT REGISTER VULT ZIJN EIGEN ZEVEN SLOTS, en niet uit netheid: een meetleer
       die 5 van de 7 scoort op zijn eigen schaal, vraagt van anderen wat hij zelf
       niet doet. `bewijst` staat hier bewust klein en naast `grens` -- los is dat
       precies de vorm die dit instrument bij anderen afkeurt. */
    wat: 'of elk register in de wortel de lezer machinaal belet er meer uit te concluderen dan het aantoont',
    stempel: stempel(), hoe: 'npm run meetleer',
    bewijst: 'Dat er per register en per slot IETS staat, en of dat als veld (machinaal leesbaar) of alleen als zin in vrije tekst staat. Meer niet: leesbaarheid, geen juistheid.',
    grens: 'Dit meet of er IETS staat waar een machine bij kan, nooit of het KLOPT: een register met grens: "geen" haalt deze toets. Dat een mens de grenzen eerlijk opschrijft is de aanname waar deze laag op rust en die is hier niet getoetst. Proza wordt alleen herkend bij de twee beperkingsslots; bij de rest zou raden als gevuld tellen en dat maakt de meter waardeloos.',
    blindeVlekken: 'Alleen registers in de wortel met een HOOFDLETTERnaam. Registers elders (server/data, .github) worden niet gezien, en een register dat helemaal niet geschreven wordt al helemaal niet.',
    registers: rijen.length,
    slots: SLOTS.length,
    onleesbaar, blind,
    losseClaims: rijen.filter(r => r.losseClaim).length,
    perSlot,
    rijen: rijen.sort((a, b) => b.ontbreekt - a.ontbreekt)
  };
}

module.exports = { meet, keurRegister, SLOTS, BEPERKT };

if (require.main === module) {
  const uit = meet();
  if (process.argv.includes('--json')) { console.log(JSON.stringify(uit, null, 1)); return; }

  console.log('\n=== DE MEETLEER ===\n');
  console.log('  ' + uit.registers + ' registers x ' + uit.slots + ' slots\n');
  const b = (n) => String(n).padStart(4);
  console.log('  slot                 veld  proza  ontbr');
  for (const s of SLOTS) {
    const p = uit.perSlot[s.id];
    console.log('  ' + s.id.padEnd(20) + b(p.veld) + b(p.proza) + b(p.ontbreekt) +
      (s.botsing ? '   <- ' + s.botsing : ''));
  }
  console.log('\n  ONLEESBAAR VOOR EEN MACHINE: ' + uit.onleesbaar + ' slots.');
  console.log('  Daarvan is het gevaarlijke deel: ' + uit.blind + ' registers zeggen NERGENS');
  console.log('  wat ze niet aantonen -- niet als veld en niet in een zin. Daar wordt de');
  console.log('  lezer nergens geremd, en dat is precies waar een dashboard te ver gaat.');
  if (uit.losseClaims) {
    console.log('\n  LOSSE CLAIMS: ' + uit.losseClaims + '. Een `bewijst` zonder `grens` is geen');
    console.log('  vooruitgang maar de vorm waarin overclaiming ontstaat; hij telt hier niet mee.');
  }
  console.log('\n  De tien met de meeste lege slots:');
  for (const r of uit.rijen.slice(0, 10)) {
    const mist = SLOTS.filter(s => r.slots[s.id] === 'ontbreekt').map(s => s.id);
    console.log('    ' + r.register.padEnd(26) + r.ontbreekt + ' leeg: ' + mist.join(', '));
  }
  console.log('\n  Deze meter BLOKKEERT NIETS. Hij loopt in de schaduw tot het getal is');
  console.log('  gedaald (CONTROLPLANE.md); pas daarna hoort hij als regel in meetkeuring.\n');
  if (process.argv.includes('--vastleggen')) {
    fs.writeFileSync(path.join(WORTEL, 'MEETLEER.json'), JSON.stringify(uit, null, 2) + '\n');
    console.log('  Vastgelegd in MEETLEER.json\n');
  }
}
