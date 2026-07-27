/* De Residence, deelbestand "spellen": de speldata en de speelplekken.
   Elk spel hoort bij een zaal en rekent een timing-nauwkeurigheid (0-100)
   om naar punten. SPOTS zijn de plekken in de zaal waar de spelers gaan
   staan zodra het potje begint: de afslagmat, de werplijn, de kegelbaan,
   de badrand, de biljarttafel, de boog-mat en de dansvloer -- zo speelt
   de wereld zichtbaar mee. */

const SPELLEN = {
  golf: { zaal: 'golf', naam: 'Midgetgolf', beurten: 3, laag: true, eenheid: 'slagen',
    punt: a => a >= 90 ? 1 : a >= 72 ? 2 : a >= 45 ? 3 : 4 },
  darts: { zaal: 'bar', naam: 'Darts', beurten: 6, eenheid: 'punten',
    punt: a => Math.round(a * 0.6) },
  kegelen: { zaal: 'kegel', naam: 'Kegelen', beurten: 5, eenheid: 'kegels',
    punt: a => a >= 92 ? 10 : Math.floor(a / 10) },
  zwemmen: { zaal: 'badhuis', naam: 'Baantjes zwemmen', beurten: 4, laag: true, eenheid: 'seconden',
    punt: a => Math.round((14 - a / 10) * 10) / 10 },
  biljart: { zaal: 'biljart', naam: 'Biljart', beurten: 5, eenheid: 'caramboles',
    punt: a => a >= 90 ? 3 : a >= 65 ? 2 : a >= 35 ? 1 : 0 },
  boogschieten: { zaal: 'boog', naam: 'Boogschieten', beurten: 5, eenheid: 'punten',
    punt: a => Math.min(10, Math.max(0, Math.round(a / 10))) },
  // dansen is samen: geen winnaar, een gezamenlijke score voor de gratie
  dansen: { zaal: 'balzaal', naam: 'Samen dansen', beurten: 4, samen: true, eenheid: 'gratie',
    punt: a => Math.round(a / 2) },
  // racen gaat niet op timing maar op tikken: het tik-tempo is het gas
  racen: { zaal: 'renbaan', naam: 'De Grand Prix', beurten: 4, eenheid: 'meters',
    punt: a => Math.round(a) }
};

/* per zaal: waar de spelers gaan staan bij de start van een potje */
const SPOTS = {
  golf: [[1, 7], [2, 7], [6, 6], [7, 6]],
  bar: [[1, 3], [2, 3], [3, 4], [2, 4]],
  kegel: [[3, 6], [5, 6], [7, 6], [4, 6]],
  badhuis: [[3, 5], [5, 5], [4, 5], [6, 5]],
  biljart: [[3, 5], [7, 3], [4, 6], [6, 1]],
  boog: [[2, 6], [6, 6], [10, 6], [4, 6]],
  balzaal: [[5, 4], [6, 5], [4, 5], [7, 4]],
  renbaan: [[2, 6], [5, 6], [8, 6], [11, 6]]
};

/* de spelers naar hun speelplek brengen; de zaal ziet ze aantreden */
function plaats(id, leden, spelers, sein) {
  const spots = SPOTS[id] || [];
  spelers.forEach((s, i) => {
    const l = leden[s.key], spot = spots[i];
    if (!l || !spot) return;
    l.x = l.dx; l.y = l.dy; l.dx = spot[0]; l.dy = spot[1]; l.zit = false; l.at = Date.now();
    sein(id, 'stap', { codenaam: l.codenaam, x: l.x, y: l.y, dx: spot[0], dy: spot[1], zit: false });
  });
}

module.exports = { SPELLEN, SPOTS, plaats };
