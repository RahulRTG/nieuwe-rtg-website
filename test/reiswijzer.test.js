/* De Reiswijzer: van elk land van de wereld alle reisregels (visum,
   rijrichting, alarmnummer, water, fooi, let-op), automatisch bijgehouden
   door de Regelwacht en automatisch uitgereikt zodra iemand ergens naartoe
   gaat (reisbureau-aanvraag en partnerboeking).
   Draai los: node --experimental-sqlite --test test/reiswijzer.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

const { LANDEN } = require('../server/kern/fiscaal/landen');
const reis = require('../server/kern/reis')({ LANDEN });

test('elk land van de wereld heeft een complete reisrij', () => {
  for (const [cc, l] of Object.entries(LANDEN)) {
    const r = l.reis;
    assert.ok(r, cc + ' heeft reisregels');
    assert.ok(['geen', 'vrij', 'toestemming', 'aankomst', 'evisum', 'visum'].includes(r.visum), cc + ': geldig visumsoort');
    assert.ok(['links', 'rechts'].includes(r.rijden), cc + ': rijrichting');
    assert.ok(/^\d{2,8}$/.test(r.alarm), cc + ': alarmnummer');
    assert.ok(typeof r.water === 'boolean' && r.fooi, cc + ': water en fooi');
  }
});

test('landVind herkent codes, landnamen en bekende bestemmingen in vrije tekst', () => {
  assert.equal(reis.landVind('JP'), 'JP');
  assert.equal(reis.landVind('Ibiza, Spanje'), 'ES');
  assert.equal(reis.landVind('Gstaad'), 'CH');
  assert.equal(reis.landVind('Monaco'), 'MC');
  assert.equal(reis.landVind('een week Bali'), 'ID');
  assert.equal(reis.landVind('Atlantis'), null);
});

test('de reiswijzer geeft alle regels: visum, paspoort, verkeer, alarm, water, fooi, alcohol en let-op', () => {
  const jp = reis.reiswijzer('Tokio');
  assert.equal(jp.code, 'JP');
  assert.equal(jp.rijden, 'links');
  assert.match(jp.visum.tekst, /Visumvrij .* 90 dagen/);
  assert.match(jp.letOp, /fooi/i);
  assert.match(jp.paspoort, /6 maanden/);
  assert.equal(jp.alcoholLeeftijd, 20);
  const us = reis.reiswijzer('US');
  assert.equal(us.visum.soort, 'toestemming');
  assert.equal(us.alarm, '911');
  assert.ok(reis.reiswijzer('Atlantis').error, 'onbekende bestemming geeft een nette fout');
});

test('regelwacht: ook de reisregels worden automatisch bijgewerkt (gevalideerd, herstart-vast)', () => {
  const db = { data: {} };
  const { regelwacht } = require('../server/kern/fiscaal/regelwacht')({ db, save: () => {}, LANDEN, peiljaar: 2025 });
  const uit = regelwacht.pasToe({ landen: { TH: { reis: { dagen: 30, water: true, letOp: 'Nieuwe verblijfsregel' } } } }, 'bron', 'r1');
  assert.equal(uit.landen, 1);
  assert.equal(LANDEN.TH.reis.dagen, 30, 'de verblijfsduur is in place bijgewerkt');
  assert.equal(LANDEN.TH.reis.water, true);
  assert.equal(LANDEN.TH.reis.letOp, 'Nieuwe verblijfsregel');
  const slecht = regelwacht.pasToe({ landen: { TH: { reis: { visum: 'tovervisum', rijden: 'midden', dagen: 999 } } } }, 'bron');
  assert.equal(slecht.landen, 0, 'ongeldige reiswaardes worden geweigerd');
  assert.equal(LANDEN.TH.reis.visum, 'vrij');
  // herstel: de reis-overlay komt na een herstart terug op een verse tabel
  LANDEN.TH.reis.dagen = 60; LANDEN.TH.reis.water = false;
  const tweede = require('../server/kern/fiscaal/regelwacht')({ db, save: () => {}, LANDEN, peiljaar: 2025 });
  tweede.regelwacht.herstelOverlay();
  assert.equal(LANDEN.TH.reis.dagen, 30, 'de reis-overlay staat er na herstel weer op');
  // terug naar de basis zodat andere tests niets merken
  regelwacht.pasToe({ landen: { TH: { reis: { dagen: 60, water: false, letOp: ' ' } } } }, 'bron');
  LANDEN.TH.reis.letOp = '';
});

/* ---- end-to-end: wie ergens naartoe gaat, krijgt de regels automatisch ---- */
let srv, base, lid;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-reis-'));
test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  base = srv.base;
  const l = await (await fetch(base + '/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tier: 'rtg' }) })).json();
  lid = { token: l.token };
});
test.after(() => { stop(srv && srv.child); try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {} });

const api = (pad, body, token) => fetch(base + '/api/' + pad, {
  method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
  body: JSON.stringify(body || {})
}).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));

test('de reiswijzer-API: elk land opvraagbaar, ook voor de gratis app', async () => {
  const w = await api('reis/wijzer', { bestemming: 'Ibiza, Spanje' }, lid.token);
  assert.equal(w.status, 200);
  assert.equal(w.body.code, 'ES');
  assert.ok(w.body.visum.tekst && w.body.alarm === '112' && w.body.fooi);
  const landen = await api('reis/landen', {}, lid.token);
  assert.ok(landen.body.landen.length >= 180, 'alle landen staan in de lijst');
  const gast = await (await fetch(base + '/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tier: 'guest' }) })).json();
  assert.equal((await api('reis/wijzer', { land: 'FR' }, gast.token)).status, 200, 'veilig reizen is er ook voor gasten');
});

test('reisbureau-aanvraag: de boeker krijgt automatisch alle regels van de bestemming mee', async () => {
  const r = await api('reisbureau/boek', { tripId: 'ibiza-jetset', personen: 2 }, lid.token);
  assert.equal(r.status, 200);
  assert.ok(r.body.reiswijzer, 'de reiswijzer reist mee met de boeking');
  assert.equal(r.body.reiswijzer.code, 'ES');
  assert.match(r.body.reiswijzer.visum.tekst, /Geen visum nodig/);
});

test('partnerboeking (niet-lid): ook daar reizen de regels mee', async () => {
  const r = await fetch(base + '/api/book', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tripId: 'gstaad-alpien', name: 'Test Reiziger', email: 'reiziger@test.nl' })
  });
  assert.equal(r.status, 200);
  const d = await r.json();
  assert.ok(d.reiswijzer && d.reiswijzer.code === 'CH', 'Gstaad geeft de regels van Zwitserland');
});
