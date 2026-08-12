/* ============================================================================
   DUURZAAM VASTLEGGEN -- een mutatie die pas telt als de opslag hem BEVESTIGT.

   WAAROM DIT BESTAAT. De gewone save() is write-behind: hij plant een
   schrijfactie en keert meteen terug. Voor afgeleide toestand (caches, tellers,
   indexen) is dat precies goed. Voor werk van een lid niet, en de ketenronde
   weerlegde de belofte die eronder lag: een notitie werd met 200 bevestigd en
   was na een herstart weg (KETENS.json, verraad `schrijf-verloren` -- STIL
   VERLIES). Een bevestiging die de opslag nog niet heeft gedaan is een leugen,
   ook als het om een boodschappenlijstje gaat.

   WAAROM HIER EN NIET IN ELKE APP. De reikwijdte in GELDLAT.md is "geld en
   alles wat een lid zelf maakt": notities, agenda, bestanden, berichten. Vier
   apps met elk hun eigen kopie van deze zes regels is vier plekken die een
   waarheid vasthouden (LAT.md, regel 4), en de eerste die uit de pas loopt doet
   dat stil. Dus een plek, en de apps bedraden hem.

   WAT HIJ NIET IS. Geen "veilige save" die je overal neerzet. De aanroepplekken
   staan met een reden per regel op de lijst van `npm run check` regel 47, en die
   regel kijkt ook naar de naam van dit bestand -- zonder dat zou een app hem
   kunnen requiren zonder dat de poort iets zegt.

   BEVESTIGBAAR EN DUURZAAM ZIJN TWEE DINGEN. Een opslag die niet kan tellen
   (geheugen) mag geen mutatie laten mislukken -- dat brak eerder vier
   geldtoetsen -- maar mag evenmin doorgaan voor bewijs. Dat verschil zit in
   db/saveDuurzaam(); hier gooit de bundel alleen waar bevestigen mogelijk is.
   ========================================================================== */
'use strict';

/* `bron` is de app-naam voor het log. `bijeen` en `save` komen uit db/index.js.

   Geeft een functie terug die een SYNCHRONE mutatie aanneemt en `null` teruggeeft
   als het is vastgelegd, of een foutantwoord ({status, error}) als de opslag het
   niet kon bevestigen. Die vorm is met opzet: de aanroeper kan hem rechtstreeks
   teruggeven en kan hem niet per ongeluk negeren zoals een boolean. */
module.exports = function maakVastleggen({ bijeen, save, bron }) {
  /* Zonder de bundel zou een app terugvallen op de gewone write-behind save() en
     weer 200 zeggen over iets wat de opslag nog niet heeft gedaan. Een
     ontbrekende afhankelijkheid hoort hier luid te zijn: dit is opstarttijd. */
  if (typeof bijeen !== 'function' || typeof save !== 'function') {
    throw new Error('duurzaam vastleggen heeft db.bijeen en db.save nodig (zie GELDLAT.md).');
  }
  const naam = bron || 'app';
  return async function vastleggen(mutatie) {
    try {
      await bijeen(async () => { mutatie(); save(); }, { duurzaam: true });
    } catch (e) {
      /* Niet stil (LAT.md, regel 5): het lid krijgt een nee, en waarom de opslag
         niet bevestigde hoort in het log -- anders is een app die 503'en
         uitdeelt niet te onderscheiden van een app die het druk heeft. */
      console.warn('[' + naam + '] de duurzame commit is niet vastgelegd:', e && e.message);
      return { status: 503, error: 'Dit is niet vastgelegd; probeer het zo nog een keer.' };
    }
    return null;
  };
};
