/* ============================================================================
   DE TRECHTER ONDER ONBEWEZEN.

   Waarom hij bestaat staat in de kop van scripts/onbewezen.js: "3430 zonder
   bewijs" is een werkvoorraad waar niemand aan begint, en wie er wel aan
   begint leest broncode voor routes die op een ontbrekende fixture vastlopen.
   De bakken staan daarom van goedkoop naar duur.

   DRIE DINGEN DIE DEZE TOETS VASTHOUDT, en alle drie omdat ze bij het bouwen
   fout gingen:

   1. FAIL-CLOSED. Zonder geldige meting valt er geen blokkadereden te noemen.
      De eerste versie deelde toch in, en meldde op een vuile boom 1020 routes
      als SEMANTIEK_NODIG -- de DUURSTE bak, en precies de routes waarvan de
      meting zegt dat ze BESCHERMD zijn. Wie daarop was gaan lezen, had duizend
      keer de bron opengeslagen voor een gesloten poort.
   2. AFWEZIG IS NIET STALE. Een route waarvoor dit instrument geen sleutel
      heeft, staat niet in IDEMPROEF.json. Die afwezigheid las de eerste versie
      als "de meting is verouderd" -- de goedkoopste bak -- en zette er 873
      routes in die met opnieuw meten geen millimeter opschieten. Twee oorzaken
      met hetzelfde symptoom en tegengestelde reparaties.
   3. DE INVARIANT. ONBEWEZEN mag alleen kleiner worden doordat een route
      geldig bewijs krijgt, nooit doordat een foutreden wordt hernoemd. Daarom
      ratelt het TOTAAL en niet de bakken: een route van FIXTURE_404 naar
      SEMANTIEK_NODIG schuiven is vooruitgang in inzicht en nul in bewijs.

   DE MUTATIE: laat bakVan() de sleutelcontrole overslaan -> de tweede toets
   zakt. Laat meet() ook bij een gesloten poort indelen -> de eerste zakt.
   ========================================================================== */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { meet, BAKKEN, KLAAR } = require('../scripts/onbewezen');

const u = meet();

test('zonder geldige meting deelt de trechter niet stilzwijgend in', () => {
  assert.equal(typeof u.metingGebruikt, 'boolean', 'de uitslag hoort te zeggen of hij op een meting leunt');
  assert.ok(u.metingReden && u.metingReden.length > 10, 'en met welke reden');
  if (!u.metingGebruikt) {
    /* Bij een gesloten poort mag de duurste bak niet vollopen: dat is precies
       de fout die deze toets vasthoudt. */
    const duur = u.bakken.find(b => b.id === 'SEMANTIEK_NODIG');
    const totaal = u.gemeten.onbewezen;
    assert.ok(duur.aantal < totaal,
      'met een gesloten poort hoort niet alles in SEMANTIEK_NODIG te belanden');
  }
});

test('een route zonder proefsleutel is geen verouderde meting', () => {
  const geen = u.bakken.find(b => b.id === 'GEEN_PROEFSLEUTEL');
  const stale = u.bakken.find(b => b.id === 'STALE_BEWIJS');
  assert.ok(geen, 'de bak GEEN_PROEFSLEUTEL hoort te bestaan');
  assert.ok(geen.aantal > 0,
    'er zijn routes zonder sleutel (het mutatieboek telt er honderden); ' +
    'staan die op 0, dan vallen ze ergens anders in en waarschijnlijk in STALE_BEWIJS');
  assert.ok(stale.aantal < geen.aantal + stale.aantal,
    'niet alles hoort stale te heten');
});

test('elke onbewezen route valt in precies een bak, en de optelling sluit', () => {
  assert.equal(u.gemeten.sluit, true,
    u.gemeten.metBewijs + ' + ' + u.gemeten.onbewezen + ' hoort ' + u.gemeten.mutaties + ' te zijn');
  const som = u.bakken.reduce((n, b) => n + b.aantal, 0);
  assert.equal(som, u.gemeten.onbewezen, 'de bakken horen op te tellen tot ONBEWEZEN');
});

test('de bakken staan van goedkoop naar duur, en die volgorde IS de methode', () => {
  const ids = BAKKEN.map(b => b[0]);
  assert.equal(ids[0], 'STALE_BEWIJS', 'opnieuw meten is altijd goedkoper dan bron lezen');
  assert.ok(ids.indexOf('SEMANTIEK_NODIG') > ids.indexOf('FIXTURE_404'),
    'bron lezen hoort NA de fixture-bakken te komen; anders leest een mens voor een meetprobleem');
  assert.equal(ids[ids.length - 1], 'ECHT_DEFECT', 'een echt defect is de laatste conclusie, niet de eerste');
});

test('NIET_BEPROEFBAAR telt niet als bewijs', () => {
  /* "De proef kan er niet bij" is een tekort van de opstelling. Wie dat als
     eindstand accepteert, noemt een blinde vlek groen. */
  assert.ok(!KLAAR.has('NIET_BEPROEFBAAR'));
  assert.ok(!KLAAR.has('WACHT_OP_FIXTURE'));
  assert.ok(!KLAAR.has('NOG_NIET_GECLASSIFICEERD'));
});
