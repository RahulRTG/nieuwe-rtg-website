/* De automatiseringen ("draaiboeken") van RTG: kleine, herbruikbare stappen die
   over de RTMAIL-rail lopen. Elk draaiboek BEREIDT VOOR en BERICHT; alles wat
   geld uitgeeft of toegang/een baan verleent blijft langs de bestaande poorten
   lopen waar een mens beslist -- zo blijft de automatisering risicoloos.

   Privacy by design: RTMAIL draait op codenamen. De draaiboeken zetten daarom
   geen echte namen in de berichten (die blijven in de kluis); een welkomstwoord
   is warm maar zonder naam.

   Dit begint met het welkom-draaiboek voor elk nieuw lid (RTG en RTF). Volgende
   draaiboeken (personeel, inkoop, facturen, overheid) komen hier stap voor stap
   bij, elk met een eigen test. */
module.exports = ({ rtmail }) => {
  // Een nieuw lid krijgt meteen een welkom in zijn eigen RTMAIL-postvak. Geeft
  // het bezorgde bericht terug (of null als er geen bruikbaar adres is).
  function welkomLid({ codename, wereld } = {}) {
    const adres = rtmail.normAdres(codename);
    if (!adres) return null;
    const merk = wereld === 'RTF' ? 'de RTFoundation' : 'Rahul Travel Group';
    const tekst = 'Welkom bij ' + merk + '. Je account staat live en dit is je eigen RTMAIL-postvak ' +
      'binnen het platform -- hier houd ik je op de hoogte en regel ik dingen voor je. Fijn dat je er bent. -- Rahul';
    return rtmail.systeemStuur(adres, 'Welkom bij ' + merk, tekst, 'welkom');
  }

  // Personeel-draaiboek: een nieuwe sollicitatie zet een seintje in het RTMAIL-
  // postvak van de zaak. Codenaam-privacy: geen echte naam, alleen de codenaam
  // en de functie; de kandidaat en het cv staan in de sollicitatie-lijst. Het
  // aannemen (een baan geven) blijft de zaak zelf, langs de bestaande poort.
  function sollicitatieBinnen({ zaakCode, functie, codename } = {}) {
    const adres = rtmail.normAdres(zaakCode);
    if (!adres) return null;
    const f = functie ? (' als ' + String(functie).slice(0, 60)) : '';
    const wie = codename ? ' (codenaam ' + String(codename).slice(0, 40) + ')' : '';
    const tekst = 'Er is een nieuwe sollicitatie binnen' + f + wie + '. Bekijk de kandidaat en het cv ' +
      'bij Team / sollicitaties. Aannemen of afwijzen beslist u zelf.';
    return rtmail.systeemStuur(adres, 'Nieuwe sollicitatie', tekst, 'personeel');
  }

  return { welkomLid, sollicitatieBinnen };
};
