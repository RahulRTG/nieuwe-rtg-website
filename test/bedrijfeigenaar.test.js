/* RTG Werk OS: de weg van een ledenaccount naar een werkruimte.

   Dit bestand bestaat om een gat dat een gebruiker meldde: de laag was
   volledig en toch onbereikbaar. Een werkruimte heeft zijn eigen sleutel, en
   die krijg je van een mens -- maar de EIGENAAR van het platform had niemand
   om het aan te vragen. Vier beweringen:

   - DE EIGENAAR KRIJGT ZIJN WERKRUIMTE, EEN KEER. Een tweede aanroep maakt
     geen tweede werkruimte en geen tweede lidmaatschap.
   - EEN GEWOON LID KRIJGT NIETS AUTOMATISCH; voor hem blijft gelden dat een
     mens hem toelaat.
   - HET BEHEER-TOKEN REIST NOOIT MEE, ook niet naar de eigenaar.
   - EEN GEKOPPELD LID VINDT ZIJN EIGEN WERKRUIMTE TERUG, met zijn eigen token
     en niet dat van een ander.
   Draai los: node --test test/bedrijfeigenaar.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'); const os = require('os'); const path = require('path');
const { startServer } = require('./helper');

let BASE, child;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-bedrijfeig-'));
const api = (pad, body, bearer) => fetch(BASE + '/api/bedrijf' + pad, {
  method: 'POST', headers: Object.assign({ 'Content-Type': 'application/json' },
    bearer ? { Authorization: 'Bearer ' + bearer } : {}),
  body: JSON.stringify(body || {})
}).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));

async function inlog(login, wachtwoord) {
  const r = await fetch(BASE + '/api/auth/login', { method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ login, password: wachtwoord }) }).then(x => x.json());
  return r.token || null;
}
async function nieuwLid() {
  const u = Date.now().toString().slice(-8) + Math.floor(Math.random() * 90 + 10);
  const reg = await fetch(BASE + '/api/auth/register', { method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Gewoon lid', email: 'g' + u + '@x.nl', phone: '06' + u.slice(0, 8),
      password: 'geheim12345', geboortedatum: '1985-05-05', tier: 'rtg' }) }).then(r => r.json());
  return reg.token;
}

test.before(async () => {
  ({ child, base: BASE } = await startServer({ env: { RTG_DATA_DIR: TMP, SMTP_URL: '' } }));
});
test.after(() => {
  if (child) try { child.kill('SIGKILL'); } catch (e) {}
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('de eigenaar krijgt zijn werkruimte, een keer, met zichzelf als directie', async () => {
  const token = await inlog('roellie.i@gmail.com', process.env.DEMO_PASS || 'Imran');
  assert.ok(token, 'de eigenaar kan inloggen (demostand)');

  const eerst = (await api('/mijn', {}, token)).body;
  assert.equal(eerst.eigenaar, true, 'het account wordt als eigenaar herkend');
  assert.equal(eerst.aantal, 1, 'er staat nu een werkruimte klaar');
  assert.ok(eerst.aangemaakt, 'en die is bij deze aanroep gemaakt');
  const w = eerst.werkruimtes[0];
  assert.equal(w.naam, 'Rahul Travel Group');
  assert.ok(w.lidNaam, 'de accountbrug kan de persoonlijke kop meteen vullen');
  assert.deepEqual(w.rollen, ['directie'], 'met de eigenaar als directie');
  assert.equal(w.eigenaarsRuimte, true);
  assert.ok(w.lidToken, 'en met zijn eigen lid-token, zodat het scherm meteen open kan');

  const plat = JSON.stringify(eerst);
  assert.ok(plat.indexOf('beheerToken') < 0, 'het beheer-token reist niet mee, ook niet naar de eigenaar');

  // dat token werkt ook echt, en geeft directie-rechten
  const rechten = (await api('/mijn-rechten', { werkruimte: w.werkruimte, lidToken: w.lidToken })).body;
  assert.ok(rechten.rechten.includes('besluit') && rechten.rechten.includes('cijfer'));

  const nogmaals = (await api('/mijn', {}, token)).body;
  assert.equal(nogmaals.aantal, 1, 'een tweede aanroep maakt geen tweede werkruimte');
  assert.equal(nogmaals.aangemaakt, null, 'en zegt dat er niets is aangemaakt');
  assert.equal(nogmaals.werkruimtes[0].lidToken, w.lidToken, 'het lidmaatschap wordt niet overschreven');
});

test('een gewoon lid krijgt niets automatisch, en vindt na koppelen zijn eigen werkruimte', async () => {
  const lidToken = await nieuwLid();
  assert.ok(lidToken, 'het gewone lid is aangemeld');

  const leeg = (await api('/mijn', {}, lidToken)).body;
  assert.equal(leeg.eigenaar, false);
  assert.equal(leeg.aantal, 0, 'een gewoon lid krijgt geen werkruimte cadeau');
  assert.match(leeg.let, /nog aan geen enkele actieve werkruimte gekoppeld/i);

  // de gewone weg: aanmelden, toegelaten worden, koppelen
  const w = (await api('/werkruimte/maak', { naam: 'Ander bedrijf' })).body;
  const a = (await api('/lid/aanmeld', { werkruimte: w.werkruimte, naam: 'Nieuwe collega' })).body;
  const voorToelating = (await api('/mijn', {}, lidToken)).body;
  assert.equal(voorToelating.aantal, 0, 'aanmelden alleen is niet genoeg');

  await api('/lid/besluit', { werkruimte: w.werkruimte, beheerToken: w.beheerToken, lidId: a.lidId, akkoord: true });
  await api('/lid/rollen', { werkruimte: w.werkruimte, beheerToken: w.beheerToken, lidId: a.lidId, rollen: ['medewerker'] });
  await api('/lid/koppel', { werkruimte: w.werkruimte, lidToken: a.lidToken }, lidToken);

  const na = (await api('/mijn', {}, lidToken)).body;
  assert.equal(na.aantal, 1, 'na koppelen vindt hij zijn werkruimte terug');
  assert.equal(na.werkruimtes[0].lidToken, a.lidToken, 'met zijn eigen token');
  assert.equal(na.werkruimtes[0].lidNaam, 'Nieuwe collega', 'met de identiteit voor de persoonlijke kop');
  assert.deepEqual(na.werkruimtes[0].rollen, ['medewerker']);
  assert.equal(na.werkruimtes[0].eigenaarsRuimte, false);

  // en hij ziet de werkruimte van de eigenaar niet
  assert.ok(!na.werkruimtes.some(x => x.eigenaarsRuimte), 'de werkruimte van de eigenaar staat er niet bij');
});

test('zonder ledensessie geeft deze weg niets prijs', async () => {
  const zonder = await api('/mijn', {});
  assert.ok(zonder.status === 401 || zonder.status === 403, 'geen sessie, geen antwoord: ' + zonder.status);
});
