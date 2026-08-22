/* DE ENIGE ROUTE-EIGENAARSCATALOGUS VAN DE VIER MEGA-APPS.

   Dit bestand beslist nog niets over vorm, zichtbaarheid of rechten. Het legt
   alleen vast welk product een app-route bezit. Een route staat precies één
   keer in LIFE, WORK, FOUNDATION of INSTELLINGEN. Rol-, pas- en leeftijdspoorten
   blijven in hun bestaande bron; eigenaarschap mag die beveiliging nooit
   vervangen.

   De lijsten staan per wereld in ./wereldroutes/ om onder de modulegrens te
   blijven. Nieuwe app-pagina? Dan hoort in dezelfde wijziging één route hier
   bij, anders zakt test/appwereldcatalogus.test.js. */
'use strict';

const WERELDEN = Object.freeze({
  LIFE: Object.freeze(require('./wereldroutes/life').slice()),
  WORK: Object.freeze(require('./wereldroutes/work').slice()),
  FOUNDATION: Object.freeze(require('./wereldroutes/foundation').slice()),
  INSTELLINGEN: Object.freeze(require('./wereldroutes/instellingen').slice())
});

const INGANGEN = Object.freeze({
  LIFE: '/apps/rtg.html',
  WORK: '/apps/kantoor.html',
  FOUNDATION: '/apps/foundation/index.html',
  INSTELLINGEN: '/apps/ik.html'
});

const ROUTE_NAAR_WERELD = new Map();
for (const [wereld, routes] of Object.entries(WERELDEN)) {
  for (const route of routes) {
    if (ROUTE_NAAR_WERELD.has(route)) {
      throw new Error(route + ' staat in twee werelden: ' +
        ROUTE_NAAR_WERELD.get(route) + ' en ' + wereld);
    }
    ROUTE_NAAR_WERELD.set(route, wereld);
  }
}

function schoonRoute(pad) {
  const kaal = String(pad || '').split('?')[0].split('#')[0];
  return kaal || '/';
}

function wereldVanRoute(pad) {
  return ROUTE_NAAR_WERELD.get(schoonRoute(pad)) || null;
}

function routesVanWereld(wereld) {
  const routes = WERELDEN[String(wereld || '').toUpperCase()];
  return routes ? routes.slice() : [];
}

module.exports = { WERELDEN, INGANGEN, ROUTE_NAAR_WERELD, schoonRoute,
  wereldVanRoute, routesVanWereld };
