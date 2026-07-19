/* Het gezamenlijke rampbeeld: korpsen, zorg en defensie delen tijdens een
   calamiteit hun paraatheid, vrije bedden en eenheden in een overzicht, met
   een coordinatieniveau. Een korps ziet de eigen keten-partners, de
   boardroom ziet alles. Draai los:
   node --experimental-sqlite --test test/rampbeeld.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

let srv, base, office;
const tok = {};
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-ramp-'));

function api(pad, body, token) {
  const h = { 'Content-Type': 'application/json' };
  if (token) h.Authorization = 'Bearer ' + token;
  return fetch(base + pad, { method: 'POST', headers: h, body: JSON.stringify(body || {}) })
    .then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
}
async function login(code, pin) {
  const roster = await api('/api/supplier/roster', { code });
  const chef = roster.body.staff.find(m => m.role === 'manager');
  const r = await api('/api/supplier/login', { code, staffId: chef.id, pin });
  return r.body.token;
}

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  base = srv.base;
  office = (await api('/api/office/login', { code: 'RTG-OFFICE' })).body.token;
  for (const c of ['GUARDIA', 'URGENCIA', 'CANMISSES', 'GARNIZOEN']) tok[c] = await login(c, '1234');
  // een keten opbouwen: politie <-> ambulance <-> ziekenhuis <-> defensie
  await api('/api/supplier/keten/verzoek', { korps: 'URGENCIA' }, tok.GUARDIA);
  await api('/api/supplier/keten/beslis', { korps: 'GUARDIA', akkoord: true }, tok.URGENCIA);
  await api('/api/supplier/keten/verzoek', { korps: 'CANMISSES' }, tok.URGENCIA);
  await api('/api/supplier/keten/beslis', { korps: 'URGENCIA', akkoord: true }, tok.CANMISSES);
  await api('/api/supplier/keten/verzoek', { korps: 'GARNIZOEN' }, tok.URGENCIA);
  await api('/api/supplier/keten/beslis', { korps: 'URGENCIA', akkoord: true }, tok.GARNIZOEN);
});
test.after(() => {
  stop(srv && srv.child);
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('1. een korps ziet het gedeelde rampbeeld van de eigen keten-partners', async () => {
  const b = await api('/api/supplier/keten/rampbeeld', {}, tok.URGENCIA);
  assert.equal(b.status, 200);
  assert.ok(b.body.korpsen.some(k => k.code === 'GUARDIA'), 'de politie staat in het beeld van de ambulance');
  assert.ok(b.body.ziekenhuizen.some(z => z.code === 'CANMISSES'), 'het ziekenhuis met vrije bedden');
  assert.ok(b.body.defensie.some(d => d.code === 'GARNIZOEN'), 'en defensie met paraatheid');
  assert.ok(b.body.totalen.eenhedenVrij >= 1, 'de vrije eenheden zijn opgeteld');
  assert.ok(b.body.totalen.beddenVrij >= 1, 'en de vrije bedden');
});

test('2. het beeld beweegt live mee: een ingezette eenheid en een bezet bed tellen anders', async () => {
  const voor = await api('/api/supplier/keten/rampbeeld', {}, tok.GUARDIA);
  const vrijVoor = voor.body.totalen.eenhedenVrij;
  // de politie zet een melding uit en stuurt een eenheid
  const m = await api('/api/supplier/hulp/melding/maak', { tekst: 'Grote calamiteit', prio: 1 }, tok.GUARDIA);
  const bord = await api('/api/supplier/hulp/overzicht', {}, tok.GUARDIA);
  const e = bord.body.eenheden.find(x => x.status === 'vrij');
  await api('/api/supplier/hulp/melding/wijs', { melding: m.body.melding.id, eenheid: e.id }, tok.GUARDIA);
  const na = await api('/api/supplier/keten/rampbeeld', {}, tok.GUARDIA);
  assert.equal(na.body.totalen.eenhedenVrij, vrijVoor - 1, 'een vrije eenheid minder');
  assert.ok(na.body.totalen.eenhedenIngezet >= 1, 'en een ingezette erbij');
  assert.ok(na.body.totalen.meldingenOpen >= 1, 'de open melding telt mee');
});

test('3. op- en afschalen: het coordinatieniveau geldt voor de hele keten', async () => {
  const op = await api('/api/supplier/keten/rampbeeld/schaal', { niveau: 'ramp' }, tok.URGENCIA);
  assert.equal(op.status, 200);
  assert.equal(op.body.ramp.niveau, 'ramp');
  const bijBrandweer = await api('/api/supplier/keten/rampbeeld', {}, tok.GUARDIA);
  assert.equal(bijBrandweer.body.ramp.niveau, 'ramp', 'de politie ziet hetzelfde niveau');
  assert.equal((await api('/api/supplier/keten/rampbeeld/schaal', { niveau: 'onzin' }, tok.URGENCIA)).status, 400);
  await api('/api/supplier/keten/rampbeeld/schaal', { niveau: 'normaal' }, tok.URGENCIA);
});

test('4. de boardroom ziet het volledige rampbeeld over alle korpsen heen', async () => {
  const b = await api('/api/office/rampbeeld', {}, office);
  assert.equal(b.status, 200);
  // de boardroom ziet ook korpsen die (nog) niet in de keten zitten, zoals de brandweer
  assert.ok(b.body.korpsen.some(k => k.code === 'BOMBERS'), 'de brandweer staat in het boardroom-beeld');
  assert.equal((await api('/api/office/rampbeeld/schaal', { niveau: 'opgeschaald', naam: 'boardroom' }, office)).body.ramp.niveau, 'opgeschaald');
  await api('/api/office/rampbeeld/schaal', { niveau: 'normaal', naam: 'boardroom' }, office);
});

test('5. de AI-coordinator doet concrete voorstellen, maar voert niets uit', async () => {
  // een open melding zonder eenheid moet in de voorstellen komen
  await api('/api/supplier/hulp/melding/maak', { tekst: 'Instorting, meerdere gewonden', plek: 'Dalt Vila', prio: 1 }, tok.URGENCIA);
  const r = await api('/api/supplier/keten/rampbeeld/ai', {}, tok.URGENCIA);
  assert.equal(r.status, 200);
  assert.ok(Array.isArray(r.body.voorstellen) && r.body.voorstellen.length, 'er zijn concrete voorstellen');
  assert.ok(r.body.antwoord.length > 15, 'en een leesbaar advies');
  assert.match(JSON.stringify(r.body.voorstellen), /Instorting|ziekenhuis|eenheid|bijstand/i, 'het voorstel gaat over de open melding of de inzet');
  // de coordinator wijst NIETS toe: de melding blijft onbemand tot een mens hem toewijst
  const bord = await api('/api/supplier/hulp/overzicht', {}, tok.URGENCIA);
  const nog = bord.body.meldingen.find(m => /Instorting/.test(m.tekst));
  assert.equal(nog.eenheidId, null, 'de coordinator heeft niets zelf toegewezen');
  // de boardroom kan de coordinator ook raadplegen
  assert.equal((await api('/api/office/rampbeeld/ai', {}, office)).status, 200);
});

test('6. de grens: zonder keten geen rampbeeld, en geen andere zaak dan hulp/zorg/defensie', async () => {
  // een vers korps zonder verbindingen krijgt 409
  const bombers = await login('BOMBERS', '1234');
  assert.equal((await api('/api/supplier/keten/rampbeeld', {}, bombers)).status, 409);
  // een restaurant hoort er helemaal niet bij
  const kik = await api('/api/supplier/login', { username: 'rahul', password: 'Imran' });
  assert.equal((await api('/api/supplier/keten/rampbeeld', {}, kik.body.token)).status, 403);
});
