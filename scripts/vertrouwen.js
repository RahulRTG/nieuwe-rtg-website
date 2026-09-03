#!/usr/bin/env node
/* ============================================================================
   DE VERVALSTATEN -- PROOF.md paragraaf 2 als meting, niet als voornemen.

   WAAROM DIT ER IS. De bewijsmatrix zegt per cel bewezen of niet; wat hij niet
   zegt is wat dat bewijs vandaag nog waard is. Bewijs veroudert: de code
   verandert, de meting raakt uit de tijd, een cel zakt. Wie alleen groen en
   rood kent, leest een meting van drie maanden oud als een feit van vandaag.
   Dit script kent elke route een LEVENDE STAAT toe, met de reden en met wat de
   staat zou veranderen -- de tweede universele vraag van PROOF.md ("wat zou
   maken dat RTG dit niet meer vertrouwt") per route beantwoord.

   DE STATEN, van sterk naar zwak:

     bewezen     alle elf cellen dragen bewijs (of zijn nvt) en de meting is
                 vers genoeg
     verschaald  het bewijs is compleet maar spreekt over een vorige wereld:
                 de meting is ouder dan de halfwaardetijd
     verzwakt    er is bewijs maar het draagt minder dan het lijkt: een of
                 meer schakels zijn nooit gemeten
     geschorst   een cel is GEZAKT: het bewijs zegt zelf dat het niet klopt.
                 De veiligste toestand geldt tot een hermeting slaagt
     ongemeten   er is niets om te vertrouwen -- dat is geen vervalstaat maar
                 de eerlijke vloer (LAT.md regel 12: niet gemeten is geen
                 slechte uitslag, maar vertrouwen is het ook niet)

   TWEE HARDE REGELS UIT PROOF.md PARAGRAAF 9. Niemand zet een staat met de
   hand op bewezen: dit script LEEST alleen, en de enige weg omhoog is een
   hermeting in de registers zelf. En de staat is nooit een verhaal: elke rij
   hieronder komt uit bouw() van scripts/bewijsmatrix.js, dezelfde ene waarheid
   waar het routedossier en de normtanden op staan (LAT.md regel 4).

   DE HALFWAARDETIJD IS IN FASE 1 GROF: hij geldt per REGISTER (de oudste
   stempel van de bronregisters bepaalt de ouderdom van het hele bewijs), niet
   per route. Dat is bewust: per-route-versheid vraagt de slagveld-koppeling
   van PROOF.md paragraaf 7 en die bestaat nog niet. Grof en eerlijk wint van
   fijn en verzonnen.

   Draai:  node scripts/vertrouwen.js
           node scripts/vertrouwen.js --vastleggen
   ========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');
const { stempel, stempelVan, eisSchoneBoom, versheid, nuCommit } = require('./lib/stempel');

const WORTEL = path.join(__dirname, '..');
const UITSLAG = path.join(WORTEL, 'VERTROUWEN.json');

/* Dertig dagen. Een getal om over te twisten, en dat hoort ook: wie hem
   verandert, verandert wat "vers" betekent voor het hele huis, en doet dat
   hier op EEN plek. PROOF.md wil hem later per risico; dat begint pas te
   betekenen als er een risicoklasse per capability bestaat. */
const HALFWAARDETIJD_DAGEN = 30;

/* De bronregisters waarvan de oudste stempel de ouderdom van het bewijs
   bepaalt. Dezelfde bestanden die scripts/bewijsmatrix.js leest; een register
   dat ontbreekt telt niet mee (de matrix zet die cellen dan al op ongemeten,
   en dat is de straf -- twee keer straffen zou dubbel tellen). */
const BRONNEN = ['POORTWACHT.json', 'ROLPROEF.json', 'KETENS.json', 'INVOERPROEF.json',
  'IDEMPROEF.json', 'STAATPROEF.json', 'OUTPUTPROEF.json', 'AUDITPROEF.json',
  /* Deze twee stonden er niet terwijl de matrix ze wel leest. Ze droegen ook geen
     stempel, dus ze hadden hier hoe dan ook niets bijgedragen -- twee gaten die
     elkaar dekten. */
  'HANDELINGPROEF.json', 'UITVOERPROEF.json'];

/* De staat van EEN route, uit zijn elf cellen en de ouderdom van het bewijs.
   Pure functie: de toets voert hem elke overgang (LAT.md regel 10), en wie de
   staatmachine wil veranderen doet dat hier en nergens anders.

   `cellen` is het object uit een matrixrij: { AUTH: { staat: 'bewezen' }, .. }
   `ouderdomDagen` is een getal; NaN of undefined is een gezakte meting. */
function staatVan(cellen, ouderdomDagen, halfwaardetijd, onreproduceerbaar) {
  if (!cellen || typeof cellen !== 'object' || !Object.keys(cellen).length) {
    throw new Error('een route zonder cellen heeft geen staat; dit is een gezakte meting en geen ongemeten');
  }
  if (!Number.isFinite(ouderdomDagen)) {
    throw new Error('ouderdom van het bewijs is onbekend; zonder versheid is er geen staat te geven');
  }
  const hw = Number.isFinite(halfwaardetijd) ? halfwaardetijd : HALFWAARDETIJD_DAGEN;

  const per = { bewezen: [], verklaard: [], nvt: [], ongemeten: [], gezakt: [] };
  for (const [schakel, cel] of Object.entries(cellen)) {
    (per[cel && cel.staat] || per.ongemeten).push(schakel);
  }

  if (per.gezakt.length) {
    return { staat: 'geschorst',
      reden: 'het bewijs zegt zelf dat het niet klopt: gezakt op ' + per.gezakt.join(', '),
      heropent: 'repareer de oorzaak en laat de proef op ' + per.gezakt.join(', ') +
        ' opnieuw slagen; een staat gaat alleen omhoog door hermeting' };
  }
  const gedragen = per.bewezen.length + per.verklaard.length;
  if (!gedragen) {
    return { staat: 'ongemeten',
      reden: 'geen enkele schakel draagt bewijs; er is niets om te vertrouwen',
      heropent: 'meet: elke schakel heeft een instrument (zie scripts/bewijsmatrix.js SCHAKELS)' };
  }
  if (per.ongemeten.length) {
    return { staat: 'verzwakt',
      reden: 'het bewijs draagt minder dan het lijkt: ' + per.ongemeten.length +
        ' schakel(s) nooit gemeten (' + per.ongemeten.join(', ') + ')',
      heropent: 'meet de ontbrekende schakel(s); de sluitweg per soort staat in BEWIJSSCHULD.json' };
  }
  if (ouderdomDagen > hw) {
    return { staat: 'verschaald',
      reden: 'het bewijs is compleet maar ' + Math.round(ouderdomDagen) +
        ' dagen oud (halfwaardetijd ' + hw + '); het spreekt over een vorige wereld',
      heropent: 'draai de proeven opnieuw; het bewijs zelf is niet in twijfel, alleen zijn leeftijd' };
  }
  /* HET LAATSTE FILTER, EN HET WORDT NIET GEHAALD DOOR OUDERDOM MAAR DOOR
     HERKOMST. Een bronregister dat is gemeten terwijl er ongecommitte CODE in de
     boom stond, hoort niet bij de commit die in zijn stempel staat -- hij hoort
     bij iets wat nergens is vastgelegd. Zo'n meting is niet na te lopen, en wat
     niemand kan overdoen is geen bewijs (TAKEN.md 7.3).

     HIJ ZAKT NAAR `verschaald` EN NIET NAAR `geschorst`, en dat is een besluit.
     De meting is niet FOUT -- er is wel degelijk iets gemeten, en waarschijnlijk
     klopt het -- hij is alleen onreproduceerbaar. Dat is precies wat `verschaald`
     betekent in PROOF.md par. 2: het bewijs zelf is niet in twijfel, alleen de
     waarde die je eraan mag hechten. Een route hierop schorsen zou de
     schorspoort dichttrekken op een boekhoudkundig gebrek, en dat is geen
     veiligheid maar een storing.

     De namen gaan mee in de reden. "Het bewijs is onreproduceerbaar" zonder te
     zeggen WELKE meting, stuurt de lezer op een zoektocht die de meter zelf al
     had kunnen afsluiten. */
  const vuil = Array.isArray(onreproduceerbaar) ? onreproduceerbaar.filter(Boolean) : [];
  if (vuil.length) {
    return { staat: 'verschaald',
      reden: 'het bewijs is compleet en vers, maar ' + vuil.length + ' bronregister(s) zijn gemeten ' +
        'met ongecommitte code in de boom en dus niet na te lopen: ' + vuil.join(', '),
      heropent: 'commit de code en meet opnieuw; een meting hoort bij de commit die in zijn stempel staat' };
  }
  return { staat: 'bewezen',
    reden: 'alle schakels dragen bewijs en de meting is ' + Math.round(ouderdomDagen) + ' dag(en) oud',
    heropent: 'dit vervalt zodra een cel zakt, een schakel zijn bewijs verliest, of de meting ouder ' +
      'wordt dan ' + hw + ' dagen' };
}

/* Alle routes: de matrixrijen door de staatmachine. Losgetrokken van meet()
   zodat de toets hem verzonnen rijen kan voeren zonder de echte registers. */
function bereken(rijen, ouderdomDagen, halfwaardetijd, onreproduceerbaar) {
  const telling = { bewezen: 0, verschaald: 0, verzwakt: 0, geschorst: 0, ongemeten: 0 };
  const perRoute = {};
  for (const rij of rijen) {
    const uit = staatVan(rij.cellen, ouderdomDagen, halfwaardetijd, onreproduceerbaar);
    telling[uit.staat]++;
    perRoute[rij.methode + ' ' + rij.pad] = uit;
  }
  return { telling, perRoute };
}

/* De ouderdom van het bewijs: dagen sinds de OUDSTE stempel van de bronnen
   die bestaan. De oudste en niet de jongste, want het bewijs is zo vers als
   zijn oudste been -- een verse outputproef naast een rolproef van vorig
   kwartaal maakt het geheel niet vers. */
function ouderdom(nu, lees) {
  const lezer = lees || ((naam) => fs.readFileSync(path.join(WORTEL, naam), 'utf8'));
  const bronnen = {};
  const vuil = [];
  let oudste = null;
  for (const naam of BRONNEN) {
    /* VIA DE GEDEELDE LEZER, want hier stond `j.stempel && j.stempel.op` en dat
       kent maar EEN van de twee stempelvormen. POORTWACHT.json draagt de zijne
       onder `gemeten` en viel daardoor stilzwijgend buiten deze berekening -- het
       OUDSTE register van de stapel, in de meter die juist over ouderdom gaat. */
    let st;
    if (lees) { let j; try { j = JSON.parse(lezer(naam)); } catch (e) { continue; }
      st = j && (j.stempel || (j.gemeten && j.gemeten.op ? j.gemeten : null)); }
    else st = stempelVan(naam);
    const op = st && st.op;
    if (!op) continue;
    const dagen = (nu - new Date(op).getTime()) / 86400000;
    bronnen[naam] = { op, dagen: Math.round(dagen * 10) / 10, boomVuil: st.boomVuil === true };
    /* `boomVuil: null` is met opzet GEEN vuil: dat betekent dat git niet te
       bevragen was, en onbekend als vuil lezen zou elke meting buiten een
       repo onbruikbaar maken. Onbekend hoort hier niet zwaarder te wegen dan
       gemeten -- maar ook niet lichter, en daarom staat het er wel bij. */
    if (st.boomVuil === true) vuil.push(naam);
    if (oudste === null || dagen > oudste) oudste = dagen;
  }
  if (oudste === null) {
    throw new Error('geen enkel bronregister draagt een stempel; dan is de versheid niet te meten ' +
      'en is dit een gezakte meting, geen verse');
  }
  return { dagen: oudste, bronnen, onreproduceerbaar: vuil };
}

function meet() {
  const matrix = require('./bewijsmatrix').bouw();
  if (matrix.gedegradeerd) {
    throw new Error('de routekaart viel om (' + matrix.reden + '); een vertrouwensstaat over een ' +
      'halve routelijst is gevaarlijker dan geen');
  }
  const oud = ouderdom(Date.now());
  const uit = bereken(matrix.rijen, oud.dagen, HALFWAARDETIJD_DAGEN, oud.onreproduceerbaar);
  return {
    stempel: stempel(),
    uitleg: 'De vervalstaat per route (PROOF.md par. 2): bewezen, verschaald, verzwakt, geschorst of ' +
      'ongemeten, met per route de reden en wat de staat zou veranderen. Berekend uit bouw() van ' +
      'scripts/bewijsmatrix.js en de stempels van de bronregisters. NIEMAND zet een staat met de hand ' +
      'omhoog; alleen een hermeting kan dat.',
    grens: 'De halfwaardetijd geldt in fase 1 per register (oudste stempel), niet per route; en een ' +
      'staat zegt wat de PROEVEN dragen, niet wat de code waard is. Een bewezen route met een gat dat ' +
      'geen proef bedacht heeft, staat hier gewoon op bewezen -- dit register is geen dekkingsbewijs.',
    halfwaardetijdDagen: HALFWAARDETIJD_DAGEN,
    ouderdomDagen: Math.round(oud.dagen * 10) / 10,
    bronnen: oud.bronnen,
    /* Welke bronnen niet zijn na te lopen, apart en met naam: dit is de reden
       waarom er geen enkele route op `bewezen` kan staan, en die reden hoort in
       het register te staan en niet alleen in de tekst per route. */
    onreproduceerbaar: oud.onreproduceerbaar,
    routes: matrix.routes,
    telling: uit.telling,
    perRoute: uit.perRoute
  };
}

module.exports = { staatVan, bereken, ouderdom, meet, HALFWAARDETIJD_DAGEN, BRONNEN };


/* ==========================================================================
   DE POORT VOOR HET SCHRIJVEN -- en waarom juist DIT register er een nodig had.

   Dit bestand schrijft VERTROUWEN.json, en dat register is geen rapport: de
   bewijspoort in server/kern/stuur/beleid.js LEEST hem en weigert een route
   waarvan het bewijs volgens deze afdruk is gezakt. Een verkeerd register zet
   dus echte handelingen stil.

   Dat is echt gebeurd, twee keer in een zitting. Het register werd afgeleid uit
   een testronde die halverwege was afgebroken. De routes waarvan de toetsen
   niet meer aan de beurt waren kwamen als "gezakt bewijs" binnen, VERTROUWEN
   sprong van 0 naar 45 geschorst, en de volgende ronde antwoordde overal met
   "Deze handeling is tijdelijk geschorst" -- op plekken waar niets mis was.
   Aan het bestand is dat verschil niet te zien: een half gemeten register ziet
   er precies zo uit als een volledig gemeten register.

   TWEE EISEN DUS, ALLEBEI VOOR HET SCHRIJVEN:

     1. een schone boom -- zelfde poort als de zes proefrunners
        (scripts/rolproef-route.js e.a.). Ongecommit werk betekent dat het
        register bij iets anders hoort dan bij de commit die het noemt.
     2. de bronregisters mogen niet ouder zijn dan de laatste ronde, en er moet
        er minstens EEN zijn. Ontbreken ze allemaal, dan is er niets gemeten en
        hoort er niets geschreven te worden.

   Weigeren gebeurt MET een reden en met een uitweg, zoals elke verhindering in
   dit huis (GRAMMATICA.md). Lezen en tonen blijft altijd mogelijk -- de poort
   staat op het SCHRIJVEN en niet op het meten, want een meter die je niet mag
   draaien is geen meter.
   ========================================================================== */
function poortVoorSchrijven(watIsHet) {
  const b = eisSchoneBoom(watIsHet);
  if (!b.ok) {
    console.error('\n  NIET VASTGELEGD -- dit register stuurt de bewijspoort aan\n');
    console.error('  ' + b.reden);
    for (const r of (b.bestanden || [])) console.error('    ' + r);
    process.exit(3);
  }

  /* EEN SCHONE BOOM IS NIET GENOEG -- DE BRONNEN MOETEN OOK BIJ DEZE BOOM HOREN.

     Dit register LEIDT AF uit de proefregisters in BRONNEN. Die dragen elk hun
     eigen stempel, en die kan van een heel andere versie van de code zijn. Op
     1 september 2026 gebeurde precies dat: ROLPROEF.json was gemeten op
     5dc3b081, twee uur voordat de twee lijsten van publieke routes werden
     samengevoegd. De ACL-cellen kenden die lijst dus niet, en /api/auth/forgot
     -- een route die met een uitgeschreven reden publiek IS -- kwam terug als
     'gezakt op ACL'. Vijfenveertig routes gingen daarop naar `geschorst`, de
     bewijspoort in kern/stuur/beleid.js weigerde ze, en de suite antwoordde
     honderden keren met "Deze handeling is tijdelijk geschorst" op plekken waar
     niets mis was.

     De boom was daarbij SCHOON. De poort hierboven zag dus niets, en dat is de
     hele reden dat deze tweede eis er staat: een afgeleid register kan niet
     verser zijn dan zijn bronnen, en het verschil is aan de afdruk niet te zien.

     `versheid()` uit ./lib/stempel.js beantwoordt dit al, en met de juiste
     nuance: niet "andere commit" maar "andere CODE". Een commit die alleen
     registers of documentatie raakt, maakt een meting niet ongeldig. */
  const nu = nuCommit();
  const oud = [];
  for (const bron of BRONNEN) {
    /* Via dezelfde lezer als ouderdom() hierboven: hier stond `j.stempel`, en
       dat kent maar een van de twee stempelvormen. POORTWACHT.json draagt de
       zijne onder `gemeten` en zou hier dus als "geen stempel" zijn geweigerd
       -- niet omdat hij oud was, maar omdat deze poort hem niet kon lezen.
       `undefined` is "het bestand is er niet" en telt niet mee, precies zoals
       ouderdom() een ontbrekend register overslaat; `null` is "wel een
       bestand, geen stempel" en dat weigert versheid() met de reden erbij. */
    const st = stempelVan(bron);
    if (st === undefined) continue;
    const v = versheid(st, nu);
    if (!v.vers) oud.push(bron + ' -- ' + v.reden);
  }
  if (oud.length) {
    console.error('\n  NIET VASTGELEGD -- de bronnen horen niet bij deze boom\n');
    console.error('  Dit register leidt af uit de proefregisters, en ' + oud.length +
      ' van de ' + BRONNEN.length + ' zijn gemeten op andere code. Een route die daardoor');
    console.error('  ten onrechte `geschorst` heet, wordt door de bewijspoort geweigerd -- en dan');
    console.error('  staat er software stil om een meting die niet bij deze versie hoort.\n');
    for (const r of oud) console.error('    ' + r);
    console.error('\n  Zo kan het wel: draai de proeven die verouderd zijn opnieuw, en leg dit');
    console.error('  register daarna vast. Een ontbrekend register telt niet mee (de matrix zet');
    console.error('  die cellen al op ongemeten); een OUD register wel, en dat is het gevaar.');
    process.exit(3);
  }
}

if (require.main !== module) return;

const uit = meet();
console.log('\n=== DE VERVALSTATEN ===\n');
console.log('  bewijs is ' + uit.ouderdomDagen + ' dagen oud (oudste bron; halfwaardetijd ' +
  uit.halfwaardetijdDagen + ')\n');
for (const s of ['bewezen', 'verschaald', 'verzwakt', 'geschorst', 'ongemeten']) {
  console.log('  ' + s.padEnd(11) + String(uit.telling[s]).padStart(6));
}
if (process.argv.includes('--vastleggen')) {
  poortVoorSchrijven('de vervalstaten');
  fs.writeFileSync(UITSLAG, JSON.stringify(uit, null, 1) + '\n');
  console.log('\n  vastgelegd in VERTROUWEN.json\n');
} else {
  console.log('\n  (niet vastgelegd; draai met --vastleggen om VERTROUWEN.json te schrijven)\n');
}
