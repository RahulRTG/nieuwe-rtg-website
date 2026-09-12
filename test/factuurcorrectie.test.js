/* DE TERUGWEG VAN /api/pay/saldo -- een betaalde factuur corrigeren.

   HERSTELBESLUIT.json verklaarde dat pad COMPENSATABLE en zette het bewijs op
   BLOCKED, met `watErMoetKomen`. Deze toets is het bewijs dat daarbij hoort:
   hij loopt de heenweg (betalen uit saldo) en dan de terugweg, en meet de
   ECONOMISCHE uitkomst en niet de statuscode -- zelfde maat als
   scripts/factuurproef.js, want een route kan keurig 200 geven terwijl er geen
   cent is bewogen.

   DRIE DINGEN DIE HIER WORDEN VASTGEPIND EN DIE GEEN VAN ALLE VANZELF SPREKEN:

   1. COMPENSEREN IS GEEN TERUGDRAAIEN. De factuur blijft `paid` en het
      betaalbewijs blijft staan; de correctie komt ERNAAST. Zou iemand hem op
      een derde stand zetten, dan tonen de ledenschermen hem als openstaande
      schuld -- 19 lezers splitsen binair op `paid`.
   2. EEN GEDEELDE KANTOORCODE CORRIGEERT NIET. Zonder herleidbaar mens is een
      terugbetaling een bedrag uit het niets.
   3. DE AFDRACHT WORDT NIET STIL TERUGGEHAALD. Er is geen positie van de
      RTFoundation om aan te betalen (GIFT.md), dus de regel zegt
      `nietGeregeld` met de reden -- en niet niets.

   Draai los: node --test test/factuurcorrectie.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop, kantoorAlsPersoon } = require('./helper');

const CODE = 'RTG-OFFICE';
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-factuurcorrectie-'));
let srv, base, lid, gedeeld, opNaam, userId, factuur, bedragCenten, saldoNaBetaling;

function api(pad, body, token) {
  const h = { 'Content-Type': 'application/json' };
  if (token) h.Authorization = 'Bearer ' + token;
  return fetch(base + pad, { method: 'POST', headers: h, body: JSON.stringify(body || {}) })
    .then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
}
const invoicesVan = async () => ((await api('/api/state', {}, lid)).body.state || {}).invoices || [];
const saldoVan = async () => (await api('/api/pay/overzicht', {}, lid)).body.saldo;

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, OFFICE_CODE: CODE,
    RTG_ENC_KEY: 'test-encryptiesleutel-1234567890' } });
  base = srv.base;

  const reg = await api('/api/auth/register', { name: 'Correctie Lid', email: 'corr@x.nl',
    phone: '0655544333', password: 'geheim123', geboortedatum: '1985-04-04', geslacht: 'm',
    tier: 'rtg', pasApp: 'rtg' });
  lid = reg.body.token;
  assert.ok(lid, 'het lid is ingelogd');
  /* De account-id komt uit de registratie zelf (`state.user.id`), zoals elke
     andere kantoortoets hem pakt -- en niet uit een ledenlijst die ik moet
     raden. Een fout id gaf hier eerst een 404 die er als een echte
     weigering uitzag. */
  userId = reg.body.state && reg.body.state.user && reg.body.state.user.id;
  assert.ok(userId, 'en zijn account-id staat in de registratie');
  // de payGate: een gratis lid toont eenmalig zijn paspoort voor het RTG Pay mag
  const PNG = 'data:image/png;base64,' + Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4]).toString('base64');
  await api('/api/verify/upload', { image: PNG }, lid);
  await api('/api/verify/selfie', { image: PNG }, lid);

  gedeeld = (await api('/api/office/login', { code: CODE })).body.token;
  assert.ok(gedeeld, 'de gedeelde kantoorcode werkt');
  // en een medewerker OP NAAM, via dezelfde helper als de andere kluistoetsen
  opNaam = await kantoorAlsPersoon(base, CODE);
  assert.ok(opNaam, 'er staat een medewerker met een eigen account in de backoffice');
});
test.after(() => {
  stop(srv && srv.child);
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('1. de heenweg loopt: een open factuur wordt betaald uit saldo', async () => {
  const open = (await invoicesVan()).filter(i => i.status === 'open');
  assert.ok(open.length >= 1, 'het nieuwe lid heeft een open factuur');
  factuur = open[0];
  bedragCenten = Math.round((factuur.bijdrage || 0) * 100);
  assert.ok(bedragCenten > 0, 'de maandbijdrage is een echt bedrag');

  const r = await api('/api/pay/saldo', { invoiceId: factuur.id }, lid);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.betaald, bedragCenten, 'exact het bedrag ging eraf');
  saldoNaBetaling = await saldoVan();
});

/* HET LID ZELF KAN ER NIET BIJ. Deze route hangt achter officeAuth; met een
   ledentoken hoort hij niet open te gaan. */
test('2. een lid kan zijn eigen betaalde factuur niet corrigeren', async () => {
  const r = await api('/api/office/pay/factuurcorrectie',
    { userId, invoiceId: factuur.id, grond: 'coulance', reden: 'ik wil mijn geld terug' }, lid);
  assert.ok(r.status === 401 || r.status === 403, 'de ledendeur geeft geen toegang: ' + r.status);
  assert.equal(await saldoVan(), saldoNaBetaling, 'en er is niets bewogen');
});

/* DE GEDEELDE CODE OOK NIET, en dat is de grens die de toelatingsproef al
   vond: een spoor dat eindigt bij een code die iedereen kent, is geen spoor. */
test('3. de gedeelde kantoorcode corrigeert niet', async () => {
  const r = await api('/api/office/pay/factuurcorrectie',
    { userId, invoiceId: factuur.id, grond: 'coulance', reden: 'zomaar' }, gedeeld);
  assert.equal(r.status, 403, JSON.stringify(r.body));
  assert.match(r.body.error, /eigen account|gedeelde kantoorcode/i, 'en het zegt waarom');
  assert.equal(await saldoVan(), saldoNaBetaling, 'en er is niets bewogen');
});

test('4. zonder grond of zonder reden gebeurt er niets', async () => {
  const zonderGrond = await api('/api/office/pay/factuurcorrectie',
    { userId, invoiceId: factuur.id, reden: 'wel een reden' }, opNaam);
  assert.equal(zonderGrond.status, 400, JSON.stringify(zonderGrond.body));
  assert.match(zonderGrond.body.error, /grond/i);

  const zonderReden = await api('/api/office/pay/factuurcorrectie',
    { userId, invoiceId: factuur.id, grond: 'coulance' }, opNaam);
  assert.equal(zonderReden.status, 400, JSON.stringify(zonderReden.body));
  assert.match(zonderReden.body.error, /reden/i);

  assert.equal(await saldoVan(), saldoNaBetaling, 'en er is nog steeds niets bewogen');
});

test('5. de correctie boekt terug, en het lid ziet zijn geld', async () => {
  const r = await api('/api/office/pay/factuurcorrectie',
    { userId, invoiceId: factuur.id, grond: 'niet-geleverd', reden: 'de maand is niet geleverd' }, opNaam);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.teruggeboekt, bedragCenten, 'exact wat er ontvangen was gaat terug');
  assert.equal(await saldoVan(), saldoNaBetaling + bedragCenten, 'het saldo klopt op de cent');
});

/* DE KERN VAN COMPENSATABLE. Niet terugdraaien maar ernaast boeken. */
test('6. de factuur blijft `paid` en draagt de correctie ernaast', async () => {
  const inv = (await invoicesVan()).find(i => i.id === factuur.id);
  assert.ok(inv, 'de factuur bestaat nog');
  assert.equal(inv.status, 'paid', 'de historie is niet herschreven');
  assert.ok(Array.isArray(inv.correcties) && inv.correcties.length === 1, 'er staat een correctieregel');
  const c = inv.correcties[0];
  assert.equal(c.grond, 'niet-geleverd');
  assert.equal(c.centen, bedragCenten);
  assert.ok(c.door, 'en wie hem zette staat erbij');
  assert.ok(Array.isArray(inv.betaalBewijzen) && inv.betaalBewijzen.length >= 1,
    'het oorspronkelijke betaalbewijs is blijven staan');
});

/* HET GETAL WAAR DE HELE PR OM DRAAIT: een tweede aanroep verplaatst NUL. */
test('7. een tweede correctie verplaatst geen cent', async () => {
  const voor = await saldoVan();
  const r = await api('/api/office/pay/factuurcorrectie',
    { userId, invoiceId: factuur.id, grond: 'coulance', reden: 'nog een keer' }, opNaam);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  /* HET GELD EERST. Deze volgorde is met opzet: een statusveld dat afwijkt is
     hinderlijk, een tweede boeking is geld. Stond `herhaald` hier eerst, dan
     zakte de toets op het etiket voordat hij de portemonnee had geteld -- en
     bij de mutatieproef zie je dan niet OF er dubbel is geboekt. */
  assert.equal(await saldoVan(), voor, 'er is nul bijgekomen');
  assert.equal(r.body.herhaald, true, 'en hij meldt dat het een herhaling is');

  const inv = (await invoicesVan()).find(i => i.id === factuur.id);
  assert.equal(inv.correcties.length, 1, 'en er staat nog steeds precies een correctieregel');
});

test('8. een openstaande factuur valt niets te corrigeren', async () => {
  const open = (await invoicesVan()).find(i => i.status === 'open');
  if (!open) return; // geen tweede factuur in de zaaiset: dan is er niets te meten
  const r = await api('/api/office/pay/factuurcorrectie',
    { userId, invoiceId: open.id, grond: 'coulance', reden: 'te vroeg' }, opNaam);
  assert.equal(r.status, 409, JSON.stringify(r.body));
  assert.match(r.body.error, /betaalde factuur/i);
});

test('9. een onbekend account is een nette 404 en beweegt niets', async () => {
  const voor = await saldoVan();
  const r = await api('/api/office/pay/factuurcorrectie',
    { userId: 999999, invoiceId: factuur.id, grond: 'coulance', reden: 'bestaat niet' }, opNaam);
  assert.equal(r.status, 404, JSON.stringify(r.body));
  assert.equal(await saldoVan(), voor);
});

/* DE AFDRACHT, EN WAAROM DIT EEN LOSSE OPSTELLING IS. Het bord van de
   RTFoundation is niet langs een ledenroute te lezen, dus dit stuk draait de
   module met een eigen db -- zelfde vorm als test/idembundel.test.js. Zonder
   deze toets zou de kop van deze module iets beweren wat nergens werd
   nagerekend, en dat is precies het gebrek waar deze PR over gaat. */
test('10. de afdracht houdt haar regel en krijgt `nietGeregeld` met de reden', async () => {
  const { maakFactuurCorrectie } = require('../server/kern/factuurcorrectie.js');
  const inv = { id: 'RTG-T-1', desc: 'Maandbijdrage', status: 'paid', bijdrage: 65, deelbetaald: 6500 };
  const afdracht = { invoiceId: 'RTG-T-1', centen: 1950, status: 'te_storten' };
  const db = { data: { techniek: {}, fondsAfdrachten: [afdracht], invoices: [inv] }, save: async () => {} };
  const boekingen = [];
  const mod = maakFactuurCorrectie({
    db, accounts: null, fonds: { isAbonnement: () => true }, log: null,
    bijeen: async (fn) => fn(),
    payVan: () => ({ huisUit: async (o) => { boekingen.push(o); return { boeking: 'B1', centen: o.centen }; } })
  });

  const r = await mod.corrigeerFactuur({ own: false, accountId: null, wie: 'office',
    codenaam: 'RTG-TEST', invoiceId: 'RTG-T-1', grond: 'dubbel',
    reden: 'twee keer gefactureerd', door: 'user-7' });

  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(r.teruggeboekt, 6500, 'wat er ONTVANGEN is gaat terug, niet de bijdrage');
  assert.equal(boekingen.length, 1, 'en er is precies een boeking gedaan');

  /* De afdrachtregel is er nog -- hij is echt gebeurd -- en draagt de correctie. */
  assert.equal(afdracht.status, 'te_storten', 'de afdracht is NIET omgezet of weggehaald');
  assert.equal(afdracht.centen, 1950, 'en haar bedrag is niet aangeraakt');
  assert.ok(afdracht.correctie, 'maar er staat wel een correctieregel op');
  assert.equal(afdracht.correctie.geld.stand, 'nietGeregeld',
    'en het geld ervan is eerlijk als niet-geregeld gemeld');
  assert.match(afdracht.correctie.geld.uitleg, /RTFoundation/,
    'met de reden erbij en niet als leeg veld');
  assert.equal(afdracht.correctie.door, 'user-7', 'en wie het zette staat erbij');
});

/* HET FORMULIER MOET WETEN WAT ER TE KIEZEN VALT -- en wat er met opzet niet
   bestaat, want dat is de vraag die een medewerker een keer stelt en daarna
   nooit meer. Alleen lezen, en alleen voor het kantoor. */
test('11. de gronden zijn op te halen, en alleen door het kantoor', async () => {
  const get = (token) => fetch(base + '/api/office/pay/factuurcorrectie/gronden',
    { headers: token ? { Authorization: 'Bearer ' + token } : {} })
    .then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));

  const dicht = await get(null);
  assert.equal(dicht.status, 401, 'zonder inlog komt er niets uit');

  const open = await get(gedeeld);
  assert.equal(open.status, 200, JSON.stringify(open.body));
  const ids = (open.body.gronden || []).map(g => g.id);
  assert.ok(ids.includes('niet-geleverd') && ids.includes('coulance'), 'de gronden staan erin: ' + ids.join(', '));
  for (const g of open.body.gronden) {
    assert.ok(g.label && g.wat, g.id + ' draagt een label en een uitleg');
    assert.ok(g.wie === 'lid' || g.wie === 'kantoor', g.id + ' zegt van wiens kant het signaal komt');
  }
  /* Wat er NIET is hoort er even hard bij te staan: anders stelt iemand die
     vraag opnieuw in code in plaats van hem hier beantwoord te vinden. */
  assert.ok(open.body.nietGebouwd && open.body.nietGebouwd['de-afdracht-terugboeken'],
    'en wat er met opzet niet bestaat staat erbij, met de reden');
});
