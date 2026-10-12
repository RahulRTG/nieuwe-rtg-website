/* KIJKEN NAAR EEN STROOMTICKET ZONDER HET TE CLAIMEN (./sessiestroom.js).
   Geknipt uit dat bestand op de 10 kB-grens van keuringsregel 13; het krijgt
   precies de stukken van de sessiestroom die de claim ook gebruikt, zodat er
   geen tweede lezing van een ticket ontstaat. */
'use strict';

module.exports = ({ soorten, transactie, bearer, eigen, geopend }) => {
  /* KIJKEN ZONDER TE CLAIMEN: van wie is dit ticket? Voor de hoofdzekering
     (../middleware/remmen.js): in onderhoud mag alleen de EIGENAAR erbij, en
     dat leest de zekering uit de sessie in de kop. Een EventSource stuurt geen
     kop, dus de stroom van de eigenaar kwam er sinds de stroomtickets niet meer
     door -- hij leunde op de `?token=`-uitweg die weg is (en wegblijft). Deze
     functie geeft de zekering dezelfde sessie, langs het ticket.

     Hij CLAIMT NIETS: het ticket blijft staan voor de deur erachter, die het
     zelf claimt en zelf opnieuw toetst. Wat hij wel doet is dezelfde controles
     als de claim (bestaat, doel en scope van zijn soort, niet verlopen,
     ingetrokken of op, zegel geldig) -- een ticket dat de deur zou weigeren,
     opent ook de zekering niet. Geeft { soort, token } of null. */
  return async function kijk(ticket) {
    const kaal = String(ticket == null ? '' : ticket).trim();
    const namen = [...soorten.keys()];
    if (!kaal || !namen.length || !soorten.get(namen[0]).st.vorm(kaal)) return null;
    let gevonden = null;
    try {
      gevonden = await transactie(kaart => {
        for (const naam of namen) {
          const rij = eigen(kaart, naam);
          const t = Array.isArray(rij) ? bearer.vind(rij, kaal) : null;
          if (!t) continue;
          if (bearer.reden(t, { doel: 'sessie-stroom:' + naam, scope: ['stroom.' + naam] })) return null;
          return { naam, onderwerp: t.onderwerp };
        }
        return null;
      });
    } catch (e) { return null; }
    const raw = gevonden ? geopend(gevonden.onderwerp, gevonden.naam, bearer.hash(kaal)) : null;
    return raw ? { soort: gevonden.naam, token: raw } : null;
  };
};
