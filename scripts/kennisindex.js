#!/usr/bin/env node
/* ============================================================================
   DE KENNISINDEX -- wat de documenten van dit huis zeggen, voor Rahul leesbaar.

   Waarom een register en geen leesweg naar de documenten: productie krijgt
   geen enkel .md mee (.dockerignore), en de runtime-AI leest registers en nooit
   iets anders (CODE-AI-001). Dit script knipt de documenten daarom op in
   stukken per kop en legt ze vast in KENNISINDEX.json; de registerblik
   (server/kern/registerblik/kennis.js) zoekt daarin met een woordindex.

   WAT DE INDEX IS EN WAT NIET. Een document is een BEWERING: een besluit, een
   voornemen, een meting van een dag. Wat erin staat krijgt daarom de graad
   `vermoed`, en de registerblik zegt erbij welke registers het stuk noemt --
   daar staat de huidige werkelijkheid. Er zijn geen embeddings: 150
   documenten zijn geen corpus dat daarom vraagt, en een woordindex is uit te
   leggen en te beproeven.

   WAT ER NIET IN KOMT, met de reden in het register zelf: afdrukken die een
   script uit een register schrijft (BEWIJS.md, FUNCTIES.md, ...). Die zeggen
   niets wat het register zelf niet zegt, en een afdruk van een getal naast het
   getal is twee waarheden.

   Draai:  node scripts/kennisindex.js            (schrijft KENNISINDEX.json)
           node scripts/kennisindex.js --droog    (telt alleen)
   ========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const cp = require('child_process');
const { stempel } = require('./lib/stempel');
/* De getal-merktekens hebben EEN eigenaar (scripts/getallen.js); hier wordt
   zijn patroon gebruikt en niet nageschreven, anders zijn er twee. */
const { MERK } = require('./getallen');

const WORTEL = path.join(__dirname, '..');
const DOEL = path.join(WORTEL, 'KENNISINDEX.json');
const MAX_STUK = 1800;

/* Afdrukken: een script schrijft ze uit een register. */
const AFDRUKKEN = new Set(['BEWIJS.md', 'FUNCTIES.md', 'GROEPEN.md', 'ARCHITECTUUR.md', 'WERELDLIJST.md',
  'BUNDELS.md', 'DOCTRINE-IJKING.md', 'SLO.md', 'BELOFTE.md']);
const AFDRUKKOP = /automatisch geschreven|niet met de hand bijwerken|niet met de hand wijzigen/i;

function documenten() {
  const uit = fs.readdirSync(WORTEL).filter(f => f.endsWith('.md')).sort()
    .concat(fs.readdirSync(path.join(WORTEL, 'docs')).filter(f => f.endsWith('.md')).sort().map(f => 'docs/' + f));
  return uit;
}

function gewijzigd(rel) {
  const r = cp.spawnSync('git', ['log', '-1', '--format=%cs', '--', rel], { cwd: WORTEL, encoding: 'utf8' });
  return r.status === 0 && r.stdout.trim() ? r.stdout.trim() : null;
}

/* Knip op koppen, en een te lange sectie op alinea's. De kop reist mee als pad
   ("H1 > H2"), zodat een los stuk nog zegt waar het staat. */
function knip(tekst) {
  const regels = tekst.replace(new RegExp(MERK.source, 'g'), '$2').split('\n');
  const stukken = [];
  const koppen = [];
  let buf = [];
  let start = 1;
  const sluit = () => {
    const t = buf.join('\n').trim();
    if (t) {
      const kop = koppen.filter(Boolean).join(' > ');
      let deel = '';
      let deelStart = start;
      for (const alinea of t.split(/\n{2,}/)) {
        if (deel && deel.length + alinea.length > MAX_STUK) { stukken.push({ k: kop, r: deelStart, t: deel }); deel = ''; }
        deel = deel ? deel + '\n\n' + alinea : alinea;
      }
      if (deel) stukken.push({ k: kop, r: deelStart, t: deel.slice(0, MAX_STUK * 2) });
    }
    buf = [];
  };
  let inCode = false;
  regels.forEach((regel, i) => {
    if (/^```/.test(regel)) inCode = !inCode;
    const m = !inCode && /^(#{1,4})\s+(.*)$/.exec(regel);
    if (m) {
      sluit();
      koppen.length = m[1].length;
      koppen[m[1].length - 1] = m[2].replace(/[*`]/g, '').trim().slice(0, 120);
      start = i + 1;
      return;
    }
    if (!buf.length) start = i + 1;
    buf.push(regel);
  });
  sluit();
  return stukken;
}

function bouw() {
  const docs = [];
  const stukken = [];
  const overgeslagen = [];
  for (const rel of documenten()) {
    const tekst = fs.readFileSync(path.join(WORTEL, rel), 'utf8');
    if (AFDRUKKEN.has(rel) || AFDRUKKOP.test(tekst.slice(0, 600))) {
      overgeslagen.push({ pad: rel, reden: 'afdruk van een register: het register zelf is de bron' });
      continue;
    }
    const titel = (/^#\s+(.*)$/m.exec(tekst) || [])[1] || rel;
    const d = docs.length;
    docs.push({ pad: rel, titel: titel.replace(/[*`]/g, '').trim().slice(0, 160), gewijzigd: gewijzigd(rel),
      sha: crypto.createHash('sha256').update(tekst).digest('hex').slice(0, 16) });
    for (const s of knip(tekst)) stukken.push({ d, k: s.k, r: s.r, t: s.t });
  }
  return { docs, stukken, overgeslagen };
}

if (require.main === module) {
  const { docs, stukken, overgeslagen } = bouw();
  const kop = { stempel: stempel(), soort: 'gegevens',
    uitleg: 'De documenten van dit huis, opgeknipt per kop, voor de registerblik (server/kern/registerblik/kennis.js). ' +
      'Een document is een BEWERING en geen meting: wat hier staat heeft de graad vermoed, en de huidige werkelijkheid staat in de registers die een stuk noemt.',
    grens: 'Gebouwd uit de documenten op het moment van het stempel. Een document dat daarna veranderde, staat hier in zijn oude vorm; npm run kennisindex ververst hem.',
    documenten: docs.length, stukken: stukken.length, overgeslagen };
  if (process.argv.includes('--droog')) { console.log(JSON.stringify(Object.assign({}, kop, { stempel: undefined }), null, 1)); process.exit(0); }
  /* Een stuk per regel: een gewijzigd document geeft een kleine diff. */
  const regels = ['{', '  "kop": ' + JSON.stringify(kop) + ',', '  "docs": ['];
  docs.forEach((d, i) => regels.push('    ' + JSON.stringify(d) + (i < docs.length - 1 ? ',' : '')));
  regels.push('  ],', '  "stukken": [');
  stukken.forEach((s, i) => regels.push('    ' + JSON.stringify(s) + (i < stukken.length - 1 ? ',' : '')));
  regels.push('  ]', '}');
  fs.writeFileSync(DOEL, regels.join('\n') + '\n');
  console.log('KENNISINDEX.json geschreven: ' + docs.length + ' documenten, ' + stukken.length + ' stukken, ' +
    overgeslagen.length + ' afdrukken overgeslagen.');
}

module.exports = { knip, bouw, AFDRUKKEN };
