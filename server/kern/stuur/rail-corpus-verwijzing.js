/* EEN SELECTIE ZEGT WELK OBJECT, NOOIT WAT ERMEE MOET.

   Drie zinnen op DEZELFDE context, en het verschil is of de zin een WERKWOORD
   draagt. Dat is de hele bewering van dit bestand, en zij is scherper dan zij
   lijkt: wie een selectie als opdracht leest, laat een aanwijzende muisklik een
   handeling worden.

     "deze"          een aanwijzing zonder werkwoord. De context zegt WELK
                     document; niemand heeft gezegd wat ermee moet. Vragen.
     "open hem"      hetzelfde scherm, maar nu draagt de zin het werkwoord.
                     Dan is er wel een opdracht, en die komt tot `tonen`.
     "leg dit uit"   een actief object in plaats van een selectie, en een vraag
                     om KENNIS in plaats van om gegevens. Er hoeft niets uit dit
                     huis gehaald te worden, dus er gebeurt niets.

   DE DERDE DOET NOG IETS. Hij draagt een VERWIJZING (soort + id) in plaats van
   een tekstselectie, en die verwijzing komt vandaag op `ONOPGELOST` uit: er is
   geen opzoeker bedraad, dus hij wordt nooit canoniek. Dat is met opzet
   zichtbaar in het register -- een verwijzing die niet is opgelost, mag nooit
   als bruikbaar object langskomen (./menscontext-ref.js).

   DE SLEUTELS STAAN HIER LETTERLIJK, net als in de andere contextbestanden. Ze
   zijn EEN KEER afgeleid met de echte handtekening() en daarna overgenomen. */
'use strict';

const verhelder = (projectie) => ({ stappen: [], projectie });

module.exports = {

  /* 1. AANWIJZEN IS GEEN OPDRACHT. */
  'deze actieve context scherm rtg kluis deel documenten selectie paspoort 2026':
    verhelder('Ik zie dat je Paspoort 2026 hebt geselecteerd. Wat wil je ermee -- bekijken, ' +
      'delen of iets anders?'),

  /* 2. HETZELFDE SCHERM, MAAR NU MET EEN WERKWOORD. De kaart wordt opgehaald --
        daaraan is te zien dat de contextwoorden de echte resolver bereiken --
        en dan wordt er gelezen. Niet meer dan dat: openen is kijken. */
  'open hem actieve context scherm rtg kluis deel documenten selectie paspoort 2026':
    { stappen: [
        { tools: [{ name: 'kaart', input: {} }] },
        { tools: [{ name: 'doe', input: { pad: '/api/asset/mijn',
          zeker: true, begrepen: 'het geselecteerde document van dit lid opzoeken om te tonen',
          body: {} } }] }],
      projectie: 'Dit is Paspoort 2026.' },

  /* 3. EEN VRAAG OM KENNIS, NIET OM GEGEVENS. "Leg dit uit" vraagt wat een
        document BETEKENT, en daarvoor hoeft er niets uit dit huis gehaald te
        worden. Geen enkele tool, dus geen enkele poort die nee hoefde te zeggen
        -- en de verwijzing in de context blijft onopgelost, precies zoals het
        hoort zolang er geen opzoeker bedraad is. */
  'leg dit uit actieve context scherm rtg kluis deel documenten 1 verwijzing naar document':
    verhelder('Een paspoort is je reisdocument: het bewijst wie je bent en waar je vandaan ' +
      'komt, en de geldigheidsdatum bepaalt tot wanneer je ermee kunt reizen.')

};
