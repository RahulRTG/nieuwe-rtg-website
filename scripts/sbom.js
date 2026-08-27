#!/usr/bin/env node
/* ============================================================================
   DE MATERIAALLIJST -- waar bestaat een RTG-release uit?

   WAAROM DIT ER IS. BEWIJSMACHINE.md stelt vast dat dit huis geen
   release-provenance heeft: geen SBOM, geen build-attestatie, geen SLSA. Dat is
   het eerste wat een inkoper vraagt, en het antwoord "vertrouw ons maar" telt
   daar niet.

   WAT DEZE LIJST ANDERS MAAKT DAN DE GEMIDDELDE SBOM. Bij de meeste projecten
   is een SBOM een lijst van honderden npm-pakketten. Hier niet: dit project
   heeft NUL productie-afhankelijkheden, en dat is geen toeval maar een grens
   die de norm bewaakt (`dependencies: 0` in NORM.json). Een lijst die alleen
   npm telt, zou hier dus bijna leeg zijn en daarmee een verkeerd beeld geven --
   alsof er niets van buiten in zit.

   Er zit wel iets van buiten in, en dat zijn de BASIS-IMAGES en de TOOLCHAINS:
   node, rust, postgres. Die dragen een besturingssysteem met bibliotheken, en
   dat is de werkelijke derdenlaag van deze release. Ze staan daarom als
   eersteklas onderdelen in deze lijst en niet in een voetnoot.

   EN DE EIGEN CODE STAAT EROP MET EEN AFDRUK. Dat is het stuk dat de vraag "is
   wat er draait ook wat er is gebouwd" beantwoordbaar maakt: een som over alle
   bestanden die meegaan in het image, in een vaste volgorde, zodat twee
   machines er hetzelfde uit krijgen.

   WAT DEZE LIJST NIET BEWEERT. Hij zegt niet dat de inhoud veilig is, en niet
   dat de basis-images geen kwetsbaarheden hebben -- daar is een scanner voor en
   die draait hier niet. Hij zegt WAT erin zit. Dat is minder dan een keurmerk
   en het is precies wat een SBOM hoort te zijn.

   Draai:  node scripts/sbom.js              (schrijft SBOM.json)
           node scripts/sbom.js --toon       (alleen tonen)
   ========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

const WORTEL = path.join(__dirname, '..');
const UIT = path.join(WORTEL, 'SBOM.json');

/* ---- de eigen code: welke bestanden gaan er mee, en wat is hun afdruk ----
   De lijst komt uit git en niet uit een mapwandeling: git weet precies wat er
   in de release zit en wat er genegeerd wordt (server/data/, .env, node_modules).
   Een eigen wandeling zou daar vroeg of laat van afwijken. */
function eigenBestanden() {
  const uit = execFileSync('git', ['ls-files', '-z'], { cwd: WORTEL, maxBuffer: 64 * 1024 * 1024 });
  return uit.toString('utf8').split('\0').filter(Boolean).sort();
}

/* De afdruk over de eigen code. Per bestand pad EN inhoud, want een verplaatst
   bestand is een andere release ook als de bytes gelijk zijn. In vaste volgorde,
   zodat twee machines hetzelfde antwoord geven. */
function afdrukVan(bestanden, basis) {
  const wortel = basis || WORTEL;
  const h = crypto.createHash('sha256');
  let bytes = 0;
  for (const b of bestanden) {
    const p = path.join(wortel, b);
    let inhoud;
    try { inhoud = fs.readFileSync(p); } catch (e) { continue; }   // symlink of net weg
    bytes += inhoud.length;
    h.update(b, 'utf8');
    h.update(crypto.createHash('sha256').update(inhoud).digest());
  }
  return { afdruk: 'sha256:' + h.digest('hex'), bestanden: bestanden.length, bytes };
}

/* ---- wat er van buiten komt ---- */
function npmOnderdelen() {
  let lock = {};
  try { lock = JSON.parse(fs.readFileSync(path.join(WORTEL, 'package-lock.json'), 'utf8')); } catch (e) { return []; }
  const pk = lock.packages || {};
  return Object.entries(pk).filter(([naam]) => naam.startsWith('node_modules/')).map(([naam, v]) => ({
    soort: 'library', ecosysteem: 'npm',
    naam: naam.slice('node_modules/'.length), versie: v.version || null,
    licentie: v.license || null, integriteit: v.integrity || null,
    /* devDependencies gaan NIET mee in het productie-image (de Dockerfile
       installeert met --omit=dev). Dat staat erbij, want een SBOM die
       bouwgereedschap en runtime door elkaar haalt, laat een inkoper naar
       kwetsbaarheden kijken die nergens draaien. */
    inRelease: !v.dev
  }));
}

function cargoOnderdelen() {
  let tekst = '';
  try { tekst = fs.readFileSync(path.join(WORTEL, 'motor', 'Cargo.lock'), 'utf8'); } catch (e) { return []; }
  const uit = [];
  for (const blok of tekst.split('[[package]]').slice(1)) {
    const naam = (/^\s*name\s*=\s*"([^"]+)"/m.exec(blok) || [])[1];
    const versie = (/^\s*version\s*=\s*"([^"]+)"/m.exec(blok) || [])[1];
    const som = (/^\s*checksum\s*=\s*"([^"]+)"/m.exec(blok) || [])[1] || null;
    if (naam) uit.push({ soort: 'library', ecosysteem: 'cargo', naam, versie: versie || null,
      licentie: null, integriteit: som ? 'sha256:' + som : null, inRelease: true });
  }
  return uit;
}

/* WAT ER WERKELIJK IS GETROKKEN. Een tag is geen afdruk: `node:22-slim` van
   vandaag is niet die van vorige maand. Pinnen op een digest is een besluit met
   onderhoud eraan (elke patch wordt een commit), en dat besluit hoort niet in
   een script te sluipen.

   Wat hier WEL gebeurt: de pijplijn schrijft de digests die hij op dat moment
   heeft opgehaald in BASISIMAGES.json, en die worden hier meegenomen. Daarmee is
   van elke release na te gaan uit welke basis-images hij is gebouwd -- ook
   zonder te pinnen. Pinnen wordt dan een besluit met gegevens eronder in plaats
   van een gok. Ontbreekt het bestand, dan staat er bij elk image dat het op een
   tag staat; dat is de eerlijke stand en geen fout. */
function getrokkenDigests() {
  try { return JSON.parse(fs.readFileSync(path.join(WORTEL, 'BASISIMAGES.json'), 'utf8')).images || {}; }
  catch (e) { return {}; }
}

/* De basis-images: de werkelijke derdenlaag van deze release. Uit de Dockerfile
   zelf gelezen, zodat de lijst niet los van de bouw kan gaan lopen. */
function basisImages() {
  const digests = getrokkenDigests();
  let df = '';
  try { df = fs.readFileSync(path.join(WORTEL, 'Dockerfile'), 'utf8'); } catch (e) { return []; }
  const uit = [];
  for (const m of df.matchAll(/^FROM\s+(\S+)(?:\s+AS\s+(\S+))?/gmi)) {
    const ref = m[1];
    if (/^scratch$/i.test(ref) || !ref.includes(':')) continue;
    const i = ref.lastIndexOf(':');
    const digest = digests[ref] || null;
    uit.push({ soort: 'container', ecosysteem: 'oci', naam: ref.slice(0, i), versie: ref.slice(i + 1),
      licentie: null, integriteit: digest, fase: m[2] || 'runtime', inRelease: true,
      let: digest
        ? 'Op een tag gebouwd; dit is de digest die de pijplijn toen werkelijk trok.'
        : 'Vastgezet op een tag, niet op een digest, en er is geen digest opgeschreven.' });
  }
  return uit;
}

function bouw() {
  const bestanden = eigenBestanden();
  const eigen = afdrukVan(bestanden);
  let commit = null, schoon = null;
  try { commit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: WORTEL }).toString().trim(); } catch (e) {}
  try { schoon = execFileSync('git', ['status', '--porcelain'], { cwd: WORTEL }).toString().trim() === ''; } catch (e) {}
  const onderdelen = [].concat(basisImages(), npmOnderdelen(), cargoOnderdelen());
  return {
    uitleg: 'Waar een RTG-release uit bestaat. Gegenereerd met node scripts/sbom.js; bewerk dit bestand niet met de hand. ' +
      'Dit zegt WAT erin zit, niet dat het veilig is -- daar is een scanner voor, en die draait hier niet.',
    formaat: 'rtg-sbom/1',
    product: { naam: 'rtg-website', bron: 'git', commit, werkboomSchoon: schoon },
    eigenCode: eigen,
    telling: {
      onderdelen: onderdelen.length,
      inRelease: onderdelen.filter(o => o.inRelease).length,
      alleenBouw: onderdelen.filter(o => !o.inRelease).length,
      npmInRelease: onderdelen.filter(o => o.ecosysteem === 'npm' && o.inRelease).length,
      imagesMetDigest: onderdelen.filter(o => o.ecosysteem === 'oci' && o.integriteit).length
    },
    onderdelen
  };
}

if (require.main === module) {
  const s = bouw();
  if (process.argv.includes('--toon')) { console.log(JSON.stringify(s, null, 2)); process.exit(0); }
  fs.writeFileSync(UIT, JSON.stringify(s, null, 2) + '\n');
  console.log('SBOM.json geschreven: ' + s.telling.onderdelen + ' onderdelen (' + s.telling.inRelease + ' in de release, ' +
    s.telling.alleenBouw + ' alleen voor de bouw), ' + s.eigenCode.bestanden + ' eigen bestanden, afdruk ' +
    s.eigenCode.afdruk.slice(0, 23) + '...');
}

module.exports = { bouw, afdrukVan, eigenBestanden };
