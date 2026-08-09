/* Het bestellingenoverzicht van de RTG Mall: alles wat een lid lopen heeft,
   over vijf domeinen heen.

   Waar deze toetsen op mikken:
     1. EEN KAPOTTE BRON DIE STILLETJES EEN KORTER LIJSTJE OPLEVERT. Dat is het
        gevaarlijkste wat een overzichtslaag kan doen: je ziet niet dat je iets
        niet ziet (LAT-regel 5).
     2. EEN ONBEKENDE STATUS DIE ONDER EEN VERZONNEN LABEL VERDWIJNT. De
        domeinen houden hun eigen statussen; wat wij niet kennen heet "loopt" en
        houdt zijn eigen naam.
     3. EEN GEZAMENLIJKE AFREKENING DIE ER NIET IS. Achter deze regels zitten
        verschillende partijen; een knop "betaal alles" zou een belofte doen die
        niemand heeft gegeven.
     4. BETAALD DAT VAN NIETS WORDT AFGELEID. Waar een bron het niet bijhoudt
        staat null, en null is niet false.

   Elke toets is met een mutatie nagetrokken (LAT-regel 2).
   Draai los: node --experimental-sqlite --test test/mall-bestellingen.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');
const { stand, isAfgerond, AFGEROND } = require('../server/kern/ervaring/afgerond');

function api(base, pad, body, token) {
  const h = { 'Content-Type': 'application/json' };
  if (token) h.Authorization = 'Bearer ' + token;
  return fetch(base + pad, { method: 'POST', headers: h, body: JSON.stringify(body || {}) })
    .then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
}

/* De laag met een gebouwde wereld eronder, zodat een omvallende bron en een
   onbekende status echt te maken zijn. */
function bouw(data, kapot) {
  const db = { data: Object.assign({ orders: [], boekingen: [], reserveringen: [], reisAanvragen: [], thuisBoekingen: [] }, data) };
  if (kapot) Object.defineProperty(db.data, kapot, { get() { throw new Error('bron ' + kapot + ' ligt eruit'); } });
  const ctx = { db, save() {}, crypto: require('crypto') };
  return require('../server/kern/mall/bestellingen')(ctx).mallBestellingen;
}

let srv, base, lid;
test.before(async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-mallbest-'));
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  base = srv.base;
  const reg = await api(base, '/api/auth/register', { name: 'Best Lid', email: 'best@x.nl', phone: '0612345678',
    password: 'geheim123', geboortedatum: '1990-01-01', tier: 'rtg', pasApp: 'rtg' });
  lid = reg.body.token;
  assert.ok(lid, 'lid-registratie geeft een token');
});
test.after(() => stop(srv && srv.child));

test('1. vijf domeinen komen samen in een lijst, met hun eigen soort', () => {
  const m = bouw({
    orders: [{ ref: 'O1', customerKey: 'k', supplierName: 'Cafe', supplierCode: 'C', status: 'nieuw', paid: false, total: 24, items: [{ naam: 'Koffie' }], at: '2026-08-01T10:00:00Z' }],
    boekingen: [{ ref: 'B1', customerKey: 'k', supplierName: 'Kapper', supplierCode: 'K', status: 'bevestigd', paid: false, price: 45, service: { name: 'Knippen' }, wanneer: '2026-08-12 10:00', at: '2026-08-02T10:00:00Z' }],
    reserveringen: [{ id: 'R1', customerKey: 'k', supplierName: 'Casa', supplierCode: 'CA', status: 'aangevraagd', datum: '2026-08-20', tijd: '20:00', personen: 2, at: '2026-08-03T10:00:00Z' }],
    reisAanvragen: [{ ref: 'T1', customerKey: 'k', titel: 'Alpien weekend', status: 'aangevraagd', prijs: { totaal: 1200 }, vertrek: '2026-12-01', at: '2026-08-04T10:00:00Z' }],
    thuisBoekingen: [{ ref: 'H1', gast: 'Coda', titel: 'Villa', plaats: 'Ibiza', status: 'bevestigd', van: '2026-09-01', tot: '2026-09-08', prijsopbouw: { totaal: 900 } }]
  });
  const d = m.mijn('k', 'Coda');
  assert.equal(d.aantal, 5, 'alle vijf de domeinen leveren een regel');
  assert.deepEqual(d.bestellingen.map(r => r.soort).sort(),
    ['boeking', 'order', 'reis', 'reservering', 'verblijf']);
  assert.deepEqual(d.stuk, [], 'geen enkele bron valt om');
  for (const r of d.bestellingen) {
    assert.ok(r.pagina && r.pagina.startsWith('/apps/'), r.soort + ' wijst naar het scherm dat hem beheert');
    assert.ok(r.titel, r.soort + ' heeft een titel');
  }
});

test('2. een omvallende bron komt terug als `stuk`, niet als een korter lijstje', () => {
  const m = bouw({
    orders: [{ ref: 'O1', customerKey: 'k', supplierName: 'Cafe', status: 'nieuw', total: 24, items: [], at: 'x' }]
  }, 'reisAanvragen');
  const d = m.mijn('k', 'Coda');
  assert.equal(d.aantal, 1, 'wat het wel deed komt door');
  assert.equal(d.stuk.length, 1, 'en de kapotte bron staat erbij');
  assert.equal(d.stuk[0].bron, 'reisbureau');
  assert.ok(/ligt eruit/.test(d.stuk[0].fout), 'met de reden: ' + d.stuk[0].fout);
});

test('3. zonder codenaam worden verblijven niet stilletjes overgeslagen', () => {
  const m = bouw({ thuisBoekingen: [{ ref: 'H1', gast: 'Coda', titel: 'Villa', status: 'bevestigd', van: 'a', tot: 'b' }] });
  const d = m.mijn('k', null);
  assert.equal(d.aantal, 0, 'zonder codenaam is er niets te vinden');
  const gemist = d.stuk.find(s => s.bron === 'thuis');
  assert.ok(gemist, 'maar dat wordt gemeld in plaats van een lege lijst te tonen');
  assert.equal(gemist.overslaan, true, 'en herkenbaar als "overgeslagen", niet als "kapot"');
});

test('4. een onbekende status verdwijnt niet onder een verzonnen label', () => {
  const m = bouw({
    orders: [{ ref: 'O1', customerKey: 'k', supplierName: 'Cafe', status: 'wachtend-op-de-bakker', total: 5, items: [], at: 'x' }]
  });
  const r = m.mijn('k', 'Coda').bestellingen[0];
  assert.equal(r.status, 'wachtend-op-de-bakker', 'de eigen status van het domein blijft staan');
  assert.equal(r.stand, 'loopt', 'en wat we niet kennen telt als lopend');
});

test('5. loopt, klaar en afgezegd komen uit een gedeelde tabel', () => {
  // dezelfde tabel die bepaalt of je al een review mag plaatsen
  assert.equal(isAfgerond('order', 'bezorgd'), true);
  assert.equal(isAfgerond('order', 'nieuw'), false);
  assert.equal(stand('order', 'bezorgd'), 'klaar');
  assert.equal(stand('order', 'geannuleerd'), 'afgezegd');
  assert.equal(stand('order', 'nieuw'), 'loopt');
  assert.ok(AFGEROND.order.includes('geserveerd'), 'de tabel is de echte, niet een kopie');

  const m = bouw({
    orders: [
      { ref: 'A', customerKey: 'k', supplierName: 'X', status: 'bezorgd', total: 1, items: [], at: '3' },
      { ref: 'B', customerKey: 'k', supplierName: 'X', status: 'geannuleerd', total: 1, items: [], at: '2' },
      { ref: 'C', customerKey: 'k', supplierName: 'X', status: 'nieuw', total: 1, items: [], at: '1' }
    ]
  });
  const d = m.mijn('k', 'Coda');
  assert.equal(d.klaar, 1);
  assert.equal(d.afgezegd, 1);
  assert.equal(d.loopt, 1);
});

test('6. "betaald" komt uit de bron; wat een bron niet bijhoudt is null en niet false', () => {
  const m = bouw({
    orders: [{ ref: 'O1', customerKey: 'k', supplierName: 'X', status: 'nieuw', paid: true, total: 5, items: [], at: 'x' }],
    reserveringen: [{ id: 'R1', customerKey: 'k', supplierName: 'Y', status: 'aangevraagd', datum: 'd', tijd: 't', personen: 2, at: 'x' }]
  });
  const d = m.mijn('k', 'Coda');
  const order = d.bestellingen.find(r => r.soort === 'order');
  const tafel = d.bestellingen.find(r => r.soort === 'reservering');
  assert.equal(order.betaald, true, 'de bron zei betaald');
  assert.equal(tafel.betaald, null, 'een tafel zonder aanbetaling weet het niet -- dat is geen "nee"');
  assert.equal(tafel.bedrag, null, 'en er wordt geen bedrag verzonnen');
});

test('7. het overzicht van een ander lid blijft van dat andere lid', () => {
  const m = bouw({
    orders: [
      { ref: 'MIJN', customerKey: 'k', supplierName: 'X', status: 'nieuw', total: 1, items: [], at: 'x' },
      { ref: 'ANDER', customerKey: 'z', supplierName: 'X', status: 'nieuw', total: 1, items: [], at: 'x' }
    ]
  });
  assert.deepEqual(m.mijn('k', 'Coda').bestellingen.map(r => r.id), ['MIJN']);
});

test('8. er is GEEN gezamenlijke afrekening, en dat staat in het antwoord', async () => {
  const r = await api(base, '/api/mall/bestellingen', {}, lid);
  assert.equal(r.status, 200);
  assert.equal(r.body.geenGezamenlijkeAfrekening, true);
  assert.ok(/partij die hem levert/i.test(r.body.opmerking), r.body.opmerking);
  assert.ok(Array.isArray(r.body.bronnen) && r.body.bronnen.length === 5,
    'het antwoord noemt uit welke vijf bronnen het put: ' + JSON.stringify(r.body.bronnen));
});

test('9. de route levert het overzicht van de ingelogde gebruiker, ook als die niets heeft', async () => {
  const r = await api(base, '/api/mall/bestellingen', {}, lid);
  assert.equal(r.body.aantal, 0, 'een vers lid heeft niets lopen');
  assert.deepEqual(r.body.stuk, [], 'en dat komt niet doordat er bronnen omvielen');
  const zonder = await api(base, '/api/mall/bestellingen', {});
  assert.equal(zonder.status, 401, 'zonder inlog geen overzicht');
});
