/* RTMAIL (deelmodule): van een INLOG naar een ADRES.

   Klein bestand, en het staat er om een reden die groter is dan zijn omvang:
   het adres van een postvak mag maar op EEN plek worden afgeleid. Zodra er een
   tweede routebestand is dat "de codenaam op het domein van de pas" zelf
   uitrekent, kunnen die twee uiteenlopen -- en dan kijkt de ene ingang in een
   ander postvak dan de andere. Bij post is dat geen schoonheidsfout maar een
   lek.

   TWEE REGELS DIE HIER VASTLIGGEN:

   1. HET ADRES KOMT UIT DE SESSIE, NOOIT UIT DE BODY. Alle functies hier
      nemen de sessie (of de leverancier) als bron. Er is geen parameter
      waarmee een client kan zeggen wiens postvak hij wil zien.
   2. DE SOORT WORDT AFGELEID, NIET GEKOZEN. Een bewezen rol weegt zwaarder dan
      een pas (zie kern/rtmail-adres.js): wie bij RTG werkt en ook een RTG Pass
      heeft, is aanspreekbaar op zijn werkadres. */
module.exports = ({ db, rtmail, codenaamVan }) => {
  // de codenaam van het ingelogde lid; die is het linkerdeel van zijn adres
  const lidCodenaam = (req) =>
    (req.session && req.session.account && req.session.account.codename) ||
    (codenaamVan ? codenaamVan(req.session && req.session.key) : null);

  function lidSoort(req) {
    const rollen = ((db && db.data && db.data.accountRollen) || {})[req.session.key] || [];
    return rtmail.soortVoor({ tier: req.session.tier, rollen });
  }

  const lidAdres = (req) => {
    const c = lidCodenaam(req);
    return c ? rtmail.adresVoor(lidSoort(req), c) : null;
  };

  // een zaak handelt onder haar eigen code op partner.rtg
  const zaakAdres = (req) => rtmail.adresVoor('zaak', (req.supplier && req.supplier.code) || '');

  return { lidCodenaam, lidSoort, lidAdres, zaakAdres };
};
