'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { certifieer, serialiseer } = require('../server/lib/immutable-json');
const vries = x => require('../server/kern/bewijsvlak/canon').bevries(x);
function gelijk(v) { assert.equal(serialiseer(v), JSON.stringify(v)); }

test('alleen transitief JSON-onveranderlijke inhoud krijgt een certificaat', () => {
  const kind = { n: 1 }, half = Object.freeze({ kind });
  assert.equal(certifieer(half), false);
  gelijk({ half }); kind.n = 2; gelijk({ half });
  const vast = vries({ tekst: '\ud800\n"\\\u20ac', n: -0, getallen: [1e21, NaN, Infinity] });
  assert.equal(certifieer(vast), true); gelijk({ vast });
  const geladen = JSON.parse(JSON.stringify(vast));
  assert.equal(certifieer(geladen), false);
  geladen.tekst = 'nieuw'; gelijk({ geladen });
});

for (const [naam, maak] of [
  ['undefined', () => ({ a: undefined, b: [undefined] })],
  ['functie', () => ({ a() {}, b: [() => {}] })],
  ['symbol', () => ({ a: Symbol('x'), b: [Symbol('y')] })],
  ['datum', () => ({ at: new Date('2026-11-12T00:00:00.000Z') })],
  ['boxed', () => ({ n: new Number(3), s: new String('x') })],
  ['sparse', () => ({ lijst: [, 2] })],
  ['raw-json', () => ({ n: JSON.rawJSON('42'), b: JSON.rawJSON('true') })],
  ['null-prototype', () => Object.assign(Object.create(null), { a: 1 })]
]) test('native semantiek voor ' + naam, () => gelijk(maak()));

test('accessors en toJSON worden vóór volledige fallback nooit uitgevoerd', () => {
  for (const soort of ['getter', 'toJSON']) {
    let n = 0;
    const v = soort === 'getter'
      ? Object.freeze({ get waarde() { n++; return n; } })
      : Object.freeze({ toJSON(k) { n++; return { k, n }; } });
    assert.equal(certifieer(v), false); assert.equal(n, 0);
    const root = { eerder: { veilig: 1 }, v };
    const uit = serialiseer(root);
    assert.equal(n, 1); n = 0;
    assert.equal(uit, JSON.stringify(root)); assert.equal(n, 1);
  }
});

test('geen enkele foreign proxyval vóór fallback, ook bij ingetrokken proxy', () => {
  let traps = [];
  const p = new Proxy({ n: 1 }, {
    get(t, k, r) { traps.push('get:' + String(k)); return Reflect.get(t, k, r); },
    ownKeys(t) { traps.push('keys'); return Reflect.ownKeys(t); },
    getOwnPropertyDescriptor(t, k) { traps.push('desc:' + String(k)); return Reflect.getOwnPropertyDescriptor(t, k); }
  });
  assert.equal(certifieer(p), false); assert.deepEqual(traps, []);
  const uit = serialiseer({ p }), gezien = traps; traps = [];
  assert.equal(uit, JSON.stringify({ p })); assert.deepEqual(gezien, traps);
  const r = Proxy.revocable({}, {}); r.revoke();
  assert.equal(certifieer(r.proxy), false);
  assert.throws(() => serialiseer({ r: r.proxy }), TypeError);
});

test('array-indices tellen ook niet-enumerable; extra metadata telt niet', () => {
  let gelezen = 0;
  const a = [1, 2];
  Object.defineProperty(a, '1', { value: 3, enumerable: false });
  Object.defineProperty(a, 'extra', { get() { gelezen++; throw Error('geen JSON-inhoud'); } });
  Object.freeze(a);
  assert.equal(certifieer(a), true);
  gelijk({ a }); assert.equal(gelezen, 0);
});

test('prototype-toJSON na certificering dwingt volledige native fallback', () => {
  const v = vries({ a: [1, 2] }); assert.equal(certifieer(v), true);
  for (const proto of [Object.prototype, Array.prototype]) {
    let n = 0;
    try {
      Object.defineProperty(proto, 'toJSON', { configurable: true, value(k) { n++; return k + ':veranderd'; } });
      const uit = serialiseer({ v }); const aantal = n; n = 0;
      assert.equal(uit, JSON.stringify({ v })); assert.equal(n, aantal);
    } finally { delete proto.toJSON; }
  }
  gelijk({ v });
});

test('gewijzigde prototypeketen voert zelf geen Proxy-hasval uit', () => {
  const oud = Object.getPrototypeOf(Array.prototype); let has = 0;
  const tussen = new Proxy(Object.create(oud), { has(t, k) { has++; return Reflect.has(t, k); } });
  try {
    Object.setPrototypeOf(Array.prototype, tussen);
    gelijk({ lijst: [1, 2] }); assert.equal(has, 0);
  } finally { Object.setPrototypeOf(Array.prototype, oud); }
});

test('BigInt-toJSON draait eenmaal, pas op de oorspronkelijke volledige root', () => {
  let n = 0;
  try {
    Object.defineProperty(BigInt.prototype, 'toJSON', { configurable: true, value(k) { n++; return k + ':' + String(this); } });
    const root = { a: { veilig: 1 }, getal: 42n };
    const uit = serialiseer(root); assert.equal(n, 1); n = 0;
    assert.equal(uit, JSON.stringify(root)); assert.equal(n, 1);
  } finally { delete BigInt.prototype.toJSON; }
  assert.throws(() => serialiseer({ n: 42n }), TypeError);
});

test('cycli, diepte en inhoudsbudget behouden native uitkomst of fout', () => {
  const cyclus = {}; cyclus.terug = cyclus;
  assert.equal(certifieer(Object.freeze(cyclus)), false);
  assert.throws(() => serialiseer(cyclus), TypeError);
  let diep = { a: 1 }; for (let i = 0; i < 100; i++) diep = { diep };
  gelijk(diep);
  gelijk({ groot: Array.from({ length: 10000 }, (_, i) => i) });
  const gedeeld = { n: 1 }; gelijk({ a: gedeeld, b: gedeeld });
});

test('boxed primitives behouden hun interne JSON-betekenis na prototypewijziging', () => {
  for (const p of [Object.prototype, null]) {
    const b = Object.setPrototypeOf(new Boolean(false), p);
    gelijk({ b });
    assert.equal(certifieer(Object.freeze(b)), false);
  }
  let n = 0;
  const getal = Object.setPrototypeOf(new Number(7), Object.prototype);
  Object.defineProperty(getal, 'valueOf', { value() { n++; return 7; } });
  Object.freeze(getal);
  assert.equal(certifieer(getal), false);
  assert.equal(n, 0, 'certificering voert geen verborgen coercion uit');
  const uit = serialiseer({ getal }); assert.equal(n, 1); n = 0;
  assert.equal(uit, JSON.stringify({ getal })); assert.equal(n, 1);
  const groot = Object.setPrototypeOf(Object(42n), null);
  assert.throws(() => serialiseer({ groot }), TypeError);
});
