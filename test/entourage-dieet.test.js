/* ENTOURAGE: ALLERGIE EN DIEET VAN EEN REISGENOOT (besluit van de integrator van
   19 oktober 2026, hetzelfde als Table: test/table-dieet.test.js).

   Een reisgenoot is een derde zonder account; zijn allergie of medisch dieet is
   een gezondheidsgegeven (art. 9 AVG). Entourage is een vaste lijst en geen
   gelegenheid, dus de termijn loopt vanaf de laatste keer dat het lid het
   bevestigde (opnieuw opsloeg): twaalf maanden. Daarna is het weg uit de opslag
   en zegt het gezelschap "dieet onbekend" -- het lid vult het opnieuw in.

   Draai: node --test test/entourage-dieet.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stopNet, elevateTier } = require('./helper');

const DAG = 86400000;

function kern() {
  const db = { data: {} };
  const DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-entkern-'));
  const k = require('../server/kern/rechterhand')({ db, save: () => {}, crypto, liveCodename: () => '', anthropic: null, DATA_DIR });
  return { k, db };
}
const persoon = (k, naam) => k.entourage('lid1').gezelschap.find((p) => p.naam === naam);

test('de allergenen van een reisgenoot komen uit de EU-lijst; vrije tekst is een aanvulling', () => {
  const { k } = kern();
  assert.equal(k.enPersoon('lid1', { naam: 'Partner P', band: 'partner', allergenen: ['sesam', 'gluten'], dieet: 'pescotarisch' }).status, 200);
  const p = persoon(k, 'Partner P');
  assert.deepEqual(p.allergenen, ['gluten', 'sesam'], 'in de volgorde van bijlage II');
  assert.equal(p.dieet, 'pescotarisch');
  assert.ok(p.dieetTot, 'het lid ziet tot wanneer het bewaard blijft');
  const fout = k.enPersoon('lid1', { naam: 'Kind K', band: 'kind', allergenen: ['aardbei'] });
  assert.equal(fout.status, 400);
  assert.match(fout.error, /lijst/);
  assert.equal(k.entourage('lid1').allergenen.length, 14);
});

test('na twaalf maanden zonder bevestiging is het weg uit de opslag; de persoon blijft', () => {
  const { k, db } = kern();
  k.enPersoon('lid1', { naam: 'Partner P', band: 'partner', allergenen: ['pinda'], dieet: 'geen varkensvlees', telefoon: '0611' });
  assert.equal(k.entourageVergeetDieet(Date.now() + 360 * DAG), 0, 'binnen de termijn blijft het staan');
  assert.equal(k.entourageVergeetDieet(Date.now() + 367 * DAG), 1);
  const opslag = JSON.stringify(db.data);
  assert.doesNotMatch(opslag, /geen varkensvlees|pinda/);
  assert.match(opslag, /Partner P/);
});

test('opnieuw opslaan bevestigt en zet de termijn opnieuw', () => {
  const { k, db } = kern();
  k.enPersoon('lid1', { naam: 'Partner P', band: 'partner', allergenen: ['vis'] });
  const p = persoon(k, 'Partner P');
  /* een jaar oud maken, alsof het lid het lang geleden invulde */
  const rec = db.data.lifestyle.lid1.entourage.find((x) => x.id === p.id);
  rec.dieetOp = new Date(Date.now() - 400 * DAG).toISOString();
  k.enPersoon('lid1', { id: p.id, naam: 'Partner P', band: 'partner', allergenen: ['vis'] });
  assert.equal(k.entourageVergeetDieet(Date.now()), 0, 'net bevestigd');
  assert.deepEqual(persoon(k, 'Partner P').allergenen, ['vis']);
});

test('het gezelschap noemt een verlopen dieet "onbekend" en zet allergenen bij de tafel', () => {
  const { k, db } = kern();
  k.enPersoon('lid1', { naam: 'Partner P', band: 'partner', allergenen: ['noten'] });
  k.enPersoon('lid1', { naam: 'Vriend V', band: 'vriend', dieet: 'veganistisch' });
  const ids = k.entourage('lid1').gezelschap.map((p) => p.id);
  let g = k.enGezelschap('lid1', { ids });
  assert.ok(g.dieten.some((d) => d.naam === 'Partner P' && /noten/.test(d.dieet)), 'allergenen staan bij de tafel');
  db.data.lifestyle.lid1.entourage.forEach((x) => { if (x.naam === 'Partner P') x.dieetOp = new Date(Date.now() - 400 * DAG).toISOString(); });
  g = k.enGezelschap('lid1', { ids });
  assert.ok(g.punten.some((p) => p.naam === 'Partner P' && /dieet onbekend/.test(p.wat)));
  assert.doesNotMatch(JSON.stringify(db.data), /noten/);
});

test('de reissecretaris krijgt geen namen en geen dieet', async () => {
  const { k } = kern();
  k.enPersoon('lid1', { naam: 'Mevrouw Zonneveld', band: 'partner', allergenen: ['noten'], dieet: 'coeliakie' });
  const r = await k.rechterhandAI('lid1', 'entourage', 'Wat moet ik regelen?');
  assert.doesNotMatch(r.antwoord, /Zonneveld|coeliakie|noten/);
});

test('de bewaarveger wist het in de opslag van een draaiende server', { timeout: 120000 }, async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-entdieet-'));
  let { child, base } = await startServer({ env: { RTG_DATA_DIR: TMP, SMTP_URL: '' } });
  const post = (p, b, t) => fetch(base + p, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(t ? { Authorization: 'Bearer ' + t } : {}) }, body: JSON.stringify(b || {}) })
    .then(async (r) => ({ status: r.status, data: await r.json().catch(() => ({})) }));
  try {
    const t = String(Date.now());
    const reg = await post('/api/auth/register', { name: 'Lid ' + t, email: 'ed' + t + '@v.test', phone: '06' + t.slice(-8), password: 'geheim123', geboortedatum: '1980-05-05', tier: 'rtg' });
    await elevateTier(base, reg.data.token, 'lifestyle', (await post('/api/office/login', { code: 'RTG-OFFICE' })).data.token);
    const p = await post('/api/member/rechterhand/entourage/persoon', { naam: 'Reisgenoot Q', band: 'vriend', allergenen: ['lupine'], dieet: 'merkteken-' + t }, reg.data.token);
    assert.equal(p.status, 200);
    assert.equal((await post('/api/member/rechterhand/entourage/persoon', { naam: 'Reisgenoot R', allergenen: ['aardbei'] }, reg.data.token)).status, 400);
    await stopNet(child);
    ({ child, base } = await startServer({ env: { RTG_DATA_DIR: TMP, SMTP_URL: '', RTG_KLOK: '+367d' } }));
    await new Promise((r) => setTimeout(r, 1500));
    await stopNet(child);
    child = null;
    const plekken = [];
    const loop = (map) => { for (const n of fs.readdirSync(map)) { const q = path.join(map, n); const s = fs.statSync(q);
      if (s.isDirectory()) { if (!/backup/i.test(n)) loop(q); } else if (fs.readFileSync(q).includes('merkteken-' + t)) plekken.push(path.relative(TMP, q)); } };
    loop(TMP);
    assert.deepEqual(plekken, [], 'het dieet staat na de termijn nergens meer in de opslag');
  } finally {
    if (child) await stopNet(child);
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
});
