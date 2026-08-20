/* RTG School, de generatoren voor wereldorientatie, natuur, verkeer en Engels.
   Hoort bij ./leerstof-gen.js, dat alle reeksen samenvoegt.

   Waarom deze reeks er is: die vakken draaiden op 'mc' -- vier of vijf
   handgeschreven vragen per leerdoel. Dat is dezelfde fout als bij de oude
   taalleerlijn: na twee sessies kent een kind de vragen, en meet je zijn
   geheugen voor die vier zinnen in plaats van zijn kennis.

   Hier staan vier vormen die uit een TABEL putten. Twaalf provincies met hun
   hoofdstad zijn twaalf vragen heen en twaalf terug; dertig gedateerde
   gebeurtenissen zijn honderden "wat was eerder"-vragen. De tabel uitbreiden
   is een regel erbij, en de afleiders komen uit de tabel zelf -- dus altijd
   uit dezelfde soort en nooit een lachwekkende keuze die het antwoord
   weggeeft. */
const crypto = require('crypto');
const r = n => crypto.randomInt(0, n);
const kies = arr => arr[r(arr.length)];
function schud(a) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = r(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; }

const GENW = {
  /* Twee kolommen aan elkaar koppelen, heen en (als g.terug er staat) terug.
     g.vraag en g.terug zijn zinnen met %s op de plaats van het gegeven. */
  koppel(g) {
    const [links, rechts] = kies(g.paren);
    const heen = !g.terug || r(2) === 0;
    const vraag = (heen ? g.vraag : g.terug).replace('%s', heen ? links : rechts);
    const goed = heen ? rechts : links;
    const anderen = g.paren.filter(p => p[0] !== links).map(p => (heen ? p[1] : p[0]));
    return { v: vraag, a: goed, opties: schud([goed].concat(schud(anderen).slice(0, 2))) };
  },

  /* Indelen in groepen: bij welke groep hoort dit? De afleiders zijn de andere
     groepen, dus de vraag blijft altijd binnen hetzelfde onderwerp. */
  indeling(g) {
    const groepen = Object.keys(g.groepen);
    const groep = kies(groepen);
    const ding = kies(g.groepen[groep]);
    return { v: (g.vraag || 'Bij welke groep hoort %s?').replace('%s', ding), a: groep, opties: schud(groepen.slice()) };
  },

  /* Chronologie: wat was eerder? Uit een lijst gedateerde gebeurtenissen
     komen honderden paren, en het jaartal hoeft een kind daarvoor niet uit het
     hoofd te kennen -- de volgorde wel. */
  eerder(g) {
    const twee = schud(g.gebeurtenissen).slice(0, 2);
    if (twee[0][1] === twee[1][1]) return GENW.eerder(g); // even oud: opnieuw trekken
    const eerst = twee[0][1] < twee[1][1] ? twee[0] : twee[1];
    return { v: 'Wat was eerder: ' + twee[0][0] + ' of ' + twee[1][0] + '?',
      a: eerst[0], opties: schud([twee[0][0], twee[1][0]]) };
  },

  /* In welke eeuw? Een eeuw is honderd jaar, en de eeuw is altijd het jaartal
     gedeeld door honderd plus een -- 1650 is de zeventiende eeuw. Dat rekenen
     hoort bij het leerdoel, dus het antwoord is het getal en niet de naam. */
  eeuw(g) {
    const [naam, jaar] = kies(g.gebeurtenissen);
    const eeuw = Math.floor((jaar - 1) / 100) + 1;
    const anderen = [eeuw - 1, eeuw + 1, eeuw - 2].filter(x => x > 0 && x !== eeuw);
    return { v: 'In welke eeuw was ' + naam + ' (' + jaar + ')?', a: String(eeuw) + 'e eeuw',
      opties: schud([String(eeuw) + 'e eeuw'].concat(schud(anderen).slice(0, 2).map(x => String(x) + 'e eeuw'))) };
  }
};

const MEERKEUZE_WERELD = ['koppel', 'indeling', 'eerder', 'eeuw'];

module.exports = { GENW, MEERKEUZE_WERELD };
