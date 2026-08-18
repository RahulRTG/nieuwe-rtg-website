/* RTF-golf 5: het gezinsalbum -- het babyboekje op Galerij-niveau.
   Maandgroepen en de terugblik (zelfde maand, eerdere jaren), het gedeelde
   favorieten-hartje, en de eerlijke dagklem: een oude foto mag op zijn
   echte dag het boekje in, nooit op een dag die nog moet komen.
   Draai los: node --test test/rtfalbum.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer } = require('./helper');

let BASE;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtf-album-'));
let child;

const api = (pad, body) => fetch(BASE + '/api/foundation' + pad, {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) })
  .then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
const baby = (actie, body) => fetch(BASE + '/api/rtf/baby/' + actie, {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) })
  .then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
const dag = n => { const d = new Date(Date.now() + n * 86400000);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };

let g, ouder, kind, gast;

test.before(async () => {
  ({ child, base: BASE } = await startServer({ env: { RTG_DATA_DIR: TMP, SMTP_URL: '' }, wachtPad: '/api/foundation/health' }));
  const gz = await api('/gezin/maak', { gezinsnaam: 'Fam Album', naam: 'Mam', pin: '1234' });
  g = gz.body;
  ouder = { code: g.code, token: g.token };
  const k = await api('/gezin/profiel/maak', Object.assign({}, ouder, { naam: 'Bo', rol: 'kind', groep: 'kind' }));
  kind = { code: g.code, token: (await api('/gezin/profiel/kies', { code: g.code, profielId: k.body.profiel.id })).body.token };
  const ga = await api('/gezin/profiel/maak', Object.assign({}, ouder, { naam: 'Oppas Jet', rol: 'gast' }));
  gast = { code: g.code, token: (await api('/gezin/profiel/kies', { code: g.code, profielId: ga.body.profiel.id })).body.token };
  await baby('instellen', Object.assign({}, ouder, { kindNaam: 'Fien', geboren: '2025-11-05' }));
});
test.after(() => {
  if (child) try { child.kill('SIGKILL'); } catch (e) {}
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('1. de tijdlijn groepeert per maand, de terugblik kent de eerdere jaren, en de dagklem is eerlijk', async () => {
  await baby('entry-maak', Object.assign({}, ouder, { tekst: 'Eerste hapje appel' }));
  // een oude foto op zijn echte dag: precies een jaar terug (zelfde maand)
  const oud = dag(0).replace(/^\d{4}/, y => String(Number(dag(0).slice(0, 4)) - 1));
  await baby('entry-maak', Object.assign({}, ouder, { tekst: 'Toen nog zo klein', dag: oud }));
  // een dag die nog moet komen wordt gewoon vandaag
  const morgen = await baby('entry-maak', Object.assign({}, ouder, { tekst: 'Uit de toekomst?', dag: dag(2) }));
  assert.equal(morgen.body.entry.dag, dag(0), 'de toekomst klemt eerlijk op vandaag');
  const t = await baby('tijdlijn', ouder);
  assert.ok(t.body.ok);
  assert.equal(t.body.maanden[0].maand, dag(0).slice(0, 7), 'de nieuwste maand staat bovenaan');
  assert.ok(t.body.maanden.some(m => m.maand === oud.slice(0, 7)), 'de oude maand heeft zijn eigen groep');
  assert.ok(t.body.terugblik.find(e => e.tekst === 'Toen nog zo klein'),
    'de terugblik: dezelfde maand, een jaar eerder -- net als de RTG Galerij');
});

test('2. het hartje is van het gezin samen: iedereen telt mee, en mijnFav is per kijker', async () => {
  const t = await baby('tijdlijn', ouder);
  const e = t.body.maanden[0].items.find(x => x.tekst === 'Eerste hapje appel');
  const f1 = await baby('favoriet', Object.assign({}, ouder, { id: e.id }));
  assert.deepEqual([f1.body.fav, f1.body.mijnFav], [1, true]);
  const f2 = await baby('favoriet', Object.assign({}, kind, { id: e.id }));
  assert.equal(f2.body.fav, 2, 'twee hartjes van twee gezinsleden');
  // de ouder haalt zijn hartje weg; dat van het kind blijft staan
  const f3 = await baby('favoriet', Object.assign({}, ouder, { id: e.id }));
  assert.deepEqual([f3.body.fav, f3.body.mijnFav], [1, false]);
  const tk = await baby('tijdlijn', kind);
  const ek = tk.body.maanden[0].items.find(x => x.id === e.id);
  assert.deepEqual([ek.fav, ek.mijnFav], [1, true], 'het kind ziet zijn eigen hartje nog gevuld');
});

test('3. het album is van het gezin zelf: een gast komt er niet in', async () => {
  assert.equal((await baby('tijdlijn', gast)).status, 403);
  assert.equal((await baby('favoriet', Object.assign({}, gast, { id: 'x' }))).status, 403);
});
