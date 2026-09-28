/* De IMAP-apparaatsleutel vervalt en roteert (CODECREDENTIALS.json,
   rtmail.imap_apparaatsleutel; server/kern/mailsleutel.js).

   Wat hier moet kunnen zakken:
   1. maken zet een vervaldatum (standaard 180, hoogstens 365 dagen) met
      uitgever en doel, en een ongeldige telling wordt geweigerd;
   2. een verlopen sleutel logt niet meer in, en een sleutel van voor de regel
      werkt tot LEGACY_TOT en niet langer;
   3. roteren geeft hetzelfde apparaat een nieuw geheim en maakt het oude meteen
      waardeloos -- geen overlap;
   4. elke sleutel van het postvak wordt vergeleken, zonder vroege uitgang, en
      gebruik wordt geteld;
   5. over HTTP, voor lid EN zaak: roteren via de echte route, en het antwoord
      gaat geen cache in.

   MUTATIES (LAT.md regel 2), elk gedraaid en gezakt:
   - controleer(): de vervalregel weg -> toets 2 zakt
   - vervaltVan(): `|| LEGACY_TOT` weg -> toets 2 zakt
   - roteer(): `hash: hash(geheim)` weg (oude hash blijft) -> toets 3 zakt
   - controleer(): `return` bij de eerste treffer (vroege uitgang) -> toets 4 zakt
   - geldigheid(): bovengrens weg -> toets 1 zakt

   Draai los: node --test test/imap-sleutelverval.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const echt = require('node:crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

const DAG = 86400000;
const ADRES = 'lid@rtgpass.rtg';
function maak(crypto) {
  const db = { data: {} };
  return { db, s: require('../server/kern/mailsleutel')({ db, save: () => {}, crypto: crypto || echt }) };
}
function metKlok(t, werk) {
  const oud = Date.now;
  Date.now = () => t;
  try { return werk(); } finally { Date.now = oud; }
}

test('1. maken zet een vervaldatum met uitgever en doel, en een ongeldige telling wordt geweigerd', () => {
  const { db, s } = maak();
  const t0 = Date.now();
  const r = s.maak(ADRES, 'Laptop');
  assert.ok(Math.abs(Date.parse(r.vervalt) - (t0 + 180 * DAG)) < 60000, 'standaard 180 dagen');
  assert.ok(Math.abs(Date.parse(s.maak(ADRES, 'Tablet', 365).vervalt) - (t0 + 365 * DAG)) < 60000);
  for (const fout of [0, 366, 1.5, 'altijd']) assert.ok(s.maak(ADRES, 'X', fout).error, 'dagen ' + fout);
  const rij = db.data.mailSleutels.rijen[0];
  assert.equal(rij.issuer, 'rtg.rtmail');
  assert.equal(rij.doel, 'imap-apparaat');
  assert.ok(!JSON.stringify(db.data).includes(r.sleutel), 'alleen de hash staat in de opslag');
});

test('2. een verlopen sleutel logt niet in, en een sleutel van voor de regel werkt tot de legacydatum', () => {
  const { db, s } = maak();
  const r = s.maak(ADRES, 'Laptop', 1);
  assert.equal(s.controleer(ADRES, r.sleutel).ok, true);
  assert.equal(metKlok(Date.now() + 2 * DAG, () => s.controleer(ADRES, r.sleutel)).ok, false, 'na de vervaldatum niet meer');
  delete db.data.mailSleutels.rijen[0].vervalt;   // zo stond hij er voor de regel
  assert.equal(s.lijst(ADRES)[0].legacy, true);
  const grens = Date.parse(s.LEGACY_TOT);
  assert.equal(metKlok(grens - DAG, () => s.controleer(ADRES, r.sleutel)).ok, true, 'een mailclient breekt niet vandaag');
  assert.equal(metKlok(grens + 1000, () => s.controleer(ADRES, r.sleutel)).ok, false, 'maar niet na de legacydatum');
});

test('3. roteren geeft een nieuw geheim en maakt het oude meteen waardeloos', () => {
  const { s } = maak();
  const r = s.maak(ADRES, 'Laptop');
  const n = s.roteer(ADRES, r.id);
  assert.equal(n.id, r.id, 'zelfde apparaat');
  assert.equal(n.naam, 'Laptop');
  assert.notEqual(n.sleutel, r.sleutel);
  assert.equal(s.controleer(ADRES, r.sleutel).ok, false, 'de oude werkt niet meer');
  assert.equal(s.controleer(ADRES, n.sleutel).ok, true, 'de nieuwe wel');
  assert.ok(s.roteer(ADRES, 'bestaatniet').error);
  assert.ok(s.roteer('ander@rtgpass.rtg', r.id).error, 'een ander postvak roteert deze sleutel niet');
});

test('4. elke sleutel van het postvak wordt vergeleken zonder vroege uitgang, en gebruik wordt geteld', () => {
  const crypto = Object.create(echt);
  let n = 0;
  crypto.timingSafeEqual = (a, b) => { n++; return echt.timingSafeEqual(a, b); };
  const { s } = maak(crypto);
  const eerste = s.maak(ADRES, 'Een');
  s.maak(ADRES, 'Twee');
  s.maak(ADRES, 'Drie');
  s.maak('ander@rtgpass.rtg', 'Vreemd');
  n = 0;
  assert.equal(s.controleer(ADRES, eerste.sleutel).ok, true);
  assert.equal(n, 3, 'de treffer staat eerst, en toch zijn alle drie de sleutels van dit postvak vergeleken');
  s.controleer(ADRES, eerste.sleutel);
  assert.equal(s.lijst(ADRES).find(x => x.naam === 'Een').gebruik, 2);
});

test('5. over HTTP roteren lid en zaak hun eigen apparaatsleutel', async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-imapverval-'));
  const srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  const api = (pad, body, tok) => fetch(srv.base + pad, { method: 'POST',
    headers: Object.assign({ 'Content-Type': 'application/json' }, tok ? { Authorization: 'Bearer ' + tok } : {}),
    body: JSON.stringify(body || {}) }).then(async x => ({ status: x.status, koppen: x.headers, body: await x.json().catch(() => ({})) }));
  try {
    const u = Date.now().toString().slice(-9);
    const lid = (await api('/api/auth/register', { name: 'Imap Lid', email: 'iv' + u + '@x.nl', phone: '06' + u.slice(0, 8),
      password: 'geheim12345', geboortedatum: '1990-01-01', tier: 'business', pasApp: 'business' })).body.token;
    const rooster = await api('/api/supplier/roster', { code: 'KIKUNOI' });
    const manager = (rooster.body.staff || []).find(x => x.role === 'manager');
    const zaak = (await api('/api/supplier/login', { code: 'KIKUNOI', staffId: manager.id, pin: '1234' })).body.token;
    assert.ok(lid && zaak);
    for (const [kant, tok] of [['member', lid], ['supplier', zaak]]) {
      const pad = '/api/' + kant + '/rtmail/imap/';
      assert.ok([401, 403].includes((await api(pad + 'roteer', { id: 'x' })).status), kant + ': niet zonder inlog');
      const m = await api(pad + 'sleutel', { naam: 'Telefoon', dagen: 30 }, tok);
      assert.equal(m.status, 200, kant + ': ' + JSON.stringify(m.body).slice(0, 160));
      assert.match(m.koppen.get('cache-control') || '', /no-store/);
      assert.equal((await api(pad + 'sleutel', { naam: 'Telefoon', dagen: 999 }, tok)).status, 400);
      const r = await api(pad + 'roteer', { id: m.body.id }, tok);
      assert.equal(r.status, 200, kant + ': ' + JSON.stringify(r.body).slice(0, 160));
      assert.match(r.koppen.get('cache-control') || '', /no-store/);
      assert.notEqual(r.body.sleutel, m.body.sleutel);
      const lijst = (await api(pad + 'sleutels', {}, tok)).body.sleutels;
      assert.equal(lijst.length, 1, kant + ': roteren maakt geen tweede sleutel');
      assert.ok(lijst[0].vervalt && !JSON.stringify(lijst).includes(r.body.sleutel));
    }
  } finally { stop(srv.child); try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {} }
});
