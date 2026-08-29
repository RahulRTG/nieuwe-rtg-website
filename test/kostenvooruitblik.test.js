/* WAT WORDT HET DEZE MAAND -- en waarom er GEEN bandbreedte staat.

   "Verwacht: 284,20 euro, marge 279-289, betrouwbaarheid 99,1%" ziet er
   indrukwekkend uit en is een verzinsel met een decimaal zolang niemand die
   99,1% heeft nagemeten. Dit huis heeft daar een regel voor (BESTUUR.md par. 3),
   en deze toetsen leggen vast dat de regel hier ook geldt: de projectie staat er
   altijd, de band alleen als er afgesloten maanden zijn om hem op te baseren.

   Elke toets is tegen een tijdelijk kapotgemaakte kern gezien zakken (LAT.md
   regel 2); de geziene mutatie staat per toets in het commentaar.

   Draai los: node --experimental-sqlite --test test/kostenvooruitblik.test.js */
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
    name: 'Vooruit Toets', email: 'vooruit-' + t + '@toets.example',
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
    /* Een verzoek kost hier een hele cent. Met een tiende cent per verzoek kon
       veertig keer verbruik op de voorlaatste dagen na beide afrondingen nog
       hetzelfde hele-centenbedrag geven: de projectie werkte dan wel, maar de
       toets zag het pas een maand later weer. Veertig cent groeit ook op de
       voorlaatste dag van elke maand zichtbaar met minstens een cent. */
    { soort: 'verzoek', perEenheid: 1000000, bron: 'Toetstarief, hostingcontract 2026' }, kantoor);
});
test.after(() => stop(srv));

/* MUTATIE: in vooruitblik.js de projectie vervangen door `verwacht = totNu`
   (niet doortrekken) -- deze toets zakt dan, want dan is de verwachting gelijk
   aan wat er tot nu toe staat en voorspelt hij niets. */
test('de projectie trekt het verbruik tot nu toe door naar het eind van de maand', async () => {
  const lid = await versLid();
  /* Genoeg verbruik om in hele centen zichtbaar te zijn: de projectie rekent
     in millicenten en rondt aan het eind af, maar de BEWERING hieronder gaat
     over een verschil dat een mens moet kunnen zien. */
  for (let i = 0; i < 40; i++) await api('/api/kosten/mij', {}, lid);

  const v = await api('/api/kosten/vooruitblik', {}, lid);
  assert.equal(v.status, 200, JSON.stringify(v.body).slice(0, 200));
  assert.equal(v.body.lopend, true, 'de huidige maand hoort als lopend te lezen');
  assert.ok(v.body.totNuCenten > 0, 'er is niets gemeten om mee te rekenen');
  assert.ok(v.body.dagenInMaand >= 28 && v.body.dagenInMaand <= 31);
  assert.ok(v.body.dagenVoorbij >= 1 && v.body.dagenVoorbij <= v.body.dagenInMaand);

  /* De verwachting hoort minstens gelijk te zijn aan wat er nu staat, en meer
     zodra de maand nog niet om is. Op de laatste dag van de maand vallen die
     twee samen -- dat is geen fout maar het einde van de projectie. */
  assert.ok(v.body.verwachtCenten >= v.body.totNuCenten, 'de verwachting ligt onder wat er al staat');
  if (v.body.dagenVoorbij < v.body.dagenInMaand) {
    assert.ok(v.body.verwachtCenten > v.body.totNuCenten,
      'de maand is nog niet om, maar er wordt niets doorgetrokken');
  }
  assert.match(v.body.zegtNiet, /laatste week|tot nu toe/i, 'de projectie zegt niet wat hij niet weet');
});

/* MUTATIE: in vooruitblik.js de MIN_MAANDEN-drempel op 0 zetten -- deze toets
   zakt dan, want dan verschijnt er een bandbreedte op nul gemeten maanden. */
test('er staat geen bandbreedte zolang de trefzekerheid niet gemeten is', async () => {
  const lid = await versLid();
  await api('/api/kosten/mij', {}, lid);

  const v = await api('/api/kosten/vooruitblik', {}, lid);
  assert.equal(v.body.band, null,
    'er staat een bandbreedte terwijl er geen enkele afgesloten maand is om hem op te baseren');
  assert.equal(v.body.trefzekerheid.gemeten, false);
  assert.equal(v.body.trefzekerheid.maanden, 0);
  assert.equal(v.body.trefzekerheid.minimaal, 3);
  assert.match(v.body.trefzekerheid.waarom, /verzinsel met een decimaal|nodig/i,
    'er staat niet WAAROM er geen percentage is');
});

/* MUTATIE: in routes/kosten-kantoor.js de trefzekerheid uit het antwoord halen
   -- deze toets zakt dan, want dan ziet het kantoor wel een verwachting maar
   niet hoe hard die is. */
test('het kantoor ziet de vooruitblik van het huis, met de trefzekerheid erbij', async () => {
  const v = await api('/api/office/kosten/vooruitblik', {}, kantoor);
  assert.equal(v.status, 200);
  assert.equal(v.body.drager, null, 'zonder drager hoort dit het huistotaal te zijn');
  assert.ok(v.body.verwachtCenten >= 0);
  assert.ok(v.body.trefzekerheid, 'de trefzekerheid ontbreekt in het kantoorantwoord');
  assert.equal(v.body.trefzekerheid.gemeten, false);
  assert.match(v.body.trefzekerheid.waarom, /nodig|verzinsel/i);
});

/* MUTATIE: in vooruitblik.js vastleggen() de dagcontrole weghalen (elke aanroep
   overschrijven) -- deze toets zakt dan op de tweede aanroep. */
test('de voorspelling van vandaag wordt een keer per dag vastgelegd', () => {
  const db = { data: {} };
  const economie = require('../server/kern/economie')({ db, save: () => {} }).economie;
  const k = require('../server/kern/kosten')({ db, save: () => {}, accounts: {}, economie }).kosten;

  const eerste = k.vooruitblikVastleggen();
  assert.equal(eerste.ok, true);
  assert.equal(eerste.overgeslagen, undefined, 'de eerste vastlegging van vandaag hoort door te gaan');

  const tweede = k.vooruitblikVastleggen();
  assert.equal(tweede.overgeslagen, true,
    'de tweede vastlegging van dezelfde dag hoort te worden overgeslagen; anders overschrijft de ochtend de avond');
});

/* MUTATIE: in vooruitblik.js de `p >= nuP`-overslag in trefzekerheid() weghalen
   -- deze toets zakt dan, want dan rekent hij de LOPENDE maand mee als
   afgesloten, en dan meet je je voorspelling tegen een half gevulde maand. */
test('de trefzekerheid rekent alleen met maanden die voorbij zijn', () => {
  const db = { data: {} };
  const economie = require('../server/kern/economie')({ db, save: () => {} }).economie;
  const k = require('../server/kern/kosten')({ db, save: () => {}, accounts: {}, economie }).kosten;

  const drager = k.drager('lid', 'user-1');
  k.tariefZet('verzoek', 100000, 'Toetstarief', 'toets');
  k.meet(drager, 'verzoek', 4000, { pas: 'rtg' });
  k.vooruitblikVastleggen();

  const tz = k.trefzekerheid();
  assert.equal(tz.gemeten, false, 'de lopende maand telde mee als afgesloten');
  assert.equal(tz.maanden, 0, 'er is nul afgesloten maand, en toch telde er een mee');
  assert.deepEqual(tz.rijen, []);
});
