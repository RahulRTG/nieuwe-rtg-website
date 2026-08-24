/* DE GEVOLGSIMULATIE -- wat blijft er open als deze wijziging doorgaat.

   Dit is de laag die ik eerst NIET wilde bouwen, met het argument dat het
   dossier de vraag al beantwoordt. Dat argument klopte niet, en het verschil is
   precies wat deze toets vastlegt: het dossier kijkt naar BINNEN (wat hoort bij
   dit object, wie verwijst ernaar), en dit kijkt VOORUIT (wat breekt er als het
   weg is). Toets 2 laat dat zien met een taak van iemand anders die op werk van
   de vertrekker wacht -- die staat in geen enkel dossier van de vertrekker, en
   valt straks wel stil.

   Vier beweringen:

   1. Simuleren verandert niets. Geen enkele tak schrijft.
   2. `blijftOpen` is het deel dat ertoe doet, en het bevat dingen die de graaf
      niet oplevert.
   3. De simulatie volgt de rechten, net als de rest van het Werk OS.
   4. Wat er niet gerekend wordt, staat er met naam en reden.

   Draai los: node --experimental-sqlite --test test/werkgevolg.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-gevolg-'));
let srv, base, ruimte, beheer, pia, hakim, project, taakVanPia;

/* De volle route in elke aanroep, en niet `base + '/api/bedrijf' + pad`. Dat
   scheelt tekens maar maakt de route onvindbaar voor de dekkingsteller in
   scripts/lib/routedekking.js -- en dan telt een endpoint dat WEL getoetst is
   als ongedekt. Een meter die door plakwerk misleid wordt, meet niet. */
function api(pad, body) {
  return fetch(base + pad, { method: 'POST',
    headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) })
    .then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
}
const beheerS = () => ({ werkruimte: ruimte, beheerToken: beheer });

async function afdruk() {
  const uit = await fetch(base + '/api/tenant/export', { method: 'POST',
    headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(beheerS()) }).then(r => r.json());
  const inhoud = JSON.parse(JSON.stringify(uit.inhoud || {}));
  delete inhoud.journaal;                       // een inzage met reden hoort in het journaal
  return JSON.stringify(inhoud);
}

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  base = srv.base;
  const w = await api('/api/bedrijf/werkruimte/maak', { naam: 'Gevolgbedrijf' });
  ruimte = w.body.werkruimte; beheer = w.body.beheerToken;

  const maakLid = async (naam, rollen) => {
    const l = await api('/api/bedrijf/lid/aanmeld', { werkruimte: ruimte, naam });
    await api('/api/bedrijf/lid/besluit', { ...beheerS(), lidId: l.body.lidId, akkoord: true });
    await api('/api/bedrijf/lid/rollen', { ...beheerS(), lidId: l.body.lidId, rollen });
    return { id: l.body.lidId, token: l.body.lidToken, naam };
  };
  pia = await maakLid('Pia', ['projectleider', 'service', 'jurist']);
  hakim = await maakLid('Hakim', ['projectleider']);

  const S = { werkruimte: ruimte, lidToken: pia.token };
  project = (await api('/api/bedrijf/project/maak', { ...S, naam: 'Uitrol Utrecht', werkvorm: 'stadsuitrol' })).body.project;

  /* De opstelling die het punt maakt: een taak van Pia, en een taak van Hakim
     die daarop WACHT. Als Pia weggaat valt die van Hakim stil -- en dat staat
     in geen enkel dossier van Pia. */
  taakVanPia = (await api('/api/bedrijf/taak/maak', { ...S, titel: 'Vergunning aanvragen',
    projectId: project.id, wie: 'Pia' })).body.taak;
  const vanHakim = (await api('/api/bedrijf/taak/maak', { ...S, titel: 'Opening plannen',
    projectId: project.id, wie: 'Hakim' })).body.taak;
  await api('/api/bedrijf/taak/wacht-op', { ...S, taakId: vanHakim.id, wachtOpId: taakVanPia.id });

  await api('/api/bedrijf/kennis/schrijf', { ...S, titel: 'Hoe wij aanbesteden', eigenaar: 'Pia', tekst: 'Zo dus.' });
  await api('/api/bedrijf/ticket/maak', { ...S, onderwerp: 'Lift blijft steken', wie: 'Pia' });

  /* Een besluit dat in stemming staat en waar Pia nog niet heeft gestemd.
     Dit is de rij die toets 3 NIET mag zien: Hakim heeft het recht `besluit`
     niet. */
  const b = (await api('/api/bedrijf/besluit/maak', { ...S, titel: 'Kantoor verhuizen',
    onderbouwing: 'De huur loopt af.' })).body.besluit;
  await api('/api/bedrijf/besluit/stemronde', { ...S, besluitId: b.id });
});
test.after(() => {
  stop(srv && srv.child);
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('1. simuleren verandert niets', async () => {
  const S = { werkruimte: ruimte, lidToken: pia.token };
  const voor = await afdruk();
  const r = await api('/api/bedrijf/gevolg', { ...S, wijziging: 'lid.uit-dienst', lidId: pia.id });
  assert.equal(r.status, 200);
  assert.equal(await afdruk(), voor, 'geen byte verschil');
  assert.match(r.body.let, /Er is NIETS veranderd/);
});

test('2. blijftOpen bevat wat het dossier niet oplevert', async () => {
  const S = { werkruimte: ruimte, lidToken: pia.token };
  const r = await api('/api/bedrijf/gevolg', { ...S, wijziging: 'lid.uit-dienst', lidId: pia.id });
  const open = r.body.blijftOpen;
  const soort = (s, tekst) => open.find(o => o.soort === s && (!tekst || o.wat.includes(tekst)));

  assert.ok(soort('taak', 'zonder eigenaar'), 'zijn eigen taak blijft zonder eigenaar');

  /* DE ASSERTIE WAAR DEZE LAAG VOOR BESTAAT. De taak van Hakim staat niet op
     Pia's naam en komt in geen enkel dossier van Pia voor -- maar hij valt wel
     stil. Dat is het verschil tussen "wat hoort bij dit object" en "wat breekt
     er als het weg is". */
  const wachtend = soort('taak', 'wachtend op werk');
  assert.ok(wachtend, 'en een taak van iemand ANDERS valt stil: ' + JSON.stringify(open.map(o => o.wat)));
  assert.equal(wachtend.aantal, 1);
  assert.deepEqual(wachtend.voorbeelden, ['Opening plannen']);

  assert.ok(soort('kennisartikel'), 'het kennisartikel verliest zijn eigenaar');
  assert.equal(soort('kennisartikel').opNaam, true,
    'en het staat erbij dat dat een naammatch is, want een artikel draagt geen eigenaarId');
  assert.ok(soort('ticket'), 'het open ticket verliest zijn behandelaar');
  assert.ok(soort('besluit'), 'en het besluit in stemming wacht op een stem die niet meer komt');

  const dossier = await api('/api/bedrijf/dossier', { ...S, type: 'lid', id: pia.id });
  assert.ok(!JSON.stringify(dossier.body).includes('Opening plannen'),
    'het dossier van Pia noemt de taak van Hakim niet -- daarom is deze laag geen wrapper');
});

test('3. de simulatie volgt de rechten', async () => {
  /* Hakim is alleen projectleider. Dat is in dit huis `project`, `kennis` en
     `cijfer` -- dus de taken- EN de kenniskant hoort hij te zien, en de
     service-, besluit- en mensenkant niet. Niet omdat er achteraf iets wordt
     weggefilterd, maar omdat die takken niet draaien zonder het recht. Wie
     hier een `mag()` weghaalt, laat deze toets zakken. */
  const r = await api('/api/bedrijf/gevolg',
    { werkruimte: ruimte, lidToken: hakim.token, wijziging: 'lid.uit-dienst', lidId: pia.id });
  assert.equal(r.status, 200);
  const soorten = r.body.blijftOpen.map(o => o.soort);
  assert.ok(soorten.includes('taak'), 'de takenkant ziet hij wel');
  assert.ok(soorten.includes('kennisartikel'), 'en de kenniskant ook, want daar heeft hij het recht voor');
  assert.ok(!soorten.includes('ticket'), 'de servicekant niet: ' + soorten.join(', '));
  assert.ok(!soorten.includes('besluit'), 'en het besluit in stemming ziet hij ook niet');
  assert.ok(!r.body.raakt.some(x => x.soort === 'lid'),
    'en zonder het recht `mens` ziet hij ook niet welke rollen er vervallen');
});

test('4. een project stoppen laat zien wat er BUITEN het project stil valt', async () => {
  const S = { werkruimte: ruimte, lidToken: pia.token };
  const los = (await api('/api/bedrijf/project/maak', { ...S, naam: 'Losse klus', werkvorm: 'stadsuitrol' })).body.project;
  const buiten = (await api('/api/bedrijf/taak/maak', { ...S, titel: 'Nazorg regelen', projectId: los.id, wie: 'Hakim' })).body.taak;
  await api('/api/bedrijf/taak/wacht-op', { ...S, taakId: buiten.id, wachtOpId: taakVanPia.id });

  const r = await api('/api/bedrijf/gevolg', { ...S, wijziging: 'project.stop', projectId: project.id });
  assert.equal(r.status, 200);
  const stil = r.body.blijftOpen.find(o => o.wat.includes('BUITEN dit project'));
  assert.ok(stil, 'de taak in het andere project valt stil: ' + JSON.stringify(r.body.blijftOpen.map(o => o.wat)));
  assert.ok(stil.voorbeelden.includes('Nazorg regelen'));
});

test('5. de werkruimte sluiten telt alles, en zegt wat er niet gerekend is', async () => {
  const r = await api('/api/bedrijf/gevolg', { werkruimte: ruimte, lidToken: pia.token, wijziging: 'werkruimte.sluiten' });
  assert.equal(r.status, 200);
  assert.ok(r.body.raakt.some(x => x.soort === 'lid' && x.aantal >= 2), 'de mensen verliezen hun toegang');
  assert.ok(r.body.blijftOpen.some(o => o.soort === 'taken'), 'en er staan taken open');

  const namen = r.body.nietGerekend.map(n => n.wat);
  for (const n of ['kosten', 'contracten', 'controls', 'terugdraaien'])
    assert.ok(namen.includes(n), n + ' staat als niet-gerekend in het antwoord');
  for (const n of r.body.nietGerekend) assert.ok(n.reden.length > 20, n.wat + ' heeft een reden');
});

test('6. een wijziging die niet bestaat, krijgt geen gok', async () => {
  const r = await api('/api/bedrijf/gevolg', { werkruimte: ruimte, lidToken: pia.token, wijziging: 'alles.weg' });
  assert.equal(r.status, 400);
  assert.deepEqual(r.body.kan, ['lid.uit-dienst', 'project.stop', 'werkruimte.sluiten']);
  assert.match(r.body.let, /kort en gesloten/);
});
