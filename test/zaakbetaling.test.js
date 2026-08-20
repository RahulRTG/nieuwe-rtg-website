/* DE DRIE BETAALPADEN VERPLAATSEN ECHT GELD.

   Een bestelling, een lopende rekening en een rit zetten `paid = true`,
   schreven een factuur en stuurden een bericht -- en verplaatsten geen cent. Er
   stond "betaald" op het scherm en er was nooit iets geboekt. Zolang alles
   binnen dezelfde demo bleef viel dat niet op; zodra een zaak zijn RTG
   Pay-saldo wil uitbetalen (apps/zaakpay.html), is het het verschil tussen
   omzet en niets.

   Wat hier wordt vastgehouden, en het is geen van alle "de knop geeft 200":

   1. het saldo van de ZAAK groeit met precies het bedrag van de bon;
   2. de wallet van het LID daalt met datzelfde bedrag, en het grootboek sluit;
   3. verzilverde punten landen in de WALLET en niet in een tweede saldo -- het
      stuk dat pas kon toen de drie paden echt betaalden;
   4. lukt de betaling niet, dan blijft de bestelling ONBETAALD (geen vlag zonder
      geld -- precies de fout die deze ronde wegneemt, maar dan andersom);
   5. een annulering boekt het geld ECHT terug, en maar een keer.

   Draai los: node --experimental-sqlite --test test/zaakbetaling.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

let srv, base;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-zaakbet-'));

const api = (pad, body, token) => fetch(base + pad, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
  body: JSON.stringify(body || {})
}).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));

const MINI_PNG = 'data:image/png;base64,' +
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

let teller = 0;
async function lid() {
  const u = Date.now() + '-' + (++teller);
  /* Met telefoonnummer, want een bestelling brengt een DERDE partij in beeld en
     dan vraagt de gegevenspoort dat nummer (kern/gegevenspoort.js). Deze toets
     loopt die poort gewoon af in plaats van hem te omzeilen. */
  const r = await api('/api/auth/register', {
    name: 'Zaakbet Lid ' + teller, email: 'zb-' + u + '@toets.example',
    phone: '06' + String(Date.now()).slice(-8), password: 'geheim123',
    geboortedatum: '1985-05-05', geslacht: 'v', tier: 'rtg', pasApp: 'rtg'
  });
  assert.ok(r.body.token, 'registreren hoort een token te geven');
  assert.equal((await api('/api/verify/upload', { image: MINI_PNG }, r.body.token)).status, 200);
  const o = await api('/api/pay/overzicht', {}, r.body.token);
  return { token: r.body.token, codenaam: o.body.codenaam };
}
const zaakSaldo = async (tok) => (await api('/api/supplier/pay/overzicht', {}, tok)).body.saldo;
const walletSaldo = async (tok) => (await api('/api/pay/overzicht', {}, tok)).body.saldo;

/* Een bestelling plaatsen bij de zaak uit de seed. De kaart komt van de ZAAK
   zelf (de leverancier-state), zodat deze toets niet op een verzonnen
   artikel-id leunt. Bewust geen bar-gerechten: die dragen een leeftijdsgrens en
   dat is hier niet het onderwerp. */
let KAART = null;
async function kaartVanZaak() {
  if (KAART) return KAART;
  const st = await api('/api/supplier/state', {}, supToken);
  const state = st.body.state || {};
  const menu = (state.supplier && state.supplier.menu) || state.menu || [];
  KAART = menu.filter(m => m.station !== 'bar');
  assert.ok(KAART.length, 'de zaak heeft een kaart: ' + JSON.stringify(Object.keys(state)).slice(0, 200));
  return KAART;
}
async function bestel(tok, aantal) {
  const kaart = await kaartVanZaak();
  const b = await api('/api/order', { supplierCode: 'KIKUNOI', items: [{ id: kaart[0].id, qty: aantal || 1 }] }, tok);
  assert.ok(b.body.order, 'bestellen hoort te lukken: ' + JSON.stringify(b.body).slice(0, 200));
  return b.body.order;
}

let supToken;
test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  base = srv.base;
  const s = await api('/api/supplier/login', { username: 'rahul', password: 'Imran' });
  supToken = s.body.token;
  assert.ok(supToken, 'de zaak logt in als manager');
});
test.after(() => {
  stop(srv && srv.child);
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

/* MUTATIE GEZIEN ZAKKEN: de aanroep van rekenAf in
   server/kern/lidacties/betalen.js weggehaald (alsof betalen alleen de vlag
   omzet); deze toets zakte op "het saldo van de zaak groeit met de bon".
   Teruggedraaid, daarna groen. */
test('een betaalde bestelling verplaatst geld: uit de wallet, in de kas van de zaak', async () => {
  const a = await lid();
  await api('/api/pay/oplaad', { centen: 20000, idem: 'zb-oplaad' }, a.token);

  const voorZaak = await zaakSaldo(supToken);
  const voorLid = await walletSaldo(a.token);
  const order = await bestel(a.token, 1);
  const centen = Math.round(order.total * 100);
  assert.ok(centen > 0, 'de bon heeft een bedrag: ' + order.total);

  const betaald = await api('/api/order/pay', { ref: order.ref }, a.token);
  assert.equal(betaald.status, 200, JSON.stringify(betaald.body).slice(0, 200));
  assert.equal(betaald.body.order.paid, true);

  assert.equal(await zaakSaldo(supToken), voorZaak + centen, 'het saldo van de zaak groeit met de bon');
  assert.equal(await walletSaldo(a.token), voorLid - centen, 'en de wallet van het lid daalt met datzelfde bedrag');

  const gezond = await fetch(base + '/api/pay/gezond').then(r => r.json());
  assert.equal(gezond.klopt, true, 'de som van alle saldi is nog steeds exact nul');
});

/* EEN knop: te weinig saldo is geen weigering maar een bijlading. Dat is de
   belofte van RTG Pay en die hoort ook op dit pad te gelden.

   MUTATIE GEZIEN ZAKKEN: zorgSaldo() uit kern/pay/zaakbetaling.js weggehaald;
   deze toets zakte op "zonder saldo lukt het toch". Teruggedraaid, daarna groen. */
test('betalen met een lege wallet laadt zelf bij en gaat gewoon door', async () => {
  const a = await lid();
  assert.equal(await walletSaldo(a.token), 0, 'deze wallet begint leeg');
  const order = await bestel(a.token, 1);
  const betaald = await api('/api/order/pay', { ref: order.ref }, a.token);
  assert.equal(betaald.status, 200, 'zonder saldo lukt het toch: ' + JSON.stringify(betaald.body).slice(0, 200));
  assert.ok(betaald.body.bijgeladen > 0, 'en er is echt bijgeladen: ' + betaald.body.bijgeladen);
});

/* EEN SALDO IN PLAATS VAN TWEE.

   Verzilverde punten stonden als APART bedrag naast RTG Pay (`tegoedCenten`):
   een euro-aanspraak op RTG die alleen als korting kon worden ingelost, op de
   drie betaalpaden die hem kenden. Twee bedragen die allebei geld van hetzelfde
   lid voorstellen -- precies waar kern/geldwereld.js voor waarschuwt.

   Dat kon pas weg toen de drie betaalpaden zelf geld gingen verplaatsen: zolang
   ze dat niet deden, was verzilverd tegoed in de wallet juist ONbesteedbaar.
   Nu landt het in de wallet, en is walletsaldo de enige vorm die overal werkt.

   Deze toets houdt vast dat het bedrag ECHT overkomt (en niet alleen een veld
   ophoogt), dat het tweede saldo leeg blijft, en dat het grootboek sluit --
   want dit geld komt van de huisrekening en dat hoort een boeking te zijn.

   MUTATIE GEZIEN ZAKKEN: in kern/ervaring/leden/punten.js de tak die naar
   pay.huisUit gaat overgeslagen (terug naar het oude tegoed); deze toets zakte
   op "het bedrag staat in de wallet". Teruggedraaid, daarna groen. */
test('verzilverde punten landen in de wallet, niet in een tweede saldo', async () => {
  const a = await lid();
  await api('/api/pay/oplaad', { centen: 50000, idem: 'saldo-oplaad' }, a.token);

  /* Punten verdienen langs de gewone weg: doorbestellen TOT er genoeg is, met
     een harde bovengrens zodat een kapotte puntenmotor deze toets laat hangen
     noch stil laat slagen. Een eerdere versie had hier `if (saldo < 100) return`
     en sloeg zichzelf al die tijd stil over. */
  let saldo = 0;
  for (let ronde = 0; ronde < 12 && saldo < 100; ronde++) {
    const o = await bestel(a.token, 20);
    assert.equal((await api('/api/order/pay', { ref: o.ref }, a.token)).status, 200, 'ronde ' + ronde);
    saldo = (await api('/api/punten', {}, a.token)).body.saldo;
  }
  assert.ok(saldo >= 100, 'er zijn honderd punten verdiend om te verzilveren, kreeg: ' + saldo);

  const voorLid = await walletSaldo(a.token);
  const verzilverd = await api('/api/punten/verzilver', { punten: 100 }, a.token);
  assert.equal(verzilverd.status, 200, 'verzilveren hoort te lukken: ' + JSON.stringify(verzilverd.body).slice(0, 200));

  assert.equal(await walletSaldo(a.token), voorLid + 1000, 'het bedrag staat in de wallet: honderd punten is tien euro');
  assert.equal(verzilverd.body.naarWalletCenten, 1000, 'en het antwoord zegt dat ook');
  assert.equal(verzilverd.body.tegoedCenten, 0, 'het tweede saldo blijft leeg');
  assert.equal(verzilverd.body.saldo, saldo - 100, 'en de punten zijn afgeschreven');

  const gezond = await fetch(base + '/api/pay/gezond').then(r => r.json());
  assert.equal(gezond.klopt, true, 'dit geld komt van de huisrekening, dus het grootboek sluit');
});

/* GEEN VLAG ZONDER GELD, EN GEEN GELD ZONDER BOEKING.

   TWEE KEER EEN TOETS DIE NIETS MAT, en dat hoort hier te staan. De eerste zette
   RTG_BETALEN_UIT=1 en verwachtte dat de betaling zou stranden in de betaalcode;
   die schakelaar wordt al in de middleware afgevangen (opzet/betaalstop.js), dus
   /api/order/pay kwam nooit bij de code die het onderwerp was. De tweede probeerde
   over de boekingsgrens van RTG Pay te komen met een grote bestelling -- maar een
   regel is gemaximeerd op twintig stuks en de kaart van de seed is goedkoop, dus
   die grens is via de route helemaal niet te raken zonder de halve server uit te
   zetten.

   Daarom staat deze toets op de MODULE. Dat is geen omweg om de routes heen: de
   gelukkige paden hierboven lopen wel over HTTP, en dit is het stuk dat daar niet
   bij kan. Wat hier wordt vastgehouden:

   1. boven de boekingsgrens weigert betaalZaak en boekt hij NIETS -- geen halve
      betaling, geen enkele regel;
   2. mislukt de betaling, dan komt het punten-tegoed terug: het is afgetrokken
      voordat er betaald werd, dus anders is het weg zonder dat er iets voor is
      gekocht;
   3. en bij een HERHALING (dezelfde idem-sleutel, het geld ging al bij een eerdere
      poging over) komt het ook terug. Dat is het gemene geval: het antwoord is
      `ok`, dus wie alleen op `.error` kijkt ziet het niet, en het lid raakt stil
      tegoed kwijt bij precies de retry waar idempotentie voor bestaat.

   MUTATIES GEZIEN ZAKKEN: de grensregel in kern/pay/zaakbetaling.js weggehaald
   (punt 1 zakte: er werd geboekt); in kern/lidacties/afrekenen.js de regel
   `if (r.error) { herstelTegoed(...) }` weggehaald (punt 2 zakte); en de regel
   `if (r.herhaald) herstelTegoed(...)` weggehaald (punt 3 zakte). Alle drie
   teruggedraaid, daarna groen. */
test('een mislukte of herhaalde betaling laat geen boeking en geen verdampt tegoed achter', async () => {
  const MAX = 500000;   // MAX_CENTEN uit kern/pay/stand.js
  const geboekt = [];
  const nepPay = require('../server/kern/pay/zaakbetaling')({
    schoon: (x, n) => String(x == null ? '' : x).slice(0, n),
    rekLid: c => 'lid:' + c, rekPartner: c => 'partner:' + c, saldoVan: () => 0,
    metIdem: (sleutel, afdruk, werk) => werk(),
    boekAsync: async (b) => { geboekt.push(b); return { ok: true, boeking: { id: 'B' + geboekt.length } }; },
    zorgSaldo: async () => ({ ok: true, bijgeladen: 0 }),
    seintje: () => {}, MIN_CENTEN: 1, MAX_CENTEN: MAX
  });

  // 1. boven de grens: weigeren, en niets boeken
  const teGroot = await nepPay.betaalZaak({ codenaam: 'A', supplierCode: 'Z', centen: MAX + 1, bijlageCenten: 0 });
  assert.equal(teGroot.status, 400, 'boven de boekingsgrens hoort een weigering');
  assert.match(teGroot.error, /te groot|maximaal/i, 'met een uitleg: ' + teGroot.error);
  assert.deepEqual(geboekt, [], 'en er is geen enkele regel geboekt');

  // en eronder gaat hij gewoon door (LAT.md regel 9: ook de positieve kant)
  const goed = await nepPay.betaalZaak({ codenaam: 'A', supplierCode: 'Z', centen: 1000, bijlageCenten: 250 });
  assert.equal(goed.ok, true, JSON.stringify(goed).slice(0, 160));
  assert.equal(geboekt.length, 2, 'twee boekingen: het lid en de bijlage van RTG');
  assert.equal(geboekt[0].van, 'lid:A');
  assert.equal(geboekt[1].van, 'extern:treasury');

  // 2 en 3. het tegoed komt terug bij een fout EN bij een herhaling
  const terug = [];
  const antwoorden = [{ status: 402, error: 'Onvoldoende saldo.' }, { ok: true, herhaald: true }];
  const rekenAf = require('../server/kern/lidacties/afrekenen')({
    pay: { betaalZaak: async () => antwoorden.shift() },
    liveCodename: () => 'A',
    herstelTegoed: (key, euro) => { terug.push(euro); }
  }).rekenAf;

  const mislukt = await rekenAf({ session: { key: 'k' }, supplierCode: 'Z', bedrag: 20, korting: 5, soort: 'bestelling' });
  assert.equal(mislukt.status, 402, 'de fout gaat onverkort terug naar de aanroeper');
  assert.deepEqual(terug, [5], 'en het tegoed is teruggegeven');

  const herhaald = await rekenAf({ session: { key: 'k' }, supplierCode: 'Z', bedrag: 20, korting: 5, soort: 'bestelling' });
  assert.equal(herhaald.ok, true, 'een herhaling is geen fout');
  assert.deepEqual(terug, [5, 5], 'maar het tegoed van DEZE poging hoort wel terug');
});

/* MUTATIE GEZIEN ZAKKEN: geldTerug() in kern/ervaring/leden/annuleren.js
   overgeslagen; deze toets zakte op "het geld is terug bij het lid".
   Teruggedraaid, daarna groen. */
test('een annulering boekt het geld echt terug, en maar een keer', async () => {
  const a = await lid();
  await api('/api/pay/oplaad', { centen: 20000, idem: 'ann-oplaad' }, a.token);
  const order = await bestel(a.token, 1);
  const centen = Math.round(order.total * 100);
  assert.equal((await api('/api/order/pay', { ref: order.ref }, a.token)).status, 200);

  const naBetalen = await walletSaldo(a.token);
  const zaakNa = await zaakSaldo(supToken);

  const weg = await api('/api/annuleer', { soort: 'order', ref: order.ref }, a.token);
  assert.equal(weg.status, 200, JSON.stringify(weg.body).slice(0, 200));
  assert.equal(await walletSaldo(a.token), naBetalen + centen, 'het geld is terug bij het lid');
  assert.equal(await zaakSaldo(supToken), zaakNa - centen, 'en uit de kas van de zaak');

  // en nog een keer annuleren levert niets op
  const weer = await api('/api/annuleer', { soort: 'order', ref: order.ref }, a.token);
  assert.notEqual(weer.status, 200, 'een tweede annulering hoort te weigeren');
  assert.equal(await walletSaldo(a.token), naBetalen + centen, 'het saldo bewoog niet nog een keer');

  const gezond = await fetch(base + '/api/pay/gezond').then(r => r.json());
  assert.equal(gezond.klopt, true, 'en het grootboek sluit nog steeds');
});

/* DE REKENING: EEN BETALING, MAAR ANNULEREN GAAT PER BON.

   Deze staat bewust ACHTERAAN: hij zet de zaak op "achteraf betalen", en dat
   verandert wat een bestelling wordt voor alles wat erna komt.

   Waarom hij bestaat: een rekening wordt in EEN keer betaald -- een boeking
   voor het geheel, want het lid rekent een keer af -- maar annuleren gaat per
   BON. Stond de betaal-marker alleen op de eerste bon, dan meldt het annuleren
   van bon twee "geld retour" zonder dat er iets terugkomt, en zou het annuleren
   van bon een de HELE rekening terugboeken voor een enkele bon. De marker wordt
   daarom verdeeld met de grootste-restmethode, zodat de som exact gelijk is aan
   wat er is geboekt.

   MUTATIE GEZIEN ZAKKEN: de verdeling vervangen door de marker alleen op
   bonnen[0] te zetten (zoals hij eerst was); deze toets zakte op "elke bon
   draagt zijn eigen deel". Teruggedraaid, daarna groen. */
test('een rekening betaalt in een keer, en elke bon draagt zijn eigen deel terug', async () => {
  // de zaak op achteraf betalen zetten
  const roster = await api('/api/supplier/roster', { code: 'KIKUNOI' });
  const mgr = (roster.body.staff || []).find(x => x.role === 'manager') || (roster.body.staff || [])[0];
  const mtok = (await api('/api/supplier/login', { code: 'KIKUNOI', staffId: mgr.id, pin: '1234' })).body.token;
  await api('/api/supplier/settings', { code: 'KIKUNOI', opties: { betaalVooraf: false } }, mtok);

  const a = await lid();
  await api('/api/pay/oplaad', { centen: 30000, idem: 'rek-oplaad' }, a.token);

  const b1 = await bestel(a.token, 1);
  const b2 = await bestel(a.token, 2);
  assert.equal(b1.betaalMoment, 'achteraf', 'de zaak laat achteraf betalen');

  const voorZaak = await zaakSaldo(supToken);
  const voorLid = await walletSaldo(a.token);
  const som = Math.round((b1.total + b2.total) * 100);

  const bet = await api('/api/rekening/betaal', { supplierCode: 'KIKUNOI' }, a.token);
  assert.equal(bet.status, 200, JSON.stringify(bet.body).slice(0, 200));
  assert.equal(await zaakSaldo(supToken), voorZaak + som, 'de zaak ontvangt de hele rekening');
  assert.equal(await walletSaldo(a.token), voorLid + (bet.body.bijgeladen || 0) - som, 'en het lid betaalt hem in een keer');

  /* En nu de kern: de TWEEDE bon annuleren hoort precies ZIJN deel terug te
     boeken -- niet niets, en niet de hele rekening. */
  const naZaak = await zaakSaldo(supToken);
  const naLid = await walletSaldo(a.token);
  const weg = await api('/api/annuleer', { soort: 'order', ref: b2.ref }, a.token);
  assert.equal(weg.status, 200, JSON.stringify(weg.body).slice(0, 200));

  const deel2 = Math.round(b2.total * 100);
  assert.equal(await walletSaldo(a.token), naLid + deel2, 'elke bon draagt zijn eigen deel');
  assert.equal(await zaakSaldo(supToken), naZaak - deel2, 'en dat komt uit de kas van de zaak');

  const gezond = await fetch(base + '/api/pay/gezond').then(r => r.json());
  assert.equal(gezond.klopt, true, 'het grootboek sluit');
});
