/* Nagekeken contracten van de twee routes die het SSO-clientgeheim roteren en
   de overlap sluiten (besluit B16, CODECREDENTIALS.json
   identity.sso_client_secret). Beide staan in lib/eenmalig-geheim-routes.js en in
   de NOOIT-lijst (lib/idemsleutels-nooit-ssogeheim.js): de kern beslist op de
   verse stand, geen antwoordcache. Alleen de eigenaar (techAuth + eigenaarAlleen). */
'use strict';
const AF = { door: 'Claude, sso/clientgeheim*.js en de routes gelezen en beproefd', op: '2026-09-29' };
const EIGENAAR = { klasse: 'CAPABILITY_GATED', bevoegdheid: 'eigenaar van RTG (techAuth + eigenaarAlleen)' };
const CONTRACTEN = {
  'POST /api/techniek/sso/geheim': {
    mutatieId: 'techniek.sso.geheim.roteren', herkomst: 'mens',
    semantiek: { klasse: 'nietHerhaalbaar' }, toegang: EIGENAAR,
    stand: 'INTENTIONALLY_NON_IDEMPOTENT',
    waarom: 'Roteren zet een nieuw clientgeheim bovenaan en laat het vorige een begrensde overlap meelopen. Hetzelfde geheim nog eens geeft ongewijzigd: true zonder overlap met zichzelf; een ander geheim is een tweede rotatie en schuift de overlap door. De kern beslist op de verse stand, geen cache, en het antwoord draagt nooit het geheim.',
    bewijs: { gemeten: 'test/sso-clientgeheim-routes.test.js: rotatie met overlap, dezelfde aanvraag nog eens is ongewijzigd, lid en kantoor krijgen 401/403, een onbekende org 404; test/sso-clientgeheim.test.js toets 3', op: '2026-09-29' },
    afgetekend: AF
  },
  'POST /api/techniek/sso/geheim/overlap/sluit': {
    mutatieId: 'techniek.sso.geheim.overlap.sluiten', herkomst: 'mens',
    semantiek: { klasse: 'idempotent' }, toegang: EIGENAAR,
    stand: 'PROTECTED',
    bewijs: { gemeten: 'test/sso-clientgeheim-routes.test.js: eerste keer 200 zonder overlap, tweede keer 409 (er loopt geen overlap meer), de stand blijft gelijk', op: '2026-09-29' },
    afgetekend: AF
  }
};
module.exports = { CONTRACTEN };
