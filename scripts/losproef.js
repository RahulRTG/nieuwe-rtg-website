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
/* Het appcontract noemt per app de routes die de INGANG zelf aanroept, los van
   de gedeelde setup -- de bron waaruit de eigenaar EIGEN wil afleiden. */
let CONTRACT = {};
try { CONTRACT = require(path.join(WORTEL, 'scripts', 'lib', 'appcontract')).CONTRACT || {}; } catch (e) { /* zonder contract valt alles terug op de scenario-bron */ }

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

/* De primaire categorie van een verzameling routes: de categorie van de functie
   die ze het vaakst raken. `negeer` is een set functie-ids die niet meetelt (de
   platform-bodem); `negeerCats` idem voor categorieen (het platform). Zo kiest
   de telling de EIGEN categorie van de app en niet de gedeelde setup (inloggen,
   member-schil), die anders de weinige bepalende eigen routes overstemt. Geen
   niet-platform-route -> null. */
function primaireCategorie(routes, negeer, negeerCats) {
  const skipId = negeer || new Set();
  const skipCat = new Set(negeerCats || []);
  const tel = new Map();
  for (const r of routes) {
    const id = idVanRoute(r); if (!id || skipId.has(id)) continue;
    const c = categorieVan(id); if (!c || skipCat.has(c)) continue;
    tel.set(c, (tel.get(c) || 0) + 1);
  }
  let beste = null, besteN = 0;
  for (const [c, n] of tel) if (n > besteN) { beste = c; besteN = n; }
  return beste;
}

/* DE EIGEN ROUTES van een app, zoals de eigenaar ze bedoelt: wat de INGANG zelf
   aanroept, zonder de gedeelde setup. Eerst uit het appcontract (het noemt per
   app "het scenario loopt <eigen routes>, de routes die <ingang> zelf aanroept,
   met <setup>"): alles vOOr "de route(s) die" is eigen, de "met ..."-setup valt
   weg. Dekt het contract de app niet (11 van de 110), dan de module-constanten
   van het scenariobestand (`const NAAM = '/api/...'`), die per conventie de
   eigen routes van het scherm zijn. Allebei leeg -> null (de aanroeper valt dan
   terug op alle scenario-routes). */
function eigenRoutes(functieLink, scenarioBron) {
  const e = functieLink && CONTRACT[functieLink];
  const waarom = e && e.voltooibaar && e.voltooibaar.waarom;
  if (waarom) {
    const eigenDeel = String(waarom).split(/de routes? die/)[0];
    const uit = (eigenDeel.match(/\/api\/[a-zA-Z0-9/_.-]+/g) || []).map((r) => r.replace(/[.,]+$/, ''));
    if (uit.length) return uit;
  }
  const consts = (String(scenarioBron || '').match(/^const\s+[A-Z0-9_]+\s*=\s*['"]\/api\/[^'"]+['"]/gm) || [])
    .map((s) => (s.match(/['"](\/api\/[^'"]+)['"]/) || [])[1]).filter(Boolean);
  return consts.length ? consts : null;
}

/* DE PLATFORMVOORZIENINGEN die AAN blijven, los van welke app getest wordt
   (aanscherping eigenaar 19 oktober 2026: LOS is geen kunstmatige isolatie).
   Afgeleid uit de bron, niet uit gevoel:

   - PLATFORM_CATS: hele categorieen die het platform ZIJN. Alleen "Toegang en
     identiteit" (tg-*: inloggen, account, sso, pin, rechten/zegel, link,
     gegevenspoort, aanmelden) -- identiteit en sessie, de deur die in ELKE
     trede open staat (server/functies/register/fasetreden.js:65-95,
     FASE_VOORDEUR). Geen enkele andere categorie is HEEL platform: RTG-Backoffice
     is gemengd (command-* is control-plane, maar `office`/`office-school` zijn de
     backoffice-APP), en de boardroom-schakelaar zelf (/api/techniek, /api/boardroom)
     staat ongated buiten het register (server/kern/bestuursroutes.js), dus die
     hoeft hier niet aangehouden te worden -- hem uitzetten kan niet.
   - De rest van het platform zit al in BODEM (trede 0, FASES[0].aan =
     FASE_VOORDEUR + de lanceervloer salon/supplier-salon) en in de ruggengraat,
     beide per FUNCTIE-ID: member + kern-* (de ledenschil/sessie),
     verificatie/paspoort/webauthn (beveiliging en bezitsbewijs),
     experience-platform (de app-draagschil), ov-mail-binnen (de mailpoort die
     member nodig heeft).
   - De betaalWAARHEID (betaalstop/geldwegen/kern-geldketen) en de
     bewijs-/logvoorziening (auditspoor/inzagespoor) staan ongated buiten het
     register en gaan dus nooit uit -- niets te schakelen, altijd aan. De geld-APP
     (`dom-*`, categorie Geld) is wEl app-domein en gaat uit tenzij de app onder
     test die zelf is. */
const PLATFORM_CATS = ['Toegang en identiteit'];

/* DE LANCEERVLOER IS GEEN PLATFORM. Trede 0 (FASES[0].aan) is de voordeur PLUS
   de eerste lanceerbare app-snede: `salon` (De Salon) en `supplier-salon` (de
   partnerkant daarvan). FASE_START noemt dat zelf "de voordeur plus De Salon"
   (fasetreden.js:97-98) -- De Salon is een sociale APP, geen
   platformvoorziening in de zin van de eigenaar (identiteit/beveiliging/
   betaalwaarheid/bewijs). Voor modus LOS hoort De Salon dus UIT, tenzij de app
   onder test De Salon zelf is. Dat is ook precies wat de eigenaar bij Berichten
   vraagt: "zonder Salon als actieve interface". De voordeur blijft wel staan. */
const LANCEERVLOER = ['salon', 'supplier-salon'];
const PLATFORM_BODEM = new Set([...BODEM].filter((id) => !LANCEERVLOER.includes(id)));

/* PLATFORM per FUNCTIE-ID, bovenop de bodem, op eigenaarsruling van 19 oktober
   2026: RTG iD-machtigen (`dom-rtgid`, /api/rtgid/*) en de paspoortkeuring
   (`dom-onboarding`, /api/onboarding/*) zijn identiteit en toestemming -- net als
   /api/toestemming (dat ongated buiten het register al altijd aan staat). Per id
   en niet de hele categorie "Identiteit en veiligheid": `dom-veiligheid`,
   `dom-kmar` e.d. in diezelfde categorie zijn wEl apps. */
const PLATFORM_EXTRA = ['dom-rtgid', 'dom-onboarding'];

/* DE EIGEN CATEGORIEEN van een app: de categorieen die zijn eigen routes raken
   (uit de contract-eigenclausule, zie eigenRoutes), zonder het platform. Een app
   is niet per se EEN categorie -- de Gezin-app bezit `rtf-contacten` (Sociaal) en
   de gezinsfuncties onder /api/foundation/gezin (RTFoundation). Eigendom volgt
   SCHERMEIGENAAR, niet het routepad (eigenaarsruling 19 oktober 2026), en het
   appcontract noemt die eigen routes. Alle eigen categorieen blijven samen aan;
   een route BUITEN die set en buiten het platform is een leun op een andere app. */
function eigenCategorieën(routes, aanIds) {
  const cats = new Set();
  for (const r of (routes || [])) {
    const id = idVanRoute(r); if (!id || aanIds.has(id)) continue;
    const c = categorieVan(id); if (!c || PLATFORM_CATS.includes(c)) continue;
    cats.add(c);
  }
  return cats;
}

/* DE HELE AFLEIDING, PUUR. Uit de bron van het scenario en de bron van de
   gedeelde wereldhelpers: de drie groepen van de eigenaar -- EIGEN (de primaire
   categorie), PLATFORM (blijft aan), en de OPTIONELE appkoppelingen die uit gaan
   -- plus de leun-kandidaten (andere app-categorieen die het scenario nog
   raakt). Geen server, geen bestand -- test/losproef.test.js draait hier recht
   op. */
function losAfleiding({ scenarioBron, ruggengraatBron, functieLink }) {
  const scRoutes = routesUit(scenarioBron);
  const ruggengraat = idsVanRoutes(routesUit(ruggengraatBron || ''));
  const aanIds = new Set([...PLATFORM_BODEM, ...ruggengraat, ...PLATFORM_EXTRA]);
  /* EIGEN leidt de proef af uit de routes die de ingang zelf aanroept (contract,
     anders de scenario-constanten), niet uit alle scenario-routes: de gedeelde
     setup (inloggen, member-connect, een andere app vullen) telt niet mee. De
     app mag meer dan EEN eigen categorie hebben; alle blijven aan. Lukt de
     eigenclausule niet, dan valt het terug op alle scenario-routes. */
  const heeftContract = !!(functieLink && CONTRACT[functieLink] && CONTRACT[functieLink].voltooibaar && CONTRACT[functieLink].voltooibaar.waarom);
  const eigen = eigenRoutes(functieLink, scenarioBron);
  const eigenBron = heeftContract ? 'contract' : (eigen ? 'scenario-constanten' : 'alle-routes (onzeker)');
  const eigenCats = eigenCategorieën(eigen || scRoutes, aanIds);
  const primair = eigenCats.size ? [...eigenCats].join(' + ') : null;
  const aanCats = new Set([...PLATFORM_CATS, ...eigenCats]);
  const uitCats = ALLE_CATS.filter((c) => !aanCats.has(c));
  /* De leun-kandidaten: categorieen die het scenario raakt maar die nu uit
     staan (dus niet de eigen categorie en niet het platform). */
  const andereCats = [...new Set(scRoutes.map(catVanRoute).filter((c) => c && !aanCats.has(c)))];
  const groepen = {
    eigen: primair || '(volledig op de bodem)',
    platform: [...new Set([...PLATFORM_CATS, 'bodem-ids (trede 0 + ruggengraat, per id)',
      'ongated infra: betaalwaarheid + bewijs/log (buiten het register)'])],
    optioneelUit: uitCats
  };
  return { primair, eigenCats: [...eigenCats], eigenBron, aanIds, aanCats: [...aanCats], uitCats, andereCats, groepen, scRoutes };
}

/* Het oordeel over een gedraaid scenario, puur uit zijn boek.

   LOS-KERN is de verfijning van de eigenaar voor Office: de eigen belofte sluit,
   en de enige open stap is een ISOLATIE-stap die een tegenspeler uit een andere
   app opbouwt (B.v. "een zaak kan dit kantoordocument niet openen" -- dat vraagt
   een zaak uit de partnerapp). Die tegenspeler kan in LOS-modus niet bestaan, dus
   de stap breekt bij de opbouw (stand 'stuk') op een 503 van een andere app. Dat
   is geen leunende belofte maar een proef die het isolatiebewijs alleen in SAMEN
   kan leveren (BEWIJSMACHINE.md par. 6a). Een open stap ZONDER zo'n cross-app-503
   is wel een echte kern-leun -> LEUNT. */
function oordeel({ afgebroken, open }) {
  if (afgebroken) return 'AFGEBROKEN';
  if (!open || !open.length) return 'LOS';
  const alleenIsolatie = open.every((s) => s && s.isolatie);
  return alleenIsolatie ? 'LOS-KERN' : 'LEUNT';
}

module.exports = {
  KERN, BODEM, ALLE_CATS, WORTEL, PLATFORM_CATS, LANCEERVLOER, PLATFORM_BODEM,
  categorieVan, idVanRoute, catVanRoute, routesUit, idsVanRoutes, primaireCategorie, eigenRoutes, eigenCategorieën, PLATFORM_EXTRA,
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
