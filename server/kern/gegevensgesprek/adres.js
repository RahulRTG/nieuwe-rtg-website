/* Gegevensgesprek (deelmodule): het adreswerk.

   Apart omdat gegevensgesprek.js met de adresstap erbij over de 10 KB kwam, en
   keuringsregel 13 zegt daarover dat zo'n bestand meestal een tweede onderwerp
   draagt. Dat klopt hier: de rest van dat bestand gaat over het gesprek zelf --
   wie vraagt wat, en wanneer -- en dit gaat over waar een adres landt. */

function maakAdreshulp({ onboarding }) {
  /* Het adres in het onboardingprofiel bijschrijven, met dezelfde functie
     waarmee de intake dat deed -- een tweede schrijver zou een tweede waarheid
     zijn (LAT.md regel 4). Alleen adres en woonplaats: die twee hebben een
     lezer (het scherm van het lid en kern/ledenregister.js). Postcode en land
     schrijven we NIET mee; niets leest ze, en wat niets leest bewaren we niet.
     De kluis (member_state.adres) is al gevuld voordat dit gebeurt, dus een lid
     dat halverwege afhaakt houdt zijn bezorgadres -- alleen de stad ontbreekt
     dan, en dat is het eerlijke gevolg van een afgebroken gesprek. */
  function bewaarAdres(sessie, adres, plaats) {
    if (!onboarding || !onboarding.slaOp) return;
    /* Gaat dit mis, dan is het bezorgadres wel bewaard en de stad niet -- stil
       precies het verlies dat deze functie moest voorkomen. Dus luid melden
       (LAT.md regel 5); de bezorging zelf mag er nooit op stukvallen. */
    try { onboarding.slaOp('rtg', sessie, { adres, woonplaats: plaats }); }
    catch (e) { require('../../log').log.uitzondering(e, { bron: 'gegevensgesprek-adres' }); }
  }
  return { bewaarAdres };
}

module.exports = { maakAdreshulp };
