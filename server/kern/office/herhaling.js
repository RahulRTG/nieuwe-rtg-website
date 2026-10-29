/* RTG Office: EEN HERHAALD VERZOEK IS GEEN NIEUW VERZOEK.

   Twee gevallen, allebei gevonden door scripts/lib/voltooi/office.js (19
   oktober 2026), en allebei omdat het antwoord op het eerste verzoek nooit bij
   het scherm aankwam (een afgebroken verbinding, een herstart):

   1. NIEUW DOCUMENT. Het scherm stuurt per poging een `idem`; komt die terug,
      dan krijgt het hetzelfde document. Zonder sleutel stond er na een
      stroomstoring en een herhaling een tweede leeg document in de drive.
   2. DEZELFDE AUTOSAVE NOG EENS. De eerste bewaring telde, dus het scherm
      draagt een verouderde `verwachtGewijzigd` mee. De optimistische
      vergrendeling zei dan "intussen door iemand anders gewijzigd" over de
      eigen bewaring van de medewerker. Is de inhoud die binnenkomt al precies
      wat er staat, dan valt er niets over te schrijven en is er geen conflict.
      Een ANDERE inhoud op een oude stand blijft een conflict: dat is de
      bescherming tegen een tweede venster, en die blijft. */
'use strict';

/* Het antwoord voor een document dat deze eigenaar met deze sleutel al
   maakte, of null als het een nieuwe poging is. */
function gemaakt(alle, key, idem, verzoek) {
  const d = idem && Object.values(alle).find(x => x.key === key && x.idem === idem);
  if (!d) return null;
  /* Dezelfde sleutel bij een ander verzoek is geen herhaling maar een fout. */
  if (d.idemVerzoek && d.idemVerzoek !== verzoek)
    return { status: 409, error: 'Deze herhaalsleutel hoort bij een ander document; er is niets aangemaakt.' };
  return { status: 200, ok: true, id: d.id, soort: d.soort, titel: d.titel, herhaald: true };
}

/* Wat een maak-verzoek IS: soort, sjabloon en titel zoals ze binnenkwamen. */
const verzoekVan = (data) => JSON.stringify([data.soort || '', data.sjabloon || '', data.titel || '']);

/* Staat wat er binnenkomt er al? Titel telt alleen als die is meegestuurd. */
function staatEr(d, data, schoonInhoud, titelVan) {
  if (!data.inhoud || typeof data.inhoud !== 'object') return false;
  if (JSON.stringify(schoonInhoud(d.soort, data.inhoud)) !== JSON.stringify(d.inhoud)) return false;
  return typeof data.titel !== 'string' || (titelVan(data.titel) || d.titel) === d.titel;
}

/* De sleutel en het verzoek bij een nieuw document vastleggen. */
function merk(d, idem, data) { if (idem) { d.idem = idem; d.idemVerzoek = verzoekVan(data); } }

module.exports = { gemaakt, staatEr, verzoekVan, merk };
