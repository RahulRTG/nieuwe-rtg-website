/* DE WAARDEPOORT: de vraag die VOOR elke boeking gesteld hoort te worden.

   In ./index.js stond een regel die zei "heeft deze rekening genoeg?", en dat
   bleef lang de enige vraag -- terecht, want er was maar EEN soort waarde: een
   getal op lid:<codenaam>. Zodra een werkgeversbudget, een gemeentetegoed of
   een cadeaubon hetzelfde grootboek gebruikt, is genoeg saldo de verkeerde
   vraag geworden: het zegt niets over of DIT tegoed hier voor bedoeld was.

   De oude regel blijft letterlijk staan en gaat als eerste. Hij is de bodem die
   er ook is als de waardelaag niet gemount is -- en dat is geen theorie: deze
   laag is optioneel, en een optionele laag die stilzwijgend een controle
   meeneemt, neemt hem weg zodra iemand hem niet mount.

   De poort komt daar bovenop en is strenger op drie punten:
     - gereserveerd geld telt niet als beschikbaar (kern/waarde/reserve.js);
     - het beleid van de uitgever en van de houder geldt (kern/waarde/policy.js);
     - de ontvangende wallet heeft een plafond (kern/waarde/index.js).

   WAAROM DIT EEN EIGEN BESTAND IS. ./index.js stond op 10414 byte na deze
   toevoeging, over de grens van 10240 uit de keuring. Dit is de naad met de
   minste bedrading eroverheen -- er gaan twee functies in en er komt een
   oordeel uit -- en het is dezelfde reden waarom ./stand.js bestaat. */
'use strict';

module.exports = ({ saldoVan, waarde }) => {
  /* `genre` en `dagBesteed` reizen mee met de boeking en worden hier
     doorgegeven, want zonder die twee kan de poort een beleidsregel niet
     toetsen -- en een poort die de helft van het beleid niet kent, keurt de
     andere helft ten onrechte goed.

     Dat is geen theorie: de samensteller (kern/waarde/samenstellen.js) koos een
     maaltijdbudget omdat hij WEL wist bij wat voor zaak er betaald werd, en de
     poort weigerde dezelfde boeking omdat hij het niet wist. Twee lagen die
     hetzelfde beleid toetsen op verschillende gegevens, geven verschillende
     antwoorden -- en de strengste wint, dus de betaling ketste af. */
  return function waardePoort({ van, naar, centen, soort, genre, dagBesteed }) {
    if (!van.startsWith('extern:') && saldoVan(van) < centen) return { status: 402, error: 'Onvoldoende saldo.' };
    if (!waarde) return null;
    return waarde.poort({ van, naar, centen, soort, genre, dagBesteed, saldoVan });
  };
};
