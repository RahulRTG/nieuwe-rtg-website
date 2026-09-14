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
  'voor-eerste-mutatie': { verraad: 'sterf-voor-mutatie',
    waarom: 'ingebouwd in server/db/bijeen.js, voor fn() van de buitenste bundel: op dat punt ' +
      'staat vast dat er nog niets is gemuteerd' },
  /* GEMETEN EN NIET AANGENOMEN. scripts/crashgrenzen.js liep dit geldpad met
     een dood tussen de schrijfopdracht en de checkpoint, en kreeg exact de
     uitkomst van sterf-na-commit terug: de betaling stond vast. De oorzaak
     staat in db/sqlite.js -- `BEGIN IMMEDIATE ... COMMIT` maakt de save EEN
     transactie. Er is geen middelpunt om in te sterven, dus deze grens BESTAAT
     hier niet; zie het `nee` dat classificeer() eraan geeft. */
  'in-de-opslag': { verraad: null,
    waarom: 'de opslag is transactioneel (BEGIN IMMEDIATE ... COMMIT in db/sqlite.js), dus er is ' +
      'geen waarneembaar moment MIDDENIN de schrijfactie om in te sterven' },
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

/* ============================================================================
   HET GEMETEN UITVOERINGSPAD -- en waarom dit register hier gelezen wordt.

   Deze classificatie leidde `bestaat` af uit een enkel gegeven: schrijft deze
   route collecties? Zo ja, dan bestaan de twee duurzame crashgrenzen. Dat is
   over-claimen, en scripts/crashproef.js heeft het weerlegd door de routes
   werkelijk te laten sterven: EENENVEERTIG van de negentig rijen komen langs
   geen van beide injectiepunten, omdat die routes met de gewone write-behind
   save() schrijven (na te lezen in server/kern/bank/passen.js). De grens hangt
   dus niet aan "schrijft hij" maar aan WELKE SCHRIJFWEG hij neemt -- de vierde
   as uit crashtaxonomie.js, en die is niet af te leiden.

   Daarom leest deze module CRASHPROEF.json. Geen kringloop: die proef leest
   GELDDEKKING.json en nooit dit register.

   ZONDER REGISTER VALT HIJ TERUG OP `onbekend` EN NIET OP DE OUDE AANNAME. Dat
   is het hele punt: de oude aanname was fout, dus hem gebruiken als terugval
   zou de fout op elke machine zonder meting terugzetten. */
const CRASHPROEF = (() => {
  try {
    const j = JSON.parse(fs.readFileSync(path.join(WORTEL, 'CRASHPROEF.json'), 'utf8'));
    const op = new Map();
    for (const r of j.per || []) op.set(r.methode + ' ' + r.pad + ' ' + r.grens, r.stand);
    return { op, stempel: j.stempel };
  } catch (e) { return { op: new Map(), stempel: null }; }
})();

/* Wat zegt de PROEF over deze route en deze grens? Drie uitkomsten die alle
   drie iets anders betekenen, en die nooit mogen samenvallen. */
function padOordeel(rij, grens) {
  const stand = CRASHPROEF.op.get(rij.methode + ' ' + rij.pad + ' ' + grens);
  if (stand === 'PROVEN' || stand === 'FAILED') return { bestaat: VERDICT.JA, graad: 'gemeten',
    grond: 'scripts/crashproef.js heeft deze grens werkelijk geraakt op deze route (' + stand + ')' };
  if (stand === 'GEEN_DUURZAME_WEG') return { bestaat: VERDICT.NEE, graad: 'gemeten',
    grond: 'gemeten met scripts/crashproef.js: de route deed zijn werk en het proces bleef leven, ' +
      'dus hij loopt langs geen van beide injectiepunten (de duurzame bundel, de duurzame ' +
      'commit) -- hij schrijft met de gewone ' +
      'write-behind save(), en die kent dit moment niet',
    wordtRelevantAls: 'deze route zijn schrijfweg naar een duurzame bundel verlegt. Wat hem NU ' +
      'bedreigt is een verloren schrijfactie, en dat is `schrijf-verloren` en niet deze grens' };
  return null;
}

function classificeer(rij) {
  const w = schrijftDezeRoute(rij);
  const uit = {};

  /* De INTERNE grenzen die aan een schrijfactie hangen. Ze vallen samen in hun
     voorwaarde -- is er iets te muteren -- en niet in hun moment. Dat is de hele
     reden dat het er meer dan een zijn.

     `in-de-opslag` staat hier NIET meer bij, en dat is een meetuitslag en geen
     vereenvoudiging: de opslag is transactioneel, dus dat moment bestaat niet.
     Hij krijgt hieronder een eigen `nee` met de grond erbij. */
  for (const g of ['voor-eerste-mutatie', 'na-commit-voor-antwoord']) {
    /* Schrijft de route aantoonbaar NIETS, dan bestaat de grens niet -- dat is
       geen aanname maar het ontbreken van een mutatie. */
    if (w.schrijft === false) { uit[g] = { bestaat: VERDICT.NEE, graad: w.graad, grond: w.grond }; continue; }
    /* Anders beslist de PROEF, en niet de gevolgtrekking uit "hij schrijft". */
    const gemeten = padOordeel(rij, g);
    if (gemeten) { uit[g] = gemeten; continue; }
    /* Geen proefuitslag voor dit paar. Dat is `onbekend` en nadrukkelijk niet
       het oude `ja`: dat de route schrijft, zegt niets over de weg waarlangs. */
    uit[g] = { bestaat: VERDICT.ONBEKEND, graad: 'onbekend',
      grond: w.schrijft === true
        ? 'de route schrijft aantoonbaar (' + w.grond + '), maar scripts/crashproef.js kreeg hem ' +
          'niet aan het werk, dus welke SCHRIJFWEG hij neemt is niet gemeten -- en daarvan hangt af ' +
          'of deze grens op zijn pad ligt'
        : w.grond };
  }

  /* `in-de-opslag` BESTAAT HIER NIET, en dat is gemeten. De vraag was of een
     half geschreven uitkomst mogelijk is -- bij meer dan een collectie klinkt
     dat waarschijnlijk. Het antwoord is nee, en niet omdat het onwaarschijnlijk
     is maar omdat db/sqlite.js alle collecties in EEN transactie wegschrijft:
     hij commit heel of rolt heel terug. scripts/crashgrenzen.js heeft dat
     nagemeten door er een dood in te injecteren en exact de uitkomst van
     sterf-na-commit terug te krijgen.

     Het aantal collecties staat er wel bij: op een opslag die WEL kan scheuren
     is dat het getal dat het risico bepaalt, en dan is dit `nee` niet langer
     waar. */
  uit['in-de-opslag'] = { bestaat: VERDICT.NEE, graad: 'gemeten',
    grond: 'de opslag is transactioneel: db/sqlite.js schrijft met `BEGIN IMMEDIATE ... COMMIT`, ' +
      'dus de save commit heel of rolt heel terug. Nagemeten met scripts/crashgrenzen.js: een dood ' +
      'tussen de schrijfopdracht en de checkpoint gaf exact de uitkomst van sterf-na-commit.',
    collecties: w.n,
    wordtRelevantAls: 'de opslag kan scheuren -- de json-stand schrijft een tijdelijk bestand en ' +
      'hernoemt het, en daartussen bestaat het moment wel' };

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
  const zet = (route, grens, stand, instrument, op) => {
    uit[route] = uit[route] || {};
    uit[route][grens] = { stand, instrument, op: op || null };
  };
  try {
    const f = lees('FACTUURPROEF.json');
    const route = f.route || 'POST /api/pay/saldo';
    const g = (f.crash && f.crash.grenzen) || {};
    for (const [grens, stand] of Object.entries(g))
      zet(route, grens, stand, 'scripts/factuurproef.js', f.gemetenOp);
  } catch (e) { /* geen proef, geen uitslagen */ }

  /* DE CRASHPROEF TELT OOK MEE, en die toevoeging is een reparatie van de
     andere kant. Toen deze module `bestaat` ging lezen uit CRASHPROEF.json,
     stond `gemeten` er nog op 0 terwijl diezelfde proef vier grenzen werkelijk
     had geraakt. Een register dat zijn eigen bron half leest, onderschat wat er
     bekend is -- en dat is net zo onwaar als overschatten.

     Alleen PROVEN en FAILED tellen als GEMETEN: bij die twee is de grens
     werkelijk geraakt. GEEN_DUURZAME_WEG is een uitspraak over de schrijfweg en
     geen meting AAN de grens, en GEEN_WERK is helemaal niets. Zouden die
     meetellen, dan telde "de proef kwam er niet bij" als bewijs. */
  try {
    const c = lees('CRASHPROEF.json');
    for (const r of c.per || [])
      if (r.stand === 'PROVEN' || r.stand === 'FAILED')
        zet(r.methode + ' ' + r.pad, r.grens, r.stand, 'scripts/crashproef.js',
          c.stempel && c.stempel.op);
  } catch (e) { /* geen crashproef, geen uitslagen */ }
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
    bronnen: ['GELDDEKKING.json', 'scripts/lib/crashtaxonomie.js', 'server/lib/verraad.js', 'FACTUURPROEF.json', 'CRASHPROEF.json'],
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
