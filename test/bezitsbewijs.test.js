/* ============================================================================
   MIJN RTG blok 4 -- het bezitsbewijs.

   DE BEWERING DIE ERTOE DOET staat in toets 1: een sessietoken is een
   DRAGERSBEWIJS. Wie hem onderschept -- uit een logregel, van een gedeelde
   computer -- is die persoon tot het verloopt. Alle herkomst uit blok 1 tot 3
   beschrijft hoe de sessie ONTSTOND en houdt zo iemand daarna niet tegen.

   Dit is niet DPoP (RFC 9449): er is geen access token met een cnf-claim en
   geen OAuth eromheen. Het idee en de vorm zijn ervan geleend, en dat hoort er
   te staan in plaats van dat het "onze eigen beveiliging" heet.

   Draai los: node --test test/bezitsbewijs.test.js
   ========================================================================== */
const test = require('node:test');
const assert = require('node:assert/strict');
const { webcrypto } = require('crypto');
const { maakBezitsbewijs, zwaarPad, PADEN } = require('../server/kern/identiteit/bezitsbewijs');

const TOESTEL = 'a'.repeat(32);

async function opzet() {
  const kp = await webcrypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign', 'verify']);
  const jwk = await webcrypto.subtle.exportKey('jwk', kp.publicKey);
  const pub = { kty: jwk.kty, crv: jwk.crv, x: jwk.x, y: jwk.y };
  const toestellen = { publiekeSleutelVan: (lid, id) => (lid === 'user-1' && id === TOESTEL ? pub : null) };
  const b = maakBezitsbewijs({ db: { data: {} }, save() {}, toestellen });
  const teken = async (lading) => {
    const kop = Buffer.from(JSON.stringify(lading)).toString('base64url');
    const sig = await webcrypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, kp.privateKey, Buffer.from(kop, 'utf8'));
    return kop + '.' + Buffer.from(sig).toString('base64url');
  };
  return { b, teken, toestellen };
}
const jti = () => 'j' + Math.random().toString(36).slice(2).padEnd(20, 'x').slice(0, 20);
const gebonden = { key: 'user-1', sessieContext: { sleutelbinding: { keyRef: TOESTEL, schema: 'rtg-bezitsbewijs-v1' } } };
const los = { key: 'user-1', sessieContext: {} };

/* ---------------------------------------------------------------------------
   1. DE KERN: een gestolen token alleen is niet genoeg.
   ------------------------------------------------------------------------- */
test('1. een gebonden sessie zonder bewijs komt er niet door', async () => {
  const { b } = await opzet();
  const uit = await b.controleer({ sess: gebonden, methode: 'POST', pad: '/api/pay/tik', kop: null, stand: 'aanbevolen' });
  assert.equal(uit.stand, 'geweigerd');
  assert.equal(uit.code, 401);
});

test('1b. met een geldig bewijs wel', async () => {
  const { b, teken } = await opzet();
  const kop = await teken({ jti: jti(), tijd: Date.now(), methode: 'POST', pad: '/api/pay/tik' });
  const uit = await b.controleer({ sess: gebonden, methode: 'POST', pad: '/api/pay/tik', kop, stand: 'aanbevolen' });
  assert.equal(uit.stand, 'bewezen', uit.reden || '');
});

test('1c. en een bewijs van een ANDER toestel niet', async () => {
  const { b } = await opzet();
  const andere = await opzet();               // eigen sleutelpaar
  const kop = await andere.teken({ jti: jti(), tijd: Date.now(), methode: 'POST', pad: '/api/pay/tik' });
  const uit = await b.controleer({ sess: gebonden, methode: 'POST', pad: '/api/pay/tik', kop, stand: 'aanbevolen' });
  assert.equal(uit.stand, 'geweigerd');
});

/* ---------------------------------------------------------------------------
   2. DE HANDELING ZIT IN DE HANDTEKENING.
   ------------------------------------------------------------------------- */
test('2. een bewijs voor een ander pad dekt deze handeling niet', async () => {
  const { b, teken } = await opzet();
  const kop = await teken({ jti: jti(), tijd: Date.now(), methode: 'POST', pad: '/api/pay/saldo' });
  const uit = await b.controleer({ sess: gebonden, methode: 'POST', pad: '/api/pay/tik', kop, stand: 'aanbevolen' });
  assert.equal(uit.stand, 'geweigerd');
  assert.match(uit.reden, /ander adres/);
});

test('2b. en een bewijs voor een andere methode ook niet', async () => {
  const { b, teken } = await opzet();
  const kop = await teken({ jti: jti(), tijd: Date.now(), methode: 'GET', pad: '/api/pay/tik' });
  const uit = await b.controleer({ sess: gebonden, methode: 'POST', pad: '/api/pay/tik', kop, stand: 'aanbevolen' });
  assert.equal(uit.stand, 'geweigerd');
  assert.match(uit.reden, /andere handeling/);
});

/* ---------------------------------------------------------------------------
   3. HERHALING. Een onderschept bewijs mag hooguit een keer werken.
   ------------------------------------------------------------------------- */
test('3. hetzelfde bewijs werkt geen tweede keer', async () => {
  const { b, teken } = await opzet();
  const kop = await teken({ jti: jti(), tijd: Date.now(), methode: 'POST', pad: '/api/pay/tik' });
  assert.equal((await b.controleer({ sess: gebonden, methode: 'POST', pad: '/api/pay/tik', kop, stand: 'aanbevolen' })).stand, 'bewezen');
  const twee = await b.controleer({ sess: gebonden, methode: 'POST', pad: '/api/pay/tik', kop, stand: 'aanbevolen' });
  assert.equal(twee.stand, 'geweigerd');
  assert.match(twee.reden, /al gebruikt/);
});

test('3b. een oud bewijs is te oud', async () => {
  const { b, teken } = await opzet();
  const kop = await teken({ jti: jti(), tijd: Date.now() - 10 * 60 * 1000, methode: 'POST', pad: '/api/pay/tik' });
  const uit = await b.controleer({ sess: gebonden, methode: 'POST', pad: '/api/pay/tik', kop, stand: 'aanbevolen' });
  assert.equal(uit.stand, 'geweigerd');
  assert.match(uit.reden, /te oud|toekomst/);
});

/* ---------------------------------------------------------------------------
   4. DE ZWAARTE IS EEN LIJST MET REDENEN, en geldt niet overal.
   ------------------------------------------------------------------------- */
test('4. een gewoon pad vraagt geen bewijs', async () => {
  const { b } = await opzet();
  const uit = await b.controleer({ sess: gebonden, methode: 'POST', pad: '/api/member/boardroom', kop: null, stand: 'aanbevolen' });
  assert.equal(uit.stand, 'nvt', 'anders betaalt elke menukaart de prijs van een overboeking');
});

test('4b. elk zwaar pad draagt een reden', () => {
  assert.ok(PADEN.length >= 8);
  for (const p of PADEN) {
    assert.ok(p.reden && p.reden.length > 5, p.pad + ' staat er zonder reden bij; dan groeit de lijst tot hij overal staat');
    assert.match(p.pad, /^\/api\//);
  }
  assert.ok(zwaarPad('/api/pay/tik'));
  assert.equal(zwaarPad('/api/gids/app'), null);
});

/* ---------------------------------------------------------------------------
   5. DE STANDEN. Schaduw weigert nooit -- dat is de hele reden dat hij bestaat.
   ------------------------------------------------------------------------- */
test('5. schaduw weigert nooit, maar rekent het wel uit', async () => {
  const { b } = await opzet();
  const uit = await b.controleer({ sess: gebonden, methode: 'POST', pad: '/api/pay/tik', kop: null, stand: 'schaduw' });
  assert.equal(uit.stand, 'schaduw');
  assert.equal(uit.zouZijn, 'geweigerd',
    'zonder deze uitkomst meet je niets en blijft de stand voor altijd op schaduw staan');
});

test('5b. een ONGEBONDEN sessie komt er in "aanbevolen" langs, en dat wordt gezegd', async () => {
  const { b } = await opzet();
  const uit = await b.controleer({ sess: los, methode: 'POST', pad: '/api/pay/tik', kop: null, stand: 'aanbevolen' });
  assert.equal(uit.stand, 'onbeschermd');
  assert.ok(uit.nietAfgedwongen, 'een gat dat alleen in commentaar staat, is een gat dat niemand kent');
});

test('5c. in "verplicht" komt een ongebonden sessie er niet langs', async () => {
  const { b } = await opzet();
  const uit = await b.controleer({ sess: los, methode: 'POST', pad: '/api/pay/tik', kop: null, stand: 'verplicht' });
  assert.equal(uit.stand, 'geweigerd');
  assert.equal(uit.code, 403);
});

test('5d. een onbekende stand valt terug op schaduw en zegt dat', () => {
  const oud = process.env.RTG_BEZITSBEWIJS;
  try {
    const { maakBezitsbewijs } = require('../server/kern/identiteit/bezitsbewijs');
    const b = maakBezitsbewijs({ db: { data: {} }, save() {}, toestellen: null });
    process.env.RTG_BEZITSBEWIJS = 'verplicth';        // typefout
    const s = b.standNu();
    assert.equal(s.stand, 'schaduw', 'een typefout hoort geen beveiliging aan of uit te zetten');
    assert.match(s.reden, /onbekende waarde/);
    delete process.env.RTG_BEZITSBEWIJS;
    assert.equal(b.standNu().stand, 'schaduw');
  } finally { if (oud === undefined) delete process.env.RTG_BEZITSBEWIJS; else process.env.RTG_BEZITSBEWIJS = oud; }
});

/* ---------------------------------------------------------------------------
   6. EEN INGETROKKEN TOESTEL kan niet meer tekenen.
   ------------------------------------------------------------------------- */
test('6. is het toestel ingetrokken, dan telt zijn bewijs niet meer', async () => {
  const kp = await webcrypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign', 'verify']);
  const jwk = await webcrypto.subtle.exportKey('jwk', kp.publicKey);
  let bekend = true;
  const b = maakBezitsbewijs({ db: { data: {} }, save() {},
    toestellen: { publiekeSleutelVan: () => (bekend ? { kty: jwk.kty, crv: jwk.crv, x: jwk.x, y: jwk.y } : null) } });
  const maak = async () => {
    const kop = Buffer.from(JSON.stringify({ jti: jti(), tijd: Date.now(), methode: 'POST', pad: '/api/pay/tik' })).toString('base64url');
    const sig = await webcrypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, kp.privateKey, Buffer.from(kop, 'utf8'));
    return kop + '.' + Buffer.from(sig).toString('base64url');
  };
  assert.equal((await b.controleer({ sess: gebonden, methode: 'POST', pad: '/api/pay/tik', kop: await maak(), stand: 'aanbevolen' })).stand, 'bewezen');
  bekend = false;
  const uit = await b.controleer({ sess: gebonden, methode: 'POST', pad: '/api/pay/tik', kop: await maak(), stand: 'aanbevolen' });
  assert.equal(uit.stand, 'geweigerd');
  assert.equal(uit.code, 403);
});
