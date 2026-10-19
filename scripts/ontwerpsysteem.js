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

const WORTEL = path.join(__dirname, '..');
const PUBLIEK = path.join(WORTEL, 'public');
const DS = path.join(PUBLIEK, 'ds');
const NORMPAD = path.join(WORTEL, 'ONTWERPNORM.json');
const rel = p => path.relative(WORTEL, p).split(path.sep).join('/');
const zonderCommentaar = s => s.replace(/\/\*[\s\S]*?\*\//g, ' ');

function bestanden(map, patroon, uit = []) {
  if (!fs.existsSync(map)) return uit;
  for (const naam of fs.readdirSync(map).sort()) {
    if (naam === 'node_modules' || naam.startsWith('.')) continue;
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

  /* Laadgraaf: van een bestand naar de .css en .js die het noemt. */
  const buren = f => {
    const s = lees(f), uit = [];
    if (f.endsWith('.html')) {
      for (const m of s.matchAll(/<link\b[^>]*href=["']([^"']+\.css[^"']*)["']/gi)) uit.push(naarPubliek(m[1], f));
      for (const m of s.matchAll(/<script\b[^>]*src=["']([^"']+\.js[^"']*)["']/gi)) uit.push(naarPubliek(m[1], f));
      for (const b of stijlblokken(s)) for (const m of b.matchAll(/@import\s+(?:url\()?\s*['"]?([^'")\s;]+\.css)/gi)) uit.push(naarPubliek(m[1], f));
    } else if (f.endsWith('.css')) {
      for (const m of zonderCommentaar(s).matchAll(/@import\s+(?:url\()?\s*['"]?([^'")\s;]+\.css)/gi)) uit.push(naarPubliek(m[1], f));
    } else {
      for (const m of zonderCommentaar(s).matchAll(/['"`](\/(?:shared|apps|site|ds|fonts)\/[^'"`\s]+?\.(?:css|js))(?:\?[^'"`]*)?['"`]/g)) uit.push(naarPubliek(m[1], f));
    }
    return uit.filter(p => p && fs.existsSync(p));
  };
  const geladenDoor = {};
  const paginas = {};
  for (const p of html) {
    const gezien = new Set(), rij = [p];
    while (rij.length) {
      const f = rij.pop();
      for (const b of buren(f)) if (!gezien.has(b)) { gezien.add(b); rij.push(b); }
    }
    const lijst = [...gezien].filter(f => f.endsWith('.css')).map(rel).sort();
    paginas[rel(p)] = {
      bladen: lijst,
      ds: lijst.some(b => b.startsWith('public/ds/')),
      erfenis: lijst.filter(b => !b.startsWith('public/ds/') && b !== 'public/fonts/fonts.css').length,
      stijlblok: Boolean(blokken[rel(p)]),
    };
    for (const b of lijst) (geladenDoor[b] = geladenDoor[b] || []).push(rel(p));
  }
  /* Ook de service workers en losse scripts noemen bladen (precache); wie
     daar genoemd staat is geen wees, maar ook niet door een scherm geladen. */
  const genoemd = new Set();
  for (const f of [...js, ...css]) for (const b of buren(f)) if (b.endsWith('.css')) genoemd.add(rel(b));
  /* De server levert ook zelf bladen uit (middleware, schermbouw); een naam
     die daar staat is in gebruik, ook als geen scherm hem statisch laadt. */
  const serverBron = bestanden(path.join(WORTEL, 'server'), /\.js$/).map(f => fs.readFileSync(f, 'utf8')).join('\n');
  for (const b of Object.keys(bladen)) if (serverBron.includes(path.basename(b))) genoemd.add(b);
  const wezen = Object.keys(bladen).filter(b => !geladenDoor[b] && !genoemd.has(b) && !b.startsWith('public/ds/')).sort();

  const gemigreerd = Object.entries(paginas).filter(([, v]) => v.ds && v.erfenis === 0 && !v.stijlblok).map(([k]) => k);
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

  for (const f of bestanden(DS, /\.css$/)) {
    const r = rel(f);
    const s = zonderCommentaar(fs.readFileSync(f, 'utf8'));
    const deel = path.relative(DS, f).split(path.sep).join('/');

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
    /* 2. Geen !important: in een gelaagd systeem bestaat er geen reden voor. */
    if (telImportant(s)) fouten.push(r + ': bevat !important (' + telImportant(s) + 'x)');
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
  /* Elk schermtype en elk component uit het contract bestaat ook. */
  for (const t of contract.schermtypen) if (!fs.existsSync(path.join(DS, 'schermen', t + '.css'))) fouten.push('schermtype ' + t + ' staat in het contract maar public/ds/schermen/' + t + '.css ontbreekt');
  for (const c of contract.componenten) if (!fs.existsSync(path.join(DS, 'componenten', c + '.css'))) fouten.push('component ' + c + ' staat in het contract maar public/ds/componenten/' + c + '.css ontbreekt');
  for (const w of contract.werelden) if (!fs.existsSync(path.join(DS, 'thema', w + '.css'))) fouten.push('wereld ' + w + ' staat in het contract maar public/ds/thema/' + w + '.css ontbreekt');
  /* Een gemigreerd scherm laadt geen erfenis en draagt geen eigen blok. */
  for (const [p, v] of Object.entries(meting.paginas)) {
    if (!v.ds) continue;
    if (v.stijlblok) fouten.push(p + ': draagt het Design System en tegelijk een eigen <style>-blok');
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
    if (!u.pad || !u.reden || !u.vervalt) { fouten.push('uitzondering zonder pad, reden of vervaldatum: ' + JSON.stringify(u)); continue; }
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
  for (const [pad, n] of Object.entries(meting.injectie)) {
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

module.exports = { DS, meet, contractFouten, ratelFouten, normUit, telHex, telImportant, telInjectie };
if (require.main === module) process.exitCode = hoofd();
