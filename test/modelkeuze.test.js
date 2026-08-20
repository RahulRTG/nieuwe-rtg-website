/* ============================================================================
   WELK MODEL WAAR, EN WAAR HET NIET LICHTER MAG.

   Alle aanroepplekken stonden op Opus. Een deel is verlaagd naar Sonnet 5 of
   Haiku 4.5 -- dat scheelt 40 tot 80 procent per aanroep. Maar juist de
   plekken met de MEESTE besparing (korte uitvoer, veel aanroepen) zijn de
   plekken waar het niet mag, en dat is precies de valkuil: wie ooit een
   kostenronde doet en van boven naar beneden door de lijst gaat, komt daar als
   eerste uit.

   Daarom staat die grens hier en niet alleen in een rapport. Zakt deze toets,
   dan is dat geen technische fout maar een BESLUIT dat iemand terugdraait, en
   dan hoort hij te lezen waarom het er stond.

   DE REGEL. Een model mag lichter worden waar de uitvoer machinaal wordt
   nagekeken (JSON die tegen een schema wordt geschoond, met een terugval
   erachter) of waar een fout hooguit een matige zin oplevert. Waar een regel
   alleen bestaat doordat het model hem opvolgt -- en zeker waar een kind
   meeleest -- blijft hij staan.

   DEZE TOETS STAAT IN MUTATIES.json ALS "OVERLEEFD", EN DAT IS EERLIJK.
   De mutatiemotor verandert OPERATOREN in de bron (true->false, ===->!==,
   return-weg). Deze toets bewaakt geen besturingsstroom maar BESTANDSINHOUD:
   welke modelnaam in welk bestand staat. Geen enkele operator raakt dat, dus
   hij kan niet zakken op wat de motor probeert -- en dat is geen zwakte van de
   toets maar een grens van het gereedschap.

   Zakken kan hij wel, op de mutatie die er hier toe doet. Met de hand
   nagegaan, en alle vier gepakt:
     kern/bijles.js naar Haiku            -> zakt (kindgericht)
     kletspraat/gesprek.js naar Sonnet    -> zakt (onbewaakte merkregel)
     kern/agenda.js stil terug naar Opus  -> zakt (de andere kant)
     Haiku uit de prijstabel van de meter -> zakt

   Wie deze toets ooit sterker wil maken volgens de motor, moet niet de toets
   verbouwen maar de motor een operator geven die tekenreeksen verandert.

   Draai los: node --test test/modelkeuze.test.js
   ========================================================================== */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const WORTEL = path.join(__dirname, '..', 'server');
const lees = (rel) => fs.readFileSync(path.join(WORTEL, rel), 'utf8');
const modellenIn = (rel) => (lees(rel).match(/claude-[a-z0-9-]+/g) || []);

/* De zwaarste modellen die we kennen. Alles wat hier NIET in staat, is voor
   deze toets "lichter" -- ook een model dat na vandaag verschijnt. Zo faalt de
   toets bij twijfel, in plaats van een nieuw goedkoop model door te laten. */
const ZWAAR = new Set(['claude-opus-5', 'claude-opus-4-8', 'claude-opus-4-7', 'claude-opus-4-6',
  'claude-fable-5', 'claude-mythos-5']);

/* ---------------------------------------------------------------------------
   1. KINDGERICHT. Wat een kind te horen krijgt is geen kostenpost. LEVEN.md:
      nooit sturen maar openen; CLAUDE.md: leren is geen wedstrijd.
--------------------------------------------------------------------------- */
const KINDGERICHT = {
  'kern/bijles.js': 'een eigen, geduldige bijlesdocent voor een kind',
  'kern/lesmaker.js': 'lesstof die feitelijk juist moet zijn, voor kinderen',
  'kern/leren/schrijven.js': 'de schrijfcoach die een kind een compliment geeft',
  'kern/leren/overhoren/lijsten.js': 'overhoorlijsten; een fout antwoord leert een kind iets verkeerds',
  'kern/leren/projecten.js': 'een project opdelen voor kinderen en gezinnen',
  'kern/baby.js': 'gezinsmomenten voor een gezin met een heel jong kind',
  'foundation/buddy.js': 'de buddy van een kind in de RTFoundation',
  'foundation/onderwijs/schrift.js': 'het schrift van een leerling',
  'routes/rtfschool.js': 'de RTF-school'
};

/* ---------------------------------------------------------------------------
   2. EEN MERKREGEL DIE NIEMAND MECHANISCH AFDWINGT. Hier rust de regel volledig
      op het instructievolgen van het model.
--------------------------------------------------------------------------- */
const ONBEWAAKTE_REGEL = {
  'kern/kletspraat/gesprek.js':
    'draagt "noem nooit een bestaand hotel, restaurant, merk of stad" -- precies wat CLAUDE.md ' +
    'verbiedt -- en de schrob() erachter haalt alleen AI-openers weg, geen merknamen',
  'kern/bibliothecaris.js':
    'praat in de RTF-stand met een kind, en moet in de Geloof-stand volstrekt neutraal blijven: ' +
    'nooit partij kiezen, nooit bekeren, niets als "de waarheid" presenteren'
};

/* ---------------------------------------------------------------------------
   3. MERKSTEM, REDENERING OF CONTRACT.
--------------------------------------------------------------------------- */
const ZWAAR_WERK = {
  'kern/ai.js': 'de ledenassistent zelf, met de tone of voice per pas',
  'routes/member/assistent.js': 'dezelfde ledenassistent op zijn route',
  'kern/webmaker-ai.js': 'de ontwerpassistent die een heel website-ontwerp herschrijft',
  'kern/onderneming/ontwerper.js': 'de bedrijfsontwerper',
  'kern/onboarding/beheer.js': 'de verplichte intake en het contract',
  'routes/techniek/functie.js': 'de controlekamer van het platform',
  'routes/techniek/beheer.js': 'de controlekamer van het platform',
  'routes/techniek/boardroom/ai.js': 'de boardroom van de eigenaar'
};

function keurZwaar(groep, waarom) {
  for (const [rel, reden] of Object.entries(groep)) {
    const modellen = modellenIn(rel).filter(m => m !== 'claude-code');
    assert.ok(modellen.length, rel + ' noemt geen model meer; is de aanroep verplaatst?');
    for (const m of modellen) {
      assert.ok(ZWAAR.has(m),
        '\n\n' + rel + ' staat op ' + m + ' en dat hoort niet.\n' +
        'Waarom niet: ' + reden + '.\n' +
        waarom + '\n' +
        'Is dit een bewust besluit, pas dan deze toets aan EN leg uit waarom -- niet andersom.\n');
    }
  }
}

test('1. de kindgerichte plekken blijven op een zwaar model', () => {
  keurZwaar(KINDGERICHT,
    'Wat een kind te horen krijgt is geen kostenpost. Zie LEVEN.md (nooit sturen maar openen) ' +
    'en CLAUDE.md (leren is geen wedstrijd).');
});

test('2. plekken met een regel die alleen het model bewaakt, blijven zwaar', () => {
  keurZwaar(ONBEWAAKTE_REGEL,
    'Deze regel wordt NERGENS in code afgedwongen; hij bestaat alleen doordat het model hem opvolgt.');
});

test('3. merkstem, redenering en contract blijven zwaar', () => {
  keurZwaar(ZWAAR_WERK,
    'Dit is merkoppervlak of een besluit met gevolgen, geen tekstje.');
});

test('4. en de plekken die WEL verlaagd zijn, staan er ook echt', () => {
  /* De andere kant van dezelfde afspraak: zonder deze toets zou iemand alles
     stilletjes terug naar Opus kunnen zetten en zou de rekening weer oplopen
     zonder dat iemand het merkt. */
  const LICHT = {
    'kern/agenda.js': 'claude-haiku-4-5',
    'kern/homekit.js': 'claude-haiku-4-5',
    'kern/markt/toezicht.js': 'claude-haiku-4-5',
    'kern/kijken.js': 'claude-sonnet-5',
    'kern/rtgonderzoeker.js': 'claude-sonnet-5',
    'kern/command/operator.js': 'claude-sonnet-5',
    'kern/facturatie/loket.js': 'claude-sonnet-5',
    'kern/creator.js': 'claude-sonnet-5',
    'kern/boerderij/adviseur.js': 'claude-sonnet-5',
    'kern/office/delen.js': 'claude-sonnet-5',
    'translate.js': 'claude-sonnet-5',
    'translate/batch-model.js': 'claude-sonnet-5'
  };
  for (const [rel, verwacht] of Object.entries(LICHT)) {
    assert.ok(modellenIn(rel).includes(verwacht),
      rel + ' hoort op ' + verwacht + ' te staan; gevonden: ' + modellenIn(rel).join(', '));
  }
});

test('5. elk gebruikt model staat in de prijstabel van de meter', () => {
  /* Anders telt ai-meter.js het tegen het onbekend-tarief en klopt de dagstand
     niet meer -- en dan gaat een plafond op het verkeerde moment dicht. */
  const { PRIJZEN } = require('../server/ai-meter');
  const cp = require('child_process');
  const gebruikt = new Set(cp.execSync(
    'grep -rhoE "model: \'claude-[a-z0-9-]+\'" ' + WORTEL + ' --include=*.js || true')
    .toString().split('\n').map(r => (r.match(/claude-[a-z0-9-]+/) || [])[0]).filter(Boolean));
  assert.ok(gebruikt.size >= 3, 'er horen meerdere modellen in gebruik te zijn');
  for (const m of gebruikt) {
    assert.ok(PRIJZEN[m], 'model ' + m + ' wordt aangeroepen maar staat niet in de prijstabel van ai-meter.js');
  }
});
