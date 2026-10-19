#!/usr/bin/env node
'use strict';
/* ============================================================================
   DE LOS-PROEF -- werkt een app met alleen zijn EIGEN functies aan?

   WAAROM. Eigenaarsbesluit 19 oktober 2026: elke app werkt in twee modi, LOS en
   SAMEN. De tredeproef (TREDEPROEF.json, MODULAIR.md) bewijst op HTTP-niveau dat
   een trede aan en de rest uit geen lekken geeft, maar MODULAIR.md zegt zelf dat
   bestellen, betalen en bevestigen "nooit end-to-end beproefd met de rest van
   het huis uit" zijn. Deze proef doet dat: hij draait een VOLTOOISCENARIO
   (scripts/lib/voltooi/*) in een wereld waar alleen de functies van die app zelf
   aan staan.

   DE AFLEIDING KOMT UIT DE BESTAANDE TREDEN, niet uit een nieuwe lijst. Een
   functie (server/functies/register) draagt een `categorie`; een app IS die
   categorie. Wat aan blijft:

     1. de PRIMAIRE categorie van de app: de categorie van de functie die de
        eigen routes van het scenario het vaakst raken (via de paden-eigendom van
        functieVoorPad). Categorie-breed aan.
     2. de BODEM, per FUNCTIE-ID en niet per categorie: trede 0 (de smalle snee,
        FASES[0].aan) PLUS de functie-ids die de gedeelde wereldhelpers raken om
        een echt, geverifieerd lid met een gebonden toestel en een connectie te
        maken (voltooiwereld.js). Per id, want trede 0 raakt zEVEN categorieen
        (ook Partners via supplier-salon, Eigen apps via experience-platform);
        hield je die categorieen heel aan, dan stond de halve lanceerbare stad
        weer aan en mat de proef niets. De snede moet dus per id, niet per
        categorie -- dat is de kern van de meting en test/losproef.test.js
        bewaakt het.

   Alles daarbuiten gaat uit, langs de boardroom (de eigenaar vraagt de
   functieschakelaar aan en keurt hem zelf goed; geen eigen vlag). Raakt het
   scenario dan een route van een ANDERE categorie die nu uit staat, dan weigert
   die met 503 en zakt de keten -- en dat is de bevinding: het scherm leunt op
   een andere app zonder eerlijke lege toestand.

   LEES DE BEVINDING GOED (BEWIJSMACHINE.md par. 6a). Een 503 in een EIGEN
   belofte-stap betekent leunen. Een 503 in een ISOLATIE-stap -- waar het
   scenario juist een tegenspeler uit een andere app opbouwt om te bewijzen dat
   die er niet bij kan -- betekent dat de PROEF niet volledig in LOS-modus te
   draaien is, niet per se dat de belofte leunt. De runner legt per stap vast
   welke uit-categorie de 503 gaf.

   WAT DIT NIET IS: een reparatie. Een bevinding is een melding aan de eigenaar
   van die app. En het is geen nieuw register: de uitslag hoort bij VOLTOOIPROEF
   (een losModus-veld per app), want de proef leent zijn scenario's daarvandaan.

   Draai:  node scripts/losproef.js                 (meet de kern, schrijft niets)
           node scripts/losproef.js --app=wallet     (een app; komma's voor meer)
   ========================================================================== */
const fs = require('fs');
const path = require('path');
const WORTEL = path.join(__dirname, '..');

const { FASES, FUNCTIES } = require(path.join(WORTEL, 'server', 'functies', 'register'));
const { functieVoorPad } = require(path.join(WORTEL, 'server', 'functies'));

/* De vijf apps van de lanceerbare kern waar de integrator mee wil beginnen,
   met hun voltooiscenario. Geen nieuwe lijst van functies -- alleen WELKE
   scenario's; de functies leidt de proef zelf af. */
const KERN = ['wallet', 'reizen', 'office', 'berichten', 'horeca'];

const CAT_VAN_ID = new Map(FUNCTIES.map((f) => [f.id, f.categorie || null]));
const ALLE_CATS = [...new Set(FUNCTIES.map((f) => f.categorie).filter(Boolean))];
const BODEM = new Set(FASES[0].aan);   // trede 0: de smalle snee

const categorieVan = (fid) => (CAT_VAN_ID.has(fid) ? CAT_VAN_ID.get(fid) : null);
const idVanRoute = (r) => { const f = functieVoorPad(r); return (f && (f.id || f)) || null; };
const catVanRoute = (r) => { const id = idVanRoute(r); return id ? categorieVan(id) : null; };

/* De routes die een bron letterlijk noemt -- dezelfde lezing als
   scripts/lib/bewijsbron.js: een pad tussen aanhalingstekens. Een pad dat wordt
   OPGEBOUWD wordt gemist, en dat is de veilige kant (het gaat dan niet per
   ongeluk uit). Params (:id) en een sluitende slash vallen weg. */
function routesUit(bron) {
  const m = bron.match(/['"`]\/api\/[a-zA-Z0-9/_.:-]+/g) || [];
  return [...new Set(m.map((s) => s.slice(1).replace(/:.*$/, '').replace(/\/+$/, '')))];
}

/* De functie-ids die een verzameling routes raakt (een route zonder schakelaar
   valt weg: die staat sowieso altijd open). */
function idsVanRoutes(routes) {
  const ids = new Set();
  for (const r of routes) { const id = idVanRoute(r); if (id) ids.add(id); }
  return ids;
}

/* De primaire categorie van een app: de categorie van de functie die de eigen
   routes van het scenario het vaakst raken. Geen enkele geschakelde route ->
   null (de app draait volledig op de bodem). */
function primaireCategorie(routes) {
  const tel = new Map();
  for (const r of routes) { const id = idVanRoute(r); if (id) tel.set(id, (tel.get(id) || 0) + 1); }
  let beste = null, besteN = 0;
  for (const [id, n] of tel) if (n > besteN) { beste = id; besteN = n; }
  return beste ? categorieVan(beste) : null;
}

/* DE HELE AFLEIDING, PUUR. Uit de bron van het scenario en de bron van de
   gedeelde wereldhelpers: wat aan blijft (primaire categorie, per-id-bodem),
   wat uit gaat, en welke andere categorieen het scenario nog raakt (de
   leun-kandidaten). Geen server, geen bestand -- test/losproef.test.js draait
   hier recht op. */
function losAfleiding({ scenarioBron, ruggengraatBron }) {
  const scRoutes = routesUit(scenarioBron);
  const primair = primaireCategorie(scRoutes);
  const ruggengraat = idsVanRoutes(routesUit(ruggengraatBron || ''));
  const aanIds = new Set([...BODEM, ...ruggengraat]);
  const aanCats = new Set(); if (primair) aanCats.add(primair);
  const uitCats = ALLE_CATS.filter((c) => !aanCats.has(c));
  const andereCats = [...new Set(scRoutes.map(catVanRoute).filter((c) => c && c !== primair))];
  return { primair, aanIds, uitCats, andereCats, scRoutes };
}

/* Het oordeel over een gedraaid scenario, puur uit zijn boek. */
function oordeel({ afgebroken, open }) {
  if (afgebroken) return 'AFGEBROKEN';
  return (open && open.length) ? 'LEUNT' : 'LOS';
}

module.exports = {
  KERN, BODEM, ALLE_CATS, WORTEL,
  categorieVan, idVanRoute, catVanRoute, routesUit, idsVanRoutes, primaireCategorie,
  losAfleiding, oordeel,
  /* De tredeproef en de oude losrunner lazen losSet([]) voor de kale bodem. */
  losSet: (routes) => {
    const aan = new Set(BODEM);
    const cats = new Set();
    for (const r of (routes || [])) { const c = catVanRoute(r); if (c) cats.add(c); }
    for (const f of FUNCTIES) if (f.categorie && cats.has(f.categorie)) aan.add(f.id);
    return { aan, categorieën: [...cats] };
  }
};

if (require.main === module) {
  // De runner zelf (hij heeft de wegwerpwereld nodig) staat apart, zodat dit
  // bestand de pure afleiding los-toetsbaar houdt -- net als scripts/tredeproef.
  require(path.join(__dirname, 'lib', 'losrunner')).main({ fs, path, WORTEL });
}
