/* ============================================================================
   HET ABONNEMENT VAN EEN ZAAK -- het gegeven dat ontbrak.

   kern/commercie/capaciteiten.js beschrijft per trede wat een klant mag. Zes van
   de acht capabilities werden NERGENS afgedwongen, en de reden bleek niet
   luiheid maar een ontbrekend gegeven: een zaak draagt helemaal geen
   abonnement. De partnerpoort kijkt naar de pas van de AANVRAGER op het moment
   van aanvragen, en daarna weet niemand meer waar die zaak op zit.

   Zo is een productprofiel een folder: het staat er, en niets houdt zich eraan.
   Precies de fout die dit hele traject heeft opgeruimd -- een belofte zonder
   beller.

   DE BEWERINGEN DIE ERTOE DOEN:

     toets 2  een zaak van voor de ladder verliest niets
     toets 3  en die terugval is TELBAAR -- anders is het een gat dat er over een
              jaar nog is en dat niemand meer ziet
     toets 5  een zaak kan niet op een consumententrede worden gezet

   Draai los: node --experimental-sqlite --test test/zaakabonnement.test.js
   ========================================================================== */
const test = require('node:test');
const assert = require('node:assert/strict');
const { maakZaakabonnement, TERUGVAL } = require('../server/kern/commercie/zaakabonnement');
const caps = require('../server/kern/commercie/capaciteiten');

function verse() {
  const db = { data: {} };
  return maakZaakabonnement({ db, save: () => {}, nu: () => 1000 });
}

test('1. een vastgelegd abonnement wordt teruggegeven, met herkomst', () => {
  const z = verse();
  const r = z.zet('kikunoi', 'business-lite', 'partner-goedkeuring');
  assert.equal(r.status, 200);
  const a = z.van('KIKUNOI');
  assert.equal(a.pas, 'business-lite');
  assert.equal(a.herkomst, 'vastgelegd');
  assert.equal(z.van('kikunoi').pas, 'business-lite', 'de code is hoofdletterongevoelig');
});

/* DE BEWERING. Er zijn honderden zaken van voor de ladder. Ze weigeren zou elke
   bestaande partner morgen buitensluiten; een migratie die rechten intrekt is
   een storing met een nette naam. */
test('2. een zaak zonder vastgelegd abonnement verliest niets', () => {
  const z = verse();
  const a = z.van('OUDEZAAK');
  assert.equal(a.pas, TERUGVAL);
  assert.equal(a.herkomst, 'voor-de-ladder', 'en dat staat erbij, het is geen stille aanname');

  /* De terugval is de RUIMSTE zakelijke trede, dus hij kan nooit iets afpakken
     van wie het al had. Dat is de eigenschap die telt, niet het woord
     "business". */
  for (const cap of caps.capsVan('business-lite'))
    assert.equal(z.mag('OUDEZAAK', cap), true,
      'een zaak van voor de ladder hoort ' + cap + ' te houden');
});

/* DE TWEEDE BEWERING. Een terugval die je niet kunt tellen, is een gat dat er
   over een jaar nog steeds is en dat niemand meer ziet. */
test('3. wie op de terugval draait, is telbaar', () => {
  const z = verse();
  z.zet('NIEUW', 'business-lite', 'test');
  const open = z.zonderAbonnement(['NIEUW', 'OUD1', 'OUD2', 'oud3']);
  assert.equal(open.aantal, 3, 'drie zaken zonder vastgelegd abonnement');
  assert.deepEqual(open.codes.sort(), ['OUD1', 'OUD2', 'OUD3']);
  assert.equal(open.terugval, TERUGVAL, 'met erbij waarop ze draaien');
  assert.equal(z.zonderAbonnement([]).aantal, 0);
});

test('4. de capabilities van een zaak volgen haar abonnement', () => {
  const z = verse();
  z.zet('LITE', 'business-lite', 'test');
  z.zet('GROOT', 'business', 'test');

  assert.equal(z.mag('LITE', 'can_use_pos'), true, 'Business Lite draait een kassa');
  assert.equal(z.mag('LITE', 'can_use_enterprise_governance'), false,
    'maar geen enterprise governance -- dat is waar Business voor is');
  assert.equal(z.mag('GROOT', 'can_use_enterprise_governance'), true);

  assert.equal(z.mag('LITE', 'can_hack'), false, 'een onbekende capability geeft niets');
});

/* DE DERDE BEWERING. Een zaak op de consumentenpas zou een abonnement zijn dat
   de partnerpoort zelf niet zou hebben doorgelaten. */
test('5. een zaak kan niet op een consumententrede worden gezet', () => {
  const z = verse();
  for (const pas of ['rtg', 'gratis', 'lifestyle']) {
    const r = z.zet('X', pas, 'test');
    assert.equal(r.status, 400, pas + ' is geen zakelijk abonnement');
    assert.match(r.error, /zakelijk abonnement/);
  }
  assert.equal(z.zet('X', 'bestaat-niet', 'test').status, 400);
  assert.equal(z.zet('', 'business', 'test').status, 400, 'en zonder zaak gaat het ook niet');
  assert.equal(z.van('X').herkomst, 'voor-de-ladder', 'geen van die pogingen heeft iets vastgelegd');
});

test('6. de lijst laat zien wat er is vastgelegd, en wanneer', () => {
  const z = verse();
  z.zet('A', 'business-lite', 'partner-goedkeuring');
  z.zet('B', 'business', 'boardroom');
  const l = z.lijst();
  assert.equal(l.length, 2);
  assert.ok(l.every(x => x.sinds), 'met een datum, want een abonnement heeft een begin');
  assert.ok(l.every(x => x.herkomst === 'vastgelegd'));
});

/* Het profiel hoort het product te BESCHRIJVEN, niet te herontwerpen. Deze toets
   staat er omdat ik dat een keer fout heb gedaan: in capaciteiten.js stond dat
   Business De Rechterhand NIET had, terwijl routes/member/lifestyle.js Business
   al sinds het begin laat meeerven. Ze afdwingen zou elke Business Pass-houder
   die suite hebben afgenomen. */
test('7. de Business Pass erft de Rechterhand, zoals de route dat altijd al deed', () => {
  assert.equal(caps.mag('business', 'can_use_lifestyle_service'), true);
  assert.equal(caps.mag('lifestyle', 'can_use_lifestyle_service'), true);
  assert.equal(caps.mag('business-lite', 'can_use_lifestyle_service'), false);
  assert.equal(caps.mag('rtg', 'can_use_lifestyle_service'), false);

  const bron = require('fs').readFileSync(
    require.resolve('../server/routes/member/lifestyle.js'), 'utf8');
  assert.match(bron, /can_use_lifestyle_service/,
    'de route hoort de capability te vragen en geen lijstje pas-ids: bij een zesde ' +
    'trede moet iemand aan dat lijstje denken, en die iemand bestaat niet');
  assert.doesNotMatch(bron, /\['lifestyle', 'business'\]\.includes/,
    'het oude lijstje pas-ids hoort weg te zijn');
});
