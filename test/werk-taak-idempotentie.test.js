/* WorkOS: taakmutaties zijn veilig bij dubbele tikken en netwerkherhaling.

   De browser stuurt een herhaalsleutel, maar de werkruimte bewaart alleen een
   actor-gebonden afdruk. Daardoor kan dezelfde medewerker een verzoek veilig
   herhalen, terwijl een sleutel van een andere medewerker geen taak kaapt. */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { startServer } = require('./helper');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-werk-idem-'));
let base, child, werkruimte, beheerToken, eerste, tweede;

async function post(pad, body) {
  const r = await fetch(base + pad, { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body || {}) });
  return { status: r.status, body: await r.json().catch(() => ({})) };
}

async function projectleider(naam) {
  const a = (await post('/api/bedrijf/lid/aanmeld', { werkruimte, naam })).body;
  await post('/api/bedrijf/lid/besluit', { werkruimte, beheerToken, lidId: a.lidId, akkoord: true });
  await post('/api/bedrijf/lid/rollen', { werkruimte, beheerToken, lidId: a.lidId,
    rollen: ['projectleider'], reden: 'gerichte idempotentietoets' });
  return { werkruimte, lidToken: a.lidToken, lidId: a.lidId };
}

test.before(async () => {
  ({ child, base } = await startServer({ env: { RTG_DATA_DIR: TMP, SMTP_URL: '' } }));
  const w = (await post('/api/bedrijf/werkruimte/maak', { naam: 'Veilig dubbel werk' })).body;
  werkruimte = w.werkruimte;
  beheerToken = w.beheerToken;
  eerste = await projectleider('Eerste medewerker');
  tweede = await projectleider('Tweede medewerker');
});

test.after(() => {
  if (child) try { child.kill('SIGKILL'); } catch (_) {}
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (_) {}
});

test('dezelfde actor en sleutel leveren exact dezelfde taak op', async () => {
  const idem = 'werkos-idem-een-0000000000000001';
  const invoer = Object.assign({ titel: 'Een keer uitvoeren', idem }, eerste);
  const a = await post('/api/bedrijf/taak/maak', invoer);
  const b = await post('/api/bedrijf/taak/maak', invoer);
  const lijst = await post('/api/bedrijf/taken', eerste);

  assert.equal(a.status, 200);
  assert.equal(b.status, 200);
  assert.equal(b.body.herhaald, true);
  assert.equal(a.body.taak.id, b.body.taak.id);
  assert.equal(lijst.body.taken.filter((t) => t.titel === 'Een keer uitvoeren').length, 1);
  assert.doesNotMatch(JSON.stringify(a.body) + JSON.stringify(b.body), new RegExp(idem));
});

test('dezelfde sleutel van een andere actor botst niet', async () => {
  assert.notEqual(eerste.lidId, tweede.lidId, 'de fixture moet twee afzonderlijke leden dragen');
  const idem = 'werkos-idem-gedeeld-00000000000002';
  const a = await post('/api/bedrijf/taak/maak', Object.assign({ titel: 'Werk van een', idem }, eerste));
  const b = await post('/api/bedrijf/taak/maak', Object.assign({ titel: 'Werk van twee', idem }, tweede));
  assert.equal(a.status, 200);
  assert.equal(b.status, 200);
  assert.notEqual(a.body.taak.id, b.body.taak.id,
    JSON.stringify({ eerste, tweede, eersteAntwoord: a.body, tweedeAntwoord: b.body }));
  assert.notEqual(b.body.herhaald, true);
});

test('een andere sleutel is een nieuwe bewuste taak', async () => {
  const a = await post('/api/bedrijf/taak/maak', Object.assign({ titel: 'Bewuste herhaling',
    idem: 'werkos-idem-bewust-000000000000001' }, eerste));
  const b = await post('/api/bedrijf/taak/maak', Object.assign({ titel: 'Bewuste herhaling',
    idem: 'werkos-idem-bewust-000000000000002' }, eerste));
  assert.equal(a.status, 200);
  assert.equal(b.status, 200);
  assert.notEqual(a.body.taak.id, b.body.taak.id);
});

test('ongeldige sleutels worden geweigerd en ruwe sleutels landen niet in opslag', async () => {
  const kort = await post('/api/bedrijf/taak/maak', Object.assign({ titel: 'Mag niet', idem: 'te-kort' }, eerste));
  assert.equal(kort.status, 400);
  assert.match(kort.body.error, /herhaalsleutel/i);

  const bestanden = [];
  (function lees(map) {
    for (const e of fs.readdirSync(map, { withFileTypes: true })) {
      const p = path.join(map, e.name);
      if (e.isDirectory()) lees(p); else bestanden.push(p);
    }
  })(TMP);
  const opslag = bestanden.map((p) => fs.readFileSync(p)).join('\n');
  assert.doesNotMatch(opslag, /werkos-idem-(een|gedeeld|bewust)-/,
    'alleen een hash van de herhaalsleutel mag worden bewaard');
});
