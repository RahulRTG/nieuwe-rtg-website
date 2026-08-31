/* ============================================================================
   DE VOORVOEGSELREGELS VAN DE IDEMWERELD -- volgorde en reikwijdte.

   Twee fouten die hier echt zijn gemaakt, allebei stil:

   1. DE VERKEERDE NAAM. De schoolkant heette in de eerste opzet /api/school/.
      Dat pad bestaat niet: server/opzet/poortwachters.js mount die router op
      /api/foundation, dus alle 225 schoolroutes heten /api/foundation/school/*.
      De regel matchte nul routes, klaagde nergens over, en de ronde erna zag er
      precies zo uit als daarvoor.

   2. DE VERKEERDE VOLGORDE. De eerste treffer wint. Staat /api/foundation/ voor
      /api/foundation/school/, dan krijgen die 225 routes het gezinslijf zonder
      schoolcode -- half beproefd, zonder dat een getal daalt.

   Beide zijn machinaal te vangen, en dat gebeurt hieronder.
   ========================================================================== */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const { voorvoegselLijf } = require('../scripts/lib/idemwereld');
const { alleRoutes } = require('../scripts/lib/routes');

const wereld = {
  gezinCode: 'GEZ123', gezinToken: 'gt',
  schoolCode: 'SCH123', schoolBeheerToken: 'sbt',
  werkruimte: 'WR1', beheerToken: 'bt', lidToken: 'lt'
};

test('een specifieker voorvoegsel staat VOOR het bredere', () => {
  const regels = voorvoegselLijf(wereld);
  for (let i = 0; i < regels.length; i++) {
    for (let j = i + 1; j < regels.length; j++) {
      const eerder = regels[i].voorvoegsel, later = regels[j].voorvoegsel;
      assert.ok(!later.startsWith(eerder) || eerder === later,
        '"' + later + '" staat NA "' + eerder + '" terwijl die er een voorvoegsel van is; ' +
        'de eerste treffer wint, dus de specifiekere regel wordt nooit bereikt');
    }
  }
});

test('elk voorvoegsel raakt werkelijk routes -- een dode regel klaagt nergens over', () => {
  const paden = alleRoutes().map(r => r.pad);
  for (const { voorvoegsel } of voorvoegselLijf(wereld)) {
    const raak = paden.filter(p => p.startsWith(voorvoegsel)).length;
    assert.ok(raak > 0, 'geen enkele route begint met "' + voorvoegsel + '" -- die regel doet niets, ' +
      'en een regel die niets doet ziet er in het register precies zo uit als een die werkt');
  }
});

test('de schoolregel draagt de schoolsleutels EN de gezinssleutels', () => {
  const school = voorvoegselLijf(wereld).find(v => v.voorvoegsel.includes('school'));
  assert.ok(school, 'er hoort een schoolregel te zijn');
  for (const veld of ['code', 'token', 'schoolCode', 'beheerToken']) {
    assert.ok(veld in school.lijf, 'de schoolregel mist ' + veld +
      '; de directiedeur en de ouderdeur vragen elk een andere sleutel');
  }
});

test('zonder gezin komen er geen gezins- of schoolregels', () => {
  /* Faalt het aanmaken van het gezin, dan hoort de regel te ONTBREKEN en niet
     met lege waarden te bestaan: een lijf met `code: undefined` levert een 404
     op die eruitziet als een bevinding over de route. */
  const regels = voorvoegselLijf({});
  assert.ok(!regels.some(r => r.voorvoegsel.startsWith('/api/foundation')),
    'zonder gezin hoort er geen foundation-regel te zijn');
});
