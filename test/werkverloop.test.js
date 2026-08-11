/* ============================================================================
   DE GEBEURTENISLAAG ONDER HET WERK OS -- en waarom het VANGNET het bewijs is.

   WAAROM DIT BESTAAT

   server/bedrijf/toen.js kon zeggen WAT er bestond op een datum en zei er
   eerlijk bij dat de TOESTAND van toen niet vast te stellen was: "een wijziging
   overschrijft de vorige waarde en er ligt geen gebeurtenislaag onder de
   schrijfhandelingen." Dat stond zo in TAKEN.md 5.39(c).

   server/bedrijf/verloop.js is die laag. Maar een gebeurtenislaag die elke
   schrijfplek moet aanroepen, is bij de vijftiende schrijfplek al niet meer
   compleet -- en dan LIEGT de reconstructie, want een ontbrekende regel leest
   als "er is niets veranderd". Dat is erger dan geen laag hebben, en het is de
   reden dat de helft van deze toetsen over het vangnet gaat.

   WAT ER WORDT VASTGELEGD

   1. De nette weg legt de oude waarde vast, met tijdstip en naam.
   2. De toestand van toen wordt gereconstrueerd door terug te draaien.
   3. Een wijziging BUITEN de laag om wordt opgemerkt -- en niet gedateerd.
   4. Een reconstructie die over zo'n gat kijkt, zegt dat zij onzeker is.
   5. De gevolgde velden worden AFGELEID uit de soort, niet overgetypt.
   ========================================================================== */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert');

const { verloopZet, verloopMeet, verloopStandOp, volgVelden } = require('../server/bedrijf/verloop');
const { SOORTEN } = require('../server/kern/werkcommand/soorten');

const soortVan = (type) => SOORTEN.find(s => s.type === type);

/* Een kale werkruimte met een paar rijen. Deze laag praat alleen met het
   werkruimte-object; er is geen server nodig, en dat is met opzet. */
function ruimte() {
  return {
    code: 'PROEF',
    projecten: { p1: { id: 'p1', naam: 'Havenrenovatie', status: 'concept', eigenaar: 'Reiger', at: '2026-01-10T09:00:00.000Z' } },
    contracten: { c1: { id: 'c1', naam: 'Onderhoud', status: 'concept', at: '2026-02-01T09:00:00.000Z' } },
    taken: { t1: { id: 't1', titel: 'Kade meten', kolom: 'te doen', wie: 'Reiger', at: '2026-01-11T09:00:00.000Z' } }
  };
}

test('de gevolgde velden worden afgeleid uit de soort, niet overgetypt', () => {
  /* Zou hier een eigen lijst staan, dan is dat de tweede waarheid waar
     LAT-regel 4 over gaat: een nieuw veld in soorten.js zou dan stil buiten de
     gebeurtenislaag vallen. */
  const project = volgVelden(soortVan('project'));
  assert.ok(project.includes('status'), 'status hoort als toestand te tellen');
  assert.ok(project.includes('eigenaar'));
  assert.equal(project.includes('id'), false, 'een identiteitsveld is geen toestand');
  assert.equal(project.includes('naam'), false);

  const taak = volgVelden(soortVan('taak'));
  assert.ok(taak.includes('kolom') && taak.includes('wie'));
});

test('de nette weg legt de oude waarde vast, met tijdstip en naam', () => {
  const w = ruimte();
  const p = w.projecten.p1;

  assert.equal(verloopZet(w, 'project', p, 'status', 'loopt', 'Imran'), true);
  assert.equal(p.status, 'loopt', 'het veld hoort gewoon gezet te worden');

  assert.equal(w.verloop.length, 1);
  const e = w.verloop[0];
  assert.equal(e.oud, 'concept');
  assert.equal(e.nieuw, 'loopt');
  assert.equal(e.door, 'Imran');
  assert.ok(e.at, 'de nette weg hoort een tijdstip te dragen');
  assert.equal(e.ongemeten, undefined);

  /* Dezelfde waarde opnieuw zetten is geen gebeurtenis. Zou dat wel een regel
     opleveren, dan loopt het log vol met ruis en wordt "er is iets veranderd"
     betekenisloos. */
  assert.equal(verloopZet(w, 'project', p, 'status', 'loopt', 'Imran'), false);
  assert.equal(w.verloop.length, 1);
});

test('de toestand van toen wordt gereconstrueerd door terug te draaien', () => {
  const w = ruimte();
  const c = w.contracten.c1;
  const so = soortVan('contract');

  // concept -> actief op 1 maart, actief -> opgezegd op 1 juni
  w.verloop = [
    { soort: 'contract', id: 'c1', veld: 'status', oud: 'concept', nieuw: 'actief', at: '2026-03-01T10:00:00.000Z', door: 'Imran' },
    { soort: 'contract', id: 'c1', veld: 'status', oud: 'actief', nieuw: 'opgezegd', at: '2026-06-01T10:00:00.000Z', door: 'Imran' }
  ];
  w.verloopStand = {};
  c.status = 'opgezegd';

  /* DIT IS DE VRAAG DIE HIER JARENLANG NIET KON: was dit contract op 12 april
     actief of nog concept? */
  const april = verloopStandOp(w, so, c, '2026-04-12');
  assert.equal(april.stand.status, 'actief', 'op 12 april was het contract actief');
  assert.equal(april.zeker, true);
  assert.equal(april.bestond, true);

  assert.equal(verloopStandOp(w, so, c, '2026-02-15').stand.status, 'concept');
  assert.equal(verloopStandOp(w, so, c, '2026-08-01').stand.status, 'opgezegd');

  // en vóór het bestaan van de rij is er geen toestand
  const voor = verloopStandOp(w, so, c, '2025-12-01');
  assert.equal(voor.bestond, false, 'op die dag bestond dit contract nog niet');
});

test('HET VANGNET: een wijziging buiten de laag om wordt opgemerkt en niet gedateerd', () => {
  const w = ruimte();
  const so = soortVan('project');

  // eerste meting: de beginstand leren kennen, zonder ruis
  const eerst = verloopMeet(w, SOORTEN);
  assert.equal(eerst.ongemeten, 0, 'de eerste meting hoort geen wijzigingen te melden');
  assert.equal((w.verloop || []).length, 0,
    'een rij die je voor het eerst ziet is ONTSTAAN, geen wijziging -- anders is het vangnet een ruismachine');

  /* Nu schrijft iemand rechtstreeks, zoals dat in twaalf van de veertien
     schrijfplekken gebeurde voordat deze laag er was. */
  w.projecten.p1.status = 'loopt';

  const na = verloopMeet(w, SOORTEN);
  assert.equal(na.ongemeten, 1, 'het vangnet hoort deze wijziging op te merken');
  const e = w.verloop.find(x => x.veld === 'status');
  assert.equal(e.oud, 'concept', 'de oude waarde weten we wel');
  assert.equal(e.at, null, 'het TIJDSTIP weten we niet, en dat wordt niet verzonnen');
  assert.equal(e.ongemeten, true);

  // en een tweede meting zonder wijziging levert niets nieuws op
  assert.equal(verloopMeet(w, SOORTEN).ongemeten, 0);
});

test('een reconstructie die over een gat kijkt, zegt dat zij onzeker is', () => {
  const w = ruimte();
  const so = soortVan('project');
  verloopMeet(w, SOORTEN);
  w.projecten.p1.status = 'loopt';        // buitenom
  verloopMeet(w, SOORTEN);

  const uit = verloopStandOp(w, so, w.projecten.p1, '2026-05-01');
  assert.equal(uit.zeker, false, 'met een ongedateerde wijziging kan dit niet zeker zijn');
  assert.equal(uit.onzeker, 1);
  assert.match(uit.let, /niet wanneer/i,
    'de marge hoort IN de uitslag te staan; een toestand die netjes oogt maar niet klopt, gaat iemand geloven');

  /* En zonder gat is hij wel zeker -- anders zegt deze laag altijd "misschien"
     en is de melding betekenisloos. */
  const w2 = ruimte();
  verloopZet(w2, 'project', w2.projecten.p1, 'status', 'loopt', 'Imran');
  assert.equal(verloopStandOp(w2, so, w2.projecten.p1, '2026-05-01').zeker, true);
});

test('de nette weg en het vangnet werken samen zonder dubbel te tellen', () => {
  const w = ruimte();
  verloopMeet(w, SOORTEN);                                    // beginstand
  verloopZet(w, 'taak', w.taken.t1, 'kolom', 'bezig', 'Imran');  // netjes
  const na = verloopMeet(w, SOORTEN);
  assert.equal(na.ongemeten, 0,
    'het vangnet hoort een wijziging die al netjes is vastgelegd NIET nog eens te melden');
  assert.equal(w.verloop.filter(e => e.veld === 'kolom').length, 1);
});

/* ----------------------------------------------------------------------------
   DE MUTATIES DIE ZIJN GEDAAN (LAT-regel 2)

   1. verloopZet() de oude waarde niet laten bewaren      -> toets 2 zakt
   2. verloopStandOp() niet laten terugdraaien            -> toets 3 zakt
   3. het vangnet een tijdstip laten verzinnen (nu())     -> toets 4 zakt
   4. `zeker` altijd true laten geven                     -> toets 5 zakt
   5. verloopZet() de stand niet laten bijwerken          -> toets 6 zakt
   6. IDENTITEIT leegmaken (id/naam gaan meetellen)       -> toets 1 zakt
   -------------------------------------------------------------------------- */
