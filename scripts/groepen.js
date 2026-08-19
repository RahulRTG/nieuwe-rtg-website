/* Schrijft GROEPEN.md: alle functies per doelgroep, afgelezen uit de bron.

   WAAROM DIT EEN SCRIPT IS EN GEEN DOCUMENT. FUNCTIES.md zegt het zelf in zijn
   eerste alinea: een met de hand bijgehouden functielijst loopt binnen een week
   uit de pas met de code. Dat geldt dubbel voor een lijst waar een PRIJS aan
   hangt -- wie op grond hiervan een pas van 20.000 euro verkoopt, hoort te weten
   dat het overzicht van vandaag is.

   Twee bronnen, en ze zijn met opzet allebei zichtbaar:

     server/functies/register/   190 functieschakelaars, elk met zijn doelgroepen
     apps/app-main (PREMIUM)     de apps die de client achter een dure pas houdt

   Die twee weten NIETS van elkaar. De server kent 190 functies met doelgroepen,
   de client kent een set van veertien app-sleutels. Wat een pas krijgt, staat dus
   op twee plekken -- en dat is precies het soort tweedeling waar LAT.md regel 4
   over gaat. Dit script legt ze naast elkaar in plaats van te doen alsof er een
   is.

   Draai: npm run groepen */
const fs = require('fs');
const path = require('path');
const WORTEL = path.join(__dirname, '..');
const R = require('../server/functies/register');
const { bundel } = require('./bundel');

const F = R.FUNCTIES;
const heeft = (f, id) => (f.doelgroepen || []).includes(id);

/* De clientkant: welke apps houdt app-main achter een dure pas? */
function premiumApps() {
  const bron = String(bundel('apps/app-main.js'))
    .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '');
  const m = bron.match(/const PREMIUM = new Set\(\[([\s\S]*?)\]\)/);
  if (!m) return [];
  return [...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1]);
}

const uit = [];
const zeg = (s) => uit.push(s === undefined ? '' : s);

zeg('# Alle functies per groep');
zeg();
zeg('Afgelezen uit `server/functies/register/` en uit de `PREMIUM`-set van');
zeg('`apps/app-main`. Niet met de hand bijgehouden: draai `npm run groepen`.');
zeg();
zeg('`WERELDEN.md` zegt WAAR iets hoort, dit zegt WIE het krijgt. De twee assen');
zeg('staan loodrecht op elkaar: een wereld is een plek, een groep is een publiek.');
zeg();

/* ------------------------------------------------------------ in getallen -- */
zeg('## In getallen');
zeg();
zeg('| groep | functies | wie dat is |');
zeg('|---|---:|---|');
for (const g of R.DOELGROEPEN) {
  zeg('| **' + g.naam + '** | ' + F.filter((f) => heeft(f, g.id)).length + ' | ' + g.uitleg + ' |');
}
zeg();
zeg('Totaal ' + F.length + ' functieschakelaars in ' + R.CATEGORIEEN.length + ' categorieën.');
zeg();

/* --------------------------------------------------- het verschil per pas -- */
const boven = F.filter((f) => !heeft(f, 'rtg') && (heeft(f, 'lifestyle') || heeft(f, 'business')));
const alleenB = boven.filter((f) => heeft(f, 'business') && !heeft(f, 'lifestyle'));
const alleenL = boven.filter((f) => heeft(f, 'lifestyle') && !heeft(f, 'business'));

zeg('## Het verschil tussen de passen');
zeg();
zeg('Dit is de vraag waar een prijskaartje aan hangt, dus hier staat hij kaal:');
zeg();
zeg('| | functies | waarvan uniek |');
zeg('|---|---:|---:|');
zeg('| RTG Pass | ' + F.filter((f) => heeft(f, 'rtg')).length + ' | . |');
zeg('| Lifestyle Pass | ' + F.filter((f) => heeft(f, 'lifestyle')).length + ' | ' + alleenL.length + ' |');
zeg('| Business Pass | ' + F.filter((f) => heeft(f, 'business')).length + ' | ' + alleenB.length + ' |');
zeg('| Gratis app | ' + F.filter((f) => heeft(f, 'gast')).length + ' | . |');
zeg();
zeg('**Wat er boven de RTG Pass uit komt, de hele lijst:**');
zeg();
for (const f of boven) {
  const wie = ['lifestyle', 'business'].filter((x) => heeft(f, x))
    .map((x) => x === 'lifestyle' ? 'Lifestyle' : 'Business').join(' + ');
  zeg('- **' + f.naam + '** -- ' + wie);
  zeg('  <br>' + f.uitleg.split('.')[0] + '.');
}
zeg();

/* ----------------------------------------------------- de tweede lijst -- */
const pa = premiumApps();
zeg('## En de tweede lijst, die de eerste niet kent');
zeg();
zeg('De client houdt daarnaast ' + pa.length + ' APPS achter een dure pas');
zeg('(`PREMIUM` in `apps/app-main`, `premiumPas = lifestyle || business`):');
zeg();
zeg(pa.map((x) => '`' + x + '`').join(' · '));
zeg();
zeg('Die set staat los van het functieregister hierboven en kent geen onderscheid');
zeg('tussen Lifestyle en Business. Wat een pas krijgt, staat dus op twee plekken');
zeg('met verschillende inhoud en verschillende korrel -- server op functie,');
zeg('client op app. Zie de opmerking bovenaan `scripts/groepen.js`.');
zeg();

/* --------------------------------------------------------- per groep -- */
const VOLGORDE = ['gast', 'rtg', 'lifestyle', 'business', 'personeel', 'leverancier', 'foundation', 'intern'];
for (const id of VOLGORDE) {
  const g = R.DOELGROEP_OP_ID[id];
  const lijst = F.filter((f) => heeft(f, id));
  zeg('---');
  zeg();
  zeg('## ' + g.naam + ' -- ' + lijst.length + ' functies');
  zeg();
  zeg('*' + g.uitleg + '*');
  zeg();
  const perCat = new Map();
  for (const f of lijst) {
    if (!perCat.has(f.categorie)) perCat.set(f.categorie, []);
    perCat.get(f.categorie).push(f);
  }
  for (const [cat, fs] of perCat) {
    zeg('### ' + cat);
    zeg();
    for (const f of fs) zeg('- **' + f.naam + '** -- ' + f.uitleg.split('. ')[0].replace(/\.$/, '') + '.');
    zeg();
  }
}

const pad = path.join(WORTEL, 'GROEPEN.md');
fs.writeFileSync(pad, uit.join('\n').replace(/\n{3,}/g, '\n\n') + '\n');
console.log('GROEPEN.md geschreven: ' + F.length + ' functies over ' + R.DOELGROEPEN.length + ' groepen');
console.log('  RTG ' + F.filter((f) => heeft(f, 'rtg')).length +
  ' | Lifestyle ' + F.filter((f) => heeft(f, 'lifestyle')).length +
  ' | Business ' + F.filter((f) => heeft(f, 'business')).length +
  ' | Gratis ' + F.filter((f) => heeft(f, 'gast')).length);
console.log('  boven de RTG Pass: ' + boven.length + ' functies');
