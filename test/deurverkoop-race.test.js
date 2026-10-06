'use strict';
/* DEURVERKOOP: EERST DE PLEK, DAN HET GELD.

   De race die hier vastligt: de deurkassa telde de vrije plekken, wachtte op
   `pay.kasInt`, en voegde het kaartje pas daarna toe. Zolang die betaling
   alleen microtaken afwacht (de toetsopstelling met genoeg saldo) gebeurt er
   niets; wacht hij op echte I/O -- de geldmotor, of een opwaardering bij een
   provider -- dan tellen twee kopers dezelfde plekken. Gemeten: vier personen
   verkocht bij een capaciteit van drie. kern/festival/verkoop.js beschrijft
   precies deze race en lost hem op dezelfde manier op.

   De route draait hier met een nagemaakte kern omdat de race alleen bestaat
   als de betaling werkelijk wacht, en dat is in de serveropstelling niet te
   maken zonder de motor. `ticketsVoorSlot` volgt de echte regel uit
   kern/leverancier/zaak.js: geweigerd telt niet, onbetaald telt 30 min mee. */

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const Module = require('module');

const ROUTE = require.resolve('../server/routes/supplier/tickets.js');

function opstelling(kasInt) {
  const routes = {};
  const boekingen = [];
  const zaak = { code: 'Z1', name: 'Club', activiteiten: [{ id: 'a1', name: 'Nacht', prijs: 25, capaciteit: 3, tijden: ['23:00'] }] };
  const kern = {
    app: { post: (pad, ...h) => { routes[pad] = h[h.length - 1]; }, get: () => {} },
    crypto, db: { capsVan: () => ['tickets'], data: { posSales: {} } },
    logActivity() {}, save() {}, schoon: x => x, sseToSupplier() {}, supplierAuth() {}, managerOnly: () => true,
    ticketsVoorSlot: (c, a, d, t) => boekingen.filter(b => b.activiteitId === a && b.tijd === t &&
      b.status !== 'geweigerd' && (b.paid || Date.now() - Date.parse(b.at) < 30 * 60000)),
    boekingenVoegToe: b => boekingen.push(b),
    tickettoegang: { uitgeven: async () => ({ code: 'TK.X' }) },
    pay: { kasInt }
  };
  const origineel = Module.prototype.require;
  Module.prototype.require = function (p) { return p === './tickets-deur' ? () => {} : origineel.apply(this, arguments); };
  try { delete require.cache[ROUTE]; require(ROUTE)(kern); } finally { Module.prototype.require = origineel; }
  const verkoop = body => new Promise(klaar => {
    setImmediate(() => routes['/api/supplier/ticket/deurverkoop'](
      { supplier: zaak, actor: { name: 'deur' }, body: Object.assign({ activiteitId: 'a1', tijd: '23:00', method: 'rtgpay' }, body) },
      { set() {}, status(c) { this.c = c; return this; }, json(b) { klaar({ status: this.c || 200, body: b }); } }));
  });
  const betaald = () => boekingen.filter(b => b.paid && b.status !== 'geweigerd').reduce((n, b) => n + b.personen, 0);
  return { verkoop, boekingen, betaald };
}

// een sprong naar de volgende ronde van de event-loop: genoeg om twee kopers door elkaar te laten lopen
const metIO = antwoord => async () => { await new Promise(r => setImmediate(r)); return antwoord(); };

test('1. twee kopers tegelijk verkopen nooit meer dan de capaciteit, ook als de betaling op I/O wacht', async () => {
  const o = opstelling(metIO(() => ({ van: 'Lid' })));
  const uit = await Promise.all([
    o.verkoop({ personen: 2, payCode: 'c1', idem: 'i1' }),
    o.verkoop({ personen: 2, payCode: 'c2', idem: 'i2' })]);
  assert.deepEqual(uit.map(u => u.status).sort(), [200, 409]);
  assert.ok(o.betaald() <= 3, 'verkocht: ' + o.betaald() + ' bij een capaciteit van 3');
});

test('2. een geweigerde betaling geeft de plek terug', async () => {
  let keer = 0;
  const o = opstelling(metIO(() => (++keer === 1 ? { error: 'Saldo te laag.', status: 402 } : { van: 'Lid' })));
  const r = await o.verkoop({ personen: 3, payCode: 'c1', idem: 'i1' });
  assert.equal(r.status, 402);
  assert.equal(o.boekingen[0].status, 'geweigerd');
  // dezelfde drie plekken zijn meteen weer te koop
  assert.equal((await o.verkoop({ personen: 3, payCode: 'c2', idem: 'i2' })).status, 200);
  assert.equal(o.betaald(), 3);
});

test('3. een ONBEKENDE uitkomst houdt de plek vast, en een retry met dezelfde sleutel neemt die plek', async () => {
  let keer = 0;
  const o = opstelling(metIO(() => (++keer === 1
    ? { error: 'Het is niet zeker of de betaling gelukt is.', status: 503, code: 'KASCLAIM_HERVATBAAR' }
    : { van: 'Lid' })));
  const eerste = await o.verkoop({ personen: 3, payCode: 'c1', idem: 'zelfde' });
  assert.equal(eerste.status, 503);
  assert.equal(eerste.body.code, 'KASCLAIM_HERVATBAAR');
  assert.equal(o.boekingen[0].status, 'wacht-op-betaling', 'onbekend is geen mislukking: de plek blijft vast');

  // iemand anders kan die plekken ondertussen niet kopen
  assert.equal((await o.verkoop({ personen: 1, payCode: 'c9', idem: 'ander' })).status, 409);

  // de herhaling komt bij DEZE plek uit en maakt geen tweede
  const retry = await o.verkoop({ personen: 3, payCode: 'c1', idem: 'zelfde' });
  assert.equal(retry.status, 200);
  assert.equal(o.boekingen.filter(b => b.status !== 'geweigerd').length, 1);
  assert.equal(o.betaald(), 3);
});

test('4. contant verandert niet: meteen betaald en bevestigd', async () => {
  const o = opstelling(async () => { throw new Error('contant mag de betaallaag niet raken'); });
  const r = await o.verkoop({ personen: 2, method: 'contant' });
  assert.equal(r.status, 200);
  assert.equal(o.boekingen[0].paid, true);
  assert.equal(o.boekingen[0].status, 'bevestigd');
});
