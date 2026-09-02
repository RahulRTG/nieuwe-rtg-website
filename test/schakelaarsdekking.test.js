/* ELKE SCHAKELAAR SCHAKELT IETS, EN ELKE ROUTE WEET OF HIJ AAN STAAT.

   Draai los: node --experimental-sqlite --test test/schakelaarsdekking.test.js

   DE VRAAG DIE HIERONDER LIGT: welke routes bestaan wel maar zijn niet actief?
   Die was tot nu toe niet te beantwoorden, en het antwoord bleek een defect te
   bevatten.

   VIER SCHAKELAARS SCHAKELDEN NIETS. functieVoorPad() kiest de langste prefix en
   breekt een gelijkspel met de volgorde (`len > besteLen` is strikt). Vier paren
   claimden exact hetzelfde pad -- tg-werving naast werving, en ov-arrival,
   ov-instant-reality en ov-rtgone naast arrival, instantreality en rtgone. De
   eerste won, de tweede stond wel op het bord. Samen 23 routes achter een knop
   die loog, veertien daarvan van RTG One: wie 'Invisible Arrival' uitzette zag
   hem uitgaan terwijl alle vier zijn routes bleven draaien.

   Een schakelaar die niet schakelt is erger dan een ontbrekende schakelaar,
   want hij wekt vertrouwen. De vier zijn weg; ./server/functies/register/index.js
   gooit voortaan bij het OPSTARTEN als twee functies hetzelfde pad claimen.

   DE MUTATIES (LAT.md regel 2), beide gedaan en beide zag ik de juiste toets
   zakken:
     - een dubbele claim op /api/rtgone terugzetten -> toets 1 zakt (de server
       komt dan niet eens op, en dat is de bedoeling)
     - een functie een pad geven dat geen enkele route heeft -> toets 2 zakt */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const functies = require('../server/functies');
const { prefixLengte } = require('../server/functies/toegang');
const { alleRoutes } = require('../scripts/lib/routes');

const F = functies.FUNCTIES;

test('1. geen twee functies claimen hetzelfde pad', () => {
  /* De catalogus gooit hier zelf al bij het laden op; deze toets zegt WELKE, en
     zorgt dat de reden in de suite staat en niet alleen in een opstartfout. */
  const perPad = new Map();
  for (const f of F) for (const p of (f.paden || [])) {
    const bij = perPad.get(p) || []; bij.push(f.id); perPad.set(p, bij);
  }
  const dubbel = [...perPad].filter(([, ids]) => ids.length > 1);
  assert.deepEqual(dubbel, [],
    'deze paden worden door meer dan een functie geclaimd; de eerste wint en de rest ' +
    'staat op het bord zonder iets te schakelen: ' +
    dubbel.map(([p, ids]) => p + ' <- ' + ids.join(' + ')).join('; '));
});

test('2. elke schakelaar heeft minstens een route om te schakelen', () => {
  const routes = alleRoutes();
  const zonder = F.filter(f => !(f.paden || []).some(p => routes.some(r => prefixLengte(r.pad, p) > 0)));
  assert.deepEqual(zonder.map(f => f.id), [],
    'deze functies staan op het schakelbord maar er hangt geen enkele route onder. ' +
    'Een knop die niets doet is geen knop: ' +
    zonder.map(f => f.id + ' (' + JSON.stringify(f.paden) + ')').join(', '));
});

test('3. wat NIET actief is, is te benoemen en klein', () => {
  /* De eigenlijke vraag. Met een lege schakelkast geldt overal `standaard`, en
     dan hoort er hooguit een handvol functies uit te staan -- elk met een reden
     die iemand ooit bewust heeft opgeschreven. Groeit dit stil, dan draait dit
     huis met routes die niemand meer bereikt. */
  const uit = F.filter(f => functies.functieStatus(f.id, {}) !== 'aan');
  assert.ok(uit.length <= 5,
    uit.length + ' functies staan standaard uit; dat is meer dan een handvol en ' +
    'hoort een bewuste keuze te zijn: ' + uit.map(f => f.id).join(', '));
  for (const f of uit) {
    assert.ok(f.uitleg && f.uitleg.length > 20,
      f.id + ' staat standaard uit maar legt niet uit waarom dat zo is');
  }
});

test('4. elke route hoort bij een functie of bij de bediening', () => {
  /* De tegenhanger van toets 2: niet "een schakelaar zonder route" maar "een
     route zonder schakelaar". Die mogen bestaan -- de bediening van het platform
     zelf hoort niet uitschakelbaar te zijn -- maar ze horen BENOEMD te zijn, en
     dat bewaakt test/platformregister.test.js. Hier alleen dat het er niet
     stilletjes meer worden. */
  const routes = alleRoutes();
  const paren = [];
  for (const f of F) for (const p of (f.paden || [])) paren.push(p);
  const zonder = routes.filter(r => !paren.some(p => prefixLengte(r.pad, p) > 0));
  /* DE GRENS STOND OP 100 EN STAAT NU OP 120, EN DAT IS EEN BESLUIT.

     De samenvoeging van twaalf takken bracht de zelfbedieningslaag van het lid
     binnen: /api/mijn/tweefactor, /sessies, /herstelkanaal, /post, /toestel en
     twee relatie-routes onder /api/toestemming. Twintig routes, en geen ervan
     hoort aan een functieschakelaar te hangen -- een knop waarmee het huis de
     tweefactor of het herstelkanaal van een lid uitzet, hoort niet te bestaan.
     Ze staan daarom alle twintig als BEDIENING in kern/platformregister/bediening.js,
     elk met de reden waarom hij niet schakelbaar is.

     Wat deze toets bewaakt is dat het er niet STILLETJES meer worden, en dat
     blijft precies zo werken: de grens gaat met de hand omhoog, niet vanzelf.
     Wat de vraag beantwoordt of die twintig terecht buiten een functie vallen
     is test/platformregister.test.js -- die eist dat elke route hier BENOEMD is,
     en die stond groen voordat dit getal werd verzet. Zonder die volgorde is
     een hoger getal hier alleen een zachtere meter. */
  assert.ok(zonder.length <= 120,
    zonder.length + ' routes hangen aan geen enkele functie. Dat is de bediening van ' +
    'het platform (boardroom, techniek, gezondheid) en die hoort niet schakelbaar te zijn, ' +
    'maar bij deze aantallen is er iets anders aan de hand.');
});
