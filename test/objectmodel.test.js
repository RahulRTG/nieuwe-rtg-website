/* DE METING VAN HET OBJECTMODEL -- en of hij werkelijk iets onderscheidt.

   scripts/objectmodel.js beantwoordt de vraag uit DEVELOPERCLOUD.md par. 2:
   delen de domeinen van dit huis een vorm, of lijken ze alleen zo? Een meter die
   op die vraag "ja" zegt terwijl hij eigenlijk de verpakking telt, is erger dan
   geen meter -- hij levert een objectmodel op dat in een SDK belandt.

   Daarom staat hier niet alleen dat de meter DRAAIT, maar dat hij de vier
   dingen uit elkaar houdt die hem anders om de tuin leiden:

     1. een bewaarde vorm tegenover een optiezak;
     2. een echt veld tegenover een veldnaam in commentaar of in een string;
     3. gedeelde BETEKENIS tegenover gedeelde VERPAKKING -- twee vormen die
        alleen id/at/naam delen, delen niets;
     4. twee DOMEINEN tegenover twee bestanden van hetzelfde domein.

   Die derde en vierde zijn precies de fouten die de eerste versie van het script
   maakte: hij vond 2227 gelijkende vormparen, en de top stond vol met dezelfde
   demo-auto uit twee seedbestanden en met bestanden die ooit zijn gesplitst
   omdat ze over de 10 kB gingen.

   Draai los: node --test test/objectmodel.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const O = require('../scripts/objectmodel');

const V = (module, velden) => ({ module, velden });
/* De envelopdrempel als ABSOLUUT getal in plaats van een deel. Met een deel is
   in een voorbeeld van drie domeinen niet uit te drukken "in drie domeinen is
   verpakking, in twee niet" -- en juist dat onderscheid is wat hier getoetst
   wordt. In de echte meting blijft het een deel; zie de kop van het script. */
const KLEIN = { envelopVanaf: 3, gedeeldVanaf: 2, gelijkenis: 0.6 };

test('1. een bewaarde vorm telt, een optiezak niet', () => {
  const bron = [
    'const rij = { id: id(), naam: naam, status: "open", at: nu(), door: wie };',
    'const opties = { stil: true, hard: false };',            // geen id, te weinig velden
    'const drie = { id: 1, a: 2, b: 3 };'                     // wel een id, te weinig velden
  ].join('\n');
  const v = O.vormenVan(bron);
  assert.equal(v.length, 1, 'alleen de rij met een id en vier of meer velden telt');
  assert.deepEqual(v[0].sort(), ['at', 'door', 'id', 'naam', 'status']);
});

test('2. een veldnaam in commentaar of in een string is geen veld', () => {
  const bron = [
    '/* hier staat { id: 1, geheim: 2, extra: 3, nog: 4 } in een uitleg */',
    'const s = "{ id: 1, uitStringA: 2, uitStringB: 3, uitStringC: 4 }";',
    'const echt = { id: id(), alfa: 1, beta: 2, gamma: 3 };'
  ].join('\n');
  const v = O.vormenVan(bron);
  assert.equal(v.length, 1);
  assert.ok(!v[0].includes('geheim'), 'commentaar telt niet mee');
  assert.ok(!v[0].includes('uitStringA'), 'een string telt niet mee');
  assert.deepEqual(v[0].sort(), ['alfa', 'beta', 'gamma', 'id']);
});

test('3. de envelop wordt gemeten, niet opgeschreven', () => {
  /* Wat verpakking is, hangt af van wat er in dit huis staat en niet van een
     lijst die iemand ooit heeft bedacht. Zet je er een veld bij dat overal
     voorkomt, dan hoort het vanzelf envelop te worden. */
  const overal = ['kern/a', 'kern/b', 'kern/c', 'kern/d']
    .map((d, i) => V('server/' + d + '/x.js', ['id', 'at', 'iedereen', 'eigen' + i, 'nog' + i, 'meer' + i]));
  const r = O.analyse(overal, 4, { envelopDeel: 0.9, gedeeldVanaf: 2, gelijkenis: 0.6 });
  assert.ok(r.envelop.includes('iedereen'), 'een veld dat overal staat is verpakking, ook als niemand hem zo noemde');
  assert.ok(!r.envelop.includes('eigen0'), 'en een veld van een enkel domein is dat niet');
});

test('4. twee vormen die ALLEEN de envelop delen, zijn geen paar', () => {
  /* Dit is de kern van de hele meting. Bijna elke bewaarde rij draagt id, at en
     naam; wie die meetelt vindt overal verwantschap en bewijst daarmee niets. */
  const derde = V('server/kern/derde/x.js', ['id', 'at', 'naam', 'iets', 'anders', 'hier']);
  const vormen = [
    V('server/kern/eten/kaart.js', ['id', 'at', 'naam', 'gerecht', 'allergenen', 'station', 'gang']),
    V('server/kern/vervoer/rit.js', ['id', 'at', 'naam', 'ophaalpunt', 'bestemming', 'chauffeur', 'kenteken']),
    derde
  ];
  const r = O.analyse(vormen, 3, KLEIN);
  assert.deepEqual(r.envelop, ['at', 'id', 'naam'], 'id, at en naam staan in alle drie en zijn dus verpakking');
  assert.equal(r.paren.length, 0, 'een menukaart en een rit delen hun verpakking en verder niets');

  // en als ze wel iets echts delen, wordt het wel gezien
  const wel = [
    V('server/kern/eten/bon.js', ['id', 'at', 'naam', 'van', 'naar', 'centen', 'soort', 'ref']),
    V('server/kern/vervoer/bon.js', ['id', 'at', 'naam', 'van', 'naar', 'centen', 'soort', 'ref']),
    derde
  ];
  const r2 = O.analyse(wel, 3, KLEIN);
  assert.equal(r2.paren.length, 1, 'twee bonnen met dezelfde vijf velden zijn wel een kandidaat');
  assert.equal(r2.paren[0].gelijkenis, 1);
  assert.deepEqual(r2.paren[0].gedeeld, ['centen', 'naar', 'ref', 'soort', 'van'],
    'en wat er gedeeld heet, is wat er NA de envelop overblijft');
});

test('5. twee bestanden van HETZELFDE domein zijn geen twee domeinen', () => {
  /* De eerste versie zette gast/buitenshuis.js naast gast/sessie.js bovenaan,
     en levensgraaf/bronnen.js naast bronnen2.js. Dat is geen gedeeld type maar
     een bestand dat ooit is gesplitst omdat het over de 10 kB ging. Wie die als
     bewijs telt, meet zijn eigen bestandsindeling. */
  const derde = V('server/kern/derde/x.js', ['id', 'at', 'los1', 'los2', 'los3', 'los4']);
  const zelfde = [
    V('server/kern/gast/deel1.js', ['id', 'at', 'alfa', 'beta', 'gamma', 'delta']),
    V('server/kern/gast/deel2.js', ['id', 'at', 'alfa', 'beta', 'gamma', 'delta']),
    derde
  ];
  assert.equal(O.analyse(zelfde, 3, KLEIN).paren.length, 0, 'twee helften van hetzelfde domein bewijzen niets');

  const anders = [
    V('server/kern/gast/deel1.js', ['id', 'at', 'alfa', 'beta', 'gamma', 'delta']),
    V('server/kern/hotel/deel1.js', ['id', 'at', 'alfa', 'beta', 'gamma', 'delta']),
    derde
  ];
  assert.equal(O.analyse(anders, 3, KLEIN).paren.length, 1, 'dezelfde vorm in twee domeinen wel');

  assert.equal(O.domeinVan('server/kern/gast/sessie.js'), 'kern/gast');
  assert.equal(O.domeinVan('server/kern/wallet.js'), 'kern/wallet', 'een losse module in kern is zijn eigen domein');
  assert.equal(O.domeinVan('server/bedrijf/bouw.js'), 'bedrijf');
});

test('6. seed- en catalogusbestanden tellen niet mee', () => {
  /* Twee seedbestanden met dezelfde huurauto erin gaven gelijkenis 1,00. Dat is
     gekopieerde VOORBEELDDATA: het meet dat iemand een demo-rij twee keer heeft
     neergezet, niet dat twee domeinen een type delen. */
  const g = O.lees();
  const fout = [...new Set(g.vormen.map(v => v.module))]
    .filter(m => /\/initdata\/|\/seed\/|-data\.js$|-rijen\/|\/data\//.test(m));
  assert.deepEqual(fout, [], 'er zit geen seed- of catalogusbestand in de meting');
  assert.ok(g.vormen.length > 500, 'en er blijft ruim genoeg over om iets over te zeggen: ' + g.vormen.length);
});

test('7. OBJECTMODEL.json is een AFDRUK van de meting en geen los verhaal', () => {
  /* Zelfde regel als SLO.md/SLO.json en BEREIK.json: twee plaatsen met dezelfde
     waarheid lopen uit elkaar. Wie de code verandert en dit bestand niet
     bijwerkt, ziet het hier. */
  const vast = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'OBJECTMODEL.json'), 'utf8'));
  const vers = O.meet();
  assert.deepEqual(vast.gemeten, vers.gemeten,
    'OBJECTMODEL.json loopt achter op de code -- draai: npm run objectmodel:vast');
  assert.deepEqual(vast.envelop, vers.envelop);
});

test('8. en de uitkomst zegt wat DEVELOPERCLOUD.md par. 2 beweert', () => {
  /* Geen losse toets maar het antwoord op de vraag waarvoor dit script bestaat.
     Zakt hij, dan is de conclusie in dat document niet meer waar en hoort hij
     daar herschreven te worden -- niet hier weggehaald. */
  const r = O.meet();
  const deel = r.gemeten.veldenDomeineigen / r.gemeten.velden;
  assert.ok(deel > 0.5,
    'meer dan de helft van de velden hoort bij precies EEN domein (nu ' + Math.round(deel * 100) + '%); ' +
    'dat is de reden dat een universeel objectmodel gevonden en niet verklaard moet worden');
  assert.ok(r.gemeten.gelijkendeVormparen < r.gemeten.vormen / 10,
    'en gelijkende vormparen zijn de uitzondering, niet de regel (' + r.gemeten.gelijkendeVormparen +
    ' op ' + r.gemeten.vormen + ' vormen)');
});
