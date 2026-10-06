/* ============================================================================
   ENVELOP v2 -- de bus leest het verzoekframe (Fase 2, PR 5; besluit B3b).

   Vier dingen worden hier vastgehouden, en elk zakt op een eigen mutatie:

     1. HET NEGENDE VELD. `hoedanigheid` is { naam, grond } en verder niets; wat
        niemand zegt is `onbekend`, nooit stil een waarde. Bevoegdheden, een
        plafond of `wat` vallen er structureel af.
     2. LEZERS EERST. Een v1-envelop (een proces dat nog niet bij is) en een
        versie die deze code niet kent, lezen als `onbekend` -- en worden wel
        afgeleverd: de levering gaat voor.
     3. DE BUS LEEST HET FRAME (I1). Een envelop die binnen een verzoek ontstaat
        draagt diens correlatie, het verzoek als oorzaak en de CODENAAM van het
        lid -- nooit de datasleutel user-<n>. Een gesloten frame levert niets,
        en een ouder in de keten gaat voor.
     4. NOOIT UIT EEN OPGAVE. Een publicerende plek kan de hoedanigheid niet
        zetten; de bus neemt alleen actor en classificatie van haar over.

   Draai los: node --test test/envelopv2.test.js
   ========================================================================== */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { AsyncResource } = require('node:async_hooks');
const E = require('../server/kern/envelop');
const frame = require('../server/opzet/verzoekframe');
const opzetEnvelop = require('../server/opzet/envelop');
const { maakBus } = require('../server/bus');

function verzoek(sessie) {
  const req = { id: 'srv-' + Math.random().toString(16).slice(2, 10), externeId: null,
    path: '/x', method: 'POST', headers: {}, body: { hoedanigheid: { naam: 'advocaat', grond: 'sessie' } },
    session: sessie || null };
  const res = new EventEmitter();
  let binnen = null;
  frame.middleware()(req, res, () => { binnen = AsyncResource.bind((fn) => fn()); });
  return { req, binnen, sluit: () => res.emit('finish') };
}
const lid = (key, codename) => ({ key, tier: 'rtg', account: { id: 1, codename } });

test('1. het negende veld: onbekend tenzij gezegd, en alleen naam en grond', () => {
  assert.deepEqual({ ...E.maak({ kanaal: 'x' }).hoedanigheid }, { naam: 'onbekend', grond: null });
  const h = E.maak({ kanaal: 'x', hoedanigheid: { naam: 'zaakwaarnemer', grond: 'machtiging:m-12',
    bevoegdheden: ['betalen'], plafond: 500, wat: 'iets' } }).hoedanigheid;
  assert.deepEqual(Object.keys(h).sort(), ['grond', 'naam'], 'bevoegdheden, plafond en wat vallen eraf');
  assert.equal(h.naam, 'zaakwaarnemer');
  assert.ok(Object.isFrozen(h));
  assert.throws(() => E.maak({ kanaal: 'x', hoedanigheid: { naam: 'Mijn advocaat & vriend' } }), /gesloten lijst/);
  assert.throws(() => E.maak({ kanaal: 'x', hoedanigheid: { naam: 'advocaat', grond: 'body' } }), /grond/);
  assert.throws(() => E.maak({ kanaal: 'x', hoedanigheid: 'advocaat' }), /naam, grond/);
});

test('2. lezers eerst: v1 en een onbekende versie lezen als onbekend', () => {
  const v1 = { id: 'a', versie: 1, kanaal: 'x', actor: null, correlatie: 'a', oorzaak: null, classificatie: 'intern' };
  assert.equal(E.hoedanigheidVan(v1).naam, 'onbekend', 'v1 heeft geen negende veld');
  const v3 = Object.assign({}, v1, { versie: 3, hoedanigheid: { naam: 'advocaat', grond: 'sessie' } });
  assert.equal(E.hoedanigheidVan(v3).naam, 'onbekend', 'een veld uit een onbekend formaat wordt niet geraden');
  const v2 = Object.assign({}, v1, { versie: 2, hoedanigheid: { naam: 'advocaat', grond: 'sessie' } });
  assert.equal(E.hoedanigheidVan(v2).naam, 'advocaat');
  assert.equal(E.hoedanigheidVan(Object.assign({}, v2, { hoedanigheid: { naam: 'X Y' } })).naam, 'onbekend',
    'een onleesbare waarde is onbekend, geen fout bij de lezer');
  assert.equal(E.hoedanigheidVan(null).naam, 'onbekend');
  /* Een gevolg van een v1-ouder is v2 met onbekend: de keten loopt door. */
  E.inKeten(v1, () => {
    const g = E.maak({ kanaal: 'x' });
    assert.equal(g.versie, 2);
    assert.equal(g.correlatie, 'a');
    assert.equal(g.hoedanigheid.naam, 'onbekend');
  });
});

test('3. binnen een verzoek: correlatie, oorzaak en de CODENAAM uit het frame (I1)', () => {
  const v = verzoek(lid('user-41', 'Amberen Vos'));
  v.binnen(() => {
    opzetEnvelop.zet(v.req, { soort: 'lid', id: 'user-41', rol: 'rtg' });
    const e = E.maak({ kanaal: 'sse' });
    assert.equal(e.correlatie, v.req.id, 'de verzoekcorrelatie');
    assert.equal(e.oorzaak, v.req.id, 'het verzoek is de oorzaak');
    assert.equal(e.actor, 'Amberen Vos', 'de codenaam, en niet user-41');
    assert.equal(e.hoedanigheid.naam, 'onbekend', 'het frame draagt er geen, dus de envelop ook niet');
    /* Een ouder in de keten gaat voor: dan is dit een gevolg en geen begin. */
    const ouder = E.alsStart(E.maak({ kanaal: 'keten', correlatie: 'andere-keten', actor: 'Iemand Anders' }));
    E.inKeten(ouder, () => {
      const g = E.maak({ kanaal: 'sse' });
      assert.equal(g.correlatie, 'andere-keten');
      assert.equal(g.actor, 'Iemand Anders');
    });
  });
  /* Een gesloten frame levert niets: werk na afloop erft geen identiteit. */
  v.sluit();
  v.binnen(() => {
    const e = E.maak({ kanaal: 'sse' });
    assert.equal(e.correlatie, null);
    assert.equal(e.actor, null);
  });
});

test('3b. geen datasleutel en geen codenaam van een andere sessie op de bus', () => {
  const v = verzoek(lid('user-42', 'user-42'));     // een account zonder echte codenaam
  v.binnen(() => {
    opzetEnvelop.zet(v.req, { soort: 'lid', id: 'user-42' });
    assert.equal(E.maak({ kanaal: 'sse' }).actor, null, 'een datasleutel is geen codenaam');
  });
  const y = verzoek(lid('user-46', 'user-7'));      // de sleutel van een ANDER lid
  y.binnen(() => {
    opzetEnvelop.zet(y.req, { soort: 'lid', id: 'user-46' });
    assert.equal(E.maak({ kanaal: 'sse' }).actor, null, 'ook niet die van een ander');
  });
  const z = verzoek(lid('rtg', 'rtg'));             // een sleutel zonder user-vorm
  z.binnen(() => {
    opzetEnvelop.zet(z.req, { soort: 'lid', id: 'rtg' });
    assert.equal(E.maak({ kanaal: 'sse' }).actor, null, 'de sleutel zelf is geen codenaam');
  });
  const w = verzoek(lid('user-43', 'Zilveren Reiger'));
  w.binnen(() => {
    opzetEnvelop.zet(w.req, { soort: 'lid', id: 'user-99' });   // de sessie hoort niet bij deze actor
    assert.equal(E.maak({ kanaal: 'sse' }).actor, null);
  });
  const x = verzoek(lid('user-44', 'jan@voorbeeld.nl'));
  const t0 = frame.tellers().codenaamGeweigerd;
  x.binnen(() => {
    opzetEnvelop.zet(x.req, { soort: 'lid', id: 'user-44' });
    assert.equal(E.maak({ kanaal: 'sse' }).actor, null, 'de zeef van de envelop geldt ook hier');
  });
  assert.equal(frame.tellers().codenaamGeweigerd - t0, 1, 'en de weigering telt');
});

test('4. de bus neemt de hoedanigheid nooit uit de opgave van een publicerende plek', () => {
  const bus = maakBus();
  const gezien = [];
  bus.subscribe('proef', m => gezien.push(m));
  const v = verzoek(lid('user-45', 'Stille Uil'));
  v.binnen(() => {
    opzetEnvelop.zet(v.req, { soort: 'lid', id: 'user-45' });
    bus.publish('proef', { event: 'x', data: {}, envelop: { classificatie: 'intern',
      hoedanigheid: { naam: 'advocaat', grond: 'sessie' } } });
  });
  assert.equal(gezien.length, 1);
  const env = gezien[0].envelop;
  assert.equal(env.hoedanigheid.naam, 'onbekend', 'een opgave zet geen rol');
  assert.equal(env.correlatie, v.req.id, 'maar de keten van het verzoek wel');
  assert.equal(env.actor, 'Stille Uil');
  assert.equal(env.versie, 2);
});

/* Een Redis-transport in het geheugen: twee clients op een makelaar, met de
   echte JSON-weg ertussen. */
function nepRedis() {
  const makelaar = new EventEmitter();
  return { createClient: () => {
    const c = new EventEmitter();
    c.connect = async () => { setImmediate(() => c.emit('ready')); };
    c.publish = async (k, tekst) => { makelaar.emit(k, tekst); return 1; };
    c.subscribe = async (k, fn) => { makelaar.on(k, fn); return 1; };
    c.scan = async () => ['0', []]; c.get = async () => null; c.eval = async () => 1;
    return c;
  }, makelaar };
}

test('5. Redis: een v1- en een onbekende versie worden afgeleverd, en de keten loopt door', async () => {
  const busPad = require.resolve('../server/bus'), redisPad = require.resolve('../server/redis');
  const oudUrl = process.env.REDIS_URL, oudRedis = require.cache[redisPad];
  const nep = nepRedis();
  try {
    process.env.REDIS_URL = 'redis://nep:6379';
    require.cache[redisPad] = { id: redisPad, filename: redisPad, loaded: true, exports: nep };
    delete require.cache[busPad];
    const oudLog = console.log; console.log = () => {};
    let bus; try { bus = require('../server/bus').maakBus(); } finally { console.log = oudLog; }
    await new Promise((r) => { const uit = bus.onStand(s => { if (s.gereed) { setImmediate(() => uit()); r(); } }); });
    const gezien = [];
    bus.subscribe('oud', (m) => {
      gezien.push(m);
      if (m.event === 'eerste') bus.publishDirect('oud', { event: 'gevolg', data: {}, envelop: { classificatie: 'intern' } });
    });
    await new Promise(r => setImmediate(r));
    const t0 = E.tellers().onbekendeVersie;
    const v1 = { id: 'v1-id', at: '2026-10-05T00:00:00.000Z', versie: 1, kanaal: 'oud', actor: 'Oude Vos',
      correlatie: 'keten-1', oorzaak: null, classificatie: 'intern' };
    nep.makelaar.emit('oud', JSON.stringify({ event: 'eerste', data: {}, envelop: v1 }));
    nep.makelaar.emit('oud', JSON.stringify({ event: 'later', data: {},
      envelop: Object.assign({}, v1, { id: 'v3-id', versie: 3, hoedanigheid: { naam: 'advocaat', grond: 'sessie' }, nieuw: 1 }) }));
    for (let i = 0; i < 5 && gezien.length < 3; i++) await new Promise(r => setImmediate(r));
    const [eerste, gevolg, later] = [gezien.find(m => m.event === 'eerste'), gezien.find(m => m.event === 'gevolg'),
      gezien.find(m => m.event === 'later')];
    assert.ok(eerste && later, 'beide versies zijn afgeleverd: de levering gaat voor');
    assert.equal(E.hoedanigheidVan(eerste.envelop).naam, 'onbekend');
    assert.equal(E.hoedanigheidVan(later.envelop).naam, 'onbekend', 'een v3-veld wordt niet geraden');
    assert.ok(gevolg, 'het gevolg van de v1-gebeurtenis kwam over de bus terug');
    assert.equal(gevolg.envelop.versie, 2);
    assert.equal(gevolg.envelop.correlatie, 'keten-1', 'de keten van het v1-proces loopt door');
    assert.equal(gevolg.envelop.oorzaak, 'v1-id');
    assert.equal(gevolg.envelop.actor, 'Oude Vos');
    assert.equal(gevolg.envelop.hoedanigheid.naam, 'onbekend', 'ontbrekend in de ouder = onbekend in het gevolg');
    assert.equal(E.tellers().onbekendeVersie - t0, 1, 'de onbekende versie telt, de v1 niet');
  } finally {
    if (oudUrl === undefined) delete process.env.REDIS_URL; else process.env.REDIS_URL = oudUrl;
    if (oudRedis) require.cache[redisPad] = oudRedis; else delete require.cache[redisPad];
    delete require.cache[busPad];
  }
});
