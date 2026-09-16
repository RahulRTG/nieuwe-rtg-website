/* DE MANDAATPROEF (scripts/mandaatproef.js).

   Bewaakt de VORM van de proef en niet zijn uitslag: die hoort te veranderen
   zodra een mandaat verleend kan worden. Twee dingen die hier vastliggen omdat
   ze tijdens het bouwen misgingen:

     1 De proef stuurde eerst een VERZONNEN body naar het `klein`-pad. De route
       gaf 404, de schakel stond op `ok: false`, en dat ziet er precies zo uit
       als een poort die dichtzit. Een proef die zijn eigen typefout meet in
       plaats van de grens, is erger dan geen proef.
     2 De spiegel is het bewijs, niet de weigering. Dat de route 403 zegt is
       goedkoop; dat de OPSLAG onaangeraakt bleef terwijl dezelfde handeling in
       de meelopende stand wel schreef, is de uitslag. Beide standen moeten dus
       in het register staan, en het verschil ertussen moet echt zijn. */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const WORTEL = path.join(__dirname, '..');
const M = require('../scripts/mandaatproef.js');
const REGISTER = path.join(WORTEL, 'MANDAATPROEF.json');

test('de proef gebruikt een BESTAAND leerdoel, en meet dus niet zijn eigen typefout', () => {
  const { DOELEN } = require('../server/kern/leerstof.js');
  assert.ok(DOELEN[M.DOEL_ID],
    'het leerdoel "' + M.DOEL_ID + '" bestaat niet meer; dan geeft de route 404 en leest dat als een ' +
    'gesloten poort. Kies een doel dat in de leerlijn staat.');
});

test('de twee paden dragen elk hun eigen beleidsniveau, en dat is het hele ontwerp', () => {
  const { beleidVoor } = require('../server/kern/stuur/beleid.js');
  assert.strictEqual(beleidVoor(M.KLEIN_PAD, 'member').niveau, 'klein',
    'de mandaattak heeft een `klein`-pad nodig: alleen daar handelt de machine zelfstandig');
  assert.strictEqual(beleidVoor(M.VOORSTEL_PAD, 'member').niveau, 'voorstel',
    'de menstak heeft een `voorstel`-pad nodig. Wordt dit `klein`, dan kan de agenda-handeling ' +
    'ineens zelfstandig en bewijst de proef iets anders dan zij beweert');
});

test('MANDAATPROEF.json bestaat, sluit, en draagt de spiegel', () => {
  assert.ok(fs.existsSync(REGISTER),
    'MANDAATPROEF.json ontbreekt -- draai `npm run mandaatproef:vast`');
  const j = JSON.parse(fs.readFileSync(REGISTER, 'utf8'));

  assert.strictEqual(j.telling.open, 0,
    'er staat een schakel open ZONDER reden; repareer hem of schrijf de reden op (openBekend)');
  assert.strictEqual(j.sluit, true);

  const s = (id) => j.schakels.find(x => x.id === id);
  /* DE SPIEGEL. Zonder deze twee naast elkaar bewijst de proef niets: een poort
     die alles weigert haalt schakel 4 en 5 ook. */
  const mee = s('meelopend-laat-door');
  const geen = s('afdwingend-geen-effect');
  assert.ok(mee && mee.stand === 'gesloten', 'de meelopende stand laat de handeling niet door');
  assert.ok(Array.isArray(mee.gemeten.effect) && mee.gemeten.effect.length > 0,
    'in de meelopende stand veranderde er NIETS in de opslag. Dan is de spiegel leeg: ' +
    'de afdwingende stand bewijst dan niet dat de poort iets tegenhield, maar dat er niets te ' +
    'houden viel. Gemeten: ' + JSON.stringify(mee.gemeten));
  assert.ok(geen && geen.stand === 'gesloten' && geen.gemeten.veranderd.length === 0,
    'de geweigerde handeling liet wel een spoor na');

  assert.ok(j.grens && j.grens.length > 200, 'het register draagt geen uitgeschreven grens');
});

test('een schakel die openBekend is, draagt een uitgeschreven reden', () => {
  const j = JSON.parse(fs.readFileSync(REGISTER, 'utf8'));
  for (const s of j.schakels.filter(x => x.stand === 'openBekend'))
    assert.ok(s.waarom && s.waarom.length > 80,
      'schakel "' + s.id + '" staat open zonder uitgeschreven reden; dan is openBekend een manier ' +
      'om een bevinding weg te poetsen in plaats van hem te dragen');
});

test('de proef eindigt met een foutcode op een open schakel', () => {
  const bron = fs.readFileSync(path.join(WORTEL, 'scripts/mandaatproef.js'), 'utf8');
  assert.match(bron, /process\.exit\(u\.sluit \? 0 : 1\)/,
    'zonder foutcode is dit een meting en geen proef');
});
