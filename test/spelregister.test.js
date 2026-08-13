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

/* EN HIJ IS DE ROOKMELDER VAN DE HELE MAP. `maakRegister(stubCtx)` scant de
   ECHTE spellenmap, dus een nieuw hulpbestand dat niet in GEEN_SPEL staat zakt
   hier binnen een seconde -- zonder server, zonder database. Dat is precies de
   fout die in augustus 2026 ruim twaalfhonderd toetsen liet zakken en die geen
   enkele modulegerichte toets kon zien: die requiren hun module rechtstreeks en
   starten nooit een server. Draai deze toets bij elk nieuw bestand in
   server/kern/spellen/. */
const maakRegister = require('../server/kern/spellen/register');
const stubCtx = { save() {}, crypto: require('crypto'), schud: (a) => a, beurtDoor() {}, codenaamVan: (h) => h, nudge() {} };

/* Een lijst die uit een andere bibliotheek wordt AFGELEID hoort niet woord voor
   woord in een gouden tabel: dan zakt hij bij groei in plaats van bij drift.
   Deze plaatshouder zegt "hier hoort een niet-lege lijst tekst te staan", en de
   inhoud wordt elders nagemeten. */
const AFGELEID = Symbol('afgeleide lijst');
function vervangAfgeleid(spel) {
  if (!spel || !spel.varianten) return spel;
  const varianten = {};
  for (const [veld, lijst] of Object.entries(spel.varianten)) varianten[veld] = lijst;
  if (Array.isArray(varianten.stof) && varianten.stof.length > 5 && varianten.stof.every(x => typeof x === 'string'))
    varianten.stof = AFGELEID;
  return Object.assign({}, spel, { varianten });
}

/* De gouden catalogus: sleutel -> [naam, max, wereld, extra]. Handmatig
   overgeschreven uit de spellen zoals ze zijn, niet uit het register
   gegenereerd -- anders toetst hij zichzelf. */
const GOUD = {
  mejn:     ['Mens erger je niet', 4, 'rtf', { teams: 'keuze', vormen: ['live', 'async'] }],
  schaak:   ['Schaken', 2, 'rtg', { vormen: ['live', 'async'], naspeelbaar: true }],
  woord:    ['Woordduel', 2, 'rtg', { perTaal: true, vormen: ['live', 'async'] }],
  pesten:   ['Pesten', 4, 'rtf', { vormen: ['live'] }],
  dam:      ['Dammen', 2, 'rtf', { vormen: ['live', 'async'], naspeelbaar: true }],
  rummi:    ['Rummi', 4, 'rtf', { vormen: ['live', 'async'] }],
  magnaat:  ['Magnaat', 6, 'rtg', { buitenBeurt: ['bouw', 'verkoop', 'beleid',
    'contract-voorstel', 'contract-antwoord', 'contract-opzeggen',
    'veiling-start', 'veiling-bod', 'veiling-intrekken',
    'belang-voorstel', 'belang-antwoord',
    'krediet-opnemen', 'krediet-aflossen', 'krediet-herzien',
    'polis-sluiten', 'polis-opzeggen',
    'onderzoek-starten', 'onderzoek-budget', 'onderzoek-uitrollen', 'onderzoek-subsidie',
    'beheer-aan', 'beheer-uit', 'beheer-regels', 'vakantie-aan', 'vakantie-uit',
    'uitstappen',
    'beurs-aanbieden', 'beurs-kopen', 'beurs-intrekken',
    'overname-bod', 'overname-antwoord', 'overname-intrekken',
    'functie-openen', 'functie-intrekken', 'solliciteren', 'aannemen',
    'dienst-opzeggen', 'werk-beleid',
    'promotie-aanbieden', 'promotie-antwoord', 'promotie-intrekken',
    /* DE DIENST (VERHAAL.md par. 0f). Vrij, en scherper dan de rest: een avond
       op de werkvloer die op je beurt moet wachten is geen avond meer. Hij
       staat NIET in de volwassen laag hieronder -- dit is de bijbaan zelf. */
    'rush', 'rush-pak', 'rush-overdragen', 'storing-verhelpen',
    'foundation-stem', 'bestuur-zet'],
    volwassenLaag: ['open', 'uitbreiden', 'sluiten', 'uitstappen',
      'krediet-opnemen', 'krediet-aflossen', 'krediet-herzien', 'functie-openen',
      'functie-intrekken', 'aannemen', 'bestuur-zet', 'promotie-aanbieden',
      'belang-voorstel', 'belang-antwoord', 'beurs-aanbieden', 'beurs-kopen',
      'beurs-intrekken', 'overname-bod', 'overname-antwoord', 'overname-intrekken',
      'veiling-start', 'veiling-bod', 'veiling-intrekken', 'polis-sluiten',
      'polis-opzeggen', 'contract-voorstel', 'contract-antwoord', 'contract-opzeggen',
      'onderzoek-starten', 'onderzoek-budget', 'onderzoek-uitrollen', 'onderzoek-subsidie',
      'beheer-aan', 'beheer-uit', 'beheer-regels', 'beleid',
      /* Beslissen wat er met een kapotte machine gebeurt is ondernemen: het kost
         geld en het raakt de capaciteit van een zaak (magnaat/storing.js). */
      'bouw', 'verkoop', 'storing-verhelpen'],
    vormen: ['live', 'async'],
    varianten: { vorm: ['bord', 'economie'], stad: ['IJmuiden'], duur: ['quick', 'avond', 'weekend'],
      start: ['ondernemer', 'mens'] } }],
  seconden: ['30 Seconden', 4, 'rtg', { min: 4, teams: 'altijd', vormen: ['live'] }],
  waarheid: ['Doen of Waarheid', 6, 'rtf', { vormen: ['live'] }],
  proost:   ['Proost', 6, 'rtg', { volwassen: true, vormen: ['live'] }],
  flits:    ['Flitsduel', 4, 'rtf', { buitenBeurt: ['antwoord'], vormen: ['live'] }],
  reactie:  ['Reactieduel', 4, 'rtf', { buitenBeurt: ['tik'], vormen: ['live'] }],
  quiz:     ['Quizduel', 4, 'rtf', { buitenBeurt: ['antwoord'], vormen: ['live'], teams: 'keuze',
    varianten: { bron: ['algemeen', 'school'], stof: AFGELEID } }],
  schat:    ['Schatduel', 4, 'rtf', { buitenBeurt: ['schat'], vormen: ['live'] }],
  geheugen: ['Geheugenduel', 4, 'rtf', { buitenBeurt: ['reeks'], vormen: ['live'] }],
  orde:     ['Rangschikduel', 4, 'rtf', { buitenBeurt: ['orde'], vormen: ['live'] }]
};

/* De arcade is de tweede vorm: geen potje, geen beurten, wel een score. Sneek
   en Tetris staan in BEIDE apps -- dat is precies waarom een arcadespel
   `werelden` (lijst) heeft en een potje `wereld` (enkelvoud, en dat betekent
   daar iets anders: wie mag STARTEN).

   Sudoku is de uitzondering en dat staat er met naam bij: `serverScore` betekent
   dat de server de puzzel uitgeeft en de punten rekent, en dat `arcade-score`
   een ingestuurd getal voor dit spel WEIGERT. Die vlag stil zien wegvallen zou
   het scorebord weer opengooien zonder dat er iets zichtbaar kapot gaat. Zijn
   maxPunten is daarom ook geen fantasiegrens maar de hoogste basis die de motor
   uberhaupt kan uitdelen (moeilijk, in nul seconden). */
const GOUD_ARCADE = {
  sneek:  ['Sneek', ['rtg', 'rtf'], 999999, {}],
  tetris: ['Tetris', ['rtg', 'rtf'], 999999, {}],
  sudoku: ['Sudoku', ['rtg', 'rtf'], 500, { serverScore: true, dagelijks: true }]
};

test('precies een spel mag niet bekeken worden, en dat is 30 Seconden', () => {
  /* Meekijken is opt-in per spel. Deze regel staat hier apart omdat hij over
     valsspelen gaat en niet over een lijstje: de weergave van 30 Seconden zou
     de kaart aan een kijker tonen die de rader niet mag zien. Zie
     test/spelkijken.test.js voor de meting.

     Let op WAAR dit nu aan hangt. Hiervoor stond hier `!SPEL[k].kijken`, een
     vlag naast de weergave -- en die bewering klopte bij drie spellen niet.
     Nu is de weergave zelf het antwoord: geen `zicht.kijker`, niets te tonen. */
  const { ZICHT } = maakRegister(stubCtx);
  assert.deepEqual(Object.keys(ZICHT).filter(k => !ZICHT[k].kijker), ['seconden']);
});

test('een gedeeld scherm is opt-in, en 30 Seconden hoort er wel bij', () => {
  /* De keerzijde van de regel hierboven, en de reden dat het zicht drie lagen
     heeft in plaats van twee: juist het spel dat NIET bekeken mag worden hoort
     wel op een televisie in de kamer te kunnen. */
  const { ZICHT } = maakRegister(stubCtx);
  assert.ok(ZICHT.seconden.publiek, '30 Seconden hoort te projecteren');
  assert.ok(!ZICHT.seconden.kijker, 'en tegelijk niet te bekijken');
  /* En de keerzijde van de keerzijde: wie GEEN projectie beschrijft, krijgt er
     ook geen. Magnaat stond hier tot de economie erbij kwam -- die heeft nu wel
     een publieke weergave (de stad en de maand, en niemands boeken), dus de
     regel wordt nu op een spel gemeten dat hem echt niet heeft. */
  assert.ok(!ZICHT.pesten.publiek, 'wat geen projectie beschreven heeft, projecteert niet');
  assert.ok(ZICHT.magnaat.publiek, 'Magnaat kreeg er een toen de economie erbij kwam');
});

test('het register vindt precies de spellen die er zijn', () => {
  const { SPEL, ARCADE } = maakRegister(stubCtx);
  assert.deepEqual(Object.keys(SPEL).sort(), Object.keys(GOUD).sort(),
    'een potjes-spel is stil uit het register verdwenen of erin geslopen');
  assert.deepEqual(Object.keys(ARCADE).sort(), Object.keys(GOUD_ARCADE).sort(),
    'een arcadespel is stil uit het register verdwenen of erin geslopen');
});

test('de twee vormen lopen niet door elkaar', () => {
  const { SPEL, ARCADE, INITS, ZETTEN, ZICHT } = maakRegister(stubCtx);
  for (const sleutel of Object.keys(ARCADE)) {
    assert.ok(!SPEL[sleutel], sleutel + ' is arcade en hoort geen potje te kunnen zijn');
    // anders zou /spel/nieuw of /spel/zet met soort=sneek een open vraag zijn
    for (const tabel of [INITS, ZETTEN, ZICHT]) assert.equal(tabel[sleutel], undefined);
  }
  for (const sleutel of Object.keys(SPEL)) assert.ok(!ARCADE[sleutel], sleutel + ' is een potje en hoort geen arcadescore te hebben');
});

test('elk arcadespel houdt zijn naam, apps, puntengrens en wie de score rekent', () => {
  const { ARCADE } = maakRegister(stubCtx);
  for (const [sleutel, [naam, werelden, maxPunten, extra]] of Object.entries(GOUD_ARCADE))
    assert.deepEqual(ARCADE[sleutel], Object.assign({ naam, werelden, maxPunten }, extra), 'arcadespel ' + sleutel);
});

test('elk spel houdt zijn naam, spelersaantal, wereld en toegangsregels', () => {
  const { SPEL, SOORTEN } = maakRegister(stubCtx);
  for (const [sleutel, [naam, max, wereld, extra]] of Object.entries(GOUD)) {
    /* De schoolstof van het Quizduel is AFGELEID uit de leerlijnen en groeit
       daarmee mee; hem hier voluit overschrijven zou betekenen dat deze toets
       zakt zodra er een leerdoel bij komt, en dat is geen drift maar groei.
       Wat hier telt is dat het VELD er is en zijn vorm klopt; dat de inhoud bij
       de leerstof past staat in test/spelquiz.test.js. */
    const echt = vervangAfgeleid(SPEL[sleutel]);
    /* `rolVanZet` is een HAAK en geen eigenschap: hij vertelt de platformlaag
       welke rol de handelende speler met een zet op zich neemt (../grens.js).
       Een functie letterlijk in een gouden tabel zetten meet niets -- dat hij
       er is en dat hij werkt, staat in test/spelleeftijd.test.js. */
    const haak = echt.rolVanZet;
    delete echt.rolVanZet;
    if (sleutel === 'magnaat') assert.equal(typeof haak, 'function', 'magnaat hoort een rolhaak te hebben');
    else assert.equal(haak, undefined, sleutel + ' heeft er ongevraagd een');
    assert.deepEqual(echt, Object.assign({ naam, max, wereld }, extra), 'spel ' + sleutel);
    assert.equal(SOORTEN[sleutel], naam, 'SOORTEN van ' + sleutel);
  }
});

test('elk spel levert een init, een zet en een eigen spelerweergave', () => {
  const { SPEL, INITS, ZETTEN, ZICHT } = maakRegister(stubCtx);
  for (const sleutel of Object.keys(SPEL)) {
    for (const [wat, tabel] of [['init', INITS], ['zet', ZETTEN]])
      assert.equal(typeof tabel[sleutel], 'function', sleutel + ' mist een ' + wat);
    assert.equal(typeof ZICHT[sleutel].speler, 'function', sleutel + ' mist een zicht.speler');
  }
});

/* ---------- het zicht faalt net zo luid als de rest ---------- */

test('de oude vorm wordt geweigerd in plaats van stil vertaald', () => {
  /* `view` + `kijken: true` automatisch omzetten naar `zicht` zou de drie
     fouten die daarin zaten meenemen en er de schijn van een besluit aan geven.
     Wie migreert hoort per spel de vraag te beantwoorden. */
  metMap({ 'oud.js': "module.exports = () => ({ spel: { sleutel: 'oud', naam: 'Oud', max: 2, wereld: 'rtg', init(){}, zet(){}, view(){} } });" }, (map) => {
    assert.throws(() => maakRegister(stubCtx, map), /oud\.js gebruikt nog `view`; dat heet nu `zicht\.speler`/);
  });
  metMap({ 'vlag.js': GELDIG('vlag', 'Vlag').replace("wereld: 'rtg'", "wereld: 'rtg', kijken: true") }, (map) => {
    assert.throws(() => maakRegister(stubCtx, map), /vlag\.js gebruikt nog `kijken`/);
  });
});

test('een zicht zonder spelerweergave wordt geweigerd', () => {
  metBlind('zicht: { kijker(){} }', /geen `zicht\.speler`/);
});

test('een kijker die geen functie is en niet ZONDER_SPELER wordt geweigerd', () => {
  // anders is `kijker: true` weer een vlag, en dat is precies wat hier weg moest
  metBlind('zicht: { speler(){}, kijker: true }', /`zicht\.kijker` die geen functie is en niet ZONDER_SPELER/);
});

test('een publiek dat geen functie is wordt geweigerd', () => {
  metBlind('zicht: { speler(){}, publiek: true }', /`zicht\.publiek` die geen functie is/);
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
  "max: 2, wereld: 'rtg', init(){}, zet(){}, zicht: { speler(){} } } });";

/* Een spel met een kapot `zicht`-blok, om te toetsen dat het register er luid
   op valt. De rest van de descriptor klopt, zodat de melding echt over het
   zicht gaat en niet over iets anders wat er toevallig ook mist. */
function metBlind(zichtBlok, patroon) {
  const bron = "module.exports = () => ({ spel: { sleutel: 'blind', naam: 'Blind', " +
    `max: 2, wereld: 'rtg', init(){}, zet(){}, ${zichtBlok} } });`;
  metMap({ 'blind.js': bron }, (map) => {
    assert.throws(() => maakRegister(stubCtx, map), patroon);
  });
}

test('een module zonder descriptor laat de server niet opstarten', () => {
  metMap({ 'echt.js': GELDIG('echt', 'Echt'), 'losse-helper.js': 'module.exports = () => ({ hulp(){} });' }, (map) => {
    assert.throws(() => maakRegister(stubCtx, map), /losse-helper\.js geeft geen `spel`-descriptor/);
  });
});

test('een descriptor die iets verplichts mist noemt het bestand en wat er mist', () => {
  metMap({ 'half.js': "module.exports = () => ({ spel: { sleutel: 'half', naam: 'Half', wereld: 'rtg', init(){}, zet(){} } });" }, (map) => {
    assert.throws(() => maakRegister(stubCtx, map), /half\.js mist in `spel` \(vorm potje\): max, zicht/);
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
    const { SPEL, INITS, ZETTEN, ZICHT } = maakRegister(stubCtx, map);
    assert.deepEqual(SPEL.nieuw, { naam: 'Gloednieuw', max: 2, wereld: 'rtg', vormen: ['live'] });
    for (const tabel of [INITS, ZETTEN]) assert.equal(typeof tabel.nieuw, 'function');
    assert.equal(typeof ZICHT.nieuw.speler, 'function');
    // en het nieuwe spel is standaard niet te bekijken en niet te projecteren
    assert.equal(ZICHT.nieuw.kijker, null);
    assert.equal(ZICHT.nieuw.publiek, null);
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

/* ---------- de dagopgave: de enige harde koppeling in het register ----------
   `dagelijks: true` betekent EEN opgave voor iedereen op EEN bord, en daar
   staan mensen op die je niet kent. Dat is een competitie, en een score die de
   client zelf rekent hoort daar niet in -- bij Sneek en Tetris is een topscore
   vandaag een regel JavaScript. Zonder deze weigering is die hele maatregel te
   omzeilen met een regel in een descriptor, en dat zou pas opvallen als er een
   bord vol onmogelijke tijden staat. */

test('een dagopgave zonder server-berekende score laat de server niet opstarten', () => {
  metMap({ 'dagvals.js': ARCADE_GELDIG('dagvals', 'Dagvals').replace('maxPunten: 1000',
    'maxPunten: 1000, dagelijks: true, dagOpgave: () => ({}), dagKeur: () => ({})') }, (map) => {
    assert.throws(() => maakRegister(stubCtx, map), /dagvals\.js heeft `dagelijks: true` zonder `serverScore: true`/);
  });
});

test('een dagopgave zonder de twee haken laat de server niet opstarten', () => {
  /* `serverScore` alleen zegt dat de score van de server komt; zonder een
     opgave om uit te geven en een keuring om hem te wegen is er niets om hem
     mee uit te rekenen, en dan staat er een lege dagknop in de app. */
  const basis = ARCADE_GELDIG('dagkaal', 'Dagkaal').replace('maxPunten: 1000',
    'maxPunten: 1000, serverScore: true, dagelijks: true');
  metMap({ 'dagkaal.js': basis }, (map) => {
    assert.throws(() => maakRegister(stubCtx, map), /dagkaal\.js heeft `dagelijks: true` maar geen `dagOpgave`/);
  });
  metMap({ 'dagkaal.js': basis.replace('dagelijks: true', 'dagelijks: true, dagOpgave: () => ({})') }, (map) => {
    assert.throws(() => maakRegister(stubCtx, map), /dagkaal\.js heeft `dagelijks: true` maar geen `dagKeur`/);
  });
});

test('een dagopgave die wel deugt levert twee haken op, en de tabel blijft data', () => {
  metMap({ 'dagecht.js': ARCADE_GELDIG('dagecht', 'Dagecht').replace('maxPunten: 1000',
    'maxPunten: 1000, serverScore: true, dagelijks: true, dagOpgave: () => ({}), dagKeur: () => ({})') }, (map) => {
    const { ARCADE, DAG } = maakRegister(stubCtx, map);
    assert.deepEqual(ARCADE.dagecht, { naam: 'Dagecht', werelden: ['rtg'], maxPunten: 1000,
      serverScore: true, dagelijks: true }, 'de functies horen niet in de ARCADE-tabel');
    assert.equal(typeof DAG.dagecht.opgave, 'function');
    assert.equal(typeof DAG.dagecht.keur, 'function');
  });
});

test('een arcadespel zonder dagopgave staat niet in de DAG-tabel', () => {
  const { ARCADE, DAG } = maakRegister(stubCtx);
  for (const sleutel of Object.keys(ARCADE))
    assert.equal(!!DAG[sleutel], !!ARCADE[sleutel].dagelijks, sleutel + ': tabel en vlag lopen uiteen');
  assert.ok(DAG.sudoku, 'Sudoku is de enige die vandaag een dagopgave heeft');
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

test('een helper die het register zelf aanroept krijgt een melding, geen stack overflow', () => {
  /* Dit is echt gebeurd bij het opsplitsen: spellen/rondom.js kwam in de map te
     staan zonder in GEEN_SPEL te zitten, en vroeg via naspelen.js het register
     op. De scan vond het bestand, laadde het, en dat laadde de scan -- een
     stack overflow ver van de oorzaak, in plaats van de melding die er hoort
     te staan. */
  metMap({ 'lus.js': "module.exports = () => { require('" +
    path.join(__dirname, '..', 'server', 'kern', 'spellen', 'register').replace(/\\/g, '/') +
    "')({}); return { spel: {} }; };" }, (map) => {
    assert.throws(() => maakRegister(stubCtx, map), /het register roept zichzelf aan/);
  });
});

test('en een terechte fout laat die bewaking niet vastzitten', () => {
  /* De vlag moet ook opgeruimd worden als de keuring gooit -- anders is de
     eerste kapotte descriptor genoeg om elke volgende scan te laten denken dat
     hij zichzelf aanroept. Ook dat is hier misgegaan. */
  metMap({ 'stuk.js': 'module.exports = () => ({ hulp(){} });' }, (map) => {
    assert.throws(() => maakRegister(stubCtx, map), /geeft geen `spel`-descriptor/);
  });
  // en meteen daarna moet een gezonde scan het gewoon doen
  const { SPEL } = maakRegister(stubCtx);
  assert.ok(SPEL.schaak, 'het echte register werkt nog');
});
