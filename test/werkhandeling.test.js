/* HANDELEN VIA DE COMMANDOBALK -- de keten, en de vijf plekken waar hij breekt.

   De balk mocht zoeken en openen; handelen niet, met de reden dat een machine
   die iets verandert in een werksysteem een actiebon en een bevestigingsmodel
   nodig heeft. Dit toetst of die twee er ook echt zijn.

     bedoeling -> plan -> geraakte objecten -> rechtencontrole -> BEVESTIGING
     door een mens -> uitvoering -> actiebon

   Vijf beweringen, en ze gaan alle vijf over wat er NIET gebeurt:

   1. Plannen verandert niets. Toets 2 legt de hele werkruimte voor en na naast
      elkaar; er mag geen byte verschillen.
   2. Zonder de bevestigingscode gebeurt er niets.
   3. Het recht wordt bij de UITVOERING opnieuw gerekend. Een plan dat is
      gemaakt toen je het recht nog had, is daarna niet meer uitvoerbaar.
   4. Een plan is van een persoon en voor een keer.
   5. Wat de zeef niet begrijpt, wordt geen plan -- er komt geen gok.

   Draai los: node --experimental-sqlite --test test/werkhandeling.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-handeling-'));
let srv, base, ruimte, beheer, lidId, lidToken, tweedeToken;

/* De volle route in elke aanroep, en niet `base + '/api/bedrijf' + pad`. Dat
   scheelt tekens maar maakt de route onvindbaar voor de dekkingsteller in
   scripts/lib/routedekking.js -- en dan telt een endpoint dat WEL getoetst is
   als ongedekt. Een meter die door plakwerk misleid wordt, meet niet. */
function api(pad, body) {
  return fetch(base + pad, { method: 'POST',
    headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) })
    .then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
}
const S = () => ({ werkruimte: ruimte, lidToken });
const beheerS = () => ({ werkruimte: ruimte, beheerToken: beheer });

/* De hele werkruimte als tekst: de enige eerlijke manier om te toetsen dat
   plannen NIETS verandert. Een paar velden vergelijken mist precies de
   bijwerking die je niet had voorzien. */
async function afdruk() {
  const uit = await fetch(base + '/api/tenant/export', { method: 'POST',
    headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(beheerS()) })
    .then(r => r.json());
  const inhoud = JSON.parse(JSON.stringify(uit.inhoud || {}));
  /* Zes bakken bewegen door de TOETS zelf en zeggen dus niets: de plannen (dat
     IS het voornemen), het journaal, de bonnen, de leden (een toets zet rollen
     om en terug) en de twee bakken van de gebeurtenislaag, die diezelfde
     rolwissel netjes vastleggen. Al het andere hoort onaangeroerd te blijven --
     door ALLES te vergelijken behalve die zes vangt deze afdruk ook een
     bijwerking in een bak waar niemand aan dacht. */
  for (const k of ['handelplannen', 'journaal', 'actiebonnen', 'leden',
    'gebeurtenissen', 'gebeurtenisStand']) delete inhoud[k];
  return JSON.stringify(inhoud);
}

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  base = srv.base;
  const w = await api('/api/bedrijf/werkruimte/maak', { naam: 'Handelbedrijf' });
  ruimte = w.body.werkruimte; beheer = w.body.beheerToken;

  const l = await api('/api/bedrijf/lid/aanmeld', { werkruimte: ruimte, naam: 'Pia' });
  lidId = l.body.lidId; lidToken = l.body.lidToken;
  await api('/api/bedrijf/lid/besluit', { ...beheerS(), lidId, akkoord: true });
  await api('/api/bedrijf/lid/rollen', { ...beheerS(), lidId, rollen: ['projectleider', 'service'] });

  const t = await api('/api/bedrijf/lid/aanmeld', { werkruimte: ruimte, naam: 'Tweede' });
  tweedeToken = t.body.lidToken;
  await api('/api/bedrijf/lid/besluit', { ...beheerS(), lidId: t.body.lidId, akkoord: true });
  await api('/api/bedrijf/lid/rollen', { ...beheerS(), lidId: t.body.lidId, rollen: ['projectleider'] });
});
test.after(() => {
  stop(srv && srv.child);
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('1. wat de zeef niet begrijpt, wordt geen plan', async () => {
  const r = await api('/api/bedrijf/handeling/plan', { ...S(), bedoeling: 'regel even iets met de klanten' });
  assert.equal(r.status, 200);
  assert.equal(r.body.plan, null, 'geen gok');
  assert.match(r.body.let, /begrijp ik niet/);
  assert.match(r.body.let, /een taak aanmaken/, 'en het zegt wat het wel kan');

  const leeg = await api('/api/bedrijf/handeling/plan', { ...S(), bedoeling: '' });
  assert.equal(leeg.status, 400);
});

test('2. plannen verandert niets aan de werkruimte', async () => {
  const voor = await afdruk();
  const r = await api('/api/bedrijf/handeling/plan', { ...S(), bedoeling: 'maak een taak Dakgoot vervangen' });
  assert.equal(r.status, 200);
  assert.ok(r.body.plan.id, 'er is een voornemen');
  assert.match(r.body.plan.samenvatting, /Dakgoot vervangen/);
  assert.deepEqual(r.body.plan.raakt, [{ soort: 'taak', wat: 'er komt er een bij' }]);
  assert.match(r.body.let, /Er is nog NIETS gebeurd/);

  const na = await afdruk();
  assert.equal(na, voor, 'geen byte verschil in het werk van deze werkruimte');
});

test('3. zonder de bevestigingscode gebeurt er niets', async () => {
  const plan = (await api('/api/bedrijf/handeling/plan', { ...S(), bedoeling: 'maak een taak Kozijnen schilderen' })).body.plan;
  const voor = await afdruk();

  const zonder = await api('/api/bedrijf/handeling/doe', { ...S(), planId: plan.id });
  assert.equal(zonder.status, 400);
  assert.match(zonder.body.error, /bevestigen doet een mens/);

  const fout = await api('/api/bedrijf/handeling/doe', { ...S(), planId: plan.id, bevestiging: 'raden-maar' });
  assert.equal(fout.status, 400);
  assert.equal(await afdruk(), voor, 'en er is nog steeds niets veranderd');

  const goed = await api('/api/bedrijf/handeling/doe', { ...S(), planId: plan.id, bevestiging: plan.bevestiging });
  assert.equal(goed.status, 200);
  assert.equal(goed.body.resultaat.titel, 'Kozijnen schilderen');
  assert.equal(goed.body.resultaat.kolom, 'te doen');
  assert.notEqual(await afdruk(), voor, 'nu wel');

  /* DE ACTIEBON. Wat er is gebeurd, op wiens gezag, met welk recht, en wat
     eruit kwam -- en hij staat ook in het journaal. */
  const bon = goed.body.actiebon;
  assert.equal(bon.handeling, 'taak.maak');
  assert.equal(bon.bedoeling, 'maak een taak Kozijnen schilderen');
  assert.equal(bon.recht, 'project');
  assert.equal(bon.door, 'Pia');
  assert.equal(bon.gelukt, true);
  assert.equal(bon.resultaat.soort, 'taak');
  assert.ok(bon.gepland && bon.uitgevoerd, 'met beide momenten erin');

  const journaal = await api('/api/bedrijf/journaal', { ...beheerS(), reden: 'toets' });
  assert.ok((journaal.body.regels || []).some(r => r.wat === 'handeling:taak.maak'),
    'de handeling staat in het journaal van de werkruimte');
});

test('4. een plan is voor EEN keer, en van EEN persoon', async () => {
  const plan = (await api('/api/bedrijf/handeling/plan', { ...S(), bedoeling: 'taak: Ramen lappen' })).body.plan;

  const ander = await api('/api/bedrijf/handeling/doe',
    { werkruimte: ruimte, lidToken: tweedeToken, planId: plan.id, bevestiging: plan.bevestiging });
  assert.equal(ander.status, 403, 'de code van een ander werkt niet');
  assert.match(ander.body.error, /van iemand anders/);

  assert.equal((await api('/api/bedrijf/handeling/doe', { ...S(), planId: plan.id, bevestiging: plan.bevestiging })).status, 200);
  const opnieuw = await api('/api/bedrijf/handeling/doe', { ...S(), planId: plan.id, bevestiging: plan.bevestiging });
  assert.equal(opnieuw.status, 404, 'een tweede keer bestaat het voornemen niet meer');
});

test('5. het recht wordt bij de UITVOERING opnieuw gerekend', async () => {
  const plan = (await api('/api/bedrijf/handeling/plan', { ...S(), bedoeling: 'maak een taak Tuin snoeien' })).body.plan;
  assert.ok(plan, 'met de rol projectleider mag dit');
  const voor = await afdruk();

  /* De rol wordt ingetrokken NA het plan en VOOR de bevestiging. Zou het recht
     alleen bij het plan gerekend worden, dan overleeft een tijdelijke rol zijn
     eigen einddatum -- en dan is tijdelijke toegang permanent. */
  await api('/api/bedrijf/lid/rollen', { ...beheerS(), lidId, rollen: ['extern'] });

  const na = await api('/api/bedrijf/handeling/doe', { ...S(), planId: plan.id, bevestiging: plan.bevestiging });
  assert.equal(na.status, 403);
  assert.match(na.body.error, /nu niet meer/);
  assert.match(na.body.error, /niets uitgevoerd/);
  assert.equal(await afdruk(), voor, 'en er is inderdaad niets uitgevoerd');

  await api('/api/bedrijf/lid/rollen', { ...beheerS(), lidId, rollen: ['projectleider', 'service'] });
});

test('6. zonder het recht komt er geen knop, en de bonnen zeggen wat de balk kan', async () => {
  await api('/api/bedrijf/lid/rollen', { ...beheerS(), lidId, rollen: ['hr'] });
  const geweigerd = await api('/api/bedrijf/handeling/plan', { ...S(), bedoeling: 'maak een taak Iets' });
  assert.equal(geweigerd.status, 403);
  assert.equal(geweigerd.body.recht, 'project', 'met het recht dat ontbreekt erbij');
  assert.equal(geweigerd.body.plan, null, 'en geen voornemen om te bevestigen');
  await api('/api/bedrijf/lid/rollen', { ...beheerS(), lidId, rollen: ['projectleider', 'service'] });

  const bonnen = await api('/api/bedrijf/handeling/bonnen', S());
  assert.equal(bonnen.status, 200);
  assert.ok(bonnen.body.aantal >= 2, 'de eerdere uitvoeringen staan er');
  assert.deepEqual(bonnen.body.kan.map(k => k.id).sort(), ['taak.maak', 'ticket.maak'],
    'de lijst is gesloten: er is geen algemene uitvoerknop');
  for (const k of bonnen.body.kan) assert.ok(k.recht, k.id + ' hangt aan een recht');
});

test('7. de bevestigingscode komt nooit in de uitvoer van een vertrekkende klant', async () => {
  const plan = (await api('/api/bedrijf/handeling/plan', { ...S(), bedoeling: 'ticket: Storing in de lift' })).body.plan;
  const uit = await fetch(base + '/api/tenant/export', { method: 'POST',
    headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(beheerS()) }).then(r => r.json());

  /* Het geheim heet met opzet `token`, want dat is de naam die de uitvoerlaag
     eruit haalt. Deze toets is de reden dat die keuze geen toeval mag zijn. */
  assert.ok(!JSON.stringify(uit).includes(plan.bevestiging), 'de code staat niet in de export');
  assert.ok(uit.inhoud.handelplannen, 'het voornemen zelf staat er wel -- dat is gewoon werk');
});
