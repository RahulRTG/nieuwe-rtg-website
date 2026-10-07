/* RTG PAY EN DE VRIJGAVEPOORT (server/kern/vrijgave/): welke capability een
   NIEUWE geldhandeling van deze laag vraagt, en waar dat wordt gevraagd.

   WAAR HIJ HANGT, en waar met opzet NIET. De poort staat in de idem-laag
   (../../lib/idem.js `poort`): na het opzoeken van een herhaling en voor het
   werk. Hij staat NIET in de waardepoort (./poort.js) en niet in de boeking
   (./boeking.js), want daar komt ook de AFWIKKELING langs van geld dat al
   vaststond: de bijschrijving van een bevestigde oplading (./opladen.js
   `oplaadAfronden`, de webhook en de veegronde van de betaalwaarheid), de
   terugboeking van een uitbetaling die de rail weigerde, een teruggave. Een
   noodstop die die wegen ook dichtzet, laat een lid met een afgeschreven kaart en
   een lege wallet zitten -- en dat is precies wat een noodstop niet mag doen.

   NIEUW WERK BUITEN DE IDEM-LAAG. Drie handelingen in deze laag hebben een eigen
   herhaalvorm (een claim in een collectietransactie) en komen niet langs
   lib/idem: afrekenen met een kascode (./kas-claim.js), een tegoed verzilveren
   (./tegoed-claim.js) en een vooraf gereserveerd bedrag vastleggen (./vooraf.js).
   Die vragen dezelfde poort op dezelfde plek in HUN volgorde: na de herhaling,
   voor een nieuwe claim. Een claim die al liep (een hervatting na een crash) is
   afwikkeling en gaat door.

   WIE ER VRAAGT. Deze laag kent geen mensen: de route besliste al of deze actor
   dit mocht (`recht: true` hieronder is DAT besluit, doorgegeven). Wat de poort
   hier weegt, is of het HUIS dit mag: stand, bewijs, autorisatie, gezondheid.
   Een lager woord (recht, actor) kan een hoger nee nooit in een ja veranderen
   -- de evaluator is een EN (test/vrijgave-rangorde.test.js). */
'use strict';

function maakPayVrijgave({ vrijgave, betaal } = {}) {
  const V = require('../vrijgave');
  const poort = () => vrijgave || V.standaard();
  /* De rail van een interne boeking: het gesloten grootboek zelf. Alleen op een
     aantoonbaar lokale installatie is dat een rail zonder echt geld
     (../vrijgave/lokaal.js); elders is het het tegoed van echte mensen. */
  const INTERN = { rail: 'intern', recht: true, actor: { soort: 'route' } };
  /* De rail van een oplading of uitbetaling: de provider die de betaalnaad nu
     gebruikt. Leest hij niets, dan is het `onbekend` -- en dan is de capability
     dicht (geen provider, geen afhankelijkheid). */
  const inkomendeRail = () => String((betaal && betaal.AANBIEDER) || 'onbekend');

  function weiger(capability, ctx) {
    return V.weigering(capability, Object.assign({}, INTERN, ctx || {}), poort());
  }

  return {
    /* Het interne saldo: de poort van de idem-laag van RTG Pay. */
    intern: () => weiger('geld.intern_saldo'),
    /* Per aanroep, als `opties.poort` voor ../../lib/idem.js. */
    opwaarderen: () => weiger('geld.opwaarderen', { rail: inkomendeRail(), provider: inkomendeRail() }),
    lidIbanUitbetaling: () => weiger('geld.lid_iban_uitbetaling', { rail: inkomendeRail(), provider: inkomendeRail() }),
    partnerafrekening: () => weiger('geld.partnerafrekening', { rail: inkomendeRail(), provider: inkomendeRail() }),
    weiger
  };
}

/* De grootboekkoppeling van Stripe Connect (server/betaal/connect/, `koppelGrootboek`).
   Drie economische gebeurtenissen per afrekening, en elk boekt HOOGSTENS EEN
   effect: de sleutel komt van de connectlaag (`pay-uitbetaling:<64 hex>`, uit het
   ZAKELIJKE id van de afrekening), en die sleutel gaat als economische sleutel mee
   naar de boeking. In de JS-stand draagt ../betaalopdracht/terugboeking.js
   `boekOpSleutel` hem in dezelfde commit als de saldi; in de motorstand ontdubbelt
   de motor hem duurzaam. Een herhaalde melding, een veeg na een herstart of twee
   processen die tegelijk afrekenen, landen dus op dezelfde boeking.

     reservering   partnersaldo -> extern:connect-onderweg   het geld is van de
                   partner af en staat klaar om te vertrekken
     afgerekend    extern:connect-onderweg -> extern:uitbetaald   Stripe meldt het
                   op de bank van de partner
     teruggeboekt  extern:connect-onderweg -> partnersaldo   het vertrok nooit, of
                   Stripe draaide de transfer terug

   Een tussenrekening en niet meteen extern:uitbetaald: zo laat de reconciliatie
   zien wat er ONDERWEG is (het saldo van extern:connect-onderweg), en is een
   terugboeking iets anders dan geld dat van buiten terugkomt. */
const CONNECT_ONDERWEG = 'extern:connect-onderweg';

function maakConnectBoeking(pay) {
  if (!pay || typeof pay.boekAsync !== 'function' || typeof pay.rekPartner !== 'function')
    throw new Error('De Connect-grootboekkoppeling heeft RTG Pay nodig (boekAsync, rekPartner).');
  const { SLEUTEL } = require('../../db/economische-identiteit');
  return async function boekConnectEffect({ sleutel, soort, afrekening, partner, centen }) {
    if (!SLEUTEL.test(String(sleutel || '')) || !String(sleutel).startsWith('pay-uitbetaling:'))
      throw new Error('Een Connect-effect zonder geldige economische sleutel boekt niet.');
    if (!partner) throw new Error('Een Connect-effect zonder partner boekt niet.');
    const rek = pay.rekPartner(String(partner));
    const zet = {
      reservering: { van: rek, naar: CONNECT_ONDERWEG, soort: 'uitbetaling', oms: 'Partnerafrekening ' + afrekening + ' gereserveerd' },
      afgerekend: { van: CONNECT_ONDERWEG, naar: 'extern:uitbetaald', soort: 'uitbetaald', oms: 'Partnerafrekening ' + afrekening + ' uitbetaald' },
      teruggeboekt: { van: CONNECT_ONDERWEG, naar: rek, soort: 'terug', oms: 'Partnerafrekening ' + afrekening + ' teruggeboekt' }
    }[soort];
    if (!zet) throw new Error('Onbekend Connect-effect: ' + soort);
    const b = await pay.boekAsync(Object.assign({ centen, ref: String(afrekening), economischeSleutel: String(sleutel) }, zet));
    if (!b || b.error) {
      const e = new Error((b && b.error) || 'Het grootboek gaf geen antwoord.');
      e.status = (b && b.status) || 502;
      throw e;
    }
    return { boeking: b.boeking && b.boeking.id, herhaald: !!b.herhaald };
  };
}

module.exports = { maakPayVrijgave, maakConnectBoeking, CONNECT_ONDERWEG };
