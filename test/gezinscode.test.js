/* De gezinscode en het stroomticket (B18, CODECREDENTIALS.json
   foundation.family_profile_access), control voor control: 128 bits en eenmaal
   kaal, hash-only in een EIGEN collectie, issuer/doel/scope/onderwerp zonder
   persoonsgegevens, vervaltijd en gebruiksteller, roteren en intrekken,
   constant-time zoeken over alle gezinnen, een gewist adres dat bij een nieuw
   gezin niets opent, en het eenmalige ticket per kanaal dat met de sessie
   ophoudt. De routes op een echte server staan in test/gezinsdeur.test.js, de
   race over twee PostgreSQL-instances in test/gezinsdeur.pg.test.js.

   Draai los: node --test test/gezinscode.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const C = require('../server/foundation/gezinscode');
const S = require('../server/foundation/gezinsstroom');
const T = require('../server/foundation/gezinstoken');

const T0 = Date.parse('2026-10-04T12:00:00.000Z');
/* Een db met de semantiek van server/db/collectie-bewerken.js: de bewerker krijgt
   een KOPIE en die wordt pas na afloop de collectie. */
function wereld(munt = crypto) {
  let klok = T0;
  const nu = () => new Date(klok).toISOString();
  const db = { data: { foundation: { gezinnen: {
    ABC234: { id: 'g1', code: 'ABC234', profielen: { b: { id: 'b', rol: 'beheerder' }, k: { id: 'k', rol: 'kind' },
      o: { id: 'o', rol: 'gast' } } },
    XYZ789: { id: 'g2', code: 'XYZ789', profielen: { b: { id: 'b', rol: 'beheerder' } } } } } } };
  const bewerkCollectie = (sleutel, werk) => {
    const kopie = JSON.parse(JSON.stringify(db.data[sleutel] == null ? {} : db.data[sleutel]));
    const uit = werk(kopie); db.data[sleutel] = kopie; return uit;
  };
  const G = () => db.data.foundation.gezinnen;
  const tokens = T.maak({ crypto: munt, nu });
  const code = C.maak({ db, crypto: munt, bewerkCollectie, G, nu });
  const stroom = S.maak({ db, crypto: munt, bewerkCollectie, gezinstoken: tokens, G, nu, rtfHandle: (c, p) => 'rtf:' + c + ':' + p });
  return { db, G, code, stroom, tokens, nu, schuif: ms => { klok += ms; } };
}

test('1. 128 bits, eenmaal kaal, en alleen als hash in de eigen collectie', async () => {
  const w = wereld();
  const raw = await w.code.geef(w.G().ABC234, 'b');
  assert.match(raw, /^GC\.[0-9A-F]{32}$/);
  assert.equal(JSON.stringify(w.db.data).includes(raw.slice(3)), false, 'het geheim staat nergens');
  const t = w.db.data[C.COLLECTIE].ABC234;
  assert.match(t.code_hash, /^[a-f0-9]{64}$/);
  assert.equal(w.db.data.foundation.gezinnen.ABC234.toegang, undefined, 'niet op het gezin: een eigen collectie');
  assert.deepEqual([t.issuer, t.doel, t.scope], ['rtg.foundation', 'gezin-inloggen', ['foundation.gezin.inloggen']]);
  assert.deepEqual(t.onderwerp, { gezin: 'ABC234', id: 'g1' }, 'geen naam, geen profiel, geen kind in de code');
  assert.equal(t.max_gebruik, C.MAX_GEBRUIK);
  assert.equal(Date.parse(t.expires_at) - T0, require('../server/kern/bearercode').MAX_GELDIG_MS);
  assert.equal(w.code.vind(raw), 'ABC234');
  assert.equal(w.code.vind(raw.slice(3).toLowerCase()), 'ABC234', 'overgetypt zonder voorvoegsel');
  assert.equal(w.code.vind(raw.replace(/(.{8})/g, '$1 ')), 'ABC234', 'met spaties ertussen');
  for (const fout of ['ABC234', 'GC.' + '0'.repeat(32), raw.slice(0, -1), '', null])
    assert.equal(w.code.vind(fout), null, String(fout) + ' opent niets');
});

test('2. roteren vervangt, intrekken sluit, en een tweede gezin heeft een eigen code', async () => {
  const w = wereld();
  const a = await w.code.geef(w.G().ABC234, 'b');
  const x = await w.code.geef(w.G().XYZ789, 'b');
  assert.equal(w.code.vind(x), 'XYZ789');
  const b = await w.code.geef(w.G().ABC234, 'b');
  assert.equal(w.code.vind(a), null, 'de vorige opent niets meer');
  assert.equal(w.code.vind(b), 'ABC234');
  assert.equal(w.code.publiek('ABC234').rotatie, 2);
  assert.equal(await w.code.intrek('ABC234', 'profiel:b'), true);
  assert.equal(w.code.vind(b), null);
  assert.equal(w.code.publiek('ABC234').stand, 'ongeldig');
  assert.equal(w.code.vind(x), 'XYZ789', 'het andere gezin merkt er niets van');
  assert.equal(JSON.stringify(w.code.publiek('XYZ789')).includes('hash'), false, 'de stand toont geen hash');
  assert.equal(w.code.publiek('GEEN00').stand, 'geen');
});

test('3. verval, de gebruiksteller en de claim', async () => {
  const w = wereld();
  const a = await w.code.geef(w.G().ABC234, 'b');
  assert.equal(await w.code.claim(a, 'ABC234'), true);
  assert.equal(w.db.data[C.COLLECTIE].ABC234.gebruik, 1, 'een geslaagde inlog telt');
  assert.equal(await w.code.claim(a, 'XYZ789'), false, 'een claim voor een ander gezin faalt');
  w.db.data[C.COLLECTIE].ABC234.gebruik = C.MAX_GEBRUIK;
  assert.equal(w.code.vind(a), null, 'opgebruikt');
  assert.equal(await w.code.claim(a, 'ABC234'), false);
  w.db.data[C.COLLECTIE].ABC234.gebruik = 0;
  w.schuif(require('../server/kern/bearercode').MAX_GELDIG_MS);
  assert.equal(w.code.vind(a), null, 'na 366 dagen opent hij niets meer');
});

test('4. een gewist adres dat terugkomt bij een nieuw gezin, opent dat gezin niet', async () => {
  const w = wereld();
  const a = await w.code.geef(w.G().ABC234, 'b');
  delete w.G().ABC234;
  assert.equal(w.code.vind(a), null, 'een gewist gezin opent niets');
  w.G().ABC234 = { id: 'nieuw', code: 'ABC234', profielen: {} };
  assert.equal(w.code.vind(a), null, 'hetzelfde adres, een ander gezin: de oude code opent het niet');
  assert.equal(await w.code.vergeet('ABC234'), true);
  assert.equal(w.db.data[C.COLLECTIE].ABC234, undefined);
});

test('5. constant-time: elke gezinscode wordt vergeleken, ook na een treffer en bij een foute vorm', async () => {
  let n = 0;
  const munt = Object.assign(Object.create(crypto), { timingSafeEqual: (a, b) => { n++; return crypto.timingSafeEqual(a, b); } });
  const w = wereld(munt);
  const a = await w.code.geef(w.G().ABC234, 'b');
  await w.code.geef(w.G().XYZ789, 'b');
  n = 0; w.code.vind(a);
  assert.equal(n, 2, 'twee gezinnen, twee vergelijkingen');
  n = 0; w.code.vind('ABC234');
  assert.equal(n, 2, 'ook een oude zes-tekencode loopt alle rijen langs');
});

test('6. het stroomticket: eenmalig, per kanaal, een minuut, en het houdt op met de sessie', async () => {
  const w = wereld();
  const g = w.G().ABC234;
  const sess = w.tokens.geef(g, g.profielen.b);
  const t = await w.stroom.geef(g, sess, 'sociaal');
  assert.match(t.ticket, /^GS\.[0-9A-F]{32}$/);
  assert.equal(JSON.stringify(w.db.data).includes(t.ticket.slice(3)), false, 'alleen de hash');
  const open = await w.stroom.open('ABC234', t.ticket, 'sociaal');
  assert.equal(open.ok, true);
  assert.equal(open.handle, 'rtf:ABC234:b');
  assert.equal(open.leeft(), true);
  assert.equal((await w.stroom.open('ABC234', t.ticket, 'sociaal')).status, 401, 'eenmalig');
  const t2 = await w.stroom.geef(g, sess, 'gezin');
  assert.equal((await w.stroom.open('ABC234', t2.ticket, 'sociaal')).status, 401, 'een ander kanaal');
  assert.equal((await w.stroom.open('ABC234', t2.ticket, 'gezin')).status, 401, 'en daarna is hij op');
  const t3 = await w.stroom.geef(g, sess, 'gezin');
  assert.equal((await w.stroom.open('XYZ789', t3.ticket, 'gezin')).status, 401, 'een ander gezin');
  const t4 = await w.stroom.geef(g, sess, 'gezin');
  w.schuif(S.GELDIG_MS + 1);
  assert.equal((await w.stroom.open('ABC234', t4.ticket, 'gezin')).status, 401, 'na een minuut niets meer');
  const t5 = await w.stroom.geef(g, sess, 'gezin');
  const o5 = await w.stroom.open('ABC234', t5.ticket, 'gezin');
  assert.equal(o5.leeft(), true);
  w.tokens.intrek(w.G().ABC234, sess);
  assert.equal(o5.leeft(), false, 'een open stroom ziet dat zijn sessie is afgemeld');
  const t6 = await w.stroom.geef(w.G().ABC234, sess, 'gezin');
  assert.equal(t6, null, 'een afgemelde sessie krijgt geen ticket');
  assert.equal(await w.stroom.geef(g, 'GZ.' + '0'.repeat(32), 'gezin'), null);
  const gast = w.tokens.geef(w.G().ABC234, w.G().ABC234.profielen.o, { geldigMs: T.KANAAL_MS });
  assert.equal(await w.stroom.geef(w.G().ABC234, gast, 'sociaal'), null, 'een gast heeft geen sociale stroom');
  assert.ok(await w.stroom.geef(w.G().ABC234, gast, 'gezin'), 'wel het gezinskanaal');
});

test('7. een ticket opent niets meer als de sessie tussen uitgifte en inwisselen ophoudt', async () => {
  const w = wereld();
  const g = w.G().ABC234;
  const sess = w.tokens.geef(g, g.profielen.k);
  const t = await w.stroom.geef(g, sess, 'gezin');
  w.tokens.sluit(g.profielen.k);
  assert.equal((await w.stroom.open('ABC234', t.ticket, 'gezin')).status, 401);
  assert.equal(w.db.data[S.COLLECTIE].ABC234, undefined, 'het ticket is ook dan opgebruikt en weg');
});
