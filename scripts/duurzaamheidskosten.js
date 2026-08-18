#!/usr/bin/env node
/* ============================================================================
   WAT KOST DE DUURZAME COMMIT? -- stap 6 uit GELDLAT.md, met een getal.

   HET BESLUIT IS AL GENOMEN (GELDLAT.md, 12 augustus): geld en alles wat een lid
   zelf maakt gaan duurzaam. Deze meting is dus geen poort maar informatie. De
   vraag is niet "mag het" maar "wat kost het", en dat hoort met een gemeten
   getal beantwoord te worden in plaats van met een gevoel.

   WAAROM NIET GEWOON `npm run beproeving` TWEE KEER. Dat is een storm over
   honderden endpoints tegelijk; het effect van vier routes verdrinkt daarin, en
   de laatste vastgelegde ronde stond bovendien op een andere machine EN een
   andere opslag (darwin/postgres tegen linux/sqlite hier). LAT.md regel 10 is
   daar duidelijk over: dat vergelijk je niet. Deze proef meet daarom GEPAARD --
   dezelfde machine, dezelfde opslag, dezelfde belasting, twee keer achter
   elkaar, alleen de schakelaar ertussen.

   WAT ER GEMETEN WORDT

     duurzaam   de routes die sinds deze ronde wachten op de opslag
     controle   een schrijfroute die dat NIET doet, in dezelfde ronde

   Die controle is het halve punt. Zonder hem weet je niet of een verschil van
   de duurzaamheid komt of van de machine die toevallig druk was; loopt de
   controle even hard mee omhoog, dan meet je ruis.

   Draai:  node scripts/duurzaamheidskosten.js
           node scripts/duurzaamheidskosten.js --n=400
   ========================================================================== */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

const WORTEL = path.join(__dirname, '..');
const UITSLAG = path.join(WORTEL, 'DUURZAAMHEIDSKOSTEN.json');
const argv = process.argv.slice(2);
const N = Number((argv.find(a => a.startsWith('--n=')) || '').slice(4)) || 200;

/* De routes die de proef bestookt. `duurzaam` zegt of deze route sinds deze
   ronde op de opslag wacht; de rest is de controlegroep. */
const ROUTES = [
  { naam: 'notities/bewaar', duurzaam: true, pad: '/api/notities/bewaar',
    lijf: (i) => ({ titel: 'Meting ' + i, tekst: 'proef' }) },
  { naam: 'agenda/toevoegen', duurzaam: true, pad: '/api/agenda/toevoegen',
    lijf: (i) => ({ titel: 'Meting ' + i, datum: '2026-09-01', tijd: '10:00' }) },
  { naam: 'bestanden/map', duurzaam: true, pad: '/api/bestanden/map',
    lijf: (i) => ({ naam: 'Map ' + i }) },
  /* DE CONTROLEGROEP. Een schrijfroute die NIET door lib/duurzaam gaat, in
     dezelfde ronde en op dezelfde server. Beweegt hij mee, dan meet deze proef
     de machine en niet de commit. */
  { naam: 'zorgprofiel/zet (controle)', duurzaam: false, pad: '/api/zorgprofiel/zet',
    lijf: (i) => ({ delen: i % 2 === 0, allergieen: ['proef' + i] }) }
];

function vrijePoort() {
  const net = require('net');
  return new Promise((res, rej) => {
    const s = net.createServer(); s.unref(); s.on('error', rej);
    s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); });
  });
}

async function start(extra) {
  const poort = await vrijePoort();
  const datamap = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-kosten-'));
  const basis = 'http://127.0.0.1:' + poort;
  const kind = spawn(process.execPath, [path.join(WORTEL, 'server', 'server.js')], {
    cwd: WORTEL, stdio: 'ignore',
    env: { ...process.env, PORT: String(poort), RTG_DATA_DIR: datamap, SMTP_URL: '',
      STUN_UIT: '1', RTG_DEMO: '1', ...extra }
  });
  const eind = Date.now() + 60000;
  while (Date.now() < eind) {
    try { const r = await fetch(basis + '/api/health'); if (r.ok) return { kind, basis, datamap }; } catch (e) {}
    await new Promise(r => setTimeout(r, 200));
  }
  throw new Error('de server kwam niet op');
}
const stop = (s) => { try { s.kind.kill('SIGKILL'); } catch (e) {} try { fs.rmSync(s.datamap, { recursive: true, force: true }); } catch (e) {} };

const post = async (basis, pad, lijf, tok) => {
  const t0 = process.hrtime.bigint();
  let status = 0;
  try {
    const r = await fetch(basis + pad, { method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(tok ? { Authorization: 'Bearer ' + tok } : {}) },
      body: JSON.stringify(lijf || {}) });
    status = r.status; await r.text();
  } catch (e) { status = 0; }
  return { ms: Number(process.hrtime.bigint() - t0) / 1e6, status };
};

/* Percentielen op de RUWE metingen, niet op een histogram: bij tweehonderd
   waarden is sorteren goedkoper dan buckets, en een bucket-artefact heeft dit
   huis al een keer een verkeerde p99 gekost (LAT.md regel 10). */
function pct(rij, q) {
  if (!rij.length) return null;
  const s = rij.slice().sort((a, b) => a - b);
  return Math.round(s[Math.min(s.length - 1, Math.floor(q * s.length))] * 100) / 100;
}

async function ronde(naam, extra) {
  const s = await start(extra);
  const uit = { naam, routes: {} };
  try {
    const inlog = await fetch(s.basis + '/api/login', { method: 'POST',
      headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tier: 'rtg' }) });
    const tok = (await inlog.json()).token;
    if (!tok) throw new Error('geen token: de proef zou dan de inlogpoort meten');

    for (const r of ROUTES) {
      const tijden = [];
      const statussen = {};
      // een opwarmronde die NIET meetelt: de eerste schrijfactie op een verse
      // opslag maakt bestanden aan, en dat is geen latentie van de commit
      for (let i = 0; i < 5; i++) await post(s.basis, r.pad, r.lijf('warm' + i), tok);
      for (let i = 0; i < N; i++) {
        const a = await post(s.basis, r.pad, r.lijf(i), tok);
        statussen[a.status] = (statussen[a.status] || 0) + 1;
        if (a.status >= 200 && a.status < 300) tijden.push(a.ms);
      }
      uit.routes[r.naam] = { duurzaam: r.duurzaam, gelukt: tijden.length, statussen,
        p50: pct(tijden, 0.5), p95: pct(tijden, 0.95), p99: pct(tijden, 0.99),
        max: tijden.length ? Math.round(Math.max(...tijden) * 100) / 100 : null };
    }
  } finally { stop(s); }
  return uit;
}

/* HET OORDEEL OVER DE RONDE, apart en puur -- en dat is hier geen formaliteit.
   Deze proef kan op precies een manier liegen: als de machine tijdens de tweede
   ronde toevallig drukker was, gaat ALLES omhoog en leest dat als de prijs van
   de commit. De controlegroep is daar de test op, en die regel hoort toetsbaar
   te zijn zonder twee servers te starten (LAT.md regel 10). */
function oordeel(duurFactor, ctrlFactor) {
  if (duurFactor == null) return { blind: true, reden: 'geen enkele duurzame route leverde een meting' };
  if (ctrlFactor == null) return { blind: true, reden: 'de controlegroep leverde niets; dan is een verschil niet toe te wijzen' };
  if (ctrlFactor >= duurFactor) {
    return { blind: true, reden: 'de controlegroep bewoog even hard mee (' + ctrlFactor + 'x tegen ' +
      duurFactor + 'x); dit verschil komt niet van de commit' };
  }
  return { blind: false, reden: null };
}

module.exports = { pct, oordeel, ROUTES };

/* Alleen doen als iemand dit bestand DRAAIT; geladen door een toets hoort er
   niets te gebeuren en al helemaal geen process.exit. */
if (require.main !== module) return;

(async () => {
  console.log('\n=== WAT KOST DE DUURZAME COMMIT ===\n');
  console.log('  machine  : ' + os.cpus().length + ' kernen, ' + Math.round(os.totalmem() / 1e9) + ' GB, ' +
    os.platform() + ', node ' + process.version);
  console.log('  opslag   : ' + (process.env.RTG_STORE || 'sqlite (standaard)'));
  console.log('  verzoeken: ' + N + ' per route per ronde, plus 5 opwarm\n');

  const aan = await ronde('duurzaam AAN', {});
  const uitR = await ronde('duurzaam UIT', { RTG_DUURZAAM: 'uit' });

  const rijen = [];
  console.log('  route                        p50 aan   p50 uit    p95 aan   p95 uit    p99 aan   p99 uit');
  for (const r of ROUTES) {
    const a = aan.routes[r.naam], u = uitR.routes[r.naam];
    const kolom = (x) => String(x == null ? '-' : x).padStart(8);
    console.log('  ' + (r.duurzaam ? '' : ' ') + r.naam.padEnd(28) +
      kolom(a.p50) + kolom(u.p50) + '  ' + kolom(a.p95) + kolom(u.p95) + '  ' + kolom(a.p99) + kolom(u.p99));
    const factor = (x, y) => (x != null && y != null && y > 0 ? Math.round(x / y * 100) / 100 : null);
    rijen.push({ route: r.naam, duurzaam: r.duurzaam,
      aan: { p50: a.p50, p95: a.p95, p99: a.p99, max: a.max, gelukt: a.gelukt, statussen: a.statussen },
      uit: { p50: u.p50, p95: u.p95, p99: u.p99, max: u.max, gelukt: u.gelukt, statussen: u.statussen },
      factor: { p50: factor(a.p50, u.p50), p95: factor(a.p95, u.p95), p99: factor(a.p99, u.p99) } });
  }

  const duur = rijen.filter(r => r.duurzaam && r.factor.p50 != null);
  const ctrl = rijen.filter(r => !r.duurzaam && r.factor.p50 != null);
  const gem = (rij, veld) => rij.length ? Math.round(rij.reduce((s, r) => s + r.factor[veld], 0) / rij.length * 100) / 100 : null;

  console.log('\n  ----------------------------------------');
  console.log('  FACTOR p50 op de duurzame routes ... ' + gem(duur, 'p50') + 'x');
  console.log('  FACTOR p95 ......................... ' + gem(duur, 'p95') + 'x');
  console.log('  FACTOR p99 ......................... ' + gem(duur, 'p99') + 'x');
  console.log('  FACTOR p50 op de CONTROLE .......... ' + gem(ctrl, 'p50') + 'x   <- hoort rond 1 te liggen');
  console.log('  ----------------------------------------');

  /* DE PROEF OORDEELT NIET OVER GOED OF FOUT, maar hij zegt WEL wanneer hij
     niets heeft gemeten. Beweegt de controlegroep even hard mee, dan zit het
     verschil in de machine en niet in de commit, en dan is elk getal hierboven
     ruis met een decimaal. */
  const ctrlFactor = gem(ctrl, 'p50');
  const duurFactor = gem(duur, 'p50');
  const o = oordeel(duurFactor, ctrlFactor);
  const blind = o.blind;
  if (blind) console.log('\n  DE METER IS BLIND: ' + o.reden);

  fs.writeFileSync(UITSLAG, JSON.stringify({
    uitleg: 'Gepaarde meting van de duurzame commit: dezelfde machine, dezelfde opslag, dezelfde ' +
      'belasting, alleen RTG_DUURZAAM ertussen. De controlegroep is een schrijfroute die NIET ' +
      'duurzaam vastlegt; beweegt die mee, dan meet deze ronde de machine en niet de commit. ' +
      'Getallen van verschillende machines of opslagstanden horen NIET vergeleken te worden.',
    gedraaid: new Date().toISOString(),
    machine: { kernen: os.cpus().length, geheugenGB: Math.round(os.totalmem() / 1e9),
      platform: os.platform(), node: process.version },
    opslag: process.env.RTG_STORE || 'sqlite',
    gemeten: { verzoekenPerRoute: N,
      factorP50: gem(duur, 'p50'), factorP95: gem(duur, 'p95'), factorP99: gem(duur, 'p99'),
      controleFactorP50: ctrlFactor, blindeRondes: blind ? 1 : 0 },
    routes: rijen
  }, null, 1) + '\n');
  console.log('\n  weggeschreven in DUURZAAMHEIDSKOSTEN.json');
  process.exit(blind ? 2 : 0);
})().catch(e => { console.error('de kostenmeting viel om: ' + (e && e.stack || e)); process.exit(2); });
