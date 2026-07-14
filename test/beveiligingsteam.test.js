/* Het beveiligings-commandocentrum voor topbeveiligingsteams: de manager plant
   het rooster (of laat de AI het overnemen), bewaakt het budget, beheert posten
   en handelt inzetaanvragen af; de bewaker gebruikt de PDA (op staffId) om in te
   klokken, te patrouilleren, incidenten te melden en de SOS-knop te gebruiken.
   (Niet te verwarren met server/beveiliging.js: dat is de interne alarmlaag.)
   Draai: npm test */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

function api(base, pad, body, token) {
  const h = { 'Content-Type': 'application/json' };
  if (token) h.Authorization = 'Bearer ' + token;
  return fetch(base + pad, { method: 'POST', headers: h, body: JSON.stringify(body || {}) })
    .then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
}
function morgen() { return new Date(Date.now() + 86400000).toISOString().slice(0, 10); }

let srv, base, mgr, guards = [], guardTok;

test.before(async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-bev-'));
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, DEMO_SUPPLIER: 'AEGIS' } });
  base = srv.base;
  const login = await api(base, '/api/supplier/login', { username: 'rahul', password: 'Imran' });
  mgr = login.body.token;
  guards = (login.body.state.staff || []).filter(x => x.role === 'staff');
  // een bewaker logt persoonlijk in met PIN (staff-pin in de seed = 5678)
  guardTok = (await api(base, '/api/supplier/login', { code: 'AEGIS', staffId: guards[0].id, pin: '5678' })).body.token;
});
test.after(() => stop(srv && srv.child));

test('1. het commandocentrum toont team, posten, budget en veel functies', async () => {
  const r = await api(base, '/api/supplier/beveiliging/command', {}, mgr);
  assert.equal(r.status, 200);
  assert.ok(r.body.team >= 4, 'een ploeg bewakers');
  assert.ok(r.body.posten >= 3, 'de bewaakte objecten');
  assert.ok(r.body.budget && r.body.budget.budgetUren > 0, 'budgetbewaking staat aan');
  assert.ok(Array.isArray(r.body.functies) && r.body.functies.length >= 10, 'veel aan/uit-zetbare functies');
});

test('2. de AI neemt het rooster over en vult open diensten in (met rust)', async () => {
  const r = await api(base, '/api/supplier/beveiliging/planauto', { datum: morgen() }, mgr);
  assert.equal(r.status, 200);
  assert.ok(r.body.gemaakt.length >= 1, 'de AI plande diensten in');
  const seen = new Set();
  for (const d of r.body.gemaakt) {
    const k = d.guardId + '|' + d.shiftId;
    assert.ok(!seen.has(k), 'geen dubbele dienst per shift');
    seen.add(k);
  }
});

test('3. het budget telt de geplande uren en geeft advies', async () => {
  const r = await api(base, '/api/supplier/beveiliging/budget', {}, mgr);
  assert.equal(r.status, 200);
  assert.ok(r.body.budget.urenGepland >= 8, 'geplande uren tellen mee');
  assert.ok(typeof r.body.budget.advies === 'string' && r.body.budget.advies.length > 0);
});

test('4. een inzetaanvraag van een klant kan ingepland worden', async () => {
  const av = await api(base, '/api/supplier/beveiliging/aanvraag',
    { klant: 'Villa Roca', object: 'Villa Roca', datum: morgen(), shiftId: 'nacht', aantal: 2, tekst: 'Weekendbewaking' }, mgr);
  assert.equal(av.status, 200);
  const ref = av.body.aanvraag.ref;
  const lijst = await api(base, '/api/supplier/beveiliging/aanvragen', {}, mgr);
  assert.ok(lijst.body.open.some(a => a.ref === ref), 'de aanvraag staat open');
  const beslis = await api(base, '/api/supplier/beveiliging/aanvraag/beslis', { ref, actie: 'plan' }, mgr);
  assert.equal(beslis.status, 200);
  assert.equal(beslis.body.status2, 'gepland');
  const cmd = await api(base, '/api/supplier/beveiliging/command', {}, mgr);
  assert.ok(cmd.body.posten >= 4, 'de aanvraag werd een bewaakte post');
});

test('5. de bewaker ziet zijn diensten en klokt in op post (PDA)', async () => {
  const mijn = await api(base, '/api/supplier/beveiliging/pda/diensten', {}, guardTok);
  assert.equal(mijn.status, 200);
  assert.ok(mijn.body.diensten.length >= 1, 'de bewaker heeft ingeplande diensten');
  const d = mijn.body.diensten[0];
  const ink = await api(base, '/api/supplier/beveiliging/pda/inklok', { id: d.id, lat: 38.876, lng: 1.383 }, guardTok);
  assert.equal(ink.status, 200);
  assert.equal(ink.body.dienst.status, 'ingeklokt');
});

test('6. een patrouilleronde met checkpoints', async () => {
  const mijn = await api(base, '/api/supplier/beveiliging/pda/diensten', {}, guardTok);
  const postId = mijn.body.diensten[0].postId;
  const start = await api(base, '/api/supplier/beveiliging/pda/ronde/start', { postId }, guardTok);
  assert.equal(start.status, 200);
  const rid = start.body.ronde.id;
  await api(base, '/api/supplier/beveiliging/pda/ronde/checkpoint', { id: rid, naam: 'Achterhek' }, guardTok);
  const cp = await api(base, '/api/supplier/beveiliging/pda/ronde/checkpoint', { id: rid, naam: 'Poolhouse' }, guardTok);
  assert.equal(cp.body.ronde.checkpoints.length, 2, 'twee checkpoints gelopen');
  const klaar = await api(base, '/api/supplier/beveiliging/pda/ronde/klaar', { id: rid }, guardTok);
  assert.ok(klaar.body.ronde.klaar, 'de ronde is afgerond');
});

test('7. incident melden en de SOS-noodknop; het commandocentrum ziet het', async () => {
  const inc = await api(base, '/api/supplier/beveiliging/pda/incident',
    { post: 'Villa Cala Jondal', soort: 'inbraakpoging', ernst: 'hoog', tekst: 'Onbevoegde bij het strandhek.' }, guardTok);
  assert.equal(inc.status, 200);
  assert.equal(inc.body.incident.ernst, 'hoog');
  const sos = await api(base, '/api/supplier/beveiliging/pda/sos', { lat: 38.876, lng: 1.383 }, guardTok);
  assert.equal(sos.status, 200);
  assert.equal(sos.body.incident.sos, true);
  const cmd = await api(base, '/api/supplier/beveiliging/command', {}, mgr);
  assert.equal(cmd.body.sosActief, true, 'het commandocentrum ziet de actieve SOS');
  assert.ok(cmd.body.incidentenOpen >= 2, 'incident + SOS staan open');
});

test('8. een team zet zijn eigen functies aan en uit; de PDA blokkeert een uitgezette functie', async () => {
  const uit = await api(base, '/api/supplier/beveiliging/functie', { id: 'patrouille', aan: false }, mgr);
  assert.equal(uit.status, 200);
  assert.ok(uit.body.functies.find(f => f.id === 'patrouille' && !f.aan), 'patrouille staat uit');
  const mijn = await api(base, '/api/supplier/beveiliging/pda/diensten', {}, guardTok);
  const postId = mijn.body.diensten[0].postId;
  const start = await api(base, '/api/supplier/beveiliging/pda/ronde/start', { postId }, guardTok);
  assert.equal(start.status, 409, 'met patrouille uit kan er geen ronde starten');
});
