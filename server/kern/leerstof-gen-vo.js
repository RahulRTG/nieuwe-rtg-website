/* RTG School, de generatoren voor het voortgezet en vervolgonderwijs. Hoort
   bij ./leerstof-gen.js, dat alle reeksen samenvoegt.

   Het vo draaide bijna helemaal op 'mc': eenentwintig van de vierendertig
   leerdoelen hadden vier handgeschreven vragen. Bij de exacte vakken is dat
   het zonde-zonde-geval: juist daar is elke opgave uit te rekenen, en dus te
   genereren.

   De kern van deze reeks is `formule`: een sjabloon met twee getallen en een
   som die daaruit volgt. Daarmee dekt hij snelheid, dichtheid, wet van Ohm,
   rente, molmassa, arbeid en alles wat verder de vorm "twee gegevens, een
   uitkomst" heeft. De som staat als tekst in de leerlijn ('a / b') en wordt
   hier gerekend door een kleine rekenaar -- GEEN eval: een leerlijn is data en
   data hoort nooit code te kunnen worden. */
const crypto = require('crypto');
const r = n => crypto.randomInt(0, n);
const kies = arr => arr[r(arr.length)];
function schud(a) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = r(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; }

/* Het rekenwerkje: alleen a, b, getallen en + - * / ( ). Alles wat daarbuiten
   valt, is een fout in de leerlijn en valt luid om. */
function rekenUit(som, a, b) {
  const stukken = String(som).match(/(\d+\.?\d*|[ab]|[-+*/()])/g) || [];
  if (stukken.join('') !== String(som).replace(/\s/g, '')) throw new Error('leerstof-gen-vo: onbegrepen som: ' + som);
  let i = 0;
  const kijk = () => stukken[i];
  const eet = () => stukken[i++];
  function waarde() {
    const t = eet();
    if (t === '(') { const v = expressie(); eet(); return v; }
    if (t === '-') return -waarde();
    if (t === 'a') return a;
    if (t === 'b') return b;
    return Number(t);
  }
  function term() {
    let v = waarde();
    while (kijk() === '*' || kijk() === '/') { const op = eet(); const w = waarde(); v = op === '*' ? v * w : v / w; }
    return v;
  }
  function expressie() {
    let v = term();
    while (kijk() === '+' || kijk() === '-') { const op = eet(); const w = term(); v = op === '+' ? v + w : v - w; }
    return v;
  }
  const uit = expressie();
  if (i !== stukken.length) throw new Error('leerstof-gen-vo: som niet helemaal gelezen: ' + som);
  return uit;
}

const trek = (b) => {
  const [van, tot, stap] = b;
  const n = Math.floor((tot - van) / (stap || 1)) + 1;
  return van + r(Math.max(1, n)) * (stap || 1);
};

const GENVO = {
  /* Een sjabloon met %a en %b, en een som die daaruit volgt.
     g.rond zegt hoeveel decimalen het antwoord krijgt (standaard heel). */
  formule(g) {
    let a = trek(g.a), b = trek(g.b || [1, 1, 1]);
    let uit = rekenUit(g.antwoord, a, b);
    /* Geen antwoorden met eindeloze staarten: bij een deling die niet uitkomt
       trekt hij opnieuw. Een leerling die 3,333333 moet invullen, oefent geen
       natuurkunde maar afronden. */
    let pogingen = 0;
    while (!Number.isFinite(uit) || (!g.rond && Math.abs(uit - Math.round(uit)) > 1e-9)) {
      if (++pogingen > 40) break;
      a = trek(g.a); b = trek(g.b || [1, 1, 1]);
      uit = rekenUit(g.antwoord, a, b);
    }
    const macht = Math.pow(10, g.rond || 0);
    const net = Math.round(uit * macht) / macht;
    return { v: g.vraag.replace('%a', a).replace('%b', b), a: String(net).replace('.', ',') };
  },

  /* Pythagoras op hele drietallen, zodat het antwoord altijd netjes uitkomt.
     Twee kanten op: de schuine zijde erbij, of een rechthoekszijde eruit. */
  pythagoras() {
    const DRIE = [[3, 4, 5], [6, 8, 10], [5, 12, 13], [9, 12, 15], [8, 15, 17], [7, 24, 25], [20, 21, 29]];
    const [x, y, z] = kies(DRIE);
    if (r(2) === 0) return { v: 'Een rechthoekige driehoek heeft rechthoekszijden van ' + x + ' en ' + y + ' cm. Hoe lang is de schuine zijde?', a: String(z) };
    return { v: 'Een rechthoekige driehoek heeft een schuine zijde van ' + z + ' cm en een rechthoekszijde van ' + x + ' cm. Hoe lang is de andere rechthoekszijde?', a: String(y) };
  },

  /* Machten en wortels: het rekenwerk waar de wiskunde van de bovenbouw op
     rust. Altijd hele uitkomsten. */
  macht(g) {
    const grond = 2 + r(g.max || 10);
    const exp = 2 + r(g.maxExp || 2);
    const uit = Math.pow(grond, exp);
    if (r(2) === 0) return { v: grond + '^' + exp + ' =', a: String(uit) };
    return { v: 'De ' + (exp === 2 ? 'wortel' : exp + 'e-machtswortel') + ' van ' + uit + ' is', a: String(grond) };
  },

  /* Een lineaire functie: waarde uitrekenen of het snijpunt met de y-as. */
  functie(g) {
    const a = 1 + r(g.max || 8), b = -10 + r(21), x = 1 + r(10);
    // "y = 5x + -9" schrijft niemand op; een negatieve b wordt een min
    const formule = 'y = ' + a + 'x ' + (b < 0 ? '- ' + Math.abs(b) : '+ ' + b);
    const soort = r(3);
    if (soort === 0) return { v: 'Gegeven ' + formule + '. Wat is y als x = ' + x + '?', a: String(a * x + b) };
    if (soort === 1) return { v: 'Gegeven ' + formule + '. Waar snijdt de lijn de y-as?', a: String(b) };
    return { v: 'Gegeven ' + formule + '. Wat is de richtingscoefficient?', a: String(a) };
  }
};

const MEERKEUZE_VO = [];

module.exports = { GENVO, MEERKEUZE_VO, rekenUit };
