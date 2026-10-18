/* Schermfamilies, wereldnamen en beeldkeuze voor de redactionele RTG-schil. */
(function (g, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (g) g.RTGEditorialV4Model = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  var COVER = /\/(rtg|reizen|kantoor|living-os|world|wereld|home|foundation\/(?:index|os|os-publiek))\.html$/;
  var CONVERSATION = /\/(berichten|comm|cercle|entourage|meet|rendezvous|rtmail|leverancier-rtmail|mail|sociaal(?:-prive)?|vonk|service-bel)\.html$/;
  var COLLECTION = /\/(mall|mijnmall|bestanden|documenten|library|boeken|krant|nieuws|media|galerij|appstore[^/]*|winkel|markt|schoolbieb|bieb|zoeken)\.html$/;
  var TASK = /\/(agenda|planning|rooster|kassa|horeca[^/]*|personeel|payroll|loonstrook|aanvraag[^/]*|leverancier-aanvragen|toestemming|instellingen|werk)\.html$/;
  var STATE = /\/(404|toegang|login|isolatie|onveilig|privacy|voorwaarden|passkeys)\.html$/;
  var PHOTOS = Object.freeze({
    living:['/images/editorial/living-home.webp','/images/editorial/living-dining.webp','/images/editorial/living-nearby.webp','/images/editorial/living-on-the-way.webp','/images/editorial/moment-dinner.webp','/images/editorial/public-evening.webp'],
    travel:['/images/editorial/travel-inspiration.webp','/images/editorial/travel-flight.webp','/images/travelos/city-arrival.jpg','/images/travelos/coastal-train.jpg','/images/travelos/hotel-executive.jpg','/images/travelos/private-aviation.jpg'],
    work:['/images/editorial/company-technology.webp','/images/editorial/company-control.webp','/images/editorial/company-opportunity.webp','/images/editorial/team-room.webp','/images/editorial/work-project.webp','/beeld/workos-haven.jpg'],
    foundation:['/images/editorial/foundation-care.webp','/images/editorial/foundation-family.webp','/images/editorial/foundation-learning.webp','/images/editorial/foundation-school.webp','/images/editorial/foundation-home.webp','/images/editorial/moment-family-support.webp']
  });
  function pathOf(value) {
    try { return new URL(value || '/', 'https://rtg.local').pathname.replace(/\/$/, '') || '/'; }
    catch (e) { return String(value || '/').split(/[?#]/)[0].replace(/\/$/, '') || '/'; }
  }
  function classify(path, body, registry) {
    var route = pathOf(path), canvas = registry && registry.canvas && registry.canvas[route];
    var declared = body && (body.getAttribute('data-rtg-screen') || body.getAttribute('data-rtg-cinematic-kind'));
    if (canvas || declared === 'canvas' || declared === 'immersive') return 'canvas';
    if (COVER.test(route) || declared === 'world-home') return 'cover';
    if (CONVERSATION.test(route)) return 'conversation';
    if (COLLECTION.test(route) || declared === 'files') return 'collection';
    if (STATE.test(route) || (body && body.matches('[data-rtg-access-state="locked"],[data-rtg-state="error"]'))) return 'state';
    if (TASK.test(route) || declared === 'agenda' || declared === 'task') return 'task';
    return 'detail';
  }
  function ownsPresentation(kind, body) {
    /* Heritage blijft de universele kwaliteitsvloer. Editorial V4 neemt een
       scherm pas over wanneer het van zichzelf redactioneel is (cover of
       collectie), of wanneer een gemigreerde route dat expliciet verklaart.
       Zo blijft bestaande taakbediening eigenaar van operationele schermen
       totdat die bediening bewust naar de gedeelde schil is overgedragen. */
    var declared = body && body.getAttribute && body.getAttribute('data-rtg-editorial-v4');
    if (declared === 'off') return false;
    if (declared !== 'force' && body && body.hasAttribute && body.hasAttribute('data-rtg-editorial-room')) return false;
    return declared === 'force' || kind === 'cover' || kind === 'collection';
  }
  function photoFor(route, world) {
    var pool = PHOTOS[world] || PHOTOS.living, score = 0;
    for (var i = 0; i < route.length; i += 1) score = ((score * 31) + route.charCodeAt(i)) >>> 0;
    return pool[score % pool.length];
  }
  function worldName(world) {
    return ({ living:'LivingOS', travel:'TravelOS', work:'WorkOS', foundation:'FoundationOS' })[world] || 'RTG';
  }
  function screenLabel(route, fallback) {
    var key = route.split('/').pop().replace(/\.html$/, '');
    return ({agenda:'Agenda',berichten:'Berichten',rtmail:'RTmail',documenten:'Documenten',bestanden:'Documenten',mall:'Mall',reizen:'Reizen',reisboek:'Reisboek',passkeys:'Passkeys',navigatie:'Navigatie'})[key] || fallback;
  }
  return Object.freeze({ pathOf:pathOf, classify:classify, ownsPresentation:ownsPresentation,
    photoFor:photoFor, worldName:worldName, screenLabel:screenLabel });
}));
