/* Oude Foundation-codeportalen gebruiken nog een langlevende code als enige
   bevoegdheid. Rate limiting maakt zo'n credential niet intrekbaar, tijdelijk
   of veilig bij uitlekken. Daarom blijven deze deuren in productie volledig
   dicht totdat zij naar de centrale codelevenscyclus zijn gemigreerd. Een
   juridisch Foundation-vrijgavedossier mag deze technische blokkade niet
   opheffen; dit is bewust een afzonderlijke, vroeg gemounte poort. */
'use strict';

const STATUS = 503;
const ANTWOORD = Object.freeze({
  error:'Deze toegang is momenteel niet beschikbaar.',
  code:'codeportaal-niet-beschikbaar'
});

const GESLOTEN_FAMILIES = Object.freeze([
  '/api/rtf/club',
  '/api/rtf/partner'
]);

const GESLOTEN_ROUTES = Object.freeze([
  '/api/rtfos/portaal/partner',
  '/api/rtfos/portaal/gemeente',
  '/api/rtfos/portaal/ondernemer'
]);

const geslotenRoutes = new Set(GESLOTEN_ROUTES);

function normaliseerPad(waarde) {
  /* Express routeert standaard niet hoofdlettergevoelig. De poort moet dus
     dezelfde equivalentie hanteren; anders bereikt `/API/RTF/CLUB/PORTAAL`
     de lowercase handler terwijl een case-sensitive beveiligingscheck hem
     zou laten passeren. */
  let pad = String(waarde || '').split('?')[0] || '/';
  /* De router decodeert URL-segmenten bij het matchen. Doe dat hier eveneens,
     zodat `%63lub` niet langs de poort maar wel bij de route kan komen. Een
     kapotte escape laten we ongewijzigd; Express zal zo'n pad zelf afwijzen. */
  try { pad = decodeURIComponent(pad); } catch (e) {}
  pad = pad.toLowerCase();
  while (pad.length > 1 && pad.endsWith('/')) pad = pad.slice(0, -1);
  return pad;
}

function isGeslotenPad(waarde) {
  const pad = normaliseerPad(waarde);
  if (geslotenRoutes.has(pad)) return true;
  return GESLOTEN_FAMILIES.some(familie => pad === familie || pad.startsWith(familie + '/'));
}

module.exports = function legacyCodeportaalProductiepoort({ productie, env } = {}) {
  const omgeving = env || process.env;
  const isProductie = productie == null ? omgeving.NODE_ENV === 'production' : productie === true;
  return function legacyCodeportaalProductiepoortMiddleware(req, res, next) {
    if (!isProductie || !isGeslotenPad(req.path || req.url)) return next();
    res.set('Cache-Control', 'no-store');
    return res.status(STATUS).json(ANTWOORD);
  };
};

module.exports.STATUS = STATUS;
module.exports.ANTWOORD = ANTWOORD;
module.exports.GESLOTEN_FAMILIES = GESLOTEN_FAMILIES;
module.exports.GESLOTEN_ROUTES = GESLOTEN_ROUTES;
module.exports.normaliseerPad = normaliseerPad;
module.exports.isGeslotenPad = isGeslotenPad;
