/* Eenmalige WebAuthn-ceremonies zijn expres vluchtig, maar ook vluchtig
   geheugen moet begrensd zijn. De oude Map ruimde pas boven 5000 op en
   verwijderde dan alleen verlopen regels. Vijfduizend verse aanvragen bleven
   dus onbeperkt doorgroeien en iedere volgende aanvraag liep de hele Map
   langs: een goedkope geheugen- en CPU-aanval.

   Deze kleine opslag houdt afloopvolgorde, ruimt O(1) aan de voorkant en werpt
   bij drukte de oudste ongebruikte ceremonie af. Hij staat los van de
   accountlogica, zodat de beveiligingsrand zelfstandig leesbaar en toetsbaar
   blijft. */

const CHALLENGE_TTL_MS = 5 * 60 * 1000;
const CHALLENGE_MAX = 5000;

function maakCeremonieOpslag({ max = CHALLENGE_MAX, ttlMs = CHALLENGE_TTL_MS, nu = () => Date.now() } = {}) {
  const waarden = new Map();
  const grens = Math.min(CHALLENGE_MAX, Math.max(1, Math.floor(Number(max) || CHALLENGE_MAX)));
  const eersteWeg = () => {
    const eerste = waarden.keys().next();
    if (!eerste.done) waarden.delete(eerste.value);
  };
  function ruimVerlopen(tijd) {
    for (const [sleutel, waarde] of waarden) {
      if (waarde.tot > tijd) break;
      waarden.delete(sleutel);
    }
  }
  function zet(sleutel, challenge, extra) {
    const tijd = nu();
    ruimVerlopen(tijd);
    // opnieuw uitgeven voor dezelfde sleutel hoort achteraan in de aflooprij
    waarden.delete(sleutel);
    while (waarden.size >= grens) eersteWeg();
    waarden.set(sleutel, { ...(extra || {}), challenge, tot: tijd + ttlMs });
  }
  function pak(sleutel) {
    const tijd = nu();
    ruimVerlopen(tijd);
    const waarde = waarden.get(sleutel);
    waarden.delete(sleutel);             // ook een foute/late poging is eenmalig
    return waarde && waarde.tot > tijd ? waarde : null;
  }
  return { zet, pak, aantal: () => waarden.size };
}

module.exports = { maakCeremonieOpslag };
