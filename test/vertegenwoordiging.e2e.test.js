/* RTG VERTEGENWOORDIGING OVER HTTP -- bestaat de functie ook voor een echte
   gebruiker? (BETROUWBAARHEID.md: een functie bestaat pas als een echte
   gebruiker haar bedoeling kan voltooien, niet als het scherm laadt.)

   De regels zelf staan in test/vertegenwoordiging.test.js en zijn daar met een
   mutatie nagetrokken. Deze suite meet iets anders: komt een verzoek werkelijk
   bij die regels aan, en houdt de DEUR wat hij hoort te houden.

   EN HIJ LEGT DE 18+-POORT VAST ALS PRODUCTGEDRAG. Een vers geregistreerd lid
   haalt `volwassen()` niet -- dat vraagt niet alleen 18 jaar maar ook dat RTG
   het identiteitsbewijs heeft gezien (A3). Dat is geen bijwerking maar de
   bedoeling: een machtiging waarmee iemand commercieel namens je handelt, hoort
   niet te kunnen op een geboortedatum die je zelf hebt ingetypt. Het gevolg is
   wel dat deze functie pas opengaat na verificatie, en dat hoort een toets vast
   te leggen in plaats van dat iemand er later over struikelt.
   Draai: node --test test/vertegenwoordiging.e2e.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer } = require('./helper');

let BASE, child, lidToken, agentToken, lidCodenaam;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-vtg-'));
const json = r => r.json();

async function api(pad, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = 'Bearer ' + token;
  return fetch(BASE + pad, { method: 'POST', headers, body: JSON.stringify(body || {}) });
}

test.before(async () => {
  ({ child, base: BASE } = await startServer({ env: { RTG_DATA_DIR: TMP, SMTP_URL: '' } }));
  lidToken = (await json(await api('/api/auth/register', { name: 'Talent Een', email: 'talent@x.nl',
    phone: '0612345601', password: 'geheim123', geboortedatum: '1990-01-01', tier: 'rtg', pasApp: 'rtg' }))).token;
  agentToken = (await json(await api('/api/auth/register', { name: 'Zaakwaarnemer Twee', email: 'agent@x.nl',
    phone: '0612345602', password: 'geheim123', geboortedatum: '1985-01-01', tier: 'rtg', pasApp: 'rtg' }))).token;
  /* DE CODENAAM EN NIET DE ECHTE NAAM. Dat is geen testdetail maar de
     privacy-opzet van dit huis: operationele data draait op codenamen en echte
     namen wonen in de gescheiden kluis (CLAUDE.md). Een vertegenwoordiger vraagt
     dus om een codenaam, en wie hier de echte naam invult, krijgt terecht 404. */
  lidCodenaam = (await json(await api('/api/state', {}, lidToken))).state.user.codename;
});
test.after(() => {
  if (child) try { child.kill('SIGKILL'); } catch (e) {}
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('1. zonder sessie komt er niemand bij zijn team', async () => {
  const r = await api('/api/vertegenwoordiging/mijn', {});
  assert.ok(r.status === 401 || r.status === 403, 'onbevoegd hoort 401 of 403 te geven, kreeg ' + r.status);
});

test('2. de gesloten lijst komt compleet mee, inclusief wat NOOIT kan', async () => {
  const d = await json(await api('/api/vertegenwoordiging/bevoegdheden', {}, lidToken));
  assert.ok(Array.isArray(d.bevoegdheden) && d.bevoegdheden.length >= 5);
  assert.ok(Array.isArray(d.nooit) && d.nooit.length >= 5,
    'de NOOIT-lijst hoort even hard mee te komen als wat er wel kan');
  for (const b of d.bevoegdheden) {
    assert.ok(b.grond, b.sleutel + ' komt zonder grond over de lijn');
    assert.equal(typeof b.klaarzetten, 'boolean', b.sleutel + ' zegt niet of hij alleen mag klaarzetten');
  }
  assert.ok(d.nooit.some(n => /machtigen/i.test(n.wat)), 'geen delegatie hoort in het antwoord te staan');
});

test('3. een leeg team is leeg en niet stuk', async () => {
  const d = await json(await api('/api/vertegenwoordiging/mijn', {}, lidToken));
  assert.deepEqual(d.team, []);
  assert.deepEqual(d.ikSta, []);
  assert.deepEqual(d.log, []);
  assert.equal(d.volwassen, false, 'een vers lid is nog niet door RTG gezien');
});

test('4. de 18+-poort houdt, en zegt wat eraan te doen is', async () => {
  const r = await api('/api/vertegenwoordiging/voorstel', { client: lidCodenaam,
    hoedanigheid: 'zaakwaarnemer', bevoegdheden: ['aanbod.ontvangen'],
    tot: new Date(Date.now() + 100 * 86400000).toISOString() }, agentToken);
  const d = await json(r);
  assert.equal(r.status, 403);
  assert.match(d.error, /18 of ouder/i);
  assert.match(d.error, /verifieren|jeugdbestuur/i,
    'een weigering zonder weg eromheen leest als een storing (GRAMMATICA.md)');
});

test('5. een onbekende cliënt lekt niet of hij bestaat als iets anders dan een codenaam', async () => {
  const r = await api('/api/vertegenwoordiging/voorstel', { client: 'Bestaat Niet Zeker Weten',
    hoedanigheid: 'zaakwaarnemer', bevoegdheden: ['aanbod.ontvangen'],
    tot: new Date(Date.now() + 100 * 86400000).toISOString() }, agentToken);
  assert.equal(r.status, 404);
});

test('6. de eigen grens is te zetten en komt terug', async () => {
  const zet = await json(await api('/api/vertegenwoordiging/grens',
    { bevoegdheden: ['reis.voorbereiden'] }, lidToken));
  assert.equal(zet.ok, true);
  const d = await json(await api('/api/vertegenwoordiging/mijn', {}, lidToken));
  assert.deepEqual(d.grens, ['reis.voorbereiden']);
  const fout = await api('/api/vertegenwoordiging/grens', { bevoegdheden: ['bestaat.niet'] }, lidToken);
  assert.equal(fout.status, 400, 'een verzonnen bevoegdheid hoort geweigerd te worden, ook via de route');
});

test('7. een machtiging van een vreemde is niet te simuleren op een geraden id', async () => {
  const r = await api('/api/vertegenwoordiging/simulatie', { id: 'vm0000000000' }, lidToken);
  assert.equal(r.status, 404);
});

test('8. handelen op een machtiging die niet van u is, kan niet', async () => {
  const r = await api('/api/vertegenwoordiging/handel',
    { id: 'vm0000000000', bevoegdheid: 'aanbod.ontvangen' }, agentToken);
  assert.equal(r.status, 404);
});
