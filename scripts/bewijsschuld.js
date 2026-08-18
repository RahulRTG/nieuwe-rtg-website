#!/usr/bin/env node
/* ============================================================================
   DE BEWIJSSCHULD -- WAT ER NOG NIET GEMETEN IS, EN WAAROM NIET.

   WAAROM DIT ER IS. De bewijslaag van dit huis is 36% bewezen. De overige 64%
   is geen homogene berg werk: er zitten posten in die je met een middag meten
   dicht, posten die een NIEUW INSTRUMENT vragen, en posten waar meten domweg de
   verkeerde vraag is. Die drie door elkaar heen als "ongemeten" tellen maakt het
   getal onbruikbaar -- je weet niet of je naar achterstand kijkt of naar een
   grens van de methode.

   Tot nu toe leefde die kennis in committeksten en in NORM.json-notities. Dat is
   geen register: je kunt er niet op ratelen, en niemand ziet het als een post
   stilletjes groeit. Dit bestand geeft de bewijsschuld dezelfde vorm als
   BEREIK.json al had -- een lijst die ALLEEN MAG KRIMPEN, met een toets eronder.

   DE DRIE SOORTEN, en het onderscheid is het hele punt:

     meetwerk      het instrument bestaat en werkt; er is alleen nog niet
                   overal mee gemeten. Dit is echte achterstand.
     instrument    de vraag is goed maar er is niets dat hem beantwoordt. Dit
                   is geen achterstand maar ontbrekend gereedschap, en het
                   sluiten ervan is een project.
     grens         meten is hier de verkeerde vraag. Deze post SLUIT NOOIT, en
                   dat is geen falen -- het is de eerlijke rand van de methode.
                   Wie hem als achterstand telt, jaagt op een getal dat niet
                   bestaat.

   ELKE POST DRAAGT EEN AANTAL, EEN SOORT, EEN REDEN EN WAT HEM ZOU SLUITEN.
   Zonder dat laatste is een schuldpost een klaagzang.

   Draai:  node scripts/bewijsschuld.js
           node scripts/bewijsschuld.js --vastleggen
   ========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');
const { stempel } = require('./lib/stempel');

const WORTEL = path.join(__dirname, '..');
const UITSLAG = path.join(WORTEL, 'BEWIJSSCHULD.json');
const VASTLEGGEN = process.argv.includes('--vastleggen');

const lees = (naam) => { try { return JSON.parse(fs.readFileSync(path.join(WORTEL, naam), 'utf8')); } catch (e) { return null; } };

/* De posten. Elke telling komt UIT EEN REGISTER en staat hier niet als getal:
   een schuldenlijst met overgeschreven cijfers loopt binnen een maand uit de
   pas met wat er werkelijk is (LAT.md regel 4). */
const POSTEN = [
  { id: 'auth-onbeslist', soort: 'instrument',
    wat: 'routes waarvan de poortwacht niet kan zeggen of ze een slot hebben',
    uit: (r) => (r.poortwacht || {}).stil,
    waarom: 'de sonde klopt aan met een LEEG lichaam. Een 400 of 404 betekent dan dat de ' +
      'validatie of een opzoeking eerder aan de beurt was dan de autorisatie, en zegt niets ' +
      'over een slot. Een tweede klop met een onzin-token gaf op alle veertien gemeten routes ' +
      'exact dezelfde status.',
    sluit: 'een sonde die een PLAUSIBEL lichaam stuurt. Die moet tegen een eigen wegwerpserver ' +
      'draaien, want plausibele lichamen naar schrijfroutes sturen kan muteren.' },

  { id: 'capability-in-handler', soort: 'grens',
    wat: 'routes zonder bewakerslaag: de controle zit IN de handler (een capability-token)',
    uit: (r) => reden(r.rolproef, 'geen bewakerslaag'),
    waarom: 'de rolproef kruist ROLLEN. Deze routes kennen geen rol -- ze eisen een token dat ' +
      'je alleen hebt als je het hebt gekregen (de schoolborden van foundation, rtf/social). ' +
      'Rollen kruisen is hier niet moeilijk maar zinloos.',
    sluit: 'niets in deze proef. Een eigen proef op capability-tokens zou de goede vraag ' +
      'stellen; die bestaat niet en is een project, geen achterstand.' },

  { id: 'objectpoort', soort: 'instrument',
    wat: 'routes die eigenaarschap toetsen van een object uit het lichaam',
    uit: (r) => reden(r.rolproef, 'objectpoort'),
    waarom: 'huisAuth en huisPoort doen werkplek.kent(req.body.bedrijf) VOORDAT ze naar de ' +
      'identiteit kijken. Met een leeg of verzonnen bedrijf is 404 het enige antwoord en is ' +
      'de identiteit nooit aan de beurt geweest.',
    sluit: 'een IDOR-proef: twee leden met DEZELFDE rol, en de een probeert het object van de ' +
      'ander. Dat is precies de foutklasse die de rolproef expliciet buiten zijn grens legt.' },

  { id: 'lichaamssleutel', soort: 'grens',
    wat: 'routes waarvan de sleutel een VELD IN HET VERZOEK is, geen token in de kop',
    uit: (r) => reden(r.rolproef, 'lichaamssleutel'),
    waarom: 'gastAuth leest req.body.sleutel, gezinsPoort en rtfPoort lezen code+token uit het ' +
      'lichaam. Een member-, supplier- of officetoken is voor zo n deur niet fout maar ' +
      'IRRELEVANT: hij kijkt er niet naar. Alle drie krijgen dezelfde 401.',
    sluit: 'niets in deze proef; die 401 als bewijs tellen zou dezelfde fout zijn die de ' +
      'AUTH-as al 294 cellen kostte. Een proef op sessiesleutels is een andere vraag.' },

  /* STOND HIER ALS 'grens', EN DAT KLOPT NIET MEER. Zolang de liegpoort alleen
     per toetsbestand kon, viel er over deze routes niets af te leiden en was dat
     de rand van de methode. Sinds scripts/outputproef.js --meet bestaat, is het
     gewoon traag werk: lieg over EEN route, draai de toetsen die hem raken, en
     kijk wie het merkt. Een post die meetbaar is geworden hoort niet als grens
     te blijven staan -- dan verbergt het woord "grens" achterstand. */
  { id: 'output-niet-toerekenbaar', soort: 'meetwerk',
    wat: 'routes waar inhoudgevoelige toetsen op zitten, maar die toetsen raken er meer',
    uit: (r) => (r.output && r.output.gemeten || {}).onbeslist,
    waarom: 'een toets die op de lege inhoud zakt en tien routes raakt, kan op de inhoud van ' +
      'een van die tien zijn gezakt. Aan DEZE route valt dan niets toe te rekenen.',
    sluit: 'node scripts/outputproef.js --meet=<n>. Die liegt over EEN route en draait alleen ' +
      'de toetsen die hem raken; de uitslagen stapelen in OUTPUTPROEF.json. Een paar honderd ' +
      'per ronde, dus dit sluit met werk en niet met een doorbraak.' },

  { id: 'audit-wisselend', soort: 'meetwerk',
    wat: 'routes die soms wel en soms geen spoor nalaten',
    uit: (r) => (r.audit && r.audit.gemeten || {}).wisselend,
    waarom: 'het hangt ergens van af -- geslaagd of geweigerd, welke rol, welke invoer. Dan is ' +
      '"laat een spoor na" geen eigenschap van de route.',
    sluit: 'uitzoeken WAARVAN het afhangt. Per route na te lopen met het journaal erbij; ' +
      'echte achterstand, geen ontbrekend gereedschap.' },

  { id: 'rollback-gezakt', soort: 'meetwerk',
    wat: 'routes die weigeren en toch de toestand veranderen',
    uit: (r) => ((r.staatproef || {}).gemeten || {}).rollbackGezakt,
    waarom: 'de meeste zijn /api/rtfos/* met securityLog en sessions -- vermoedelijk de ' +
      'auth-laag die een geweigerde poging vastlegt, en dus mogelijk ruis in de meting en ' +
      'geen lek. Maar EEN ervan verspringt per ronde van plek, en een bevinding die verhuist ' +
      'is zelf een bevinding over de meting.',
    sluit: 'per route nalopen wat er beweegt en waarom. Dit is de oudste post op deze lijst ' +
      'en de enige die naar een mogelijk defect wijst.' },

  { id: 'proefruis', soort: 'meetwerk',
    wat: 'de vier proeven meten op dezelfde code niet twee keer hetzelfde',
    uit: () => 1,
    waarom: 'twee rondes op dezelfde commit gaven vijf cellen verschil (INPUT vier omlaag, ' +
      'AUTH en ACL twee omhoog). Op 46.035 cellen is dat 0,01%, maar een ratel op een ruisende ' +
      'meter weigert op ruis, en dat leert mensen om met de hand vast te leggen. Zo verslapt ' +
      'een ratel.',
    sluit: 'de ruis meten: tien rondes op dezelfde commit, en per as de spreiding vastleggen. ' +
      'Dan weet de ratel wat een echte verslechtering is en wat niet.' },

  { id: 'wegwerpserver-kopieen', soort: 'meetwerk',
    wat: 'scripts met een eigen kopie van "start een wegwerpserver"',
    uit: () => {
      let n = 0;
      try {
        for (const f of fs.readdirSync(path.join(WORTEL, 'scripts'))) {
          if (!f.endsWith('.js')) continue;
          const t = fs.readFileSync(path.join(WORTEL, 'scripts', f), 'utf8');
          if (/spawn\([^)]*server\.js|'server', 'server\.js'/.test(t) && !t.includes('lib/wegwerpserver')) n++;
        }
      } catch (e) { return null; }
      return n;
    },
    waarom: 'scripts/lib/wegwerpserver.js bestaat sinds de meetronde, maar de bestaande ' +
      'instrumenten zijn er nog niet op omgezet. Verandert er iets aan hoe je hier een server ' +
      'start, dan verandert dat op tien plekken of -- waarschijnlijker -- op een.',
    sluit: 'ze een voor een omzetten. Bewust niet in een keer: deze tien vullen de registers ' +
      'waar dit huis op leunt, en ze tegelijk verbouwen is precies de verandering die je niet ' +
      'in een keer moet doen.' }
];

function reden(register, voorvoegsel) {
  if (!register || !Array.isArray(register.redenenNietBeproefbaar)) return null;
  return register.redenenNietBeproefbaar
    .filter(x => String(x.reden).startsWith(voorvoegsel))
    .reduce((a, x) => a + x.aantal, 0);
}

function meet() {
  const r = {
    poortwacht: lees('POORTWACHT.json'), rolproef: lees('ROLPROEF.json'),
    staatproef: lees('STAATPROEF.json'), output: lees('OUTPUTPROEF.json'),
    audit: lees('AUDITPROEF.json')
  };
  const posten = POSTEN.map(p => {
    let aantal = null;
    try { aantal = p.uit(r); } catch (e) { aantal = null; }
    return { id: p.id, soort: p.soort, wat: p.wat, aantal: (aantal === undefined ? null : aantal),
      waarom: p.waarom, sluit: p.sluit };
  });
  const som = (s) => posten.filter(p => p.soort === s && typeof p.aantal === 'number')
    .reduce((a, p) => a + p.aantal, 0);
  return { stempel: stempel(),
    uitleg: 'Wat er nog niet gemeten is, en waarom niet. MAG ALLEEN KRIMPEN -- zie ' +
      'test/bewijsschuld.test.js. Een post van soort "grens" sluit nooit; die telt niet als ' +
      'achterstand maar als de rand van de methode.',
    telling: { posten: posten.length, meetwerk: som('meetwerk'),
      instrument: som('instrument'), grens: som('grens') },
    posten };
}

module.exports = { meet, POSTEN };

if (require.main !== module) return;

const uit = meet();
if (process.argv.includes('--json')) { console.log(JSON.stringify(uit, null, 1)); process.exitCode = 0; return; }

console.log('\n=== DE BEWIJSSCHULD ===\n');
for (const soort of ['meetwerk', 'instrument', 'grens']) {
  const eigen = uit.posten.filter(p => p.soort === soort);
  if (!eigen.length) continue;
  console.log('  ' + soort.toUpperCase());
  for (const p of eigen) {
    console.log('    ' + String(p.aantal === null ? '?' : p.aantal).padStart(5) + '  ' + p.id.padEnd(26) + p.wat);
  }
  console.log('');
}
console.log('  achterstand (meetwerk + instrument): ' + (uit.telling.meetwerk + uit.telling.instrument));
console.log('  rand van de methode (grens)        : ' + uit.telling.grens + '  -- sluit nooit, en dat is geen falen');

if (VASTLEGGEN) {
  fs.writeFileSync(UITSLAG, JSON.stringify(uit, null, 1) + '\n');
  console.log('\n  vastgelegd in BEWIJSSCHULD.json');
}
console.log('');
process.exitCode = 0;
