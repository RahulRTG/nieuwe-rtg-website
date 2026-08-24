/* ============================================================================
   DE SNELLE ZOEKER EN DE NAIEVE MOETEN DEZELFDE ROUTES DEKKEN.

   WAAROM DEZE TOETS ER IS

   De dekkingsanalyse in scripts/keuring.js vroeg van 4195 routes of ze ergens
   in de toetscode voorkomen, met zeven vormen per route (zie patronenVoor in
   scripts/lib/routedekking.js). Dat waren 29.365 aanroepen van String.includes
   over een tekst van 10 MB -- ruim 126 gigabyte scannen, gemeten 16,9 seconde.
   En die vraag wordt niet een keer per ronde gesteld maar bij elke meting die
   endpointsZonderTest, dekkingPct of keuringScheef nodig heeft; in de
   meterijking alleen al 85 van de 126 seconden.

   scripts/lib/veelzoek.js draait het om (Aho-Corasick): alle patronen EEN keer
   in een boom, de tekst EEN keer erdoorheen. Gemeten: 327 milliseconde.

   EN DAAROM DEZE TOETS. Die uitkomst voedt twee RATELTANDEN -- endpointsZonderTest
   en dekkingPct staan in NORM.json en mogen alleen de goede kant op. Een
   snellere zoeker die net iets ANDERS vindt is dan geen versnelling maar een
   stille verschuiving van een norm: een route die de nieuwe zoeker per ongeluk
   gedekt noemt, verdwijnt uit de lijst zonder dat er ooit een toets voor
   geschreven is, en de tand ratelt een stap door die niet verdiend is.

   Dat is precies wat test/ast-grens.test.js voor de grenscontrole doet, en daar
   was het geen theorie: de herschreven variant miste een derde vorm van een
   grens en keurde twee correcte routes af.

   WAT DEZE TOETS WEL EN NIET VANGT, en dat is de eerlijke kant. Toets 1 vangt
   alles waar de twee zeven op de ECHTE routekaart en de ECHTE toetscode uit
   elkaar lopen. Hij vangt NIET de klassieke Aho-Corasick-fout (de uitvoer van
   de faalknoop vergeten, waardoor elk patroon dat een achtervoegsel is van een
   ander wegvalt), want van de 29.365 patronen die patronenVoor() vandaag
   oplevert is er gemeten NUL een echt achtervoegsel van een ander -- elk
   patroon begint met /api/ of met een aanhalingsteken. Die garantie staat
   daarom apart in toets 2, op patronen die de vorm wel hebben. Een toets die
   dat verzwijgt zou hier groen staan op een zoeker die voor de volgende
   aanroeper stuk is.

   OP DE ECHTE CODE, NIET OP VOORBEELDEN. Toets 1 draait allebei de zeven vormen
   over de werkelijke routekaart en de werkelijke toetscode, route voor route.
   Dat kost de naieve kant zijn volle 16,9 seconde plus anderhalve seconde voor
   de routekaart, en dat is de prijs: hij vervangt 85 seconden meterijking en hij
   is het enige wat de gelijkwaardigheid ECHT vaststelt. Een verzonnen corpus zou
   die zeven vormen nooit in de combinaties zetten waarin ze hier voorkomen.
   ========================================================================== */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const WORTEL = path.join(__dirname, '..');
const { zonderCommentaar } = require('../scripts/lib/bron');
const { gedektIn, gedektenIn, patronenVoor } = require('../scripts/lib/routedekking');
const { bouw, zoek, welkeKomenVoor } = require('../scripts/lib/veelzoek');

/* De toetscode zoals dekking() hem ziet: alle test/*.js, zonder commentaar.
   zonderCommentaar komt uit scripts/lib/bron.js -- dezelfde functie die keuring.js
   gebruikt, en met opzet niet nagebouwd: een tweede zeef zou een ander corpus
   opleveren en dan toetst dit bestand een tekst die nergens bestaat. */
function toetsCorpus() {
  const uit = [];
  (function ga(d) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      if (e.name === 'node_modules' || e.name === '.git' || e.name === 'data') continue;
      const p = path.join(d, e.name);
      if (e.isDirectory()) ga(p);
      else if (e.name.endsWith('.js')) uit.push(p);
    }
  })(path.join(WORTEL, 'test'));
  uit.sort();
  return { bestanden: uit, tekst: uit.map(p => zonderCommentaar(fs.readFileSync(p, 'utf8'))).join('\n') };
}

/* De echte routekaart, via hetzelfde subproces dat dekking() gebruikt. Een
   ingebakken lijst zou binnen een week achterlopen op de server, en dan toetst
   dit bestand de gelijkwaardigheid op routes die niet meer bestaan. */
function apiRoutes() {
  const uit = execFileSync(process.execPath,
    ['--experimental-sqlite', path.join(WORTEL, 'scripts', 'routekaart.js'), '--json'],
    { cwd: WORTEL, encoding: 'utf8', timeout: 180000, maxBuffer: 32 * 1024 * 1024 });
  const d = JSON.parse(uit);
  return (d.routes || d || []).map(r => (typeof r === 'string' ? r : r.pad || r.path))
    .filter(Boolean).filter(r => r.startsWith('/api/'));
}

test('de snelle zoeker dekt exact dezelfde routes als de naieve, op de echte toetscode', () => {
  const { bestanden, tekst } = toetsCorpus();
  const routes = apiRoutes();

  /* EEN LEGE INVOER IS GEEN "ALLES GOED" MAAR EEN KAPOTTE METING (LAT.md regel
     3). Zonder deze twee regels zou een verplaatste map, een stukke routekaart
     of een zeef die alles wegsnijdt netjes nul tegen nul zetten en groen geven:
     twee lege verzamelingen zijn per definitie gelijk. */
  assert.ok(bestanden.length > 500, 'het corpus bevat de toetsbestanden (' + bestanden.length + ')');
  assert.ok(tekst.length > 2e6, 'het corpus bevat echte tekst (' + tekst.length + ' tekens)');
  assert.ok(routes.length > 2000, 'de routekaart levert de echte routes (' + routes.length + ')');

  const snel = gedektenIn(routes, tekst);
  const naief = new Set(routes.filter(r => gedektIn(r, tekst)));

  /* En er moet ECHT iets gedekt zijn, en ECHT iets niet. Zou de zeef alles of
     niets teruggeven, dan zijn de twee verzamelingen ook gelijk en zegt de
     vergelijking hierboven nog steeds niets. */
  assert.ok(naief.size > 1000, 'de naieve zeef vindt echte dekking (' + naief.size + ')');
  assert.ok(naief.size < routes.length, 'en niet alles (' + naief.size + ' van ' + routes.length + ')');

  const alleenSnel = routes.filter(r => snel.has(r) && !naief.has(r));
  const alleenNaief = routes.filter(r => !snel.has(r) && naief.has(r));
  assert.deepEqual(alleenSnel.slice(0, 20), [],
    'de snelle zoeker noemt ' + alleenSnel.length + ' route(s) gedekt die de naieve niet vindt -- ' +
    'dat poetst dekkingPct op zonder een enkele toets:\n  ' + alleenSnel.slice(0, 20).join('\n  '));
  assert.deepEqual(alleenNaief.slice(0, 20), [],
    'de snelle zoeker mist ' + alleenNaief.length + ' route(s) die de naieve wel vindt -- ' +
    'dat laat endpointsZonderTest stijgen zonder oorzaak:\n  ' + alleenNaief.slice(0, 20).join('\n  '));
  assert.equal(snel.size, naief.size, 'even veel gedekte routes');
});

test('een patroon dat een achtervoegsel is van een ander wordt ook gemeld', () => {
  /* DE VALKUIL VAN AHO-CORASICK, EN DE REDEN DAT bouw() DE UITVOER VAN DE
     FAALKNOOP OVERNEEMT.

     Staat "abcdef" in de boom en eindigt de doorloop daar, dan is de automaat
     ONDERWEG ook langs "cdef" en "def" gekomen -- maar alleen als de knoop van
     "abcdef" de uitvoer van zijn faalknoop erbij heeft gekregen. Zonder die ene
     regel meldt hij alleen het langste patroon, en dat is stil: de uitkomst
     wordt kleiner en niets klaagt.

     EN TOETS 1 VANGT DIT NIET. Dat is gemeten en niet aangenomen: van de 29.365
     patronen die patronenVoor() vandaag over de hele routekaart oplevert is er
     NUL een echt achtervoegsel van een ander. Dat is geen toeval maar een
     gevolg van de zeven vormen -- elk patroon begint met /api/ of met een
     aanhalingsteken, en die twee vallen nooit samen. Draai je de faalregel
     eruit, dan blijft de echte dekking dus exact gelijk en zakt er niets.

     Daarom staat deze toets hier en niet in toets 1. veelzoek.js is een
     algemene zoeker: de volgende aanroeper (of een achtste vorm in
     patronenVoor) heeft die garantie wel nodig, en dan is de fout er een die
     alleen nog in een dekkingscijfer te zien is. */
  const patronen = ['abcdef', 'cdef', 'def', 'zzz'];
  const gevonden = welkeKomenVoor('xx abcdef xx', patronen);
  assert.deepEqual([...gevonden].sort(), ['abcdef', 'cdef', 'def'],
    'alle drie de achtervoegsels horen gemeld te worden, niet alleen het langste');
  assert.ok(!gevonden.has('zzz'), 'en wat er niet staat, wordt niet gemeld');

  /* Dezelfde vraag breed: een verzameling patronen die stevig in elkaars
     staarten zit, tegen dezelfde naieve includes() die gedektIn gebruikt. Dit
     is de gelijkwaardigheid die toets 1 op de echte code stelt, hier op de vorm
     die de echte code (nog) niet heeft. */
  const stapel = ['a', 'ba', 'cba', 'dcba', 'edcba', 'x', 'yx', 'zyx', 'q'];
  for (const tekst of ['edcba', 'oo edcba oo', 'zyx en dcba', 'niets hier', 'aaa', 'qqq']) {
    const snel = welkeKomenVoor(tekst, stapel);
    const naief = new Set(stapel.filter(p => tekst.includes(p)));
    assert.deepEqual([...snel].sort(), [...naief].sort(),
      'snel en naief zijn het eens over "' + tekst + '"');
  }
});

test('elk van de zeven vormen laat beide zeven dezelfde kant op vallen', () => {
  /* patronenVoor() staat op EEN plek zodat gedektIn en gedektenIn niet uiteen
     kunnen lopen (LAT.md regel 4). Deze toets sluit het rondje: per vorm een
     corpus dat ALLEEN die vorm bevat, en beide zeven moeten hem vinden. Wie er
     een vorm bij zet en die alleen in de snelle kant verwerkt, zakt hier. */
  const route = '/api/lid/bank/overzicht';
  const vormen = patronenVoor(route);
  assert.equal(vormen.length, 7, 'zeven vormen (' + vormen.join(' ') + ')');
  assert.equal(new Set(vormen).size, 7, 'en zeven verschillende');
  for (const vorm of vormen) {
    const corpus = 'const x = 1;\nconst y = ' + vorm + ';\n';
    assert.ok(gedektIn(route, corpus), 'naief vindt de vorm ' + vorm);
    assert.ok(gedektenIn([route], corpus).has(route), 'snel vindt de vorm ' + vorm);
  }
  /* En de afgeknipte vorm ZONDER aanhalingstekens hoort NIET te tellen: dat is
     de strengheid waar routedekking.js om vraagt, en beide zeven moeten hem
     missen. Zou de snelle kant hem wel meenemen, dan telt lopende tekst als
     dekking. */
  const kaal = 'zie ook lid/bank/overzicht in de handleiding';
  assert.ok(!gedektIn(route, kaal), 'naief telt een kaal pad niet mee');
  assert.equal(gedektenIn([route], kaal).size, 0, 'snel telt een kaal pad ook niet mee');
});

test('twee keer hetzelfde patroon geeft twee meldingen, en een leeg patroon geen', () => {
  /* Een routekaart kan dezelfde route twee keer bevatten (twee registraties van
     hetzelfde pad). Dan hangen beide patronen aan DEZELFDE knoop in de boom, en
     zoek() moet ze allebei melden -- vandaar een lijst van indexen per knoop en
     geen enkel getal. Meldt hij er een, dan valt de tweede route stil buiten de
     dekking en stijgt endpointsZonderTest zonder oorzaak. */
  const a = bouw(['bank', 'bank', 'kluis']);
  const idx = zoek('de bank staat er', a);
  assert.deepEqual([...idx].sort(), [0, 1], 'beide indexen van hetzelfde patroon');

  /* Een leeg patroon zou OVERAL matchen en daarmee elke route gedekt noemen.
     Dat is geen vraag maar een fout in de aanroep, en bouw() slaat hem over. */
  const b = bouw(['', null, undefined, 'kluis']);
  assert.equal(zoek('geen kluis hier', b).size, 1, 'alleen het echte patroon telt');
  assert.equal(zoek('helemaal niets', b).size, 0, 'een lege tekst levert geen enkele melding');
});

test('de snelle zoeker vindt een patroon op elke plek in de tekst', () => {
  /* Begin, midden, eind en direct naast elkaar. Een automaat die na een treffer
     niet correct terugvalt, mist de tweede -- en dan hangt de dekking af van
     WAAR een route in een toetsbestand staat. */
  const p = ['aap', 'noot', 'mies'];
  assert.deepEqual([...welkeKomenVoor('aap', p)].sort(), ['aap'], 'de hele tekst is het patroon');
  assert.deepEqual([...welkeKomenVoor('aapnootmies', p)].sort(), ['aap', 'mies', 'noot'], 'aaneengesloten');
  assert.deepEqual([...welkeKomenVoor('x mies x aap x', p)].sort(), ['aap', 'mies'], 'begin en eind');
  assert.deepEqual([...welkeKomenVoor('aaap', p)].sort(), ['aap'], 'met een valse start ervoor');
  assert.deepEqual([...welkeKomenVoor('', p)], [], 'een lege tekst');
});
