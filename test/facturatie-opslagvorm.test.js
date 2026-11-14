'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const { isProxy } = require('node:util').types;
const crypto = require('node:crypto');
const fixture = require('./lib/audit-rijen-fixture');

function motor(db, save) {
  return require('../server/kern/facturatie').maakFacturatie({ db, save, crypto,
    findSupplier: () => ({ code: 'ZAAK', name: 'Proefzaak', land: 'NL' }) });
}
const invoer = ref => ({ verkoperCode: 'ZAAK', koper: { codenaam: 'ALFA', key: 'k:ALFA' },
  regels: [{ omschrijving: 'Proef', aantal: 2, stuk: 12.10, btw: 21 }], ref });

test('herhaald factureren bewaart gewone records, geen trackerproxies in de opslagarray', t => {
  const tracker = require('../server/db/mutatietracker');
  const db = { data: tracker.bewaak({ facturen: [], factuurTeller: 0 }) };
  const f = motor(db, () => {});
  for (let i = 0; i < 50; i++) assert.equal(f.boek(invoer('R' + i)).ok, true);
  const verwacht = JSON.stringify(db.data.facturen);
  const stringify = JSON.stringify;
  let bekeken = 0, proxies = 0;
  t.mock.method(JSON, 'stringify', function(waarde, ...rest) {
    if (Array.isArray(waarde) && waarde.length === 50) {
      bekeken++; proxies += waarde.filter(isProxy).length;
    }
    return stringify.call(this, waarde, ...rest);
  });
  const tekst = tracker.serialiseerVoorOpslag(db.data.facturen, 'facturen');
  assert.equal(tekst, verwacht, 'alle velden en volgorde blijven native JSON');
  assert.equal(bekeken, 1);
  assert.equal(proxies, 0, 'slice mag geen kinderproxies in de opslagarray terugzetten');
});

test('facturen, nummering en latere betaalstatus staan echt in SQLite en na herstart', t => {
  const p = fixture(t, { facturen: [], factuurTeller: 0 });
  const f = motor(p.db, p.save);
  const a = f.boek(invoer('A')), b = f.boek(invoer('B'));
  assert.equal(a.ok, true); assert.equal(b.ok, true);
  let vast = p.lees('facturen');
  assert.deepEqual(vast.map(x => x.ref), ['B', 'A']);
  assert.equal(p.lees('factuurTeller'), 2);
  assert.equal(vast[0].totaal, 24.2);
  assert.equal(vast[0].betaald, false);
  const id = vast[0].id;
  assert.equal(f.factuurBetaald(id, 'ZAAK', true).ok, true);
  assert.equal(p.lees('facturen')[0].betaald, true);
  assert.equal(f.factuurBetaald(id, 'ZAAK', false).ok, true);
  assert.equal(f.classificeer(id, 'k:ALFA', 'zakelijk').ok, true);
  vast = p.lees('facturen');
  assert.equal(vast[0].betaald, false);
  assert.equal(vast[0].betaaldAt, null);
  assert.equal(vast[0].classificatie, 'zakelijk');
  const kind = p.kind("const p=require('./server/db');p.load();process.stdout.write(JSON.stringify({facturen:p.db.data.facturen,teller:p.db.data.factuurTeller}));process.exit(0)");
  assert.equal(kind.status, 0, kind.stderr);
  const herstart = JSON.parse(kind.stdout.trim().split('\n').pop());
  assert.deepEqual(herstart, { facturen: vast, teller: 2 });
});

test('diagnostiek: werkelijke factuurvorm blijft native JSON bij herhaalde serialisatie', t => {
  const tracker = require('../server/db/mutatietracker');
  const db = { data: tracker.bewaak({ facturen: [], factuurTeller: 0 }) };
  const f = motor(db, () => {});
  f.boek(invoer('BASIS'));
  const basis = JSON.parse(JSON.stringify(db.data.facturen[0]));
  db.data.facturen = Array.from({ length: 2000 }, (_, i) => ({ ...basis, id: 'f' + i, ref: 'R' + i }));
  f.boek(invoer('NIEUW'));
  const verwacht = JSON.stringify(db.data.facturen), metingen = [];
  for (let i = 0; i < 30; i++) {
    const begin = performance.now();
    const tekst = tracker.serialiseerVoorOpslag(db.data.facturen, 'facturen');
    metingen.push(performance.now() - begin);
    assert.equal(tekst, verwacht);
  }
  metingen.sort((a, b) => a - b);
  t.diagnostic(JSON.stringify({ diagnosticOnly: true, records: 2001, chars: verwacht.length,
    minMs: metingen[0], medianMs: metingen[15], maxMs: metingen[29] }));
});

test('de bestaande retentiegrens blijft 100000 met dezelfde rootvervanging boven de grens', () => {
  const tracker = require('../server/db/mutatietracker');
  const bron = { facturen: Array.from({ length: 100000 }, (_, i) => ({ id: 'oud-' + i })), factuurTeller: 100000 };
  let vervangingen = 0;
  const bewaakt = tracker.bewaak(bron);
  const db = { data: new Proxy(bewaakt, { set(doel, k, v) {
    if (k === 'facturen') vervangingen++;
    return Reflect.set(doel, k, v);
  } }) };
  assert.equal(motor(db, () => {}).boek(invoer('NIEUW')).ok, true);
  assert.equal(db.data.facturen.length, 100000);
  assert.equal(db.data.facturen[0].ref, 'NIEUW');
  assert.equal(db.data.facturen[99999].id, 'oud-99998');
  assert.equal(vervangingen, 1, 'de begrotingspoort blijft de retentievervanging zien');
});
