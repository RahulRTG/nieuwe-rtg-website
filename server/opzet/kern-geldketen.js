/* DE BESLISLAAG EN DE GOUDEN WEG -- opgehangen, niet uitgevonden.

   AFGESPLITST VAN ./kernlaag3c.js omdat die over de 10 KB ging. De naad is echt:
   kernlaag3c bouwt de COMMERCIELE KERN (de ronde, het abonnement, de tegoeden,
   de handhavingsregels) en dit bestand hangt er twee dingen aan die daar bovenop
   staan -- wie iets mag, en langs welke baan een geldhandeling gaat.

   WAAROM ZE SAMEN IN EEN BESTAND ZITTEN: de baan kan niet wegen zonder besluit, en
   het besluit had tot deze ronde geen bron. Ze los ophangen zou de volgende lezer
   laten denken dat het twee losse voorzieningen zijn.
*/
'use strict';

module.exports = ({ kern, voornemens, token, eigen }) => {
  /* DE BESLISLAAG, EN WAAROM ZIJ HIER PAS KOMT. kern/commercie/besluit.js kon
     alles behalve beginnen: `zoekBevoegdheid` werd nergens gevuld, dus `kern.beslis`
     bestond niet en de keuring van een voornemen kwam nooit tot een besluit. De
     bron staat nu in kern/kantoor/geldbevoegdheid.js -- een GESLOTEN lijst die
     opschrijft wat vandaag al mag, met per regel het adres van de bestaande grens.
     Hij verleent niets; hij maakt weegbaar wat in een router stond.

     `munt` is de tokenmunter van hierboven: een ja dat alleen in het besluit
     bestaat, moet elke volgende stap opnieuw worden gevraagd -- met een bewijstoken
     draagt de aanroeper het besluit mee. */
  const geldbesluit = require('../kern/kantoor/geldbevoegdheid').maakBeslis({ munt: token.munt });

  /* DE GOUDEN WEG (MACHINE.md): de baan waarlangs een geldhandeling langs alle
     motoren van dit huis loopt. Geen zeventiende motor -- de ORDE waarin de
     zestien bestaande elkaar raken, met per as een uitslag en een graad. */
  const geldketen = require('../kern/kantoor/geldketen').maakGeldketen({
    voornemens, bak: (naam) => eigen.bak(naam),
    /* DE FRICTIEMOTOR KOMT LUI BINNEN, en dat is geen omweg maar de enige juiste
       vorm. `kern/frictie` is een FABRIEK (`maakRisico({ beleid })`) en de motor
       kan niet bestaan zonder het beleidsregister dat kern/command bouwt -- en dat
       gebeurt in opzet/aanbouw.js, dus NA deze laag. De module hier meegeven leek
       te werken en deed niets: een module heeft geen `beoordeel`, dus de baan zou
       de frictie-as stil op `onbekend` zetten. Nu wordt de echte motor bij het
       VERZOEK opgehaald, en is hij er dan niet, dan staat dat in het dossier. */
    frictie: () => (kern.command && kern.command.risico) || null });

  /* DE BRUG NAAR DE EFFECTBON, EN DEZE LAAG IS DE ENIGE PLEK WAAR DIE MAG LIGGEN.
     server/effectbon.js observeert wat een verzoek werkelijk veroorzaakte en wil dat
     tegen de VOORSPELLING houden; die voorspelling woont in deze keten. Kern hoort
     niets naar de serverlaag te duwen en de bon hoort niet te weten dat er een
     geldketen bestaat -- dus geeft opzet, dat beide kent, een zuiver lezende functie
     mee. Zelfde vorm als de frictiemotor hierboven: niet een module, maar precies de
     ene functie die nodig is.

     Hangt hij er niet in (een kale opzet, een unittoets), dan draagt de bon geen
     nameting. Dat is geen fout: dan heeft niemand iets voorspeld. */
  require('../effectbon').zetVoorspeller((verzoek) => geldketen.voorspellingVan(verzoek));

  return { beslis: geldbesluit.beslis, geldbevoegdheden: geldbesluit.LIJST, geldketen };
};
