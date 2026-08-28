/* ============================================================================
   DE MARKTPLAATS VANAF DE ZAAK -- 8 endpoints achter de leverancier-inlog.

   Deze acht wees de waargenomen dekkingsmeting aan als nooit aangeroepen:
   status, verwijder, antwoord, chat, deal/voorstel, deal/hier, deal/betaal en
   ai. Er BESTAAT een uitgebreide markttoets (test/markt.test.js), maar die
   loopt bijna helemaal via de RTFoundation-ingang: gezinnen die van elkaar
   kopen. Van de zaak-ingang raakte hij alleen /plaats en /mijn.

   Dat is dezelfde motor (kern/markt.js) met een ander soort deelnemer ervoor.
   Een gezin identificeert zich met gezinscode plus profieltoken in de body;
   een zaak met een Bearer-token en een partij van soort "zaak". Elke
   eigenaars- en deelnemerscontrole in die motor vergelijkt partijsleutels, en
   of die vergelijking ook opgaat voor een zaak was tot nu toe niet beproefd.

   WAT ER OP HET SPEL STAAT

   Hier gaat geld tussen twee partijen heen en weer, en de motor kent maar
   twee rollen: koper en verkoper. Een zaak die op de markt staat is de
   VERKOPER. De regel "alleen de koper betaalt" is daarmee geen formaliteit:
   zou een verkoper die aanroep kunnen doen, dan kan hij zijn eigen verkoop
   als betaald afstempelen zonder dat er iets is overgemaakt.

   Draai los: node --test test/markt-zaak.test.js
   ========================================================================== */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

let srv, base, zaak, andereZaak, gezin, gezinToken;
let adId = null, chatId = null;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-marktzaak-'));

function api(pad, body, token) {
  const h = { 'Content-Type': 'application/json' };
  if (token) h.Authorization = 'Bearer ' + token;
  return fetch(base + pad, { method: 'POST', headers: h, body: JSON.stringify(body || {}) })
    .then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
}
// de zaak-kant: Bearer-token; de gezins-kant: code en token in de body
const zk = (pad, body, token) => api('/api/supplier/markt/' + pad, body, token);
const rtf = (pad, body) => api('/api/foundation/markt/' + pad, Object.assign({ code: gezin, token: gezinToken }, body));

async function manager(code) {
  const roster = await api('/api/supplier/roster', { code });
  const wie = roster.body.staff.find(x => x.role === 'manager');
  return (await api('/api/supplier/login', { code, staffId: wie.id, pin: '1234' })).body.token;
}

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  base = srv.base;
  zaak = await manager('MAISON');
  andereZaak = await manager('KIKUNOI');
  const g = await api('/api/foundation/gezin/maak', { gezinsnaam: 'Familie Roig', naam: 'Marta', pin: '1234', groep: 'volw' });
  gezin = g.body.code; gezinToken = g.body.token;
  assert.ok(zaak && andereZaak && gezin, 'twee zaken en een gezin staan klaar');
});
test.after(() => {
  stop(srv && srv.child);
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('1. de zaak beheert alleen zijn eigen advertentie', async () => {
  const mk = await zk('plaats', { akkoord: true, titel: 'Vitrinekast uit de winkel', beschrijving: 'Glazen vitrinekast, netjes, op te halen.', categorie: 'wonen', staat: 'gebruikt', prijs: 120, plaats: 'Ibiza' }, zaak);
  assert.equal(mk.status, 200);
  adId = mk.body.ad.id;
  assert.equal(mk.body.ad.verkoper.badge, 'zaak');

  const mijn = await zk('mijn', {}, zaak);
  assert.ok(mijn.body.ads.some(a => a.id === adId), 'de advertentie staat in het eigen overzicht');

  const res = await zk('status', { id: adId, status: 'gereserveerd' }, zaak);
  assert.equal(res.body.ad.status, 'gereserveerd');
  assert.equal((await zk('status', { id: adId, status: 'weggegooid' }, zaak)).status, 400, 'een onbekende status is geen status');
  assert.equal((await zk('status', { id: 'bestaatniet', status: 'te-koop' }, zaak)).status, 404);
  // de andere zaak heeft een geldige inlog, maar niet op deze advertentie
  assert.equal((await zk('status', { id: adId, status: 'verkocht' }, andereZaak)).status, 403, 'dit is de advertentie van een ander');
  assert.equal((await zk('verwijder', { id: adId }, andereZaak)).status, 403);
  await zk('status', { id: adId, status: 'te-koop' }, zaak);
});

test('2. een gezin reageert; de zaak leest het gesprek en antwoordt', async () => {
  const r = await rtf('reageer', { id: adId, tekst: 'Hallo, is de vitrinekast er nog?' });
  assert.equal(r.status, 200);
  chatId = r.body.chat.id;

  const pv = await zk('mijn', {}, zaak);
  assert.ok(pv.body.postvak.some(c => c.id === chatId && c.rol === 'verkoper'), 'het gesprek staat in het postvak van de zaak');

  const open = await zk('chat', { chatId }, zaak);
  assert.equal(open.status, 200);
  assert.equal(open.body.chat.berichten.length, 1);
  assert.equal((await zk('chat', { chatId }, andereZaak)).status, 403, 'een derde zaak leest het gesprek niet mee');
  assert.equal((await zk('chat', { chatId: 'bestaatniet' }, zaak)).status, 404);

  const a = await zk('antwoord', { chatId, tekst: 'Ja hoor, hij staat klaar. Kom maar langs de winkel.' }, zaak);
  assert.equal(a.status, 200);
  assert.equal(a.body.chat.berichten.length, 2);
  assert.equal((await zk('antwoord', { chatId, tekst: 'hoi' }, andereZaak)).status, 403, 'en schrijft er ook niet in');
});

test('3. de prijs afspreken: geen bedrag betekent de vraagprijs', async () => {
  /* Een leeg bedrag is hier geen fout maar een keuze: dan geldt de vraagprijs
     van de advertentie (kern/markt/handel/deal.js). Pas als er ook geen
     vraagprijs is, valt er niets af te spreken en komt er een 400. */
  const leeg = await zk('deal/voorstel', { chatId }, zaak);
  assert.equal(leeg.status, 200);
  assert.equal(leeg.body.chat.deal.bedrag, 120, 'zonder bedrag geldt de vraagprijs');

  const d = await zk('deal/voorstel', { chatId, bedrag: 110 }, zaak);
  assert.equal(d.status, 200);
  assert.equal(d.body.chat.deal.status, 'afgesproken');
  assert.equal(d.body.chat.deal.bedrag, 110);
  assert.equal((await zk('deal/voorstel', { chatId, bedrag: 1 }, andereZaak)).status, 403);
});

test('4. samen zijn: pas als beide locaties vers en dichtbij zijn komt de factuur vrij', async () => {
  assert.equal((await zk('deal/hier', { chatId, lat: 'ergens', lng: null }, zaak)).status, 400, 'zonder leesbare locatie gebeurt er niets');

  const alleen = await zk('deal/hier', { chatId, lat: 38.9090, lng: 1.4330 }, zaak);
  assert.equal(alleen.status, 200);
  assert.equal(alleen.body.samen, false, 'met alleen de verkoper ter plekke zijn ze niet samen');

  const ver = await rtf('deal/hier', { chatId, lat: 39.5000, lng: 2.6500 });
  assert.equal(ver.body.samen, false, 'ruim honderd kilometer uit elkaar is niet samen');

  const dichtbij = await rtf('deal/hier', { chatId, lat: 38.9091, lng: 1.4331 });
  assert.equal(dichtbij.body.samen, true, 'een paar meter uit elkaar is samen');
  assert.ok(/^SAL-\d{4}-\d{6}$/.test(dichtbij.body.chat.deal.factuur.nummer), 'de factuur heeft een nummer');
  assert.equal(dichtbij.body.chat.deal.factuur.bedrag, 110);
});

test('5. alleen de koper betaalt: de verkopende zaak kan zijn eigen verkoop niet afstempelen', async () => {
  const poging = await zk('deal/betaal', { chatId, methode: 'apple-pay' }, zaak);
  assert.equal(poging.status, 403, 'de verkoper betaalt niet');
  assert.match(poging.body.error, /koper/i);
  assert.equal((await zk('deal/betaal', { chatId }, andereZaak)).status, 403, 'en een buitenstaander al helemaal niet');

  // de koper betaalt wel, en dan pas is de advertentie verkocht
  const betaald = await rtf('deal/betaal', { chatId, methode: 'apple-pay' });
  assert.equal(betaald.status, 200);
  assert.equal(betaald.body.chat.deal.betaald, true);
  const mijn = await zk('mijn', {}, zaak);
  assert.equal(mijn.body.ads.find(a => a.id === adId).status, 'verkocht', 'de advertentie staat op verkocht');
  assert.equal((await rtf('deal/betaal', { chatId })).status, 409, 'twee keer betalen kan niet');
});

test('6. de AI-hulp van de zaak draait ook zonder sleutel', async () => {
  const tekst = await zk('ai', { soort: 'beschrijving', titel: 'Etalagepop', staat: 'gebruikt' }, zaak);
  assert.equal(tekst.status, 200);
  assert.ok(tekst.body.tekst && tekst.body.tekst.length > 10, 'er komt een bruikbare omschrijving terug');
  const prijs = await zk('ai', { soort: 'prijs', categorie: 'wonen', staat: 'zgan' }, zaak);
  assert.ok(prijs.body.prijs && prijs.body.prijs.midden > 0, 'en een prijsvoorstel');
});

test('7. opruimen: de eigenaar haalt zijn advertentie weg', async () => {
  // eerst vaststellen dat hij er nog staat: op een leeg overzicht slaagt
  // "hij is weg" ook als er nooit iets is weggehaald
  assert.ok((await zk('mijn', {}, zaak)).body.ads.some(a => a.id === adId),
    'de advertentie staat er nog voordat we hem weghalen');

  assert.equal((await zk('verwijder', { id: adId }, zaak)).status, 200);
  const mijn = await zk('mijn', {}, zaak);
  assert.ok(!mijn.body.ads.some(a => a.id === adId), 'de advertentie is uit het overzicht');
  assert.equal((await zk('verwijder', { id: 'bestaatniet' }, zaak)).status, 404);
});
