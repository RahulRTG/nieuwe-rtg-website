/* GEKEURD, EN DEZELFDE GEKEURDE PERSOON? Een antwoord, nooit een rij.

   Gebruikt door de juridische hold op sollicitatiepost (kern/rtmail-leidinghold.js,
   besluit van de eigenaar 12 oktober 2026: "gekeurde identiteit"). Een beoordeling
   telt alleen als aanvrager en beoordelaar ALLEBEI een identiteit hebben die RTG
   heeft gezien, en die twee aantoonbaar verschillende personen zijn. De
   vergelijking woont hier, in de identiteitskluis, omdat zij de keuring, de
   documentgeboortedatum en hashes leest; wie haar aanroept krijgt alleen 'ander', 'zelfde' of
   'onbekend' terug -- geen veld, geen hash, geen document en geen rij.

   GEKEURD (A3) is EEN regel en staat hier: `isGekeurd(id)`. server.js
   idGeverifieerd() leest hem voor een sessie met een account; er is geen tweede
   kopie.

   WAT HIER WORDT VASTGESTELD, en wat niet:
   - 'zelfde' als het hetzelfde account is, of als beide accounts dezelfde
     telefoon- of e-mailhash dragen.
   - 'ander' ALLEEN als beide accounts gekeurd zijn, beide een geboortedatum VAN
     HET DOCUMENT hebben (`geborenBron: 'paspoort'`, routes/office/verificaties.js)
     en die twee datums verschillen. Verschillende documentdatums zijn
     verschillende documenten, dus verschillende mensen.
   - 'onbekend' in elk ander geval: een sleutel zonder account, een account dat
     niet gekeurd is, een keuring zonder documentdatum, DEZELFDE documentdatum,
     of een kluis die niet antwoordt. De aanroeper telt dat NOOIT als een ander
     mens.
   De naam doet met opzet NIET mee: dat is wat het lid zelf intypte (met de
   gebruikersnaam of 'Lid' als terugval), en de keurder legt geen documentnaam
   vast -- 'M. Tweede' en 'Manager Tweede' zouden anders twee mensen zijn. De
   keuring bewaart ook geen documentnummer. De vergelijking is daarom precies zo
   sterk als de geboortedatum van het document, en dat heeft een prijs: twee echt
   verschillende mensen met dezelfde geboortedatum kunnen elkaar niet
   beoordelen; een ander gekeurd lid moet het doen. En ook 'ander' is niet
   bewezen: een keuring bewijst een geregistreerde identiteit, niet wie er achter
   het toetsenbord zat. */
'use strict';

const idVan = (k) => (/^user-\d+$/.test(String(k || '')) ? Number(String(k).slice(5)) : null);

module.exports = function maakZelfdeMens({ getUserById, getMemberState }) {
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
      // dezelfde documentdatum: niet vast te stellen dat het twee mensen zijn
      return mx.geboren !== my.geboren ? 'ander' : 'onbekend';
    } catch (e) { return 'onbekend'; }
  }
  return { isGekeurd, zelfdeMens };
};
