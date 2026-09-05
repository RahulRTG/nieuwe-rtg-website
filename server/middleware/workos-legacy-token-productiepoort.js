/* Tijdelijke productiegrendel voor de oude WerkOS-werkruimtebearers.

   Alle /api/bedrijf-routes delen dezelfde twee centrale deuren: een raw
   beheerToken op de werkruimte en een raw lidToken op het lid. De Tenant
   Control Plane hergebruikt diezelfde deuren. Zolang die tokens nog
   langlevend, opnieuw toonbaar en zonder vaste expiry/rotatie zijn, mag geen
   deelroute per ongeluk als productiegeschikt worden behandeld.

   Dit is bewust geen featureflag en geen migratiebewijs. De grendel verdwijnt
   pas wanneer de hele familie accountgebonden, hash-only, intrekbaar en
   multi-instance bewezen is. Tot die tijd faalt productie vóór idemopslag en
   vóór iedere domeinhandler; ontwikkeling en tests houden de oude stroom om
   de vervanging en regressies te kunnen toetsen. */
'use strict';

const STATUS = 503;
const CODE = 'WORKOS_IDENTITY_NOT_RELEASED';
const BERICHT = 'WerkOS-toegang is nog niet voor productie vrijgegeven. Er is niets gelezen of gewijzigd.';

function normaliseerPad(waarde) {
  let pad = String(waarde || '').split('?')[0] || '/';
  try { pad = decodeURIComponent(pad); } catch (e) {}
  pad = pad.toLowerCase();
  while (pad.length > 1 && pad.endsWith('/')) pad = pad.slice(0, -1);
  return pad;
}

function featureVoor(req) {
  if (String(req && req.method || '').toUpperCase() !== 'POST') return null;
  const pad = normaliseerPad(req && (req.path || req.url));
  if (pad === '/api/bedrijf' || pad.startsWith('/api/bedrijf/'))
    return 'workos.workspace_access_tokens';
  if (pad === '/api/tenant' || pad.startsWith('/api/tenant/'))
    return 'workos.workspace_access_tokens';
  return null;
}

module.exports = function workosLegacyTokenProductiepoort({ productie, env } = {}) {
  const omgeving = env || process.env;
  const isProductie = productie == null
    ? String(omgeving.NODE_ENV || '') === 'production' : productie === true;
  return function workosLegacyTokenProductiepoortMiddleware(req, res, next) {
    if (!isProductie) return next();
    const feature = featureVoor(req);
    if (!feature) return next();
    res.set('Cache-Control', 'no-store');
    return res.status(STATUS).json({ error: BERICHT, code: CODE, feature });
  };
};

module.exports.STATUS = STATUS;
module.exports.CODE = CODE;
module.exports.BERICHT = BERICHT;
module.exports.normaliseerPad = normaliseerPad;
module.exports.featureVoor = featureVoor;
