/* De apparaatsleutel van de Stadsdoos als gemigreerde credential
   (CODECREDENTIALS.json, devices.stadsdoos_sleutel; kern/stad/doossleutel.js).

   Wat hier moet kunnen zakken:
   1. UITGIFTE: 128 bit, alleen de SHA-256 bewaard, uitgever/doel/scope en een
      VERPLICHTE vervaldatum van hoogstens een jaar.
   2. CONSTANTE TIJD: beide hashes (huidig en vorig) worden met timingSafeEqual
      vergeleken, ook als de eerste al raak is -- een `===` of een vroege uitgang
      laat de teller hieronder zakken.
   3. VERVAL EN OVERLAP: een verlopen sleutel opent niets; de vorige sleutel
      overlapt na een rotatie een dag en nooit langer dan zijn eigen verval; een
      sleutel van voor de regel geldt tot LEGACY_TOT.
   4. HET MANIFEST WORDT NIET MET DE OPGESLAGEN HASH ONDERTEKEND maar met een
      uit een servergeheim afgeleide sleutel per doos en generatie; zonder
      servergeheim is er geen handtekening.
   5. UITGIFTE OP NAAM: de gedeelde kantoorcode krijgt 403 op aanmelden en
      roteren (naamAuth).

   MUTATIES (LAT.md regel 2), elk gedraaid en gezakt:
   - doossleutel.js past(): `const vorig = ...` pas na een mislukte `huidig`
     uitrekenen (vroege uitgang) -> toets 2 zakt
   - gelijk(): timingSafeEqual vervangen door `x.equals(y)` -> toets 2 zakt
   - geef(): `n.sleutelVervalt = t + SLEUTEL_MAX_MS` weg -> toets 1 en 3 zakken
   - geef(): `Math.min(t + OVERLAP_MS, vervaltVan(n))` -> `t + OVERLAP_MS` -> toets 3 zakt
   - onderteken(): HMAC met `n.sleutelHash` in plaats van de afgeleide sleutel
     (apparaatupdate.js zoals het was) -> toets 4 zakt
   - routes/kantoren/stad.js: naamAuth op /stad/sleutel terug naar officeAuth -> toets 5 zakt

   Draai los: node --test test/stadsdoossleutel.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const echt = require('node:crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

const DAG = 86400000;
const BASIS = echt.randomBytes(32);

/* Een crypto die telt hoe vaak er in constante tijd wordt vergeleken. */
function tellendeCrypto() {
  const c = Object.create(echt);
  c.vergelijkingen = 0;
  c.timingSafeEqual = (a, b) => { c.vergelijkingen++; return echt.timingSafeEqual(a, b); };
  return c;
}
function motor(opties) {
  const o = opties || {};
  const klok = { t: o.t || Date.parse('2026-09-27T10:00:00Z') };
  const crypto = tellendeCrypto();
  const s = require('../server/kern/stad/doossleutel')({ crypto, nu: () => klok.t,
    manifestBasis: o.zonderBasis ? () => null : () => BASIS });
  return { s, klok, crypto };
}
const doos = () => ({ serial: 'SD-ABC123', actief: true, sleutelHash: null, at: 1 });

test('1. uitgifte: 128 bit, alleen de hash, uitgever/doel/scope en een verplichte vervaldatum', () => {
  const { s, klok } = motor();
  const n = doos();
  const r = s.geef(n, 'user-1');
  assert.match(r.sleutel, /^[0-9a-f]{32}$/, '16 bytes = 128 bit');
  assert.equal(n.sleutelHash, echt.createHash('sha256').update(r.sleutel).digest('hex'));
  assert.ok(!JSON.stringify(n).includes(r.sleutel), 'de kale sleutel staat nergens op de doos');
  assert.equal(n.sleutelVervalt, klok.t + s.SLEUTEL_MAX_MS);
  assert.ok(s.SLEUTEL_MAX_MS <= 365 * DAG, 'hoogstens een jaar');
  assert.equal(n.sleutelMeta.issuer, 'rtg.stad');
  assert.deepEqual(n.sleutelMeta.scope, ['stad.doos.hartslag', 'stad.doos.meting']);
  assert.equal(new Date(n.sleutelVervalt).toISOString(), r.sleutelVervalt);
  const st = s.stand(n);
  assert.equal(st.legacy, false);
  assert.ok(s.past(n, r.sleutel));
  assert.equal(s.stand(n).gebruik, 1, 'gebruik wordt geteld');
});

test('2. constante tijd: beide hashes worden vergeleken, ook als de eerste raak is', () => {
  const { s, crypto } = motor();
  const n = doos();
  const eerste = s.geef(n, 'user-1');
  const tweede = s.geef(n, 'user-1');   // nu is er een vorige
  crypto.vergelijkingen = 0;
  assert.ok(s.past(n, tweede.sleutel), 'de huidige past');
  assert.equal(crypto.vergelijkingen, 2, 'en ook de vorige is vergeleken, zonder vroege uitgang');
  crypto.vergelijkingen = 0;
  assert.ok(s.past(n, eerste.sleutel), 'de vorige past in de overlap');
  assert.equal(crypto.vergelijkingen, 2);
  crypto.vergelijkingen = 0;
  assert.equal(s.past(n, 'zomaarwat'), null);
  assert.equal(crypto.vergelijkingen, 2, 'een foute gok kost evenveel vergelijkingen als een goede');
});

test('3. verval en overlap: verlopen opent niets, de vorige overlapt kort, legacy geldt tot de legacydatum', () => {
  const { s, klok } = motor();
  const n = doos();
  const eerste = s.geef(n, 'user-1');
  klok.t += 10 * DAG;
  const tweede = s.geef(n, 'user-1');
  assert.ok(s.past(n, eerste.sleutel), 'binnen de overlap werkt de vorige nog');
  klok.t += s.OVERLAP_MS + 1;
  assert.equal(s.past(n, eerste.sleutel), null, 'na de overlap niet meer');
  assert.ok(s.past(n, tweede.sleutel));
  klok.t = n.sleutelVervalt + 1;
  assert.equal(s.past(n, tweede.sleutel), null, 'na de vervaldatum opent ook de huidige niets');

  // de overlap duurt nooit langer dan het verval van de vorige sleutel zelf
  const m = doos();
  const oud = s.geef(m, 'user-1');
  klok.t = m.sleutelVervalt - 1000;
  s.geef(m, 'user-1');
  klok.t += 2000;
  assert.equal(s.past(m, oud.sleutel), null, 'een verlopen vorige sleutel krijgt geen overlap erbij');

  // een doos van voor de regel: geen sleutelVervalt, dus de legacydatum
  const { s: s2, klok: k2 } = motor();
  const l = doos();
  const r = s2.geef(l, 'user-1');
  delete l.sleutelVervalt;
  assert.equal(s2.stand(l).legacy, true);
  k2.t = s2.LEGACY_TOT - DAG;
  assert.ok(s2.past(l, r.sleutel), 'werkende dozen breken niet vandaag');
  k2.t = s2.LEGACY_TOT + 1;
  assert.equal(s2.past(l, r.sleutel), null, 'maar niet na de legacydatum');
});

test('4. het manifest is ondertekend met de afgeleide sleutel en niet met de opgeslagen hash', () => {
  const { s, klok } = motor();
  const n = doos();
  const r = s.geef(n, 'user-1');
  assert.match(r.manifestSleutel, /^[0-9a-f]{64}$/);
  const bericht = '1.2.3|' + 'a'.repeat(64) + '|' + klok.t;
  const p = s.past(n, r.sleutel);
  const handtekening = s.onderteken(n.serial, p.epoch, bericht);
  const metAfgeleide = echt.createHmac('sha256', Buffer.from(r.manifestSleutel, 'hex')).update(bericht).digest('hex');
  const metHash = echt.createHmac('sha256', n.sleutelHash).update(bericht).digest('hex');
  assert.equal(handtekening, metAfgeleide, 'de doos rekent na met de sleutel die hij bij de uitgifte kreeg');
  assert.notEqual(handtekening, metHash, 'wie de database leest, kan hem niet namaken');
  assert.ok(!JSON.stringify(n).includes(r.manifestSleutel), 'de manifestsleutel staat niet op de doos in de opslag');

  // na een rotatie tekent de server voor wie met de VORIGE sleutel komt met de vorige generatie
  klok.t += 1000;
  const r2 = s.geef(n, 'user-1');
  assert.notEqual(r2.manifestSleutel, r.manifestSleutel, 'een nieuwe generatie, een nieuwe manifestsleutel');
  const oudEpoch = s.past(n, r.sleutel).epoch;
  assert.equal(s.onderteken(n.serial, oudEpoch, bericht), metAfgeleide, 'een doos in de overlap kan nog narekenen');

  const { s: zonder } = motor({ zonderBasis: true });
  const m = doos();
  const z = zonder.geef(m, 'user-1');
  assert.equal(z.manifestSleutel, null);
  assert.equal(zonder.onderteken(m.serial, 1, bericht), null, 'zonder servergeheim geen handtekening');
});

test('5. over HTTP: de gedeelde kantoorcode meldt geen doos aan en roteert geen sleutel', async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-doossl-'));
  const CODE = 'KANTOOR-DOOSSL-1';
  const srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, OFFICE_CODE: CODE } });
  const post = (pad, body, tok) => fetch(srv.base + pad, { method: 'POST',
    headers: Object.assign({ 'Content-Type': 'application/json' }, tok ? { Authorization: 'Bearer ' + tok } : {}),
    body: JSON.stringify(body || {}) }).then(async x => ({ status: x.status, koppen: x.headers, body: await x.json().catch(() => ({})) }));
  try {
    const gedeeld = (await post('/api/office/login', { code: CODE })).body.token;
    const eig = (await post('/api/auth/login', { login: 'roellie.i@gmail.com', password: 'Imran', pasApp: 'business' })).body.token;
    assert.ok(gedeeld && eig);
    const aanmeld = { doosNaam: 'Proefdoos', zone: 'Marina', sensoren: ['water'] };
    const g = await post('/api/office/stad/node/aanmeld', aanmeld, gedeeld);
    assert.equal(g.status, 403, 'aanmelden is uitgifte, en dat gebeurt op naam');
    const a = await post('/api/office/stad/node/aanmeld', aanmeld, eig);
    assert.equal(a.status, 200, JSON.stringify(a.body).slice(0, 200));
    assert.match(a.koppen.get('cache-control') || '', /no-store/);
    assert.match(String(a.body.manifestSleutel), /^[0-9a-f]{64}$/, 'de manifestsleutel gaat eenmaal mee');
    assert.ok(Date.parse(a.body.sleutelVervalt) <= Date.now() + 366 * DAG);
    assert.equal((await post('/api/office/stad/sleutel', { serial: a.body.serial }, gedeeld)).status, 403);
    const hartslag = (sleutel) => post('/api/stad/doos/hartslag', { serial: a.body.serial, sleutel });
    assert.equal((await hartslag(a.body.sleutel)).status, 200);
    assert.equal((await hartslag('0'.repeat(32))).status, 401);
    const rot = await post('/api/office/stad/sleutel', { serial: a.body.serial }, eig);
    assert.equal(rot.status, 200);
    assert.notEqual(rot.body.manifestSleutel, a.body.manifestSleutel);
    assert.equal((await hartslag(rot.body.sleutel)).status, 200);
    const pp = (await post('/api/office/stad/paspoort', { serial: a.body.serial }, eig)).body.paspoort;
    assert.equal(pp.sleutel.doel, 'stadsdoos-apparaat');
    assert.ok(pp.sleutel.gebruik >= 1, 'het paspoort toont het gebruik');
  } finally { stop(srv.child); try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {} }
});
