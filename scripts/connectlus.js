#!/usr/bin/env node
/* ============================================================================
   DE LUS-METING -- bestaat de Foundation-lus, of verklaren we hem?

   DE VRAAG. Er ligt een ontwerp voor Foundation Connect: een sociaal
   ontdekkingsnetwerk binnen FoundationOS, met als dragende bewering dat
   vrijwel IEDERE functie in dezelfde lus terechtkomt --

     ONTDEK -> BEGRIJP -> DOE -> MAAK -> DEEL -> VERBIND -> HELP -> GROEI

   -- en daarnaast een gedeelde contentsoort ("video, verhaal, fotoreeks,
   podcast, cursus, quiz, challenge, experiment, project, simulatie, discussie,
   live sessie, vraag of interactieve uitleg") waar een universele Rahul-laag
   overheen hangt.

   DAT IS DRIE KEER EERDER GEVRAAGD EN DRIE KEER NEE GEWEEST:

     OBJECTMODEL.json  `Asset` bestaat niet. 71% van de velden hoort bij precies
                       EEN domein.
     COMMERCE.json     `Koopbaar` is geen interface: 0 domeinen voeren alle acht
                       werkwoorden uit, 0 werkwoorden staan in alle domeinen.
     STAGEVORM.json    `Moment` bestaat niet. 89% domeineigen over tien publieke
                       domeinen -- minder verwant dan een willekeurige doorsnede.

   DEVELOPERCLOUD.md par. 2 trok daar de regel uit die dit script gehoorzaamt:
   een universeel model moet worden GEVONDEN in de domeinen, niet eroverheen
   VERKLAARD. De lus is exact even breed als Koopbaar was -- acht werkwoorden
   over tientallen domeinen -- dus wordt hij op dezelfde manier behandeld.

   DE METING IS MET OPZET SCHEEF, EN DE GOEDE KANT OP. Een werkwoord telt mee
   bij de vaagste naamverwantschap: een functie die `zoekLes` heet, telt als
   ONTDEK. Dat maakt de lus RIJKER dan hij is. Komt er dan alsnog uit dat de
   domeinen hem niet delen, dan is dat een sterke uitslag. Andersom zou een
   streng gemeten "nee" niets zeggen.

   ================================ WAT ER GEMETEN WORDT ======================

   A. DE ACHT WERKWOORDEN. Per ontdekkingsdomein: welke van de acht voert het
      vandaag werkelijk uit? Gemeten op de NAMEN van de functies die het domein
      definieert, net als scripts/commerce.js dat deed. De vraag eronder is niet
      "hoeveel werkwoorden heeft domein X" maar: IS ER EEN WERKWOORD DAT ZE
      ALLEMAAL HEBBEN, en is er EEN DOMEIN dat de lus rond maakt?

   B. DE VORM. Delen die domeinen VELDEN, na aftrek van de envelop? Dit is de
      Asset-vraag toegespitst op alles wat ontdekt kan worden, en hij toetst de
      gedeelde contentsoort rechtstreeks.

   C. DE NAMEN. Draagt `ontdekking`, `lus`, `naklank`, `kring`, `horizon` of
      `trede` al een betekenis elders? SEMANTIEK.json meet dat 106 van de 124
      gedeelde namen meer dan een betekenis dragen; een nieuwe laag die zijn
      centrale naam op een bezette zet, is de `VERMOGENS`-botsing opnieuw.

   D. DE HUBS. Een domein met tweeennegentig bestanden haalt alle acht
      werkwoorden door zijn OMVANG en niet door zijn vorm. MACHINEDEKKING.json
      is daar een keer op gezakt (een hub in de kern-tas zette 4162 routes op
      "idempotent"), dus staat de bestandstelling per domein in de uitslag --
      wie A leest zonder D, leest een artefact.

   WAT DIT NIET BEWIJST. Een gedeelde WERKWOORDNAAM is geen gedeeld gedrag:
   `maakLes` en `maakTeam` heten allebei maak en doen niets hetzelfde. Het
   script wijst kandidaten aan; een mens beslist. Daarom is de enige conclusie
   die het script zelf trekt een NEGATIEVE -- dat er niets gedeeld is -- want
   die kant is met een ruime meting wel hard.

   DRAAIEN  node scripts/connectlus.js
            node scripts/connectlus.js --json
            npm run connectlus:vast          (schrijft CONNECTLUS.json)
   ========================================================================== */
'use strict';

const fs = require('fs');
const path = require('path');
const om = require('./objectmodel.js');
const { stempel } = require('./lib/stempel');

const WORTEL = path.join(__dirname, '..');

/* DE ONTDEKKINGSDOMEINEN: waar vandaag iets staat dat iemand kan ontdekken,
   begrijpen, doen, maken of doorgeven. Met opzet RUIM, om dezelfde reden als
   bij stagevorm: een domein dat er ten onrechte bij staat verlaagt hooguit de
   gedeeldheid, terwijl een ontbrekend domein juist een gedeelde vorm verbergt.
   De lijst staat hier en niet in een document, want een lijst in een document
   loopt achter op de code zodra iemand een domein hernoemt. */
const DOMEINEN = /^server\/(kern\/)?(leerstof|beroepenbieb|bijles|boeken|bieb|geloofbieb|boekhoudkennis|spellen|salon|mediaos|clips|knelpunt|rtfos|sociaal|socialegraaf|podium|theater|festival|clubs|sportclub|leren|ervaring|carriereledger|events|magazine)\b/;

/* EEN BESTAND IS GEEN DOMEIN -- dezelfde correctie als in stagevorm.js: zonder
   dit tellen leerstof-gen, leerstof-lijn en leerstof-herhalen als drie domeinen
   en ZAKT de gedeeldheid door een schrijfwijze in plaats van door een bevinding. */
function lusDomein(module) {
  const d = om.domeinVan(module);
  const m = /^kern\/([a-z]+)(?:-|$)/.exec(d);
  return m ? 'kern/' + m[1] : d;
}

/* ---------------------------------------------------------------------------
   A. DE ACHT WERKWOORDEN
   ------------------------------------------------------------------------ */
/* De stammen zijn RUIM en dat is de scheefheid uit de kop. `lijst` telt als
   ontdekken, `nieuw` als maken. Wie ze smaller maakt, meet iets strengers en
   mag de uitslag niet meer naast COMMERCE.json leggen. */
const WERKWOORDEN = {
  ontdek:  ['ontdek', 'verken', 'blader', 'feed', 'tijdlijn', 'aanbevel', 'voorstel', 'suggest', 'browse', 'catalogus', 'zoek', 'vind', 'lijst', 'overzicht'],
  begrijp: ['uitleg', 'leguit', 'verklaar', 'waarom', 'begrijp', 'explain', 'samenvat', 'vertaal', 'duiding', 'toelicht'],
  doe:     ['oefen', 'probeer', 'speel', 'challenge', 'opdracht', 'experiment', 'quiz', 'toets', 'start', 'doe', 'missie', 'taak'],
  maak:    ['maak', 'creeer', 'schrijf', 'upload', 'opnemen', 'bewerk', 'monteer', 'ontwerp', 'bouw', 'nieuw'],
  deel:    ['deel', 'publiceer', 'plaats', 'post', 'verstuur', 'stuur', 'zend', 'uitzend'],
  verbind: ['volg', 'vriend', 'verbind', 'koppel', 'match', 'groep', 'team', 'community', 'nodiguit', 'uitnodig', 'lid'],
  help:    ['help', 'beantwoord', 'vraag', 'ondersteun', 'feedback', 'mentor', 'bijstand', 'vrijwillig', 'antwoord'],
  groei:   ['voortgang', 'groei', 'niveau', 'vaardig', 'bewijs', 'portfolio', 'ledger', 'dossier', 'spoor', 'stand', 'behaald', 'gevorderd', 'resultaat']
};
const ACHT = Object.keys(WERKWOORDEN);

/* De namen die een bestand DEFINIEERT. Drie vormen, want dit huis schrijft ze
   alle drie: `function x`, `const x = (` en `x: function` / `x: (` in een
   teruggegeven object. Een AANROEP telt niet mee -- die zegt dat een ander
   domein het werkwoord uitvoert, niet dit. */
const DEFINITIE = /(?:function\s+([A-Za-z_$][\w$]*)|(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?(?:function|\()|([A-Za-z_$][\w$]*)\s*[:(]\s*(?:async\s*)?(?:function|\())/g;

function werkwoorden(paden) {
  const per = new Map();
  for (const p of paden) {
    const s = om.wring(fs.readFileSync(path.join(WORTEL, p), 'utf8'));
    const d = lusDomein(p);
    if (!per.has(d)) per.set(d, { namen: new Set(), bestanden: 0 });
    per.get(d).bestanden++;
    for (const m of s.matchAll(DEFINITIE)) {
      const naam = m[1] || m[2] || m[3];
      if (naam) per.get(d).namen.add(naam.toLowerCase());
    }
  }
  const rijen = [...per.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([domein, v]) => ({
    domein, bestanden: v.bestanden, symbolen: v.namen.size,
    werkwoorden: ACHT.filter(w => [...v.namen].some(n => WERKWOORDEN[w].some(s => n.includes(s))))
  }));
  const n = rijen.length;
  const perWerkwoord = ACHT.map(w => ({ werkwoord: w, domeinen: rijen.filter(r => r.werkwoorden.includes(w)).length }));
  return {
    domeinen: n,
    rondeLus: rijen.filter(r => r.werkwoorden.length === ACHT.length).map(r => r.domein),
    inAlleDomeinen: ACHT.filter(w => rijen.every(r => r.werkwoorden.includes(w))),
    combinaties: new Set(rijen.map(r => r.werkwoorden.slice().sort().join('+'))).size,
    zeldzaamste: perWerkwoord.slice().sort((a, b) => a.domeinen - b.domeinen)[0],
    perWerkwoord, rijen
  };
}

/* ---------------------------------------------------------------------------
   B. DE VORM -- delen de ontdekkingsdomeinen velden?
   ------------------------------------------------------------------------ */
function vorm() {
  const g = om.lees();
  const envelop = new Set(JSON.parse(fs.readFileSync(path.join(WORTEL, 'OBJECTMODEL.json'), 'utf8')).envelop);
  const perDomein = new Map();
  let vormen = 0;
  for (const v of g.vormen) {
    if (!DOMEINEN.test(v.module)) continue;
    vormen++;
    const d = lusDomein(v.module);
    if (!perDomein.has(d)) perDomein.set(d, new Set());
    for (const f of v.velden) if (!envelop.has(f)) perDomein.get(d).add(f);
  }
  const domeinen = [...perDomein.keys()].sort();
  const veldDom = new Map();
  for (const d of domeinen) for (const f of perDomein.get(d)) {
    if (!veldDom.has(f)) veldDom.set(f, []);
    veldDom.get(f).push(d);
  }
  const n = domeinen.length, helft = Math.ceil(n / 2);
  const lijst = [...veldDom.entries()].map(([veld, waar]) => ({ veld, domeinen: waar.length, waar }))
    .sort((a, b) => b.domeinen - a.domeinen || a.veld.localeCompare(b.veld));
  const eigen = lijst.filter(x => x.domeinen === 1).length;
  return {
    vormen, domeinen: n, velden: lijst.length, helftDrempel: helft,
    inAlleDomeinen: lijst.filter(x => x.domeinen === n).length,
    inMinstensDeHelft: lijst.filter(x => x.domeinen >= helft).length,
    veldenDomeineigen: eigen,
    domeineigenPct: lijst.length ? Math.round((eigen / lijst.length) * 1000) / 10 : 0,
    gedeeld: lijst.filter(x => x.domeinen >= 3).slice(0, 20)
  };
}

/* ---------------------------------------------------------------------------
   C. DE NAMEN -- is het centrale woord al bezet?
   ------------------------------------------------------------------------ */
const KANDIDATEN = ['ontdekking', 'lus', 'naklank', 'weerklank', 'signalen', 'kring', 'spoor',
  'horizon', 'trede', 'treden', 'leerdossier', 'mixer', 'vondst', 'connect'];

function namen(alle) {
  const uit = new Map(KANDIDATEN.map(k => [k, []]));
  for (const p of alle) {
    const s = om.wring(fs.readFileSync(path.join(WORTEL, p), 'utf8'));
    for (const k of KANDIDATEN) {
      /* Een toekenning aan een LITERAAL -- `naam: {`, `naam = [`. Precies genoeg
         om "hier woont een ding met deze naam" te betekenen, en te precies om
         het gewone Nederlandse woord in een zin te vangen. */
      if (new RegExp('\\b' + k + '\\s*[:=]\\s*[\\[{]', 'g').test(s)) uit.get(k).push(p);
    }
  }
  return KANDIDATEN.map(k => ({
    naam: k, plekken: uit.get(k).length,
    /* De domeinen zijn de ONDERGRENS van het aantal betekenissen: twee vormen
       in hetzelfde domein zijn meestal hetzelfde ding, twee in verschillende
       domeinen meestal niet. Meestal, dus een mens kijkt na. */
    domeinen: [...new Set(uit.get(k).map(lusDomein))].sort(),
    waar: uit.get(k).slice(0, 8)
  })).sort((a, b) => b.plekken - a.plekken);
}

function meet() {
  const alle = om.BRONNEN.reduce((a, m) => om.bestanden(m, a), []);
  const paden = alle.filter(p => DOMEINEN.test(p));
  return { stempel: stempel(), werkwoorden: werkwoorden(paden), vorm: vorm(), namen: namen(alle) };
}

module.exports = { meet, werkwoorden, vorm, namen, lusDomein, WERKWOORDEN, ACHT, DOMEINEN };

function toon() {
  const r = meet();
  /* `process.exitCode` EN NIET `process.exit()`. Node schrijft naar een BESTAND
     synchroon en naar een PIPE niet: met exit() vlak achter een grote uitvoer
     verdwijnt de staart, en wat er overblijft is geldige tekst met kapotte JSON
     en exitcode 0. Dat is een keer gebeurd bij de poortwacht (484 KB werd
     146176 bytes) en scripts/meetkeuring.js bewaakt het sindsdien -- die regel
     ving deze ook. */
  if (process.argv.includes('--json')) { console.log(JSON.stringify(r)); process.exitCode = 0; return; }
  if (process.argv.includes('--vastleggen')) {
    fs.writeFileSync(path.join(WORTEL, 'CONNECTLUS.json'), JSON.stringify(Object.assign({
      uitleg: 'Gemeten met scripts/connectlus.js; de vraag en de methode staan in de kop van dat bestand. ' +
        'Een gedeelde WERKWOORDNAAM is geen gedeeld gedrag -- dit wijst kandidaten aan, een mens beslist. ' +
        'Lees A nooit zonder D: een domein met negentig bestanden haalt alle acht werkwoorden door zijn omvang.'
    }, r), null, 2) + '\n');
    console.log('CONNECTLUS.json geschreven.');
  }
  const w = r.werkwoorden;
  console.log('\n  DE LUS VAN FOUNDATION CONNECT\n');
  console.log('  A. DE ACHT WERKWOORDEN over ' + w.domeinen + ' ontdekkingsdomeinen\n');
  for (const rij of w.rijen) {
    console.log('    ' + String(rij.werkwoorden.length).padStart(2) + '/8  ' +
      rij.domein.padEnd(22) + String(rij.bestanden).padStart(3) + ' best.  ' + rij.werkwoorden.join(' '));
  }
  console.log('');
  for (const p of w.perWerkwoord) console.log('    ' + p.werkwoord.padEnd(10) + String(p.domeinen).padStart(3) + '/' + w.domeinen);
  console.log('');
  console.log('    Werkwoorden in ALLE domeinen: ' + (w.inAlleDomeinen.length ? w.inAlleDomeinen.join(' ') : 'GEEN'));
  console.log('    Domeinen met de lus ROND:     ' + (w.rondeLus.length ? w.rondeLus.join(' ') : 'GEEN'));
  console.log('    Verschillende combinaties:    ' + w.combinaties + ' over ' + w.domeinen + ' domeinen');
  console.log('    Zeldzaamste werkwoord:        ' + w.zeldzaamste.werkwoord + ' (' + w.zeldzaamste.domeinen + '/' + w.domeinen + ')');
  const v = r.vorm;
  console.log('\n  B. DE VORM -- ' + v.vormen + ' bewaarde vormen in ' + v.domeinen + ' domeinen, ' + v.velden + ' velden na de envelop\n');
  console.log('    in ALLE domeinen:        ' + v.inAlleDomeinen);
  console.log('    in minstens de helft:    ' + v.inMinstensDeHelft + ' (drempel ' + v.helftDrempel + ')');
  console.log('    in PRECIES EEN domein:   ' + v.veldenDomeineigen + '  (' + v.domeineigenPct + '%)');
  console.log('\n  C. DE NAMEN -- staat het woord al ergens als datavorm?\n');
  for (const n of r.namen) {
    console.log('    ' + n.naam.padEnd(12) + String(n.plekken).padStart(3) + '  ' + (n.domeinen.slice(0, 6).join(' ') || 'VRIJ'));
  }
  console.log('');
}

if (require.main === module) toon();
