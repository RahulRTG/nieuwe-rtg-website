/* ============================================================================
   DE ROUTEDEKKING -- EEN ROUTE IS EEN METHODE PLUS EEN PATROON, EN ZE TELLEN
   ALLEMAAL MEE.

   Dit is de ENIGE plek waar staat wat "een route" is en wanneer hij is
   aangeraakt. scripts/dekking.js (de poort waar de build op zakt) en
   routes/office/dekking.js (het scherm waar het personeel kijkt) rekenen er
   allebei mee. Zo is het cijfer op dat scherm hetzelfde cijfer als het cijfer
   in de poort; twee optellingen voor een waarheid lopen uiteen (LAT.md regel 4).

   DE EENHEID IS METHODE + PATROON, over alles wat de router kent. Dat was eerst
   een PAD onder /api/, en die twee versimpelingen kostten samen twintig routes
   die het cijfer niet kende: zeven pagina-routes (waaronder de bundelroutes die
   elke pagina van het huis dragen) en dertien methode/pad-paren die samenvielen
   met hun buurman -- op /api/scim/v2/Users/:id zette een toets op GET ook DELETE,
   PATCH en PUT op groen. Honderd procent over een deelverzameling is geen
   honderd procent.

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

/* DE INVENTARIS: elke meetbare route precies één keer, met zijn bewakers.

   Slikt beide vormen waarin een routekaart hier binnenkomt -- app._routes()
   geeft één regel per LAAG ({pad, methode, laagNaam}, dus een route met drie
   middlewares staat er drie keer), scripts/routekaart.js geeft de gebundelde
   vorm ({pad, methoden: [...], bewakers: {...}}). Eén normalisatie hier, geen
   tweede elders.

   DE BEWAKERS, EN WAAROM DIE HIER WORDEN AFGELEID EN NIET ELDERS

   Een route is in deze router EEN LAAG PER MIDDLEWARE, alle met hetzelfde pad en
   dezelfde methode, in de volgorde waarin ze zijn opgehangen. De laatste is de
   handler, alles daarvoor is een bewaker. Die regel is een feit over deze router
   en hoort dus bij de routerkennis te staan -- niet overgeschreven in elk script
   dat hem nodig heeft, want dan is hij op vier plekken anders (LAT.md regel 4).

   `bewakers: null` betekent NIET GEEN BEWAKERS maar ONBEKEND: de invoer droeg
   geen laagnamen. Dat verschil moet blijven staan. Een leeg lijstje leest als
   "deze route is onbeschermd" en dat is een heel andere bewering dan "we weten
   het niet" (LAT.md regel 3). 578 routes van dit huis hebben werkelijk geen
   bewakerslaag omdat ze in de handler een capability-token controleren; die
   verdienen [] en de rest verdient null. */
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
    // per laag (app._routes) is er EEN naam; per bundel (routekaart) een lijst per methode
    const heeftLaag = r && Object.prototype.hasOwnProperty.call(r, 'laagNaam');
    for (const m of methoden) {
      /* EEN ROUTE ZONDER EIGEN METHODE IS NIET TE METEN, EN DAT MOET OPVALLEN.
         web/routing.js noteert een patroon alleen als de laag een methode
         draagt, dus een route van app.all() komt nooit in het journaal. Die
         stilzwijgend meetellen zou hem voorgoed op "nooit aangeraakt" zetten;
         hem overslaan zou hem gratis groen geven. Beide zijn fout, dus komt hij
         apart terug en noemt de poort hem bij naam (LAT.md regel 3). */
      const naam = normaalMethode(m);
      if (naam === 'ALL') { onmeetbaar.push({ methode: 'ALL', pad, domein: domeinVan(pad) }); continue; }
      const sleutel = naam + ' ' + pad;
      const al = per.get(sleutel);
      if (!al) {
        const gebundeld = r.bewakers && !Array.isArray(r.bewakers) ? r.bewakers[naam] : null;
        per.set(sleutel, { methode: naam, pad, domein: domeinVan(pad),
          lagen: heeftLaag ? [String(r.laagNaam || '')] : null,
          bewakers: Array.isArray(gebundeld) ? gebundeld.slice() : (Array.isArray(r.bewakers) ? r.bewakers.slice() : null) });
      } else if (al.lagen && heeftLaag) {
        al.lagen.push(String(r.laagNaam || ''));
      }
    }
  }
  /* De bewakers uit de laagreeks: alles behalve de laatste, zonder de anonieme.
     Alleen wanneer de reeks er is -- anders blijft `bewakers` null (onbekend). */
  const lijst = [...per.values()].map(r => {
    if (r.bewakers == null && Array.isArray(r.lagen)) r.bewakers = r.lagen.slice(0, -1).filter(Boolean);
    delete r.lagen;
    return r;
  }).sort((a, b) =>
    a.pad === b.pad ? (a.methode < b.methode ? -1 : 1) : (a.pad < b.pad ? -1 : 1));
  return { routes: lijst, onmeetbaar };
}

/* De geraakte sleutels uit de regels van het routejournaal (server/routelog.js).
   Slikt een Set, een array of een tekst met regels.

   DRIE REGELSOORTEN VALLEN ERUIT: SCHERM (een pagina, voor scripts/schermen.js),
   TOETS (een route met de toets die hem raakte, voor de OUTPUT-as) en AUDIT (de
   journalen die tijdens dat verzoek groeiden, voor de AUDIT-as). Het journaal
   draagt meer dan een meting.

   Zonder deze filter komen ze binnen als sleutel 'TOETS GET /api/x foo.js', die
   op geen enkele route past. Ze zouden dan als VREEMD PATROON gelden -- drift
   tussen router en journaal -- en de dekkingspoort laten zakken op regels die er
   met opzet in staan. Gemeten: twaalf valse vreemden op achttien regels. Elke
   nieuwe regelsoort hoort hier langs. */
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
    if (methode === 'SCHERM' || methode === 'TOETS' || methode === 'AUDIT' || !pad || BUITEN(pad)) continue;
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
