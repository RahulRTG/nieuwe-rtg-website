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
const { meet, bakVan, BAKKEN, KLAAR } = require('../scripts/onbewezen');

const u = meet();

test('zonder geldige meting deelt de trechter niet stilzwijgend in', () => {
  assert.equal(typeof u.metingGebruikt, 'boolean', 'de uitslag hoort te zeggen of hij op een meting leunt');
  assert.ok(u.metingReden && u.metingReden.length > 10, 'en met welke reden');
  if (!u.metingGebruikt) {
    /* WAT DEZE TOETS EERST DEED, EN WAAROM DAT TE ZWAK WAS. Hij keek of de
       duurste bak niet ALLES bevatte -- en dat was hij ook niet, dus hij ving
       de fout niet. Ondertussen zette een gesloten poort 1205 routes in
       SEMANTIEK_NODIG: de duurste bak, en precies de routes waarvan de meting
       zegt dat ze BESCHERMD zijn. De uitslag zag er volkomen normaal uit.

       Zonder geldige meting valt er GEEN blokkadereden te noemen. Alles wat
       geen bewijs heeft hoort dan in STALE_BEWIJS -- de goedkoopste bak, want
       opnieuw meten IS de reparatie. Elke andere bak hoort leeg te zijn. */
    for (const b of u.bakken) {
      if (b.id === 'STALE_BEWIJS') continue;
      assert.equal(b.aantal, 0,
        'met een gesloten poort staat er ' + b.aantal + ' in ' + b.id + '; zonder meting ' +
        'valt er geen blokkadereden te noemen en hoort alles in STALE_BEWIJS');
    }
  }
});

test('een route zonder proefsleutel is geen verouderde meting', () => {
  /* Zonder geldige meting staat alles met opzet in STALE_BEWIJS (zie de toets
     hierboven); dan valt er over deze bak niets te zeggen. Geen stille
     overslag: de reden hoort in de uitslag te staan. */
  if (!u.metingGebruikt) { assert.ok(u.metingReden.length > 20); return; }
  const geen = u.bakken.find(b => b.id === 'GEEN_PROEFSLEUTEL');
  const stale = u.bakken.find(b => b.id === 'STALE_BEWIJS');
  assert.ok(geen, 'de bak GEEN_PROEFSLEUTEL hoort te bestaan');
  /* HIER STOND `geen.aantal > 0`, en dat was een GETAL en geen regel. Toen deze
     toets werd geschreven telde het mutatieboek er honderden, en de zorg was
     terecht: een bak die op nul springt terwijl de sleutels ontbreken, betekent
     dat die routes ergens anders zijn beland.

     Inmiddels is die bak echt leeg -- elke rol heeft een sleutel, en dat was
     het werk van zestien stappen. De toets zakte daarop, en dat is precies
     verkeerd om: een toets hoort te zakken als het SLECHTER wordt.

     Wat hij nu bewaakt is de zorg zelf en niet het getal: nul mag, maar dan
     moet STALE_BEWIJS ook nul zijn. Waren er sleutels weggevallen, dan zouden
     die routes zonder meting in STALE belanden en zou deze toets alsnog zakken. */
  if (geen.aantal === 0) {
    assert.equal(stale.aantal, 0,
      'GEEN_PROEFSLEUTEL staat op nul terwijl er ' + stale.aantal + ' routes in STALE_BEWIJS staan; ' +
      'dat is precies hoe een ontbrekende sleutel zich vermomt als een verouderde meting');
  }

  /* EN DE REGEL ZELF, want de twee tellingen hierboven staan allebei op nul en
     kunnen elkaar dus niet meer tegenspreken. Een toets die vandaag niet kan
     zakken is geen toets (LAT.md regel 9), dus wordt de indeler hier
     RECHTSTREEKS gevraagd wat hij van een sleutelloze route vindt. Die vraag
     blijft falsifieerbaar ook als de bak voorgoed leeg blijft. */
  const zonderSleutel = bakVan({ pad: '/api/verzonnen/proef', bestand: null }, null, null, true, false);
  assert.equal(zonderSleutel, 'GEEN_PROEFSLEUTEL',
    'een route zonder sleutel hoort GEEN_PROEFSLEUTEL te heten en niet "' + zonderSleutel + '"');
  const metSleutel = bakVan({ pad: '/api/verzonnen/proef', bestand: null }, null, null, false, false);
  assert.equal(metSleutel, 'STALE_BEWIJS',
    'een route MET sleutel maar zonder meting hoort wel STALE te heten');
  /* De oude staartcontrole (`stale < geen + stale`) stond hier om te zeggen
     dat niet ALLES stale mocht heten. Met allebei op nul rekende die zichzelf
     kapot (0 < 0), en hij zei niets meer dat de regel hierboven niet al zegt. */
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

/* ============================================================================
   EEN FAMILIE DECLAREREN IS IETS ANDERS DAN HEM HEBBEN.

   WAT ER MIS GING, en het was mijn eigen inbouw. De trechter las of een route
   onder het voorvoegsel van een lijfsleutel-familie viel -- de DECLARATIE -- en
   trok hem dan uit GEEN_PROEFSLEUTEL. In de meting daarna liep de gezinsfamilie
   stuk op twee veldnamen (`gezinsnaam` en `naam`, niet `naam` en `beheerder`).
   De bouwer meldde zich netjes als mislukt, de proef schreef "mislukt: gezin"
   in zijn uitvoer... en de trechter meldde 255 routes minder in
   GEEN_PROEFSLEUTEL. De uitslag zei "heeft een sleutel" over 187 routes waar
   geen sleutel voor bestond.

   Dat is exact de schijnzekerheid die deze trechter moet voorkomen, en ik had
   hem er zelf in gezet. Sindsdien telt hier alleen wat de METING heeft
   gebouwd (`gemeten.lijfsleutelsGebouwd` in IDEMPROEF.json). Ontbreekt dat veld
   -- een ouder register -- dan wordt er niets gecrediteerd: fail-closed, en
   liever een te hoog getal dan een te laag.

   DE MUTATIE: laat de trechter weer op de declaratie tellen -> deze toets
   zakt zodra een familie mislukt of het veld ontbreekt.
   ========================================================================== */
test('een lijfsleutel telt pas als de meting hem heeft GEBOUWD', () => {
  if (!u.metingGebruikt) { assert.ok(u.metingReden.length > 20); return; }
  const fs = require('fs');
  const path = require('path');
  const { FAMILIES } = require('../scripts/lib/lijfsleutels');
  let reg = null;
  try { reg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'IDEMPROEF.json'), 'utf8')); } catch (e) {}
  const gebouwd = new Set(((reg && reg.gemeten && reg.gemeten.lijfsleutelsGebouwd) || []));
  const geen = new Set(u.perRoute.GEEN_PROEFSLEUTEL || []);

  for (const f of FAMILIES) {
    if (gebouwd.has(f.naam)) continue;
    /* Een familie die NIET is gebouwd, mag geen enkele route uit de bak halen.
       Als er routes onder zijn voorvoegsel bestaan, horen die er nog in te staan. */
    const onderPrefix = (u.perRoute.GEEN_PROEFSLEUTEL || [])
      .concat(...Object.values(u.perRoute))
      .filter(s => f.prefixen.some(p => s.split(' ')[1].startsWith(p)));
    if (!onderPrefix.length) continue;
    const nogInDeBak = onderPrefix.some(s => geen.has(s));
    assert.ok(nogInDeBak,
      'familie "' + f.naam + '" is niet gebouwd, en toch staat geen van zijn routes nog in ' +
      'GEEN_PROEFSLEUTEL -- dan is de trechter op de declaratie gaan tellen in plaats van op de meting');
  }
});

/* ============================================================================
   "NIET AANRAKEN" IS GEEN ONTBREKENDE SLEUTEL.

   Dertig routes stonden in GEEN_PROEFSLEUTEL terwijl er niets ontbrak. Het zijn
   schakelkasten (/api/office/boardroom/alles zet in een keer alles om) en
   onomkeerbare handelingen (/api/boardroom/reset, de bewaarveger die wist wat
   over de termijn is). scripts/lib/routes.js houdt ze bij naam tegen, met een
   uitgeschreven reden per route.

   WAAROM DIT ERTOE DOET. Zolang ze onder "geen sleutel" vielen, was die bak
   niet leeg te krijgen: je kunt geen sleutel bouwen voor een deur waar je met
   opzet niet aan mag komen. Iemand zou blijven zoeken naar een sleutel die niet
   hoort te bestaan -- en het doel "GEEN_PROEFSLEUTEL = 0" was onhaalbaar om de
   verkeerde reden.

   Dit is de "aantoonbaar niet-beproefbaar" die als eindtoestand mag bestaan:
   niet een bak waar iets stil in verdwijnt, maar een lijst met per route een
   reden die iemand kan nalopen.
   ========================================================================== */
test('een niet-aanraakbare route staat niet onder "geen sleutel"', () => {
  if (!u.metingGebruikt) { assert.ok(u.metingReden.length > 20); return; }
  const { waaromNietAanraken } = require('../scripts/lib/routes');
  const geen = u.perRoute.GEEN_PROEFSLEUTEL || [];
  for (const s of geen) {
    const pad = s.split(' ')[1];
    assert.ok(!waaromNietAanraken(pad),
      pad + ' mag met opzet niet worden aangeroepen (' + waaromNietAanraken(pad) + ') ' +
      'en staat toch onder "geen sleutel" -- daar is geen sleutel voor te bouwen');
  }
});

test('elke niet-aanraakbare route draagt een uitgeschreven reden', () => {
  if (!u.metingGebruikt) { assert.ok(u.metingReden.length > 20); return; }
  const { waaromNietAanraken } = require('../scripts/lib/routes');
  const bak = u.perRoute.NIET_AANRAAKBAAR || [];
  for (const s of bak) {
    const reden = waaromNietAanraken(s.split(' ')[1]);
    assert.ok(reden && reden.length > 10,
      s + ' staat in NIET_AANRAAKBAAR zonder reden; dan is het een restbak en geen uitgang');
  }
});
