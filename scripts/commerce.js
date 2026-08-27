#!/usr/bin/env node
/* ============================================================================
   DE COMMERCE-METING -- bestaat "Koopbaar", of verklaren we hem?

   DE VRAAG. Er ligt een ontwerp voor een universele commerce-laag boven de
   bestaande domeinen: een Kanaal-object, een Commerce Graph, een Universal Cart
   en -- de dragende bewering -- een KOOPBAAR-protocol:

     "Een koopbaar object kan een product zijn, een gerecht, een kamer, een
      ticket, een rit, een dienst, een abonnement, een reservering, een factuur,
      een cadeaukaart, een lidmaatschap, een digitale dienst, een groothandel-
      partij. Allemaal implementeren ze toon(), prijs(), beschikbaarheid(),
      reserveer(), bevestig(), lever(), annuleer(), retourneer(). Dan bouw je
      checkout een keer."

   Ze KUNNEN het. De vraag is of ze het ZIJN -- en dit huis heeft die vraag al
   twee keer gesteld en twee keer NEE gehoord:

     OBJECTMODEL.json  `Asset` bestaat niet. Tafel, kamer, podium en leaseauto
                       delen niets buiten hun verpakking. 71% van de velden
                       hoort bij precies EEN domein.
     CAPABILITEIT.json Er is geen capabilitylaag, er zijn er twintig. 91% van
                       de leden woont in precies EEN lijst.

   DEVELOPERCLOUD.md par. 2 trok daar de regel uit die dit script gehoorzaamt:
   een universeel objectmodel moet worden GEVONDEN in de domeinen, niet eroverheen
   VERKLAARD. Koopbaar is exact even breed als Asset was -- dertien domeinen,
   acht werkwoorden -- dus wordt hij op dezelfde manier behandeld: meten, en het
   getal de conclusie laten dragen.

   DE METING IS MET OPZET SCHEEF, EN WEL DE GOEDE KANT OP. Alle vier de tellingen
   hieronder zijn ROYAAL: een werkwoord telt mee bij de vaagste naamverwantschap,
   een koopbare vorm bij het minste prijsveld. Dat maakt Koopbaar RIJKER dan hij
   is. Komt er dan alsnog uit dat de domeinen hem niet delen, dan is dat een
   sterke uitslag -- de meter heeft zijn best gedaan om het tegendeel te vinden.
   Andersom zou een streng gemeten "nee" niets zeggen.

   ================================ WAT ER GEMETEN WORDT ======================

   A. DE KOOPBARE VORMEN. Elke bewaarde vorm met een PRIJSVELD (prijs, centen,
      bedrag, tarief, price, kosten) en vier of meer velden. De envelop gaat
      eraf -- zonder dat vindt de meter overal verwantschap, want elke rij in
      dit huis draagt id/at/naam/status. Daarna: hoeveel domeinen hebben zo'n
      vorm, en hoeveel vormparen uit VERSCHILLENDE domeinen lijken werkelijk op
      elkaar? Dat is de Asset-vraag, toegespitst op alles met een prijs.

   B. DE ACHT WERKWOORDEN. Per domein uit A: welke van de acht werkwoorden van
      het voorgestelde protocol worden daar werkelijk uitgevoerd? Gemeten op de
      NAMEN van de functies die het domein definieert. Dat is grof en dat mag,
      zie de scheefheid hierboven. De vraag eronder is niet "hoeveel werkwoorden
      heeft domein X" maar: IS ER EEN WERKWOORD DAT ZE ALLEMAAL HEBBEN? Een
      protocol dat niemand volledig invult, is geen protocol maar een wens.

   C. DE WINKELWAGENS. Elke vorm die REGELS met een aantal EN een prijs draagt
      -- dat is een wagen of een bon, ongeacht hoe hij heet. Hoeveel zijn het er,
      en delen ze een vorm? Dit toetst "Universal Cart" rechtstreeks.

   D. DE OPTELLINGEN. Elke plek die regels tot een totaal optelt (een reduce of
      een lus met prijs maal aantal). Dit is het duurste getal van de vier, want
      elke plek is een eigen kans om btw, korting of afronding nEt anders te
      doen -- en dat is precies wat kern/fiscaal/tarief.js overkwam: twee plekken
      die hetzelfde btw-tarief vasthielden en het oneens waren, jarenlang, zonder
      dat iemand wist welke klopte.

   ================================ WAT DIT NIET BEWIJST ======================

   Een gedeelde NAAM is geen gedeelde BETEKENIS -- dezelfde waarschuwing als bij
   scripts/objectmodel.js, en hier zwaarder omdat B op namen alleen meet. Een
   functie `bevestig` in kern/reservering bevestigt een tafel; een `bevestig` in
   kern/appstore bevestigt een aanschaf. Dit script wijst kandidaten aan en telt
   afwezigheid; of twee werkwoorden hetzelfde werkwoord zijn, beslist een mens
   die beide modules opent. Daarom staat overal WAAR het vandaan komt.

   En het meet de HUIDIGE code. "Domein X kent geen retour" betekent niet dat
   retour daar onmogelijk is -- het betekent dat er vandaag niets staat, en dus
   dat een universeel protocol dat er wel van uitgaat, daar iets belooft wat
   niemand heeft gebouwd. Dat is de bruikbare uitslag: een prijskaart, geen
   foutenlijst.

   Draai: node scripts/commerce.js            (leesbaar)
          node scripts/commerce.js --json     (voor de ratel)
          npm run commerce:vast               (schrijft COMMERCE.json)
   ========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');
/* De boomwandeling, de uitsluitingen en de domeinbepaling komen uit de meter
   die ze al had. Een tweede kopie van die uitsluitlijst loopt er binnen een
   maand op achter, en dan meten twee scripts een andere boom (LAT-regel 4). */
const { wring, domeinVan, bestanden, BRONNEN } = require('./objectmodel');

const WORTEL = path.join(__dirname, '..');

const MIN_VELDEN = 4;              // minder is geen bewaard ding maar een optiezak
const ENVELOP_DEEL = 0.06;         // een veld in 6%+ van de domeinen is verpakking
const GELIJKENIS = 0.6;            // twee vormen lijken op elkaar vanaf deze overlap

/* WAT EEN VORM KOOPBAAR MAAKT: er staat een bedrag in. Ruim genomen, en
   `centen` zit erbij hoewel OBJECTMODEL.json hem ENVELOP noemt -- daar terecht,
   want daar was de vraag welke velden een TYPE onderscheiden. Hier is het
   prijsveld juist de INGANG en niet het bewijs; wat de vormen onderscheidt,
   wordt daarna gemeten met de envelop er weer af. */
const PRIJSVELD = /^(prijs|prijzen|price|centen|bedrag|tarief|kosten|totaal|totaalCenten|basisCenten|bedragCenten|kostprijs|publiekePrijs|ledenPrijs)$/i;
/* Een REGELVELD maakt van een vorm een wagen of een bon: er staat een aantal
   bij het bedrag. Een vorm met alleen een prijs is een artikel; een vorm met
   een prijs EN een aantal is een regel in een afrekening. */
const AANTALVELD = /^(aantal|qty|hoeveelheid|stuks|n|count)$/i;

/* DE ACHT WERKWOORDEN VAN HET VOORGESTELDE PROTOCOL, elk als naamfamilie.

   Dit zijn de royaalste patronen die nog verdedigbaar zijn. `toon` vangt met
   lijst/overzicht bijna elke module -- dat is geen slordigheid maar het punt:
   als het enige werkwoord dat iedereen deelt "laat het zien" is, dan is dat de
   envelop van het protocol en niet het protocol.

   Wat er met opzet NIET in zit: een kaal `terug`. Dat vangt terugkoppelen,
   teruggeven en terugrekenen, en dan lijkt elk domein een retourstroom te
   hebben. Alleen de samenstellingen die werkelijk over geld terug gaan.

   DE PATRONEN ANKEREN NIET OP HET BEGIN VAN DE NAAM, en dat is een reparatie.
   Dat deden ze wel, en toen miste `maakTeruggave` in kern/appstore het
   werkwoord retour terwijl dat bestand juist HET teruggaverecht uit APPSTORE.md
   uitvoert. Dit huis schrijft `maakX`, `zetX`, `doeX` en `isX`, dus een anker
   vooraan meet de schrijfgewoonte en niet het werk -- en het maakte de meting
   STRENGER dan de kop belooft, precies de verkeerde kant op. */
const WERKWOORDEN = {
  toon: /(toon|beeld|weergave|publiek|etalage|kaart|lijst|overzicht|zoek)/i,
  prijs: /(prijs|prijzen|tarief|kosten|bereken|som|totaal|offerte|quote)/i,
  beschikbaarheid: /(beschikbaar|vrij|voorraad|slot|sloten|capaciteit|open|agenda|rooster|bezetting)/i,
  reserveer: /(reserveer|reserveren|reservering|houd|blokkeer|claim|vastleg|vastzet)/i,
  bevestig: /(bevestig|plaats|boek|accepteer|akkoord|bestel|koop|aanschaf)/i,
  /* `serveer` staat er met een lookbehind, en dat is geen finesse maar een
     reparatie van een uitslag die anders had gelogen: RESERVEER bevat SERVEER.
     Zonder die twee tekens telde elk domein dat iets reserveert ook als een
     domein dat kan leveren, en `kern/mobiliteit` haalde daarmee alle acht
     werkwoorden -- met twee ervan bewezen door dezelfde functie. Precies de
     valse volledigheid die dit script hoort te ontmaskeren. */
  lever: /(lever|bezorg|overhandig|afhaal|uitgifte|uitgeef|(?<!re)serveer|verzend|verstuur)/i,
  annuleer: /(annuleer|afzeg|intrek|afbreek|verval)/i,
  retour: /(retour|terugbetaal|teruggave|terugstort|terugboek|refund|crediteer|creditnota)/i
};
const WERKWOORD_NAMEN = Object.keys(WERKWOORDEN);

/* De vormen in een bron, met hun velden. Anders dan vormenVan() in
   scripts/objectmodel.js is `id` hier GEEN eis: een wagenregel draagt vaak
   `itemId` en geen `id`, en juist die regels zijn hier het onderwerp. De eis is
   in plaats daarvan een prijsveld -- zie PRIJSVELD hierboven.

   Net als daar: alleen literalen ZONDER geneste accolades. Een half gelezen
   vorm vervuilt de uitkomst, een gemiste vorm verzwakt alleen een conclusie. */
function vormenVan(bron) {
  const s = wring(bron);
  const uit = [];
  for (const m of s.matchAll(/\{([^{}]{20,1600})\}/g)) {
    const velden = [...m[1].matchAll(/(?:^|,)\s*([A-Za-z_$][\w$]*)\s*:/g)].map(x => x[1]);
    const uniek = [...new Set(velden)];
    if (uniek.length < MIN_VELDEN) continue;
    if (!uniek.some(f => PRIJSVELD.test(f))) continue;
    uit.push(uniek);
  }
  return uit;
}

/* SLEUTELWOORDEN ZIJN GEEN FUNCTIENAMEN. Het patroon voor een methode in een
   object-literaal (`naam(...) {`) vangt ook `if (...) {` en `for (...) {`, en
   die stonden dus in de namenlijst van elk domein. Onschuldig voor de acht
   werkwoorden -- geen ervan lijkt op een sleutelwoord -- maar een namenlijst
   die `if` bevat, is een namenlijst die je niet kunt vertrouwen zodra iemand er
   een negende werkwoord bij zet. */
const SLEUTELWOORDEN = new Set(['if', 'for', 'while', 'switch', 'catch', 'return', 'function',
  'typeof', 'new', 'do', 'else', 'try', 'await', 'yield', 'case', 'delete', 'void', 'in', 'of']);

/* De functienamen die een bestand DEFINIEERT. Vier vormen, want dit huis
   schrijft ze alle vier: een functieverklaring, een methode in een object-
   literaal, een pijlfunctie op een const, en een async methode. Aanroepen
   tellen niet mee -- anders "heeft" elk domein elk werkwoord zodra het er een
   van een ander aanroept, en dan meet je de bedrading in plaats van het werk. */
function functiesVan(bron) {
  const s = wring(bron);
  const uit = new Set();
  for (const m of s.matchAll(/\bfunction\s+([A-Za-z_$][\w$]*)\s*\(/g)) uit.add(m[1]);
  for (const m of s.matchAll(/\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?(?:function\b|\([^)]*\)\s*=>|[A-Za-z_$][\w$]*\s*=>)/g)) uit.add(m[1]);
  for (const m of s.matchAll(/(?:^|[,{])\s*([A-Za-z_$][\w$]*)\s*(?:\([^)]*\)\s*\{|:\s*(?:async\s*)?(?:function\b|\([^)]*\)\s*=>))/gm)) uit.add(m[1]);
  for (const m of s.matchAll(/\basync\s+([A-Za-z_$][\w$]*)\s*\(/g)) uit.add(m[1]);
  for (const w of SLEUTELWOORDEN) uit.delete(w);
  return [...uit];
}

/* DE OPTELLINGEN: een plek die van regels een bedrag maakt.

   De eerste versie eiste de vermenigvuldiging BINNEN de reduce, en vond er
   zeven. Dat was te smal en het is leerzaam waarom: routes/gast/checkout-buiten.js
   rekent `totaalCenten: centen * aantal` uit bij het BOUWEN van de regel en telt
   daarna `r.totaalCenten` op. De rekenkunde staat er dus wel, alleen niet op de
   plek waar de meter keek -- en juist die splitsing is de gewone manier om het
   te schrijven.

   Nu telt allebei: het uitrekenen van een regelbedrag (prijs maal aantal, in
   beide schrijfrichtingen) en het optellen van bedragen tot een totaal. Er moet
   ook een BEDRAG in het bestand voorkomen, anders telt `aantal * breedte` in
   een plattegrond mee als afrekening. */
const HEEFT_BEDRAG = /\b(centen|prijs|price|bedrag|tarief|totaal)/i;
const OPTELLING = [
  /\*\s*(?:[\w.]*\.)?(?:aantal|qty|hoeveelheid|stuks)\b/,
  /\b(?:aantal|qty|hoeveelheid|stuks)\s*\*/,
  /\.reduce\(\s*\([^)]*\)\s*=>[^;]{0,200}?\b(?:centen|prijs|price|bedrag|totaal)/i
];
/* Als eigen functie zodat de toets hem los kan voeren met de twee schrijfwijzen
   die hij uit elkaar moet houden -- en met de twee die hij moet weigeren. */
function isOptelling(bron) {
  const s = wring(bron);
  return HEEFT_BEDRAG.test(s) && OPTELLING.some(r => r.test(s));
}

function lees() {
  const paden = BRONNEN.reduce((a, m) => bestanden(m, a), []);
  const vormen = [];        // { module, velden[] }
  const functies = [];      // { module, namen[] }
  const optellingen = [];   // { module }
  for (const p of paden) {
    const bron = fs.readFileSync(path.join(WORTEL, p), 'utf8');
    /* Dezelfde vorm twee keer in een bestand is EEN vorm -- anders telt een
       module die zijn regel bij maken, bijwerken en tonen opbouwt drie keer
       mee, en verschijnt elk paar drie keer in de uitkomst. */
    const gezien = new Set();
    for (const velden of vormenVan(bron)) {
      const sleutel = velden.slice().sort().join(',');
      if (gezien.has(sleutel)) continue;
      gezien.add(sleutel);
      vormen.push({ module: p, velden });
    }
    functies.push({ module: p, namen: functiesVan(bron) });
    if (isOptelling(bron)) optellingen.push({ module: p });
  }
  return { vormen, functies, optellingen, bestanden: paden.length };
}

/* Het inlezen en het REKENEN staan los, en dat is toetsbaarheid en geen
   netheid: analyse() is te voeren met verzonnen vormen waarvan je WEET wat
   eruit hoort te komen. Een meter die alleen op de echte boom draait, is een
   meter die je nooit hebt zien uitslaan (LAT-regel 10). */
function analyse({ vormen, functies, optellingen }, bestandenTel, opties) {
  const O = Object.assign({ envelopDeel: ENVELOP_DEEL, gelijkenis: GELIJKENIS, envelopVanaf: null }, opties || {});

  const domeinenMetVorm = new Set(vormen.map(v => domeinVan(v.module)));
  const alleDomeinen = new Set(functies.map(f => domeinVan(f.module)));

  /* De envelop, gemeten over DOMEINEN en niet over vormen -- zie de kop van
     scripts/objectmodel.js voor waarom dat de eerlijke maat is. */
  const inDomeinen = new Map();
  for (const v of vormen) {
    for (const f of v.velden) {
      if (!inDomeinen.has(f)) inDomeinen.set(f, new Set());
      inDomeinen.get(f).add(domeinVan(v.module));
    }
  }
  const drempel = O.envelopVanaf != null ? O.envelopVanaf : Math.max(2, Math.ceil(domeinenMetVorm.size * O.envelopDeel));
  const envelop = [...inDomeinen.entries()].filter(([, s]) => s.size >= drempel).map(([f]) => f).sort();
  const isEnvelop = new Set(envelop);

  const eigen = [...inDomeinen.entries()].filter(([f, s]) => s.size === 1 && !isEnvelop.has(f)).length;
  const nietEnvelop = [...inDomeinen.keys()].filter(f => !isEnvelop.has(f)).length;

  /* A. Vormparen uit VERSCHILLENDE domeinen die na aftrek van de envelop nog
        op elkaar lijken. Dit is de Asset-vraag op alles met een prijs. */
  const zwaar = vormen.map(v => ({ module: v.module, domein: domeinVan(v.module),
    kern: new Set(v.velden.filter(f => !isEnvelop.has(f))) })).filter(v => v.kern.size >= MIN_VELDEN);
  const paren = [];
  for (let i = 0; i < zwaar.length; i++) {
    for (let j = i + 1; j < zwaar.length; j++) {
      const a = zwaar[i], b = zwaar[j];
      if (a.domein === b.domein) continue;
      let snee = 0;
      for (const f of a.kern) if (b.kern.has(f)) snee++;
      if (!snee) continue;
      const gelijk = snee / (a.kern.size + b.kern.size - snee);
      if (gelijk >= O.gelijkenis) paren.push({ gelijkenis: Number(gelijk.toFixed(2)),
        a: a.module, b: b.module, domeinA: a.domein, domeinB: b.domein,
        gedeeld: [...a.kern].filter(f => b.kern.has(f)).sort() });
    }
  }
  paren.sort((x, y) => y.gelijkenis - x.gelijkenis || y.gedeeld.length - x.gedeeld.length);

  /* B. De acht werkwoorden per KOOPBAAR-domein. De functienamen van alle
        bestanden van een domein worden samengevoegd: een domein dat zijn werk
        over vier bestanden verdeelt, is een domein en geen vier. */
  const namenPerDomein = new Map();
  for (const f of functies) {
    const d = domeinVan(f.module);
    if (!namenPerDomein.has(d)) namenPerDomein.set(d, new Set());
    for (const n of f.namen) namenPerDomein.get(d).add(n);
  }
  const matrix = [...domeinenMetVorm].sort().map(d => {
    const namen = namenPerDomein.get(d) || new Set();
    const heeft = {}, bewijs = {};
    for (const w of WERKWOORD_NAMEN) {
      const raak = [...namen].filter(n => WERKWOORDEN[w].test(n));
      heeft[w] = raak.length > 0;
      if (raak.length) bewijs[w] = raak.sort()[0];
    }
    return { domein: d, heeft, bewijs, telt: WERKWOORD_NAMEN.filter(w => heeft[w]).length };
  }).sort((a, b) => b.telt - a.telt || a.domein.localeCompare(b.domein));

  const perWerkwoord = {};
  for (const w of WERKWOORD_NAMEN) perWerkwoord[w] = matrix.filter(r => r.heeft[w]).length;
  const overalAanwezig = WERKWOORD_NAMEN.filter(w => perWerkwoord[w] === matrix.length);
  const volledig = matrix.filter(r => r.telt === WERKWOORD_NAMEN.length);
  /* De verdeling van de subsets: hoeveel VERSCHILLENDE combinaties van
     werkwoorden komen er voor? Een protocol is pas een protocol als de domeinen
     dezelfde combinatie hebben. Twintig domeinen met achttien verschillende
     combinaties is achttien protocollen. */
  const combinaties = new Set(matrix.map(r => WERKWOORD_NAMEN.filter(w => r.heeft[w]).join('+')));

  /* C. De winkelwagens: vormen met regels (een aantal NAAST een bedrag). */
  const wagens = vormen.filter(v => v.velden.some(f => AANTALVELD.test(f)))
    .map(v => ({ module: v.module, domein: domeinVan(v.module),
      kern: v.velden.filter(f => !isEnvelop.has(f)).sort() }));
  const wagenDomeinen = new Set(wagens.map(w => w.domein));
  const wagenVormen = new Set(wagens.map(w => w.kern.join(',')));

  /* D. De optellingen, per domein. */
  const optelDomeinen = new Map();
  for (const o of optellingen) {
    const d = domeinVan(o.module);
    if (!optelDomeinen.has(d)) optelDomeinen.set(d, []);
    optelDomeinen.get(d).push(o.module);
  }

  return {
    gemeten: {
      bestanden: bestandenTel != null ? bestandenTel : new Set(functies.map(f => f.module)).size,
      domeinenTotaal: alleDomeinen.size,
      koopbareVormen: vormen.length,
      koopbareDomeinen: domeinenMetVorm.size,
      envelopDrempel: drempel,
      envelop: envelop.length,
      veldenDomeineigen: eigen,
      veldenNietEnvelop: nietEnvelop,
      gelijkendeVormparen: paren.length,
      werkwoordenVolledig: volledig.length,
      werkwoordenOveral: overalAanwezig.length,
      werkwoordCombinaties: combinaties.size,
      wagenVormen: wagens.length,
      wagenVormenUniek: wagenVormen.size,
      wagenDomeinen: wagenDomeinen.size,
      optellingen: optellingen.length,
      optelDomeinen: optelDomeinen.size
    },
    envelop,
    perWerkwoord,
    overalAanwezig,
    /* De matrix gaat ONGEKORT mee, anders dan de vormparen. Hij stond op de
       eerste veertig rijen en toen viel kern/retail eruit -- het domein met de
       varianten, de SKU's en de voorraad, dus juist het domein waar iedereen
       naar kijkt als hij "webshop" zegt. Een afkapping die de belangrijkste rij
       weglaat, maakt van bewijs een selectie. Hij is begrensd door het aantal
       koopbare domeinen (99) en dus niet het soort lijst dat ontspoort; de
       vormparen zijn dat wel, en die blijven wel gekort. */
    matrix,
    paren: paren.slice(0, 25),
    wagens: [...wagenDomeinen].sort(),
    optelling: [...optelDomeinen.entries()].sort((a, b) => b[1].length - a[1].length)
      .slice(0, 25).map(([d, mods]) => ({ domein: d, plekken: mods.length, waar: mods.slice(0, 4) }))
  };
}

function meet() { const g = lees(); return analyse(g, g.bestanden); }

module.exports = { meet, lees, analyse, vormenVan, functiesVan, isOptelling, WERKWOORDEN, WERKWOORD_NAMEN };

if (require.main === module) {
  const r = meet();
  const g = r.gemeten;
  if (process.argv.includes('--json')) { console.log(JSON.stringify(r)); process.exit(0); }
  if (process.argv.includes('--vastleggen')) {
    fs.writeFileSync(path.join(WORTEL, 'COMMERCE.json'), JSON.stringify(Object.assign({
      uitleg: 'Gemeten met scripts/commerce.js; de vraag en de methode staan in de kop van dat bestand en in COMMERCE.md par. 1. De meting is met opzet royaal: zij maakt Koopbaar rijker dan hij is, zodat een negatieve uitslag zwaar weegt. Een gedeelde NAAM is geen gedeelde BETEKENIS.',
      vastgelegd: new Date().toISOString().slice(0, 10)
    }, r), null, 2) + '\n');
    console.log('COMMERCE.json geschreven.');
  }
  console.log('\n  BESTAAT KOOPBAAR?\n');
  console.log('  ' + g.koopbareVormen + ' vormen met een prijsveld, in ' + g.koopbareDomeinen + ' van ' + g.domeinenTotaal + ' domeinen (' + g.bestanden + ' bestanden).');
  console.log('  ' + g.envelop + ' velden zijn ENVELOP (in ' + g.envelopDrempel + '+ domeinen); daarna houden ' + g.veldenNietEnvelop + ' velden over,');
  console.log('  waarvan ' + g.veldenDomeineigen + ' in PRECIES EEN domein voorkomen (' + Math.round(g.veldenDomeineigen / Math.max(1, g.veldenNietEnvelop) * 100) + '%).');
  console.log('  ' + g.gelijkendeVormparen + ' vormparen uit verschillende domeinen halen ' + Math.round(GELIJKENIS * 100) + '%+ overlap na aftrek van de envelop.\n');

  console.log('  DE ACHT WERKWOORDEN\n');
  for (const w of WERKWOORD_NAMEN) {
    const n = r.perWerkwoord[w];
    const deel = Math.round(n / Math.max(1, g.koopbareDomeinen) * 100);
    console.log('    ' + w.padEnd(16) + String(n).padStart(3) + ' van ' + g.koopbareDomeinen + '  (' + String(deel).padStart(3) + '%)  ' + '#'.repeat(Math.round(deel / 4)));
  }
  console.log('');
  console.log('  ' + g.werkwoordenVolledig + ' domeinen voeren ALLE ACHT werkwoorden uit.');
  console.log('  ' + g.werkwoordenOveral + ' werkwoorden staan in ALLE koopbare domeinen' + (r.overalAanwezig.length ? ': ' + r.overalAanwezig.join(' ') : '.'));
  console.log('  ' + g.werkwoordCombinaties + ' verschillende combinaties van werkwoorden over ' + g.koopbareDomeinen + ' domeinen.\n');

  console.log('  DE WINKELWAGENS EN DE OPTELLINGEN\n');
  console.log('  ' + g.wagenVormen + ' vormen dragen REGELS (een aantal naast een bedrag), in ' + g.wagenDomeinen + ' domeinen,');
  console.log('  met ' + g.wagenVormenUniek + ' verschillende vormen. Delen ze een vorm, dan liggen die twee getallen dicht bijeen.');
  console.log('  ' + g.optellingen + ' plekken in ' + g.optelDomeinen + ' domeinen tellen regels op tot een totaal.\n');

  if (r.paren.length) {
    console.log('  KOOPBARE VORMEN DIE ECHT OP ELKAAR LIJKEN\n');
    for (const p of r.paren.slice(0, 8)) {
      console.log('    ' + p.gelijkenis + '  ' + p.domeinA + '  ' + p.a);
      console.log('          ' + p.domeinB + '  ' + p.b);
      console.log('          gedeeld: ' + p.gedeeld.join(' '));
    }
    console.log('');
  } else {
    console.log('  GEEN ENKEL koopbaar vormpaar uit verschillende domeinen haalt de drempel.');
    console.log('  Dat is een antwoord: wat een prijs draagt deelt zijn verpakking en verder niets.\n');
  }
}
