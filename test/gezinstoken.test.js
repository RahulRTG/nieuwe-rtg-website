/* Het gezinsprofieltoken (foundation.family_profile_token_buiten_harde_poort,
   B17), control voor control: 128 bits en eenmaal kaal, hash-only, issuer/doel/
   scope/onderwerp zonder persoonsgegevens, vervaltijd, het plafond per profiel,
   intrekken, roteren en de epoch, constant-time zoeken, en de oude kale tokens
   die niets meer openen. De atomaire claim van een uitnodiging staat hier ook
   (op de lokale collectietransactie); de race over twee PostgreSQL-instances
   staat in test/gezinsuitnodiging.pg.test.js en de routes op een echte server in
   test/gezinssessie.test.js.

   Draai los: node --test test/gezinstoken.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const T = require('../server/foundation/gezinstoken');

const T0 = Date.parse('2026-09-29T12:00:00.000Z');
function wereld(munt = crypto) {
  let klok = T0;
  const z = T.maak({ crypto: munt, nu: () => new Date(klok).toISOString() });
  const g = { code: 'ABC234', profielen: {
    b: { id: 'b', rol: 'beheerder', naam: 'Mama', geboren: '1990-01-01', groep: 'volw' },
    k: { id: 'k', rol: 'kind', naam: 'Tim', geboren: '2018-05-05', groep: 'kind' } } };
  return { z, g, schuif: ms => { klok += ms; } };
}

test('1. 128 bits, eenmaal kaal, en op het profiel alleen een hash', () => {
  const { z, g } = wereld();
  const t = z.geef(g, g.profielen.b);
  assert.match(t, /^GZ\.[0-9A-F]{32}$/);
  assert.equal(JSON.stringify(g).includes(t.slice(3)), false, 'het geheim staat nergens');
  assert.match(g.profielen.b.sessies[0].code_hash, /^[a-f0-9]{64}$/);
  const t2 = z.geef(g, g.profielen.b);
  assert.notEqual(t2, t, 'een tweede uitgifte is een nieuwe sessie, nooit de oude');
  assert.equal(z.vind(g, t).id, 'b');
  assert.equal(z.vind(g, t2).id, 'b');
  assert.equal(z.vind(g, t.toLowerCase()).id, 'b', 'hoofdletters zijn geen tweede sleutel');
});

test('2. issuer, doel, scope en een onderwerp zonder persoonsgegevens', () => {
  const { z, g } = wereld();
  z.geef(g, g.profielen.k);
  const s = g.profielen.k.sessies[0];
  assert.equal(s.issuer, 'rtg.foundation');
  assert.equal(s.doel, 'gezinsprofiel-sessie');
  assert.deepEqual(s.scope, ['foundation.gezin']);
  assert.deepEqual(s.onderwerp, { gezin: 'ABC234', profiel: 'k', rol: 'lid', epoch: 0 },
    'een kind is geen profiel: geen naam, geen geboortedatum, geen groep in het token');
  assert.equal(s.max_gebruik, 0, 'een sessie telt geen gebruik');
  z.geef(g, g.profielen.b);
  assert.equal(g.profielen.b.sessies[0].onderwerp.rol, 'beheerder');
});

test('3. het onderwerp bindt: ander gezin, ander profiel, andere rol, andere scope', () => {
  const { z, g } = wereld();
  const t = z.geef(g, g.profielen.k);
  assert.equal(z.vind({ code: 'ANDER1', profielen: g.profielen }, t), null, 'een ander gezin kent hem niet');
  g.profielen.b.sessies = g.profielen.k.sessies; g.profielen.k.sessies = [];
  assert.equal(z.vind(g, t), null, 'op de beheerder geplakt opent hij niets');
  g.profielen.k.sessies = g.profielen.b.sessies; g.profielen.b.sessies = [];
  assert.equal(z.vind(g, t).id, 'k');
  g.profielen.k2 = { id: 'k2', rol: 'kind', sessies: g.profielen.k.sessies }; g.profielen.k.sessies = [];
  assert.equal(z.vind(g, t), null, 'op een ander kind met dezelfde rol geplakt opent hij ook niets');
  g.profielen.k.sessies = g.profielen.k2.sessies; delete g.profielen.k2;
  g.profielen.k.rol = 'beheerder';
  assert.equal(z.vind(g, t), null, 'een kind dat beheerder wordt, houdt zijn oude sessie niet');
  g.profielen.k.rol = 'kind';
  g.profielen.k.sessies[0].scope = ['foundation.alles'];
  assert.equal(z.vind(g, t), null, 'een omgezette scope opent niets');
});

test('4. vervaltijd: zeven dagen (B19), het kanaal twaalf uur, en nooit langer', () => {
  const { z, g, schuif } = wereld();
  const t = z.geef(g, g.profielen.b);
  const s = g.profielen.b.sessies[0];
  assert.equal(s.issued_at, new Date(T0).toISOString());
  assert.equal(T.GELDIG_MS, 7 * 86400000);
  assert.equal(Date.parse(s.expires_at) - T0, 7 * 86400000);
  const kanaal = z.geef(g, g.profielen.k, { geldigMs: T.KANAAL_MS });
  const lang = z.geef(g, g.profielen.k, { geldigMs: 365 * 86400000 });
  assert.equal(Date.parse(g.profielen.k.sessies.at(-1).expires_at) - T0, 7 * 86400000, 'een verzoek om een jaar wordt zeven dagen');
  schuif(12 * 3600000 + 1);
  assert.equal(z.vind(g, kanaal), null, 'de kanaalsessie is na twaalf uur weg');
  assert.equal(z.vind(g, t).id, 'b');
  schuif(7 * 86400000);
  assert.equal(z.vind(g, t), null, 'na zeven dagen opent hij niets meer');
  assert.equal(z.vind(g, lang), null);
});

test('4b. B19: een sessie van voor het besluit (dertig dagen op schijf) houdt na zeven dagen op', () => {
  const { z, g, schuif } = wereld();
  const t = z.geef(g, g.profielen.b);
  const s = g.profielen.b.sessies[0];
  s.expires_at = new Date(T0 + 30 * 86400000).toISOString();   // zoals B17 hem schreef
  schuif(6 * 86400000);
  assert.equal(z.vind(g, t).id, 'b');
  schuif(86400000);
  assert.equal(z.vind(g, t), null, 'zeven dagen na uitgifte, ongeacht wat er op schijf staat');
});

test('4c. B19: roteren verlengt niet, verlengen geeft zeven dagen, een gast verlengt nooit', () => {
  const { z, g, schuif } = wereld();
  const a = z.geef(g, g.profielen.b);
  schuif(5 * 86400000);
  const b = z.roteer(g, a);
  const sb = g.profielen.b.sessies.at(-1);
  assert.equal(Date.parse(sb.expires_at), T0 + 7 * 86400000, 'de geroteerde sessie houdt het einde van de oude');
  const c = z.roteer(g, b, { verleng: true });
  assert.equal(Date.parse(g.profielen.b.sessies.at(-1).expires_at), T0 + 12 * 86400000, 'verlengen: zeven dagen vanaf nu');
  assert.equal(z.vind(g, b), null, 'de verlengde vervangt de oude');
  schuif(7 * 86400000 + 1);
  assert.equal(z.vind(g, c), null, 'en ook die houdt na zeven dagen op');
  assert.equal(z.roteer(g, c, { verleng: true }), null, 'een verlopen sessie verlengt niet');
  g.profielen.o = { id: 'o', rol: 'gast', naam: 'Oma' };
  const k = z.geef(g, g.profielen.o, { geldigMs: T.KANAAL_MS });
  assert.equal(z.roteer(g, k, { verleng: true }), null, 'het kanaal van een gast blijft twaalf uur');
  assert.equal(z.vind(g, k).id, 'o', 'en de weigering laat zijn sessie staan');
});

test('5. intrekken, roteren en de epoch', () => {
  const { z, g } = wereld();
  const a = z.geef(g, g.profielen.k), b = z.geef(g, g.profielen.k);
  assert.equal(z.intrek(g, a), true);
  assert.equal(z.vind(g, a), null, 'afgemeld');
  assert.equal(z.vind(g, b).id, 'k', 'de andere sessie van hetzelfde kind blijft');
  assert.equal(z.intrek(g, a), false, 'een tweede keer vindt hem niet meer');
  const c = z.roteer(g, b);
  assert.match(c, /^GZ\./);
  assert.equal(z.vind(g, b), null, 'na roteren is de oude weg');
  assert.equal(z.vind(g, c).id, 'k');
  assert.equal(z.roteer(g, b), null, 'een geroteerde sessie roteert niet nog eens');
  const d = z.geef(g, g.profielen.k);
  const oud = g.profielen.k.sessies.slice();
  z.sluit(g.profielen.k);
  g.profielen.k.sessies = oud;   // een achterlopende kopie die de lijst nog had
  assert.equal(z.vind(g, d), null, 'de epoch sluit, ook als een oude rij terugkomt');
  g.profielen.k.sessies = [];
  assert.equal(g.profielen.k.sessieEpoch, 1);
  assert.equal(z.vind(g, c), null, 'sluiten neemt elke sessie mee');
  assert.equal(z.vind(g, d), null);
  const e = z.geef(g, g.profielen.k);
  assert.equal(z.vind(g, e).id, 'k', 'na sluiten opent alleen een NIEUWE sessie');
});

test('6. het plafond per profiel: acht apparaten, de oudste valt weg', () => {
  const { z, g } = wereld();
  const rij = [];
  for (let i = 0; i < T.MAX_SESSIES + 2; i++) rij.push(z.geef(g, g.profielen.b));
  assert.equal(g.profielen.b.sessies.length, T.MAX_SESSIES);
  assert.equal(z.vind(g, rij[0]), null);
  assert.equal(z.vind(g, rij[1]), null);
  assert.equal(z.vind(g, rij.at(-1)).id, 'b');
});

test('7. constant-time: elke sessie van het gezin wordt vergeleken, ook na een treffer', () => {
  let n = 0;
  const munt = Object.assign(Object.create(crypto), { timingSafeEqual: (a, b) => { n++; return crypto.timingSafeEqual(a, b); } });
  const { z, g } = wereld(munt);
  const eerste = z.geef(g, g.profielen.b);
  z.geef(g, g.profielen.b); z.geef(g, g.profielen.k); z.geef(g, g.profielen.k);
  n = 0; z.vind(g, eerste);
  assert.equal(n, 4, 'vier sessies, vier vergelijkingen, ook al staat de treffer vooraan');
  n = 0; z.vind(g, 'GZ.' + '0'.repeat(32));
  assert.equal(n, 4);
});

test('8. een oud kaal token opent niets, en ruimOud haalt het van schijf', () => {
  const { z, g } = wereld();
  const oud = crypto.randomBytes(24).toString('hex');
  g.profielen.b.token = oud;
  assert.equal(z.vind(g, oud), null, 'het oude token (48 hex, raw bewaard) opent niets');
  assert.equal(z.ruimOud({ [g.code]: g }), 1);
  assert.equal('token' in g.profielen.b, false);
  z.geef(g, g.profielen.k);
  assert.equal(JSON.stringify(g).includes(oud), false);
});

test('9. de claim van een uitnodiging: eenmalig, gebonden en hash-only', async () => {
  const { z } = wereld();
  const db = { foundation: { gezinnen: { ABC234: { code: 'ABC234', profielen: {}, uitnodigingen: [] } } } };
  const bewerkCollectie = (sleutel, werk) => { // de lokale vorm van db.bewerkCollectie: werk op een kopie
    const kopie = JSON.parse(JSON.stringify(db[sleutel] || {}));
    const uit = werk(kopie); db[sleutel] = kopie; return uit;
  };
  const C = require('../server/foundation/gezinsclaim').maak({ bewerkCollectie, crypto, tokens: z,
    nu: () => new Date(T0).toISOString(), rid: n => crypto.randomBytes(n).toString('hex'),
    ensureCodenaam: p => (p.codenaam = p.codenaam || 'Gouden Vos 0001') });
  const geheim = crypto.randomBytes(24).toString('base64url');
  const zet = (rol, verloopt) => db.foundation.gezinnen.ABC234.uitnodigingen.push({ id: 'u' + rol, naam: 'Opa', rol,
    status: 'open', sleutelHash: C.hash(geheim), verlooptAt: new Date(T0 + (verloopt || 3600000)).toISOString() });
  zet('ouder');
  const een = await C.claim({ code: 'ABC234', geheim, metSessie: true, profiel: { pin: { salt: 's', hash: 'h' } } });
  assert.equal(een.ok, true);
  assert.match(een.token, /^GZ\./);
  const twee = await C.claim({ code: 'ABC234', geheim, metSessie: true, profiel: {} });
  assert.equal(twee.status, 404, 'dezelfde sleutel levert geen tweede profiel');
  const g = db.foundation.gezinnen.ABC234;
  assert.equal(Object.keys(g.profielen).length, 1);
  assert.equal(g.uitnodigingen[0].status, 'geaccepteerd');
  assert.equal('sleutelHash' in g.uitnodigingen[0], false, 'de sleutel verdwijnt na gebruik');
  assert.equal(JSON.stringify(db).includes(een.token.slice(3)), false, 'de sessie staat alleen als hash');
  assert.equal(z.vind(g, een.token).rol, 'ouder', 'naam en rol komen uit de uitnodiging');
  // een gast kan niet via de FOUNDATION-weg, en een verlopen sleutel opent niets
  const g2 = crypto.randomBytes(24).toString('base64url');
  const G = () => db.foundation.gezinnen.ABC234; // de collectietransactie vervangt het object
  G().uitnodigingen.push({ id: 'ug', naam: 'Oppas', rol: 'ouder', status: 'open', sleutelHash: C.hash(g2), verlooptAt: new Date(T0 + 1000).toISOString() });
  assert.equal((await C.claim({ code: 'ABC234', geheim: g2, alleenGast: true })).status, 409);
  G().uitnodigingen.at(-1).verlooptAt = new Date(T0 - 1).toISOString();
  assert.equal((await C.claim({ code: 'ABC234', geheim: g2 })).status, 404, 'verlopen');
  assert.equal((await C.claim({ code: 'ANDER1', geheim: g2 })).status, 404, 'een ander gezin');
  const g3 = crypto.randomBytes(24).toString('base64url');
  G().uitnodigingen.push({ id: 'ui', naam: 'X', rol: 'ouder', status: 'ingetrokken', sleutelHash: C.hash(g3), verlooptAt: new Date(T0 + 3600000).toISOString() });
  assert.equal((await C.claim({ code: 'ABC234', geheim: g3 })).status, 404, 'een ingetrokken uitnodiging opent niets, ook met een achtergebleven hash');
});
