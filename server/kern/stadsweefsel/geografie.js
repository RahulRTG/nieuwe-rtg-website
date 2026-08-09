/* RTG Stadsweefsel, deel "geografie": EEN geografische waarheid voor de stad.

   Dit was het grootste gat onder RTG Stad. De acht domeinen wisten wel DAT er
   iets speelde, maar niet WAAR: zones waren zes losse namen, een Stadsdoos had
   geen positie, en het A*-wegennet van kern/navigatie leefde in een eigen
   wereld. Zonder plaats kun je niet weten wat ernaast staat, welke monteur het
   snelst is, of twee meldingen hetzelfde probleem zijn, of welke buurt geraakt
   wordt. Alles wat het weefsel verder doet (objecten, zaken, werkorders,
   afhankelijkheden) hangt daarom aan deze laag.

   De boom is vast en vijf niveaus diep:
     stad -> wijk -> buurt -> zone -> straatsegment
   Elk gebied draagt een geometrie (punt, lijn of vlak) en kent zijn ouder. Een
   gebied hoger in de boom krijgt de omhullende rechthoek van zijn kinderen, dus
   de grenzen van een wijk zijn geen tweede waarheid maar een gevolg.

   EEN WERELD, NIET TWEE. Het middelpunt en de grenzen komen uit kern/navigatie
   (REF/BOUNDS, Ibiza-stad), want dat is waar het wegennet en de POI-lagen al
   liggen. Een eigen middelpunt hier zou betekenen dat de stad en haar wegen
   naast elkaar bestaan zonder elkaar te raken -- precies de fout die deze laag
   moet wegnemen.

   DE ZONES ZIJN HIER DE WAARHEID. kern/stad had zijn eigen lijstje zonenamen in
   db.data.stadZones; die leest nu uit deze boom (index.js koppelt dat). Twee
   plekken die dezelfde waarheid vasthouden lopen uiteen, en dan meldt een
   bewoner iets in een zone die de veldploeg niet kent.

   Krijgt de gedeelde ctx van kern/stadsweefsel/index.js. */
const { schoon, coordPaar } = require('../util');
const { haversine } = require('../../lib/geo');
const { REF, BOUNDS } = require('../navigatie');

const NIVEAUS = ['stad', 'wijk', 'buurt', 'zone', 'straatsegment'];

module.exports = (ctx) => {
  const { bak, save, crypto } = ctx;

  const gebieden = () => bak().gebieden;
  const perId = () => { const m = {}; for (const g of gebieden()) m[g.id] = g; return m; };

  // de meetkunde (punt-in-vlak, afstand tot een lijnstuk, omhullende) staat in
  // ./meetkunde.js: pure rekenkunde, los na te rekenen
  const { hoeken, inVlak, totGeometrie: totGeo, middenVan, omhullende } = require('./meetkunde')({ REF });
  const totGeometrie = (p, g) => totGeo(p, g, haversine);

  /* De seed -- de zes zones, hun straten en de gebieden erboven -- staat in
     ./geografieseed.js. Die bouwt de boom een keer op; hieronder wordt hij
     alleen nog bevraagd. */
  const zaai = require('./geografieseed')({ REF, gebieden, save, hoeken, middenVan, omhullende });
  const { zorgGeografie } = zaai;

  // ---- opvragen ----

  const gebied = (id) => perId()[String(id || '')] || null;
  const kinderen = (id) => gebieden().filter(g => g.ouder === String(id || ''));

  /* De STAD-AS staat in ./steden.js: welke stad hoort bij dit gebied, welke
     steden zijn er, wat zijn de grenzen van een stad en hoe komt er een bij.
     Dat is uit dit bestand gehaald toen het over de 10 kB-grens ging, en de
     naad lag er al: geografie.js bevraagt de boom, steden.js gaat over de
     WORTELS van die boom. */
  const stadas = require('./steden')({ gebieden, gebied, NIVEAUS, BOUNDS, schoon, coordPaar, zaai, opNaamRuw: (naam, niveau) => gebieden().find(g => g.naam.toLowerCase() === String(naam || '').trim().toLowerCase() && (!niveau || g.niveau === niveau)) || null });
  const { stadVan, steden, stadId, inStad, grenzenVan, stadErbij } = stadas;

  const opNiveau = (niveau, stad) => {
    const wortel = stadId(stad);
    return gebieden().filter(g => g.niveau === niveau && inStad(g, wortel));
  };
  const namen = (niveau, stad) => opNiveau(niveau, stad).map(g => g.naam);
  const opNaam = (naam, niveau, stad) => {
    const wortel = stadId(stad);
    return gebieden().find(g =>
      g.naam.toLowerCase() === String(naam || '').trim().toLowerCase() &&
      (!niveau || g.niveau === niveau) && inStad(g, wortel)) || null;
  };

  // de kruimelpad van stad naar dit gebied; begrensd, want een kapotte
  // ouder-verwijzing mag geen oneindige lus worden
  function pad(id) {
    const uit = [];
    let g = gebied(id);
    for (let i = 0; g && i < NIVEAUS.length + 1; i++) { uit.unshift(g); g = g.ouder ? gebied(g.ouder) : null; }
    return uit;
  }
  const binnen = (ouderId, id) => pad(id).some(g => g.id === String(ouderId || ''));

  /* Waar ligt dit punt? Geeft het diepste gebied dat hem bevat, plus het hele
     kruimelpad. Een straatsegment is een lijn: daar hoor je bij als je er
     dichtbij genoeg staat (STRAAT_M), niet als je er precies op staat. */
  const STRAAT_M = 80;
  function plaats(lat, lng) {
    zorgGeografie();
    const p = { lat, lng };
    const zone = opNiveau('zone').find(z => inVlak(p, z.geometrie.punten)) || null;
    if (!zone) return { binnenStad: false, zone: null, straat: null, pad: [] };
    let straat = null, best = STRAAT_M;
    for (const s of kinderen(zone.id)) {
      const m = totGeometrie(p, s.geometrie);
      if (m < best) { best = m; straat = s; }
    }
    const kruimels = pad((straat || zone).id);
    return {
      binnenStad: true, zone: { id: zone.id, naam: zone.naam },
      straat: straat ? { id: straat.id, naam: straat.naam, meter: Math.round(best) } : null,
      gebiedId: (straat || zone).id,
      pad: kruimels.map(g => ({ id: g.id, niveau: g.niveau, naam: g.naam }))
    };
  }

  // het gebied waarin een object/zaak thuishoort, met een naam die een mens leest
  function label(id) {
    const p = pad(id);
    return p.length ? p.map(g => g.naam).slice(1).join(' · ') : '';
  }

  /* De straatzoeker: welk straatsegment of welke zone staat er in deze zin?
     Bewust simpel en streng: hij zoekt de naam als heel woord, neemt de
     LANGSTE treffer (zodat "Marinalaan" wint van "Marina") en geeft niets
     terug bij twijfel. Een adreszoeker die gokt, hangt meldingen aan de
     verkeerde straat en dat is erger dan geen plaats: dan gaat er iemand
     kijken op een plek waar niets aan de hand is. */
  function uitTekst(tekst, stad) {
    const t = String(tekst || '').toLowerCase();
    if (t.length < 3) return null;
    let beste = null, evenGoed = 0;
    for (const g of [...opNiveau('straatsegment', stad), ...opNiveau('zone', stad)]) {
      const naam = g.naam.toLowerCase();
      if (!new RegExp('(^|[^a-z])' + naam.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '([^a-z]|$)').test(t)) continue;
      if (!beste || naam.length > beste.naam.length) { beste = g; evenGoed = 1; }
      else if (naam.length === beste.naam.length && g.id !== beste.id) evenGoed++;
    }
    /* TWEE STEDEN KUNNEN DEZELFDE STRAATNAAM HEBBEN, en het startraster geeft ze
       zelfs dezelfde. Staat de naam in meer dan een stad, dan is er geen
       antwoord -- deze zoeker geeft al sinds zijn eerste versie niets terug bij
       twijfel, en dit is precies zo'n twijfel. Wie het wel weet, geeft de stad
       mee. */
    return evenGoed > 1 ? null : beste;
  }

  /* Het MAKEN van een gebied staat in ./gebiedmaak.js: dit bestand bevraagt de
     boom, dat bestand voegt eraan toe. Twee dingen die los van elkaar
     veranderen -- de straatzoeker wijzigt zelden, de regels voor wat er onder
     wat mag hangen wel. */
  const gebiedMaak = require('./gebiedmaak')({ NIVEAUS, gebied, gebieden, save, crypto, schoon,
    middenVan, zorgGeografie, grenzenVan, stadVan });

  return {
    NIVEAUS, zorgGeografie, gebied, kinderen, opNiveau, namen, opNaam, uitTekst, pad, binnen, plaats, label,
    stadVan, steden, stadErbij, grenzenVan,
    afstand: haversine, totGeometrie, inVlak, middenVan,
    api: {
      weefselGebieden: ({ niveau } = {}) => {
        zorgGeografie();
        return { status: 200, niveaus: NIVEAUS, grenzen: BOUNDS, midden: REF,
          gebieden: (niveau ? opNiveau(niveau) : gebieden()).map(g => ({ ...g, label: label(g.id) })) };
      },
      weefselGebiedMaak: gebiedMaak,
      weefselStadErbij: (v) => { const r = stadErbij(v || {}); return r.ok ? { status: 200, ...r } : r; },
      weefselSteden: () => { zorgGeografie(); return { status: 200,
        steden: steden().map(g => ({ id: g.id, naam: g.naam, zones: namen('zone', g.id).length })) }; },
      weefselPlaats: ({ lat, lng }) => {
        const p = coordPaar(lat, lng);
        if (!p) return { status: 400, error: 'Geef een geldige positie (lat en lng).' };
        return { status: 200, ...plaats(p.lat, p.lng) };
      }
    }
  };
};
