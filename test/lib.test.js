/* Unit-tests voor de zuivere hulplibs (server/lib). Geen server nodig.
   Draai: node --test test/lib.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const geo = require('../server/lib/geo');
const leeftijd = require('../server/lib/leeftijd');
const { merge3 } = require('../server/db');

test('geo.haversine: afstand Amsterdam <-> Rotterdam is ~57 km', () => {
  const ams = { lat: 52.3676, lng: 4.9041 }, rot = { lat: 51.9244, lng: 4.4777 };
  const m = geo.haversine(ams, rot);
  assert.ok(m > 55000 && m < 60000, 'afstand plausibel: ' + m);
  assert.equal(geo.haversine(null, rot), null);
  assert.equal(geo.haversine({ lat: 'x' }, rot), null);
});

test('geo.etaMinutes: lopen duurt langer dan rijden, vliegen het kortst', () => {
  const d = 10000; // 10 km
  const lopen = geo.etaMinutes(d, 'walking');
  const rijden = geo.etaMinutes(d, 'driving');
  const vliegen = geo.etaMinutes(d, 'flying');
  assert.ok(lopen > rijden && rijden > vliegen, `${lopen} > ${rijden} > ${vliegen}`);
  assert.equal(geo.etaMinutes(null), null);
  assert.equal(geo.etaMinutes(1, 'driving'), 1); // minstens 1 minuut
});

test('leeftijd.leeftijdVan + groep: paspoortdatum stuurt de groep', () => {
  const jaar = new Date().getFullYear();
  assert.equal(leeftijd.leeftijdVan('bla'), null);
  assert.equal(leeftijd.leeftijdVan((jaar - 30) + '-01-01') >= 29, true);
  assert.equal(leeftijd.leeftijdsgroepVan(16), '15-17');
  assert.equal(leeftijd.leeftijdsgroepVan(20), '18-21');
  assert.equal(leeftijd.leeftijdsgroepVan(40), '21+');
  assert.equal(leeftijd.leeftijdsgroepVan(null), null);
});

test('db.merge3: gelijktijdige wijzigingen in dezelfde collectie worden samengevoegd', () => {
  // maps (bijv. foundation.gezinnen of sessions): elk props een andere sleutel
  const base = { A: 1 };
  assert.deepEqual(merge3(base, { A: 1, B: 2 }, { A: 1, C: 3 }), { A: 1, B: 2, C: 3 });
  // een kant wijzigt een waarde, de andere niet: de wijziging wint
  assert.deepEqual(merge3({ A: 1 }, { A: 9 }, { A: 1 }), { A: 9 });
  assert.deepEqual(merge3({ A: 1 }, { A: 1 }, { A: 9 }), { A: 9 });
  // verwijderen werkt door
  assert.deepEqual(merge3({ A: 1, B: 2 }, { A: 1 }, { A: 1, B: 2 }), { A: 1 });
  // arrays met id (bijv. orders, snaps): toevoegingen van beide kanten blijven
  const ords = merge3([{ id: 1 }], [{ id: 1 }, { id: 2 }], [{ id: 1 }, { id: 3 }]);
  assert.deepEqual(ords.map(o => o.id).sort(), [1, 2, 3]);
  // connecties (array zonder id, sleutel uit a+b)
  const conns = merge3([], [{ a: 'x', b: 'y' }], [{ a: 'p', b: 'q' }]);
  assert.equal(conns.length, 2);
  // geneste map (bijv. foundation.gezinnen[code].profielen)
  const nested = merge3({ g: { profielen: { p1: 1 } } }, { g: { profielen: { p1: 1, p2: 2 } } }, { g: { profielen: { p1: 1, p3: 3 } } });
  assert.deepEqual(nested.g.profielen, { p1: 1, p2: 2, p3: 3 });
});

test('kluis: versleuteling-at-rest is omkeerbaar, merkt geknoei, en laat plaintext door', () => {
  // met sleutel in een apart proces (RTG_ENC_KEY zet je via de omgeving)
  const { execFileSync } = require('node:child_process');
  const script = `
    process.env.RTG_ENC_KEY = 'a'.repeat(64);
    delete require.cache[require.resolve('${require('path').join(__dirname, '..', 'server', 'kluis.js').replace(/\\\\/g, '/')}')];
    const k = require('${require('path').join(__dirname, '..', 'server', 'kluis.js').replace(/\\\\/g, '/')}');
    const geheim = JSON.stringify({ chat: 'hallo', pin: 1234 });
    const enc = k.versleutel(geheim);
    const out = {
      aan: k.AAN,
      versleuteld: enc.startsWith('RTGENC1:') && !enc.includes('hallo'),
      rondrit: k.ontsleutel(enc) === geheim,
      plaintextDoor: k.ontsleutel(geheim) === geheim,  // niet-versleutelde waarde blijft
    };
    // geknoei moet opvallen (GCM-tag)
    try { k.ontsleutel(enc.slice(0, -3) + 'AAA'); out.knoeiGemerkt = false; } catch (e) { out.knoeiGemerkt = true; }
    // binaire variant
    const b = Buffer.from([1,2,3,4,5]);
    out.bufRondrit = Buffer.compare(k.ontsleutelBuf(k.versleutelBuf(b)), b) === 0;
    process.stdout.write(JSON.stringify(out));
  `;
  const res = JSON.parse(execFileSync(process.execPath, ['-e', script]).toString());
  assert.equal(res.aan, true);
  assert.equal(res.versleuteld, true, 'de opgeslagen waarde bevat geen plaintext');
  assert.equal(res.rondrit, true, 'ontsleutelen geeft exact het origineel terug');
  assert.equal(res.plaintextDoor, true, 'niet-versleutelde waarde laat je ongemoeid (migratie)');
  assert.equal(res.knoeiGemerkt, true, 'aangepaste cijfertekst wordt geweigerd');
  assert.equal(res.bufRondrit, true, 'binaire versleuteling (KYC) is omkeerbaar');
});

/* lib/idem: idempotentie met verzoek-binding, gedeeld door RTG Pay en RTG Bank.
   Een idem-sleutel voorkomt dubbel boeken bij een dubbeltik of retry, maar mag
   NOOIT stil "gelukt" antwoorden op een ander verzoek onder dezelfde sleutel --
   de apps bouwden hun sleutel uit Date.now(), dus die botsing is echt. */
test('lib/idem: herhaalt bij hetzelfde verzoek en conflicteert bij een ander', async () => {
  const maakIdem = require('../server/lib/idem');
  const data = {};
  let bewaard = 0;
  const metIdem = maakIdem({ d: () => data, save: () => { bewaard++; }, naam: 'payIdem' });

  let keer = 0;
  const werk = () => { keer++; return Promise.resolve({ ok: true, boeking: 'B' + keer }); };

  // eerste keer: het werk draait en wordt bewaard
  const a = await metIdem('stuur:A:k1', 'stuur|A|B|100|p2p', werk);
  assert.deepEqual(a, { ok: true, boeking: 'B1' });
  assert.equal(keer, 1);
  assert.ok(bewaard > 0, 'de sleutel is weggeschreven');

  // zelfde sleutel, zelfde afdruk: herhaling, het werk draait NIET opnieuw
  const b = await metIdem('stuur:A:k1', 'stuur|A|B|100|p2p', werk);
  assert.equal(b.herhaald, true);
  assert.equal(b.boeking, 'B1', 'exact hetzelfde antwoord');
  assert.equal(keer, 1, 'het werk mag niet nog eens draaien');

  // zelfde sleutel, ANDERE afdruk: conflict, en het werk draait niet
  const c = await metIdem('stuur:A:k1', 'stuur|A|C|99999|p2p', werk);
  assert.equal(c.status, 409);
  assert.ok(/ander verzoek/.test(c.error));
  assert.equal(keer, 1, 'bij een conflict mag er niets gebeuren');

  // zonder sleutel: altijd gewoon uitvoeren
  const d2 = await metIdem(null, 'x', werk);
  assert.equal(d2.boeking, 'B2');
});

test('lib/idem: mislukt werk wordt niet bewaard, en sleutels zonder afdruk blijven werken', async () => {
  const maakIdem = require('../server/lib/idem');
  const data = {};
  const metIdem = maakIdem({ d: () => data, save: () => {}, naam: 'bankIdem' });

  // een fout antwoord (geen .ok) mag de sleutel niet vastzetten
  const mis = await metIdem('sepa:NL1:k', 'sepa|NL1|100|NL2', () => Promise.resolve({ status: 402, error: 'te weinig' }));
  assert.equal(mis.status, 402);
  const opnieuw = await metIdem('sepa:NL1:k', 'sepa|NL1|100|NL2', () => Promise.resolve({ ok: true, n: 1 }));
  assert.equal(opnieuw.ok, true, 'na een mislukking mag het opnieuw');
  assert.equal(opnieuw.herhaald, undefined);

  /* Een database van VOOR de binding heeft wel de sleutel maar geen afdruk. Die
     moet zich gedragen als voorheen (herhaling), niet plots als conflict --
     anders breekt een upgrade lopende idem-sleutels. */
  data.bankIdem = { _keys: ['oud:1'], 'oud:1': { ok: true, oud: true } };
  delete data.bankIdemAfdruk;
  const oud = await metIdem('oud:1', 'heel|andere|afdruk', () => Promise.resolve({ ok: true, nieuw: true }));
  assert.equal(oud.herhaald, true, 'zonder bekende afdruk geldt het oude gedrag');
  assert.equal(oud.oud, true);
});
