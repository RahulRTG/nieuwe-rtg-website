/* Herstelpunten zijn navigatie, geen bevoegdheid of kopie van domeindata.
   Iedere lezing verzoent het punt met de huidige actor/context/projectie. */
'use strict';
const { geldig, sleutel } = require('./objectrefs');

function surfaceVoor(v) {
  if (v == null || v === '') return null;
  if (typeof v !== 'string' || v.length > 2048) return undefined;
  const pad = v.split(/[?#]/, 1)[0];
  return pad.length <= 180 && /^\/apps\/(?:[a-zA-Z0-9_-]+\/)*[a-zA-Z0-9_-]+\.html$/.test(pad)
    ? pad : undefined;
}
function navigatieVoor(v) {
  if (v == null) return [];
  return Array.isArray(v) && v.length <= 8 &&
    v.every(x => typeof x === 'string' && /^[a-zA-Z0-9._-]{1,64}$/.test(x)) ? v.slice() : null;
}
function refVoor(ref, projection) {
  if (!geldig(ref) || !projection.objects.some(o => sleutel(o.ref) === sleutel(ref))) return null;
  return { domain: ref.domain, type: ref.type, id: ref.id };
}

module.exports = function maakResume({ opslag, contexten, manifesten, projecteer }) {
  function voor(key, projection) {
    const oud = opslag.resumeLees(key);
    if (!oud) return null;
    const surface = surfaceVoor(oud.surface), navigationState = navigatieVoor(oud.navigationState);
    const objectRef = oud.objectRef ? refVoor(oud.objectRef, projection) : null;
    const reconciled = oud.world !== projection.world || oud.contextId !== projection.context.id ||
      surface === undefined || !navigationState || !!(oud.objectRef && !objectRef);
    return { world: projection.world, contextId: projection.context.id,
      surface: reconciled ? null : surface, objectRef: reconciled ? null : objectRef,
      navigationState: reconciled ? [] : navigationState, updatedAt: oud.updatedAt, reconciled };
  }

  function zet(key, invoer, economicPrincipalRef) {
    const b = invoer || {};
    if (!manifesten.haal(b.world)) return { error: 'Onbekende wereld.', status: 400 };
    const context = contexten.kies(key, b.world, b.contextId);
    if (!context || (b.contextId && context.id !== b.contextId))
      return { error: 'Deze context hoort niet bij deze gebruiker en wereld.', status: 403 };
    const surface = surfaceVoor(b.surface), navigationState = navigatieVoor(b.navigationState);
    if (surface === undefined) return { error: 'Ongeldige surface.', status: 400 };
    if (!navigationState) return { error: 'Ongeldige navigatiestappen.', status: 400 };
    let objectRef = null;
    if (b.objectRef) {
      if (!geldig(b.objectRef)) return { error: 'Ongeldige object reference.', status: 400 };
      const projection = projecteer({ key, world: b.world, contextId: context.id, economicPrincipalRef });
      if (projection.error) return projection;
      objectRef = refVoor(b.objectRef, projection);
      if (!objectRef) return { error: 'Dit object is niet beschikbaar in deze context.', status: 403 };
    }
    return { ok: true, resume: opslag.resumeZet(key, {
      world: b.world, contextId: context.id, surface, objectRef, navigationState
    }) };
  }
  return { voor, zet };
};
