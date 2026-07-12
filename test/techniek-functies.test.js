/* Integratietest: functieschakelaars met bevestiging. Een schakelactie maakt
   een AANVRAAG; er verandert pas iets nadat de eigenaar (Rahul) accepteert.
   Weigeren laat alles zoals het was. Draait tegen een echte server.
   Draai los: node --experimental-sqlite --test test/techniek-functies.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const PORT = 3800 + Math.floor(Math.random() * 80);
const BASE = 'http://127.0.0.1:' + PORT;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtf-func-'));
const OWNER = 'rahul@rtg.example'; // standaard-eigenaar (RTG_OWNER_EMAIL)
let child, techToken;

function post(pad, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = 'Bearer ' + token;
  return fetch(BASE + pad, { method: 'POST', headers, body: JSON.stringify(body || {}) });
}
// hulp: dien een aanvraag in en laat de eigenaar hem meteen accepteren
async function schakelMetAkkoord(body) {
  const vz = await (await post('/api/techniek/functie', body, techToken)).json();
  assert.equal(vz.status, 'wacht', 'de schakelactie wordt eerst een aanvraag');
  const b = await (await post('/api/techniek/functie/besluit', { verzoekId: vz.verzoekId }, techToken)).json();
  assert.equal(b.status, 'akkoord');
  return b;
}

test.before(async () => {
  child = spawn(process.execPath, ['--experimental-sqlite', path.join(__dirname, '..', 'server', 'server.js')], {
    env: { ...process.env, PORT: String(PORT), RTG_DATA_DIR: TMP, NODE_ENV: 'test', SMTP_URL: '' },
    stdio: ['ignore', 'ignore', 'inherit']
  });
  for (let i = 0; i < 100; i++) {
    try { const r = await fetch(BASE + '/api/health'); if (r.ok) break; } catch (e) {}
    await new Promise(r => setTimeout(r, 100));
  }
  // in demo-modus is het eigenaarsaccount (Rahul/Imran) al geseed; log daarmee in
  const login = await (await post('/api/techniek/inloggen', { login: OWNER, wachtwoord: 'Imran' })).json();
  assert.ok(login.token && login.eigenaar, 'de eigenaar kan inloggen op de technische pagina');
  techToken = login.token;
});
test.after(() => {
  if (child) try { child.kill('SIGKILL'); } catch (e) {}
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('schakelen maakt een aanvraag; pas na accepteren gaat de functie echt om', async () => {
  // een school aanmelden lukt normaal
  assert.equal((await post('/api/foundation/school/school/maak', { naam: 'Testschool', plaats: 'Utrecht' })).status, 200);

  // de aanvraag "RTF School uit" verandert nog NIETS
  const vz = await (await post('/api/techniek/functie', { id: 'foundation-school', aan: false }, techToken)).json();
  assert.equal(vz.status, 'wacht');
  assert.ok(vz.verzoekId);
  assert.equal((await post('/api/foundation/school/school/maak', { naam: 'Nog gewoon open' })).status, 200,
    'zolang de eigenaar niet accepteert blijft de functie aan');

  // de aanvraag staat op het bord (status-endpoint)
  const st = await (await fetch(BASE + '/api/techniek/status', { headers: { Authorization: 'Bearer ' + techToken } })).json();
  assert.ok(st.verzoeken.some(v => v.vid === vz.verzoekId && v.status === 'wacht'));

  // de eigenaar accepteert -> nu geeft het schoolkanaal 503
  const b = await (await post('/api/techniek/functie/besluit', { verzoekId: vz.verzoekId }, techToken)).json();
  assert.equal(b.status, 'akkoord');
  const r = await post('/api/foundation/school/school/maak', { naam: 'Nu dicht' });
  assert.equal(r.status, 503);
  assert.equal((await r.json()).functie, 'foundation-school');

  // dezelfde aanvraag kan geen tweede keer behandeld worden
  assert.equal((await post('/api/techniek/functie/besluit', { verzoekId: vz.verzoekId }, techToken)).status, 409);

  // de rest van de onderwijs-app bleef gewoon werken
  assert.notEqual((await post('/api/foundation/gezin/maak', { gezinsnaam: 'Fam', naam: 'Ouder', pin: '1234' })).status, 503);

  // weer aan (aanvraag + akkoord) -> werkt weer
  await schakelMetAkkoord({ id: 'foundation-school', aan: true });
  assert.equal((await post('/api/foundation/school/school/maak', { naam: 'Weer open' })).status, 200);
});

test('weigeren laat alles zoals het was; dubbel schakelen is "ongewijzigd"', async () => {
  const vz = await (await post('/api/techniek/functie', { id: 'betalen', aan: false }, techToken)).json();
  assert.equal(vz.status, 'wacht');
  const b = await (await post('/api/techniek/functie/besluit', { verzoekId: vz.verzoekId, akkoord: false }, techToken)).json();
  assert.equal(b.status, 'geweigerd');
  // betalen staat nog gewoon aan (geen 503 door de functieschakelaar)
  assert.notEqual((await post('/api/betaal/checkout', {})).status, 503);
  // iets aanzetten dat al aan staat: geen aanvraag nodig
  const nop = await (await post('/api/techniek/functie', { id: 'betalen', aan: true }, techToken)).json();
  assert.equal(nop.status, 'ongewijzigd');
});

test('een open aanvraag is zichtbaar in het actiecentrum van de Backoffice', async () => {
  const vz = await (await post('/api/techniek/functie', { id: 'verificatie', aan: false }, techToken)).json();
  assert.equal(vz.status, 'wacht');
  // de backoffice (demo-code) ziet de waarschuwing in het actiecentrum
  const login = await (await post('/api/office/login', { code: 'RTG-OFFICE' })).json();
  const alert = (login.state.alerts || []).find(a => a.kind === 'functie');
  assert.ok(alert, 'het actiecentrum meldt de wachtende functieaanvraag');
  assert.match(alert.text, /bevestiging/);
  // na het besluit (weigeren) verdwijnt de melding weer
  await post('/api/techniek/functie/besluit', { verzoekId: vz.verzoekId, akkoord: false }, techToken);
  const officeToken = login.token;
  const st = await (await fetch(BASE + '/api/office/state', { method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + officeToken }, body: '{}' })).json();
  assert.ok(!(st.state.alerts || []).some(a => a.kind === 'functie'), 'na het besluit is het actiecentrum weer schoon');
});

test('beveiliging: mislukte tech-login wordt gemeld; een kritieke melding komt in het actiecentrum', async () => {
  // een mislukte inlog op de technische pagina -> waarschuwing op het bord
  assert.equal((await post('/api/techniek/inloggen', { login: 'indringer@x.nl', wachtwoord: 'fout' })).status, 401);
  let st = await (await fetch(BASE + '/api/techniek/status', { headers: { Authorization: 'Bearer ' + techToken } })).json();
  assert.ok(st.beveiliging.open >= 1, 'de mislukte login staat op het bord');
  assert.ok(st.beveiliging.recent.some(m => m.type === 'tech-login-mislukt'));

  // een echt account dat correct inlogt maar geen recht heeft = kritiek
  await post('/api/auth/register', { name: 'Nieuwsgierig Lid', email: 'lid@x.nl', phone: '0611112222', password: 'welkom123', geboortedatum: '1995-05-05' });
  assert.equal((await post('/api/techniek/inloggen', { login: 'lid@x.nl', wachtwoord: 'welkom123' })).status, 403);
  st = await (await fetch(BASE + '/api/techniek/status', { headers: { Authorization: 'Bearer ' + techToken } })).json();
  assert.ok(st.beveiliging.kritiek >= 1, 'een geldig account zonder recht is een kritieke melding');

  // die kritieke melding staat als rode regel in het actiecentrum van de Backoffice
  const office = await (await post('/api/office/login', { code: 'RTG-OFFICE' })).json();
  const alert = (office.state.alerts || []).find(a => a.kind === 'beveiliging');
  assert.ok(alert && alert.level === 'rood', 'het actiecentrum toont de kritieke beveiligingsmelding');

  // de eigenaar markeert alles als gezien -> het bord en het actiecentrum zijn schoon
  await post('/api/techniek/beveiliging/afhandelen', {}, techToken);
  st = await (await fetch(BASE + '/api/techniek/status', { headers: { Authorization: 'Bearer ' + techToken } })).json();
  assert.equal(st.beveiliging.open, 0);
  const office2 = await (await fetch(BASE + '/api/office/state', { method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + office.token }, body: '{}' })).json();
  assert.ok(!(office2.state.alerts || []).some(a => a.kind === 'beveiliging'));
});

test('noodrem: staat standaard aan; alleen de eigenaar schakelt hem', async () => {
  let st = await (await fetch(BASE + '/api/techniek/status', { headers: { Authorization: 'Bearer ' + techToken } })).json();
  assert.equal(st.beveiliging.autoReactie, true, 'de noodrem staat standaard aan');
  // zonder token: geen toegang tot de schakelaar
  assert.equal((await post('/api/techniek/beveiliging/auto', { aan: false })).status, 401);
  // de eigenaar zet hem uit en weer aan
  const uit = await (await post('/api/techniek/beveiliging/auto', { aan: false }, techToken)).json();
  assert.equal(uit.autoReactie, false);
  st = await (await fetch(BASE + '/api/techniek/status', { headers: { Authorization: 'Bearer ' + techToken } })).json();
  assert.equal(st.beveiliging.autoReactie, false);
  const aan = await (await post('/api/techniek/beveiliging/auto', { aan: true }, techToken)).json();
  assert.equal(aan.autoReactie, true);
});

test('alleen de eigenaar besluit; techniek blijft altijd bereikbaar', async () => {
  // zonder token: geen aanvraag kunnen doen
  assert.equal((await post('/api/techniek/functie', { id: 'betalen', aan: false })).status, 401);
  // zonder token: zeker geen besluit
  assert.equal((await post('/api/techniek/functie/besluit', { verzoekId: 'x' })).status, 401);

  // hele platform uit via aanvraag + akkoord
  await schakelMetAkkoord({ alles: true, aan: false });
  assert.equal((await post('/api/foundation/gezin/maak', { gezinsnaam: 'X', naam: 'Y', pin: '1234' })).status, 503);
  // maar de technische pagina blijft bereikbaar om alles weer aan te zetten
  assert.equal((await fetch(BASE + '/api/techniek/status', { headers: { Authorization: 'Bearer ' + techToken } })).status, 200);
  // alles weer aan
  const weer = await schakelMetAkkoord({ alles: true, aan: true });
  assert.ok(weer.functies.flatMap(g => g.functies).every(f => f.aan));
  assert.notEqual((await post('/api/foundation/gezin/maak', { gezinsnaam: 'Z', naam: 'W', pin: '1234' })).status, 503);
});
