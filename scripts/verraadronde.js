#!/usr/bin/env node
/* ============================================================================
   DE VERRAADRONDE -- en hij meldt nooit alleen "PASS".

   WAAROM DIT SCRIPT ANDERS RAPPORTEERT DAN ELK ANDER. Een chaosproef die
   "geslaagd" meldt, is niet te onderscheiden van een chaosproef die niets heeft
   gedaan. Bij deze motor is dat geen theoretisch risico maar de standaardfout:
   een verraad kan aanstaan, kan toeslaan, en toch volstrekt onzichtbaar
   blijven. Dan leert een groene ronde je precies niets, en leest hij als
   weerbaarheid.

   Dus zes getallen, altijd, ook als alles goed gaat:

     VERKLAARD      hoeveel verraden er aanstonden
     TOEGEDIEND     hoe vaak er werkelijk is toegeslagen
     WAARGENOMEN    hoe vaak dat een ZICHTBAAR verschil gaf
     INVARIANTSCHENDINGEN  hoe vaak een harde waarheid brak
     BLINDE INJECTIES      toegediend maar niets zag het -- hier is niets geleerd
     ONHERHAALBARE RONDES  zelfde seed, andere uitkomst

   TOEGEDIEND MIN WAARGENOMEN IS DE BELANGRIJKSTE VAN DE ZES. Dat verschil zijn
   de blinde injecties: het verraad sloeg toe en er was geen enkele meetpost die
   het kon zien. Nul bevindingen betekent dan niet "het systeem is bestand", maar
   "we hebben niet gekeken". Deze ronde ZAKT daarop, en niet op een bevinding --
   want een bevinding is winst en blindheid is een gat.

   WAAROM ER HERSTART WORDT. `schrijf-verloren` slaat de persistentie over,
   maar het geheugen houdt de gegevens vast. In hetzelfde proces terugkijken laat
   dus niets zien: dat zou een blinde injectie zijn en het zou eruitzien als een
   systeem dat er niet door van slag raakt. Daarom draait elke ronde in twee
   etappes met een echte herstart ertussen -- de enige plek waar "bevestigd maar
   verloren" zichtbaar wordt.

   IJKING VOORAF, zoals de rolproef die ook heeft. Eerst een SCHONE ronde: het
   scenario moet zonder verraad wel degelijk zijn spoor achterlaten. Doet het dat
   niet, dan meet de waarnemer niets en mag hij niet oordelen.

   Draai:  node scripts/verraadronde.js
           node scripts/verraadronde.js --seed=99
   ========================================================================== */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const { CATALOGUS } = require('../server/lib/verraad');
const { telSamen, zakt } = require('./lib/verraadtelling');

const WORTEL = path.join(__dirname, '..');
const UITSLAG = path.join(WORTEL, 'VERRAAD.json');
const argv = process.argv.slice(2);
const SEED = (argv.find(a => a.startsWith('--seed=')) || '--seed=20260811').slice(7);

/* De verraden die op het schrijfpad zijn ingebouwd. De andere staan in de
   catalogus als voornemen en horen hier niet: een ronde die ze meetelt, meldt
   dekking die er niet is. */
const TE_PROEVEN = CATALOGUS.filter(v => v.waar && v.waar.includes('db/index.js')).map(v => v.naam);

function vrijePoort() {
  const net = require('net');
  return new Promise((res, rej) => {
    const s = net.createServer(); s.unref(); s.on('error', rej);
    s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); });
  });
}

async function start(datamap, extra) {
  const poort = await vrijePoort();
  const basis = 'http://127.0.0.1:' + poort;
  const kind = spawn(process.execPath, [path.join(WORTEL, 'server', 'server.js')], {
    cwd: WORTEL, stdio: 'ignore',
    env: { ...process.env, PORT: String(poort), RTG_DATA_DIR: datamap, SMTP_URL: '', STUN_UIT: '1',
      RTG_DEMO: '1', RTG_VERRAAD_SEED: SEED, ...extra }
  });
  const eind = Date.now() + 45000;
  while (Date.now() < eind) {
    if (kind.exitCode !== null) return { kind, basis, dood: true };
    try { const r = await fetch(basis + '/api/health'); if (r.ok) return { kind, basis, dood: false }; } catch (e) {}
    await new Promise(r => setTimeout(r, 200));
  }
  return { kind, basis, dood: true };
}
const stop = (s) => { try { s.kind.kill('SIGKILL'); } catch (e) {} };

const post = async (basis, pad, lijf, tok) => {
  try {
    const r = await fetch(basis + pad, { method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(tok ? { Authorization: 'Bearer ' + tok } : {}) },
      body: JSON.stringify(lijf || {}) });
    return { status: r.status, data: await r.json().catch(() => ({})) };
  } catch (e) { return { status: 0, data: { fout: String(e.message) } }; }
};

/* HET SCENARIO. Een lid schrijft een notitie en leest hem NA EEN HERSTART
   terug. Bewust iets kleins en volledig: bij een reeks van vijftien stappen is
   achteraf niet te zeggen welke stap door het verraad omviel. */
async function scenario(verraadAan) {
  const datamap = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-verraadronde-'));
  const merk = 'verraadproef-' + Math.random().toString(36).slice(2, 9);
  const waarnemingen = { schrijfStatus: null, terugNaHerstart: null, tweedeStartLukte: null, toegediend: {} };
  try {
    /* Etappe 1: schrijven, mét het verraad. */
    const een = await start(datamap, verraadAan ? { RTG_VERRAAD: verraadAan } : {});
    if (een.dood) { waarnemingen.eersteStartLukte = false; stop(een); return waarnemingen; }
    waarnemingen.eersteStartLukte = true;

    const u = Date.now().toString().slice(-8) + Math.floor(Math.random() * 900);
    const reg = await post(een.basis, '/api/auth/register', { name: 'Verraadproef',
      email: 'vp' + u + '@x.nl', phone: '06' + u.slice(0, 8), password: 'geheim123',
      geboortedatum: '1986-06-06', geslacht: 'm', tier: 'rtg', pasApp: 'rtg' });
    const tok = reg.data && reg.data.token;
    if (!tok) { waarnemingen.registratieLukte = false; stop(een); return waarnemingen; }
    waarnemingen.registratieLukte = true;

    const schrijf = await post(een.basis, '/api/notities/bewaar', { titel: merk, tekst: merk }, tok);
    waarnemingen.schrijfStatus = schrijf.status;
    await new Promise(r => setTimeout(r, 1500));     // write-behind zijn kans geven
    stop(een);
    await new Promise(r => setTimeout(r, 500));

    /* Etappe 2: herstarten ZONDER verraad, en terugkijken. De enige plek waar
       "bevestigd maar verloren" zichtbaar wordt. */
    const twee = await start(datamap, {});
    waarnemingen.tweedeStartLukte = !twee.dood;
    if (twee.dood) { stop(twee); return waarnemingen; }

    const opnieuw = await post(twee.basis, '/api/auth/login', { login: 'vp' + u + '@x.nl', password: 'geheim123' });
    const tok2 = opnieuw.data && opnieuw.data.token;
    waarnemingen.inlogNaHerstart = !!tok2;
    if (tok2) {
      const lijst = await post(twee.basis, '/api/notities/mijn', {}, tok2);
      const alles = JSON.stringify(lijst.data || {});
      waarnemingen.terugNaHerstart = alles.includes(merk);
    }
    stop(twee);
    return waarnemingen;
  } finally {
    try { fs.rmSync(datamap, { recursive: true, force: true }); } catch (e) {}
  }
}

/* Twee waarnemingsreeksen vergelijken: wat is er ANDERS dan in de schone ronde?
   Dat verschil IS de waarneming. Geen verschil betekent dat er niets te zien
   was -- niet dat er niets is gebeurd. */
function verschillen(schoon, met) {
  const uit = [];
  for (const sleutel of new Set([...Object.keys(schoon), ...Object.keys(met)])) {
    if (sleutel === 'toegediend') continue;
    if (JSON.stringify(schoon[sleutel]) !== JSON.stringify(met[sleutel])) {
      uit.push(sleutel + ': ' + JSON.stringify(schoon[sleutel]) + ' -> ' + JSON.stringify(met[sleutel]));
    }
  }
  return uit;
}

(async () => {
  console.log('\n=== DE VERRAADRONDE ===\n');
  console.log('  seed : ' + SEED);

  /* ---- DE IJKING. Zonder verraad MOET het spoor er zijn. ---- */
  const schoon = await scenario(null);
  const ijkOk = schoon.eersteStartLukte && schoon.registratieLukte &&
    schoon.tweedeStartLukte && schoon.terugNaHerstart === true;
  console.log('  ijking (schone ronde laat een spoor na) : ' + (ijkOk ? 'ja' : 'NEE'));
  if (!ijkOk) {
    console.log('\n  DE WAARNEMER IS BLIND: zonder verraad blijft het spoor al weg.');
    console.log('  ' + JSON.stringify(schoon));
    console.log('  Deze ronde oordeelt niet -- een meter die een LEGITIEME schrijfactie niet ziet,');
    console.log('  ziet een verloren schrijfactie ook niet.');
    process.exit(2);
  }

  const rondes = [];
  for (const naam of TE_PROEVEN) {
    const een = await scenario(naam);
    const gezien = verschillen(schoon, een);
    /* Herhaalbaarheid: dezelfde seed, nog een keer, en de waarnemingen horen
       gelijk te zijn. Zo niet, dan is een gevonden fout niet na te spelen en is
       de ronde niets waard als bewijs. */
    const twee = await scenario(naam);
    const herhaalbaar = JSON.stringify(verschillen(schoon, twee)) === JSON.stringify(gezien);
    rondes.push({ verraad: naam, toegediend: true, waargenomen: gezien.length > 0, gezien, herhaalbaar });
    console.log('\n  ' + naam);
    console.log('    toegediend  : ja');
    console.log('    waargenomen : ' + (gezien.length ? gezien.join(' | ') : 'NIETS -- blinde injectie'));
    console.log('    herhaalbaar : ' + (herhaalbaar ? 'ja' : 'NEE'));
  }

  /* ---- DE ZES GETALLEN. Altijd, ook als alles goed gaat.
     De regels staan in ./lib/verraadtelling.js: puur, en dus toetsbaar zonder
     dat er vier servers voor hoeven te starten. */
  const t = telSamen(rondes, TE_PROEVEN.length);

  console.log('\n  ----------------------------------------');
  console.log('  VERKLAARD ............. ' + t.verklaard);
  console.log('  TOEGEDIEND ............ ' + t.toegediend);
  console.log('  WAARGENOMEN ........... ' + t.waargenomen);
  console.log('  INVARIANTSCHENDINGEN .. ' + t.invariantschendingen);
  console.log('  BLINDE INJECTIES ...... ' + t.blindeInjecties +
    (t.blindeInjecties ? '   <- hier is NIETS geleerd' : ''));
  console.log('  ONHERHAALBARE RONDES .. ' + t.onherhaalbareRondes);
  console.log('  ----------------------------------------');
  console.log('  in de catalogus staan ' + CATALOGUS.length + ' verraden; deze ronde beproeft er ' +
    t.verklaard + ' (de rest is nog niet ingebouwd).');

  fs.writeFileSync(UITSLAG, JSON.stringify({
    uitleg: 'De Verraadronde meldt nooit alleen PASS. TOEGEDIEND min WAARGENOMEN is het ' +
      'belangrijkste getal: dat zijn blinde injecties, en daar is niets geleerd. ' +
      'De ronde zakt op blindheid en op onherhaalbaarheid, niet op een bevinding -- ' +
      'een bevinding is winst.',
    seed: SEED,
    gemeten: { ...t, inCatalogus: CATALOGUS.length },
    rondes
  }, null, 2) + '\n');
  console.log('\n  weggeschreven in VERRAAD.json');

  /* Zakken op blindheid en onherhaalbaarheid. NIET op een bevinding: die is
     winst en hoort in het register, niet in een rode poort. */
  process.exit(zakt(t) ? 1 : 0);
})().catch(e => { console.error('de verraadronde viel om: ' + (e && e.stack || e)); process.exit(2); });
