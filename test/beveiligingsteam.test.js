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
/* Het budget telt per KALENDERMAAND (kern/beveiliging/rooster/planning.js:
   d.datum.slice(0,7) === deze maand). Op de laatste dag van een maand valt
   morgen() dus buiten de telling en komt de budgettoets op nul uit -- niet
   omdat het budget kapot is, maar omdat de toets op een dag plande die niet
   meetelt. Vandaar een dag die gegarandeerd in deze maand ligt: morgen als
   dat kan, anders vandaag. planAuto accepteert vandaag net zo goed. */
function dagInDezeMaand() {
  const m = morgen();
  return m.slice(0, 7) === new Date().toISOString().slice(0, 7) ? m : new Date().toISOString().slice(0, 10);
}

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
  const r = await api(base, '/api/supplier/beveiliging/planauto', { datum: dagInDezeMaand() }, mgr);
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

/* ---------------------------------------------------------------------------
   De zeven hieronder wees het routejournaal aan als nooit aangeroepen: post,
   post/weg, rooster, dienst, dienst/weg, incident/beslis en pda/uitklok. De
   handmatige kant van het rooster dus -- alles wat de AI-planner NIET doet.

   Een dag ver genoeg vooruit dat de planner van toets 2 en de aanvraag van
   toets 4 er niet al iemand hebben neergezet; wat hier gemeten wordt is niet
   maand- of weekgebonden, dus de kalender doet er verder niet toe.
   --------------------------------------------------------------------------- */
function overVijfDagen() { return new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10); }
let losPost = null;

test('9. posten beheren: een naam is verplicht, en een bewaker beheert niets', async () => {
  const leeg = await api(base, '/api/supplier/beveiliging/post', { klant: 'Zonder naam' }, mgr);
  assert.equal(leeg.status, 400, 'een post zonder naam is geen post');

  const mk = await api(base, '/api/supplier/beveiliging/post',
    { naam: 'Kade 7', klant: 'Havenbedrijf', adres: 'Puerto de Ibiza', minMan: 2, shifts: ['nacht'], orders: 'Hek sluiten om 23u.' }, mgr);
  assert.equal(mk.status, 200);
  losPost = mk.body.post.id;
  assert.equal(mk.body.post.minMan, 2);
  assert.deepEqual(mk.body.post.shifts, ['nacht'], 'alleen de shifts die bestaan blijven staan');

  // hetzelfde id opnieuw zetten wijzigt de post en maakt er geen tweede
  const bij = await api(base, '/api/supplier/beveiliging/post', { id: losPost, naam: 'Kade 7 noord' }, mgr);
  assert.equal(bij.body.post.id, losPost);
  assert.equal(bij.body.post.klant, 'Havenbedrijf', 'wat niet meegestuurd wordt blijft staan');

  assert.equal((await api(base, '/api/supplier/beveiliging/post/weg', { id: 'bestaatniet' }, mgr)).status, 404);
  // de bewaker heeft een geldige zaak-inlog, maar beheert het rooster niet
  assert.equal((await api(base, '/api/supplier/beveiliging/post', { naam: 'Eigen post' }, guardTok)).status, 403);
  assert.equal((await api(base, '/api/supplier/beveiliging/post/weg', { id: losPost }, guardTok)).status, 403);
});

test('10. het rooster toont de open plekken, en een dienst vult er een', async () => {
  const dag = overVijfDagen();
  const r1 = await api(base, '/api/supplier/beveiliging/rooster', { van: dag, dagen: 2 }, mgr);
  assert.equal(r1.status, 200);
  assert.equal(r1.body.dagen.length, 2, 'het gevraagde aantal dagen');
  const post1 = r1.body.dagen[0].posten.find(p => p.postId === losPost);
  assert.equal(post1.shifts.length, 1, 'de post draait alleen de nachtshift');
  assert.equal(post1.open, 2, 'twee open plekken, want minMan is twee');

  const gid = guards[0].id;
  assert.equal((await api(base, '/api/supplier/beveiliging/dienst', { postId: 'bestaatniet', shiftId: 'nacht', datum: dag, guardId: gid }, mgr)).status, 404);
  assert.equal((await api(base, '/api/supplier/beveiliging/dienst', { postId: losPost, shiftId: 'middag', datum: dag, guardId: gid }, mgr)).status, 400, 'een shift die niet bestaat');
  assert.equal((await api(base, '/api/supplier/beveiliging/dienst', { postId: losPost, shiftId: 'nacht', datum: '5 juni', guardId: gid }, mgr)).status, 400, 'een datum die geen datum is');
  assert.equal((await api(base, '/api/supplier/beveiliging/dienst', { postId: losPost, shiftId: 'nacht', datum: dag, guardId: 999999 }, mgr)).status, 404, 'iemand die niet in het team zit');

  const zet = await api(base, '/api/supplier/beveiliging/dienst', { postId: losPost, shiftId: 'nacht', datum: dag, guardId: gid }, mgr);
  assert.equal(zet.status, 200);
  assert.equal(zet.body.dienst.status, 'gepland');
  assert.equal((await api(base, '/api/supplier/beveiliging/dienst', { postId: losPost, shiftId: 'nacht', datum: dag, guardId: gid }, mgr)).status, 409, 'niemand staat twee keer op dezelfde shift');

  const r2 = await api(base, '/api/supplier/beveiliging/rooster', { van: dag, dagen: 1 }, mgr);
  assert.equal(r2.body.dagen[0].posten.find(p => p.postId === losPost).open, 1, 'er is een plek gevuld');

  // en weer schrappen brengt de open plek terug
  assert.equal((await api(base, '/api/supplier/beveiliging/dienst/weg', { id: zet.body.dienst.id }, mgr)).status, 200);
  const r3 = await api(base, '/api/supplier/beveiliging/rooster', { van: dag, dagen: 1 }, mgr);
  assert.equal(r3.body.dagen[0].posten.find(p => p.postId === losPost).open, 2, 'de plek staat weer open');
  assert.equal((await api(base, '/api/supplier/beveiliging/dienst/weg', { id: 'bestaatniet' }, mgr)).status, 404);
});

test('11. een ingeklokte dienst wordt niet onder de bewaker vandaan geschrapt', async () => {
  /* De bewaker klokte in toets 5 in en staat dus op post. Die dienst schrappen
     zou hem uit het rooster halen terwijl hij er lijfelijk staat -- en niemand
     zou het merken. Eerst uitklokken, dan pas. */
  const mijn = await api(base, '/api/supplier/beveiliging/pda/diensten', {}, guardTok);
  const ingeklokt = mijn.body.diensten.find(d => d.status === 'ingeklokt');
  assert.ok(ingeklokt, 'de bewaker staat ingeklokt op een dienst');

  const teVroeg = await api(base, '/api/supplier/beveiliging/dienst/weg', { id: ingeklokt.id }, mgr);
  assert.equal(teVroeg.status, 409, 'schrappen kan niet zolang hij ingeklokt staat');

  const uit = await api(base, '/api/supplier/beveiliging/pda/uitklok', { id: ingeklokt.id }, guardTok);
  assert.equal(uit.status, 200);
  assert.equal(uit.body.dienst.status, 'afgerond');
  assert.ok(uit.body.dienst.uitklokAt, 'het tijdstip staat erbij');
  assert.equal((await api(base, '/api/supplier/beveiliging/pda/uitklok', { id: 'bestaatniet' }, guardTok)).status, 404);

  assert.equal((await api(base, '/api/supplier/beveiliging/dienst/weg', { id: ingeklokt.id }, mgr)).status, 200, 'na uitklokken kan het wel');
});

test('12. een incident afhandelen en weer openzetten', async () => {
  const cmd = await api(base, '/api/supplier/beveiliging/command', {}, mgr);
  const open = cmd.body.incidenten.find(i => i.status === 'open');
  assert.ok(open, 'er staat een incident open uit toets 7');

  const af = await api(base, '/api/supplier/beveiliging/incident/beslis', { id: open.id }, mgr);
  assert.equal(af.status, 200);
  assert.equal(af.body.status2, 'afgehandeld');
  const na = await api(base, '/api/supplier/beveiliging/command', {}, mgr);
  assert.equal(na.body.incidentenOpen, cmd.body.incidentenOpen - 1, 'de teller loopt terug');

  // dezelfde knop zet hem weer open: een te snel afgevinkt incident is te herstellen
  assert.equal((await api(base, '/api/supplier/beveiliging/incident/beslis', { id: open.id }, mgr)).body.status2, 'open');
  assert.equal((await api(base, '/api/supplier/beveiliging/incident/beslis', { id: 'bestaatniet' }, mgr)).status, 404);
  assert.equal((await api(base, '/api/supplier/beveiliging/incident/beslis', { id: open.id }, guardTok)).status, 403, 'een bewaker sluit zijn eigen melding niet af');
});

test('13. de post opruimen: hij verdwijnt uit het rooster', async () => {
  const voor = await api(base, '/api/supplier/beveiliging/rooster', { van: overVijfDagen(), dagen: 1 }, mgr);
  assert.ok(voor.body.dagen[0].posten.some(p => p.postId === losPost), 'de post staat er nog voordat we hem weghalen');

  assert.equal((await api(base, '/api/supplier/beveiliging/post/weg', { id: losPost }, mgr)).status, 200);
  const r = await api(base, '/api/supplier/beveiliging/rooster', { van: overVijfDagen(), dagen: 1 }, mgr);
  assert.ok(!r.body.dagen[0].posten.some(p => p.postId === losPost), 'de post staat niet meer in het rooster');
  /* En de rest van het rooster staat er nog. Zonder deze regel zou een rooster
     dat plotseling helemaal leeg terugkomt hier groen blijven -- "hij staat er
     niet meer" is dan waar om de verkeerde reden. */
  assert.ok(r.body.dagen[0].posten.length, 'de andere posten staan er nog: het rooster is niet in zijn geheel leeg');
});
