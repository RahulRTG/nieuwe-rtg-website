/* De multimodale reisplanner: taxi, OV en lopen naast elkaar, en een geboekte
   reis waarin ze samen EEN reis zijn. Draai los:
   node --experimental-sqlite --test test/reisplan.test.js

   Wat deze toetsen bewaken:

   1. De planner vindt de OV-optie OOK als je precies op de halte staat. Dat
      klinkt vanzelfsprekend en was het niet: `haversine(...) || 9e9` maakte van
      een afstand van nul een oneindige, dus de halte waar je bij stond werd als
      laatste gesorteerd en de hele optie viel af. De planner was het slechtst
      op het moment dat hij het makkelijkst had moeten hebben.
   2. Wat afvalt, valt af MET reden. Een lege lijst zonder uitleg leest als een
      storing.
   3. Het plan wordt bij het boeken opnieuw gerekend. De app stuurt alleen welke
      optie het werd; wie de prijs meestuurt, bepaalt hem anders zelf.
   4. Een reis is EEN overzicht met eerlijke geldregels: het kaartje is betaald,
      de rit wordt afgerekend als hij gereden is, en voor een lijn zonder
      kaartverkoop check je in.
   5. De planner belooft geen kaartje dat de kaartverkoop niet kan leveren. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

let srv, base, lid, kantoor;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-reis-'));
const OFFICE_CODE = 'KANTOOR-REIS-1';

// Ibiza-stad en Santa Eularia: de Eilandexpres (T1) verbindt ze
const STAD = { lat: 38.908, lng: 1.432, label: 'Vara de Rey' };
const EULA = { lat: 38.984, lng: 1.537, label: 'Santa Eularia' };
// een punt ver van elke halte, zodat het voortransport een taxi wordt
const HEUVEL = { lat: 38.930, lng: 1.390, label: 'Landhuis in de heuvels' };

function api(pad, body, token) {
  const h = { 'Content-Type': 'application/json' };
  if (token) h.Authorization = 'Bearer ' + token;
  return fetch(base + pad, { method: 'POST', headers: h, body: JSON.stringify(body || {}) })
    .then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
}
let seq = 0;
async function nieuwLid() {
  const u = (Date.now() + (++seq)).toString().slice(-8);
  const reg = await api('/api/auth/register', { name: 'Reiziger ' + seq, email: 'rp' + u + '@x.nl',
    phone: '06' + u, password: 'geheim123', geboortedatum: '1990-05-05', geslacht: 'v',
    tier: 'rtg', pasApp: 'rtg' });
  return reg.body.token;
}

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, OFFICE_CODE } });
  base = srv.base;
  lid = await nieuwLid();
  kantoor = (await api('/api/office/login', { code: OFFICE_CODE })).body.token;
  assert.ok(lid && kantoor);
});
test.after(() => {
  stop(srv && srv.child);
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('1. de planner zet taxi, OV en lopen naast elkaar, met de cijfers eronder', async () => {
  const r = await api('/api/mob/reis/plan', { van: STAD, naar: EULA, stad: 'Ibiza' }, lid);
  assert.equal(r.status, 200, r.body.error || '');
  assert.ok(r.body.opties.length >= 2, 'er zijn meerdere manieren om er te komen');

  const taxi = r.body.opties.find(o => o.id === 'taxi');
  const trein = r.body.opties.find(o => o.id === 'ov-TRANSIT-T1');
  assert.ok(taxi, 'de directe taxi staat erbij');
  /* DE KERN VAN DEZE TOETS. Vertrekpunt STAD ligt precies op halte t-stad. De
     eerste versie sorteerde die halte als oneindig ver weg (0 || 9e9) en gooide
     de trein er daarna uit als omweg. */
  assert.ok(trein, 'de Eilandexpres staat erbij, ook al staat de reiziger precies op de halte');

  assert.ok(trein.totaal.prijs < taxi.totaal.prijs, 'de trein is goedkoper dan de taxi');
  assert.ok(trein.totaal.co2Gram < taxi.totaal.co2Gram, 'en schoner');
  assert.equal(trein.totaal.co2Geschat, true, 'en de uitstoot heet een schatting, geen meting');
  assert.ok(taxi.totaal.minuten <= trein.totaal.minuten, 'de taxi is sneller');

  // de merken wijzen aan zonder een "beste" te kiezen
  assert.equal(taxi.snelst, true);
  assert.equal(trein.goedkoopst, true);
  assert.equal(trein.schoonst, true);

  // elke etappe draagt zijn eigen cijfers, en de OV-etappe zegt waar de tijd vandaan komt
  const ov = trein.etappes.find(e => e.wijze === 'ov');
  assert.ok(ov.wachtMin >= 0);
  assert.match(ov.wachtUitleg, /dienstregeling|live/, 'de wachttijd zegt of hij uit GPS of uit het boekje komt');
  assert.ok(ov.betrouwbaarheid && ov.betrouwbaarheid.uitleg, 'en er staat een betrouwbaarheidsuitleg bij');
  assert.equal(trein.totaal.minuten, trein.etappes.reduce((n, e) => n + e.minuten, 0),
    'het totaal is de som van de etappes, niet iets ernaast');
});

test('2. wat afvalt, valt af met een reden', async () => {
  const r = await api('/api/mob/reis/plan', { van: STAD, naar: EULA, stad: 'Ibiza' }, lid);
  assert.ok(r.body.afgevallen.length, 'er vallen lijnen af');
  for (const a of r.body.afgevallen) {
    assert.ok(a.naam, 'elke afvaller heeft een naam');
    assert.ok(a.reden && a.reden.length > 10, 'en een leesbare reden: ' + JSON.stringify(a));
  }
  // de ferry gaat de verkeerde kant op en hoort erbij te staan
  assert.ok(r.body.afgevallen.some(a => /ferry/i.test(a.naam)), 'de ferry staat bij de afvallers');

  // vertrek en bestemming op dezelfde plek is geen reis
  const zelfde = await api('/api/mob/reis/plan', { van: STAD, naar: STAD }, lid);
  assert.equal(zelfde.status, 400);
});

test('3. een gemengde reis: taxi naar de halte, dan de trein', async () => {
  const r = await api('/api/mob/reis/plan', { van: HEUVEL, naar: EULA, stad: 'Ibiza' }, lid);
  assert.equal(r.status, 200, r.body.error || '');
  const trein = r.body.opties.find(o => o.id === 'ov-TRANSIT-T1');
  assert.ok(trein, 'ook vanaf een punt zonder halte in de buurt is er een OV-optie');
  const wijzen = trein.etappes.map(e => e.wijze);
  assert.ok(wijzen.includes('taxi'), 'het voortransport is een taxi, want lopen kan niet: ' + wijzen.join(','));
  assert.ok(wijzen.includes('ov'), 'en de trein zit erin');
});

test('4. het plan wordt bij het boeken opnieuw gerekend', async () => {
  // een verzonnen optie bestaat niet, ook al stuurt de app hem netjes mee
  const nep = await api('/api/mob/reis/boek', { van: STAD, naar: EULA, optie: 'ov-VERZONNEN-X9' }, lid);
  assert.equal(nep.status, 404);
  assert.ok(Array.isArray(nep.body.opties), 'en het antwoord noemt wat er wel is');

  /* De prijs uit het verzoek wordt genegeerd. Zou hij worden overgenomen, dan
     bepaalt de client wat een rit kost -- en dat is het eerste wat iemand
     probeert. */
  const echt = await api('/api/mob/reis/boek', { van: HEUVEL, naar: EULA, stad: 'Ibiza',
    optie: 'ov-TRANSIT-T1', prijs: 1, totaal: { prijs: 1 }, idem: 'b1' }, lid);
  assert.equal(echt.status, 200, echt.body.error || '');
  assert.ok(echt.body.reis.nogAfTeRekenen > 100, 'de ritprijs komt van de server, niet uit het verzoek');
});

test('5. een reis is een overzicht met eerlijke geldregels', async () => {
  const r = await api('/api/mob/reis/mijn', {}, lid);
  assert.equal(r.status, 200);
  const reis = r.body.reizen[0];
  assert.ok(reis, 'de geboekte reis staat erin');

  const taxi = reis.etappes.find(e => e.wijze === 'taxi');
  assert.ok(taxi && taxi.ref, 'de taxi-etappe is een echte opdracht in de rittenmotor');
  assert.equal(taxi.ritStatus, 'aangevraagd', 'met een status uit die motor');

  /* Zonder kaartverkoop is de OV-etappe een instructie, geen kaartje -- en de
     uitleg zegt dat je bij het uitchecken betaalt. "Alles is betaald" stond
     hier eerst, en dat was onwaar. */
  const ov = reis.etappes.find(e => e.wijze === 'ov');
  assert.ok(ov, 'de OV-etappe staat erin');
  assert.equal(ov.kaartje, null, 'zonder kaartverkoop is er geen kaartje');
  assert.equal(reis.inchecken, 1, 'en de reis weet dat er ingecheckt moet worden');
  assert.match(reis.uitleg, /checkt u in/, 'de uitleg zegt wat de reiziger moet doen: ' + reis.uitleg);
  assert.ok(reis.nogAfTeRekenen > 0, 'de rit moet nog afgerekend worden');
  assert.equal(reis.betaald, 0, 'en er is nog niets betaald');
});

test('6. met kaartverkoop erbij: het kaartje is betaald, de rit nog niet', async () => {
  for (const m of ['partner_contracts', 'public_transport_ticketing'])
    assert.equal((await api('/api/office/mob/module/zet', { id: m, aan: true }, kantoor)).status, 200, m);
  const ok = await api('/api/office/mob/overeenkomst', { vervoerder: 'TRANSIT',
    van: '2020-01-01', tot: '2099-12-31', producten: ['enkel'], lijnen: ['T1'],
    getekendDoor: 'J. Directeur' }, kantoor);
  assert.equal(ok.status, 200, ok.body.error || '');

  const ander = await nieuwLid();
  const r = await api('/api/mob/reis/boek', { van: HEUVEL, naar: EULA, stad: 'Ibiza',
    optie: 'ov-TRANSIT-T1', idem: 'b2' }, ander);
  assert.equal(r.status, 200, r.body.error || '');
  const reis = r.body.reis;
  const ov = reis.etappes.find(e => e.wijze === 'ov');
  assert.ok(ov.kaartje, 'nu is er wel een kaartje');
  assert.equal(ov.kaartStand, 'geldig');
  assert.ok(reis.betaald > 0, 'het kaartje is betaald');
  assert.ok(reis.nogAfTeRekenen > 0, 'de rit nog niet');
  assert.equal(reis.inchecken, 0, 'en er hoeft niet meer ingecheckt te worden');
  assert.match(reis.uitleg, /vervoerbewijzen zijn betaald/);
  assert.match(reis.uitleg, /schatting/, 'en de ritprijs heet een schatting tot hij gereden is');

  // het kaartje staat ook gewoon in de kaartjeslijst van het lid
  const mijn = await api('/api/mob/kaart/mijn', {}, ander);
  assert.ok(mijn.body.kaartjes.some(k => k.code === ov.kaartje), 'het kaartje staat in de app van de reiziger');
});

test('7. de planner belooft geen kaartje dat de verkoop niet kan leveren', async () => {
  /* De planner zegt "kaartje inbegrepen" op grond van dezelfde twee vragen als
     de verkoop: staat de module aan, en dekt de overeenkomst dit. Hier keek de
     planner alleen naar de overeenkomst, en dan belooft hij een kaartje terwijl
     de kaartverkoop in dit gebied uit staat -- het boeken liep dan stuk op een
     belofte van de planner zelf. */
  const aan = await api('/api/mob/reis/plan', { van: HEUVEL, naar: EULA, stad: 'Ibiza' }, lid);
  const ovAan = aan.body.opties.find(o => o.id === 'ov-TRANSIT-T1').etappes.find(e => e.wijze === 'ov');
  assert.equal(ovAan.kaartTeKoop, true, 'met module en overeenkomst is er een kaartje te koop');

  await api('/api/office/mob/module/zet', { id: 'public_transport_ticketing', aan: false }, kantoor);
  const uit = await api('/api/mob/reis/plan', { van: HEUVEL, naar: EULA, stad: 'Ibiza' }, lid);
  const ovUit = uit.body.opties.find(o => o.id === 'ov-TRANSIT-T1').etappes.find(e => e.wijze === 'ov');
  assert.equal(ovUit.kaartTeKoop, false, 'met de module uit belooft de planner geen kaartje');
  assert.ok(ovUit.kaartReden, 'en hij zegt waarom niet');

  // en het boeken loopt dan ook niet stuk: het wordt gewoon inchecken
  const derde = await nieuwLid();
  const b = await api('/api/mob/reis/boek', { van: HEUVEL, naar: EULA, stad: 'Ibiza',
    optie: 'ov-TRANSIT-T1', idem: 'b3' }, derde);
  assert.equal(b.status, 200, 'boeken lukt nog steeds: ' + (b.body.error || ''));
  assert.equal(b.body.reis.inchecken, 1);
  await api('/api/office/mob/module/zet', { id: 'public_transport_ticketing', aan: true }, kantoor);
});

test('8. annuleren: de ritten gaan weg, een betaald kaartje blijft geldig', async () => {
  const vierde = await nieuwLid();
  const b = await api('/api/mob/reis/boek', { van: HEUVEL, naar: EULA, stad: 'Ibiza',
    optie: 'ov-TRANSIT-T1', idem: 'b4' }, vierde);
  assert.equal(b.status, 200, b.body.error || '');
  const kaartCode = b.body.reis.etappes.find(e => e.wijze === 'ov').kaartje;
  assert.ok(kaartCode);

  const a = await api('/api/mob/reis/annuleer', { id: b.body.reis.id }, vierde);
  assert.equal(a.status, 200, a.body.error || '');
  assert.ok(a.body.ritten.length, 'de taxi-etappe is geannuleerd');
  assert.ok(a.body.ritten.every(x => x.gelukt), 'en dat lukte');
  assert.match(a.body.uitleg, /blijven geldig/, 'het kaartje wordt niet stilletjes ingetrokken');

  const mijn = await api('/api/mob/kaart/mijn', {}, vierde);
  const k = mijn.body.kaartjes.find(x => x.code === kaartCode);
  assert.equal(k.stand, 'geldig', 'het betaalde kaartje is nog steeds geldig');

  const weer = await api('/api/mob/reis/annuleer', { id: b.body.reis.id }, vierde);
  assert.equal(weer.status, 409, 'twee keer annuleren kan niet');

  // en de reis van een ander is niet te annuleren
  const vreemd = await api('/api/mob/reis/annuleer', { id: b.body.reis.id }, lid);
  assert.equal(vreemd.status, 403);
});

test('9. de deuren: een gast plant en boekt niets', async () => {
  const gast = (await api('/api/login', { tier: 'guest' })).body.token;
  for (const pad of ['/api/mob/reis/plan', '/api/mob/reis/boek', '/api/mob/reis/mijn', '/api/mob/reis/annuleer'])
    assert.equal((await api(pad, { van: STAD, naar: EULA }, gast)).status, 403, pad + ' is dicht voor gasten');
});
