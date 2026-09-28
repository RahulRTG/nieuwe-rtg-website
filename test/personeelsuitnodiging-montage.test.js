/* De personeelsuitnodiging (workos.personeelsuitnodiging) belooft een
   atomaire claim, en die bestaat alleen in een collectietransactie. Werving en
   supplier maakten elk een eigen instantie met alleen `kern`, en kern draagt
   bewerkCollectie niet: de claim nam stil de niet-transactionele weg. Deze
   toets houdt twee dingen vast:

   1. de instantie die opzet/kernlaag6b.js op de kern zet, loopt door
      bewerkCollectie('staffInvites', ...);
   2. zonder bewerkCollectie weigert de module in productie, in plaats van
      terug te vallen op db.data plus save().

   De race over twee echte instances staat in
   test/personeelsuitnodiging.pg.test.js.

   Draai los: node --test test/personeelsuitnodiging-montage.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

// een los onderdeel dat alles slikt: kernlaag6b bouwt meer dan deze toets nodig heeft
const stub = () => new Proxy(function () {}, { get: (t, k) => k === 'data' ? {} : stub(), apply: () => undefined });

test('de gemonteerde personeelsuitnodiging claimt in de collectietransactie', () => {
  const namen = [];
  const kern = {};
  const hulp = new Proxy({
    bewerkCollectie: (naam, werk) => { namen.push(naam); return werk({}); },
    db: { data: { suppliers: [] } }
  }, { get: (t, k) => k in t ? t[k] : stub() });
  const k = new Proxy(kern, {
    get: (t, p) => p in t ? t[p] : stub(),
    set: (t, p, v) => { t[p] = v; return true; }
  });
  require('../server/opzet/kernlaag6b')(k, hulp);
  const u = kern.personeelsUitnodiging;
  assert.equal(typeof u.verbindCode, 'function');
  assert.deepEqual(u.lijstInvites('ZAAK'), { ok: true, invites: [] });
  assert.deepEqual(namen, ['staffInvites'], 'de lezing liep niet door de collectietransactie');
});

test('zonder collectietransactie weigert de module in productie', () => {
  const kern = {
    accounts: {}, crypto, db: { data: { suppliers: [{ code: 'ZAAK', name: 'De Zaak' }] } },
    save: () => { throw new Error('mag niet: dit is de niet-atomaire weg'); },
    logActivity: () => {}, notifySupplier: () => {}
  };
  const oud = process.env.NODE_ENV;
  process.env.NODE_ENV = 'production';
  try {
    const u = require('../server/routes/supplier/werving/uitnodiging')({ kern });
    assert.throws(() => u.maakInvite({ code: 'ZAAK' }, { name: 'M' }, { role: 'staff' }),
      /staffInvites vereist bewerkCollectie/);
    assert.equal(kern.db.data.staffInvites, undefined, 'er is toch in db.data geschreven');
  } finally {
    if (oud === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = oud;
  }
});
