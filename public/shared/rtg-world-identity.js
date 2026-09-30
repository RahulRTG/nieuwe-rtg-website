/* RTG WERELDIDENTITEIT -----------------------------------------------------
   Een route krijgt precies een vaste menselijke context: Living, Travel,
   Work of Foundation. Core blijft de techniek die alle werelden ondersteunt,
   maar is geen vijfde zichtbare wereld. Toegang, data en gedrag blijven bij
   het scherm zelf; dit manifest bepaalt alleen de vaste kamer en haar Edge.
   Waar MAPPEN (app-main, de enige wereldlijst) dezelfde route noemt, is dit
   een afgeleide die daarmee moet kloppen en geen tweede eigenaar
   (test/rtg-world-identity.test.js); de routes die alleen hier staan krijgen
   van die toets geen tweede eigenaar erbij. */
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
      garderobe geld krant leven lifestyle living-os maison mall media \
      mijnmall muziek nieuws onderhoud pay podium pulse rendezvous rtg scherm sociaal spelen spelscherm sport table \
      theater thuis uitgaan veilig verificatie vonk wereld wonen woningdossier \
      app avond bestellen concierge doelen festival-gast festival galerij gast gedachten genootschap \
      gereedschap home ik isolatie juridisch juridisch/partnervoorwaarden juridisch/privacy \
      juridisch/voorwaarden klankwerk labpas life medicijnen meet memo mijn-gegevens mijn-isolatie \
      mijn-neigingen mijn-post mijn-relaties mijn-sessies notities oog passkeys rtgid salon scanner service-bel service \
      sociaal-prive tijdlijn training vertaler voeding zaal'),
    travel: routes('\
      arrival boeken chauffeur flits hangar hotels move navigatie ov reisboek reisbureau reizen-veilig reizen \
      residentie rit routedossier stad vluchten \
      dispatch ghost luchthaven marechaussee ovcontrol ovdienst ovroutes reisuitnodiging routedekking \
      voertuig zakelijk'),
    work: routes('\
      backoffice bestanden browser command decision-room kantoor kantoren magnaat office onderneming personeel \
      project-room rtgone rtgschool rtmail sitemaker vertegenwoordiging werk \
      appcel appstore-kantoor appstore-uitgever architect-pda belastingkantoor bewijsmap boardroom \
      concern doos handel hardware-pda horeca-bar horeca-beheer horeca-bezorg horeca-club horeca-events \
      horeca-expeditie horeca-haccp horeca-hotel horeca-pda horeca-vloer horeca kantoorpda kassa \
      klankwerk-kantoor kosten leerhuis leerhuis-werk leverancier-aanvragen leverancier-commerce leverancier-rtmail \
      leverancier-service leverancier loonstrook loopbaan loopbaanbewijs magnaat-kantoor magnaat-partnerstudio meldkamer merken \
      pakketten partner-network partner-worden payroll platformregister redactie-pda redactie \
      redactiekantoor rtgkantoor sportclub stadsdoos studio-pda techniek websitestudio werkplek \
      werkruimte zaakkosten zaakpay zaakweb'),
    foundation: routes('\
      foundation/agenda foundation/arena foundation/babyboek foundation/beheer foundation/beroepen \
      foundation/bieb foundation/bord foundation/budget foundation/buurtruil foundation/campus \
      foundation/club foundation/clubswerk foundation/contact foundation/cv foundation/dromen \
      foundation/geld foundation/geld-later foundation/geloofbieb foundation/geven foundation/gevoel \
      foundation/gezondheid foundation/gezondheid-welzijn \
      foundation/hulpwijzer foundation/index foundation/kantoor foundation/keuken foundation/klas \
      foundation/kleuren foundation/klimaatfonds foundation/klusjes foundation/kompas foundation/kwestiekantoor foundation/kwesties \
      foundation/leerpaspoort foundation/leren foundation/liedjes foundation/magazine foundation/mail \
      foundation/markt foundation/mediawijs foundation/meedoen-ontdekken foundation/memorie \
      foundation/mijnbanden foundation/ochtend \
      foundation/onveilig foundation/oppasinfo foundation/opvoeden foundation/os-bestuur \
      foundation/os-deelnemer foundation/os-donateur foundation/os-portaal foundation/os-publiek \
      foundation/os-veld foundation/os-vrijwilliger foundation/os foundation/overhoren foundation/partner \
      foundation/pesten foundation/presenteren foundation/privacy foundation/projecten foundation/rechten \
      foundation/registreren foundation/reis foundation/rust foundation/samen-thuis foundation/school foundation/schoolbieb \
      foundation/schrift foundation/schrijven foundation/societeit foundation/speelhal \
      foundation/speeltuin foundation/steun foundation/studie foundation/tellen foundation/toetsen \
      foundation/veilig foundation/veilig-vertrouwd foundation/verhaaltje foundation/verjaardagen foundation/vrienden \
      foundation/wegwijzer foundation/werk foundation/winkel foundation/zakgeld foundation/zorg \
      connect defensie gemeente gemeenteloket gemeentepda lab lesmaker livinglab overheid overheidspda \
      rechtbank rijksloket schoolpartner zorgbalie')
  });

  var REDIRECTS = routes('\
    balans bank berichten codewoord geld-command labfonds logboek mecenaat metier nalatenschap rtgcode thuisrust \
    thuiswacht toestemming vandaag vitaal wallet wbw');
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
    if (waarde === '/') return '/apps/app.html';
    if (waarde === '/apps') return '/apps/app.html';
    if (waarde === '/apps/foundation') return '/apps/foundation/index.html';
    return waarde;
  }

  function classificeer(pad) {
    if (normaliseer(pad) === '/apps/werkruimte.html') {
      try { var area = new URL(pad, 'https://rtg.local').searchParams.get('gebied');
        var areas={kantoor:'work',persoonlijk:'work',reizen:'travel',living:'living',foundation:'foundation'};
        return Object.prototype.hasOwnProperty.call(areas,area) ? areas[area] : 'work';
      } catch(e) { return 'work'; }
    }
    return ROUTES[normaliseer(pad)] || null;
  }

  function toepassen(doc, pad) {
    if (!doc || !doc.body) return null;
    var body = doc.body;
    body.setAttribute('data-rtg-skin', 'heritage');
    var venster = doc.defaultView;
    var huidig = pad || (venster && venster.location && (venster.location.href || venster.location.pathname)) ||
      (doc.location && (doc.location.href || doc.location.pathname)) || '';
    var wereld = classificeer(huidig);
    if (wereld && wereld !== 'redirect') {
      body.setAttribute('data-rtg-world', wereld);
      if (body.removeAttribute) body.removeAttribute('data-rtg-eigenvlak');
    }
    palet(doc);
    return wereld;
  }

  /* De zichtbare app kleurt de omlijsting. De vaste route-identiteit blijft
     staan: die wordt ook door navigatie en gegevensbronnen gebruikt. Een
     geopend desktopvenster ligt boven een eventueel onderliggend Pass-blad. */
  function palet(doc) {
    var body = doc && doc.body;
    if (!body || !body.getAttribute) return null;
    var wereld = ['data-rtg-frame-world','data-rtg-blad-wereld','data-rtg-world']
      .map(function (naam) { return body.getAttribute(naam); })
      .find(function (waarde) { return Object.prototype.hasOwnProperty.call(MANIFEST, waarde); });
    if (wereld && body.getAttribute('data-rtg-palette') !== wereld) body.setAttribute('data-rtg-palette', wereld);
    return wereld || null;
  }

  return Object.freeze({
    VALUES: Object.freeze(['living', 'travel', 'work', 'foundation']),
    MANIFEST: MANIFEST,
    REDIRECTS: REDIRECTS,
    normalizePath: normaliseer,
    classify: classificeer,
    apply: toepassen,
    syncPalette: palet
  });
}));
