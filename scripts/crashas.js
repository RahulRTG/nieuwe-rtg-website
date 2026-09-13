#!/usr/bin/env node
/* ============================================================================
   DE CRASH-AS OVER DE GELDROUTES -- welke crashgrenzen BESTAAN er per route.

   WAAROM DIT EERST KOMT EN HET BEPROEVEN DAARNA. De verleiding is om de zes
   grenzen uit ./lib/crashtaxonomie.js over 45 routes heen te draaien en te
   tellen wat er groen wordt. Dat levert 270 uitslagen waarvan de meeste niets
   betekenen: een route die geen aanbieder aanroept, kan onmogelijk zakken op
   `providercommit-zonder-antwoord`, en een groen vinkje daar leest als bewijs
   terwijl het een afwezigheid is. Eerst de vraag welke grenzen er ECHT zijn,
   dan pas de vraag of ze gehouden worden.

   DIT SCRIPT VELT DUS GEEN OORDEEL OVER DE CODE. Het zegt per (route, grens):
   bestaat hij, waarom denken we dat, en hoe hard is dat -- en apart daarvan of
   er uberhaupt een instrument is om hem te beproeven. Die twee worden met opzet
   niet samengevoegd: "bestaat niet" en "kan niet gemeten worden" zijn
   verschillende dingen, en wie ze optelt krijgt een dekkingscijfer dat stijgt
   doordat er minder te meten valt.

   DE DRIE UITSLAGEN VAN `bestaat` ZIJN GESLOTEN: ja, nee, onbekend. Er komt
   geen vierde bij, en `onbekend` is met opzet geen `nee` -- dat is dezelfde
   regel die kern/stuur/gevolg.js afdwingt, waar "de proef kwam er niet bij"
   nooit "er gebeurt niets" mag gaan heten.

   DE GRAAD KOMT UIT BESTUUR.md EN IS GEEN NIEUWE LADDER: onbekend, vermoed,
   gemeten, bewezen. Een classificatie uit een GEMETEN collectie-lijst draagt
   `gemeten`; een classificatie uit het lezen van een bronbestand draagt
   `vermoed`, want een routebestand delegeert naar de kern via de contexttas en
   die weg is statisch niet te volgen (CODE.md par. over het contextobject).

   BRONNEN, en alle vier zijn het registers of code en geen aannames:
     GELDDEKKING.json        de 45 geldroutes, met de collecties die de
                             idempotentieproef ze werkelijk zag aanraken
     lib/crashtaxonomie.js   de gesloten lijst van zes grenzen
     server/lib/verraad.js   welke crashmomenten een INGEBOUWD injectiepunt
                             hebben -- een grens zonder injectiepunt is niet
                             te beproeven, hoe graag je ook wilt
     FACTUURPROEF.json       de enige route waar er al aan een grens is gemeten

   Draaien:  npm run crashas              (print)
             npm run crashas -- --json    (register op stdout)
             npm run crashas -- --vastleggen
   ========================================================================== */
'use strict';

const fs = require('fs');
const path = require('path');

const WORTEL = path.join(__dirname, '..');
const tax = require('./lib/crashtaxonomie.js');
const lees = (naam) => JSON.parse(fs.readFileSync(path.join(WORTEL, naam), 'utf8'));

const jsonUit = process.argv.includes('--json');
const vastleggen = process.argv.includes('--vastleggen');

/* ---------------------------------------------------------------------------
   WELKE GRENZEN HEBBEN EEN INJECTIEPUNT.

   De catalogus in server/lib/verraad.js zet bij elk verraad `waar` het is
   INGEBOUWD, en `waar: null` betekent ontworpen maar niet gebouwd. Die
   eerlijkheid is hier goud waard: zonder injectiepunt kan een grens niet
   beproefd worden, en dan is elke uitslag erover een mening.

   De koppeling grens -> verraad staat HIER en niet in verraad.js, want die
   catalogus gaat over veel meer dan crashes (een trage afhankelijkheid, een
   oude cache) en hoort niets van deze as te weten.
   --------------------------------------------------------------------------- */
const INJECTIE = {
  'voor-eerste-mutatie': { verraad: null,
    waarom: 'er is geen verraad dat het proces doodt VOORDAT de eerste mutatie is geschreven; ' +
      'sterf-na-commit slaat per definitie te laat toe' },
  'in-de-opslag': { verraad: null,
    waarom: 'schrijf-faalt en schrijf-verloren bootsen een MISLUKTE schrijfactie na, niet een ' +
      'proces dat midden IN de schrijfactie sterft -- dat is een ander moment' },
  /* De plek staat hier BEWUST zonder de functienaam erin. Keuringsregel 47
     bewaakt wie aan de duurzame commit komt, strippt commentaar maar houdt
     STRINGS -- en dit veld is een string. De naam hier voluit schrijven zet dit
     meetscript op de lijst van plekken die duurzaam schrijven, terwijl het
     niets schrijft; de kop van die regel waarschuwt zelf dat de lijst dan
     "leest als dekking die er niet is". Wie de precieze naam zoekt, vindt hem
     in server/lib/verraad.js, waar hij wel een verwijzing is die iets doet. */
  'na-commit-voor-antwoord': { verraad: 'sterf-na-commit',
    waarom: 'ingebouwd in server/db/index.js, in de duurzame commit zelf: na de bevestigde ' +
      'schrijfactie en voor het antwoord' },
  'na-commit-voor-bericht': { verraad: null,
    waarom: 'er is geen haak tussen de commit en het versturen van het bericht' },
  'providercommit-zonder-antwoord': { verraad: null,
    waarom: 'vraagt een aanbieder die commit en dan zwijgt; server/betaal/synthetisch.js kan ' +
      'wel `traag` en `terugboeking`, maar niet vanuit een HTTP-route worden gestuurd' },
  'ambigu-extern-resultaat': { verraad: null,
    waarom: 'vraagt een aanbieder met een onbesliste uitkomst' }
};

/* Is er in deze installatie uberhaupt een aanbieder? server/betaal.js weigert
   fail-closed zonder echte provider ("Geen betaalprovider actief"), en de
   synthetische rail draait alleen achter RTG_SIMULATIEBANK en nooit naast een
   echte. Zolang dat zo is, bestaan de twee externe grenzen niet -- niet als
   tekortkoming maar als toestand, en de toestand staat erbij zodat hij kan
   omslaan zodra er wel een provider hangt. */
const AANBIEDER_ACTIEF = false;
const AANBIEDER_GROND = 'server/betaal.js weigert fail-closed zonder echte provider ' +
  '("Geen betaalprovider actief"); de synthetische rail draait alleen achter RTG_SIMULATIEBANK ' +
  'en nooit naast een echte. Zonder aanbieder is er geen providercommit om het antwoord van te ' +
  'verliezen.';

/* De bakken waarin dit huis een bericht aan een mens vastlegt. Staat er een in
   de GEMETEN collecties van een route, dan stuurt die route aantoonbaar een
   bericht en bestaat `na-commit-voor-bericht`. Staat er geen, dan is dat GEEN
   bewijs van het tegendeel -- de idempotentieproef hoeft de berichtweg niet te
   hebben geraakt. */
const BERICHTBAKKEN = new Set(['meldingen', 'notificaties', 'notifications', 'berichten',
  'mailUit', 'smsUit', 'postvak', 'meldAan']);

const VERDICT = { JA: 'ja', NEE: 'nee', ONBEKEND: 'onbekend' };

/* ---------------------------------------------------------------------------
   DE CLASSIFICATIE PER ROUTE.
   --------------------------------------------------------------------------- */
function schrijftDezeRoute(rij) {
  const n = Array.isArray(rij.collecties) ? rij.collecties.length : 0;
  if (n > 0) return { schrijft: true, n, graad: 'gemeten',
    grond: 'de idempotentieproef zag deze route ' + n + ' collectie(s) aanraken: ' + rij.collecties.join(', ') };
  if (rij.semantiek === 'leest') return { schrijft: false, n: 0, graad: 'gemeten',
    grond: 'verklaard als `leest`: een POST die niets muteert' };
  return { schrijft: null, n: 0, graad: 'onbekend',
    grond: 'de idempotentieproef mat geen collecties voor deze route (idempotentie: ' +
      (rij.idempotentie || 'onbekend') + '), dus of er iets geschreven wordt is hier niet vast te stellen' };
}

function classificeer(rij) {
  const w = schrijftDezeRoute(rij);
  const uit = {};

  /* De drie INTERNE grenzen die aan een schrijfactie hangen. Ze vallen samen in
     hun voorwaarde -- is er iets te muteren -- en niet in hun moment. Dat is de
     hele reden dat het er drie zijn en geen een. */
  for (const g of ['voor-eerste-mutatie', 'in-de-opslag', 'na-commit-voor-antwoord']) {
    uit[g] = w.schrijft === true
      ? { bestaat: VERDICT.JA, graad: w.graad, grond: w.grond }
      : w.schrijft === false
        ? { bestaat: VERDICT.NEE, graad: w.graad, grond: w.grond }
        : { bestaat: VERDICT.ONBEKEND, graad: 'onbekend', grond: w.grond };
  }

  /* `in-de-opslag` verdient een eigen aantekening zodra er MEER dan een
     collectie bij betrokken is: dan is een half geschreven uitkomst niet alleen
     denkbaar maar samengesteld uit meerdere bakken, en is de vraag of de bundel
     ze samen duurzaam maakt. Bij een enkele bak gaat het alleen over de
     atomiciteit van de opslag zelf. */
  if (uit['in-de-opslag'].bestaat === VERDICT.JA) {
    uit['in-de-opslag'].vorm = w.n > 1 ? 'samengesteld (' + w.n + ' collecties)' : 'enkelvoudig (1 collectie)';
  }

  /* De berichtgrens. */
  const bericht = (rij.collecties || []).filter(c => BERICHTBAKKEN.has(c));
  uit['na-commit-voor-bericht'] = bericht.length
    ? { bestaat: VERDICT.JA, graad: 'gemeten',
      grond: 'de gemeten collecties bevatten een berichtbak: ' + bericht.join(', ') }
    : { bestaat: VERDICT.ONBEKEND, graad: 'onbekend',
      grond: 'in de gemeten collecties staat geen berichtbak, maar dat bewijst niets: de ' +
        'idempotentieproef hoeft de berichtweg niet te hebben geraakt, en een routebestand ' +
        'delegeert naar de kern via de contexttas -- die weg is statisch niet te volgen' };

  /* De twee EXTERNE grenzen. */
  for (const g of ['providercommit-zonder-antwoord', 'ambigu-extern-resultaat']) {
    uit[g] = AANBIEDER_ACTIEF
      ? { bestaat: VERDICT.ONBEKEND, graad: 'onbekend', grond: 'er hangt een aanbieder; per route moet nog worden vastgesteld of hij die aanroept' }
      : { bestaat: VERDICT.NEE, graad: 'gemeten', grond: AANBIEDER_GROND,
        wordtRelevantAls: 'er een echte betaalprovider is aangesloten' };
  }
  return uit;
}

/* ---------------------------------------------------------------------------
   WAT ER AL GEMETEN IS. Vandaag is dat een route en een grens; dat staat hier
   zodat het register niet alleen zegt wat er BESTAAT maar ook wat ervan
   BEWEZEN is -- en zodat het verschil tussen die twee een getal wordt.
   --------------------------------------------------------------------------- */
function gemetenUitslagen() {
  const uit = {};
  try {
    const f = lees('FACTUURPROEF.json');
    const route = f.route || 'POST /api/pay/saldo';
    const g = (f.crash && f.crash.grenzen) || {};
    for (const [grens, stand] of Object.entries(g)) {
      uit[route] = uit[route] || {};
      uit[route][grens] = { stand, instrument: 'scripts/factuurproef.js', op: f.gemetenOp || null };
    }
  } catch (e) { /* geen proef, geen uitslagen */ }
  return uit;
}

function meet() {
  const geld = lees('GELDDEKKING.json');
  const rijen = geld.rijen || [];
  const gemeten = gemetenUitslagen();
  const grenzen = Object.keys(tax.GRENZEN);

  const per = rijen.map(rij => {
    const route = rij.methode + ' ' + rij.pad;
    const k = classificeer(rij);
    for (const g of grenzen) {
      const m = gemeten[route] && gemeten[route][g];
      k[g].uitslag = m ? m.stand : null;
      k[g].instrument = m ? m.instrument : null;
      k[g].meetbaar = INJECTIE[g].verraad ? INJECTIE[g].verraad : false;
      if (!INJECTIE[g].verraad) k[g].nietMeetbaarOmdat = INJECTIE[g].waarom;
    }
    return { route, rol: rij.rol, semantiek: rij.semantiek, collecties: rij.collecties || [], grenzen: k };
  });

  /* DE TELLING, en met opzet geen samengesteld cijfer. Drie vragen, drie
     getallen: hoeveel (route, grens)-paren BESTAAN er, hoeveel daarvan zijn te
     BEPROEVEN, en hoeveel zijn er werkelijk GEMETEN. Een percentage over die
     eerste twee samen zou stijgen zodra er minder te meten valt. */
  const t = { routes: per.length, paren: per.length * grenzen.length,
    bestaat: 0, bestaatNiet: 0, onbekend: 0, meetbaar: 0, gemeten: 0, perGrens: {} };
  for (const g of grenzen) t.perGrens[g] = { bestaat: 0, bestaatNiet: 0, onbekend: 0, meetbaar: 0, gemeten: 0 };
  for (const r of per) for (const g of grenzen) {
    const c = r.grenzen[g];
    const vak = c.bestaat === VERDICT.JA ? 'bestaat' : c.bestaat === VERDICT.NEE ? 'bestaatNiet' : 'onbekend';
    t[vak]++; t.perGrens[g][vak]++;
    if (c.bestaat === VERDICT.JA && c.meetbaar) { t.meetbaar++; t.perGrens[g].meetbaar++; }
    if (c.uitslag) { t.gemeten++; t.perGrens[g].gemeten++; }
  }
  return {
    soort: 'meting', instrument: 'scripts/crashas.js',
    uitleg: 'Per geldroute en per crashgrens: BESTAAT die grens hier, hoe hard weten we dat, ' +
      'en is hij te beproeven. Dit is een classificatie en geen oordeel over de code.',
    grens: 'Bestaan en meetbaarheid worden nooit opgeteld. Een grens die niet bestaat is geen ' +
      'bewezen grens, en een grens zonder injectiepunt is niet weerlegd maar ongemeten.',
    bronnen: ['GELDDEKKING.json', 'scripts/lib/crashtaxonomie.js', 'server/lib/verraad.js', 'FACTUURPROEF.json'],
    contracten: tax.CONTRACTEN, grenzen: tax.GRENZEN, injectiepunten: INJECTIE,
    aanbieder: { actief: AANBIEDER_ACTIEF, grond: AANBIEDER_GROND },
    gemetenOp: new Date().toISOString(), telling: t, per
  };
}

function toon(u) {
  const t = u.telling;
  console.log('\n\x1b[1mDE CRASH-AS OVER DE GELDROUTES\x1b[0m \x1b[2m(classificatie, geen oordeel)\x1b[0m\n');
  console.log('  geldroutes                 : ' + t.routes);
  console.log('  (route, grens)-paren       : ' + t.paren);
  console.log('  daarvan BESTAAT de grens   : ' + t.bestaat);
  console.log('  bestaat NIET (met reden)   : ' + t.bestaatNiet);
  console.log('  ONBEKEND                   : ' + t.onbekend);
  console.log('  bestaand EN te beproeven   : ' + t.meetbaar);
  console.log('  werkelijk gemeten          : ' + t.gemeten + '\n');
  const b = (n, van) => String(n).padStart(3) + '/' + String(van).padEnd(3);
  for (const [g, c] of Object.entries(t.perGrens)) {
    const inj = INJECTIE[g].verraad;
    console.log('  ' + g.padEnd(32) + 'bestaat ' + b(c.bestaat, t.routes) +
      '  meetbaar ' + b(c.meetbaar, t.routes) + '  gemeten ' + b(c.gemeten, t.routes) +
      (inj ? '  \x1b[2m(' + inj + ')\x1b[0m' : '  \x1b[2m(geen injectiepunt)\x1b[0m'));
  }
  console.log('\n  \x1b[2mWat hier NIET staat: of een bestaande grens ook GEHOUDEN wordt. Daarvoor is');
  console.log('  een injectiepunt nodig, en dat is er vandaag voor een van de zes.\x1b[0m\n');
}

function schrijf(u) {
  const { stempel } = require('./lib/stempel.js');
  const reg = Object.assign({ stempel: stempel({ instrument: 'scripts/crashas.js' }) }, u);
  fs.writeFileSync(path.join(WORTEL, 'CRASHAS.json'), JSON.stringify(reg, null, 2) + '\n');
}

/* ALLEEN DRAAIEN ALS HIJ WORDT AANGEROEPEN, en niet bij het importeren. Zonder
   deze wacht print een `require('./crashas.js')` de hele tabel -- en erger: een
   toets die de classificatie wil narekenen, draait dan de meting mee. */
if (require.main === module) {
  const u = meet();
  if (jsonUit) console.log(JSON.stringify(u, null, 2));
  else toon(u);
  if (vastleggen) { schrijf(u); if (!jsonUit) console.log('  CRASHAS.json geschreven.\n'); }
}

module.exports = { classificeer, meet, INJECTIE, BERICHTBAKKEN, VERDICT, AANBIEDER_ACTIEF };
