/* DE KLANTNAAD: hoe een ledensessie een handle op een rekening wordt.

   Deze toets start GEEN server. Dat is geen luiheid maar precies de reden dat
   de naad een eigen bestand is: het is een rekenregel zonder opslag, en die
   hoort in milliseconden na te lopen zijn.

   WAAROM DIT ER STAAT. `handleVan` stond woordelijk in twee routebestanden
   (bezorgen en foodcourt). Bij het samenvoegen bleken twee beweringen die ik in
   het commentaar had opgeschreven door geen enkele toets te worden bewaakt: ik
   heb ze allebei kapotgemaakt en de hele gastreeks bleef groen (LAT-regel 10 --
   een meter die je niet hebt zien bewegen, meet niets). Vandaar dit bestand.

   De twee beweringen:
   1. EEN LEGE HANDLE MAG NOOIT ALLES ZIEN. `isVan` beslist bij bezorgen,
      afhalen en de foodcourt of een rekening van jou is. Zou een lege handle
      "ja" opleveren, dan ziet een sessie zonder codenaam en zonder sleutel
      andermans bestellingen. Dat is geen crash en geen foutmelding; dat is een
      lek dat gewoon werkt.
   2. ER GAAT GEEN LEDENSLEUTEL DE OPSLAG VAN EEN ZAAK IN. Zonder codenaam
      wordt de handle "lid-" plus de LAATSTE ZES tekens van de sessiesleutel:
      genoeg om jouw bestellingen uit elkaar te houden, te weinig om er iets
      mee te doen (CLAUDE.md, privacy by design). */
const test = require('node:test');
const assert = require('node:assert/strict');
const naad = require('../server/kern/gast/naad')();

test('de codenaam is de handle; nooit de naam en nooit het e-mailadres', () => {
  const h = naad.handleVan({ key: 'user-42', account: { codename: 'Zilverreiger', name: 'Jamie de Vries', email: 'jamie@voorbeeld.nl' } });
  assert.equal(h, 'Zilverreiger');
  assert.ok(!/jamie|vries/i.test(h), 'er staat niets herleidbaars in: ' + h);
});

test('zonder codenaam gaat er hooguit zes tekens van de sessiesleutel mee', () => {
  const sleutel = 'user-geheim-abc123def456';
  const h = naad.handleVan({ key: sleutel });
  assert.equal(h, 'lid-def456');
  assert.ok(!h.includes(sleutel), 'de volledige sleutel hoort niet in de opslag van een zaak te belanden');
  assert.ok(h.length <= 10, 'en er gaat niet stiekem meer mee: ' + h);
  assert.equal(naad.handleVan({}), 'lid-', 'zonder sessie blijft er niets over om mee te geven');
});

test('bezorgen en de foodcourt komen op DEZELFDE handle uit', () => {
  /* Dit was de aanleiding: twee kopieen van dezelfde functie. Zouden ze
     uiteenlopen, dan vinden je bezorgbestellingen en je foodcourt-mandje elkaar
     niet meer -- zonder ook maar een foutmelding, want beide kanten werken
     prima met hun eigen handle. */
  const sessie = { key: 'user-7', account: { codename: 'Blauwe Reiger' } };
  const req = { session: sessie };
  assert.equal(naad.handleVanReq(req), naad.handleVan(sessie));
});

test('een lege handle is nooit eigenaar van iets', () => {
  const rek = { id: 'r1', gastId: 'Zilverreiger' };
  assert.equal(naad.isVan(rek, 'Zilverreiger'), true);
  assert.equal(naad.isVan(rek, 'Blauwe Reiger'), false);
  assert.equal(naad.isVan(rek, ''), false, 'een lege handle mag nooit ergens bij horen');
  assert.equal(naad.isVan(rek, null), false);
  assert.equal(naad.isVan(rek, undefined), false);
  assert.equal(naad.isVan({ id: 'r2' }, 'Zilverreiger'), false, 'een rekening zonder gastId is van niemand');
  assert.equal(naad.isVan(null, 'Zilverreiger'), false);
  assert.equal(naad.isVan({ id: 'r3', gastId: undefined }, undefined), false,
    'twee keer niets is geen overeenkomst');
});
