/* RTG Werk OS, deel 6: het directiebeeld en de aansluitingen.

   Vier beweringen:

   - HET BEELD MAAKT VAN NIETS GEEN NUL. Een module zonder gegevens staat bij
     nietGemeten met een reden, en niet als een geruststellende nul.
   - ER STAAT GEEN VOORSPELLING IN. Geen prognose, geen verwacht, geen
     voorspelde omzet.
   - EEN MOEDER KIJKT NIET ONGEMERKT IN DE BOEKEN VAN EEN DOCHTER: zonder haar
     beheer-token telt die dochter niet mee, en dat wordt gezegd.
   - EEN KOPPELING MET EEN RTG-ACCOUNT GEEFT TELLINGEN, GEEN INHOUD -- en
     niemand koppelt het account van een ander.
   Draai los: node --test test/bedrijfbeeld.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'); const os = require('os'); const path = require('path');
const { startServer } = require('./helper');

let BASE, child;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-bedrijfbeeld-'));
const api = (pad, body, bearer) => fetch(BASE +
  (pad.startsWith('/api/') ? pad : '/api/bedrijf' + pad), {
  method: 'POST', headers: Object.assign({ 'Content-Type': 'application/json' },
    bearer ? { Authorization: 'Bearer ' + bearer } : {}),
  body: JSON.stringify(body || {})
}).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));

let W, B, DIR, MED, dochter;
async function lid(naam, rollen) {
  const a = (await api('/lid/aanmeld', { werkruimte: W, naam })).body;
  await api('/lid/besluit', { werkruimte: W, beheerToken: B, lidId: a.lidId, akkoord: true });
  if (rollen.length) await api('/lid/rollen', { werkruimte: W, beheerToken: B, lidId: a.lidId, rollen });
  return { werkruimte: W, lidToken: a.lidToken, id: a.lidId, wie: naam };
}
async function nieuwLid() {
  const u = Date.now().toString().slice(-8) + Math.floor(Math.random() * 90 + 10);
  const reg = await fetch(BASE + '/api/auth/register', { method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Werker', email: 'w' + u + '@x.nl', phone: '06' + u.slice(0, 8),
      password: 'geheim12345', geboortedatum: '1980-01-01', tier: 'rtg' }) }).then(r => r.json());
  assert.ok(reg.token, 'het RTG-lid is aangemeld: ' + JSON.stringify(reg).slice(0, 120));
  return reg.token;
}

test.before(async () => {
  ({ child, base: BASE } = await startServer({ env: { RTG_DATA_DIR: TMP, SMTP_URL: '' } }));
  const w = (await api('/werkruimte/maak', { naam: 'RTG Holding', land: 'NL' })).body;
  W = w.werkruimte; B = w.beheerToken;
  DIR = await lid('Dana', ['directie']);
  MED = await lid('Mo', ['medewerker']);
  dochter = (await api('/werkruimte/maak', {
    naam: 'RTG Belgie', land: 'BE', moeder: W, moederBeheerToken: B
  })).body;
});
test.after(() => {
  if (child) try { child.kill('SIGKILL'); } catch (e) {}
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('het beeld maakt van niets geen nul, en voorspelt niets', async () => {
  const leeg = (await api('/beeld', DIR)).body;
  const blokken = leeg.nietGemeten.map(x => x.blok);
  assert.ok(blokken.includes('verkoop') && blokken.includes('service') && blokken.includes('bouw'),
    'lege modules staan als niet gemeten: ' + JSON.stringify(blokken));
  assert.ok(leeg.nietGemeten.every(x => x.reden), 'elk met een reden');
  assert.equal(leeg.verkoop, undefined, 'en niet als een geruststellende nul');
  assert.equal(leeg.mensen.actief, 2, 'wat er wel is, staat er gewoon');

  // de cijfers zelf, zonder de uitleg-zin (die zegt juist DAT er niets voorspeld wordt)
  const cijfers = JSON.stringify(Object.assign({}, leeg, { let: undefined }));
  assert.ok(!/prognose|voorspel|verwacht/i.test(cijfers), 'er staat geen voorspelling tussen de cijfers');
  assert.match(leeg.let, /geen enkele voorspelling/i, 'en het beeld zegt dat zelf');
  assert.ok(leeg.gemetenOp, 'wel een tijdstempel');

  // zodra er iets is, verdwijnt het uit nietGemeten
  await api('/project/maak', Object.assign({ naam: 'Uitrol', werkvorm: 'stadsuitrol' }, DIR));
  const na = (await api('/beeld', DIR)).body;
  assert.equal(na.projecten.lopend, 1);
  assert.ok(!na.nietGemeten.map(x => x.blok).includes('projecten'));
  assert.equal(na.projecten.deelKlaar, null, 'zonder taken geen percentage');
});

test('een medewerker zonder cijferrecht komt niet bij het directiebeeld', async () => {
  const dicht = await api('/beeld', MED);
  assert.equal(dicht.status, 403);
  assert.match(dicht.body.error, /cijfer/);
});

test('een moeder telt een dochter alleen mee met haar sleutel', async () => {
  const zonder = (await api('/api/bedrijf/geconsolideerd', { werkruimte: W, beheerToken: B })).body;
  assert.deepEqual(zonder.nietMeegeteld, [dochter.werkruimte], 'zonder sleutel telt de dochter niet mee');
  assert.equal(zonder.werkruimtes.length, 1);
  assert.match(zonder.let, /dat is geen fout maar de grens/i);

  const sleutels = {}; sleutels[dochter.werkruimte] = dochter.beheerToken;
  const met = (await api('/api/bedrijf/geconsolideerd', { werkruimte: W, beheerToken: B, dochterTokens: sleutels })).body;
  assert.equal(met.werkruimtes.length, 2);
  assert.deepEqual(met.nietMeegeteld, []);
  assert.equal(met.totalen.mensenActief, 2, 'de dochter heeft nog geen leden, dus het totaal blijft twee');
  assert.match(met.let, /compleet/i);

  const fout = {}; fout[dochter.werkruimte] = 'raden-maar';
  const mis = (await api('/api/bedrijf/geconsolideerd', { werkruimte: W, beheerToken: B, dochterTokens: fout })).body;
  assert.deepEqual(mis.nietMeegeteld, [dochter.werkruimte], 'een verkeerde sleutel opent niets');
});

test('een koppeling geeft tellingen en geen inhoud, en niemand koppelt het account van een ander', async () => {
  const token = await nieuwLid();
  const voor = (await api('/koppeling', MED)).body;
  assert.equal(voor.gekoppeld, false);

  const zonderSessie = await api('/lid/koppel', MED);
  assert.ok(zonderSessie.status >= 400, 'koppelen zonder RTG-sessie kan niet');

  const uit = (await api('/lid/koppel', MED, token)).body;
  assert.equal(uit.gekoppeld, true);
  assert.ok(uit.codenaam, 'de koppeling draait op de codenaam');
  assert.match(uit.let, /de inhoud niet/i);

  const dubbel = await api('/lid/koppel', DIR, token);
  assert.equal(dubbel.status, 409, 'hetzelfde RTG-account koppelt niet aan twee leden');
  assert.match(dubbel.body.error, /al gekoppeld aan Mo/);

  const start = (await api('/start', MED)).body;
  assert.ok(start.blokken.agenda, 'het agendablok komt nu uit de bestaande RTG Agenda');
  assert.equal(start.blokken.agenda.bron, 'RTG Agenda');
  assert.equal(start.blokken.agenda.openItems, 0, 'een nieuw lid heeft nog niets in zijn agenda');
  assert.ok(start.blokken.berichten, 'en het berichtenblok uit RTMAIL');
  assert.equal(typeof start.blokken.berichten.ongelezen, 'number');
  const blokken = start.nietGemeten.map(x => x.blok);
  assert.ok(!blokken.includes('agenda') && !blokken.includes('berichten'),
    'die twee staan niet meer bij nietGemeten: ' + JSON.stringify(blokken));

  const plat = JSON.stringify(start.blokken);
  assert.ok(!/wachtwoord|inhoud|tekst":/i.test(plat), 'er reist geen inhoud mee, alleen tellingen en titels');

  const los = (await api('/lid/ontkoppel', MED)).body;
  assert.equal(los.gekoppeld, false);
  const naLos = (await api('/start', MED)).body;
  assert.ok(naLos.nietGemeten.map(x => x.blok).includes('agenda'), 'na losmaken is het blok weer weg');
});
