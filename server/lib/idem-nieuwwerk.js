/* NIEUW WERK IN DE IDEM-LAAG (./idem.js): de vrijgavepoort, en waar hij staat.

   `poort` (bij maakIdem, een functie): de VRIJGAVEPOORT voor nieuw werk
   (server/kern/vrijgave/). Hij krijgt de opties van de aanroep en geeft null
   (mag) of een antwoord ({status, error, code}) dat ongewijzigd teruggaat. Zijn
   plek in de volgorde is het hele punt:

     1. eerst de HERHALING. Een bewaard antwoord op dezelfde sleutel komt terug,
        en een verzoek dat op een lopende vlucht wacht krijgt diens antwoord --
        ook als de capability intussen dicht staat. Uitzetten mag de
        geschiedenis niet beschadigen (een lid dat na de noodstop zijn
        bevestiging opnieuw opvraagt, krijgt hem), en weer AANZETTEN mag niets
        opnieuw uitvoeren (de herhaling raakt het werk nooit).
     2. dan de poort, en pas daarna het werk. Ook zonder sleutel: werk zonder
        sleutel is nog steeds nieuw werk.

   Een aanroep die GEEN nieuw werk is maar iets afwikkelt dat al vaststond (een
   teruggave, een terugbetaling, een correctie die geld terugzet), verklaart dat
   met `opties.afwikkeling` (een reden, als tekst). De poort van de idem-laag
   slaat dan over; een poort die de AANROEPER zelf meegeeft (`opties.poort`)
   draait altijd. Een noodstop houdt nieuw geld tegen en laat geld dat terug
   moet, gewoon teruggaan.

   `opties.poort` (per aanroep): een extra poort voor DEZE aanroep (een eigen
   capability, zoals geld.opwaarderen naast het interne saldo). Draait NA de
   poort van de laag; hij kan er niets mee openen, alleen erbij sluiten.

   Een poort die GOOIT, zegt geen ja: dicht, met de veilige code van de
   vrijgavepoort. */
'use strict';

function maakPoortVoorNieuwWerk(poort) {
  return function poortVoorNieuwWerk(opties) {
    const o = opties || {};
    const lijst = [];
    const afwikkeling = typeof o.afwikkeling === 'string' && o.afwikkeling.trim().length > 0;
    if (typeof poort === 'function' && !afwikkeling) lijst.push(poort);
    if (typeof o.poort === 'function') lijst.push(o.poort);
    for (const p of lijst) {
      let w;
      try { w = p(o); }
      catch (e) { return { status: 503, code: 'tijdelijk-uit', error: 'Deze functie staat tijdelijk uit. Er is niets uitgevoerd.' }; }
      if (w) return w;
    }
    return null;
  };
}

module.exports = { maakPoortVoorNieuwWerk };
