/* De productiepoort voor Foundation-functies die nog een afzonderlijke
   vrijgave nodig hebben.

   WAAROM EEN EIGEN POORT. Foundation heeft niet één router. De gezins- en
   schoolroutes hangen vroeg onder /api/foundation; de leerling-, bibliotheek-
   en Living-Lab-routes worden later rechtstreeks op de hoofd-app gemount.
   Een controle in één van die routers laat dus altijd andere deuren open.

   HET CONTRACT. In productie zijn de hieronder benoemde routefamilies dicht.
   RTF_BESCHERMDE_FUNCTIES_VRIJGEGEVEN=1 is alleen een verzoek om ze te openen:
   daarnaast moet het vaste, commit-gebonden externe vrijgavedossier slagen.
   Een losse, ontbrekende of anders gespelde vlag blijft dus dicht. Buiten
   productie staat de poort expliciet open, zodat lokale en testomgevingen hun
   bestaande fixtures kunnen draaien.

   DE AFBAKENING. Dit is bewust geen zoekwoord- of brede regexregel. Iedere
   routefamilie hieronder is een werkelijk gemounte Foundation-deur en wordt
   op een segmentgrens vergeleken. Publieke informatie, volwassen FoundationOS-
   bedrijfsvoering, registratiecontrole en de ethiek/governancekant van het
   Living Lab blijven bereikbaar. Veilige uitgangen (wissen, intrekken,
   blokkeren, melden en terugtrekken) gaan voor op de sluiting: een releasepoort
   mag nooit iemand in een relatie, publicatie of onderzoek vasthouden. */
'use strict';

const foundationVrijgave = require('../config/foundation-vrijgave');
const ENV_NAAM = foundationVrijgave.ENV_NAAM;
const STATUS = 503;
const ANTWOORD = Object.freeze({
  error: 'Deze functie is momenteel niet beschikbaar.',
  code: 'functie-niet-beschikbaar'
});

/* Volledige, bestaande routefamilies die minderjarigendata, communicatie,
   onderwijs- of onderzoeksdeelnemersdata verwerken. Segmentvergelijking zorgt
   dat bijvoorbeeld /api/foundation/gezinnen-openbaar hier niet onder valt. */
const BESCHERMDE_ROUTEFAMILIES = Object.freeze([
  '/api/foundation/gezin',
  '/api/foundation/school',
  '/api/foundation/les',
  '/api/foundation/bord',
  '/api/foundation/schrift',
  '/api/foundation/opgave',
  '/api/foundation/opgaven',
  '/api/foundation/agenda',
  '/api/foundation/mail',
  '/api/foundation/markt',
  '/api/rtf/leerling',
  '/api/rtf/school',
  '/api/rtf/samen',
  '/api/rtf/baby',
  '/api/rtf/tiener',
  '/api/rtf/welzijn',
  '/api/rtf/leren',
  '/api/rtf/spel',
  '/api/rtf/social',
  '/api/rtf/kantoorpakket',
  '/api/rtf/leven',
  '/api/rtf/apply',
  '/api/rtf/talent',
  '/api/rtf/onboarding',
  '/api/rtf/link',
  '/api/rtf/club',
  '/api/rtfos/casus',
  '/api/rtfos/portaal/deelnemer',
  '/api/rtfos/veld',
  '/api/rtfos/bescherming',
  '/api/rtfos/meldcode',
  '/api/lab2/mijn',
  '/api/lab2/mens',
  '/api/lab2/bewijs',
  '/api/lab2/coach'
]);

/* Losse risicovolle deuren binnen verder openbare routefamilies. De catalogi
   ernaast blijven daardoor gewoon beschikbaar. */
const BESCHERMDE_ROUTES = Object.freeze([
  '/api/foundation/ai',
  '/api/foundation/hulp/ai',
  '/api/foundation/reis/aanvraag',
  '/api/rtf/rahul',
  '/api/rtf/bieb/ai',
  '/api/rtf/geloof/ai',
  '/api/rtf/profielen',
  '/api/rtf/koppel',
  '/api/rtf/uitnodiging/accepteer',
  '/api/rtf/overzicht',
  '/api/rtf/kanaal',
  '/api/rtf/bericht',
  '/api/rtf/solliciteer',
  '/api/rtfos/casussen',
  '/api/rtfos/project/deelnemers',
  '/api/rtfos/activiteiten',
  '/api/rtfos/activiteit/zet',
  '/api/rtfos/activiteit/open',
  '/api/rtfos/activiteit/status',
  '/api/rtfos/activiteit/incheck',
  '/api/rtfos/meldcodes',
  '/api/lab2/bewoner/thema',
  '/api/lab2/bewoner/stem',
  '/api/lab2/bewoner/paspoort',
  '/api/lab2/bewoner/paspoort-maak',
  '/api/lab2/metingen',
  '/api/lab2/publicatie/zet'
]);

/* Een juridisch/DPIA-dossier maakt een verouderde bezitssleutel niet ineens
   technisch veilig. Deze families blijven daarom ook na een externe
   Foundation-vrijgave dicht totdat hun eigen credentialregister op
   `migrated` staat. Beperkende uitgangen hieronder blijven wel beschikbaar.

   Dit is tevens de productiescheiding uit de eerste RTG-release: scholen,
   gezinnen, lessen, onderzoeksdeelnemers en stadiontickets kunnen de veilige
   algemene Foundation-laag niet gijzelen en worden ook niet per ongeluk mee
   vrijgegeven door één brede vlag. */
const NOG_GESLOTEN_CREDENTIALFAMILIES = Object.freeze([
  '/api/foundation/gezin',
  '/api/foundation/school',
  '/api/lab2/mijn',
  '/api/les'
]);
const NOG_GESLOTEN_CREDENTIALROUTES = Object.freeze([
  '/api/lab2/bewoner/paspoort',
  '/api/lab2/bewoner/paspoort-maak',
  '/api/member/sport/ticket/koop',
  '/api/member/sport/tickets',
  '/api/sport/scan',
  '/api/foundation/registratie/status',
  '/api/office/foundation/registratie/besluit',
  '/api/rtf/social/stream'
]);

/* De beperkende en verwijderende uitgangen vormen een zelfstandig beleid.
   Ze staan apart zodat deze universele requestpoort klein en controleerbaar
   blijft; de vergelijking blijft hier exact op methode plus route. */
const VEILIGE_UITGANGEN = require('./foundation-veilige-uitgangen');

/* Twee volwassen werkstromen delen nu een endpoint met minderjarigen. De body
   is geen geverifieerd leeftijdsbewijs: daarom blijft de hele deur dicht tot
   de handler een server-authenticated leeftijdsclaim kan gebruiken. */
const GEMENGDE_ROUTES = Object.freeze([
  'POST /api/foundation/registratie/aanvragen',
  'POST /api/rtfos/activiteit/inschrijven'
]);

const veiligeUitgangen = new Set(VEILIGE_UITGANGEN);
const beschermdeRoutes = new Set(BESCHERMDE_ROUTES);
const gemengdeRoutes = new Set(GEMENGDE_ROUTES);

function isVeiligeBodyUitgang(sleutel, body) {
  if (!body || typeof body !== 'object') return false;
  if (sleutel === 'POST /api/rtf/talent/interesse') return body.actief === false;
  if (sleutel === 'POST /api/rtf/social/goedkeuren') return body.akkoord === false;
  if (sleutel === 'POST /api/rtf/social/kind/boardroom/zet') return body.aan === false;
  if (sleutel === 'POST /api/rtfos/activiteit/status') return body.status === 'afgelast';
  if (sleutel === 'POST /api/office/foundation/registratie/besluit')
    return body.action === 'afwijzen';
  return false;
}

function normaliseerPad(waarde) {
  let pad = String(waarde || '').split('?')[0] || '/';
  while (pad.length > 1 && pad.endsWith('/')) pad = pad.slice(0, -1);
  return pad;
}

function binnenRoutefamilie(pad, familie) {
  return pad === familie || pad.startsWith(familie + '/');
}

function isGemengdeRoute(methode, waarde) {
  const sleutel = String(methode || '').toUpperCase() + ' ' + normaliseerPad(waarde);
  return gemengdeRoutes.has(sleutel);
}

function isNogGeslotenCredentialroute(methode, waarde, body) {
  const pad = normaliseerPad(waarde);
  const sleutel = String(methode || '').toUpperCase() + ' ' + pad;
  if (veiligeUitgangen.has(sleutel) || isVeiligeBodyUitgang(sleutel, body)) return false;
  if (NOG_GESLOTEN_CREDENTIALROUTES.includes(pad)) return true;
  return NOG_GESLOTEN_CREDENTIALFAMILIES.some(familie => binnenRoutefamilie(pad, familie));
}

function isBeschermdeRoute(methode, waarde, body) {
  const pad = normaliseerPad(waarde);
  const sleutel = String(methode || '').toUpperCase() + ' ' + pad;
  if (veiligeUitgangen.has(sleutel)) return false;
  if (isVeiligeBodyUitgang(sleutel, body)) return false;
  if (gemengdeRoutes.has(sleutel)) return true;
  if (beschermdeRoutes.has(pad)) return true;
  return BESCHERMDE_ROUTEFAMILIES.some(familie => binnenRoutefamilie(pad, familie));
}

function stuurDicht(res) {
  res.set('Cache-Control', 'no-store');
  return res.status(STATUS).json(ANTWOORD);
}

module.exports = function foundationProductiepoort({ productie, env, root } = {}) {
  const omgeving = env || process.env;
  const isProductie = productie == null ? omgeving.NODE_ENV === 'production' : productie === true;
  /* Eén besluit per processtart. Een dossier dat later op schijf wordt
     vervangen kan een draaiend proces nooit stilletjes meer bevoegdheid geven. */
  const vrijgave = isProductie
    ? foundationVrijgave.beoordeel({ env:omgeving, root })
    : { vrijgegeven:true, reden:'niet-productie' };

  return function foundationProductiepoortMiddleware(req, res, next) {
    if (!isProductie) return next();
    /* Ook een groen procesdossier verandert clientinvoer niet in een
       geverifieerde leeftijd. Deze twee gedeelde handlers blijven dicht tot
       zij zelf een server-authenticated leeftijdsclaim krijgen. */
    if (isGemengdeRoute(req.method, req.path || req.url)) return stuurDicht(res);
    /* Externe juridische vrijgave is noodzakelijk, maar nooit voldoende om
       een technisch onvolwassen bearer of PIN te vertrouwen. */
    if (isNogGeslotenCredentialroute(req.method, req.path || req.url, req.body))
      return stuurDicht(res);
    if (vrijgave.vrijgegeven) return next();
    if (!isBeschermdeRoute(req.method, req.path || req.url, req.body)) return next();
    return stuurDicht(res);
  };
};

module.exports.ENV_NAAM = ENV_NAAM;
module.exports.STATUS = STATUS;
module.exports.ANTWOORD = ANTWOORD;
module.exports.BESCHERMDE_ROUTEFAMILIES = BESCHERMDE_ROUTEFAMILIES;
module.exports.BESCHERMDE_ROUTES = BESCHERMDE_ROUTES;
module.exports.NOG_GESLOTEN_CREDENTIALFAMILIES = NOG_GESLOTEN_CREDENTIALFAMILIES;
module.exports.NOG_GESLOTEN_CREDENTIALROUTES = NOG_GESLOTEN_CREDENTIALROUTES;
module.exports.VEILIGE_UITGANGEN = VEILIGE_UITGANGEN;
module.exports.GEMENGDE_ROUTES = GEMENGDE_ROUTES;
module.exports.normaliseerPad = normaliseerPad;
module.exports.binnenRoutefamilie = binnenRoutefamilie;
module.exports.isGemengdeRoute = isGemengdeRoute;
module.exports.isNogGeslotenCredentialroute = isNogGeslotenCredentialroute;
module.exports.isVeiligeBodyUitgang = isVeiligeBodyUitgang;
module.exports.isBeschermdeRoute = isBeschermdeRoute;
