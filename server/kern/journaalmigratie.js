/* EENMALIG EEN OUDE JOURNAALCOLLECTIE PLAATSEN.

   De gewone noteerRegel()-weg begint bij zijn stapelgrens asynchroon te
   spoelen. De verhuizing zag daardoor bij 8.611 regels alleen de laatste 8.111
   terug uit spoelNu(), hield de oude collectie terecht vast, en iedere
   serverstart schreef hem opnieuw. In een cluster deden drie starters dat ook
   nog tegelijk.

   Daarom krijgt de verhuizing één atomisch bestand. Ieder proces schrijft
   eerst zijn eigen tijdelijke bestand en probeert daarna een hardlink met de
   inhoudsdigest als vaste naam te plaatsen. Precies één proces wint; EEXIST
   betekent dat dezelfde collectie al veilig staat. Pas daarna komt de
   complete-marker. Een crash vóór de link laat hooguit een verborgen tijdelijk
   bestand achter; een crash tussen link en marker wordt bij de volgende start
   herkend aan het volledige doelbestand.

   Het migratiebestand doet gewoon mee met lezen en rotatie
   (journaalrotatie.js). De marker niet: die blijft als idempotentiebewijs staan
   wanneer de oude regels volgens de gewone bestandsgrens verlopen. */
'use strict';
const fs = require('fs');
const crypto = require('node:crypto');

function maakJournaalmigratie({ pad, zorgMap, regelTekst, meldEens, stuk, telGeschreven }) {
  function verhuisEenmalig(regels) {
    const rij = Array.isArray(regels) ? regels : [];
    if (!rij.length) return { ok: true, geschreven: 0, reeds: false };
    if (stuk()) return { ok: false, geschreven: 0, reden: stuk() };
    const digest = crypto.createHash('sha256').update(JSON.stringify(rij)).digest('hex').slice(0, 32);
    const naam = 'migratie-v1-' + digest;
    const doel = pad(naam + '.log');
    const marker = pad('.' + naam + '.complete');
    const markerGoed = () => {
      try {
        const m = JSON.parse(fs.readFileSync(marker, 'utf8'));
        return m && m.digest === digest && Number(m.aantal) === rij.length;
      } catch (e) { return false; }
    };
    if (markerGoed()) return { ok: true, geschreven: rij.length, reeds: true };

    zorgMap();
    let tijdelijk = null;
    let geplaatst = false;
    try {
      if (!fs.existsSync(doel)) {
        tijdelijk = pad('.' + naam + '.' + process.pid + '.' + crypto.randomBytes(6).toString('hex') + '.tmp');
        const fd = fs.openSync(tijdelijk, 'wx', 0o600);
        try {
          fs.writeFileSync(fd, rij.map(regelTekst).join(''));
          fs.fsyncSync(fd);
        } finally { fs.closeSync(fd); }
        try { fs.linkSync(tijdelijk, doel); geplaatst = true; }
        catch (e) { if (!e || e.code !== 'EEXIST') throw e; }
      }
      if (!fs.existsSync(doel)) throw new Error('het atomische migratiebestand ontbreekt na het plaatsen');

      /* De marker zelf wordt eveneens pas compleet zichtbaar via een link. */
      if (!markerGoed()) {
        const mtmp = pad('.' + naam + '.' + process.pid + '.' + crypto.randomBytes(6).toString('hex') + '.marker.tmp');
        const fd = fs.openSync(mtmp, 'wx', 0o600);
        try {
          fs.writeFileSync(fd, JSON.stringify({ versie: 1, digest, aantal: rij.length }) + '\n');
          fs.fsyncSync(fd);
        } finally { fs.closeSync(fd); }
        try { fs.linkSync(mtmp, marker); }
        catch (e) { if (!e || e.code !== 'EEXIST') throw e; }
        try { fs.unlinkSync(mtmp); } catch (e) {}
      }
      if (!markerGoed()) throw new Error('de complete-marker van de verhuizing is niet leesbaar');
      if (geplaatst) telGeschreven(rij.length);
      return { ok: true, geschreven: rij.length, reeds: !geplaatst };
    } catch (e) {
      meldEens(e);
      return { ok: false, geschreven: 0, reden: e && e.message ? e.message : String(e) };
    } finally {
      if (tijdelijk) try { fs.unlinkSync(tijdelijk); } catch (e) {}
    }
  }

  return { verhuisEenmalig };
}

module.exports = { maakJournaalmigratie };
