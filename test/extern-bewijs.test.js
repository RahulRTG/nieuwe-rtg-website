/* DE BEWIJSVERSLAGEN VOOR HET EXTERNE DOSSIER (scripts/extern-bewijs.js).

   Wat hier beproefd wordt is het OORDEEL van elk verslag, niet de host: een
   verslag mag alleen PASS zeggen als het de proef werkelijk zag slagen, en een
   stap die alleen een mens kan zetten laat hem OPEN en nooit PASS. De ClamAV-
   kant draait tegen een nagemaakte clamd die het echte INSTREAM- en VERSION-
   protocol spreekt, zodat de echte client (server/kern/clamd.js) meedoet.

   Draai los: node --test test/extern-bewijs.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const net = require('node:net');
const path = require('node:path');
const bewijs = require('../scripts/extern-bewijs');
const { maakClamd } = require('../server/kern/clamd');
const extern = require('../server/config/external-release');

const NU = Date.parse('2026-09-27T10:00:00Z');

/* Een clamd die VERSION beantwoordt met de gegeven definitiedatum en elke
   INSTREAM met de EICAR-reeks erin als besmet meldt -- tenzij `blind`. */
async function nepClamd({ versieDatum, blind = false } = {}) {
  const srv = net.createServer(sok => {
    let buf = Buffer.alloc(0);
    sok.on('data', stuk => {
      buf = Buffer.concat([buf, stuk]);
      if (buf.toString('latin1').startsWith('zVERSION\0'))
        return sok.end('ClamAV 1.3.1/27410/' + versieDatum + '\0');
      if (!buf.toString('latin1').startsWith('zINSTREAM\0')) return;
      if (!buf.subarray(buf.length - 4).equals(Buffer.alloc(4))) return;
      const raak = !blind && buf.toString('latin1').includes('EICAR-STANDARD-ANTIVIRUS-TEST-FILE');
      sok.end(raak ? 'stream: Eicar-Test-Signature FOUND\0' : 'stream: OK\0');
    });
  });
  await new Promise(r => srv.listen(0, '127.0.0.1', r));
  return { srv, clamd: () => maakClamd({ host: '127.0.0.1', port: srv.address().port, timeout: 2000 }) };
}

const basis = extra => Object.assign({ env: {}, commit: 'a'.repeat(40), nu: () => NU }, extra);

test('de vier verslagen horen bij vier echte controles van het dossier', () => {
  for (const naam of Object.values(bewijs.CONTROLE)) assert.ok(extern.ALLE_CONTROLES.includes(naam), naam);
});

test('malware: actuele definities, EICAR geraakt en schoon door is PASS', async () => {
  const { srv, clamd } = await nepClamd({ versieDatum: 'Sat Sep 26 08:20:00 2026' });
  try {
    const uit = await bewijs.voer('malware', null, basis({ clamd }));
    assert.equal(uit.uitkomst, 'PASS', JSON.stringify(uit.redenen));
    assert.equal(uit.gegevens.eicar.verdict, 'besmet');
    assert.equal(uit.gegevens.schoon.verdict, 'schoon');
    assert.equal(uit.gegevens.leeftijdDagen, 1);
    assert.equal(uit.commit, 'a'.repeat(40));
  } finally { srv.close(); }
});

test('malware: oude definities of een scanner die EICAR mist is FAIL, met de reden', async () => {
  const oud = await nepClamd({ versieDatum: 'Mon Sep 14 08:20:00 2026' });
  try {
    const uit = await bewijs.voer('malware', null, basis({ clamd: oud.clamd }));
    assert.equal(uit.uitkomst, 'FAIL');
    assert.ok(uit.redenen.some(r => /13 dagen oud/.test(r)), uit.redenen.join('; '));
  } finally { oud.srv.close(); }
  const blind = await nepClamd({ versieDatum: 'Sat Sep 26 08:20:00 2026', blind: true });
  try {
    const uit = await bewijs.voer('malware', null, basis({ clamd: blind.clamd }));
    assert.equal(uit.uitkomst, 'FAIL');
    assert.ok(uit.redenen.some(r => /EICAR-proef werd NIET herkend/.test(r)));
  } finally { blind.srv.close(); }
  const geen = await bewijs.voer('malware', null, basis({ clamd: () => null }));
  assert.equal(geen.uitkomst, 'FAIL', 'zonder scanner is er niets om PASS over te zeggen');
});

test('objectopslag volgt de echte mediaproef, en een ontbrekende opslag is FAIL', async () => {
  const ok = await bewijs.voer('objectopslag', null, basis({ beproefMedia: async () => ({ ok: true, bytes: 96,
    sha256: 'b'.repeat(64), tweeInstanties: true, verwijderd: true }) }));
  assert.equal(ok.uitkomst, 'PASS');
  const weg = await bewijs.voer('objectopslag', null, basis({ beproefMedia: async () => ({ ok: false,
    reden: 'de gedeelde S3-mediastore is niet geconfigureerd' }) }));
  assert.equal(weg.uitkomst, 'FAIL');
  assert.match(weg.redenen[0], /niet geconfigureerd/);
});

function staten(voor, set) {
  const map = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-rollbackproef-'));
  const staat = path.join(map, 'staat'), rollbackStaat = path.join(map, 'terug');
  if (voor) fs.writeFileSync(staat, voor.join('\n') + '\n');
  if (set) fs.writeFileSync(rollbackStaat, set.join('\n') + '\n');
  return { map, staat, rollbackStaat };
}

test('rollback: alleen een ECHTE wissel naar de bewezen set is PASS', async () => {
  const nieuw = ['img@sha256:1', 'bak@sha256:1', 'c'.repeat(64)], oud = ['img@sha256:0', 'bak@sha256:0', 'd'.repeat(64)];
  const s = staten(nieuw, oud);
  try {
    const draai = () => { fs.writeFileSync(s.staat, oud.join('\n') + '\n'); return { status: 0 }; };
    const uit = await bewijs.voer('rollback', null, basis({ staat: s.staat, rollbackStaat: s.rollbackStaat, draai }));
    assert.equal(uit.uitkomst, 'PASS', JSON.stringify(uit.redenen));
    assert.deepEqual(uit.gegevens.na, oud);
    const nogmaals = await bewijs.voer('rollback', null, basis({ staat: s.staat, rollbackStaat: s.rollbackStaat, draai }));
    assert.equal(nogmaals.uitkomst, 'FAIL', 'wie al op de rollbackset stond, heeft niets teruggezet');
    const kapot = await bewijs.voer('rollback', null, basis({ staat: s.staat, rollbackStaat: s.rollbackStaat,
      draai: () => ({ status: 65 }) }));
    assert.equal(kapot.uitkomst, 'FAIL');
  } finally { fs.rmSync(s.map, { recursive: true, force: true }); }
});

test('herstel: zonder de twee mensverklaringen OPEN, met beide PASS, en een mislukte route FAIL', async () => {
  const ok = () => ({ status: 0 });
  const zonder = await bewijs.voer('herstel', '20260815T030000Z', basis({ draai: ok }));
  assert.equal(zonder.uitkomst, 'OPEN');
  assert.equal(zonder.mensVerklaring, null);
  assert.equal(zonder.redenen.length, 2);
  const met = await bewijs.voer('herstel', '20260815T030000Z', basis({ draai: ok,
    env: { RTG_HERSTEL_LOGIN_GEZIEN: 'Beheerder A', RTG_HERSTEL_NAAM_GEZIEN: 'Beheerder A' } }));
  assert.equal(met.uitkomst, 'PASS');
  assert.equal(met.mensVerklaring.inlogGezienDoor, 'Beheerder A');
  const mis = await bewijs.voer('herstel', '20260815T030000Z', basis({ draai: () => ({ status: 1 }),
    env: { RTG_HERSTEL_LOGIN_GEZIEN: 'A', RTG_HERSTEL_NAAM_GEZIEN: 'A' } }));
  assert.equal(mis.uitkomst, 'FAIL', 'een mensverklaring maakt een mislukte route niet goed');
  const stempel = await bewijs.voer('herstel', 'gisteren', basis({ draai: ok }));
  assert.equal(stempel.uitkomst, 'FAIL');
});

test('het verslag komt met zijn hash op de plek die het dossier leest', async () => {
  const map = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-extern-'));
  try {
    const uit = await bewijs.voer('objectopslag', null, basis({ beproefMedia: async () => ({ ok: false, reden: 'x' }) }));
    const w = bewijs.schrijf('objectopslag', uit, map);
    assert.equal(path.basename(w.pad), 'object-storage-delivery.json');
    const bytes = fs.readFileSync(w.pad);
    assert.equal(require('node:crypto').createHash('sha256').update(bytes).digest('hex'), w.sha256);
    assert.equal(JSON.parse(bytes).formaat, 'rtg-extern-bewijsverslag-v1');
  } finally { fs.rmSync(map, { recursive: true, force: true }); }
});
