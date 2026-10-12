/* DE LEIDINGSPLEK VAN EEN ZAAKPOSTVAK (kern/rtmail-leiding.js) -- vijfde
   tegenlezing van PR #584.

   Sollicitatiepost hoort bij de werving, en die is van de manager. Ze staat
   daarom niet in het gedeelde zaakpostvak maar op een plek ernaast die geen
   adres is. Twee dingen worden hier op een echte server bewezen:

   1. MIGRATIE: post die op de oude manier in het gedeelde postvak staat (van
      voor deze plek, zonder `beperkt`), wordt bij het opstarten verhuisd. Daarna
      krijgt een medewerker hem via GEEN enkele route -- inbox, telling, lezen,
      vak, zoeken, gesprekken, draad, hulp, export -- en kan hij hem niet
      verplaatsen, labelen of een ster geven. De manager ziet hem in zijn inbox.
   2. KAPEN: een lid dat een team "kikunoi-leiding" aanmaakt, krijgt er niets van
      binnen -- er is geen adres om naar te sturen of na te maken.

   Draai: node --test test/rtmail-leidingplek.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'); const os = require('os'); const path = require('path');
const { startServer, stopNet } = require('./helper');

let srv, TMP;
const env = () => ({ RTG_DATA_DIR: TMP, SMTP_URL: '', RTG_DEMO: '1', RTG_STORE: 'json' });
const api = (pad, body, token) => fetch(srv.base + pad, {
  method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
  body: JSON.stringify(body || {})
}).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
async function inlog() {
  const roster = (await api('/api/supplier/roster', { code: 'KIKUNOI' })).body;
  const mgr = roster.staff.find(x => x.role === 'manager');
  const st = roster.staff.find(x => x.role === 'staff');
  return {
    tokM: (await api('/api/supplier/login', { code: 'KIKUNOI', staffId: mgr.id, pin: '1234' })).body.token,
    tokW: (await api('/api/supplier/login', { code: 'KIKUNOI', staffId: st.id, pin: '5678' })).body.token
  };
}
let postId, lid;

test.before(async () => {
  TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-leidingplek-'));
  srv = await startServer({ env: env() });
  const reg = await api('/api/auth/register', { name: 'Sanne Leiding', email: 'sanne.leiding@x.nl', phone: '0612340009',
    password: 'geheim123', geboortedatum: '1990-01-01', tier: 'business', pasApp: 'business' });
  lid = reg.body.token;
  assert.equal((await api('/api/cv/save', { name: 'Sanne Leiding', contact: 's@x.nl', skills: 'koken', experience: 'horeca' }, lid)).status, 200);
  assert.equal((await api('/api/member/apply', { supplierCode: 'KIKUNOI', func: 'Kok' }, lid)).status, 200);
  const { tokM } = await inlog();
  const post = (await api('/api/supplier/rtmail/inbox', {}, tokM)).body.berichten.find(m => m.onderwerp === 'Nieuwe sollicitatie');
  assert.ok(post, 'de manager ziet de sollicitatiepost');
  postId = post.id;

  // de OUDE plaatsing nabootsen: in het gedeelde postvak, zonder `beperkt`, en nog niet gemigreerd
  await stopNet(srv.child);
  const pad = path.join(TMP, 'db.json');
  const db = JSON.parse(fs.readFileSync(pad, 'utf8'));
  const i = db.rtmail.leiding.findIndex(m => m.id === postId);
  assert.ok(i >= 0, 'de post stond op de leidingsplek');
  const [m] = db.rtmail.leiding.splice(i, 1);
  delete m.beperkt;
  delete m.regel;   // van voor de termijnregel (584A)
  m.at = new Date(Date.now() - 3 * 86400e3).toISOString();   // oud genoeg voor een termijn van een dag
  db.rtmail.berichten.unshift(m);
  delete db.rtmail.leidingVersie;
  fs.writeFileSync(pad, JSON.stringify(db));
  srv = await startServer({ env: env() });
});
test.after(async () => {
  try { await stopNet(srv.child); } catch (e) {}
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('1. oude sollicitatiepost in het gedeelde postvak: na het opstarten via geen enkele route bij een medewerker', async () => {
  const { tokM, tokW } = await inlog();
  assert.ok((await api('/api/supplier/rtmail/inbox', {}, tokM)).body.berichten.some(m => m.id === postId), 'de manager ziet hem nog');
  const lezen = [['/api/supplier/rtmail/inbox', {}], ['/api/supplier/rtmail/ongelezen', {}], ['/api/supplier/rtmail/vak', {}],
    ['/api/supplier/rtmail/vak', { map: 'archief' }], ['/api/supplier/rtmail/zoek', { vraag: 'sollicitatie' }],
    ['/api/supplier/rtmail/gesprekken', {}], ['/api/supplier/rtmail/draad', { id: postId }], ['/api/supplier/rtmail/hulp', { id: postId }],
    ['/api/supplier/rtmail/export', { reden: 'proef', metInhoud: true }], ['/api/supplier/rtmail/assist', {}]];
  for (const [pad, body] of lezen) {
    const r = await api(pad, body, tokW);
    assert.ok(!JSON.stringify(r.body).includes(postId), pad + ' levert een medewerker de sollicitatiepost');
  }
  assert.equal((await api('/api/supplier/rtmail/lees', { id: postId }, tokW)).status, 404, 'lezen');
  for (const [pad, body] of [['/api/supplier/rtmail/verplaats', { id: postId, map: 'archief' }],
    ['/api/supplier/rtmail/etiket', { id: postId, label: 'weg' }], ['/api/supplier/rtmail/ster', { id: postId }]]) {
    const r = await api(pad, body, tokW);
    assert.ok(r.status >= 400, pad + ' laat een medewerker de post aanraken: ' + r.status);
  }
  // en de manager ziet hem daarna nog steeds, ongewijzigd
  assert.ok((await api('/api/supplier/rtmail/inbox', {}, tokM)).body.berichten.some(m => m.id === postId));
});

test('2. een team met de naam van de leidingsplek krijgt er niets van binnen', async () => {
  const maak = await api('/api/member/rtmail/team/maak', { naam: 'Kikunoi leiding', adres: 'kikunoi-leiding' }, lid);
  if (maak.status === 200 && maak.body.team) {
    const pv = await api('/api/member/rtmail/team/postvak', { id: maak.body.team.id, alles: true }, lid);
    assert.ok(!JSON.stringify(pv.body).includes(postId), 'het team ziet de sollicitatiepost');
  }
  // en sturen naar dat adres komt nooit op de leidingsplek
  const { tokM } = await inlog();
  const voor = (await api('/api/supplier/rtmail/inbox', {}, tokM)).body.berichten.length;
  await api('/api/supplier/rtmail/stuur', { naar: 'kikunoi-leiding', onderwerp: 'binnendringer', tekst: 'x' }, tokM);
  const na = (await api('/api/supplier/rtmail/inbox', {}, tokM)).body.berichten;
  assert.ok(!na.some(m => m.onderwerp === 'binnendringer'), 'post aan een adres komt niet in de inbox van de zaak');
  assert.ok(na.length >= voor);
});

test('3. bewaartermijn, juridische bewaring en export gelden ook voor de leidingsplek', async () => {
  const { tokM, tokW } = await inlog();
  const inbox = async () => (await api('/api/supplier/rtmail/inbox', {}, tokM)).body.berichten.map(m => m.id);
  // de export van een manager neemt de wervingspost mee, die van een medewerker niet (toets 1)
  const ex = await api('/api/supplier/rtmail/export', { reden: 'proef', metInhoud: true }, tokM);
  assert.ok(ex.body.berichten.some(m => m.id === postId), 'de export van de manager dekt de leidingsplek');
  assert.ok(!JSON.stringify((await api('/api/supplier/rtmail/export', { reden: 'proef' }, tokW)).body).includes(postId));
  // een juridische bewaring houdt hem vast, ook over de termijn
  assert.equal((await api('/api/supplier/rtmail/bewaartermijn', { dagen: 1, reden: 'proef' }, tokM)).status, 200);
  assert.equal((await api('/api/supplier/rtmail/bewaring', { aan: true, zaak: 'Z-1', reden: 'onderzoek' }, tokM)).status, 200);
  assert.notEqual((await api('/api/supplier/rtmail/opruimen', { reden: 'proef' }, tokM)).status, 200, 'onder een bewaring verdwijnt niets');
  assert.ok((await inbox()).includes(postId), 'de wervingspost staat er nog');
  /* zonder bewaring ruimt de POSTVAKtermijn van een dag hem NIET op: de leidingsplek
     volgt zijn eigen termijn (584A, test/rtmail-leidingtermijn.test.js), en een
     kortere postvaktermijn wordt niet stil overgenomen */
  assert.equal((await api('/api/supplier/rtmail/bewaring', { aan: false, reden: 'onderzoek klaar' }, tokM)).status, 200);
  const op = await api('/api/supplier/rtmail/opruimen', { reden: 'proef' }, tokM);
  assert.equal(op.status, 200, JSON.stringify(op.body));
  assert.ok((await inbox()).includes(postId), 'een postvaktermijn ruimde de leidingsplek op');
});

test('4. vangnet: beperkte post die NA de verhuizing in het gedeelde postvak komt, ziet een collega niet', () => {
  /* Een oude instantie bij een rolling deploy, of een andere schrijver, kan nog
     beperkte post in `berichten` zetten. Elke lezer roept dezelfde schoonLeiding() aan
     (kern/rtmail-leiding.js), zonder vlag. Hier rechtstreeks op de kern, want
     over HTTP is "een andere schrijver" niet na te bootsen. */
  const crypto = require('crypto');
  const db = { data: {} };
  const save = () => {};
  const rtmail = require('../server/kern/rtmail')({ db, save, crypto });
  const vak = require('../server/kern/rtmail-vak')({ db, save, rtmail });
  const draad = require('../server/kern/rtmail-draad')({ db, save, rtmail, vak });
  rtmail.systeemStuur('kik', 'Gewone post', 'hallo', 'systeem');
  rtmail.postvak('kik');                                   // de opslag bestaat en is al eens geschoond
  const stray = (id, naar) => ({ id, van: 'rtg@rtmail', naar, soort: 'personeel', onderwerp: 'Nieuwe sollicitatie', tekst: 'x',
    at: new Date().toISOString(), gelezen: false, bron: 'systeem' });
  // stray1 komt uit de tussenversie met een -leiding-adres, stray2 rechtstreeks in het gedeelde postvak
  db.data.rtmail.berichten.unshift(stray('stray1', 'kik-leiding@rtmail'), stray('stray2', 'kik@rtmail'));
  assert.ok(!JSON.stringify(vak.lijst('kik')).includes('stray'), 'vak.lijst levert hem niet (en IMAP loopt daarlangs)');
  assert.ok(!JSON.stringify(draad.lijst('kik', {})).includes('stray'), 'draad.lijst ook niet');
  assert.ok(!rtmail.postvak('kik').some(m => /stray/.test(m.id)));
  assert.ok(rtmail.leiding.post('kik').some(m => m.id === 'stray2'));
  const op = rtmail.leiding.post('kik').find(m => m.id === 'stray1');
  assert.ok(op, 'hij staat op de leidingsplek');
  assert.equal(op.naar, 'kik@rtmail', 'en het achtervoegsel -leiding is eraf');
});
// de bronscan per leesplek staat in test/rtmail-leiding-pg.test.js
