/* De herstelsleutel van de algemene pin als gemigreerde credential
   (CODECREDENTIALS.json, identity.algpin_herstelsleutel;
   kern/algpin-herstel.js). De raceproef over twee PostgreSQL-instances staat
   in test/algpin-herstel.pg.test.js.

   Wat hier moet kunnen zakken:
   1. HERUITGIFTE TREKT IN: een tweede aanvraag maakt de eerste sleutel van
      HETZELFDE lid waardeloos, en laat die van een ander lid staan.
   2. EENMALIG: een sleutel werkt een keer; een verlopen sleutel nooit.
   3. HASH-ONLY met uitgever, doel, scope, uitgifte, verval en max_gebruik 1.
   4. CONSTANTE TIJD: een claim vergelijkt met elke bewaarde hash (geen
      objectsleutel-opzoeking, geen vroege uitgang).
   5. ZONDER COLLECTIETRANSACTIE START HIJ NIET.
   6. Over HTTP: de tweede /api/pin/vergeten maakt de link uit de eerste mail
      dood, en het antwoord gaat geen cache in.

   MUTATIES (LAT.md regel 2), elk gedraaid en gezakt:
   - algpin-herstel.js geef(): `r.key === key ||` weg -> toets 1 en 6 zakken
   - claim(): `delete rijen[treffer]` weg -> toets 2 zakt
   - claim(): `r.tot > t ?` weg -> toets 2 zakt
   - claim(): de lus vervangen door `rijen[h]` (objectsleutel) -> toets 4 zakt
   - de guard op bewerkCollectie weg -> toets 5 zakt

   Draai los: node --test test/algpin-herstel.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const echt = require('node:crypto');
const { maakAlgPin } = require('../server/kern/algpin');
const { startServer, stop } = require('./helper');

const SLOT = { dicht: () => false, fout: () => {}, goed: () => {} };
function maak(crypto) {
  const db = { data: {}, writable: true };
  const bewerkCollectie = require('../server/db/collectie-bewerken')({ store: 'json', db, save() {} });
  const k = maakAlgPin({ db, save: () => {}, crypto: crypto || echt, slot: SLOT, bewerkCollectie });
  return { db, k };
}

test('1. een nieuwe aanvraag trekt de vorige sleutel van hetzelfde lid in, en die van een ander niet', async () => {
  const { k } = maak();
  const a1 = await k.pinHerstelStart('lid-a');
  const b1 = await k.pinHerstelStart('lid-b');
  const a2 = await k.pinHerstelStart('lid-a');
  assert.equal((await k.pinHerstelZet(a1.sleutel, '4321')).status, 400, 'de eerste link van lid-a is dood');
  assert.equal((await k.pinHerstelZet(a2.sleutel, '4321')).ok, true, 'de nieuwste werkt');
  assert.equal((await k.pinHerstelZet(b1.sleutel, '8765')).ok, true, 'de sleutel van lid-b bleef staan');
});

test('2. eenmalig: een sleutel werkt een keer, en een verlopen sleutel nooit', async () => {
  const { db, k } = maak();
  const r = await k.pinHerstelStart('lid-a');
  assert.equal((await k.pinHerstelZet(r.sleutel, '4321')).ok, true);
  assert.equal((await k.pinHerstelZet(r.sleutel, '4321')).status, 400, 'een tweede keer niet');
  const v = await k.pinHerstelStart('lid-a');
  for (const rij of Object.values(db.data.algPinHerstel)) rij.tot = Date.now() - 1;
  assert.equal((await k.pinHerstelZet(v.sleutel, '4321')).status, 400, 'verlopen is verlopen');
  assert.deepEqual(Object.keys(db.data.algPinHerstel), [], 'en een verlopen treffer is opgeruimd');
});

test('3. alleen de hash staat in de opslag, met uitgever, doel, scope, uitgifte, verval en max_gebruik 1', async () => {
  const { db, k } = maak();
  const t0 = Date.now();
  const r = await k.pinHerstelStart('lid-a');
  assert.match(r.sleutel, /^[0-9a-f]{48}$/, '24 bytes = 192 bit');
  const rijen = db.data.algPinHerstel;
  assert.ok(!JSON.stringify(rijen).includes(r.sleutel), 'de kale sleutel staat nergens');
  const [h, rij] = Object.entries(rijen)[0];
  assert.equal(h, echt.createHash('sha256').update(r.sleutel).digest('hex'));
  assert.equal(rij.key, 'lid-a');
  assert.equal(rij.issuer, 'rtg.lid.algpin');
  assert.equal(rij.doel, 'algpin-herstel');
  assert.equal(rij.scope, 'algpin.zet');
  assert.equal(rij.max_gebruik, 1);
  assert.ok(rij.issued_at >= t0 && rij.tot - rij.issued_at === 3600000, 'een uur geldig');
});

test('4. een claim vergelijkt in constante tijd met elke bewaarde hash', async () => {
  const crypto = Object.create(echt);
  let n = 0;
  crypto.timingSafeEqual = (a, b) => { n++; return echt.timingSafeEqual(a, b); };
  const { k } = maak(crypto);
  await k.pinHerstelStart('lid-a');
  await k.pinHerstelStart('lid-b');
  const c = await k.pinHerstelStart('lid-c');
  n = 0;
  assert.equal((await k.pinHerstelZet('0'.repeat(48), '4321')).status, 400);
  assert.equal(n, 3, 'een onbekende sleutel is met alle drie vergeleken');
  n = 0;
  assert.equal((await k.pinHerstelZet(c.sleutel, '4321')).ok, true);
  assert.equal(n, 3, 'een treffer ook: geen vroege uitgang');
});

test('5. zonder collectietransactie start de pinlaag niet', () => {
  assert.throws(() => maakAlgPin({ db: { data: {} }, save: () => {}, crypto: echt, slot: SLOT }),
    /niet atomair/);
});

test('6. over HTTP: gratis account herstelt alleen zijn eigen pin; heruitgifte trekt in en antwoorden worden niet gecachet', async () => {
  const srv = await startServer({ env: { SMTP_URL: '' } });
  const p = (pad, body, tok) => fetch(srv.base + pad, { method: 'POST',
    headers: Object.assign({ 'Content-Type': 'application/json' }, tok ? { Authorization: 'Bearer ' + tok } : {}),
    body: JSON.stringify(body || {}) }).then(async x => ({ status: x.status, koppen: x.headers, body: await x.json().catch(() => ({})) }));
  try {
    const reg = await p('/api/auth/register', { name: 'Herstel Lid', email: 'herstelsleutel@x.nl', phone: '0612345791',
      password: 'geheim123', geboortedatum: '1990-01-01', pasApp: 'rtg' });
    assert.equal(reg.status, 200, JSON.stringify(reg.body));
    assert.equal(reg.body.state.user.account, true);
    assert.equal(reg.body.state.user.tier, 'guest', 'pinbeveiliging vraagt een echt account, geen betaalde pas');
    const tok = reg.body.token;
    assert.ok(tok);
    const ander = await p('/api/auth/register', { name: 'Ander Herstel Lid', email: 'ander-herstel@x.nl', phone: '0612345792',
      password: 'geheim123', geboortedatum: '1990-01-01', pasApp: 'rtg' });
    assert.equal(ander.status, 200, JSON.stringify(ander.body));
    assert.equal(ander.body.state.user.account, true);
    assert.equal(ander.body.state.user.tier, 'guest');
    assert.ok(ander.body.token);
    const anderDoel = { account: ander.body.state.user, accountId: ander.body.state.user.id,
      key: 'user-' + ander.body.state.user.id, email: ander.body.state.user.email };

    const beschermd = [
      ['/api/pin/status', {}], ['/api/pin/zet', { pin: '4321' }],
      ['/api/pin/check', { pin: '4321' }], ['/api/pin/vergeten', {}]
    ];
    for (const [pad, body] of beschermd)
      assert.equal((await p(pad, { ...anderDoel, ...body })).status, 401, pad + ': een account in de body is geen sessie');
    for (const tier of ['guest', 'rtg']) {
      const demo = await p('/api/login', { tier, pasApp: 'rtg' });
      assert.equal(demo.status, 200, JSON.stringify(demo.body));
      assert.ok(demo.body.token);
      assert.notEqual(demo.body.state.user.account, true, 'de negatieve persona heeft geen echt account');
      for (const [pad, body] of beschermd)
        assert.equal((await p(pad, { ...anderDoel, ...body }, demo.body.token)).status, 403,
          pad + ': ook een demo-pas vervangt geen eigen account');
    }

    assert.equal((await p('/api/pin/zet', { pin: '8765' }, ander.body.token)).status, 200);
    const leeg = await p('/api/pin/status', anderDoel, tok);
    assert.equal(leeg.status, 200);
    assert.equal(leeg.body.gezet, false, 'de status leest de sessie, niet het meegestuurde andere account');
    const zonderPin = await p('/api/pin/check', { ...anderDoel, pin: '8765' }, tok);
    assert.equal(zonderPin.status, 200);
    assert.equal(zonderPin.body.gezet, false);
    assert.equal((await p('/api/pin/zet', { ...anderDoel, pin: '4321' }, tok)).status, 200);
    const gezet = await p('/api/pin/status', {}, tok);
    assert.equal(gezet.status, 200);
    assert.equal(gezet.body.gezet, true);
    assert.equal((await p('/api/pin/check', { ...anderDoel, pin: '8765' }, tok)).status, 401,
      'de pincode van een ander bewijst niets voor deze sessie');
    assert.equal((await p('/api/pin/zet', { ...anderDoel, pin: '1111', oud: '8765' }, tok)).status, 401,
      'de oude pin van een ander mag de eigen pin niet wijzigen');
    assert.equal((await p('/api/pin/check', { pin: '4321' }, tok)).status, 200);
    assert.equal((await p('/api/pin/check', { pin: '8765' }, ander.body.token)).status, 200,
      'instellen met een ander doel in de body raakt het andere account niet');

    const v1 = await p('/api/pin/vergeten', anderDoel, tok);
    assert.equal(v1.status, 200);
    assert.equal(v1.body.verstuurd, true);
    assert.equal(v1.body.email, undefined, 'het herstelantwoord onthult geen hersteladres');
    assert.match(v1.koppen.get('cache-control') || '', /no-store/);
    const v2 = await p('/api/pin/vergeten', {}, tok);
    assert.equal(v2.status, 200);
    assert.match(v2.koppen.get('cache-control') || '', /no-store/);
    const s1 = String(v1.body.devPinUrl).split('pinherstel=')[1], s2 = String(v2.body.devPinUrl).split('pinherstel=')[1];
    assert.ok(s1 && s2 && s1 !== s2);
    assert.equal((await p('/api/pin/herstel', { sleutel: s1, pin: '1111' })).status, 400, 'de link uit de eerste mail is dood');
    assert.equal((await p('/api/pin/herstel', { ...anderDoel, sleutel: s2, pin: '2222' })).status, 200,
      'de herstelsleutel bepaalt het account, niet de body en niet een betaalde pas');
    assert.equal((await p('/api/pin/herstel', { sleutel: s2, pin: '3333' })).status, 400, 'en de nieuwe werkt een keer');
    assert.equal((await p('/api/pin/check', { pin: '2222' }, tok)).status, 200);
    assert.equal((await p('/api/pin/check', { pin: '8765' }, ander.body.token)).status, 200,
      'herstel van de eigen pin laat de pin van het andere account intact');
  } finally { await stop(srv.child); }
});
