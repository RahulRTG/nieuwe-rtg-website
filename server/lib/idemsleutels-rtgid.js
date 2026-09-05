/* RTG-iD bewaakt start/rotatie/annulering zelf duurzaam. De twee uitgiftes
   staan bewust in idemsleutels-nooit omdat hun kale credentials nooit uit een
   antwoordcache mogen terugkomen. Hier staan de overige routebetekenissen. */
'use strict';
const SLEUTELS = {
  'POST /api/rtgid/status': { nietIdempotent: true,
    waarom: 'de eerste bevestigde status levert het al bekende statusgeheim eenmalig als id-tokenlabel en iedere poll telt als credentialgebruik' },
  'POST /api/rtgid/annuleer': { nietIdempotent: true,
    waarom: 'de kern bindt de expliciete sleutel duurzaam en moet zelf het actuele ingetrokken oordeel geven' },
  'POST /api/rtgid/wie': { nietIdempotent: true,
    waarom: 'iedere geldige gegevensophaling telt; de tweede wordt in het inzagelog zichtbaar' },
  'POST /api/rtgid/koppel': { leest: true },
  'POST /api/rtgid/bevestig': { nietIdempotent: true,
    waarom: 'een WebAuthn-ceremonie is eenmalig en de kern moet een tweede poging tegen de actuele koppelstand beoordelen' },
  'POST /api/rtgid/weiger': { nietIdempotent: true,
    waarom: 'de kern moet na de eerste weigering de actuele gesloten stand teruggeven en geen oud succes herhalen' }
};
module.exports = { SLEUTELS };
