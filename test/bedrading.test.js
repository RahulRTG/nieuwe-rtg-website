/* ============================================================================
   HET REGRESSIECORPUS VAN DE BEDRADINGSANALYSER.

   WAAROM DIT BESTAND ZWAARDER WEEGT DAN EEN GEWONE TOETS.

   scripts/lib/werkelijkheid.js beantwoordt de vraag "welke bestanden laadt dit
   bestand in", en keuringsregel 59 laat de bouw zakken zodra daar een
   routemodule buiten valt. In de
   richting die PROOF-INCREMENTAL.md beschrijft mag deze laag straks méér: hij
   gaat bepalen welke bewijzen NIET opnieuw hoeven. Een analyser die dat mag
   zeggen, hoort tot de zwaarst getoetste code van dit huis -- want elke fout
   erin is geen falende toets maar een toets die ONTERECHT wordt overgeslagen.

   DAAROM EEN CORPUS EN GEEN STEEKPROEF. Per constructie een voorbeeld, en de
   drie vormen waar deze analyser bij het bouwen zelf op struikelde staan er met
   naam bij:

     - een require in COMMENTAAR (regel- en blokvorm, inclusief een
       vervolgregel die zichzelf niet verraadt);
     - een SAMENGESTELDE require met een letterlijke lijst ernaast;
     - path.join met een letterlijk pad, dat geen onbekende is maar een omweg.

   DE MUTATIE VOOR DIT BESTAND: haal in werkelijkheid.js de blokcommentaar-staat
   weg -> "een doorlopende kop telt niet mee" zakt.
   ========================================================================== */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { kantenUit, codeRegelsUit, los, vormVan } = require('../scripts/lib/werkelijkheid');
const { meet } = require('../scripts/lib/bedrading');

/* Een echte map met echte bestanden, want `los` raakt de schijf: een require
   telt pas als opgelost wanneer het doel BESTAAT. Dat is de hele reden dat
   './wacht' en './wacht/index.js' allebei moeten werken. */
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-bedrading-'));
fs.mkdirSync(path.join(TMP, 'kern'), { recursive: true });
fs.mkdirSync(path.join(TMP, 'kern', 'wacht'), { recursive: true });
fs.mkdirSync(path.join(TMP, 'routes'), { recursive: true });
for (const f of ['kern/zorg.js', 'kern/wacht/index.js', 'routes/auth.js',
  'routes/member.js', 'routes/office.js']) {
  fs.writeFileSync(path.join(TMP, f), '// leeg\n');
}
const HIER = path.join(TMP, 'ingang.js');
const kijk = (bron) => {
  const r = kantenUit(bron, codeRegelsUit(bron), HIER, 'ingang.js');
  /* `opgelost` is in de index een LIJST van doelen en geen teller -- die lijst
     is wat een impactvraag nodig heeft. Hier houden we beide bij de hand. */
  return { ...r, aantal: r.opgelost.length, ingeladen: new Set(r.opgelost) };
};

test.after(() => { try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {} });

test('een letterlijke require telt als opgelost, en wijst naar het echte bestand', () => {
  const r = kijk("const z = require('./kern/zorg');\n");
  assert.equal(r.aantal, 1);
  assert.equal(r.onbekend.length, 0);
  assert.ok([...r.ingeladen].some((p) => p.endsWith('kern/zorg.js')));
});

test('een map met index.js wordt opgelost, net als Node dat doet', () => {
  /* Dit was een echte misser: vier schoolmodules leken ongemount tot bleek dat
     hun ouder ze als map inlaadt. */
  const r = kijk("require('./kern/wacht');\n");
  assert.equal(r.aantal, 1);
  assert.ok([...r.ingeladen].some((p) => p.endsWith('wacht/index.js')));
});

test('een require naar iets dat niet bestaat, telt nergens mee', () => {
  const r = kijk("require('./kern/bestaatniet');\n");
  assert.equal(r.aantal, 0);
  assert.equal(r.ingeladen.size, 0);
});

test('een kernmodule is geen kant in deze graaf', () => {
  const r = kijk("const fs = require('fs');\nconst path = require('node:path');\n");
  assert.equal(r.aantal, 0);
  assert.equal(r.onbekend.length, 0);
});

test('een require in REGELCOMMENTAAR telt niet als onbekende kant', () => {
  const r = kijk("// zie require(iets) in de kop hierboven\nconst a = 1;\n");
  assert.equal(r.onbekend.length, 0, 'commentaar is proza: ' + JSON.stringify(r.onbekend));
});

test('een doorlopende kop telt niet mee, ook niet op de vervolgregel', () => {
  /* DE MISSER DIE DIT BESTAND AFDWONG. In dit huis lopen koppen over tien
     regels door, en zo'n vervolgregel begint niet met // of *. De eerste versie
     van deze analyser meldde twee van die regels als onbekende kant. */
  const r = kijk([
    '/* DE KERNLAGEN, en hoe ze worden opgehangen.',
    '   vorm Object.assign(kern, require(...)). De VOLGORDE doet ertoe.',
    '   Nog een regel proza. */',
    'const a = 1;'
  ].join('\n'));
  assert.equal(r.onbekend.length, 0, 'een vervolgregel in een blok is proza: ' + JSON.stringify(r.onbekend));
});

test('een samengestelde require met een letterlijke lijst wordt BENADERD, met zijn kandidaten', () => {
  const r = kijk([
    "const DOMEINEN = ['auth', 'member', 'office'];",
    'for (const naam of DOMEINEN) {',
    "  require('./routes/' + naam)(grens(naam));",
    '}'
  ].join('\n'));
  assert.equal(r.benaderd.length, 1, JSON.stringify(r.benaderd));
  const b = r.benaderd[0];
  assert.equal(b.voorvoegsel, './routes/');
  /* DE KANDIDATENVERZAMELING IS HET PUNT. "Het is een van deze drie" en "het
     zit ergens onder routes/" zijn allebei conservatief, maar hun impactradius
     scheelt een orde van grootte -- en een planner die veilig wil verbreden
     heeft de verzameling nodig, niet het aantal. */
  assert.deepEqual(b.kandidaten.map((p) => path.basename(p)).sort(),
    ['auth.js', 'member.js', 'office.js']);
  assert.equal(r.onbekend.length, 0, 'benaderd is niet onbekend');
});

test('een lijst die uit een AFGELEIDE variabele komt, wordt nog steeds benaderd', () => {
  /* Zo staat het er echt: de lus loopt over `gekozen`, niet over de lijst. Die
     keten narekenen is een dataflow-motor bouwen; in plaats daarvan telt elke
     letterlijke lijst in ditzelfde bestand mee. Dat maakt de graaf RUIMER, en
     die kant is hier de veilige. */
  const r = kijk([
    "const ALLE = ['auth', 'member'];",
    "const gekozen = (process.env.X || ALLE.join(',')).split(',');",
    'for (const naam of gekozen) {',
    "  require('./routes/' + naam)(x);",
    '}'
  ].join('\n'));
  assert.equal(r.benaderd.length, 1);
  assert.equal(r.benaderd[0].kandidaten.length, 2);
});

test('path.join met een letterlijk pad is geen onbekende maar een omweg', () => {
  const r = kijk("require(path.join(root, 'server/kern/onderwijs'))(ctx);\n");
  assert.equal(r.onbekend.length, 0,
    'een letterlijk tweede stuk wijst gewoon vanaf de wortel: ' + JSON.stringify(r.onbekend));
});

test('een ECHT onbekende require draagt bestand, regel, vorm en reden', () => {
  const r = kijk("const map = elders();\nconst m = require(path.join(map, naam))(ctx);\n");
  assert.equal(r.onbekend.length, 1, JSON.stringify(r.onbekend));
  const o = r.onbekend[0];
  assert.equal(o.bestand, 'ingang.js');
  assert.equal(o.lijn, 2, 'het regelnummer wijst de plek aan');
  assert.equal(o.vorm, 'path.join met een variabele');
  assert.match(o.reden, /runtime|variabele/i, 'en er staat WAAROM hij niet oplosbaar is');
  /* Een kaal getal is geen meting. Wie deze onbekende ooit wil sluiten, moet
     weten waar hij moet kijken en wat hem in de weg staat. */
  assert.ok(o.code.length > 0, 'de constructie staat er letterlijk bij');
});

test('een kale variabele als pad is een eigen vorm, met een eigen reden', () => {
  const r = kijk('for (const b of BRONNEN) { const m = require(b); }\n');
  assert.equal(r.onbekend.length, 1);
  assert.equal(r.onbekend[0].vorm, 'kale variabele');
});

test('de vormen zijn uit elkaar te houden', () => {
  /* Zonder dit is `vorm` een etiket dat altijd hetzelfde zegt, en dan kan een
     planner er niet op sturen -- een maplader vraagt iets anders dan een naam
     uit een omgevingsvariabele. */
  assert.equal(vormVan('require(path.join(map, naam))'), 'path.join met een variabele');
  assert.equal(vormVan('require(b)'), 'kale variabele');
  assert.equal(vormVan('require(`./x/${naam}`)'), 'template-literal');
  assert.notEqual(vormVan('require(path.join(map, naam))'), vormVan('require(b)'));
});

test('los() volgt dezelfde drie stappen als Node, en niet meer', () => {
  assert.ok(String(los(HIER, './kern/zorg')).endsWith('kern/zorg.js'), 'pad + .js');
  assert.ok(String(los(HIER, './kern/zorg.js')).endsWith('kern/zorg.js'), 'het pad zelf');
  assert.ok(String(los(HIER, './kern/wacht')).endsWith('wacht/index.js'), 'map met index.js');
  assert.equal(los(HIER, 'fs'), null, 'een kernmodule is geen bestand');
  assert.equal(los(HIER, './nergens'), null, 'wat niet bestaat, lost niet op');
});

test('de echte meting op server/ staat, en draagt haar eigen onzekerheid', () => {
  /* DE POORT ZELF, tegen de echte boom. Dit is geen dubbeling van
     keuringsregel 59 maar de andere kant ervan: die zakt als er een wees is,
     deze bewaakt dat de MEETVORM klopt -- drie klassen, en elke onbekende met
     identiteit. Zonder dit kan de meter stilletjes veranderen in een teller die
     altijd nul zegt. */
  const r = meet(['server']);
  assert.ok(r.gekeken > 1000, 'de boom wordt echt afgelopen (' + r.gekeken + ')');
  assert.ok(r.kanten.opgelost > 1000, 'en er worden echte kanten gevonden');
  assert.deepEqual(r.wezen, [], 'elke routemodule heeft een pad vanaf een ingang');
  for (const o of r.kanten.onbekend) {
    assert.ok(o.bestand && o.lijn > 0 && o.vorm && o.reden,
      'elke onbekende draagt identiteit: ' + JSON.stringify(o));
  }
  for (const b of r.kanten.benaderd) {
    assert.ok(Array.isArray(b.kandidaten) || b.grens,
      'elke benadering draagt een verzameling of een grens: ' + JSON.stringify(b));
  }
});
