/* GEKEURD, EN DEZELFDE GEKEURDE PERSOON? Een antwoord, nooit een rij.

   Gebruikt door de juridische hold op sollicitatiepost (kern/rtmail-leidinghold.js,
   besluit van de eigenaar 12 oktober 2026: "gekeurde identiteit"). Een beoordeling
   telt alleen als aanvrager en beoordelaar ALLEBEI een identiteit hebben die RTG
   heeft gezien, en die twee aantoonbaar verschillende personen zijn. De
   vergelijking woont hier, in de identiteitskluis, omdat zij naam, geboortedatum
   en hashes leest; wie haar aanroept krijgt alleen 'ander', 'zelfde' of
   'onbekend' terug -- geen veld, geen hash, geen document en geen rij.

   GEKEURD (A3) is EEN regel en staat hier: `isGekeurd(id)`. server.js
   idGeverifieerd() leest hem voor een sessie met een account; er is geen tweede
   kopie.

   WAT "DEZELFDE GEKEURDE PERSOON" HIER BETEKENT, en wat niet:
   - 'zelfde' als het hetzelfde account is, als beide accounts dezelfde telefoon-
     of e-mailhash dragen, of als beide GEKEURD zijn met dezelfde naam (zoals de
     keurder die tegen het document hield, genormaliseerd: hoofdletters, accenten
     en spaties tellen niet) EN dezelfde geboortedatum VAN HET DOCUMENT
     (`geborenBron: 'paspoort'`, routes/office/verificaties.js).
   - 'ander' alleen als beide gekeurd zijn, beide een documentdatum hebben, en
     naam of geboortedatum verschilt. Twee mensen met dezelfde naam en
     geboortedatum heten hier 'zelfde': dat is de weigerkant, en die is veilig.
   - 'onbekend' in elk ander geval: een sleutel zonder account, een account dat
     niet gekeurd is, een keuring zonder documentdatum, of een kluis die niet
     antwoordt. De aanroeper telt dat NOOIT als een ander mens.
   De keuring bewaart geen documentnummer; deze vergelijking is daarom zo sterk
   als naam plus documentdatum, en niet sterker. En ook 'ander' is niet bewezen:
   een keuring bewijst een geregistreerde identiteit, niet wie er achter het
   toetsenbord zat. */
'use strict';

const idVan = (k) => (/^user-\d+$/.test(String(k || '')) ? Number(String(k).slice(5)) : null);
const norm = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

module.exports = function maakZelfdeMens({ getUserById, getMemberState, realNameOf }) {
  function isGekeurd(id) {
    const u = getUserById(Number(id));
    return !!u && u.verified === 'verified';
  }
  function zelfdeMens(a, b) {
    const ia = idVan(a), ib = idVan(b);
    if (!ia || !ib) return 'onbekend';
    try {
      const x = getUserById(ia), y = getUserById(ib);
      if (!x || !y) return 'onbekend';
      if (x.id === y.id) return 'zelfde';
      if (x.phone_hash && x.phone_hash === y.phone_hash) return 'zelfde';
      if (x.email_hash && x.email_hash === y.email_hash) return 'zelfde';
      if (!isGekeurd(x.id) || !isGekeurd(y.id)) return 'onbekend';
      const mx = getMemberState(x.id) || {}, my = getMemberState(y.id) || {};
      if (mx.geborenBron !== 'paspoort' || my.geborenBron !== 'paspoort' || !mx.geboren || !my.geboren) return 'onbekend';
      const nx = norm(realNameOf(x)), ny = norm(realNameOf(y));
      if (!nx || !ny) return 'onbekend';
      return nx === ny && mx.geboren === my.geboren ? 'zelfde' : 'ander';
    } catch (e) { return 'onbekend'; }
  }
  return { isGekeurd, zelfdeMens };
};
