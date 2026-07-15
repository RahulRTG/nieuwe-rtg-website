/* De dagcontext: alles wat verandert en waar elke AI rekening mee houdt.
   Tijd, dagdeel, weekdag, seizoen en een temperatuurbeeld, in een vorm die
   zo in een prompt past (zin/zinEn) en in rekenregels (temperatuurC, factor).

   Zonder externe diensten: de temperatuur volgt een seizoenscurve
   (Middellandse Zee, het decor van de demo) met een dagritme eroverheen.
   RTG_TEMPERATUUR overschrijft hem, bijvoorbeeld voor een hittegolf. */

const DAGEN = ['zondag', 'maandag', 'dinsdag', 'woensdag', 'donderdag', 'vrijdag', 'zaterdag'];
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function dagContext(d) {
  d = d || new Date();
  const maand = d.getMonth() + 1;
  const uur = d.getHours();
  const doy = Math.floor((d - new Date(d.getFullYear(), 0, 0)) / 86400000);
  const seizoen = maand >= 3 && maand <= 5 ? 'lente' : maand >= 6 && maand <= 8 ? 'zomer' : maand >= 9 && maand <= 11 ? 'herfst' : 'winter';
  const season = { lente: 'spring', zomer: 'summer', herfst: 'autumn', winter: 'winter' }[seizoen];
  const dagdeel = uur < 6 ? 'nacht' : uur < 12 ? 'ochtend' : uur < 18 ? 'middag' : 'avond';
  const daypart = { nacht: 'night', ochtend: 'morning', middag: 'afternoon', avond: 'evening' }[dagdeel];
  // seizoenscurve (piek eind juli) plus een dagritme
  const basis = 18 + 8 * Math.sin(2 * Math.PI * (doy - 105) / 365);
  const ritme = { nacht: -4, ochtend: -2, middag: 2, avond: 0 }[dagdeel];
  const override = Number(process.env.RTG_TEMPERATUUR);
  const temperatuurC = Number.isFinite(override) ? Math.round(override) : Math.round(basis + ritme);
  // de klimaatfactor voor drukte: warme avonden lopen vol (terras), gure dagen niet
  const factor = temperatuurC >= 28 ? 1.15 : temperatuurC >= 22 ? 1.05 : temperatuurC <= 8 ? 0.9 : 1;
  return {
    nu: d.toISOString(), uur, dagdeel, weekdag: DAGEN[d.getDay()], seizoen, temperatuurC, factor,
    zin: 'Het is ' + DAGEN[d.getDay()] + dagdeel + ' in de ' + seizoen + ', rond de ' + temperatuurC + ' graden.',
    zinEn: 'It is ' + DAYS[d.getDay()] + ' ' + daypart + ' in ' + season + ', around ' + temperatuurC + ' degrees C.'
  };
}

module.exports = { dagContext };
