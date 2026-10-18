#!/usr/bin/env node
'use strict';
/* HET DEKKINGSGAT -- wat de vloer NIET ziet, naast wat hij wel ziet.

   De dekkingsvloer (scripts/dekkingsvloer.js) rekent over de bestanden die in
   de opgetelde lcov staan, en een bestand komt daar alleen in als een Node-
   toetsproces het laadt. Wat alleen in de browser draait (public/), wat als
   eigen proces wordt gestart en met SIGKILL stopt, en tooling die geen toets
   aanraakt, staat er dus niet in: niet als 0%, maar helemaal niet. Het
   percentage van de vloer is daarmee een percentage van een KLEINER universum
   dan de broncode.

   BESLUIT VAN DE EIGENAAR (14 oktober 2026): eerst meten, dan beslissen. Dit
   script verandert de vloer niet, niet de drempel, niet de teller en niet de
   noemer. Het legt naast het getal van de vloer twee getallen die er tot nu
   toe niet stonden: hoeveel productiebestanden buiten de meting vallen, en hoe
   groot ze ongeveer zijn.

   WAT HET TELT. Kandidaten zijn de bestanden die git kent onder server/,
   public/ en scripts/ met .js, .mjs of .cjs, behalve server/data/. Gemeten is
   een bestand als het met een SF:-regel in een van de lcov-bestanden staat.

   DE OMVANG IS EEN SCHATTING. Node telt in zijn lcov elke bronregel als DA-
   regel (ook lege en commentaar; nagemeten: DA-telling == wc -l). Het aantal
   regels van een ongemeten bestand is dus wat het in de noemer zou wegen als
   het geladen werd. Wat er dan GEDEKT zou zijn, is onbekend: de ondergrens
   hieronder rekent alsof het niets is, en dat is te somber, want laden alleen
   dekt de declaraties al. Takken en functies schat dit script niet; die zijn
   zonder te laden niet te tellen.

   GEEN POORT. Exitcode is altijd 0: dit is een rapport, en het besluit over
   wat ermee moet ligt bij de eigenaar.

   Draai:  node scripts/dekkingsgat.js [map]   (standaard dekking-scherven)
           node scripts/dekkingsgat.js map --json
   ========================================================================== */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { voegSamen, tel } = require('./lib/lcov');

const WORTEL = path.join(__dirname, '..');
const BRONMAPPEN = ['server', 'public', 'scripts'];
const UITGESLOTEN = ['server/data/'];

/* Een productiebestand? Alleen JavaScript onder de drie bronmappen. */
function isKandidaat(pad) {
  const p = String(pad).replace(/\\/g, '/');
  if (!/\.(?:js|mjs|cjs)$/.test(p)) return false;
  if (!BRONMAPPEN.some((m) => p.startsWith(m + '/'))) return false;
  return !UITGESLOTEN.some((u) => p.startsWith(u));
}

/* De SF-paden uit de opgetelde lcov, genormaliseerd naar een pad vanaf de wortel. */
function gemetenPaden(samen, wortel) {
  const uit = new Set();
  for (const pad of samen.keys()) {
    const p = path.isAbsolute(pad) ? path.relative(wortel || WORTEL, pad) : pad;
    uit.add(p.replace(/\\/g, '/'));
  }
  return uit;
}

/* De groep waar een bestand onder valt: twee niveaus diep, en onder
   public/apps drie, want daar staat elke app in een eigen map. */
function groepVan(pad) {
  const d = pad.split('/');
  const diepte = d[0] === 'public' && d[1] === 'apps' ? 3 : 2;
  return d.length > diepte ? d.slice(0, diepte).join('/') : d.slice(0, -1).join('/') || d[0];
}

function regelsVan(wortel, pad) {
  try {
    const t = fs.readFileSync(path.join(wortel, pad), 'utf8');
    if (!t) return 0;
    return t.split('\n').length - (t.endsWith('\n') ? 1 : 0);
  } catch (e) { return 0; }
}

/* Het rapport zelf, zonder schijf- of git-toegang buiten de regeltelling. */
function rapport({ kandidaten, teksten, wortel, regels }) {
  const telRegels = regels || ((p) => regelsVan(wortel || WORTEL, p));
  const samen = voegSamen(teksten || []);
  const meting = tel(samen);
  const gemeten = gemetenPaden(samen, wortel);
  const productie = kandidaten.filter(isKandidaat).sort();
  const bekend = new Set(productie);
  const groepen = new Map();
  const ongemeten = [];
  for (const p of productie) {
    if (gemeten.has(p)) continue;
    const n = telRegels(p);
    ongemeten.push({ pad: p, regels: n });
    const g = groepen.get(groepVan(p)) || { groep: groepVan(p), bestanden: 0, regels: 0 };
    g.bestanden++; g.regels += n;
    groepen.set(g.groep, g);
  }
  const extraRegels = ongemeten.reduce((s, o) => s + o.regels, 0);
  const noemer = meting.regels.totaal + extraRegels;
  const pct = (h, f) => (f === 0 ? 100 : Math.round((h / f) * 10000) / 100);
  return {
    meting: { bestanden: meting.bestanden, regels: meting.regels,
      buitenKandidaten: [...gemeten].filter((p) => !bekend.has(p)).length },
    ongemeten: { bestanden: ongemeten.length, regels: extraRegels, lijst: ongemeten },
    groepen: [...groepen.values()].sort((a, b) => b.bestanden - a.bestanden || b.regels - a.regels),
    ondergrens: { gedekt: meting.regels.gedekt, totaal: noemer, pct: pct(meting.regels.gedekt, noemer) },
    aandeelOngemeten: pct(extraRegels, noemer)
  };
}

function kandidatenUitGit(wortel) {
  const uit = execFileSync('git', ['ls-files', '-z', '--', ...BRONMAPPEN],
    { cwd: wortel, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  return uit.split('\0').filter(Boolean);
}

function leesMap(map) {
  return fs.readdirSync(map).filter((n) => /\.(?:info|lcov)$/.test(n)).sort()
    .map((n) => fs.readFileSync(path.join(map, n), 'utf8'));
}

function tekst(r, map) {
  const fmt = (n) => n.toLocaleString('nl-NL');
  const rgl = [];
  rgl.push('', '=== Het dekkingsgat: wat de vloer niet ziet (rapport, geen poort) ===', '');
  rgl.push('  meting: ' + map);
  rgl.push('  in de meting:       ' + fmt(r.meting.bestanden) + ' bestanden, regels ' +
    r.meting.regels.pct + '% (' + fmt(r.meting.regels.gedekt) + '/' + fmt(r.meting.regels.totaal) + ')  <- het getal van de vloer');
  rgl.push('    waarvan geen productiebestand in git (blijft in de noemer): ' + fmt(r.meting.buitenKandidaten));
  rgl.push('  NIET in de meting:  ' + fmt(r.ongemeten.bestanden) + ' productiebestanden, ~' +
    fmt(r.ongemeten.regels) + ' regels (schatting: wc -l, zoals Node DA-regels telt)');
  rgl.push('  ondergrens regels als het ongemeten deel 0% zou zijn: ' + r.ondergrens.pct + '% (' +
    fmt(r.ondergrens.gedekt) + '/' + fmt(r.ondergrens.totaal) + '); ongemeten aandeel ' + r.aandeelOngemeten + '%');
  rgl.push('  takken en functies: niet geschat (zonder laden niet te tellen)', '');
  rgl.push('  per map (bestanden, ~regels):');
  for (const g of r.groepen) {
    rgl.push('    ' + String(g.bestanden).padStart(5) + '  ' + String('~' + fmt(g.regels)).padStart(9) + '  ' + g.groep);
  }
  rgl.push('', '  De vloer, de drempel, de teller en de noemer blijven ongewijzigd (besluit eigenaar).', '');
  return rgl.join('\n');
}

function main(argv) {
  const json = argv.includes('--json');
  const map = argv.find((a) => !a.startsWith('--')) || path.join(WORTEL, 'dekking-scherven');
  try {
    const teksten = leesMap(map);
    const r = rapport({ kandidaten: kandidatenUitGit(WORTEL), teksten, wortel: WORTEL });
    if (!teksten.length) console.log('Geen lcov-bestanden in ' + map + '; er valt niets naast te leggen.');
    else if (json) console.log(JSON.stringify({ ...r, ongemeten: { ...r.ongemeten, lijst: undefined } }, null, 2));
    else console.log(tekst(r, map));
    const samenvatting = process.env.GITHUB_STEP_SUMMARY;
    if (samenvatting && teksten.length) {
      fs.appendFileSync(samenvatting, '### Dekkingsgat (rapport, geen poort)\n\n' +
        '- in de meting: ' + r.meting.bestanden + ' bestanden, regels ' + r.meting.regels.pct + '%\n' +
        '- niet in de meting: ' + r.ongemeten.bestanden + ' bestanden, ~' + r.ongemeten.regels + ' regels (schatting)\n' +
        '- ondergrens regels met het ongemeten deel op 0%: ' + r.ondergrens.pct + '%\n\n');
    }
  } catch (e) {
    console.log('Het dekkingsgat is niet te meten: ' + e.message + ' (rapport, geen poort: exit 0)');
  }
  return 0;
}

if (require.main === module) process.exitCode = main(process.argv.slice(2));
module.exports = { isKandidaat, gemetenPaden, groepVan, regelsVan, rapport };
