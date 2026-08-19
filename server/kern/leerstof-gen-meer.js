/* RTG School, de tweede reeks opgave-generatoren. Hoort bij ./leerstof-gen.js
   (dat de eerste reeks draagt en beide samenvoegt); apart bestand omdat een
   generatorenlijst nu eenmaal groeit en een bestand van dertig kilobyte
   niemand meer leest.

   De regel is hier dezelfde als daar: een generator maakt een VERSE opgave uit
   parameters, en het antwoord blijft op de server. Een vaste vragenlijst is na
   drie keer een geheugenspel, en dan meet je het geheugen van de vragen in
   plaats van het rekenen.

   Wat deze reeks toevoegt is dekking: delen met rest, afronden, tijdsduur,
   kalender, schaal, negatieve getallen, kwadraten, schatten, korting, en het
   aflezen van een tabelletje. Daarmee dekt de leerlijn rekenen niet alleen
   "getallen" maar ook meten, verhoudingen en verbanden -- de vier domeinen van
   het referentiekader. */
const crypto = require('crypto');
const r = n => crypto.randomInt(0, n);
const kies = arr => arr[r(arr.length)];
function schud(a) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = r(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; }
const tijd = (u, m) => u + ':' + String(m).padStart(2, '0');

const GEN2 = {
  // verdubbelen en halveren: de brug tussen optellen en de tafels
  dubbel(g) {
    const max = g.max || 20;
    const half = r(2) === 1;
    const n = half ? 2 * (1 + r(Math.floor(max / 2))) : 1 + r(max);
    return half
      ? { v: 'De helft van ' + n + ' is', a: String(n / 2) }
      : { v: 'Het dubbele van ' + n + ' is', a: String(n * 2) };
  },

  // delen met rest: het moment waarop delen niet meer altijd uitkomt
  deelrest(g) {
    const deler = 2 + r((g.max || 10) - 1);
    const heel = 1 + r(10), rest = 1 + r(deler - 1);
    /* Het voorbeeld in de vraag is VAST en niet het eigen antwoord. Met
       'schrijf als "' + heel + ' rest ' + rest + '"' stond de oplossing
       letterlijk in de opgave -- de eerste versie hiervan deed dat, en dat is
       precies het soort fout dat een oefening waardeloos maakt zonder dat
       iemand het merkt: iedereen heeft alles goed. */
    /* Het voorbeeld staat in WOORDEN en niet in cijfers. Een voorbeeld met
       getallen erin ("schrijf het zo: 3 rest 2") is bij 29 : 9 toevallig het
       antwoord zelf -- en dan heeft een kind het goed zonder te rekenen. */
    return { v: (heel * deler + rest) + ' : ' + deler + ' = ?  (schrijf eerst hoe vaak het past, dan het woord rest, dan wat overblijft)',
      a: heel + ' rest ' + rest };
  },

  // afronden op tientallen, honderdtallen of duizendtallen
  afronden(g) {
    const stap = kies(g.stappen || [10, 100]);
    /* Nooit een getal dat al rond is. "Rond 3300 af op honderdtallen" heeft
       het antwoord in de vraag staan en vraagt bovendien niets -- de
       generatortoets in test/leerfabric.test.js viel hier terecht over. */
    let n = stap + r(stap * 40);
    while (n % stap === 0) n = stap + r(stap * 40);
    const rest = n % stap;
    const uit = rest * 2 >= stap ? n - rest + stap : n - rest;
    return { v: 'Rond ' + n + ' af op ' + (stap === 10 ? 'tientallen' : stap === 100 ? 'honderdtallen' : 'duizendtallen'), a: String(uit) };
  },

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
    const weken = 2 + r(6);
    return { v: 'Hoeveel dagen zijn ' + weken + ' weken?', a: String(weken * 7) };
  },

  // schaal: van kaart naar werkelijkheid en terug
  schaal() {
    const s = kies([100, 200, 500, 1000]);
    const cm = 2 + r(8);
    const meter = (cm * s) / 100;
    return { v: 'Op een kaart met schaal 1 : ' + s + ' is een weg ' + cm + ' cm lang. Hoeveel meter is dat in het echt?',
      a: String(meter % 1 === 0 ? meter : Math.round(meter * 10) / 10).replace('.', ',') };
  },

  // negatieve getallen, meestal in graden: het getal onder de nul
  negatief(g) {
    const max = g.max || 15;
    const start = -(1 + r(max));
    const stijging = 1 + r(max + 10);
    return { v: 'Het is ' + start + ' graden. Het wordt ' + stijging + ' graden warmer. Hoe warm is het dan?',
      a: String(start + stijging) };
  },

  // kwadraten en wortels: de stap naar de wiskunde van het vo
  kwadraat(g) {
    const n = 2 + r(g.max || 12);
    return r(2) === 0
      ? { v: n + ' x ' + n + ' (het kwadraat van ' + n + ') =', a: String(n * n) }
      : { v: 'Van welk getal is ' + (n * n) + ' het kwadraat?', a: String(n) };
  },

  // schatten: het antwoord hoeft niet precies, de aanpak wel
  schatten(g) {
    const a = 2 + r(g.max || 40), b = 2 + r(g.max || 40);
    const rondA = Math.round(a / 10) * 10 || 10, rondB = Math.round(b / 10) * 10 || 10;
    const goed = rondA * rondB;
    return { v: 'Schat het antwoord van ' + a + ' x ' + b + ' door eerst af te ronden op tientallen.',
      a: String(goed), opties: schud([String(goed), String(goed * 2), String(Math.round(goed / 2))]) };
  },

  // korting en rente: procenten waar het over geld gaat
  korting(g) {
    const prijs = 10 * (2 + r(18));
    const p = kies(g.procenten || [10, 20, 25, 50]);
    const af = (prijs * p) / 100;
    return r(2) === 0
      ? { v: 'Een jas kost ' + prijs + ' euro en is ' + p + '% afgeprijsd. Hoeveel euro korting is dat?', a: String(af) }
      : { v: 'Een jas kost ' + prijs + ' euro en er gaat ' + p + '% af. Hoeveel euro betaal je?', a: String(prijs - af) };
  },

  // een tabelletje aflezen: het begin van verbanden en grafieken
  tabel() {
    const DAGEN = ['maandag', 'dinsdag', 'woensdag', 'donderdag', 'vrijdag'];
    const rij = DAGEN.map(d => ({ dag: d, n: 1 + r(20) }));
    const tekst = rij.map(x => x.dag + ': ' + x.n).join(', ');
    const soort = r(3);
    if (soort === 0) {
      const meeste = rij.reduce((a, b) => (b.n > a.n ? b : a));
      return { v: 'Er werden boeken geleend: ' + tekst + '. Op welke dag waren het er de meeste?',
        a: meeste.dag, opties: schud(DAGEN.slice()) };
    }
    if (soort === 1) return { v: 'Er werden boeken geleend: ' + tekst + '. Hoeveel in de hele week samen?',
      a: String(rij.reduce((n, x) => n + x.n, 0)) };
    const twee = schud(rij).slice(0, 2);
    return { v: 'Er werden boeken geleend: ' + tekst + '. Hoeveel schelen ' + twee[0].dag + ' en ' + twee[1].dag + '?',
      a: String(Math.abs(twee[0].n - twee[1].n)) };
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

  // breuken vergelijken: welke is groter, en waarom is dat niet het grootste getal
  breukvergelijk() {
    const paren = [['1/2', '1/3'], ['2/3', '1/2'], ['3/4', '2/3'], ['1/4', '1/5'], ['2/5', '1/2'], ['5/6', '3/4'], ['1/3', '1/4']];
    const [a, b] = kies(paren);
    const waarde = s => { const d = s.split('/'); return Number(d[0]) / Number(d[1]); };
    const groot = waarde(a) > waarde(b) ? a : b;
    return { v: 'Welke breuk is groter: ' + a + ' of ' + b + '?', a: groot, opties: schud([a, b]) };
  }
};

// welke van deze soorten meerkeuze zijn (zelfde afspraak als in leerstof-gen.js)
const MEERKEUZE2 = ['breukvergelijk', 'kalender', 'schatten', 'tabel'];

module.exports = { GEN2, MEERKEUZE2 };
