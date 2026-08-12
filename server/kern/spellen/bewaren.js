/* Spellen (deelmodule): WAT EEN POTJE OVERLEEFT.

   Vier lagen met EEN vraag -- wat blijft er staan als de partij voorbij is:

     telling      geaggregeerd, zonder personen
     uitslagen    wie won, achter de progressiegrens
     prestaties   afgeleid uit de uitslagen; alleen wat behaald is
     loopbaan     wat er van een MENS overblijft (VERHAAL.md)

   Afgesplitst van ../spellen.js, dat de hele spellenlaag bedraadt en op de
   10 kB-grens stond. Hij knelde toen de loopbaan erbij kwam, en dat is precies
   waar die grens voor is: een bestand dat er net boven komt draagt een tweede
   onderwerp. Dit is dat onderwerp.

   DE VOLGORDE IS GEDRAG EN GEEN SMAAK. `telPotje` gaat in `noteerUitslag`, en
   `spelStand` (uit de uitslagen) voedt de prestaties. */
'use strict';

module.exports = (ctx) => {
  const { db, save, nu, codenaamVan, progressieMag, GEEN_PROGRESSIE } = ctx;

  /* Uitslagen die een potje overleven: de bron onder winrate, niveaus en
     toernooien. Deelnemers buiten de progressiegrens staan er zonder codenaam
     in; speelde niemand binnen de grens mee, dan wordt er niets bewaard. Zie
     spellen/uitslagen.js. */
  /* Telemetrie: geaggregeerd, zonder personen. Hangt aan `noteerUitslag` en
     niet aan de twee einden van een potje -- een plek, en meteen dezelfde
     idempotentie. Zie spellen/telling.js voor waarom dit NAAST de uitslagen
     staat en er niet uit wordt afgeleid. */
  const { telPotje, spelTelemetrie } = require('./telling')({ db, save, nu, SOORTEN: ctx.SOORTEN });

  const { noteerUitslag, spelUitslagen, spelStand } = require('./uitslagen')({
    db, save, codenaamVan, nu, progressieMag, telPotje
  });

  /* De loopbaan: wat er van een MENS overblijft als het potje voorbij is (zie
     VERHAAL.md en de kop van spellen/loopbaan.js). Naast de uitslagen, want
     alles wat een potje OVERLEEFT hoort hier. */
  const loopbaan = require('./loopbaan')({
    db, save, codenaamVan, progressieMag, GEEN_PROGRESSIE
  });


  /* Prestaties, ook afgeleid uit de uitslagen: alleen wat behaald is, geen
     voortgang naar wat je "nog moet", en geen reeksen. Zie de kop van
     spellen/prestaties.js voor waarom dat drie bewuste keuzes zijn. */
  const { spelPrestaties } = require('./prestaties')({
    spelStand, naamVanSpel: (soort) => ctx.SOORTEN[soort] || null
  });

  /* En de STAD (fase C): wat een campagne aan de stad toevoegt blijft staan als
     de campagne voorbij is. Hij hoort in deze rij omdat hij dezelfde vraag
     beantwoordt -- wat blijft er staan -- maar hij staat BUITEN de 18+-poort,
     en die uitzondering is dezelfde als die van de dagtelling: er staat geen
     persoon in. Zie de kop van ./stadsgeheugen.js. */
  const stadsgeheugen = require('./stadsgeheugen')({ db, save });
  /* MAGNAAT DAILY (./stadskrant.js): de stad van vandaag in woorden. Hij hoort
     hier omdat hij van het stadsgeheugen leeft en verder van niets -- en om
     dezelfde reden valt hij buiten de 18+-poort: er staat geen persoon in. Hij
     BEWAART niets: een editie wordt gerekend, niet opgeslagen. */
  const daily = require('./stadskrant')({ stadsgeheugen });

  /* DE LOKALE ONDERNEMERSKRING (fase D): wie er in een stad een zaak had. Naast
     het stadsgeheugen, maar met een STRENGERE grens -- daar staat geen persoon
     in en hier wel, dus geldt de 18+-poort per persoon. Zie de kop van
     ./ondernemerskring.js, en vooral de regel dat hij GEEN contactenlijst is:
     een potje geeft geen nieuw recht om iemand te bereiken. */
  const ondernemerskring = require('./ondernemerskring')({
    db, save, progressieMag, GEEN_PROGRESSIE
  });

  return { telPotje, spelTelemetrie, noteerUitslag, spelUitslagen, spelStand,
    spelPrestaties, loopbaan, stadsgeheugen, daily, ondernemerskring };
};
