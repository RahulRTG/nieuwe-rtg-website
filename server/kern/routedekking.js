/* ============================================================================
   DE ROUTEDEKKING -- EEN ROUTE IS EEN METHODE PLUS EEN PATROON, EN ZE TELLEN
   ALLEMAAL MEE.

   Dit is de ENIGE plek waar staat wat "een route" is en wanneer hij is
   aangeraakt. scripts/dekking.js (de poort waar de build op zakt) en
   routes/office/dekking.js (het scherm waar het personeel kijkt) rekenen er
   allebei mee. Zo is het cijfer op dat scherm hetzelfde cijfer als het cijfer
   in de poort; twee optellingen voor een waarheid lopen uiteen (LAT.md regel 4).

   WAT HIER VERANDERDE, EN WAAROM HET GEEN SMAAK IS

   De meting keek eerst alleen naar paden die met /api/ beginnen, en telde per
   PAD. Dat liet twee gaten open die met geen mogelijkheid te zien waren, ook
   niet door wie het cijfer las:

     - zeven routes buiten /api/ (/apps, /apps/index.html, /apps/bureau.html,
       /media/:naam, /werken/:code, /scriptbundel.js, /stijlbundel.css) stonden
       buiten de meting. Ze waren niet ONGEDEKT -- ze bestonden niet voor het
       cijfer. Een van de twee bundelroutes draagt elke pagina van het huis.
     - dertien methode/pad-paren vielen samen met hun buurman. Op
       /api/scim/v2/Users/:id hangen DELETE, GET, PATCH en PUT; een toets op
       een van de vier zette alle vier op groen. Datzelfde gold voor elf paden
       met GET naast POST.

   Honderd procent over een deelverzameling is geen honderd procent. De eenheid
   is daarom METHODE + PATROON, over alles wat de router kent.

   WAT ER NIET BIJ ZIT, en met opzet: de SCHERM-regels uit het journaal. Een
   pagina komt langs de statische laag en is geen route; die meting heeft zijn
   eigen meter (scripts/schermen.js). Ze staan in hetzelfde journaal en worden
   hier op hun methode eruit gefilterd.
   ========================================================================== */
'use strict';

/* HEAD KOMT LANGS DE GET-LAAG. web/routing.js laat een HEAD-verzoek matchen op
   een GET-route (`laag.method === 'GET' && req.method === 'HEAD'`), maar het
   journaal noteert req.method. Zonder deze gelijkstelling levert een HEAD de
   sleutel "HEAD /pad" op, die op geen enkele route van de kaart past: dezelfde
   route zou dan TWEE keer verkeerd tellen -- als nooit aangeraakt EN als vreemd
   patroon. Eén regel, twee valse meldingen minder. */
function normaalMethode(m) {
  const x = String(m == null ? '' : m).trim().toUpperCase();
  return x === 'HEAD' ? 'GET' : (x || 'GET');
}

function sleutelVan(methode, pad) { return normaalMethode(methode) + ' ' + String(pad); }

/* Het domein waaronder een route valt: het derde deel van /api/<domein>/... .
   Alles buiten /api/ is een pagina-route en heet zo, want "overig" zou hem in
   dezelfde bak gooien als een /api/-pad zonder domein. */
function domeinVan(pad) {
  const p = String(pad);
  if (!p.startsWith('/api/')) return 'pagina';
  return p.split('/')[2] || 'overig';
}

/* Opzettelijke teststoringen bestaan alleen onder NODE_ENV=test (zie server.js).
   Ze horen nergens anders te bestaan, dus mogen ze de kaart niet vervuilen en
   niet als drift gemeld worden. */
const BUITEN = (pad) => String(pad).startsWith('/api/test/');

/* DE INVENTARIS: elke meetbare route precies één keer.

   Slikt beide vormen waarin een routekaart hier binnenkomt -- app._routes()
   geeft één regel per LAAG ({pad, methode}, dus een route met drie middlewares
   staat er drie keer), scripts/routekaart.js geeft de gebundelde vorm
   ({pad, methoden: [...]}). Eén normalisatie hier, geen tweede elders. */
function inventaris(rauw) {
  const per = new Map();
  const onmeetbaar = [];
  for (const r of (Array.isArray(rauw) ? rauw : [])) {
    /* '/' wordt NIET overgeslagen. Dat deed zowel deze functie als
       scripts/routekaart.js, en het knipte de voordeur uit de meting -- de
       drukste route van het huis. "Alle routes" met een uitzondering erin is
       geen alle routes. */
    const pad = r && r.pad ? String(r.pad) : '';
    if (!pad || BUITEN(pad)) continue;
    const methoden = Array.isArray(r.methoden) ? r.methoden : [r.methode];
    for (const m of methoden) {
      /* EEN ROUTE ZONDER EIGEN METHODE IS NIET TE METEN, EN DAT MOET OPVALLEN.
         web/routing.js noteert een patroon alleen als de laag een methode
         draagt, dus een route van app.all() komt nooit in het journaal. Die
         stilzwijgend meetellen zou hem voorgoed op "nooit aangeraakt" zetten;
         hem overslaan zou hem gratis groen geven. Beide zijn fout, dus komt hij
         apart terug en noemt de poort hem bij naam (LAT.md regel 3). */
      const naam = normaalMethode(m);
      if (naam === 'ALL') { onmeetbaar.push({ methode: 'ALL', pad, domein: domeinVan(pad) }); continue; }
      per.set(naam + ' ' + pad, { methode: naam, pad, domein: domeinVan(pad) });
    }
  }
  const lijst = [...per.values()].sort((a, b) =>
    a.pad === b.pad ? (a.methode < b.methode ? -1 : 1) : (a.pad < b.pad ? -1 : 1));
  return { routes: lijst, onmeetbaar };
}

/* De geraakte sleutels uit de regels van het routejournaal (server/routelog.js).
   Slikt een Set, een array of een tekst met regels. SCHERM-regels vallen eruit:
   die dragen een url plus een toetsnaam en zijn een andere meting. */
function geraaktUit(regels) {
  const uit = new Set();
  const bron = typeof regels === 'string' ? regels.split('\n')
    : (regels instanceof Set ? [...regels] : (Array.isArray(regels) ? regels : []));
  for (const rauw of bron) {
    const regel = String(rauw).trim();
    const ruimte = regel.indexOf(' ');
    if (ruimte <= 0) continue;
    const methode = regel.slice(0, ruimte);
    const pad = regel.slice(ruimte + 1).trim();
    if (methode === 'SCHERM' || !pad || BUITEN(pad)) continue;
    uit.add(sleutelVan(methode, pad));
  }
  return uit;
}

/* DE METING. Geeft altijd alle drie de kanten terug: wat er niet is aangeraakt,
   wat er is aangeraakt zonder op de kaart te staan (drift tussen router en
   kaart), en wat niet te meten valt. Een van de drie verzwijgen maakt het
   percentage mooier en het antwoord slechter. */
function meet(rauw, regels) {
  const { routes, onmeetbaar } = inventaris(rauw);
  const geraakt = geraaktUit(regels);
  const opKaart = new Set(routes.map(r => sleutelVan(r.methode, r.pad)));

  const ongeraakt = routes.filter(r => !geraakt.has(sleutelVan(r.methode, r.pad)));
  const vreemd = [...geraakt].filter(s => !opKaart.has(s)).sort();

  const perDomein = new Map();
  for (const r of routes) {
    const d = perDomein.get(r.domein) || { domein: r.domein, totaal: 0, geraakt: 0, ongeraakt: [] };
    d.totaal++;
    if (geraakt.has(sleutelVan(r.methode, r.pad))) d.geraakt++;
    else d.ongeraakt.push(r.methode + ' ' + r.pad);
    perDomein.set(r.domein, d);
  }

  /* De GATEN zijn de nooit-aangeraakte routes plus de niet te meten routes. Ze
     staan bij elkaar omdat de poort er één vraag over stelt: is er iets waarvan
     we het niet weten? "Niet gemeten" en "niet meetbaar" zijn daar hetzelfde
     antwoord op. */
  const gaten = ongeraakt.length + onmeetbaar.length;
  return {
    totaal: routes.length,
    geraakt: routes.length - ongeraakt.length,
    nooitAangeraakt: ongeraakt.length,
    onmeetbaar,
    gaten,
    /* Naar beneden afgerond, niet naar het naastbijgelegen getal: 4188 van 4189
       is geen honderd procent, en een meter die dat zo afdrukt is precies de
       meter die dit huis al een keer heeft misleid (zie NORM.json bij
       endpointsNooitAangeraakt). Alleen echt alles geeft 100. */
    pct: routes.length ? Math.floor((routes.length - gaten) / routes.length * 100) : 0,
    ongeraakt,
    vreemd,
    perDomein: [...perDomein.values()].sort((a, b) =>
      (b.totaal - b.geraakt) - (a.totaal - a.geraakt) || (a.domein < b.domein ? -1 : 1))
  };
}

module.exports = { normaalMethode, sleutelVan, domeinVan, inventaris, geraaktUit, meet };
