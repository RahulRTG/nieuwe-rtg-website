/* RTG School, de generatoren voor METEN EN TIJD: tijdsduur, de kalender,
   schaal en het omrekenen van lengte, gewicht en inhoud.

   Apart van ./leerstof-gen-meer.js om de reden die dat bestand zelf noemt: de
   leerlijn rekenen dekt vier domeinen, en meten is er daar een van. Getallen,
   verhoudingen en verbanden staan daar; wat je AFMEET staat hier. Dat is ook
   waar de fout zat die deze splitsing uitlokte -- de kalender gaf een
   meerkeuzevraag zonder keuzes -- en zulke vragen horen bij elkaar te staan
   waar iemand ze in een keer overziet.

   De regel is dezelfde als in elke reeks: een generator maakt een VERSE opgave
   uit parameters, en het antwoord blijft op de server. */
const crypto = require('crypto');
const r = n => crypto.randomInt(0, n);
const kies = arr => arr[r(arr.length)];
function schud(a) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = r(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; }
const tijd = (u, m) => u + ':' + String(m).padStart(2, '0');

const GENM = {
  // hoeveel tijd zit ertussen: klokkijken dat ergens over gaat
  tijdsduur() {
    const u1 = 7 + r(10), m1 = 5 * r(12);
    const duur = 5 * (1 + r(23));
    let u2 = u1, m2 = m1 + duur;
    while (m2 >= 60) { m2 -= 60; u2++; }
    const uren = Math.floor(duur / 60), min = duur % 60;
    const a = uren ? (min ? uren + ' uur en ' + min + ' minuten' : uren + ' uur') : min + ' minuten';
    return { v: 'Hoe lang duurt het van ' + tijd(u1, m1) + ' tot ' + tijd(u2, m2) + '?', a };
  },

  // de kalender: dagen, weken en maanden
  kalender() {
    const DAGEN = ['maandag', 'dinsdag', 'woensdag', 'donderdag', 'vrijdag', 'zaterdag', 'zondag'];
    const MAANDEN = [['januari', 31], ['februari', 28], ['maart', 31], ['april', 30], ['mei', 31], ['juni', 30],
      ['juli', 31], ['augustus', 31], ['september', 30], ['oktober', 31], ['november', 30], ['december', 31]];
    const soort = r(3);
    if (soort === 0) {
      const ix = r(7), stap = 1 + r(6);
      return { v: 'Het is ' + DAGEN[ix] + '. Welke dag is het over ' + stap + ' dag' + (stap === 1 ? '' : 'en') + '?',
        a: DAGEN[(ix + stap) % 7], opties: schud(DAGEN.slice()) };
    }
    if (soort === 1) {
      const [naam, dagen] = kies(MAANDEN);
      return { v: 'Hoeveel dagen heeft ' + naam + ' (geen schrikkeljaar)?', a: String(dagen), opties: schud(['28', '30', '31']) };
    }
    /* Deze tak gaf lang geen opties terug terwijl `kalender` wel in MEERKEUZE
       staat: dan legt de quiz een meerkeuzevraag voor zonder keuzes. De
       afleiders zijn echte kinderfouten -- vijf schooldagen in plaats van
       zeven, en een week te veel of te weinig -- en geen willekeurige getallen,
       want daar leert niemand iets van. */
    const weken = 2 + r(6);
    const dagen = weken * 7;
    const opties = [dagen, weken * 5, (weken + 1) * 7, (weken - 1) * 7]
      .filter(x => x > 0).map(String).filter((x, i, l) => l.indexOf(x) === i);
    return { v: 'Hoeveel dagen zijn ' + weken + ' weken?', a: String(dagen),
      opties: schud(opties) };
  },

  // schaal: van kaart naar werkelijkheid en terug
  schaal() {
    const s = kies([100, 200, 500, 1000]);
    const cm = 2 + r(8);
    const meter = (cm * s) / 100;
    return { v: 'Op een kaart met schaal 1 : ' + s + ' is een weg ' + cm + ' cm lang. Hoeveel meter is dat in het echt?',
      a: String(meter % 1 === 0 ? meter : Math.round(meter * 10) / 10).replace('.', ',') };
  },

  // meten: lengte, gewicht en inhoud omrekenen binnen een soort
  meten(g) {
    const TABEL = {
      lengte: [['kilometer', 'meter', 1000], ['meter', 'centimeter', 100], ['centimeter', 'millimeter', 10], ['meter', 'decimeter', 10]],
      gewicht: [['kilogram', 'gram', 1000], ['ton', 'kilogram', 1000], ['gram', 'milligram', 1000]],
      inhoud: [['liter', 'deciliter', 10], ['liter', 'milliliter', 1000], ['deciliter', 'centiliter', 10]]
    };
    /* g.eenheid en niet g.soort: `soort` is al de naam van de generator zelf,
       en een parameter die zo heet, overschrijft in de aanroep de generator. */
    const [groot, klein, factor] = kies(TABEL[g.eenheid] || TABEL.lengte);
    const n = 1 + r(9);
    return r(2) === 0
      ? { v: n + ' ' + groot + ' = hoeveel ' + klein + '?', a: String(n * factor) }
      : { v: (n * factor) + ' ' + klein + ' = hoeveel ' + groot + '?', a: String(n) };
  },
};

const MEERKEUZE_METEN = ['kalender'];

module.exports = { GENM, MEERKEUZE_METEN };
