/* De Hospitality-simulatiebrug gebruikt nog een korte bearer om de context
   van een horecazaak aan een spelwereld te koppelen. De simulatie zelf mag in
   testomgevingen blijven bestaan, maar deze brug is geen noodzakelijke
   productiefunctie en heeft nog geen volledige credentiallevenscyclus.
   Daarom blijven zowel uitgifte, inzage, koppelen als terugdelen in productie
   dicht. Dit is een servergrens; een verborgen knop in de UI zou onvoldoende
   zijn. */
'use strict';

const STATUS = 503;
const ANTWOORD = Object.freeze({
  error:'De simulatiebrug is momenteel niet beschikbaar.',
  code:'simulatiebrug-niet-beschikbaar'
});

const GESLOTEN_ROUTES = Object.freeze([
  '/api/supplier/horeca/simulatie/maak',
  '/api/supplier/horeca/simulatie/voorstellen',
  '/api/member/spel/hospitality-koppel',
  '/api/member/spel/hospitality-delen',
  '/api/rtf/spel/hospitality-koppel',
  '/api/rtf/spel/hospitality-delen'
]);

const geslotenRoutes = new Set(GESLOTEN_ROUTES);

function normaliseerPad(waarde) {
  let pad = String(waarde || '').split('?')[0] || '/';
  try { pad = decodeURIComponent(pad); } catch (e) {}
  pad = pad.toLowerCase();
  while (pad.length > 1 && pad.endsWith('/')) pad = pad.slice(0, -1);
  return pad;
}

function isGeslotenPad(waarde) {
  return geslotenRoutes.has(normaliseerPad(waarde));
}

module.exports = function simulatiebrugProductiepoort({ productie, env } = {}) {
  const omgeving = env || process.env;
  const isProductie = productie == null ? omgeving.NODE_ENV === 'production' : productie === true;
  return function simulatiebrugProductiepoortMiddleware(req, res, next) {
    if (!isProductie || !isGeslotenPad(req.path || req.url)) return next();
    res.set('Cache-Control', 'no-store');
    return res.status(STATUS).json(ANTWOORD);
  };
};

module.exports.STATUS = STATUS;
module.exports.ANTWOORD = ANTWOORD;
module.exports.GESLOTEN_ROUTES = GESLOTEN_ROUTES;
module.exports.normaliseerPad = normaliseerPad;
module.exports.isGeslotenPad = isGeslotenPad;
