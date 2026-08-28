/* ============================================================================
   DE KAST VAN DE DUBBELTIK -- bewaarde antwoorden, met drie grenzen.

   WAAROM DIT EEN EIGEN BESTAND IS. De middleware ernaast (./dubbeltik.js) gaat
   over verzoeken: herken een herhaling, laat de tweede wachten op de eerste,
   markeer het antwoord. Dit bestand gaat over GEHEUGEN, en dat is een andere
   vraag met eigen invarianten -- die je los hoort te kunnen toetsen zonder een
   server op te tuigen.

   DRIE GRENZEN, en ze zijn geen van drieën optioneel:

     tijd     Een bewaard antwoord van gisteren is geen herhaling meer maar een
              leugen: de wereld is verder. Na de termijn valt hij eruit.
     aantal   Een Map zonder plafond is een geheugenlek met een nette naam.
     BYTES    En dit is de grens die het vaakst wordt vergeten. Vijfduizend
              bewaarde antwoorden van honderd kilobyte is een half gigabyte --
              een plafond op AANTAL is dus geen plafond. De maat komt uit de
              content-length die de server toch al heeft berekend, zodat er geen
              tweede serialisatie nodig is.

   WAT ER GEBEURT ALS HIJ VOL IS: de OUDSTE valt eraf. Bescherming verdwijnt
   dan geleidelijk aan de achterkant, in plaats van per regel voor een soort
   antwoord dat toevallig groot is -- en `uitgevallen` telt hoe vaak dat gebeurt,
   zodat het zichtbaar is in plaats van stil.
   ========================================================================== */
'use strict';

const STANDAARD_TTL = 10 * 60 * 1000;         // een retry-venster is seconden; tien minuten is ruim
const STANDAARD_MAX = 5000;
const STANDAARD_MAX_BYTES = 32 * 1024 * 1024;

function maakKast(opties) {
  const o = opties || {};
  const ttl = o.ttlMs || STANDAARD_TTL;
  const max = o.max || STANDAARD_MAX;
  const maxBytes = o.maxBytes || STANDAARD_MAX_BYTES;
  const nu = o.nu || (() => Date.now());

  const rijen = new Map();
  let bytes = 0;
  let uitgevallen = 0;

  function verwijder(id) {
    const rij = rijen.get(id);
    if (!rij) return;
    bytes -= rij.bytes || 0;
    if (bytes < 0) bytes = 0;
    rijen.delete(id);
  }

  function veeg() {
    const grens = nu() - ttl;
    for (const [id, rij] of rijen) if (rij.at && rij.at < grens) verwijder(id);
    while (rijen.size > max) { verwijder(rijen.keys().next().value); uitgevallen++; }
    while (bytes > maxBytes && rijen.size) { verwijder(rijen.keys().next().value); uitgevallen++; }
  }

  return {
    haal: (id) => rijen.get(id),
    zet: (id, rij) => { rijen.set(id, rij); if (rijen.size > max) veeg(); return rij; },
    verwijder,
    /* De maat wordt pas NA het verzenden bijgeschreven: dan staat de
       content-length vast. Ontbreekt hij (chunked), dan telt dit antwoord als
       nul en houdt het aantal-plafond de kast alsnog in toom. */
    meet: (id, aantalBytes) => {
      const rij = rijen.get(id);
      if (!rij) return;
      rij.bytes = Number(aantalBytes) || 0;
      bytes += rij.bytes;
      if (bytes > maxBytes || rijen.size > max) veeg();
    },
    veeg,
    stand: () => ({ inKast: rijen.size, bytes, uitgevallen }),
    rijen
  };
}

module.exports = { maakKast, STANDAARD_TTL, STANDAARD_MAX, STANDAARD_MAX_BYTES };
