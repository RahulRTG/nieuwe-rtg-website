#!/usr/bin/env node
'use strict';
/* ============================================================================
   DE AANVOERVORM -- heeft een "manier" EEN vorm, of vijf?

   DE VRAAG DIE HIJ BEANTWOORDT. kern/knelpunt/openingen-kaart.js wijst per
   terrein EEN ingang aan ("hier kunt u kijken"). De stap erna is aanvoer: niet
   de deur maar wat erachter staat -- de vacatures zelf, de leerpaden zelf, de
   vrije opvangplekken zelf. Daarvoor is een contract nodig, en de verleiding is
   dat contract te VERKLAREN: een `Manier` met een vaste set velden waar elk
   brondomein zich naar voegt.

   DAT IS EXACT DE FOUT DIE `Asset` AL EEN KEER HEEFT GEMAAKT. DEVELOPERCLOUD.md
   par. 2: *een universeel objectmodel moet worden GEVONDEN in de domeinen, niet
   eroverheen verklaard.* OBJECTMODEL.json mat dat tafel, kamer, podium en
   leaseauto niets delen buiten hun verpakking; COMMERCE.json mat dat er 0
   domeinen alle acht koopwerkwoorden uitvoeren, waarna `Koopbaar` een
   VERKLARING VAN WERKWOORDEN werd in plaats van een interface. Dus wordt het
   hier eerst gemeten.

   DEZELFDE LEZER, EN DAT IS GEEN GEMAK MAAR EEN EIS. Hij leent
   ./objectmodel.js, precies zoals scripts/carrierevorm.js dat doet en om
   dezelfde reden die daar staat: een tweede parser zou de vergelijking met de
   Asset-meting waardeloos maken. Een getal dat je niet naast het vorige kunt
   leggen, stuurt niets.

   DE AS IS HET TERREIN EN NIET DE MODULE. De vraag is niet of twee bestanden op
   elkaar lijken maar of WERK, OPLEIDING, OPVANG, VERVOER en WONEN een vorm
   delen -- dat zijn de vijf terreinen van openingen-kaart.js, en dus de vijf
   die een aanvoercontract zou moeten dragen. Een terrein dat uit drie modules
   bestaat, telt als EEN terrein; anders bepaalt het aantal bestanden de
   uitslag.

   WAT HIJ MET OPZET NIET MEET: of aanvoer als PROCES bestaat. Dat is de vraag
   van een ketenproef (scripts/adamproef.js) en niet van een vormmeter. Wie een
   lage uitslag hier leest als "er is geen aanvoer", leest hem verkeerd: hij
   zegt dat de aanvoer geen OBJECT is.

   Draaien: npm run aanvoervorm  (vastleggen: npm run aanvoervorm:vast)
   ========================================================================== */

const fs = require('fs');
const path = require('path');
const om = require('./objectmodel.js');
const { stempel } = require('./lib/stempel');

const WORTEL = path.join(__dirname, '..');
const DOEL = path.join(WORTEL, 'AANVOERVORM.json');

/* De vijf terreinen met de modules die hun aanbod dragen. De lijst staat HIER
   en niet in een document, want een lijst in een document loopt achter op de
   code zodra iemand een module hernoemt.

   TWEE LIJSTEN EN NIET EEN, en dat is de les van scripts/carrierevorm.js: die
   meter is een mutatie aangedaan (tot atelier+studio versmald) en sloeg om van
   0 naar 8 van de 10 velden gedeeld. Een uitslag die op de domeinlijst drijft,
   is geen uitslag. Dus wordt hier BEIDE kanten gemeten:

     RUIM    alles wat naar het terrein ruikt. Een module die er ten onrechte
             bij staat verlaagt hooguit de gedeeldheid; een module die ontbreekt
             VERBERGT juist een gedeelde vorm. Dit is de veilige kant voor de
             uitspraak "ze delen niets".
     SMAL    precies de bron die openingen-kaart.js per terrein NOEMT. Dit is de
             aanvoer zoals het huis hem vandaag aanbiedt, en dus de lijst waar
             een contract werkelijk over zou gaan.

   Zeggen ze allebei hetzelfde, dan drijft de uitslag niet op de lijst.

   EEN VERSCHIL DAT ER AL IN ZIT: `server/school` valt in de RUIME lijst onder
   `opleiding`, terwijl openingen-kaart.js met zoveel woorden zegt dat de
   opleidingenlijst daar *"van de schooladministratie is en niet van u"*. De
   ruime meting maakt van `opleiding` dus vooral het schooldomein. Dat is precies
   waarom de smalle ernaast staat. */
const RUIM = {
  werk: /^server\/(kern\/(werk|werkplek|werkplaats|vacature)|routes\/member\/werk)/,
  opleiding: /^server\/(kern\/(beroepenbieb|leerstof|onderwijs)|school)/,
  opvang: /^server\/kern\/verzorging\/opvang/,
  vervoer: /^server\/kern\/(vervoer|mobiliteit)/,
  wonen: /^server\/(kern\/(vastgoed|makelaar|wonen|woning)|routes\/member\/handel\/vastgoed)/
};

/* SMAL: de module die openingen-kaart.js per terrein als `bron` noemt, en verder
   niets. Het veld `wonen` staat er met opzet in terwijl het niets oplevert --
   zie `terreinenLeeg` in de uitslag. */
const SMAL = {
  werk: /^server\/kern\/werk\.js$/,
  opleiding: /^server\/kern\/beroepenbieb\//,
  opvang: /^server\/kern\/verzorging\/opvang/,
  vervoer: /^server\/kern\/vervoer\.js$/,
  wonen: /^server\/routes\/member\/handel\/vastgoed\.js$/
};

function terreinVan(lijst, module) {
  for (const t of Object.keys(lijst)) if (lijst[t].test(module)) return t;
  return null;
}

/* Een ronde over EEN domeinlijst. `meet()` draait hem twee keer. */
function ronde(g, envelop, lijst) {
  const NAMEN = Object.keys(lijst);
  const perTerrein = new Map(NAMEN.map((t) => [t, new Set()]));
  const modulesPer = new Map(NAMEN.map((t) => [t, new Set()]));
  let vormen = 0;
  for (const v of g.vormen) {
    const t = terreinVan(lijst, v.module);
    if (!t) continue;
    vormen++;
    modulesPer.get(t).add(v.module);
    for (const f of v.velden) if (!envelop.has(f)) perTerrein.get(t).add(f);
  }

  /* Een terrein zonder enkele vorm doet NIET mee aan de noemer, en dat staat
     erbij. Een leeg terrein meetellen zou "0 velden in alle vijf" garanderen --
     een uitslag die de meter zelf veroorzaakt, en dat is geen meting. */
  const gevuld = NAMEN.filter((t) => perTerrein.get(t).size > 0);
  const leeg = NAMEN.filter((t) => perTerrein.get(t).size === 0)
    .map((t) => ({ terrein: t, reden: 'geen enkele objectvorm gevonden onder ' + String(lijst[t]) }));

  const veldTerrein = new Map();
  for (const t of gevuld) for (const f of perTerrein.get(t)) {
    if (!veldTerrein.has(f)) veldTerrein.set(f, []);
    veldTerrein.get(f).push(t);
  }

  const n = gevuld.length;
  const inAlle = [...veldTerrein].filter(([, ts]) => ts.length === n).map(([f]) => f).sort();
  const inHelft = [...veldTerrein].filter(([, ts]) => ts.length * 2 >= n).map(([f]) => f).sort();
  const inEen = [...veldTerrein].filter(([, ts]) => ts.length === 1).map(([f]) => f);
  const velden = veldTerrein.size;

  /* De gedeelde PAREN: welke twee terreinen lijken het meest op elkaar. Bij
     COMMERCE.json was dat de enige echte vondst (mall <-> retail), dus die as
     hoort erin -- "niets gedeeld over vijf" en "twee delen iets" zijn twee
     verschillende uitslagen. */
  const paren = [];
  for (let i = 0; i < gevuld.length; i++) for (let j = i + 1; j < gevuld.length; j++) {
    const a = perTerrein.get(gevuld[i]), b = perTerrein.get(gevuld[j]);
    const samen = [...a].filter((f) => b.has(f));
    const unie = new Set([...a, ...b]).size;
    paren.push({ paar: [gevuld[i], gevuld[j]], gedeeld: samen.length,
      overlap: unie ? Number((samen.length / unie).toFixed(3)) : 0, velden: samen.sort().slice(0, 12) });
  }
  paren.sort((x, y) => y.overlap - x.overlap);

  return {
    uitleg: 'Delen de vijf terreinen van kern/knelpunt/openingen-kaart.js een VORM? Gemeten met de ' +
      'lezer van scripts/objectmodel.js -- dezelfde als bij de Asset- en Koopbaar-metingen, want een ' +
      'tweede parser maakt de vergelijking waardeloos. De as is het TERREIN en niet de module.',
    grens: 'Dit meet de vorm van de DATA en niet of aanvoer als proces bestaat -- dat is de vraag van ' +
      'een ketenproef. Een lage uitslag zegt dat aanvoer geen OBJECT is, niet dat er geen aanvoer is. ' +
      'De modulelijst per terrein is met opzet ruim: een module die er ten onrechte bij staat verlaagt ' +
      'hooguit de gedeeldheid, een module die ontbreekt VERBERGT juist een gedeelde vorm. De uitslag is ' +
      'dus een ONDERgrens voor "ze delen niets". Envelopvelden (id, naam, status, at, ...) vallen eruit: ' +
      'die staan overal en meten de verpakking.',
    terreinen: gevuld, terreinenLeeg: leeg,
    vormen, velden,
    perTerrein: Object.fromEntries(gevuld.map((t) => [t,
      { velden: perTerrein.get(t).size, modules: [...modulesPer.get(t)].sort() }])),
    inAlleTerreinen: inAlle,
    inMinstensHelft: inHelft,
    inEenTerreinPct: velden ? Number(((inEen.length / velden) * 100).toFixed(1)) : 0,
    paren
  };
}

function meet() {
  const g = om.lees();
  /* De envelopvelden vallen eruit. `id`, `naam`, `status` en `at` staan overal
     en zeggen dus niets over verwantschap -- ze meten de VERPAKKING. Dezelfde
     uitsluiting als in objectmodel.js zelf en in carrierevorm.js; hij wordt uit
     OBJECTMODEL.json gelezen en niet overgetypt. */
  const envelop = new Set(JSON.parse(fs.readFileSync(path.join(WORTEL, 'OBJECTMODEL.json'), 'utf8')).envelop);
  const ruim = ronde(g, envelop, RUIM);
  const smal = ronde(g, envelop, SMAL);

  /* DE CONCLUSIE WORDT AFGELEID EN NIET OPGESCHREVEN. Zij houdt alleen stand
     als BEIDE lijsten hem dragen: dat is de hele reden dat er twee zijn. Waar
     ze uiteenlopen, is de uitslag `verdeeld` -- en dan is er geen antwoord maar
     een vraag naar de domeinlijst. */
  const geenGedeeldeVorm = ruim.inAlleTerreinen.length === 0 && smal.inAlleTerreinen.length === 0;
  const conclusie = geenGedeeldeVorm
    ? 'GEEN GEDEELDE VORM: geen enkel veld staat in alle gemeten terreinen, onder geen van beide ' +
      'domeinlijsten. Een `Manier` als objecttype met verplichte velden is daarmee niet gerechtvaardigd; ' +
      'de vorm die overleeft is een PROJECTIE met een klein aantal etiketten, per aanroep samengesteld ' +
      'door het brondomein zelf -- de vorm van kern/levensgraaf/graaf.js, en de uitweg die COMMERCE.md ' +
      'voor `Koopbaar` al koos.'
    : 'VERDEELD: de twee domeinlijsten geven een ander antwoord, dus de uitslag drijft op de lijst en ' +
      'niet op de code. Er is hier geen conclusie te trekken zonder eerst de lijst te verantwoorden.';

  return {
    stempel: stempel(),
    uitleg: 'Delen de vijf terreinen van kern/knelpunt/openingen-kaart.js een VORM? Gemeten met de ' +
      'lezer van scripts/objectmodel.js -- dezelfde als bij de Asset- en Koopbaar-metingen, want een ' +
      'tweede parser maakt de vergelijking waardeloos. De as is het TERREIN en niet de module, en er ' +
      'wordt over TWEE domeinlijsten gemeten (ruim en smal) zodat de uitslag niet op de lijst drijft.',
    grens: 'Dit meet de vorm van de DATA en niet of aanvoer als PROCES bestaat -- dat is de vraag van ' +
      'een ketenproef (scripts/adamproef.js). Een lage uitslag zegt dat aanvoer geen OBJECT is, niet ' +
      'dat er geen aanvoer is. Envelopvelden (id, naam, status, at, ...) vallen eruit: die staan overal ' +
      'en meten de verpakking. En de lezer van objectmodel.js kijkt alleen in server/kern, server/bedrijf, ' +
      'server/school en server/papieren -- een bron die in een ROUTE woont is voor deze meter onzichtbaar, ' +
      'en dat is geen nul maar een blinde vlek. Zie `terreinenLeeg`.',
    conclusie, geenGedeeldeVorm,
    ruim, smal
  };
}

function drukRonde(naam, u) {
  console.log('\n  ' + naam + ' -- ' + u.vormen + ' objectvormen over ' + u.terreinen.length + ' terrein(en)');
  for (const t of u.terreinen)
    console.log('    ' + t.padEnd(11) + String(u.perTerrein[t].velden).padStart(4) + ' velden  (' +
      u.perTerrein[t].modules.length + ' module(s))');
  for (const l of u.terreinenLeeg) console.log('    \x1b[33m' + l.terrein.padEnd(11) + '   -- niets gevonden\x1b[0m');
  console.log('    ' + 'velden totaal'.padEnd(24) + String(u.velden).padStart(5));
  console.log('    ' + 'in ALLE terreinen'.padEnd(24) + String(u.inAlleTerreinen.length).padStart(5) +
    (u.inAlleTerreinen.length ? '  (' + u.inAlleTerreinen.join(', ') + ')' : ''));
  console.log('    ' + 'in minstens de helft'.padEnd(24) + String(u.inMinstensHelft.length).padStart(5));
  console.log('    ' + 'in precies EEN terrein'.padEnd(24) + String(u.inEenTerreinPct).padStart(5) + '%');
  if (u.paren.length) {
    const p = u.paren[0];
    console.log('    meest verwante paar     ' + (p.paar[0] + ' <-> ' + p.paar[1]) + ': ' + p.gedeeld +
      ' gedeeld, overlap ' + p.overlap);
  }
}

function druk(u) {
  console.log('\nDE AANVOERVORM -- heeft een "manier" EEN vorm, of vijf?');
  drukRonde('RUIM (alles wat naar het terrein ruikt)', u.ruim);
  drukRonde('SMAL (de bron die openingen-kaart.js noemt)', u.smal);
  console.log('\n' + (u.geenGedeeldeVorm ? '\x1b[32m' : '\x1b[33m') + u.conclusie + '\x1b[0m');
}

module.exports = { meet, DOEL, RUIM, SMAL };

if (require.main === module) {
  const u = meet();
  if (process.argv.includes('--json')) { console.log(JSON.stringify(u)); process.exit(0); }
  druk(u);
  if (process.argv.includes('--vastleggen')) {
    fs.writeFileSync(DOEL, JSON.stringify(u, null, 2) + '\n');
    console.log('\ngeschreven: AANVOERVORM.json');
  }
}
