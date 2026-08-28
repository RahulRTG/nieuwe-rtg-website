'use strict';
/* DE REALITY INDEX -- de broncode één keer begrijpen.

   WAAROM DIT ER IS, EN WAAROM HET STAP 1 HOORDE TE ZIJN.

   PROOF-INCREMENTAL.md zet dit vooraan met één reden: niet acht scanners die
   acht keer dezelfde bestanden lezen. Ik heb die volgorde eerst genegeerd en
   regel 51, 59 en 60 als drie losse scanners gebouwd -- elk met een eigen
   boomwandeling, een eigen leesronde en een eigen commentaarfilter. Ze waren
   snel genoeg om er niets van te merken, en precies daarom is dat de fout die je
   niet ziet aankomen: bij de vijfde laag is het te laat om hem nog te maken.

   WAT DEZE INDEX LEVERT, per bestand, uit één leesronde:

     hash        de inhoud, zodat een bewijs later kan zeggen of er iets veranderde
     bytes       code-bytes, zonder commentaar (zie de opmerking bij regel 13)
     gebied      identity / money / security / algemeen
     kanten      wat dit bestand inlaadt: opgelost, benaderd, onbekend
     raakt       de plekken die een verboden kant kunnen schenden
     coderegels  de regels zonder commentaar, één keer bepaald

   DE COMMENTAARVRAAG WORDT HIER ÉÉN KEER BEANTWOORD. Dat is geen detail: drie
   van de vier meetfouten die tijdens het bouwen van deze laag zijn gemaakt,
   kwamen uit commentaar -- een kop die als kant telde, een te grove stripper die
   een echte mountregel opat, en een voorbeeld-require in een toelichting die de
   keuring liet zakken. Eén antwoord op één plek is de enige manier waarop dat
   niet een vierde keer gebeurt.

   WAT DIT NIET IS. Geen parser: de AST-laag (scripts/ast/parser.js) is duurder
   en wordt gebruikt waar hij nodig is (lib/vrijenamen.js). Deze index geeft de
   goedkope waarheden waar de meeste lagen genoeg aan hebben, en geeft de bron
   door aan wie meer wil.
   ========================================================================== */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const WORTEL = path.join(__dirname, '..', '..');

/* ---------------------------------------------------------------- gebieden */
/* De grenzen zijn PADEN en geen gevoel; ze staan hier zodat je ze kunt lezen en
   betwisten. Een gebied dat ontbreekt valt onder `algemeen` en krijgt dus de
   zachte eis -- wie een nieuw geldpad maakt en het hier vergeet, verliest de
   harde nul. Daarom noemt de keuring de drie bij naam. */
const GEBIEDEN = [
  ['identity', [/^server\/accounts\//, /^server\/accounts\.js$/, /^server\/kern\/paspoort/,
    /^server\/kern\/rtgid/, /^server\/routes\/auth\//, /^server\/kern\/identiteit/,
    /^server\/kern\/vakbewijs/, /^server\/kern\/persoonseis/]],
  ['money', [/^server\/kern\/pay\//, /^server\/kern\/commercie\//, /^server\/kern\/geld/,
    /^server\/routes\/bank/, /^server\/routes\/betaal/, /^server\/routes\/member\/betalen/,
    /^server\/kern\/facturatie/, /^server\/kern\/tegoed/]],
  ['security', [/^server\/middleware\//, /^server\/kern\/bevoegdheid\//, /^server\/rem\.js$/,
    /^server\/kern\/beveiliging\//, /^server\/kern\/stuur\//, /^server\/schild/]]
];

function gebiedVan(rel) {
  for (const [naam, patronen] of GEBIEDEN) {
    for (const p of patronen) if (p.test(rel)) return naam;
  }
  return 'algemeen';
}

/* ------------------------------------------------------------- commentaar */
/* ÉÉN ANTWOORD OP ÉÉN PLEK. De blokstaat wordt meegelopen omdat een kop in dit
   huis over tien regels doorloopt en zo'n vervolgregel zichzelf niet verraadt.
   Levert [regelnummer, tekst] van alleen de CODEregels. */
const COMMENTAARREGEL = /^\s*(?:\/\/|\*|\/\*|\*\/)/;

function codeRegelsUit(bron) {
  const uit = [];
  let inBlok = false;
  const regels = bron.split('\n');
  for (let i = 0; i < regels.length; i++) {
    const r = regels[i];
    if (inBlok) { if (r.includes('*/')) inBlok = false; continue; }
    if (r.includes('/*') && !r.includes('*/')) { inBlok = true; continue; }
    if (COMMENTAARREGEL.test(r)) continue;
    if (!r.trim()) continue;
    uit.push([i + 1, r]);
  }
  return uit;
}

/* ------------------------------------------------------------------ kanten */
const REQUIRE_RE = /require\(\s*(['"])([^'"]+)\1\s*\)/g;
const SAMEN_RE = /require\(\s*(['"])([^'"]+)\1\s*\+\s*([A-Za-z_$][\w$]*)\s*\)/g;
const JOIN_RE = /require\(\s*path\.join\(\s*[^,)]+,\s*(['"])([^'"]+)\1\s*\)\s*\)/g;
const LIJST_RE = /(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*\[([^\]]*)\]/g;
const SAMENGESTELD_RE = /require\(\s*[^'")\s]/;

/* LEZEN IS OOK EEN KANT. Een require is niet de enige manier waarop een bestand
   van een ander afhangt: de keuringen lezen WERELDLIJST.md, de schermtoetsen
   openen .html-pagina's, en de ratelregisters worden met readFileSync
   binnengehaald. Zonder deze kanten zou een gewijzigde WERELDLIJST.md nergens
   aankomen, en zou de planner de keuring die hem leest laten erven -- een
   overgeslagen bewijs, en precies de stille soort.

   RUIM EN NIET SCHERP. Elke letterlijke tekst die eruitziet als een bestandsnaam
   met een gegevens-extensie telt mee, ook als hij in een melding staat. Dat
   levert kanten op die er niet zijn, en dat maakt de graaf ruimer -- de veilige
   kant. Wat het NIET oplevert is een samengesteld pad; dat blijft onbekend, met
   alle gevolgen die par. 0 daaraan verbindt. */
const LEES_RE = /['"`]([\w./-]+\.(?:md|json|html?|css|txt|ya?ml|svg))['"`]/g;

function los(vanaf, spec) {
  if (!spec.startsWith('.')) return null;
  const basis = path.resolve(path.dirname(vanaf), spec);
  for (const k of [basis, basis + '.js', path.join(basis, 'index.js')]) {
    try { if (fs.statSync(k).isFile()) return k; } catch (e) { /* volgende */ }
  }
  return null;
}

function letterlijkeLijsten(bron) {
  const uit = new Map();
  LIJST_RE.lastIndex = 0;
  let m;
  while ((m = LIJST_RE.exec(bron))) {
    const stukken = [...m[2].matchAll(/(['"])([^'"]*)\1/g)].map((x) => x[2]);
    if (stukken.length) uit.set(m[1], stukken);
  }
  return uit;
}

function lijnVan(bron, index) {
  let n = 1;
  for (let i = 0; i < index && i < bron.length; i++) if (bron[i] === '\n') n++;
  return n;
}

function vormVan(regel) {
  if (/require\(\s*path\.join\(/.test(regel)) return 'path.join met een variabele';
  if (/require\(\s*`/.test(regel)) return 'template-literal';
  if (/require\(\s*[A-Za-z_$][\w$]*\s*\)/.test(regel)) return 'kale variabele';
  if (/require\(\s*['"][^'"]*['"]\s*\+/.test(regel)) return 'voorvoegsel + uitdrukking';
  return 'onbekende vorm';
}

function redenVan(regel) {
  if (/require\(\s*path\.join\(\s*[A-Za-z_$]/.test(regel))
    return 'de map komt uit een variabele; welke bestanden erin zitten is pas op runtime bekend';
  if (/require\(\s*[A-Za-z_$][\w$]*\s*\)/.test(regel))
    return 'het pad staat in een variabele die van buiten dit bestand komt';
  if (/require\(\s*`/.test(regel))
    return 'een template-literal met een invulling die hier niet vaststaat';
  return 'de uitdrukking is pas op runtime te bepalen';
}

/* De kanten van één bestand. `bron` is de RAUWE tekst voor het vinden van
   kanten -- een require in commentaar voegt dan een kant toe die er niet is, en
   dat maakt de graaf RUIMER, wat voor een weesmeting de veilige kant is.
   `code` (de coderegels) wordt alleen gebruikt om een ONBEKENDE te noteren. */
function kantenUit(bron, code, absPad, rel) {
  const uit = { opgelost: [], benaderd: [], onbekend: [] };
  /* WELKE REGELS ZIJN AL BEANTWOORD. Zonder deze verzameling telt
     `require(path.join(root, 'server/kern/x'))` twee keer: hij wordt hieronder
     netjes OPGELOST (het tweede stuk is letterlijk), en daarna alsnog als
     onbekend genoteerd omdat de regel ook op het patroon `path.join met een
     variabele` past. Twee waarheden over dezelfde regel, en de strengste won --
     precies de meetfout waar deze hele laag tegen is gebouwd. */
  const beantwoord = new Set();
  let m;

  REQUIRE_RE.lastIndex = 0;
  while ((m = REQUIRE_RE.exec(bron))) {
    const doel = los(absPad, m[2]);
    if (doel) {
      uit.opgelost.push(path.relative(WORTEL, doel).replace(/\\/g, '/'));
      beantwoord.add(lijnVan(bron, m.index));
    }
  }

  JOIN_RE.lastIndex = 0;
  while ((m = JOIN_RE.exec(bron))) {
    const doel = los(path.join(WORTEL, 'x.js'), './' + m[2]);
    if (doel) {
      uit.opgelost.push(path.relative(WORTEL, doel).replace(/\\/g, '/'));
      beantwoord.add(lijnVan(bron, m.index));
    }
  }

  const lijsten = letterlijkeLijsten(bron);
  SAMEN_RE.lastIndex = 0;
  while ((m = SAMEN_RE.exec(bron))) {
    const eigen = lijsten.get(m[3]);
    const kandidaten = eigen || [...lijsten.values()].flat();
    if (!kandidaten.length) continue;
    const geraakt = [];
    for (const w of kandidaten) {
      const doel = los(absPad, m[2] + w);
      if (doel) geraakt.push(path.relative(WORTEL, doel).replace(/\\/g, '/'));
    }
    uit.benaderd.push({
      bestand: rel, lijn: lijnVan(bron, m.index),
      vorm: eigen ? 'voorvoegsel + eigen lijst' : 'voorvoegsel + lijst uit ditzelfde bestand',
      voorvoegsel: m[2], kandidaten: geraakt.sort(),
      grens: geraakt.length ? null : 'subtree(' + m[2] + '**)'
    });
  }

  LEES_RE.lastIndex = 0;
  while ((m = LEES_RE.exec(bron))) {
    const naam = m[1];
    if (naam.startsWith('node_modules')) continue;
    for (const k of [path.resolve(path.dirname(absPad), naam), path.join(WORTEL, naam)]) {
      let goed = false;
      try { goed = fs.statSync(k).isFile(); } catch (e) { /* volgende */ }
      if (!goed) continue;
      const rel2 = path.relative(WORTEL, k).replace(/\\/g, '/');
      if (rel2.startsWith('..')) break;
      uit.opgelost.push(rel2);
      break;
    }
  }

  if (!uit.benaderd.length) {
    for (const [lijn, r] of code) {
      if (beantwoord.has(lijn)) continue;          // deze regel is al opgelost
      if (!SAMENGESTELD_RE.test(r)) continue;
      uit.onbekend.push({ bestand: rel, lijn, vorm: vormVan(r),
        code: r.trim().slice(0, 90), reden: redenVan(r) });
    }
  }
  return uit;
}

/* ------------------------------------------------------------------- index */

/* WELKE BESTANDEN KOMEN IN DE INDEX. Niet alleen .js: een gewijzigd bestand dat
   hier niet in staat, maakt elke impactvraag onbeantwoordbaar (zie risico.js,
   `onvolledig`). Van 2555 gewijzigde bestanden in de samenvoegtak vielen er
   zo 374 buiten beeld -- werkstromen, documenten, registers, schermen -- en dan
   staat er terecht ONBETROUWBAAR onder elk oordeel, maar valt er ook niets meer
   te winnen. Binaire bestanden blijven eruit; die worden niet gelezen als tekst
   en veranderen zelden. */
const TEKST_RE = /\.(?:js|mjs|cjs|json|md|html?|css|txt|ya?ml|svg|sh)$/i;
/* Bestanden zonder extensie die er wel toe doen. Zonder deze lijst valt de
   Node-versie -- die de houdbaarheid van elk bewijs bepaalt -- buiten de index,
   en dan is elk oordeel over een tak die hem aanraakt onbetrouwbaar. */
const NAAM_OK = new Set(['Dockerfile', '.nvmrc', '.dockerignore', 'Procfile']);
const telt = (naam) => TEKST_RE.test(naam) || NAAM_OK.has(naam);
const CODE_RE = /\.(?:js|mjs|cjs)$/i;

function loop(map, uit) {
  let rij;
  try { rij = fs.readdirSync(map, { withFileTypes: true }); } catch (e) { return uit; }
  for (const n of rij) {
    const p = path.join(map, n.name);
    if (n.isDirectory()) { if (n.name !== 'node_modules' && n.name !== 'dist') loop(p, uit); }
    else if (telt(n.name)) uit.push(p);
  }
  return uit;
}

/* DE ENE RONDE. Alles hieronder komt uit precies één readdir-wandeling en één
   readFileSync per bestand. */
function index(mappen) {
  const paden = [];
  for (const m of mappen || ['server']) {
    /* '.' betekent: de losse bestanden IN de wortel, en niet de hele boom --
       daar staan de ratelregisters en de merkdocumenten. */
    if (m === '.') {
      for (const n of fs.readdirSync(WORTEL, { withFileTypes: true })) {
        if (!n.isDirectory() && telt(n.name)) paden.push(path.join(WORTEL, n.name));
      }
      continue;
    }
    loop(path.join(WORTEL, m), paden);
  }

  const bestanden = new Map();
  for (const abs of paden) {
    let bron;
    try { bron = fs.readFileSync(abs, 'utf8'); } catch (e) { continue; }
    const rel = path.relative(WORTEL, abs).replace(/\\/g, '/');
    const isCode = CODE_RE.test(rel);
    const code = isCode ? codeRegelsUit(bron) : [];
    bestanden.set(rel, {
      pad: rel, abs,
      hash: crypto.createHash('sha256').update(bron).digest('hex').slice(0, 16),
      bytes: Buffer.byteLength(bron),
      codeBytes: code.reduce((a, [, r]) => a + Buffer.byteLength(r) + 1, 0),
      gebied: gebiedVan(rel),
      code,
      bron,
      soort: isCode ? 'code' : 'tekst',
      kanten: isCode ? kantenUit(bron, code, abs, rel)
        : { opgelost: [], benaderd: [], onbekend: [] }
    });
  }

  /* De graaf en zijn omkering. De omgekeerde is wat een impactvraag nodig heeft:
     van een gewijzigd bestand naar iedereen die het inlaadt. */
  const graaf = new Map(), omgekeerd = new Map();
  for (const [rel, b] of bestanden) {
    const doelen = [...new Set(b.kanten.opgelost)];
    graaf.set(rel, doelen);
    for (const d of doelen) {
      if (!omgekeerd.has(d)) omgekeerd.set(d, []);
      omgekeerd.get(d).push(rel);
    }
    for (const ben of b.kanten.benaderd) {
      for (const k of ben.kandidaten) {
        if (!omgekeerd.has(k)) omgekeerd.set(k, []);
        omgekeerd.get(k).push(rel);
      }
    }
  }

  return { bestanden, graaf, omgekeerd, gebiedVan, WORTEL };
}

module.exports = { index, gebiedVan, TEKST_RE, CODE_RE, codeRegelsUit, kantenUit, los, vormVan, redenVan, GEBIEDEN };
