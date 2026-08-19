/* RTG School, de opgave-generatoren: uit de gen-parameters van een leerdoel
   komt telkens een verse opgave { v (vraag), a (antwoord), opties? }.
   Antwoorden blijven op de server; de client krijgt alleen de vraag.
   Alles puur en zonder toeval-bibliotheken: crypto.randomInt is de dobbelsteen. */
const crypto = require('crypto');
const r = n => crypto.randomInt(0, n);
const kies = arr => arr[r(arr.length)];
function schud(a) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = r(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; }

const GEN = {
  tel(g) { const n = 1 + r(g.max); return { v: 'Tel de stippen: ' + '● '.repeat(n).trim(), a: String(n) }; },
  vergelijk(g) {
    const a = 1 + r(g.max), b = 1 + r(g.max);
    const juist = a > b ? 'meer' : a < b ? 'minder' : 'evenveel';
    return { v: 'Links liggen ' + a + ' knikkers, rechts ' + b + '. Liggen er links meer, minder of evenveel?', a: juist, opties: ['meer', 'minder', 'evenveel'] };
  },
  vorm() {
    const V = [['cirkel', 'rond, zonder hoeken'], ['vierkant', 'vier gelijke zijden en vier hoeken'], ['driehoek', 'drie zijden en drie hoeken']];
    const [naam, oms] = kies(V);
    return { v: 'Welke vorm is ' + oms + '?', a: naam, opties: schud(V.map(x => x[0])) };
  },
  som(g) {
    const max = g.max || 20;
    const op = g.op === 'beide' ? kies(['+', '-']) : (g.op || '+');
    if (g.komma) { const a = (1 + r(max * 10)) / 10, b = (1 + r(max * 10)) / 10;
      const [x, y] = op === '-' && b > a ? [b, a] : [a, b];
      const uit = op === '+' ? x + y : x - y;
      return { v: String(x).replace('.', ',') + ' ' + op + ' ' + String(y).replace('.', ',') + ' =', a: String(Math.round(uit * 10) / 10).replace('.', ',') }; }
    if (op === 'x') { const a = 2 + r(9), b = Math.max(2, r(max)); return { v: a + ' x ' + b + ' =', a: String(a * b) }; }
    let a = 1 + r(max), b = 1 + r(max);
    if (op === '+') { while (a + b > max) { a = 1 + r(max); b = 1 + r(max); } return { v: a + ' + ' + b + ' =', a: String(a + b) }; }
    if (b > a) [a, b] = [b, a];
    return { v: a + ' - ' + b + ' =', a: String(a - b) };
  },
  buur(g) {
    const stap = g.stap || 1;
    const n = stap * (1 + r(Math.floor((g.max - stap) / stap)));
    const na = r(2) === 0;
    return { v: 'Welk getal komt ' + (na ? 'na' : 'voor') + ' ' + n + (stap > 1 ? ' (in stappen van ' + stap + ')' : '') + '?', a: String(na ? n + stap : n - stap) };
  },
  splits(g) { const heel = 3 + r(g.max - 2), deel = 1 + r(heel - 1); return { v: deel + ' en hoeveel is samen ' + heel + '?', a: String(heel - deel) }; },
  tafel(g) { const t = kies(g.tafels), n = 1 + r(10); return { v: n + ' x ' + t + ' =', a: String(n * t) }; },
  deel(g) { const t = kies(g.tafels), n = 1 + r(10); return { v: (n * t) + ' : ' + t + ' =', a: String(n) }; },
  klok(g) {
    const uur = 1 + r(12);
    if (g.stap === 30) { const half = r(2) === 1; return { v: 'Wat is een ' + (half ? 'half uur' : 'heel uur') + ' na ' + uur + ':00?', a: half ? uur + ':30' : (uur === 12 ? 1 : uur + 1) + ':00' }; }
    const min = g.stap * (1 + r(Math.floor(55 / g.stap)));
    return { v: 'Wat is ' + min + ' minuten na ' + uur + ':00?', a: uur + ':' + String(min).padStart(2, '0') };
  },
  /* Het biljet waarmee je betaalt wisselt mee. Stond hier eerst vast op g.max,
     en dan is elke opgave "je betaalt met 20 euro" -- dat oefent het aftrekken
     wel, maar niet het kiezen van een passend biljet. */
  geld(g) {
    const BILJETTEN = [5, 10, 20, 50, 100].filter(b => b <= (g.max || 20));
    const prijs = 1 + r((g.max || 20) - 1);
    const bet = BILJETTEN.filter(b => b > prijs)[0] || (g.max || 20);
    return { v: 'Iets kost ' + prijs + ' euro en je betaalt met ' + bet + ' euro. Hoeveel euro krijg je terug?', a: String(bet - prijs) };
  },
  'breuk-benoem'() {
    const n = kies([2, 3, 4, 5, 6, 8, 10]);
    return { v: 'Een taart is in ' + n + ' gelijke stukken verdeeld en je pakt er een. Welk deel van de taart heb je?', a: '1/' + n, opties: schud(['1/' + n, '1/' + (n + 1), n + '/1']) };
  },
  'breuk-som'() {
    const noemer = kies([3, 4, 5, 6, 8, 10]);
    const a = 1 + r(noemer - 2), b = 1 + r(noemer - 1 - a);
    return { v: a + '/' + noemer + ' + ' + b + '/' + noemer + ' =', a: (a + b) + '/' + noemer };
  },
  verhouding(g) {
    const stuks = 2 + r(3), prijs = 1 + r(Math.floor(g.max / 2)), vraag = stuks + 1 + r(4);
    return { v: stuks + ' broden kosten samen ' + (stuks * prijs) + ' euro. Hoeveel euro kosten ' + vraag + ' broden?', a: String(vraag * prijs) };
  },
  procent(g) {
    const p = kies(g.procenten);
    const basis = (100 / gcd(p, 100)) * (1 + r(5));
    return { v: p + '% van ' + basis + ' =', a: String(basis * p / 100) };
  },
  gemiddelde(g) {
    const m = 2 + r(g.max - 4), d = 1 + r(3);
    const rij = [m - d, m, m + d];
    return { v: 'Wat is het gemiddelde van ' + rij.join(', ') + '?', a: String(m) };
  },
  drieluik() {
    const T = [['1/2', '0,5', '50%'], ['1/4', '0,25', '25%'], ['3/4', '0,75', '75%'], ['1/5', '0,2', '20%'], ['1/10', '0,1', '10%']];
    const rij = kies(T); const van = r(3); let naar = r(3); while (naar === van) naar = r(3);
    const vorm = ['als breuk', 'als kommagetal', 'in procenten'];
    return { v: 'Schrijf ' + rij[van] + ' ' + vorm[naar] + '.', a: rij[naar], opties: schud(T.map(x => x[naar])) };
  },
  opp(g) {
    const l = 2 + r(g.max - 1), b = 2 + r(g.max - 1);
    const omtrek = r(2) === 1;
    return { v: 'Een rechthoek is ' + l + ' bij ' + b + ' meter. Wat is de ' + (omtrek ? 'omtrek' : 'oppervlakte') + '?', a: String(omtrek ? 2 * (l + b) : l * b) };
  },
  metriek() {
    const C = [['1 meter', '100', 'centimeter'], ['1 kilometer', '1000', 'meter'], ['1 liter', '10', 'deciliter'], ['1 kilogram', '1000', 'gram'], ['1 centimeter', '10', 'millimeter']];
    const [van, a, naar] = kies(C);
    return { v: van + ' = hoeveel ' + naar + '?', a };
  },
  letter(g) { const w = kies(g.woorden); return { v: 'Met welke letter begint "' + w + '"?', a: w[0] }; },
  rijm(g) {
    const [w, ja, nee] = kies(g.paren);
    return { v: 'Welk woord rijmt op "' + w + '"?', a: ja, opties: schud([ja, nee]) };
  },
  kies(g) {
    const [goed, fout] = kies(g.paren);
    return { v: 'Welke is goed geschreven?', a: goed, opties: schud([goed, fout]) };
  },
  // algemene meerkeuze (VO en vervolgonderwijs): g.vragen = [[vraag, goed, fout, fout], ...]
  mc(g) {
    const [v, goed, ...fout] = kies(g.vragen);
    return { v, a: goed, opties: schud([goed].concat(fout)) };
  },
  // lineaire vergelijking: los x op uit ax + b = c
  vergelijking(g) {
    const a = 2 + r(g.maxA - 1), x = 1 + r(g.maxX), b = 1 + r(20);
    return { v: 'Los op: ' + a + 'x + ' + b + ' = ' + (a * x + b) + '. x =', a: String(x) };
  },
  dt(g) {
    const w = kies(g.ww);
    if (g.tijd === 'tt') { const hij = r(2) === 1;
      return { v: 'Vul in: ' + (hij ? 'hij ___' : 'ik ___') + ' (' + w[0] + ')', a: hij ? w[2] : w[1] }; }
    const mv = r(2) === 1;
    return { v: 'Vul in (verleden tijd): ' + (mv ? 'wij ___' : 'ik ___') + ' (' + w[0] + ')', a: mv ? w[2] : w[1] };
  }
};
function gcd(a, b) { return b ? gcd(b, a % b) : a; }

/* De tweede reeks (delen met rest, afronden, tijdsduur, kalender, schaal,
   negatieve getallen, kwadraten, schatten, korting, tabellen, meten en breuken
   vergelijken) woont in ./leerstof-gen-meer.js en komt hier in dezelfde lijst
   terecht. Een generator hoort maar op EEN plek te bestaan, en de beller mag
   niet hoeven weten in welk bestand hij staat. */
const { GEN2, MEERKEUZE2 } = require('./leerstof-gen-meer');
const { GENT, MEERKEUZE_TAAL } = require('./leerstof-gen-taal');
const { GENW, MEERKEUZE_WERELD } = require('./leerstof-gen-wereld');
const { GENVO, MEERKEUZE_VO } = require('./leerstof-gen-vo');
for (const reeks of [GEN2, GENT, GENW, GENVO]) {
  for (const naam of Object.keys(reeks)) {
    if (GEN[naam]) throw new Error('leerstof-gen: de soort "' + naam + '" bestaat twee keer');
    GEN[naam] = reeks[naam];
  }
}

/* Een opgave voor dit leerdoel; onbekende soorten vallen luid om (test bewaakt dekking). */
function opgave(gen) {
  const maak = GEN[gen.soort];
  if (!maak) throw new Error('onbekende opgave-soort: ' + gen.soort);
  return maak(gen);
}

/* WELKE SOORTEN MEERKEUZE ZIJN. De meeste generatoren vragen om een antwoord
   dat je zelf intikt ('7 + 5 =' heeft geen opties); een deel geeft er wel een
   rijtje bij. In de oefensessie maakt dat niets uit -- daar mag je gewoon
   typen -- maar wie deze bibliotheek in een MEERKEUZESPEL gebruikt (het
   Quizduel met schoolvragen, kern/spellen/quiz.js) kan alleen deze soorten
   voorleggen. Een som met een enkele optie is geen vraag maar een knop.

   De lijst staat HIER, bij de generatoren zelf, en niet bij de beller: wie een
   generator schrijft weet of hij opties teruggeeft, en een tweede lijst
   elders loopt daar stil op achter. `test/leerstof.test.js` legt hem naast wat
   de generatoren werkelijk doen, dus een soort die van vorm verandert zonder
   deze lijst bij te werken zakt. */
const MEERKEUZE = ['breuk-benoem', 'drieluik', 'kies', 'mc', 'rijm', 'vergelijk', 'vorm']
  .concat(MEERKEUZE2, MEERKEUZE_TAAL, MEERKEUZE_WERELD, MEERKEUZE_VO).sort();

module.exports = { opgave, SOORTEN: Object.keys(GEN), MEERKEUZE };
