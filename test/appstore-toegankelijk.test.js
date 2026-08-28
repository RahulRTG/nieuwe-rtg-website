/* DE TOEGANKELIJKHEIDSPOORT -- houdt hij werkelijk tegen?

   Besloten op 27 augustus 2026: de keuring blokkeert vanaf nu alles, ook een
   update van een app die vandaag live is. Een poort die dat zegt en het niet
   doet, is erger dan geen poort -- dan staat er een belofte in een document
   waar niemand op kan bouwen (LAT-regel 6).

   Deze toets houdt vijf dingen vast:

     1. zonder uitslag gaat er niets live;
     2. een uitslag die BLOKKEERT houdt tegen, met het aantal erbij;
     3. 'niet vast te stellen' is GEEN ja -- zelfde regel als de virusscanner;
     4. een uitslag hangt aan de BYTES: een nieuwe bundel heeft een nieuwe nodig;
     5. inzenden en WEIGEREN mogen gewoon zonder keuring.

   Draai los: node --test test/appstore-toegankelijk.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { maakToegankelijk, STANDEN } = require('../server/kern/appstore/toegankelijk');

/* Een verzonnen versie is genoeg om de poort te toetsen: `belet()` kijkt alleen
   naar de uitslag en naar de hash. Dat is met opzet -- de poort hoort niets van
   de rest van de motor te weten. */
const versieMet = (extra) => Object.assign({ id: 'v1', sleutel: 'app', hash: 'aaaa1111',
  manifest: { versie: '1.0.0' }, status: 'wacht-op-mens' }, extra || {});

function bouw(v) {
  const versies = { v1: v };
  const geboekt = [];
  const laag = maakToegankelijk({
    S: () => ({ versies }), save() {}, nu: () => new Date().toISOString(),
    versie: (id) => versies[id], boek: (wat, over, wie, extra) => geboekt.push({ wat, over, wie, extra })
  });
  return { laag, v, geboekt };
}

test('1 - zonder uitslag gaat er niets live', () => {
  const { laag, v } = bouw(versieMet());
  const belet = laag.belet(v);
  assert.ok(belet, 'de poort hoort dicht te staan');
  assert.equal(belet.status, 409);
  assert.match(belet.error, /nog niet over deze bundel gedraaid/);
  assert.match(belet.hoe, /keurloper/, 'en de weg vooruit hoort erbij te staan');
});

test('2 - een uitslag die blokkeert houdt tegen, met het aantal erbij', () => {
  const { laag, v } = bouw(versieMet());
  laag.noteer({ versieId: 'v1', stand: 'blokkeert', fouten: 7, door: 'de keurloper',
    bevindingen: [{ ernst: 'fout', bestand: 'index.html', wat: 'Knop zonder naam', hoe: 'aria-label' }] });
  const belet = laag.belet(v);
  assert.ok(belet);
  assert.match(belet.error, /7 toegankelijkheidsfout/);
  assert.equal(belet.toegankelijk.bevindingen.length, 1, 'de bevindingen reizen mee, zodat de uitgever weet wat');
  assert.match(belet.hoe, /nieuwe versie/);
});

test('3 - niet vast te stellen is GEEN ja', () => {
  /* Dezelfde regel als de virusscanner in de machinepoort: een controle die niet
     heeft gedraaid, is geen stilzwijgend ja. */
  const { laag, v } = bouw(versieMet());
  laag.noteer({ versieId: 'v1', stand: 'niet-vast-te-stellen', door: 'de keurloper' });
  const belet = laag.belet(v);
  assert.ok(belet, 'een keuring die niet kon draaien hoort de poort dicht te houden');
  assert.match(belet.error, /geen goedkeuring/);
});

test('4 - in orde haalt de blokkade weg', () => {
  const { laag, v } = bouw(versieMet());
  laag.noteer({ versieId: 'v1', stand: 'in-orde', fouten: 0, door: 'de keurloper' });
  assert.equal(laag.belet(v), null);
});

test('5 - een uitslag hangt aan de BYTES en niet aan de app', () => {
  /* Zou hij aan de app hangen, dan keurt de eerste versie de volgende goed --
     precies het gat waar zo'n poort doorheen lekt. */
  const { laag, v } = bouw(versieMet());
  laag.noteer({ versieId: 'v1', stand: 'in-orde', fouten: 0, door: 'de keurloper' });
  assert.equal(laag.belet(v), null);

  v.hash = 'bbbb2222';                       // de uitgever zendt een nieuwe bundel in
  const belet = laag.belet(v);
  assert.ok(belet, 'een nieuwe bundel hoort een nieuwe keuring te vragen');
  assert.match(belet.error, /nog niet over deze bundel/);
});

test('6 - een verzonnen stand wordt geweigerd', () => {
  const { laag } = bouw(versieMet());
  const r = laag.noteer({ versieId: 'v1', stand: 'prima', door: 'de keurloper' });
  assert.equal(r.status, 400);
  for (const s of STANDEN) assert.match(r.error, new RegExp(s));
});

test('7 - de uitslag komt in het journaal', () => {
  const { laag, geboekt } = bouw(versieMet());
  laag.noteer({ versieId: 'v1', stand: 'blokkeert', fouten: 3, door: 'de keurloper' });
  assert.equal(geboekt.length, 1);
  assert.equal(geboekt[0].wat, 'toegankelijkheid-blokkeert');
  assert.equal(geboekt[0].extra.fouten, 3);
});

test('8 - de wachtrij noemt wat nog gekeurd moet worden', () => {
  const v = versieMet();
  const { laag } = bouw(v);
  assert.equal(laag.wachtOpKeuring().length, 1, 'een inzending die op een mens wacht en geen uitslag heeft');
  laag.noteer({ versieId: 'v1', stand: 'in-orde', fouten: 0, door: 'de keurloper' });
  assert.equal(laag.wachtOpKeuring().length, 0, 'daarna niet meer');
  v.hash = 'cccc3333';
  assert.equal(laag.wachtOpKeuring().length, 1, 'en bij een nieuwe bundel weer wel');
});

test('9 - de poort hangt in besluit() en nergens anders', () => {
  /* De toets die de plek vasthoudt. Zou hij bij het INZENDEN komen te staan, dan
     moet keur() een browser hebben -- en die is er niet. */
  const bron = fs.readFileSync(path.join(__dirname, '..', 'server/kern/appstore/besluit.js'), 'utf8');
  assert.match(bron, /toegankelijk\.belet\(v\)/);
  assert.match(bron, /keuze === 'gepubliceerd' && toegankelijk/,
    'de poort hoort alleen bij PUBLICEREN te staan');
  /* ./versies.js MAG de uitslag noemen -- publiekV draagt hem naar het
     keuringsscherm, want de mens die aftekent moet hem kunnen lezen. Wat daar
     niet mag staan is de POORT: geen belet(), en niets dat op de uitslag een
     inzending tegenhoudt. Inzenden mag altijd; alleen publiceren niet. */
  const versies = fs.readFileSync(path.join(__dirname, '..', 'server/kern/appstore/versies.js'), 'utf8');
  const kaal = versies.replace(/\/\*[\s\S]*?\*\//g, '');
  assert.ok(!/belet/.test(kaal), 'inzenden hoort niet op de keuring te wachten: dat mag altijd');
  for (const r of kaal.split('\n')) {
    assert.ok(!(/toegankelijk/.test(r) && /\breturn\b.*(status|error)/.test(r)),
      'geen weigering op de uitslag bij het inzenden: ' + r.trim());
  }
});

test('10 - weigeren mag zonder keuring', () => {
  /* Een mens die een app afkeurt hoeft niet eerst te meten. Zou de poort ook
     daar staan, dan kan een slechte inzending niet eens worden weggestuurd. */
  const bron = fs.readFileSync(path.join(__dirname, '..', 'server/kern/appstore/besluit.js'), 'utf8');
  const stuk = bron.slice(bron.indexOf('function besluit'), bron.indexOf('function besluit') + 3000);
  const poort = stuk.indexOf('toegankelijk.belet');
  const geweigerd = stuk.indexOf("keuze === 'geweigerd'");
  assert.ok(poort > 0 && geweigerd > 0, 'beide takken horen te bestaan');
  assert.match(stuk.slice(poort - 120, poort), /gepubliceerd/,
    'de poort staat in de publiceer-tak en niet in de weiger-tak');
});

test('11 - de keurloper leest de bundel van schijf en verandert er niets aan', () => {
  const loper = require('../scripts/appstore-a11y');
  const data = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-keurdata-'));
  const van = path.join(data, 'appstore', 'app', 'hash1');
  fs.mkdirSync(van, { recursive: true });
  fs.writeFileSync(path.join(van, 'index.html'), '<html lang="nl"><head><title>x</title></head><body>hoi</body></html>');
  fs.writeFileSync(path.join(van, 'bundel.json'), JSON.stringify({ sleutel: 'app', hash: 'hash1', bestanden: { 'index.html': {} } }));

  const oud = process.env.RTG_DATA_DIR;
  process.env.RTG_DATA_DIR = data;
  delete require.cache[require.resolve('../scripts/appstore-a11y')];
  const verse = require('../scripts/appstore-a11y');
  const w = verse.schrijfWerkmap('app', 'hash1', { sleutel: 'app', start: 'index.html' });
  if (oud === undefined) delete process.env.RTG_DATA_DIR; else process.env.RTG_DATA_DIR = oud;

  assert.ok(w.map, w.error || 'de werkmap hoort te worden gemaakt');
  assert.ok(fs.existsSync(path.join(w.map, 'index.html')), 'de bundel hoort te zijn gekopieerd');
  assert.ok(fs.existsSync(path.join(w.map, 'manifest.json')), 'met een manifest dat de keuring kent');
  assert.equal(fs.readFileSync(path.join(w.map, 'index.html'), 'utf8'),
    fs.readFileSync(path.join(van, 'index.html'), 'utf8'), 'en er hoort niets aan veranderd te zijn');
  fs.rmSync(w.map, { recursive: true, force: true });
  fs.rmSync(data, { recursive: true, force: true });
  assert.ok(loper, 'de loper hoort te laden');
});

test('12 - een ontbrekende bundel wordt niet-vast-te-stellen en geen stilte', () => {
  const loper = require('../scripts/appstore-a11y');
  const w = loper.schrijfWerkmap('bestaat', 'niet', { sleutel: 'x', start: 'index.html' });
  assert.ok(w.error, 'een ontbrekende bundel hoort een fout te geven en geen lege map');
  assert.match(w.error, /ligt niet op/);
});
