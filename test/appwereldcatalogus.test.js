/* DE VIER MEGA-APPS BEGINNEN BIJ EIGENAARSCHAP, NIET BIJ VORM.

   Iedere bediende app-route hoort precies één keer bij LIFE, WORK, FOUNDATION
   of INSTELLINGEN. Deze toets leest de echte HTML-boom; een nieuwe pagina kan
   daardoor niet stil buiten de vier werelden vallen. Oude voordeur- en
   doorstuurpaden tellen mee, maar moeten dezelfde eigenaar houden als hun
   canonicale bestemming.

   Dit bewijst nog niet dat een mega-app klaar is of dat een gebruiker recht
   heeft op iedere route. Het legt alleen de eerste, noodzakelijke waarheid
   vast: wie bezit deze functie? */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const catalogus = require('../server/kern/wereldroutes');
const appgids = require('../server/kern/appgids');

const ROOT = path.join(__dirname, '..');
const APPROOT = path.join(ROOT, 'public', 'apps');
const NAMEN = ['LIFE', 'WORK', 'FOUNDATION', 'INSTELLINGEN'];
const VIRTUEEL = ['/', '/apps/', '/apps/bureau.html', '/apps/index.html'];

function schermen() {
  const uit = [];
  (function loop(map, voor) {
    for (const naam of fs.readdirSync(map)) {
      const bestand = path.join(map, naam);
      if (fs.statSync(bestand).isDirectory()) loop(bestand, voor + naam + '/');
      else if (naam.endsWith('.html')) uit.push(voor + naam);
    }
  })(APPROOT, '/apps/');
  return uit.sort();
}

test('alle app-schermen hebben precies één van de vier werelden', () => {
  assert.deepEqual(Object.keys(catalogus.WERELDEN), NAMEN,
    'de productlijst is LIFE, WORK, FOUNDATION en INSTELLINGEN');

  const alle = schermen();
  const geregistreerd = [...catalogus.ROUTE_NAAR_WERELD.keys()]
    .filter((route) => !VIRTUEEL.includes(route)).sort();

  assert.ok(alle.length >= 258,
    'positieve controle: de toets leest het hele huidige app-huis');
  assert.deepEqual(geregistreerd, alle,
    'ontbrekende route of catalogusroute zonder bestaand scherm');

  for (const route of alle) {
    assert.ok(NAMEN.includes(catalogus.wereldVanRoute(route)),
      route + ' heeft geen geldige eigenaar');
  }
});

test('de vier ingangen en oude homescreen-routes hebben een eigenaar', () => {
  assert.deepEqual(catalogus.INGANGEN, {
    LIFE: '/apps/rtg.html',
    WORK: '/apps/kantoor.html',
    FOUNDATION: '/apps/foundation/index.html',
    INSTELLINGEN: '/apps/ik.html'
  });
  for (const [wereld, route] of Object.entries(catalogus.INGANGEN)) {
    assert.equal(catalogus.wereldVanRoute(route), wereld, route);
  }
  for (const route of VIRTUEEL) {
    assert.equal(catalogus.wereldVanRoute(route), 'INSTELLINGEN', route);
  }
});

test('een doorstuurroute blijft in dezelfde wereld als zijn bestemming', () => {
  for (const route of schermen()) {
    const bestand = path.join(ROOT, 'public', route.slice(1));
    const bron = fs.readFileSync(bestand, 'utf8');
    const meta = /<meta[^>]+http-equiv=["']refresh["'][^>]+content=["'][^"']*url=([^"']+)["']/i.exec(bron);
    if (!meta) continue;
    const doel = meta[1].trim().split('?')[0].split('#')[0];
    assert.equal(catalogus.wereldVanRoute(route), catalogus.wereldVanRoute(doel),
      route + ' stuurt naar een andere wereld (' + doel + ')');
  }
});

test('opzoeken normaliseert query en hash, onbekend blijft onbekend', () => {
  assert.equal(catalogus.wereldVanRoute('/apps/geld.html?tab=bank#wallet'), 'LIFE');
  assert.equal(catalogus.wereldVanRoute('/apps/werk.html#projecten'), 'WORK');
  assert.equal(catalogus.wereldVanRoute('/apps/foundation/campus.html?groep=tiener'), 'FOUNDATION');
  assert.equal(catalogus.wereldVanRoute('/apps/ik.html#persoonlijk'), 'INSTELLINGEN');
  assert.equal(catalogus.wereldVanRoute('/apps/bestaat-niet.html'), null);
  assert.deepEqual(catalogus.routesVanWereld('life'), catalogus.WERELDEN.LIFE);
  assert.deepEqual(catalogus.routesVanWereld('onbekend'), []);
});

test('de bestaande app-gids geeft de nieuwe wereld aan iedere route door', () => {
  for (const route of schermen()) {
    assert.equal(appgids.gidsVan(route).megaApp, catalogus.wereldVanRoute(route), route);
  }
  assert.equal(appgids.gidsVan('/apps/bestaat-niet.html').megaApp, null,
    'een onbekende route krijgt wel terugvaluitleg maar geen verzonnen eigenaar');
});

test('de lijsten zijn stabiel gesorteerd en bevatten alleen routepaden', () => {
  for (const [wereld, routes] of Object.entries(catalogus.WERELDEN)) {
    assert.deepEqual(routes, routes.slice().sort(), wereld + ' is niet gesorteerd');
    for (const route of routes) {
      assert.match(route, /^\/(?:$|apps\/(?:$|[a-z0-9/-]+\.html$))/,
        wereld + ': ongeldig routepad ' + route);
      assert.ok(!route.includes('?') && !route.includes('#'),
        wereld + ': varianten horen bij de route, niet als tweede eigenaar');
    }
  }
});
