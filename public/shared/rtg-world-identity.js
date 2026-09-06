/* RTG WERELDIDENTITEIT -----------------------------------------------------
   Een route krijgt precies een vaste menselijke context: Living, Travel,
   Work of Foundation. Core blijft de techniek die alle werelden ondersteunt,
   maar is geen vijfde zichtbare wereld. Toegang, data en gedrag blijven bij
   het scherm zelf; dit manifest bepaalt alleen de vaste kamer en haar Edge. */
(function (g, fabriek) {
  'use strict';
  var api = fabriek();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (g && g.document) g.RTGWorldIdentity = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  function routes(regels) {
    return Object.freeze(regels.trim().split(/\s+/).filter(Boolean).map(function (naam) {
      return '/apps/' + naam + '.html';
    }));
  }

  var MANIFEST = Object.freeze({
    living: routes('\
      agenda appstore-dossier attenties camera cellier cercle clips comm commerce entourage foodcourt \
      foundation/vrienden garderobe geld krant leven lifestyle living-os maison mall media \
      mijnmall muziek nieuws pay podium pulse rendezvous rtg scherm sociaal spelen spelscherm sport table \
      theater thuis uitgaan vandaag veilig vonk wereld \
      app avond bestellen concierge doelen festival-gast festival galerij gast gedachten genootschap \
      gereedschap home ik isolatie juridisch juridisch/partnervoorwaarden juridisch/privacy \
      juridisch/voorwaarden klankwerk labpas life medicijnen meet memo mijn-gegevens mijn-isolatie \
      mijn-post mijn-relaties mijn-sessies notities oog passkeys rtgid salon scanner service-bel service \
      sociaal-prive tijdlijn toestemming training vertaler voeding zaal'),
    travel: routes('\
      arrival boeken chauffeur flits hangar hotels navigatie ov reisboek reisbureau reizen-veilig reizen \
      residentie rit routedossier stad vluchten \
      dispatch ghost luchthaven marechaussee ovcontrol ovdienst ovroutes reisuitnodiging routedekking \
      voertuig zakelijk'),
    work: routes('\
      backoffice bestanden browser command kantoor kantoren magnaat office onderneming personeel rtgone \
      rtgschool rtmail sitemaker werk \
      appcel appstore-kantoor appstore-uitgever architect-pda belastingkantoor bewijsmap boardroom \
      concern doos handel hardware-pda horeca-bar horeca-beheer horeca-bezorg horeca-club horeca-events \
      horeca-expeditie horeca-haccp horeca-hotel horeca-pda horeca-vloer horeca kantoorpda kassa \
      klankwerk-kantoor kosten leverancier-aanvragen leverancier-commerce leverancier-rtmail \
      leverancier-service leverancier loonstrook magnaat-kantoor magnaat-partnerstudio meldkamer merken \
      pakketten partner-network partner-worden payroll platformregister redactie-pda redactie \
      redactiekantoor rtgkantoor sportclub stadsdoos studio-pda techniek websitestudio werkplek \
      werkruimte zaakkosten zaakpay zaakweb'),
    foundation: routes('\
      foundation/agenda foundation/arena foundation/babyboek foundation/beheer foundation/beroepen \
      foundation/bieb foundation/bord foundation/budget foundation/buurtruil foundation/campus \
      foundation/club foundation/clubswerk foundation/contact foundation/cv foundation/dromen \
      foundation/geld foundation/geloofbieb foundation/geven foundation/gevoel foundation/gezondheid \
      foundation/hulpwijzer foundation/index foundation/kantoor foundation/keuken foundation/klas \
      foundation/kleuren foundation/klimaatfonds foundation/klusjes foundation/kompas \
      foundation/leerpaspoort foundation/leren foundation/liedjes foundation/magazine foundation/mail \
      foundation/markt foundation/mediawijs foundation/memorie foundation/mijnbanden foundation/ochtend \
      foundation/onveilig foundation/oppasinfo foundation/opvoeden foundation/os-bestuur \
      foundation/os-deelnemer foundation/os-donateur foundation/os-portaal foundation/os-publiek \
      foundation/os-veld foundation/os-vrijwilliger foundation/os foundation/overhoren foundation/partner \
      foundation/pesten foundation/presenteren foundation/privacy foundation/projecten foundation/rechten \
      foundation/registreren foundation/reis foundation/rust foundation/school foundation/schoolbieb \
      foundation/schrift foundation/schrijven foundation/societeit foundation/speelhal \
      foundation/speeltuin foundation/steun foundation/studie foundation/tellen foundation/toetsen \
      foundation/veilig foundation/verhaaltje foundation/verjaardagen foundation/wegwijzer \
      foundation/werk foundation/winkel foundation/zakgeld \
      defensie gemeente gemeenteloket gemeentepda lab lesmaker livinglab overheid overheidspda rechtbank \
      rijksloket schoolpartner zorgbalie')
  });

  var REDIRECTS = routes('\
    balans bank berichten codewoord geld-command labfonds logboek mecenaat metier nalatenschap rtgcode thuisrust \
    thuiswacht vitaal wallet wbw');
  var ROUTES = Object.create(null);
  Object.keys(MANIFEST).forEach(function (wereld) {
    MANIFEST[wereld].forEach(function (pad) { ROUTES[pad] = wereld; });
  });
  REDIRECTS.forEach(function (pad) { ROUTES[pad] = 'redirect'; });

  function normaliseer(pad) {
    var waarde = String(pad || '/');
    try { waarde = new URL(waarde, 'https://rtg.local').pathname; }
    catch (e) { waarde = waarde.split(/[?#]/)[0]; }
    waarde = waarde.replace(/\/{2,}/g, '/');
    if (waarde.length > 1) waarde = waarde.replace(/\/$/, '');
    if (waarde === '/apps') return '/apps/app.html';
    if (waarde === '/apps/foundation') return '/apps/foundation/index.html';
    return waarde;
  }

  function classificeer(pad) {
    return ROUTES[normaliseer(pad)] || null;
  }

  function toepassen(doc, pad) {
    if (!doc || !doc.body) return null;
    var body = doc.body;
    body.setAttribute('data-rtg-skin', 'heritage');
    /* Een scherm dat zijn wereld al uitspreekt is de hoogste autoriteit. Ook
       een toekomstige waarde wordt hier niet stil teruggeschreven. */
    if (body.hasAttribute('data-rtg-world')) return body.getAttribute('data-rtg-world');
    var venster = doc.defaultView;
    var huidig = pad || (venster && venster.location && venster.location.pathname) ||
      (doc.location && doc.location.pathname) || '';
    var wereld = classificeer(huidig);
    if (wereld && wereld !== 'redirect') body.setAttribute('data-rtg-world', wereld);
    return wereld;
  }

  return Object.freeze({
    VALUES: Object.freeze(['living', 'travel', 'work', 'foundation']),
    MANIFEST: MANIFEST,
    REDIRECTS: REDIRECTS,
    normalizePath: normaliseer,
    classify: classificeer,
    apply: toepassen
  });
}));
