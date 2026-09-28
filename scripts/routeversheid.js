#!/usr/bin/env node
/* ============================================================================
   DE ROUTEVERSHEID -- vervalt het bewijs van een route omdat iets waar hij van
   AFHANGT is veranderd?

   WAAROM DIT ER IS

   PROOF.md par. 2 zegt dat bewijs veroudert, en scripts/vertrouwen.js maakt dat
   waar -- maar grof, en dat staat er zelf in: "de halfwaardetijd geldt per
   REGISTER (de oudste stempel), niet per route. Per-route-versheid vraagt de
   slagveld-koppeling van PROOF.md paragraaf 7 en die bestaat nog niet."

   Die koppeling kan nu wel gelegd worden, want de twee helften liggen er:

     ROUTEBRON.json      in welk bestand wordt deze route afgehandeld (uit de
                         ROUTER, niet uit een regex)
     de require-graaf    wat dat bestand transitief laadt (scripts/lib/
                         werkelijkheid.js, dezelfde index als impactbereik.js)
     AANROEPGRAAF.json   wat het via de KERN-TAS bereikt -- de meeste
                         routebestanden hebben nul requires en krijgen hun domein
                         via `(kern) => ...`, dus zonder deze kanten ziet de
                         sluiting vrijwel niets

   Leg de sluiting van een route naast `git diff` sinds de commit waarop zijn
   bewijs is gemeten, en je weet per route of zijn bewijs over een vorige wereld
   spreekt. Dat is de vraag uit het voorstel voor een levende bewijsgraaf:
   PROVEN -> STALE -> REPROVE_REQUIRED, en alleen voor het deel dat geraakt is.

   DRIE STANDEN, EN WAAROM ER GEEN "WAARSCHIJNLIJK VERS" BIJ ZIT

     geraakt     een bestand in de sluiting is gewijzigd sinds de meting. Dit is
                 zeker, ook als de sluiting onvolledig is: wat we WEL zien, is
                 veranderd.
     vers        de sluiting is volledig gevolgd en er is niets in gewijzigd.
     onbepaald   niet vast te stellen, met de reden: de route heeft geen bekend
                 bronbestand, de meetcommit is niet in de geschiedenis (een
                 ondiepe kloon), of de sluiting loopt via een kern-naam die niet
                 te volgen is. Dat laatste is met opzet geen `vers`: een sluiting
                 met een gat erin die "niets gewijzigd" meldt, is precies de
                 blinde vlek die impactbereik.js voor Affected Proof Selection
                 tegenhield -- "de stilste vorm van kapot die dit huis kent".

   WAT DIT NIET IS

   Het is een SCHADUWMETING. Het verandert de staat in VERTROUWEN.json niet, en
   het schrijft geen register. Twee redenen:

     1. VERTROUWEN.json is geen rapport: server/middleware/schorspoort.js leest
        hem en zet routes dicht. Een nieuwe regel loopt eerst mee zonder te
        blokkeren (CONTROLPLANE.md, `schaduw.js`) -- je kunt niet afdwingen wat
        nooit in de schaduw heeft gelopen.
     2. De uitslag hangt aan HEAD. Een ingecheckt register met "vers" erin is
        bij de volgende commit al een bewering over het verleden. Een levende
        meting wordt dus uitgerekend wanneer iemand hem vraagt.

   En de meetcommit is GROF, net als de ouderdom in vertrouwen.js: het bewijs
   van een route is zo vers als het OUDSTE bronregister, want de elf cellen
   komen uit verschillende registers en een verse outputproef maakt een oude
   rolproef niet vers. Per cel de eigen commit is de fijnere stap daarna.

   Draai:  npm run routeversheid
           npm run routeversheid -- --route "POST /api/pay/oplaad"
           npm run routeversheid -- --json
           npm run routeversheid -- --sinds HEAD~1   (wat raakte de laatste commit)

   UITGANG  0 gemeten (ook als alles geraakt is -- dit is geen poort)
            2 niet vast te stellen: geen meetcommit, geen git, of geen ROUTEBRON
   ========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { stempelVan } = require('./lib/stempel');

const WORTEL = path.join(__dirname, '..');

/* Dezelfde montagewortel als in veranderbereik.js. server/server.js en
   server/opzet/ MONTEREN alles; wie erdoorheen blijft lopen, krijgt het hele
   huis in elke sluiting en dan is elke route altijd geraakt. Ze komen er wel
   IN (een route die in server.js woont hangt aan server.js), maar er wordt niet
   DOORHEEN gelopen. */
const MONTAGE = /^server\/(server\.js$|opzet\/)/;
const BRONMAPPEN = ['server/', 'scripts/', 'public/'];
const isBron = (p) => BRONMAPPEN.some((m) => p.startsWith(m));

/* De voorwaartse sluiting van een route. `buren(bestand)` geeft
   { naar: [bestanden], ongevolgd: n } -- `ongevolgd` telt de kern-namen die
   niet naar een bestand zijn op te lossen. Pure functie. */
function sluiting(start, buren) {
  const gezien = new Set();
  const ongevolgd = [];
  const stapel = start.filter(Boolean).filter(isBron);
  while (stapel.length) {
    const b = stapel.pop();
    if (gezien.has(b)) continue;
    gezien.add(b);
    if (MONTAGE.test(b)) continue;
    const v = buren(b) || { naar: [], ongevolgd: 0 };
    if (v.ongevolgd > 0) ongevolgd.push(b);
    for (const n of v.naar) if (isBron(n) && !gezien.has(n)) stapel.push(n);
  }
  return { bestanden: gezien, ongevolgd };
}

/* De stand van EEN route. Pure functie; de toets voert hem elke tak. */
function standVan({ bestanden, ongevolgd, gewijzigd, meetcommit }) {
  if (!bestanden || !bestanden.size) {
    return { stand: 'onbepaald', reden: 'geen bronbestand bekend voor deze route (ROUTEBRON.json kent hem niet)' };
  }
  const geraakt = [...bestanden].filter((b) => gewijzigd.has(b)).sort();
  if (geraakt.length) {
    return { stand: 'geraakt', geraakt, sluiting: bestanden.size,
      reden: geraakt.length + ' bestand(en) in de sluiting gewijzigd sinds ' + meetcommit +
        '; het bewijs spreekt over een vorige wereld',
      heropent: 'meet de proeven van deze route opnieuw' };
  }
  if (ongevolgd && ongevolgd.length) {
    return { stand: 'onbepaald', sluiting: bestanden.size, ongevolgd: ongevolgd.slice().sort(),
      reden: 'niets gewijzigd in wat te volgen is, maar ' + ongevolgd.length + ' bestand(en) in de ' +
        'sluiting roepen een kern-naam aan die niet naar een bestand is op te lossen ' +
        '(KERNHERKOMST.json) -- "niets gewijzigd" over een sluiting met een gat is geen uitslag' };
  }
  return { stand: 'vers', sluiting: bestanden.size,
    reden: 'de volledige sluiting (' + bestanden.size + ' bestanden) is ongewijzigd sinds ' + meetcommit };
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
const PARAM = '(\\{[^{}]*\\}|[A-Za-z_$][\\w$]*)';
function fabriekParam(bron) {
  const s = bron || '';
  let m = new RegExp('module\\.exports\\s*=\\s*(?:async\\s*)?(?:function\\s*[\\w$]*\\s*)?\\(\\s*' + PARAM).exec(s) ||
    new RegExp('module\\.exports\\s*=\\s*(?:async\\s*)?([A-Za-z_$][\\w$]*)\\s*=>').exec(s);
  if (m) return m[1];
  const n = /module\.exports\s*=\s*([A-Za-z_$][\w$]*)\s*;?\s*(?:\n|$)/.exec(s);
  if (!n) return null;
  const N = n[1].replace(/\$/g, '\\$');
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
  const p = param.replace(/\$/g, '\\$');
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

/* De meetcommit: die van het OUDSTE bronregister van de vervalstaten. */
function meetcommit(bronnen) {
  let oudste = null;
  for (const naam of bronnen) {
    const st = stempelVan(naam);
    if (!st || !st.op) continue;
    if (!oudste || new Date(st.op) < new Date(oudste.op)) oudste = { naam, op: st.op, commit: st.commit || null };
  }
  return oudste;
}

function git(args) {
  return execFileSync('git', args, { cwd: WORTEL, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
}

/* De gewijzigde bestanden sinds een commit, of een reden waarom dat niet kan. */
function gewijzigdSinds(commit) {
  if (!commit) return { reden: 'het oudste bronregister draagt geen commit in zijn stempel' };
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

function meet(opties) {
  const o = opties || {};
  const { BRONNEN } = require('./vertrouwen');
  const rb = JSON.parse(fs.readFileSync(path.join(WORTEL, 'ROUTEBRON.json'), 'utf8'));
  /* `sinds` vervangt de meetcommit: "stel dat het bewijs op X gemeten was,
     wat is er dan nu geraakt". Zo is de meter te ijken op een korte afstand, en
     beantwoordt hij ook de omgekeerde vraag: wat raakt de laatste commit? */
  const mc = o.sinds ? { naam: '--sinds', op: null, commit: o.sinds } : meetcommit(o.bronnen || BRONNEN);
  const sinds = gewijzigdSinds(mc && mc.commit);
  const kop = {
    soort: 'schaduw',
    uitleg: 'Per route: is een bestand waar hij van afhangt gewijzigd sinds zijn bewijs is gemeten? ' +
      'Verandert de vervalstaat in VERTROUWEN.json NIET en schrijft geen register.',
    meetcommit: mc,
    grens: 'De meetcommit is die van het OUDSTE bronregister, niet per cel. De sluiting volgt ' +
      'requires, opgeloste kern-kanten en de namen die een fabrieksmodule uit de tas haalt ' +
      '(KERNHERKOMST.json), en een naam uit de montagewortel wordt naar zijn require gevolgd -- ' +
      'is hij daar zelf gedefinieerd, dan hangt de route aan dat hele bestand (grof, per symbool is ' +
      'de volgende stap). Een route die via een ongevolgde kern-naam loopt kan ' +
      'hooguit `geraakt` of `onbepaald` zijn, nooit `vers`.'
  };
  if (!mc || sinds.reden) {
    return { ...kop, vastTeStellen: false, reden: mc ? sinds.reden : 'geen enkel bronregister draagt een stempel' };
  }
  const { index } = require('./lib/werkelijkheid');
  const ix = index(['server', 'scripts', 'public']);
  const ag = JSON.parse(fs.readFileSync(path.join(WORTEL, 'AANROEPGRAAF.json'), 'utf8'));
  const kh = JSON.parse(fs.readFileSync(path.join(WORTEL, 'KERNHERKOMST.json'), 'utf8'));
  const herkomst = new Map((kh.perNaam || []).map((x) => [x.naam, x.herkomsten || []]));
  /* Zonder commentaar: een `kern.x` in een toelichting is geen afhankelijkheid
     (scripts/lib/bron.js is de gedeelde verwijderaar; geen tweede). */
  const { zonderCommentaar } = require('./lib/bron');
  const lees = (p) => { try { return zonderCommentaar(fs.readFileSync(path.join(WORTEL, p), 'utf8')); } catch (e) { return ''; } };
  const montageBron = {};
  for (const b of ix.bestanden.values()) if (MONTAGE.test(b.pad)) montageBron[b.pad] = lees(b.pad);
  const montage = montageHerkomst(montageBron, (p) => ix.bestanden.has(p));
  const buren = burenIndex(ix, ag.kanten, herkomst, lees, montage);

  const telling = { geraakt: 0, vers: 0, onbepaald: 0 };
  const perRoute = {};
  const cache = new Map();
  const perBestand = new Map();
  let alleenMontage = 0;
  for (const r of rb.perRoute || []) {
    if (!r || !r.route) continue;
    let s = cache.get(r.bestand);
    if (!s) { s = sluiting([r.bestand], buren); cache.set(r.bestand, s); }
    const uit = standVan({ ...s, gewijzigd: sinds.gewijzigd, meetcommit: mc.commit });
    telling[uit.stand]++;
    if (uit.geraakt) {
      if (uit.geraakt.every((b) => MONTAGE.test(b))) alleenMontage++;
      for (const b of uit.geraakt) perBestand.set(b, (perBestand.get(b) || 0) + 1);
    }
    perRoute[r.route] = { bestand: r.bestand || null, ...uit };
  }
  return { ...kop, vastTeStellen: true, gewijzigdeBestanden: sinds.gewijzigd.size, telling,
    /* Hoeveel `geraakt` ALLEEN via de montagewortel binnenkwam. Ze blijven
       geraakt -- te ruim is de veilige kant -- maar apart geteld, anders leest
       een breed getal als precisie (dezelfde regel als veranderbereik.js). */
    alleenViaMontage: alleenMontage,
    /* De gewijzigde bestanden die het meeste bewijs verschalen: de impactvraag
       ("wat raakt deze wijziging") en tegelijk de lijst hubs die de grofheid
       van deze meting bepalen. */
    meestGeraakt: [...perBestand].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1)).slice(0, 15)
      .map(([bestand, routes]) => ({ bestand, routes })),
    perRoute };
}

function main() {
  const argv = process.argv.slice(2);
  if (!fs.existsSync(path.join(WORTEL, 'ROUTEBRON.json'))) {
    console.error('\n  ROUTEBRON.json ontbreekt; draai eerst `npm run routebron`.\n');
    return 2;
  }
  const si = argv.indexOf('--sinds');
  const u = meet({ sinds: si > -1 ? argv[si + 1] : null });
  if (argv.includes('--json')) { console.log(JSON.stringify(u, null, 2)); return u.vastTeStellen ? 0 : 2; }
  console.log('\n  ROUTEVERSHEID (schaduw -- de vervalstaat verandert hier niet)\n');
  if (!u.vastTeStellen) { console.log('  niet vast te stellen: ' + u.reden + '\n'); return 2; }
  console.log('  gemeten tegen   ' + u.meetcommit.commit + (u.meetcommit.op ? ' (' + u.meetcommit.naam + ', ' + u.meetcommit.op + ')' : ' (' + u.meetcommit.naam + ')'));
  console.log('  gewijzigd sinds ' + String(u.gewijzigdeBestanden).padStart(6) + ' bestanden');
  for (const [k, v] of Object.entries(u.telling)) console.log('  ' + k.padEnd(15) + String(v).padStart(6));
  console.log('    waarvan geraakt alleen via de montagewortel ' + u.alleenViaMontage);
  console.log('\n  meest geraakt (routes waarvan het bewijs door dit bestand verschaalt):');
  for (const m of u.meestGeraakt.slice(0, 10)) console.log('  ' + String(m.routes).padStart(6) + '  ' + m.bestand);
  const i = argv.indexOf('--route');
  if (i > -1) {
    const r = u.perRoute[argv[i + 1]];
    console.log('\n  ' + argv[i + 1] + ': ' + (r ? r.stand + ' -- ' + r.reden : 'onbekende route'));
    if (r && r.geraakt) for (const b of r.geraakt.slice(0, 20)) console.log('    ' + b);
  }
  console.log('\n  ' + u.grens + '\n');
  return 0;
}

module.exports = { sluiting, standVan, burenIndex, kernGebruik, fabriekParam, montageHerkomst, meetcommit, gewijzigdSinds, meet, MONTAGE };

if (require.main === module) process.exitCode = main();
