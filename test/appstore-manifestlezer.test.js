'use strict';
/* De manifestlezer van de App Store (server/kern/appstore/manifest.js), veld
   voor veld.

   Het manifest is het enige dat een uitgever zelf invult en dat daarna door het
   hele huis wordt gelezen, dus elke weigering hoort bij het juiste VELD te
   staan en de reden te dragen. Deze toets zet per veld een fout neer en kijkt
   of die fout -- en alleen die -- terugkomt, plus de drie keuzes uit de kop:
   onbekende sleutels worden geweigerd, er staan geen url's in, en een
   machtiging die niet bestaat zegt waarom. */
const test = require('node:test');
const assert = require('node:assert/strict');
const { lees, SLEUTELS } = require('../server/kern/appstore/manifest');

const goed = () => ({ sleutel: 'route-planner', naam: 'Routeplanner', versie: '1.0.0',
  uitleg: 'Plant een wandelroute langs de plekken die je bewaart.', categorie: 'reizen' });
const velden = (r) => r.fouten.map((f) => f.veld);
const metFout = (wijziging) => lees(Object.assign(goed(), wijziging));

test('1. een minimaal manifest gaat door en krijgt zijn standaarden', () => {
  const r = lees(goed());
  assert.equal(r.ok, true, JSON.stringify(r.fouten));
  assert.deepEqual(r.manifest, { sleutel: 'route-planner', naam: 'Routeplanner', versie: '1.0.0',
    uitleg: 'Plant een wandelroute langs de plekken die je bewaart.', categorie: 'reizen', start: 'index.html',
    icoon: null, machtigingen: [], doelen: {}, taal: 'nl', prijsCenten: 0, arena: null });
});

test('2. geen object is geen manifest', () => {
  for (const ruw of [null, undefined, 'tekst', 3, ['lijst']]) {
    const r = lees(ruw);
    assert.equal(r.ok, false);
    assert.deepEqual(velden(r), ['manifest']);
  }
});

test('3. een onbekend veld wordt geweigerd, ook een url', () => {
  const r = metFout({ homepage: 'https://voorbeeld.nl' });
  assert.deepEqual(velden(r), ['homepage']);
  assert.match(r.fouten[0].wat, new RegExp(SLEUTELS.join(', ')));
});

test('4. elk vormveld zakt op zijn eigen naam', () => {
  const gevallen = [
    [{ sleutel: '9begint-met-cijfer' }, 'sleutel'], [{ sleutel: 'ab' }, 'sleutel'],
    [{ naam: 'x' }, 'naam'], [{ naam: 'n'.repeat(61) }, 'naam'],
    [{ versie: '1.0' }, 'versie'], [{ uitleg: 'te kort' }, 'uitleg'], [{ uitleg: 'u'.repeat(261) }, 'uitleg'],
    [{ categorie: 'casino' }, 'categorie'],
    [{ start: 'index.js' }, 'start'], [{ start: '../buiten.html' }, 'start'], [{ start: '/abs.html' }, 'start'],
    [{ icoon: 'icoon.gif' }, 'icoon'], [{ icoon: '../icoon.svg' }, 'icoon'],
    [{ taal: 'de' }, 'taal']
  ];
  for (const [wijziging, veld] of gevallen) {
    const r = metFout(wijziging);
    assert.equal(r.ok, false, JSON.stringify(wijziging));
    assert.equal(r.manifest, null);
    assert.deepEqual(velden(r), [veld], JSON.stringify(wijziging));
  }
});

test('5. hoofdletters en witruimte worden genormaliseerd waar dat mag', () => {
  const r = metFout({ sleutel: '  Route-Planner ', categorie: 'REIZEN', taal: 'EN', start: 'app/start.html', icoon: 'img/logo.svg' });
  assert.equal(r.ok, true, JSON.stringify(r.fouten));
  assert.equal(r.manifest.sleutel, 'route-planner');
  assert.equal(r.manifest.categorie, 'reizen');
  assert.equal(r.manifest.taal, 'en');
  assert.equal(r.manifest.start, 'app/start.html');
  assert.equal(r.manifest.icoon, 'img/logo.svg');
});

test('6. machtigingen: een lijst, met een doel uit de gesloten lijst, elk een keer', () => {
  const ok = metFout({ machtigingen: [{ id: 'profiel.basis', doel: 'aanspreken' }, { id: 'opslag.eigen', doel: 'werk-bewaren' }] });
  assert.equal(ok.ok, true, JSON.stringify(ok.fouten));
  assert.deepEqual(ok.manifest.machtigingen, ['profiel.basis', 'opslag.eigen']);
  assert.deepEqual(ok.manifest.doelen, { 'profiel.basis': 'aanspreken', 'opslag.eigen': 'werk-bewaren' });

  assert.deepEqual(velden(metFout({ machtigingen: 'profiel.basis' })), ['machtigingen']);
  assert.match(metFout({ machtigingen: Array(9).fill({ id: 'profiel.basis', doel: 'aanspreken' }) }).fouten[0].wat, /je vraagt er meer/);

  const kaal = metFout({ machtigingen: ['profiel.basis'] });
  assert.match(kaal.fouten[0].wat, /heeft een doel nodig/);
  assert.match(kaal.fouten[0].wat, /aanspreken \(/);

  const verkeerdDoel = metFout({ machtigingen: [{ id: 'profiel.basis', doel: 'werk-bewaren' }] });
  assert.match(verkeerdDoel.fouten[0].wat, /hoort niet bij/);

  const dubbel = metFout({ machtigingen: [{ id: 'profiel.basis', doel: 'aanspreken' }, { id: 'profiel.basis', doel: 'taal-kiezen' }] });
  assert.match(dubbel.fouten[0].wat, /twee keer/);
});

test('7. een machtiging die niet bestaat zegt waarom, en anders wat er wel is', () => {
  const betalen = metFout({ machtigingen: [{ id: 'betalen.afschrijven', doel: 'x' }] });
  assert.match(betalen.fouten[0].wat, /"betalen\.afschrijven" bestaat niet\. \S/);
  assert.doesNotMatch(betalen.fouten[0].wat, /Er zijn er drie/);
  const verzonnen = metFout({ machtigingen: [{ id: 'teleport.nu', doel: 'x' }] });
  assert.match(verzonnen.fouten[0].wat, /profiel\.basis, opslag\.eigen/);
});

test('8. de prijs: hele centen tussen de grenzen, en niet net boven nul', () => {
  assert.equal(metFout({ prijsCenten: 299 }).manifest.prijsCenten, 299);
  assert.equal(metFout({ prijsCenten: '' }).manifest.prijsCenten, 0);
  assert.equal(metFout({ prijsCenten: 0 }).manifest.prijsCenten, 0);
  for (const fout of [-1, 1.5, 50001, 'gratis']) assert.deepEqual(velden(metFout({ prijsCenten: fout })), ['prijsCenten'], String(fout));
  assert.match(metFout({ prijsCenten: 49 }).fouten[0].wat, /onder de 50 cent/);
});

test('9. een arena hoort bij de machtiging arena.meedoen en heeft een richting', () => {
  const met = (arena, machtigingen) => metFout({ arena, machtigingen });
  const meedoen = [{ id: 'arena.meedoen', doel: 'meedoen-arena' }];
  const ok = met({ richting: 'LAAG', eenheid: 'seconden' }, meedoen);
  assert.equal(ok.ok, true, JSON.stringify(ok.fouten));
  assert.deepEqual(ok.manifest.arena, { richting: 'laag', eenheid: 'seconden' });
  assert.deepEqual(met({}, meedoen).manifest.arena, { richting: 'hoog', eenheid: 'punten' });

  assert.match(met({ richting: 'hoog' }).fouten[0].wat, /zonder de machtiging/);
  assert.deepEqual(velden(met('hoog', meedoen)), ['arena']);
  assert.deepEqual(velden(met(['hoog'], meedoen)), ['arena']);
  assert.match(met({ richting: 'opzij' }, meedoen).fouten[0].wat, /"hoog" \(meer is beter\)/);
  assert.match(met({ eenheid: 'e'.repeat(21) }, meedoen).fouten[0].wat, /hooguit 20 tekens/);
  assert.equal(metFout({ arena: '' }).manifest.arena, null);
});
