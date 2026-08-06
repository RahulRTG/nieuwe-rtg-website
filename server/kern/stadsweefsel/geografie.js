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
const CEL_LAT = 0.012, CEL_LNG = 0.016;   // een zone is ruwweg 1,3 x 1,4 km

/* De zes zones op een raster rond het middelpunt, zodat ze elkaar NIET
   overlappen: een punt hoort bij precies een zone. [id, naam, kolom, rij] */
const ZONES = [
  ['oudwest', 'Oud-West', -1, 1],
  ['centrum', 'Centrum', 0, 1],
  ['marina', 'Marina', 1, 1],
  ['bedrijven', 'Bedrijvenkwartier', -1, 0],
  ['groen', 'Groenzone', 0, 0],
  ['boulevard', 'Boulevard', 1, 0]
];
const BUURTEN = [
  ['oudestad', 'Oude Stad', 'kern', ['oudwest', 'centrum']],
  ['haven', 'Haven', 'kust', ['marina', 'boulevard']],
  ['werkgebied', 'Werkgebied', 'rand', ['bedrijven', 'groen']]
];
const WIJKEN = [['kern', 'Kern'], ['kust', 'Kust'], ['rand', 'Rand']];

module.exports = (ctx) => {
  const { bak, save, crypto } = ctx;

  const gebieden = () => bak().gebieden;
  const perId = () => { const m = {}; for (const g of gebieden()) m[g.id] = g; return m; };

  // de meetkunde (punt-in-vlak, afstand tot een lijnstuk, omhullende) staat in
  // ./meetkunde.js: pure rekenkunde, los na te rekenen
  const { hoeken, inVlak, totGeometrie: totGeo, middenVan, omhullende } = require('./meetkunde')({ REF });
  const totGeometrie = (p, g) => totGeo(p, g, haversine);

  const vakVan = (kol, rij) => ({
    lat0: REF.lat + (rij - 1) * CEL_LAT, lat1: REF.lat + rij * CEL_LAT,
    lng0: REF.lng + (kol - 0.5) * CEL_LNG, lng1: REF.lng + (kol + 0.5) * CEL_LNG
  });

  // ---- de seed: de stad zoals hij nu bestaat ----

  function zorgGeografie() {
    if (gebieden().length) return;
    const rij = gebieden();
    const zet = (id, niveau, naam, ouder, soort, punten) => {
      const g = { id: 'G-' + id, niveau, naam, ouder: ouder ? 'G-' + ouder : null,
        geometrie: { soort, punten }, centrum: middenVan(punten) };
      rij.push(g);
      return g;
    };
    const zones = ZONES.map(([id, naam, kol, r]) => {
      const vak = vakVan(kol, r);
      const z = zet(id, 'zone', naam, BUURTEN.find(b => b[3].includes(id))[0], 'vlak', hoeken(vak));
      /* Twee straatsegmenten per zone: een laan oost-west en een straat
         noord-zuid. Ze zijn er niet om mooi te ogen -- een melding, een
         lantaarn en een werkorder hangen straks aan een SEGMENT, en dat is het
         niveau waarop een monteur denkt ("de Marinalaan", niet "zone Marina"). */
      const mLat = (vak.lat0 + vak.lat1) / 2, mLng = (vak.lng0 + vak.lng1) / 2;
      zet(id + '-laan', 'straatsegment', naam + 'laan', id, 'lijn',
        [{ lat: mLat, lng: vak.lng0 }, { lat: mLat, lng: vak.lng1 }]);
      zet(id + '-straat', 'straatsegment', naam + 'straat', id, 'lijn',
        [{ lat: vak.lat0, lng: mLng }, { lat: vak.lat1, lng: mLng }]);
      return z;
    });
    for (const [id, naam, wijk, kids] of BUURTEN) {
      const punten = omhullende(zones.filter(z => kids.includes(z.id.slice(2))));
      zet(id, 'buurt', naam, wijk, 'vlak', punten);
    }
    for (const [id, naam] of WIJKEN) {
      const punten = omhullende(rij.filter(g => g.ouder === 'G-' + id));
      zet(id, 'wijk', naam, 'stad', 'vlak', punten);
    }
    zet('stad', 'stad', 'RTG Stad', null, 'vlak', omhullende(rij.filter(g => g.niveau === 'wijk')));
    save();
  }

  // ---- opvragen ----

  const gebied = (id) => perId()[String(id || '')] || null;
  const kinderen = (id) => gebieden().filter(g => g.ouder === String(id || ''));
  const opNiveau = (niveau) => gebieden().filter(g => g.niveau === niveau);
  const namen = (niveau) => opNiveau(niveau).map(g => g.naam);
  const opNaam = (naam, niveau) => gebieden().find(g =>
    g.naam.toLowerCase() === String(naam || '').trim().toLowerCase() && (!niveau || g.niveau === niveau)) || null;

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

  function gebiedMaak({ niveau, naam, ouder, punten, soort }) {
    zorgGeografie();
    if (!NIVEAUS.includes(String(niveau || ''))) return { status: 400, error: 'Kies een niveau: ' + NIVEAUS.join(', ') + '.' };
    const n = schoon(naam, 60);
    if (!n) return { status: 400, error: 'Hoe heet het gebied?' };
    const o = ouder ? gebied(ouder) : null;
    if (ouder && !o) return { status: 404, error: 'Dat ouder-gebied bestaat niet.' };
    if (o && NIVEAUS.indexOf(o.niveau) >= NIVEAUS.indexOf(niveau))
      return { status: 400, error: 'Een ' + niveau + ' hoort onder een ' + NIVEAUS[NIVEAUS.indexOf(niveau) - 1] + ', niet onder een ' + o.niveau + '.' };
    const rij = (Array.isArray(punten) ? punten : []).map(q => ({ lat: Number(q && q.lat), lng: Number(q && q.lng) }))
      .filter(q => Number.isFinite(q.lat) && Number.isFinite(q.lng) &&
        q.lat >= BOUNDS.lat0 && q.lat <= BOUNDS.lat1 && q.lng >= BOUNDS.lng0 && q.lng <= BOUNDS.lng1);
    if (!rij.length) return { status: 400, error: 'Geef minstens een punt binnen de stadsgrenzen.' };
    const s = ['punt', 'lijn', 'vlak'].includes(soort) ? soort : (rij.length === 1 ? 'punt' : rij.length === 2 ? 'lijn' : 'vlak');
    const g = { id: 'G-' + crypto.randomBytes(4).toString('hex'), niveau, naam: n,
      ouder: o ? o.id : null, geometrie: { soort: s, punten: rij }, centrum: middenVan(rij) };
    gebieden().push(g);
    save();
    return { ok: true, gebied: g };
  }

  return {
    NIVEAUS, zorgGeografie, gebied, kinderen, opNiveau, namen, opNaam, pad, binnen, plaats, label,
    afstand: haversine, totGeometrie, inVlak, middenVan,
    api: {
      weefselGebieden: ({ niveau } = {}) => {
        zorgGeografie();
        return { status: 200, niveaus: NIVEAUS, grenzen: BOUNDS, midden: REF,
          gebieden: (niveau ? opNiveau(niveau) : gebieden()).map(g => ({ ...g, label: label(g.id) })) };
      },
      weefselGebiedMaak: gebiedMaak,
      weefselPlaats: ({ lat, lng }) => {
        const p = coordPaar(lat, lng);
        if (!p) return { status: 400, error: 'Geef een geldige positie (lat en lng).' };
        return { status: 200, ...plaats(p.lat, p.lng) };
      }
    }
  };
};
