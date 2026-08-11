/* Hospitality Guest OS (kern): DE KLANTNAAD -- wie is deze gast, wat de
   rekening betreft.

   WAAROM DIT EEN EIGEN BESTAND IS. De gastkant heeft vijf kanalen en die
   bewijzen elk op hun eigen manier dat je ergens bij hoort: de sticker op tafel
   (een QR-sleutel), thuis (je ledensessie), de hotelkamer (een open
   gastrekening), de club (de code op je polsband) en de foodcourt (je
   ledensessie plus een mandje-id). Dat verschil is ECHT en hoort niet te worden
   weggepoetst tot een generieke `wieBenJij()`; het staat zo ook in de
   documentatie van gast.js.

   Maar er is één ding dat ze wél delen, en dat stond in twee routebestanden
   woordelijk hetzelfde: HOE EEN LEDENSESSIE EEN HANDLE OP EEN REKENING WORDT.
   Dat is de naad. Hij loopt over `gastId`, en op vier plekken wordt daarmee
   bepaald of een rekening van jou is (buitenshuis.js twee keer, foodcourt.js
   twee keer). Zouden bezorgen en de foodcourt die handle ooit verschillend
   maken -- iemand kort de sleutel in, of neemt de e-mail in plaats van de
   codenaam -- dan vinden je bezorgbestellingen en je foodcourt-mandje elkaar
   niet meer, en dat geeft geen enkele foutmelding. Vandaar één plek
   (LAT-regel 4).

   ER STAAT EEN CODENAAM OP EEN REKENING EN NOOIT EEN ECHTE NAAM. De handle komt
   uit de codenaam van het account; is die er niet, dan uit de laatste zes
   tekens van de sessiesleutel. Geen naam, geen e-mail, geen volledige sleutel:
   de zaak hoeft je niet te kennen om je eten te geven (CLAUDE.md, privacy by
   design). */
'use strict';

module.exports = () => {
  /* De handle van een lid op een rekening. Bewust GEEN volledige sessiesleutel:
     die staat dan in de opslag van elke zaak waar je ooit besteld hebt. Zes
     tekens is genoeg om jouw bestellingen van elkaar te onderscheiden en te
     weinig om er iets mee te doen. */
  function handleVan(session) {
    const s = session || {};
    return (s.account && s.account.codename) || ('lid-' + String(s.key || '').slice(-6));
  }

  // van een verzoek: dezelfde regel, maar dan waar de routes hem aanroepen
  const handleVanReq = (req) => handleVan(req && req.session);

  /* Is deze rekening van deze gast? Eén vraag, één antwoord, voor elke plek die
     "mijn bestellingen" toont. Een lege handle geeft NOOIT true -- anders zou
     een sessie zonder codenaam en zonder sleutel ineens alles zien. */
  const isVan = (rekening, handle) => !!handle && !!rekening && rekening.gastId === handle;

  return { handleVan, handleVanReq, isVan };
};
