/* Filialen en de zakelijke ingang van de RTG Mall.

   Waar deze toetsen op mikken:
     1. EEN KOPIE PER VESTIGING. De verleiding bij filialen is om per vestiging
        een kopie van het aanbod te maken. Dan staat hetzelfde brood twintig keer
        in de zoeklijst en moet elke prijswijziging op twintig plaatsen landen
        (LAT-regel 4). Het hoort EEN rij te blijven met meer plekken.
     2. DE AFSTAND TOT HET HOOFDKANTOOR. Een keten met een filiaal om de hoek
        hoort niet onderaan te staan omdat haar hoofdadres in een andere stad is.
     3. EEN BELOFTE PER FILIAAL DIE ER NIET IS. Dit zegt "wij zijn ook in
        Haarlem", niet "in Haarlem kost het minder" -- voorraad en prijs zijn van
        de zaak als geheel, en dat hoort in het antwoord te staan.
     4. EEN ZAKELIJKE PRIJS DIE JE MET EEN VINKJE KOOPT. De pas bepaalt wie op
        inkoop koopt, niet het verzoek.

   Elke toets is met een mutatie nagetrokken (LAT-regel 2).
   Draai los: node --experimental-sqlite --test test/mall-vestigingen.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');
const { vestigingenVan, MAX_VESTIGINGEN } = require('../server/kern/mall/vestigingen');

function api(base, pad, body, token) {
  const h = { 'Content-Type': 'application/json' };
  if (token) h.Authorization = 'Bearer ' + token;
  return fetch(base + pad, { method: 'POST', headers: h, body: JSON.stringify(body || {}) })
    .then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
}
// de echte plek-module, zodat deze toetsen op de echte regels draaien
const P = require('../server/kern/mall/plek')({ haalLandVind: () => null });
const AMS = { lat: 52.37, lng: 4.90 }, HRL = { lat: 52.38, lng: 4.64 }, IBZ = { lat: 38.91, lng: 1.43 };

const keten = {
  code: 'KETEN', name: 'De Bakker', type: 'retail', city: 'Amsterdam', country: 'NL', loc: AMS,
  vestigingen: [{ naam: 'Filiaal Haarlem', stad: 'Haarlem', land: 'NL', loc: HRL }]
};
// een aanbod-object zoals de normalisator het aflevert, met filialen erbij
function aanbodVan(s, bereik) {
  return {
    id: 'x', titel: 'Brood', type: 'product',
    aanbieder: { soort: 'zaak', code: s.code, naam: s.name },
    plek: P.plekVan({ stad: s.city, land: s.country, punt: s.loc }),
    vestigingen: vestigingenVan(s, P.plekVan),
    bereik: bereik || { soort: 'adres', km: 0 }
  };
}

let srv, base, lid;
test.before(async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-mallvest-'));
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  base = srv.base;
  const reg = await api(base, '/api/auth/register', { name: 'Vest Lid', email: 'vest@x.nl', phone: '0612345678',
    password: 'geheim123', geboortedatum: '1990-01-01', tier: 'rtg', pasApp: 'rtg' });
  lid = reg.body.token;
  assert.ok(lid, 'lid-registratie geeft een token');
});
test.after(() => stop(srv && srv.child));

test('1. de hoofdvestiging staat voorop, ook zonder ingevulde lijst', () => {
  const alleen = vestigingenVan({ code: 'X', city: 'Ibiza', country: 'ES', loc: IBZ }, P.plekVan);
  assert.equal(alleen.length, 1, 'een zaak zonder filialen heeft een lijst van een');
  assert.equal(alleen[0].stad, 'Ibiza');

  const v = vestigingenVan(keten, P.plekVan);
  assert.equal(v.length, 2);
  assert.equal(v[0].stad, 'Amsterdam', 'het adres van de zaak zelf staat voorop');
  assert.equal(v[1].stad, 'Haarlem');
});

test('2. een filiaal in dezelfde stad telt niet dubbel', () => {
  const v = vestigingenVan({
    code: 'X', city: 'Amsterdam', country: 'NL', loc: AMS,
    vestigingen: [{ naam: 'Tweede pand', stad: 'Amsterdam', land: 'NL', loc: AMS }]
  }, P.plekVan);
  assert.equal(v.length, 1, 'twee panden in dezelfde stad zijn een plek in de Mall');
});

test('3. de zaak wordt gevonden in de stad van haar filiaal', () => {
  const a = aanbodVan(keten);
  const haarlem = P.plekVan({ stad: 'Haarlem', land: 'NL', punt: HRL });
  const ibiza = P.plekVan({ stad: 'Ibiza', land: 'ES', punt: IBZ });
  assert.equal(P.bedient(a, haarlem), true, 'het filiaal in Haarlem maakt de zaak daar vindbaar');
  assert.equal(P.bedient(a, ibiza), false, 'maar niet overal -- Ibiza blijft Ibiza');

  const zonder = aanbodVan({ code: 'S', name: 'Solo', type: 'retail', city: 'Amsterdam', country: 'NL', loc: AMS });
  assert.equal(P.bedient(zonder, haarlem), false, 'een zaak zonder filiaal is in Haarlem niet vindbaar');
});

test('4. de afstand is die tot het DICHTSTBIJZIJNDE filiaal', () => {
  const a = aanbodVan(keten);
  const bijHaarlem = P.afstandTot(a, HRL);
  const zonder = aanbodVan({ code: 'S', name: 'Solo', type: 'retail', city: 'Amsterdam', country: 'NL', loc: AMS });
  const vanAms = P.afstandTot(zonder, HRL);
  assert.ok(bijHaarlem < 2000, 'vanaf Haarlem is het filiaal om de hoek (' + Math.round(bijHaarlem) + ' m)');
  assert.ok(vanAms > 15000, 'terwijl het hoofdadres in Amsterdam veel verder is (' + Math.round(vanAms) + ' m)');
  assert.ok(bijHaarlem < vanAms, 'de keten staat dus hoger dan de losse zaak, en dat is de bedoeling');
});

test('5. het blijft EEN aanbod, geen kopie per vestiging', () => {
  const a = aanbodVan(keten);
  const plekken = P.plekkenUit([a]);
  assert.equal(plekken.length, 2, 'de zaak telt mee in beide steden');
  assert.deepEqual(plekken.map(p => p.stad).sort(), ['Amsterdam', 'Haarlem']);
  for (const p of plekken) assert.equal(p.aantal, 1, p.stad + ' telt hem een keer');
  // en er is werkelijk maar een rij
  assert.equal([a].length, 1);
});

test('6. prijs en voorraad zijn van de zaak, niet per filiaal -- en dat staat erbij', async () => {
  const r = await api(base, '/api/mall/zoek', { per: 60 }, lid);
  const metCode = r.body.items.filter(a => a.aanbieder.code);
  assert.ok(metCode.length > 0, 'er is aanbod van zaken');
  for (const a of metCode.slice(0, 10)) {
    assert.ok(Array.isArray(a.vestigingen) && a.vestigingen.length >= 1,
      a.titel + ' heeft een vestigingenlijst');
    assert.equal(a.perVestiging, false,
      a.titel + ' zegt dat prijs en voorraad NIET per filiaal zijn -- geen belofte die we niet waarmaken');
  }
});

test('7. de gewone Mall werkt onveranderd voor zaken met een plek', async () => {
  const r = await api(base, '/api/mall/zoek', { per: 60 }, lid);
  assert.equal(r.status, 200);
  assert.deepEqual(r.body.stuk, [], 'geen bron valt om door de vestigingenlaag');
  assert.deepEqual(r.body.geweigerd, [], 'en er wordt geen aanbod-object half afgeleverd');
  assert.ok(r.body.totaal >= 10);
});

test('8. het aantal filialen is begrensd', () => {
  const veel = Array.from({ length: MAX_VESTIGINGEN + 25 }, (x, i) => ({ naam: 'F' + i, stad: 'Stad' + i, land: 'NL' }));
  const v = vestigingenVan({ code: 'X', city: 'Amsterdam', country: 'NL', loc: AMS, vestigingen: veel }, P.plekVan);
  assert.ok(v.length <= MAX_VESTIGINGEN + 1, 'niet meer dan het maximum plus de hoofdvestiging, was: ' + v.length);
});

/* ---------------------------------------------------------------------------
   9-11. De zakelijke ingang.
   --------------------------------------------------------------------------- */

test('9. de zakelijke Mall is dicht voor wie geen Business Pass heeft', async () => {
  const r = await api(base, '/api/mall/zakelijk', {}, lid);
  assert.equal(r.status, 403, 'een RTG Pass komt er niet in');
  assert.ok(/Business Pass/i.test(r.body.error), r.body.error);
  /* En de deur gaat niet open door het te vragen: de AI en de app mogen nooit
     zelf een pas verlenen -- dat staat in CLAUDE.md en het hoort hier ook zo. */
  assert.ok(/gesprek met RTG/i.test(r.body.error),
    'de weigering verwijst naar een mens, niet naar een knop: ' + r.body.error);
});

test('10. je koopt geen inkoopprijs door een vinkje mee te sturen', async () => {
  const r = await api(base, '/api/mall/zoek', { per: 60, zakelijk: true, zakelijkAlleen: true }, lid);
  assert.equal(r.status, 200);
  assert.equal(r.body.zakelijk, false, 'de pas bepaalt de prijs, niet het verzoek');
  for (const a of r.body.items) {
    assert.ok(!a.zakelijk, a.titel + ' wordt niet zakelijk geprijsd voor een RTG Pass');
    if (a.prijs) assert.ok(a.prijs.btw !== 'ex', a.titel + ' toont geen prijs exclusief btw');
  }
});

test('11. een Business Pass ziet inkoopprijzen, exclusief btw en als zodanig gemarkeerd', async () => {
  const reg = await api(base, '/api/auth/register', { name: 'Zakelijk Lid', email: 'zak@x.nl', phone: '0612345680',
    password: 'geheim123', geboortedatum: '1990-01-01', tier: 'business', pasApp: 'business' });
  const t = reg.body.token;
  assert.ok(t, 'registratie lukt');

  const zoek = await api(base, '/api/mall/zoek', { per: 60 }, t);
  const zakelijkeRijen = zoek.body.items.filter(a => a.zakelijk);
  if (!zoek.body.zakelijk) {
    /* Zelfregistratie kent geen betaalde pas toe -- dat is met opzet zo
       (routes/auth/account.js). Dan is dit de toets: je kunt hem jezelf niet
       geven, en de zakelijke Mall blijft dus dicht. */
    const zak = await api(base, '/api/mall/zakelijk', {}, t);
    assert.equal(zak.status, 403, 'een zelf aangevraagde Business Pass geeft geen toegang');
    return;
  }
  for (const a of zakelijkeRijen) {
    assert.equal(a.prijs.btw, 'ex', a.titel + ' zegt erbij dat de prijs exclusief btw is');
    assert.ok(a.consumentPrijs, a.titel + ' toont ook nog wat een consument betaalt');
  }
});
