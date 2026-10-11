/* DE HERZEGELING OP EEN ECHTE SERVER: /api/privacy/delete legt het externe
   anker niet stil.

   test/ankerherzegel.test.js toetst de regels op een los journaal; dit toetst
   dat de wissing in kern/vergeten.js ze werkelijk aanroept -- tekenen VOOR de
   herzegeling, en daarna een ankerronde als onderdeel van de wissing -- met de
   referentieontvanger als tweede machine.

   Draai los: node --test test/ankerherzegel-echt.test.js */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, stop } = require('./helper');
const fs = require('fs'), os = require('os'), path = require('path');
const { maakOntvanger } = require('../scripts/ankerontvanger');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-herzegel-echt-'));
let srv, base, kantoor, lid, ontvanger;

const api = (pad, body, t) => fetch(base + pad, { method: 'POST',
  headers: Object.assign({ 'Content-Type': 'application/json' }, t ? { Authorization: 'Bearer ' + t } : {}),
  body: JSON.stringify(body || {}) }).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
const regels = () => fs.readFileSync(ontvanger.bestand, 'utf8').trim().split('\n').filter(Boolean).map(r => JSON.parse(r));

test.before(async () => {
  ontvanger = maakOntvanger({ map: path.join(TMP, 'tweede-machine') });
  /* 127.0.0.2: de ankerpost weigert 127.0.0.1 en localhost als "deze machine zelf". */
  await new Promise((ja, nee) => ontvanger.server.listen(0, '127.0.0.2', ja).on('error', nee));
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: path.join(TMP, 'data'),
    RTG_ANKERPOST_URL: 'http://127.0.0.2:' + ontvanger.server.address().port + '/', RTG_ANKERPOST_ONVEILIG: '1' } });
  base = srv.base;
  kantoor = (await api('/api/auth/login', { login: 'roellie.i@gmail.com', password: 'Imran', pasApp: 'business' })).body.token;
  assert.ok(kantoor, 'kantoor ingelogd');
  const reg = await api('/api/auth/register', { name: 'Ankie Ankerwis', email: 'ankie' + Date.now() + '@anker.test',
    phone: '0633333333', password: 'geheim12345', geboortedatum: '1990-03-03', tier: 'rtg', pasApp: 'rtg' });
  assert.equal(reg.status, 200, JSON.stringify(reg.body));
  lid = reg.body.token;
  /* Schrijfhandelingen van het lid: die zet het API-spoor op zijn sleutel. */
  for (let i = 0; i < 3; i++) assert.equal((await api('/api/state', {}, lid)).status, 200);
});
test.after(() => { stop(srv && srv.child); ontvanger.server.close(); try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {} });

test('een AVG-wissing ankert zelf door: getekende herzegeling naar buiten, en de volgende ronde klopt', async () => {
  const eerst = await api('/api/office/anker/post', {}, kantoor);
  assert.equal(eerst.status, 200);
  assert.equal(eerst.body.uitkomst.ok, true, 'het eerste blok staat buiten: ' + JSON.stringify(eerst.body.uitkomst));
  const voorWissing = regels().length;

  const weg = await api('/api/privacy/delete', {}, lid);
  assert.equal(weg.status, 200, JSON.stringify(weg.body));

  const na = regels();
  assert.equal(na.length, voorWissing + 1, 'de wissing bracht zelf een nieuw blok weg');
  const mee = na[na.length - 1].herzegelingen || [];
  assert.equal(mee.length, 1, 'met de getekende herzegeling erbij');
  assert.equal(mee[0].journaal, 'apiSpoor');
  assert.ok(mee[0].regels.some(g => g.gewist), 'die zegt welke regels hun actor verloren');
  assert.deepEqual(mee[0].door, { rol: 'lid', wie: 'de betrokkene zelf' }, 'wie wiste komt uit de sessie, zonder sleutel');

  /* Het blok van VÓÓR de wissing rekent nog steeds af -- verklaard, niet genegeerd. */
  const oud = await api('/api/office/anker/reken', { blok: na[voorWissing - 1].blok }, kantoor);
  assert.equal(oud.body.ok, true, JSON.stringify(oud.body.perJournaal && oud.body.perJournaal.apiSpoor));
  assert.equal(oud.body.perJournaal.apiSpoor.herzegeld, true);

  /* En de periodieke ronde daarna: vergelijken klopt, geen stilstand. */
  const reken = await api('/api/office/anker/post/reken', {}, kantoor);
  assert.equal(reken.body.uitkomst.ok, true, JSON.stringify(reken.body.uitkomst));
});
