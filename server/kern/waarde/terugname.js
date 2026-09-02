/* ============================================================================
   EEN REGISTRATIE TERUGNEMEN -- het enige in deze laag dat iets WEGHAALT.

   Waarom hij er is: kern/pay/budget.js zet eerst de positie klaar en boekt
   daarna. Faalt de boeking, dan bleef er een lege positie achter -- en dat
   stond daar als een bewuste keuze, met de redenering "kost niemand geld,
   verwarrend hooguit". Die redenering miste een tweede regel: ./uitgifte.js
   laat maar 25 open posities per lid toe. Gemeten op 31 augustus 2026: 24
   mislukte pogingen van EEN werkgever met te weinig saldo, en daarna krijgt
   dat lid van NIEMAND meer een budget -- "Dit lid heeft te veel open
   posities". Twee besluiten die elk apart kloppen en samen een lid
   buitensluiten.

   Waarom hij zo smal is: een grootboek hoort niet te kunnen vergeten. Deze
   module neemt daarom alleen een REGISTRATIE terug, nooit een boeking, en de
   aanroeper moet AANTONEN dat er nooit geld op stond -- de waardelaag houdt
   zelf geen saldo bij (zie de kop van ./index.js) en kan dat dus niet zien.
   Wie hem aanroept zonder dat bewijs krijgt een weigering en geen stilte.

   Drie weigeringen, en alle drie zien ze zakken bij een mutatie
   (test/budgetterugname.test.js): geen positie, geen bewijs, en saldo dat niet
   nul is. */
'use strict';

module.exports = ({ posities, positie, save }) => {
  function registratieTerug(rek, { saldoCenten } = {}) {
    if (!rek) return { status: 400, error: 'Welke rekening?' };
    if (!posities()[rek]) return { status: 404, error: 'Deze positie is niet geregistreerd.' };
    if (saldoCenten === undefined || saldoCenten === null) {
      return { status: 400, error: 'Toon aan dat deze positie leeg is; deze laag houdt geen saldo bij.' };
    }
    if (Math.round(Number(saldoCenten)) !== 0) {
      return { status: 409, error: 'Op deze positie staat geld; een registratie met saldo wordt niet teruggenomen.' };
    }
    delete posities()[rek];
    save();
    return { ok: true, teruggenomen: rek };
  }

  return { registratieTerug };
};
