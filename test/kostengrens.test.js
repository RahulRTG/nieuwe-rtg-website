/* EEN VERBRUIKSGRENS DIE ECHT WEIGERT.

   Een waarschuwing die nergens bijt, is een getal op een scherm. Deze toetsen
   leggen vast dat een plafond de AI-weg werkelijk dichtzet, dat de app daarna
   blijft werken (dat is het verschil tussen een grens en een storing), en dat de
   grens van het kantoor niet door een lid is op te hogen.

   Elke toets is tegen een tijdelijk kapotgemaakte kern gezien zakken (LAT.md
   regel 2); de geziene mutatie staat per toets in het commentaar.

   Draai los: node --experimental-sqlite --test test/kostengrens.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, stop, kantoorAlsPersoon } = require('./helper');

let srv, base, kantoor;

const api = (pad, body, token) => fetch(base + pad, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
  body: JSON.stringify(body || {})
}).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));

let teller = 0;
async function versLid() {
  const t = Date.now() + '-' + (teller++);
  const r = await api('/api/auth/register', {
    name: 'Grens Toets', email: 'grens-' + t + '@toets.example',
    password: 'geheim123', geboortedatum: '1985-05-05', tier: 'rtg'
  });
  assert.ok(r.body.token, 'registratie gaf geen token: ' + JSON.stringify(r.body).slice(0, 200));
  return r.body.token;
}

test.before(async () => {
  srv = await startServer(); base = srv.base;
  kantoor = await kantoorAlsPersoon(base);
  assert.ok(kantoor, 'geen boardroom-sessie; zonder eigenaar valt hier niets te zien');
  await api('/api/office/kosten/tarief/zet',
    { soort: 'verzoek', perEenheid: 100000, bron: 'Toetstarief, hostingcontract 2026' }, kantoor);
});
test.after(() => stop(srv));

/* MUTATIE: in grens.js de 'geen-grens'-stand vervangen door 'ruim' -- deze toets
   zakt dan, want dan leest "niemand heeft een grens gezet" als "er is een grens
   en er is nog ruimte". Dat zijn niet dezelfde bewering. */
test('zonder ingestelde grens is er geen grens, en dat is iets anders dan ruimte', async () => {
  const lid = await versLid();
  await api('/api/kosten/mij', {}, lid);
  const g = await api('/api/kosten/grens', {}, lid);
  assert.equal(g.status, 200);
  assert.equal(g.body.grens.plafond, null);
  assert.equal(g.body.grens.waarschuw, null);
  assert.equal(g.body.stand.stand, 'geen-grens');
  assert.equal(g.body.stand.ok, true);
});

/* MUTATIE: in grens.js de waarschuw > plafond-controle weghalen -- deze toets
   zakt dan, want dan mag er een waarschuwing worden gezet die pas afgaat als de
   deur al dicht is. */
test('een waarschuwing boven het plafond bestaat niet', async () => {
  const lid = await versLid();
  const r = await api('/api/kosten/grens/zet', { waarschuwCenten: 5000, plafondCenten: 1000 }, lid);
  assert.equal(r.status, 400);
  assert.match(r.body.error, /waarschuwing ligt boven het plafond/i);
});

/* MUTATIE: in server/ai.js de grens-controle weghalen -- deze toets zakt dan,
   want dan gaat de AI-weg open terwijl het plafond bereikt is. */
test('boven het plafond gaat de AI-weg dicht, en de rest blijft werken', async () => {
  const lid = await versLid();
  // wat verbruik maken zodat er iets te overschrijden valt
  for (let i = 0; i < 5; i++) await api('/api/kosten/mij', {}, lid);
  const mij = await api('/api/kosten/mij', {}, lid);
  const nuCenten = mij.body.overzicht.totaal.centen;
  assert.ok(nuCenten > 0, 'er is niets verbruikt om een grens op te zetten');

  const zet = await api('/api/kosten/grens/zet', { plafondCenten: 1 }, lid);
  assert.equal(zet.status, 200, JSON.stringify(zet.body).slice(0, 160));

  const g = await api('/api/kosten/grens', {}, lid);
  assert.equal(g.body.stand.stand, 'dicht', 'het plafond is bereikt maar de stand is niet dicht');
  assert.equal(g.body.stand.ok, false);
  assert.match(g.body.stand.uitleg, /plafond/i);

  /* EN DE APP BLIJFT WERKEN. Een grens die de hele app meeneemt is een storing;
     dit hoort alleen de AI-weg te raken. */
  const nog = await api('/api/kosten/mij', {}, lid);
  assert.equal(nog.status, 200, 'de gewone routes vielen mee om met de grens');
  assert.equal(nog.body.grens.stand, 'dicht', 'de stand hoort in hetzelfde antwoord te staan als het verbruik');

  /* De AI-weg zelf: die valt terug op de regelgestuurde werkmodus in plaats van
     een fout naar buiten te gooien. Dat is wat dit huis doet als er geen model
     is, en een grens hoort daar niet anders in te zijn. */
  const vertaal = await api('/api/translate', { tekst: 'hallo', naar: 'en' }, lid);
  assert.ok(vertaal.status < 500, 'de vertaalroute viel om op de verbruiksgrens: ' + vertaal.status);
});

/* MUTATIE: in grens.js de twee sloten samenvoegen tot een (slot negeren) --
   deze toets zakt dan, want dan zet het lid de kantoorgrens gewoon opzij. */
test('een lid kan de grens van het kantoor niet ophogen', async () => {
  const lid = await versLid();
  await api('/api/kosten/mij', {}, lid);
  const drager = (await api('/api/kosten/mij', {}, lid)).body.overzicht.drager;

  const kantoorGrens = await api('/api/office/kosten/grens/zet',
    { drager, plafondCenten: 500 }, kantoor);
  assert.equal(kantoorGrens.status, 200, JSON.stringify(kantoorGrens.body).slice(0, 160));

  // het lid zet een RUIMERE grens voor zichzelf
  const eigen = await api('/api/kosten/grens/zet', { plafondCenten: 900000 }, lid);
  assert.equal(eigen.status, 200);

  const g = await api('/api/kosten/grens', {}, lid);
  assert.equal(g.body.grens.plafond.centen, 500, 'de ruimere eigen grens won van de kantoorgrens');
  assert.equal(g.body.grens.plafond.door, 'kantoor');
  assert.equal(g.body.grens.zelf.plafondCenten, 900000, 'de eigen grens hoort er wel te staan');
  assert.equal(g.body.grens.kantoor.plafondCenten, 500);
});

/* MUTATIE: in haak.js de catch in magUitgeven weghalen -- deze toets zakt dan,
   want dan sluit een fout in de boekhouding de AI-weg van het hele huis. */
test('een kapotte grenswacht sluit de AI-weg niet', () => {
  const haak = require('../server/kern/kosten/haak');
  const eerder = haak.magUitgeven();
  assert.equal(eerder.ok, true, 'zonder wacht hoort alles te mogen');

  haak.zetGrenswacht(() => { throw new Error('de boekhouding is stuk'); });
  const uit = haak.magUitgeven('lid:wat-dan-ook');
  assert.equal(uit.ok, true,
    'een gooiende grenswacht sloot de AI-weg; dat is het omgekeerde van wat een grens moet doen');
  haak.zetGrenswacht(null);
});
