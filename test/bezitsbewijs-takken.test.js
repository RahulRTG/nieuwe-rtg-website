/* HET BEZITSBEWIJS TAK VOOR TAK (server/kern/identiteit/bezitsbewijs.js).

   Aanvulling op test/bezitsbewijs.test.js. Wat dit bestand vasthoudt: een
   licht pad is nvt; zonder meegegeven stand telt RTG_BEZITSBEWIJS; een
   onleesbaar register en een storing in de verifier sluiten (fail closed), en
   alleen de schaduwstand laat door met wat er zou zijn gebeurd; in `verplicht`
   krijgt een gast een andere weg dan een lid; elke onleesbare vorm van het
   bewijs (geen punt, geen JSON, geen object, geen tijd, slechte jti) is een
   401; een ingetrokken toestel een 403; en verlopen herhaalmerken worden
   opgeruimd. De echte sleutelparen komen uit webcrypto. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { webcrypto } = require('node:crypto');
const { maakBezitsbewijs, zwaarPad, SPELING_MS } = require('../server/kern/identiteit/bezitsbewijs');

const TOESTEL = 'c'.repeat(32);
const PAD = '/api/pay/tik';

async function opzet({ toestellen } = {}) {
  const kp = await webcrypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign', 'verify']);
  const jwk = await webcrypto.subtle.exportKey('jwk', kp.publicKey);
  const pub = { kty: jwk.kty, crv: jwk.crv, x: jwk.x, y: jwk.y };
  const db = { data: {} };
  let saves = 0;
  const t = toestellen || { publiekeSleutelVan: (lid, id) => (lid === 'user-1' && id === TOESTEL ? pub : null) };
  const b = maakBezitsbewijs({ db, save() { saves++; }, toestellen: t });
  const kopVan = (lading) => Buffer.from(JSON.stringify(lading)).toString('base64url');
  const teken = async (lading) => {
    const kop = kopVan(lading);
    const sig = await webcrypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, kp.privateKey, Buffer.from(kop, 'utf8'));
    return kop + '.' + Buffer.from(sig).toString('base64url');
  };
  return { b, db, teken, kopVan, saves: () => saves };
}
let teller = 0;
const jti = () => 'jti' + String(++teller).padStart(17, '0');
const gebonden = { key: 'user-1', account: 'acc', sessieContext: { sleutelbinding: { keyRef: TOESTEL } } };
const lading = (extra = {}) => Object.assign({ jti: jti(), tijd: Date.now(), methode: 'POST', pad: PAD }, extra);

function metStand(waarde, fn) {
  const oud = process.env.RTG_BEZITSBEWIJS, oudEnv = process.env.NODE_ENV;
  if (waarde == null) delete process.env.RTG_BEZITSBEWIJS; else process.env.RTG_BEZITSBEWIJS = waarde;
  return Promise.resolve().then(fn).finally(() => {
    if (oud === undefined) delete process.env.RTG_BEZITSBEWIJS; else process.env.RTG_BEZITSBEWIJS = oud;
    if (oudEnv === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = oudEnv;
  });
}

test('zwaarPad: een licht of ontbrekend pad is geen zwaar pad', async () => {
  assert.equal(zwaarPad(null), null);
  assert.equal(zwaarPad('/api/menukaart'), null);
  assert.ok(zwaarPad(PAD));
  const { b } = await opzet();
  assert.deepEqual(await b.controleer({ sess: gebonden, methode: 'GET', pad: '/api/menukaart' }), { stand: 'nvt' });
});

test('zonder meegegeven stand telt de omgeving: leeg is verplicht, schaduw laat door', async () => {
  const { b } = await opzet();
  const los = { key: 'user-1', account: 'acc', tier: 'rtg', sessieContext: {} };
  await metStand(null, async () => {
    const uit = await b.controleer({ sess: los, methode: 'POST', pad: PAD });
    assert.equal(uit.stand, 'geweigerd');
    assert.equal(uit.code, 403);
    assert.match(uit.reden, /Waar ben ik aanwezig/);
  });
  await metStand('schaduw', async () => {
    delete process.env.NODE_ENV;
    const uit = await b.controleer({ sess: gebonden, methode: 'POST', pad: PAD, kop: null });
    assert.equal(uit.stand, 'schaduw');
    assert.equal(uit.zouZijn, 'geweigerd');
    assert.ok(uit.waarom);
  });
  await metStand('aanbevolen', async () => {
    const uit = await b.controleer({ sess: los, methode: 'POST', pad: PAD });
    assert.equal(uit.stand, 'onbeschermd');
    assert.match(uit.nietAfgedwongen, /sleutelbinding/);
  });
});

test('verplicht zonder binding: een gast of een sessie zonder account krijgt de accountweg', async () => {
  const { b } = await opzet();
  for (const sess of [null, { key: 'g', tier: 'guest', account: 'x' }, { key: 'p', tier: 'rtg' }]) {
    const uit = await b.controleer({ sess, methode: 'POST', pad: PAD, stand: 'verplicht' });
    assert.equal(uit.stand, 'geweigerd');
    assert.equal(uit.code, 403);
    assert.match(uit.reden, /eigen RTG-account/);
  }
});

test('een onleesbaar register sluit, ook in aanbevolen; in de schaduw niet', async () => {
  const { b } = await opzet();
  const storing = { key: 'user-1', sessieContextStoring: true };
  const uit = await b.controleer({ sess: storing, methode: 'POST', pad: PAD, stand: 'aanbevolen' });
  assert.deepEqual([uit.stand, uit.code, uit.storing], ['geweigerd', 503, true]);
  const schaduw = await b.controleer({ sess: storing, methode: 'POST', pad: PAD, stand: 'schaduw' });
  assert.equal(schaduw.stand, 'schaduw');
  assert.match(schaduw.reden, /niet worden gelezen/);
});

test('een storing in de verifier is geen doorgang (503), behalve in de schaduw', async () => {
  const { b, teken } = await opzet({ toestellen: { publiekeSleutelVan() { throw new Error('register plat'); } } });
  const kop = await teken(lading());
  const uit = await b.controleer({ sess: gebonden, methode: 'POST', pad: PAD, kop, stand: 'verplicht' });
  assert.deepEqual([uit.stand, uit.code, uit.storing], ['geweigerd', 503, true]);
  assert.match(uit.reden, /niet worden gecontroleerd/);
  const schaduw = await b.controleer({ sess: gebonden, methode: 'POST', pad: PAD, kop: await teken(lading()), stand: 'schaduw' });
  assert.equal(schaduw.stand, 'schaduw');
  assert.equal(schaduw.zouZijn, 'geweigerd');
});

test('onleesbare bewijzen: geen twee delen, geen JSON, geen object', async () => {
  const { b, kopVan } = await opzet();
  const vraag = (kop) => b.controleer({ sess: gebonden, methode: 'POST', pad: PAD, kop, stand: 'aanbevolen' });
  for (const kop of ['zonderpunt', 'a.b.c', Buffer.from('{kapot').toString('base64url') + '.x',
    kopVan(null) + '.x', kopVan(7) + '.x']) {
    const uit = await vraag(kop);
    assert.equal(uit.stand, 'geweigerd', kop);
    assert.equal(uit.code, 401);
    assert.equal(uit.reden, 'Onleesbaar bezitsbewijs.');
  }
});

test('methode en pad: ontbrekend telt als leeg; de vergelijking negeert hoofdletters van de methode', async () => {
  const { b, kopVan, teken } = await opzet();
  const zonder = await b.controleer({ sess: gebonden, methode: 'POST', pad: PAD, kop: kopVan({ pad: PAD }) + '.x', stand: 'aanbevolen' });
  assert.match(zonder.reden, /andere handeling/);
  const geenPad = await b.controleer({ sess: gebonden, methode: 'POST', pad: PAD, kop: kopVan({ methode: 'post' }) + '.x', stand: 'aanbevolen' });
  assert.match(geenPad.reden, /ander adres/);
  const klein = await b.controleer({ sess: gebonden, methode: 'post', pad: PAD, kop: await teken(lading({ methode: 'Post' })), stand: 'aanbevolen' });
  assert.equal(klein.stand, 'bewezen');
});

test('tijd: ontbrekend, onleesbaar of buiten de speling wordt geweigerd', async () => {
  const { b, kopVan } = await opzet();
  for (const tijd of [undefined, 'gisteren', Date.now() - SPELING_MS - 5000, Date.now() + SPELING_MS + 5000]) {
    const kop = kopVan({ methode: 'POST', pad: PAD, tijd, jti: jti() }) + '.x';
    const uit = await b.controleer({ sess: gebonden, methode: 'POST', pad: PAD, kop, stand: 'aanbevolen' });
    assert.match(uit.reden, /te oud of ligt in de toekomst/, String(tijd));
  }
});

test('jti: geen tekst, te kort of met vreemde tekens is onleesbaar', async () => {
  const { b, kopVan } = await opzet();
  for (const j of [12345678901234567, 'kort', 'x'.repeat(65), 'met spatie in de jti!!']) {
    const kop = kopVan({ methode: 'POST', pad: PAD, tijd: Date.now(), jti: j }) + '.x';
    const uit = await b.controleer({ sess: gebonden, methode: 'POST', pad: PAD, kop, stand: 'aanbevolen' });
    assert.equal(uit.reden, 'Onleesbaar bezitsbewijs.', String(j));
  }
});

test('een onbekend of ingetrokken toestel geeft 403, ook zonder toestellenregister', async () => {
  const { b, teken } = await opzet();
  const ander = { key: 'user-2', sessieContext: { sleutelbinding: { keyRef: TOESTEL } } };
  const uit = await b.controleer({ sess: ander, methode: 'POST', pad: PAD, kop: await teken(lading()), stand: 'aanbevolen' });
  assert.deepEqual([uit.stand, uit.code], ['geweigerd', 403]);
  assert.match(uit.reden, /niet meer bekend/);
  const kaal = await opzet({ toestellen: {} });
  const zonder = await kaal.b.controleer({ sess: gebonden, methode: 'POST', pad: PAD, kop: await kaal.teken(lading()), stand: 'aanbevolen' });
  assert.equal(zonder.code, 403);
});

test('herhaling: een bewijs werkt een keer; verlopen merken worden opgeruimd', async () => {
  const { b, db, teken, saves } = await opzet();
  db.data.bezitsbewijzen = { oudmerkoudmerk0001: Date.now() - 1000, levendmerk00000001: Date.now() + 60000 };
  const kop = await teken(lading());
  const eerst = await b.controleer({ sess: gebonden, methode: 'POST', pad: PAD, kop, stand: 'verplicht' });
  assert.equal(eerst.stand, 'bewezen');
  assert.equal(saves(), 1);
  assert.equal('oudmerkoudmerk0001' in db.data.bezitsbewijzen, false, 'een verlopen merk is weg');
  assert.ok('levendmerk00000001' in db.data.bezitsbewijzen);
  const weer = await b.controleer({ sess: gebonden, methode: 'POST', pad: PAD, kop, stand: 'verplicht' });
  assert.equal(weer.stand, 'geweigerd');
  assert.match(weer.reden, /al gebruikt/);
  assert.equal(saves(), 1, 'een herhaling schrijft niets');
});

test('de meter telt per pad en per stand', async () => {
  const { b, teken } = await opzet();
  await b.controleer({ sess: gebonden, methode: 'POST', pad: PAD, kop: await teken(lading()), stand: 'aanbevolen' });
  await b.controleer({ sess: gebonden, methode: 'POST', pad: PAD, kop: null, stand: 'schaduw' });
  const s = b.stand();
  assert.ok(s && typeof s === 'object');
  assert.match(JSON.stringify(s), /bewezen/);
  assert.match(JSON.stringify(s), /schaduw/);
});
