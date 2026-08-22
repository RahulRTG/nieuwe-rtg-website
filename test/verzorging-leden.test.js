/* De LEDENkant van de beauty-salon en barbier (kern/verzorging/beautyleden.js).
   Knippen, scheren en nagels waren alleen voor de zaak zelf te zien; nu boekt
   een lid er zelf, op codenaam, in DEZELFDE agenda als de salon. Wat hier
   bewezen wordt: het aanbod is cosmetisch en niet medisch, een geboekt slot is
   daarna weg voor iedereen (de agenda is een waarheid), een gast mag niet
   boeken, en de afspraak van een ander is niet te annuleren.
   Draai los: node --test test/verzorging-leden.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

let srv, base, lid, lid2, gast, echteCodenaam;
const ECHTE_NAAM = 'Verzorging Lid';
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-verz-'));

const api = (pad, body, t) => fetch(base + '/api/' + pad, {
  method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + t },
  body: JSON.stringify(body || {})
}).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
const morgen = () => new Date(Date.now() + 86400000).toISOString().slice(0, 10);
const overDagen = n => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, DEMO_SUPPLIER: 'VELVET' } });
  base = srv.base;
  const login = tier => fetch(base + '/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tier }) }).then(r => r.json()).then(d => d.token);
  /* Een ECHT account, want de privacybewering van deze laag gaat over het
     verschil tussen de naam in de kluis en de codenaam die de salon ziet.
     Met een demo-persona zou dat verschil er niet zijn en zou de toets niets
     kunnen bewijzen. */
  const u = Date.now().toString().slice(-8);
  const reg = await api('auth/register', { name: ECHTE_NAAM, email: 'v' + u + '@x.nl', phone: '06' + u,
    password: 'geheim123', geboortedatum: '1990-01-01', tier: 'rtg', pasApp: 'rtg' }, '');
  lid = reg.body.token;
  echteCodenaam = reg.body.state && reg.body.state.user && reg.body.state.user.codename;
  assert.ok(lid, 'het lid is geregistreerd');
  assert.ok(echteCodenaam && echteCodenaam !== ECHTE_NAAM, 'het account heeft een codenaam die niet de echte naam is');
  lid2 = await login('business');
  gast = await login('guest');
  assert.ok(lid2 && gast, 'de tweede sessie en de gast');
});
test.after(() => {
  stop(srv && srv.child);
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('het aanbod staat er als cosmetisch, niet als zorg, en zonder intake', async () => {
  const r = await api('verzorging', { datum: morgen() }, lid);
  assert.equal(r.status, 200);
  const salon = r.body.aanbieders.find(a => /velvet/i.test(a.naam));
  assert.ok(salon, 'de geseede salon staat in het aanbod');
  assert.equal(salon.medisch, false);
  assert.equal(salon.soort, 'verzorging');
  assert.ok(salon.behandelingen.length >= 3, 'knippen, scheren, nagels');
  assert.ok(salon.behandelingen.every(b => b.soort === 'cosmetisch'),
    'geen enkele behandeling van een kapper mag als medisch binnenkomen');
  // de scheiding met Care is het punt van deze laag: hier hoort geen dossier
  assert.equal(salon.intakeActief, undefined);
  assert.ok(salon.behandelingen[0].tijden.length > 0, 'een lege dag heeft vrije tijden');
});

test('boeken vult de agenda van de salon zelf: het slot is daarna voor iedereen weg', async () => {
  const datum = morgen();
  const ov = (await api('verzorging', { datum }, lid)).body;
  const salon = ov.aanbieders.find(a => /velvet/i.test(a.naam));
  // een behandeling met maar EEN stoel van dat soort, anders is het slot na een
  // boeking terecht nog vrij en bewijst de toets niets
  const beh = salon.behandelingen.find(b => b.vak === 'kapper');
  assert.ok(beh, 'de salon heeft kapperswerk');
  const tijd = beh.tijden[0];

  const boek = await api('verzorging/boek', { code: salon.code, behandelingId: beh.id, datum, tijd }, lid);
  assert.equal(boek.status, 200, JSON.stringify(boek.body));
  assert.equal(boek.body.afspraak.van, tijd);

  // 1. hetzelfde slot is voor een ANDER lid niet meer te zien
  const na = (await api('verzorging', { datum }, lid2)).body;
  const behNa = na.aanbieders.find(a => a.code === salon.code).behandelingen.find(b => b.id === beh.id);
  assert.ok(!behNa.tijden.includes(tijd), 'een bezet slot verdwijnt uit het aanbod');

  // 2. en het is ook niet alsnog te boeken door er langs het aanbod om te vragen
  const nogmaals = await api('verzorging/boek', { code: salon.code, behandelingId: beh.id, datum, tijd }, lid2);
  assert.equal(nogmaals.status, 409, 'een bezet slot geeft een botsing, geen tweede afspraak');
});

test('de salon zet zijn eigen uren, en de ledenkant volgt ze', async () => {
  /* Dit rooster stond als constante in de code, met een briefje erbij dat dat
     een gat was. Nu staat het bij de salon; deze toets is het bewijs dat de
     ledenkant het daar ook echt vandaan haalt en niet uit een eigen getal. */
  const datum = overDagen(3);
  const voor = (await api('verzorging', { datum }, lid)).body.aanbieders[0];
  const behVoor = voor.behandelingen.find(b => b.tijden.length);
  assert.equal(voor.opening.van, '09:00');
  assert.ok(behVoor.tijden.includes('09:00'), 'standaard gaat de deur om negen uur open');
  assert.ok(!behVoor.tijden.some(t => t >= '18:00'), 'en om zes uur dicht');

  const sup = (await api('supplier/login', { username: 'rahul', password: 'Imran' }, '')).body.token;
  const uren = await api('supplier/beauty/uren', { van: '12:00', tot: '20:00', stapMin: 60 }, sup);
  assert.equal(uren.status, 200, JSON.stringify(uren.body));

  const na = (await api('verzorging', { datum }, lid)).body.aanbieders[0];
  const behNa = na.behandelingen.find(b => b.id === behVoor.id);
  assert.equal(na.opening.van, '12:00', 'de ledenkant toont de uren van de salon');
  assert.ok(!behNa.tijden.includes('09:00'), 'negen uur is geen optie meer');
  assert.ok(behNa.tijden.includes('12:00'), 'twaalf uur wel');
  assert.ok(behNa.tijden.some(t => t >= '18:00'), 'en de avond is nu open');

  const gek = await api('supplier/beauty/uren', { van: '20:00', tot: '12:00' }, sup);
  assert.equal(gek.status, 400, 'dicht voor open is geen dag');

  await api('supplier/beauty/uren', { van: '09:00', tot: '18:00', stapMin: 30 }, sup);
});

test('mijn-lijst is van mij alleen, en de salon ziet een codenaam en geen echte naam', async () => {
  const mijn = (await api('verzorging/mijn', {}, lid)).body;
  assert.equal(mijn.afspraken.length, 1);
  assert.equal(mijn.afspraken[0].datum, morgen());

  const vanEenAnder = (await api('verzorging/mijn', {}, lid2)).body;
  assert.equal(vanEenAnder.afspraken.length, 0, 'lid2 boekte niets en ziet dus niets');

  /* De privacybelofte van het huis, aan de kant waar hij telt: de salon opent
     zijn eigen agenda en de ECHTE naam van het lid staat er niet in. Deze
     bewering zakt zodra beautyleden.js de naam uit de kluis zou doorgeven in
     plaats van de codenaam. */
  const sup = (await api('supplier/login', { username: 'rahul', password: 'Imran' }, '')).body.token;
  assert.ok(sup, 'de demo-salon logt in');
  const agenda = (await api('supplier/beauty', {}, sup)).body;
  const opNaam = agenda.afspraken.find(a => a.datum === morgen());
  assert.ok(opNaam, 'de salon ziet de afspraak van het lid in zijn eigen agenda');
  assert.ok(!new RegExp(ECHTE_NAAM, 'i').test(JSON.stringify(agenda.afspraken)),
    'de echte naam van het lid komt de salon niet binnen');
  assert.equal(opNaam.naam, echteCodenaam, 'de salon ziet precies de codenaam');
});

test('een gast boekt niet, en een afspraak van een ander is niet te annuleren', async () => {
  const datum = morgen();
  const ov = (await api('verzorging', { datum }, lid)).body;
  const salon = ov.aanbieders.find(a => /velvet/i.test(a.naam));
  const beh = salon.behandelingen.find(b => b.tijden.length);

  const gastBoekt = await api('verzorging/boek', { code: salon.code, behandelingId: beh.id, datum, tijd: beh.tijden[0] }, gast);
  assert.equal(gastBoekt.status, 403, 'boeken is voor leden');

  const mijn = (await api('verzorging/mijn', {}, lid)).body;
  const eigen = mijn.afspraken[0];
  const steel = await api('verzorging/annuleer', { code: eigen.code, id: eigen.id }, lid2);
  assert.equal(steel.status, 404, 'het id van een ander lid bestaat voor jou niet');

  // en na die mislukte poging staat hij er nog gewoon
  const naPoging = (await api('verzorging/mijn', {}, lid)).body;
  assert.equal(naPoging.afspraken.length, 1, 'de afspraak van het eigen lid overleeft de poging');

  const eigenAnnuleer = await api('verzorging/annuleer', { code: eigen.code, id: eigen.id }, lid);
  assert.equal(eigenAnnuleer.status, 200);
  assert.equal((await api('verzorging/mijn', {}, lid)).body.afspraken.length, 0);
});
