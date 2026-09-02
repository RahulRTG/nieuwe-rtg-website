/* EERST KEUREN, DAN PAKKEN, DAN TOEPASSEN -- twee fouten in een functie.

   `zet()` in server/kern/socialebeleid/index.js had ze allebei, en de
   staatproef vond ze in EEN meting: "geweigerd (status 400) en de toestand
   veranderde toch: socialebeleid".

   EEN: `pak(key)` stond op de eerste regel. Die functie SCHRIJFT -- hij maakt
   `db.data.socialebeleid[k]` aan als hij er nog niet is. Een lid dat een
   onbekende soort meestuurde kreeg netjes zijn 400, maar had intussen wel een
   beleidsrij gekregen die er daarvoor niet was.

   TWEE, en die is erger: de drie velden werden VELD VOOR VELD toegepast terwijl
   er verderop nog geweigerd kon worden. Wie `{soort:'x', horizon:9999}` stuurde,
   kreeg een 400 op de horizon -- met de soort al uitgezet. Een geweigerd verzoek
   dat de helft van zijn werk laat staan is precies de uitkomst die de staatproef
   "echt slecht" noemt: de statuscode en de database spreken elkaar tegen.

   WAT DIT KOSTTE. Via de bewijsmatrix werd het een gezakte ROLLBACK-cel, in
   VERTROUWEN.json een `geschorst`, en server/middleware/schorspoort.js zette
   /api/sociaal/beleid/zet met een 503 dicht.

   Draai los: node --test test/socialebeleid-volgorde.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

/* Rechtstreeks op de kern met een NAMAAK-db, zonder server: dit gaat over de
   VOLGORDE binnen een functie, en daar hoort geen HTTP-laag tussen te zitten. */
function kern() {
  const db = { data: { socialebeleid: {} } };
  const mod = require(path.join(__dirname, '..', 'server', 'kern', 'socialebeleid'))(
    { db, save() {}, soorten: ['antwoord', 'uitnodiging'] });
  return { zet: mod.socialebeleid.zet, beleid: mod.socialebeleid.beleid, db };
}

test('een GEWEIGERDE zet laat geen beleidsrij achter', () => {
  /* Mutatie nagetrokken: `const r = pak(key)` terugzetten naar de eerste regel
     van zet() laat deze toets zakken -- de rij bestaat dan na de 400. */
  const { zet, db } = kern();
  const r = zet('proefsleutel', { soort: 'bestaat-niet' });
  assert.equal(r.status, 400, 'een onbekende soort wordt geweigerd');
  assert.deepEqual(Object.keys(db.data.socialebeleid), [],
    'en er is geen rij bijgekomen: pak() hoort pas te draaien als er niets meer geweigerd kan worden');
});

test('en een zet die HALVERWEGE wordt geweigerd, laat de eerste helft ook niet staan', () => {
  /* De duurste van de twee. `soort` is geldig, `horizon` niet -- de oude code
     had de soort al uitgezet voordat hij op de horizon viel. Een geweigerd
     verzoek dat de helft van zijn werk laat staan, is precies waar de
     ROLLBACK-cel over gaat: de statuscode en de database spreken elkaar tegen.

     Mutatie nagetrokken: de drie controles terugzetten tussen de toepassingen
     (zoals het was) laat deze toets zakken op de tweede assertie. */
  const { zet, beleid, db } = kern();
  const r = zet('halfsleutel', { soort: 'antwoord', aan: false, horizon: 999999 });
  assert.equal(r.status, 400, 'de horizon wordt geweigerd');
  assert.deepEqual(Object.keys(db.data.socialebeleid), [],
    'en er staat nog steeds geen rij');
  assert.ok(beleid('halfsleutel').soorten.find(s => s.soort === 'antwoord').aan,
    'de soort staat NIET uit: een geweigerd verzoek voert geen halve opdracht uit');
});

test('DE TEGENPROEF: een GELDIGE zet doet zijn werk wel', () => {
  /* Zonder deze zou een zet() die altijd weigert de twee toetsen hierboven ook
     halen -- en dan is een kapotte functie een geslaagde grendel. */
  const { zet, beleid, db } = kern();
  const r = zet('goed', { soort: 'antwoord', aan: false });
  assert.equal(r.status, 200, 'een geldige zet gaat door');
  assert.equal(r.gewijzigd, true);
  assert.ok(!beleid('goed').soorten.find(s => s.soort === 'antwoord').aan, 'en de soort staat nu uit');
  assert.deepEqual(Object.keys(db.data.socialebeleid), ['goed'], 'nu is er wel een rij');
});
