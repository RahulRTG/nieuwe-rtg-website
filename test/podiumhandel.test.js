/* DE VERKOOPWERELD VAN HET PODIUM -- de kraam naast de uitzending.

   Zone 'handel' (kern/podium/zones.js) laat een maker productkaarten klaarzetten
   -- naam, prijs, voorraad -- waar een kijker tijdens de uitzending op afrekent.
   Het geld loopt langs precies dezelfde RTG Pay-route als een cadeau en een
   kaartje: er is geen tweede betaalweg en geen tweede saldo.

   WAT HIER BEWEZEN MOET WORDEN:
     - de kraam bestaat alleen in deze wereld (in de open zaal is er geen);
     - kopen haalt er echt een van de voorraad af, en uitverkocht is uitverkocht;
     - een dubbeltik koopt er geen twee (dezelfde idem = hetzelfde antwoord);
     - de zaal hoort WEL dat er een weg is en NIET wie hem kocht;
     - de bestelling staat bij de maker, met de leveringsafspraak die hij zelf
       op de kaart heeft gezet -- want RTG bezorgt niets, en dat mag het scherm
       dus ook niet beloven.

   Draai los: node --experimental-sqlite --test test/podiumhandel.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-podiumhandel-'));
let srv, base, office;
let maker, koper, tweede, openMaker;
let kanaalId, openId, sjaalId, laatsteId;

function api(pad, body, token) {
  const h = { 'Content-Type': 'application/json' };
  if (token) h.Authorization = 'Bearer ' + token;
  return fetch(base + pad, { method: 'POST', headers: h, body: JSON.stringify(body || {}) })
    .then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
}
/* Meeluisteren op de live-verbinding van EEN lid. De belofte "de zaal hoort dat
   er een weg is, niet wie hem kocht" gaat over wat er over die draad gaat, en
   die is met een lijst opvragen niet te controleren. */
function luister(token) {
  const ac = new AbortController();
  const brokken = [];
  const klaar = fetch(base + '/api/stream?token=' + token, { signal: ac.signal })
    .then(async (r) => {
      const lezer = r.body.getReader(); const dec = new TextDecoder();
      for (;;) { const { done, value } = await lezer.read(); if (done) break; brokken.push(dec.decode(value)); }
    }).catch(() => {});
  return { tekst: () => brokken.join(''), stop: () => { ac.abort(); return klaar; } };
}
const wacht = (ms) => new Promise(r => setTimeout(r, ms));

let seq = 0;
async function lid(naam) {
  const u = (Date.now() + (++seq)).toString().slice(-8);
  const reg = await api('/api/auth/register', { name: naam, email: 'ph' + u + '@x.nl', phone: '06' + u,
    password: 'geheim12345', geboortedatum: '1990-01-01', tier: 'rtg', pasApp: 'rtg' });
  assert.ok(reg.body.token, naam + ' is aangemeld: ' + JSON.stringify(reg.body).slice(0, 120));
  const st = await api('/api/state', {}, reg.body.token);
  return { token: reg.body.token, naam, codenaam: st.body.state.user.codename };
}

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  base = srv.base;
  office = (await api('/api/office/login', { code: 'RTG-OFFICE' })).body.token;
  maker = await lid('Marktkoopman');
  koper = await lid('Koper');
  tweede = await lid('Tweede koper');
  openMaker = await lid('Gewone maker');

  const aan = await api('/api/podium/kanaal/aanmeld', { naam: 'De kraam', zone: 'handel', genre: 'lifestyle' }, maker.token);
  assert.equal(aan.status, 200, JSON.stringify(aan.body).slice(0, 160));
  kanaalId = aan.body.kanaal.id;
  await api('/api/office/podium/beslis', { id: kanaalId, besluit: 'goedgekeurd' }, office);
  await api('/api/podium/live', { aan: true, titel: 'Zaterdagmarkt' }, maker.token);

  const open = await api('/api/podium/kanaal/aanmeld', { naam: 'Gewoon kanaal', zone: 'open' }, openMaker.token);
  openId = open.body.kanaal.id;
  await api('/api/office/podium/beslis', { id: openId, besluit: 'goedgekeurd' }, office);
});
test.after(() => {
  stop(srv && srv.child);
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('1. de kraam bestaat alleen in de verkoopwereld', async () => {
  const niet = await api('/api/podium/waar', { naam: 'Mok', centen: 1200, voorraad: 3 }, openMaker.token);
  assert.equal(niet.status, 409, 'in de open zaal staat geen kraam');
  assert.match(niet.body.error, /In deze zone wordt niets verkocht/);

  const zonderKanaal = await api('/api/podium/waar', { naam: 'Mok', centen: 1200 }, koper.token);
  assert.equal(zonderKanaal.status, 404, 'en wie geen kanaal heeft, heeft ook geen kraam');
});

test('2. een productkaart heeft een naam en een prijs, anders is het geen kaart', async () => {
  const geenNaam = await api('/api/podium/waar', { centen: 1200 }, maker.token);
  assert.equal(geenNaam.status, 400);
  const geenPrijs = await api('/api/podium/waar', { naam: 'Sjaal' }, maker.token);
  assert.equal(geenPrijs.status, 400);
  assert.match(geenPrijs.body.error, /prijs/);

  const kaart = await api('/api/podium/waar', { naam: 'Wollen sjaal', centen: 2500, voorraad: 2,
    levering: 'Afhalen in Haarlem, na bericht in de chat.' }, maker.token);
  assert.equal(kaart.status, 200, JSON.stringify(kaart.body).slice(0, 160));
  sjaalId = kaart.body.waar.id;
  assert.equal(kaart.body.waar.voorraad, 2);

  // en een tweede kaart die uit staat: klaargezet, maar nog niet te koop
  const uit = await api('/api/podium/waar', { naam: 'Nog geheim', centen: 999, voorraad: 5, aan: false }, maker.token);
  assert.equal(uit.status, 200);
  laatsteId = uit.body.waar.id;
  assert.equal(uit.body.waren.length, 2, 'de maker ziet allebei zijn kaarten');
});

test('3. de kijker ziet de kraam, maar alleen wat aanstaat', async () => {
  const zaal = await api('/api/podium/kanalen', { zone: 'handel' }, koper.token);
  assert.ok(zaal.body.geld.includes('verkoop'), 'in deze wereld mag verkocht worden');
  const kanaal = (zaal.body.kanalen || []).find(k => k.id === kanaalId);
  assert.ok(kanaal, 'het kanaal staat in de zaal');
  assert.equal(kanaal.waren.length, 1, 'alleen de kaart die aanstaat');
  assert.equal(kanaal.waren[0].naam, 'Wollen sjaal');
  assert.equal(kanaal.waren[0].centen, 2500);
  assert.match(kanaal.waren[0].levering, /Afhalen/, 'met de leveringsafspraak van de maker erbij');

  const gesloten = await api('/api/podium/koop', { id: kanaalId, waarId: laatsteId, idem: 'x1' }, koper.token);
  assert.equal(gesloten.status, 404, 'wat uitstaat is niet te kopen, ook niet met het id');
});

test('4. kopen haalt er een van de voorraad af, en een dubbeltik koopt er geen twee', async () => {
  const koop = await api('/api/podium/koop', { id: kanaalId, waarId: sjaalId, idem: 'k1' }, koper.token);
  assert.equal(koop.status, 200, 'de betaling loopt via RTG Pay: ' + JSON.stringify(koop.body).slice(0, 160));
  assert.equal(koop.body.voorraad, 1, 'er is er een weg');
  assert.equal(koop.body.bestelling.naam, 'Wollen sjaal');
  assert.match(koop.body.bestelling.levering, /Afhalen/, 'de koper krijgt de leveringsafspraak mee');

  const nogeens = await api('/api/podium/koop', { id: kanaalId, waarId: sjaalId, idem: 'k1' }, koper.token);
  assert.equal(nogeens.status, 200, 'dezelfde idem geeft hetzelfde antwoord');
  assert.equal(nogeens.body.voorraad, 1, 'en er gaat er GEEN tweede af');
  assert.equal(nogeens.body.bestelling.id, koop.body.bestelling.id, 'het is dezelfde bestelling');

  const zaal = await api('/api/podium/kanalen', { zone: 'handel' }, koper.token);
  const w = (zaal.body.kanalen.find(k => k.id === kanaalId).waren || [])[0];
  assert.equal(w.voorraad, 1, 'en de zaal ziet de echte voorraad');
});

test('5. uitverkocht is uitverkocht', async () => {
  const laatste = await api('/api/podium/koop', { id: kanaalId, waarId: sjaalId, idem: 'k2' }, tweede.token);
  assert.equal(laatste.status, 200, JSON.stringify(laatste.body).slice(0, 160));
  assert.equal(laatste.body.voorraad, 0, 'dat was de laatste');

  const teLaat = await api('/api/podium/koop', { id: kanaalId, waarId: sjaalId, idem: 'k3' }, koper.token);
  assert.equal(teLaat.status, 409, 'daarna is er niets meer te kopen');
  assert.equal(teLaat.body.error, 'Deze is uitverkocht.');

  /* En de voorraad is niet stiekem doorgelopen: het grootboek van het kanaal
     mag geen geld hebben aangenomen voor die derde poging. */
  const mijn = await api('/api/podium/mijn', {}, maker.token);
  assert.equal(mijn.body.kanaal.verdiend, 5000, 'twee keer 25 euro, niet drie keer');

  // de maker vult bij, en dan kan het weer
  const bij = await api('/api/podium/waar', { id: sjaalId, voorraad: 1 }, maker.token);
  assert.equal(bij.status, 200);
  assert.equal(bij.body.waar.voorraad, 1);
  const weer = await api('/api/podium/koop', { id: kanaalId, waarId: sjaalId, idem: 'k4' }, koper.token);
  assert.equal(weer.status, 200, 'na bijvullen kan het weer');
});

test('6. de zaal weet DAT er een weg is, niet WIE hem kocht', async () => {
  /* De voorraad is openbaar -- dat is het antwoord op "heeft kopen nog zin".
     De koper is dat niet: een aankoop is geen mededeling aan de zaal. */
  const zaal = await api('/api/podium/kanalen', { zone: 'handel' }, tweede.token);
  const kanaal = zaal.body.kanalen.find(k => k.id === kanaalId);
  assert.equal(JSON.stringify(kanaal).includes(koper.codenaam), false, 'de codenaam van de koper staat nergens in het kijkbeeld');

  const kijk = await api('/api/podium/kijk', { id: kanaalId }, tweede.token);
  assert.equal(kijk.status, 200);
  assert.equal((kijk.body.chat || []).some(r => JSON.stringify(r).includes('sjaal')), false,
    'en er komt geen aankoopregel in de chat');

  /* En de live-verbinding zelf, want daar gaat het bericht overheen op het
     moment van kopen. De zaal krijgt de voorraad; de maker krijgt de
     bestelling. Wie er kocht hoort alleen bij die tweede. */
  await api('/api/podium/waar', { id: sjaalId, voorraad: 2 }, maker.token);
  const zaalOor = luister(tweede.token);
  const makerOor = luister(maker.token);
  await wacht(300);
  const koop = await api('/api/podium/koop', { id: kanaalId, waarId: sjaalId, idem: 'k5' }, koper.token);
  assert.equal(koop.status, 200, JSON.stringify(koop.body).slice(0, 160));
  for (let i = 0; i < 40 && !zaalOor.tekst().includes('"kind":"waar"'); i++) await wacht(50);
  await zaalOor.stop(); await makerOor.stop();

  const naarZaal = zaalOor.tekst();
  assert.ok(naarZaal.includes('"kind":"waar"'), 'de zaal hoort dat de voorraad veranderde');
  assert.ok(naarZaal.includes(sjaalId), 'en om welke kaart het gaat');
  assert.equal(naarZaal.includes(koper.codenaam), false, 'maar niet wie hem kocht');
  assert.equal(naarZaal.includes('bestelling'), false, 'en de bestelling gaat niet naar de zaal');

  const naarMaker = makerOor.tekst();
  assert.ok(naarMaker.includes('"kind":"bestelling"'), 'de maker krijgt de bestelling wel');
  assert.ok(naarMaker.includes(koper.codenaam), 'met de codenaam, want hij moet weten aan wie hij levert');

  // bij de MAKER staat hij wel, met codenaam: hij moet weten aan wie hij levert
  const mijn = await api('/api/podium/mijn', {}, maker.token);
  const best = mijn.body.kanaal.bestellingen;
  assert.equal(best.length, 4, 'vier bestellingen');
  assert.ok(best.some(b => b.codenaam === koper.codenaam), 'op codenaam, zoals alles hier');
  assert.ok(best.every(b => /Afhalen/.test(b.levering || '')), 'elk met de leveringsafspraak van de maker');
  assert.equal(mijn.body.kanaal.verdiend, 10000, 'en het verdiende bedrag klopt met vier keer 25 euro');
});
