/* Bundelt de opgeknipte app-scripts weer samen.

   De grote app-scripts (leverancier.js, app-main.js, personeel.js,
   backoffice.js, techniek.js, meldkamer.js) zijn te groot om prettig in een bestand te
   bewerken, maar delen intern een gesloten scope:
   je kunt ze niet zomaar in losse modules hakken zonder alles te herschrijven.
   Daarom bewaren we de bron opgeknipt per onderdeel in public/apps/<naam>/,
   en plakken die delen bij de build weer aaneen tot exact hetzelfde bestand.
   De uitvoer is byte-voor-byte gelijk aan de som van de delen: geen enkele
   gedragsverandering, alleen een prettiger te onderhouden bron.

   Gebruik:
     const { bundels, bundel, schrijfBundels, controleer } = require('./bundel');
   - bundel(naam)         -> de samengevoegde inhoud als string
   - schrijfBundels()     -> schrijft elke bundel naar public/apps/<naam>.js
   - controleer()         -> gooit als een bundel afwijkt van de losse delen
*/
const fs = require('fs');
const path = require('path');

const PUB = path.join(__dirname, '..', 'public');

// Welke bundels bestaan er, en waar staan hun delen. De delen worden op naam
// gesorteerd samengevoegd (vandaar de NN- prefix), en rauw aaneengeplakt zodat
// het resultaat exact de oorspronkelijke bron is.
const bundels = {
  'apps/boardroom.js': 'apps/boardroom',
  'apps/foundation/samen.js': 'apps/foundation/samen',
  'apps/rtg-protect.js': 'apps/rtg-protect',
  'apps/werkplek-bureaus.js': 'apps/werkplek-bureaus',
  'apps/defensie.js': 'apps/defensie',
  'apps/office/blad.js': 'apps/office/blad',
  'apps/office/app.js': 'apps/office/app',
  'shared/handenvrij-scherm.js': 'shared/handenvrij-scherm',
  'shared/mond.js': 'shared/mond',
  'shared/rahulpoort.js': 'shared/rahulpoort',
  'shared/geluid.js': 'shared/geluid',
  'shared/clipdeler.js': 'shared/clipdeler',
  'shared/rtg-schil.js': 'shared/rtg-schil',
  'shared/handenvrij-bureau.js': 'shared/handenvrij-bureau',
  'shared/handenvrij-balk.js': 'shared/handenvrij-balk',
  'shared/sterren.js': 'shared/sterren',
  'shared/drie.js': 'shared/drie',
  'shared/levendekleur.js': 'shared/levendekleur',
  'shared/bediening.js': 'shared/bediening',
  'shared/klok3d.js': 'shared/klok3d',
  'shared/glyf.js': 'shared/glyf',
  'shared/qr.js': 'shared/qr',
  'shared/klok.js': 'shared/klok',
  // de levende wereld: de kring, het draaien, het inzoomen, het Command Wheel,
  // de ring van Rahul en de levende grond -- zes delen in EEN IIFE
  'shared/wereld.js': 'shared/wereld',
  'shared/metgezel.js': 'shared/metgezel',
  // het app-menu: stijl, tekens, de eigen functies van een app, de vaste
  // functies, het blad en de knop -- zes onderdelen achter elkaar in een IIFE
  'shared/appmenu.js': 'shared/appmenu',
  'shared/rtghorloge.js': 'shared/rtghorloge',
  'apps/residentie.js': 'apps/residentie',
  'apps/leverancier.js': 'apps/leverancier',
  'apps/app-main.js': 'apps/app-main',
  'apps/personeel.js': 'apps/personeel',
  'apps/backoffice.js': 'apps/backoffice',
  // RTG Command: de schil, de elf werkplekken en de gedeelde staat -- zeven
  // delen omdat elke werkplek zijn eigen tekenaar heeft en die niet in elkaars
  // bestand horen te wonen
  'apps/command.js': 'apps/command',
  // De Regie van de zaak: één scherm dat zowel in de zaak-app als in de
  // personeels-PDA hangt. Drie delen: de vorm, de werkplekken Nu/Lijst, en de
  // rest (zoeken, dossier, rechtzetten, regels).
  'shared/zaakcommand.js': 'shared/zaakcommand',
  // De bureau-PDA: één werking voor de drie ontwerpbureaus (studio, hardware,
  // architect). Deel 1 is de tabel met wat per bureau verschilt, deel 2 de
  // werking die daarvoor drie keer bestond en uit elkaar liep.
  'shared/bureaupda.js': 'shared/bureaupda',
  'apps/techniek.js': 'apps/techniek',
  'apps/meldkamer.js': 'apps/meldkamer',
  'apps/foundation/gezin-rt.js': 'apps/foundation/gezin-rt',
  'apps/foundation/sessie.js': 'apps/foundation/sessie',
  'shared/basis.js': 'shared/basis',
  'shared/ios.js': 'shared/ios',
  'shared/deelmenu.js': 'shared/deelmenu',
  // uitvoer.js draagt twee onderwerpen (de gegevens en de bediening) en kwam
  // daarmee over de 10 KB-lat; opgeknipt precies langs die grens
  'shared/uitvoer.js': 'shared/uitvoer',
  'apps/notities/app.js': 'apps/notities/app',
  'apps/rtgschool/leer.js': 'apps/rtgschool/leer',
  'apps/schoolpartner/app.js': 'apps/schoolpartner/app',
  'shared/i18n.js': 'shared/i18n',
  'shared/borden.js': 'shared/borden',
  'shared/werkos.js': 'shared/werkos',
  'shared/verbinding.js': 'shared/verbinding',
  'shared/teamcall.js': 'shared/teamcall'
};

function deelBestanden(deelMap) {
  const dir = path.join(PUB, deelMap);
  return fs.readdirSync(dir).filter((n) => n.endsWith('.js')).sort()
    .map((n) => path.join(dir, n));
}

function bundel(uitvoer) {
  const delen = deelBestanden(bundels[uitvoer]);
  return Buffer.concat(delen.map((f) => fs.readFileSync(f)));
}

/* Eén definitie voor de parserveiligheid die de zware-bundeltoets bewaakt. */
function blokkeertHtmlParser(tag) {
  return /\b(?:defer|async)\b/i.test(String(tag || '')) === false;
}

function schrijfBundels() {
  const geschreven = [];
  for (const uit of Object.keys(bundels)) {
    const inhoud = bundel(uit);
    const doel = path.join(PUB, uit);
    let oud = null; try { oud = fs.readFileSync(doel); } catch (e) {}
    if (!oud || !oud.equals(inhoud)) { fs.writeFileSync(doel, inhoud); geschreven.push(uit); }
  }
  return geschreven;
}

// Faalt als een uitgecheckte bundel niet gelijk is aan de som van zijn delen.
// Alle afwijkingen in een keer: wie bij de eerste stopt, meldt "1 probleem"
// terwijl er vier zijn, en dat getal wordt overgeschreven als feit.
function controleer() {
  const scheef = [];
  for (const uit of Object.keys(bundels)) {
    const inhoud = bundel(uit);
    const doel = path.join(PUB, uit);
    const oud = fs.readFileSync(doel);
    if (!oud.equals(inhoud)) scheef.push(uit + ' (bundel ' + oud.length + ', delen ' + inhoud.length + ' bytes)');
  }
  if (scheef.length) {
    /* De melding zei hier alleen "draai `npm run build`", en dat is precies de
       handeling die de nieuwste inhoud weggooit wanneer de BUNDEL de nieuwe
       kant is (iemand bewerkte de bundel in plaats van de delen). Zo verdween
       hier het lege beginscherm en het app-menu. Kijk dus eerst welke kant de
       nieuwe is; pas dan bouwen. */
    throw new Error(scheef.length + ' bundel(s) wijken af van hun losse delen: ' +
      scheef.join(', ') +
      '. KIJK EERST welke kant de nieuwe is (`git diff -- <bundel>`): `npm run build` OVERSCHRIJFT de bundel met de delen, ' +
      'dus een wijziging die alleen in de bundel staat is daarna weg. Zet hem eerst in de delen; die zijn de bron.');
  }
}

module.exports = { bundels, bundel, blokkeertHtmlParser, schrijfBundels, controleer };

// Direct aanroepbaar: node scripts/bundel.js  -> schrijf de bundels.
if (require.main === module) {
  const g = schrijfBundels();
  console.log('[bundel] ' + (g.length ? 'bijgewerkt: ' + g.join(', ') : 'niets te doen (bundels al actueel)'));
}
