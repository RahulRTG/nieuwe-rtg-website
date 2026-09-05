#!/usr/bin/env node
/* ============================================================================
   DE HERKOMST VAN HET IMAGE -- een stuklijst (SBOM) en een handtekening die
   image, stuklijst en bron aan elkaar binden.

   WAT ER AL WAS EN WAT ER ONTBRAK. scripts/release-bewijs.js hasht de BRON:
   elke serverbron, elke gebouwde frontend, de Rust-bron, met SHA-256 per
   bestand. Dat is sterk, en het zit ook in het image (/app/release-bewijs.json).
   Wat het niet dekt is alles wat er in het image bij komt zonder door deze repo
   te gaan: de pakketten van het basis-image (node:22-slim is Debian, en dat zijn
   ruim honderd deb-pakketten die wij niet schrijven en niet kiezen). Wie vraagt
   "zit CVE-2026-xxxx in wat jullie draaien?" heeft aan een bronhash niets. Dat
   is de vraag die een SBOM beantwoordt, en dat was hier de blinde vlek.

   WAAROM EEN EIGEN STUKLIJST EN GEEN SYFT OF COSIGN. Het gewone antwoord is
   `syft` voor de SBOM en `cosign` voor de handtekening. Allebei zijn het
   binaries van derden die je in het releasepad zet -- precies het soort
   afhankelijkheid dat een SBOM moet blootleggen. Dit huis heeft nul
   runtime-afhankelijkheden in npm en nul crates in Cargo; er dan twee binaries
   bij halen om dat op te schrijven, is de verkeerde ruil. En het kan hier ook
   zonder: de enige onbekende is de pakketlijst van het basis-image, en die
   vraagt het image zelf op met dpkg-query.

   WAT DIT NIET IS, en dat hoort erbij. Dit is geen Sigstore. Er is geen
   transparantielogboek, geen keyless-OIDC, geen derde die meekijkt. Het is een
   Ed25519-handtekening met een sleutel die de eigenaar zelf bewaart. Wie
   sigstore-verificatie eist (sommige inkopers doen dat), krijgt dat hier niet;
   zie TAKEN.md. Wat het wel is: een controleerbare binding tussen wat er draait
   en wat er gebouwd is, met een commando dat iedereen kan draaien.

   DRIE DINGEN IN EEN HANDTEKENING, en dat is met opzet. Alleen het
   image-digest tekenen bewijst niets over de stuklijst; alleen de stuklijst
   tekenen bewijst niets over wat er draait. De handtekening staat daarom onder
   een document dat het image-digest, de hash van de stuklijst en de hash van
   het releasebewijs samen noemt. Klopt er een van de drie niet, dan valt de
   controle om.

   DE PUBLIEKE SLEUTEL STAAT IN DE REPOSITORY, en het document draagt hem niet
   zelf. Een handtekening met de sleutel ernaast bewijst alleen dat iemand een
   sleutel had. De controle leest deploy/release-sleutel.pub -- wie een vals
   herkomstdocument maakt, moet dus ook een commit in deze repository krijgen.

   Draai:
     node scripts/herkomst.js --nieuwe-sleutel
     node scripts/herkomst.js --sleutelcontrole
     node scripts/herkomst.js --sbom --image=ghcr.io/org/app:v1 --uit=.release/sbom.json
     node scripts/herkomst.js --binden --image=ghcr.io/org/app:v1 --digest=sha256:... \
          --sbom=.release/sbom.json --uit=.release/herkomst.json
     node scripts/herkomst.js --controle --herkomst=.release/herkomst.json
     node scripts/herkomst.js --controle --herkomst=.release/herkomst.json --draait=sha256:...
   ========================================================================== */
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const cp = require('child_process');

const WORTEL = path.join(__dirname, '..');
const SLEUTELBESTAND = path.join(WORTEL, 'deploy', 'release-sleutel.pub');
const STANDAARD_SBOM = '.release/sbom.json';
const STANDAARD_HERKOMST = '.release/herkomst.json';
const UITVOER_BESTANDEN = Object.freeze({
  unit: '.release/ci-suite.json',
  schermen: '.release/ci-schermsuite-bewijs.json',
  pg: '.release/ci-pg-bewijs.json',
  bron: '.release/bron-release-bewijs.json'
});

/* ---------------------------------------------------------------------------
   LEZERS. Elk van deze drie krijgt tekst en geeft gegevens; ze doen geen I/O,
   zodat test/herkomst.test.js ze met een vaste invoer kan vastpinnen.
   ------------------------------------------------------------------------- */

/* dpkg-query -W -f='${Package}\t${Version}\t${Architecture}\n' uit het image.
   Regels zonder versie zijn pakketten die wel bekend maar niet geïnstalleerd
   zijn (dpkg houdt die stand bij); die horen niet in een stuklijst van wat er
   draait. */
function leesDpkg(tekst) {
  const uit = [];
  for (const regel of String(tekst || '').split('\n')) {
    if (!regel.trim()) continue;
    const [naam, versie, arch] = regel.split('\t');
    if (!naam || !versie) continue;
    uit.push({ naam: naam.trim(), versie: versie.trim(), arch: (arch || '').trim() || 'unknown' });
  }
  return uit.sort((a, b) => (a.naam + a.versie).localeCompare(b.naam + b.versie));
}

/* Alpine-images (onder meer de herstelcontainer) hebben geen dpkg. `apk info
   -v` eindigt iedere regel met -<versie>; we splitsen op de laatste scheiding
   die door een cijfer wordt gevolgd en markeren het ecosysteem voor de purl. */
function leesApk(tekst) {
  const uit = [];
  for (const regel of String(tekst || '').split('\n')) {
    const m = regel.trim().match(/^(.+)-(\d[^\s]*)$/);
    if (m) uit.push({ naam:m[1], versie:m[2], arch:'unknown', apk:true });
  }
  return uit.sort((a, b) => (a.naam + a.versie).localeCompare(b.naam + b.versie));
}

/* Cargo.lock. Bewust een eigen minilezer en geen TOML-pakket: het bestand is
   machinaal gegenereerd en heeft precies drie velden die ons aangaan. Een
   checksum staat er alleen bij crates van crates.io; de eigen crate heeft er
   geen, en dat is geen ontbrekend gegeven maar een ander soort component. */
function leesCargoLock(tekst) {
  const uit = [];
  let huidig = null;
  for (const ruw of String(tekst || '').split('\n')) {
    const regel = ruw.trim();
    if (regel === '[[package]]') { if (huidig) uit.push(huidig); huidig = {}; continue; }
    if (!huidig) continue;
    if (regel.startsWith('[') && regel !== '[[package]]') { uit.push(huidig); huidig = null; continue; }
    const m = regel.match(/^(name|version|checksum|source)\s*=\s*"([^"]*)"/);
    if (m) huidig[m[1] === 'name' ? 'naam' : m[1] === 'version' ? 'versie' : m[1]] = m[2];
  }
  if (huidig) uit.push(huidig);
  return uit.filter(p => p.naam && p.versie)
    .sort((a, b) => (a.naam + a.versie).localeCompare(b.naam + b.versie));
}

/* package-lock.json. Wat hier telt is niet de lijst maar het AANTAL: dit huis
   heeft nul runtime-afhankelijkheden, en die nul hoort in de stuklijst te staan
   als een gemeten feit en niet als een bewering in een README. Dev-pakketten
   (Playwright) staan niet in het image -- npm ci draait daar met --omit=dev --
   en horen dus ook niet in een stuklijst van wat er draait. */
function leesNpmLock(tekst) {
  let lock;
  try { lock = JSON.parse(tekst); } catch (e) { return { runtime: [], ontwikkeling: 0 }; }
  const pakketten = lock.packages || {};
  const runtime = [];
  let ontwikkeling = 0;
  for (const [pad, p] of Object.entries(pakketten)) {
    if (!pad || pad === '') continue;                       // de wortel is het project zelf
    if (p && p.dev) { ontwikkeling++; continue; }
    const naam = (p && p.name) || pad.replace(/^node_modules\//, '');
    runtime.push({ naam, versie: (p && p.version) || '0', integriteit: (p && p.integrity) || null });
  }
  return { runtime: runtime.sort((a, b) => a.naam.localeCompare(b.naam)), ontwikkeling };
}

/* ---------------------------------------------------------------------------
   DE STUKLIJST. CycloneDX 1.5, want dat is wat scanners lezen. De volgorde is
   vast (op purl gesorteerd), zodat twee bouwsels van dezelfde invoer dezelfde
   bytes geven -- anders is een hash over de stuklijst niets waard.
   ------------------------------------------------------------------------- */
function maakSbom({ app, image, os, crates, npm, node, bewijs, gemaakt, serie }) {
  const componenten = [];
  const voeg = (c) => componenten.push(c);

  if (node) voeg({
    type: 'platform', name: 'node', version: String(node).replace(/^v/, ''),
    purl: 'pkg:generic/node@' + String(node).replace(/^v/, ''),
    description: 'De Node-runtime uit het basis-image.'
  });

  for (const p of os || []) voeg({
    type: 'library', name: p.naam, version: p.versie,
    purl: p.apk
      ? 'pkg:apk/alpine/' + p.naam + '@' + encodeURIComponent(p.versie)
      : 'pkg:deb/debian/' + p.naam + '@' + encodeURIComponent(p.versie) + '?arch=' + p.arch,
    scope: 'required'
  });

  for (const c of crates || []) {
    const comp = {
      type: 'library', name: c.naam, version: c.versie,
      purl: 'pkg:cargo/' + c.naam + '@' + c.versie,
      scope: 'required'
    };
    if (c.checksum) comp.hashes = [{ alg: 'SHA-256', content: c.checksum }];
    if (!c.source) comp.description = 'Eigen crate uit deze repository (geen registry-bron).';
    voeg(comp);
  }

  for (const p of (npm && npm.runtime) || []) {
    const comp = { type: 'library', name: p.naam, version: p.versie, purl: 'pkg:npm/' + p.naam + '@' + p.versie, scope: 'required' };
    if (p.integriteit) comp.hashes = [{ alg: 'SHA-512', content: p.integriteit.replace(/^sha512-/, '') }];
    voeg(comp);
  }

  componenten.sort((a, b) => String(a.purl).localeCompare(String(b.purl)));

  return {
    bomFormat: 'CycloneDX',
    specVersion: '1.5',
    serialNumber: 'urn:uuid:' + serie,
    version: 1,
    metadata: {
      timestamp: gemaakt,
      tools: [{ vendor: 'Rahul Travel Group', name: 'scripts/herkomst.js', version: '1' }],
      component: {
        type: 'application',
        name: (app && app.naam) || 'rtg',
        version: (app && app.versie) || '0',
        purl: 'pkg:generic/' + ((app && app.naam) || 'rtg') + '@' + ((app && app.versie) || '0'),
        description: 'RTG / RTFoundation productie-image' + (image ? ' (' + image + ')' : ''),
        /* De bronhash uit release-bewijs.json. Zo wijst de stuklijst terug naar
           het bestandsbewijs in plaats van ernaast te staan. */
        hashes: bewijs && bewijs.inhoudSha256 ? [{ alg: 'SHA-256', content: bewijs.inhoudSha256 }] : undefined
      },
      properties: [
        { name: 'rtg:runtime-dependencies-npm', value: String(((npm && npm.runtime) || []).length) },
        { name: 'rtg:dev-dependencies-npm', value: String((npm && npm.ontwikkeling) || 0) },
        { name: 'rtg:crates', value: String((crates || []).length) },
        { name: 'rtg:os-pakketten', value: String((os || []).length) },
        /* EEN STUKLIJST DIE NIET ZEGT HOE VOLLEDIG HIJ IS, LIEGT STIL. Zonder
           een draaiend image kan dit script de OS-pakketten niet zien; dan is
           dit een BRON-stuklijst en geen image-stuklijst, en dat hoort erin. */
        { name: 'rtg:volledigheid', value: (os || []).length ? 'image' : 'alleen-bron' }
      ]
    },
    components: componenten
  };
}

/* ---------------------------------------------------------------------------
   CANONIEKE VORM EN HANDTEKENING.
   ------------------------------------------------------------------------- */

/* Sleutels gesorteerd, undefined eruit. Twee documenten die hetzelfde beweren
   moeten dezelfde bytes geven, anders tekent de ene wat de andere niet leest. */
function canoniek(waarde) {
  const orden = (v) => {
    if (Array.isArray(v)) return v.map(orden);
    if (v && typeof v === 'object') {
      const uit = {};
      for (const k of Object.keys(v).sort()) if (v[k] !== undefined) uit[k] = orden(v[k]);
      return uit;
    }
    return v;
  };
  return JSON.stringify(orden(waarde));
}

const sha256 = (data) => crypto.createHash('sha256').update(data).digest('hex');

function uitvoeringHashes(root = WORTEL) {
  const uit = {};
  for (const [naam, rel] of Object.entries(UITVOER_BESTANDEN)) {
    const pad = path.resolve(root, rel);
    let bytes;
    try { bytes = fs.readFileSync(pad); }
    catch (e) { throw new Error('Verplicht bevroren CI-bewijs ontbreekt: ' + rel + '.'); }
    uit[naam] = { pad:rel, sha256:sha256(bytes), bytes:bytes.length };
  }
  return uit;
}

function nieuweSleutel() {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
  return {
    prive: privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(),
    publiek: publicKey.export({ type: 'spki', format: 'pem' }).toString()
  };
}

/* De privésleutel komt uit de omgeving en nooit uit een bestand in de
   repository. In CI is dat een secret; op een laptop een export uit de
   secrets manager. Base64 mag, want een PEM met echte nieuwe regels overleeft
   niet elke secret-store. */
function priveUitOmgeving(env) {
  const ruw = (env || process.env).RTG_RELEASE_SIGN_KEY || '';
  if (!ruw) return null;
  const tekst = ruw.includes('BEGIN') ? ruw : Buffer.from(ruw, 'base64').toString('utf8');
  if (!tekst.includes('BEGIN')) throw new Error('RTG_RELEASE_SIGN_KEY is geen PEM en geen base64-PEM.');
  return crypto.createPrivateKey(tekst);
}

function teken(document, priveSleutel) {
  const bytes = Buffer.from(canoniek(document), 'utf8');
  return crypto.sign(null, bytes, priveSleutel).toString('base64');
}

function controleerHandtekening(document, handtekening, publiekPem) {
  const zonder = { ...document };
  delete zonder.handtekening;
  const bytes = Buffer.from(canoniek(zonder), 'utf8');
  try {
    const sleutel = crypto.createPublicKey(publiekPem);
    if (sleutel.asymmetricKeyType !== 'ed25519' ||
        !/^[A-Za-z0-9+/]{86}==$/.test(String(handtekening || ''))) return false;
    const sig = Buffer.from(handtekening, 'base64');
    return sig.length === 64 && crypto.verify(null, bytes, sleutel, sig);
  } catch (e) { return false; }
}

/* Controleer vóór publicatie dat het CI-geheim werkelijk bij het vastgelegde
   vertrouwensanker hoort. Achteraf afkeuren is te laat: het image staat dan al
   in de registry. Een vaste, niet-geheime proeftekst is voldoende; alleen het
   bezit van de privésleutel moet hier worden bewezen. */
function sleutelpaarKlopt(priveSleutel, publiekPem) {
  try {
    const proef = Buffer.from('rtg-release-sleutelproef-v1', 'utf8');
    const handtekening = crypto.sign(null, proef, priveSleutel);
    return crypto.verify(null, proef, crypto.createPublicKey(publiekPem), handtekening);
  } catch (e) { return false; }
}

/* ---------------------------------------------------------------------------
   HET HERKOMSTDOCUMENT.
   ------------------------------------------------------------------------- */
function maakHerkomst({ image, digest, sbomBytes, sbomComponenten, bewijs, bron, bouw, uitvoering, gemaakt }) {
  return {
    formaat: 'rtg-herkomst-v1',
    gemaakt,
    image: { verwijzing: image || null, digest: digest || null },
    sbom: { sha256: sha256(sbomBytes), componenten: sbomComponenten, formaat: 'CycloneDX-1.5' },
    releasebewijs: bewijs ? { inhoudSha256: bewijs.inhoudSha256 || null, bestandAantal: bewijs.bestandAantal || null } : null,
    bron: bron || null,
    uitvoering: uitvoering || null,
    bouw: bouw || null
  };
}

function controleerHerkomst({ document, sbomBytes, publiekPem, draait }) {
  const klachten = [];
  if (!document || document.formaat !== 'rtg-herkomst-v1') return { ok: false, klachten: ['Onbekend of beschadigd herkomstdocument.'] };

  if (!document.handtekening || !document.handtekening.waarde) {
    klachten.push('Er staat geen handtekening onder dit document.');
  } else if (document.handtekening.algoritme !== 'ed25519') {
    klachten.push('Het herkomstdocument gebruikt niet de verplichte Ed25519-handtekening.');
  } else if (!publiekPem) {
    klachten.push('Er is geen vastgelegde publieke sleutel (deploy/release-sleutel.pub); een handtekening zonder bekende sleutel bewijst niets.');
  } else if (!controleerHandtekening(document, document.handtekening.waarde, publiekPem)) {
    klachten.push('De handtekening klopt niet bij deploy/release-sleutel.pub -- of het document is gewijzigd, of het is met een andere sleutel getekend.');
  }

  if (sbomBytes) {
    const nu = sha256(sbomBytes);
    if (nu !== (document.sbom || {}).sha256)
      klachten.push('De stuklijst is niet de stuklijst waaronder getekend is (SHA-256 ' + nu + ' tegen ' + (document.sbom || {}).sha256 + ').');
  }

  /* HET ENIGE DAT ER OP DE MACHINE TOE DOET: draait daar het image waar dit
     document over gaat? Zonder deze vergelijking is een geldige handtekening
     een geldige handtekening onder iets anders. */
  if (draait) {
    const gevraagd = String(draait).trim();
    if (!document.image || !document.image.digest) klachten.push('Dit document noemt geen image-digest, dus er valt niets te vergelijken.');
    else if (document.image.digest !== gevraagd)
      klachten.push('Het draaiende image (' + gevraagd + ') is niet het getekende image (' + document.image.digest + ').');
  }

  return { ok: klachten.length === 0, klachten };
}

/* De productiekandidaat gebruikt de strenge vorm: een geldige handtekening
   alleen is niet genoeg. Het document moet exact de gevraagde CI-build,
   registrydigest, schone commit, volledige image-SBOM en release-inhoud binden. */
function controleerKandidaatHerkomst({ document, sbomBytes, publiekPem, draait,
  commit, image, bewijsInhoudSha256, uitvoering }) {
  const basis = controleerHerkomst({ document, sbomBytes, publiekPem, draait });
  const klachten = [...basis.klachten];
  let sbom = null;
  try { sbom = JSON.parse(Buffer.from(sbomBytes || '').toString('utf8')); }
  catch (e) { klachten.push('De verplichte image-SBOM ontbreekt of is onleesbaar.'); }
  const volledig = sbom && (((sbom.metadata || {}).properties) || [])
    .some(p => p && p.name === 'rtg:volledigheid' && p.value === 'image');
  if (!volledig || !Array.isArray(sbom && sbom.components) || !sbom.components.length)
    klachten.push('De SBOM is geen volledige inventaris uit het gebouwde image.');
  if (!document || !document.image || !/^sha256:[a-f0-9]{64}$/.test(String(document.image.digest || '')))
    klachten.push('Het herkomstdocument heeft geen immutable registrydigest.');
  if (String((document.image || {}).verwijzing || '') !== String(image || ''))
    klachten.push('Het herkomstdocument hoort bij een andere imagereferentie.');
  if (!document.bron || document.bron.commit !== commit || document.bron.werkboomSchoon !== true)
    klachten.push('Het image is niet aan exact deze schone releasecommit gebonden.');
  if (!document.bouw || document.bouw.draaier !== 'github-actions' ||
      !document.bouw.workflow || !document.bouw.run)
    klachten.push('De kandidaat heeft geen geautoriseerde CI-bouwherkomst.');
  if (!/^[a-f0-9]{64}$/.test(String(bewijsInhoudSha256 || '')) ||
      !document.releasebewijs || document.releasebewijs.inhoudSha256 !== bewijsInhoudSha256)
    klachten.push('De kandidaat-SBOM bindt niet het exacte runtime-inhoudsbewijs.');
  if (sbom && document.sbom && document.sbom.componenten !== sbom.components.length)
    klachten.push('De getekende SBOM-telling wijkt af van de gemounte stuklijst.');
  const namen = Object.keys(UITVOER_BESTANDEN).sort();
  const vast = document && document.uitvoering;
  if (!vast || JSON.stringify(Object.keys(vast).sort()) !== JSON.stringify(namen) ||
      namen.some(naam => !vast[naam] || vast[naam].pad !== UITVOER_BESTANDEN[naam] ||
        !/^[a-f0-9]{64}$/.test(String(vast[naam].sha256 || '')) ||
        !Number.isSafeInteger(vast[naam].bytes) || vast[naam].bytes <= 0))
    klachten.push('De signed provenance bindt niet alle bevroren CI-uitvoeringsbewijzen.');
  if (uitvoering && JSON.stringify(vast) !== JSON.stringify(uitvoering))
    klachten.push('Een CI-uitvoeringsbewijs wijkt af van de signed provenance.');
  return { ok:klachten.length === 0, klachten };
}

/* ---------------------------------------------------------------------------
   HET GEREEDSCHAP ERBUITEN: git, docker, bestanden.
   ------------------------------------------------------------------------- */
function commando(bin, args, opties) {
  const r = cp.spawnSync(bin, args, { encoding: 'utf8', timeout: (opties && opties.timeout) || 120000 });
  if (r.error || r.status !== 0) return null;
  return String(r.stdout || '').trim();
}

function gitInfo() {
  const commit = commando('git', ['-C', WORTEL, 'rev-parse', 'HEAD']);
  if (!commit) return null;
  const status = commando('git', ['-C', WORTEL, 'status', '--porcelain']);
  const onbekend = String(status || '').split(/\r?\n/).filter(Boolean)
    .filter(regel => regel.slice(3) !== 'SUITE.json' || regel.slice(3).includes(' -> '));
  return {
    commit,
    boom: commando('git', ['-C', WORTEL, 'rev-parse', 'HEAD^{tree}']) || null,
    tag: commando('git', ['-C', WORTEL, 'describe', '--tags', '--exact-match']) || null,
    /* SUITE.json is de apart gepinde, getrackte testuitvoer en geen
       image-invoer. Iedere andere afwijking blijft een onzuivere bouw. */
    werkboomSchoon: onbekend.length === 0
  };
}

/* De pakketlijst uit het image zelf. Lukt dit niet (geen docker, geen daemon,
   image niet lokaal), dan geeft dit null en zegt de stuklijst eerlijk dat hij
   alleen de bron dekt -- er wordt hier niets geraden. */
function pakkettenUitImage(image) {
  if (!image) return null;
  const uit = commando('docker', ['run', '--rm', '--entrypoint', 'dpkg-query', image,
    '-W', '-f=${Package}\t${Version}\t${Architecture}\n'], { timeout: 180000 });
  if (uit) return leesDpkg(uit);
  const apk = commando('docker', ['run', '--rm', '--entrypoint', 'apk', image,
    'info', '-v'], { timeout: 180000 });
  return apk ? leesApk(apk) : null;
}

function argument(naam, argv) {
  const lijst = argv || process.argv;
  const vlag = '--' + naam;
  const gelijk = lijst.find(a => a.startsWith(vlag + '='));
  if (gelijk) return gelijk.slice(vlag.length + 1);
  const i = lijst.indexOf(vlag);
  return i >= 0 && lijst[i + 1] && !lijst[i + 1].startsWith('--') ? lijst[i + 1] : null;
}

function schrijf(rel, tekst) {
  const doel = path.resolve(WORTEL, rel);
  fs.mkdirSync(path.dirname(doel), { recursive: true });
  fs.writeFileSync(doel, tekst, { mode: 0o644 });
  return path.relative(WORTEL, doel);
}

function leesJson(rel) {
  try { return JSON.parse(fs.readFileSync(path.resolve(WORTEL, rel), 'utf8')); } catch (e) { return null; }
}

/* ---------------------------------------------------------------------------
   DE VIER STANDEN.
   ------------------------------------------------------------------------- */
function doeNieuweSleutel() {
  const sleutel = nieuweSleutel();
  console.log('DE PRIVESLEUTEL (nu naar je secrets manager, nooit naar de repository):');
  console.log('RTG_RELEASE_SIGN_KEY=' + Buffer.from(sleutel.prive).toString('base64'));
  console.log('');
  console.log('DE PUBLIEKE SLEUTEL (hoort WEL in de repository, in deploy/release-sleutel.pub):');
  console.log(sleutel.publiek.trim());
  console.log('');
  console.log('Zet hem neer met: node scripts/herkomst.js --nieuwe-sleutel --schrijf-publiek');
  if (process.argv.includes('--schrijf-publiek')) {
    schrijf('deploy/release-sleutel.pub', sleutel.publiek);
    console.log('Geschreven: deploy/release-sleutel.pub -- commit dit bestand.');
  }
}

function doeSleutelcontrole() {
  if (!fs.existsSync(SLEUTELBESTAND))
    throw new Error('deploy/release-sleutel.pub ontbreekt; publicatie zonder vastgelegd vertrouwensanker is verboden.');
  const prive = priveUitOmgeving();
  if (!prive) throw new Error('RTG_RELEASE_SIGN_KEY ontbreekt; een ongetekend image mag niet worden gepubliceerd.');
  const publiek = fs.readFileSync(SLEUTELBESTAND, 'utf8');
  if (!sleutelpaarKlopt(prive, publiek))
    throw new Error('RTG_RELEASE_SIGN_KEY hoort niet bij deploy/release-sleutel.pub.');
  console.log('Release-ondertekening gereed: privésleutel en vastgelegd vertrouwensanker horen bij elkaar.');
}

function doeSbom() {
  const image = argument('image');
  const pakketbestand = argument('pakketten');
  const uit = argument('uit') || STANDAARD_SBOM;

  const os = pakketbestand
    ? leesDpkg(fs.readFileSync(path.resolve(WORTEL, pakketbestand), 'utf8'))
    : pakkettenUitImage(image);

  const pkg = leesJson('package.json') || {};
  const bewijs = leesJson(argument('bewijs') || '.release/release-bewijs.json');
  const sbom = maakSbom({
    app: { naam: pkg.name || 'rtg', versie: pkg.version || '0' },
    image,
    os: os || [],
    crates: leesCargoLock(fs.readFileSync(path.join(WORTEL, 'motor', 'Cargo.lock'), 'utf8')),
    npm: leesNpmLock(fs.readFileSync(path.join(WORTEL, 'package-lock.json'), 'utf8')),
    node: process.version,
    bewijs,
    gemaakt: new Date().toISOString(),
    serie: crypto.randomUUID()
  });

  const pad = schrijf(uit, JSON.stringify(sbom, null, 2) + '\n');
  const volledig = os && os.length;
  console.log('Stuklijst geschreven: ' + pad + ' (' + sbom.components.length + ' componenten)');
  if (!volledig) {
    console.log('LET OP: zonder image-pakketten. Dit is een BRON-stuklijst, geen image-stuklijst.');
    console.log('Draai met --image=<verwijzing> op een machine met docker, of geef --pakketten=<dpkg-uitvoer>.');
    if (process.argv.includes('--eis-image')) process.exitCode = 1;
  }
}

function doeBinden() {
  const image = argument('image');
  const sbomPad = argument('sbom') || STANDAARD_SBOM;
  const uit = argument('uit') || STANDAARD_HERKOMST;
  let digest = argument('digest');

  const sbomBytes = fs.readFileSync(path.resolve(WORTEL, sbomPad));
  const sbom = JSON.parse(sbomBytes.toString('utf8'));

  /* Geen digest meegekregen? Dan vragen we het aan docker. Dit is bewust GEEN
     stilzwijgende terugval op de tag: een tag kan verhuizen, een digest niet. */
  if (!digest && image) {
    const uitDocker = commando('docker', ['inspect', '--format', '{{index .RepoDigests 0}}', image]);
    if (uitDocker && uitDocker.includes('@')) digest = uitDocker.split('@')[1];
  }
  if (!digest) throw new Error('Zonder --digest (of een lokaal image met een RepoDigest) valt er niets te binden.');

  const document = maakHerkomst({
    image, digest,
    sbomBytes,
    sbomComponenten: (sbom.components || []).length,
    bewijs: leesJson(argument('bewijs') || '.release/release-bewijs.json'),
    bron: gitInfo(),
    uitvoering: uitvoeringHashes(),
    bouw: {
      node: process.version,
      workflow: process.env.GITHUB_WORKFLOW || null,
      run: process.env.GITHUB_RUN_ID ? String(process.env.GITHUB_RUN_ID) : null,
      draaier: process.env.RUNNER_NAME ? 'github-actions' : null
    },
    gemaakt: new Date().toISOString()
  });

  const prive = priveUitOmgeving();
  if (prive) {
    document.handtekening = {
      algoritme: 'ed25519',
      publiekeSleutelSha256: sha256(crypto.createPublicKey(prive).export({ type: 'spki', format: 'der' })),
      waarde: teken(document, prive)
    };
  }

  const pad = schrijf(uit, JSON.stringify(document, null, 2) + '\n');
  console.log('Herkomstdocument geschreven: ' + pad);
  console.log('  image   ' + digest);
  console.log('  sbom    ' + document.sbom.sha256 + ' (' + document.sbom.componenten + ' componenten)');
  if (!prive) {
    console.log('ONGETEKEND: RTG_RELEASE_SIGN_KEY staat niet in de omgeving.');
    console.log('Een herkomstdocument zonder handtekening is een notitie, geen bewijs.');
    if (process.argv.includes('--eis-handtekening')) process.exitCode = 1;
  }
}

function doeControle() {
  const herkomstPad = argument('herkomst') || STANDAARD_HERKOMST;
  const document = leesJson(herkomstPad);
  if (!document) throw new Error('Geen herkomstdocument gevonden op ' + herkomstPad);

  const sbomPad = argument('sbom') || (document.sbom && path.join(path.dirname(herkomstPad), 'sbom.json'));
  let sbomBytes = null;
  try { sbomBytes = fs.readFileSync(path.resolve(WORTEL, sbomPad)); } catch (e) { /* zonder stuklijst toetsen we alleen de handtekening */ }

  const publiekPem = fs.existsSync(SLEUTELBESTAND) ? fs.readFileSync(SLEUTELBESTAND, 'utf8') : null;
  const streng = process.argv.includes('--eis-kandidaat');
  const r = streng
    ? controleerKandidaatHerkomst({ document, sbomBytes, publiekPem,
      draait:argument('draait'), commit:argument('commit'), image:argument('image'),
      bewijsInhoudSha256:argument('bewijs-inhoud'), uitvoering:uitvoeringHashes() })
    : controleerHerkomst({ document, sbomBytes, publiekPem, draait: argument('draait') });

  if (!sbomBytes) console.log('LET OP: de stuklijst zelf is niet meegelezen (' + sbomPad + ' ontbreekt); alleen de handtekening is getoetst.');
  if (!r.ok) {
    for (const k of r.klachten) console.error('✗ ' + k);
    process.exit(1);
  }
  console.log('Herkomst in orde.');
  console.log('  image   ' + ((document.image || {}).digest || 'onbekend'));
  console.log('  sbom    ' + (document.sbom || {}).sha256);
  console.log('  bron    ' + ((document.bron || {}).commit || 'onbekend') +
    ((document.bron || {}).werkboomSchoon === false ? ' (werkboom bevatte wijzigingen)' : ''));
}

function hoofd() {
  if (process.argv.includes('--nieuwe-sleutel')) return doeNieuweSleutel();
  if (process.argv.includes('--sleutelcontrole')) return doeSleutelcontrole();
  if (process.argv.includes('--sbom')) return doeSbom();
  if (process.argv.includes('--binden')) return doeBinden();
  if (process.argv.includes('--controle')) return doeControle();
  console.log('Gebruik: --nieuwe-sleutel | --sleutelcontrole | --sbom | --binden | --controle (zie de kop van dit bestand).');
  process.exitCode = 1;
}

if (require.main === module) {
  try { hoofd(); } catch (e) { console.error('[herkomst] ' + e.message); process.exitCode = 1; }
}

module.exports = {
  leesDpkg, leesApk, leesCargoLock, leesNpmLock, maakSbom, canoniek, sha256,
  nieuweSleutel, teken, controleerHandtekening, sleutelpaarKlopt, maakHerkomst,
  controleerHerkomst, controleerKandidaatHerkomst, UITVOER_BESTANDEN, uitvoeringHashes
};
