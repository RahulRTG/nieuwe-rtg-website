/* Tests voor De Wacht (server/kern/wacht.js): meters/grafiek, afweer/quarantaine,
   hygiene en de raadkamer (accepteren/afwijzen/inconclaaf + veilige-actie-lijst).
   Zuiver, met een nagemaakte db en signaallezers; geen server nodig.
   Draai: node --test test/wacht.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const maakWacht = require('../server/kern/wacht');

function maakDb() { return { data: {} }; }
// een nagemaakt beveilig-object dat meldingen alleen telt
function maakBeveilig() {
  const meldingen = [];
  return {
    meldingen,
    meld: (type, ernst, tekst, meta) => { meldingen.push({ type, ernst, tekst, meta }); },
    samenvatting: () => ({ open: meldingen.length, kritiek: meldingen.filter(m => m.ernst === 'kritiek').length })
  };
}

test('meters: grafiek groeit, verzoeken tellen als delta', () => {
  let teller = 0;
  const db = maakDb();
  const w = maakWacht({ db, save() {}, lees: { verzoeken: () => teller, bans: () => 2, actieveIps: () => 5, geheugenMB: () => 42 } });
  teller = 10; w.meet();
  teller = 25; const s = w.meet();
  assert.equal(s.verzoeken, 15, 'tweede sample is de delta 25-10');
  assert.equal(s.bans, 2);
  const m = w.meters();
  assert.equal(m.geheugen, 42);
  assert.equal(w.grafiek().length, 2);
});

test('afweer: isoleer snijdt af, verloopt, en kan worden vrijgegeven', () => {
  const db = maakDb(); const bev = maakBeveilig();
  const w = maakWacht({ db, save() {}, beveilig: bev });
  w.isoleer('1.2.3.4', 'test');
  assert.equal(w.inQuarantaine('1.2.3.4'), true);
  assert.equal(w.inQuarantaine('9.9.9.9'), false);
  assert.ok(bev.meldingen.some(m => m.type === 'quarantaine' && m.ernst === 'kritiek'), 'quarantaine geeft een kritieke melding');
  // handmatig verlopen zetten -> valt vanzelf uit quarantaine
  db.data.wacht.quarantaine['1.2.3.4'].tot = Date.now() - 1;
  assert.equal(w.inQuarantaine('1.2.3.4'), false, 'verlopen quarantaine dooft');
  // opnieuw en dan vrijgeven
  w.isoleer('5.6.7.8', 'test');
  assert.equal(w.vrij('5.6.7.8'), true);
  assert.equal(w.inQuarantaine('5.6.7.8'), false);
});

test('hygiene: opruimen ruimt verlopen quarantaine en oude besluiten op', () => {
  const db = maakDb();
  const w = maakWacht({ db, save() {} });
  w.isoleer('a', 'x'); w.isoleer('b', 'y');
  db.data.wacht.quarantaine['a'].tot = Date.now() - 1; // verlopen
  const r = w.opruimen();
  assert.equal(r.opgeruimd >= 1, true);
  assert.equal(w.inQuarantaine('a'), false);
  assert.equal(w.inQuarantaine('b'), true, 'niet-verlopen blijft staan');
});

test('raadkamer: accepteren voert de gekoppelde veilige actie uit', () => {
  const db = maakDb(); const bev = maakBeveilig();
  const w = maakWacht({ db, save() {}, beveilig: bev });
  const v = w.voorstel({ soort: 'afweer', titel: 'Snijd af', uitleg: 't', actie: { soort: 'quarantaine', bron: '7.7.7.7', reden: 'test' } });
  assert.equal(w.inQuarantaine('7.7.7.7'), false, 'nog niets uitgevoerd voor het besluit');
  const r = w.beslis(v.id, 'accepteren', 'akkoord', 'eigenaar');
  assert.equal(r.ok, true);
  assert.equal(r.status, 'geaccepteerd');
  assert.equal(w.inQuarantaine('7.7.7.7'), true, 'pas na accepteren is de actie uitgevoerd');
});

test('raadkamer: afwijzen en inconclaaf voeren NIETS uit', () => {
  const db = maakDb();
  const w = maakWacht({ db, save() {} });
  const v1 = w.voorstel({ soort: 'afweer', titel: 'A', uitleg: 't', actie: { soort: 'quarantaine', bron: '8.8.8.8' } });
  w.beslis(v1.id, 'afwijzen', 'nee', 'eigenaar');
  assert.equal(w.inQuarantaine('8.8.8.8'), false, 'afwijzen voert niets uit');

  const v2 = w.voorstel({ soort: 'afweer', titel: 'B', uitleg: 't', actie: { soort: 'quarantaine', bron: '9.9.9.9' } });
  const r = w.beslis(v2.id, 'inconclaaf', 'even napraten', 'eigenaar');
  assert.equal(r.status, 'inconclaaf');
  assert.equal(w.inQuarantaine('9.9.9.9'), false, 'inconclaaf voert niets uit');
  // het voorstel telt nog mee als open werk
  assert.equal(w.bord().openVoorstellen >= 1, true);
});

test('veiligheid: een niet-toegestane actie wordt nooit uitgevoerd', () => {
  const db = maakDb();
  const w = maakWacht({ db, save() {} });
  // probeer een voorstel met een verzonnen actie-soort te maken
  const v = w.voorstel({ soort: 'kwaad', titel: 'Draai code', uitleg: 't', actie: { soort: 'shell', cmd: 'rm -rf /' } });
  assert.equal(v.actie, null, 'een onbekende actie-soort wordt niet eens bewaard');
  const r = w.beslis(v.id, 'accepteren', '', 'eigenaar');
  assert.equal(r.ok, true);
  // de gevaarlijke actie is nooit bewaard, dus accepteren kan hem niet draaien:
  // het besluit valt terug op een pure notitie zonder enige uitvoering.
  assert.match(r.resultaat, /genoteerd als akkoord/, 'geen actie -> niets uitgevoerd, alleen genoteerd');
});

test('analyseer: kauwt verdachte bronnen uit tot afsnij-voorstellen (geen duplicaten)', () => {
  const db = maakDb();
  const bronnen = [{ bron: '3.3.3.3', treffers: 5 }, { bron: '4.4.4.4', treffers: 1 }];
  const w = maakWacht({ db, save() {}, lees: { verdachteBronnen: () => bronnen } });
  const eerste = w.analyseer();
  assert.equal(eerste.length, 1, 'alleen de bron boven de drempel levert een voorstel');
  assert.equal(eerste[0].actie.bron, '3.3.3.3');
  const tweede = w.analyseer();
  assert.equal(tweede.length, 0, 'geen dubbel open voorstel voor dezelfde bron');
});

test('lastafworp: een L7-piek tript de zekering, snijdt bronnen af en dooft vanzelf', () => {
  let teller = 0;
  const db = maakDb(); const bev = maakBeveilig();
  const bronnen = [{ bron: '3.3.3.3', treffers: 9 }, { bron: '4.4.4.4', treffers: 4 }];
  const w = maakWacht({ db, save() {}, beveilig: bev, lees: { verzoeken: () => teller, verdachteBronnen: () => bronnen } });
  // een rustige meting: geen lastafworp
  teller = 100; w.meet();
  assert.equal(w.lastAfworpActief(), false, 'rustig verkeer trip niets');
  // drempel omlaag zodat een bescheiden piek al telt, dan een piek
  db.data.wacht.drempels['l7-flood'] = 200;
  teller = 100 + 5000; const s = w.meet();
  assert.equal(s.lastafworp, 1, 'de sample markeert de lastafworp');
  assert.equal(w.lastAfworpActief(), true, 'de zekering staat dicht na de piek');
  assert.equal(w.inQuarantaine('3.3.3.3'), true, 'de felste bron is afgesneden');
  assert.ok(bev.meldingen.some(m => m.type === 'lastafworp' && m.ernst === 'kritiek'), 'kritieke melding op het bord');
  assert.ok(w.bord().openVoorstellen >= 1, 'er staat een raadkamer-voorstel klaar om eerder op te heffen');
  // laten verlopen -> dooft vanzelf
  db.data.wacht.lastafworp.tot = Date.now() - 1;
  assert.equal(w.lastAfworpActief(), false, 'de lastafworp dooft vanzelf na de afkoeltijd');
});

test('lastafworp: handmatig opheffen via de veilige actie-lijst', () => {
  const db = maakDb();
  const w = maakWacht({ db, save() {} });
  w.zetLastafworp(true);
  assert.equal(w.lastAfworpActief(), true);
  w.zetLastafworp(false);
  assert.equal(w.lastAfworpActief(), false, 'handmatig opheffen laat verkeer weer toe');
  // via de raadkamer (accepteren van een lastafworp-voorstel) moet ook werken
  w.zetLastafworp(true);
  const v = w.voorstel({ soort: 'afweer', titel: 'Hef op', uitleg: 't', actie: { soort: 'lastafworp', aan: false } });
  w.beslis(v.id, 'accepteren', '', 'eigenaar');
  assert.equal(w.lastAfworpActief(), false, 'de raadkamer kan de lastafworp opheffen');
});

test('rand-status: weerspiegelt of verkeer via de rand binnenkomt', () => {
  const db = maakDb();
  const w = maakWacht({ db, save() {} });
  // niets gezien, geen edge verwacht
  let r = w.bord().rand;
  assert.equal(r.status, 'onbekend');
  // randverkeer waargenomen -> actief
  w.randGezien({ ray: 'abc-123', provider: 'cloudflare' });
  r = w.randStatus();
  assert.equal(r.status, 'actief');
  assert.equal(r.provider, 'cloudflare');
  assert.equal(r.ray, 'abc-123');
  assert.ok(r.ouderdomSec != null);
});
