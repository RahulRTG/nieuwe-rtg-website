/* DE GELDROUTES, TWEE KEER AANGEROEPEN -- beweegt het geld dan een keer?

   WAAROM DEZE TOETS ER IS, en waarom hij niet in IDEMPROEF.json past.

   De brede idempotentieproef (scripts/idemproef-route.js) beoordeelt 115 van de
   3074 routes. Voor de GELDROUTES is die uitslag bijna leeg, en niet omdat ze
   slecht zijn: van de 66 geldroutes staan er 61 op "ongemeten", vrijwel allemaal
   met de reden "de eerste oproep deed geen werk (status 403/404)". De proef
   bouwt een plausibel lijf en een rol, maar komt niet langs de paspoortpoort,
   heeft geen saldo en kent geen echte ref -- dus hij komt er niet in.

   Het gevolg is scherper dan de honderd "onbeschermde" routes waar TAKEN.md
   4.30 het over heeft: van `/api/pay/stuur`, de centrale geldroute van dit
   huis, WEET niemand het. Een veiligheidseigenschap die niet is gemeten op de
   plek waar hij het meeste waard is, is geen eigenschap maar een aanname.

   Deze toets meet het wel, met een ECHT scenario: een geverifieerde koper, een
   echte ontvanger, echt saldo, en per route twee oproepen met dezelfde
   idem-sleutel. Daarna wordt niet naar het ANTWOORD gekeken maar naar het
   GEVOLG -- het saldo en de lijst. Dat is het verschil dat ertoe doet: twee
   gelijke antwoorden met twee afschrijvingen eronder is precies de fout die
   niemand ziet.

   MUTATIES die zijn gedraaid en welke toets erop zakte (LAT.md regel 2):
   - de idem-sleutel uit de aanroep van pay.stuur gehaald (de toets stuurt dan
     twee verse sleutels) -> "hetzelfde betaalverzoek schrijft een keer af" ZAKT (RAAK)
   - de herhalingscontrole uit kern/directpay/verzoek.js gehaald
     -> "hetzelfde betaalverzoek staat er een keer" ZAKT (RAAK)
   - de dubbele-kaart-controle uit kern/wallet.js gehaald
     -> "dezelfde kaart zit er een keer in" ZAKT (RAAK)

   Draai los: node --experimental-sqlite --test test/geldidempotentie.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

let srv, base, koper, ontvanger, ontvangerNaam;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-geldidem-'));

function api(pad, body, token) {
  const h = { 'Content-Type': 'application/json' };
  if (token) h.Authorization = 'Bearer ' + token;
  return fetch(base + pad, { method: 'POST', headers: h, body: JSON.stringify(body || {}) })
    .then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
}
let seq = 0;
async function lid(naam) {
  const u = (Date.now() + (++seq)).toString().slice(-8);
  return (await api('/api/auth/register', { name: naam, email: 'gi' + u + '@x.nl', phone: '06' + u,
    password: 'geheim123', geboortedatum: '1990-04-04', geslacht: 'x', tier: 'rtg', pasApp: 'rtg' })).body.token;
}
const codenaamVan = async (t) => ((await api('/api/state', {}, t)).body.state || {}).user.codename;
const saldoVan = async (t) => Number(((await api('/api/pay/overzicht', {}, t)).body || {}).saldo || 0);

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  base = srv.base;
  /* De koper is het eigenaarsaccount: geverifieerd, dus langs de paspoortpoort
     van RTG Pay. Precies de horde waar de brede proef op stukloopt. */
  koper = (await api('/api/auth/login', { login: 'roellie.i@gmail.com', password: 'Imran', pasApp: 'business' })).body.token;
  assert.ok(koper, 'de koper is ingelogd en geverifieerd');
  ontvanger = await lid('Ontvanger');
  ontvangerNaam = await codenaamVan(ontvanger);
  assert.ok(ontvangerNaam, 'de ontvanger heeft een codenaam');
});
test.after(() => stop(srv));

test('hetzelfde betaalverzoek betaalt de ontvanger EEN keer, ook al druk je twee keer', async () => {
  /* Gemeten aan de ONTVANGER en niet aan de betaler, en dat is geen detail: de
     wallet van de betaler laadt zichzelf bij als er te weinig op staat
     (zorgSaldo/autolaad in kern/pay), dus zijn saldo kan na een betaling hoger
     zijn dan ervoor. Een toets die dat verschil meet, meet de bijlading en niet
     de betaling -- en dat is precies hoe deze toets de eerste keer ten onrechte
     rood stond. De ontvanger krijgt alleen; daar is het verschil de waarheid. */
  const voor = await saldoVan(ontvanger);
  const opdracht = { aan: ontvangerNaam, centen: 250, oms: 'Twee keer tikken', idem: 'stuur-een' };
  const a = await api('/api/pay/stuur', opdracht, koper);
  assert.equal(a.status, 200, JSON.stringify(a.body).slice(0, 200));
  const b = await api('/api/pay/stuur', opdracht, koper);
  assert.equal(b.status, 200, 'een herhaling is geen fout');

  /* NIET naar het antwoord kijken maar naar het GEVOLG. Twee gelijke antwoorden
     met twee bijschrijvingen eronder is de fout die niemand ziet. */
  const na = await saldoVan(ontvanger);
  assert.equal(na - voor, 250, 'er is precies een keer 2,50 bijgeschreven (verschil: ' + (na - voor) + ')');

  // en met een VERSE sleutel gaat het gewoon nog een keer: de rem zit op de herhaling, niet op de route
  const c = await api('/api/pay/stuur', Object.assign({}, opdracht, { idem: 'stuur-twee' }), koper);
  assert.equal(c.status, 200);
  assert.equal((await saldoVan(ontvanger)) - voor, 500, 'een echte tweede betaling telt wel');
});

test('hetzelfde betaalverzoek van een zaak staat er EEN keer, ook zonder idem', async () => {
  /* GEEN STILLE OVERSLAAN-TAK. Hier stond eerst `if (!zaak) return;`, en die
     tak deed precies waar LAT.md regel 9 voor waarschuwt: de toets bleef groen
     terwijl hij niets beproefde. Een mutatie die de herhalingscontrole
     weghaalde, liet hem gewoon slagen -- gevonden doordat die mutatie NIET
     zakte. Nu faalt hij als de zaak er niet is, want dan is de uitslag onbekend
     en niet goed. */
  const roster = (await api('/api/supplier/roster', { code: 'KIKUNOI' })).body;
  const staf = (roster.staff || []).find(x => x.role !== 'manager') || (roster.staff || [])[0];
  assert.ok(staf, 'de demo-zaak KIKUNOI heeft personeel om mee in te loggen');
  const zaak = (await api('/api/supplier/login', { code: 'KIKUNOI', staffId: staf.id, pin: '5678' })).body.token;
  assert.ok(zaak, 'de zaak is ingelogd');
  const opdracht = { codename: ontvangerNaam, centen: 700, omschrijving: 'Tafel 4' };
  const a = await api('/api/supplier/betaalverzoek', opdracht, zaak);
  assert.equal(a.status, 200, JSON.stringify(a.body).slice(0, 200));
  const b = await api('/api/supplier/betaalverzoek', opdracht, zaak);
  assert.equal(b.status, 200);
  assert.equal(b.body.herhaald, true, 'de tweede wordt als dubbeltik herkend');
  assert.equal(b.body.verzoek.ref, a.body.verzoek.ref, 'en levert hetzelfde verzoek op');

  /* De lijst van de GAST, en dat is een andere route dan die van RTG Pay: een
     betaalverzoek van een zaak loopt over directpay (/api/betaal/verzoeken) en
     niet over /api/pay/verzoeken. Twee lijsten met bijna dezelfde naam -- hier
     stond eerst de verkeerde, en de toets zag toen nul verzoeken in plaats van
     een. */
  const open = (await api('/api/betaal/verzoeken', {}, ontvanger)).body;
  const lijst = (open.verzoeken || []).filter(v => v.bedrag === 700);
  assert.equal(lijst.length, 1, 'de gast ziet er EEN, niet twee (' + lijst.length + ')');
});

test('dezelfde kaart zit EEN keer in de wallet', async () => {
  const kaart = { soort: 'klantenkaart', titel: 'Bakkerij Vega', code: 'VEGA-9911' };
  const a = await api('/api/wallet/voeg', kaart, ontvanger);
  assert.equal(a.status, 200);
  const b = await api('/api/wallet/voeg', kaart, ontvanger);
  assert.equal(b.status, 200, 'een herhaling is geen fout');
  assert.equal(b.body.herhaald, true);
  const items = ((await api('/api/wallet', {}, ontvanger)).body.items || []).filter(x => x.code === 'VEGA-9911');
  assert.equal(items.length, 1, 'er staat er een in de wallet (' + items.length + ')');
});
