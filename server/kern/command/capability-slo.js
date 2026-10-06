'use strict';

function leesCapabilitySlo(nu) {
  let capabilities;
  try {
    const plane = require('../bewijsvlak/runtime').current();
    capabilities = plane.metrics.standAll(plane.registry.publiek(), nu);
  } catch (e) {
    capabilities = [{ capability: 'trust-evidence-plane', oordeel: 'onvoldoende gemeten',
      reasons: ['CAPABILITY_METER_UNAVAILABLE'] }];
  }
  const gezakt = capabilities.filter(c => c.oordeel === 'niet gehaald');
  return { capabilities, gezakt,
    tel: { totaal: capabilities.length,
      gehaald: capabilities.filter(c => c.oordeel === 'gehaald').length,
      gezakt: gezakt.length,
      onvoldoende: capabilities.filter(c => c.oordeel === 'onvoldoende gemeten').length } };
}

function begrensUitrolMetCapabilities(uitrol, capabilityStand) {
  if (!capabilityStand.gezakt.length) return uitrol;
  uitrol.mag = false;
  uitrol.reden = 'capability-SLO niet gehaald: ' +
    capabilityStand.gezakt.map(c => c.capability).join(', ');
  return uitrol;
}

module.exports = { leesCapabilitySlo, begrensUitrolMetCapabilities };
