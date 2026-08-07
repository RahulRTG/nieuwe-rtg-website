/* RTG Stadsweefsel, deel "geografieseed": de stad zoals hij nu bestaat.

   Afgesplitst uit ./geografie.js, en op de naad die er al lag: dit bestand
   BOUWT de boom een keer op, geografie.js BEVRAAGT hem daarna. Twee dingen die
   los van elkaar veranderen -- er komt eerder een zone bij dan dat de
   straatzoeker anders gaat werken.

   De zes zones liggen op een raster rond het middelpunt zodat ze elkaar NIET
   overlappen: een punt hoort bij precies een zone. Zou dat niet zo zijn, dan
   zou dezelfde lantaarn in twee zones staan en zouden twee ploegen erheen.

   Het middelpunt komt uit kern/navigatie, niet van hier -- de stad en haar
   wegennet horen een wereld te zijn. Zie de kop van ./geografie.js. */

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
  const vakVan = (kol, rij) => ({
    lat0: REF.lat + (rij - 1) * CEL_LAT, lat1: REF.lat + rij * CEL_LAT,
    lng0: REF.lng + (kol - 0.5) * CEL_LNG, lng1: REF.lng + (kol + 0.5) * CEL_LNG
  });

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

  return { zorgGeografie, vakVan, ZONES, BUURTEN, WIJKEN };
};
