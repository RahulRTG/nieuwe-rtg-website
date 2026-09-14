/* HET BESLUITREGISTER NAAST DE METING -- en waarom het die meting niet mag
   wegdrukken.

   `/api/office/magnaat/scan` is de laatste gezakte route van de faalproef, en
   hij is NAGEMETEN in plaats van weggewerkt (MENSNETWERK.md par. 0.6b). Het
   contract van die proef is mechanisch -- 200 terwijl de toestand niet veranderde
   -- en dat is precies wat er gebeurde. Wat het contract niet kan zien is of het
   verloren gevolg HERREKENBAAR is: bij een cache-tijdstempel is dat het hele
   verschil met een verdwenen bankakkoord.

   De eigenaar heeft optie A gekozen: een besluitregister NAAST de meting, in de
   vorm die MUTATIECONTRACT.md al had gekozen (IDEMBESLUIT.json naast
   IDEMPROEF.json).

   DE INVARIANT DIE DEZE TOETS BEWAAKT, en het is er maar een die telt:

     Het besluit drukt de meting NOOIT weg.

   `gezakt` blijft `gezakt`. Wie het register de meting laat corrigeren, heeft de
   meting afgeschaft in plaats van haar te verklaren -- en dan is het register een
   manier om een getal groen te praten. Daarom telt faalproef.js `gezaktMetBesluit`
   apart en trekt hij het nergens af.

   EN EEN BESLUIT OVER NIETS IS GEEN BESLUIT. Toets 3 eist dat elke route in het
   register ook werkelijk als gezakt in de meting staat. Zonder die eis kan het
   register vollopen met verklaringen voor routes die nergens meer falen, en dan
   ziet het eruit als dekking terwijl het geheugen is.

   GEMETEN MET DE MUTATIE (13 september 2026):
     a. een klasse gebruiken die niet verklaard is        -> toets 1 zakt
     b. een grond terugbrengen tot een paar woorden       -> toets 2 zakt
     c. een route in het register die niet gezakt is      -> toets 3 zakt
     d. gezaktMetBesluit van gezakt aftrekken in faalproef.js -> toets 4 zakt

   Draai los: node --test test/herrekenbaar.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { zonderCommentaar } = require('../scripts/lib/bron');

const WORTEL = path.join(__dirname, '..');
const REG = JSON.parse(fs.readFileSync(path.join(WORTEL, 'HERREKENBAAR.json'), 'utf8'));
const METING = JSON.parse(fs.readFileSync(path.join(WORTEL, 'FAALPROEF.json'), 'utf8'));

const gezakteRoutes = () => (METING.perRoute || [])
  .filter(r => r && r.failure === 'gezakt').map(r => r.route);

test('1. elke gebruikte klasse is verklaard', () => {
  const klassen = Object.keys(REG.klassen || {});
  assert.ok(klassen.length >= 2, 'er zijn klassen verklaard');
  for (const [route, b] of Object.entries(REG.routes || {})) {
    assert.ok(b.klasse, route + ' draagt geen klasse');
    assert.ok(klassen.includes(b.klasse),
      route + ' gebruikt de klasse "' + b.klasse + '" die nergens is verklaard. ' +
      'Een klasse zonder uitleg is een etiket, en dan staat er een besluit dat niemand kan nalezen.');
  }
});

test('2. elke grond is UITGESCHREVEN en geen etiket', () => {
  for (const [route, b] of Object.entries(REG.routes || {})) {
    assert.ok(String(b.grond || '').length > 150,
      route + ' draagt een grond van minder dan 150 tekens. Dit register bestaat om uit te leggen ' +
      'waarom een gemeten gebrek geen gebrek is -- dat kan niet in een half zinnetje, en een korte ' +
      'grond is precies hoe een uitzondering een gewoonte wordt.');
    assert.ok(b.besloten, route + ' zegt niet WANNEER het is besloten');
  }
});

test('3. elk besluit gaat over een route die werkelijk gezakt is', () => {
  const gezakt = gezakteRoutes();
  assert.ok(gezakt.length >= 1,
    'de meting kent geen enkele gezakte route meer. Dan is dit register geheugen geworden: ' +
    'haal de verklaringen weg die nergens meer over gaan, of dit bestand zelf.');
  for (const route of Object.keys(REG.routes || {})) {
    assert.ok(gezakt.includes(route),
      'het register verklaart "' + route + '", maar die route staat niet als gezakt in FAALPROEF.json. ' +
      'Een besluit over niets is geen besluit -- het ziet eruit als dekking en het is geheugen.');
  }
});

test('4. het besluit drukt de meting niet weg', () => {
  /* De bron en niet de uitvoer: dit gaat over wat faalproef.js DOET, en een
     register dat toevallig klopt bewijst niet dat de volgende ronde het ook doet.
     Commentaar eraf, want de kop van dat bestand legt deze regel uit en zou de
     toets op zijn eigen toelichting laten slagen (BEWIJSMACHINE.md par. 6a.1). */
  const bron = zonderCommentaar(fs.readFileSync(path.join(WORTEL, 'scripts/faalproef.js'), 'utf8'));

  assert.ok(/gezaktMetBesluit/.test(bron), 'faalproef.js telt de verklaarde routes niet apart');

  /* DE EERSTE VORM VAN DEZE ASSERTIE PAKTE DE MUTATIE NIET, en dat is de
     leerzaamste regel van dit bestand. Hij filterde de regels met `gezakt:` en
     draaide daar een patroon overheen dat op het REGELEINDE ankerde -- en de
     echte regel zet drie tellers achter elkaar op een regel, dus het anker lag
     ergens in het midden. Uitslag: groen, terwijl `gezakt: tel('gezakt') -
     gezaktMetBesluit` er gewoon stond. Een geldige uitslag op het verkeerde
     experiment (BEWIJSMACHINE.md par. 6a), op de assertie die juist de dragende
     invariant moet bewaken.

     De vorm die het wel doet is simpel: pak de UITDRUKKING achter `gezakt:` tot
     aan de komma, en eis dat er niets van wordt afgetrokken. `\bgezakt:` raakt
     `gezaktMetBesluit:` niet, want daar volgt geen dubbele punt op `gezakt`. */
  const m = /\bgezakt:\s*([^,\n]+)/.exec(bron);
  assert.ok(m, 'er is geen `gezakt:`-teller meer in faalproef.js; dan meet deze toets niets');
  assert.ok(!/-/.test(m[1]),
    'de gezakt-teller trekt iets af (`gezakt: ' + m[1].trim() + '`). Dan verklaart het register ' +
    'de meting niet maar corrigeert hij hem, en is `gezakt` geen meting meer. ' +
    'Het besluit hoort ERNAAST te staan, nooit ervan af.');

  /* En de uitkomst: in het register zelf staat gezakt hoger dan nul terwijl er
     een verklaring bestaat. Dat is de vorm waar het om gaat. */
  /* EN DE UITKOMST, MET EEN LUIDE TAK IN PLAATS VAN EEN STILLE. Dit stond eerst
     achter een `if (... != null)`, en dat is een assertie die zichzelf overslaat
     zodra het veld ontbreekt -- precies zo verdwijnt een bewijs zonder dat iemand
     het merkt. Ontbreekt het veld, dan zegt de toets dat het register moet worden
     hergedraaid; hij doet niet alsof er niets aan de hand is. */
  const g = METING.gemeten || {};
  assert.ok(g.gezaktMetBesluit != null,
    'FAALPROEF.json draagt `gezaktMetBesluit` niet: het register is geschreven vóór de koppeling ' +
    'met HERREKENBAAR.json. Draai `npm run faalproef` opnieuw. Een register dat niet is hergedraaid, ' +
    'is een bewering over het verleden.');
  assert.ok(g.gezakt >= g.gezaktMetBesluit,
    'gezakt is kleiner dan het aantal verklaarde gezakte routes; dan is er afgetrokken');
  assert.equal(g.gezakt, g.gezaktMetBesluit + g.gezaktZonderBesluit,
    'de twee tellers horen samen precies `gezakt` te zijn -- niet meer en niet minder');
});
