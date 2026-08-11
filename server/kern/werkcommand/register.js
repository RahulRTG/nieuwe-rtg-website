/* HET OBJECTREGISTER VAN EEN WERKRUIMTE -- het DERDE register in dit huis,
   naast dat van RTG (kern/command/register.js) en dat van een zaak
   (kern/zaakcommand/register.js). Met opzet een eigen register en geen filter
   over een bestaand.

   WAT DIT OPLOST. Het Werk OS had tien modules die elkaar niet kenden: een
   contract wist niet welke projecten eraan hingen, een klant niet welke
   tickets, een ticket niet welk issue. Elke module had zijn eigen lijst en zijn
   eigen zoekveld. De motoren die dat kunnen beantwoorden stonden er al --
   zoek.js, object.js, graaf.js, kwaliteit.js, herkomst.js -- maar ze konden de
   werkruimte-objecten niet zien, want die staan in geen enkel register.
   Dit bestand is dat register. Er wordt geen tabel verplaatst en geen kopie
   aangelegd: elke soort leest de bak waar hij al woonde.

   TWEE ASSEN VAN SCOPE, EN ALLEBEI DOOR WEGLATEN.

   1. DE WERKRUIMTE. Elke soort draagt een `lees(db)` die alleen
      db.data.werkruimtes[CODE] opent. Er bestaat geen pad waarlangs een rij van
      een andere werkruimte naar buiten komt -- niet doordat de aanroeper netjes
      filtert, maar doordat de bron het niet kan leveren. Dat is precies waarom
      een filter over een gedeeld register hier niet volstaat: de
      afhankelijkhedenscan in object.js loopt ALLE soorten van het register
      langs op zoek naar rijen die deze sleutel noemen, en één vergeten filter
      levert dan de contracten van een andere organisatie op.

   2. HET RECHT. Het Werk OS poort zijn modules per recht (werkPoort(req, res,
      'project')). Een register dat alle soorten draagt zou dat omzeilen: wie
      alleen 'service' heeft, zou via de zoekbalk de contracten zien. Daarom
      LAAT dit register een soort WEG als het lid het recht niet heeft. Niet
      filteren -- weglaten, zodat geen enkele lezer hem nog kan vinden.
      Er is geen standaard: `rechten` is verplicht, en een lege lijst geeft een
      leeg register. Wie hem vergeet ziet niets, en dat is de goede kant om
      fout te gaan.

      Binnen een soort kan er nog een derde zeef staan (kennis: een artikel kan
      aan een recht hangen). Die hoort in `lees` en niet in de aanroeper, om
      dezelfde reden als hierboven.

   WAT ER BEWUST NIET IN STAAT: DE LEDEN. De personen van een werkruimte zijn
   het hart van een organisatiekaart, en ze staan hier toch niet in. Twee
   redenen, en de tweede is de zwaarste:

   - Een lidrij draagt `token` (de sleutel waarmee die medewerker inlogt) en
     `rtgKey` (de koppeling naar zijn persoonlijke RTG-account). De VERBORGEN-
     lijst van object.js kent `token` wel en `rtgKey` niet, dus het objectdossier
     zou die koppeling uitprinten. Dat is dezelfde afweging waarom
     kern/zaakcommand/register.js `supplierTeam` weglaat: dat draagt pincodes.
   - Het levert bijna niets op. Geen enkele module verwijst naar een lid met
     zijn id; `eigenaar`, `wie` en `door` zijn vrije tekst met een naam erin.
     Een lid-knoop zou dus vrijwel geen gemeten randen krijgen.

   Mensen in de graaf is een eigen stap met een eigen besluit (welk recht, en
   wat betekent het voor de koppeling met het RTG-account) en geen bijvangst van
   een register. Zolang die stap niet is gezet, staat dat hier als reden en niet
   als lege plek. */
'use strict';

const { maakRegister } = require('../command/register');
const { SOORTEN } = require('./soorten');
const { eigenVeld } = require('../util');

/* De code wordt aan BEIDE kanten genormaliseerd. server/bedrijf/index.js zoekt
   zijn werkruimte op met `String(...).trim().toUpperCase()`; een kale === hier
   zou een register opleveren dat stil nul rijen leest -- en bij een scoping-
   laag is "stil niets" de gevaarlijke kant op, want dat leest als een lege
   organisatie in plaats van als een verkeerd gespelde code. */
const norm = (v) => String(v == null ? '' : v).trim().toUpperCase();

function ruimte(db, code) {
  const alle = db && db.data ? db.data.werkruimtes : null;
  if (!alle || typeof alle !== 'object') return null;
  const w = eigenVeld(alle, code);
  return w && typeof w === 'object' ? w : null;
}

/* De lezer van één soort. Elke bak van het Werk OS is een object op id (geen
   array), dus hier worden er rijen van gemaakt -- één keer, op deze plek, in
   plaats van in elke motor die het register leest. */
function lezerVoor(code, so, rechten) {
  return (db) => {
    const w = ruimte(db, code);
    const bak = w ? eigenVeld(w, so.veld) : null;
    if (!bak || typeof bak !== 'object') return [];
    const rijen = Object.values(bak).filter(r => r && typeof r === 'object');
    return so.zeef ? rijen.filter(r => so.zeef(r, rechten)) : rijen;
  };
}

/* De soorten die dit lid mag zien, elk met zijn eigen lezer eraan. */
function soortenVoor(code, rechten) {
  const c = norm(code);
  const mag = Array.isArray(rechten) ? rechten.map(String) : [];
  return SOORTEN
    .filter(so => mag.includes(so.recht))
    .map(so => Object.assign({}, so, { lees: lezerVoor(c, so, mag) }));
}

/* Het register zelf. `rechten` is verplicht en heeft geen standaardwaarde: een
   register dat bij vergeten rechten alles teruggeeft, is precies de fout die
   deze laag moet voorkomen. */
function maakWerkRegister(code, rechten) {
  const c = norm(code);
  if (!c) throw new Error('een werkregister zonder werkruimtecode bestaat niet');
  if (!Array.isArray(rechten)) throw new Error('een werkregister zonder rechten bestaat niet');
  const register = maakRegister(soortenVoor(c, rechten));
  register.code = c;
  return register;
}

module.exports = { maakWerkRegister, soortenVoor, norm };
