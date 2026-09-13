#!/usr/bin/env node
/* ============================================================================
   MACHINEDEKKING -- hoeveel van de eigen machinerie raakt een handeling?

   DE VRAAG DIE HIERONDER LIGT, en zij is een andere dan alle bestaande meters
   stellen. Dit huis heeft zestien motoren gebouwd die samen een programmeermodel
   voor betrouwbare handelingen vormen: een deur die een mens eist, een mandaat
   dat versmalt, een bewijstoken dat meereist, een voornemen dat het TOTAAL weegt
   voor de eerste stap, een tegenfeit, een frictieweging, een envelop met
   oorzaak, een idempotentiepoort, een atomaire schrijflaan, een hashketen, een
   gevolgmeting, een schaduwstand. Elke motor is apart gemeten (KANTOORMACHT,
   IDEMPROEF, HERSTEL, VERTROUWEN, EXECUTION_MAP). Wat NIEMAND meet is of ze bij
   dezelfde handeling langskomen.

   Dat is precies het verschil tussen zestien organen en een machine. Een route
   die de envelop draagt maar geen bewijs, en een route die bewijs draagt maar
   geen envelop, tellen in de bestaande registers ieder als een halve overwinning
   -- en in werkelijkheid is er geen enkele handeling die de keten heeft gelopen.
   Deze meter telt per handeling hoeveel assen hij raakt, en dus ook hoeveel
   handelingen NUL assen raken.

   WAT HIJ NIET IS. Geen keurcijfer. BEWIJSMACHINE.md verbiedt het enkele getal
   boven een bewijs-scorecard, en om dezelfde reden staat hier nergens
   "integratie 15/15" als poort: een samengesteld cijfer verbergt WELKE as
   ontbreekt, en juist die naam is het werk. Het aantal assen per route staat er
   als VERDELING, de poort hangt aan twee absolute getallen (zie --controle).

   TWEE ASSEN DIE VERSCHILLENDE DINGEN MISSEN, EN ZE WORDEN NOOIT OPGETELD.
   Dat is de kern van de methode, en de vorm komt uit KANTOORMACHT.json: twee
   ondergrenzen die verschillende dingen missen, geven samen geen bovengrens.

     handler   de as is geraakt binnen de TEKST van deze handler (van zijn
               app.post-regel tot de volgende route in hetzelfde bestand).
               MIST: een aanroep via een hulpfunctie elders in het bestand, en
               alles wat via de kern-tas gaat.
     bestand   de as is geraakt in het routebestand zelf of in een bestand dat
               het RECHTSTREEKS requiret. VANGT de hulpfunctie, maar markeert
               alle routes in hetzelfde bestand -- en MIST nog steeds de
               kern-tas.

   EN DEZELFDE HUB SLOEG TWEE KEER TOE, langs de andere kant. `/api/notifications`
   scoorde tien assen -- tot bleek dat die route in server/server.js woont, een
   bestand met 143 requires. Een routebestand dat zelf een hub is, erft op de
   bestandsas het hele huis. Vandaar de HUBGRENS: een bestand met veertig of meer
   requires wordt niet als buur meegerekend, en een route die ZELF in zo'n bestand
   woont krijgt geen bestandsas maar een vermelding in `bestandsasOnbruikbaar`.
   Niet stilletjes een winnaar, en niet stilletjes een nul.

   WAAROM DE KERN-TAS ER NIET IN ZIT, en dat is een vondst van de eerste ronde.
   Eerst rekende de bestandsas ook de module mee die de gebruikte kern-naam heeft
   geleverd. Dat leek de blinde vlek van de require-graaf te dichten en deed het
   omgekeerde: `save` komt uit server/server.js, dat requiret lib/keten, en
   daardoor stonden idempotentie (4162), bewijsketen (4158) en schaduw (4157) op
   bijna elke muterende route. Een hub in de zak markeert de hele boom. Een
   dekkingsgetal dat zo ontstaat leest als een overwinning en betekent niets --
   precies de faalvorm waarvoor CODEWERELD.json zijn teller heeft moeten
   splitsen. De tasas hoort dus per FUNCTIE gemeten te worden en niet per
   module, en tot die er is staat hij niet in deze meter maar in `motoren`, waar
   hij over modules gaat en niet over routes.

   Wie die twee optelt of gemiddelt, maakt een getal dat niets meer meet. Het
   verschil tussen de twee is zelf informatie: staat een as op 200 (bestand) en 2
   (handler), dan hangt hij aan een bestand en niet aan een handeling.

   HET IS EEN PROJECTIE EN NOOIT EEN BRON. Vier assen worden hier niet zelf
   gerekend maar GELEZEN uit EXECUTION_MAP.json, dat ze al bezit (bereik, bewijs,
   herhaling, terugweg). Een tweede plek die hetzelfde zelf telt, zegt op een dag
   iets anders -- dezelfde regel als scripts/getallen.js. De brondigests staan in
   de uitslag, zodat een register dat achterloopt zichtbaar is in plaats van
   stilletjes mee te tellen.

   DE TOKENS WORDEN GEKEURD, en dat is niet kosmetisch. Een as die zijn motor
   herkent aan een woord als `mag` of `reden` markeert de halve boom en zet een
   dekkingsgetal op groen zonder dat er iets is aangesloten. Vandaar de
   breedtekeuring: een token dat in meer dan een kwart van de routebestanden
   voorkomt, wordt AFGEKEURD en staat met naam in `tokenAfgekeurd`. Een as die
   daardoor zonder token overblijft is `ongemeten` met de reden erbij, nooit 0.

   Draaien:  node scripts/machinedekking.js
             node scripts/machinedekking.js --vastleggen
             node scripts/machinedekking.js --controle     (poort: mag alleen dalen)
             node scripts/machinedekking.js --as envelop   (welke routes raken hem)
   ========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');
const { alleRoutes } = require('./lib/routes.js');
const { EIST_MENS } = require('./kantoormacht.js');
/* DE DEFINITIE VAN EEN VOLLEDIGE KETEN KOMT UIT DE CODE EN NIET UIT DEZE METER.
   server/kern/kantoor/geldketen.js bezit de handelingsklassen (welke assen zijn
   verplicht, en waarom een as die NIET verplicht is dat niet is) en de declaratie
   van welke handelingen de baan werkelijk lopen. Een meter die zelf mag bepalen
   wanneer hij tevreden is, meet zijn eigen tevredenheid -- dezelfde regel als
   scripts/getallen.js: de bron is altijd het register, nooit een berekening hier. */
const { KLASSEN, KETENS } = require('../server/kern/kantoor/geldketen.js');

const WORTEL = path.join(__dirname, '..');
const DOEL = path.join(WORTEL, 'MACHINEDEKKING.json');
const K = { rood: '\x1b[31m', groen: '\x1b[32m', geel: '\x1b[33m', grijs: '\x1b[2m', reset: '\x1b[0m' };

/* ---------------------------------------------------------------------------
   DE ASSEN. Per as: welke MOTOR hem bedient, waaraan je hem herkent, en de
   graad. `bron` is het bestand dat de as BEZIT -- staat daar niets meer, dan is
   de as zelf verdwenen en hoort deze meter te zakken (test/machinedekking).

   De tokens zijn met de hand gekozen en dat is een besluit, geen slordigheid:
   afgeleide tokens (alle exports van een module) leverden bij de eerste ronde
   `mag`, `uit`, `grens` en `reden` op, en die markeerden 103 bestanden voor een
   motor met een aanroeper. Elk token hier is een naam die alleen bij deze motor
   hoort; de breedtekeuring hieronder houdt dat eerlijk.
   ------------------------------------------------------------------------- */
const ASSEN = {
  mensAanDeDeur: {
    wat: 'de deur eist een BEWEZEN mens en niet een gedeelde code',
    bron: 'server/kern/kantoor/kluispoort.js', graad: 'gemeten', uitRouter: true,
  },
  assurance: {
    wat: 'de zekerheid over wie er staat: passkey, stap-op, vertrouwensstand',
    bron: 'server/kern/identiteit/vertrouwen.js', graad: 'vermoed',
    tokens: ['zwaarbewijs', 'zwaarBeveiliging', 'identiteit/vertrouwen', 'stapOpMaak'],
  },
  mandaat: {
    wat: 'namens-wie, en de speelruimte als DOORSNEDE van bestaand vermogen',
    bron: 'server/kern/stuur/mandaat.js', graad: 'vermoed',
    tokens: ['stuur/mandaat', 'speelruimte', 'magZelfstandig', 'mandaatGeldig'],
  },
  autoriteit: {
    wat: 'het bevoegdheidsoordeel: mag deze actor dit, nominaal en effectief',
    bron: 'server/kern/commercie/rechten.js', graad: 'vermoed',
    tokens: ['commercieRechten', 'commercie/rechten', 'commercie/besluit', 'bevoegdheidVan'],
  },
  bewijsDraagt: {
    wat: 'proof-carrying authorization: de toestemming reist MEE met het werk',
    bron: 'server/kern/commercie/bewijstoken.js', graad: 'vermoed',
    tokens: ['bewijstoken', 'commercieBewijstoken'],
  },
  voornemen: {
    wat: 'het hele plan wordt gewogen VOOR de eerste stap',
    bron: 'server/kern/commercie/voornemen.js', graad: 'vermoed',
    tokens: ['commercie/voornemen', 'maakVoornemens', 'voornemens.'],
  },
  beleid: {
    wat: 'de beleidslaag die het besluit bewaakt (veiligheidskern)',
    bron: 'server/kern/commercie/veiligheidskern.js', graad: 'vermoed',
    tokens: ['veiligheidskern'],
  },
  tegenfeit: {
    wat: 'wat zou er gebeurd zijn: de tegenfeitelijke controle',
    bron: 'server/kern/commercie/tegenfeit.js', graad: 'vermoed',
    tokens: ['tegenfeit'],
  },
  simulatie: {
    wat: 'de handeling eerst in een tweeling uitvoeren',
    bron: 'server/kern/command/simulatie.js', graad: 'vermoed',
    tokens: ['command/simulatie', 'command/zandbak', 'droogloop'],
  },
  frictie: {
    wat: 'hoeveel mens deze handeling NU nodig heeft: hand, assist of auto',
    bron: 'server/kern/frictie/motor.js', graad: 'vermoed',
    tokens: ['frictie', 'maakRisico'],
  },
  envelop: {
    wat: 'de gebeurtenis draagt actor, correlatie en oorzaak',
    bron: 'server/kern/envelop.js', graad: 'vermoed',
    tokens: ['kern/envelop', 'envelopWie', 'publishDirect', 'inKeten'],
  },
  idempotentie: {
    wat: 'een tweede identieke aanroep doet niet nog eens hetzelfde',
    bron: 'server/lib/idem-poort.js', graad: 'vermoed',
    tokens: ['idem-poort', 'metIdem', 'idemSleutel', 'idempotentie'],
  },
  atomair: {
    wat: 'het effect landt in een schrijflaan die heel of niet doorgaat',
    bron: 'server/pg/verzoektransactie.js', graad: 'vermoed',
    tokens: ['verzoektransactie', 'collectietransactie', 'naCommit', 'metTransactie'],
  },
  bewijsketen: {
    wat: 'de gebeurtenis hangt in een hashketen die te verankeren is',
    bron: 'server/lib/keten.js', graad: 'vermoed',
    tokens: ['lib/keten', 'ketenAnker', 'ankerdienst'],
  },
  gevolg: {
    wat: 'wat deze handeling AANRAAKT is gemeten en niet aangenomen',
    bron: 'server/kern/stuur/gevolg.js', graad: 'vermoed',
    tokens: ['stuur/gevolg'],
  },
  schaduw: {
    wat: 'een nieuwe regel loopt eerst mee zonder te blokkeren',
    bron: 'server/kern/commercie/schaduw.js', graad: 'vermoed',
    tokens: ['commercie/schaduw', 'pay/schaduw', 'zetModus', 'schaduwregels'],
  },
};

/* Vier assen worden GELEZEN uit EXECUTION_MAP.json in plaats van hier gerekend.
   Wie ze hier opnieuw telt, bouwt de tweede bron die dit huis elders al een
   keer heeft moeten opruimen. */
const UIT_EXECUTIONMAP = {
  aiVindbaar: { wat: 'de AI mag deze route zien en aanroepen', veld: 'bereik',
    raakt: v => v && v !== 'verboden', graad: 'gemeten' },
  bewijsstand: { wat: 'de vervalstaat van het bewijs onder deze route', veld: 'bewijs',
    raakt: v => v === 'bewezen', graad: 'gemeten' },
  herhaling: { wat: 'wat een tweede identieke aanroep doet', veld: 'herhaling',
    raakt: v => v === 'beschermd', graad: 'gemeten' },
};

/* ---------------------------------------------------------------------------
   DE KETENASSEN -- de assen die een BAAN heeft en een losse route niet.

   Een geldhandeling loopt over drie menselijke stappen en dus over drie routes.
   Vijf assen van zo'n baan zijn daarom per constructie niet op een enkele handler
   te vinden: ze gaan over de baan. Ze staan hier met hun woord, zodat de
   ketendekking hieronder dezelfde namen gebruikt als het dossier in
   kern/kantoor/geldketen.js -- twee lijsten met dezelfde bedoeling en andere
   woorden is de botsing die SEMANTIEK.json meet.
   ------------------------------------------------------------------------- */
const KETENAS_TOKENS = {
  streefstand: ['streefstand'],
  tweedeMens: ['tweedeHand', 'tweedehandtekening', 'tweedeMens'],
  hervatbaar: ['uitvoerbelofte', 'hervatbaar'],
  autoriteit: ['geldketen', 'commercie/besluit', 'commercieRechten'],
  bewijsDraagt: ['geldketen', 'bewijstoken'],
  voornemen: ['geldketen', 'commercie/voornemen', 'voornemens.'],
  mandaat: ['geldketen', 'stuur/mandaat', 'speelruimte', 'magZelfstandig'],
  tegenfeit: ['geldketen', 'tegenfeit', 'vooruitblik'],
  assurance: ['zwaarbewijs', 'zwaarBeveiliging', 'zwaar.eis'],
  envelop: ['geldketen', 'kern/envelop', 'envelopWie'],
  bewijsketen: ['geldketen', 'lib/keten', 'ketenAnker'],
  gevolg: ['geldketen', 'stuur/gevolg'],
  frictie: ['geldketen', 'frictie'],
  idempotentie: ['geldketen', 'idem', 'sleutel'],
  atomair: ['verzoektransactie', 'collectietransactie', 'metTransactie'],
  mensbewijs: ['kluisAuth', 'naamAuth', 'boardroomAuth'],
  uitvoering: ['geldketen', 'ketenlaag.uitvoer', 'voerUit'],
};

/* Wat deze meter NIET kan meten, met de reden -- nooit als 0. */
const ONGEMETEN = {
  doelVindbaar: 'er is geen doelregister in dit huis: een Goal bestaat niet als runtime-object, ' +
    'dus "kan een planner deze capability vinden om een doel te bereiken" heeft vandaag geen bron. ' +
    'Een 0 zou beweren dat het gemeten is en nul opleverde.',
  gegevensklasse: 'er is geen gegevensklasse per VELD (KANTOORMACHT.md par. 3). De privacyklasse ' +
    'van een handeling is daarom niet af te leiden; kern/envelop.js kent er een per GEBEURTENIS, ' +
    'en dat is een andere vraag.',
  terugweg: 'HERSTEL.json leidt een tegenhanger af uit de NAAM van een route en HERSTELPROEF.json ' +
    'beproeft 90 paren; bij elkaar dekken die niet de muterende routes, en een naam is geen bewijs. ' +
    'De bevestigde paren staan in EXECUTION_MAP.json en worden daar gelezen, niet hier geteld.',
  kosten: 'de kostprijs per handeling hangt aan een verbruiksmeter met een drager uit de ' +
    'async-context (KOSTEN.md), niet aan een route. Statisch is hij niet af te leiden.',
};

const digest = (bestand) => {
  try { return crypto.createHash('sha256').update(fs.readFileSync(path.join(WORTEL, bestand))).digest('hex').slice(0, 16); }
  catch (e) { return null; }
};
/* DE STEMPEL KOMT UIT HET HUIS EN NIET UIT DIT BESTAND, en dat is geen
   opruimwerk. scripts/lib/stempel.js zet er `boomVuil` bij: is de werkboom niet
   schoon op het moment van meten, dan is de uitslag NIET te herhalen -- en
   scripts/norm.js telt precies dat (`registersUitVuileBoom`, en die mag alleen
   dalen). Een eigen stempel zonder dat veld zou deze meter onzichtbaar houden
   voor die telling: niet vals, maar wel buiten het toezicht dat elk ander
   register hier wel draagt. */
const { stempel } = require('./lib/stempel');

/* ---------------------------------------------------------------------------
   DE BESTANDSGRAAF. Twee dingen: welke bestanden requiret een bestand
   rechtstreeks (voor de bestandsas), en welke module heeft een kern-naam in de
   tas gelegd (voor `motoren`, dus over MODULES en niet over routes -- zie de kop
   over de hub die de hele boom markeerde).

   De herkomst komt uit KERNHERKOMST.json. Loopt dat register achter, dan is het
   in `bronnen` te zien -- hij wordt niet stil gebruikt.
   ------------------------------------------------------------------------- */
function bestandenIn(map) {
  const uit = [];
  (function lees(d) {
    let ee; try { ee = fs.readdirSync(path.join(WORTEL, d), { withFileTypes: true }); } catch (e) { return; }
    for (const e of ee) {
      if (['node_modules', 'data', 'dist'].includes(e.name) || e.name.startsWith('.')) continue;
      const rel = d + '/' + e.name;
      if (e.isDirectory()) lees(rel); else if (e.name.endsWith('.js')) uit.push(rel);
    }
  })(map);
  return uit;
}

function bouwGraaf() {
  const alle = bestandenIn('server');
  const bestaat = new Set(alle);
  const tekst = new Map();
  for (const f of alle) tekst.set(f, fs.readFileSync(path.join(WORTEL, f), 'utf8'));

  const los = (van, spec) => {
    if (!spec.startsWith('.')) return null;
    const p = path.posix.normalize(path.posix.join(path.posix.dirname(van), spec));
    for (const kand of [p, p + '.js', p + '/index.js']) if (bestaat.has(kand)) return kand;
    return null;
  };

  const herkomst = new Map();
  let herkomstBron = null;
  try {
    const reg = JSON.parse(fs.readFileSync(path.join(WORTEL, 'KERNHERKOMST.json'), 'utf8'));
    herkomstBron = reg.stempel || null;
    for (const r of reg.perNaam) if (r.herkomsten.length === 1) herkomst.set(r.naam, r.herkomsten[0].bestand);
  } catch (e) { /* geen herkomst: de bovengrens valt terug op requires, en dat staat in de uitslag */ }

  /* DE HUBGRENS. Veertig requires is geen gevoel maar de knik in de verdeling:
     de mediaan staat op nul (de meeste routebestanden krijgen alles via de tas)
     en er staan een paar bestanden op honderd-plus. Alles daarboven is een
     bestand dat het huis bijeenhoudt, geen bestand dat een handeling doet. */
  const HUBDREMPEL = 40;
  const hub = new Set();
  for (const f of alle) {
    const n = (tekst.get(f).match(/require\(\s*['"]/g) || []).length;
    if (n >= HUBDREMPEL) hub.add(f);
  }

  const buren = new Map();     // bestand -> zichzelf + wat het RECHTSTREEKS requiret (hubs uitgezonderd)
  const vraagt = new Map();    // doel -> bestanden die het requiren (voor motoren)
  const viaZak = new Map();    // module -> bestanden die een naam uit zijn fabriek gebruiken
  for (const f of alle) {
    const t = tekst.get(f);
    const set = new Set([f]);
    for (const m of t.matchAll(/require\(\s*['"]([^'"]+)['"]\s*\)/g)) {
      const d = los(f, m[1]);
      if (!d) continue;
      if (!hub.has(d)) set.add(d);
      if (!vraagt.has(d)) vraagt.set(d, new Set());
      vraagt.get(d).add(f);
    }
    buren.set(f, set);

    if (f.startsWith('server/opzet/')) continue;   // bedrading is geen gebruik
    const namen = new Set();
    for (const m of t.matchAll(/(?:const|let|var)\s*\{([^}]*)\}\s*=\s*(?:kern|actx|ctx)\b/g))
      for (const n of m[1].split(',')) { const naam = n.split(':')[0].trim(); if (naam) namen.add(naam); }
    for (const m of t.matchAll(/\bkern\.([A-Za-z_$][\w$]*)/g)) namen.add(m[1]);
    for (const n of namen) {
      const b = herkomst.get(n);
      if (!b || b === f) continue;
      if (!viaZak.has(b)) viaZak.set(b, new Set());
      viaZak.get(b).add(f);
    }
  }
  return { alle, tekst, buren, vraagt, viaZak, hub, hubdrempel: HUBDREMPEL, herkomstBron, herkomstNamen: herkomst.size };
}

/* ---------------------------------------------------------------------------
   DE HANDLERSPAN. scripts/lib/routes.js geeft per route het bestand en de
   regel. De span loopt tot de volgende route in hetzelfde bestand; bij de
   laatste tot het einde. Dat is grof aan de bovenkant (een hulpfunctie tussen
   twee routes valt in de span van de eerste) en het is de beste ondergrens die
   zonder een tweede parser te krijgen is.
   ------------------------------------------------------------------------- */
function spans(routes, tekst) {
  const perBestand = new Map();
  for (const r of routes) {
    if (!r.bestand || !r.regel) continue;
    if (!perBestand.has(r.bestand)) perBestand.set(r.bestand, []);
    perBestand.get(r.bestand).push(r);
  }
  const uit = new Map();
  for (const [bestand, rs] of perBestand) {
    const t = tekst.get(bestand);
    if (!t) continue;
    const regels = t.split('\n');
    rs.sort((a, b) => a.regel - b.regel);
    for (let i = 0; i < rs.length; i++) {
      const van = rs[i].regel - 1;
      const tot = i + 1 < rs.length ? rs[i + 1].regel - 1 : regels.length;
      uit.set(rs[i], regels.slice(van, Math.max(tot, van + 1)).join('\n'));
    }
  }
  return uit;
}

function meet() {
  const routes = alleRoutes();
  const graaf = bouwGraaf();
  const span = spans(routes, graaf.tekst);

  /* DE BREEDTEKEURING. Een token dat in meer dan een kwart van de routebestanden
     staat, meet niets meer. Hij wordt afgekeurd en genoemd. */
  const routeBestanden = [...new Set(routes.map(r => r.bestand).filter(Boolean))];
  const tokenAfgekeurd = [];
  const DREMPEL = Math.ceil(routeBestanden.length * 0.25);
  for (const [naam, as] of Object.entries(ASSEN)) {
    if (!as.tokens) continue;
    as.tokens = as.tokens.filter(tok => {
      const n = routeBestanden.filter(f => (graaf.tekst.get(f) || '').includes(tok)).length;
      if (n > DREMPEL) { tokenAfgekeurd.push({ as: naam, token: tok, bestanden: n, drempel: DREMPEL }); return false; }
      return true;
    });
  }

  /* De executiekaart als bron voor de vier assen die zij al bezit. */
  let kaart = null, kaartRij = new Map();
  try {
    kaart = JSON.parse(fs.readFileSync(path.join(WORTEL, 'EXECUTION_MAP.json'), 'utf8'));
    for (const c of kaart.capabilities) kaartRij.set(c.pad, c);
  } catch (e) { /* dan staan die assen als ongemeten in de uitslag */ }

  const soft = Object.entries(ASSEN).filter(([, a]) => !a.uitRouter);
  const perAs = {};
  for (const naam of Object.keys(ASSEN)) perAs[naam] = { handler: 0, bestand: 0 };
  for (const naam of Object.keys(UIT_EXECUTIONMAP)) perAs[naam] = { handler: 0, bestand: 0, uitKaart: true };

  const perRoute = [];
  const histogram = new Map();
  let muterend = 0, zonderEnigeAs = 0, geenSpan = 0, hubRoutes = 0;

  const buurTekstCache = new Map();
  const buurTekst = (f) => {
    if (buurTekstCache.has(f)) return buurTekstCache.get(f);
    let t = '';
    for (const b of (graaf.buren.get(f) || [f])) t += (graaf.tekst.get(b) || '');
    buurTekstCache.set(f, t);
    return t;
  };

  for (const r of routes) {
    const mut = /POST|PUT|PATCH|DELETE/i.test(r.methode);
    if (mut) muterend++;
    const onder = [], boven = [];
    const s = span.get(r);
    if (mut && s === undefined) geenSpan++;

    if ((r.bewakers || []).some(b => EIST_MENS.has(b))) { onder.push('mensAanDeDeur'); boven.push('mensAanDeDeur'); }

    /* Woont deze route in een hub, dan is de bestandsas onbruikbaar: hij zou het
       hele huis erven. Dan geldt alleen de handlertekst, en de route wordt
       geteld in `bestandsasOnbruikbaar` -- zichtbaar, niet weggelaten. */
    const inHub = r.bestand ? graaf.hub.has(r.bestand) : false;
    if (inHub && mut) hubRoutes++;
    const bt = !r.bestand ? '' : inHub ? (s || '') : buurTekst(r.bestand);
    for (const [naam, as] of soft) {
      if (!as.tokens || !as.tokens.length) continue;
      if (s && as.tokens.some(tok => s.includes(tok))) onder.push(naam);
      if (as.tokens.some(tok => bt.includes(tok))) boven.push(naam);
    }
    const rij = kaartRij.get(r.pad);
    for (const [naam, as] of Object.entries(UIT_EXECUTIONMAP)) {
      if (rij && as.raakt(rij[as.veld])) { onder.push(naam); boven.push(naam); }
    }

    for (const a of onder) perAs[a].handler++;
    for (const a of boven) perAs[a].bestand++;
    if (mut) {
      histogram.set(onder.length, (histogram.get(onder.length) || 0) + 1);
      if (!boven.length) zonderEnigeAs++;
      perRoute.push({ methode: r.methode, pad: r.pad, bestand: r.bestand, onder, boven });
    }
  }

  /* ------------------------------------------------------------------------
     VOLLEDIGE KETENS -- de enige teller hier die alleen mag STIJGEN.

     De twee andere tellers zijn schulden (ze mogen alleen dalen); deze is een
     BEZIT. Hij zegt of dit huis van losse integraties naar samengestelde
     uitvoering beweegt, en dat is een andere vraag dan "hoeveel routes raken een
     motor".

     DE DEFINITIE IS STRENG, en dat is de hele waarde: een keten heet volledig
     wanneer ELKE as die zijn handelingsklasse verplicht stelt, ergens op de
     routes van die keten werkelijk voorkomt -- op de HANDLERAS, de strengste van
     de twee. Aanwezigheid in een bestand telt hier niet mee, want dat is precies
     de verwarring die deze meter twee keer over zichzelf heeft ontdekt (een hub
     in de tas en een hub als routebestand).

     WAT HIJ NIET BEWIJST: dat de as bij de UITVOERING ook werkelijk iets deed.
     Dat is wat test/geldketen.test.js beproeft, met een mutatie per grendel. Deze
     meter ziet de bedrading; die toets ziet het gedrag. Twee dingen, en ze worden
     niet opgeteld.
     ---------------------------------------------------------------------- */
  const perPad = new Map();
  for (const r of routes) {
    if (!perPad.has(r.pad)) perPad.set(r.pad, []);
    perPad.get(r.pad).push(r);
  }
  const ketens = [];
  for (const k of KETENS) {
    const klasse = KLASSEN[k.klasse];
    const open = [], gevonden = {};
    const bestaat = k.routes.filter(p => perPad.has(p));
    for (const as of (klasse ? klasse.verplicht : [])) {
      const tokens = KETENAS_TOKENS[as] || [];
      let waar = null;
      for (const pad of k.routes) {
        for (const r of (perPad.get(pad) || [])) {
          const tekst = span.get(r) || '';
          if (tokens.some(tok => tekst.includes(tok))) { waar = pad; break; }
        }
        if (waar) break;
      }
      if (waar) gevonden[as] = waar; else open.push(as);
    }
    ketens.push({
      naam: k.naam, klasse: k.klasse, handeling: k.handeling,
      routes: k.routes, routesBestaan: bestaat.length, routesGeteld: k.routes.length,
      verplicht: klasse ? klasse.verplicht.length : 0,
      gevonden, open,
      volledig: !!klasse && open.length === 0 && bestaat.length === k.routes.length,
      waaromNiet: klasse ? klasse.waaromNiet : {},
    });
  }
  const volledig = ketens.filter(k => k.volledig).length;

  /* HOEVEEL BEREIKT EEN MOTOR? Dit is de onderbenut-vraag van de vorige ronde,
     en hier staat hij op de as waarop hij hard is: MODULES. `moduleLezers` telt
     de bestanden die de bron rechtstreeks requiren, `zakLezers` de bestanden die
     een naam gebruiken die zijn fabriek in de tas heeft gelegd. Die twee staan
     apart omdat ze verschillende dingen missen -- en omdat een motor met nul van
     beide een motor is die niemand aanroept, hoeveel routes er ook bestaan. */
  const motoren = [];
  for (const [naam, as] of Object.entries(ASSEN)) {
    const bron = as.bron;
    const lezers = [...(graaf.vraagt.get(bron) || [])].filter(f => !f.startsWith('server/opzet/'));
    const zak = [...(graaf.viaZak.get(bron) || [])];
    motoren.push({
      motor: naam, bron, bestaat: fs.existsSync(path.join(WORTEL, bron)),
      moduleLezers: lezers.length, zakLezers: zak.length,
      lezers: lezers.slice(0, 8),
      routesHandler: perAs[naam].handler, routesBestand: perAs[naam].bestand,
      tokens: as.tokens ? as.tokens.length : null, graad: as.graad,
    });
  }
  const zonderBereik = motoren.filter(m => m.routesBestand === 0).map(m => m.motor);

  return {
    soort: 'projectie',
    uitleg: 'Per handeling: hoeveel van de eigen machinerie raakt hij? Zestien motoren die ieder ' +
      'apart gemeten zijn, hier voor het eerst naast elkaar op DEZELFDE route.',
    grens: 'Twee assen die verschillende dingen missen, nooit opgeteld: `handler` is lexicaal binnen de ' +
      'tekst van de handler (mist een hulpfunctie en de kern-tas) en `bestand` rekent het routebestand plus ' +
      'zijn DIRECTE requires (vangt de hulpfunctie, markeert alle routes in een bestand, mist nog steeds de ' +
      'kern-tas). De tas zit met opzet niet in de route-as: een hub als server.js zette zo 4162 routes op ' +
      '"idempotent". Woont een route ZELF in een hub, dan vervalt de bestandsas (bestandsasOnbruikbaar) en is ook ' +
      'zijn handlerspan grof, want die loopt door de infrastructuur van dat bestand. Alleen `mensAanDeDeur` komt uit de ROUTER en is hard. De assen uit EXECUTION_MAP.json ' +
      'zijn gelezen en niet hier geteld.',
    stempel: stempel(),
    bronnen: {
      'EXECUTION_MAP.json': digest('EXECUTION_MAP.json'),
      'KERNHERKOMST.json': digest('KERNHERKOMST.json'),
      'server/kern/stuur/beleid.js': digest('server/kern/stuur/beleid.js'),
      kernherkomstStempel: graaf.herkomstBron, kernherkomstNamen: graaf.herkomstNamen,
      executionmapStempel: kaart && kaart.stempel ? kaart.stempel : null,
    },
    assen: Object.fromEntries(Object.entries(ASSEN).map(([n, a]) =>
      [n, { wat: a.wat, bron: a.bron, graad: a.graad, tokens: a.tokens || null, uitRouter: !!a.uitRouter }])),
    assenUitKaart: Object.fromEntries(Object.entries(UIT_EXECUTIONMAP).map(([n, a]) =>
      [n, { wat: a.wat, bron: 'EXECUTION_MAP.json#' + a.veld, graad: a.graad }])),
    gemeten: {
      routes: routes.length, muterend,
      assen: Object.keys(ASSEN).length + Object.keys(UIT_EXECUTIONMAP).length,
      perAs,
      motoren,
      motorenZonderRouteBereik: zonderBereik.length,
      motorenZonderRouteBereikNamen: zonderBereik,
      volledigeKetens: volledig,
      ketens,
      mutatiesZonderEnigeAs: zonderEnigeAs,
      mutatiesZonderHandlerSpan: geenSpan,
      bestandsasOnbruikbaar: hubRoutes,
      hubdrempel: graaf.hubdrempel,
      hubs: [...graaf.hub].sort(),
      assenPerMutatie: [...histogram.entries()].sort((a, b) => a[0] - b[0]).map(([n, aantal]) => ({ assen: n, routes: aantal })),
    },
    ongemeten: ONGEMETEN,
    tokenAfgekeurd,
    perRoute,
  };
}

function toon(u) {
  const g = u.gemeten;
  console.log('\nMACHINEDEKKING -- raken de zestien motoren dezelfde handeling?\n');
  console.log('  routes                   ' + g.routes + '   (muterend: ' + g.muterend + ')');
  console.log('  assen                    ' + g.assen + '   (' + Object.keys(u.ongemeten).length + ' ongemeten, met reden)');
  console.log('\n  per as: routes geraakt        handler (ondergrens)   bestand (bovengrens)');
  const rijen = Object.entries(g.perAs).sort((a, b) => a[1].bestand - b[1].bestand);
  for (const [naam, v] of rijen) {
    const kleur = v.bestand === 0 ? K.rood : v.handler === 0 ? K.geel : '';
    console.log('    ' + kleur + naam.padEnd(18) + String(v.handler).padStart(8) + String(v.bestand).padStart(22) +
      (v.uitKaart ? K.grijs + '   uit EXECUTION_MAP' : '') + K.reset);
  }
  console.log('\n  VOLLEDIGE KETENS (mag alleen stijgen): ' +
    (g.volledigeKetens ? K.groen : K.rood) + g.volledigeKetens + K.reset + ' van ' + g.ketens.length + ' verklaard');
  for (const k of g.ketens) {
    console.log('    ' + (k.volledig ? K.groen + 'rond   ' : K.geel + 'open   ') + K.reset +
      k.naam.padEnd(16) + K.grijs + k.klasse + ' -- ' + Object.keys(k.gevonden).length + ' van ' +
      k.verplicht + ' verplichte assen op ' + k.routesBestaan + '/' + k.routesGeteld + ' routes' + K.reset);
    if (k.open.length) console.log('           open: ' + k.open.join(', '));
  }
  console.log('\n  muterende routes die GEEN ENKELE as raken (bovengrens): ' +
    (g.mutatiesZonderEnigeAs ? K.rood : K.groen) + g.mutatiesZonderEnigeAs + K.reset +
    ' van ' + g.muterend);
  console.log('  bestandsas onbruikbaar (de route woont zelf in een hub): ' + g.bestandsasOnbruikbaar +
    '  -- ' + g.hubs.length + ' hubs boven ' + g.hubdrempel + ' requires');
  console.log('  motoren die geen enkele route bereiken: ' + g.motorenZonderRouteBereik +
    (g.motorenZonderRouteBereikNamen.length ? '  (' + g.motorenZonderRouteBereikNamen.join(', ') + ')' : ''));
  console.log('\n  verdeling: hoeveel assen raakt een muterende handeling (ondergrens)');
  for (const r of g.assenPerMutatie) console.log('    ' + String(r.assen).padStart(2) + ' assen  ' + r.routes + ' routes');
  if (u.tokenAfgekeurd.length) {
    console.log('\n  tokens AFGEKEURD op breedte (ze zouden de halve boom markeren):');
    for (const t of u.tokenAfgekeurd) console.log('    ' + t.as + ': "' + t.token + '" in ' + t.bestanden + ' routebestanden (drempel ' + t.drempel + ')');
  }
  const leeg = Object.entries(u.assen).filter(([n, a]) => !a.uitRouter && (!a.tokens || !a.tokens.length));
  if (leeg.length) console.log('\n  ' + K.rood + 'assen zonder bruikbaar token (dus ongemeten, niet 0): ' + leeg.map(([n]) => n).join(', ') + K.reset);
  console.log('\n  ongemeten (met reden, nooit als 0): ' + Object.keys(u.ongemeten).join(', '));
  console.log('');
}

function main() {
  const argv = process.argv.slice(2);
  const u = meet();
  if (argv.includes('--json')) { console.log(JSON.stringify(u, null, 1)); return; }

  const asArg = argv.indexOf('--as');
  if (asArg > -1 && argv[asArg + 1]) {
    const naam = argv[asArg + 1];
    const raakt = u.perRoute.filter(r => r.boven.includes(naam));
    console.log('\nas "' + naam + '": ' + raakt.length + ' muterende routes (bovengrens)');
    for (const r of raakt.slice(0, 40)) console.log('  ' + (r.onder.includes(naam) ? '*' : ' ') + ' ' + r.methode + ' ' + r.pad + '   ' + r.bestand);
    if (raakt.length > 40) console.log('  ... en ' + (raakt.length - 40) + ' meer');
    console.log('\n  * = ook binnen de handlertekst zelf gevonden (ondergrens)');
    return;
  }

  toon(u);

  if (argv.includes('--vastleggen')) {
    fs.writeFileSync(DOEL, JSON.stringify(u, null, 1) + '\n');
    console.log('  vastgelegd in MACHINEDEKKING.json\n');
    return;
  }

  /* DE POORT hangt aan twee ABSOLUTE getallen en niet aan een percentage: een
     percentage stijgt ook als er routes bijkomen die niets doen. Beide mogen
     alleen dalen -- dezelfde normtandvorm als PROOF.md en kantoormacht. */
  if (argv.includes('--controle')) {
    let oud;
    try { oud = JSON.parse(fs.readFileSync(DOEL, 'utf8')); }
    catch (e) { console.error('GEZAKT: MACHINEDEKKING.json ontbreekt. Draai eerst --vastleggen.'); process.exitCode = 1; return; }
    let gezakt = false;
    /* DEZE TELLER GAAT DE ANDERE KANT OP. `volledigeKetens` is een bezit en geen
       schuld: hij mag alleen STIJGEN. Dat is geen spiegelbeeld van de twee
       hieronder maar een ander soort bewaking -- de twee schulden zeggen hoeveel
       er nog buiten de machine om gaat, deze zegt of er werkelijk iets IN de
       machine is komen te liggen. */
    const wasK = oud.gemeten.volledigeKetens, nuK = u.gemeten.volledigeKetens;
    if (typeof wasK === 'number' && nuK < wasK) {
      console.error(K.rood + 'GEZAKT: volledigeKetens ' + wasK + ' -> ' + nuK +
        '. Deze teller mag alleen stijgen: een keten die rond was, hoort niet stil open te gaan staan.' + K.reset);
      gezakt = true;
    } else if (typeof wasK === 'number') console.log('  in orde: volledigeKetens ' + nuK + ' (was ' + wasK + ')');

    for (const veld of ['mutatiesZonderEnigeAs', 'motorenZonderRouteBereik']) {
      const was = oud.gemeten[veld], nu = u.gemeten[veld];
      if (typeof was !== 'number') continue;
      if (nu > was) {
        console.error(K.rood + 'GEZAKT: ' + veld + ' ' + was + ' -> ' + nu + '. Deze teller mag alleen dalen.' + K.reset);
        gezakt = true;
      } else console.log('  in orde: ' + veld + ' ' + nu + ' (was ' + was + ')');
    }
    if (gezakt) process.exitCode = 1;
  }
}

if (require.main === module) main();
module.exports = { meet, bouwGraaf, ASSEN, UIT_EXECUTIONMAP, ONGEMETEN };
