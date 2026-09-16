#!/usr/bin/env node
'use strict';
/* ============================================================================
   DE PLANVORM -- is roosteren EEN motor, of zeven?

   DE VRAAG DIE HIJ BEANTWOORDT. Het voorstel op tafel is een universele
   RTG Planning Engine: roosteren is geen personeelsfunctie maar een tijd- en
   capaciteitsmotor, met als basiseenheid niet `medewerker + dienst` maar
   `resource + tijd + plaats + activiteit + capaciteit + regels`. De zeven
   bestaande planners (horeca, beveiliging, festival, taxi, ov, verblijf,
   school) worden dan domeinadapters boven dezelfde grond.

   DAT IS EXACT DE VORM WAARIN `Asset` SNEUVELDE. DEVELOPERCLOUD.md par. 2:
   *een universeel objectmodel moet worden GEVONDEN in de domeinen, niet
   eroverheen verklaard.* OBJECTMODEL.json mat dat tafel, kamer, podium en
   leaseauto niets delen buiten hun verpakking; COMMERCE.json dat 0 van 100
   domeinen alle acht koopwerkwoorden uitvoeren, waarna `Koopbaar` een
   VERKLARING VAN WERKWOORDEN werd in plaats van een interface; CARRIEREVORM,
   STAGEVORM, CONNECTLUS en AANVOERVORM deden hetzelfde voor `Career`,
   `Moment`, `Ontdekking` en `Manier`. Vijf keer dezelfde belofte, vier keer
   dezelfde uitslag. Dus wordt deze eerst gemeten.

   DEZELFDE LEZER, EN DAT IS GEEN GEMAK MAAR EEN EIS. Hij leent
   ./objectmodel.js, precies zoals carrierevorm, stagevorm en aanvoervorm dat
   doen en om dezelfde reden: een getal dat je niet naast het vorige kunt
   leggen, stuurt niets.

   TWEE ASSEN, EN ZE MOGEN NOOIT WORDEN OPGETELD.

     A. DE LUS   voert een domein de negen stations van de voorgestelde keten
                 uit? (vraag -> capaciteit -> resource -> beperking -> plan ->
                 reistijd -> uitvoering -> werkelijkheid -> herplanning)
     B. DE VORM  delen de domeinen VELDEN? Dat is de Asset-vraag.

   Een motor kan de lus rond hebben zonder een gedeelde vorm (dan is hij een
   verklaring van werkwoorden) en andersom (dan is hij een projectie). Een
   samengesteld cijfer over allebei zou verbergen welke van de twee beweegt --
   INT-04, en BEWIJSMACHINE.md over de bewijs-scorecard.

   DE AS IS HET PLANDOMEIN EN NIET DE MODULE. Een domein dat uit acht bestanden
   bestaat telt als EEN domein; anders bepaalt de bestandsindeling de uitslag.
   Dat is dezelfde correctie die objectmodel.js zelf al moest maken.

   TWEE DOMEINLIJSTEN EN NIET EEN. De les van scripts/carrierevorm.js: die is
   een mutatie aangedaan (tot atelier+studio versmald) en sloeg om van 0 naar 8
   van de 10 velden gedeeld. Een uitslag die op de domeinlijst drijft, is geen
   uitslag. Dus:

     RUIM   alles wat in dat domein naar planning ruikt. Een module die er ten
            onrechte bij staat verlaagt hooguit de gedeeldheid; een module die
            ONTBREEKT verbergt juist een gedeelde vorm. Dit is de veilige kant
            voor de uitspraak "ze delen niets".
     SMAL   precies de module die het rooster of de dienst DRAAGT. Dit is waar
            een planningsgrond werkelijk over zou gaan.

   Zeggen ze allebei hetzelfde, dan drijft de uitslag niet op de lijst.

   WAT HIJ MET OPZET NIET MEET. Of planning als PROCES bestaat -- dat is de
   vraag van een ketenproef (scripts/tafelproef.js, ritproef.js) en niet van een
   vormmeter. Wie een lage uitslag leest als "er wordt hier niet gepland", leest
   hem verkeerd: hij zegt dat planning geen OBJECT is.

   EN DE WERKWOORD-AS IS LEXICAAL, DUS EEN ONDERGRENS. Hij leest de namen die
   een bestand DEFINIEERT, niet wat het doet. Graad `vermoed`, dezelfde als de
   `anoniem`-as van scripts/kantoormacht.js -- en om dezelfde reden hangt de
   conclusie hieronder aan de VORM-as (hard) en niet aan de lus-as (zacht).

   Draaien: npm run planvorm   (vastleggen: npm run planvorm:vast)
   ========================================================================== */

const fs = require('fs');
const path = require('path');
const om = require('./objectmodel.js');
const { stempel } = require('./lib/stempel');

const WORTEL = path.join(__dirname, '..');
const DOEL = path.join(WORTEL, 'PLANVORM.json');

/* De zeven plandomeinen. De lijst staat HIER en niet in een document, want een
   lijst in een document loopt achter op de code zodra iemand een module
   hernoemt.

   WAT ER MET OPZET NIET IN STAAT: kern/opvang.js. Dat kent wel `DIENSTEN`, maar
   dat zijn opvangSOORTEN (dagopvang, BSO) en geen ploegen. Een domein meetellen
   dat geen planner is, verlaagt de gedeeldheid zonder iets te bewijzen -- en
   dat is precies het soort meter dat zijn eigen uitslag veroorzaakt. */
const RUIM = {
  horeca:      /^server\/kern\/(personeel|agent)\.js$/,
  beveiliging: /^server\/kern\/beveiliging\//,
  festival:    /^server\/kern\/festival\//,
  taxi:        /^server\/kern\/mobiliteit\//,
  ov:          /^server\/kern\/ov\//,
  verblijf:    /^server\/kern\/verblijf/,
  school:      /^server\/school\//
};

/* SMAL: de module die het rooster of de dienst werkelijk draagt, en verder
   niets. */
const SMAL = {
  horeca:      /^server\/kern\/personeel\.js$/,
  beveiliging: /^server\/kern\/beveiliging\/rooster\//,
  festival:    /^server\/kern\/festival\/dienst\.js$/,
  taxi:        /^server\/kern\/mobiliteit\/cdt/,
  ov:          /^server\/kern\/ov\/dienst\.js$/,
  verblijf:    /^server\/kern\/verblijf\/receptie\.js$/,
  school:      /^server\/school\/klas\.js$/
};

/* ---------------------------------------------------------------------------
   A. DE LUS -- de negen stations van de voorgestelde keten
   ------------------------------------------------------------------------ */
const STATIONS = {
  vraag:      ['vraag', 'behoefte', 'aanvraag', 'reserver', 'boek', 'bestel', 'opdracht', 'verzoek', 'drukte'],
  capaciteit: ['capaciteit', 'bezetting', 'benodigd', 'minbezet', 'norm', 'budget', 'bezet'],
  resource:   ['team', 'staff', 'guard', 'personeel', 'medewerk', 'voertuig', 'kamer', 'post', 'middel'],
  beperking:  ['grens', 'rust', 'conflict', 'keur', 'regel', 'beschikbaar', 'geldig', 'mag'],
  plan:       ['plan', 'rooster', 'verdeel', 'toewijs', 'voorstel', 'shift'],
  reistijd:   ['reistijd', 'afstand', 'haversine', 'transitie', 'rijtijd', 'onderweg'],
  uitvoering: ['klok', 'start', 'uitvoer', 'aanwezig', 'checkin', 'incheck', 'begin'],
  werkelijk:  ['werkelijk', 'afwijk', 'verschil', 'realisat', 'meting', 'gemeten', 'stand'],
  herplan:    ['herplan', 'opnieuw', 'verplaats', 'ruil', 'vervang', 'annuleer', 'schrap', 'wijzig']
};
const NEGEN = Object.keys(STATIONS);

/* De namen die een bestand DEFINIEERT. Dezelfde drie vormen als
   scripts/connectlus.js, en om dezelfde reden: een AANROEP telt niet mee -- die
   zegt dat een ANDER domein het station uitvoert, niet dit. */
const DEFINITIE = /(?:function\s+([A-Za-z_$][\w$]*)|(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?(?:function|\()|([A-Za-z_$][\w$]*)\s*[:(]\s*(?:async\s*)?(?:function|\())/g;

function domeinVan(lijst, module) {
  for (const d of Object.keys(lijst)) if (lijst[d].test(module)) return d;
  return null;
}

function lus(paden, lijst) {
  const per = new Map();
  for (const p of paden) {
    const d = domeinVan(lijst, p);
    if (!d) continue;
    if (!per.has(d)) per.set(d, { namen: new Set(), bestanden: 0 });
    per.get(d).bestanden++;
    const s = om.wring(fs.readFileSync(path.join(WORTEL, p), 'utf8'));
    for (const m of s.matchAll(DEFINITIE)) {
      const naam = m[1] || m[2] || m[3];
      if (naam) per.get(d).namen.add(naam.toLowerCase());
    }
  }
  const rijen = [...per.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([domein, v]) => ({
    domein, bestanden: v.bestanden, symbolen: v.namen.size,
    stations: NEGEN.filter(w => [...v.namen].some(n => STATIONS[w].some(t => n.includes(t))))
  }));
  const perStation = NEGEN.map(w => ({ station: w, domeinen: rijen.filter(r => r.stations.includes(w)).length }));
  return {
    domeinen: rijen.length,
    rondeLus: rijen.filter(r => r.stations.length === NEGEN.length).map(r => r.domein),
    inAlleDomeinen: NEGEN.filter(w => rijen.length > 0 && rijen.every(r => r.stations.includes(w))),
    combinaties: new Set(rijen.map(r => r.stations.slice().sort().join('+'))).size,
    zeldzaamste: perStation.slice().sort((a, b) => a.domeinen - b.domeinen)[0] || null,
    perStation, rijen
  };
}

/* ---------------------------------------------------------------------------
   B. DE VORM -- delen de plandomeinen velden? (de Asset-vraag)
   ------------------------------------------------------------------------ */
function vorm(g, envelop, lijst) {
  const NAMEN = Object.keys(lijst);
  const perDomein = new Map(NAMEN.map(d => [d, new Set()]));
  const modulesPer = new Map(NAMEN.map(d => [d, new Set()]));
  let vormen = 0;
  for (const v of g.vormen) {
    const d = domeinVan(lijst, v.module);
    if (!d) continue;
    vormen++;
    modulesPer.get(d).add(v.module);
    for (const f of v.velden) if (!envelop.has(f)) perDomein.get(d).add(f);
  }

  /* Een domein zonder enkele vorm doet NIET mee aan de noemer, en dat staat
     erbij. Een leeg domein meetellen zou "0 velden in alle zeven" garanderen --
     een uitslag die de meter zelf veroorzaakt, en dat is geen meting. */
  const gevuld = NAMEN.filter(d => perDomein.get(d).size > 0);
  const leeg = NAMEN.filter(d => perDomein.get(d).size === 0)
    .map(d => ({ domein: d, reden: 'geen enkele objectvorm gevonden onder ' + String(lijst[d]) }));

  const veldDomein = new Map();
  for (const d of gevuld) for (const f of perDomein.get(d)) {
    if (!veldDomein.has(f)) veldDomein.set(f, []);
    veldDomein.get(f).push(d);
  }
  const n = gevuld.length;
  const inAlle = [...veldDomein].filter(([, ds]) => ds.length === n).map(([f]) => f).sort();
  const inHelft = [...veldDomein].filter(([, ds]) => ds.length * 2 >= n).map(([f]) => f).sort();
  const inEen = [...veldDomein].filter(([, ds]) => ds.length === 1).map(([f]) => f);
  const velden = veldDomein.size;

  /* De gedeelde PAREN. Bij COMMERCE.json was dat de enige echte vondst
     (mall <-> retail), dus die as hoort erin -- "niets gedeeld over zeven" en
     "twee delen iets" zijn twee verschillende uitslagen, en de tweede is een
     bouwopdracht terwijl de eerste er een tegenhoudt. */
  const paren = [];
  for (let i = 0; i < gevuld.length; i++) for (let j = i + 1; j < gevuld.length; j++) {
    const a = perDomein.get(gevuld[i]), b = perDomein.get(gevuld[j]);
    const samen = [...a].filter(f => b.has(f));
    const unie = new Set([...a, ...b]).size;
    paren.push({ paar: [gevuld[i], gevuld[j]], gedeeld: samen.length,
      overlap: unie ? Number((samen.length / unie).toFixed(3)) : 0, velden: samen.sort().slice(0, 12) });
  }
  paren.sort((x, y) => y.overlap - x.overlap);

  return {
    domeinen: gevuld, domeinenLeeg: leeg, vormen, velden,
    perDomein: Object.fromEntries(gevuld.map(d => [d,
      { velden: perDomein.get(d).size, modules: [...modulesPer.get(d)].sort() }])),
    inAlleDomeinen: inAlle, inMinstensHelft: inHelft,
    inEenDomeinPct: velden ? Number(((inEen.length / velden) * 100).toFixed(1)) : 0,
    paren
  };
}

function meet(opties) {
  const lijsten = (opties && opties.lijsten) || { ruim: RUIM, smal: SMAL };
  const g = om.lees();
  const paden = om.bestanden('server/kern', om.bestanden('server/school', []));
  /* De envelopvelden vallen eruit. `id`, `naam`, `status` en `at` staan overal
     en zeggen dus niets over verwantschap -- ze meten de VERPAKKING. Hij wordt
     uit OBJECTMODEL.json GELEZEN en niet overgetypt: twee lijsten die hetzelfde
     horen te zijn, lopen uiteen. */
  const envelop = new Set(JSON.parse(fs.readFileSync(path.join(WORTEL, 'OBJECTMODEL.json'), 'utf8')).envelop);

  const uit = {};
  for (const naam of Object.keys(lijsten)) {
    uit[naam] = { lus: lus(paden, lijsten[naam]), vorm: vorm(g, envelop, lijsten[naam]) };
  }

  /* DE CONCLUSIE WORDT AFGELEID EN NIET OPGESCHREVEN, en zij hangt aan de
     VORM-as. De lus-as is lexicaal (graad `vermoed`) en mag een conclusie dus
     niet dragen -- hij mag hem hooguit kleuren. Zij houdt alleen stand als
     BEIDE lijsten hem dragen: dat is de hele reden dat er twee zijn. */
  const namen = Object.keys(uit);
  const geenGedeeldeVorm = namen.every(n => uit[n].vorm.inAlleDomeinen.length === 0);
  const eensgezind = new Set(namen.map(n => uit[n].vorm.inAlleDomeinen.length === 0)).size === 1;
  const conclusie = !eensgezind
    ? 'VERDEELD: de domeinlijsten geven een ander antwoord, dus de uitslag drijft op de lijst en niet ' +
      'op de code. Er is hier geen conclusie te trekken zonder eerst de lijst te verantwoorden.'
    : geenGedeeldeVorm
      ? 'GEEN GEDEELDE VORM: geen enkel veld staat in alle gemeten plandomeinen, onder geen van beide ' +
        'domeinlijsten. Een planningsgrond met een VERPLICHTE basiseenheid (resource + tijd + plaats + ' +
        'activiteit + capaciteit + regels) is daarmee niet gerechtvaardigd als OBJECT. Wat overleeft is ' +
        'de vorm die dit huis al vier keer heeft gekozen: een VERKLARING VAN WERKWOORDEN (COMMERCE.md, ' +
        '`Koopbaar`) boven een PROJECTIE met etiketten (kern/levensgraaf/graaf.js) -- het plandomein ' +
        'stelt zijn eigen behoefte samen, de grond rekent en bezit niets.'
      : 'GEDEELDE VORM GEVONDEN: er staan velden in alle gemeten plandomeinen, onder beide lijsten. Dat ' +
        'is de uitslag die een gedeeld objecttype WEL zou rechtvaardigen -- en die dit huis bij `Asset`, ' +
        '`Koopbaar`, `Career`, `Moment` en `Manier` geen van vijf keer haalde. Lees `inAlleDomeinen` ' +
        'voordat er iets op gebouwd wordt: een veld als `datum` is verpakking die de envelop niet ving.';

  return {
    stempel: stempel(),
    uitleg: 'Is roosteren EEN motor of zeven? Twee assen over zeven plandomeinen (horeca, beveiliging, ' +
      'festival, taxi, ov, verblijf, school): DE LUS (voert een domein de negen stations van de ' +
      'voorgestelde keten uit) en DE VORM (delen ze velden -- de Asset-vraag). Gemeten met de lezer van ' +
      'scripts/objectmodel.js, dezelfde als bij de Asset-, Koopbaar-, Career-, Moment- en Manier-metingen.',
    grens: 'DE TWEE ASSEN WORDEN NOOIT OPGETELD: de lus zegt of het WERK overal hetzelfde is, de vorm of ' +
      'de GEGEVENS dat zijn, en een samengesteld cijfer verbergt welke van de twee beweegt (INT-04). ' +
      'De lus-as is LEXICAAL over gedefinieerde symboolnamen en dus een ONDERgrens -- graad `vermoed`; ' +
      'de conclusie hangt daarom aan de vorm-as. Dit meet de vorm van de DATA en niet of planning als ' +
      'PROCES bestaat (dat is een ketenproef). Envelopvelden vallen eruit: die meten de verpakking. ' +
      'En de lezer kijkt alleen in server/kern, server/bedrijf, server/school en server/papieren -- een ' +
      'planner die in een ROUTE woont is hier onzichtbaar, en dat is geen nul maar een blinde vlek.',
    conclusie, geenGedeeldeVorm, eensgezind,
    stations: NEGEN,
    rondes: uit
  };
}

function drukRonde(naam, r) {
  console.log('\n  ' + naam);
  console.log('    A. DE LUS -- ' + r.lus.domeinen + ' plandomeinen, ' + NEGEN.length + ' stations');
  for (const rij of r.lus.rijen)
    console.log('       ' + rij.domein.padEnd(12) + String(rij.stations.length).padStart(2) + '/9  ' +
      rij.stations.join(' '));
  console.log('       ' + 'lus rond'.padEnd(24) + String(r.lus.rondeLus.length).padStart(3) +
    (r.lus.rondeLus.length ? '  (' + r.lus.rondeLus.join(', ') + ')' : ''));
  console.log('       ' + 'in ALLE domeinen'.padEnd(24) + String(r.lus.inAlleDomeinen.length).padStart(3) +
    (r.lus.inAlleDomeinen.length ? '  (' + r.lus.inAlleDomeinen.join(', ') + ')' : ''));
  if (r.lus.zeldzaamste)
    console.log('       ' + 'zeldzaamste station'.padEnd(24) + String(r.lus.zeldzaamste.domeinen).padStart(3) +
      '  (' + r.lus.zeldzaamste.station + ')');
  console.log('       ' + 'verschillende combinaties'.padEnd(24) + String(r.lus.combinaties).padStart(3));

  console.log('    B. DE VORM -- ' + r.vorm.vormen + ' objectvormen over ' + r.vorm.domeinen.length + ' domein(en)');
  for (const d of r.vorm.domeinen)
    console.log('       ' + d.padEnd(12) + String(r.vorm.perDomein[d].velden).padStart(4) + ' velden  (' +
      r.vorm.perDomein[d].modules.length + ' module(s))');
  for (const l of r.vorm.domeinenLeeg) console.log('       \x1b[33m' + l.domein.padEnd(12) + '   -- niets gevonden\x1b[0m');
  console.log('       ' + 'velden totaal'.padEnd(24) + String(r.vorm.velden).padStart(5));
  console.log('       ' + 'in ALLE domeinen'.padEnd(24) + String(r.vorm.inAlleDomeinen.length).padStart(5) +
    (r.vorm.inAlleDomeinen.length ? '  (' + r.vorm.inAlleDomeinen.join(', ') + ')' : ''));
  console.log('       ' + 'in minstens de helft'.padEnd(24) + String(r.vorm.inMinstensHelft.length).padStart(5));
  console.log('       ' + 'in precies EEN domein'.padEnd(24) + String(r.vorm.inEenDomeinPct).padStart(5) + '%');
  if (r.vorm.paren.length) {
    const p = r.vorm.paren[0];
    console.log('       meest verwante paar      ' + (p.paar[0] + ' <-> ' + p.paar[1]) + ': ' + p.gedeeld +
      ' gedeeld, overlap ' + p.overlap);
  }
}

function druk(u) {
  console.log('\nDE PLANVORM -- is roosteren EEN motor, of zeven?');
  for (const naam of Object.keys(u.rondes)) drukRonde(naam.toUpperCase(), u.rondes[naam]);
  console.log('\n' + (u.geenGedeeldeVorm ? '\x1b[32m' : '\x1b[33m') + u.conclusie + '\x1b[0m');
}

module.exports = { meet, druk, DOEL, RUIM, SMAL, STATIONS, NEGEN };

if (require.main === module) {
  const u = meet();
  /* GEEN process.exit() NA EEN GROTE UITVOER: naar een BESTAND schrijft node
     synchroon, naar een PIPE niet. Zie de pipe-regel in scripts/meetkeuring.js;
     een vroege `return` laat de buffer gewoon leeglopen. */
  if (process.argv.includes('--json')) { console.log(JSON.stringify(u)); return; }
  druk(u);
  if (process.argv.includes('--vastleggen')) {
    fs.writeFileSync(DOEL, JSON.stringify(u, null, 2) + '\n');
    console.log('\ngeschreven: PLANVORM.json');
  }
}
