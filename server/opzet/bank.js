/* Bankregie, bevoegdheid en bank worden als één keten aangesloten.
   Wallet-plafonds en geldnaden blijven bij de eigenaar ná alle domeinen. */
module.exports = (kern, ctx) => {
  const { db, save, bijeen, economischeBoekingEenmaal, crypto, schoon, betaal,
    keyVanCodenaam, accounts, sseToCustomer, sseToOffice, anthropic, betaalOpdrachten } = ctx;
/* Bankregie (kern/bankregie.js): de geldinfrastructuur-knop van de boardroom --
   een schakelaar met DRIE standen (partner -> hybride -> eigen) die bepaalt hoe
   RTG Bank clearet: via de externe kaart-naad, als eigen emissie, of allebei.
   Eerst gemount zodat de bank en de kantoor-routes dezelfde regie delen. */
const bankregie = require('../kern/bankregie').maakBankregie({ db, save, bijeen });
Object.assign(kern, bankregie);
/* De BEVOEGDHEID (kern/bevoegdheid.js): de zesde as naast de vijf van de
   functieschakelaars. Die vijf gaan over wie de gebruiker is en wat de beheerder
   heeft uitgezet; deze gaat over wat RTG zelf mag. Hij leest wat er in de
   boardroom is vastgelegd en welke rail nu clearet -- dezelfde SEPA is een
   partnerhandeling of eigen werk, en dat verschil bepaalt het antwoord. */
const bevoegd = require('../kern/bevoegdheid').maakBevoegdheid({
  vergunning: bankregie.bankVergunning,
  partnerRails: bankregie.bankPartnerRails,
  clearing: bankregie.bankClearing,
  /* De terugstortstand bepaalt WELK GEZICHT de vermogens WALLET_SALDO en
     LID_UITBETALING hebben: gesloten circuit (een besluit, beperkt netwerk) of
     inwisselbaar saldo (een rail met een e-geldvergunning). Een schakelaar die
     de juridische positie verandert, hoort die verandering ook meteen in de
     bevoegdheidsvraag te laten doorwerken -- anders is hij een manier om
     eromheen te komen. */
  terugstorting: bankregie.bankTerugstorting,
  /* DE ANDERE SCHAKELAARS, op naam (de beurs, en de cadeaubon van C14). Elk
     vermogen hangt aan zijn eigen `hangtAf`: ze heten allemaal `gesloten` en
     `open`, dus zonder deze kaart zou er een stilletjes de bankknop lezen.
     Ontbreekt er een, dan geldt `gesloten`: bij twijfel beweegt er geen geld. */
  standen: { rugdekkingBeurs: () => kern.rugdekking.beursStand(), cadeaubon: () => kern.cadeaubonStand() }
});
kern.bevoegd = bevoegd;
/* DE TERUGSTORTING AANSLUITEN OP DE BEVOEGDHEID. Sinds leden hun saldo kunnen
   terugstorten is walletsaldo elektronisch geld (zie de kop van WALLET_SALDO in
   kern/bevoegdheid/lijst.js), en die handeling mag alleen als LID_UITBETALING
   open staat. Zonder deze regel vraagt niemand dat, en dan weigert
   kern/pay/terug.js elke terugstorting -- dat is de veilige kant, maar het is
   niet de bedoeling. Late binding, want bevoegdheid wordt na pay gemount. */
if (kern.pay && kern.pay.koppelBevoegdTerug) kern.pay.koppelBevoegdTerug(id => bevoegd.mag(id));
/* EN DE RUGDEKKING AANSLUITEN. Zonder deze regel valt kern/rugdekking/beurs.js
   terug op zijn eigen schakelaar en weegt niemand de RAIL mee: dan legt het
   kantoor een beurs vast die RTG niet kan uitbetalen. Dezelfde late binding en
   dezelfde reden als de terugstorting hierboven. */
if (kern.rugdekking && kern.rugdekking.koppelBevoegd) kern.rugdekking.koppelBevoegd(id => bevoegd.mag(id));
/* RTG Bank (kern/bank): de eigen bank, gebouwd OP het RTG Pay-grootboek en met
   dezelfde dubbele-boekhoud-tucht -- rekeningen met een echt IBAN, storten (langs
   de 3-standen knop), overboeken, de brug van/naar de wallet, uitgaande SEPA achter
   de betaal-naad, en sparen met rente. Klaar om met een knop de eigen bank te worden. */
Object.assign(kern, require('../kern/bank')({ db, save, bijeen, economischeBoekingEenmaal, crypto, schoon, betaal, pay: kern.pay, bankregie, keyVanCodenaam, accounts, sseToCustomer, sseToOffice, anthropic, betaalOpdrachten, betaalWaarheid: kern.betaalWaarheid }));
  return { bankregie };
};
