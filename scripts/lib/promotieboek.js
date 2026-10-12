/* ============================================================================
   HET PROMOTIEBOEK -- het BEWIJSARCHIEF bij de artefactketen. Het beslist
   niets zelf: welk image gepromoveerd is en waarheen teruggedraaid mag worden,
   staat uitsluitend in de ondertekende artefactketen (scripts/lib/
   artefactketen.js, .release/artefactketen.json). Er is EEN releaseketen.

   WAT ER ONTBRAK. `live.sh` controleerde bij een rollback dat het doel in de
   keten eerder was gepromoveerd, maar de getekende herkomst met de
   KWALIFICATIE van dat image (scripts/lib/kwalificatie.js: de tests draaiden
   op de bytes van precies dit image-ID) was na de uitrol weg -- het volgende
   CI-artefact overschreef haar. Dat het rollbackdoel ooit gekwalificeerd was,
   viel dan niet meer na te lezen.

   DE REGEL. Bij elke uitrol wordt de ondertekende promotie en de getekende
   herkomst van de kandidaat bewaard onder zijn image-ID -- maar alleen als de
   artefactketen hem op dat moment als ACTIEF gepromoveerd kent. Bij een
   rollback (met de hand of automatisch) LEEST dit boek eerst de keten: staat
   het exacte stel image-ID's daar niet als gepromoveerd in deze omgeving, dan
   is het antwoord nee, wat er ook in het archief ligt. Daarna eist het, zonder
   iets te bouwen:
     - de promotie is getekend onder het vaste PROMOTION-anker en noemt exact
       dit app- en backup-image-ID, deze bewijspin en de digests uit de keten;
     - de herkomst is getekend onder het BUILD-anker, hoort bij het digest uit
       de keten, en haar kwalificatie noemt exact deze image-ID's.
   Wat niet in de keten staat, niet in het boek staat, of waarvan een byte
   veranderd is, wordt geweigerd. Er is geen vlag die dat overslaat.
   ========================================================================== */
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const trust = require('../../server/config/release-trust');
const keten = require('./artefactketen');

const MAP = '.release/promoties';
const BRONNEN = Object.freeze({
  promotie: '.release/productie-promotie.json',
  promotieSig: '.release/productie-promotie.sig',
  herkomst: '.release/herkomst.json',
  backupHerkomst: '.release/herkomst-backup.json'
});
const ID = /^sha256:[a-f0-9]{64}$/;
const HASH = /^[a-f0-9]{64}$/;
const sha256 = b => crypto.createHash('sha256').update(b).digest('hex');

function mapVoor(root, imageId) {
  if (!ID.test(String(imageId || ''))) throw new Error('Promotieboek: ongeldig image-ID.');
  return path.join(root, MAP, imageId.slice(7));
}

function leesBestand(pad, max = 16 * 1024 * 1024) {
  const stat = fs.lstatSync(pad);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size < 1 || stat.size > max)
    throw new Error('geen begrensd regulier bestand: ' + path.basename(pad));
  return fs.readFileSync(pad);
}

function canoniek(waarde) {
  return require('../imageherkomst').canoniek(waarde);
}

/* Controleer een stel bytes (promotie, handtekening, herkomsten) tegen de
   gevraagde identiteit. Geeft klachten; een lege lijst is de enige ja. */
const OMGEVING = /^(staging|pilot|productie)$/;

/* De keten is de enige bron: de gepromoveerd-records voor exact dit stel
   image-ID's in deze omgeving, nieuwste eerst. Een keten die niet verifieert
   is een klacht, nooit een lege lijst. */
function ketenRecords(root, { imageId, backupId, omgeving }) {
  if (!OMGEVING.test(String(omgeving || ''))) throw new Error('Promotieboek: onbekende omgeving.');
  return keten.geverifieerd(root).records.filter(r => r.soort === 'gepromoveerd' && r.velden.omgeving === omgeving &&
    r.velden.imageId === imageId && r.velden.backupImageId === backupId).reverse();
}

function controleerBytes(root, b, { imageId, backupId, pin, record }) {
  const k = [];
  let promotie, herkomst, backupHerkomst, ankers;
  try { ankers = trust.anchors(root); } catch (e) { return [e.message]; }
  try {
    promotie = JSON.parse(b.promotie.toString('utf8'));
    herkomst = JSON.parse(b.herkomst.toString('utf8'));
    backupHerkomst = JSON.parse(b.backupHerkomst.toString('utf8'));
  } catch (e) { return ['Promotieboek: een bewaard bewijs is onleesbaar.']; }
  const sig = b.promotieSig.toString('ascii').trim();
  if (!trust.verify('PROMOTION', b.promotie, sig, ankers.PROMOTION.key))
    k.push('De bewaarde promotie heeft geen geldige PROMOTION-handtekening.');
  if (!promotie || promotie.ondertekenDomein !== trust.ROLES.PROMOTION.domain || !promotie.kandidaat ||
      !promotie.kandidaat.image || !promotie.kandidaat.backup)
    return k.concat('De bewaarde promotie heeft niet de vorm van een OCI-promotie.');
  const img = promotie.kandidaat.image, bck = promotie.kandidaat.backup;
  if (img.id !== imageId) k.push('De promotie hoort bij image ' + img.id + ', niet bij ' + imageId + '.');
  if (bck.id !== backupId) k.push('De promotie hoort bij backupimage ' + bck.id + ', niet bij ' + backupId + '.');
  if (!HASH.test(String(pin || '')) || img.bewijsBestandSha256 !== pin)
    k.push('De bewijspin van het image is niet de pin uit de promotie.');
  if (!record || record.soort !== 'gepromoveerd') return k.concat('Zonder gepromoveerd-record uit de artefactketen is er niets om tegen te controleren.');
  if (img.digest !== record.velden.digest || bck.digest !== record.velden.backupDigest)
    k.push('De promotie noemt andere digests dan het gepromoveerd-record in de artefactketen.');
  for (const [naam, doc, digest, rol, id] of [['app', herkomst, img.digest, 'app', imageId],
    ['backup', backupHerkomst, bck.digest, 'backup', backupId]]) {
    const zonder = { ...doc }; delete zonder.handtekening;
    const ok = doc && doc.handtekening && trust.verify('BUILD', Buffer.from(canoniek(zonder), 'utf8'),
      doc.handtekening.waarde, ankers.BUILD.key);
    if (!ok) { k.push('De ' + naam + '-herkomst heeft geen geldige BUILD-handtekening.'); continue; }
    if (!doc.image || doc.image.digest !== digest)
      k.push('De ' + naam + '-herkomst hoort bij een ander digest dan de promotie.');
    k.push(...require('./kwalificatie').controleer(doc.kwalificatie, { imageId: id, rol }));
  }
  return k;
}

/* Bij uitrol: bewaar de bewijzen van de kandidaat die nu live gaat. De keten
   moet hem op dit moment als ACTIEF gepromoveerd kennen; anders, of als de
   bewijzen niet kloppen, wordt er ook niet uitgerold. */
function archiveer(root, { imageId, backupId, pin, omgeving }) {
  if (!OMGEVING.test(String(omgeving || ''))) throw new Error('Promotieboek: onbekende omgeving.');
  const nu = keten.huidigUit(keten.geverifieerd(root).records, omgeving);
  if (!nu || nu.record.soort !== 'gepromoveerd' || nu.record.velden.imageId !== imageId ||
      nu.record.velden.backupImageId !== backupId)
    throw new Error('Promotieboek: de artefactketen kent ' + imageId + ' niet als actief gepromoveerd in ' + omgeving + '.');
  const bytes = {};
  for (const [naam, rel] of Object.entries(BRONNEN)) bytes[naam] = leesBestand(path.join(root, rel));
  const klachten = controleerBytes(root, bytes, { imageId, backupId, pin, record: nu.record });
  if (klachten.length) throw new Error('Promotieboek: kandidaat niet te archiveren: ' + klachten.join(' '));
  const doel = mapVoor(root, imageId);
  fs.mkdirSync(doel, { recursive: true, mode: 0o700 });
  for (const [naam, b] of Object.entries(bytes)) fs.writeFileSync(path.join(doel, naam), b, { mode: 0o600 });
  const index = { formaat: 'rtg-promotieboek-v2', imageId, backupId, pin, omgeving, ketenRecord: nu.record.hash,
    bestanden: Object.fromEntries(Object.entries(bytes).map(([n, b]) => [n, sha256(b)])),
    gearchiveerd: new Date().toISOString() };
  fs.writeFileSync(path.join(doel, 'index.json'), JSON.stringify(index, null, 2) + '\n', { mode: 0o600 });
  return index;
}

/* Bij rollback: mag dit exacte stel image-ID's terug? Eerst de keten, dan het
   archief. Geeft klachten; een lege lijst is de enige ja. */
function controleerRollback(root, { imageId, backupId, pin, omgeving }) {
  if (!ID.test(String(imageId || '')) || !ID.test(String(backupId || '')))
    return ['Rollbackdoel heeft geen geldige image-ID\'s.'];
  let records;
  try { records = ketenRecords(root, { imageId, backupId, omgeving }); }
  catch (e) { return ['Promotieboek: de artefactketen beslist en is niet te lezen: ' + e.message]; }
  if (!records.length) return ['Image ' + imageId + ' staat niet als gepromoveerd in de artefactketen voor ' + omgeving + '.'];
  const map = mapVoor(root, imageId);
  if (!fs.existsSync(map)) return ['Image ' + imageId + ' staat niet in het promotieboek: zijn kwalificatie is niet bewaard.'];
  const bytes = {};
  try { for (const naam of Object.keys(BRONNEN)) bytes[naam] = leesBestand(path.join(map, naam)); }
  catch (e) { return ['Promotieboek voor ' + imageId + ' is onvolledig: ' + e.message]; }
  /* Een image kan vaker gepromoveerd zijn; het archief hoort bij een van die
     records, en precies dat record is de maat. */
  let index = null;
  try { index = JSON.parse(fs.readFileSync(path.join(map, 'index.json'), 'utf8')); } catch (e) { index = null; }
  const record = index && records.find(r => r.hash === index.ketenRecord);
  if (!record) return ['Het promotieboek voor ' + imageId + ' verwijst niet naar een gepromoveerd-record in de artefactketen.'];
  return controleerBytes(root, bytes, { imageId, backupId, pin, record });
}

module.exports = { MAP, BRONNEN, archiveer, controleerRollback, controleerBytes, mapVoor };
