/* DRIE DRAGERS NAAR BEARERCODE V2 (UITVOERINGSPLAN par. 7.1).

   - de gezinssessie en de doossleutel waren een v1-record waarvan `max_gebruik`
     na uitgifte op 0 werd gezet (Z6). Ze zijn nu `gebruik: 'sessie'`;
   - de Arrival Pass kreeg zijn einde door `expires_at` na uitgifte te
     overschrijven (A3). Hij draagt nu `geldigheid: { verlooptOp }`. Een aankomst
     die al voorbij is, krijgt geen pass meer: v1 gaf er een die bij uitgifte
     al verlopen was, met status 200. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

const T0 = Date.parse('2026-09-27T12:00:00.000Z');

function arrival() {
  let klok = T0;
  const db = { data: {}, writable: true };
  const bewerkCollectie = require('../server/db/collectie-bewerken')({ store: 'json', db, save() {} });
  const kern = require('../server/kern/arrivalpas')({ db, bewerkCollectie, crypto, nu: () => new Date(klok).toISOString() });
  return { db, kern };
}

test('Arrival Pass: v2-record met een vast einde, zonder overschrijving na uitgifte', () => {
  const { db, kern } = arrival();
  const a = kern.aanvraag({ requestToken: 'aanvraag0001abcdefghijklmnopqrstuvwx', supplierCode: 'ZAAK',
    reserveringId: 'R1', datum: '2026-09-28', tijd: '20:00' });
  const rij = db.data.arrivalToegang[a.id];
  assert.equal(rij.toegang.contractversie, 2, 'de pass is geen v2-record');
  assert.equal(rij.toegang.expires_at, new Date(Date.parse(rij.tot)).toISOString(), 'het einde is niet het einde van de aankomst');
  assert.equal(rij.toegang.gebruiksvorm, 'teller');
  assert.equal(rij.toegang.max_gebruik, 60);
});

test('Arrival Pass: een aankomst die al voorbij is, krijgt geen pass', () => {
  const { db, kern } = arrival();
  const r = kern.aanvraag({ requestToken: 'aanvraag0002abcdefghijklmnopqrstuvwx', supplierCode: 'ZAAK',
    reserveringId: 'R2', datum: '2026-09-20', tijd: '20:00' });
  assert.equal(r.status, 400, JSON.stringify(r));
  assert.equal(r.code, undefined, 'er kwam toch een code mee');
  assert.equal(Object.keys(db.data.arrivalToegang || {}).length, 0, 'er bleef een record achter');
});

test('Gezinssessie: een sessie telt niet af en wordt niet na uitgifte herschreven', () => {
  const g = require('../server/foundation/gezinstoken').maak({ crypto });
  const profiel = { id: 'P1', rol: 'lid' }, gezin = { code: 'GZTEST', profielen: { P1: profiel } };
  const code = g.geef(gezin, profiel);
  const t = profiel.sessies[0];
  assert.equal(t.contractversie, 2);
  assert.equal(t.gebruiksvorm, 'sessie');
  for (let i = 0; i < 5; i++) assert.ok(g.zoek(gezin, code), 'de sessie werkt niet meer na ' + i + ' keer');
  t.expires_at = new Date(Date.parse(t.expires_at) + 365 * 86400000).toISOString();
  assert.equal(g.zoek(gezin, code), null, 'een met de hand verlengde sessie opende nog');
});

test('Doossleutel: v2-sessie, en een met de hand verlengde sleutel opent niets', async () => {
  const db = { data: {}, writable: true };
  const bewerkCollectie = require('../server/db/collectie-bewerken')({ store: 'json', db, save() {} });
  const s = require('../server/kern/zaakdoos/sleutels').maakDoosSleutels({ db, save() {}, crypto, bewerkCollectie });
  const r = await s.geef({ doos: 'DOOS-1', zaak: 'ZAAK', scope: [require('../server/kern/zaakdoos/sleutels').FAMILIES[0]], door: 'eigenaar' });
  assert.ok(r.ok, JSON.stringify(r));
  const rij = (db.data.doosSleutels || {})[r.doos];
  assert.ok(rij && rij.toegang, 'het record van de doos is niet te vinden');
  assert.equal(rij.toegang.contractversie, 2);
  assert.equal(rij.toegang.gebruiksvorm, 'sessie');
  const fam = require('../server/kern/zaakdoos/sleutels').FAMILIES[0];
  const vers = s.welke('DOOS-1', r.sleutel, fam);
  assert.ok(vers && !vers.fout, 'de verse sleutel opent niets: ' + JSON.stringify(vers));
  rij.toegang.expires_at = new Date(Date.parse(rij.toegang.expires_at) + 365 * 86400000).toISOString();
  const na = s.welke('DOOS-1', r.sleutel, fam);
  assert.ok(!na || na.fout === 'gemanipuleerd', 'een met de hand verlengde sleutel opende nog: ' + JSON.stringify(na));
});
