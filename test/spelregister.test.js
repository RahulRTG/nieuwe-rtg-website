/* Het spelregister: elk spel beschrijft zichzelf in zijn eigen module en het
   register bouwt daar de dispatch-tabellen uit. Deze toets bewaakt twee dingen
   die anders pas midden in een potje zouden opvallen:

   1. De catalogus zelf. Een spel dat stil uit de lijst verdwijnt (hernoemd
      bestand, weggevallen descriptor) is precies de fout waar dit register
      voor is; de gouden tabel hieronder houdt hem tegen. De eigenschappen die
      over TOEGANG gaan -- de 18+-poort van Proost, het minimum van vier bij 30
      Seconden, welke wereld een potje mag starten -- staan er met naam in,
      want die stil zien wegvallen is erger dan een spel kwijt zijn.
   2. Dat het register LUID faalt. Een module zonder geldige descriptor mag de
      server niet laten opstarten. Stil overslaan zou het spel spoorloos uit de
      lobby laten verdwijnen, en dan is het register zijn eigen doel kwijt.

   Draai los: node --experimental-sqlite --test test/spelregister.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const maakRegister = require('../server/kern/spellen/register');
const stubCtx = { save() {}, crypto: require('crypto'), schud: (a) => a, beurtDoor() {}, codenaamVan: (h) => h, nudge() {} };

/* De gouden catalogus: sleutel -> [naam, max, wereld, extra]. Handmatig
   overgeschreven uit de spellen zoals ze zijn, niet uit het register
   gegenereerd -- anders toetst hij zichzelf. */
const GOUD = {
  mejn:     ['Mens erger je niet', 4, 'rtf', { teams: 'keuze', kijken: true }],
  schaak:   ['Schaken', 2, 'rtg', { kijken: true }],
  woord:    ['Woordduel', 2, 'rtg', { perTaal: true, kijken: true }],
  pesten:   ['Pesten', 4, 'rtf', { kijken: true }],
  dam:      ['Dammen', 2, 'rtf', { kijken: true }],
  rummi:    ['Rummi', 4, 'rtf', { kijken: true }],
  magnaat:  ['Magnaat', 6, 'rtg', { buitenBeurt: ['bouw', 'verkoop'], kijken: true }],
  seconden: ['30 Seconden', 4, 'rtg', { min: 4, teams: 'altijd' }],
  waarheid: ['Doen of Waarheid', 6, 'rtf', { kijken: true }],
  proost:   ['Proost', 6, 'rtg', { volwassen: true, kijken: true }],
  flits:    ['Flitsduel', 4, 'rtf', { buitenBeurt: ['antwoord'], kijken: true }],
  reactie:  ['Reactieduel', 4, 'rtf', { buitenBeurt: ['tik'], kijken: true }],
  quiz:     ['Quizduel', 4, 'rtf', { buitenBeurt: ['antwoord'], kijken: true }],
  schat:    ['Schatduel', 4, 'rtf', { buitenBeurt: ['schat'], kijken: true }],
  geheugen: ['Geheugenduel', 4, 'rtf', { buitenBeurt: ['reeks'], kijken: true }],
  orde:     ['Rangschikduel', 4, 'rtf', { buitenBeurt: ['orde'], kijken: true }]
};

/* De arcade is de tweede vorm: geen potje, geen beurten, wel een score. Sneek
   en Tetris staan in BEIDE apps -- dat is precies waarom een arcadespel
   `werelden` (lijst) heeft en een potje `wereld` (enkelvoud, en dat betekent
   daar iets anders: wie mag STARTEN). */
const GOUD_ARCADE = {
  sneek:  ['Sneek', ['rtg', 'rtf'], 999999],
  tetris: ['Tetris', ['rtg', 'rtf'], 999999],
  sudoku: ['Sudoku', ['rtf'], 999999]
};

test('precies een spel mag niet bekeken worden, en dat is 30 Seconden', () => {
  /* Meekijken is opt-in per spel. Deze regel staat hier apart omdat hij over
     valsspelen gaat en niet over een lijstje: de weergave van 30 Seconden zou
     de kaart aan een kijker tonen die de rader niet mag zien. Zie
     test/spelkijken.test.js voor de meting. */
  const { SPEL } = maakRegister(stubCtx);
  assert.deepEqual(Object.keys(SPEL).filter(k => !SPEL[k].kijken), ['seconden']);
});

test('het register vindt precies de spellen die er zijn', () => {
  const { SPEL, ARCADE } = maakRegister(stubCtx);
  assert.deepEqual(Object.keys(SPEL).sort(), Object.keys(GOUD).sort(),
    'een potjes-spel is stil uit het register verdwenen of erin geslopen');
  assert.deepEqual(Object.keys(ARCADE).sort(), Object.keys(GOUD_ARCADE).sort(),
    'een arcadespel is stil uit het register verdwenen of erin geslopen');
});

test('de twee vormen lopen niet door elkaar', () => {
  const { SPEL, ARCADE, INITS, ZETTEN, VIEWS } = maakRegister(stubCtx);
  for (const sleutel of Object.keys(ARCADE)) {
    assert.ok(!SPEL[sleutel], sleutel + ' is arcade en hoort geen potje te kunnen zijn');
    // anders zou /spel/nieuw of /spel/zet met soort=sneek een open vraag zijn
    for (const tabel of [INITS, ZETTEN, VIEWS]) assert.equal(tabel[sleutel], undefined);
  }
  for (const sleutel of Object.keys(SPEL)) assert.ok(!ARCADE[sleutel], sleutel + ' is een potje en hoort geen arcadescore te hebben');
});

test('elk arcadespel houdt zijn naam, apps en puntengrens', () => {
  const { ARCADE } = maakRegister(stubCtx);
  for (const [sleutel, [naam, werelden, maxPunten]] of Object.entries(GOUD_ARCADE))
    assert.deepEqual(ARCADE[sleutel], { naam, werelden, maxPunten }, 'arcadespel ' + sleutel);
});

test('elk spel houdt zijn naam, spelersaantal, wereld en toegangsregels', () => {
  const { SPEL, SOORTEN } = maakRegister(stubCtx);
  for (const [sleutel, [naam, max, wereld, extra]] of Object.entries(GOUD)) {
    assert.deepEqual(SPEL[sleutel], Object.assign({ naam, max, wereld }, extra), 'spel ' + sleutel);
    assert.equal(SOORTEN[sleutel], naam, 'SOORTEN van ' + sleutel);
  }
});

test('elk spel levert een init, een zet en een eigen weergave', () => {
  const { SPEL, INITS, ZETTEN, VIEWS } = maakRegister(stubCtx);
  for (const sleutel of Object.keys(SPEL)) {
    for (const [wat, tabel] of [['init', INITS], ['zet', ZETTEN], ['view', VIEWS]])
      assert.equal(typeof tabel[sleutel], 'function', sleutel + ' mist een ' + wat);
  }
});

test('alleen Magnaat levert statische borddata, en die reist niet standaard mee', () => {
  const { STATISCH } = maakRegister(stubCtx);
  assert.deepEqual(Object.keys(STATISCH), ['magnaat']);
  assert.ok(Array.isArray(STATISCH.magnaat().velden) && STATISCH.magnaat().velden.length > 0);
});

/* ---------- het luide falen ---------- */

// een tijdelijke spellenmap met precies de meegegeven bestanden erin
function metMap(bestanden, doe) {
  const map = fs.mkdtempSync(path.join(os.tmpdir(), 'spelregister-'));
  try {
    for (const [naam, inhoud] of Object.entries(bestanden)) fs.writeFileSync(path.join(map, naam), inhoud);
    doe(map);
  } finally { fs.rmSync(map, { recursive: true, force: true }); }
}
const GELDIG = (sleutel, naam) => `module.exports = () => ({ spel: { sleutel: '${sleutel}', naam: '${naam}', ` +
  "max: 2, wereld: 'rtg', init(){}, zet(){}, view(){} } });";

test('een module zonder descriptor laat de server niet opstarten', () => {
  metMap({ 'echt.js': GELDIG('echt', 'Echt'), 'losse-helper.js': 'module.exports = () => ({ hulp(){} });' }, (map) => {
    assert.throws(() => maakRegister(stubCtx, map), /losse-helper\.js geeft geen `spel`-descriptor/);
  });
});

test('een descriptor die iets verplichts mist noemt het bestand en wat er mist', () => {
  metMap({ 'half.js': "module.exports = () => ({ spel: { sleutel: 'half', naam: 'Half', wereld: 'rtg', init(){}, zet(){} } });" }, (map) => {
    assert.throws(() => maakRegister(stubCtx, map), /half\.js mist in `spel` \(vorm potje\): max, view/);
  });
});

test('een sleutel die niet bij zijn bestandsnaam hoort wordt geweigerd', () => {
  // anders zoek je een spel dat er wel is en toch niet start
  metMap({ 'schaken.js': GELDIG('schaak', 'Schaken') }, (map) => {
    assert.throws(() => maakRegister(stubCtx, map), /schaken\.js noemt zich 'schaak'; verwacht 'schaken'/);
  });
});

test('een spel in een wereld die niet bestaat wordt geweigerd', () => {
  metMap({ 'zweef.js': GELDIG('zweef', 'Zweef').replace("wereld: 'rtg'", "wereld: 'rtx'") }, (map) => {
    assert.throws(() => maakRegister(stubCtx, map), /zweef\.js heeft wereld 'rtx'/);
  });
});

test('een spel toevoegen is een bestand neerzetten, en verder niets', () => {
  /* Dit is de belofte van het register, dus die staat hier als toets. Viel hij
     weg, dan waren we terug bij negen plekken in zes bestanden. */
  metMap({ 'echt.js': GELDIG('echt', 'Echt'), 'nieuw.js': GELDIG('nieuw', 'Gloednieuw') }, (map) => {
    const { SPEL, INITS, ZETTEN, VIEWS } = maakRegister(stubCtx, map);
    assert.deepEqual(SPEL.nieuw, { naam: 'Gloednieuw', max: 2, wereld: 'rtg' });
    for (const tabel of [INITS, ZETTEN, VIEWS]) assert.equal(typeof tabel.nieuw, 'function');
  });
});

test('een teams-instelling die niet bestaat wordt geweigerd', () => {
  metMap({ 'raar.js': GELDIG('raar', 'Raar').replace("wereld: 'rtg'", "wereld: 'rtg', teams: 'soms'") }, (map) => {
    assert.throws(() => maakRegister(stubCtx, map), /raar\.js heeft teams 'soms'/);
  });
});

/* ---------- de teamvraag: leest de lobby hem echt uit de descriptor? ---------- */

test('de lobby leidt de teamstand af uit het spel, niet uit een spelnaam', () => {
  const { SPEL } = maakRegister(stubCtx);
  const { teamModus } = require('../server/kern/spellen/lobby')({ SPEL });

  // 'altijd': 30 Seconden BESTAAT alleen als twee teams van twee, ook als er
  // niets gevraagd wordt (het random-pad vraagt niet)
  assert.equal(teamModus('seconden', 4, 'teams'), 'teams');
  assert.equal(teamModus('seconden', 4, undefined), 'teams');
  assert.equal(teamModus('seconden', 4, 'vrij'), 'teams');

  // 'keuze': alleen als het potje VOL is en de starter erom vraagt. Met drie
  // spelers valt 2-tegen-2 niet te verdelen, dus dat blijft vrij spel
  assert.equal(teamModus('mejn', 4, 'teams'), 'teams');
  assert.equal(teamModus('mejn', 3, 'teams'), 'vrij', 'teams met een half potje deelt niet eerlijk');
  assert.equal(teamModus('mejn', 2, 'teams'), 'vrij');
  assert.equal(teamModus('mejn', 4, undefined), 'vrij', 'het random-pad vraagt niets, dus geen teams');

  // een spel zonder teams in zijn descriptor speelt nooit in teams, wat de
  // client ook meestuurt
  for (const sleutel of Object.keys(SPEL).filter(k => !SPEL[k].teams))
    assert.equal(teamModus(sleutel, SPEL[sleutel].max, 'teams'), 'vrij', sleutel + ' hoort geen teams te kennen');
});

/* ---------- de arcade-vorm faalt net zo luid ---------- */

const ARCADE_GELDIG = (sleutel, naam) => `module.exports = () => ({ spel: { sleutel: '${sleutel}', naam: '${naam}', ` +
  "vorm: 'arcade', werelden: ['rtg'], maxPunten: 1000 } });";

test('een arcadespel toevoegen is ook een bestand neerzetten', () => {
  metMap({ 'pinbal.js': ARCADE_GELDIG('pinbal', 'Pinbal') }, (map) => {
    const { SPEL, ARCADE } = maakRegister(stubCtx, map);
    assert.deepEqual(ARCADE.pinbal, { naam: 'Pinbal', werelden: ['rtg'], maxPunten: 1000 });
    assert.deepEqual(SPEL, {}, 'een arcadespel hoort niet in de potjes-tabel te landen');
  });
});

test('een arcadespel zonder puntengrens wordt geweigerd', () => {
  // zonder grens is een ingestuurde score onbegrensd, en die komt uit de client
  metMap({ 'los.js': ARCADE_GELDIG('los', 'Los').replace('maxPunten: 1000', 'maxPunten: 0') }, (map) => {
    assert.throws(() => maakRegister(stubCtx, map), /los\.js heeft maxPunten 0/);
  });
});

test('een arcadespel zonder apps om in te staan wordt geweigerd', () => {
  metMap({ 'nergens.js': ARCADE_GELDIG('nergens', 'Nergens').replace("werelden: ['rtg']", 'werelden: []') }, (map) => {
    assert.throws(() => maakRegister(stubCtx, map), /nergens\.js heeft werelden \[\]/);
  });
});

test('een arcadespel in een app die niet bestaat wordt geweigerd', () => {
  metMap({ 'raarland.js': ARCADE_GELDIG('raarland', 'Raarland').replace("werelden: ['rtg']", "werelden: ['rtg','rtx']") }, (map) => {
    assert.throws(() => maakRegister(stubCtx, map), /raarland\.js heeft werelden \["rtg","rtx"\]/);
  });
});

test('een vorm die niet bestaat wordt geweigerd', () => {
  metMap({ 'iets.js': GELDIG('iets', 'Iets').replace("wereld: 'rtg'", "wereld: 'rtg', vorm: 'gokkast'") }, (map) => {
    assert.throws(() => maakRegister(stubCtx, map), /iets\.js heeft vorm 'gokkast'/);
  });
});

test('een arcadespel dat zijn naam of apps mist noemt precies wat er mist', () => {
  metMap({ 'kaal.js': "module.exports = () => ({ spel: { sleutel: 'kaal', vorm: 'arcade' } });" }, (map) => {
    assert.throws(() => maakRegister(stubCtx, map), /kaal\.js mist in `spel` \(vorm arcade\): naam, werelden, maxPunten/);
  });
});

test('een sleutel die twee keer bestaat wordt geweigerd', () => {
  /* Dit kan echt: een map `dubbel/` (met index.js) en een bestand `dubbel.js`
     leveren allebei de sleutel 'dubbel'. Zonder deze controle wint de laatste
     in de scanvolgorde en verdwijnt de ander stil. */
  const map = fs.mkdtempSync(path.join(os.tmpdir(), 'spelregister-'));
  try {
    fs.writeFileSync(path.join(map, 'dubbel.js'), GELDIG('dubbel', 'Dubbel'));
    fs.mkdirSync(path.join(map, 'dubbel'));
    fs.writeFileSync(path.join(map, 'dubbel', 'index.js'), GELDIG('dubbel', 'Dubbel uit de map'));
    assert.throws(() => maakRegister(stubCtx, map), /'dubbel' staat er twee keer in/);
  } finally { fs.rmSync(map, { recursive: true, force: true }); }
});
