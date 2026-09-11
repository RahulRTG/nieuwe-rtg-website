#!/usr/bin/env node
/* DE CANONIEKE LUSINDEX -- elke cyclische gedraging van dit huis krijgt EEN
   identiteit, EEN vorm, EEN terminatiegraad en het bewijs dat er AL over ligt.

   WAAROM DIT GEEN ZEVENDE TELLER IS. Er lagen vier losse signalen over lussen:
   de event-loopmeting (server/meting-lus.js), de wekkers (scripts/wekkers.js),
   de domeinlussen in de ketenproeven, en een handmatige telling van
   sleutelwoordlussen. Vier tellingen over hetzelfde onderwerp die elkaar niet
   kennen, zijn geen meting maar vier meningen. Dit register geeft ze een
   gedeelde identiteit zodat bewijs dat ergens anders al is geleverd, hier kan
   worden AANGEHAALD in plaats van overgedaan.

   DE ASSEN WORDEN NIET OPGETELD, en dat is de belangrijkste regel hier.
   Een `for (const x of lijst)` en een `lijst.map(...)` zijn allebei iteratie,
   maar een `.map` over drie elementen is iets anders dan een `while` over
   invoer van buiten. Ze staan daarom in KOLOMMEN naast elkaar. Een enkel getal
   "23.000 lussen, 22.981 groen" verbergt precies welke as bewoog -- hetzelfde
   bezwaar dat BEWIJSMACHINE.md tegen een samengesteld entropiecijfer maakt.

   DE IDENTITEIT DRAAGT GEEN REGELNUMMER. Een lus die drie regels naar beneden
   schuift is dezelfde lus; een LoopID op regelnummer zou bij elke opmaakronde
   het hele register verversen en daarmee elk hergebruik van bewijs weggooien.
   De sleutel is daarom bestand + omsluitend symbool + een STRUCTUURHASH van de
   lus zelf (de boom met regel-, start- en eindvelden eruit). Het regelnummer
   staat er wel BIJ, want je moet hem kunnen vinden -- het is alleen geen deel
   van de sleutel.

   RISICO IS EEN VECTOR EN GEEN PRODUCT. De verleiding is een formule als
   `risico = terminatie x groei x nesting x neveneffect x kritiek domein`. Dat
   kan hier niet: drie van die vijf factoren zijn vandaag niet gemeten, en een
   onbekende factor die je als 1 invult, betekent stilzwijgend "geen risico".
   Dat is de fout die KOSTEN.md met zoveel woorden verbiedt -- er staat nooit
   een getal waar er geen is. Elke lus draagt daarom zijn factoren APART, plus
   een klasse die uit expliciete regels volgt, mét de opbouw die hem zette.

   WAT ER MET OPZET NIET IN ZIT. Er is geen graad `runtimeBegrensd` en geen
   `bewezenOnbegrensd`. Niet omdat ze niet bestaan, maar omdat geen enkele
   meting in dit huis ze vandaag kan ZETTEN: de eerste vraagt een looptijdproef
   per lus, de tweede een tegenvoorbeeld. Een graad die niets kan bereiken, is
   geen graad -- dezelfde reden waarom de herstelproef zijn opwarmronde draait.
   Wat ontbreekt staat in `nogNietTeZetten` met de reden erbij.

   DE BOOM. De index gaat over server/ + public/: de code die bij een lid
   draait. scripts/ en test/ worden GETELD maar niet geïndexeerd, en dat getal
   wordt nooit bij het andere opgeteld -- een hangende lus in een meter is een
   hangende CI en niet een hangende gebruiker. Zelfde vorm als zuiver/beproefd
   in de tredeproef.

   Draaien: npm run lussen -> LUSSEN.json */
'use strict';

/* DE WACHT. Dit script rekent en SCHRIJFT bij het laden. Requiren doet dus
   niets -- exact de fout waarmee ROLPROEF.json van 3377 beproefde routes
   terugviel naar 292, en het register zag er daarna volkomen normaal uit. */
if (require.main !== module) return;

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');
const { parse } = require('./ast/parser');
const { loop: wandel } = require('./ast/walk');
/* De indeling zelf woont in scripts/lib/lusvorm.js: die raakt geen schijf en is
   daardoor toetsbaar zonder dit register te overschrijven. */
const {
  LUSKNOPEN, ITERATORS, FUNCTIEKNOPEN, structuurhash, symbooolVan, inEigenLijf,
  vormVan, terminatieVan, effectenVan, domeinVan, risicoVan, overlapRemVan, soortVan,
  sterkeComponenten, eindigeRij, KRITIEKE_DOMEINEN
} = require('./lib/lusvorm');

const WORTEL = path.join(__dirname, '..');
const BOMEN = ['server', 'public'];
const BUITEN_INDEX = ['scripts', 'test'];

/* Bundeldelen zijn geen zelfstandige bestanden: ze beginnen middenin een
   functie en vormen pas samengevoegd een programma. Ze worden BENOEMD en niet
   stil overgeslagen -- anders verdwijnen er 310 bestanden uit beeld. */
let BUNDELDELEN = new Set();
try {
  const { bundels } = require('./bundel');
  for (const map of Object.values(bundels)) BUNDELDELEN.add('public/' + map);
} catch (e) { /* geen bundelregister: dan is elk fragment gewoon een leesfout */ }
const isBundeldeel = rel => [...BUNDELDELEN].some(m => rel.startsWith(m + '/'));

function bestanden(map) {
  const uit = [];
  (function lees(d) {
    let ent;
    try { ent = fs.readdirSync(path.join(WORTEL, d), { withFileTypes: true }); } catch (e) { return; }
    for (const e of ent) {
      if (e.name === 'node_modules' || e.name === 'data' || e.name === 'dist' || e.name.startsWith('.')) continue;
      const rel = d + '/' + e.name;
      if (e.isDirectory()) lees(rel); else if (e.name.endsWith('.js')) uit.push(rel);
    }
  })(map);
  return uit.sort();
}

/* ---------------------------------------------------------------------------
   DE HOOFDRONDE. */
const perLus = [];
const callbackGeteld = { totaal: 0, geindexeerd: 0, perNaam: {} };
const timers = [];
const parsefouten = [];
const directRecursief = [];
const eigenRequires = new Map();
let bestandenGelezen = 0, bundeldelen = 0;

for (const boom of BOMEN) {
  for (const rel of bestanden(boom)) {
    const bron = fs.readFileSync(path.join(WORTEL, rel), 'utf8');
    let ast;
    try { ast = parse(bron); }
    catch (e) {
      if (isBundeldeel(rel)) bundeldelen++;
      else parsefouten.push({ bestand: rel, melding: e.message });
      continue;
    }
    bestandenGelezen++;
    const gezienIndex = new Map();   // structuurhash -> volgnummer binnen hetzelfde symbool

    /* EIGEN REQUIRE-KANTEN, UIT DE AST. Ze komen met opzet NIET uit
       SYMBOLEN.json: dat register leest requires met een reguliere uitdrukking
       over de ruwe bron, en pikt daardoor de require op die in een KOPCOMMENTAAR
       als gebruiksvoorbeeld staat. Drie bestanden (server/rem.js,
       server/anthropic.js, server/stripe.js) requiren zichzelf volgens dat
       register, en doen dat in werkelijkheid nergens. Een kring die op zo'n kant
       rust, is een BESCHULDIGING zonder grond -- en dat is exact de fout die de
       herstelproef met `geen-herstel` een keer bijna maakte. Vandaar hier de
       boom, waar een commentaar niet in staat. */
    const mijnRequires = [];

    wandel(ast, (n, pad) => {
      /* --- as 1: sleutelwoordlussen --- */
      if (LUSKNOPEN.has(n.type)) {
        const symbool = symbooolVan(pad);
        const hash = structuurhash(n);
        const sleutel = rel + '#' + (symbool || '<top>') + '@' + hash;
        const volg = (gezienIndex.get(sleutel) || 0) + 1;
        gezienIndex.set(sleutel, volg);

        const vorm = vormVan(n);
        const terminatie = terminatieVan(n, vorm);
        const effecten = effectenVan(n);
        let metAwait = false;
        inEigenLijf(n, k => { if (k.type === 'AwaitExpression') metAwait = true; });
        const nesting = pad.filter(p => LUSKNOPEN.has(p.type)).length;
        const soort = soortVan(n, vorm, terminatie);
        const risico = risicoVan(n, rel, vorm, terminatie, effecten, nesting, metAwait, soort);

        perLus.push({
          id: 'LUS:' + sleutel + (volg > 1 ? '#' + volg : ''),
          as: 'syntactisch',
          bestand: rel, symbool, lijn: n.lijn || null, soort: n.type,
          begrenzing: vorm.begrenzing, begrenzingReden: vorm.reden,
          terminatie: terminatie.graad, terminatieGrond: terminatie.grond, onbekendReden: terminatie.code || null,
          lussoort: soort.lussoort, voortgang: soort.voortgang,
          await: metAwait, nesting, effecten,
          domein: risico.domein, risico: risico.klasse, risicoOpbouw: risico.opbouw
        });
      }

      /* --- as 2: iteratie via een callback --- */
      if (n.type === 'CallExpression' && n.callee && n.callee.type === 'MemberExpression'
          && n.callee.property && ITERATORS.includes(n.callee.property.name)) {
        const cb = (n.arguments || [])[0];
        if (!cb || !FUNCTIEKNOPEN.has(cb.type)) return;   // .sort() zonder callback is geen iteratie van ons
        const naam = n.callee.property.name;
        callbackGeteld.totaal++;
        callbackGeteld.perNaam[naam] = (callbackGeteld.perNaam[naam] || 0) + 1;

        /* WAAROM NIET ALLEMAAL GEINDEXEERD. Een `.map(x => x.naam)` over drie
           elementen draagt geen enkele vraag; hem indexeren zou het register
           verviervoudigen en de lijst onbruikbaar maken voor de mens die hem
           moet afwerken. Wat WEL wordt geindexeerd is de callback die iets
           doet: async, met een effect, of binnen een andere lus. De rest staat
           als GETELD in de uitslag -- zichtbaar, en niet als dekking. */
        let heeftAwait = false, effect = [];
        wandel(cb.body, k => { if (k.type === 'AwaitExpression') heeftAwait = true; });
        effect = effectenVan({ body: cb.body });
        const inLus = pad.some(p => LUSKNOPEN.has(p.type));
        const interessant = cb.async || heeftAwait || effect.length > 0 || inLus;
        if (!interessant) return;

        callbackGeteld.geindexeerd++;
        const symbool = symbooolVan(pad);
        const hash = structuurhash(n);
        const sleutel = rel + '#' + (symbool || '<top>') + '@' + hash;
        const volg = (gezienIndex.get(sleutel) || 0) + 1;
        gezienIndex.set(sleutel, volg);

        /* GELIJKTIJDIGHEID is hier de eigenlijke vraag, en die staat los van
           terminatie: `await Promise.all(items.map(save))` eindigt gegarandeerd
           en kan toch 200.000 verbindingen tegelijk openen. Een meter die
           alleen "await in een lus" roept, ziet juist dat geval niet. */
        const ouder = pad[pad.length - 1];
        const inPromiseAll = pad.some(p => p.type === 'CallExpression' && p.callee
          && p.callee.type === 'MemberExpression' && p.callee.object && p.callee.object.name === 'Promise'
          && p.callee.property && ['all', 'allSettled', 'race', 'any'].includes(p.callee.property.name));
        const gelijktijdig = (cb.async || heeftAwait) && inPromiseAll
          ? 'ONBEGRENSD_GELIJKTIJDIG'
          : ((cb.async || heeftAwait) ? 'SEQUENTIEEL_OF_LOSGELATEN' : 'SYNCHROON');

        perLus.push({
          id: 'LUS:' + sleutel + (volg > 1 ? '#' + volg : ''),
          as: 'callback',
          bestand: rel, symbool, lijn: n.lijn || null, soort: naam + '()',
          begrenzing: eindigeRij(n.callee.object) ? 'EINDIGE_RIJ' : 'COLLECTIE',
          begrenzingReden: null,
          terminatie: eindigeRij(n.callee.object) ? 'bewezenBegrensd' : 'aannemelijkBegrensd',
          terminatieGrond: 'een callback-iteratie loopt over de lengte van de bron; oneindig kan alleen bij een oneindige bron',
          onbekendReden: null, lussoort: 'eindig', voortgang: 'nietVanToepassing',
          await: heeftAwait || !!cb.async, nesting: pad.filter(p => LUSKNOPEN.has(p.type)).length,
          effecten: effect, gelijktijdigheid: gelijktijdig,
          domein: domeinVan(rel),
          risico: (gelijktijdig === 'ONBEGRENSD_GELIJKTIJDIG' && (effect.length || KRITIEKE_DOMEINEN.has(domeinVan(rel)))) ? 'hoog'
            : (effect.length || inLus ? 'midden' : 'laag'),
          risicoOpbouw: [gelijktijdig === 'ONBEGRENSD_GELIJKTIJDIG' ? 'gelijktijdigheid: onbegrensd' : null,
            effect.length ? 'neveneffect: ' + effect.join('+') : null, inLus ? 'binnen een andere lus' : null].filter(Boolean)
        });
      }

      if (n.type === 'CallExpression' && n.callee && n.callee.name === 'require'
          && (n.arguments || [])[0] && n.arguments[0].type === 'Literal' && n.arguments[0].kind === 'string') {
        const doel = n.arguments[0].raw.slice(1, -1);
        if (doel.startsWith('.')) {
          let q = path.normalize(path.join(path.dirname(rel), doel));
          if (!q.endsWith('.js')) q += '.js';
          if (fs.existsSync(path.join(WORTEL, q))) mijnRequires.push(q);
          else { const idx = q.replace(/\.js$/, '/index.js'); if (fs.existsSync(path.join(WORTEL, idx))) mijnRequires.push(idx); }
        }
      }

      /* --- as 3: directe recursie --- */
      if ((n.type === 'FunctionDeclaration' || n.type === 'FunctionExpression') && n.id && n.id.name) {
        let zelf = false;
        wandel(n.body, k => { if (k.type === 'CallExpression' && k.callee && k.callee.name === n.id.name) zelf = true; });
        if (zelf) directRecursief.push({ bestand: rel, symbool: n.id.name, lijn: n.lijn || null });
      }

      /* --- as 6: wekkers. setInterval is de bekende; een setTimeout die
         zichzelf opnieuw zet is net zo goed een lus en staat in geen enkele
         telling van `setInterval`. --- */
      if (n.type === 'CallExpression' && n.callee && (n.callee.name === 'setInterval' || n.callee.name === 'setTimeout')) {
        const arg = (n.arguments || [])[0];
        const periode = (n.arguments || [])[1];
        let asyncCallback = false;
        if (arg && FUNCTIEKNOPEN.has(arg.type)) { asyncCallback = !!arg.async; wandel(arg.body, k => { if (k.type === 'AwaitExpression') asyncCallback = true; }); }
        const omsluitend = symbooolVan(pad);
        const herzet = n.callee.name === 'setTimeout' && arg && arg.type === 'Identifier' && arg.name === omsluitend;
        if (n.callee.name === 'setInterval' || herzet) {
          timers.push({
            bestand: rel, lijn: n.lijn || null, soort: n.callee.name === 'setInterval' ? 'setInterval' : 'setTimeout-herzet',
            symbool: omsluitend,
            periodeMs: periode && periode.type === 'Literal' ? Number(periode.raw) || null : null,
            asyncCallback,
            /* DE OVERLAPVRAAG. Draait de callback langer dan de periode, dan
               lopen uitvoeringen over elkaar heen. Of dat GEBEURT is hier niet
               te zien -- wel of er iets is dat het tegenhoudt. */
            overlapRem: overlapRemVan(arg, asyncCallback)
          });
        }
      }
    });
    eigenRequires.set(rel, [...new Set(mijnRequires)]);
  }
}

/* ---------------------------------------------------------------------------
   DE KRINGEN, uit de bestaande graven. */
const aanroepgraaf = JSON.parse(fs.readFileSync(path.join(WORTEL, 'AANROEPGRAAF.json'), 'utf8'));
const symbolen = JSON.parse(fs.readFileSync(path.join(WORTEL, 'SYMBOLEN.json'), 'utf8'));

const symbKnopen = new Set(), symbBuren = new Map();
for (const k of aanroepgraaf.kanten) {
  const van = k.vanBestand + '#' + k.van, naar = k.naarBestand + '#' + k.naar;
  symbKnopen.add(van); symbKnopen.add(naar);
  if (!symbBuren.has(van)) symbBuren.set(van, []);
  symbBuren.get(van).push(naar);
}
const wederzijds = sterkeComponenten([...symbKnopen], k => symbBuren.get(k))
  .filter(g => g.length > 1)
  .sort((a, b) => b.length - a.length);

const modKnopen = new Set(), modBuren = new Map();
for (const [bestand, r] of eigenRequires) {
  modKnopen.add(bestand);
  for (const x of r) modKnopen.add(x);
  modBuren.set(bestand, r);
}
/* HET VERSCHIL MET HET REGISTER, geteld en niet verzwegen. Zolang symbolen.js
   zijn requires lexicaal leest, staat hier een afwijking; verdwijnt die naar
   nul, dan is dat register gerepareerd. */
let kantenAlleenInRegister = 0;
for (const b of symbolen.perBestand) {
  const mijn = new Set(eigenRequires.get(b.bestand) || []);
  for (const x of (b.requires || [])) if (!mijn.has(x)) kantenAlleenInRegister++;
}
const moduleKringen = sterkeComponenten([...modKnopen], k => modBuren.get(k))
  .sort((a, b) => b.length - a.length);

/* ---------------------------------------------------------------------------
   HET BEWIJS DAT ER AL LIGT. Dit is de kern van de opzet: niet opnieuw testen
   wat elders al beproefd is, maar dat bewijs AANHALEN. De ketting is
   lus -> symbool -> route -> vervalstaat, en elke schakel bestaat al.

   DE BRUG IS NIET VOLLEDIG EN DAT STAAT IN DE UITSLAG. 2.585 van de 2.987
   routes uit AANROEPGRAAF.json vinden een vervalstaat in VERTROUWEN.json; de
   overige 400 staan onder een ander voorvoegsel gemonteerd of komen uit een
   register van een andere leeftijd. Een brug van 86% als 100% presenteren is
   precies de fout die CODE.md par. 0.3 bij het bronbereik beschrijft. */
const vertrouwen = JSON.parse(fs.readFileSync(path.join(WORTEL, 'VERTROUWEN.json'), 'utf8'));
const symbNaarRoutes = new Map();
for (const r of aanroepgraaf.routeNaarSymbool) {
  for (const s of r.symbolen || []) {
    if (!symbNaarRoutes.has(s)) symbNaarRoutes.set(s, []);
    symbNaarRoutes.get(s).push(r.route);
  }
}
const RANG = { bewezen: 4, verschaald: 3, verzwakt: 2, geschorst: 1, ongemeten: 0 };

/* BEREIKBAARHEID, want een directe treffer is bijna nooit de plek waar de lus
   staat. Een route noemt de handler; de lus staat drie aanroepen dieper in een
   hulpfunctie. Direct matchen gaf 179 van de 6.092 lussen een bewijsveld -- 3%,
   en dat is geen aggregator maar een toevalstreffer.

   Daarom een doorloop over de aanroepgraaf vanaf elk routesymbool. Twee dingen
   houden dat eerlijk. Ten eerste: het bewijs heet dan `viaAanroepgraaf` en
   nooit `direct`, want die graaf lost 25,8% van de aanroepen op (CODE.md par.
   0.3) -- bereikbaarheid erin is een ONDERGRENS en de afwezigheid ervan bewijst
   niets. Ten tweede: de afstand staat erbij. Bewijs dat zeven aanroepen verderop
   is geleverd, zegt minder over deze lus dan bewijs op de handler zelf, en wie
   dat verschil wegpoetst, bouwt precies de geruststelling die PROOF.md verbiedt.

   De volgorde is ZWAKSTE ROUTE EERST. Wordt een symbool door twee routes
   bereikt, dan telt de zwakste -- dezelfde samenstelregel als hierboven, nu op
   de graaf. */
const buren = new Map();
for (const k of aanroepgraaf.kanten) {
  const van = k.vanBestand + '#' + k.van, naar = k.naarBestand + '#' + k.naar;
  if (!buren.has(van)) buren.set(van, []);
  buren.get(van).push(naar);
}
const bereik = new Map();   // symbool -> { staat, afstand, route }
const routesGesorteerd = [...aanroepgraaf.routeNaarSymbool].sort((a, b) => {
  const sa = vertrouwen.perRoute[a.route], sb = vertrouwen.perRoute[b.route];
  return (RANG[sa ? sa.staat : 'ongemeten'] || 0) - (RANG[sb ? sb.staat : 'ongemeten'] || 0);
});
for (const r of routesGesorteerd) {
  const v = vertrouwen.perRoute[r.route];
  const staat = v ? v.staat : 'ongemeten';
  let rand = (r.symbolen || []).filter(x => !bereik.has(x));
  for (const x of rand) bereik.set(x, { staat, afstand: 0, route: r.route });
  let afstand = 0;
  while (rand.length && afstand < 12) {
    afstand++;
    const volgende = [];
    for (const k of rand) for (const b of (buren.get(k) || [])) {
      if (bereik.has(b)) continue;
      bereik.set(b, { staat, afstand, route: r.route });
      volgende.push(b);
    }
    rand = volgende;
  }
}

let brugGevonden = 0, brugZonderRoute = 0, brugDirect = 0, brugViaGraaf = 0;
for (const l of perLus) {
  const sleutel = l.bestand + '#' + l.symbool;
  const routes = l.symbool ? (symbNaarRoutes.get(sleutel) || []) : [];
  if (!routes.length) {
    const via = l.symbool ? bereik.get(sleutel) : null;
    if (via) {
      l.bewijs = via.staat; l.bewijsHoe = 'viaAanroepgraaf'; l.bewijsAfstand = via.afstand; l.bewijsRoute = via.route;
      l.bewijsGrond = 'bereikbaar vanaf ' + via.route + ' in ' + via.afstand + ' aanroep(en); de graaf lost 25,8% van de aanroepen op, dus dit is een ondergrens';
      brugGevonden++; brugViaGraaf++; continue;
    }
    l.bewijs = 'geenRouteGevonden';
    l.bewijsGrond = 'geen route bereikt dit symbool in de aanroepgraaf -- dat kan betekenen dat hij niet via een route loopt, of dat de graaf de aanroep niet oploste';
    brugZonderRoute++; continue;
  }
  l.bewijsHoe = 'direct'; brugDirect++;
  /* HET ZWAKSTE BEWIJS TELT, want een keten is zo sterk als zijn zwakste
     schakel -- dezelfde samenstelregel als scripts/schermgedrag.js. */
  let zwakste = null, zwaksteRang = Infinity;
  for (const r of routes) {
    const v = vertrouwen.perRoute[r];
    const staat = v ? v.staat : 'ongemeten';
    const rang = RANG[staat] != null ? RANG[staat] : 0;
    if (rang < zwaksteRang) { zwaksteRang = rang; zwakste = staat; }
  }
  l.bewijs = zwakste; l.bewijsRoutes = routes.length;
  l.bewijsGrond = 'zwakste vervalstaat over ' + routes.length + ' route(s) die bij dit symbool uitkomen';
  brugGevonden++;
}

/* ---------------------------------------------------------------------------
   BUITEN DE INDEX. scripts/ en test/ worden geteld en niet geindexeerd. Het
   getal staat er zodat niemand denkt dat de index het hele huis dekt, en het
   wordt nooit bij het andere opgeteld: een hangende lus in een meter is een
   hangende CI, geen hangende gebruiker. */
const buitenIndex = {};
for (const boom of BUITEN_INDEX) {
  let n = 0, bestandenN = 0;
  for (const rel of bestanden(boom)) {
    let ast;
    try { ast = parse(fs.readFileSync(path.join(WORTEL, rel), 'utf8')); } catch (e) { continue; }
    bestandenN++;
    wandel(ast, k => { if (LUSKNOPEN.has(k.type)) n++; });
  }
  buitenIndex[boom] = { bestanden: bestandenN, sleutelwoordlussen: n };
}

const verdeling = (rijen, veld) => rijen.reduce((m, x) => { m[x[veld]] = (m[x[veld]] || 0) + 1; return m; }, {});
const syntactisch = perLus.filter(l => l.as === 'syntactisch');
const callbacks = perLus.filter(l => l.as === 'callback');

let commit = null;
try { commit = execSync('git rev-parse --short HEAD', { cwd: WORTEL }).toString().trim(); } catch (e) {}

const uit = {
  soort: 'index',
  uitleg: 'De canonieke lusindex: elke cyclische gedraging van server/ en public/ met EEN identiteit, EEN vorm, EEN terminatiegraad en het bewijs dat er al over ligt. De assen staan naast elkaar en worden nooit opgeteld.',
  stempel: { op: new Date().toISOString().slice(0, 10), commit },
  grens: 'Terminatie is onbeslisbaar: geen enkele graad hier betekent "bewezen veilig". `bewezenBegrensd` zegt dat de STRUCTUUR de afloop vastlegt, `uitwegAanwezig` dat er een uitweg STAAT zonder dat iemand zijn bereikbaarheid heeft getoetst. Neveneffect en domein zijn lexicaal afgeleid en dus een ONDERGRENS (graad vermoed). Het bewijsveld is geleend van de route waar het symbool bij uitkomt en zegt niets over de lus zelf.',
  nogNietTeZetten: [
    { graad: 'runtimeBegrensd', reden: 'vraagt een looptijdproef die per LoopID iteraties telt; er is vandaag geen instrumentatie die dat per lus kan.' },
    { graad: 'bewezenOnbegrensd', reden: 'vraagt een tegenvoorbeeld (een invoer die de lus aantoonbaar niet laat stoppen); scripts/sabotage.js kan wetten overtreden maar genereert geen tegenvoorbeelden.' },
    { veld: 'bereikbaarheidVanDeUitweg', reden: 'vraagt een control-flowgraaf met dominator-analyse; die bestaat niet in scripts/ast/ en is een eigen blok.' },
    { veld: 'complexiteitsgroei', reden: 'vraagt symbolische groei van de iteratieruimte (O(n) tegenover O(n2) over EXTERNE invoer); zonder dataflow is nesting het enige harde getal, en nesting alleen zegt niets.' }
  ],
  assen: {
    toelichting: 'Zes assen, zes tellingen. Ze mogen niet worden opgeteld: dezelfde logische lus kan op meer dan een as staan (een recursieve functie die ook een for bevat), en een .map over drie elementen is geen while over invoer van buiten.',
    sleutelwoordlussen: syntactisch.length,
    callbackIteratiesGeteld: callbackGeteld.totaal,
    callbackIteratiesGeindexeerd: callbackGeteld.geindexeerd,
    directeRecursie: directRecursief.length,
    wederzijdseRecursieGroepen: wederzijds.length,
    moduleKringen: moduleKringen.length,
    wekkers: timers.length
  },
  gemeten: {
    bestandenGelezen, bundeldelen, parsefouten: parsefouten.length,
    geindexeerd: perLus.length,
    terminatieVerdeling: verdeling(perLus, 'terminatie'),
    risicoVerdeling: verdeling(perLus, 'risico'),
    begrenzingVerdeling: verdeling(syntactisch, 'begrenzing'),
    domeinVerdeling: verdeling(perLus, 'domein'),
    lussoortVerdeling: verdeling(perLus, 'lussoort'),
    /* DE WERKLIJST ACHTER `onbekend`. Dit getal stuurt welke analysetechniek
       als volgende iets oplevert -- zonder deze uitsplitsing is elke volgende
       investering een gok. */
    onbekendRedenVerdeling: perLus.filter(l => l.terminatie === 'nietVastTeStellen')
      .reduce((m, x) => { m[x.onbekendReden || 'ANALYSEGRENS'] = (m[x.onbekendReden || 'ANALYSEGRENS'] || 0) + 1; return m; }, {}),
    metAwait: perLus.filter(l => l.await).length,
    genest: perLus.filter(l => l.nesting >= 1).length,
    onbegrensdGelijktijdig: callbacks.filter(l => l.gelijktijdigheid === 'ONBEGRENSD_GELIJKTIJDIG').length,
    bewijsVerdeling: verdeling(perLus, 'bewijs'),
    brugGevonden, brugZonderRoute, brugDirect, brugViaGraaf,
    /* WAAROM HET BEWIJS ONTBREEKT, uitgesplitst. Zonder deze twee regels leest
       "5.772 zonder bewijs" als een defect van de brug, en dat is het niet:
       public/ KENT geen routes, en in server/ noemt AANROEPGRAAF.json per route
       alleen de symbolen die hij kon oplossen (25,8%). Een genretabel die zijn
       plannerfunctie opzoekt, is met opzet geen kant. Dit is dus de prijs van
       de resolutiegraad van die graaf, niet van deze aggregator. */
    zonderBewijsInPublic: perLus.filter(l => l.bewijs === 'geenRouteGevonden' && l.bestand.startsWith('public/')).length,
    zonderBewijsInServer: perLus.filter(l => l.bewijs === 'geenRouteGevonden' && l.bestand.startsWith('server/')).length,
    requireKantenAlleenInRegister: kantenAlleenInRegister,
    wekkersAsyncZonderRem: timers.filter(t => t.asyncCallback && t.overlapRem === 'geenGevonden').length
  },
  /* DE RATEL. Deze drie mogen alleen omlaag. Ze zijn met opzet geen percentage:
     een percentage stijgt ook als de noemer groeit, en dan ziet een huis dat
     er tien kritieke lussen bij kreeg eruit alsof het vooruitging. */
  ratel: {
    geenUitwegGevonden: perLus.filter(l => l.terminatie === 'geenUitwegGevonden').length,
    kritiek: perLus.filter(l => l.risico === 'kritiek').length,
    wekkersAsyncZonderRem: timers.filter(t => t.asyncCallback && t.overlapRem === 'geenGevonden').length
  },
  buitenIndex: Object.assign({ toelichting: 'Geteld, niet geindexeerd, en nooit opgeteld bij de assen hierboven.' }, buitenIndex),
  callbackPerNaam: callbackGeteld.perNaam,
  parsefouten,
  wekkers: timers.sort((a, b) => (a.periodeMs || 0) - (b.periodeMs || 0)),
  wederzijdseRecursie: wederzijds.slice(0, 200).map(g => ({ omvang: g.length, leden: g.slice(0, 12), afgekapt: g.length > 12 })),
  moduleKringen: moduleKringen.slice(0, 200).map(g => ({ omvang: g.length, leden: g.slice(0, 12), afgekapt: g.length > 12 })),
  directeRecursie: directRecursief,
  lussen: perLus.sort((a, b) => {
    const r = { kritiek: 0, hoog: 1, midden: 2, laag: 3 };
    return (r[a.risico] - r[b.risico]) || a.bestand.localeCompare(b.bestand) || ((a.lijn || 0) - (b.lijn || 0));
  })
};

/* --controle: de ratel mag alleen dalen. Vergelijkt met het ingecheckte
   register en schrijft niets -- anders bewijst de controle zichzelf. */
if (process.argv.includes('--controle')) {
  let oud;
  try { oud = JSON.parse(fs.readFileSync(path.join(WORTEL, 'LUSSEN.json'), 'utf8')); }
  catch (e) { console.error('LUSSEN.json ontbreekt; draai eerst npm run lussen'); process.exit(1); }
  let gezakt = false;
  for (const [k, v] of Object.entries(uit.ratel)) {
    const was = oud.ratel ? oud.ratel[k] : null;
    const teken = was == null ? '?' : (v > was ? 'GESTEGEN' : (v < was ? 'gedaald' : 'gelijk'));
    console.log('  ' + k.padEnd(26), String(was).padStart(5), '->', String(v).padStart(5), ' ' + teken);
    if (was != null && v > was) gezakt = true;
  }
  if (gezakt) { console.error('\nDe ratel is gestegen. Leg het getal opnieuw vast met npm run lussen als dit een besluit is, en niet een ongeluk.'); process.exit(1); }
  console.log('\nratel in orde');
  process.exit(0);
}

fs.writeFileSync(path.join(WORTEL, 'LUSSEN.json'), JSON.stringify(uit, null, 1) + '\n');
const g = uit.gemeten, a = uit.assen;
console.log('LUSSEN.json geschreven  (' + bestandenGelezen + ' bestanden, ' + bundeldelen + ' bundeldelen, ' + parsefouten.length + ' parsefouten)');
console.log('\n  ONTDEKKING -- zes assen, nooit opgeteld');
console.log('    sleutelwoordlussen        ', a.sleutelwoordlussen);
console.log('    callback-iteraties        ', a.callbackIteratiesGeteld, '(geindexeerd:', a.callbackIteratiesGeindexeerd + ')');
console.log('    directe recursie          ', a.directeRecursie);
console.log('    wederzijdse recursiegroepen', a.wederzijdseRecursieGroepen);
console.log('    module-kringen            ', a.moduleKringen);
console.log('    wekkers                   ', a.wekkers);
console.log('\n  TERMINATIE');
for (const [k, v] of Object.entries(g.terminatieVerdeling).sort((x, y) => y[1] - x[1])) console.log('    ' + k.padEnd(24), v);
console.log('\n  LUSSOORT');
for (const [k, v] of Object.entries(g.lussoortVerdeling).sort((x, y) => y[1] - x[1])) console.log('    ' + k.padEnd(24), v);
console.log('\n  WAAROM ONBEKEND (de werklijst van de analyzer)');
for (const [k, v] of Object.entries(g.onbekendRedenVerdeling).sort((x, y) => y[1] - x[1])) console.log('    ' + k.padEnd(24), v);
console.log('\n  RISICO');
for (const k of ['kritiek', 'hoog', 'midden', 'laag']) if (g.risicoVerdeling[k]) console.log('    ' + k.padEnd(24), g.risicoVerdeling[k]);
console.log('\n  BEWIJS (geleend van de route, niet van de lus) -- direct:', g.brugDirect, '| via de aanroepgraaf:', g.brugViaGraaf, '| geen route:', g.brugZonderRoute);
for (const [k, v] of Object.entries(g.bewijsVerdeling).sort((x, y) => y[1] - x[1])) console.log('    ' + k.padEnd(24), v);
console.log('\n  RATEL (mag alleen dalen)');
for (const [k, v] of Object.entries(uit.ratel)) console.log('    ' + k.padEnd(24), v);
console.log('\n  buiten de index:', Object.entries(buitenIndex).map(([k, v]) => k + ' ' + v.sleutelwoordlussen).join(', '), ' -- geteld, niet geindexeerd');
