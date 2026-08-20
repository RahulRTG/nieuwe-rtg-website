/* De geld-regie van de boardroom: RTG bepaalt de pasprijzen (publiek
   zichtbaar, de voorwaarden volgen live), de interne partnervergoeding per
   genre of per zaak, en het RTG-ledenvoordeel per genre (RTG legt bij; de
   zaak houdt het volle bedrag, dus de nettoprijzen-belofte blijft staan).
   Draai los: node --experimental-sqlite --test test/geldregie.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

let srv, base, office, lid, sup, genre;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-geld-'));

function api(pad, body, token) {
  const h = { 'Content-Type': 'application/json' };
  if (token) h.Authorization = 'Bearer ' + token;
  return fetch(base + pad, { method: 'POST', headers: h, body: JSON.stringify(body || {}) })
    .then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
}

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  base = srv.base;
  // boardroom-werk vraagt de eigenaar zelf (de boardroom-poort): zijn accountlogin opent ook het kantoor
  office = (await api('/api/auth/login', { login: 'roellie.i@gmail.com', password: 'Imran', pasApp: 'business' })).body.token;
  const u = Date.now().toString().slice(-8);
  lid = (await api('/api/auth/register', { name: 'Geldlid', email: 'geld' + u + '@x.nl', phone: '06' + u,
    password: 'geheim123', geboortedatum: '1990-05-05', geslacht: 'v', tier: 'rtg', pasApp: 'rtg' })).body.token;
  // de demo-zaak KIKUNOI met een vaste kaart, om het ledenvoordeel echt af te rekenen
  const login = await api('/api/supplier/login', { username: 'rahul', password: 'Imran' });
  sup = { token: login.body.token, code: 'KIKUNOI' };
  await api('/api/supplier/menu', { menu: [
    { id: 'ramen', name: 'Tonkotsu Ramen', price: 22, publiekePrijs: 22, cat: 'Warm', station: 'keuken', sectie: 'warm' }
  ] }, sup.token);
  assert.ok(office && lid && sup.token, 'kantoor, lid en zaak zijn ingelogd');
});
test.after(() => {
  stop(srv && srv.child);
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('1. pasprijzen: de ladder publiek zichtbaar, met bodems die houden', async () => {
  const p = await api('/api/pasprijzen', {});
  assert.equal(p.status, 200);
  assert.equal(p.body.passen.gratis.maandCenten, 0, 'de gratis app kost niets');
  assert.equal(p.body.passen.gratis.vast, true, 'en dat staat vast');
  assert.equal(p.body.passen.rtg.maandCenten, 6500, 'RTG Pass 65 euro ex btw');
  assert.equal(p.body.passen.rtg.rtfCenten, 1950, '30% naar de RTFoundation');
  /* De twee bovenste treden zijn CONTRACTUEEL: een vanaf, geen prijs. Stond hier
     een maandbedrag, dan zou de voorwaardenpagina een bedrag publiceren dat voor
     geen enkele klant het afgesproken bedrag hoeft te zijn. */
  assert.equal(p.body.passen.business.vanafCenten, 500000, 'Business vanaf 5.000 euro');
  assert.equal(p.body.passen.business.maandCenten, undefined, 'en dus geen maandbedrag');
  assert.equal(p.body.passen.lifestyle.vanafCenten, 2000000, 'Lifestyle vanaf 20.000 euro');
  assert.equal(p.body.passen.lifestyle.maandCenten, undefined, 'en dus geen maandbedrag');

  // de boardroom zet een nieuwe RTG-prijs en het publieke endpoint volgt meteen
  const zet = await api('/api/office/geld/pasprijs', { pas: 'rtg', euro: 70 }, office);
  assert.equal(zet.status, 200);
  const na = await api('/api/pasprijzen', {});
  assert.equal(na.body.passen.rtg.maandCenten, 7000);
  assert.equal(na.body.passen.rtg.rtfCenten, 2100);

  // de vaste afspraken zijn niet te verzetten
  assert.equal((await api('/api/office/geld/pasprijs', { pas: 'gratis', euro: 5 }, office)).status, 400);
  assert.equal((await api('/api/office/geld/pasprijs', { pas: 'business', euro: 5000 }, office)).status, 400,
    'ook een bedrag BOVEN de bodem gaat niet in de prijslijst: het hoort op het contract');
  // en de bodem van de trede zelf houdt, ook via de API
  assert.equal((await api('/api/office/geld/pasprijs', { pas: 'rtg', euro: 40 }, office)).status, 400,
    'onder de bodem van 65 euro kan de RTG Pass niet');
  await api('/api/office/geld/pasprijs', { pas: 'rtg', euro: 65 }, office);
});

/* WAT HIER STOND was een toets op een knop die niet had moeten bestaan: een
   partnervergoeding per genre, met een eigen afspraak per zaak die voorging, tot
   30 procent. Ondertussen beloofden de partnervoorwaarden 0% commissie en
   printten twee schermen hard "RTG-commissie EUR 0,00".

   De toets was dus groen op gedrag dat in strijd was met het contract -- en dat
   is de reden dat hij hier vervangen is in plaats van aangepast. De invarianten
   zelf staan in test/commercie.test.js; dit is de weg erheen via de API. */
test('2. partnervergoeding: nul, en er valt niets te zetten', async () => {
  const o = await api('/api/office/geld', {}, office);
  assert.equal(o.status, 200);
  const zaak = o.body.zaken.find(z => z.code === 'KIKUNOI');
  genre = zaak.genre;
  assert.equal(zaak.rate, 0, 'elke zaak staat op nul, wat er ook in haar rij is opgeslagen');
  assert.equal(o.body.partnervergoeding.overOmzet, 0);

  // en de knop is weg: zetten wordt geweigerd, met de reden en met wat het wel kan zijn
  const g = await api('/api/office/geld/commissie', { genre, pct: 10 }, office);
  assert.equal(g.status, 400, 'een commissie zetten hoort niet te kunnen');
  assert.match(g.body.error, /geen commissie/);
  const per = await api('/api/office/geld/commissie', { code: 'KIKUNOI', pct: 12.5 }, office);
  assert.equal(per.status, 400, 'ook niet per zaak');

  // en na twee geweigerde pogingen staat alles nog steeds op nul
  const na = await api('/api/office/geld', {}, office);
  assert.equal(na.body.zaken.find(z => z.code === 'KIKUNOI').rate, 0);

  // wat RTG wel in rekening kan brengen, staat er benoemd bij
  assert.ok(na.body.vergoedingssoorten.length >= 4, 'de benoemde diensten staan op het bord');
  assert.ok(na.body.vergoedingssoorten.every(v => v.overOmzet === false),
    'en geen ervan neemt een aandeel in de omzet van de partner');
});

test('3. ledenvoordeel per genre: RTG legt bij; het lid ziet het, de zaak houdt het volle bedrag', async () => {
  const zet = await api('/api/office/geld/korting', { genre, pct: 10 }, office);
  assert.equal(zet.status, 200);
  const plaats = await api('/api/order', { supplierCode: 'KIKUNOI', items: [{ id: 'ramen', qty: 1 }] }, lid);
  assert.equal(plaats.status, 200, JSON.stringify(plaats.body));
  const betaal = await api('/api/order/pay', { ref: plaats.body.order.ref }, lid);
  assert.equal(betaal.status, 200);
  assert.equal(betaal.body.order.total, 22, 'de zaak houdt het volle bedrag (nettoprijzen-belofte)');
  assert.equal(betaal.body.order.regieKorting, 2.2, 'het lid krijgt 10% RTG-ledenvoordeel');
  // voordeel op nul zetten haalt de regel weg
  await api('/api/office/geld/korting', { genre, pct: 0 }, office);
  const o2 = await api('/api/office/geld', {}, office);
  assert.equal(o2.body.kortingen[genre], undefined);
  // grenzen: meer dan 50% kan niet
  assert.equal((await api('/api/office/geld/korting', { genre, pct: 60 }, office)).status, 400);
});
