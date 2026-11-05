#!/usr/bin/env node
/* ============================================================================
   HET ONTWERPSYSTEEM -- WAT ER AAN STIJL LIGT, EN WAT ER NIET MEER BIJ MAG.

   Op 19 oktober 2026 stonden er 179 stijlbladen in public/, ruim 20.000 regels
   CSS in public/shared alleen, bijna 3.000 keer `!important`, en 206 van de
   226 appschermen droegen daarnaast een eigen <style>-blok. Elke ontwerpronde
   legde een laag BOVENOP de vorige: rtg-heritage, rtg-editorial-v4,
   rtg-cinematic-system, rtg-edge-2, rtg-adaptive-edge, rtg-worlds-2026 ... en
   rtg-heritage-order.js houdt met een MutationObserver de "nieuwste" laag
   achteraan in <head>, zodat hij de oude overstemt. Een nieuw ontwerp kwam zo
   binnen als de zoveelste laag, en de oude lagen duwden het terug. Dat is de
   oorzaak die ONTWERPSYSTEEM.md wegneemt, en dit script is zijn tand.

   DRIE DINGEN, IN EEN BESTAND:

   1. De inventaris (fase 1). Elk stijlblad, elk <style>-blok, elk script dat
      zelf stijl injecteert, en per scherm welke bladen het (statisch afgeleid)
      laadt. Een blad dat niemand laadt is een WEES en kan weg.

   2. De ratel op de erfenis (ONTWERPNORM.json). Per BESTAND, niet als som: een
      som laat toe dat het ene scherm opruimt en het andere er evenveel bij
      zet. Een bestaand blad mag niet groeien in bytes, `!important` of
      hexkleuren; een nieuw blad buiten public/ds/ bestaat niet; een scherm
      zonder <style>-blok krijgt er geen; een script dat geen stijl injecteert
      gaat dat niet doen. Krimpen mag altijd; `--vastleggen` zet de lat dan
      strakker en weigert hem losser te zetten.

   3. Het contract van het nieuwe systeem (public/ds/contract.json). Alles in
      public/ds/ zit in een cascadelaag, kent geen `!important`, draagt
      kleurwaarden alleen in tokens.css, gebruikt alleen logische eigenschappen
      (rechts-naar-links werkt dan vanzelf), een wereldthema zet uitsluitend
      de tokens die het contract themabaar noemt, en een component raakt
      alleen zijn eigen `.ds-`-klassen.

   WAT DIT NIET ZIET: of een scherm MOOI is, of het overeenkomt met de mockup,
   en wat een script tijdens het draaien nog aan stijl zet via element.style.
   De laadgraaf is statisch afgeleid uit <link>, @import en de .css- en
   .js-namen die in geladen scripts staan; een naam die in runtime wordt
   samengesteld, ziet hij niet.

   Draai:  node scripts/ontwerpsysteem.js                (inventaris op scherm)
           node scripts/ontwerpsysteem.js --json=pad     (inventaris als JSON)
           node scripts/ontwerpsysteem.js --controle     (ratel + contract; exit 1 bij schending)
           node scripts/ontwerpsysteem.js --vastleggen   (lat strakker zetten)
   ========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');
const { zonderCommentaar: zonderJsCommentaar, zonderTekst, stukken } = require('./lib/bron');
const { parse } = require('./ast/parser');
const { loop } = require('./ast/walk');

const WORTEL = path.join(__dirname, '..');
const PUBLIEK = path.join(WORTEL, 'public');
const DS = path.join(PUBLIEK, 'ds');
const NORMPAD = path.join(WORTEL, 'ONTWERPNORM.json');
const rel = p => path.relative(WORTEL, p).split(path.sep).join('/');
const zonderCommentaar = s => s.replace(/\/\*[\s\S]*?\*\//g, ' ');

function bestanden(map, patroon, uit = []) {
  if (!fs.existsSync(map)) return uit;
  for (const naam of fs.readdirSync(map).sort()) {
    /* public/dist is de uitvoer van npm run build (geminimaliseerde kopie,
       in .gitignore): geen bron, dus geen erfenis en geen nieuw bestand. */
    if (naam === 'node_modules' || naam.startsWith('.') || path.join(map, naam) === path.join(PUBLIEK, 'dist')) continue;
    const vol = path.join(map, naam);
    const st = fs.statSync(vol);
    if (st.isDirectory()) bestanden(vol, patroon, uit);
    else if (patroon.test(naam)) uit.push(vol);
  }
  return uit;
}

/* Kleurwaarden in DECLARATIES, niet in selectors: `#id` is geen kleur. */
function telHex(css) {
  let n = 0;
  for (const m of css.matchAll(/:([^;{}]+)(?=[;}])/g)) n += (m[1].match(/#[0-9a-fA-F]{3,8}\b/g) || []).length;
  return n;
}
const telImportant = css => (css.match(/!\s*important/gi) || []).length;
const VERBORGEN = /\.ds-scherm \[hidden\] \{ display: none !important; \}/;
const telKleurfunctie = css => {
  let n = 0;
  for (const m of css.matchAll(/:([^;{}]+)(?=[;}])/g)) n += (m[1].match(/\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\(/gi) || []).length;
  return n;
};

function stijlblokken(html) {
  return [...html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)].map(m => m[1]);
}

/* Een script dat ZELF stijl in de pagina zet: een <style>-element, een regel
   in een blad, een geadopteerd blad, of een <link> naar een .css. Dat is
   precies de route waarlangs rtg-heritage-order.js de volgorde omgooit. */
function telInjectie(js) {
  const s = zonderCommentaar(js);
  return (s.match(/createElement\(\s*['"`]style['"`]\s*\)/g) || []).length +
    (s.match(/\.insertRule\(/g) || []).length +
    (s.match(/adoptedStyleSheets/g) || []).length +
    (s.match(/['"`][^'"`\s]*\.css(?:\?[^'"`]*)?['"`]/g) || []).length;
}

function naarPubliek(href, vanuit) {
  const schoon = href.split(/[?#]/)[0];
  if (/^(?:https?:)?\/\//.test(schoon) || schoon.startsWith('data:')) return null;
  if (schoon.startsWith('/')) return path.join(PUBLIEK, schoon.slice(1));
  return path.join(path.dirname(vanuit), schoon);
}

/* ---------------------------------------------------------------- meting */
function meet() {
  const css = bestanden(PUBLIEK, /\.css$/);
  const html = [path.join(WORTEL, 'index.html'), path.join(WORTEL, 'explore', 'index.html'), ...bestanden(PUBLIEK, /\.html$/)].filter(f => fs.existsSync(f));
  const js = bestanden(PUBLIEK, /\.js$/);
  const bron = new Map();
  const lees = f => { if (!bron.has(f)) bron.set(f, fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : ''); return bron.get(f); };
  const paginaBron = new Map();

  const bladen = {};
  for (const f of css) {
    const s = zonderCommentaar(lees(f));
    bladen[rel(f)] = { bytes: Buffer.byteLength(lees(f)), important: telImportant(s), hex: telHex(s) };
  }
  const blokken = {};
  for (const f of html) {
    const b = stijlblokken(lees(f));
    if (!b.length) continue;
    const s = zonderCommentaar(b.join('\n'));
    blokken[rel(f)] = { blokken: b.length, bytes: Buffer.byteLength(b.join('')), important: telImportant(s), hex: telHex(s) };
  }
  const injectie = {};
  for (const f of js) { const n = telInjectie(lees(f)); if (n) injectie[rel(f)] = n; }

  let dsPoort = {};
  try { dsPoort = JSON.parse(lees(path.join(DS, 'contract.json'))).dsPoort || {}; } catch (e) { /* ontbrekend contract blijft bij contractFouten geblokkeerd */ }
  const analyses = new Map();
  const analyse = (f, ds) => {
    const k = f + '|' + ds;
    if (!analyses.has(k)) analyses.set(k, scriptLaadAnalyse(lees(f), { ds, poort: Array.isArray(dsPoort[rel(f)]) ? dsPoort[rel(f)] : [] }));
    return analyses.get(k);
  };

  /* Laadgraaf: van een bestand naar de .css en .js die het noemt. */
  const burenCache = new Map();
  const buren = (f, ds = false, alleenVermeld = false) => {
    const sleutel = f + '|' + ds + '|' + alleenVermeld;
    if (burenCache.has(sleutel)) return burenCache.get(sleutel);
    const s = paginaBron.get(f) || lees(f), uit = [];
    if (f.endsWith('.html')) {
      for (const m of s.matchAll(/<link\b[^>]*href=["']([^"']+\.css[^"']*)["']/gi)) uit.push(naarPubliek(m[1], f));
      for (const m of s.matchAll(/<script\b[^>]*src=["']([^"']+\.js[^"']*)["']/gi)) uit.push(naarPubliek(m[1], f));
      for (const b of stijlblokken(s)) for (const m of b.matchAll(/@import\s+(?:url\()?\s*['"]?([^'")\s;]+\.css)/gi)) uit.push(naarPubliek(m[1], f));
    } else if (f.endsWith('.css')) {
      for (const m of zonderCommentaar(s).matchAll(/@import\s+(?:url\()?\s*['"]?([^'")\s;]+\.css)/gi)) uit.push(naarPubliek(m[1], f));
    } else {
      const hrefs = alleenVermeld ? lokaleScriptVerwijzingen(s) : analyse(f, ds).verwijzingen.map(v => v.href);
      for (const href of hrefs) uit.push(naarPubliek(href, f));
    }
    const gevonden = [...new Set(uit.filter(p => p && fs.existsSync(p)))];
    burenCache.set(sleutel, gevonden);
    return gevonden;
  };
  /* Gebruik de bestaande pure kop-renderer: een losse namenlijst verliest
     defer/volgorde en behandelt Sprong ten onrechte als vóór de DS-shell.
     Een ontbrekende of defecte renderer is onbeslist, nooit een schone pagina. */
  const kop = path.join(WORTEL, 'server', 'middleware', 'kopinjectie.js');
  let kopRenderer = null, kopFout = '';
  if (fs.existsSync(kop)) {
    try { kopRenderer = require(kop).kopinjecties; if (typeof kopRenderer !== 'function') throw new Error('kopinjecties ontbreekt'); }
    catch (e) { kopFout = 'Serverkop niet herleid: ' + e.message; }
  } else kopFout = 'Serverkop niet herleid: middleware ontbreekt';
  const geladenDoor = {};
  const paginas = {};
  for (const p of html) {
    /* Ook een volledige DS-host houdt zijn transitieve scriptgraaf. Een
       stijlinjectie verhuist anders ongemerkt van een directe owner naar een
       dynamisch geladen kind. Dit is conservatieve bronbereikbaarheid, geen
       bewering dat elke voorwaardelijke tak tijdens een browserrun actief is.
       Berekende/remote URL's blijven buiten deze statische graaf; browserbewijs
       blijft verplicht en een onzichtbaar pad is geen bewezen schone laadweg. */
    const gezien = new Set(), aanwezig = new Set(), bladenZeker = new Set(), injecteertZeker = new Set(), injecteertMogelijk = new Set(), onzeker = new Set();
    if (p.startsWith(PUBLIEK)) {
      if (kopFout) onzeker.add(kopFout);
      if (kopRenderer) try {
        const html = kopRenderer(lees(p), 'ds-inventaris', { headers: {} }, { setHeader() {} }, path.basename(p) === 'magnaat.html');
        if (typeof html !== 'string' || !/<(?:html|head|body|script|meta|link)\b/i.test(html)) throw new Error('geen HTML');
        if (dsBereik(lees(p), []).ds && !dsBereik(html, []).ds) throw new Error('DS-ingang verdwenen bij kopinjectie');
        paginaBron.set(p, html);
      } catch (e) { onzeker.add('Serverkop niet herleid: ' + e.message); }
    }
    const rij = [{ f: p, ds: false, zeker: true }];
    while (rij.length) {
      const { f, ds, zeker } = rij.pop(), sleutel = f + '|' + ds + '|' + zeker;
      if (gezien.has(sleutel)) continue;
      gezien.add(sleutel); aanwezig.add(f);
      if (zeker && f.endsWith('.css')) bladenZeker.add(rel(f));
      const a = f.endsWith('.js') ? analyse(f, ds) : null;
      if (a) {
        for (const melding of a.onzeker) onzeker.add(rel(f) + ': ' + melding);
        for (const v of a.verwijzingen) if (!fs.existsSync(naarPubliek(v.href, f))) onzeker.add(rel(f) + ': genoemde laadbron ontbreekt: ' + v.href);
        if (a.injecties && !rel(f).startsWith('public/ds/')) (zeker ? injecteertZeker : injecteertMogelijk).add(rel(f));
        if (a.mogelijkeInjecties && !rel(f).startsWith('public/ds/')) injecteertMogelijk.add(rel(f));
      }
      for (const b of buren(f, ds)) {
        const href = '/' + rel(b).replace(/^public\//, ''), v = a && a.verwijzingen.find(v => v.href === href);
        rij.push({ f: b, ds: f.endsWith('.html') ? dsVoorScript(paginaBron.get(f) || lees(f), href) : ds, zeker: zeker && (!a || v && v.soort === 'dom') });
      }
    }
    const lijst = [...bladenZeker].sort();
    const mogelijkeBladen = [...aanwezig].filter(f => f.endsWith('.css') && !bladenZeker.has(rel(f))).map(rel).sort();
    paginas[rel(p)] = {
      bladen: lijst,
      ...dsBereik(paginaBron.get(p) || lees(p), lijst),
      erfenis: lijst.filter(b => !b.startsWith('public/ds/') && b !== 'public/fonts/fonts.css').length,
      mogelijkeBladen,
      mogelijkeErfenis: mogelijkeBladen.filter(b => !b.startsWith('public/ds/') && b !== 'public/fonts/fonts.css').length,
      stijlblok: Boolean(blokken[rel(p)]),
      injecteert: [...injecteertZeker].sort(),
      mogelijkeInjectie: [...injecteertMogelijk].filter(f => !injecteertZeker.has(f)).sort(),
      onzeker: [...onzeker].sort(),
    };
    for (const b of lijst) (geladenDoor[b] = geladenDoor[b] || []).push(rel(p));
  }
  /* Ook de service workers en losse scripts noemen bladen (precache); wie
     daar genoemd staat is geen wees, maar ook niet door een scherm geladen. */
  const genoemd = new Set();
  for (const f of [...js, ...css]) for (const b of buren(f, false, true)) if (b.endsWith('.css')) genoemd.add(rel(b));
  /* De server levert ook zelf bladen uit (middleware, schermbouw); een naam
     die daar staat is in gebruik, ook als geen scherm hem statisch laadt. */
  const serverBron = bestanden(path.join(WORTEL, 'server'), /\.js$/).map(f => fs.readFileSync(f, 'utf8')).join('\n');
  for (const b of Object.keys(bladen)) if (serverBron.includes(path.basename(b))) genoemd.add(b);
  const wezen = Object.keys(bladen).filter(b => !geladenDoor[b] && !genoemd.has(b) && !b.startsWith('public/ds/')).sort();

  /* Gemigreerd: het systeem, geen erfenisblad, geen eigen blok, en geen
     script dat stijl injecteert behalve de benoemde overgangsscripts uit
     contract.json (elk met reden en vervaldatum). */
  let overgang = new Set();
  try { overgang = new Set((JSON.parse(fs.readFileSync(path.join(DS, 'contract.json'), 'utf8')).overgangsscripts || []).map(o => o.pad)); } catch (e) { /* zonder contract: niets toegestaan */ }
  /* public/ds/voorbeeld.html is de voorbeeldpagina van het systeem en geen
     productscherm: het contract keurt hem wel, de migratieteller niet. */
  const gemigreerd = Object.entries(paginas).filter(([k, v]) => !k.startsWith('public/ds/') && v.ds && v.erfenis === 0 && !v.mogelijkeErfenis && !v.onzeker.length && !v.stijlblok &&
    v.injecteert.concat(v.mogelijkeInjectie).every(j => overgang.has(j))).map(([k]) => k);
  return { bladen, blokken, injectie, paginas, geladenDoor, wezen, gemigreerd };
}

/* ------------------------------------------------------- DS-contract */
/* Splits op de komma's op het bovenste niveau: `:is(a, b)` is één selector. */
function selectorlijst(tekst) {
  const uit = []; let diepte = 0, nu = '';
  for (const c of tekst) {
    if (c === '(') diepte++; else if (c === ')') diepte--;
    if (c === ',' && diepte === 0) { uit.push(nu); nu = ''; } else nu += c;
  }
  uit.push(nu);
  return uit.map(x => x.trim()).filter(Boolean);
}

function contractFouten(meting, DS = module.exports.DS) {
  const fouten = [];
  const CONTRACTPAD = path.join(DS, 'contract.json');
  if (!fs.existsSync(DS)) return fouten;
  if (!fs.existsSync(CONTRACTPAD)) return ['public/ds/contract.json ontbreekt; zonder contract is public/ds/ niet te keuren'];
  const contract = JSON.parse(fs.readFileSync(CONTRACTPAD, 'utf8'));
  const lagen = contract.lagen;
  const themabaar = new Set(contract.themabaar);
  const FYSIEK = /(?:^|[;{\s])(margin-left|margin-right|padding-left|padding-right|border-left[a-z-]*|border-right[a-z-]*|left|right|border-top-left-radius|border-top-right-radius|border-bottom-left-radius|border-bottom-right-radius)\s*:/;
  const RICHTING = /(?:text-align|float|clear)\s*:\s*(left|right)\b/;
  const cssBestanden = bestanden(DS, /\.css$/);
  const tokenBron = new Map(cssBestanden.map(f => [f, zonderTekst(zonderJsCommentaar(fs.readFileSync(f, 'utf8'), { soort: 'css' }).replace(/\\\r?\n/g, ''))]));
  const tokenNamen = new Set([...tokenBron.values()].flatMap(s => [...s
    .matchAll(/(?:^|[;{])\s*(--ds-[\w-]+)\s*:/g)].map(m => m[1])));
  for (const f of cssBestanden) {
    const r = rel(f);
    const s = zonderCommentaar(fs.readFileSync(f, 'utf8'));
    const deel = path.relative(DS, f).split(path.sep).join('/');

    // Een typefout in een verplicht token laat de browser de declaratie stil
    // negeren. Een expliciete fallback voor een optioneel hosttoken mag wel.
    // Dit is naamcontrole, geen bewijs van cascadebereik of werkelijk contrast.
    for (const token of new Set([...tokenBron.get(f).matchAll(/var\(\s*(--ds-[\w-]+)\s*\)/g)].map(m => m[1])))
      if (!tokenNamen.has(token)) fouten.push(r + ': onbekend verplicht DS-token ' + token);

    /* 0. De accolades sluiten. Een zoek-vervang die er een laat staan of
          opslokt, maakt van de rest van het blad een andere regel zonder dat
          de browser iets meldt (AGENTS.md: "brace-balans controleren"). */
    { let diep = 0, min = 0; for (const c of s) { if (c === '{') diep++; else if (c === '}') { diep--; min = Math.min(min, diep); } }
      if (diep !== 0 || min < 0) { fouten.push(r + ': accolades sluiten niet (' + (diep > 0 ? diep + ' open' : 'een } te veel') + ')'); continue; } }
    /* 1. Alles zit in een benoemde cascadelaag uit het contract. Een regel
          buiten een laag wint van elke laag -- dat is precies het lek. */
    let diepte = 0, buiten = '';
    for (let i = 0; i < s.length; i++) {
      const c = s[i];
      if (c === '{') { if (diepte === 0) { const kop = buiten.slice(buiten.lastIndexOf(';') + 1).trim(); const m = kop.match(/^@layer\s+([\w.-]+)$/); if (!m) fouten.push(r + ': regel buiten een cascadelaag ("' + kop.slice(0, 60) + '")'); else if (!lagen.includes(m[1])) fouten.push(r + ': onbekende laag ' + m[1] + ' (contract: ' + lagen.join(', ') + ')'); buiten = ''; } diepte++; }
      else if (c === '}') diepte--;
      else if (diepte === 0) buiten += c;
    }
    for (const stmt of buiten.split(';').map(x => x.trim()).filter(Boolean)) {
      if (/^@layer\s+[\w.,\s-]+$/.test(stmt)) continue;
      /* Een @import binnen public/ds/ is veilig: het doel zet zichzelf in
         zijn laag. Een @import van buiten zou erfenis binnenhalen. */
      const imp = stmt.match(/^@import\s+(?:url\()?['"]?([^'")\s]+)['"]?\)?(?:\s+layer\(([\w.-]+)\))?$/);
      if (imp) {
        const doel = path.resolve(path.dirname(f), imp[1]);
        if (!doel.startsWith(DS + path.sep)) fouten.push(r + ': @import van buiten public/ds/ (' + imp[1] + ')');
        else if (!fs.existsSync(doel)) fouten.push(r + ': @import van een ontbrekend bestand (' + imp[1] + ')');
        if (imp[2] && !lagen.includes(imp[2])) fouten.push(r + ': onbekende laag ' + imp[2]);
        continue;
      }
      fouten.push(r + ': losse opdracht buiten een laag ("' + stmt.slice(0, 60) + '")');
    }
    /* 2. Geen !important: in een gelaagd systeem is er precies een reden, en
       die staat hier met naam. Een belangrijke declaratie in de VROEGSTE laag
       wint van elke latere laag; zonder dat zet een component met een eigen
       display het attribuut hidden opzij. Alleen die ene regel in reset.css. */
    const zonderVerborgen = deel === 'reset.css' ? s.replace(VERBORGEN, '') : s;
    if (telImportant(zonderVerborgen)) fouten.push(r + ': bevat !important (' + telImportant(zonderVerborgen) + 'x)');
    /* 3. Kleurwaarden alleen in tokens.css. */
    if (deel !== 'tokens.css' && (telHex(s) || telKleurfunctie(s))) fouten.push(r + ': kleurwaarde buiten tokens.css (' + (telHex(s) + telKleurfunctie(s)) + 'x); gebruik een token');
    /* 4. Rechts-naar-links: alleen logische eigenschappen. */
    for (const regel of s.split('\n')) {
      const m = regel.match(FYSIEK); if (m) fouten.push(r + ': fysieke eigenschap ' + m[1] + ' (gebruik de logische variant, voor RTL)');
      const t = regel.match(RICHTING); if (t) fouten.push(r + ': ' + t[0].trim() + ' (gebruik start/end, voor RTL)');
    }
    /* 5. Afronding alleen via een radius-token. */
    for (const m of s.matchAll(/border-(?:[a-z-]*-)?radius\s*:\s*([^;}]+)/g)) {
      if (!/^\s*(?:var\(--ds-radius-[a-z-]+\)|0)\s*$/.test(m[1])) fouten.push(r + ': afronding ' + m[1].trim() + ' (alleen var(--ds-radius-*))');
    }
    /* 6. Een wereldthema zet alleen themabare tokens. */
    if (deel.startsWith('thema/')) {
      for (const m of s.matchAll(/([\w-]+)\s*:\s*[^;{}]+[;}]/g)) {
        if (!m[1].startsWith('--')) fouten.push(r + ': thema zet eigenschap ' + m[1] + '; een thema zet alleen tokens');
        else if (!themabaar.has(m[1])) fouten.push(r + ': thema zet ' + m[1] + ', dat staat niet in contract.themabaar');
      }
    }
    /* 7. Componenten en schermtypen raken alleen hun eigen klassen. */
    if (deel.startsWith('componenten/') || deel.startsWith('schermen/')) {
      if (/var\(--ds-p-/.test(s)) fouten.push(r + ': leest een primitief token (--ds-p-*); een component leest alleen semantische tokens, anders kan geen thema hem bereiken');
      for (const m of s.matchAll(/(?:^|[{}])\s*([^{}@;]+?)\s*\{/g)) {
        for (const sel of selectorlijst(m[1])) {
          if (/^(?:from|to|\d+%)$/.test(sel)) continue;
          if (!/^(?:\[dir=["']?rtl["']?\]\s+|:where\()?\.ds-/.test(sel)) fouten.push(r + ': selector "' + sel + '" begint niet bij een eigen .ds-klasse');
        }
      }
    }
  }
  /* 8. Een script van het systeem spuit geen stijl en haalt geen erfenis
        binnen: dat is precies de weg waarlangs basis.js en randen.js de oude
        lagen op elk scherm zetten. */
  for (const f of bestanden(DS, /\.js$/)) {
    const r = rel(f), s = zonderCommentaar(fs.readFileSync(f, 'utf8'));
    if (/createElement\(\s*['"`]style['"`]\s*\)|\.insertRule\(|adoptedStyleSheets|\.style\.[a-zA-Z]+\s*=|\.style\.cssText|setAttribute\(\s*['"`]style['"`]/.test(s)) fouten.push(r + ': script zet zelf stijl; vorm komt uit de bladen van public/ds/');
    for (const m of s.matchAll(/['"`]([^'"`\s]*\.css)(?:\?[^'"`]*)?['"`]/g)) if (!m[1].startsWith('/ds/')) fouten.push(r + ': noemt een stijlblad buiten public/ds/ (' + m[1] + ')');
  }
  /* Elk schermtype en elk component uit het contract bestaat ook. */
  for (const t of contract.schermtypen) if (!fs.existsSync(path.join(DS, 'schermen', t + '.css'))) fouten.push('schermtype ' + t + ' staat in het contract maar public/ds/schermen/' + t + '.css ontbreekt');
  for (const c of contract.componenten) if (!fs.existsSync(path.join(DS, 'componenten', c + '.css'))) fouten.push('component ' + c + ' staat in het contract maar public/ds/componenten/' + c + '.css ontbreekt');
  for (const w of contract.werelden) if (!fs.existsSync(path.join(DS, 'thema', w + '.css'))) fouten.push('wereld ' + w + ' staat in het contract maar public/ds/thema/' + w + '.css ontbreekt');
  /* 9. De nadruk: een gesloten lijst, gedragen door tokens (par. 7). */
  fouten.push(...require('./lib/nadruk.js').nadrukFouten(contract, DS, path.join(WORTEL, 'public')));
  /* Een scherm op het systeem laadt geen erfenis, draagt geen eigen blok en
     laadt geen stijlinjecterend script buiten de overgangslijst. Half
     migreren bestaat niet (ONTWERPSYSTEEM.md par. 5). */
  const overgang = new Map();
  for (const o of contract.overgangsscripts || []) {
    if (!o.pad || !o.reden || !o.vervalt || !o.eigenaar || !o.plan) fouten.push('contract.overgangsscripts: ' + (o.pad || '?') + ' zonder pad, eigenaar, reden, verwijderplan of vervaldatum');
    else if (o.vervalt < vandaag()) fouten.push('contract.overgangsscripts: ' + o.pad + ' is verlopen op ' + o.vervalt);
    else overgang.set(o.pad, o);
  }
  const bewijs = contract.bewijs || {};
  for (const [p, v] of Object.entries(meting.paginas)) {
    if (!v.ds) continue;
    const toets = bewijs[p];
    const route = '/' + p.replace(/^public\//, '');
    if (!toets) fouten.push(p + ': draagt het Design System zonder browsertoets in contract.json "bewijs" (TRAVELOS-MIGRATIE.md par. 3)');
    else if (!fs.existsSync(path.join(WORTEL, toets)) || !fs.readFileSync(path.join(WORTEL, toets), 'utf8').includes(route)) fouten.push(p + ': de browsertoets ' + toets + ' bestaat niet of opent ' + route + ' niet');
    if (v.stijlblok) fouten.push(p + ': draagt het Design System en tegelijk een eigen <style>-blok');
    if (v.erfenis) fouten.push(p + ': draagt het Design System en laadt ' + v.erfenis + ' erfenisblad(en): ' + v.bladen.filter(b => !b.startsWith('public/ds/') && b !== 'public/fonts/fonts.css').slice(0, 5).join(', '));
    if (v.mogelijkeErfenis) fouten.push(p + ': mogelijk ' + v.mogelijkeErfenis + ' erfenisblad(en); laadweg nog niet bewezen: ' + v.mogelijkeBladen.filter(b => !b.startsWith('public/ds/') && b !== 'public/fonts/fonts.css').slice(0, 5).join(', '));
    if ((v.onzeker || []).length) fouten.push(p + ': onbesliste laadgraaf (' + v.onzeker.length + '): ' + v.onzeker.slice(0, 3).join('; '));
    for (const j of v.injecteert || []) if (!overgang.has(j)) fouten.push(p + ': draagt het Design System en laadt ' + j + ', dat zelf stijl injecteert');
    for (const j of v.mogelijkeInjectie || []) if (!overgang.has(j)) fouten.push(p + ': mogelijke stijlinjectie via ' + j + '; laadweg nog niet bewezen');
  }
  return fouten;
}

/* ------------------------------------------------------- de ratel */
const VELDEN = { bladen: ['bytes', 'important', 'hex'], blokken: ['blokken', 'bytes', 'important', 'hex'] };

function vandaag() { return new Date().toISOString().slice(0, 10); }

function ratelFouten(meting, norm) {
  const fouten = [], ruimer = [];
  const uitz = new Map();
  for (const u of norm.uitzonderingen || []) {
    if (!u.pad || !u.reden || !u.vervalt || !u.eigenaar || !u.plan) { fouten.push('uitzondering zonder pad, eigenaar, reden, verwijderplan of vervaldatum: ' + JSON.stringify(u)); continue; }
    if (u.vervalt < vandaag()) { fouten.push('uitzondering voor ' + u.pad + ' is verlopen op ' + u.vervalt); continue; }
    uitz.set(u.pad, u);
  }
  for (const soort of ['bladen', 'blokken']) {
    const nu = meting[soort], lat = norm[soort];
    for (const [pad, w] of Object.entries(nu)) {
      if (pad.startsWith('public/ds/')) continue;
      const l = lat[pad];
      if (!l) {
        if (uitz.has(pad)) continue;
        fouten.push(soort === 'bladen'
          ? pad + ': nieuw stijlblad buiten public/ds/. Een nieuwe laag naast het Design System bestaat niet; bouw het in public/ds/.'
          : pad + ': nieuw <style>-blok. Een scherm krijgt zijn vorm uit public/ds/, niet uit een eigen blok.');
        continue;
      }
      for (const v of VELDEN[soort]) {
        if (w[v] > l[v] && !uitz.has(pad)) fouten.push(pad + ': ' + v + ' ' + l[v] + ' -> ' + w[v] + ' (erfenis mag alleen krimpen)');
        else if (w[v] < l[v]) ruimer.push(pad + ': ' + v + ' ' + l[v] + ' -> ' + w[v]);
      }
    }
    for (const pad of Object.keys(lat)) if (!nu[pad]) ruimer.push(pad + ': weg (' + soort + ')');
  }
  // Herkomst opnieuw uit actuele bestanden vaststellen, nooit uit bewijs-JSON.
  let direct;
  const onbeslisteDelen = new Set();
  function directeDelen() {
  if (direct) return direct;
  direct = new Set();
  function voeg(href, f) {
    if (/^(?:https?:)?\/\//.test(href) || href.startsWith('data:')) return;
    // Browser-entiteiten en server-URL-decodering kunnen een ander bronpad
    // aanwijzen. Zonder bewezen canonicalisatie niets onder een owner vouwen.
    // Een letterlijke query verandert het bestandsadres niet.
    if (/[&%]/.test(href.split('?')[0])) {
      onbeslisteDelen.add(rel(f) + ': gecodeerd lokaal scriptadres niet herleid: ' + href);
      return;
    }
    const p = naarPubliek(href, f);
    if (p) direct.add(rel(p));
  }
  const bronnen = [...bestanden(PUBLIEK, /\.(?:html|js)$/), ...bestanden(path.join(WORTEL, 'server'), /\.js$/), path.join(WORTEL, 'index.html'), path.join(WORTEL, 'explore/index.html')].filter(f => fs.existsSync(f));
  for (const f of bronnen) {
    const tekst = fs.readFileSync(f, 'utf8');
    if (f.endsWith('.html')) {
      // Dezelfde attribuutlezer als de DS-shellpoort, met echte tagbereiken:
      // src zonder quotes laadt ook. Commentaar en scripttekst zijn geen tags.
      for (const tag of require('./lib/mutatie-html').bereiken(tekst).tags) {
        if (tag.naam !== 'script') continue;
        for (const [naam, waarde] of htmlAttributen(tekst.slice(tag.start, tag.eind))) {
          if (naam !== 'src') continue;
          voeg(waarde.trim(), f);
        }
      }
    }
    // Daarnaast blijven letterlijke verwijzingen conservatief zichtbaar,
    // ook wanneer hun runtime-load nog niet bewezen is. Geen normverruiming.
    for (const match of tekst.matchAll(/["'`](\/?(?:[^"'`\s]*\/)??[^"'`\s]+\.js)(?:[?#][^"'`]*)?["'`]/g)) {
      voeg(match[1], f);
    }
  }
  return direct;
  }
  const herkomst = require('./lib/bundelherkomst').herkomst({ publiek: PUBLIEK,
    register: require('./bundel').bundels, injectie: meting.injectie, norm: norm.injectie,
    tel: telInjectie, verwijzingen: directeDelen });
  fouten.push(...herkomst.fouten);
  fouten.push(...onbeslisteDelen);
  for (const [pad, n] of Object.entries(meting.injectie)) {
    if (!onbeslisteDelen.size && herkomst.delen.has(pad)) continue;
    if (pad.startsWith('public/ds/')) continue;
    const l = norm.injectie[pad];
    if (l === undefined) { if (!uitz.has(pad)) fouten.push(pad + ': script injecteert stijl (' + n + 'x) en deed dat nog niet'); }
    else if (n > l && !uitz.has(pad)) fouten.push(pad + ': stijlinjectie ' + l + ' -> ' + n + ' (erfenis mag alleen krimpen)');
    else if (n < l) ruimer.push(pad + ': injectie ' + l + ' -> ' + n);
  }
  return { fouten, ruimer };
}

function normUit(meting, oud) {
  const zonderDs = o => Object.fromEntries(Object.entries(o).filter(([k]) => !k.startsWith('public/ds/')).sort());
  const min = (nu, lat) => {
    const uit = {};
    for (const [k, w] of Object.entries(nu)) {
      if (!lat) { uit[k] = w; continue; }
      if (lat[k] === undefined) continue; // nieuw: nooit stil opnemen
      uit[k] = typeof w === 'number' ? Math.min(w, lat[k]) : Object.fromEntries(Object.entries(w).map(([v, n]) => [v, Math.min(n, lat[k][v])]));
    }
    return uit;
  };
  return {
    uitleg: 'Per-bestand-ratel op de CSS-erfenis (scripts/ontwerpsysteem.js, ONTWERPSYSTEEM.md). Een getal mag alleen omlaag; ' +
      'een pad dat hier niet staat mag buiten public/ds/ niet bestaan. Verruimen gaat alleen via `uitzonderingen` met pad, reden en vervaldatum.',
    grens: 'Telt bytes, !important en hexkleuren per stijlbron en stijlinjecties per script. Zegt niets over hoe een scherm eruitziet ' +
      'en niets over stijl die een script tijdens het draaien via element.style zet.',
    totaal: {
      bladen: Object.keys(zonderDs(meting.bladen)).length,
      schermenMetStijlblok: Object.keys(meting.blokken).length,
      important: Object.values(meting.bladen).concat(Object.values(meting.blokken)).reduce((a, w) => a + w.important, 0),
    },
    uitzonderingen: (oud && oud.uitzonderingen) || [],
    bladen: min(zonderDs(meting.bladen), oud && oud.bladen),
    blokken: min(zonderDs(meting.blokken), oud && oud.blokken),
    injectie: min(zonderDs(meting.injectie), oud && oud.injectie),
  };
}

/* ------------------------------------------------------- uitvoer */
function samenvatting(m) {
  const som = (o, v) => Object.values(o).reduce((a, w) => a + (typeof w === 'number' ? w : w[v]), 0);
  const erfBladen = Object.fromEntries(Object.entries(m.bladen).filter(([k]) => !k.startsWith('public/ds/')));
  const top = Object.entries(m.geladenDoor).filter(([k]) => !k.startsWith('public/ds/')).sort((a, b) => b[1].length - a[1].length).slice(0, 12);
  const zwaar = Object.entries(m.paginas).sort((a, b) => b[1].erfenis - a[1].erfenis).slice(0, 8);
  const r = [];
  r.push('Stijlbladen buiten public/ds/: ' + Object.keys(erfBladen).length + ' (' + Math.round(som(erfBladen, 'bytes') / 1024) + ' kB, ' + som(erfBladen, 'important') + 'x !important, ' + som(erfBladen, 'hex') + ' hexkleuren)');
  r.push('Schermen met eigen <style>-blok: ' + Object.keys(m.blokken).length + ' (' + som(m.blokken, 'blokken') + ' blokken, ' + Math.round(som(m.blokken, 'bytes') / 1024) + ' kB, ' + som(m.blokken, 'important') + 'x !important)');
  r.push('Scripts die zelf stijl injecteren: ' + Object.keys(m.injectie).length + ' (' + som(m.injectie) + ' plekken)');
  r.push('Kandidaat-wezen (door geen scherm, script, blad of serverbestand geladen of genoemd): ' + m.wezen.length);
  r.push('Schermen: ' + Object.keys(m.paginas).length + ', waarvan op het Design System gemigreerd: ' + m.gemigreerd.length);
  r.push('Gemiddeld aantal erfenisbladen per scherm: ' + (Object.values(m.paginas).reduce((a, v) => a + v.erfenis, 0) / Object.keys(m.paginas).length).toFixed(1));
  r.push('\nMeest geladen erfenisbladen:');
  for (const [b, l] of top) r.push('  ' + String(l.length).padStart(4) + '  ' + b);
  r.push('\nZwaarste schermen (aantal erfenisbladen):');
  for (const [p, v] of zwaar) r.push('  ' + String(v.erfenis).padStart(4) + '  ' + p);
  if (m.wezen.length) { r.push('\nKandidaat-wezen (per stuk nalopen vóór verwijderen):'); for (const w of m.wezen) r.push('  ' + w); }
  return r.join('\n');
}

function hoofd() {
  const arg = process.argv.slice(2);
  const meting = meet();
  const json = arg.find(a => a.startsWith('--json='));
  if (json) {
    fs.writeFileSync(path.resolve(json.slice(7)), JSON.stringify(meting, null, 2) + '\n');
    console.log('inventaris geschreven naar ' + json.slice(7));
    return 0;
  }
  if (arg.includes('--beginnen')) {
    if (fs.existsSync(NORMPAD)) { console.error('ONTWERPNORM.json bestaat al; gebruik --vastleggen'); return 1; }
    fs.writeFileSync(NORMPAD, JSON.stringify(normUit(meting, null), null, 2) + '\n');
    console.log('ONTWERPNORM.json aangelegd');
    return 0;
  }
  if (arg.includes('--controle') || arg.includes('--vastleggen')) {
    if (!fs.existsSync(NORMPAD)) { console.error('ONTWERPNORM.json ontbreekt'); return 1; }
    const norm = JSON.parse(fs.readFileSync(NORMPAD, 'utf8'));
    const { fouten, ruimer } = ratelFouten(meting, norm);
    const contract = contractFouten(meting);
    const alle = fouten.concat(contract);
    if (arg.includes('--vastleggen')) {
      if (alle.length) { console.error('Weigert vast te leggen; eerst deze schendingen oplossen:\n  ' + alle.join('\n  ')); return 1; }
      fs.writeFileSync(NORMPAD, JSON.stringify(normUit(meting, norm), null, 2) + '\n');
      console.log('ONTWERPNORM.json strakker gezet (' + ruimer.length + ' verbeteringen)');
      return 0;
    }
    if (alle.length) {
      console.error('Ontwerpsysteem: ' + alle.length + ' schending(en)\n  ' + alle.join('\n  '));
      console.error('\nZie ONTWERPSYSTEEM.md. Nieuwe vormgeving hoort in public/ds/; de erfenis mag alleen krimpen.');
      return 1;
    }
    console.log('Ontwerpsysteem: geen schendingen. ' + meting.gemigreerd.length + ' scherm(en) gemigreerd.' +
      (ruimer.length ? ' ' + ruimer.length + ' verbetering(en); `node scripts/ontwerpsysteem.js --vastleggen` zet de lat strakker.' : ''));
    return 0;
  }
  console.log(samenvatting(meting));
  return 0;
}

/* Alleen de volledige expliciete DS-ingang kwalificeert een scherm als DS.
   Canonieke componenten op een legacy-host behouden de volledige laadgraaf. */
/* Bestaande lokale literal-analyse, gedeeld voor directe src-toekenningen,
   loadcalls en arrays met dynamische deelbestanden. Bundelbronnen worden niet
   afzonderlijk gevolgd tenzij een runtimebestand ze daadwerkelijk noemt. */
function lokaleScriptVerwijzingen(bron) {
  return [...new Set([...zonderJsCommentaar(bron).matchAll(/['"`](\/(?:shared|apps|site|ds|fonts)\/[^'"`\s]+?\.(?:css|js))(?:[?#][^'"`]*)?['"`]/g)].map(m => m[1]))];
}

/* Een begrensd AST-filter, geen interpreter. Alleen een directe worker-aanroep
   en lokaal bewezen DS-guards worden uitgesloten. Functie-aanroepen, aliasing
   en berekende adressen worden NIET geraden: die blijven mogelijk/onzeker.
   dsPoort is een te verifiëren contract, nooit een blinde uitzonderingslijst. */
function scriptLaadAnalyse(bron, { ds = false, poort = [] } = {}) {
  const kandidaten = lokaleScriptVerwijzingen(bron), refs = new Map(), vermeld = new Set(), uitgesloten = new Set(), onzeker = new Set();
  let boom, injecties = 0, mogelijkeInjecties = 0;
  const resultaat = () => ({ verwijzingen: [...refs].map(([href, soort]) => ({ href, soort })), vermeld: [...vermeld], uitgesloten: [...uitgesloten], onzeker: [...onzeker], injecties, mogelijkeInjecties });
  try { boom = parse(bron); } catch (e) {
    kandidaten.forEach(href => refs.set(href, 'mogelijk')); onzeker.add('JavaScript niet volledig geparseerd: ' + e.message); return resultaat();
  }
  const nodes = [], paden = new Map(), declaraties = new Map(), veranderd = new Set(), gewijzigdeLeden = new Set(), parameters = new Set();
  const isFunctie = n => n && /^(?:FunctionDeclaration|FunctionExpression|ArrowFunctionExpression)$/.test(n.type);
  const eigenaar = pad => [...pad].reverse().find(isFunctie);
  const begin = n => { let p = n.start; while (p && typeof p === 'object') p = p.start; return p; };
  const tekst = n => n && n.type === 'Literal' && n.kind === 'string' && !n.raw.includes('\\') ? n.raw.slice(1, -1) : null;
  const naam = n => !n ? '' : n.type === 'Identifier' ? n.name : n.type === 'MemberExpression' ? naam(n.object) + '.' + (n.computed ? tekst(n.property) : n.property.name) : '';
  loop(boom, (n, pad) => {
    nodes.push([n, pad]); paden.set(n, pad);
    if (n.type === 'VariableDeclarator' && n.id.type === 'Identifier') {
      const k = n.id.name; if (declaraties.has(k)) veranderd.add(k); else declaraties.set(k, { n, pad });
    }
    if (n.type === 'VariableDeclarator' && n.id.type !== 'Identifier') loop(n.id, x => { if (x.type === 'Identifier') veranderd.add(x.name); });
    for (const p of n.params || []) loop(p, x => { if (x.type === 'Identifier') parameters.add(x.name); });
    if (n.type === 'CatchClause' && n.param) loop(n.param, x => { if (x.type === 'Identifier') parameters.add(x.name); });
    if (['ClassDeclaration', 'ClassExpression'].includes(n.type) && n.id) veranderd.add(n.id.name);
    if (isFunctie(n) && n.id) veranderd.add(n.id.name);
    // Destructuring en for-in/of schrijven ook bindings; geen DS-bewijs
    // ontlenen aan een alias waarvan zo'n schrijfpad bestaat.
    if (n.type === 'AssignmentExpression' || n.type === 'ForInStatement' || n.type === 'ForOfStatement') {
      if (n.left && n.left.type === 'MemberExpression') gewijzigdeLeden.add(naam(n.left));
      else if (n.left) loop(n.left, x => { if (x.type === 'Identifier') veranderd.add(x.name); });
    }
    if (n.type === 'UpdateExpression' && n.argument.type === 'Identifier') veranderd.add(n.argument.name);
    if ((n.type === 'UpdateExpression' || n.type === 'UnaryExpression' && n.operator === 'delete') && n.argument?.type === 'MemberExpression') gewijzigdeLeden.add(naam(n.argument));
  });
  function nativeBinding(k) {
    const zonderWindow = p => p.replace(/^(?:window|globalThis)\./, '');
    const wortels = [k.split('.')[0], zonderWindow(k).split('.')[0]];
    return wortels.every(w => !declaraties.has(w) && !parameters.has(w) && !veranderd.has(w)) &&
      ![...gewijzigdeLeden].some(p => zonderWindow(p) === zonderWindow(k) || zonderWindow(k).startsWith(zonderWindow(p) + '.'));
  }
  // Alleen directe IIFE-parameters met een aantoonbaar native documentargument.
  // Geen guardcapture, aanroepinterpretatie of alias die wordt doorgegeven.
  const documentAliassen = new Map();
  for (const [fn, pad] of nodes) {
    if (!isFunctie(fn) || fn.async || fn.generator) continue;
    const call = pad[pad.length - 1];
    if (!call || call.type !== 'CallExpression' || call.callee !== fn || call.arguments.some(a => a.type === 'SpreadElement')) continue;
    for (let i = 0; i < fn.params.length; i++) {
      const param = fn.params[i], arg = call.arguments[i];
      if (param.type !== 'Identifier' || !['document', 'window.document'].includes(naam(arg)) || !nativeBinding(naam(arg) + '.documentElement.hasAttribute')) continue;
      const alias = param.name;
      const bindings = nodes.filter(([n]) => isFunctie(n)).flatMap(([n]) => n.params || []).filter(p => p.type === 'Identifier' && p.name === alias);
      if (bindings.length !== 1 || declaraties.has(alias) || veranderd.has(alias)) continue;
      const aliasGebruikOnveilig = nodes.some(([n, pp]) => {
        if (n.type !== 'Identifier' || n.name !== alias || n === param) return false;
        let eind = n, ouders = pp.slice();
        while (ouders.length && ouders[ouders.length - 1].type === 'MemberExpression' && ouders[ouders.length - 1].object === eind) {
          eind = ouders.pop();
          if (eind.computed && tekst(eind.property) === null) return true;
        }
        const ouder = ouders[ouders.length - 1], pad = naam(eind);
        // Subobjecten mogen niet ontsnappen naar variabelen, objecten, returns
        // of onbekende calls. Alleen de directe DS-read en DOM-aanmaak.
        if (ouder?.type === 'CallExpression' && ouder.callee === eind)
          return ![alias + '.documentElement.hasAttribute', alias + '.createElement'].includes(pad);
        return !(pad === alias + '.documentElement' && ouder?.type === 'LogicalExpression');
      });
      const documentArgument = n => ['document', 'window.document', alias].some(k => naam(n) === k || naam(n).startsWith(k + '.'));
      const ontsnapt = nodes.some(([n]) => n.type === 'CallExpression' && n !== call && n.arguments.some(documentArgument));
      const onveilig = aliasGebruikOnveilig || ontsnapt || nodes.some(([n, pp]) => pp.includes(fn) && (
        n.type === 'Identifier' && n.name === 'arguments' || n.type === 'WithStatement' ||
        n.type === 'CallExpression' && naam(n.callee) === 'eval' ||
        n.type === 'Identifier' && n.name === alias && n !== param &&
          !(pp[pp.length - 1]?.type === 'MemberExpression' && pp[pp.length - 1].object === n)
      ));
      if (!onveilig) documentAliassen.set(alias, fn);
    }
  }
  // Ook wijzigingen via de documentalias treffen de native methode.
  for (const p of [...gewijzigdeLeden]) {
    const a = p.split('.')[0];
    if (documentAliassen.has(a)) gewijzigdeLeden.add('document' + p.slice(a.length));
  }
  function dsNaam(n) {
    const k = naam(n), alias = k.split('.')[0], fn = documentAliassen.get(alias);
    return fn && eigenaar(paden.get(n) || []) === fn ? 'document' + k.slice(alias.length) : k;
  }
  const dsTest = n => n && n.type === 'CallExpression' && dsNaam(n.callee) === 'document.documentElement.hasAttribute' && tekst(n.arguments[0]) === 'data-ds';
  const markerWijzigt = nodes.some(([n]) => n.type === 'CallExpression' && /documentElement\.(?:setAttribute|removeAttribute|toggleAttribute)$/.test(naam(n.callee)) && tekst(n.arguments[0]) === 'data-ds');
  const kanDs = ds && !markerWijzigt && nativeBinding('document.documentElement.hasAttribute');
  // Een primitieve DS-snapshot mag worden gesloten over een latere functie,
  // uitsluitend als hij de eerste instructie van de eerste directe IIFE is.
  // Er is dan nog geen eigen call/escape uitgevoerd; latere documentaliassen
  // kunnen deze const-waarde niet veranderen. Geen algemene capture-analyse.
  const dsSnapshots = new Map();
  // Uitsluitend de bestaande no-browser-vorm: typeof leest geen getter en
  // de twee armen zijn native window/null. Geen algemene conditional-evaluatie.
  const bestaatNative = (n, k) => n?.type === 'BinaryExpression' && n.operator === '!==' &&
    n.left?.type === 'UnaryExpression' && n.left.operator === 'typeof' &&
    n.left.argument?.type === 'Identifier' && n.left.argument.name === k &&
    tekst(n.right) === 'undefined' && nativeBinding(k);
  const snapshotArgument = a => ['window', 'document', 'globalThis'].includes(naam(a)) && nativeBinding(naam(a)) ||
    a?.type === 'ConditionalExpression' && bestaatNative(a.test, 'window') &&
    a.consequent?.type === 'Identifier' && a.consequent.name === 'window' &&
    a.alternate?.type === 'Literal' && a.alternate.kind === 'null';
  function snapshotRead(n) {
    const read = n?.type === 'LogicalExpression' && n.operator === '&&' && bestaatNative(n.left, 'document') ? n.right : n;
    return dsTest(read) && read.arguments.length === 1 && naam(read.callee) === 'document.documentElement.hasAttribute';
  }
  const instructies = body => body.filter(s => !(s.type === 'ExpressionStatement' && tekst(s.expression) === 'use strict'));
  const eerste = instructies(boom.body || [])[0], call = eerste?.type === 'ExpressionStatement' && eerste.expression;
  const fn = call?.type === 'CallExpression' && call.callee;
  if (fn && isFunctie(fn) && !fn.id && !fn.async && !fn.generator && fn.body.type === 'BlockStatement' && fn.params.every(p => p.type === 'Identifier') &&
      call.arguments.every(snapshotArgument)) {
    const start = instructies(fn.body.body)[0], d = start?.type === 'VariableDeclaration' && start.kind === 'const' && start.declarations.length === 1 && start.declarations[0];
    if (d?.id?.type === 'Identifier' && snapshotRead(d.init) &&
        !veranderd.has(d.id.name) && !parameters.has(d.id.name) && declaraties.get(d.id.name)?.n === d &&
        !nodes.some(([n, pad]) => pad.includes(fn) && (n.type === 'WithStatement' || n.type === 'Identifier' && n.name === 'arguments' || n.type === 'CallExpression' && naam(n.callee) === 'eval')))
      dsSnapshots.set(d.id.name, fn);
  }
  function waar(n, gezien = new Set(), referentie = n) {
    if (!kanDs || !n) return null;
    if (dsTest(n)) return true;
    if (['document.documentElement', 'document.documentElement.hasAttribute'].includes(dsNaam(n))) return true;
    if (n.type === 'Identifier' && dsSnapshots.has(n.name) && (paden.get(n) || []).includes(dsSnapshots.get(n.name))) return true;
    if (n.type === 'Identifier' && !veranderd.has(n.name) && !parameters.has(n.name) && !gezien.has(n.name)) {
      const d = declaraties.get(n.name), blok = d && d.pad[d.pad.length - 2], fn = d && eigenaar(d.pad);
      // Geen controlflow-inferentie: alleen een eerdere, onvoorwaardelijke
      // declaratie in dezelfde scope. Een callback vóór initialisatie telt niet.
      if (!d || !blok || !(blok.type === 'Program' || fn && fn.body === blok) || eigenaar(paden.get(referentie) || []) !== fn || begin(d.n) >= begin(referentie)) return null;
      gezien.add(n.name); return waar(d.n.init, gezien, referentie);
    }
    if (n.type === 'UnaryExpression' && n.operator === '!') { const v = waar(n.argument, gezien, referentie); return v === null ? null : !v; }
    if (n.type === 'LogicalExpression') {
      const a = waar(n.left, new Set(gezien), referentie), b = waar(n.right, new Set(gezien), referentie);
      if (n.operator === '&&') return a === false || b === false ? false : a === true && b === true ? true : null;
      if (n.operator === '||') return a === true || b === true ? true : a === false && b === false ? false : null;
    }
    return null;
  }
  const returnt = n => n && (n.type === 'ReturnStatement' || n.type === 'BlockStatement' && n.body.length === 1 && n.body[0].type === 'ReturnStatement');
  function dsUit(n, pad) {
    const keten = pad.concat(n);
    for (let i = 0; i < pad.length; i++) {
      const p = pad[i], kind = keten[i + 1];
      if ((p.type === 'IfStatement' || p.type === 'ConditionalExpression') &&
          (kind === p.consequent && waar(p.test) === false || kind === p.alternate && waar(p.test) === true)) return true;
      if (p.type === 'LogicalExpression' && kind === p.right && (p.operator === '&&' && waar(p.left) === false || p.operator === '||' && waar(p.left) === true)) return true;
      // Alleen een early return vóór de rest van DEZELFDE functie. Een guard
      // in een andere functie/callsite is hier bewust geen bewijs.
      if (isFunctie(p) && p.body && p.body.type === 'BlockStatement') {
        const eerste = p.body.body.filter(s => !(s.type === 'ExpressionStatement' && tekst(s.expression) === 'use strict'))[0];
        if (eerste && eerste.type === 'IfStatement' && waar(eerste.test) === true && returnt(eerste.consequent) && !keten.includes(eerste)) return true;
      }
    }
    return false;
  }
  // Een bewezen lokaal anker-href navigeert/downloadt; het laadt geen CSS.
  // Houd de bronverwijzing wel in vermeld (en in de globale weesinventaris).
  function ankerHref(n) {
    if (!n || n.type !== 'AssignmentExpression' || n.left.type !== 'MemberExpression' ||
        (n.left.computed ? tekst(n.left.property) : n.left.property.name) !== 'href' || n.left.object.type !== 'Identifier') return false;
    const id = n.left.object.name, d = declaraties.get(id), init = d?.n.init;
    if (!d || veranderd.has(id) || parameters.has(id) || !init || init.type !== 'CallExpression' ||
        !['document.createElement', 'window.document.createElement'].includes(naam(init.callee)) ||
        tekst(init.arguments[0]) !== 'a' || !nativeBinding(naam(init.callee))) return false;
    const blok = d.pad[d.pad.length - 2], fn = eigenaar(d.pad), toekenningPad = paden.get(n) || [];
    /* Een lokaal anker mag ook binnen hetzelfde try/catch- of ander lexicaal
       blok ontstaan. De vroegere beperking tot alleen de functieroot leverde
       daar een fout-positief op. Vereis wel dat de href-toekenning aantoonbaar
       binnen exact datzelfde blok en dezelfde functie blijft. */
    if (!['Program', 'BlockStatement'].includes(blok?.type) || !toekenningPad.includes(blok) ||
        eigenaar(toekenningPad) !== fn || begin(d.n) >= begin(n)) return false;
    return !nodes.some(([x, pp]) => {
      /* Een later gebruik van het anker kan de al uitgevoerde native
         href-toekenning niet met terugwerkende kracht in een stylesheetload
         veranderen. Vóór de toekenning blijven setters, aliases, prototypes
         en onbekende calls bewust blokkerend. */
      if (begin(x) > begin(n)) return false;
      const ouder = pp[pp.length - 1];
      if (x.type === 'MemberExpression' && x.computed && tekst(x.property) === null &&
          [id, 'document', 'window'].some(k => naam(x.object) === k || naam(x.object).startsWith(k + '.'))) return true;
      if (x.type === 'CallExpression' && x.arguments.some(a => ['document', 'window.document', 'document.createElement', 'window.document.createElement'].includes(naam(a)))) {
        /* Het documentargument van de omhullende, direct aangeroepen IIFE is
           geen onbekende ontsnapping: die functie bevat juist deze bewezen
           ankeropbouw. Een document dat aan iedere andere call wordt
           doorgegeven blijft wel onbeslist. */
        const eigenIife = isFunctie(x.callee) && (paden.get(n) || []).includes(x.callee);
        if (!eigenIife) return true;
      }
      if (['document', 'window.document', 'document.createElement', 'window.document.createElement'].includes(naam(x)) &&
          !(ouder?.type === 'MemberExpression' && ouder.object === x) &&
          !(ouder?.type === 'CallExpression' && ouder.callee === x)) return true;
      if (x.type !== 'Identifier' || x.name !== id || x === d.n.id) return false;
      if (ouder?.type === 'MemberExpression' && ouder.object === x) {
        const key = ouder.computed ? tekst(ouder.property) : ouder.property.name, gebruik = pp[pp.length - 2];
        // Geen setters/prototypeketen of onbekende methodes als native href
        // behandelen. Ook overschrijven van click/remove blijft onbeslist.
        if (gebruik?.type === 'CallExpression' && gebruik.callee === ouder)
          return !['click', 'remove'].includes(key);
        if (gebruik?.type === 'AssignmentExpression' && gebruik.left === ouder)
          return !['href', 'download', 'className', 'textContent', 'id', 'target', 'rel', 'type'].includes(key);
        return !['href', 'download', 'className', 'textContent', 'id', 'target', 'rel', 'type'].includes(key);
      }
      return !(ouder?.type === 'CallExpression' && ['document.body.appendChild', 'document.body.insertBefore'].includes(naam(ouder.callee)) && nativeBinding(naam(ouder.callee)) && ouder.arguments[0] === x);
    });
  }
  const ankerToekenningen = new Set(nodes.filter(([n]) => ankerHref(n)).map(([n]) => n));
  function navigatieAdres(n) {
    const t = tekst(n);
    // Alleen een aantoonbare document-/fragmentprefix. Een onbekende URL kan
    // bijvoorbeeld javascript: zijn; die krijgt geen navigatievrijstelling.
    return t !== null ? /^(?:\/(?!\/)|#)/.test(t) :
      !!n && n.type === 'BinaryExpression' && n.operator === '+' && navigatieAdres(n.left);
  }
  const navigatieToekenningen = new Set(nodes.filter(([n]) => n.type === 'AssignmentExpression' &&
    ['location.href', 'window.location.href', 'globalThis.location.href'].includes(naam(n.left)) &&
    nativeBinding(naam(n.left.object)) && navigatieAdres(n.right)).map(([n]) => n));
  /* Een native iframe-src is een documentnavigatie en kan geen stylesheet in
     de bovenliggende pagina worden. Bewijs dit uitsluitend voor de eerste
     directe src-toekenning na createElement('iframe'); een fabriek, alias,
     eerdere escape of herschreven binding blijft open. */
  function iframeSrc(n) {
    if (!n || n.type !== 'AssignmentExpression' || n.left.type !== 'MemberExpression' ||
        (n.left.computed ? tekst(n.left.property) : n.left.property.name) !== 'src' || n.left.object.type !== 'Identifier') return false;
    const id = n.left.object.name, d = declaraties.get(id), init = d?.n.init;
    if (!d || veranderd.has(id) || parameters.has(id) || init?.type !== 'CallExpression' ||
        !['document.createElement', 'window.document.createElement'].includes(naam(init.callee)) ||
        tekst(init.arguments[0]) !== 'iframe' || !nativeBinding(naam(init.callee)) ||
        eigenaar(d.pad) !== eigenaar(paden.get(n) || []) || begin(d.n) >= begin(n)) return false;
    return !nodes.some(([x, pp]) => begin(x) > d.n.end && begin(x) < begin(n) &&
      x.type === 'Identifier' && x.name === id && !(pp[pp.length - 1] === n.left && n.left.object === x));
  }
  const iframeToekenningen = new Set(nodes.filter(([n]) => iframeSrc(n)).map(([n]) => n));
  /* Een bewezen native img-src is een beeldbron en kan geen document-CSS of
     script uitvoeren. Houd dezelfde strenge grens als bij iframe: het element
     moet rechtstreeks uit de ongewijzigde DOM/Image-constructor komen, mag
     niet aliassen of ontsnappen en de src-setter mag niet zijn vervangen.
     Gewone beeldmetadata, eventhandlers en native DOM-plaatsing veranderen de
     identiteit van het element niet. */
  function beeldSrc(n) {
    if (!n || n.type !== 'AssignmentExpression' || n.left.type !== 'MemberExpression' ||
        (n.left.computed ? tekst(n.left.property) : n.left.property.name) !== 'src' || n.left.object.type !== 'Identifier') return false;
    const id = n.left.object.name, d = declaraties.get(id), init = d?.n.init;
    const domBeeld = init?.type === 'CallExpression' &&
      ['document.createElement', 'window.document.createElement'].includes(naam(init.callee)) &&
      tekst(init.arguments[0]) === 'img' && nativeBinding(naam(init.callee));
    const imageBeeld = init?.type === 'NewExpression' && ['Image', 'window.Image'].includes(naam(init.callee)) &&
      nativeBinding(naam(init.callee));
    const declaratieEigenaar = d && eigenaar(d.pad), toekenningPad = paden.get(n) || [];
    if (!d || veranderd.has(id) || parameters.has(id) || !(domBeeld || imageBeeld) ||
        !(declaratieEigenaar === eigenaar(toekenningPad) || declaratieEigenaar && toekenningPad.includes(declaratieEigenaar)) ||
        begin(d.n) >= begin(n)) return false;
    const veiligeEigenschappen = new Set(['src', 'alt', 'className', 'id', 'width', 'height', 'loading', 'decoding',
      'draggable', 'hidden', 'onload', 'onerror', 'style', 'dataset', 'files']);
    return !nodes.some(([x, pp]) => {
      if (begin(x) <= d.n.end || begin(x) >= begin(n) || x.type !== 'Identifier' || x.name !== id) return false;
      const ouder = pp[pp.length - 1], gebruik = pp[pp.length - 2];
      if (ouder?.type === 'MemberExpression' && ouder.object === x) {
        const key = ouder.computed ? tekst(ouder.property) : ouder.property.name;
        if (key === null || !veiligeEigenschappen.has(key)) return true;
        if (gebruik?.type === 'CallExpression' && gebruik.callee === ouder) return true;
        return false;
      }
      if (ouder?.type === 'CallExpression' && ouder.arguments.includes(x)) {
        if (['document.body.appendChild', 'document.head.appendChild'].includes(naam(ouder.callee)) && nativeBinding(naam(ouder.callee))) return false;
        const methode = ouder.callee?.type === 'MemberExpression' &&
          (ouder.callee.computed ? tekst(ouder.callee.property) : ouder.callee.property.name);
        const ontvanger = ouder.callee?.type === 'MemberExpression' && ouder.callee.object?.type === 'Identifier' && ouder.callee.object.name;
        const rd = ontvanger && declaraties.get(ontvanger), ri = rd?.n?.init;
        const nativeOntvanger = ri?.type === 'CallExpression' &&
          ['document.createElement', 'window.document.createElement'].includes(naam(ri.callee)) &&
          tekst(ri.arguments[0]) !== null && nativeBinding(naam(ri.callee)) && !veranderd.has(ontvanger) &&
          ![...gewijzigdeLeden].some(p => p === ontvanger + '.' + methode || p.startsWith(ontvanger + '.' + methode + '.'));
        if (nativeOntvanger && ['appendChild', 'insertBefore', 'prepend', 'replaceChildren'].includes(methode)) return false;
        return true;
      }
      return true;
    });
  }
  const beeldToekenningen = new Set(nodes.filter(([n]) => beeldSrc(n)).map(([n]) => n));
  /* Een src op een reeds bestaand video-/audio-element is eveneens een
     mediabron, geen stylesheetloader. Anders dan een nieuw <img> komt dat
     element via het publieke RTGStroom-contract binnen. Daarom geldt een
     smallere bewijsregel: de omhullende functie moet fail-closed beginnen met
     een native HTMLMediaElement-guard en het element mag vóór de toekenning
     niet aliassen, ontsnappen of van identiteit wisselen. */
  function mediaSrc(n) {
    if (!n || n.type !== 'AssignmentExpression' || n.left.type !== 'MemberExpression' ||
        (n.left.computed ? tekst(n.left.property) : n.left.property.name) !== 'src' || n.left.object.type !== 'Identifier') return false;
    const id = n.left.object.name, pad = paden.get(n) || [];
    const contract = [...pad].reverse().find(f => isFunctie(f) && f.params.some(p => p.type === 'Identifier' && p.name === id));
    if (!contract || veranderd.has(id) || declaraties.has(id) || !nativeBinding('HTMLMediaElement.prototype.src')) return false;
    const eerste = instructies(contract.body?.body || [])[0], test = eerste?.type === 'IfStatement' && eerste.test;
    const geval = test?.type === 'UnaryExpression' && test.operator === '!' && test.argument?.type === 'BinaryExpression' &&
      test.argument.operator === 'instanceof' && test.argument.left?.type === 'Identifier' && test.argument.left.name === id &&
      naam(test.argument.right) === 'HTMLMediaElement';
    if (!geval || !returnt(eerste.consequent) || !nativeBinding('HTMLMediaElement') ||
        [...gewijzigdeLeden].some(p => p.startsWith(id + '.') && ![id + '.src', id + '.__rtgKijk', id + '.__rtgKijk.pogingen', id + '.__rtgKijkLuistert', id + '.currentTime'].includes(p))) return false;
    const veilig = new Set(['src', 'currentTime', 'play', 'getAttribute', 'addEventListener', 'removeEventListener', '__rtgKijk', '__rtgKijkLuistert']);
    return !nodes.some(([x, pp]) => {
      if (begin(x) <= eerste.end || begin(x) >= begin(n) || x.type !== 'Identifier' || x.name !== id) return false;
      const ouder = pp[pp.length - 1], gebruik = pp[pp.length - 2];
      if (ouder?.type === 'MemberExpression' && ouder.object === x) {
        const key = ouder.computed ? tekst(ouder.property) : ouder.property.name;
        if (key === null || !veilig.has(key)) return true;
        if (gebruik?.type === 'CallExpression' && gebruik.callee === ouder)
          return !['play', 'getAttribute', 'addEventListener', 'removeEventListener'].includes(key);
        return false;
      }
      return true;
    });
  }
  const mediaToekenningen = new Set(nodes.filter(([n]) => mediaSrc(n)).map(([n]) => n));
  /* Begrensde lokale DOM-laders mogen hun pad als parameter ontvangen. We
     bewijzen alleen een niet-ontsnapte functiedeclaratie met één statisch
     elementtype, een directe native src/href-toekenning, native head-append en
     uitsluitend lokale letterlijke callsites. Dit is callsite-analyse, geen
     algemene functie-interpretatie. */
  const helperLiterals = new Map(), helperToekenningen = new Set();
  for (const [helper] of nodes) {
    if (helper.type !== 'FunctionDeclaration' || !helper.id || helper.params.some(p => p.type !== 'Identifier')) continue;
    const helperPad = paden.get(helper) || [], binnen = ([, pp]) => pp.includes(helper);
    const toekenningen = nodes.filter(([n, pp]) => binnen([n, pp]) && n.type === 'AssignmentExpression' &&
      n.left.type === 'MemberExpression' && n.left.object.type === 'Identifier' &&
      ['src', 'href'].includes(n.left.computed ? tekst(n.left.property) : n.left.property.name) && n.right.type === 'Identifier');
    if (toekenningen.length !== 1) continue;
    const toekenning = toekenningen[0][0], elementNaam = toekenning.left.object.name;
    const padIndex = helper.params.findIndex(p => p.name === toekenning.right.name);
    if (padIndex < 0) continue;
    const declaratie = declaraties.get(elementNaam), init = declaratie?.n.init;
    const soort = init?.type === 'CallExpression' && ['document.createElement', 'window.document.createElement'].includes(naam(init.callee)) &&
      nativeBinding(naam(init.callee)) ? tekst(init.arguments[0]) : null;
    const eigenschap = toekenning.left.computed ? tekst(toekenning.left.property) : toekenning.left.property.name;
    if (!declaratie || !declaratie.pad.includes(helper) || !((soort === 'script' && eigenschap === 'src') || (soort === 'link' && eigenschap === 'href'))) continue;
    const append = nodes.some(([n, pp]) => binnen([n, pp]) && n.type === 'CallExpression' &&
      ['document.head.appendChild', 'window.document.head.appendChild'].includes(naam(n.callee)) &&
      nativeBinding(naam(n.callee)) && n.arguments.length === 1 && naam(n.arguments[0]) === elementNaam);
    if (!append) continue;
    const gebruiken = nodes.filter(([n]) => n.type === 'Identifier' && n.name === helper.id.name && n !== helper.id);
    if (!gebruiken.length || gebruiken.some(([n, pp]) => {
      const ouder = pp[pp.length - 1]; return !(ouder?.type === 'CallExpression' && ouder.callee === n);
    })) continue;
    const calls = gebruiken.map(([n, pp]) => pp[pp.length - 1]);
    if (calls.some(c => c.arguments.length <= padIndex || tekst(c.arguments[padIndex]) === null)) continue;
    for (const call of calls) {
      const literal = call.arguments[padIndex], href = tekst(literal);
      if (!/^\/(?:shared|apps|site|ds|fonts)\/[^\s]+?\.(?:css|js)(?:[?#].*)?$/.test(href) ||
          soort === 'script' && !/\.js(?:[?#].*)?$/.test(href) || soort === 'link' && !/\.css(?:[?#].*)?$/.test(href)) continue;
      helperLiterals.set(literal, { href: href.split(/[?#]/)[0], uitgesloten: dsUit(toekenning, paden.get(toekenning) || []) });
    }
    if (calls.every(c => helperLiterals.has(c.arguments[padIndex]))) helperToekenningen.add(toekenning);
  }
  function nativeWorker(k) {
    if (!nativeBinding(k)) return false;
    const canon = p => p.replace(/^(?:window|globalThis)\./, ''), doel = canon(k);
    if ([...gewijzigdeLeden].some(p => p.includes('.null') && doel.startsWith(canon(p).split('.null')[0] + '.'))) return false;
    return !nodes.some(([n, pad]) => {
      const p = pad[pad.length - 1], v = canon(naam(n));
      if (!v || !(v === doel || doel.startsWith(v + '.'))) return false;
      // Een native worker-object/methode mag niet via alias of een onbekende
      // call worden herschreven. Gewone feature-reads zijn geen ontsnapping.
      return p?.type === 'VariableDeclarator' && p.init === n || p?.type === 'AssignmentExpression' && p.right === n ||
        p?.type === 'CallExpression' && p.arguments.includes(n) || ['ReturnStatement', 'Property', 'ArrayExpression'].includes(p?.type);
    });
  }
  for (const [n, pad] of nodes) {
    const t = tekst(n), href = t && /^\/(?:shared|apps|site|ds|fonts)\/[^\s]+?\.(?:css|js)(?:[?#].*)?$/.test(t) ? t.split(/[?#]/)[0] : null;
    const uit = dsUit(n, pad), p = pad[pad.length - 1];
    const anker = p?.type === 'AssignmentExpression' && p.right === n && ankerToekenningen.has(p);
    const navigatie = p?.type === 'AssignmentExpression' && p.right === n && navigatieToekenningen.has(p);
    const iframe = p?.type === 'AssignmentExpression' && p.right === n && iframeToekenningen.has(p);
    const beeld = p?.type === 'AssignmentExpression' && p.right === n && beeldToekenningen.has(p);
    const media = p?.type === 'AssignmentExpression' && p.right === n && mediaToekenningen.has(p);
    const functieOnzeker = pad.some(f => isFunctie(f) && !(paden.get(f) || []).some((a, i, pp) => i === pp.length - 1 && a.type === 'CallExpression' && a.callee === f));
    const aanroep = p && (p.type === 'CallExpression' || p.type === 'NewExpression') && p.arguments[0] === n;
    const k = aanroep ? naam(p.callee) : '';
    const worker = aanroep && (['navigator.serviceWorker.register', 'window.navigator.serviceWorker.register'].includes(k) || p.type === 'NewExpression' && ['Worker', 'SharedWorker', 'window.Worker', 'window.SharedWorker'].includes(k));
    // Een bewezen worker-call laadt geen document-CSS, ook niet op /sw.js
    // of een relatief adres. De URL blijft in de broninventaris vermeld.
    if (t && worker && nativeWorker(k)) { vermeld.add(t.split(/[?#]/)[0]); continue; }
    if (t && worker) onzeker.add('Worker-binding niet bewezen: ' + k);
    if (helperLiterals.has(n)) {
      const helper = helperLiterals.get(n);
      if (helper.uitgesloten) uitgesloten.add(helper.href); else refs.set(helper.href, 'dom');
      continue;
    }
    if (href) {
      if (anker || navigatie || iframe || beeld || media) { vermeld.add(href); continue; }
      if (uit) { uitgesloten.add(href); continue; }
      const d = p && p.type === 'AssignmentExpression' && p.left.type === 'MemberExpression' && declaraties.get(naam(p.left.object));
      const elem = d && d.n.init;
      const dom = !functieOnzeker && p && p.type === 'AssignmentExpression' && p.right === n && p.left.type === 'MemberExpression' && ['src', 'href'].includes(p.left.property.name || tekst(p.left.property)) && elem && elem.type === 'CallExpression' && /\.createElement$/.test(naam(elem.callee)) && ['script', 'link'].includes(tekst(elem.arguments[0])) && !veranderd.has(naam(p.left.object));
      if (refs.get(href) !== 'dom') refs.set(href, dom ? 'dom' : 'mogelijk');
      if (!dom) onzeker.add('URL zonder bewezen DOM-load: ' + href);
    }
    // Relative en overige lokale adressen hebben nog geen bewezen basis-URL.
    // Niet stil als schoon behandelen; geen algemene URL-interpreter toevoegen.
    if (!uit && !anker && !navigatie && !iframe && !beeld && !media && t && !href && /\.(?:css|js)(?:[?#].*)?$/.test(t) && !/^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(t))
      onzeker.add('Lokaal laadadres niet herleid: ' + t);
    if (!uit && (n.type === 'CallExpression' && (/\.createElement$/.test(naam(n.callee)) && tekst(n.arguments[0]) === 'style' || /\.insertRule$/.test(naam(n.callee))) || n.type === 'MemberExpression' && (n.property.name || tekst(n.property)) === 'adoptedStyleSheets')) {
      if (functieOnzeker) { mogelijkeInjecties++; onzeker.add('Stijlinjectie in niet herleide functie op regel ' + n.lijn); } else injecties++;
    }
    if (!uit && n.type === 'AssignmentExpression' && n.left.type === 'MemberExpression' && n.left.computed && tekst(n.left.property) === null) {
      const init = declaraties.get(naam(n.left.object))?.n.init;
      if (init?.type === 'CallExpression' && /\.createElement$/.test(naam(init.callee))) onzeker.add('Berekende src/href mogelijk via onbekend DOM-attribuut op regel ' + n.lijn);
    }
    if (!uit && !ankerToekenningen.has(n) && !navigatieToekenningen.has(n) && !iframeToekenningen.has(n) && !beeldToekenningen.has(n) && !mediaToekenningen.has(n) && !helperToekenningen.has(n) && n.type === 'AssignmentExpression' && n.left.type === 'MemberExpression' && ['src', 'href'].includes(n.left.property.name || tekst(n.left.property)) && tekst(n.right) === null) onzeker.add('Berekende src/href op regel ' + n.lijn);
    if (!uit && n.type === 'TemplateLiteral') for (const href of lokaleScriptVerwijzingen(bron.slice(begin(n), n.end))) { if (refs.get(href) !== 'dom') refs.set(href, 'mogelijk'); onzeker.add('Template-laadadres niet herleid: ' + href); }
  }
  // Niet-gelezen syntax (bijv. een template) blijft kandidaat, nooit stil weg.
  for (const href of kandidaten) if (!refs.has(href) && !vermeld.has(href) && !uitgesloten.has(href)) { refs.set(href, 'mogelijk'); onzeker.add('Niet herleidbare URL: ' + href); }
  if (ds) for (const href of poort) if (refs.has(href)) onzeker.add('dsPoort niet lokaal bewezen: ' + href);
  if (ds && markerWijzigt) onzeker.add('Script wijzigt zelf de data-ds-grens');
  return resultaat();
}

function htmlAttributen(tag) {
  return [...tag.matchAll(/([:\w-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g)]
    .map(a => [a[1].toLowerCase(), a[2] ?? a[3] ?? a[4] ?? '']);
}

function zonderHtmlCommentaar(html) {
  const bron = String(html || '');
  let schoon = '', vanaf = 0;
  while (true) {
    const begin = bron.indexOf('<!--', vanaf);
    if (begin < 0) return schoon + bron.slice(vanaf);
    schoon += bron.slice(vanaf, begin);
    let diepte = 1, cursor = begin + 4;
    while (diepte) {
      const open = bron.indexOf('<!--', cursor);
      const dicht = bron.indexOf('-->', cursor);
      if (dicht < 0) return schoon;
      if (open >= 0 && open < dicht) { diepte++; cursor = open + 4; }
      else { diepte--; cursor = dicht + 3; }
    }
    vanaf = cursor;
  }
}

function dsVoorScript(html, href) {
  // De documentbron bezit de grens. De shell mag een legacydocument niet
  // tijdens uitvoering promoveren; zo blijft statische kwalificatie gelijk
  // aan het gedrag dat de browser werkelijk start.
  html = stukken(zonderHtmlCommentaar(html)).filter(b => b.soort === null).map(b => b.tekst).join('');
  return /<html\b[^>]*\bdata-ds(?:\s|=|>)/i.test(html);
}

function dsBereik(html, bladen) {
  const ds = /<link\b[^>]*href=["']\/ds\/rtg-ds\.css["']/i.test(html);
  return { ds, dsDeel: !ds && bladen.some(b => b.startsWith('public/ds/')) };
}

module.exports = { lokaleScriptVerwijzingen, scriptLaadAnalyse, dsVoorScript, dsBereik, DS, meet, contractFouten, ratelFouten, normUit, telHex, telImportant, telInjectie };
if (require.main === module) process.exitCode = hoofd();
