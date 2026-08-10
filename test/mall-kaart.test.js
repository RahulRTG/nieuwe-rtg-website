/* De kaartlaag, het landfilter en de gedeelde waardering van de RTG Mall.

   Drie dingen die makkelijk mooi lijken en stiekem liegen, en waar deze toetsen
   daarom op mikken:
     1. een kaart die driekwart van de treffers weglaat zonder het te zeggen;
     2. een landfilter dat aanbod zonder land stilletjes meeneemt of weggooit;
     3. een cijfer dat de Mall zelf uitrekent naast het cijfer dat de reviews
        al hadden -- twee sommen die na een wijziging uit elkaar lopen.

   Elke toets is met een mutatie nagetrokken (LAT-regel 2); wat er is omgezet
   staat in het commit-bericht.
   Draai los: node --experimental-sqlite --test test/mall-kaart.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');
const { kaartVan, puntVan, MIN_SPAN } = require('../server/kern/mall/kaart');
const { filter } = require('../server/kern/mall/zoekfilters');
const { ratingVanZaak } = require('../server/kern/ervaring/rating');
const { bezorgtNu, magBezorgen } = require('../server/kern/leverancier/bezorgregel');

function api(base, pad, body, token) {
  const h = { 'Content-Type': 'application/json' };
  if (token) h.Authorization = 'Bearer ' + token;
  return fetch(base + pad, { method: 'POST', headers: h, body: JSON.stringify(body || {}) })
    .then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
}
// een aanbod-object zoals de normalisator het aflevert, kaal genoeg voor deze toetsen
const stuk = (id, lat, lng, extra) => Object.assign({
  id, titel: 'Aanbod ' + id, type: 'product', verdieping: 'winkelen',
  aanbieder: { soort: 'zaak', code: 'Z1', naam: 'Zaak' },
  plek: { stad: 'Ibiza', slug: 'ibiza', land: 'ES', punt: (lat == null ? null : { lat, lng }) },
  bereik: { soort: 'adres', km: 0 }, prijs: null, open: null, beschikbaar: null
}, extra || {});

let srv, base, lid;
test.before(async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-mallkaart-'));
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  base = srv.base;
  const reg = await api(base, '/api/auth/register', { name: 'Kaart Kijker', email: 'kaart@x.nl', phone: '0612345678',
    password: 'geheim123', geboortedatum: '1990-01-01', tier: 'rtg', pasApp: 'rtg' });
  lid = reg.body.token;
  assert.ok(lid, 'lid-registratie geeft een token');
});
test.after(() => stop(srv && srv.child));

/* ---------------------------------------------------------------------------
   1-5. De kaart als pure projectie.
   --------------------------------------------------------------------------- */

test('1. de kaart zet punten binnen het vlak en houdt de noord-zuidrichting aan', () => {
  const noord = stuk('n', 39.00, 1.40);
  const zuid = stuk('z', 38.80, 1.40);
  const k = kaartVan([noord, zuid], { lat: 38.90, lng: 1.40 });
  assert.equal(k.punten.length, 2);
  for (const p of k.punten) {
    assert.ok(p.x >= 0 && p.x <= 1, p.id + ' ligt binnen het vlak (x=' + p.x + ')');
    assert.ok(p.y >= 0 && p.y <= 1, p.id + ' ligt binnen het vlak (y=' + p.y + ')');
  }
  const pn = k.punten.find(p => p.id === 'n'), pz = k.punten.find(p => p.id === 'z');
  // op een scherm loopt y naar beneden: noordelijker hoort een KLEINERE y te geven
  assert.ok(pn.y < pz.y, 'het noordelijke punt staat boven het zuidelijke');
});

test('2. treffers zonder coordinaat worden geteld en benoemd, niet weggelaten', () => {
  const k = kaartVan([stuk('a', 38.9, 1.4), stuk('b', null), stuk('c', null)], null);
  assert.equal(k.punten.length, 1, 'alleen wat een coordinaat heeft komt op de kaart');
  assert.equal(k.zonderPunt, 2, 'de rest wordt geteld');
  assert.equal(k.totaal, 3);
  assert.ok(k.opmerking && /2 van de 3/.test(k.opmerking),
    'de kaart zegt zelf hoeveel er niet op staat, opmerking was: ' + k.opmerking);
});

test('3. een kaart zonder enkele coordinaat is leeg en zegt dat, in plaats van te doen alsof', () => {
  const k = kaartVan([stuk('a', null), stuk('b', null)], null);
  assert.deepEqual(k.punten, []);
  assert.equal(k.schaalKm, 0);
  assert.ok(/niets te plaatsen/i.test(k.opmerking), 'de reden staat erbij: ' + k.opmerking);
  assert.equal(k.geenStraatkaart, true, 'ook een lege kaart blijft zeggen dat het geen straatkaart is');
});

test('4. een enkel punt wordt niet oneindig uitvergroot', () => {
  const k = kaartVan([stuk('a', 38.9, 1.4)], { lat: 38.9, lng: 1.4 });
  assert.equal(k.punten.length, 1);
  assert.ok(k.schaalKm > 0, 'het vlak heeft een echte maat, geen nul');
  // MIN_SPAN is een halve zijde in graden; het vlak is dus minstens 2x zo groot
  assert.ok(k.schaalKm >= MIN_SPAN * 2 * 111, 'de ondergrens uit MIN_SPAN wordt aangehouden, schaal: ' + k.schaalKm);
  const p = k.punten[0];
  assert.ok(Math.abs(p.x - 0.5) < 0.01 && Math.abs(p.y - 0.5) < 0.01, 'het punt staat in het midden');
});

test('5. onzinnige coordinaten worden geweigerd in plaats van geplaatst', () => {
  assert.equal(puntVan(stuk('a', 0 / 0, 1.4)), null, 'NaN is geen coordinaat');
  assert.equal(puntVan(stuk('b', 200, 1.4)), null, 'een breedte van 200 graden bestaat niet');
  assert.equal(puntVan(stuk('c', 38.9, 400)), null, 'een lengte van 400 graden bestaat niet');
  assert.deepEqual(puntVan(stuk('d', 38.9, 1.4)), { lat: 38.9, lng: 1.4 }, 'een geldig paar komt er wel door');
});

/* ---------------------------------------------------------------------------
   6-8. De filters: elk filter zegt wat het wegnam.
   --------------------------------------------------------------------------- */

test('6. het landfilter houdt alleen het gevraagde land, en telt wat het wegnam', () => {
  const es = stuk('es', 38.9, 1.4);
  const nl = stuk('nl', 52.4, 4.9, { plek: { stad: 'Haarlem', slug: 'haarlem', land: 'NL', punt: { lat: 52.4, lng: 4.9 } } });
  const zonderLand = stuk('x', 40, 2, { plek: { stad: 'Ergens', slug: 'ergens', land: null, punt: { lat: 40, lng: 2 } } });
  const r = filter([es, nl, zonderLand], { land: 'ES' }, { bedient: () => true, gekozen: null });
  assert.deepEqual(r.res.map(a => a.id), ['es'], 'alleen Spanje blijft over');
  const regel = r.toegepast.find(t => t.filter === 'land');
  assert.ok(regel, 'het landfilter meldt zichzelf');
  assert.equal(regel.weggevallen, 2, 'en zegt hoeveel het wegnam, ook het aanbod zonder land');
});

test('7. een filter dat niets wegneemt meldt zich niet, en een lege optie filtert niet', () => {
  const lijst = [stuk('a', 38.9, 1.4), stuk('b', 38.8, 1.3)];
  const geen = filter(lijst, {}, { bedient: () => true, gekozen: null });
  assert.equal(geen.res.length, 2, 'zonder filters valt er niets weg');
  assert.deepEqual(geen.toegepast, [], 'en er wordt geen filter gemeld dat niet draaide');
  // een land dat niet als landcode te lezen is, mag niet stilletjes alles wegvangen
  const rommel = filter(lijst, { land: 'Spanje' }, { bedient: () => true, gekozen: null });
  assert.equal(rommel.res.length, 2, '"Spanje" is geen landcode en filtert dus niet');
});

test('8. het cijferfilter laat alleen beoordeeld aanbod door', () => {
  const goed = stuk('goed', 38.9, 1.4, { waardering: { score: 4.6, aantal: 12 } });
  const matig = stuk('matig', 38.9, 1.4, { waardering: { score: 3.1, aantal: 4 } });
  const geen = stuk('geen', 38.9, 1.4, { waardering: null });
  const r = filter([goed, matig, geen], { minCijfer: 4 }, { bedient: () => true, gekozen: null });
  assert.deepEqual(r.res.map(a => a.id), ['goed']);
  assert.equal(r.toegepast.find(t => t.filter === 'minCijfer').weggevallen, 2);
});

/* ---------------------------------------------------------------------------
   9-10. Een waarheid, niet twee: het cijfer en de bezorgschakelaar.
   --------------------------------------------------------------------------- */

test('9. het cijfer in de Mall komt uit dezelfde som als de reviews zelf', () => {
  const db = { data: { reviewStats: { Z1: { som: 23, aantal: 5 } } } };
  assert.deepEqual(ratingVanZaak(db, 'Z1'), { score: 4.6, aantal: 5 });
  assert.equal(ratingVanZaak(db, 'Z2'), null, 'een zaak zonder reviews krijgt geen cijfer, ook geen nul');
  db.data.reviewStats.Z1.som = 25;
  assert.equal(ratingVanZaak(db, 'Z1').score, 5, 'wijzigt de som, dan wijzigt het cijfer -- er is geen tweede kopie');
});

test('10. bezorgen vraagt om mogen EN aanstaan, en beide antwoorden komen uit een plek', () => {
  const db = { capsVan: (s) => (s.type === 'restaurant' ? ['orders'] : []) };
  const horeca = { type: 'restaurant', bezorg: { aan: true, bezorgen: true } };
  assert.equal(magBezorgen(db, horeca), true);
  assert.equal(bezorgtNu(db, horeca), true);
  assert.equal(bezorgtNu(db, { type: 'restaurant', bezorg: { aan: false, bezorgen: true } }), false,
    'de schakelaar uit betekent niet bezorgen, ook al mag de zaak het');
  assert.equal(bezorgtNu(db, { type: 'restaurant', bezorg: { aan: true, bezorgen: false } }), false,
    'alleen laten ophalen is geen bezorgen');
  assert.equal(bezorgtNu(db, { type: 'kapper', bezorg: { aan: true, bezorgen: true } }), false,
    'een zaak die geen bezorgdienst mag voeren, bezorgt niet omdat zij het aanvinkt');
});

/* ---------------------------------------------------------------------------
   11-13. Door de echte zoekroute heen.
   --------------------------------------------------------------------------- */

test('11. de zoekroute levert een kaart op verzoek, over ALLE treffers en niet over de pagina', async () => {
  const zonder = await api(base, '/api/mall/zoek', { per: 5 }, lid);
  assert.equal(zonder.body.kaart, null, 'zonder verzoek geen kaart, want hij kost werk');

  const met = await api(base, '/api/mall/zoek', { per: 5, kaart: true }, lid);
  assert.equal(met.status, 200);
  assert.ok(met.body.kaart, 'met kaart:true komt er een kaart');
  assert.equal(met.body.kaart.totaal, met.body.totaal,
    'de kaart gaat over alle ' + met.body.totaal + ' treffers, niet over de ' + met.body.items.length + ' op deze pagina');
  assert.equal(met.body.kaart.geenStraatkaart, true);
  assert.equal(met.body.kaart.punten.length + met.body.kaart.zonderPunt, met.body.totaal,
    'elke treffer staat op de kaart of wordt geteld als "zonder coordinaat"; er verdwijnt er geen');
});

test('12. de zoekroute noemt de landen waarin de treffers liggen', async () => {
  const r = await api(base, '/api/mall/zoek', { per: 60 }, lid);
  assert.ok(Array.isArray(r.body.landen), 'er komt een landenlijst mee');
  assert.ok(r.body.landen.length >= 1, 'en die is niet leeg, gevonden: ' + JSON.stringify(r.body.landen));
  for (const l of r.body.landen) {
    assert.ok(/^[A-Z]{2}$/.test(l.land), l.land + ' is een landcode van twee letters');
    assert.ok(l.aantal > 0, l.land + ' heeft een echt aantal');
  }
  // en op zo'n land filteren levert precies dat aantal op
  const eerste = r.body.landen[0];
  const enkel = await api(base, '/api/mall/zoek', { per: 60, land: eerste.land }, lid);
  assert.equal(enkel.body.totaal, eerste.aantal,
    'filteren op ' + eerste.land + ' geeft dezelfde ' + eerste.aantal + ' treffers die de landenlijst beloofde');
});

test('13. een filter dat alles wegvangt legt zichzelf uit in plaats van een lege Mall te tonen', async () => {
  const r = await api(base, '/api/mall/zoek', { per: 60, land: 'ZZ' }, lid);
  assert.equal(r.status, 200);
  assert.equal(r.body.totaal, 0, 'land ZZ bestaat niet, dus geen treffers');
  assert.ok(r.body.totaalVoorFilter > 0, 'maar er was wel degelijk aanbod voor het filter');
  const regel = (r.body.filters || []).find(f => f.filter === 'land');
  assert.ok(regel, 'het antwoord zegt WELK filter alles wegnam, filters: ' + JSON.stringify(r.body.filters));
  assert.equal(regel.weggevallen, r.body.totaalVoorFilter, 'en hoeveel het er wegnam');
});
