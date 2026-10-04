/* De capability-SLO naast de HTTP-servicedoelen van ./slo.js.

   Capability-SLO blijft apart van HTTP; een geldige weigering is geen 5xx. Het
   oordeel komt uit de meter van het Trust & Evidence Plane. Is dat plane er
   niet, dan is de uitslag 'onvoldoende gemeten' met de reden erbij en nooit
   'gehaald'. Een gezakte capability sluit het uitrolslot, net als een op
   foutbudget. Afgesplitst omdat slo.js over de omvanggrens ging. */
'use strict';

function capabilityStand(t, uitrol) {
  let capabilities = [];
  try {
    const plane = require('../bewijsvlak/runtime').current();
    capabilities = plane.metrics.standAll(plane.registry.publiek(), t);
  } catch (e) {
    capabilities = [{ capability: 'trust-evidence-plane', oordeel: 'onvoldoende gemeten',
      reasons: ['CAPABILITY_METER_UNAVAILABLE'] }];
  }
  const tel = {
    totaal: capabilities.length,
    gehaald: capabilities.filter(c => c.oordeel === 'gehaald').length,
    gezakt: capabilities.filter(c => c.oordeel === 'niet gehaald').length,
    onvoldoende: capabilities.filter(c => c.oordeel === 'onvoldoende gemeten').length
  };
  const gezakt = capabilities.filter(c => c.oordeel === 'niet gehaald');
  if (gezakt.length) {
    uitrol.mag = false;
    uitrol.reden = 'capability-SLO niet gehaald: ' + gezakt.map(c => c.capability).join(', ');
  }
  return { capabilities, tel };
}

module.exports = { capabilityStand };
