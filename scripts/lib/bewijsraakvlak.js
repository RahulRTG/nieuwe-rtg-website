/* ============================================================================
   HET BEWIJSRAAKVLAK -- welke bestanden kunnen DIT bewijs van DEZE app
   aantasten?

   (Niet te verwarren met scripts/raakvlakkeuring.js: dat is het aanraakvlak
   van een knop, WCAG 2.5.8. Hier gaat het om het vlak waar code en bewijs
   elkaar raken; in de rest van dit bestand heet dat kortweg het raakvlak.)

   WAAROM DIT ER IS. versheid() in ./stempel.js verklaart een heel register oud
   zodra er sinds de meting iets in server/ of public/ is veranderd (onder
   scripts/ al per instrument versmald). Dat is veilig en het is te grof: een
   wijziging in een willekeurig routebestand maakt alle 114 apps van APPWERKT
   oud. Bij de nulmeting van 19 oktober 2026 stonden waarheidsgetrouw en bevoegd
   zo een ronde lang op 0 met 191 gewijzigde bestanden, en een meter die altijd
   rood staat wordt of eindeloos opnieuw gedraaid, of genegeerd (LAT.md regel 9).

   DE REGEL. Een bewijs is vers als ELK bestand van zijn raakvlak nu dezelfde
   inhoud heeft als op de commit waarop het gemeten is. Verandert er een bestand
   IN het raakvlak, dan vervalt alleen dat bewijs, met de naam van dat bestand.
   Een bestand BUITEN elk raakvlak maakt niets oud.

   WAT ER IN HET RAAKVLAK ZIT, en waarom het ruim genoeg is:

     gedeeld     ALLES onder server/ wat niet aantoonbaar van een enkele route
                 is, plus alles onder public/ buiten public/apps/. Dit is
                 omgekeerd opgezet en dat is de kern van de veiligheid: een
                 bestand is GEDEELD tenzij bewezen is dat het alleen achter
                 routes hangt. De server injecteert zijn kern (db, accounts,
                 de poorten, de domeingrens) in elke router; welk ingespoten
                 stuk een handler gebruikt, is niet statisch te volgen. Dus
                 telt de hele opstartsluiting van server/server.js mee voor
                 elk bewijs van elke app -- inclusief de auth-middleware, de
                 sessie en de opzet die de routes ophangt. Een wijziging daar
                 maakt bevoegd (en de rest) overal oud. Ook gedeeld: elk
                 niet-.js-bestand onder server/ (een JSON die met fs wordt
                 gelezen ziet geen require-graaf), elk serverbestand dat
                 nergens statisch wordt geladen (het kan dynamisch geladen
                 worden), en elk routebestand dat zelf middleware hangt
                 (`.use(`), want dat onderschept ook andermans verzoeken.
     eigen       het ingangsscherm met wat het statisch laadt (scripts,
                 stijlen, imports, bundeldelen, en elk ander bestand onder
                 public/ dat het letterlijk noemt); de handlerbestanden van de
                 routes die dat scherm (of de proef) noemt, gevraagd aan de
                 ROUTER van de huidige boom (scripts/lib/routes.js); hun
                 require-sluiting; en de registratieketen erboven (de
                 domein-index die ze ophangt, met zijn middleware).
     instrument  de require-sluiting van het meetinstrument onder scripts/,
                 zoals sluiting() in ./stempel.js die al rekende. Bij de
                 voltooiproef alleen het EIGEN scenario: elk scenario draait
                 met een eigen datamap en een eigen server, dus het scenario
                 van een andere app kan deze uitslag niet veranderen.

   WAAROM DE HUIDIGE BOOM HET RAAKVLAK MAG BEPALEN. Het raakvlak wordt NU
   berekend, niet op de meetcommit. Dat is sluitend: een bestand dat op de
   meetcommit wel in het raakvlak zat en nu niet meer, kan er alleen uit
   gevallen zijn doordat een bestand dat er NU nog in zit veranderde (de
   require, de route of de verwijzing is weg). Dat veranderde bestand maakt het
   bewijs dan al oud. Een bestand dat er nieuw in komt, bestond op de meetcommit
   niet of was er anders -- ook oud. Een verwijderd serverbestand maakt alles
   oud, want wie het met fs of een berekende require las, is niet te zien.

   VEILIG FALEN. Is het raakvlak niet vast te stellen -- een berekende require
   die niet statisch te volgen is, een route die de router zonder bestand kent,
   een scherm dat code laadt met een berekend pad, geen git -- dan valt DIT
   bewijs terug op de grove regel van versheid(). Nooit op "vers".

   KNOEIEN. Elk bestand krijgt een sha256 van zijn inhoud, en elk bewijs een
   samengestelde hash over zijn hele raakvlak. Bij de controle moet de huidige
   inhoud gelijk zijn aan de opgeslagen hash EN aan de inhoud op de meetcommit
   (via de blob-id van git). Een opgeslagen hash die is bijgewerkt naar de
   nieuwe inhoud valt daarmee door de mand: op de meetcommit stond iets anders.
   Wat dit niet afvangt, en ook niet kan: wie de COMMIT in het stempel vervalst,
   vervalst de meting zelf. Daar zit het vertrouwen, net als bij de grove regel.
   ========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');
const { zonderCommentaar } = require('./bron');

const WORTEL = path.join(__dirname, '..', '..');

/* Berekende requires in de servercode die WEL te volgen zijn, met wat ze laden.
   Een berekende require zonder letterlijk voorvoegsel en zonder regel hier maakt
   het raakvlak onbepaald; test/bewijsraakvlak.test.js houdt deze lijst eerlijk. */
const DYNAMISCH = {
  'server/kern/spellen/register.js': ['server/kern/spellen/'],
  'server/kern/magnaat-capabilities-bronnen.js': ['server/kern/afdelingen/register']
};

/* De voltooiproef laadt elk scenario letterlijk; voor een bewijs telt alleen
   het eigen scenario (zie de kop). */
const SCENARIOMAP = 'scripts/lib/voltooi/';

const sha256 = (buf) => crypto.createHash('sha256').update(buf).digest('hex');
const blobId = (buf) => crypto.createHash('sha1').update('blob ' + buf.length + '\0').update(buf).digest('hex');

function maakWereld(opties = {}) {
  const wortel = opties.wortel ? path.resolve(opties.wortel) : WORTEL;
  const w = { wortel, cache: new Map(), bomen: new Map(), gebruikt: new Set() };

  w.git = (args) => {
    try {
      return execFileSync('git', args, { cwd: wortel, encoding: 'utf8', maxBuffer: 1 << 28,
        stdio: ['ignore', 'pipe', 'ignore'] });
    } catch (e) { return null; }
  };

  /* Wat er nu in de boom staat: gevolgd en ongevolgd-maar-niet-genegeerd. */
  let lijst = null;
  w.lijst = () => {
    if (lijst) return lijst;
    const uit = w.git(['ls-files', '-co', '--exclude-standard', '-z']);
    if (uit === null) return (lijst = null);
    lijst = new Set(uit.split('\0').filter(Boolean).filter((p) => fs.existsSync(path.join(wortel, p))));
    return lijst;
  };

  w.inhoud = (rel) => {
    if (w.cache.has(rel)) return w.cache.get(rel);
    let b = null;
    try { b = fs.readFileSync(path.join(wortel, rel)); } catch (e) { b = null; }
    w.cache.set(rel, b);
    return b;
  };
  const shas = new Map(), blobs = new Map();
  w.sha = (rel) => {
    if (!shas.has(rel)) { const b = w.inhoud(rel); shas.set(rel, b === null ? null : sha256(b)); }
    return shas.get(rel);
  };
  w.blob = (rel) => {
    if (!blobs.has(rel)) { const b = w.inhoud(rel); blobs.set(rel, b === null ? null : blobId(b)); }
    return blobs.get(rel);
  };

  /* De boom op een commit, als pad -> blob-id. Een onbekende commit -> null. */
  w.boomOp = (commit) => {
    if (w.bomen.has(commit)) return w.bomen.get(commit);
    let boom = null;
    if (/^[0-9a-f]{4,40}$/i.test(String(commit || ''))) {
      const uit = w.git(['ls-tree', '-r', '-z', commit]);
      if (uit !== null) {
        boom = new Map();
        for (const r of uit.split('\0')) {
          const m = /^\d+ blob ([0-9a-f]+)\t(.+)$/.exec(r);
          if (m) boom.set(m[2], m[1]);
        }
      }
    }
    w.bomen.set(commit, boom);
    return boom;
  };

  w.routes = () => {
    if (w._routes !== undefined) return w._routes;
    if (opties.routes) return (w._routes = opties.routes);
    try { w._routes = require('./routes').alleRoutes(); } catch (e) { w._routes = null; }
    return w._routes;
  };

  w.bundels = () => {
    if (w._bundels !== undefined) return w._bundels;
    if (opties.bundels) return (w._bundels = opties.bundels);
    try { w._bundels = require('../bundel').bundels; } catch (e) { w._bundels = {}; }
    return w._bundels;
  };
  return w;
}

/* ---- DE REQUIRE-KANTEN VAN EEN BESTAND ------------------------------------
   { naar: [rel...], registratie: [rel...], onbekend: [tekst...] }. `registratie`
   is een kant uit de opzet die een router OPHANGT --
   `require('../routes/x')(grens('x'))` -- en geen dienst in de kern zet. */
function kanten(w, rel) {
  const sleutel = 'kanten:' + rel;
  if (w.cache.has(sleutel)) return w.cache.get(sleutel);
  const uit = { naar: [], registratie: [], onbekend: [] };
  w.cache.set(sleutel, uit);
  const buf = w.inhoud(rel);
  if (buf === null || !/\.(c?js|mjs)$/.test(rel)) return uit;
  let bron = buf.toString('utf8');
  try { bron = zonderCommentaar(bron); } catch (e) { /* dan de ruwe bron: ruimer */ }
  const lijst = w.lijst() || new Set();
  const map = path.posix.dirname(rel);
  const los = (spec, vanaf) => {
    const basis = spec.startsWith('.') ? path.posix.normalize(path.posix.join(vanaf, spec)) : path.posix.normalize(spec);
    for (const k of [basis, basis + '.js', basis + '.json', basis + '/index.js']) if (lijst.has(k)) return k;
    return null;
  };
  const voorvoegsel = (pref) => [...lijst].filter((p) => p.startsWith(pref));
  for (const m of bron.matchAll(/\brequire\s*\(/g)) {
    /* Het argument tot de bijpassende sluithaak. */
    let i = m.index + m[0].length, diepte = 1, arg = '';
    while (i < bron.length && diepte) {
      const c = bron[i];
      if (c === '(') diepte++;
      else if (c === ')') { diepte--; if (!diepte) break; }
      arg += c; i++;
    }
    arg = arg.trim();
    const na = bron.slice(i + 1, i + 40);
    const lit = /^'([^']*)'$|^"([^"]*)"$|^`([^`$]*)`$/.exec(arg);
    if (lit) {
      const naam = lit[1] ?? lit[2] ?? lit[3];
      if (!naam.startsWith('.') && !/^(server|scripts|public)\//.test(naam)) continue;   // een pakket
      const doel = los(naam, map);
      if (!doel) { uit.onbekend.push(rel + ': de require van ' + arg + ' wijst naar niets'); continue; }
      (/^\s*\(\s*grens\s*\(/.test(na) ? uit.registratie : uit.naar).push(doel);
      continue;
    }
    if (!arg) continue;   // `require()` in een tekst
    if (DYNAMISCH[rel]) { for (const p of DYNAMISCH[rel]) uit.naar.push(...voorvoegsel(p)); continue; }
    /* `for (const b of LIJST) require(b)` met een letterlijke LIJST in hetzelfde
       bestand (server/routes/office/register.js): elk element is een kant. */
    if (/^[A-Za-z_$][\w$]*$/.test(arg)) {
      const lus = new RegExp('for\\s*\\(\\s*(?:const|let|var)\\s+' + arg + '\\s+of\\s+([A-Za-z_$][\\w$]*)\\s*\\)').exec(bron);
      const lijstBron = lus && new RegExp('(?:const|let|var)\\s+' + lus[1] + '\\s*=\\s*\\[([^\\]]*)\\]').exec(bron);
      const elementen = lijstBron ? [...lijstBron[1].matchAll(/(['"])([^'"]+)\1/g)].map((x) => x[2]) : [];
      if (elementen.length && lijstBron[1].replace(/(['"])[^'"]*\1|[\s,]/g, '') === '') {
        let ok = true;
        for (const e of elementen) {
          if (!e.startsWith('.')) continue;
          const doel = los(e, map);
          if (doel) uit.naar.push(doel); else { ok = false; uit.onbekend.push(rel + ': de require van ' + arg + ' met ' + e + ' wijst naar niets'); }
        }
        if (ok) continue;
        continue;
      }
    }
    /* Een berekend pad met een letterlijk relatief begin: alles wat daarmee kan
       beginnen. `require('./reis/' + n)` laadt dus elk bestand onder ./reis/. */
    /* path.join(BASIS, 'a', 'b') met een basis die in dit bestand zelf vaststaat:
       __dirname, of een naam als `const WORTEL = path.join(__dirname, '..')`
       (ook `x || WORTEL`). Alle delen letterlijk: een gewone kant. */
    const pj = /^path\.(?:join|resolve)\(\s*(?:[A-Za-z_$][\w$]*\s*\|\|\s*)?([A-Za-z_$][\w$]*)\s*((?:,\s*(['"])[^'"]*\3\s*)*)\)$/.exec(arg);
    const basis = pj && (pj[1] === '__dirname' ? map : vasteMap(bron, pj[1], map));
    if (pj && basis !== null) {
      const delen = [...pj[2].matchAll(/(['"])([^'"]*)\1/g)].map((x) => x[2]);
      const doel = los('./' + path.posix.join(path.posix.relative(map, basis) || '.', ...delen), map);
      if (doel) { (/^\s*\(\s*grens\s*\(/.test(na) ? uit.registratie : uit.naar).push(doel); continue; }
      uit.onbekend.push(rel + ': de require van ' + arg.slice(0, 60) + ' wijst naar niets');
      continue;
    }
    const kop = /^(['"`])(\.{1,2}\/[^'"`$]*)\1?/.exec(arg) || /^path\.join\(\s*__dirname\s*,\s*(['"`])([^'"`$]*)\1/.exec(arg);
    if (kop) {
      const pref = path.posix.normalize(path.posix.join(map, kop[2]));
      const doelen = voorvoegsel(pref.endsWith('/') || kop[2].endsWith('/') ? pref.replace(/\/?$/, '/') : pref);
      if (!doelen.length) { uit.onbekend.push(rel + ': de require van ' + arg.slice(0, 60) + ' laadt niets bekends'); continue; }
      (/^\s*\(\s*grens\s*\(/.test(na) ? uit.registratie : uit.naar).push(...doelen);
      continue;
    }
    /* Alleen pakketnamen erin (scripts/lib/scherm.js laadt playwright zo): geen
       pad in deze boom. Anders onbekend. */
    const teksten = [...arg.matchAll(/(['"`])([^'"`]*)\1/g)].map((x) => x[2]);
    if (teksten.length && teksten.every((t) => !t.startsWith('.') && !t.includes('/') || /^[@a-z][\w.-]*\/[\w.-]+$/.test(t) && !/^(server|scripts|public)\//.test(t))
      && !/\b(__dirname|path\.|naam|map|root)\b/.test(arg.replace(/(['"`])[^'"`]*\1/g, ''))) continue;
    uit.onbekend.push(rel + ': een require van ' + arg.slice(0, 60));
  }
  return uit;
}

/* Welke map is `naam` in dit bestand? Alleen als het daar letterlijk staat:
   `const NAAM = path.join(__dirname, '..', '..')`. Anders null. */
function vasteMap(bron, naam, map) {
  const m = new RegExp('(?:const|let|var)\\s+' + naam.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') +
    '\\s*=\\s*path\\.(?:join|resolve)\\(\\s*__dirname\\s*((?:,\\s*([\'"])[^\'"]*\\2\\s*)*)\\)').exec(bron);
  if (!m) return null;
  const delen = [...m[1].matchAll(/(['"])([^'"]*)\1/g)].map((x) => x[2]);
  return path.posix.normalize(path.posix.join(map, ...delen));
}

/* Voorwaartse sluiting. `stop(rel)` = wel opnemen, niet verder volgen.
   `volgRegistratie`: registratiekanten ook volgen (voor een handler niet nodig,
   voor de kern niet gewenst). */
function sluitingVan(w, starts, { stop = () => false, volg = () => true } = {}) {
  const gezien = new Set(), onbekend = [];
  const rij = [...starts];
  while (rij.length) {
    const f = rij.shift();
    if (gezien.has(f)) continue;
    gezien.add(f);
    if (stop(f)) continue;
    const k = kanten(w, f);
    onbekend.push(...k.onbekend);
    for (const d of k.naar) if (volg(f, d)) rij.push(d);
  }
  return { bestanden: gezien, onbekend };
}

const isRoute = (p) => p.startsWith('server/routes/');

/* ---- DE KERN EN HET GEDEELDE DEEL -------------------------------------- */
function gedeeld(w) {
  if (w._gedeeld !== undefined) return w._gedeeld;
  const lijst = w.lijst();
  if (!lijst) return (w._gedeeld = { bepaald: false, reden: 'git kan de boom niet opsommen' });
  if (!lijst.has('server/server.js')) return (w._gedeeld = { bepaald: false, reden: 'server/server.js ontbreekt; de kern is niet vast te stellen' });
  /* De opstartsluiting. Een routebestand dat de kern als DIENST laadt (en niet
     ophangt) hoort erbij en wordt gevolgd; een registratie niet. */
  const kern = sluitingVan(w, ['server/server.js']);
  if (kern.onbekend.length) {
    return (w._gedeeld = { bepaald: false, reden: 'de opstartsluiting heeft een require die niet te volgen is: ' + kern.onbekend[0] });
  }
  /* Wat statisch achter routes hangt: vanaf elk routebestand dat niet in de
     kern zit. */
  const routeBestanden = [...lijst].filter((p) => isRoute(p) && /\.js$/.test(p) && !kern.bestanden.has(p));
  const achterRoutes = sluitingVan(w, routeBestanden, { stop: (f) => kern.bestanden.has(f) }).bestanden;
  const middleware = new Set();
  for (const p of routeBestanden) {
    let b = (w.inhoud(p) || '').toString('utf8');
    try { b = zonderCommentaar(b); } catch (e) { /* ruw */ }
    if (/\.use\s*\(/.test(b)) middleware.add(p);
  }
  const eigenMogelijk = new Set();
  for (const p of achterRoutes) {
    if (kern.bestanden.has(p) || middleware.has(p)) continue;
    if (!p.startsWith('server/') || !/\.js$/.test(p)) continue;
    eigenMogelijk.add(p);
  }
  const deel = new Set();
  for (const p of lijst) if (p.startsWith('server/') && !eigenMogelijk.has(p)) deel.add(p);
  for (const p of kern.bestanden) deel.add(p);   // ook wat de kern buiten server/ laadt
  /* Een bestand onder public/ dat de SERVER bij naam noemt (een landing die
     hij herschrijft, een JSON die een route voorleest) hangt niet aan een
     scherm maar aan die servercode, en die is gedeeld. Dus gedeeld. */
  const publiek = new Set([...lijst].filter((p) => p.startsWith('public/')));
  for (const p of lijst) {
    if (!p.startsWith('server/') || !/\.js$/.test(p)) continue;
    const t = (w.inhoud(p) || '').toString('utf8');
    for (const m of t.matchAll(/['"`]((?:public)?\/?(?:apps|shared|site|campagne|fonts|images)\/[\w@./-]+\.\w+)/g)) {
      /* Een adres in een catalogus ('/apps/x.html' als link) leest niets; een
         pad bij een bestandsoperatie of met 'public' erin wel. */
      const ervoor = t.slice(Math.max(0, m.index - 200), m.index);
      if (!m[1].startsWith('public') && !/(readFile|sendFile|createReadStream|statSync|existsSync|readdir|['"`]public['"`])/.test(ervoor)) continue;
      const k = path.posix.normalize(m[1].startsWith('public') ? m[1] : 'public/' + m[1].replace(/^\//, ''));
      if (publiek.has(k)) deel.add(k);
    }
  }
  return (w._gedeeld = { bepaald: true, bestanden: deel, eigenMogelijk, middleware: [...middleware].sort() });
}

/* ---- HET SCHERM ----------------------------------------------------------
   Wat een scherm LAADT, en wat het alleen NOEMT.

   GELADEN wordt gevolgd: de ingang, elk script, elke stijl, elke JSON, elke
   bundel (via zijn delen), elk bestand dat een berekend pad met een letterlijk
   begin kan opleveren -- en ook de gedeelde schil. Die is hier met opzet geen
   uitzondering: basis.js en rtg-world-desktop.js laden op vrijwel elk scherm
   tientallen modules uit /shared/, en een wijziging daar maakt dus vrijwel elk
   scherm oud. Dat is correct, en het komt uit de meting en niet uit een
   aanname. Een gedeeld bestand dat een scherm NIET laadt (een losse module
   van een andere app, een landingspagina, een afbeelding van iemand anders)
   maakt dat scherm niet oud.

   GENOEMD telt als bestand maar wordt niet gevolgd: een afbeelding, een
   lettertype. Een link naar een ANDER scherm telt niet: dat scherm draait
   hier niet, en wat het doet is zijn eigen meting. Gemeten op 19 oktober
   2026: het menu van de schil noemt vrijwel elk scherm, en met links erbij
   maakte een regel in mijn-post.html alle 101 apps oud.

   BEREKENDE PADEN. `'/shared/' + bron[0] + '.js'` levert elk bestand dat op
   /shared/STER.js past, met de ster binnen een padsegment; een staart die open
   blijft (`'/shared/' + x`) mag alles eronder zijn. Een src of import met
   alleen een naam (`s.src = pad`) neemt zijn waarde uit een letterlijk pad of
   patroon elders in hetzelfde bestand, of uit een blob -- dat is de ene
   aanname hier, en hij staat in test/bewijsraakvlak.test.js. Een berekend pad met
   een letterlijk begin dat op NIETS past, is niet te verklaren: onbepaald. */
const LAADT = /\.(?:m?js|css|json|webmanifest)$/i;
const EXT = 'm?js|css|json|html?|webmanifest|svg|png|jpe?g|webp|avif|gif|ico|woff2?|ttf|otf|mp3|mp4|webm|ogg|wav|txt|xml|wasm|onnx';
function globPubliek(lijst, glob, vanaf) {
  const basis = glob.startsWith('/') ? 'public' + glob : path.posix.join(path.posix.dirname(vanaf), glob);
  const delen = basis.split('*');
  /* normalize zou een kop als "public/x/" heel laten en "./" wegpoetsen; de
     slotstreep blijft staan omdat hij betekent: binnen deze map. */
  const kop = path.posix.normalize(delen[0]) + (delen[0].endsWith('/') && !path.posix.normalize(delen[0]).endsWith('/') ? '/' : '');
  const esc = (d) => d.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
  let re = esc(kop);
  for (let i = 1; i < delen.length; i++) re += (i === delen.length - 1 && delen[i] === '' ? '.*' : '[^/]*') + esc(delen[i]);
  const r = new RegExp('^' + re + '$');
  return [...lijst].filter((p) => p.startsWith(kop) && r.test(p));
}

function verwijzingen(w, f) {
  const sleutel = 'verw:' + f;
  if (w.cache.has(sleutel)) return w.cache.get(sleutel);
  const lijst = w.lijst() || new Set();
  const bundels = w.bundels();
  const uit = { laadt: [], noemt: [], onbekend: [] };
  w.cache.set(sleutel, uit);
  const buf = w.inhoud(f);
  if (buf === null || !/\.(m?js|css|html?|json|webmanifest)$/.test(f)) return uit;
  /* Een ander SCHERM (.html) is een bestemming: het draait niet in dit scherm,
     en wat het doet is zijn eigen meting. De schil linkt naar vrijwel elk
     scherm, dus anders zou elke schermwijziging elk bewijs oud maken. Een
     afbeelding of lettertype draait ook niet, maar kan wel de bladzijde
     verschuiven (een knop onder iets anders): die telt mee. */
  const plaats = (doelen) => { for (const d of doelen) { if (LAADT.test(d)) uit.laadt.push(d); else if (!/\.html?$/.test(d)) uit.noemt.push(d); } };
  const zoek = (ref) => {
    const kaal = ref.split('#')[0].split('?')[0];
    if (!kaal || /^[a-z]+:/i.test(kaal) || kaal.startsWith('//')) return [];
    const p = kaal.startsWith('/') ? path.posix.normalize('public' + kaal) : path.posix.normalize(path.posix.join(path.posix.dirname(f), kaal));
    const doelen = [];
    if (lijst.has(p)) doelen.push(p);
    /* Een bundel bestaat als delen; de delen zijn de bron. */
    const rel = p.replace(/^public\//, '');
    if (bundels[rel]) for (const d of lijst) if (d.startsWith('public/' + bundels[rel] + '/')) doelen.push(d);
    return doelen;
  };
  let tekst = buf.toString('utf8');
  if (/\.m?js$/.test(f)) { try { tekst = zonderCommentaar(tekst); } catch (e) { /* ruw: ruimer */ } }
  /* Letterlijke verwijzingen. */
  const LIT = new RegExp('(?:["\'`(]|\\b(?:src|href)=)\\s*([\\w@./~-]+\\.(?:' + EXT + '))(?:[?#][^"\'`)\\s]*)?', 'gi');
  for (const m of tekst.matchAll(LIT)) plaats(zoek(m[1]));
  /* Samengestelde paden met een letterlijk begin. */
  for (const m of tekst.matchAll(/(['"`])((?:\/|\.\.?\/)[\w@./~-]*)(\1\s*\+|\$\{)/g)) {
    if (m[2].startsWith('/api/') || m[2] === '/') continue;
    let glob = m[2] + '*';
    let i = m.index + m[0].length;
    if (m[3] === '${') {
      const eind = tekst.indexOf('`', i);
      glob = m[2] + tekst.slice(i - 2, eind < 0 ? i : eind).replace(/\$\{[^}]*\}?/g, '*');
    } else {
      /* De keten: + iets + 'tekst' + ... */
      for (let n = 0; n < 6; n++) {
        const rest = tekst.slice(i, i + 200);
        const op = /^\s*([A-Za-z_$][\w$.]*(?:\[[^\]]*\])*(?:\([^)]*\))?)\s*\+\s*(['"`])([^'"`\n]*)\2/.exec(rest);
        if (!op) break;
        glob += op[3] + '*';
        i += op[0].length;
        if (!/^\s*\+/.test(tekst.slice(i, i + 5))) { glob = glob.slice(0, -1); break; }
        i += /^\s*\+/.exec(tekst.slice(i, i + 5))[0].length;
      }
    }
    glob = glob.split('?')[0].split('#')[0].replace(/\*+/g, '*');
    if (!/\.\w+$/.test(glob) && !glob.endsWith('*')) continue;
    const doelen = globPubliek(lijst, glob, f);
    if (doelen.length) { plaats(doelen); continue; }
    /* Een code-pad dat op niets past, is niet te verklaren. */
    if (/\.(m?js|css)$/.test(glob)) uit.onbekend.push(f + ': laadt ' + glob + ', en dat past op geen enkel bestand');
  }
  return uit;
}

function schermDeel(w, ingang) {
  const sleutel = 'scherm:' + ingang;
  if (w.cache.has(sleutel)) return w.cache.get(sleutel);
  const lijst = w.lijst() || new Set();
  const start = 'public' + String(ingang).split('#')[0].split('?')[0];
  const geladen = new Set(), bestanden = new Set(), onbekend = [];
  if (!lijst.has(start)) onbekend.push('het ingangsscherm ' + start + ' bestaat niet');
  const rij = [start];
  while (rij.length) {
    const f = rij.shift();
    if (geladen.has(f)) continue;
    geladen.add(f);
    bestanden.add(f);
    const v = verwijzingen(w, f);
    onbekend.push(...v.onbekend);
    rij.push(...v.laadt);
    for (const n of v.noemt) bestanden.add(n);
  }
  /* `geladen` draait in dit scherm (daaruit komen de API-paden); `bestanden`
     telt daarnaast wat het alleen noemt. */
  const uit = { bestanden, geladen, onbekend };
  w.cache.set(sleutel, uit);
  return uit;
}

/* De API-paden die een stuk code noemt, als PATROON: een letterlijk stuk blijft
   staan, alles wat erbij wordt geplakt (een naam, een sjabloongat) wordt `*`.
   `'/api/' + w + '/doe/bevestig'` wordt dus /api/ STER /doe/bevestig, en een
   kale '/api/office/' die later aan iets vast komt, /api/office/ STER. Een tekst die
   alleen VERGELEKEN wordt (indexOf, startsWith, includes, ===) roept niets aan
   en telt niet: verbinding.js test zo of een verzoek naar /api/ gaat, en dat
   maakte anders van elke route een raakvlak van elk scherm.
   Ruimer dan scripts/schermroutes.js, en dat mag: te ruim kan een raakvlak
   alleen groter maken. */
function apiPaden(tekst) {
  const uit = new Set();
  const re = /(['"`])(\/api(?:\/|\1)[^'"`\n]*)/g;
  for (const m of tekst.matchAll(re)) {
    const voor = tekst.slice(Math.max(0, m.index - 30), m.index);
    if (/(?:\.(?:indexOf|lastIndexOf|startsWith|endsWith|includes)\(\s*|[!=]==?\s*)$/.test(voor)) continue;
    let pat = m[2].replace(/\$\{[^}]*\}?/g, '*');
    let i = m.index + 1 + m[2].length;
    const sluit = tekst[i] === m[1];
    if (sluit) i++;
    else pat += '*';   // de tekst loopt door over een regel: open houden
    /* De keten erachter: + 'tekst' of + iets anders. */
    for (;;) {
      const plus = /^\s*\+\s*/.exec(tekst.slice(i, i + 20));
      if (!plus) break;
      i += plus[0].length;
      const lit = /^(['"`])([^'"`\n]*)\1/.exec(tekst.slice(i, i + 300));
      if (lit) { pat += lit[2].replace(/\$\{[^}]*\}?/g, '*'); i += lit[0].length; continue; }
      pat += '*';
      let diepte = 0;
      while (i < tekst.length) {
        const c = tekst[i];
        if ('([{'.includes(c)) diepte++;
        else if (')]}'.includes(c)) { if (!diepte) break; diepte--; }
        else if (!diepte && (c === ',' || c === ';' || c === '\n' || c === '+' || c === '?' || c === ':')) break;
        i++;
      }
    }
    pat = pat.split('?')[0].split('#')[0];
    if (pat === '/api') pat = '/api/*';
    if (pat.endsWith('/')) pat += '*';
    uit.add(pat.replace(/\*+/g, '*'));
  }
  return uit;
}

function routeRegex(pad) {
  const re = String(pad).split(/(:[A-Za-z_]\w*\??|\*)/).map((d) =>
    d === '*' ? '.*' : /^:/.test(d) ? '[^/]+' : d.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('');
  return new RegExp('^' + re + '/?$');
}
const globRegex = (g) => new RegExp('^' + g.split('*').map((d) => d.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('.*') + '/?$');

/* Kan een verzoek naar dit patroon bij deze route uitkomen? In twee richtingen
   proberen: het patroon tegen een voorbeeld van de route (`:id` -> X), en de
   route tegen voorbeelden van het patroon (`*` -> X en X/X). */
const regexCache = new Map();
function onthoud(sleutel, maak) {
  let v = regexCache.get(sleutel);
  if (!v) { v = maak(); regexCache.set(sleutel, v); }
  return v;
}
function raakt(glob, pad) {
  const route = onthoud('r:' + pad, () => ({ re: routeRegex(pad), voorbeeld: String(pad).replace(/:[A-Za-z_]\w*\??/g, 'X').replace(/\*/g, 'X') }));
  const pat = onthoud('g:' + glob, () => ({ re: globRegex(glob), een: glob.replace(/\*/g, 'X'), twee: glob.replace(/\*/g, 'X/X'),
    kop: glob.split('*')[0] }));
  /* Snel nee: zonder ster of param moeten de koppen op elkaar aansluiten. */
  const rkop = String(pad).split(/[:*(]/)[0];
  if (!pat.kop.startsWith(rkop) && !rkop.startsWith(pat.kop)) return false;
  return pat.re.test(route.voorbeeld) || route.re.test(pat.een) || route.re.test(pat.twee);
}

/* Welke handlerbestanden dienen deze patronen? Gevraagd aan de router van de
   huidige boom. */
function handlers(w, globs) {
  const routes = w.routes();
  if (!routes) return { bepaald: false, reden: 'de router van de huidige boom is niet te ondervragen (scripts/lib/routes.js)' };
  const bestanden = new Set(), onbekend = [];
  if (!w._perGlob) w._perGlob = new Map();
  for (const g of globs) {
    let per = w._perGlob.get(g);
    if (!per) {
      per = { bestanden: [], onbekend: [] };
      for (const r of routes) {
        if (!raakt(g, r.pad)) continue;
        if (r.bestand) per.bestanden.push(r.bestand);
        else per.onbekend.push(r.methode + ' ' + r.pad + ' heeft bij de router geen bronbestand');
      }
      w._perGlob.set(g, per);
    }
    for (const b of per.bestanden) bestanden.add(b);
    onbekend.push(...per.onbekend);
  }
  return { bepaald: true, bestanden, onbekend };
}

/* De registratieketen boven een routebestand: wie het (transitief) laadt binnen
   server/routes/, plus de domein-index die de opzet ophangt. */
function voorouders(w, starts) {
  const lijst = w.lijst() || new Set();
  if (!w._omgekeerd) {
    w._omgekeerd = new Map();
    for (const p of lijst) {
      if (!isRoute(p) || !/\.js$/.test(p)) continue;
      const k = kanten(w, p);
      for (const d of k.naar.concat(k.registratie)) {
        if (!w._omgekeerd.has(d)) w._omgekeerd.set(d, new Set());
        w._omgekeerd.get(d).add(p);
      }
    }
  }
  const gezien = new Set(), rij = [...starts];
  while (rij.length) {
    const f = rij.shift();
    for (const v of w._omgekeerd.get(f) || []) if (!gezien.has(v)) { gezien.add(v); rij.push(v); }
  }
  return gezien;
}

/* Wat een instrument onder scripts/ inleest. Bij de voltooiproef alleen het
   eigen scenario. */
function instrumentDeel(w, instrument, scenario) {
  if (!instrument) return { bepaald: false, reden: 'het stempel noemt geen instrument' };
  const lijst = w.lijst() || new Set();
  if (!lijst.has(instrument)) return { bepaald: false, reden: 'het instrument ' + instrument + ' bestaat niet' };
  const starts = [instrument].concat(scenario ? [scenario] : []);
  const s = sluitingVan(w, starts, {
    volg: (van, naar) => !(scenario && naar.startsWith(SCENARIOMAP) && naar !== scenario && van === instrument)
  });
  if (s.onbekend.length) return { bepaald: false, reden: 'het instrument heeft een require die niet te volgen is: ' + s.onbekend[0] };
  return { bepaald: true, bestanden: s.bestanden };
}

/* ---- HET RAAKVLAK VAN EEN BEWIJS ---------------------------------------
   invoer: { ingang, instrument, scenario?, routeInstrument? }
     instrument       het script dat mat (stempel.instrument)
     scenario         bij de voltooiproef: het eigen scenariobestand
     routeInstrument  een proefbestand waarvan de letterlijke /api/-paden ook
                      tellen (het scenario of de ketenproef)
     soort            'browser' (standaard) of 'api', zie hieronder. */
function raakvlak(w, invoer) {
  const g = gedeeld(w);
  if (!g.bepaald) return { bepaald: false, reden: g.reden };
  const sch = schermDeel(w, invoer.ingang);
  if (sch.onbekend.length) return { bepaald: false, reden: sch.onbekend[0] };
  /* Elk geladen bestand, ook de schil: wat de schil aanroept, roept dit scherm
     aan. */
  const paden = new Set();
  const voegToe = (tekst) => { for (const x of apiPaden(tekst)) paden.add(x); };
  for (const f of sch.geladen) if (/\.(m?js|html?)$/.test(f)) voegToe((w.inhoud(f) || '').toString('utf8'));
  if (invoer.routeInstrument) voegToe((w.inhoud(invoer.routeInstrument) || '').toString('utf8'));
  const h = handlers(w, paden);
  if (!h.bepaald) return { bepaald: false, reden: h.reden };
  if (h.onbekend.length) return { bepaald: false, reden: h.onbekend[0] };
  const server = sluitingVan(w, [...h.bestanden], { stop: (f) => g.bestanden.has(f) });
  if (server.onbekend.length) return { bepaald: false, reden: 'een handler heeft een require die niet te volgen is: ' + server.onbekend[0] };
  const keten = voorouders(w, [...h.bestanden]);
  const ins = instrumentDeel(w, invoer.instrument, invoer.scenario);
  if (!ins.bepaald) return { bepaald: false, reden: ins.reden };
  const eigen = new Set();
  /* Een proef in de browser (soort 'browser') ziet het hele scherm, ook een
     afbeelding die een knop kan verschuiven. Een proef over de API (de
     voltooiproef, een ketenproef) leest geen scherm: daar telt van public/
     alleen de code die bepaalt WELKE routes het scherm aanroept. */
  const schermKant = invoer.soort === 'api' ? sch.geladen : sch.bestanden;
  for (const f of [...schermKant, ...server.bestanden, ...keten]) if (!g.bestanden.has(f)) eigen.add(f);
  const alle = new Set([...g.bestanden, ...eigen, ...ins.bestanden]);
  for (const f of alle) w.gebruikt.add(f);
  return { bepaald: true, alle, eigen: [...eigen].sort(), instrumentBestanden: [...ins.bestanden].sort(),
    handlers: [...h.bestanden].sort(), gedeeld: g.bestanden.size };
}

function samen(lijst, hashOf) {
  const h = crypto.createHash('sha256');
  for (const p of [...lijst].sort()) h.update(p + '\0' + (hashOf(p) || '-') + '\n');
  return h.digest('hex');
}

/* Wat er sinds `commit` in dit raakvlak veranderde: per bestand de inhoud op
   die commit (blob-id) tegen nu. Plus: een serverbestand dat er toen wel en nu
   niet meer is. */
function verschil(w, alle, commit) {
  const boom = w.boomOp(commit);
  if (!boom) return { bekend: false, reden: 'commit ' + commit + ' is hier niet te lezen' };
  const oorzaak = [];
  for (const p of [...alle].sort()) {
    const toen = boom.get(p);
    if (toen === undefined) oorzaak.push(p + ' (nieuw sinds de meting)');
    else if (toen !== w.blob(p)) oorzaak.push(p);
  }
  /* Verwijderd onder server/: wie het met fs of een berekende require las, is
     niet te zien, dus telt het voor elk bewijs. Eén keer per commit. */
  const sleutel = 'weg:' + commit;
  if (!w.cache.has(sleutel)) {
    const lijst = w.lijst() || new Set();
    w.cache.set(sleutel, [...boom.keys()].filter((p) => p.startsWith('server/') && !lijst.has(p)).map((p) => p + ' (verwijderd sinds de meting)'));
  }
  oorzaak.push(...w.cache.get(sleutel));
  return { bekend: true, oorzaak };
}

/* Het stempel moet eerst zelf deugen; dat zijn de voorwaarden van versheid(). */
function stempelGebrek(st) {
  if (!st || !st.op) return 'geen stempel: dit register zegt niet wanneer het is gemeten';
  if (!st.commit) return 'gemeten zonder commit; niet te herleiden tot een versie van de code';
  if (st.boomVuil) return 'gemeten met ongecommit werk in de boom (commit ' + st.commit + '); niet reproduceerbaar';
  return null;
}

/* ---- VERSHEID OP HET RAAKVLAK ----------------------------------------------
   Geeft een versheid()-functie (zelfde vorm: { vers, reden }) die per bewijs
   naar zijn raakvlak kijkt, met het vast te leggen raakvlak erbij. `grof` is de
   oude regel, voor als het raakvlak onbepaald is. */
function versheidVoor(w, invoer, grof) {
  return function versheidOpRaakvlak(st) {
    const gebrek = stempelGebrek(st);
    if (gebrek) return { vers: false, reden: gebrek };
    const ins = Object.assign({ instrument: st.instrument }, invoer);
    const r = raakvlak(w, ins);
    if (!r.bepaald) {
      const v = grof(st);
      return Object.assign({}, v, { reden: 'raakvlak onbepaald (' + r.reden + '), dus de grove regel: ' + v.reden,
        raakvlak: { commit: st.commit, instrument: ins.instrument, scenario: ins.scenario || null,
          routeInstrument: ins.routeInstrument || null, soort: ins.soort || 'browser', onbepaald: r.reden } });
    }
    const d = verschil(w, r.alle, st.commit);
    if (!d.bekend) return { vers: false, reden: 'gemeten op commit ' + st.commit + ', die hier niet meer bestaat' };
    if (d.oorzaak.length) {
      return { vers: false, oorzaak: d.oorzaak,
        reden: 'gemeten op ' + st.commit + '; sindsdien ' + d.oorzaak.length + ' bestand(en) in het raakvlak gewijzigd, eerst ' + d.oorzaak[0] };
    }
    return { vers: true,
      reden: 'gemeten op ' + st.commit + '; geen van de ' + r.alle.size + ' bestanden in het raakvlak is sindsdien gewijzigd (' +
        r.eigen.length + ' eigen, ' + r.instrumentBestanden.length + ' van het instrument, ' + r.gedeeld + ' gedeeld)',
      raakvlak: { commit: st.commit, instrument: ins.instrument, scenario: ins.scenario || null,
        routeInstrument: ins.routeInstrument || null, soort: ins.soort || 'browser', telt: r.alle.size, eigen: r.eigen.length,
        samen: samen(r.alle, w.sha) } };
  };
}

/* De hashes die een register bij zijn raakvlakken bewaart: alles wat in deze
   wereld in een raakvlak is gebruikt. */
function hashes(w) {
  const uit = {};
  for (const p of [...w.gebruikt].sort()) uit[p] = w.sha(p);
  return uit;
}

/* ---- DE CONTROLE NA DE METING --------------------------------------------
   Een opgeslagen raakvlak tegen de boom van nu. Standen:
     VERS        elk bestand gelijk aan de opgeslagen hash en aan de meetcommit
     VERVALLEN   een bestand in het raakvlak is veranderd (met de naam)
     ONGELDIG    de opgeslagen hashes kloppen niet met de meetcommit of met
                 de samengestelde hash: er is aan het register gezeten
     GROF        het raakvlak was of is onbepaald; de grove regel besliste
                 (`vers` zegt hoe) */
function controleer(w, rec, opgeslagen, ingang, grof) {
  if (!rec || typeof rec !== 'object') return { stand: 'GROF', vers: false, reden: 'geen raakvlak vastgelegd' };
  const st = { op: 'vastgelegd', commit: rec.commit, instrument: rec.instrument, boomVuil: false };
  const grofUit = (waarom) => {
    const v = grof(st);
    return { stand: 'GROF', vers: !!v.vers, reden: waarom + '; de grove regel: ' + v.reden };
  };
  if (rec.onbepaald) return grofUit('raakvlak onbepaald bij de meting (' + rec.onbepaald + ')');
  const r = raakvlak(w, { ingang, instrument: rec.instrument, scenario: rec.scenario || undefined,
    routeInstrument: rec.routeInstrument || undefined, soort: rec.soort || 'browser' });
  if (!r.bepaald) return grofUit('raakvlak nu onbepaald (' + r.reden + ')');
  const H = opgeslagen || {};
  const d = verschil(w, r.alle, rec.commit);
  if (!d.bekend) return { stand: 'VERVALLEN', vers: false, oorzaak: [], reden: 'gemeten op commit ' + rec.commit + ', die hier niet meer bestaat' };
  /* Eerst wat er veranderde. Een bestand dat sinds de meting UIT het raakvlak
     viel, hoeft hier niet apart te staan: dat kan alleen doordat een bestand
     dat er nog in zit veranderde (zie de kop), en dat staat dan al hier. */
  if (d.oorzaak.length) {
    return { stand: 'VERVALLEN', vers: false, oorzaak: d.oorzaak,
      reden: d.oorzaak.length + ' bestand(en) in het raakvlak gewijzigd sinds ' + rec.commit + ', eerst ' + d.oorzaak[0] };
  }
  /* Er veranderde niets. Dan moet de opslag precies de inhoud van nu (en dus
     van de meetcommit) dragen; anders is er aan het register gezeten. Ook een
     hash die ONTBREEKT telt zo: weglaten is geen manier om een bestand buiten
     het raakvlak te praten. */
  const fout = [...r.alle].filter((p) => H[p] !== w.sha(p));
  if (fout.length) {
    return { stand: 'ONGELDIG', vers: false, oorzaak: fout,
      reden: 'de bewaarde hash van ' + fout[0] + (fout[0] in H ? ' is niet' : ' ontbreekt; dat is niet') +
        ' de inhoud op de meetcommit ' + rec.commit + '; er is aan het register gezeten' };
  }
  if (samen(r.alle, (p) => H[p]) !== rec.samen) {
    return { stand: 'ONGELDIG', vers: false, oorzaak: [],
      reden: 'de samengestelde hash klopt niet met de bewaarde hashes over dit raakvlak; er is aan het register gezeten' };
  }
  return { stand: 'VERS', vers: true, oorzaak: [], reden: 'geen van de ' + r.alle.size + ' bestanden in het raakvlak gewijzigd sinds ' + rec.commit };
}

/* ---- HET REGISTER VAN DE HASHES ---------------------------------------------
   De hashes per bestand staan in een eigen register naast APPWERKT.json, met
   hetzelfde stempel; APPWERKT.json draagt alleen de verwijzing met de
   samengestelde hash over het hele register. Zo blijft APPWERKT.json leesbaar
   en klein in een diff, en kan het ene niet stil met het andere uiteenlopen:
   een ander stempel of een andere samengestelde hash, en de hashes tellen als
   ontbrekend -- elk bewijs is dan ONGELDIG, nooit vers. */
const REGISTER = 'APPWERKT-RAAKVLAK.json';
const REGISTER_PAD = path.join(WORTEL, REGISTER);
const overAlles = (hashes) => samen(Object.keys(hashes), (p) => hashes[p]);
function register(st, hashes) {
  return { soort: 'meting',
    uitleg: 'Per bestand dat in het raakvlak van een bewijs in APPWERKT.json zit, de sha256 van zijn inhoud op het moment van de meting (scripts/lib/bewijsraakvlak.js, BETROUWBAARHEID.md par. 4i). Wordt alleen samen met APPWERKT.json geschreven, door scripts/appwerkt.js.',
    stempel: st, bestanden: Object.keys(hashes).length, samen: overAlles(hashes), hashes };
}
function verwijzing(st, hashes) {
  return { uitleg: 'Een bewijs is vers zolang geen bestand in zijn raakvlak veranderde sinds de commit waarop het gemeten is. Is het raakvlak niet vast te stellen, dan beslist de grove regel van versheid().',
    hoe: 'npm run appwerkt:vers  (--controle zakt als een rij die als 8/8 geldt een bewijs heeft dat niet vers is)',
    register: REGISTER, bestanden: Object.keys(hashes).length, samen: overAlles(hashes) };
}
/* De hashes die bij dit APPWERKT.json horen, of null met de reden. */
function hashesVoor(appwerkt, raakvlakRegister) {
  const v = appwerkt && appwerkt.raakvlak;
  if (!v) return { hashes: null, reden: 'APPWERKT.json draagt nog geen raakvlak' };
  if (v.hashes) return { hashes: v.hashes, reden: null };   // een register waarin ze nog meestonden
  const r = raakvlakRegister;
  if (!r || !r.hashes) return { hashes: null, reden: REGISTER + ' ontbreekt' };
  const a = appwerkt.stempel || {}, b = r.stempel || {};
  if (a.op !== b.op || a.commit !== b.commit) return { hashes: null, reden: REGISTER + ' hoort bij een andere meting (' + b.commit + ' ' + b.op + ')' };
  if (overAlles(r.hashes) !== v.samen || r.samen !== v.samen) return { hashes: null, reden: 'de samengestelde hash van ' + REGISTER + ' klopt niet met APPWERKT.json' };
  return { hashes: r.hashes, reden: null };
}

module.exports = { register, verwijzing, hashesVoor, REGISTER, REGISTER_PAD, maakWereld, raakvlak, versheidVoor, controleer, hashes, verschil, gedeeld, schermDeel, apiPaden,
  handlers, instrumentDeel, kanten, samen, DYNAMISCH, SCENARIOMAP };
