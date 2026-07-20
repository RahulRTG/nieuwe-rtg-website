/* Test voor onze eigen web-push (server/webpush.js), die het pakket `web-push`
   verving. Twee harde ijkpunten:
   1. RFC 8291 Appendix A: met de testvector-sleutels + salt moet de versleutelde
      aes128gcm-record byte-voor-byte gelijk zijn aan de in de RFC gepubliceerde
      uitkomst. Zo weten we dat de payload-versleuteling exact klopt.
   2. VAPID (RFC 8292): de JWT-handtekening (ES256) is met de publieke sleutel te
      verifieren, en de header draagt k=<publieke sleutel>.
   Plus een round-trip (encrypt -> decrypt) op een realistische subscription. */
const { test } = require('node:test');
const assert = require('node:assert');
const crypto = require('node:crypto');
const wp = require('../server/webpush');

const B = (s) => Buffer.from(s, 'base64url');
const pubVanPriv = (priv) => { const e = crypto.createECDH('prime256v1'); e.setPrivateKey(priv); return e.getPublicKey(); };

test('RFC 8291 Appendix A: aes128gcm-record klopt byte-voor-byte', () => {
  const asPriv = B('yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw');
  const asPub  = B('BP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8');
  const uaPriv = B('q1dXpw3UpT5VOmu_cf_v6ih07Aems3njxI-JWgLcM94');
  const uaPub  = pubVanPriv(uaPriv).toString('base64url'); // afgeleid = gegarandeerd de juiste vector-sleutel
  const auth   = 'BTBZMqHH6r4Tts7J_aSIgg';
  const salt   = B('DGv6ra1nlYgDCS1FRnbzlw');
  const plat   = 'When I grow up, I want to be a watermelon';
  // De in RFC 8291 Appendix A gepubliceerde versleutelde record:
  const verwacht = 'DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A_yl95bQpu6cVPTpK4Mqgkf1CXztLVBSt2Ks3oZwbuwXPXLWyouBWLVWGNWQexSgSxsj_Qulcy4a-fN';

  const rec = wp.encrypt(plat, { keys: { p256dh: uaPub, auth } }, { asPrivate: asPriv, asPublic: asPub, salt });
  assert.strictEqual(rec.toString('base64url'), verwacht, 'de record moet exact de RFC 8291-uitkomst zijn');
  // en hij is met de UA-privesleutel weer te ontsleutelen tot de platte tekst
  assert.strictEqual(wp.decrypt(rec, uaPriv, B(auth)).toString(), plat);
});

test('encrypt -> decrypt round-trip op een realistische subscription', () => {
  // een "browser"-sleutelpaar + auth-geheim, zoals de PushSubscription ze levert
  const ua = crypto.createECDH('prime256v1'); ua.generateKeys();
  const auth = crypto.randomBytes(16);
  const sub = { endpoint: 'https://push.example.com/x', keys: { p256dh: ua.getPublicKey().toString('base64url'), auth: auth.toString('base64url') } };
  const payload = JSON.stringify({ title: 'Hoi', body: 'Een melding met één emoji 🚀' });

  const rec = wp.encrypt(payload, sub);
  assert.notStrictEqual(rec.toString('utf8'), payload, 'de payload hoort versleuteld op de lijn te staan');
  assert.strictEqual(wp.decrypt(rec, ua.getPrivateKey(), auth).toString(), payload);
});

test('VAPID: generateVAPIDKeys geeft P-256-sleutels van de juiste lengte', () => {
  const k = wp.generateVAPIDKeys();
  assert.strictEqual(B(k.publicKey).length, 65, 'publieke sleutel = 65 bytes (ongecomprimeerd)');
  assert.strictEqual(B(k.publicKey)[0], 0x04, 'ongecomprimeerd punt begint met 0x04');
  assert.strictEqual(B(k.privateKey).length, 32, 'privesleutel = 32 bytes');
  const k2 = wp.generateVAPIDKeys();
  assert.notStrictEqual(k.privateKey, k2.privateKey, 'elke aanroep een nieuw paar');
});

test('VAPID: de JWT-handtekening (ES256) verifieert en de header draagt k=<pub>', () => {
  const k = wp.generateVAPIDKeys();
  wp.setVapidDetails('mailto:leden@rahultravelgroup.example', k.publicKey, k.privateKey);
  const h = wp.vapidHeaders('https://fcm.googleapis.com');
  assert.ok(h.Authorization.startsWith('vapid t='), 'Authorization is een vapid-header');
  assert.ok(h.Authorization.includes('k=' + k.publicKey), 'de header draagt de publieke sleutel');

  const jwt = h.Authorization.match(/t=([^,]+),/)[1];
  const [kop, claim, sig] = jwt.split('.');
  const c = JSON.parse(B(claim).toString());
  assert.strictEqual(c.aud, 'https://fcm.googleapis.com', 'aud = de origin van de push-dienst');
  assert.strictEqual(c.sub, 'mailto:leden@rahultravelgroup.example');
  assert.ok(c.exp > Math.floor(Date.now() / 1000), 'exp ligt in de toekomst');

  const pk = B(k.publicKey);
  const pubObj = crypto.createPublicKey({ format: 'jwk', key: { kty: 'EC', crv: 'P-256',
    x: pk.subarray(1, 33).toString('base64url'), y: pk.subarray(33, 65).toString('base64url') } });
  const ok = crypto.verify('sha256', Buffer.from(kop + '.' + claim), { key: pubObj, dsaEncoding: 'ieee-p1363' }, B(sig));
  assert.ok(ok, 'de ES256-handtekening moet met de publieke sleutel verifieren');
});

test('setVapidDetails weigert een onzinnig subject', () => {
  assert.throws(() => wp.setVapidDetails('geen-schema', 'x', 'y'), /mailto:|https:/);
});
