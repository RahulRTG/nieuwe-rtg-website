/* ============================================================================
   EEN BUS-ABONNEE DRAAIT NIET IN HET VERZOEK VAN DE PUBLICEERDER (Fase 2, PR 6,
   invariant I12).

   `emit` is synchroon, dus in proces draaide een abonnee (SSE, sessies,
   intreksignaal, deurrem) tot nu toe in de handeling, het verzoekframe, de
   kostendrager en de AI-sessie van het verzoek dat publiceerde. Over Redis niet.
   Twee transporten, twee gedragingen -- en een AI-aanroep in een abonnee zou op
   het lid van een ander verzoek geboekt worden.

   Nu draait elke abonnee in de nulcontext, met alleen de envelop van zijn
   bericht als keten. Deze toetsen houden dat vast voor beide transporten, en
   houden ook vast dat de keten zelf NIET breekt: een gevolg erft correlatie en
   oorzaak zoals altijd.

   Draai los: node --test test/busabonnee.test.js
   ========================================================================== */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const handeling = require('../server/opzet/handeling');
const frame = require('../server/opzet/verzoekframe');
const opzetEnvelop = require('../server/opzet/envelop');
const haak = require('../server/kern/kosten/haak');
const aic = require('../server/ai-context');
const E = require('../server/kern/envelop');

/* fn draait in een OPEN verzoek met alle vier de identiteitsdragende contexten. */
function inVerzoek(fn) {
  const req = { id: 'srv-' + Math.random().toString(16).slice(2, 10), path: '/x', method: 'POST',
    ip: '127.0.0.1', headers: {}, session: { key: 'user-7', tier: 'rtg', account: { id: 7, codename: 'Grijze Reiger' } } };
  const res = new EventEmitter();
  let uit;
  frame.middleware()(req, res, () => handeling.middleware({ data: () => null, log: () => {} })(req, res, () => {
    aic.inContext({ ip: req.ip, req }, () => {
      opzetEnvelop.zet(req, { soort: 'lid', id: 'user-7' });
      haak.binnen(haak.drager('lid', 'user-7'), () => { uit = fn(req); }, 'rtg', 'sessie');
    });
  }));
  return uit;
}

/* Wat de abonnee ziet van de contexten van een verzoek. */
const peil = () => ({ frame: !!frame.huidig(), handeling: !!handeling.huidige(),
  drager: haak.wieNu(), ai: !!aic.huidig(), keten: E.huidige() && E.huidige().id });

function proef(bus) {
  const gezien = [];
  bus.subscribe('i12', (m) => {
    gezien.push({ m, ctx: peil() });
    if (m.event === 'eerste') bus.publishDirect('i12', { event: 'gevolg', data: {}, envelop: { classificatie: 'intern' } });
  });
  const req = inVerzoek((r) => {
    /* Eerst: de proef zelf staat echt in een verzoek. Anders bewijst niets. */
    const p = peil();
    assert.ok(p.frame && p.handeling && p.ai, 'de opzet staat niet in een verzoek');
    assert.equal(p.drager, 'lid:user-7');
    bus.publishDirect('i12', { event: 'eerste', data: {}, envelop: { classificatie: 'intern' } });
    return r;
  });
  return { gezien, req };
}

function controleer({ gezien, req }) {
  const eerste = gezien.find(g => g.m.event === 'eerste');
  const gevolg = gezien.find(g => g.m.event === 'gevolg');
  assert.ok(eerste && gevolg, 'beide berichten afgeleverd');
  for (const g of [eerste, gevolg]) {
    assert.equal(g.ctx.frame, false, 'geen verzoekframe van de publiceerder');
    assert.equal(g.ctx.handeling, false, 'geen handeling van de publiceerder');
    assert.equal(g.ctx.drager, 'huis', 'geen kostendrager van de publiceerder');
    assert.equal(g.ctx.ai, false, 'geen AI-sessie van de publiceerder');
    assert.equal(g.ctx.keten, g.m.envelop.id, 'maar wel de envelop van het eigen bericht');
  }
  /* De envelop zelf is in het verzoek gestempeld (PR 5) en de keten loopt door. */
  assert.equal(eerste.m.envelop.correlatie, req.id);
  assert.equal(eerste.m.envelop.actor, 'Grijze Reiger');
  assert.equal(gevolg.m.envelop.correlatie, req.id, 'het gevolg blijft in de keten van het verzoek');
  assert.equal(gevolg.m.envelop.oorzaak, eerste.m.envelop.id);
}

test('in proces: de abonnee draait in de nulcontext, met alleen zijn envelop (I12)', () => {
  delete process.env.REDIS_URL;
  const { maakBus } = require('../server/bus');
  controleer(proef(maakBus()));
});

test('over Redis: hetzelfde gedrag, ook als het transport synchroon aflevert', async () => {
  const busPad = require.resolve('../server/bus'), redisPad = require.resolve('../server/redis');
  const oudUrl = process.env.REDIS_URL, oudRedis = require.cache[redisPad];
  /* Een makelaar die in de context van de PUBLICEERDER aflevert: het strengste
     transport. Een echte Redis-socket levert in de context van de verbinding af. */
  const makelaar = new EventEmitter();
  const client = () => {
    const c = new EventEmitter();
    c.connect = async () => { setImmediate(() => c.emit('ready')); };
    c.publish = (k, t) => { makelaar.emit(k, t); return Promise.resolve(1); };
    c.subscribe = async (k, fn) => { makelaar.on(k, fn); return 1; };
    return c;
  };
  try {
    process.env.REDIS_URL = 'redis://nep:6379';
    require.cache[redisPad] = { id: redisPad, filename: redisPad, loaded: true, exports: { createClient: client } };
    delete require.cache[busPad];
    const oudLog = console.log; console.log = () => {};
    let bus; try { bus = require('../server/bus').maakBus(); } finally { console.log = oudLog; }
    await new Promise((r) => { const uit = bus.onStand(s => { if (s.gereed) { setImmediate(() => uit()); r(); } }); });
    await new Promise(r => setImmediate(r));
    controleer(proef(bus));
  } finally {
    if (oudUrl === undefined) delete process.env.REDIS_URL; else process.env.REDIS_URL = oudUrl;
    if (oudRedis) require.cache[redisPad] = oudRedis; else delete require.cache[redisPad];
    delete require.cache[busPad];
  }
});
