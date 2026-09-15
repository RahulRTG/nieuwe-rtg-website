/* Adaptief RTG -- de regels die niet mogen sneuvelen (ADAPTIEFRTG.md par. 5).

   Alles hier draait zonder server, want ./ladder.js en ./vraag.js zijn puur en
   ./neiging.js heeft alleen een db-achtig object nodig. De HTTP-kant staat in
   test/adaptief.e2e.js: die bewijst de montage en de deur, en deze bewijst het
   gedrag. Twee vragen, twee bestanden -- een nagemaakte app bewijst het
   handlergedrag en niet de bedrading (LAT-regel 17). */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

const ladder = require('../server/kern/adaptief/ladder');
const vraag = require('../server/kern/adaptief/vraag');
const maakNeiging = require('../server/kern/adaptief/neiging');
const maakAdaptief = require('../server/kern/adaptief');

/* Een wegwerphuis. `save` telt mee, zodat een toets kan zien DAT er bewaard is
   en niet alleen dat een functie netjes terugkwam. */
function huis(nu) {
  const db = { data: {} };
  let bewaard = 0;
  const klok = { t: nu || '2026-09-15T00:00:00Z' };
  const deps = { db, save: () => { bewaard++; }, crypto, nu: () => klok.t };
  return { db, klok, tel: () => bewaard, neiging: maakNeiging(deps), laag: maakAdaptief(deps) };
}

/* ------------------------------------------------------------------ ladder */

test('de ladder is de bestaande vier van BESTUUR.md en geen zesde', () => {
  assert.deepEqual(ladder.GRADEN, ['onbekend', 'vermoed', 'gemeten', 'bewezen']);
});

test('wat het lid zelf zei vervalt niet door tijd; wat RTG raadde wel', () => {
  const nu = '2029-09-15T00:00:00Z', oud = '2026-09-15T00:00:00Z';
  assert.equal(ladder.graadVan({ grond: 'gezegd', aantal: 1, laatst: oud, nu }), 'bewezen',
    'een uitspraak van het lid mag niet verjaren');
  assert.equal(ladder.graadVan({ grond: 'afgeleid', aantal: 1, laatst: oud, nu }), 'onbekend');
  assert.equal(ladder.graadVan({ grond: 'gekozen', aantal: 9, laatst: oud, nu }), 'onbekend');
});

test('herhaald gedrag is pas GEMETEN vanaf de drempel', () => {
  const nu = '2026-09-15T00:00:00Z';
  assert.equal(ladder.graadVan({ grond: 'gekozen', aantal: ladder.DREMPEL - 1, laatst: nu, nu }), 'vermoed');
  assert.equal(ladder.graadVan({ grond: 'gekozen', aantal: ladder.DREMPEL, laatst: nu, nu }), 'gemeten');
});

test('een onbekende grond levert de LAAGSTE trede en nooit een middenklasse', () => {
  const nu = '2026-09-15T00:00:00Z';
  assert.equal(ladder.graadVan({ grond: 'verzonnen', aantal: 99, laatst: nu, nu }), 'onbekend');
});

test('een onleesbare datum laat niets zakken -- niet-weten werkt nooit tegen het lid', () => {
  assert.equal(ladder.tijdverval('gekozen', 'geen datum', '2026-09-15T00:00:00Z'), 0);
});

/* ------------------------------------------------------------------ doelen */

test('de doelen zijn een gesloten lijst van twee, en adverteren zit er niet bij', () => {
  const h = huis();
  assert.deepEqual(h.neiging.DOELEN, ['tonen', 'helpen']);
  h.neiging.onthoud('k', { onderwerp: 'eten', grond: 'gezegd' });
  const r = h.neiging.neigingen('k', 'adverteren');
  assert.equal(r.status, 400, 'een onbekend doel moet WEIGEREN en geen lege lijst geven');
  assert.ok(!r.neigingen, 'een weigering mag geen lijst meesturen');
});

test('een neiging komt er niet uit voor een doel dat zij niet draagt', () => {
  const h = huis();
  h.neiging.onthoud('k', { onderwerp: 'eten', grond: 'gezegd', doel: ['tonen'] });
  assert.equal(h.neiging.neigingen('k', 'tonen').neigingen.length, 1);
  assert.equal(h.neiging.neigingen('k', 'helpen').neigingen.length, 0);
});

test('"niet hiervoor gebruiken" komt niet terug doordat het gedrag zich herhaalt', () => {
  const h = huis();
  const n = h.neiging.onthoud('k', { onderwerp: 'muziek', grond: 'gekozen', doel: ['tonen', 'helpen'] }).neiging;
  h.neiging.nietVoor('k', n.id, 'tonen');
  h.neiging.onthoud('k', { onderwerp: 'muziek', grond: 'gekozen', doel: ['tonen'] });
  const na = h.neiging.alles('k')[0];
  assert.deepEqual(na.doel, ['helpen'], 'een weggehaald doel mag niet terugkeren via herhaling');
});

test('geen enkel doel over betekent geweigerd, en de regel blijft ZICHTBAAR staan', () => {
  const h = huis();
  const n = h.neiging.onthoud('k', { onderwerp: 'sport', grond: 'gezegd', doel: ['tonen'] }).neiging;
  h.neiging.nietVoor('k', n.id, 'tonen');
  assert.equal(h.neiging.neigingen('k', 'tonen').neigingen.length, 0, 'hij mag nergens meer voor tellen');
  assert.equal(h.neiging.alles('k').length, 1, 'maar het lid moet hem wel kunnen zien staan');
  assert.equal(h.neiging.alles('k')[0].geweigerd, true);
});

test('vergeten is echt weg en niet een vlaggetje', () => {
  const h = huis();
  const n = h.neiging.onthoud('k', { onderwerp: 'sport', grond: 'gezegd' }).neiging;
  assert.equal(h.neiging.vergeet('k', n.id).ok, true);
  assert.equal(h.neiging.alles('k').length, 0);
  assert.equal(h.neiging.vergeet('k', n.id).status, 404);
});

test('twee leden zien elkaars neigingen niet', () => {
  const h = huis();
  h.neiging.onthoud('lid-a', { onderwerp: 'eten', grond: 'gezegd' });
  assert.equal(h.neiging.alles('lid-b').length, 0);
});

test('de bewaartermijn staat er vanaf de eerste regel en veegt echt', () => {
  const h = huis();
  h.neiging.onthoud('k', { onderwerp: 'eten', grond: 'gezegd' });
  assert.ok(h.neiging.alles('k')[0].vervalt, 'elke neiging draagt een vervaldatum');
  h.klok.t = '2029-01-01T00:00:00Z';
  assert.equal(h.neiging.veeg('k'), 1);
  assert.equal(h.neiging.alles('k').length, 0);
});

/* ----------------------------------------------------------------- vragen */

test('elke optie wijst naar een onderdeel dat werkelijk bestaat', () => {
  const c = vraag.controle();
  assert.equal(c.ok, true, 'onbekende bestemmingen: ' + JSON.stringify(c.onbekend));
});

test('een vraag zonder winst wordt niet gesteld', () => {
  /* Alles van de openingsvraag gekozen en alle vervolgvragen gehad: dan is er
     niets meer te winnen en hoort de motor NIETS te geven. */
  const alles = vraag.VRAGEN.flatMap(v => v.opties.map(o => o.onderwerp));
  assert.equal(vraag.volgende(alles, vraag.VRAGEN.map(v => v.id)), null);
});

test('de intake kapt zichzelf af en herhaalt geen gestelde vraag', () => {
  const h = huis();
  const gehad = [];
  let s = h.laag.adaptiefIntake('k'), rondes = 0;
  while (!s.klaar) {
    assert.ok(rondes++ < 12, 'de intake eindigt niet');
    assert.ok(!gehad.includes(s.vraag.id), 'vraag ' + s.vraag.id + ' werd twee keer gesteld');
    assert.ok(s.vraag.winst > 0, 'een vraag zonder winst hoort niet gesteld te worden');
    gehad.push(s.vraag.id);
    s = h.laag.adaptiefAntwoord('k', s.vraag.id, [s.vraag.opties[0].onderwerp]);
  }
  assert.ok(rondes >= 2, 'er hoort minstens een vervolgvraag te komen');
  assert.ok(s.opent.length > 0, 'na de intake hoort er iets open te staan');
});

test('niets aanvinken is ook een antwoord -- de vraag komt niet terug', () => {
  const h = huis();
  const eerst = h.laag.adaptiefIntake('k').vraag;
  const na = h.laag.adaptiefAntwoord('k', eerst.id, []);
  assert.equal(na.opgeslagen, 0);
  assert.ok(!na.vraag || na.vraag.id !== eerst.id, 'dezelfde vraag mag niet opnieuw komen');
});

test('een onderwerp dat niet bij de vraag hoort, wordt niet bewaard', () => {
  const h = huis();
  const v = h.laag.adaptiefIntake('k').vraag;
  const r = h.laag.adaptiefAntwoord('k', v.id, ['ik:ben:een:smokkelaar']);
  assert.equal(r.opgeslagen, 0);
  assert.equal(r.genegeerd, 1);
  assert.equal(h.laag.adaptiefGeheugen('k').neigingen.length, 0);
});

test('een onbekende vraag-id wordt geweigerd', () => {
  const h = huis();
  assert.equal(h.laag.adaptiefAntwoord('k', 'bestaat-niet', []).status, 400);
});

test('de uitkomst voegt alleen TOE en sluit nooit iets af', () => {
  const zonder = vraag.opent([]);
  const met = vraag.opent(['reizen']);
  assert.equal(zonder.length, 0);
  assert.ok(met.every(x => !zonder.includes(x) || met.includes(x)));
  /* Wat open stond blijft open als er een onderwerp bij komt. */
  const meer = vraag.opent(['reizen', 'eten']);
  for (const x of met) assert.ok(meer.includes(x), x + ' ging dicht door een EXTRA antwoord');
});

test('een antwoord van het lid telt als GEZEGD en nooit als afgeleid', () => {
  const h = huis();
  const v = h.laag.adaptiefIntake('k').vraag;
  h.laag.adaptiefAntwoord('k', v.id, [v.opties[0].onderwerp]);
  assert.equal(h.laag.adaptiefGeheugen('k').neigingen[0].grond, 'gezegd');
});

test('gedrag wordt nooit als een uitspraak van het lid geboekt', () => {
  const h = huis();
  /* Ook als een aanroeper `gezegd` probeert mee te geven. */
  h.laag.adaptiefMerkOp('k', 'eten:japans', 'gezegd');
  assert.equal(h.laag.adaptiefGeheugen('k').neigingen[0].grond, 'afgeleid');
});

/* --------------------------------------------------------------- geheugen */

test('twee keer hetzelfde ZEGGEN is een uitspraak; twee keer hetzelfde DOEN telt', () => {
  const h = huis();
  /* Gemeten aanleiding: een tweede identieke POST op /api/adaptief/antwoord
     veranderde het beeld van het lid opnieuw -- een dubbelklik werd een tweede
     gebeurtenis. Voor gedrag is tellen juist de bedoeling. */
  h.neiging.onthoud('k', { onderwerp: 'eten', grond: 'gezegd' });
  h.neiging.onthoud('k', { onderwerp: 'eten', grond: 'gezegd' });
  const gezegd = h.neiging.alles('k').find(n => n.grond === 'gezegd');
  assert.equal(gezegd.aantal, 1, 'een herhaalde uitspraak mag niet meetellen als tweede');

  h.neiging.onthoud('k', { onderwerp: 'sport', grond: 'gekozen' });
  h.neiging.onthoud('k', { onderwerp: 'sport', grond: 'gekozen' });
  const gekozen = h.neiging.alles('k').find(n => n.grond === 'gekozen');
  assert.equal(gekozen.aantal, 2, 'herhaald GEDRAG hoort juist wel te tellen -- dat is de graad');
});

test('een herhaald antwoord verandert het beeld van het lid niet meer', () => {
  const h = huis();
  const v = h.laag.adaptiefIntake('k').vraag;
  const keuze = [v.opties[0].onderwerp];
  h.laag.adaptiefAntwoord('k', v.id, keuze);
  const na1 = JSON.stringify(h.laag.adaptiefGeheugen('k').neigingen);
  h.laag.adaptiefAntwoord('k', v.id, keuze);
  const na2 = JSON.stringify(h.laag.adaptiefGeheugen('k').neigingen);
  assert.equal(na1, na2, 'een tweede identiek antwoord hoort niets te veranderen');
});

test('de geheugenkaart toont ook wat niet meer meetelt, met de reden', () => {
  const h = huis();
  h.laag.adaptiefMerkOp('k', 'muziek:hiphop', 'afgeleid');
  h.klok.t = '2026-12-25T00:00:00Z';
  const g = h.laag.adaptiefGeheugen('k');
  assert.equal(g.neigingen.length, 1, 'hij mag niet stil verdwijnen');
  assert.equal(g.neigingen[0].telt, false);
  assert.ok(g.neigingen[0].stil, 'er hoort een reden bij te staan');
  assert.equal(g.telt, 0);
});

test('de geheugenkaart noemt zijn eigen rand', () => {
  const g = huis().laag.adaptiefGeheugen('k');
  assert.ok(g.grenzen.length >= 4, 'een overzicht zonder rand leest als "dit is alles"');
  for (const x of g.grenzen) assert.ok(x.naam && x.reden);
});

test('de intake is nooit verplicht: overslaan bestaat en laat de neigingen staan', () => {
  const h = huis();
  const v = h.laag.adaptiefIntake('k').vraag;
  h.laag.adaptiefAntwoord('k', v.id, [v.opties[0].onderwerp]);
  assert.equal(h.laag.adaptiefOverslaan('k').klaar, true);
  assert.equal(h.laag.adaptiefIntake('k').klaar, true, 'na overslaan komt er geen vraag meer');
  assert.equal(h.laag.adaptiefGeheugen('k').neigingen.length, 1, 'overslaan wist niets');
});

test('opnieuw beginnen haalt de vragen terug en raakt geen enkele neiging aan', () => {
  const h = huis();
  h.laag.adaptiefOverslaan('k');
  h.laag.adaptiefMerkOp('k', 'sport', 'gekozen');
  const r = h.laag.adaptiefOpnieuw('k');
  assert.equal(r.klaar, false, 'er hoort weer een vraag te komen');
  assert.equal(h.laag.adaptiefGeheugen('k').neigingen.length, 1, 'opnieuw mag niets wissen');
});
