/* De Stadsraad: per stad EEN invloedrijke partner (foundation/club/instelling)
   die met een eigen raadcode het gezamenlijke foundation-kantoor in mag en
   daar SAMEN met RTG-personeel beslist over de lab-uitslagen. Grenzen: de
   partner ziet alleen rtf/samen-uitslagen (RTG-bedrijfswerk blijft dicht) en
   een besluit valt pas als beide kanten gestemd hebben.
   Draai los: node --test test/stadsraad.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer } = require('./helper');

let BASE, office, raadcode, projectId;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-stadsraad-'));
let child;

function api(pad, body, token) {
  const h = { 'Content-Type': 'application/json' };
  if (token) h.Authorization = 'Bearer ' + token;
  return fetch(BASE + pad, { method: 'POST', headers: h, body: JSON.stringify(body || {}) });
}
const json = r => r.json();

test.before(async () => {
  ({ child, base: BASE } = await startServer({ env: { RTG_DATA_DIR: TMP, SMTP_URL: '' } }));
  office = (await json(await api('/api/office/login', { code: 'RTG-OFFICE' }))).token;
  // een samen-project MET uitslag (bevinding) en een besloten RTG-project:
  // alleen het eerste hoort op de raadstafel te liggen
  const samen = await json(await api('/api/lab/project/maak', { titel: 'Schoon water voor het dorp', veld: 'water', voorWie: 'samen', doel: 'Betaalbare waterfilters voor elk huishouden.' }, office));
  projectId = samen.project.id;
  await api('/api/lab/project/bevinding', { id: projectId, titel: 'Filterontwerp werkt', tekst: 'Het keramische filter haalt 99 procent van de vervuiling weg.' }, office);
  const prive = await json(await api('/api/lab/project/maak', { titel: 'Geheime RTG-motor', veld: 'hardware', voorWie: 'rtg', doel: 'Besloten bedrijfswerk.' }, office));
  await api('/api/lab/project/bevinding', { id: prive.project.id, titel: 'Prototype draait', tekst: 'Interne bevinding.' }, office);
});
test.after(() => {
  if (child) try { child.kill('SIGKILL'); } catch (e) {}
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('per stad precies een invloedrijke partner, met een eigen raadcode', async () => {
  const p = await json(await api('/api/rtfkantoor/stadsraad/partner-maak', { stad: 'Rotterdam', naam: 'Stichting Havenlicht', soort: 'foundation' }, office));
  assert.ok(p.partner.code.startsWith('RAAD-'), 'de partner krijgt een raadcode');
  raadcode = p.partner.code;
  const dubbel = await api('/api/rtfkantoor/stadsraad/partner-maak', { stad: 'rotterdam', naam: 'Nog een club' }, office);
  assert.equal(dubbel.status, 409, 'een stad heeft precies een stadspartner');
  assert.equal((await api('/api/rtf/partner/raad', { code: 'RAAD-BESTAATNIET' })).status, 404);
});

test('de raadstafel: rtf/samen-uitslagen wel, besloten RTG-werk nooit', async () => {
  const raad = await json(await api('/api/rtf/partner/raad', { code: raadcode }));
  assert.ok(raad.uitslagen.some(u => u.id === projectId), 'de samen-uitslag ligt op tafel');
  const str = JSON.stringify(raad);
  assert.ok(!str.includes('Geheime RTG-motor'), 'het besloten RTG-project blijft dicht');
  assert.ok(!str.includes('Interne bevinding'), 'ook de interne bevinding lekt niet');
  assert.equal(raad.partner.stad, 'Rotterdam');
});

test('samen beslissen: het besluit valt pas als beide kanten gestemd hebben', async () => {
  const b = await json(await api('/api/rtf/partner/besluit-start', { code: raadcode, projectId, voorstel: 'De filterkennis delen met heel Rotterdam.' }));
  assert.equal(b.besluit.status, 'open');
  const bid = b.besluit.id;
  // een kant alleen krijgt het besluit niet dicht
  assert.equal((await api('/api/rtfkantoor/stadsraad/besluit-sluit', { besluitId: bid }, office)).status, 409, 'beide kanten stemmen eerst');
  await api('/api/rtfkantoor/stadsraad/stem', { besluitId: bid, naam: 'Kantoor Zuid', voor: true }, office);
  assert.equal((await api('/api/rtfkantoor/stadsraad/besluit-sluit', { besluitId: bid }, office)).status, 409, 'de partner heeft nog niet gestemd');
  await api('/api/rtf/partner/stem', { code: raadcode, besluitId: bid, voor: true });
  const dubbel = await api('/api/rtf/partner/stem', { code: raadcode, besluitId: bid, voor: true });
  assert.equal(dubbel.status, 409, 'een stem per kant en naam');
  const dicht = await json(await api('/api/rtf/partner/besluit-sluit', { code: raadcode, besluitId: bid }));
  assert.equal(dicht.besluit.status, 'aangenomen');
  assert.equal(dicht.besluit.uitslag, 'RTG 1-0, partners 1-0');
  // over een uitslag die niet op tafel ligt, valt niets te besluiten
  assert.equal((await api('/api/rtf/partner/besluit-start', { code: raadcode, projectId: 'nep', voorstel: 'Toch iets beslissen hier.' })).status, 404);
});
