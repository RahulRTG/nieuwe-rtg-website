/* De twee schrijvende economieroutes tegen de echte HTTP- en SQLite-keten.
   De losse economische toetsen gebruiken bewust gewone geheugenobjecten.
   Daardoor zagen zij niet dat de levende SQLite-projectie door een
   mutatietracker-Proxy wordt bewaakt: de route eindigde op 500 terwijl dezelfde
   handeling in de unit-test groen was. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, stop } = require('./helper');

let server;
let token;

async function post(pad, body) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = 'Bearer ' + token;
  const response = await fetch(server.base + pad, {
    method: 'POST', headers, body: JSON.stringify(body || {})
  });
  return { status: response.status, body: await response.json() };
}

test.before(async () => {
  server = await startServer({ env: { SMTP_URL: '' } });
  const uniek = Date.now() + '-' + process.pid;
  const registratie = await post('/api/auth/register', {
    name: 'Economie Routeproef', email: 'economie-' + uniek + '@rtg.test',
    phone: '06' + String(Date.now()).slice(-8), password: 'geheim123',
    geboortedatum: '1990-01-01', tier: 'rtg', pasApp: 'rtg'
  });
  assert.equal(registratie.status, 200);
  token = registratie.body.token;
  assert.ok(token);
});

test.after(() => stop(server));

test('bedrijfsbesluit loopt via HTTP en de duurzame economie-opslag zonder 500', async () => {
  const antwoord = await post('/api/member/magnaat/economie/beslis', {
    prijs: 117, personeelDoel: 21, loonMaand: 3650,
    trainingDag: 1800, bestelling: 340, impactPct: 1.4
  });
  assert.equal(antwoord.status, 200, JSON.stringify(antwoord.body));
  assert.equal(antwoord.body.ok, true);
  assert.equal(antwoord.body.strategie.prijs, 11700);
  assert.equal(antwoord.body.strategie.personeelDoel, 21);
});

test('economenanalyse loopt via HTTP en de duurzame economie-opslag zonder 500', async () => {
  const antwoord = await post('/api/member/magnaat/economie/analyse', {
    hypothese: 'productiviteit', maatregel: 'training-investeren',
    indicatoren: ['capaciteit', 'benutting', 'marge'],
    causaleKeten: 'Training verhoogt menselijk kapitaal, daarna capaciteit en kwaliteit; via verkoop en kostprijs verandert het nettoresultaat.',
    alternatief: 'De prijs tijdelijk verlagen om eerst de bezettingsgraad te verhogen.',
    opportunityCost: 'De training gebruikt kas die niet meer beschikbaar is voor extra voorraad.',
    risico: 'Het opgeleide team levert niet snel genoeg extra capaciteit om de investering terug te verdienen.',
    zekerheid: 75, verwachteOmzet: 10000, verwachteWinst: 1000,
    verwachteInflatie: 2.2, omzetRichting: 'stijgt',
    winstRichting: 'stijgt', kasRichting: 'daalt'
  });
  assert.equal(antwoord.status, 200, JSON.stringify(antwoord.body));
  assert.equal(antwoord.body.ok, true);
  assert.equal(antwoord.body.ingediend.status, 'wacht-op-realisatie');
  assert.equal(antwoord.body.ingediend.hypothese, 'productiviteit');
});
