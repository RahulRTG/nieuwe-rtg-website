/* WELKE TOESTAND BESTAAT ER EIGENLIJK, EN WIE IS ERVAN?

   Dit is fase A van de verificatie-runtime: de runtime ZICHTBAAR maken. Nog
   niets versnellen. De aanleiding is een getal: 647 serverstarts kosten 35% van
   alle toetstijd, en dat wordt pas minder als servers hergebruikt kunnen worden.
   Hergebruik mag alleen als je van elke muteerbare wortel weet wie hem bezit en
   of hij aantoonbaar terug kan naar zijn beginstand. Zolang er ook maar EEN
   onbekende singleton is, kan die honderd keurig geisoleerde toetsen waardeloos
   maken -- en dat merk je niet, want een gedeelde server die lekt geeft geen
   fout maar een verkeerd antwoord.

   Dus eerst tellen wat er is. Dit bestand doet dat en niets anders.

   WAT TELT ALS EEN MUTEERBARE WORTEL. Een binding op MODULEniveau die na het
   laden nog kan veranderen:

     - `let` of `var`               -- altijd, die zijn per definitie herbindbaar
     - `const` op een Map/Set/WeakMap/WeakSet, een array of een object,
       MAAR alleen als er in dat bestand ook echt in geschreven wordt

   Dat tweede onderscheid is de hele precisie van deze scanner. Zonder die eis
   telde hij 1123 wortels, want `const LANDEN = [...]` en `const TARIEVEN = {}`
   staan hier bij honderden. Dat zijn vaste tabellen en geen toestand; ze in een
   register zetten maakt het register onbruikbaar en daarmee de ratel zinloos.
   Met de eis blijven er 143 over, en dat is een lijst waar een mens iets mee kan.

   WAT DEZE SCANNER NIET ZIET, en dat hoort erbij:

     - toestand achter een fabrieksfunctie (maak...() met een eigen sluiting).
       Die is per aanroep vers, dus meestal juist GOED -- maar wie zo'n fabriek
       een keer aanroept en het resultaat op moduleniveau vasthoudt, heeft weer
       een wortel, en die ziet deze scanner wel via de binding.
     - toestand in een ander proces (Postgres, Redis) -- die heeft een eigen
       levensduur en hoort in het register met de hand.
     - `globalThis.x = ...` binnen een functie.

   Dat zijn geen omissies om weg te poetsen maar de rand van wat statisch te
   zien is; het register (STATE.json) is de plek waar zulke wortels met de hand
   bij komen, en het veld `bron` zegt dan `hand` in plaats van `scan`.

   DE KLOKCENSUS ZIT ER OOK IN, en om een reden. `new Date()` zonder argument
   LEEST de klok; `new Date(x)` construeert een datum uit iets dat er al was.
   Wie die twee op een hoop gooit telt hier 1788 kloklezingen waar er 1297 zijn,
   en dan meet je bij elke reparatie het verkeerde getal. Datzelfde geldt voor
   Date.now(), process.hrtime() en performance.now().

   Puur eigen werk: de AST-laag in scripts/ast/ (lexer, parser, walk), geen
   npm-pakket. Handhaver: test/staatregister.test.js. */
'use strict';
const fs = require('fs');
const path = require('path');
const { parse } = require('../ast/parser.js');
const { loop } = require('../ast/walk.js');

const OVERSLAAN = new Set(['node_modules', '.git', 'data', 'dist', 'coverage']);

/* De methoden die een container ECHT muteren. `get`, `has` en `size` staan er
   met opzet niet bij: lezen maakt van een tabel geen toestand. */
const MUTMETHODE = /^(set|add|delete|clear|push|pop|shift|unshift|splice|sort|reverse|fill|copyWithin)$/;
const CONTAINER = /^(Map|Set|WeakMap|WeakSet)$/;

function bestandenOnder(map, uit) {
  uit = uit || [];
  let items;
  try { items = fs.readdirSync(map, { withFileTypes: true }); } catch (e) { return uit; }
  for (const it of items) {
    if (OVERSLAAN.has(it.name)) continue;
    const p = path.join(map, it.name);
    if (it.isDirectory()) bestandenOnder(p, uit);
    else if (p.endsWith('.js')) uit.push(p);
  }
  return uit;
}

/* Staat deze knoop binnen een functie? Een timer of listener op MODULEniveau
   draait bij het laden en leeft dus zo lang als het proces; dezelfde aanroep
   binnen een routehandler hoort bij een verzoek en is een heel ander ding. */
function inFunctie(pad) {
  return pad.some(x => /Function/.test(x.type) || x.type === 'MethodDefinition');
}

/* EEN DUUR OP DE WANDKLOK -- de foutklasse die de monotone klok wegneemt.

   `Date.now() - t0` wordt kleiner zodra de wandklok achteruit gaat: bij een
   NTP-correctie, bij wintertijd, bij RTG_KLOK=-1u. Een timeout verloopt dan
   nooit meer of meteen, een venster springt open, een uptime wordt negatief.
   server/lib/klok.js heeft daar sinds vandaag sinds() en verstreken(merk) voor.

   TWEE DINGEN DIE HIER NIET BIJ HOREN, want een meter die zijn nul niet kan
   halen wordt uitgezet -- en dan bewaakt hij niets meer.

   1. KALENDERREKENEN. `Date.now() - 7 * 86400000` is geen duur maar een MOMENT:
      zeven dagen geleden. Dat hoort juist op de wandklok, want het gaat over de
      kalender. Herkenbaar aan een kale getallenkant, of aan een
      vermenigvuldiging met een tijdseenheid (1000, 60000, 3600000, 86400000).
      Negentien plekken.

   2. DE LEEFTIJD VAN EEN BEWAARD MOMENT. `Date.now() - Date.parse(m.at)` en
      `Date.now() - a.at` meten hoe oud een rij in de opslag is. Dat KAN niet
      monotoon: het bewaarde getal is een wandklok-moment en de monotone teller
      begint bij elke start opnieuw bij nul. Herkenbaar aan Date.parse(),
      .getTime(), .valueOf() of een veld op een object (a.at, rij.aangemaakt) --
      een lokale `let` is een merk in dit proces, een veld komt uit de opslag.
      Zesenvijftig plekken.

   Zonder die twee telde de meter 109 en was er 56 daarvan onbereikbaar. Nu telt
   hij 53, en dat zijn er 53 die iemand echt kan verhuizen.

   DIT IS GEEN TWEEDE KLOKSCHULD. KLOK.json telt hoeveel code de tijd aan het OS
   vraagt; dat gaat over RTG_KLOK en over beproefbaarheid. Deze telt hoeveel code
   een DUUR op de verkeerde klok uitrekent, en dat is een ander gebrek met een
   andere reparatie. Ze overlappen in regels en niet in betekenis. */
const isDateNow = (n) => n && n.type === 'CallExpression' && n.callee && n.callee.type === 'MemberExpression'
  && (n.callee.object || {}).name === 'Date' && (n.callee.property || {}).name === 'now';

const TIJDSEENHEID = new Set(['1000', '60000', '3600000', '86400000', '604800000']);

/* Een uitdrukking die een BEWAARD moment terugleest, en dus per definitie op de
   wandklok hoort. Een veld op een object komt uit de opslag; een lokale binding
   is een merk in dit proces en kan wel monotoon. */
function bewaardMoment(n) {
  if (!n) return false;
  if (n.type === 'MemberExpression') return true;
  if (n.type === 'CallExpression' && n.callee && n.callee.type === 'MemberExpression') {
    const o = (n.callee.object || {}).name, pr = (n.callee.property || {}).name;
    if (o === 'Date' && pr === 'parse') return true;
    if (pr === 'getTime' || pr === 'valueOf') return true;
  }
  if (n.type === 'BinaryExpression' || n.type === 'LogicalExpression') {
    return bewaardMoment(n.left) || bewaardMoment(n.right);
  }
  return false;
}

/* Vermenigvuldigen met een tijdseenheid maakt van een getal een AFSTAND op de
   kalender: `dagen() * 86400000` is geen duur maar hoeveel je terugtelt. */
function kalenderafstand(n) {
  if (!n || n.type !== 'BinaryExpression' || n.operator !== '*') return false;
  for (const kant of [n.left, n.right]) {
    if (!kant) continue;
    const rauw = String(kant.raw === undefined ? kant.value : kant.raw);
    if ((kant.type === 'Literal' || kant.type === 'NumericLiteral') && TIJDSEENHEID.has(rauw)) return true;
  }
  return false;
}

function alleenGetallen(n) {
  if (!n) return false;
  if (n.type === 'Literal' || n.type === 'NumericLiteral') {
    return /^[\d._]+(e[+-]?\d+)?$/i.test(String(n.raw === undefined ? n.value : n.raw));
  }
  if (n.type === 'BinaryExpression') return alleenGetallen(n.left) && alleenGetallen(n.right);
  if (n.type === 'UnaryExpression') return alleenGetallen(n.argument);
  return false;
}

function scanBestand(bron, relPad) {
  const boom = parse(bron);
  const kandidaat = new Map();
  for (const k of boom.body) {
    if (k.type !== 'VariableDeclaration') continue;
    for (const d of k.declarations || []) {
      if (!d.id || d.id.type !== 'Identifier') continue;
      if (k.kind === 'let' || k.kind === 'var') {
        kandidaat.set(d.id.name, { soort: 'binding', kind: k.kind, lijn: k.lijn, altijd: true });
        continue;
      }
      const init = d.init;
      if (!init) continue;
      if (init.type === 'NewExpression' && CONTAINER.test((init.callee || {}).name || '')) {
        kandidaat.set(d.id.name, { soort: init.callee.name.toLowerCase(), lijn: k.lijn });
      } else if (init.type === 'ArrayExpression') kandidaat.set(d.id.name, { soort: 'array', lijn: k.lijn });
      else if (init.type === 'ObjectExpression') kandidaat.set(d.id.name, { soort: 'object', lijn: k.lijn });
    }
  }

  /* Twee verzamelingen en niet een: waar wordt er geschreven?

     Een wortel die alleen TIJDENS HET LADEN wordt geschreven -- op moduleniveau,
     dus voordat er ook maar iets van de server draait -- staat daarna vast. Dat
     is geen aanname maar een eigenschap van de code, en hij is statisch te zien.
     Zulke wortels zijn `bootvast`: ze kosten geen serverstart, want er valt niets
     te herstellen. Wordt er ook binnen een functie geschreven, dan kan het na de
     boot nog bewegen en moet een mens zeggen wat dat betekent. */
  const gemuteerd = new Set();
  const gemuteerdNaLaden = new Set();
  const klok = { datumLezing: 0, datumBouw: 0, dateNow: 0, hrtime: 0, perf: 0 };
  const willekeur = { math: 0, crypto: 0 };
  let timers = 0, listeners = 0, envSchrijf = 0, globalSchrijf = 0;
  let duurOpWandklok = 0;

  loop(boom, (n, pad) => {
    if (n.type === 'CallExpression' && n.callee && n.callee.type === 'MemberExpression') {
      const o = n.callee.object, pr = n.callee.property || {};
      if (o && o.type === 'Identifier' && MUTMETHODE.test(pr.name || '')) {
        gemuteerd.add(o.name);
        if (inFunctie(pad)) gemuteerdNaLaden.add(o.name);
      }
      /* Object.assign(doel, ...) muteert zijn EERSTE argument; dat is een
         schrijfactie die je anders mist omdat er geen puntmethode op staat. */
      if (o && o.type === 'Identifier' && o.name === 'Object' && pr.name === 'assign') {
        const eerste = (n.arguments || [])[0];
        if (eerste && eerste.type === 'Identifier') {
          gemuteerd.add(eerste.name);
          if (inFunctie(pad)) gemuteerdNaLaden.add(eerste.name);
        }
      }
      const on = (o || {}).name;
      if (on === 'Date' && pr.name === 'now') klok.dateNow++;
      if (on === 'process' && pr.name === 'hrtime') klok.hrtime++;
      if (on === 'performance' && pr.name === 'now') klok.perf++;
      if (on === 'Math' && pr.name === 'random') willekeur.math++;
      if (on === 'crypto' && /^(randomBytes|randomUUID|randomInt|randomFillSync)$/.test(pr.name || '')) willekeur.crypto++;
    }
    if (n.type === 'AssignmentExpression' && n.left) {
      const l = n.left;
      if (l.type === 'Identifier') {
        gemuteerd.add(l.name);
        if (inFunctie(pad)) gemuteerdNaLaden.add(l.name);
      }
      if (l.type === 'MemberExpression' && l.object) {
        if (l.object.type === 'Identifier') {
          gemuteerd.add(l.object.name);
          if (inFunctie(pad)) gemuteerdNaLaden.add(l.object.name);
        }
        const o = l.object;
        const pad2 = o.type === 'MemberExpression'
          ? ((o.object || {}).name || '') + '.' + ((o.property || {}).name || '') : (o.name || '');
        if (pad2 === 'process.env') envSchrijf++;
        if (pad2 === 'globalThis' || pad2 === 'global') globalSchrijf++;
      }
    }
    if (n.type === 'UpdateExpression' && n.argument && n.argument.type === 'Identifier') {
      gemuteerd.add(n.argument.name);
      if (inFunctie(pad)) gemuteerdNaLaden.add(n.argument.name);
    }

    /* new Date() LEEST de klok; new Date(x) bouwt er een uit iets bestaands.
       Dat verschil is de helft van de census. */
    if (n.type === 'NewExpression' && n.callee && n.callee.name === 'Date') {
      if ((n.arguments || []).length) klok.datumBouw++; else klok.datumLezing++;
    }
    if (n.type === 'BinaryExpression' && n.operator === '-' && (isDateNow(n.left) || isDateNow(n.right))) {
      const ander = isDateNow(n.left) ? n.right : n.left;
      // alleen wat ECHT naar de monotone klok kan: geen kalenderrekenen, en niet
      // de leeftijd van een moment dat in de opslag staat
      if (!alleenGetallen(ander) && !kalenderafstand(ander) && !bewaardMoment(ander)) duurOpWandklok++;
    }
    if (!inFunctie(pad) && n.type === 'CallExpression' && n.callee) {
      const c = n.callee;
      const naam = c.type === 'Identifier' ? c.name : (c.type === 'MemberExpression' ? ((c.property || {}).name || '') : '');
      if (/^(setInterval|setTimeout)$/.test(naam)) timers++;
      if (/^(on|once|addListener)$/.test(naam)) listeners++;
    }
  });

  const wortels = [];
  for (const [naam, info] of kandidaat) {
    if (!info.altijd && !gemuteerd.has(naam)) continue;   // vaste tabel, geen toestand
    wortels.push({
      id: relPad + '#' + naam,
      bestand: relPad,
      naam,
      soort: info.soort === 'binding' ? 'binding-' + info.kind : info.soort,
      lijn: info.lijn || 0,
      /* Alleen bij het laden geschreven = na de boot vast. Dat is bewijs uit de
         code en geen classificatie door een mens; scripts/staat.js mag hem
         daarom vanzelf op `bootvast` zetten. */
      naLaden: gemuteerdNaLaden.has(naam),
      bron: 'scan'
    });
  }
  return { wortels, klok, willekeur, timers, listeners, envSchrijf, globalSchrijf, duurOpWandklok };
}

/* WIE ZET DEZE WORTEL TERUG? -- de vraag die van een reset een contract maakt.

   STATE.json laat een mens per wortel `herstelbaar` invullen met een reset
   erbij: "log.foutenReset()". Dat is tot hier een ZIN. Of die functie de wortel
   ook echt aanraakt staat er niet, en niemand merkt het als iemand er later een
   regel uit haalt.

   Dat is geen theoretisch gat. Ik schreef een resetcontract voor server/log.js
   dat met zoveel woorden beweerde de volgteller mee te nemen ("de volgteller
   mag ook niet doorlopen"), en toen ik `foutVolg = 0` uit foutenReset() sloopte
   bleef de toets groen. De reden is dat foutVolg alleen de VOLGORDE van groepen
   bepaalt en nergens naar buiten komt: aan de buitenkant is een doorlopende
   teller niet te zien. Een waarneembaarheidstoets kan dat dus niet bewijzen --
   niet omdat ik hem slecht schreef, maar omdat het bewijs daar niet ligt.

   Het ligt in de bron. Deze functie zegt, per moduleniveau-binding, binnen
   WELKE functies er in die binding geschreven wordt. Daarmee wordt "reset:
   log.foutenReset()" een controleerbare bewering: staat foutVolg niet in de
   schrijvers van foutenReset, dan is het register een leugen en gaat de poort
   rood. Haal de regel weg en het is meteen te zien.

   Toegerekend aan ALLE omsluitende functies, niet alleen de dichtstbijzijnde:
   een reset die zijn werk in een hulpfunctie of een callback doet, doet het nog
   steeds. Liever een schrijver te veel dan een rood die niet klopt. */
function functienaamOp(pad, i) {
  const fn = pad[i];
  if (fn.id && fn.id.name) return fn.id.name;
  const ouder = pad[i - 1];
  if (!ouder) return null;
  if (ouder.type === 'VariableDeclarator' && ouder.id && ouder.id.name) return ouder.id.name;
  if ((ouder.type === 'Property' || ouder.type === 'MethodDefinition') && ouder.key) {
    return ouder.key.name || ouder.key.value || null;
  }
  if (ouder.type === 'AssignmentExpression' && ouder.left) {
    const l = ouder.left;
    if (l.type === 'Identifier') return l.name;
    if (l.type === 'MemberExpression' && l.property) return l.property.name || null;
  }
  return null;
}

function omsluitendeFuncties(pad) {
  const uit = [];
  for (let i = 0; i < pad.length; i++) {
    if (!/Function/.test(pad[i].type)) continue;
    const naam = functienaamOp(pad, i);
    if (naam) uit.push(naam);
  }
  return uit;
}

/* { wortelnaam -> Set(functienamen die erin schrijven) }, plus de functienamen
   die het bestand uberhaupt kent. Dat tweede is nodig om onderscheid te maken
   tussen "de reset raakt de wortel niet aan" en "de reset bestaat hier niet",
   en dat zijn twee verschillende fouten met twee verschillende reparaties.

   EN APART: WIE ZEGT ER EEN TIMER AF. Dat is niet hetzelfde als erin schrijven,
   en het verschil kostte me een mutatie. Een reset die `saveTimer = null` doet
   zonder clearTimeout haalt alleen het handvat weg; de timer zelf blijft staan
   en vuurt gewoon, met de save-functie van de vorige eigenaar in de hand. Voor
   de schrijvers-tabel is dat een keurige schrijfactie, dus die keurde het goed
   -- en het gedrag kon het niet zien, want de reset schrijft openstaand werk al
   weg en dan doet de wees niets meer. Vandaar deze tweede tabel: bij een wortel
   met vorm `timer` eist scripts/staat.js hierop, niet op schrijvers. */
function schrijversIn(bron, relPad) {
  const boom = parse(bron);
  const schrijvers = new Map();
  const afgezegd = new Map();
  const functies = new Set();
  const noteer = (naam, pad) => {
    if (!schrijvers.has(naam)) schrijvers.set(naam, new Set());
    for (const f of omsluitendeFuncties(pad)) schrijvers.get(naam).add(f);
  };
  const noteerAfgezegd = (naam, pad) => {
    if (!afgezegd.has(naam)) afgezegd.set(naam, new Set());
    for (const f of omsluitendeFuncties(pad)) afgezegd.get(naam).add(f);
  };
  loop(boom, (n, pad) => {
    if (/Function/.test(n.type)) {
      const naam = functienaamOp(pad.concat(n), pad.length);
      if (naam) functies.add(naam);
    }
    if (n.type === 'AssignmentExpression' && n.left) {
      if (n.left.type === 'Identifier') noteer(n.left.name, pad);
      if (n.left.type === 'MemberExpression' && n.left.object && n.left.object.type === 'Identifier') {
        noteer(n.left.object.name, pad);
      }
    }
    if (n.type === 'UpdateExpression' && n.argument && n.argument.type === 'Identifier') noteer(n.argument.name, pad);
    if (n.type === 'CallExpression' && n.callee && n.callee.type === 'Identifier'
        && /^clear(Timeout|Interval|Immediate)$/.test(n.callee.name)) {
      const eerste = (n.arguments || [])[0];
      if (eerste && eerste.type === 'Identifier') noteerAfgezegd(eerste.name, pad);
    }
    if (n.type === 'CallExpression' && n.callee && n.callee.type === 'MemberExpression') {
      const o = n.callee.object, pr = n.callee.property || {};
      if (o && o.type === 'Identifier' && MUTMETHODE.test(pr.name || '')) noteer(o.name, pad);
      if (o && o.type === 'Identifier' && o.name === 'Object' && pr.name === 'assign') {
        const eerste = (n.arguments || [])[0];
        if (eerste && eerste.type === 'Identifier') noteer(eerste.name, pad);
      }
    }
  });
  return { bestand: relPad, functies, schrijvers, afgezegd };
}

/* De hele boom. Een bestand dat de eigen parser niet leest is GEEN nul: dat
   wordt geteld en genoemd, want een scanner die stil overslaat meet niets
   (LAT-regel 3). */
/* DE CENSUS KOMT UIT DE BRONKAS ALS DE BRON NIET VERANDERD IS.

   Een volledige scan ontleedt 2202 bestanden en kost 2,7 seconde. Dat is prima
   voor `npm run staat`, maar hij zit ook in norm.meet(), en die wordt tijdens
   de meterijking een stuk of tien keer aangeroepen -- op steeds een ANDERE boom,
   want dat is precies wat een ijking doet. Zonder geheugen kostte dat 54
   seconden extra op de ronde, en dat was schuld die ik met de zichtbaarheid
   zelf had gemaakt.

   De sleutel is dezelfde als bij de andere afnemers: een sha256 over de INHOUD
   van elk gescand bestand plus over de broncode van deze scanner. Verandert er
   een byte -- en tijdens een ijking verandert er met opzet een byte -- dan is de
   sleutel anders en wordt er opnieuw geteld. Een ijking kan hier dus niet op
   een oude uitslag stranden; dat is geen belofte maar een gevolg van de sleutel.

   De kas ligt in server/lib omdat de server hem ook gebruikt. Dat scripts/ uit
   server/ leest is hier de bestaande richting (check.js, a11y.js en beproeving.js
   doen het ook); andersom zou het niet mogen. */
function scan({ wortel, mappen } = {}) {
  wortel = wortel || path.join(__dirname, '..', '..');
  mappen = mappen || ['server'];
  let kas = null;
  try { kas = require('../../server/lib/bronkas'); } catch (e) { kas = null; }
  if (kas) {
    /* `vers`: deze scanner draait ook tijdens de meterijking, die de bron met
       opzet verandert en daarna opnieuw meet in HETZELFDE proces. Een onthouden
       manifest zou dan een sleutel geven die niet is meebewogen, en dan komt de
       OUDE census uit de kas. Zie de kop bij manifestVan. */
    const delen = mappen.map(m => kas.manifestVan(path.join(wortel, m), (p) => p.endsWith('.js'), 'staat', { vers: true }));
    delen.push(kas.leesVersie([__filename]), mappen.join('|'));
    return kas.geheugen({
      naam: 'staatcensus', sleutel: kas.sleutelUit(delen),
      bereken: () => scanEcht(wortel, mappen),
      naarTekst: (u) => JSON.stringify(u),
      /* Een census zonder wortels is geen census maar een mislukking; dan rekent
         de kas liever opnieuw dan een lege uitslag op te dienen (LAT-regel 3). */
      vanTekst: (t) => { const u = JSON.parse(t); return (u && Array.isArray(u.wortels)) ? u : null; }
    });
  }
  return scanEcht(wortel, mappen);
}

function scanEcht(wortel, mappen) {
  const uit = {
    wortels: [], onleesbaar: [], bestanden: 0,
    klok: { datumLezing: 0, datumBouw: 0, dateNow: 0, hrtime: 0, perf: 0 },
    willekeur: { math: 0, crypto: 0 }, timers: 0, listeners: 0, envSchrijf: 0, globalSchrijf: 0, duurOpWandklok: 0
  };
  for (const map of mappen) {
    for (const p of bestandenOnder(path.join(wortel, map)).sort()) {
      const rel = path.relative(wortel, p).split(path.sep).join('/');
      uit.bestanden++;
      let bron;
      try { bron = fs.readFileSync(p, 'utf8'); } catch (e) { uit.onleesbaar.push(rel); continue; }
      let deel;
      try { deel = scanBestand(bron, rel); } catch (e) { uit.onleesbaar.push(rel); continue; }
      uit.wortels.push(...deel.wortels);
      for (const k of Object.keys(uit.klok)) uit.klok[k] += deel.klok[k];
      uit.willekeur.math += deel.willekeur.math;
      uit.willekeur.crypto += deel.willekeur.crypto;
      uit.timers += deel.timers;
      uit.listeners += deel.listeners;
      uit.envSchrijf += deel.envSchrijf;
      uit.globalSchrijf += deel.globalSchrijf;
      uit.duurOpWandklok += deel.duurOpWandklok;
    }
  }
  uit.wortels.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  /* De ECHTE kloklezingen: alles wat de wandklok of een teller AFLEEST. Een
     new Date(x) hoort daar niet bij en zit daarom apart in `datumBouw`. */
  uit.klokLezingen = uit.klok.datumLezing + uit.klok.dateNow + uit.klok.hrtime + uit.klok.perf;
  return uit;
}

/* De eigenaar is standaard de map waarin de wortel woont. Dat is geen
   verzinsel maar de enige verdedigbare standaard: wie hem declareert bezit hem,
   tot een mens iets anders opschrijft. Twee mappen diep, want `server/kern` en
   `server/db` zeggen iets en `server` alleen niet. */
function eigenaarVan(relPad) {
  const delen = relPad.split('/');
  return delen.slice(0, Math.min(2, delen.length - 1)).join('/') || 'server';
}

module.exports = { scan, scanBestand, schrijversIn, bestandenOnder, eigenaarVan, MUTMETHODE };
