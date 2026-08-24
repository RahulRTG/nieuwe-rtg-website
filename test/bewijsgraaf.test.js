/* DE BEWIJSGRAAF EN DE PLANNER -- fase D en E van de verificatie-runtime.

   De opdracht luidde: "RTG moet de kleinste aantoonbaar voldoende verificatie
   kunnen uitvoeren voor iedere verandering -- terwijl de volledige bewijsruimte
   permanent bekend blijft." Dat vraagt twee dingen: weten welk bewijs bij welke
   code hoort (de graaf), en op grond daarvan durven weglaten (de planner).

   Durven weglaten is het gevaarlijke deel. Een planner die te weinig kiest maakt
   een GROENE ronde die niets betekent, en dat merk je pas als er iets in
   productie stukgaat. Deze toets is daarom vooral een toets op het weglaten.

   DE KRUISPROEF IS DE KERN. MUTATIES.json is een orakel dat we al hebben: daar
   staat per toets welke module bij mutatie die toets liet ZAKKEN -- bewezen
   gevoeligheid, gemeten en niet beweerd. Voor elk van die paren moet gelden dat
   de planner die toets kiest als die module verandert. Doet hij dat niet, dan is
   dat een misser, en missers horen nul te zijn.

   Die kruisproef heeft er drie gevonden voordat deze graaf iets mocht beslissen:

     strenge-poort.test.js  hing aan test/helper.js, en test/ telde niet mee als
                            afhankelijkheid -- terwijl 681 toetsen aan die helper
                            hangen.
     golive.test.js         bouwt het serverpad op met path.join(...) en werd
                            daardoor niet als serverstarter herkend.
     require('../routes/' + naam)   in server/opzet/routes.js: die BEGINT met een
                            quote, dus de eerste versie van de detector zag hem
                            als een gewone require. Negen routedomeinen en alles
                            daaronder -- 258 bestanden -- vielen buiten de
                            sluiting, terwijl die sluiting meldde compleet te zijn.

   Draai los: node --experimental-sqlite --test test/bewijsgraaf.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const bg = require('../scripts/lib/bewijsgraaf.js');
const { kies } = require('../scripts/plan.js');

const WORTEL = path.join(__dirname, '..');
let g;
test.before(() => { g = bg.graaf({ wortel: WORTEL }); });

test('de serversluiting is VOLLEDIG, en zegt het als hij dat niet is', () => {
  const s = bg.sluiting(path.join(WORTEL, 'server', 'server.js'));
  assert.equal(s.berekend, false,
    'er is een require die niet te volgen is en niet in BEREKEND_BEREIK staat; ' +
    'dan is de sluiting onvolledig en mag de planner niets overslaan');
  assert.ok(s.bestanden.size > 1500,
    'de serversluiting hoort de hele server te bevatten (' + s.bestanden.size + ')');
  /* De regel die 258 bestanden verstopte, met naam. */
  assert.ok([...s.bestanden].some(f => f.endsWith(path.join('routes', 'auth', 'account.js'))),
    'server/routes/auth/account.js hoort in de sluiting te zitten; hij komt binnen via ' +
    "require('../routes/' + naam) in server/opzet/routes.js");
});

test('elke niet-volgbare require is met de hand verantwoord', () => {
  const s = bg.sluiting(path.join(WORTEL, 'server', 'server.js'));
  const open = [];
  for (const f of s.bestanden) {
    const rel = path.relative(WORTEL, f).split(path.sep).join('/');
    if (bg.requiresVan(f).berekend && !bg.BEREKEND_BEREIK[rel]) open.push(rel);
  }
  assert.deepEqual(open, [],
    'deze bestanden laden iets met een berekend pad en staan niet in BEREKEND_BEREIK. ' +
    'Zolang dat zo is heeft de graaf een gat en kiest de planner te weinig.');
});

/* De domeinlijst staat in server/opzet/routes.js. Hem in BEREKEND_BEREIK
   herhalen maakt twee plekken die dezelfde waarheid vasthouden (LAT-regel 4),
   dus wordt hij hier vergeleken in plaats van geloofd. */
test('de domeinlijst in de graaf klopt met die in de bron', () => {
  const bron = fs.readFileSync(path.join(WORTEL, 'server', 'opzet', 'routes.js'), 'utf8');
  const m = bron.match(/const ALLE_DOMEINEN = \[([^\]]+)\]/);
  assert.ok(m, 'ALLE_DOMEINEN hoort in server/opzet/routes.js te staan');
  const echt = m[1].split(',').map(s => s.trim().replace(/^['"]|['"]$/g, '')).filter(Boolean).sort();
  const bekend = (bg.BEREKEND_BEREIK['server/opzet/routes.js'].bestanden || [])
    .map(p => path.basename(p, '.js')).sort();
  assert.deepEqual(bekend, echt,
    'de graaf kent andere domeinen dan de server laadt; dan mist hij routes of verzint hij er');
});

/* DE KRUISPROEF. Alles hierboven gaat over de graaf; dit gaat over het BESLUIT. */
test('de planner slaat geen enkele bewezen gevoelige toets over', () => {
  const mut = JSON.parse(fs.readFileSync(path.join(WORTEL, 'MUTATIES.json'), 'utf8')).toetsen;
  let gecontroleerd = 0;
  const missers = [];
  for (const [toets, u] of Object.entries(mut)) {
    if (u.staat !== 'gezakt') continue;
    const modules = [].concat(u.module || [], u.modules || []).filter(Boolean);
    if (!modules.length || !g.perToets.has(toets)) continue;
    gecontroleerd++;
    if (!kies(modules, g).toetsen.includes(toets)) missers.push(toets + ' <- ' + modules.join(', '));
  }
  assert.ok(gecontroleerd > 200,
    'er horen ruim tweehonderd bewezen gevoelige paren te zijn om tegen te kruisen (' + gecontroleerd + '); ' +
    'zonder die is deze toets groen om de verkeerde reden');
  assert.deepEqual(missers, [],
    'de planner zou deze toetsen overslaan terwijl de mutatiemotor heeft BEWEZEN dat ze ' +
    'op die module zakken. Dat is een groene ronde die niets betekent.');
});

test('wat onbekend is, draait altijd -- dat is de veilige stand en geen gat', () => {
  const zonderWijziging = kies([], g);
  assert.equal(zonderWijziging.toetsen.length, g.altijd.length,
    'zonder enige wijziging horen alleen de onbekende/onvolledige toetsen te draaien');
  assert.ok(g.altijd.length > 0, 'er zijn er nu nog ' + g.altijd.length + '; nul zou verdacht zijn');
  for (const naam of g.altijd) {
    assert.ok(zonderWijziging.toetsen.includes(naam), naam + ' is onbekend en hoort dus altijd te draaien');
  }
});

test('een wijziging in test/helper.js kiest de toetsen die eraan hangen', () => {
  /* De misser die de kruisproef vond: test/ telde niet mee als afhankelijkheid,
     terwijl honderden toetsen via die helper een server starten. */
  const r = kies(['test/helper.js'], g);
  assert.ok(r.toetsen.length > g.altijd.length,
    'een wijziging in de helper hoort meer te kiezen dan alleen de onbekende toetsen');
  assert.ok(r.toetsen.includes('strenge-poort.test.js'),
    'strenge-poort.test.js hangt aantoonbaar aan test/helper.js');
});

test('de planner laat ook echt iets weg -- anders bespaart hij niets', () => {
  /* Een planner die altijd alles kiest is veilig en zinloos. Deze bewering is
     de tegenhanger van de kruisproef hierboven: samen zeggen ze "niets te veel
     overgeslagen, en toch iets overgeslagen". */
  const r = kies(['public/apps/app.html'], g);
  assert.ok(r.redenen.overgeslagen > 100,
    'een wijziging in een los frontendbestand hoort honderden servertoetsen over te slaan (' +
    r.redenen.overgeslagen + ')');
  assert.ok(r.toetsen.length < g.perToets.size,
    'er hoort iets overgeslagen te worden, anders is de planner een dure manier om alles te draaien');
});
