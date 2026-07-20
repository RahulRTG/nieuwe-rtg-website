/* RTG Stad: het slimme-stad-platform op eigen hardware (de Stadsdoos-vloot) en
   eigen software. Getest: het stadsbeeld met de demovloot en de privacy-belofte;
   de scenario-knop die alle regimes in een keer verzet (met auditspoor, en het
   nood-scenario dat de beveiligingslaag meldt); het aanmelden van een echte
   Stadsdoos (sleutel een keer zichtbaar) en de hardware-poort met apparaat-
   sleutel (verkeerde sleutel dicht, vreemde sensor geweigerd); het losse
   regime; de AI-stadsregisseur; de STAD-01-check op het technische bord en de
   aidata-bron 'stad'.
   Draai los: node --experimental-sqlite --test test/stad.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

let srv, base, office;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-stad-'));

const api = (pad, body, token) => fetch(base + '/api/' + pad, {
  method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
  body: JSON.stringify(body || {})
}).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
const oapi = (pad, body) => api('office/' + pad, { ...(body || {}), naam: 'Aïsha' }, office);

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, OFFICE_CODE: 'KANTOOR-STAD-1' } });
  base = srv.base;
  const o = await (await fetch(base + '/api/office/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: 'KANTOOR-STAD-1' }) })).json();
  office = o.token;
  assert.ok(office, 'het kantoor logt in');
});
test.after(() => { stop(srv && srv.child); try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {} });

test('het stadsbeeld: demovloot, acht domeinen, zones en de privacy-belofte', async () => {
  const b = await oapi('stad');
  assert.equal(b.status, 200);
  assert.equal(b.body.scenario, 'normaal', 'de stad start in de gewone stand');
  assert.ok(b.body.zones.length >= 6, 'de zones staan klaar');
  assert.equal(b.body.domeinen.length, 8, 'alle acht domeinen op het bord');
  assert.ok(b.body.vloot.totaal >= 8 && b.body.vloot.online >= 1, 'de demovloot leeft');
  assert.ok(b.body.domeinen.some(d => d.waarde != null), 'er zijn verse metingen');
  assert.match(b.body.privacy, /geen mensen/, 'privacy by design staat op het bord zelf');
});

test('de scenario-knop verzet alle regimes in een keer, met auditspoor', async () => {
  const r = await oapi('stad/scenario', { scenario: 'evenement' });
  assert.equal(r.status, 200);
  assert.equal(r.body.scenario, 'evenement');
  const b = (await oapi('stad')).body;
  assert.equal(b.scenario, 'evenement');
  assert.equal(b.domeinen.find(d => d.id === 'verkeer').regime, 'streng', 'evenement zet het verkeersregime streng');
  assert.equal(b.domeinen.find(d => d.id === 'afval').regime, 'intensief', 'en het ophalen intensief');
  assert.equal((await oapi('stad/scenario', { scenario: 'onzin' })).status, 400, 'een onbekend scenario is geweigerd');
  const board = (await oapi('boardroom')).body;
  assert.ok((board.audit || []).some(a => /RTG Stad-scenario/.test(a.wat)), 'de schakeling staat in het auditlog');
  await oapi('stad/scenario', { scenario: 'normaal' });
});

test('eigen hardware: een Stadsdoos aanmelden en insturen met de apparaat-sleutel', async () => {
  const aan = await oapi('stad/node/aanmeld', { doosNaam: 'Stadsdoos Brug', zone: 'Centrum', sensoren: ['verkeer', 'geluid'] });
  assert.equal(aan.status, 200);
  assert.match(aan.body.serial, /^SD-[0-9A-F]{6}$/, 'een eigen serienummer');
  assert.ok(aan.body.sleutel && aan.body.sleutel.length >= 32, 'de apparaat-sleutel wordt een keer gegeven');
  const { serial, sleutel } = aan.body;

  // de hardware-poort: hartslag en metingen, alleen met de juiste sleutel
  assert.equal((await api('stad/doos/hartslag', { serial, sleutel })).status, 200);
  assert.equal((await api('stad/doos/hartslag', { serial, sleutel: 'fout' })).status, 401, 'verkeerde sleutel: dicht');
  const m = await api('stad/doos/meting', { serial, sleutel, metingen: [
    { sens: 'verkeer', waarde: 512 },          // eigen sensor: geboekt
    { sens: 'lucht', waarde: 40 },             // niet op deze doos: geweigerd
    { sens: 'geluid', waarde: 9999 }           // buiten bereik: geweigerd
  ] });
  assert.equal(m.status, 200);
  assert.equal(m.body.geboekt, 1, 'alleen de eigen, geldige meting telt');
  assert.equal(m.body.geweigerd, 2);
  const b = (await oapi('stad')).body;
  const doos = b.nodes.find(n => n.serial === serial);
  assert.ok(doos && doos.online && !doos.demo, 'de echte doos staat online op het bord');
  // uit dienst nemen sluit de poort
  await oapi('stad/node/stop', { serial });
  assert.equal((await api('stad/doos/meting', { serial, sleutel, metingen: [{ sens: 'verkeer', waarde: 100 }] })).status, 401, 'uit dienst = poort dicht');
});

test('los regime, AI-stadsregisseur, nood -> beveiligingsmelding, bewaking en dataset', async () => {
  // een los regime naast de knop
  assert.equal((await oapi('stad/regime', { domein: 'licht', regime: 'vol' })).body.regime, 'vol');
  assert.equal((await oapi('stad')).body.domeinen.find(d => d.id === 'licht').regime, 'vol');
  assert.equal((await oapi('stad/regime', { domein: 'licht', regime: 'onzin' })).status, 400);
  // de AI adviseert (en beslist niet): altijd een samenvatting + tips
  const adv = await oapi('stad/advies', { vraag: 'Hoe staat de stad ervoor?' });
  assert.equal(adv.status, 200);
  assert.ok(Array.isArray(adv.body.tips) && adv.body.tips.length >= 1 && adv.body.samenvatting.length > 0);
  // nood meldt de beveiligingslaag (zichtbaar op het technische bord)
  await oapi('stad/scenario', { scenario: 'nood' });
  const tech = await (await fetch(base + '/api/techniek/inloggen', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ login: 'roellie.i@gmail.com', wachtwoord: 'Imran' }) })).json();
  assert.ok(tech.token, 'de eigenaar komt op het technische bord');
  const status = await (await fetch(base + '/api/techniek/status', { method: 'GET', headers: { Authorization: 'Bearer ' + tech.token } })).json();
  assert.ok(JSON.stringify(status.beveiliging).includes('stad-nood'), 'het nood-scenario staat als beveiligingsmelding op het bord');
  const chk = status.checks.find(c => c.code === 'STAD-01');
  assert.ok(chk, 'STAD-01 staat in de bewaking');
  assert.equal(chk.status, 'ok', 'de vloot is gezond: ' + chk.detail);
  await oapi('stad/scenario', { scenario: 'normaal' });
  // de metingen zitten (zonder persoonsgegevens) in de eigen-AI-dataset
  const ai = (await oapi('aidata')).body;
  assert.ok(ai.bronnen.stad >= 1, 'de bron "stad" telt mee in de dataset');
});
