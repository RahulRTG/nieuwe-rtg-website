/* DE STUURLUS VOOR EEN LID -- de aanroep van kern/stuur/lus.js vanuit
   /api/fluister, met wat daarbij hoort: de wereld, het filter op leden- en
   Foundationpaden, het plafond van deze vraag, de voortgang op de bus en de
   systeemregel van Rahul.

   Afgesplitst uit ./persoonlijk-rahul.js toen die route door de omvangband
   ging (de Context Bridge, EDGE.md par. 14.4, liet een aangewezen object eerst
   naar de stuurlus gaan). De naad is echt: hier staat HOE de lus wordt
   aangeroepen, daar WANNEER. Er is niets aan de opties veranderd. */
'use strict';

module.exports = ({ stuurLus, bus, liveCodename }) => function lusVoorLid(req, { grendel, opzoeking }) {
  return stuurLus(req, {
    vraag: req.body.q,
    wereld: 'member',
    /* Ruw: kern/stuur/menscontext.js saneert, met de opzoeking van de route. */
    context: req.body.context, opzoeking,
    // streamende voortgang voor een zware taak: elke stap wordt live
    // "Stap X/24: taxi zoeken..." op de eigen SSE-verbinding (de UI toont het)
    opStap: (v) => {
      /* De enige publicerende plek in dit huis die de actor met zekerheid
         weet: hier ligt de codenaam van het lid al op tafel. Nooit de echte
         naam -- die woont in de identiteitskluis en hoort niet op een bus. */
      try { bus && bus.publish('sse', { doel: 'tier', match: [req.session.tier],
        event: 'rahul-voortgang', data: { stap: v.stap, totaal: v.totaal, bericht: v.bericht, klaar: !!v.klaar },
        envelop: { actor: liveCodename(req.session), classificatie: 'persoonsgegeven' } }); } catch (e) {}
    },
    // Leden- en Foundationpaden wel; werkwerelden blijven buiten bereik.
        filter: p => !['/api/supplier', '/api/staff', '/api/office', '/api/partner'].some(w => p.startsWith(w))
      && (!grendel || grendel(p)),
    systeem: require('../../kern/rahul').RAHUL_LEAD +
      'Je helpt een RTG-lid (codenaam ' + liveCodename(req.session) + ', pas: ' + (req.session.tier || 'rtg') + ') in de leden-app. ' +
      'Je regelt niet alleen reizen, bestellen, betalen en de Salon, maar ook de RTFoundation voor het gezin (bijvoorbeeld het babyboek, school, toetsen of het zakgeldpotje) als het lid daar recht op heeft.'
  });
};
