#!/usr/bin/env node
'use strict';
/* ============================================================================
   DE GROEPVORM -- hebben de groepsmodellen van dit huis EEN vorm, of achttien?

   DE VRAAG DIE HIJ BEANTWOORDT. GEMEENSCHAP.md par. 1.1 telde achttien
   groepsmodellen: het genootschap, het gezin, de Samen-kamer, de sportclub, de
   RTF-partner, de werkruimte, het reisgezelschap en zo verder. Het voorstel om
   FoundationOS "een gedeelde infrastructuur voor communities" te geven, laat
   zich makkelijk lezen als EEN `communities`-tabel waar die achttien in opgaan.

   DAT IS EXACT DE VORM WAARIN `Asset`, `Koopbaar`, `Career`, `Moment` en
   `Manier` AL SNEUVELDEN. DEVELOPERCLOUD.md par. 2: *een universeel objectmodel
   moet worden GEVONDEN in de domeinen, niet eroverheen verklaard.* De eigenaar
   besliste op 11 oktober 2026 met zoveel woorden dat fase 0 niet vooraf aanneemt
   dat de modellen samengevoegd moeten worden -- en ook niet dat ze apart
   blijven. DE UITSLAG VAN DEZE METER BEPAALT DE ARCHITECTUURKEUZE.

   DEZELFDE LEZER, EN DAT IS GEEN GEMAK MAAR EEN EIS. Hij leent
   ./objectmodel.js (vormenVan, bestanden), precies zoals scripts/aanvoervorm.js
   en scripts/carrierevorm.js: een tweede parser maakt de vergelijking met de
   Asset-meting waardeloos.

   EEN BRON BUITEN HET BEREIK VAN DIE LEZER, EN DAT STAAT ERBIJ. objectmodel.js
   leest server/kern, server/bedrijf, server/school en server/papieren. Het gezin
   woont in server/foundation/ en zou voor die lezer onzichtbaar zijn -- en een
   model dat je niet ziet telt als "deelt niets", wat precies de uitslag is die
   je zou willen bewijzen. Dus leest deze meter server/foundation/gezin*.js met
   DEZELFDE vormenVan() erbij. Geen tweede parser, wel een extra bron; die staat
   in `extraBronnen` in de uitslag.

   DE AS IS HET MODEL EN NIET DE MODULE. Een model dat uit vier bestanden bestaat
   telt als EEN model, anders bepaalt de bestandsindeling de uitslag.

   TWEE LIJSTEN, om de reden die scripts/carrierevorm.js leerde (versmald tot
   atelier+studio sloeg die meter om van 0 naar 8 gedeelde velden):

     RUIM   het hele domein waarin het model woont. Een module die er ten
            onrechte bij staat verlaagt hooguit de gedeeldheid; een module die
            ontbreekt VERBERGT een gedeelde vorm. De veilige kant voor de
            uitspraak "ze delen niets".
     SMAL   alleen de module die de groep ZELF bewaart -- de rij met leden. Dit
            is waar een gedeeld groepstype werkelijk over zou gaan.

   Zeggen ze allebei hetzelfde, dan drijft de uitslag niet op de lijst.

   WAT HIJ MET OPZET NIET MEET. Of een groep als PROCES op een andere lijkt
   (lid worden, uitnodigen, opzeggen): dat is een vraag naar werkwoorden en
   niet naar velden, en de uitweg die COMMERCE.md voor `Koopbaar` koos. En een
   gedeelde NAAM is geen gedeelde BETEKENIS: `leden` in een gezin en `leden` in
   een werkruimte zijn twee rechtsverhoudingen. Deze meter wijst aan; wat ervan
   samen kan, beslist een mens die de modules opent.

   Draaien: npm run groepvorm  (vastleggen: npm run groepvorm:vast)
   ========================================================================== */

const fs = require('fs');
const path = require('path');
const om = require('./objectmodel.js');
const { stempel } = require('./lib/stempel');

const WORTEL = path.join(__dirname, '..');
const DOEL = path.join(WORTEL, 'GROEPVORM.json');

/* Een bron buiten objectmodel.BRONNEN, met de reden. Alleen de gezinsmodules:
   de rest van server/foundation/ gaat over het leven van een kind en niet over
   een groep, en zou de meting vullen met vormen die er niet over gaan. */
const EXTRA = [{ map: 'server/foundation', filter: /^server\/foundation\/gezin[^/]*\.js$/,
  reden: 'het gezin woont buiten het bereik van objectmodel.js; zonder deze bron telt het als "deelt niets"' }];

/* De achttien rijen van GEMEENSCHAP.md par. 1.1, min een. De objectlaag
   (kern/objectlaag/) staat in die tabel maar BEZIT NIETS -- zijn eigen kop zegt
   het -- en een projectie meten als groepsmodel is de verpakking meten. Hij
   staat in BUITEN met de reden en niet stil weggelaten. */
const BUITEN = [{ model: 'objectlaag', reden: 'een projectie die niets bewaart (kern/objectlaag/groep.js); ' +
  'hij leest het genootschap en zou dat dus dubbel tellen' }];

const RUIM = {
  genootschap: /^server\/kern\/genootschap\//,
  gesprekken: /^server\/kern\/comm\//,
  samenkamer: /^server\/kern\/samen(rtf)?(-[a-z]+)?\.js$/,
  rendezvousKring: /^server\/kern\/rendezvous-(circles|kring|samen)\.js$/,
  cercleEntourage: /^server\/kern\/rechterhand\/(cercle|entourage)/,
  sportclub: /^server\/kern\/(sportclub\/|clubs(\.js$|\/))/,
  rtfclubs: /^server\/kern\/rtfclubs\.js$/,
  festivalgroep: /^server\/kern\/festival\/groep/,
  reisgezelschap: /^server\/kern\/reisgezelschap/,
  lerenProjecten: /^server\/kern\/leren\/projecten/,
  gezin: /^server\/foundation\/gezin/,
  rtfosPartners: /^server\/kern\/rtfos\/(partners|steden|netwerk)/,
  werkruimte: /^server\/bedrijf\/(werkruimte|leden|rollen)/,
  school: /^server\/school\/(klas|gezin|organisatie|rollen|ouderportaal)/,
  livinglab: /^server\/kern\/(livinglab\/|stadsraad\.js$)/,
  klankwerkSamen: /^server\/kern\/muziek-samen\.js$/,
  democratie: /^server\/kern\/democratie\//
};

/* SMAL: de module die de groepsrij zelf bouwt. Waar dat niet eenduidig EEN
   bestand is, staat de kleinste set die de leden draagt. */
const SMAL = {
  genootschap: /^server\/kern\/genootschap\/(index|beheer)\.js$/,
  gesprekken: /^server\/kern\/comm\/(gesprek|deelnemer)\.js$/,
  samenkamer: /^server\/kern\/samen(rtf)?(-kamer)?\.js$/,
  rendezvousKring: /^server\/kern\/rendezvous-circles\.js$/,
  cercleEntourage: /^server\/kern\/rechterhand\/(cercle|entourage)\.js$/,
  sportclub: /^server\/kern\/sportclub\/index\.js$/,
  rtfclubs: /^server\/kern\/rtfclubs\.js$/,
  festivalgroep: /^server\/kern\/festival\/groep\.js$/,
  reisgezelschap: /^server\/kern\/reisgezelschap\.js$/,
  lerenProjecten: /^server\/kern\/leren\/projecten\.js$/,
  gezin: /^server\/foundation\/gezin\.js$/,
  rtfosPartners: /^server\/kern\/rtfos\/partners\.js$/,
  werkruimte: /^server\/bedrijf\/werkruimte\.js$/,
  school: /^server\/school\/klas\.js$/,
  livinglab: /^server\/kern\/stadsraad\.js$/,
  klankwerkSamen: /^server\/kern\/muziek-samen\.js$/,
  democratie: /^server\/kern\/democratie\/kwestie\.js$/
};

/* De vormen uit de extra bron, met dezelfde vormenVan() en dezelfde ontdubbeling
   per bestand als objectmodel.lees(). */
function leesExtra() {
  const vormen = [];
  for (const e of EXTRA) {
    if (!fs.existsSync(path.join(WORTEL, e.map))) continue;
    for (const p of om.bestanden(e.map, []).filter((x) => e.filter.test(x))) {
      const gezien = new Set();
      for (const velden of om.vormenVan(fs.readFileSync(path.join(WORTEL, p), 'utf8'))) {
        const sleutel = velden.slice().sort().join(',');
        if (gezien.has(sleutel)) continue;
        gezien.add(sleutel);
        vormen.push({ module: p, velden });
      }
    }
  }
  return vormen;
}

function modelVan(lijst, module) {
  for (const t of Object.keys(lijst)) if (lijst[t].test(module)) return t;
  return null;
}

/* Een ronde over EEN modellenlijst. Rekent alleen; kent geen bestanden, zodat
   hij met verzonnen vormen te voeren is (test/groepvorm.test.js). */
function ronde(vormen, envelop, lijst) {
  const NAMEN = Object.keys(lijst);
  const perModel = new Map(NAMEN.map((t) => [t, new Set()]));
  const modulesPer = new Map(NAMEN.map((t) => [t, new Set()]));
  let geteld = 0;
  for (const v of vormen) {
    const t = modelVan(lijst, v.module);
    if (!t) continue;
    geteld++;
    modulesPer.get(t).add(v.module);
    for (const f of v.velden) if (!envelop.has(f)) perModel.get(t).add(f);
  }

  /* Een model zonder enkele vorm doet NIET mee aan de noemer, en staat erbij.
     Meetellen zou "0 velden in alle" garanderen -- een uitslag die de meter zelf
     veroorzaakt. */
  const gevuld = NAMEN.filter((t) => perModel.get(t).size > 0);
  const leeg = NAMEN.filter((t) => perModel.get(t).size === 0)
    .map((t) => ({ model: t, reden: 'geen enkele objectvorm gevonden onder ' + String(lijst[t]) }));

  const veldModellen = new Map();
  for (const t of gevuld) for (const f of perModel.get(t)) {
    if (!veldModellen.has(f)) veldModellen.set(f, []);
    veldModellen.get(f).push(t);
  }
  const n = gevuld.length;
  const inAlle = [...veldModellen].filter(([, ts]) => ts.length === n).map(([f]) => f).sort();
  const inHelft = [...veldModellen].filter(([, ts]) => ts.length * 2 >= n).map(([f]) => f).sort();
  const inEen = [...veldModellen].filter(([, ts]) => ts.length === 1).length;
  const velden = veldModellen.size;

  /* De velden die in minstens drie modellen staan, met WELKE. Dat is de lijst
     die een mens moet openen: een gedeeld type, als het er is, zit hierin. */
  const breedGedeeld = [...veldModellen].filter(([, ts]) => ts.length >= 3)
    .map(([f, ts]) => ({ veld: f, modellen: ts.length, waar: ts.slice().sort() }))
    .sort((a, b) => b.modellen - a.modellen || a.veld.localeCompare(b.veld));

  const paren = [];
  for (let i = 0; i < gevuld.length; i++) for (let j = i + 1; j < gevuld.length; j++) {
    const a = perModel.get(gevuld[i]), b = perModel.get(gevuld[j]);
    const samen = [...a].filter((f) => b.has(f));
    const unie = new Set([...a, ...b]).size;
    paren.push({ paar: [gevuld[i], gevuld[j]], gedeeld: samen.length,
      overlap: unie ? Number((samen.length / unie).toFixed(3)) : 0, velden: samen.sort().slice(0, 12) });
  }
  paren.sort((x, y) => y.overlap - x.overlap || y.gedeeld - x.gedeeld);

  return {
    modellen: gevuld, modellenLeeg: leeg,
    vormen: geteld, velden,
    perModel: Object.fromEntries(gevuld.map((t) => [t,
      { velden: perModel.get(t).size, modules: [...modulesPer.get(t)].sort() }])),
    inAlleModellen: inAlle,
    inMinstensHelft: inHelft,
    inEenModelPct: velden ? Number(((inEen / velden) * 100).toFixed(1)) : 0,
    breedGedeeld: breedGedeeld.slice(0, 25),
    paren: paren.slice(0, 15)
  };
}

/* DE CONCLUSIE WORDT AFGELEID EN NIET OPGESCHREVEN. Drie standen, en de derde is
   geen tussenvorm maar een eerlijke uitslag: als de lijsten uiteenlopen, is er
   geen antwoord maar een vraag naar de modellenlijst. */
function conclusieVan(ruim, smal) {
  const geenVorm = ruim.inAlleModellen.length === 0 && smal.inAlleModellen.length === 0 &&
    ruim.inMinstensHelft.length === 0 && smal.inMinstensHelft.length === 0;
  const welVorm = ruim.inMinstensHelft.length > 0 && smal.inMinstensHelft.length > 0;
  if (geenVorm) return { stand: 'geen-gedeelde-vorm', tekst:
    'GEEN GEDEELDE VORM: onder geen van beide lijsten staat een veld in alle groepsmodellen, en ook niet ' +
    'in de helft. Een `communities`-tabel of groepstype waar de modellen in opgaan is daarmee niet ' +
    'gerechtvaardigd. De vorm die overleeft is een PROJECTIE met etiketten (kern/levensgraaf/graaf.js) ' +
    'plus een verklaring van werkwoorden (COMMERCE.md, `Koopbaar`); samenvoegen kan alleen nog tussen ' +
    'een PAAR modellen dat in `paren` aantoonbaar overlapt, en dan per paar beslist.' };
  if (welVorm) return { stand: 'gedeelde-kern', tekst:
    'GEDEELDE KERN: onder beide lijsten staat minstens een veld in de helft van de modellen. Dat is een ' +
    'kandidaat voor een gedeeld type -- maar een gedeelde naam is geen gedeelde betekenis. Open de ' +
    'modules in `breedGedeeld` voordat er iets wordt samengevoegd.' };
  return { stand: 'verdeeld', tekst:
    'VERDEELD: de twee lijsten geven een ander antwoord, dus de uitslag drijft op de modellenlijst en ' +
    'niet op de code. Er is geen conclusie te trekken zonder eerst de lijst te verantwoorden.' };
}

function meet() {
  const g = om.lees();
  const vormen = g.vormen.concat(leesExtra());
  /* De envelop komt uit OBJECTMODEL.json en wordt niet overgetypt -- dezelfde
     uitsluiting als in aanvoervorm.js en carrierevorm.js. */
  const envelop = new Set(JSON.parse(fs.readFileSync(path.join(WORTEL, 'OBJECTMODEL.json'), 'utf8')).envelop);
  const ruim = ronde(vormen, envelop, RUIM);
  const smal = ronde(vormen, envelop, SMAL);
  const c = conclusieVan(ruim, smal);
  return {
    stempel: stempel(),
    uitleg: 'Delen de groepsmodellen van GEMEENSCHAP.md par. 1.1 een VORM? Gemeten met de lezer van ' +
      'scripts/objectmodel.js -- dezelfde als bij Asset, Koopbaar, Career, Moment en Manier -- over TWEE ' +
      'modellenlijsten (ruim en smal). De as is het MODEL en niet de module. De uitslag bepaalt de ' +
      'architectuurkeuze voor FoundationOS (besluit van de eigenaar, 11 oktober 2026).',
    grens: 'Dit meet de vorm van de DATA en niet of groepen als PROCES op elkaar lijken (lid worden, ' +
      'uitnodigen, opzeggen) -- dat is een vraag naar werkwoorden. Een gedeelde naam is geen gedeelde ' +
      'betekenis. Envelopvelden (uit OBJECTMODEL.json) vallen eruit. De lezer ziet alleen object-literalen ' +
      'met een `id` en minstens vier velden zonder geneste accolades: een model dat zijn rij anders opbouwt ' +
      'staat in `modellenLeeg`, en dat is een blinde vlek en geen nul.',
    extraBronnen: EXTRA.map((e) => ({ map: e.map, filter: String(e.filter), reden: e.reden })),
    buitenBeschouwing: BUITEN,
    conclusie: c.tekst, stand: c.stand,
    ruim, smal
  };
}

function drukRonde(naam, u) {
  console.log('\n  ' + naam + ' -- ' + u.vormen + ' objectvormen over ' + u.modellen.length + ' model(len)');
  for (const t of u.modellen)
    console.log('    ' + t.padEnd(17) + String(u.perModel[t].velden).padStart(4) + ' velden  (' +
      u.perModel[t].modules.length + ' module(s))');
  for (const l of u.modellenLeeg) console.log('    \x1b[33m' + l.model.padEnd(17) + '   -- niets gevonden\x1b[0m');
  console.log('    ' + 'velden totaal'.padEnd(26) + String(u.velden).padStart(5));
  console.log('    ' + 'in ALLE modellen'.padEnd(26) + String(u.inAlleModellen.length).padStart(5));
  console.log('    ' + 'in minstens de helft'.padEnd(26) + String(u.inMinstensHelft.length).padStart(5));
  console.log('    ' + 'in precies EEN model'.padEnd(26) + String(u.inEenModelPct).padStart(5) + '%');
  for (const b of u.breedGedeeld.slice(0, 6))
    console.log('    breed gedeeld  ' + b.veld.padEnd(14) + b.modellen + ' modellen (' + b.waar.join(', ') + ')');
  for (const p of u.paren.slice(0, 3))
    console.log('    verwant paar   ' + p.paar.join(' <-> ') + ': ' + p.gedeeld + ' gedeeld, overlap ' + p.overlap);
}

function druk(u) {
  console.log('\nDE GROEPVORM -- hebben de groepsmodellen EEN vorm, of achttien?');
  drukRonde('RUIM (het hele domein van elk model)', u.ruim);
  drukRonde('SMAL (de module die de groep zelf bewaart)', u.smal);
  console.log('\n' + (u.stand === 'verdeeld' ? '\x1b[33m' : '\x1b[32m') + u.conclusie + '\x1b[0m');
}

module.exports = { meet, ronde, conclusieVan, DOEL, RUIM, SMAL, EXTRA, BUITEN };

if (require.main === module) {
  const u = meet();
  /* Geen process.exit() na een grote uitvoer: naar een PIPE schrijft node niet
     synchroon (zie scripts/aanvoervorm.js en scripts/meetkeuring.js). */
  if (process.argv.includes('--json')) { console.log(JSON.stringify(u)); return; }
  druk(u);
  if (process.argv.includes('--vastleggen')) {
    fs.writeFileSync(DOEL, JSON.stringify(u, null, 2) + '\n');
    console.log('\ngeschreven: GROEPVORM.json');
  }
}
