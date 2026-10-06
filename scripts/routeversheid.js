#!/usr/bin/env node
/* ============================================================================
   HET BEWIJSVERVAL PER ROUTE -- welk bewijs van deze route spreekt over een
   vorige wereld, omdat iets waar hij AANTOONBAAR van afhangt is veranderd?

   WAAROM DIT ER IS

   PROOF.md par. 2 zegt dat bewijs veroudert, en scripts/vertrouwen.js maakte dat
   waar -- maar grof, per REGISTER (de oudste stempel). Deze module is de
   koppeling die daar ontbrak: per route, per bewezen CEL, het register dat die
   cel bewees, de commit waarop dat gebeurde, en de vraag of er sindsdien iets is
   gewijzigd waar deze route van afhangt.

   Er komen GEEN nieuwe standen bij. De uitkomst gaat naar staatVan() in
   scripts/vertrouwen.js en wordt daar een van de standen die PROOF.md al kent:
   een route waarvan een bewezen cel aantoonbaar verouderd is, heet `verschaald`.
   En drie dingen blijven strikt uit elkaar, ook als de stand er maar een kan
   zijn: DEFECT (een cel is gezakt -- `geschorst`), ONTBREKEND (een cel is nooit
   gemeten -- `verzwakt`) en VEROUDERD (een bewezen cel spreekt over een oudere
   commit -- `verschaald`). Een wijziging bewijst niet dat een route fout is; zij
   bewijst alleen dat het oude bewijs niet meer actueel genoeg is.

   DE KOPPELING DRAAGT EEN GRAAD (BESTUUR.md: onbekend, vermoed, gemeten,
   bewezen), en alleen `gemeten` laat bewijs vervallen:

     gemeten   het BESTAND waarin de router deze route afhandelt (ROUTEBRON.json,
               uit de draaiende router en niet uit een regex), en de kern-namen
               die de route TIJDENS een verzoek aanraakte (CONTEXTPROEF.json,
               een runtime-meting in de domeingrens-Proxy)
     vermoed   de statische sluiting daarachter: requires, kern-kanten uit de
               aanroepgraaf, de namen die een fabrieksmodule uit de tas haalt
               (KERNHERKOMST.json), en de montagewortel naar zijn require. Dat
               een bestand een ander LAADT, bewijst niet dat deze route die code
               RAAKT -- server/lib/keten.js hangt statisch onder ruim 4100 routes.
               Een wijziging hier staat bij de route, met de keten erbij, en laat
               het bewijs NIET vervallen. Niet gokken; de graad tonen.
     onbekend  de route heeft geen gemeten bestand, of de meetcommit van het
               register is niet vast te stellen (geen commit in de stempel, of
               een ondiepe kloon). Dan geldt de bestaande grove regel van
               vertrouwen.js (de halfwaardetijd per register) en niets fijners.

   DE UITLEGKETEN. Voor elke verouderde cel is te zeggen: welk bestand veranderde
   -> via welke gemeten koppeling -> welke route -> welk bewijs (cel, register,
   commit) -> wat opnieuw moet draaien (uit scripts/versheid.js, de ene lijst
   register -> opdracht; hier staat geen tweede).

   WAT DIT NIET IS: een oordeel over de code. En het schrijft niets; het is een
   bibliotheek voor vertrouwen.js plus een lezer voor mensen.

   Draai:  npm run routeversheid
           npm run routeversheid -- --route "POST /api/pay/oplaad"
           npm run routeversheid -- --sinds HEAD~1   (stel dat al het bewijs op
                                                    HEAD~1 gemeten was)
           npm run routeversheid -- --json
   UITGANG 0 gemeten, 2 niet vast te stellen
   ========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { stempelVan } = require('./lib/stempel');

const WORTEL = path.join(__dirname, '..');

/* Dezelfde montagewortel als in veranderbereik.js: erin, maar niet doorheen. */
const MONTAGE = /^server\/(server\.js$|opzet\/)/;
const BRONMAPPEN = ['server/', 'scripts/', 'public/'];
const isBron = (p) => BRONMAPPEN.some((m) => p.startsWith(m));

/* WELK REGISTER BEWEES DEZE CEL. De bewijsmatrix zet op elke cel een `bron`;
   dit is de vertaling naar het register dat die bron schrijft. Een cel zonder
   register (`verklaard` uit de bewakers van de router, `leesroute`) wordt op
   HEAD afgeleid en veroudert dus niet. test/routeversheid.test.js houdt deze
   lijst tegen de bron-labels in scripts/bewijsmatrix.js. */
const CEL_REGISTER = {
  poortwacht: 'POORTWACHT.json', rolproef: 'ROLPROEF.json', invoerproef: 'INVOERPROEF.json',
  outputproef: 'OUTPUTPROEF.json', staatproef: 'STAATPROEF.json', handelingproef: 'HANDELINGPROEF.json',
  auditproef: 'AUDITPROEF.json', 'auditproef-journaal': 'AUDITPROEF-JOURNAAL.json',
  ketenronde: 'KETENS.json', faalproef: 'FAALPROEF.json', idemproef: 'IDEMPROEF.json',
  uitvoerproef: 'UITVOERPROEF.json'
};
const ZONDER_REGISTER = new Set(['leesroute']);

/* De sluiting met herkomst: per bestand de ouder waarlangs hij bereikt werd, zodat
   de keten uit te leggen is ("handler -> a.js -> b.js"). Pure functie. */
function sluiting(start, buren) {
  const ouder = new Map();
  const ongevolgd = [];
  const stapel = [];
  for (const s of start.filter(Boolean).filter(isBron)) { ouder.set(s, null); stapel.push(s); }
  const gezien = new Set();
  while (stapel.length) {
    const b = stapel.pop();
    if (gezien.has(b)) continue;
    gezien.add(b);
    if (MONTAGE.test(b)) continue;
    const v = buren(b) || { naar: [], ongevolgd: 0 };
    if (v.ongevolgd > 0) ongevolgd.push(b);
    for (const n of v.naar) {
      if (!isBron(n) || ouder.has(n)) continue;
      ouder.set(n, b);
      stapel.push(n);
    }
  }
  const keten = (b) => { const k = []; for (let x = b; x; x = ouder.get(x)) k.unshift(x); return k; };
  return { bestanden: gezien, ongevolgd, keten };
}

/* WAT EEN FABRIEKSMODULE UIT DE KERN-TAS HAALT. De aanroepgraaf ziet een
   kern-kant alleen als hij als `kern.x(...)` in aanroeppositie staat; een
   routebestand dat begint met `const { a, b } = kern;` roept daarna `a()` aan,
   en dat leest als een lokale naam. Zonder deze lezer stond
   server/routes/member/rechterhand.js op `vers` met een sluiting van EEN
   bestand -- zijn hele domein (kern/rechterhand/) was onzichtbaar. Gevonden in
   de eerste ronde: 1028 routes `vers`, en de steekproef liet zien dat het een
   blinde vlek was en geen versheid.

   Pure functie over de brontekst. Hij geeft de NAMEN en een vlag `open` als er
   iets gebeurt dat niet naar namen te herleiden is (een spread, een dynamische
   sleutel). Namen oplossen doet de aanroeper met KERNHERKOMST.json. */
/* De parameter van de fabriek: een naam (`kern`, `ctx`) of een destructuring
   (`({ app, rtfos })`). Drie vormen: rechtstreeks aan module.exports, of
   module.exports = N met N elders als function of pijl gedefinieerd. De tweede
   vorm stond er in de eerste versie niet in, en daardoor stond
   server/routes/rtfos/governance.js op `vers` terwijl kern/rtfos/ sindsdien was
   gewijzigd -- dezelfde fout als hierboven, alleen een regel hoger. */
/* VOLLEDIG ONTSNAPPEN EN NIET ALLEEN DE DOLLAR -- dezelfde les als in
   scripts/activering.js: een ontsnapping die klopt DOORDAT de invoer elders
   beperkt is ([A-Za-z_$]), klopt alleen zolang niemand die beperking verruimt.
   CodeQL wees het hier opnieuw aan. */
const ontsnap = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const PARAM = '(\\{[^{}]*\\}|[A-Za-z_$][\\w$]*)';
function fabriekParam(bron) {
  const s = bron || '';
  let m = new RegExp('module\\.exports\\s*=\\s*(?:async\\s*)?(?:function\\s*[\\w$]*\\s*)?\\(\\s*' + PARAM).exec(s) ||
    new RegExp('module\\.exports\\s*=\\s*(?:async\\s*)?([A-Za-z_$][\\w$]*)\\s*=>').exec(s);
  if (m) return m[1];
  const n = /module\.exports\s*=\s*([A-Za-z_$][\w$]*)\s*;?\s*(?:\n|$)/.exec(s);
  if (!n) return null;
  const N = ontsnap(n[1]);
  m = new RegExp('function\\s+' + N + '\\s*\\(\\s*' + PARAM).exec(s) ||
    new RegExp('\\b' + N + '\\s*=\\s*(?:async\\s*)?(?:function\\s*[\\w$]*\\s*)?\\(\\s*' + PARAM).exec(s) ||
    new RegExp('\\b' + N + '\\s*=\\s*(?:async\\s*)?([A-Za-z_$][\\w$]*)\\s*=>').exec(s);
  return m ? m[1] : null;
}

function namenUit(lijst, namen) {
  let open = false;
  for (const deel of lijst.split(',')) {
    const t = deel.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '').trim();
    if (!t) continue;
    if (t.startsWith('...')) { open = true; continue; }
    const naam = t.split(/[:=]/)[0].trim();
    if (/^[A-Za-z_$][\w$]*$/.test(naam)) namen.add(naam); else open = true;
  }
  return open;
}

function kernGebruik(bron) {
  const param = fabriekParam(bron);
  if (!param) return null;
  const namen = new Set();
  if (param.startsWith('{')) {
    const open = namenUit(param.slice(1, -1), namen);
    return { param, namen: [...namen].sort(), open };
  }
  const p = ontsnap(param);
  let open = false;
  const tas = '\\b' + p + '(?:\\.kern)?';
  for (const d of bron.matchAll(new RegExp('\\{([^{}]*)\\}\\s*=\\s*' + tas + '\\b(?!\\s*\\.\\s*(?!kern\\b)[\\w$])', 'g'))) {
    if (namenUit(d[1], namen)) open = true;
  }
  for (const a of bron.matchAll(new RegExp(tas + '\\.([A-Za-z_$][\\w$]*)', 'g'))) if (a[1] !== 'kern') namen.add(a[1]);
  if (new RegExp(tas + '\\s*\\[').test(bron)) open = true;
  return { param, namen: [...namen].sort(), open };
}

/* De buren per bestand: require-kanten, opgeloste kern-kanten uit de
   aanroepgraaf, en de namen die een fabrieksmodule uit de tas haalt, opgelost
   met KERNHERKOMST.json. Een naam die daar niet staat is ONGEVOLGD. Een naam
   waarvan de herkomst de montagewortel is, wordt via montageHerkomst() naar zijn
   require gevolgd; lukt dat niet, dan wordt het montagebestand zelf de
   afhankelijkheid.

   Dat laatste was eerst andersom: `app`, `db` en `save` streepten we weg omdat
   server.js bij bijna elke commit verandert. Maar onder diezelfde herkomst
   stonden 525 namen, domeinmodules incluis, en wegstrepen maakte van een
   veilige overschatting een stille onderschatting (veranderbereik.js zegt het
   over zijn montageband in precies die woorden). Liever te vaak geraakt dan
   een keer ten onrechte vers. */
function burenIndex(ix, kanten, herkomst, lees, montage) {
  const per = new Map();
  const zet = (b) => { if (!per.has(b)) per.set(b, { naar: new Set(), ongevolgd: 0 }); return per.get(b); };
  for (const b of ix.bestanden.values()) {
    const v = zet(b.pad);
    for (const d of b.kanten.opgelost) v.naar.add(d);
  }
  for (const k of kanten || []) {
    if (k.hoe !== 'viaKern' || !k.vanBestand) continue;
    const v = zet(k.vanBestand);
    /* naar server.js zonder naam: de kern-tas zelf, niet opgelost */
    if (!k.naarBestand || (MONTAGE.test(k.naarBestand) && !k.naar)) v.ongevolgd++;
    else v.naar.add(k.naarBestand);
  }
  if (herkomst && lees) {
    for (const b of ix.bestanden.values()) {
      if (!b.pad.startsWith('server/') || MONTAGE.test(b.pad)) continue;
      const g = kernGebruik(lees(b.pad));
      if (!g) continue;
      const v = zet(b.pad);
      if (g.open) v.ongevolgd++;
      for (const n of g.namen) {
        const h = herkomst.get(n);
        if (!h || !h.length) { v.ongevolgd++; continue; }
        for (const x of h) {
          if (!x.bestand) continue;
          if (!MONTAGE.test(x.bestand)) { v.naar.add(x.bestand); continue; }
          /* Een naam uit de montagewortel: waar komt hij DAAR vandaan? */
          const def = montage && montage.get(n);
          if (def) v.naar.add(def);
          else v.naar.add(x.bestand);
        }
      }
    }
  }
  return (b) => { const v = per.get(b); return v ? { naar: [...v.naar], ongevolgd: v.ongevolgd } : null; };
}

/* WAAR EEN NAAM IN DE MONTAGEWORTEL VANDAAN KOMT. KERNHERKOMST.json zegt van
   525 namen alleen "basisobject van server/server.js" -- en daaronder zitten
   domeinmodules: `const journalistiek = require('./kern/journalistiek')(...)`.
   De eerste versie van deze meter streepte die weg als infrastructuur, en toen
   stond server/routes/journalistiek.js op `vers` terwijl kern/journalistiek.js
   sindsdien was gewijzigd. Hier wordt de require gevolgd. Een naam die in de
   montagewortel ZELF gedefinieerd is (een lokale functie in server.js) krijgt
   dat bestand als afhankelijkheid: grof, want dan maakt elke wijziging aan
   server.js de route geraakt, maar niet verzonnen. Per symbool (de regels van
   die functie, SYMBOLEN.json) is de fijnere stap daarna.

   `bestanden` is { pad: brontekst }. Pure functie. */
function montageHerkomst(bestanden, bestaat) {
  const kaart = new Map();
  const los = (van, rel) => {
    const basis = path.posix.join(path.posix.dirname(van), rel);
    for (const k of [basis, basis + '.js', basis + '/index.js']) if (bestaat(k)) return k;
    return null;
  };
  for (const [pad, bron] of Object.entries(bestanden)) {
    for (const m of bron.matchAll(/(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*require\(\s*['"](\.[^'"]+)['"]\s*\)/g)) {
      const f = los(pad, m[2]); if (f && !kaart.has(m[1])) kaart.set(m[1], f);
    }
    for (const m of bron.matchAll(/(?:const|let|var)\s*\{([^{}]*)\}\s*=\s*require\(\s*['"](\.[^'"]+)['"]\s*\)/g)) {
      const f = los(pad, m[2]); if (!f) continue;
      const namen = new Set(); namenUit(m[1], namen);
      for (const n of namen) if (!kaart.has(n)) kaart.set(n, f);
    }
  }
  return kaart;
}

function git(args) {
  return execFileSync('git', args, { cwd: WORTEL, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
}

/* De gewijzigde bestanden sinds een commit, of een reden waarom dat niet kan. */
function gewijzigdSinds(commit) {
  if (!commit) return { reden: 'het register draagt geen commit in zijn stempel' };
  try { git(['cat-file', '-e', commit + '^{commit}']); }
  catch (e) {
    let ondiep = false;
    try { ondiep = git(['rev-parse', '--is-shallow-repository']).trim() === 'true'; } catch (e2) { /* geen git */ }
    return { reden: 'meetcommit ' + commit + ' staat niet in deze geschiedenis' +
      (ondiep ? ' (ondiepe kloon; `git fetch --unshallow` haalt hem op)' : '') };
  }
  const uit = git(['diff', '--name-only', commit, 'HEAD']);
  return { gewijzigd: new Set(uit.split('\n').filter(Boolean)) };
}

/* DE AFHANKELIJKHEDEN VAN EEN ROUTE, met graad. `handler` komt uit
   ROUTEBRON.json, `runtime` is de lijst kern-namen uit CONTEXTPROEF.json,
   `naamNaarBestand` lost een kern-naam op. Pure functie over zijn invoer. */
function afhankelijkhedenVan({ handler, runtime, naamNaarBestand, buren }) {
  const gemeten = new Map();
  const vermoed = new Map();
  if (!handler) return { handler: null, gemeten, vermoed, ongevolgd: [] };
  gemeten.set(handler, { graad: 'gemeten', koppeling: 'ROUTEBRON.json: de router handelt deze route af in dit bestand' });
  for (const naam of runtime || []) {
    for (const b of naamNaarBestand(naam) || []) {
      if (!gemeten.has(b)) {
        gemeten.set(b, { graad: 'gemeten', koppeling: 'CONTEXTPROEF.json: kern-naam `' + naam + '` aangeraakt tijdens het verzoek' });
      }
    }
  }
  const s = sluiting([handler], buren);
  for (const b of s.bestanden) {
    if (gemeten.has(b)) continue;
    vermoed.set(b, { graad: 'vermoed', koppeling: 'statische sluiting: ' + s.keten(b).join(' -> ') });
  }
  return { handler, gemeten, vermoed, ongevolgd: s.ongevolgd };
}

/* HET VERVAL VAN EEN ROUTE, per bewezen cel. Pure functie:
     cellen          { SCHAKEL: { staat, bron } } uit de bewijsmatrix
     afh             afhankelijkhedenVan()
     registerVan     bron-label -> { register, commit, herdraai } of null
     gewijzigdVoor   commit -> { gewijzigd: Set } of { reden }
   Terug: { verouderd, vermoed, onbekend } -- elk een lijst per cel. */
function vervalVan({ cellen, afh, registerVan, gewijzigdVoor }) {
  const verouderd = [], vermoed = [], onbekend = [];
  for (const [schakel, cel] of Object.entries(cellen || {})) {
    if (!cel || cel.staat !== 'bewezen') continue;
    if (ZONDER_REGISTER.has(cel.bron)) continue;
    const reg = registerVan(cel.bron);
    if (!reg) { onbekend.push({ schakel, reden: 'onbekend welk register de bron `' + cel.bron + '` schrijft' }); continue; }
    const commit = cel.evidenceCommit || reg.commit;
    const basis = { schakel, register: reg.register, commit, herdraai: reg.herdraai,
      ...(cel.evidenceBinding ? { evidenceBinding: cel.evidenceBinding } : {}) };
    if (cel.provenance === 'HISTORICAL_UNREVALIDATED') {
      onbekend.push({ ...basis, reden: 'historische route-evidence is niet opnieuw gevalideerd' }); continue;
    }
    if (!afh || !afh.handler) { onbekend.push({ ...basis, reden: 'geen gemeten bestand voor deze route (ROUTEBRON.json kent hem niet)' }); continue; }
    const ch = gewijzigdVoor(commit);
    if (!ch || ch.reden) { onbekend.push({ ...basis, reden: (ch && ch.reden) || 'meetcommit onbekend' }); continue; }
    const gm = [...afh.gemeten].filter(([b]) => ch.gewijzigd.has(b)).map(([bestand, k]) => ({ bestand, ...k }));
    if (gm.length) { verouderd.push({ ...basis, geraakt: gm }); continue; }
    const vm = [...afh.vermoed].filter(([b]) => ch.gewijzigd.has(b)).map(([bestand, k]) => ({ bestand, ...k }));
    if (vm.length) vermoed.push({ ...basis, aantal: vm.length, geraakt: vm.slice(0, 3) });
  }
  return { verouderd, vermoed, onbekend };
}

/* DE UITLEGKETEN van een verouderde cel, in de vijf stappen van de vraag. */
function uitleg(route, v) {
  return v.geraakt.map((g) => ({
    bestand: g.bestand,
    koppeling: g.koppeling + ' (' + g.graad + ')',
    route,
    bewijs: v.schakel + ' uit ' + v.register + ', gemeten op ' + v.commit,
    herdraai: v.herdraai
  }));
}

/* DE BOUWER: leest de registers eenmaal en geeft per route zijn verval.
   `opties.sinds` vervangt elke meetcommit (hypothetisch: "stel dat al het bewijs
   op X gemeten was"). */
function bouwer(opties) {
  const o = opties || {};
  const leesJ = (n) => { try { return JSON.parse(fs.readFileSync(path.join(WORTEL, n), 'utf8')); } catch (e) { return null; } };
  const { index } = require('./lib/werkelijkheid');
  const { zonderCommentaar } = require('./lib/bron');
  const ix = index(['server', 'scripts', 'public']);
  const ag = leesJ('AANROEPGRAAF.json') || { kanten: [] };
  const kh = leesJ('KERNHERKOMST.json') || { perNaam: [] };
  const rb = leesJ('ROUTEBRON.json') || { perRoute: [] };
  const ctx = leesJ('CONTEXTPROEF.json') || { perVerzoek: [] };
  const herkomst = new Map((kh.perNaam || []).map((x) => [x.naam, x.herkomsten || []]));
  const lees = (p) => { try { return zonderCommentaar(fs.readFileSync(path.join(WORTEL, p), 'utf8')); } catch (e) { return ''; } };
  const montageBron = {};
  for (const b of ix.bestanden.values()) if (MONTAGE.test(b.pad)) montageBron[b.pad] = lees(b.pad);
  const montage = montageHerkomst(montageBron, (p) => ix.bestanden.has(p));
  const buren = burenIndex(ix, ag.kanten, herkomst, lees, montage);
  const handlerVan = new Map((rb.perRoute || []).filter((r) => r && r.route).map((r) => [r.route, r.bestand || null]));
  const runtimeVan = new Map((ctx.perVerzoek || []).map((v) => [v.verzoek, (v.namen || []).map((n) => n.naam)]));
  const naamNaarBestand = (volledig) => {
    const naam = String(volledig).split('.').pop();
    const uit = [];
    for (const h of herkomst.get(naam) || []) {
      if (!h.bestand) continue;
      if (!MONTAGE.test(h.bestand)) uit.push(h.bestand);
      else if (montage.get(naam)) uit.push(montage.get(naam));
    }
    return uit;
  };
  const { REGISTERS } = require('./versheid');
  const herdraaiVan = new Map(REGISTERS.map((r) => [r[0], r[1]]));
  const regCache = new Map();
  const registerVan = (bron) => {
    const register = CEL_REGISTER[bron];
    if (!register) return null;
    if (!regCache.has(register)) {
      const st = stempelVan(register);
      regCache.set(register, { register, commit: o.sinds || (st && st.commit) || null,
        herdraai: herdraaiVan.get(register) || 'onbekend -- ' + register + ' staat niet in scripts/versheid.js' });
    }
    return regCache.get(register);
  };
  const diffCache = new Map();
  const gewijzigdVoor = (commit) => {
    if (!diffCache.has(commit)) diffCache.set(commit, gewijzigdSinds(commit));
    return diffCache.get(commit);
  };
  const afhCache = new Map();
  const afhVan = (route) => {
    if (!afhCache.has(route)) {
      afhCache.set(route, afhankelijkhedenVan({ handler: handlerVan.get(route) || null,
        runtime: runtimeVan.get(route), naamNaarBestand, buren }));
    }
    return afhCache.get(route);
  };
  return {
    verval: (route, cellen) => vervalVan({ cellen, afh: afhVan(route), registerVan, gewijzigdVoor }),
    afhankelijkheden: afhVan,
    bronnen: { routebron: rb.stempel || null, contextproef: ctx.stempel || null }
  };
}

function main() {
  const argv = process.argv.slice(2);
  const si = argv.indexOf('--sinds');
  const b = bouwer({ sinds: si > -1 ? argv[si + 1] : null });
  const matrix = require('./bewijsmatrix').bouw();
  if (matrix.gedegradeerd) { console.error('  de routekaart viel om: ' + matrix.reden); return 2; }
  const telling = { verouderd: 0, alleenVermoed: 0, onbekend: 0, actueel: 0, zonderBewezenCel: 0 };
  const perRoute = {};
  for (const rij of matrix.rijen) {
    const k = rij.methode + ' ' + rij.pad;
    const v = b.verval(k, rij.cellen);
    perRoute[k] = v;
    const bewezen = Object.values(rij.cellen).some((c) => c && c.staat === 'bewezen');
    if (!bewezen) telling.zonderBewezenCel++;
    else if (v.verouderd.length) telling.verouderd++;
    else if (v.onbekend.length) telling.onbekend++;
    else if (v.vermoed.length) telling.alleenVermoed++;
    else telling.actueel++;
  }
  if (argv.includes('--json')) { console.log(JSON.stringify({ telling, perRoute }, null, 2)); return 0; }
  console.log('\n  BEWIJSVERVAL PER ROUTE (graad van de koppeling: gemeten laat vervallen, vermoed staat erbij)\n');
  const uitleg0 = {
    verouderd: 'minstens een bewezen cel, en een GEMETEN afhankelijkheid veranderde sinds die meting',
    alleenVermoed: 'alleen een VERMOED afhankelijke wijziging; bewijs blijft staan, de keten staat erbij',
    onbekend: 'meetcommit of gemeten bestand ontbreekt; de grove halfwaardetijd geldt',
    actueel: 'geen enkele afhankelijkheid van een bewezen cel is gewijzigd',
    zonderBewezenCel: 'niets om te laten vervallen (ontbrekend of defect -- dat is een andere vraag)'
  };
  for (const [k, n] of Object.entries(telling)) console.log('  ' + k.padEnd(18) + String(n).padStart(6) + '  ' + uitleg0[k]);
  const ri = argv.indexOf('--route');
  if (ri > -1) {
    const k = argv[ri + 1];
    const v = perRoute[k];
    console.log('\n  ' + k);
    if (!v) console.log('    onbekende route');
    else {
      for (const c of v.verouderd) for (const u of uitleg(k, c)) {
        console.log('    bestand   ' + u.bestand + '\n    koppeling ' + u.koppeling + '\n    bewijs    ' + u.bewijs +
          '\n    herdraai  ' + u.herdraai + '\n');
      }
      for (const c of v.vermoed) console.log('    (vermoed) ' + c.schakel + ': ' + c.aantal + ' bestand(en), o.a. ' + c.geraakt[0].koppeling);
      for (const c of v.onbekend) console.log('    (onbekend) ' + c.schakel + ': ' + c.reden);
    }
  }
  console.log('');
  return 0;
}

module.exports = { sluiting, afhankelijkhedenVan, vervalVan, uitleg, bouwer, burenIndex, kernGebruik,
  fabriekParam, montageHerkomst, gewijzigdSinds, CEL_REGISTER, ZONDER_REGISTER, MONTAGE };

if (require.main === module) process.exitCode = main();
