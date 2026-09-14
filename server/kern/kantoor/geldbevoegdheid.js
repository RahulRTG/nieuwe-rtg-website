/* ============================================================================
   DE BEVOEGDHEID VAN HET KANTOOR BIJ EEN GELDHANDELING -- klein, gesloten, en
   met de grond erbij.

   WAAROM DIT BESTAAT, en waarom het niet groter is dan dit. `kern/commercie/
   besluit.js` is een volwaardige beslislaag: acht uitkomsten, bevoegdheid,
   dagverbruik, beleid per bedrag, een bewijstoken aan het eind. Hij had alleen
   nooit een BRON -- `zoekBevoegdheid` werd nergens gevuld, `kern.beslis` bestond
   niet, en daarmee gaf de keuring van een voornemen nooit een besluit. De hele
   commercie-kluster stond op een ontbrekende invoer.

   EN DAT GAT WAS ERGER DAN LEEG. `kern/commercie/voornemen.js` krijgt
   `beslis: (vraag) => (kern.beslis ? kern.beslis(vraag) : null)`. Die wrapper is
   ALTIJD een functie, dus de controle `if (!beslis) return 503` in de keuring
   sloeg nooit aan: hij riep hem aan, kreeg `null` terug en las daar `uitkomst`
   uit. Een TypeError op de plek waar de laag een nette 503 belooft. Niemand had
   het gevonden, want er was geen aanroeper. (De keuring vangt dat sinds deze
   ronde zelf af; zie ../commercie/voornemen/keuring.js.)

   DE GROND, EN DIT IS HET BELANGRIJKSTE VAN DIT BESTAND. Deze lijst VERLEENT geen
   macht die er niet was. Zij schrijft op wat vandaag al mag en waar dat stond:
   `/api/office/bank/incasso` hangt achter `kluisAuth` en voert via de tweede
   handtekening een incassoronde uit. Dat IS de bevoegdheid; hij stond alleen in
   een router en niet in een register, en daardoor kon niets hem wegen. Wie hier
   een regel bij zet, verplaatst geen grens maar maakt er een zichtbaar -- en wie
   hier een RUIMERE regel bij zet dan de route al toestond, doet het omgekeerde
   van wat dit bestand is.

   ER STAAT MET OPZET GEEN BEDRAGGRENS. Een plafond per handeling is een besluit
   van de eigenaar en geen getal dat een bouwer erbij verzint (KOSTEN.md: er staat
   nooit een getal waar er geen is). Wat er wel staat is het BELEID uit
   besluit.js, en dat bijt al: vanaf 500 euro een verse bevestiging, vanaf 1.000
   euro een tweede handtekening, vanaf 2.500 euro alleen als het terug kan. Die
   drie hangen aan het BEDRAG en niet aan de persoon -- ook wie ruim bevoegd is,
   tekent bij een groot bedrag niet alleen.

   DE LIJST IS GESLOTEN. Een handeling die er niet in staat, levert geen
   bevoegdheid, en `besluit.js` maakt daar ONBEKEND van -- niet WEIGEREN, want het
   verschil tussen "deze actor mag dit niet" en "we konden het niet nakijken" is
   het verschil tussen een overtreding en een storing. De keuring van een
   voornemen maakt van ONBEKEND alsnog een afwijzing, want daar gaat waarde
   bewegen. Zo valt het dicht zonder dat de storing als overtreding klinkt.
   ========================================================================== */
'use strict';

const bev = require('../commercie/bevoegdheid');
const { maakBesluit } = require('../commercie/besluit');

/* Per handeling: wie mag het, waarover, en WAAR dat vandaag al stond. `bron` is
   geen vrije tekst maar het adres van de bestaande grens -- wie deze regel
   nakijkt, moet bij die route uitkomen. */
const LIJST = Object.freeze({
  GELD_INNEN: Object.freeze({
    wat: 'een incassoronde draaien: de vaste betalingen innen die aan de beurt zijn',
    /* De rol die het mag. `staff` is hier het kantoor OP NAAM en niet de gedeelde
       code: de route eist `kluisAuth`, en zonder naam komt de keten niet eens bij
       deze vraag (zie ./geldketen.js, as `mensbewijs`). */
    rol: 'kantoor-op-naam',
    scope: '*',
    grenzen: Object.freeze({}),
    grond: 'POST /api/office/bank/incasso staat achter kluisAuth en draait via de tweede ' +
      'handtekening kern/bank/incasso.js#ronde. Deze regel schrijft die bestaande bevoegdheid op; ' +
      'hij breidt hem niet uit.',
  }),
});

/* De bevoegdheidsbron voor besluit.js. Geeft `null` als de handeling niet in de
   gesloten lijst staat -- en dat wordt ONBEKEND, nooit stilzwijgend ja. */
function maakZoeker({ nu } = {}) {
  return function zoekBevoegdheid({ actor, handeling }) {
    const regel = LIJST[String(handeling || '')];
    if (!regel) return null;
    /* Zonder actor is er geen mens om de bevoegdheid aan te hangen. Dat is geen
       formaliteit: een bevoegdheid zonder houder is precies het gat dat
       KANTOORMACHT.md meet (een spoor dat eindigt bij een gedeelde code). */
    if (!actor) return null;
    return bev.maakBevoegdheid({ capability: String(handeling), scope: regel.scope,
      grenzen: regel.grenzen, bron: null, door: String(actor).slice(0, 60), nu });
  };
}

/* De beslislaag zoals `kern.beslis` hem verwacht: een functie die een vraag
   beantwoordt met een uitkomst, een reden en -- als er een sleutel is -- een
   bewijstoken om mee te dragen. `munt` komt van de bewijstokenlaag. */
function maakBeslis({ munt, dagverbruik, beleid, nu } = {}) {
  const { beslis, UITKOMST, DOOR } = maakBesluit({
    zoekBevoegdheid: maakZoeker({ nu }), dagverbruik, beleid, nu, munt });
  return { beslis, UITKOMST, DOOR, LIJST };
}

module.exports = { maakBeslis, maakZoeker, LIJST };
