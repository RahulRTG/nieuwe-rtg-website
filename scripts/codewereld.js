#!/usr/bin/env node
/* Kan er een CODEWERELD bestaan? -- de meting vooraf, niet de bouw.

   Het voorstel voor een Code Intelligence Plane draagt een aanname: de 77
   registers in de wortel zijn samen te voegen tot een canonieke waarheid over
   deze code, waarin een object ("pay.boeken") zijn bestand, zijn routes, zijn
   capabilities, zijn schrijfdoelen en zijn bewijs bij elkaar draagt. Dat is
   exact de vorm waarin `Asset` hier al een keer sneuvelde (OBJECTMODEL.json):
   een gedeeld type dat van bovenaf werd verklaard in plaats van in de domeinen
   gevonden. Daarom wordt het hier eerst GEMETEN.

   De vraag is niet "zou het mooi zijn" maar drie harde:
     1. op welke AS staan de registers -- route, bestand of symbool?
     2. is er een RUGGENGRAAT: hoeveel sleutels kennen meerdere registers?
     3. draagt de brug tussen twee assen TEGENSPRAAK?

   Wat deze meter met opzet NIET doet is een winnaar kiezen waar twee registers
   elkaar tegenspreken. Diezelfde regel staat in EXECUTION_MAP.json en om
   dezelfde reden: een stille winnaar maakt van een meningsverschil een feit.

   Draaien: npm run codewereld -> CODEWERELD.json */
'use strict';

/* DE WACHT. Dit script rekent en SCHRIJFT bij het laden: er is geen meet()
   die je los kunt aanroepen, alles staat op het hoogste niveau. Een enkele
   laadcontrole (node -e "require('./scripts/codewereld')") zou het register dus
   overschrijven met wat die aanroep toevallig meet -- exact de fout waarmee
   ROLPROEF.json van 3377 beproefde routes terugviel naar 292, en het register
   zag er daarna volkomen normaal uit. Vandaar dat requiren hier niets doet.
   Wie de uitslag in code nodig heeft, leest het register. */
if (require.main !== module) return;
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const WORTEL = path.join(__dirname, '..');
const IS_ROUTE = /^(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS) (\/\S*)$/;
const IS_BESTAND = /^[A-Za-z0-9_.\-\/]+\.(js|mjs|html|css)$/;

/* Een sleutel op de as `route` heeft in het wild TWEE vormen: "POST /api/x"
   (IDEMPROEF, VERTROUWEN) en "/api/x" (HERSTEL, EXECUTION_MAP, dat de methode
   in een apart veld zet). Er wordt daarom op PAD samengevoegd en de methode
   apart bewaard -- niet omgekeerd, want dan valt elk register zonder methode
   buiten de ruggengraat en meet je je eigen normalisatie. */
function padVan(s) { const m = IS_ROUTE.exec(s); return m ? m[2] : (s.startsWith('/') ? s : null); }
function bestandVan(s) {
  if (typeof s !== 'string' || !IS_BESTAND.test(s) || !s.includes('/')) return null;
  const i = s.indexOf('server/') >= 0 ? s.indexOf('server/') : (s.indexOf('public/') >= 0 ? s.indexOf('public/') : (s.indexOf('scripts/') >= 0 ? s.indexOf('scripts/') : -1));
  return i >= 0 ? s.slice(i) : null;                       // absolute paden komen voor (SCHRIJFANALYSE.waarom)
}

/* Loopt een register af en verzamelt per as welke sleutels erin staan, plus de
   paren (route -> bestand) die BINNEN EEN RIJ staan: alleen daar beweert een
   register dat die twee bij elkaar horen. Twee losse lijsten in hetzelfde
   bestand zeggen niets over elkaar. */
function oogst(j) {
  const paden = new Set(), bestanden = new Set(), methoden = new Set(), paren = [], symbolen = new Set();
  (function loop(n, diepte) {
    if (n == null || diepte > 10) return;
    if (typeof n === 'string') { const p = padVan(n); if (p) paden.add(p); const b = bestandVan(n); if (b) bestanden.add(b); return; }
    if (Array.isArray(n)) { for (const x of n) loop(x, diepte + 1); return; }
    if (typeof n !== 'object') return;
    let rijPad = null, rijBestand = null;
    for (const k of Object.keys(n)) {
      const p = padVan(k); if (p) paden.add(p);
      const b = bestandVan(k); if (b) bestanden.add(b);
      const v = n[k];
      if (typeof v === 'string') {
        if ((k === 'pad' || k === 'route' || k === 'heen' || k === 'terug') && v.startsWith('/') === false) { const q = padVan(v); if (q) rijPad = rijPad || q; }
        if ((k === 'pad' || k === 'route' || k === 'heen' || k === 'terug') && v.startsWith('/')) rijPad = rijPad || v;
        if (k === 'methode' || k === 'method') methoden.add(v.toUpperCase());
        if (k === 'bestand' || k === 'file' || k === 'bron') { const bb = bestandVan(v); if (bb) rijBestand = rijBestand || bb; }
      }
      loop(v, diepte + 1);
    }
    /* Een symboolsleutel is een naam MET een plaats. Een losse functienaam
       zonder bestand is geen sleutel -- daar kun je niets mee terugvinden, en
       dat is precies waarom deze as tot 3 september 2026 leeg stond. */
    if (Array.isArray(n.symbolen) && typeof n.bestand === 'string') {
      for (const sy of n.symbolen) if (sy && typeof sy.naam === 'string' && sy.lijn != null) symbolen.add(n.bestand + '#' + sy.naam);
    }
    if (rijPad && rijBestand) paren.push([rijPad, rijBestand]);
  })(j, 0);
  return { paden, bestanden, methoden, paren, symbolen };
}

/* De eigen uitslag telt niet mee. Zonder deze regel meet de tweede ronde zijn
   eigen paren en zakt de tegenspraakcontrole van `niet vast te stellen` naar
   een vals `0`: het bewijs van de meter werd zijn eigen bron. */
const symboolNaarRegisters = new Map(), verklaardeSoort = new Map(), ruweRegisters = new Map();
const registers = fs.readdirSync(WORTEL).filter(f => f.endsWith('.json') && !f.startsWith('package') && f !== 'CODEWERELD.json').sort();
const perRegister = [], padNaarRegisters = new Map(), bestandNaarRegisters = new Map(), brug = new Map();

for (const f of registers) {
  let j; try { j = JSON.parse(fs.readFileSync(path.join(WORTEL, f), 'utf8')); }
  catch (e) { perRegister.push({ register: f, as: 'ONLEESBAAR', reden: e.message.slice(0, 80) }); continue; }
  const o = oogst(j);
  if (j && typeof j === 'object' && typeof j.soort === 'string') verklaardeSoort.set(f, j.soort);
  if (j && typeof j === 'object') ruweRegisters.set(f, j);
  const as = o.paden.size >= o.bestanden.size * 2 && o.paden.size > 0 ? 'route'
    : (o.bestanden.size > 0 && o.bestanden.size >= o.paden.size ? 'bestand' : (o.paden.size ? 'route' : 'geen'));
  perRegister.push({ register: f, as: o.symbolen.size > o.paden.size ? 'symbool' : as, paden: o.paden.size, bestanden: o.bestanden.size, symbolen: o.symbolen.size, paren: o.paren.length });
  for (const p of o.paden) { if (!padNaarRegisters.has(p)) padNaarRegisters.set(p, new Set()); padNaarRegisters.get(p).add(f); }
  for (const b of o.bestanden) { if (!bestandNaarRegisters.has(b)) bestandNaarRegisters.set(b, new Set()); bestandNaarRegisters.get(b).add(f); }
  for (const sy of o.symbolen) { if (!symboolNaarRegisters.has(sy)) symboolNaarRegisters.set(sy, new Set()); symboolNaarRegisters.get(sy).add(f); }
  for (const [p, b] of o.paren) { if (!brug.has(p)) brug.set(p, new Map()); const m = brug.get(p); if (!m.has(b)) m.set(b, new Set()); m.get(b).add(f); }
}

/* 2) De ruggengraat: hoeveel paden kent meer dan een register? Een sleutel die
      maar in een register staat kan niets samenvoegen -- daar is de Codewereld
      een kopie van dat ene register en geen wereld. */
const verdeling = new Map();
for (const [, regs] of padNaarRegisters) verdeling.set(regs.size, (verdeling.get(regs.size) || 0) + 1);
const inMeer = [...padNaarRegisters.values()].filter(s => s.size > 1).length;

/* 3) De brug, en de VERSCHILLEN. Twee registers die hetzelfde pad aan een ander
      bestand hangen is geen detail: dat is de plek waar een samengevoegde
      waarheid stilletjes zou gaan liegen.

      Het woord `tegenspraak` staat hier met opzet NIET meer. Deze meter ziet
      alleen dat twee registers iets anders zeggen; of dat een echte tegenspraak
      is of een LEEFTIJDSVERSCHIL (het ene register is ouder dan de code)
      beslist scripts/routebron.js, dat de stempels erbij pakt. Zou dit een
      `tegenspraak` noemen wat daar `verouderd` heet, dan dragen twee registers
      hetzelfde woord met twee betekenissen -- de fout die SEMANTIEK.json in dit
      huis 99 keer heeft geteld. */
const tegenspraken = [];
let toetsbaar = 0;                                          // paden waar MEER DAN EEN register een bestand noemt
const brugRegisters = new Set();
for (const [p, m] of brug) {
  const sprekers = new Set(); for (const [, r] of m) for (const f of r) { sprekers.add(f); brugRegisters.add(f); }
  if (sprekers.size > 1) toetsbaar++;
  if (m.size > 1) tegenspraken.push({ pad: p, bestanden: [...m].map(([b, r]) => ({ bestand: b, volgens: [...r].sort() })) });
}

/* 4) Het bronbereik: hoeveel van de code die er ECHT staat, wordt door enig
      register genoemd? Dit is de eerlijke bovengrens van wat een Architect kan
      beantwoorden zonder bron te lezen.

      HET WORDT GESPLITST, en dat is geen detail. Toen de symboolas erbij kwam
      (SYMBOLEN.json noemt elk bestand) sprong dit getal van 33% naar 100%, en
      dan meet het zichzelf: een index van alles maakt elke dekkingsvraag
      triviaal waar. Wat een index je geeft is STRUCTUUR -- welke functies er
      wonen, wat een bestand uitvoert, wie ervan afhangt. Wat hij je niet geeft
      is GEDRAG: of het klopt, wat het schrijft, of het bewezen is. Die tweede
      vraag beantwoorden alleen de andere registers, en daarvoor blijft de
      oude teller staan. */
function bronBestanden(map) {
  const uit = [];
  (function loop(d) {
    for (const e of fs.readdirSync(path.join(WORTEL, d), { withFileTypes: true })) {
      if (e.name === 'node_modules' || e.name === 'data' || e.name === 'dist' || e.name.startsWith('.')) continue;
      const rel = d + '/' + e.name;
      if (e.isDirectory()) loop(rel); else if (e.name.endsWith('.js')) uit.push(rel);
    }
  })(map);
  return uit;
}
/* Per BOOM apart, want een gemengd percentage verbergt het verschil: de meters
   kijken naar routes, en `public/` heeft er geen. Een enkel getal van 33% zou
   suggereren dat de dekking overal gelijk is. */
const bronPerBoom = { server: bronBestanden('server'), public: bronBestanden('public') };
const bron = [...bronPerBoom.server, ...bronPerBoom.public];
const genoemd = bron.filter(b => bestandNaarRegisters.has(b));
/* WELK REGISTER IS EEN INDEX? Niet naar de naam en niet naar een label, maar
   GEMETEN: een register dat (bijna) elk bestand van een boom noemt, kan per
   definitie geen dekking onderscheiden -- het maakt elke dekkingsvraag triviaal
   waar. Dat gebeurde hier twee keer: eerst bij de symboolas (33% -> 100%) en
   daarna bij de aanroepgraaf (server 41,9% -> 85,5%). Beide keren zag het eruit
   als vooruitgang terwijl er over gedrag niets was bijgekomen.

   De grens ligt op 95% van een boom. Wie daarboven zit is een index en telt
   niet mee voor de gedragsteller; welke registers dat zijn staat in de uitslag,
   zodat de keuze na te rekenen is in plaats van te geloven. */
/* Een register mag zeggen over welke bestanden het NIETS beweert. Die tellen
   dan niet als dekking, ook al staat het bestand erin. Zonder deze aftrek zou
   een meter die over een derde van zijn onderwerp zwijgt de gedragsteller toch
   omhoog duwen -- de derde variant van dezelfde fout. */
const zwijgt = new Map();                          // register -> Set(bestanden)
for (const [f, j] of ruweRegisters) {
  const lijst = j && j.zonderUitspraak;
  if (Array.isArray(lijst) && lijst.length) zwijgt.set(f, new Set(lijst));
}

const INDEXGRENS = 0.95;
const INDEXREGISTERS = new Set(), indexWaarom = new Map();
/* Twee wegen naar dezelfde vaststelling, en allebei nodig. Een register mag
   zichzelf `soort: 'index'` noemen -- dat is een verklaring van wie hem schreef.
   En los daarvan wordt het GEMETEN: wie boven de grens uitkomt is een index,
   ook als hij dat zelf niet zegt. Een verklaring die je niet nameet is een
   belofte, en een meting zonder verklaring mist een index die toevallig maar
   80% van een boom raakt. */
for (const [f, j] of verklaardeSoort) if (j === 'index') { INDEXREGISTERS.add(f); indexWaarom.set(f, 'verklaart zichzelf als index'); }
for (const [boom, lijst] of Object.entries(bronPerBoom)) {
  if (!lijst.length) continue;
  const perReg = new Map();
  for (const b of lijst) for (const r of bestandNaarRegisters.get(b) || []) perReg.set(r, (perReg.get(r) || 0) + 1);
  for (const [r, n] of perReg) if (n / lijst.length >= INDEXGRENS) {
    INDEXREGISTERS.add(r);
    if (!indexWaarom.has(r)) indexWaarom.set(r, 'noemt ' + Math.round(n / lijst.length * 100) + '% van ' + boom + '/');
  }
}
const buitenIndex = b => [...(bestandNaarRegisters.get(b) || [])].some(r =>
  !INDEXREGISTERS.has(r) && !(zwijgt.get(r) && zwijgt.get(r).has(b)));
const gedrag = bron.filter(buitenIndex);
const perBoom = Object.entries(bronPerBoom).map(([boom, lijst]) => {
  const g = lijst.filter(b => bestandNaarRegisters.has(b)).length;
  const gd = lijst.filter(buitenIndex).length;
  return { boom, bestanden: lijst.length, genoemd: g, pct: lijst.length ? Math.round(g / lijst.length * 1000) / 10 : 0,
    gedrag: gd, gedragPct: lijst.length ? Math.round(gd / lijst.length * 1000) / 10 : 0 };
});

/* 5) De symboolas. Nul is hier de uitkomst en geen fout: geen enkel register
      kent een functie- of symboolnaam met een plaats in een bestand. Het
      gereedschap ervoor staat er wel (scripts/ast/, eigen parser met regel- en
      positie-informatie), dus dit is een ontbrekende meting en geen ontbrekende
      mogelijkheid. Dat verschil hoort in de uitslag te staan.

      En "bouwbaar" is zelf ook een bewering, dus die wordt hier BEPROEFD in
      plaats van beloofd: de parser gaat over de hele serverboom en de uitslag
      draagt hoeveel bestanden hij niet aankon. Een parser die stilletjes
      overslaat wat hij niet begrijpt zou een symboolas opleveren met gaten die
      niemand ziet -- deze gooit (parser.js: "wat de parser NIET begrijpt is een
      harde fout"), en dus is elk gefaald bestand hier zichtbaar. */
const astAanwezig = fs.existsSync(path.join(WORTEL, 'scripts/ast/parser.js'));
function symboolproef() {
  if (!astAanwezig) return { gedraaid: false, reden: 'scripts/ast/parser.js ontbreekt' };
  const { parse } = require('./ast/parser'); const { loop } = require('./ast/walk');
  const bestanden = bronBestanden('server'); const t0 = Date.now();
  let gelukt = 0, symbolen = 0; const gefaald = [];
  for (const rel of bestanden) {
    let ast;
    try { ast = parse(fs.readFileSync(path.join(WORTEL, rel), 'utf8'), {}); gelukt++; }
    catch (e) { gefaald.push({ bestand: rel, fout: String(e.message).slice(0, 90) }); continue; }
    loop(ast, n => {
      if (n.type === 'FunctionDeclaration' && n.id) symbolen++;
      else if (n.type === 'VariableDeclarator' && n.id && n.id.name && n.init && /Function|Arrow/.test(n.init.type)) symbolen++;
      else if (n.type === 'MethodDefinition') symbolen++;
    });
  }
  return { gedraaid: true, bestanden: bestanden.length, geparsed: gelukt, gefaald: gefaald.length,
    gefaaldLijst: gefaald.slice(0, 10), symbolen, seconden: Math.round((Date.now() - t0) / 100) / 10 };
}

const proef = symboolproef();

let commit = 'onbekend';
try { commit = execSync('git rev-parse --short HEAD', { cwd: WORTEL }).toString().trim(); } catch (e) { /* geen git */ }

const uit = {
  uitleg: 'Kan er een canonieke Codewereld bestaan? Gemeten over de registers in de wortel: op welke as staan ze, hoeveel sleutels delen ze, en spreken ze elkaar tegen. Deze meter voegt niets samen en kiest bij tegenspraak geen winnaar.',
  stempel: { op: new Date().toISOString().slice(0, 10), commit },
  registers: { geteld: registers.length, opRoute: perRegister.filter(r => r.as === 'route').length, opBestand: perRegister.filter(r => r.as === 'bestand').length,
    opSymbool: perRegister.filter(r => r.as === 'symbool').length, zonderAs: perRegister.filter(r => r.as === 'geen').length },
  assen: {
    route: { sleutels: padNaarRegisters.size, registers: perRegister.filter(r => r.paden > 0).length },
    bestand: { sleutels: bestandNaarRegisters.size, registers: perRegister.filter(r => r.bestanden > 0).length },
    symbool: { sleutels: symboolNaarRegisters.size, registers: perRegister.filter(r => r.symbolen > 0).length,
      reden: symboolNaarRegisters.size ? null : 'geen register draagt een functienaam met een plaats in een bestand',
      gereedschapAanwezig: astAanwezig, gereedschap: 'scripts/ast/ (eigen parser, met lijn- en positie-informatie)', proef: proef }
  },
  ruggengraat: {
    paden: padNaarRegisters.size, inMeerDanEenRegister: inMeer,
    pct: padNaarRegisters.size ? Math.round(inMeer / padNaarRegisters.size * 1000) / 10 : 0,
    verdeling: [...verdeling].sort((a, b) => b[0] - a[0]).map(([n, aantal]) => ({ registers: n, paden: aantal }))
  },
  brug: {
    uitleg: 'paren route -> bestand die BINNEN EEN RIJ van een register staan; alleen daar beweert een register dat die twee bij elkaar horen',
    paden: brug.size, registersDieSpreken: [...brugRegisters].sort(),
    /* Nul tegenspraken betekent alleen iets als er iets te weerspreken viel.
       Legt maar EEN register de brug, dan is de uitslag `niet vast te stellen`
       en niet `in orde` -- dezelfde regel als BESTUUR.md: vervallen bewijs is
       geen bewijs, en een wachter zonder tweede bron zegt dat hij niet kijkt. */
    verschilToetsbaar: toetsbaar,
    verschilDekkingPct: brug.size ? Math.round(toetsbaar / brug.size * 1000) / 10 : 0,
    verschillen: toetsbaar ? tegenspraken.length : 'niet vast te stellen',
    soortBeslistIn: 'ROUTEBRON.json -- daar wordt een verschil ingedeeld als `verouderd` of `tegenspraak`; deze meter telt alleen DAT ze verschillen',
    verschilReden: toetsbaar ? null : 'geen enkel pad krijgt van twee registers een bestand toegewezen: er valt niets te vergelijken',
    verschilLijst: tegenspraken.slice(0, 25)
  },
  bronbereik: {
    uitleg: 'twee getallen, met opzet. `genoemd` = door enig register (de symboolindex noemt alles, dus dit meet STRUCTUUR: welke functies, wat uitgevoerd, wie hangt ervan af). `gedrag` = door minstens een register buiten die index (schrijft het, is het bewezen, is het herhaalbaar). Alleen het tweede is de bovengrens voor een vraag over gedrag.',
    bestanden: bron.length, genoemd: genoemd.length,
    pct: bron.length ? Math.round(genoemd.length / bron.length * 1000) / 10 : 0,
    gedrag: gedrag.length,
    gedragPct: bron.length ? Math.round(gedrag.length / bron.length * 1000) / 10 : 0,
    relatie: bron.filter(b => [...(bestandNaarRegisters.get(b) || [])].some(r => INDEXREGISTERS.has(r))).length,
    indexregisters: [...INDEXREGISTERS].sort().map(r => ({ register: r, waarom: indexWaarom.get(r) })),
    zwijgendeRegisters: [...zwijgt].map(([r, set]) => ({ register: r, bestanden: set.size })),
    indexgrens: 'een register telt als index als hij zichzelf zo verklaart (soort: index) of minstens ' + Math.round(INDEXGRENS * 100) + '% van een boom noemt. Een index zegt WAAR iets woont en WAT met wat samenhangt; hij zegt niet of het schrijft, klopt of bewezen is -- daarom telt hij niet mee voor de gedragsteller.',
    perBoom,
    /* platte velden voor de levende getallen in de documenten (scripts/getallen.js
       leest een pad, geen lijst) */
    serverPct: (perBoom.find(b => b.boom === 'server') || {}).gedragPct,
    publicPct: (perBoom.find(b => b.boom === 'public') || {}).gedragPct,
    nooitGenoemdVoorbeeld: bron.filter(b => !bestandNaarRegisters.has(b)).slice(0, 20),
    zonderGedragVoorbeeld: bron.filter(b => !buitenIndex(b)).slice(0, 20)
  },
  noemers: {
    uitleg: 'elk register telt zijn eigen aantal routes. Wie ze samenvoegt kiest een noemer, en dat is een besluit -- geen afleiding (zelfde vondst als MUTATIEINVENTARIS.json).',
    perRegister: perRegister.filter(r => r.paden > 100).sort((a, b) => b.paden - a.paden).map(r => ({ register: r.register, paden: r.paden }))
  },
  perRegister: perRegister.sort((a, b) => (b.paden + b.bestanden) - (a.paden + a.bestanden))
};

fs.writeFileSync(path.join(WORTEL, 'CODEWERELD.json'), JSON.stringify(uit, null, 2) + '\n');
console.log('CODEWERELD.json geschreven');
console.log('  registers        ', uit.registers.geteld, '(route:', uit.registers.opRoute + ', bestand:', uit.registers.opBestand + ', symbool:', uit.registers.opSymbool + ', geen as:', uit.registers.zonderAs + ')');
console.log('  as route         ', uit.assen.route.sleutels, 'paden in', uit.assen.route.registers, 'registers');
console.log('  as bestand       ', uit.assen.bestand.sleutels, 'bestanden in', uit.assen.bestand.registers, 'registers');
console.log('  as symbool       ', uit.assen.symbool.sleutels, 'symbolen in', uit.assen.symbool.registers, 'register(s)',
  uit.assen.symbool.reden ? '(' + uit.assen.symbool.reden + ')' : '');
if (proef.gedraaid) console.log('    proef          ', proef.geparsed + '/' + proef.bestanden, 'bestanden geparsed,', proef.gefaald, 'gefaald,', proef.symbolen, 'symbolen in', proef.seconden + 's');
console.log('  ruggengraat      ', uit.ruggengraat.inMeerDanEenRegister + '/' + uit.ruggengraat.paden, 'paden in meer dan een register =', uit.ruggengraat.pct + '%');
console.log('  brug route->best.', uit.brug.paden, 'paden uit', uit.brug.registersDieSpreken.length, 'register(s); verschillen:', uit.brug.verschillen,
  '(getoetst op ' + uit.brug.verschilToetsbaar + ' paden = ' + uit.brug.verschilDekkingPct + '%; soort: zie ROUTEBRON.json)');
console.log('  bronbereik struct', uit.bronbereik.genoemd + '/' + uit.bronbereik.bestanden, '=', uit.bronbereik.pct + '%  (welke functies, wie hangt ervan af)');
console.log('  bronbereik gedrag', uit.bronbereik.gedrag + '/' + uit.bronbereik.bestanden, '=', uit.bronbereik.gedragPct + '%',
  '(' + perBoom.map(b => b.boom + ' ' + b.gedragPct + '%').join(', ') + ')');
console.log('  bronbereik relatie', uit.bronbereik.relatie + '/' + uit.bronbereik.bestanden,
  '(waar woont het, wat roept het aan, welk scherm gebruikt het)');
console.log('    indexregisters (tellen niet als gedrag):', [...INDEXREGISTERS].sort().join(', ') || '(geen)');
