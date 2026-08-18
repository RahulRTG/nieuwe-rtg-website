#!/usr/bin/env node
/* ============================================================================
   HERSTELTIJD -- hoe lang duurt het echt?

   test/herstelproef.test.js bewijst DAT herstel werkt. Dit script meet HOE LANG
   het duurt, op een database van een opgegeven omvang. Dat is een ander soort
   antwoord, en het is het antwoord dat een klant wil:

       "wij kunnen herstellen"                      -- een aanname
       "wij hebben 250.000 leden in 41 seconden
        teruggezet, gemeten op 29 juli"             -- een cijfer

   Alleen het tweede kan onder een SLA. De uitkomst hoort in PRODUCTION.md, met
   de datum erbij, en opnieuw gemeten zodra de omvang of de hardware verandert.

   WAT ER GEMETEN WORDT

     RTO (Recovery Time Objective) -- van "de schijf is weg" tot "een lid kan
     inloggen". Dat is de hele keten: terugzetten, opstarten, migreren, en de
     eerste geslaagde inlog. Niet alleen het kopieren, want daar heeft niemand
     iets aan als de server er daarna nog vier minuten over doet.

     RPO (Recovery Point Objective) -- hoeveel werk je kwijt bent. Dat is geen
     meting maar een gevolg van het back-upritme: bij een dagelijkse back-up is
     de RPO tot 24 uur. Het staat hier omdat het de vraag is die er meteen na
     de RTO komt, en omdat het antwoord onaangenaam is.

   Draai: node scripts/hersteltijd.js [aantal-leden]
   ========================================================================== */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

const AANTAL = Math.max(1000, Number(process.argv[2]) || 50000);
const WORTEL = path.join(__dirname, '..');

const seconden = (ns) => Number(ns) / 1e9;
const fmt = (s) => s < 1 ? (s * 1000).toFixed(0) + ' ms' : s.toFixed(1) + ' s';
function mb(pad) {
  let n = 0;
  for (const f of fs.readdirSync(pad)) {
    const p = path.join(pad, f);
    const st = fs.statSync(p);
    if (st.isFile()) n += st.size;
  }
  return (n / 1048576).toFixed(1);
}

function kop(t) { console.log('\n\x1b[1m' + t + '\x1b[0m\n' + '-'.repeat(t.length)); }

async function main() {
  const werk = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-hersteltijd-'));
  const bron = path.join(werk, 'bron');
  const backup = path.join(werk, 'backup');
  const doel = path.join(werk, 'hersteld');
  for (const d of [bron, backup, doel]) fs.mkdirSync(d, { recursive: true });

  /* De sleutels staan BUITEN de back-up (dat is het hele punt van het ontwerp),
     dus we houden ze hier apart, zoals een secrets manager dat zou doen. */
  const VAULT = crypto.randomBytes(32).toString('hex');
  const SECRET = crypto.randomBytes(32).toString('hex');
  process.env.RTG_DATA_DIR = bron;
  process.env.RTG_VAULT_KEY = VAULT;
  process.env.RTG_SECRET_KEY = SECRET;

  console.log('\x1b[1mHERSTELTIJD\x1b[0m\x1b[2m -- gemeten, niet aangenomen\x1b[0m');
  console.log('  leden in de proef : ' + AANTAL.toLocaleString('nl-NL'));
  console.log('  werkmap          : ' + werk);

  /* ---------- 1. een database van formaat ---------- */
  kop('1. VULLEN');
  const accounts = require(path.join(WORTEL, 'server/accounts'));
  accounts.init();
  let t = process.hrtime.bigint();
  const db = require(path.join(WORTEL, 'server/accounts/state')).db;
  const kluis = require(path.join(WORTEL, 'server/accounts/kluis'));
  /* Rechtstreeks invoegen in een transactie: createUser doet scrypt per lid en
     dat meet de tijd van het VULLEN, niet van het herstellen. */
  const hash = kluis.hashPasswordSync('proefwachtwoord123');
  db.exec('BEGIN');
  const stmt = db.prepare(`INSERT INTO users (email_hash, username, password_hash, tier, codename,
    enc_name, enc_email, created_at, actief) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)`);
  for (let i = 0; i < AANTAL; i++) {
    const email = 'lid' + i + '@proef.test';
    stmt.run(kluis.emailHash(email), 'lid' + i, hash, 'rtg', kluis.makeCodename(),
      kluis.enc('Voornaam Achternaam ' + i), kluis.enc(email), new Date().toISOString());
  }
  db.exec('COMMIT');
  const vulSec = seconden(process.hrtime.bigint() - t);
  console.log('  ' + AANTAL.toLocaleString('nl-NL') + ' leden geschreven in ' + fmt(vulSec));

  /* ---------- 2. de back-up ---------- */
  kop('2. BACK-UP');
  t = process.hrtime.bigint();
  accounts.checkpoint();   // WAL in het hoofdbestand vouwen -- zonder dit mist de kopie de verse leden
  const checkSec = seconden(process.hrtime.bigint() - t);
  t = process.hrtime.bigint();
  for (const f of fs.readdirSync(bron)) {
    const p = path.join(bron, f);
    if (fs.statSync(p).isFile() && !f.endsWith('.key')) fs.copyFileSync(p, path.join(backup, f));
  }
  const kopieSec = seconden(process.hrtime.bigint() - t);
  console.log('  WAL-checkpoint   : ' + fmt(checkSec));
  console.log('  kopieren         : ' + fmt(kopieSec) + '  (' + mb(backup) + ' MB)');
  console.log('  sleutels mee?    : ' + (fs.readdirSync(backup).some(f => f.endsWith('.key')) ? 'JA (FOUT)' : 'nee (goed)'));

  /* ---------- 3. de ramp, en het herstel ---------- */
  kop('3. HERSTEL');
  const totaalBegin = process.hrtime.bigint();
  t = process.hrtime.bigint();
  for (const f of fs.readdirSync(backup)) fs.copyFileSync(path.join(backup, f), path.join(doel, f));
  const terugSec = seconden(process.hrtime.bigint() - t);
  console.log('  terugzetten      : ' + fmt(terugSec));

  /* De server start in een eigen proces, met de sleutels uit de "secrets
     manager" -- precies zoals het draaiboek het voorschrijft. */
  t = process.hrtime.bigint();
  const poort = 4700 + Math.floor(Math.random() * 200);
  const srv = require('child_process').spawn(process.execPath,
    [path.join(WORTEL, 'server/server.js')],
    { env: { ...process.env, PORT: String(poort), RTG_DATA_DIR: doel, SMTP_URL: '' }, stdio: 'ignore' });

  let op = false;
  for (let i = 0; i < 240 && !op; i++) {
    await new Promise(r => setTimeout(r, 500));
    try { const r = await fetch('http://127.0.0.1:' + poort + '/api/health'); op = r.ok; } catch (e) {}
  }
  const startSec = seconden(process.hrtime.bigint() - t);
  if (!op) { srv.kill(); console.error('\n  De server kwam niet op. Herstel MISLUKT.'); process.exit(1); }
  console.log('  server op        : ' + fmt(startSec));

  /* De echte proef: kan een bestaand lid inloggen, en is zijn naam terug? Dat
     tweede bewijst dat de kluissleutel bij de herstelde database past. */
  t = process.hrtime.bigint();
  const r = await fetch('http://127.0.0.1:' + poort + '/api/auth/login', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ login: 'lid7@proef.test', password: 'proefwachtwoord123' })
  });
  const uit = await r.json().catch(() => ({}));
  const inlogSec = seconden(process.hrtime.bigint() - t);
  const rto = seconden(process.hrtime.bigint() - totaalBegin);
  const naamTerug = !!(uit.state && uit.state.user && /Voornaam Achternaam/.test(JSON.stringify(uit.state.user)));
  console.log('  eerste inlog     : ' + fmt(inlogSec) + '  (' + (r.ok ? 'geslaagd' : 'MISLUKT, status ' + r.status) + ')');
  console.log('  naam uit de kluis: ' + (naamTerug ? 'leesbaar (de sleutel past)' : 'NIET leesbaar'));

  srv.kill();

  /* ---------- de uitslag ---------- */
  kop('UITSLAG');
  console.log('  RTO (schijf weg -> lid ingelogd) : \x1b[1m' + fmt(rto) + '\x1b[0m');
  console.log('  RPO (bij een dagelijkse back-up) : \x1b[1mtot 24 uur\x1b[0m');
  console.log('  omvang                           : ' + AANTAL.toLocaleString('nl-NL') + ' leden, ' + mb(backup) + ' MB');
  console.log('  gemeten op                       : ' + new Date().toISOString().slice(0, 10));
  console.log('\n\x1b[2m  Deze RTO is de tijd van het HERSTEL zelf. De echte tijd tot dienstverlening');
  console.log('  telt daar het opmerken en het besluit bij op -- en dat is meestal het langste');
  console.log('  deel. Zie SLO.md en DATALEK.md.\x1b[0m');

  const goed = r.ok && naamTerug;
  try { fs.rmSync(werk, { recursive: true, force: true }); } catch (e) {}
  if (!goed) { console.error('\n  HERSTEL NIET COMPLEET.'); process.exit(1); }
  console.log('\n  \x1b[32mHerstel compleet en geklokt.\x1b[0m');
}

main().catch(e => { console.error(e); process.exit(1); });
