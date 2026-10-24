/* Care (deelmodule): DE MEDISCHE CONTEXT VAN EEN INTAKE, VERSLEUTELD PER VELD.

   Een intake is een bijzonder persoonsgegeven (art. 9 AVG): wat een lid de
   behandelaar vooraf wil laten weten. Hij stond leesbaar in de opslag zodra er
   geen RTG_ENC_KEY was -- die sleutel versleutelt de hele database, maar is
   optioneel en staat in een test- of lokale omgeving vaak uit. De
   gezondheidskaart van de Foundation (foundation/basis.js, encS) heeft dat
   probleem niet: die versleutelt het veld zelf, met een eigen sleutel buiten de
   database. Deze module doet hetzelfde voor de intake, met twee verschillen:

   1. GEBONDEN AAN DE RIJ. De context gaat als additional authenticated data
      mee (`rij`: de intake of de boeking waar de tekst bij hoort). Een blob die
      naar een andere rij wordt gekopieerd, gaat niet open.
   2. DICHT FALEN. Kan er niet versleuteld worden, dan gooit sluit() en bewaart
      de aanroeper niets -- nooit een leesbare terugval. open() geeft null bij
      een blob die niet opengaat, en laat een oude platte waarde (van voor deze
      module) leesbaar door, zodat er niets verdwijnt.

   `haalSleutel` is in te spuiten voor een toets; standaard staat de sleutel in
   care-intake.key in de datamap, net als foundation.key. */
'use strict';
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const MERK = 'cint1:';

module.exports = function maakIntakesleutel(opties) {
  const o = opties || {};
  let sleutel = null;
  const haal = o.haalSleutel || (() => {
    const map = require('../../db').DATA_DIR;
    fs.mkdirSync(map, { recursive: true });
    return require('../../lib/sleutelbestand').sleutel(path.join(map, 'care-intake.key'), 32);
  });
  const k = () => (sleutel = sleutel || haal());
  const aad = (rij) => Buffer.from('rtg-care-intake|' + String(rij || ''), 'utf8');

  function sluit(tekst, rij) {
    if (!rij) throw new Error('sluit() vraagt de rij waar de tekst bij hoort.');
    const iv = crypto.randomBytes(12);
    const c = crypto.createCipheriv('aes-256-gcm', k(), iv);
    c.setAAD(aad(rij));
    const ct = Buffer.concat([c.update(String(tekst), 'utf8'), c.final()]);
    return MERK + Buffer.concat([iv, c.getAuthTag(), ct]).toString('base64');
  }
  function open(blob, rij) {
    if (typeof blob !== 'string' || !blob.startsWith(MERK)) return blob == null ? null : blob;
    try {
      const buf = Buffer.from(blob.slice(MERK.length), 'base64');
      const d = crypto.createDecipheriv('aes-256-gcm', k(), buf.subarray(0, 12));
      d.setAAD(aad(rij));
      d.setAuthTag(buf.subarray(12, 28));
      return Buffer.concat([d.update(buf.subarray(28)), d.final()]).toString('utf8');
    } catch (e) { return null; }
  }
  return { sluit, open, MERK };
};
