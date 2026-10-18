/* RTG Werk OS, deel 5: contracten en besluitvorming.

   Vijf beweringen:

   - DE LAATSTE OPZEGDAG WORDT UITGEREKEND uit einddatum en opzegtermijn, niet
     overgetypt -- en een opzegging na die dag wordt als TE LAAT genoteerd in
     plaats van weggepoetst.
   - EEN CONTRACT MET EEN HANDTEKENING IS EEN AANBOD; pas met twee is het
     actief, en niemand tekent twee keer namens dezelfde partij.
   - STEMMEN KAN PAS NA DE ADVIESRONDE.
   - HET BEHEER-TOKEN STEMT NIET. Een stem hangt aan een mens met een sleutel.
   - EEN AANGENOMEN BESLUIT KRIJGT EEN EVALUATIEDATUM, en de bezwaren blijven
     eraan hangen.
   Draai los: node --test test/bedrijfrecht.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'); const os = require('os'); const path = require('path');
const { startServer } = require('./helper');

let BASE, child;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-bedrijfrecht-'));
const api = (pad, body) => fetch(BASE + (pad.startsWith('/api/') ? pad : '/api/bedrijf' + pad), {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {})
}).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
const dag = (v) => new Date(Date.now() + v * 86400000).toISOString().slice(0, 10);

let W, B, JUR, DIR, BEST;
async function lid(naam, rollen) {
  const a = (await api('/api/bedrijf/lid/aanmeld', { werkruimte: W, naam })).body;
  await api('/api/bedrijf/lid/besluit', { werkruimte: W, beheerToken: B, lidId: a.lidId, akkoord: true });
  await api('/api/bedrijf/lid/rollen', { werkruimte: W, beheerToken: B, lidId: a.lidId, rollen });
  return { werkruimte: W, lidToken: a.lidToken, id: a.lidId, wie: naam };
}

test.before(async () => {
  ({ child, base: BASE } = await startServer({ env: { RTG_DATA_DIR: TMP, SMTP_URL: '' } }));
  const w = (await api('/api/bedrijf/werkruimte/maak', { naam: 'RTG Recht', land: 'NL' })).body;
  W = w.werkruimte; B = w.beheerToken;
  JUR = await lid('Julia', ['jurist']);
  DIR = await lid('Diederik', ['directie']);
  BEST = await lid('Bas', ['bestuur']);
});
test.after(() => {
  if (child) try { child.kill('SIGKILL'); } catch (e) {}
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('de laatste opzegdag wordt uitgerekend, niet overgetypt', async () => {
  const c = (await api('/api/bedrijf/contract/zet', Object.assign({ titel: 'Hosting Europa',
    wederpartij: 'Datacenter BV', soort: 'leverancier', eindigt: dag(100),
    opzegtermijnDagen: 90, stilzwijgend: true, waarde: 24000 }, JUR))).body;
  assert.equal(c.contract.laatsteOpzegdag, dag(10), '100 dagen tot het einde min 90 dagen opzegtermijn');
  assert.equal(c.contract.dagenTotOpzegdag, 10);
  assert.equal(c.contract.stand, 'opzegtermijn loopt af');
  assert.match(c.contract.let, /nergens overgetypt/i);

  const plat = JSON.stringify(c.contract);
  assert.ok(!/opzegdagHandmatig|laatsteOpzegdagInvoer/i.test(plat), 'er is geen veld om de opzegdag zelf in te vullen');

  const lijst = (await api('/api/bedrijf/contracten', JUR)).body;
  assert.equal(lijst.binnenkortOpzeggen.length, 1, 'hij staat in de lijst die binnen dertig dagen op moet');
});

test('een contract met een handtekening is een aanbod', async () => {
  const c = (await api('/api/bedrijf/contract/zet', Object.assign({ titel: 'Verwerkersovereenkomst',
    wederpartij: 'Analysebureau', soort: 'verwerkers', eindigt: dag(365), opzegtermijnDagen: 30 }, JUR))).body.contract;
  assert.equal(c.status, 'concept');

  const een = (await api('/api/bedrijf/contract/teken', Object.assign({ contractId: c.id, partij: 'wij', naam: 'R. Rahul' }, JUR))).body;
  assert.equal(een.contract.status, 'concept');
  assert.match(een.let, /een aanbod/i);

  const dubbel = await api('/api/bedrijf/contract/teken', Object.assign({ contractId: c.id, partij: 'wij', naam: 'Iemand anders' }, JUR));
  assert.equal(dubbel.status, 409, 'namens dezelfde partij tekent niemand twee keer');

  const twee = (await api('/api/bedrijf/contract/teken', Object.assign({ contractId: c.id, partij: 'wederpartij', naam: 'A. Bureau' }, JUR))).body;
  assert.equal(twee.contract.status, 'actief');
  assert.equal(twee.let, null);
});

test('een opzegging na de laatste opzegdag wordt als te laat genoteerd', async () => {
  const c = (await api('/api/bedrijf/contract/zet', Object.assign({ titel: 'Kopieerapparaten',
    wederpartij: 'Kantoorlease', soort: 'huur', eindigt: dag(20), opzegtermijnDagen: 60,
    stilzwijgend: true }, JUR))).body.contract;
  assert.equal(c.stand, 'stilzwijgend verlengd (opzegdag voorbij)');

  const op = (await api('/api/bedrijf/contract/opzeggen', Object.assign({ contractId: c.id, reden: 'te duur' }, JUR))).body;
  assert.equal(op.contract.opgezegd.tijdig, false);
  assert.match(op.let, /waarschijnlijk te laat/i);
  assert.match(op.let, /in plaats van weggepoetst/i);

  const zonder = await api('/api/bedrijf/contract/opzeggen', Object.assign({ contractId: c.id }, JUR));
  assert.equal(zonder.status, 400, 'opzeggen zonder reden kan niet');
});

test('stemmen kan pas na de adviesronde, en het beheer-token stemt niet', async () => {
  const b = (await api('/api/bedrijf/besluit/maak', Object.assign({ titel: 'Prijs van de Business Pass verhogen',
    soort: 'prijs', onderbouwing: 'De marge staat onder druk door de servicekosten.',
    alternatieven: ['niets doen', 'alleen nieuwe klanten'] }, DIR))).body;
  assert.equal(b.besluit.status, 'advies');
  assert.match(b.let, /vraagt geen advies maar instemming/i);

  const tevroeg = await api('/api/bedrijf/besluit/stem', Object.assign({ besluitId: b.besluit.id, stem: 'voor' }, BEST));
  assert.equal(tevroeg.status, 409);
  assert.match(tevroeg.body.error, /adviesronde loopt nog/i);

  await api('/api/bedrijf/besluit/advies', Object.assign({ besluitId: b.besluit.id,
    tekst: 'Zonder overgangsregeling raken we de kleine zaken kwijt.', bezwaar: true }, BEST));
  await api('/api/bedrijf/besluit/advies', Object.assign({ besluitId: b.besluit.id, tekst: 'Cijfers kloppen.' }, JUR));

  const dicht = (await api('/api/bedrijf/besluit/stemronde', Object.assign({ besluitId: b.besluit.id }, DIR))).body;
  assert.equal(dicht.bezwaren.length, 1);
  assert.match(dicht.let, /blijven staan/i);

  const naAdvies = await api('/api/bedrijf/besluit/advies', Object.assign({ besluitId: b.besluit.id, tekst: 'nog iets' }, JUR));
  assert.equal(naAdvies.status, 409, 'de adviesronde is gesloten');

  const beheer = await api('/api/bedrijf/besluit/stem', { werkruimte: W, beheerToken: B, besluitId: b.besluit.id, stem: 'voor' });
  assert.equal(beheer.status, 403, 'het beheer-token stemt niet namens iemand');
  assert.match(beheer.body.error, /zonder gezicht/i);

  await api('/api/bedrijf/besluit/stem', Object.assign({ besluitId: b.besluit.id, stem: 'voor' }, DIR));
  const nogmaals = await api('/api/bedrijf/besluit/stem', Object.assign({ besluitId: b.besluit.id, stem: 'tegen' }, DIR));
  assert.equal(nogmaals.status, 409, 'niemand stemt twee keer');
  const t = (await api('/api/bedrijf/besluit/stem', Object.assign({ besluitId: b.besluit.id, stem: 'tegen',
    toelichting: 'eerst de overgangsregeling' }, BEST))).body;
  assert.deepEqual(t.telling, { voor: 1, tegen: 1, onthouding: 0 });
});

test('een aangenomen besluit krijgt een evaluatiedatum, en de bezwaren blijven eraan hangen', async () => {
  const b = (await api('/api/bedrijf/besluit/maak', Object.assign({ titel: 'Kantoor in Antwerpen openen',
    soort: 'investering', onderbouwing: 'Twintig klanten in Vlaanderen, nu zonder vaste plek.' }, DIR))).body.besluit;
  await api('/api/bedrijf/besluit/advies', Object.assign({ besluitId: b.id, tekst: 'Huurprijzen lopen op.', bezwaar: true }, JUR));
  await api('/api/bedrijf/besluit/stemronde', Object.assign({ besluitId: b.id }, DIR));

  const leeg = await api('/api/bedrijf/besluit/sluit', Object.assign({ besluitId: b.id, evalueerOp: dag(180) }, DIR));
  assert.equal(leeg.status, 409, 'zonder stemmen is er geen besluit');
  assert.match(leeg.body.error, /automaat neemt het hier niet over/i);

  await api('/api/bedrijf/besluit/stem', Object.assign({ besluitId: b.id, stem: 'voor' }, DIR));
  await api('/api/bedrijf/besluit/stem', Object.assign({ besluitId: b.id, stem: 'voor' }, BEST));

  const zonderDatum = await api('/api/bedrijf/besluit/sluit', Object.assign({ besluitId: b.id }, DIR));
  assert.equal(zonderDatum.status, 400);
  assert.match(zonderDatum.body.error, /nooit fout kan zijn geweest/i);

  const verleden = await api('/api/bedrijf/besluit/sluit', Object.assign({ besluitId: b.id, evalueerOp: dag(-1) }, DIR));
  assert.equal(verleden.status, 400);

  const uit = (await api('/api/bedrijf/besluit/sluit', Object.assign({ besluitId: b.id, evalueerOp: dag(180) }, DIR))).body;
  assert.equal(uit.besluit.status, 'aangenomen');
  assert.equal(uit.besluit.bezwaren.length, 1, 'het bezwaar hangt er nog aan');
  assert.equal(uit.besluit.evalueerOp, dag(180));
  assert.match(uit.let, /bij de evaluatie is dat het eerste wat je wilt lezen/i);

  const lijst = (await api('/api/bedrijf/besluiten', DIR)).body;
  assert.ok(lijst.besluiten.some(x => x.id === b.id && x.status === 'aangenomen'));
});

/* /api/bedrijf/uitval (server/bedrijf/uitval.js): wat raakt het als een
   wederpartij wegvalt? De deur riep geen toets aan. Drie dingen die hij
   belooft: de contracten op die naam komen terug (en alleen die), een naam
   zonder contract is een UITSLAG met een waarschuwing en geen lege
   geruststelling, en zonder het recht 'recht' blijft de deur dicht. */
test('uitval: wat er aan een wederpartij hangt, en wie dat mag vragen', async () => {
  const raak = await api('/api/bedrijf/uitval', Object.assign({ wederpartij: 'datacenter bv' }, JUR));
  assert.equal(raak.status, 200, JSON.stringify(raak.body).slice(0, 160));
  assert.ok(raak.body.contracten.length >= 1, 'het hostingcontract uit de eerste toets hangt aan deze wederpartij');
  // precies de contracten die in het register op deze wederpartij staan, geteld en niet geschat
  const alle = (await api('/api/bedrijf/contracten', JUR)).body.contracten;
  const verwacht = alle.filter(c => /^datacenter bv$/i.test(c.wederpartij || ''));
  assert.ok(verwacht.length >= 1 && verwacht.length < alle.length, 'er zijn contracten op deze naam en ook op andere namen');
  assert.deepEqual(raak.body.contracten.map(c => c.id).sort(), verwacht.map(c => c.id).sort(), 'en alleen die');
  assert.equal(raak.body.waardeCenten, verwacht.reduce((n, c) => n + Number(c.waardeCenten || 0), 0), 'de waarde is de som van precies die contracten');
  assert.match(String(raak.body.let || ''), new RegExp('^Wat hier staat is geteld, niet geschat: ' + verwacht.length + ' contract'), 'en de uitleg telt hetzelfde');

  const niets = await api('/api/bedrijf/uitval', Object.assign({ wederpartij: 'Bestaat Niet NV' }, JUR));
  assert.equal(niets.status, 200);
  assert.equal(niets.body.contracten.length, 0);
  assert.match(String(niets.body.let || ''), /geen geruststelling/i, 'nul contracten is een uitslag met een waarschuwing');

  assert.equal((await api('/api/bedrijf/uitval', Object.assign({}, JUR))).status, 400, 'zonder wederpartij geen vraag');
  const zonderRecht = await lid('Zonder Recht', []);
  assert.equal((await api('/api/bedrijf/uitval', Object.assign({ wederpartij: 'Datacenter BV' }, zonderRecht))).status, 403, 'zonder het recht blijft de deur dicht');
  assert.equal((await api('/api/bedrijf/uitval', { wederpartij: 'Datacenter BV' })).status, 403, 'en zonder sessie ook (de werkpoort geeft 403)');
});
