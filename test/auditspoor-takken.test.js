'use strict';
/* HET API-SPOOR (server/opzet/auditspoor.js), de middleware rechtstreeks
   aangeroepen met een nagemaakt verzoek en antwoord -- geen server. Hier de
   takken die test/auditspoor.test.js via HTTP niet raakt: de eigenaar en de
   gedeelde sessies achter een Bearer-token als actor, het burgerpad onder
   pseudoniem en zonder verzoek-id, een pad dat ontbreekt, het bewaren via
   save.sleutels, een eigen auditopslag met bundel, en de haak vóór de commit
   als er een verzoekcontext open staat. */
const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { maakAuditspoor, SCHRIJFT, OVERSLAAN } = require('../server/opzet/auditspoor');
const verzoekcontext = require('../server/db/verzoekcontext');

function opzet(o = {}) {
  const db = { data: {} };
  const bewaard = [];
  const save = o.save || ((sleutels) => { bewaard.push(sleutels); });
  const spoor = maakAuditspoor({ db, save, sessionFor: o.sessionFor });
  return { db, spoor, bewaard, mw: spoor.middleware() };
}
function verzoek(x = {}) {
  const koppen = x.koppen || {};
  return Object.assign({ method: 'POST', path: '/api/iets', id: 'req-1', get: (n) => koppen[String(n).toLowerCase()] }, x);
}
function antwoord(status) {
  const res = new EventEmitter();
  res.statusCode = status == null ? 200 : status;
  return res;
}
/* een verzoek door de middleware, het antwoord afgerond; geeft de laatste regel */
function stuur(o, req, status) {
  const res = antwoord(status);
  let door = 0;
  o.mw(req, res, () => { door++; });
  assert.equal(door, 1, 'de middleware houdt een verzoek nooit op');
  res.emit('finish');
  const lijst = o.db.data.apiSpoor && o.db.data.apiSpoor.commandJournaal;
  return lijst ? lijst[lijst.length - 1] : null;
}

test('de schrijvende methodes en de overgeslagen paden', () => {
  assert.deepEqual([...SCHRIJFT].sort(), ['DELETE', 'PATCH', 'POST', 'PUT']);
  assert.ok(OVERSLAAN.some(p => p.test('/api/health')));
  assert.ok(!OVERSLAAN.some(p => p.test('/api/healthz')));
});

test('lezen en intern verkeer gaan ongezien door, een schrijfhandeling laat een regel na', () => {
  const o = opzet();
  assert.equal(stuur(o, verzoek({ method: 'GET' })), null);
  assert.equal(stuur(o, verzoek({ path: '/api/cluster/hartslag' })), null);
  assert.equal(stuur(o, verzoek({ path: '/api/command/apispoor' })), null);
  const r = stuur(o, verzoek({ method: 'DELETE', path: '/api/ding/7' }));
  assert.equal(r.actie, 'DELETE /api/ding/7');
  assert.equal(r.actor, 'anoniem');
  assert.equal(r.niveau, 'api');
  assert.equal(r.uitslag, '200');
  assert.equal(r.verzoek, 'req-1');
  assert.equal(o.spoor.stand().aantal, 1);
  assert.deepEqual(o.spoor.stand().keten, { heel: true, regels: 1 });
});

test('alleen een geslaagde handeling telt: 1xx, 3xx en 4xx laten niets na', () => {
  const o = opzet();
  for (const status of [101, 302, 404, 500]) assert.equal(stuur(o, verzoek(), status), null, String(status));
  assert.ok(stuur(o, verzoek(), 299));
  assert.equal(o.spoor.stand().aantal, 1);
});

test('de actor: sessie, zaak met en zonder medewerker, en de eigenaar', () => {
  const o = opzet();
  assert.equal(stuur(o, verzoek({ session: { key: 'lid-9' } })).actor, 'lid-9');
  assert.equal(stuur(o, verzoek({ session: {}, supplier: { code: 'KIK' } })).actor, 'zaak-KIK');
  assert.equal(stuur(o, verzoek({ supplier: { code: 'KIK' }, actor: { staffId: 'st-3' } })).actor, 'zaak-KIK/st-3');
  assert.equal(stuur(o, verzoek({ supplier: {}, eigenaar: true })).actor, 'eigenaar');
});

test('achter een Bearer-token: kantoor met en zonder eigen account, een zaak, en wat er niet bij hoort', () => {
  const sessies = {
    k1: { role: 'office', lidKey: 'lid-4' }, k2: { role: 'office' },
    z1: { role: 'supplier', code: 'ZAAK' }, z2: { role: 'supplier' }, l1: { role: 'member' }
  };
  const gezien = [];
  const o = opzet({ sessionFor: (t) => { gezien.push(t); return sessies[t] || null; } });
  const met = (token) => stuur(o, verzoek({ koppen: { authorization: 'Bearer ' + token } })).actor;
  assert.equal(met('k1'), 'lid-4');
  assert.equal(met('k2'), 'kantoor-gedeelde-code');
  assert.equal(met('z1'), 'zaak-ZAAK');
  assert.equal(met('z2'), 'zaak-?');
  assert.equal(met('l1'), 'anoniem');
  assert.equal(met('onbekend'), 'anoniem');
  assert.equal(stuur(o, verzoek({ koppen: { authorization: 'Basic abc' } })).actor, 'anoniem');
  assert.deepEqual(gezien, ['k1', 'k2', 'z1', 'z2', 'l1', 'onbekend'], 'zonder Bearer wordt er geen sessie opgezocht');
  /* zonder sessiezoeker blijft een token anoniem */
  const kaal = opzet();
  assert.equal(stuur(kaal, verzoek({ koppen: { authorization: 'Bearer k1' } })).actor, 'anoniem');
});

test('een burgerpad staat onder pseudoniem, op de dag en zonder verzoek-id', () => {
  const o = opzet();
  const r = stuur(o, verzoek({ path: '/api/member/democratie/stem', session: { key: 'lid-1' } }));
  assert.equal(r.actor, 'burger (pseudoniem)');
  assert.equal(r.verzoek, undefined);
  assert.ok(!JSON.stringify(r).includes('lid-1'), 'de sleutel van de burger staat nergens');
});

test('een ontbrekend pad wordt een lege actie, en een lang pad wordt afgekapt', () => {
  const o = opzet();
  assert.equal(stuur(o, verzoek({ path: undefined })).actie, 'POST ');
  assert.equal(stuur(o, verzoek({ path: '/api/' + 'x'.repeat(300) })).actie.length, 'POST '.length + 200);
});

test('bewaren gaat langs save.sleutels als die er is, anders langs save zelf', () => {
  const o = opzet();
  stuur(o, verzoek());
  assert.deepEqual(o.bewaard[0], ['apiSpoor']);
  const via = [];
  const save = () => { throw new Error('niet deze weg'); };
  save.sleutels = (s) => { via.push(s); };
  const p = opzet({ save });
  stuur(p, verzoek());
  assert.deepEqual(via, [['apiSpoor']]);
});

test('een eigen auditopslag krijgt de regel, gebundeld na het antwoord', () => {
  const rijen = [];
  const bundels = [];
  const save = () => {};
  save.audit = {
    open: (naam) => { assert.equal(naam, 'apiSpoor'); return {
      view: () => ({}),
      append: (maak) => { const r = maak(rijen[rijen.length - 1]); rijen.push(r); return r; }
    }; },
    batch: (werk) => { bundels.push(1); return werk(); }
  };
  const o = opzet({ save });
  stuur(o, verzoek({ session: { key: 'lid-2' } }));
  stuur(o, verzoek({ session: { key: 'lid-3' } }));
  assert.equal(rijen.length, 2);
  assert.equal(bundels.length, 2);
  assert.equal(rijen[1].vorig, rijen[0].zegel, 'de keten loopt door in de eigen opslag');
  assert.deepEqual(rijen.map(r => r.actor), ['lid-2', 'lid-3']);
  assert.equal(o.db.data.apiSpoor, undefined, 'niets in het gewone vak');
});

test('met een open verzoekcontext gaat het spoor mee vóór de commit, en niet op finish', () => {
  const o = opzet();
  const ctx = verzoekcontext.nieuw(null);
  const res = antwoord(201);
  verzoekcontext.voer(ctx, () => o.mw(verzoek({ session: { key: 'lid-5' } }), res, () => {}));
  assert.equal(ctx.voorCommit.length, 1);
  res.emit('finish');
  assert.equal(o.spoor.stand().aantal, 0, 'finish schrijft niets: de commit doet het');
  ctx.voorCommit[0]();
  assert.equal(o.spoor.stand().aantal, 1);
  assert.equal(o.db.data.apiSpoor.commandJournaal[0].actor, 'lid-5');
  assert.equal(o.db.data.apiSpoor.commandJournaal[0].uitslag, '201');
});
