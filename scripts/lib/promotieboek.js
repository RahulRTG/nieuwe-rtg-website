/* ============================================================================
   HET PROMOTIEBOEK -- een rollback gaat alleen naar een image dat eerder is
   gekwalificeerd en ondertekend gepromoveerd.

   WAT ER ONTBRAK. `live.sh rollback` zette het image terug dat VOOR de laatste
   uitrol draaide (.rtg-live-rollback: image-ID, backup-ID, bewijspin). Dat het
   een ID is maakt het immutable, maar niets bewees dat dat image ooit door de
   keten was gegaan: wie eens met de hand `compose up` deed, had daarmee een
   rollbackdoel gemaakt dat nooit getest of goedgekeurd was.

   DE REGEL. Bij elke uitrol wordt de ondertekende promotie en de getekende
   herkomst van de kandidaat bewaard onder zijn image-ID. Een rollback (met de
   hand of automatisch) controleert daarna, zonder iets te bouwen:
     - de promotie is getekend onder het vaste PROMOTION-anker en noemt exact
       dit app- en backup-image-ID en deze bewijspin;
     - de herkomst is getekend onder het BUILD-anker, hoort bij hetzelfde
       registrydigest, en haar kwalificatie noemt exact deze image-ID's.
   Wat niet in het boek staat, of waarvan een byte veranderd is, wordt
   geweigerd. Er is geen vlag die dat overslaat.
   ========================================================================== */
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const trust = require('../../server/config/release-trust');

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
function controleerBytes(root, b, { imageId, backupId, pin }) {
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

/* Bij uitrol: bewaar de bewijzen van de kandidaat die nu live gaat. Faalt als
   ze niet kloppen -- dan wordt er ook niet uitgerold. */
function archiveer(root, { imageId, backupId, pin }) {
  const bytes = {};
  for (const [naam, rel] of Object.entries(BRONNEN)) bytes[naam] = leesBestand(path.join(root, rel));
  const klachten = controleerBytes(root, bytes, { imageId, backupId, pin });
  if (klachten.length) throw new Error('Promotieboek: kandidaat niet te archiveren: ' + klachten.join(' '));
  const doel = mapVoor(root, imageId);
  fs.mkdirSync(doel, { recursive: true, mode: 0o700 });
  for (const [naam, b] of Object.entries(bytes)) fs.writeFileSync(path.join(doel, naam), b, { mode: 0o600 });
  const index = { formaat: 'rtg-promotieboek-v1', imageId, backupId, pin,
    bestanden: Object.fromEntries(Object.entries(bytes).map(([n, b]) => [n, sha256(b)])),
    gearchiveerd: new Date().toISOString() };
  fs.writeFileSync(path.join(doel, 'index.json'), JSON.stringify(index, null, 2) + '\n', { mode: 0o600 });
  return index;
}

/* Bij rollback: mag dit exacte stel image-ID's terug? */
function controleerRollback(root, { imageId, backupId, pin }) {
  if (!ID.test(String(imageId || '')) || !ID.test(String(backupId || '')))
    return ['Rollbackdoel heeft geen geldige image-ID\'s.'];
  const map = mapVoor(root, imageId);
  if (!fs.existsSync(map)) return ['Image ' + imageId + ' staat niet in het promotieboek: het is nooit via de keten gepromoveerd.'];
  const bytes = {};
  try { for (const naam of Object.keys(BRONNEN)) bytes[naam] = leesBestand(path.join(map, naam)); }
  catch (e) { return ['Promotieboek voor ' + imageId + ' is onvolledig: ' + e.message]; }
  return controleerBytes(root, bytes, { imageId, backupId, pin });
}

module.exports = { MAP, BRONNEN, archiveer, controleerRollback, controleerBytes, mapVoor };
