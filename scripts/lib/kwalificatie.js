/* ============================================================================
   KWALIFICATIE -- het bewijs dat de geteste bytes de geleverde bytes ZIJN.

   WAT ER ONTBRAK. De releaseworkflow draaide de volledige software-afbouw op de
   werkboom en bouwde het image DAARNA opnieuw (`docker build --pull`). De
   herkomst tekende vervolgens de hashes van het testbewijs naast het digest van
   dat tweede image. Dat de tests over precies die bytes gingen, stond nergens:
   twee bouwrondes van dezelfde commit kunnen verschillende base-imagebytes,
   een andere Rust-binary of een andere frontend-build opleveren, en de
   handtekening zou het niet merken.

   DE KETEN NU. Het image wordt EEN keer gebouwd. Uit dat image komen het
   inhoudsbewijs (/app/release-bewijs.json), de twee Rust-binaries en de
   gebouwde frontend terug in de werkboom. Daarna:
     1. `voor`  -- de werkboom is byte voor byte de runtime-inhoud van het image;
     2. de tests draaien op die werkboom, met die binaries en die frontend;
     3. `na`    -- de werkboom is NOG STEEDS byte voor byte het image (een stap
                   die runtime-invoer herschrijft, maakt de kwalificatie ongeldig);
     4. het image dat gepubliceerd wordt heeft hetzelfde image-ID (config-digest)
        als het image waaruit de bytes kwamen -- er is niet opnieuw gebouwd.
   De samenvatting gaat in de getekende herkomst, en de kandidaatcontrole eist
   haar. Een image zonder kwalificatie, of met een ander image-ID, is geen
   kandidaat.

   WAT HET NIET ZEGT. Bestanden die de werkboom wel heeft en het image met
   opzet niet (exact genoemd in .dockerignore, zoals scripts/a11y.js) zijn
   toegestaan en worden met naam vermeld; elk ander verschil laat de
   kwalificatie zakken. Het basis-image (Debian/Node) wordt hier niet
   vergeleken -- dat dekt de image-SBOM, en het image-ID bindt het.
   ========================================================================== */
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const releaseBewijs = require('../release-bewijs');

const FORMAAT = 'rtg-kwalificatie-v1';
const REL = Object.freeze({
  imageBewijs: '.release/image-release-bewijs.json',
  image: '.release/kwalificatie-image.json',
  voor: '.release/kwalificatie-voor.json',
  na: '.release/kwalificatie-na.json'
});
const ID = /^sha256:[a-f0-9]{64}$/;
const HASH = /^[a-f0-9]{64}$/;
const sha256 = bytes => crypto.createHash('sha256').update(bytes).digest('hex');

/* Alleen LETTERLIJKE paden uit .dockerignore tellen als "met opzet niet
   geleverd". Een patroon met * of een uitzondering met ! wordt niet
   geinterpreteerd: wie hier een glob verwacht, krijgt een verschil en geen
   stille vrijstelling. */
function nietGeleverd(root) {
  let tekst = '';
  try { tekst = fs.readFileSync(path.join(root, '.dockerignore'), 'utf8'); } catch (e) { return []; }
  return tekst.split(/\r?\n/).map(r => r.trim())
    .filter(r => r && !r.startsWith('#') && !r.startsWith('!') && !/[*?[\]]/.test(r))
    .map(r => r.replace(/^\/+/, '').replace(/\/+$/, ''));
}

function isNietGeleverd(rel, lijst) {
  return lijst.some(p => rel === p || rel.startsWith(p + '/'));
}

function vergelijk(root, manifest) {
  if (!manifest || manifest.formaat !== 'rtg-release-bewijs-v1' || !Array.isArray(manifest.bestanden) ||
      !HASH.test(String(manifest.inhoudSha256 || '')))
    return { ok: false, verschillen: [{ soort: 'bewijs', pad: null }], extraToegestaan: [] };
  const verschillen = [];
  if (releaseBewijs.totaalHash(manifest.bestanden) !== manifest.inhoudSha256)
    verschillen.push({ soort: 'bewijs', pad: null });
  let werk;
  try { werk = releaseBewijs.verzamel(root); } catch (e) {
    return { ok: false, verschillen: [{ soort: 'scan', pad: null, uitleg: e.message }], extraToegestaan: [] };
  }
  const verwacht = new Map(manifest.bestanden.map(b => [b.pad, b]));
  const lijst = nietGeleverd(root);
  const extraToegestaan = [];
  for (const rel of werk) {
    if (verwacht.has(rel)) continue;
    if (isNietGeleverd(rel, lijst)) extraToegestaan.push(rel);
    else verschillen.push({ soort: 'nieuw', pad: rel });
  }
  const gevonden = new Set(werk);
  const nu = [];
  for (const b of manifest.bestanden) {
    if (!gevonden.has(b.pad)) { verschillen.push({ soort: 'ontbreekt', pad: b.pad }); continue; }
    const h = releaseBewijs.hashBestand(path.join(root, b.pad));
    nu.push({ pad: b.pad, ...h });
    if (h.bytes !== b.bytes || h.sha256 !== b.sha256) verschillen.push({ soort: 'inhoud', pad: b.pad });
  }
  return { ok: verschillen.length === 0, verschillen, extraToegestaan,
    werkboomSha256: releaseBewijs.totaalHash(nu.sort((a, b) => a.pad < b.pad ? -1 : a.pad > b.pad ? 1 : 0)),
    inhoudSha256: manifest.inhoudSha256, bestandAantal: manifest.bestanden.length };
}

function leesJson(root, rel) {
  return JSON.parse(fs.readFileSync(path.join(root, rel), 'utf8'));
}

function schrijfJson(root, rel, waarde) {
  const doel = path.join(root, rel);
  fs.mkdirSync(path.dirname(doel), { recursive: true });
  fs.writeFileSync(doel, JSON.stringify(waarde, null, 2) + '\n', { mode: 0o644 });
}

function imageRecord(root) {
  const r = leesJson(root, REL.image);
  if (!r || r.formaat !== FORMAAT + '-image' || !ID.test(String(r.imageId || '')) ||
      typeof r.image !== 'string' || !r.image)
    throw new Error('Kwalificatie: het record van het bronimage ontbreekt of is ongeldig.');
  return r;
}

function fase(root, naam) {
  if (naam !== 'voor' && naam !== 'na') throw new Error('Kwalificatie: fase is voor of na.');
  const img = imageRecord(root);
  const manifestBytes = fs.readFileSync(path.join(root, REL.imageBewijs));
  if (sha256(manifestBytes) !== img.bewijsSha256)
    throw new Error('Kwalificatie: het inhoudsbewijs is niet meer het bewijs dat uit het image kwam.');
  const r = vergelijk(root, JSON.parse(manifestBytes.toString('utf8')));
  const record = { formaat: FORMAAT + '-fase', fase: naam, imageId: img.imageId,
    inhoudSha256: r.inhoudSha256 || null, werkboomSha256: r.werkboomSha256 || null,
    bestandAantal: r.bestandAantal || 0, ok: r.ok, verschillen: r.verschillen.slice(0, 50),
    aantalVerschillen: r.verschillen.length, extraToegestaan: r.extraToegestaan,
    gemeten: new Date().toISOString() };
  schrijfJson(root, REL[naam], record);
  return record;
}

/* De samenvatting die in de getekende herkomst komt. Gooit als er iets
   ontbreekt: een kwalificatie met een gat wordt niet getekend. */
function samenvatting(root) {
  const img = imageRecord(root);
  const voorBytes = fs.readFileSync(path.join(root, REL.voor));
  const naBytes = fs.readFileSync(path.join(root, REL.na));
  const voor = JSON.parse(voorBytes.toString('utf8'));
  const na = JSON.parse(naBytes.toString('utf8'));
  for (const [naam, r] of [['voor', voor], ['na', na]]) {
    if (!r || r.formaat !== FORMAAT + '-fase' || r.fase !== naam || r.ok !== true ||
        r.aantalVerschillen !== 0 || r.imageId !== img.imageId || !HASH.test(String(r.inhoudSha256 || '')))
      throw new Error('Kwalificatie: fase "' + naam + '" is niet groen of hoort bij een ander image.');
  }
  if (voor.inhoudSha256 !== na.inhoudSha256 || voor.werkboomSha256 !== na.werkboomSha256 ||
      voor.werkboomSha256 !== voor.inhoudSha256)
    throw new Error('Kwalificatie: de werkboom veranderde tussen voor en na de tests.');
  if (img.gepubliceerdImageId !== img.imageId)
    throw new Error('Kwalificatie: het gepubliceerde image is niet het gekwalificeerde image (opnieuw gebouwd?).');
  if (!ID.test(String(img.backupImageId || '')) || img.gepubliceerdBackupImageId !== img.backupImageId)
    throw new Error('Kwalificatie: het gepubliceerde backupimage is niet het gekwalificeerde backupimage.');
  return { formaat: FORMAAT, imageId: img.imageId, backupImageId: img.backupImageId,
    backupScripts: img.backupScripts, inhoudSha256: voor.inhoudSha256,
    bestandAantal: voor.bestandAantal, imageBewijsSha256: img.bewijsSha256,
    voorSha256: sha256(voorBytes), naSha256: sha256(naBytes), nietGeleverd: voor.extraToegestaan };
}

/* De strenge controle die de kandidaatherkomst doet. Geeft klachten, gooit niet. */
function controleer(blok, { imageId, inhoudSha256, rol = 'app' } = {}) {
  const k = [];
  if (!blok || blok.formaat !== FORMAAT) return ['De herkomst draagt geen kwalificatie: niet bewezen dat de tests over deze bytes gingen.'];
  if (rol !== 'app' && rol !== 'backup') return ['Onbekende kwalificatierol.'];
  if (blok.rol !== rol) k.push('De kwalificatie hoort bij rol ' + blok.rol + ', niet bij ' + rol + '.');
  if (!ID.test(String(blok.imageId || '')) || !ID.test(String(blok.backupImageId || '')))
    k.push('De kwalificatie noemt geen geldig image-ID.');
  if (!HASH.test(String(blok.inhoudSha256 || ''))) k.push('De kwalificatie noemt geen geldige inhoudshash.');
  for (const v of ['imageBewijsSha256', 'voorSha256', 'naSha256'])
    if (!HASH.test(String(blok[v] || ''))) k.push('De kwalificatie mist ' + v + '.');
  if (!Number.isSafeInteger(blok.bestandAantal) || blok.bestandAantal <= 0) k.push('De kwalificatie telt geen bestanden.');
  const verwacht = rol === 'backup' ? blok.backupImageId : blok.imageId;
  if (!ID.test(String(imageId || '')))
    k.push('Zonder lokaal image-ID valt niet te bewijzen dat dit het gekwalificeerde image is.');
  else if (verwacht !== imageId)
    k.push('Het image (' + imageId + ') is niet het gekwalificeerde ' + rol + '-image (' + verwacht + ').');
  if (inhoudSha256 !== undefined && blok.inhoudSha256 !== inhoudSha256)
    k.push('De gekwalificeerde inhoud is niet de runtime-inhoud van dit image.');
  return k;
}

module.exports = { FORMAAT, REL, nietGeleverd, vergelijk, fase, samenvatting, controleer, imageRecord,
  schrijfJson, leesJson, sha256 };
