#!/usr/bin/env node
/* ============================================================================
   HOE LANG DOET ELKE TOETS EROVER? -- het gewicht onder de scherfverdeling.

   WAAROM DIT ER IS

   De vier toetsscherven verdeelden zich op VOLGORDE en niet op tijd, en de
   traagste scherf is in zijn eentje het kritieke pad van de hele keten. Gemeten
   op main (run 33404735353): 1336 / 548 / 501 / 577 seconden, terwijl een
   gelijke verdeling ~740 per scherf geeft.

   scripts/lib/delen.js weegt sinds 1 september 2026 op de duur uit dit
   register. Dit script schrijft het, uit een echte meting.

   HOE DE METING TOT STAND KOMT. test/toetsnaam.js wordt in elk toetsproces
   voorgeladen en schrijft bij het aflopen een regel `bestand<TAB>ms` naar
   RTG_TOETSDUUR. Dat proces IS het toetsbestand, dus zijn looptijd is precies
   de gevraagde grootheid -- en daarmee is dit geen schatting uit een logstroom
   maar de klok van de machine die hem draaide.

   DE MEDIAAN, NIET HET GEMIDDELDE EN NIET DE LAATSTE. Een runner die een keer
   wegzakt levert een uitschieter van minuten; een gemiddelde neemt die mee en
   een laatste-waarde laat hem het register overschrijven. De mediaan over alle
   waarnemingen van een bestand negeert hem. Wie de spreiding wil zien: die
   staat er per bestand bij (`n`, `min`, `max`).

   WAT DIT REGISTER NIET IS. Geen norm en geen poort. Een bestand dat trager
   wordt is hier geen fout maar een ander gewicht; wie een trage toets wil
   bewaken heeft NORM.json. En een bestand dat ONTBREEKT is geen nul maar
   ongemeten -- delen.js legt die om en om neer, precies zoals vroeger.

   DRAAIEN

     npm test                     schrijft .toetsduur (de ruwe meting)
     node scripts/toetsduur.js    toont wat die meting zegt
     node scripts/toetsduur.js --schrijf          werkt TOETSDUUR.json bij
     node scripts/toetsduur.js --lees a --lees b  meerdere metingen samen
   ========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');

const WORTEL = path.join(__dirname, '..');
const REGISTER = path.join(WORTEL, 'TOETSDUUR.json');

/* Per MODUS een eigen verzameling. Een waarneming zonder modus heet `onbekend`
   en komt nooit bij een van de twee terecht -- zie de kop van test/toetsnaam.js:
   dat samenvoegen is precies de fout die dit register moest oplossen. */
function lees(paden) {
  const perModus = new Map();
  let regels = 0, verminkt = 0;
  for (const p of paden) {
    let tekst = '';
    try { tekst = fs.readFileSync(p, 'utf8'); } catch (e) { continue; }
    for (const regel of tekst.split('\n')) {
      if (!regel.trim()) continue;
      regels++;
      const [naam, ms, modus, bron] = regel.split('\t');
      const n = Number(ms);
      /* Een half geschreven regel (twee processen tegelijk) telt niet mee en
         laat het bestand dus ongemeten -- de veilige kant. */
      if (!naam || !/\.(test|e2e)\.js$/.test(naam) || !Number.isFinite(n) || n < 0) { verminkt++; continue; }
      const m = modus || 'onbekend';
      if (!perModus.has(m)) perModus.set(m, new Map());
      const per = perModus.get(m);
      if (!per.has(naam)) per.set(naam, []);
      per.get(naam).push({ ms: Math.round(n), bron: bron || 'onbekend' });
    }
  }
  return { perModus, regels, verminkt };
}

const mediaan = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
};

/* De p90 staat erbij en wordt NIET als gewicht gebruikt. Hij zegt iets anders
   dan de mediaan: hoe erg het kan uitpakken. Een bestand met mediaan 20s en
   p90 200s is geen bestand van 20s -- wie dat verschil niet ziet, plant een
   scherf die een op de tien rondes uitloopt zonder dat iemand weet waarom. */
const p90 = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.ceil(s.length * 0.9) - 1)];
};

/* De bestanden die er NU zijn. Een register dat namen bewaart van toetsen die
   niet meer bestaan, weegt met spoken; delen.js zou ze nooit tegenkomen, maar
   het register zou blijven groeien en niemand zou meer zien wat er echt in
   staat. */
function opSchijf() {
  return new Set(fs.readdirSync(path.join(WORTEL, 'test'))
    .filter((n) => /\.(test|e2e)\.js$/.test(n)));
}

function stempelNu() {
  const stempel = {
    op: new Date().toISOString(),
    waar: process.env.GITHUB_ACTIONS ? 'ci' : 'lokaal',
    node: process.version,
    kernen: require('os').cpus().length
  };
  try {
    stempel.commit = require('child_process')
      .execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: WORTEL, encoding: 'utf8' }).trim();
  } catch (e) { /* zonder git ook goed */ }
  return stempel;
}

/* Een bron is de omgeving waarin EEN waarneming is gedaan, zoals de loper hem
   meeschreef: `waar|node|kernen|commit`. Hij staat een keer in een tabel en de
   bestanden verwijzen ernaar -- veertienhonderd keer dezelfde runnerregel
   uitschrijven maakt het register vier keer zo groot zonder er iets aan toe te
   voegen. */
function ontleedBron(tekst) {
  const [waar, node, kernen, commit] = String(tekst || '').split('|');
  if (!waar || waar === 'onbekend') return { waar: 'onbekend' };
  return { waar, node: node || null, kernen: Number(kernen) || null, commit: commit || null };
}

function bouwModus(per, bestaand, bestaat) {
  const duur = {}, spreiding = {};
  /* Wat er al stond blijft staan zolang het bestand bestaat: een ronde die maar
     een KWART van de suite draaide (een scherf) mag de andere drie kwarten niet
     uit het register vegen. */
  for (const [naam, waarde] of Object.entries((bestaand || {}).duur || {})) {
    if (bestaat.has(naam)) duur[naam] = waarde;
  }
  for (const [naam, waarde] of Object.entries((bestaand || {}).spreiding || {})) {
    if (bestaat.has(naam)) spreiding[naam] = waarde;
  }
  const bronnen = Object.assign({}, (bestaand || {}).bronnen || {});

  let vers = 0;
  for (const [naam, waarnemingen] of (per || new Map())) {
    if (!bestaat.has(naam)) continue;
    const ms = waarnemingen.map((w) => w.ms);
    duur[naam] = mediaan(ms);
    const gezien = [...new Set(waarnemingen.map((w) => w.bron))].sort();
    for (const b of gezien) if (!bronnen[b]) bronnen[b] = ontleedBron(b);
    spreiding[naam] = { n: ms.length, min: Math.min(...ms), max: Math.max(...ms),
      p90: p90(ms), bronnen: gezien, gemetenOp: new Date().toISOString().slice(0, 10) };
    vers++;
  }

  const namen = Object.keys(duur).sort();
  const g = {}, gs = {};
  for (const n of namen) { g[n] = duur[n]; if (spreiding[n]) gs[n] = spreiding[n]; }
  /* Alleen bronnen die nog ergens naar verwezen worden. */
  const inGebruik = new Set();
  for (const n of namen) for (const b of ((gs[n] || {}).bronnen || [])) inGebruik.add(b);
  const bg = {};
  for (const b of [...inGebruik].sort()) bg[b] = bronnen[b] || ontleedBron(b);

  return {
    stempel: vers ? stempelNu() : ((bestaand || {}).stempel || null),
    gemeten: {
      bestanden: namen.length,
      ongemeten: bestaat.size - namen.length,
      verseWaarnemingen: vers,
      totaalMs: namen.reduce((s2, n) => s2 + g[n], 0)
    },
    bronnen: bg,
    duur: g,
    spreiding: gs
  };
}

function bouw(paden, bestaand) {
  const { perModus, regels, verminkt } = lees(paden);
  const bestaat = opSchijf();

  /* Versie 1 kende geen modi en droeg zijn duur in de top. Die metingen zijn
     echt, maar van WELKE modus weet niemand meer -- ze verhuizen dus naar
     `onbekend` en niet naar een van de twee. Een gok hier is precies de fout
     die dit formaat moest wegnemen. */
  const oudeModi = (bestaand && bestaand.modi) ? bestaand.modi
    : (bestaand && bestaand.duur ? { onbekend: { duur: bestaand.duur, spreiding: bestaand.spreiding,
        stempel: bestaand.stempel } } : {});

  const namen = [...new Set([...Object.keys(oudeModi), ...perModus.keys()])].sort();
  const modi = {};
  for (const m of namen) {
    const uit = bouwModus(perModus.get(m), oudeModi[m], bestaat);
    if (uit.gemeten.bestanden) modi[m] = uit;
  }

  return {
    versie: 2,
    uitleg: 'Hoe lang elk toetsbestand erover deed, als gewicht voor de ' +
      'scherfverdeling in scripts/lib/delen.js. PER MODUS, want met dekking aan ' +
      'is dezelfde toets een ander kostenmodel -- niet een uitschieter. Mediaan ' +
      'over alle waarnemingen; de p90 staat erbij en weegt niet mee. Een bestand ' +
      'dat hier NIET in staat is ongemeten en wordt om en om verdeeld -- nooit ' +
      'overgeslagen.',
    hoe: 'npm test (schrijft .toetsduur), daarna: node scripts/toetsduur.js --schrijf',
    gelezen: { regels, verminkt, opSchijf: bestaat.size, modi: namen },
    modi
  };
}

/* Wat zou de verdeling worden? Dit is de hele reden dat het register bestaat,
   dus hoort hij ook hier af te lezen te zijn -- niet alleen in CI.

   EN HIJ REKENT OVER DEZELFDE VERZAMELING ALS DE KETEN, want anders is de
   afdruk een ander getal met dezelfde naam. De scherven draaien de NIET
   -geisoleerde bestanden (scripts/lib/geisoleerd.js) en laten de ijkingen weg
   (--zonder-ijkingen); die krijgen elk een eigen job. Zonder die twee filters
   telde meterijk.test.js hier mee met 864 seconden -- veertien minuten die in
   geen enkele scherf zitten, en dus een verdeling die nergens over gaat. */
function toonVerdeling(modus, totaal) {
  const { indeling, zetDuren } = require('./lib/delen');
  const { isGeisoleerd } = require('./lib/geisoleerd');
  const uit = modus;
  /* MET HETZELFDE VERTROUWEN ALS DE KETEN, anders toont deze afdruk een
     verdeling die niemand draait. `onbekend` is voor de planner een ANDERE
     modus en krijgt dus de marge; wie dat hier weglaat, laat een register er
     beter uitzien dan het is. */
  zetDuren(uit.duur, uit.naam === 'onbekend' ? 'twijfelachtig' : 'geldig');
  try {
    const alle = [...opSchijf()].filter((n) => n.endsWith('.test.js'))
      .filter((n) => !isGeisoleerd(n)).sort();
    const bakken = indeling(alle, totaal);
    const som = (b) => b.reduce((s, n) => s + (uit.duur[n] || 0), 0);
    const lasten = bakken.map(som);
    const ideaal = lasten.reduce((a, b) => a + b, 0) / totaal;
    console.log('\n  de verdeling over ' + totaal + ' scherven ' +
      '(zoals de keten hem draait: zonder de geisoleerde bestanden en de ijkingen):');
    bakken.forEach((b, i) => console.log('    scherf ' + (i + 1) + '  ' +
      String(b.length).padStart(4) + ' bestanden  ' +
      (lasten[i] / 1000).toFixed(0).padStart(6) + 's' +
      (ideaal ? '  (' + (lasten[i] / ideaal).toFixed(2) + 'x ideaal)' : '')));
    if (ideaal) console.log('    ideaal    ' + ' '.repeat(4) + '             ' +
      (ideaal / 1000).toFixed(0).padStart(6) + 's');
  } finally { zetDuren(null); }
}

function main() {
  const paden = [];
  for (let i = 2; i < process.argv.length; i++) {
    if (process.argv[i] === '--lees') paden.push(path.resolve(WORTEL, process.argv[++i]));
  }
  if (!paden.length) paden.push(path.join(WORTEL, '.toetsduur'));

  let bestaand = null;
  try { bestaand = JSON.parse(fs.readFileSync(REGISTER, 'utf8')); } catch (e) { /* eerste keer */ }

  const aanwezig = paden.filter((p) => fs.existsSync(p));
  if (!aanwezig.length && !bestaand) {
    console.error('\n  Geen meting (' + paden.join(', ') + ') en geen register.' +
      '\n  Draai eerst `npm test`; die schrijft .toetsduur.\n');
    return 2;
  }

  const uit = bouw(aanwezig, bestaand);
  const gl = uit.gelezen;
  console.log('\nTOETSDUUR  (' + gl.regels + ' waarnemingen uit ' + aanwezig.length + ' meting(en))\n');
  console.log('  toetsbestanden op schijf ' + String(gl.opSchijf).padStart(5));
  if (gl.verminkt) console.log('  verminkte regels         ' + String(gl.verminkt).padStart(5) +
    '   -> die bestanden blijven ongemeten');

  const namen = Object.keys(uit.modi);
  if (!namen.length) console.log('\n  Geen enkele modus heeft een gewicht.');
  for (const m of namen) {
    const M = uit.modi[m];
    const st = M.stempel || {};
    console.log('\n  ---- modus ' + m + (m === 'onbekend'
      ? '   (uit een register van voor de modi -- telt als een ANDERE modus)' : ''));
    console.log('    met een gewicht        ' + String(M.gemeten.bestanden).padStart(5));
    console.log('    ongemeten              ' + String(M.gemeten.ongemeten).padStart(5) +
      (M.gemeten.ongemeten ? '   -> om en om verdeeld, nooit overgeslagen' : ''));
    console.log('    samen                  ' + (M.gemeten.totaalMs / 1000).toFixed(0).padStart(5) + 's');
    console.log('    gemeten                ' + (st.waar || '?') + ' / ' + (st.node || '?') +
      ' / ' + (st.kernen || '?') + ' kernen' + (st.commit ? ' / ' + st.commit : ''));
    toonVerdeling(Object.assign({ naam: m }, M), 4);
  }

  if (process.argv.includes('--schrijf')) {
    fs.writeFileSync(REGISTER, JSON.stringify(uit, null, 1) + '\n');
    console.log('\n  geschreven: TOETSDUUR.json\n');
  } else {
    console.log('\n  (niets geschreven; gebruik --schrijf)\n');
  }
  return 0;
}

if (require.main === module) process.exit(main());
module.exports = { lees, bouw, mediaan, p90, ontleedBron, REGISTER };
