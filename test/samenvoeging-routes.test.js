/* ============================================================================
   ELF ROUTES UIT DE SAMENVOEGING DIE GEEN TOETS OVER DE DRAAD HADDEN.

   De twaalf takken van 1 september 2026 brachten routes mee waarvan de handler
   wel getoetst was (rechtstreeks aangeroepen, zoals test/herstelkanaal.test.js
   doet) maar die nooit via HTTP zijn geraakt. Het routejournaal telt alleen wat
   de server zelf heeft gematcht, dus voor DEKKING.json bestonden ze niet --
   en de dekking is een eis van 100% zonder norm om hem mee te verlagen.

   Elke route hier wordt dus over de draad aangeroepen, en niet alleen om hem
   aan te tikken: elke oproep toetst een grens die de route zegt te hebben.
   De deur (kantoor, manager, niemand) hoort erbij, want juist de deur is wat
   een rechtstreekse handleraanroep nooit ziet.

   Draai los: node --test test/samenvoeging-routes.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, stop, kantoorAlsPersoon } = require('./helper');

let srv, base, office, manager;

const api = (pad, body, token) => fetch(base + pad, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
  body: JSON.stringify(body || {})
}).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));

test.before(async () => {
  srv = await startServer(); base = srv.base;
  office = await kantoorAlsPersoon(base);
  assert.ok(office, 'geen kantoorsessie; de helft van deze routes zit achter die deur');
  const inlog = await api('/api/supplier/login', { username: 'rahul', password: 'Imran' });
  manager = inlog.body.token;
  assert.ok(manager, 'de manager van de demozaak logt niet in');
});
test.after(() => stop(srv));

test('de tweede factor ruilt alleen een ECHT bewijs om, en de deur is dicht zonder', async () => {
  /* Zonder bewijs is er geen inlogpoging om af te maken. Een 401 met de zin
     "verlopen" is hier het goede antwoord -- en niet een token, want dat zou
     betekenen dat een verzonnen bewijs voldoende was. */
  const r = await api('/api/auth/tweede', { bewijs: 'verzonnen', code: '000000' });
  assert.equal(r.status, 401);
  assert.match(r.body.error, /verlopen/);
  assert.equal(r.body.token, undefined, 'een verzonnen bewijs leverde een sessie op');
});

test('een mailwissel bevestigen vraagt een geldige link', async () => {
  const r = await api('/api/mijn/herstelkanaal/email/bevestig', { token: 'verzonnen' });
  assert.equal(r.status, 400);
  assert.match(r.body.error, /Ongeldige of verlopen/);
});

test('de schaduwmeters van het kantoor: bezitsbewijs en doelbinding, alleen achter de kantoordeur', async () => {
  for (const pad of ['/api/command/bezitsbewijs', '/api/command/doelbinding']) {
    const dicht = await api(pad, {});
    assert.ok(dicht.status === 401 || dicht.status === 403, pad + ' stond open zonder kantoorsessie');
    const r = await api(pad, {}, office);
    assert.equal(r.status, 200, pad + ': ' + JSON.stringify(r.body));
    /* Of de laag draait of niet, het antwoord zegt het zelf: een stand, of
       `nietGebouwd` met de reden. Een leeg object is geen van beide. */
    assert.ok(Object.keys(r.body).length > 0, pad + ' gaf een leeg antwoord');
  }
});

test('de periodieke giften: de lijst is van het kantoor, en vastleggen zonder plan bestaat niet', async () => {
  const dicht = await api('/api/rtfos/gift/plan/lijst', {});
  assert.ok(dicht.status === 401 || dicht.status === 403, 'de plannenlijst stond open');
  const lijst = await api('/api/rtfos/gift/plan/lijst', {}, office);
  assert.equal(lijst.status, 200, JSON.stringify(lijst.body));
  assert.ok(Array.isArray(lijst.body.plannen), 'geen lijst plannen');

  const weg = await api('/api/rtfos/gift/plan/vastleggen', { id: 'bestaat-niet', kenmerk: 'OVK-1', tot: '2031-01-01' }, office);
  assert.equal(weg.status, 404);
  assert.match(weg.body.error, /bestaat niet/);
});

test('de winkel van de stichting: een artikel zetten, terugzien, en de stand van een bestelling', async () => {
  const dicht = await api('/api/rtfos/winkel/artikel/zet', { naam: 'Kaars', euro: 12 });
  assert.ok(dicht.status === 401 || dicht.status === 403, 'artikelen zetten stond open');

  // zonder prijs is er niets te verkopen
  const zonder = await api('/api/rtfos/winkel/artikel/zet', { naam: 'Kaars zonder prijs' }, office);
  assert.equal(zonder.status, 400);
  assert.match(zonder.body.error, /prijs/);

  const naam = 'Toetskaars ' + Date.now();
  const zet = await api('/api/rtfos/winkel/artikel/zet', { naam, euro: 12.5, voorraad: 3, doel: 'schoolproject' }, office);
  assert.equal(zet.status, 200, JSON.stringify(zet.body));
  assert.ok(zet.body.artikel && zet.body.artikel.id, 'geen artikel terug');

  const etalage = await api('/api/rtfos/winkel/artikelen', {}, office);
  assert.equal(etalage.status, 200);
  assert.ok(etalage.body.artikelen.some(a => a.id === zet.body.artikel.id), 'het gezette artikel staat niet in de etalage');
  /* De zin die het verschil maakt hoort in de etalage zelf: dit is geen gift. */
  assert.match(etalage.body.uitleg, /geen aftrekbare gift/);

  const best = await api('/api/rtfos/winkel/bestellingen', {}, office);
  assert.equal(best.status, 200);
  assert.ok(Array.isArray(best.body.bestellingen));

  const stand = await api('/api/rtfos/winkel/stand', { id: 'bestaat-niet', stand: 'verstuurd' }, office);
  assert.equal(stand.status, 404, 'een stand op een bestelling die niet bestaat');
});

test('de uitbetaalrekening van een zaak: de stand is voor de manager en toont nooit het hele nummer', async () => {
  const dicht = await api('/api/supplier/pay/rekening/stand', {});
  assert.ok(dicht.status === 401 || dicht.status === 403, 'de rekeningstand stond open');
  const r = await api('/api/supplier/pay/rekening/stand', {}, manager);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(typeof r.body.ingesteld, 'boolean');
  if (r.body.eind) assert.equal(String(r.body.eind).length, 4, 'meer dan vier cijfers van het IBAN');
  assert.equal(r.body.iban, undefined, 'het hele IBAN kwam mee');
});
