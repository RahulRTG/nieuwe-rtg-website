/* DE HARDHEID VAN EEN KANTOORIDENTITEIT, als waarde van de verzoekenvelop
   (server/opzet/envelop.js IDENTITEITEN) -- besluit van de eigenaar, 11 oktober
   2026: een opgegeven naam, een bestaande sessie en een bewezen identiteit zijn
   drie dingen. ./identiteit.js kent het verschil al (besluit 3a: `bewezen`
   alleen bij een passkey); dit bestand vertaalt die soort naar de envelop, zodat
   officeAuth en de boardroom niet `bewezen` zeggen over een wachtwoordsessie.

     passkey                   -> bewezen
     opNaam / eigenaarToken    -> opNaam   (een individu, de deur zag geen sleutel)
     gedeeld                   -> anoniem  (de gedeelde code is geen individu)
     iets anders               -> onbekend

   Er komt geen veld bij in de envelop; alleen de WAARDE is eerlijk.

   `bewezen` HEEFT DAARMEE TWEE STRENGHEDEN in server/opzet/envelop.js: aan de
   kantoordeur alleen met een passkey, aan de andere deuren (lid, tiener,
   techniek, gezinslid) en in de afleiding uit een id nog "er hangt een persoon
   aan". Die deuren gelijktrekken verandert de betekenis voor elke ledensessie,
   en is daarom een besluit van de eigenaar en geen reparatie. */
'use strict';

function envelopIdentiteit(id) {
  const via = id && id.via;
  if (via === 'passkey') return 'bewezen';
  if (via === 'opNaam' || via === 'eigenaarToken') return 'opNaam';
  if (via === 'gedeeld') return 'anoniem';
  return 'onbekend';
}

/* Rechtstreeks uit de sessie (of het kale eigenaarstoken), via ./identiteit.js.
   Lui geladen, zoals ./identiteit.js zelf ./productiedeur.js laadt. */
function vanSessie(sess, eigenaarToken) {
  const { identiteitVan } = require('./identiteit');
  return envelopIdentiteit(identiteitVan(eigenaarToken ? null : sess, { eigenaarToken: !!eigenaarToken }));
}

module.exports = envelopIdentiteit;
module.exports.vanSessie = vanSessie;
