/* DE LOS-PROEF -- en of zijn afleiding werkelijk een app ISOLEERT.

   scripts/losproef.js beantwoordt de vraag uit het eigenaarsbesluit van 19
   oktober 2026: werkt een app LOS, met alleen zijn eigen functies aan? Het
   oordeel per app komt uit een gedraaid voltooiscenario (de runner start een
   server en zet de boardroom-stand; dat hoort niet in een toetssuite, net zomin
   als bij de tredeproef). Wat hier staat is de PURE afleiding eronder.

   DE EERSTE RONDE ZAKTE OP PRECIES HET PUNT DAT DEZE TOETS NU BEWAAKT: de bodem
   werd per CATEGORIE aangehouden in plaats van per id. Trede 0 raakt zeven
   categorieen -- ook Partners (via supplier-salon) en Eigen apps (via
   experience-platform). Hield je die categorieen heel aan, dan stond de halve
   lanceerbare stad weer aan en mat de proef niets: elke app heette dan LOS. De
   snede moet dus per id. Test 3 is die meting; hij was rood tegen de eerste
   implementatie.

   Draai los: node --test test/losproef.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const P = require('../scripts/losproef');
const { FASES, FUNCTIES, OP_ID } = require('../server/functies/register');

const catVanId = new Map(FUNCTIES.map((f) => [f.id, f.categorie || null]));

test('1. routesUit leest alleen letterlijke /api-paden, zonder params of sluitende slash', () => {
  const bron = `
    const A = '/api/wallet/munt/koop';
    const B = "/api/office/kantoorpakket/open";
    fetch('/api/member/find/' );        // sluitende slash valt weg
    app.post('/api/pay/:id/tik', ...);   // param valt weg
    // een los woord api/zonderslash hoort er NIET bij
  `;
  const r = P.routesUit(bron);
  assert.ok(r.includes('/api/wallet/munt/koop'));
  assert.ok(r.includes('/api/office/kantoorpakket/open'));
  assert.ok(r.includes('/api/member/find'), 'de sluitende slash is eraf');
  assert.ok(r.includes('/api/pay'), 'de param is eraf, de stam blijft');
  assert.ok(!r.some((x) => x.includes(':')), 'geen enkele route draagt nog een param');
  assert.ok(!r.includes('api/zonderslash'), 'alleen een pad dat met /api begint telt mee');
});

test('2. primaireCategorie kiest de categorie van de VAAKST geraakte functie', () => {
  /* Echte register-eigendom: /api/office/kantoorpakket valt onder de functie
     `office` (die /api/office bezit), niet onder de lid-drive `kantoorpakket`
     (/api/kantoorpakket). Wie dat omdraait, meet de verkeerde app. */
  const office = P.primaireCategorie(['/api/office/kantoorpakket/maak', '/api/office/kantoorpakket/open', '/api/office/kantoorpakket/bewaar']);
  assert.equal(office, 'RTG-Backoffice');
  const geld = P.primaireCategorie(['/api/wallet', '/api/wallet/munt/koop', '/api/pay/overzicht']);
  assert.equal(geld, 'Geld');
  assert.equal(P.primaireCategorie(['/api/health', '/api/iets-zonder-schakelaar']), null,
    'geen enkele geschakelde route -> de app draait volledig op de bodem');
});

test('3. de bodem wordt per ID aangehouden, NIET per categorie (de snede die de meting draagt)', () => {
  /* Een scenario met de Geld-app als primair. supplier-salon zit in trede 0 en
     draagt de categorie Partners; experience-platform zit in trede 0 en draagt
     Eigen apps. De afleiding MOET die twee categorieen uitzetten en alleen de
     twee bodem-IDS aanhouden -- anders stond een hele andere app weer aan. */
  const afl = P.losAfleiding({ scenarioBron: "x('/api/wallet'); y('/api/wallet/munt/koop');", ruggengraatBron: '' });
  assert.equal(afl.primair, 'Geld');

  assert.ok(afl.uitCats.includes('Partners (leveranciers)'),
    'Partners staat UIT, ook al zit supplier-salon in trede 0');
  assert.ok(afl.uitCats.includes('Eigen apps'),
    'Eigen apps staat UIT, ook al zit experience-platform in trede 0');
  assert.ok(!afl.uitCats.includes('Geld'), 'de eigen categorie staat niet uit');

  assert.ok(afl.aanIds.has('experience-platform'), 'een echt platform-bodem-id (trede 0, geen lanceervloer) blijft aan');
  /* De LANCEERVLOER (salon, supplier-salon) is GEEN platform: De Salon is een
     app en gaat uit tenzij ze zelf getest wordt. Zij staat wel in trede 0, dus
     dit toetst dat de proef de lanceervloer eruit snijdt. */
  assert.ok(!afl.aanIds.has('salon'), 'De Salon is een app, geen platform: niet auto-aan');
  assert.ok(!afl.aanIds.has('supplier-salon'), 'de partnerkant van De Salon ook niet');
  const partnerIds = FUNCTIES.filter((f) => f.categorie === 'Partners (leveranciers)').map((f) => f.id);
  const nietBodem = partnerIds.filter((id) => !new Set(FASES[0].aan).has(id));
  assert.ok(nietBodem.length >= 1, 'Partners heeft functies BUITEN trede 0 (anders meet deze toets niets)');
  for (const id of nietBodem) assert.ok(!afl.aanIds.has(id),
    'een Partners-functie buiten trede 0 blijft UIT: ' + id + ' -- anders is de snede per categorie en meet de proef niets');
});

test('4. de ruggengraat uit de wereldhelpers komt per id terug, niet per categorie', () => {
  /* De onboarding-ruggengraat (een geverifieerd, verbonden lid met een gebonden
     toestel) is de eerlijke lege toestand die ELKE app deelt. Hij komt per id
     terug, afgeleid uit de letterlijke routes van voltooiwereld.js -- niet uit
     een nieuwe handlijst. */
  const rug = "p('/api/office/verify'); p('/api/member/connect'); p('/api/mijn/toestel/bind');";
  const afl = P.losAfleiding({ scenarioBron: "x('/api/wallet');", ruggengraatBron: rug });
  const verifyId = P.idVanRoute('/api/office/verify');
  const connectId = P.idVanRoute('/api/member/connect');
  if (verifyId) assert.ok(afl.aanIds.has(verifyId), 'de keuringsroute van het kantoor hoort tot de ruggengraat');
  if (connectId) assert.ok(afl.aanIds.has(connectId), 'de connectie-route hoort tot de ruggengraat');
  /* En die ruggengraat zet geen categorie heel aan: een scenario zonder
     ruggengraat heeft dezelfde uit-categorieen als eentje met. */
  const kaal = P.losAfleiding({ scenarioBron: "x('/api/wallet');", ruggengraatBron: '' });
  assert.deepEqual(afl.uitCats, kaal.uitCats, 'de ruggengraat verandert niet WELKE categorieen uit staan');
});

test('5. andereCats noemt de leun-kandidaten: wat het scenario raakt en nu uit staat', () => {
  /* De eigen route als constante (zo leidt de proef EIGEN af als er geen
     contract is), de vreemde route alleen aangeroepen -> die laatste is de
     leun-kandidaat, niet de eigen categorie. */
  const afl = P.losAfleiding({ scenarioBron: "const MAAK = '/api/office/kantoorpakket/maak';\nb('/api/supplier/roster');", ruggengraatBron: '' });
  assert.equal(afl.primair, 'RTG-Backoffice');
  assert.ok(afl.andereCats.includes('Partners (leveranciers)'),
    'de supplier-route zit niet in de eigenclausule en hoort bij de kandidaten');
  assert.ok(!afl.andereCats.includes('RTG-Backoffice'), 'de eigen categorie is geen leun-kandidaat');
});

test('6. het oordeel loopt niet door elkaar: AFGEBROKEN voor, kern-leun LEUNT, isolatie LOS-KERN', () => {
  assert.equal(P.oordeel({ afgebroken: null, open: [] }), 'LOS');
  assert.equal(P.oordeel({ afgebroken: null, open: [{ nr: 1 }] }), 'LEUNT',
    'een open stap zonder isolatie-vlag is een echte kern-leun');
  assert.equal(P.oordeel({ afgebroken: 'de opbouw viel om', open: [] }), 'AFGEBROKEN',
    'valt de opbouw om, dan is er niets gemeten -- dat is geen LOS');
  assert.equal(P.oordeel({ afgebroken: 'kapot', open: [{ nr: 1 }] }), 'AFGEBROKEN',
    'afgebroken gaat voor een open stap');
  /* De verfijning van de eigenaar voor Office: enkel isolatie-stappen open ->
     kern LOS, isolatiebewijs vraagt SAMEN. */
  assert.equal(P.oordeel({ afgebroken: null, open: [{ nr: 1, isolatie: true }] }), 'LOS-KERN');
  assert.equal(P.oordeel({ afgebroken: null, open: [{ nr: 1, isolatie: true }, { nr: 2, isolatie: false }] }), 'LEUNT',
    'EEN echte kern-leun ertussen maakt het weer LEUNT');
});

test('8. de platformlaag blijft AAN, maar is niet "alles": Toegang heel aan, RTG-Backoffice niet', () => {
  /* Aanscherping eigenaar 19 oktober 2026: LOS is geen kunstmatige isolatie.
     Identiteit/sessie (Toegang en identiteit) is platform en blijft heel aan.
     Maar RTG-Backoffice is GEMENGD -- command-* is control-plane, `office` is de
     backoffice-APP -- dus die categorie mag NIET als platform heel aanstaan,
     anders is de Office-app triviaal LOS. */
  const walletAfl = P.losAfleiding({ scenarioBron: "x('/api/wallet');", ruggengraatBron: '' });
  assert.ok(!walletAfl.uitCats.includes('Toegang en identiteit'), 'identiteit/sessie is platform en blijft aan');
  assert.ok(walletAfl.aanCats.includes('Toegang en identiteit'));
  assert.ok(walletAfl.uitCats.includes('RTG-Backoffice'),
    'de backoffice-app staat uit als een ANDERE app getest wordt (geen gratis platform-status)');
  assert.ok(walletAfl.uitCats.includes('Geld') === false || walletAfl.primair === 'Geld',
    'de geld-APP is app-domein, niet platform');
  /* De platformlijst is bewust kort: precies een categorie (Toegang), de rest
     per id of ongated infra. Een categorie erbij is een besluit, geen reflex. */
  assert.deepEqual(P.PLATFORM_CATS, ['Toegang en identiteit']);
});

test('9. tegen de eigen app staat de eigen categorie aan, ook als die normaal uit zou staan', () => {
  /* Office: primair RTG-Backoffice. Dan hoort RTG-Backoffice AAN (eigen
     categorie), niet uit. Zo meet de proef de app en niet een lege kamer. */
  const officeAfl = P.losAfleiding({ scenarioBron: "a('/api/office/kantoorpakket/maak'); b('/api/office/kantoorpakket/open');", ruggengraatBron: '' });
  assert.equal(officeAfl.primair, 'RTG-Backoffice');
  assert.ok(officeAfl.aanCats.includes('RTG-Backoffice'));
  assert.ok(!officeAfl.uitCats.includes('RTG-Backoffice'));
});

test('10. EIGEN komt uit de routes die de ingang zelf aanroept, niet uit de gedeelde setup', () => {
  /* DE ARTEFACTEN DIE DIT VASTHOUDT (sweep 19 oktober 2026). De vorige afleiding
     koos de VAAKST geraakte categorie van ALLE scenario-routes; de gedeelde
     setup (inloggen, member-schil, een andere app vullen) overstemde dan de
     weinige bepalende eigen routes. Balans telde zo als "Diensten" (de agenda-
     vul-setup) in plaats van "Geld" (zijn eigen /api/balans), en meldde een
     valse zelf-leun. EIGEN komt nu uit het appcontract: de routes die de ingang
     zELf aanroept, zonder de "met ..."-setup. */
  const balans = P.eigenRoutes('link:balans', '');
  assert.ok(balans && balans.includes('/api/balans'), 'balans noemt zijn eigen route uit het contract');
  assert.ok(!balans.some((r) => r.startsWith('/api/agenda')), 'de agenda-vul-setup ("met ...") hoort NIET bij eigen');

  /* En de afleiding kiest dan Geld, niet Diensten -- met de echte balans-bron. */
  const fs = require('fs'); const path = require('path');
  const bron = fs.readFileSync(path.join(P.WORTEL, 'scripts', 'lib', 'voltooi', 'balans.js'), 'utf8');
  const afl = P.losAfleiding({ scenarioBron: bron, ruggengraatBron: '', functieLink: 'link:balans' });
  assert.equal(afl.primair, 'Geld', 'balans is een Geld-app; de agenda-setup bepaalt zijn categorie niet');
  assert.ok(afl.uitCats.includes('Diensten (leden)'), 'de agenda (Diensten) staat uit -> de leun op de Agenda is nu een ECHTE bevinding');

  /* Zonder contract valt EIGEN terug op de module-constanten van het scenario. */
  const viaConst = P.eigenRoutes('link:bestaat-niet', "const A = '/api/wallet/munt/koop';\nconst B = \"/api/pay/overzicht\";");
  assert.deepEqual(viaConst, ['/api/wallet/munt/koop', '/api/pay/overzicht']);
  assert.equal(P.eigenRoutes('link:bestaat-niet', 'geen const hier'), null, 'niets te vinden -> null (aanroeper valt terug op alle routes)');
});

test('7. de kern noemt vijf bestaande scenario-bestanden, en trede 0 bestaat', () => {
  assert.equal(P.KERN.length, 5);
  const fs = require('fs'); const path = require('path');
  for (const app of P.KERN) assert.ok(fs.existsSync(path.join(P.WORTEL, 'scripts', 'lib', 'voltooi', app + '.js')),
    'elke kern-app heeft een voltooiscenario: ' + app);
  const start = FASES[0];
  assert.ok(start && Array.isArray(start.aan) && start.aan.length, 'trede 0 bestaat en noemt functies');
  for (const id of start.aan) assert.ok(OP_ID[id], 'trede 0 noemt een bestaande functie: ' + id);
  /* en trede 0 spreidt echt over meer dan een categorie -- de reden dat test 3
     bestaat. */
  const cats = new Set(start.aan.map((id) => catVanId.get(id)).filter(Boolean));
  assert.ok(cats.size >= 3, 'trede 0 raakt meerdere categorieen (' + cats.size + '), dus de per-id-snede is nodig');
});
