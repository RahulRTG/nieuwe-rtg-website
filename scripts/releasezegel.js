#!/usr/bin/env node
/* ============================================================================
   HET RELEASEZEGEL -- een ondertekende verklaring over wat er is uitgebracht.

   SBOM.md noemde als ontbrekend: "geen handtekening; de provenance komt van
   onze eigen builder, dus een buitenstaander moet ons vertrouwen." Dat is nu
   een BESLUIT geworden in plaats van een gat: er wordt ondertekend met een
   EIGEN sleutel.

   WAT DAT WEL EN NIET WAARD IS, en dit hoort vooraan te staan omdat het de kern
   van de keuze is. Een handtekening met onze eigen sleutel bewijst dat deze
   verklaring is afgegeven door iemand die die sleutel houdt. Hij bewijst NIET
   dat GitHub dit heeft gebouwd, en niet dat wij te vertrouwen zijn. De
   vertrouwensbron blijft RTG. Wie meer wil -- een keyless handtekening op naam
   van de bouwer, controleerbaar zonder ons -- heeft sigstore nodig, en dat is
   een andere keuze met een derde partij erin.

   WAT HET WEL OPLOST, en dat is niet niks: zonder zegel kan iemand die een
   image in handen krijgt niets nagaan. Met zegel kan hij vaststellen dat de
   combinatie image-digest + bronafdruk + commit door RTG is afgegeven en
   sindsdien niet is veranderd. Dat is precies het verschil tussen "hier staat
   een getal" en "wij staan achter dit getal".

   GEEN NIEUW GEREEDSCHAP IN DE PIJPLIJN. Ondertekend wordt met `openssl`
   (ed25519), dat er al is; geverifieerd wordt met de ingebouwde crypto van
   Node. Er komt dus geen ondertekenbinary en geen extra actie bij -- wat bij een
   supply-chain-functie precies het verkeerde soort toevoeging zou zijn.

   DE BYTES ZIJN DE VERKLARING. Er wordt getekend over het BESTAND en niet over
   een opnieuw geserialiseerd object: JSON dat je heen en weer parst, komt er
   niet altijd hetzelfde uit, en dan zou een geldige handtekening soms ongeldig
   lijken. Wie het bestand aanraakt, breekt het zegel -- dat is de bedoeling.

   Draai:  node scripts/releasezegel.js --maak            (schrijft RELEASE.json)
           node scripts/releasezegel.js --verifieer RELEASE.json RELEASE.sig
   Ondertekenen doet de pijplijn met openssl; zie .github/workflows/release-image.yml.
   ========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const WORTEL = path.join(__dirname, '..');
/* De publieke sleutel staat in de WORTEL naast SBOM.json en NORM.json, en niet
   in server/data/: die map is gitignored (daar staan runtime-sleutels), en een
   publieke releasesleutel die niet meereist met de bron is nutteloos -- wie de
   release controleert, heeft hem juist nodig. De PRIVEsleutel staat hier
   nergens en hoort in de geheimen van de pijplijn. */
const PUBSLEUTEL = path.join(WORTEL, 'RELEASE.pub');

/* De verklaring. Alleen dingen die ergens anders VANDAAN komen -- niets wordt
   hier bedacht. Wat er niet is, staat als null en niet als lege string: een
   lege string ziet eruit als een antwoord. */
function maak({ image, imageDigest }) {
  let sbom = {};
  try { sbom = JSON.parse(fs.readFileSync(path.join(WORTEL, 'SBOM.json'), 'utf8')); } catch (e) {}
  let basis = {};
  try { basis = (JSON.parse(fs.readFileSync(path.join(WORTEL, 'BASISIMAGES.json'), 'utf8')) || {}).images || {}; }
  catch (e) {}
  return {
    formaat: 'rtg-release/1',
    uitleg: 'Wat RTG heeft uitgebracht. Ondertekend met de eigen releasesleutel; ' +
      'dat bewijst dat RTG hier achter staat, niet dat GitHub het heeft gebouwd.',
    commit: (sbom.product || {}).commit || null,
    bronAfdruk: (sbom.eigenCode || {}).afdruk || null,
    bestanden: (sbom.eigenCode || {}).bestanden || null,
    image: image || null,
    imageDigest: imageDigest || null,
    basisImages: basis,
    npmInRelease: (sbom.telling || {}).npmInRelease
  };
}

/* Verifieren. Geeft een OORDEEL terug en geen boolean: waarom iets niet klopt,
   is hier belangrijker dan dat het niet klopt. Drie standen, net als de
   uitrolproef -- en "niet vast te stellen" is er weer een van (BESTUUR.md). */
function verifieer(bytes, handtekening, publiekePem) {
  if (!publiekePem) {
    return { stand: 'niet vast te stellen', code: 2,
      waarom: 'Er is geen publieke releasesleutel (sleutels/release.pub); er valt niets te controleren.' };
  }
  if (!bytes || !handtekening || !handtekening.length) {
    return { stand: 'niet vast te stellen', code: 2, waarom: 'Er is geen verklaring of geen handtekening meegegeven.' };
  }
  let goed = false;
  try {
    goed = crypto.verify(null, bytes, crypto.createPublicKey(publiekePem), handtekening);
  } catch (e) {
    return { stand: 'niet vast te stellen', code: 2, waarom: 'De sleutel of de handtekening is niet te lezen: ' + e.message };
  }
  if (!goed) {
    return { stand: 'gebroken', code: 1,
      waarom: 'De handtekening past niet bij deze verklaring. Of het bestand is veranderd, of hij is niet door RTG afgegeven.' };
  }
  return { stand: 'geldig', code: 0,
    waarom: 'Deze verklaring is afgegeven door de houder van de RTG-releasesleutel en sindsdien niet veranderd.',
    let: 'Dit zegt niet dat GitHub dit heeft gebouwd: de vertrouwensbron is RTG zelf. Zie SBOM.md.' };
}

function lees(p) { try { return fs.readFileSync(p); } catch (e) { return null; } }

if (require.main === module) {
  const argv = process.argv.slice(2);
  if (argv.includes('--maak')) {
    const i = argv.indexOf('--image');
    const d = argv.indexOf('--digest');
    const v = maak({ image: i >= 0 ? argv[i + 1] : null, digest: null, imageDigest: d >= 0 ? argv[d + 1] : null });
    const uit = path.join(WORTEL, 'RELEASE.json');
    fs.writeFileSync(uit, JSON.stringify(v, null, 2) + '\n');
    console.log('RELEASE.json geschreven voor commit ' + (v.commit || '(onbekend)'));
    process.exit(0);
  }
  if (argv.includes('--verifieer')) {
    const rest = argv.filter(a => a !== '--verifieer');
    const bytes = lees(rest[0] || path.join(WORTEL, 'RELEASE.json'));
    const sigTekst = lees(rest[1] || path.join(WORTEL, 'RELEASE.sig'));
    const sig = sigTekst ? Buffer.from(sigTekst.toString('utf8').trim(), 'base64') : null;
    const u = verifieer(bytes, sig, lees(PUBSLEUTEL));
    console.log('UITSLAG: ' + u.stand.toUpperCase());
    console.log('  ' + u.waarom);
    if (u.let) console.log('  Let op: ' + u.let);
    process.exit(u.code);
  }
  console.error('Gebruik: --maak [--image REF --digest SHA] of --verifieer [verklaring handtekening]');
  process.exit(2);
}

module.exports = { maak, verifieer, PUBSLEUTEL };
