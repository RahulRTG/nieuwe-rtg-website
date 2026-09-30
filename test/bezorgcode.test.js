/* De bezorgcode van een mode-bezorging (mode.bezorgcode,
   server/kern/modebezorg/bezorgcode.js): vier cijfers die het lid VOORLEEST.
   De korte code haalt de 128-bit lat niet, en dat is een besluit; wat hem
   veilig houdt (binding, eenmaligheid, verval, rem met vergrendeling,
   HMAC-only, constant-time, atomaire claim) heeft hier elk een toets die zakt
   als het weg is. Draai los: node --test test/bezorgcode.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const nodeCrypto = require('node:crypto');

function opslag() {
  const kv = {};
  return { kv, bewerk: (sleutel, werk) => {
    const waarde = JSON.parse(kv[sleutel] || '{}');
    const uit = werk(waarde);
    kv[sleutel] = JSON.stringify(waarde);
    return uit;
  } };
}
const maak = (o, extra = {}) => require('../server/kern/modebezorg/bezorgcode')(Object.assign({
  crypto: nodeCrypto, bewerkCollectie: o.bewerk, geheim: 'toets-geheim' }, extra));
const REF = 'MODE1', ZAAK = 'MAISON', HOUDER = 'h1';
const anders = code => String((Number(code) + 1) % 10000).padStart(4, '0');

test('1. vier cijfers, issuer/doel/scope, zeven dagen, eenmalig; op schijf een HMAC met serversleutel', () => {
  const o = opslag(), c = maak(o);
  const uit = c.uitgeven({ ref: REF, supplierCode: ZAAK, houder: HOUDER });
  assert.match(uit.code, /^\d{4}$/);
  assert.equal(uit.toegang.doel, 'mode-overdracht');
  assert.deepEqual(uit.toegang.scope, ['koerier.bezorging.afronden']);
  assert.equal(uit.toegang.issuer, 'rtg.lid.modebezorging');
  assert.equal(uit.toegang.max_gebruik, 1);
  assert.equal(Date.parse(uit.toegang.expires_at) - Date.parse(uit.toegang.issued_at), 7 * 86400000);
  const rij = JSON.parse(o.kv.modeBezorgCode)[REF];
  assert.ok(!('code' in rij.toegang));
  const kaal = nodeCrypto.createHash('sha256').update(uit.code).digest('hex');
  assert.notEqual(rij.toegang.code_hash, kaal, 'geen kale SHA-256 van vier cijfers');
  const zonderSleutel = maak(opslag(), { geheim: 'ander-geheim' });
  assert.notEqual(zonderSleutel.hash(REF, uit.code), rij.toegang.code_hash, 'de hash hangt aan een serversleutel');
  assert.notEqual(c.hash('MODE2', uit.code), rij.toegang.code_hash, 'en aan de bezorging (ref)');
});

test('2. gebonden aan EEN bezorging en EEN winkel', () => {
  const o = opslag(), c = maak(o);
  const a = c.uitgeven({ ref: REF, supplierCode: ZAAK, houder: HOUDER });
  assert.equal(c.claim({ ref: REF, supplierCode: 'ANDERE', code: a.code }).status, 404);
  assert.equal(c.claim({ ref: 'MODE2', supplierCode: ZAAK, code: a.code }).status, 404);
  assert.equal(c.uitgeven({ ref: REF, supplierCode: ZAAK, houder: 'iemand-anders' }).status, 404,
    'een ander lid maakt geen code voor deze bezorging');
});

test('3. eenmalig, en een afgeronde bezorging gaat niet meer retour', () => {
  const o = opslag(), c = maak(o);
  const a = c.uitgeven({ ref: REF, supplierCode: ZAAK, houder: HOUDER });
  assert.equal(c.claim({ ref: REF, supplierCode: ZAAK, code: a.code }).status, 200);
  assert.equal(c.claim({ ref: REF, supplierCode: ZAAK, code: a.code }).status, 409);
  assert.equal(c.sluit({ ref: REF, supplierCode: ZAAK, door: 'k', waarom: 'retour' }).status, 409);
});

test('4. na een retour opent de code niets meer', () => {
  const o = opslag(), c = maak(o);
  const a = c.uitgeven({ ref: REF, supplierCode: ZAAK, houder: HOUDER });
  assert.equal(c.sluit({ ref: REF, supplierCode: ZAAK, door: 'k', waarom: 'retour' }).status, 200);
  assert.equal(c.claim({ ref: REF, supplierCode: ZAAK, code: a.code }).status, 409);
});

test('5. de rem: vijf foute pogingen en de code is vergrendeld, ook voor het juiste getal', () => {
  const o = opslag(), c = maak(o);
  const a = c.uitgeven({ ref: REF, supplierCode: ZAAK, houder: HOUDER });
  for (let i = 1; i <= 5; i++) {
    const f = c.claim({ ref: REF, supplierCode: ZAAK, code: anders(a.code) });
    assert.equal(f.status, 403);
    assert.equal(f.resterend, 5 - i);
  }
  assert.equal(c.claim({ ref: REF, supplierCode: ZAAK, code: a.code }).status, 403, 'vergrendeld');
  const b = c.uitgeven({ ref: REF, supplierCode: ZAAK, houder: HOUDER });
  assert.equal(c.claim({ ref: REF, supplierCode: ZAAK, code: b.code }).status, 200, 'een nieuwe code begint opnieuw');
});

test('6. roteren trekt de vorige in, en er komen er hooguit tien', () => {
  const o = opslag(), c = maak(o);
  const eerste = c.uitgeven({ ref: REF, supplierCode: ZAAK, houder: HOUDER });
  let laatste;
  for (let i = 2; i <= 10; i++) laatste = c.uitgeven({ ref: REF, supplierCode: ZAAK, houder: HOUDER });
  assert.equal(laatste.toegang.rotatie, 10);
  assert.equal(c.uitgeven({ ref: REF, supplierCode: ZAAK, houder: HOUDER }).status, 409, 'het plafond begrenst het raden');
  if (eerste.code !== laatste.code)
    assert.equal(c.claim({ ref: REF, supplierCode: ZAAK, code: eerste.code }).status, 403, 'de oude code telt als fout');
  assert.equal(c.claim({ ref: REF, supplierCode: ZAAK, code: laatste.code }).status, 200);
});

test('7. verlopen na zeven dagen', () => {
  const o = opslag();
  let t = Date.parse('2026-09-27T10:00:00Z');
  const c = maak(o, { nu: () => new Date(t).toISOString() });
  const a = c.uitgeven({ ref: REF, supplierCode: ZAAK, houder: HOUDER });
  t += 7 * 86400000 + 1;
  assert.equal(c.claim({ ref: REF, supplierCode: ZAAK, code: a.code }).status, 403);
});

test('8. vergelijken gebeurt met timingSafeEqual', () => {
  const o = opslag();
  let vergeleken = 0;
  const crypto = Object.assign(Object.create(nodeCrypto), {
    timingSafeEqual: (x, y) => { vergeleken++; return nodeCrypto.timingSafeEqual(x, y); } });
  const c = maak(o, { crypto });
  const a = c.uitgeven({ ref: REF, supplierCode: ZAAK, houder: HOUDER });
  c.claim({ ref: REF, supplierCode: ZAAK, code: anders(a.code) });
  assert.equal(vergeleken, 1);
});

/* MUTATIES (handmatig, op een schone boom; allemaal zakten ze):
   B1 bezorgcode.js: `hash` als kale sha256(code) zonder sleutel en ref  -> toets 1
   B2 bezorgcode.js: controle `r.supplierCode !== supplierCode` in claim weg -> toets 2
   B3 bezorgcode.js: `t.gebruik += 1` weg                             -> toets 3
   B4 bezorgcode.js: in sluit() `r.gesloten = ...` weg                -> toets 4
   B5 bezorgcode.js: `if (t.fout >= MAX_FOUT) trekIn(...)` weg         -> toets 5
   B6 bezorgcode.js: MAX_ROTATIE-controle weg                        -> toets 6
   B7 bezorgcode.js: verlopen-tak uit reden() weg                    -> toets 7
   B8 bezorgcode.js: zelfde() vergelijkt met === in plaats van timingSafeEqual -> toets 8 */
