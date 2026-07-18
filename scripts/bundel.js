/* Bundelt de opgeknipte app-scripts weer samen.

   De grote app-scripts (leverancier.js, app-main.js, personeel.js,
   backoffice.js, techniek.js) zijn te groot om prettig in een bestand te
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
  'apps/leverancier.js': 'apps/leverancier',
  'apps/app-main.js': 'apps/app-main',
  'apps/personeel.js': 'apps/personeel',
  'apps/backoffice.js': 'apps/backoffice',
  'apps/techniek.js': 'apps/techniek',
  'apps/foundation/gezin-rt.js': 'apps/foundation/gezin-rt',
  'apps/foundation/sessie.js': 'apps/foundation/sessie',
  'shared/i18n.js': 'shared/i18n',
  'shared/borden.js': 'shared/borden',
  'shared/werkos.js': 'shared/werkos',
  'shared/verbinding.js': 'shared/verbinding',
  'shared/osmenu.js': 'shared/osmenu',
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
function controleer() {
  for (const uit of Object.keys(bundels)) {
    const inhoud = bundel(uit);
    const doel = path.join(PUB, uit);
    const oud = fs.readFileSync(doel);
    if (!oud.equals(inhoud)) {
      throw new Error(uit + ' wijkt af van de losse delen in ' + bundels[uit] + '/. Draai `npm run build` en bewerk de delen, niet de bundel.');
    }
  }
}

module.exports = { bundels, bundel, schrijfBundels, controleer };

// Direct aanroepbaar: node scripts/bundel.js  -> schrijf de bundels.
if (require.main === module) {
  const g = schrijfBundels();
  console.log('[bundel] ' + (g.length ? 'bijgewerkt: ' + g.join(', ') : 'niets te doen (bundels al actueel)'));
}
