/* DE GEVOLGPOORT -- de vooruitblik van het domein tegen het gevolgcontract van de
   handeling, en de enige as van deze baan die kan WEIGEREN op een tegenstrijdigheid
   tussen twee VERKLARINGEN.

   APART VAN ./klaarzet.js omdat het een ander onderwerp is: dat bestand legt assen
   vast, dit houdt twee lagen tegen elkaar en kan de hele handeling stoppen. Zelfde
   naad als ./weging.js, dat om dezelfde reden naast het klaarzetten staat.

   HOE ER VERGELEKEN WORDT ZONDER OP NAAMGELIJKHEID TE GOKKEN, staat in
   kern/stuur/gevolgcontract/vergelijk.js en wordt hier niet herhaald. Wat hier staat
   is wat er in DEZE keten van afhangt.

   HET SUBJECT KOMT VAN HET DOMEIN EN WORDT NIET GERADEN. In deze keten staat de
   vooruitblik bij de AANVRAAG (/api/office/bank/incasso) en beschrijft hij wat de
   RONDE zou doen -- en die ronde loopt op een andere route
   (/api/office/bank/handtekening/bevestig). Tegen het contract van de aanvraag
   gehouden zou elke geldvoorspelling een TEGENSPRAAK zijn: die aanvraag verplaatst met
   zoveel woorden geen euro. Een poort die het subject raadt, vindt dus precies de
   conflicten die er niet zijn. Vandaar `tegenfeit.over`, met het eigen pad als terugval.

   EEN CONFLICT STOPT DE KETEN, EEN GAT NIET. Die weging woont in vergelijk.js als
   `BLOKKEERT`, zodat er niet twee plekken zijn die beslissen wat blokkeert. En de GRAAD
   van deze as gaat over de vraag of er VERGELEKEN is -- zelfde onderscheid als bij
   `tegenfeit`: `GATEN` is dus gemeten (de vergelijking liep en niets sprak elkaar
   tegen), terwijl "geen contract" of "een voorspelling zonder werkwoorden" `onbekend`
   is en de keten niet rond maakt. Dat laatste is geen nul. */
'use strict';

const { vergelijk } = require('../../stuur/gevolgcontract/vergelijk');

/* Geeft een ANTWOORD terug als de keten moet stoppen, en anders niets -- dan is de as
   gelegd en loopt het klaarzetten door. */
function gevolgpoort(o, dossier, leg) {
  const tf = o.tegenfeit || {};
  const vs = vergelijk({ over: tf.over || o.pad || '', effecten: tf.effecten });
  if (vs.blokkeert)
    return { status: 409,
      error: 'De vooruitblik van deze handeling spreekt haar gevolgcontract tegen. Er gaat niets ' +
        'verder tot een mens heeft uitgezocht welke van de twee onjuist is.',
      vergelijking: vs };
  /* DE VOORSPELDE KLASSEN GAAN MEE OP DE AS, en niet omdat de as ze nodig heeft: de
     NAMETING heeft ze straks nodig, en dan is deze voorspelling het enige wat er nog van
     over is. Ze later opnieuw afleiden zou een tweede afleiding zijn van iets dat hier
     al vaststond -- en een voorspelling die je na de handeling reconstrueert, is geen
     voorspelling meer. */
  leg(dossier, 'gevolgcontract', {
    voorspeld: Array.isArray(tf.effecten) ? tf.effecten.slice() : null,
    graad: (vs.uitslag === 'IN_ORDE' || vs.uitslag === 'GATEN') ? 'gemeten' : 'onbekend',
    uitslag: vs.uitslag, over: vs.over,
    gaten: vs.conflicten.filter(x => x.soort === 'GAT').map(x => x.werkwoord),
    reden: vs.reden });
  return null;
}

module.exports = { gevolgpoort };
