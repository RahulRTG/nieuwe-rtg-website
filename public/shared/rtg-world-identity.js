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
      mijnmall muziek nieuws onderhoud pay podium pulse rendezvous rtg scherm sociaal spelen spelscherm sport table \
      theater thuis uitgaan vandaag veilig vonk wereld wonen woningdossier \
      app avond bestellen concierge doelen festival-gast festival galerij gast gedachten genootschap \
      gereedschap home ik isolatie juridisch juridisch/partnervoorwaarden juridisch/privacy \
      juridisch/voorwaarden klankwerk labpas life medicijnen meet memo mijn-gegevens mijn-isolatie \
      mijn-post mijn-relaties mijn-sessies notities oog passkeys rtgid salon scanner service-bel service \
      sociaal-prive tijdlijn toestemming training vertaler voeding zaal'),
    travel: routes('\
      arrival boeken chauffeur flits hangar hotels move navigatie ov reisboek reisbureau reizen-veilig reizen \
      residentie rit routedossier stad vluchten \
      dispatch ghost luchthaven marechaussee ovcontrol ovdienst ovroutes reisuitnodiging routedekking \
      voertuig zakelijk'),
    work: routes('\
      backoffice bestanden browser command decision-room kantoor kantoren magnaat office onderneming personeel \
      project-room rtgone rtgschool rtmail sitemaker werk \
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
      foundation/geld foundation/geld-later foundation/geloofbieb foundation/geven foundation/gevoel \
      foundation/gezondheid foundation/gezondheid-welzijn \
      foundation/hulpwijzer foundation/index foundation/kantoor foundation/keuken foundation/klas \
      foundation/kleuren foundation/klimaatfonds foundation/klusjes foundation/kompas \
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
      foundation/veilig foundation/veilig-vertrouwd foundation/verhaaltje foundation/verjaardagen \
      foundation/wegwijzer foundation/werk foundation/winkel foundation/zakgeld foundation/zorg \
      defensie gemeente gemeenteloket gemeentepda lab lesmaker livinglab overheid overheidspda rechtbank \
      rijksloket schoolpartner zorgbalie')
  });

  /* Bestaande functionele materiaalgrenzen: routes kunnen geen vrij thema kiezen. */
  var MATERIALS = Object.freeze({
    onyx: routes('agenda berichten camera comm festival foundation/onveilig foundation/registreren foundation/wegwijzer geld-command horeca-beheer horeca-bezorg horeca-club horeca-events horeca-expeditie horeca-haccp horeca-hotel horeca hotels juridisch/partnervoorwaarden juridisch/privacy juridisch/voorwaarden leven leverancier living-os media move muziek office reisboek rit sociaal veilig vluchten werkruimte'),
    bordeaux: routes('appstore-dossier arrival boeken cellier chauffeur clips commerce flits foodcourt foundation/vrienden garderobe geld hangar krant lifestyle luchthaven maison mall mijnmall navigatie nieuws ov ovcontrol ovdienst ovroutes pay podium reisbureau reizen reizen-veilig residentie routedossier scherm spelen spelscherm sport stad table theater thuis uitgaan vandaag wereld'),
    pearl: routes('attenties cercle entourage pulse rendezvous vonk')
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
      var material = Object.keys(MATERIALS).find(function (key) { return MATERIALS[key].indexOf(normaliseer(huidig)) >= 0; });
      if (material) body.setAttribute('data-rtg-eigenvlak', material);
      else if (body.removeAttribute) body.removeAttribute('data-rtg-eigenvlak');
    }
    return wereld;
  }

  return Object.freeze({
    VALUES: Object.freeze(['living', 'travel', 'work', 'foundation']),
    MANIFEST: MANIFEST,
    MATERIALS: MATERIALS,
    REDIRECTS: REDIRECTS,
    normalizePath: normaliseer,
    classify: classificeer,
    apply: toepassen
  });
}));
