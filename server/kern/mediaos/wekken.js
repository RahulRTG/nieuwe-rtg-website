/* Media OS (deelmodule): NIEUW WERK WEKT DE JUISTE MENSEN.

   Dit sluit de belofte die de meldingsvoorkeur eerst alleen OPSCHREEF (TAKEN.md
   4.11): je volgt een maker één keer, kiest waarvoor je gewekt wilt worden, en
   vanaf nu gebeurt dat ook echt.

   VIER MOMENTEN, en het zijn precies de momenten waarop er iets TE ZIEN is:
   een uitgave in het Klankwerk, een video waarvan de bytes binnen zijn (niet
   het aanmaken van de lege kaart), een nieuwe clip, en live GAAN op het Podium.
   De vier domeinen roepen dit zelf aan via een laat gebonden haak; ze weten
   verder niets van deze laag en werken zonder hem gewoon door.

   DRIE FILTERS, en alle drie horen ze er te zijn:

   1. WIE VOLGT ER. Die lijst komt uit de domeinen zelf (de volgerslijst van
      Clips en de abonnees van het Theaterkanaal), niet uit een eigen tabel.
   2. WAARVOOR. De voorkeur per maker en per soort uit ./eigen.js. Wie niets
      heeft gezegd krijgt alles -- dat is wat volgen betekent.
   3. DE ALGEMENE MELDINGSSCHAKELAAR. notify() zelf kijkt nog naar de scope in
      de meldingsvoorkeuren van het lid (kern/ervaring.js). Wie "media" daar
      uitzet, krijgt hier niets, en dat hoort een andere knop te zijn dan
      "welke maker": de een is een dagstand, de ander een relatie.

   WAT ER MET OPZET NIET GEBEURT. De maker wordt niet over zijn eigen werk
   gewekt. Er gaat geen melding naar wie niet volgt -- dit is geen kanaal om
   aandacht mee te kopen. En er staat geen aantal in ("3.000 mensen wachten op
   u"): dat zijn de lokkertjes die dit huis nergens gebruikt. */
'use strict';

const SOORT_NAAM = { muziek: 'nieuwe muziek', video: 'een nieuwe video', flow: 'een nieuwe korte video', live: 'nu live' };

function maakWekken({ notify, codenaamVan, meldVan, bronnen }) {
  /* De volgers van een maker: de vereniging van de twee gratis volgrelaties
     die de Media OS ook zet (Clips en het Theater). Een betaald podium-
     abonnement telt hier niet mee -- dat is een betaalrelatie en geen volg. */
  function volgersVan(makerKey) {
    const uit = new Set();
    try { for (const k of (bronnen.clipsVolgersVan ? bronnen.clipsVolgersVan(makerKey) : [])) uit.add(k); }
    catch (e) { /* een bron die stuk is mag de rest niet tegenhouden */ }
    try { for (const k of (bronnen.theaterVolgersVan ? bronnen.theaterVolgersVan(makerKey) : [])) uit.add(k); }
    catch (e) {}
    uit.delete(makerKey);
    return [...uit];
  }

  /* Geeft terug WIE er gewekt is en wie niet, met de reden erbij. Dat is niet
     voor de sier: zonder die uitslag is "er ging geen melding uit" niet te
     onderscheiden van "er is niets gebeurd", en dat is precies de stilte waar
     LAT.md regel 5 over gaat. De toetsen lezen hem ook. */
  function nieuwWerk(makerKey, soort, titel) {
    if (!makerKey || !SOORT_NAAM[soort]) return { gewekt: [], overgeslagen: [] };
    const codenaam = codenaamVan ? codenaamVan(makerKey) : null;
    if (!codenaam) return { gewekt: [], overgeslagen: [] };
    const gewekt = [], overgeslagen = [];
    for (const volger of volgersVan(makerKey)) {
      const soorten = meldVan(volger, codenaam);
      if (!soorten.includes(soort)) { overgeslagen.push({ key: volger, reden: 'wil geen ' + soort + ' van deze maker' }); continue; }
      try {
        notify(volger, {
          title: 'RTG Media',
          body: codenaam + ': ' + SOORT_NAAM[soort] + (titel ? ' -- "' + titel + '"' : '') + '.',
          scope: 'media'
        });
        gewekt.push(volger);
      } catch (e) {
        overgeslagen.push({ key: volger, reden: 'melden mislukte: ' + (e && e.message ? e.message : 'onbekend') });
      }
    }
    return { gewekt, overgeslagen, soort, maker: codenaam };
  }

  return { mediaNieuwWerk: nieuwWerk, mediaVolgersVan: volgersVan, MEDIA_SOORT_NAAM: SOORT_NAAM };
}

module.exports = { maakWekken, SOORT_NAAM };
