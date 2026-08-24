/* WIE HEEFT ER BETAALD, EN VANAF WELKE REKENING?

   Een geslaagde betaling weet bij sommige aanbieders ook vanaf welk IBAN hij
   kwam. Dat gegeven heeft in dit huis precies EEN toepassing:
   kern/pay/uitbetaalrekening.js laat de wachttijd op een uitbetaalrekening
   vervallen wanneer een lid zijn geld terugvraagt naar de rekening waarvandaan
   hij het heeft opgeladen. Bewezen eigendom, dus geen wachttijd.

   WAT ER NIET MEE MAG GEBEUREN, en dat is de belangrijkste zin hier: dit veld
   ZET NOOIT een bestemming. Het bevestigt alleen een IBAN dat het lid zelf heeft
   ingevoerd -- kern/pay/uitbetaalrekening.js weigert als het niet overeenkomt.
   Zou een providerantwoord een uitbetaalbestemming kunnen aanmaken, dan is een
   nagebootste of gecompromitteerde melding genoeg om geld om te leiden, en dan
   is de hele wachttijd een slot naast een openstaande achterdeur.

   WAT WELKE AANBIEDER GEEFT, en waarom niet alle drie:

     mollie  `details.consumerAccount` bij iDEAL, bankoverboeking en
             SEPA-incasso: het VOLLEDIGE IBAN plus de tenaamstelling. Bruikbaar.
     stripe  geeft bij iDEAL alleen `iban_last4`. Vier cijfers zijn geen IBAN en
             mogen er ook niet voor doorgaan: een gedeeltelijke match is geen
             bewijs van eigendom. Dus: niets.
     adyen   levert het IBAN in de notificatie (`additionalData.iban`), niet op
             het paymentLink-object dat ./ontvangst.js ophaalt. Zou hier passen
             zodra de notificatie-afhandeling het doorgeeft; nu niet.

   Dat verschil staat er met zoveel woorden in plaats van als stilte, want "geen
   betalerIban" leest anders als een storing terwijl het bij twee van de drie de
   normale uitkomst is.

   EIGEN BESTAND omdat ./ontvangst.js er anders over de keuringsgrens van 10240
   byte gaat -- en omdat dit een eigen onderwerp is: transport en providerkeuze
   wonen daar, dit gaat over wat je uit een antwoord mag AFLEIDEN. */
'use strict';

const IBAN = /^[A-Z]{2}[0-9]{2}[A-Z0-9]{10,30}$/;

function betalerVan(details) {
  const d = details || {};
  const iban = String(d.consumerAccount || '').replace(/\s+/g, '').toUpperCase();
  if (!IBAN.test(iban)) return {};
  return { betalerIban: iban, betalerNaam: String(d.consumerName || '').slice(0, 70) || null };
}

module.exports = { betalerVan };
