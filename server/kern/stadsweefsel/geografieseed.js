/* RTG Stadsweefsel, deel "geografieseed": het raster waarop een stad begint.

   Afgesplitst uit ./geografie.js, en op de naad die er al lag: dit bestand
   BOUWT de boom op, geografie.js BEVRAAGT hem daarna. Twee dingen die los van
   elkaar veranderen -- er komt eerder een zone bij dan dat de straatzoeker
   anders gaat werken.

   De zes zones liggen op een raster rond het middelpunt zodat ze elkaar NIET
   overlappen: een punt hoort bij precies een zone. Zou dat niet zo zijn, dan
   zou dezelfde lantaarn in twee zones staan en zouden twee ploegen erheen.

   DE BOOM DROEG EEN STAD, EN DAT WAS EEN AANNAME EN GEEN ONTWERP. De vijf
   niveaus beginnen bij `stad`, dus een tweede wortel paste er altijd al in;
   alleen bouwde dit bestand er nooit een, en stopte zorgGeografie() zodra er
   iets stond. Nu bouwt bouwStad() een stad op een MEEGEGEVEN middelpunt met een
   MEEGEGEVEN voorvoegsel, en roept zorgGeografie() dat aan voor de eerste stad
   -- met een leeg voorvoegsel, zodat elke bestaande id (`G-stad`, `G-marina`,
   `G-marina-laan`) letterlijk blijft staan. Er is dus geen migratie, en dat is
   met opzet: gegevens verplaatsen om een functie toe te voegen is de duurste
   manier om een fout te maken die je pas maanden later ziet.

   Het middelpunt van de EERSTE stad komt uit kern/navigatie, niet van hier --
   die stad en haar wegennet horen een wereld te zijn. Zie de kop van
   ./geografie.js. Een volgende stad krijgt haar eigen middelpunt mee; daar
   ligt (nog) geen wegennet onder, en dat staat in de uitslag. */

const CEL_LAT = 0.012, CEL_LNG = 0.016;   // een zone is ruwweg 1,3 x 1,4 km

// [id, naam, kolom, rij]
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

module.exports = ({ REF, gebieden, save, hoeken, middenVan, omhullende }) => {
  const vakVan = (kol, rij, midden) => {
    const m = midden || REF;
    return {
      lat0: m.lat + (rij - 1) * CEL_LAT, lat1: m.lat + rij * CEL_LAT,
      lng0: m.lng + (kol - 0.5) * CEL_LNG, lng1: m.lng + (kol + 0.5) * CEL_LNG
    };
  };

  /* Eén raster, twee aanroepers. De eerste stad krijgt voorvoegsel '' en het
     middelpunt uit kern/navigatie; elke volgende krijgt haar eigen twee. Dat is
     dezelfde reden als overal in dit huis: twee keer hetzelfde raster bouwen
     levert binnen een jaar twee verschillende steden op. */
  function bouwStad({ voorvoegsel, naam, midden }) {
    const vv = String(voorvoegsel || '');
    const rij = gebieden();
    const nieuw = [];
    const zet = (id, niveau, hoe, ouder, soort, punten) => {
      const g = { id: 'G-' + vv + id, niveau, naam: hoe, ouder: ouder ? 'G-' + vv + ouder : null,
        geometrie: { soort, punten }, centrum: middenVan(punten) };
      rij.push(g);
      nieuw.push(g);
      return g;
    };
    const zones = ZONES.map(([id, hoe, kol, r]) => {
      const vak = vakVan(kol, r, midden);
      const z = zet(id, 'zone', hoe, BUURTEN.find(b => b[3].includes(id))[0], 'vlak', hoeken(vak));
      /* Twee straatsegmenten per zone: een laan oost-west en een straat
         noord-zuid. Ze zijn er niet om mooi te ogen -- een melding, een
         lantaarn en een werkorder hangen straks aan een SEGMENT, en dat is het
         niveau waarop een monteur denkt ("de Marinalaan", niet "zone Marina"). */
      const mLat = (vak.lat0 + vak.lat1) / 2, mLng = (vak.lng0 + vak.lng1) / 2;
      zet(id + '-laan', 'straatsegment', hoe + 'laan', id, 'lijn',
        [{ lat: mLat, lng: vak.lng0 }, { lat: mLat, lng: vak.lng1 }]);
      zet(id + '-straat', 'straatsegment', hoe + 'straat', id, 'lijn',
        [{ lat: vak.lat0, lng: mLng }, { lat: vak.lat1, lng: mLng }]);
      return z;
    });
    for (const [id, hoe, wijk, kids] of BUURTEN) {
      const punten = omhullende(zones.filter(z => kids.includes(z.id.slice(2 + vv.length))));
      zet(id, 'buurt', hoe, wijk, 'vlak', punten);
    }
    for (const [id, hoe] of WIJKEN) {
      const punten = omhullende(nieuw.filter(g => g.ouder === 'G-' + vv + id));
      zet(id, 'wijk', hoe, 'stad', 'vlak', punten);
    }
    const stad = zet('stad', 'stad', naam || 'RTG Stad', null, 'vlak',
      omhullende(nieuw.filter(g => g.niveau === 'wijk')));
    save();
    return { stad, gebieden: nieuw };
  }

  function zorgGeografie() {
    if (gebieden().length) return;
    bouwStad({ voorvoegsel: '', naam: 'RTG Stad', midden: REF });
  }

  return { zorgGeografie, bouwStad, vakVan, ZONES, BUURTEN, WIJKEN, CEL_LAT, CEL_LNG };
};
