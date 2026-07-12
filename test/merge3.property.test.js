/* Eigenschap-gedreven (property-based) tests voor merge3, de 3-weg-samenvoeging
   die het hart is van de multi-writer-opslag. In plaats van een handvol vaste
   gevallen genereren we duizenden willekeurige situaties en controleren we
   invarianten die ALTIJD moeten gelden. Een deterministische RNG (seed) maakt
   elke fout reproduceerbaar.
   Draai: node --test test/merge3.property.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const { merge3 } = require('../server/db');

// ---- deterministische RNG (mulberry32), zodat een fout herhaalbaar is ----
function rng(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const clone = (x) => (x === undefined ? undefined : JSON.parse(JSON.stringify(x)));

/* Canoniseer voor vergelijking: gekeyde arrays zijn SETs (merge3 bouwt ze op uit
   een id-map, dus de volgorde is niet betekenisvol), en objectsleutels sorteren
   we. Zo vergelijken we op inhoud, niet op toevallige volgorde. */
function canon(x) {
  if (Array.isArray(x)) {
    const gekeyd = x.length && x.every(it => it && typeof it === 'object' && it.id != null);
    const items = x.map(canon);
    if (gekeyd) items.sort((a, b) => JSON.stringify(a.id).localeCompare(JSON.stringify(b.id)));
    return items;
  }
  if (x && typeof x === 'object') {
    const o = {};
    for (const k of Object.keys(x).sort()) o[k] = canon(x[k]);
    return o;
  }
  return x;
}
const eq = (a, b) => JSON.stringify(canon(a)) === JSON.stringify(canon(b));

// ---- generatoren ----
function randScalar(r) {
  const k = Math.floor(r() * 4);
  return [0, 'a' + Math.floor(r() * 5), r() < 0.5, Math.floor(r() * 100)][k];
}
function randValue(r, diepte) {
  if (diepte <= 0 || r() < 0.4) return randScalar(r);
  if (r() < 0.5) {
    // gekeyd array (items met id) -- het geval waar de merge per item werkt
    const n = Math.floor(r() * 4);
    const arr = [];
    for (let i = 0; i < n; i++) arr.push({ id: Math.floor(r() * 6), v: randScalar(r) });
    // ontdubbel op id (zoals echte collecties)
    const m = new Map(); for (const it of arr) m.set(it.id, it);
    return [...m.values()];
  }
  // plat object
  const o = {}; const n = Math.floor(r() * 4);
  for (let i = 0; i < n; i++) o['k' + i] = randValue(r, diepte - 1);
  return o;
}

test('merge3: idempotent -- ours === theirs geeft ours terug', () => {
  const r = rng(1);
  for (let i = 0; i < 3000; i++) {
    const base = randValue(r, 3), ours = randValue(r, 3);
    const res = merge3(clone(base), clone(ours), clone(ours));
    assert.ok(eq(res, ours), `iter ${i}: idempotentie faalt\nbase=${JSON.stringify(base)}\nours=${JSON.stringify(ours)}\nres=${JSON.stringify(res)}`);
  }
});

test('merge3: identiteit -- als een kant niet wijzigde, wint de andere', () => {
  const r = rng(2);
  for (let i = 0; i < 3000; i++) {
    const base = randValue(r, 3), theirs = randValue(r, 3);
    // wij wijzigden niet (ours === base) -> theirs moet winnen
    assert.ok(eq(merge3(clone(base), clone(base), clone(theirs)), theirs), `iter ${i}: theirs-identiteit faalt`);
    // zij wijzigden niet (theirs === base) -> ours moet winnen
    const ours = randValue(r, 3);
    assert.ok(eq(merge3(clone(base), clone(ours), clone(base)), ours), `iter ${i}: ours-identiteit faalt`);
  }
});

test('merge3: nooit een uitzondering, resultaat is geldige JSON', () => {
  const r = rng(3);
  for (let i = 0; i < 5000; i++) {
    const base = r() < 0.2 ? undefined : randValue(r, 4);
    const ours = r() < 0.1 ? undefined : randValue(r, 4);
    const theirs = r() < 0.1 ? undefined : randValue(r, 4);
    let res;
    assert.doesNotThrow(() => { res = merge3(clone(base), clone(ours), clone(theirs)); }, `iter ${i} wierp`);
    assert.doesNotThrow(() => JSON.stringify(res), `iter ${i}: onserialiseerbaar resultaat`);
  }
});

/* De kern-invariant: gekeyde collecties waar beide kanten OP VERSCHILLENDE id's
   werken, mogen elkaars wijzigingen niet overschrijven. We bouwen ours/theirs uit
   base door op disjuncte id's toe te voegen/wijzigen/verwijderen, en vergelijken
   met een referentiemodel dat beide veranderingen toepast. */
test('merge3: gekeyde collecties -- disjuncte wijzigingen behouden alles (geen clobber)', () => {
  const r = rng(4);
  for (let iter = 0; iter < 4000; iter++) {
    // base: items met id 0..7
    const ids = []; for (let k = 0; k < 8; k++) if (r() < 0.6) ids.push(k);
    const base = ids.map(id => ({ id, v: Math.floor(r() * 100) }));
    // verdeel de id's over "onze" en "hun" kant, plus verse id's per kant
    const onsIds = new Set(), hunIds = new Set();
    for (const id of ids) (r() < 0.5 ? onsIds : hunIds).add(id);
    const ours = clone(base), theirs = clone(base);
    const ref = new Map(base.map(it => [it.id, clone(it)]));

    // onze kant muteert alleen onsIds (+ evt. nieuw id 100..103)
    for (const it of ours) if (onsIds.has(it.id)) {
      if (r() < 0.3) { it._del = true; } else { it.v = 1000 + it.id; }
    }
    let o2 = ours.filter(it => !it._del);
    if (r() < 0.5) { const nid = 100 + Math.floor(r() * 4); o2.push({ id: nid, v: 7 }); }
    // hun kant muteert alleen hunIds (+ evt. nieuw id 200..203)
    for (const it of theirs) if (hunIds.has(it.id)) {
      if (r() < 0.3) { it._del = true; } else { it.v = 2000 + it.id; }
    }
    let t2 = theirs.filter(it => !it._del);
    if (r() < 0.5) { const nid = 200 + Math.floor(r() * 4); t2.push({ id: nid, v: 9 }); }

    // referentie: pas onze wijzigingen (op onsIds) en hun wijzigingen (op hunIds) toe
    for (const id of onsIds) {
      const na = o2.find(it => it.id === id);
      if (!na) ref.delete(id); else ref.set(id, clone(na));
    }
    for (const it of o2) if (it.id >= 100) ref.set(it.id, clone(it));
    for (const id of hunIds) {
      const na = t2.find(it => it.id === id);
      if (!na) ref.delete(id); else ref.set(id, clone(na));
    }
    for (const it of t2) if (it.id >= 200) ref.set(it.id, clone(it));

    const res = merge3(clone(base), clone(o2), clone(t2));
    const resMap = new Map((res || []).map(it => [it.id, it]));
    // elk verwacht item aanwezig en gelijk; niets extra's
    assert.equal(resMap.size, ref.size, `iter ${iter}: aantal items wijkt af\nbase=${JSON.stringify(base)}\nours=${JSON.stringify(o2)}\ntheirs=${JSON.stringify(t2)}\nres=${JSON.stringify(res)}`);
    for (const [id, it] of ref) {
      assert.ok(resMap.has(id), `iter ${iter}: id ${id} ontbreekt in resultaat`);
      assert.ok(eq(resMap.get(id), it), `iter ${iter}: id ${id} verkeerd samengevoegd`);
    }
  }
});

test('merge3: verwijdering door één kant werkt door', () => {
  const r = rng(5);
  for (let i = 0; i < 2000; i++) {
    const base = [{ id: 1, v: 1 }, { id: 2, v: 2 }, { id: 3, v: 3 }];
    const ours = base.filter(it => it.id !== 2);   // wij verwijderen id 2
    const theirs = clone(base);                     // zij lieten het staan
    const res = merge3(clone(base), clone(ours), clone(theirs));
    assert.ok(!res.find(it => it.id === 2), `iter ${i}: verwijdering ging verloren`);
    assert.ok(res.find(it => it.id === 1) && res.find(it => it.id === 3), 'andere items bleven');
  }
});
