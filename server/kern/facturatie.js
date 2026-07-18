/* De centrale facturatielaag: bij ELKE transactie (verkoop van een product of
   dienst, of een verhuur) maakt EGn functie automatisch EGn factuur die BEIDE
   partijen in hun app zien: de verkoper/verhuurder EN de koper/huurder.

   Alle apps haken hierop in via boek(): de kassa, de retail-verkoop, de
   boerderij-verkoop via de Salon, de verhuur, enzovoort. De koper wordt aan een
   RTG-lid gekoppeld als er een codenaam bij de betaling zat; anders krijgt alleen
   de verkoper een bon.

   Er is ook een AI-factuurtool: die beantwoordt vragen over de facturen EN maakt
   in gewone taal een nieuwe factuur ("maak een factuur voor Gouden Vos, 3 uur
   consult a 80 euro"). Met Claude slim, anders via de ingebouwde parser.

   maakFacturatie(state) volgt het vaste kern-patroon. Bedragen zijn in euro's
   (inclusief btw); de btw wordt teruggerekend. */

const SOORTEN = ['verkoop', 'dienst', 'huur'];
// Standaard-btw per genre: eten/drinken en agrarisch 9%, de rest 21%.
const LAAG_BTW_TYPES = ['restaurant', 'bar', 'hotel', 'groothandel', 'boerderij'];

function maakFacturatie({ db, save, crypto, findSupplier, keyVanCodenaam, notify, notifySupplier, sseToCustomer, sseToSupplier, factuur, anthropic, schoon }) {
  const nu = () => new Date().toISOString();
  const scho = schoon || ((v, n) => String(v == null ? '' : v).trim().slice(0, n || 200));
  const rond = n => Math.round((Number(n) || 0) * 100) / 100;

  /* De motor- en loketlaag draaien als submodules op een gedeelde context,
     een keer opgebouwd bij het opstarten; de motor gaat eerst de context
     in omdat het loket (o.a. de AI) boekMetCodenaam gebruikt. */
  const ctx = { db, save, crypto, findSupplier, keyVanCodenaam, notify, notifySupplier, sseToCustomer, sseToSupplier, factuur, anthropic, schoon,
    SOORTEN, LAAG_BTW_TYPES, nu, scho, rond };
  const deelMotor = require('./facturatie/motor')(ctx);
  Object.assign(ctx, deelMotor);
  const deelLoket = require('./facturatie/loket')(ctx);
  Object.assign(ctx, deelLoket);
  const { store, nummer, standaardBtw, verwerkRegels, boek, boekMetCodenaam } = deelMotor;
  const { publiek, vind, voorSupplier, voorLid, mag, pdf, bedragUit, aantalUit, codenaamUit, ai } = deelLoket;

  return { SOORTEN, boek, boekMetCodenaam, voorSupplier, voorLid, vind, mag, pdf, publiek, standaardBtw, ai };
}

module.exports = { maakFacturatie };
