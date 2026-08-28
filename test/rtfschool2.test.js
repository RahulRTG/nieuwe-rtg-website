/* RTF-golf 2: school en de toetsplanner in samenhang. De gezinsagenda leest
   school alleen mee (open huiswerk en toetsen als bron 'school', net als de
   RTG-ecosysteemlaag), de leerplanner zet huiswerk, leerstappen en toetsen
   per dag op een rij, en afvinken loopt via de bestaande wegen.
   Draai los: node --test test/rtfschool2.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer } = require('./helper');

let BASE;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtf-school2-'));
let child;

const api = (pad, body) => fetch(BASE + '/api/foundation' + pad, {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) });
const rtf = (pad, body) => fetch(BASE + '/api/rtf' + pad, {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) });
const office = (pad, body, token) => fetch(BASE + '/api' + pad, { method: 'POST',
  headers: Object.assign({ 'Content-Type': 'application/json' }, token ? { Authorization: 'Bearer ' + token } : {}),
  body: JSON.stringify(body || {}) });
const json = r => r.json();
const plus = n => { const d = new Date(Date.now() + n * 86400000);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };

let g, klas, kindId, kindToken, sleutel;

test.before(async () => {
  ({ child, base: BASE } = await startServer({ env: { RTG_DATA_DIR: TMP, SMTP_URL: '' }, wachtPad: '/api/foundation/health' }));
  // de verplichte keten: school (RTG keurt goed) -> leraar -> klas -> gezin met gekoppeld kind
  const sch = await json(await api('/school/school/maak', { naam: 'Het Kompas', plaats: 'Leiden' }));
  const login = await json(await office('/office/login', { code: 'RTG-OFFICE' }));
  await office('/office/school/decide', { code: sch.schoolCode, action: 'goedkeuren' }, login.token);
  const p = await json(await api('/school/personeel/aanmeld', { schoolCode: sch.schoolCode, naam: 'Juf Iris', rol: 'leraar' }));
  await api('/school/personeel/besluit', { schoolCode: sch.schoolCode, beheerToken: sch.beheerToken, personeelId: p.personeelId, akkoord: true });
  const kl = await json(await api('/school/leraar/klas/maak', { schoolCode: sch.schoolCode, personeelToken: p.personeelToken, naam: 'Klas 2B' }));
  klas = { code: kl.code, leraarToken: p.personeelToken };
  g = await json(await api('/gezin/maak', { gezinsnaam: 'Fam Planner', naam: 'Mam', pin: '1234' }));
  const kind = await json(await api('/gezin/profiel/maak', { code: g.code, token: g.token,
    naam: 'Sam', rol: 'kind', groep: 'tiener', kleur: '#3A7BD5' }));
  kindId = kind.profiel.id;
  sleutel = g.code + ':' + kindId;
  kindToken = (await json(await api('/gezin/profiel/kies', { code: g.code, profielId: kindId }))).token;
  await api('/school/koppel', { code: g.code, token: g.token, klasCode: klas.code, profielId: kindId });
  await api('/school/uitnodiging/antwoord', { code: g.code, token: kindToken, klasCode: klas.code, akkoord: true });
});
test.after(() => {
  if (child) try { child.kill('SIGKILL'); } catch (e) {}
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('1. open huiswerk staat als schoolpunt op de gezinsagenda; afvinken haalt hem weg', async () => {
  await api('/school/huiswerk/maak', { klasCode: klas.code, leraarToken: klas.leraarToken,
    titel: 'Hoofdstuk 3 lezen', vak: 'Geschiedenis', deadline: plus(3) });
  let b = await json(await api('/gezin/agenda/bereik', { code: g.code, token: g.token, van: plus(0), tot: plus(14) }));
  const punt = b.items.find(i => i.bron === 'school' && /Hoofdstuk 3/.test(i.titel));
  assert.ok(punt, 'de agenda leest school mee, als bron school');
  assert.equal(punt.datum, plus(3), 'op de inleverdag');
  assert.equal(punt.wieNaam, 'Sam');
  assert.equal(punt.wieKleur, '#3A7BD5', 'de kleur van het kind reist mee naar het raster');
  // afvinken (via de bestaande weg) en het punt is van de agenda
  const hw = (await json(await api('/school/mijn', { code: g.code, token: g.token }))).school[0].huiswerk[0];
  await api('/school/huiswerk/af', { code: g.code, token: g.token, klasCode: klas.code, profielId: kindId, huiswerkId: hw.id });
  b = await json(await api('/gezin/agenda/bereik', { code: g.code, token: g.token, van: plus(0), tot: plus(14) }));
  assert.ok(!b.items.find(i => i.bron === 'school' && /Hoofdstuk 3/.test(i.titel)),
    'af is af: het punt verdwijnt vanzelf van de gezinsagenda');
});

test('2. de leerplanner zet huiswerk, leerstappen en de toets per dag op een rij', async () => {
  await api('/school/huiswerk/maak', { klasCode: klas.code, leraarToken: klas.leraarToken,
    titel: 'Werkblad breuken', vak: 'Wiskunde', deadline: plus(2) });
  const t = await json(await rtf('/tiener/toets-maak', { code: g.code, token: kindToken,
    vak: 'Frans', wat: 'unite 4', datum: plus(6) }));
  assert.ok(t.ok, 'de tiener plant een toets');
  // de toets staat ook op de gezinsagenda, alleen-lezen, met de naam van de tiener
  const b = await json(await api('/gezin/agenda/bereik', { code: g.code, token: g.token, van: plus(0), tot: plus(14) }));
  const toets = b.items.find(i => i.bron === 'school' && i.soort === 'toets');
  assert.ok(toets && toets.datum === plus(6) && toets.wieNaam === 'Sam', 'de toetsdag hoort op de gezinsagenda');
  // de planner van het kind: leerstap vandaag, huiswerk op de inleverdag, de toets op zijn dag
  const plan = await json(await api('/school/planner', { code: g.code, token: kindToken }));
  assert.ok(plan.ok);
  const alle = plan.dagen.flatMap(d => d.items.map(i => Object.assign({ datum: d.datum }, i)));
  const stapVandaag = alle.find(i => i.soort === 'leerstap' && i.datum === plus(0));
  assert.ok(stapVandaag && stapVandaag.vanMij === true, 'de eerste leerstap staat vandaag klaar, en is van de tiener zelf');
  assert.ok(alle.find(i => i.soort === 'huiswerk' && i.datum === plus(2)), 'huiswerk op de inleverdag');
  assert.ok(alle.find(i => i.soort === 'toets' && i.datum === plus(6)), 'de toets op de toetsdag');
  // de ouder ziet dezelfde stap, maar niet als de zijne (afvinken is aan de tiener)
  const plO = await json(await api('/school/planner', { code: g.code, token: g.token }));
  const stapO = plO.dagen.flatMap(d => d.items).find(i => i.soort === 'leerstap');
  assert.ok(stapO && stapO.vanMij === false, 'de ouder kijkt mee maar vinkt niet af');
  // de tiener vinkt de stap af en hij is uit de planner
  await rtf('/tiener/toets-stap', { code: g.code, token: kindToken, id: stapVandaag.toetsId, dag: stapVandaag.dag, af: true });
  const plan2 = await json(await api('/school/planner', { code: g.code, token: kindToken }));
  assert.ok(!plan2.dagen.flatMap(d => d.items).find(i => i.soort === 'leerstap' && i.dag === stapVandaag.dag && i.toetsId === stapVandaag.toetsId),
    'een afgevinkte leerstap is klaar en verdwijnt uit de planning');
});

test('3. de oppas ziet de gezinsagenda, maar de schoolzaken niet', async () => {
  const gast = await json(await api('/gezin/profiel/maak', { code: g.code, token: g.token, naam: 'Oppas Els', rol: 'gast' }));
  const gastToken = (await json(await api('/gezin/profiel/kies', { code: g.code, profielId: gast.profiel.id }))).token;
  const b = await json(await api('/gezin/agenda/bereik', { code: g.code, token: gastToken, van: plus(0), tot: plus(14) }));
  assert.equal(b.magBewerken, false, 'een oppas leest mee, schrijft niet');
  assert.ok(!b.items.some(i => i.bron === 'school'), 'huiswerk en toetsen zijn van het gezin, niet van de oppas');
  assert.equal((await api('/school/planner', { code: g.code, token: gastToken })).status, 403,
    'de leerplanner is dicht voor gasten');
});
