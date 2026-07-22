/* Het RTG Onderzoekslab: projecten in negen velden met de vaste fase-keten
   (idee > onderzoek > prototype > proef > uitrol), de menselijke veiligheids-
   en ethiektoets als poort naar de proef, de harde weigering van schadelijke
   richtingen en een kennisbank die nooit iets vergeet. Draai los:
   node --experimental-sqlite --test test/onderzoekslab.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

let srv, base, token;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-lab-'));
const api = (pad, body) => fetch(base + '/api/lab/' + pad, {
  method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
  body: JSON.stringify(body || {})
}).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, OFFICE_CODE: 'LAB-KEURING-1' } });
  base = srv.base;
  const login = await fetch(base + '/api/office/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: 'LAB-KEURING-1' }) });
  token = (await login.json()).token;
  assert.ok(token, 'het kantoor logt in');
});
test.after(() => { stop(srv && srv.child); try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {} });

let project;
test('negen velden, en een project start altijd als idee', async () => {
  const dicht = await fetch(base + '/api/lab/overzicht', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
  assert.equal(dicht.status, 401, 'zonder inlog blijft het lab dicht');
  const o = await api('overzicht');
  assert.equal(o.status, 200);
  assert.equal(o.body.velden.length, 9, 'negen onderzoeksvelden');
  for (const v of ['hardware', 'software', 'dorp', 'meta', 'landbouw']) assert.ok(o.body.velden.some(x => x.veld === v), v + ' is een veld');
  const p = await api('project/maak', { titel: 'Zonne-waterpomp voor een dorp', veld: 'dorp', voorWie: 'samen', doel: 'Schoon water zonder dieselpomp', budget: 25000 });
  assert.equal(p.status, 200);
  project = p.body.project;
  assert.equal(project.fase, 'idee');
  assert.equal(project.veiligheid.status, 'open', 'de toets begint open');
});

test('schadelijke richtingen weigert het lab hard', async () => {
  const w = await api('project/maak', { titel: 'Slim wapensysteem', veld: 'hardware' });
  assert.equal(w.status, 400);
  assert.match(w.body.error, /nooit wapens/i);
});

test('de fase-keten slaat nooit een stap over, en de proef wacht op de menselijke toets', async () => {
  assert.equal((await api('project/fase', { id: project.id, fase: 'prototype' })).status, 400, 'idee direct naar prototype mag niet');
  assert.equal((await api('project/fase', { id: project.id, fase: 'onderzoek' })).status, 200);
  assert.equal((await api('project/fase', { id: project.id, fase: 'prototype' })).status, 200);
  const geblokt = await api('project/fase', { id: project.id, fase: 'proef' });
  assert.equal(geblokt.status, 409, 'zonder akkoord geen proef');
  assert.match(geblokt.body.error, /veiligheids/i);
  const naamloos = await api('project/veiligheid', { id: project.id, status: 'akkoord' });
  assert.equal(naamloos.status, 400, 'de toets draagt altijd een naam');
  assert.equal((await api('project/veiligheid', { id: project.id, status: 'akkoord', door: 'Ir. Fatima', notitie: 'Waterkwaliteit dubbel getest' })).status, 200);
  assert.equal((await api('project/fase', { id: project.id, fase: 'proef' })).status, 200, 'na het akkoord opent de poort');
});

test('logboek, bevindingen en een kennisbank die nooit vergeet (ook het archief)', async () => {
  assert.equal((await api('project/log', { id: project.id, tekst: 'Eerste pomp draait op het testveld.' })).status, 200);
  assert.equal((await api('project/bevinding', { id: project.id, titel: 'Zonnepaneel op 30 graden wint 18%', tekst: 'Gemeten over twee weken proef.' })).status, 200);
  assert.equal((await api('project/fase', { id: project.id, fase: 'uitrol' })).status, 200);
  assert.equal((await api('project/fase', { id: project.id, fase: 'archief' })).status, 200);
  const kb = await api('kennisbank');
  assert.equal(kb.status, 200);
  assert.ok(kb.body.bevindingen.some(b => b.titel.includes('30 graden')), 'de bevinding blijft, ook na het archief');
  const ai = await api('ai', { q: 'Hoe zet ik een eerlijke nulmeting op?' });
  assert.equal(ai.status, 200);
  assert.ok(ai.body.antwoord.length > 20, 'de onderzoekscoach antwoordt (demo of echt)');
});
