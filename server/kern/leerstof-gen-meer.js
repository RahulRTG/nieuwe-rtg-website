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
      a: heel + ' rest ' + rest, feit: { soort: 'deelrest', heel, rest, deler } };
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
    return { v: 'Rond ' + n + ' af op ' + (stap === 10 ? 'tientallen' : stap === 100 ? 'honderdtallen' : 'duizendtallen'), a: String(uit), feit: { soort: 'afronden', n, stap } };
  },

  // negatieve getallen, meestal in graden: het getal onder de nul
  negatief(g) {
    const max = g.max || 15;
    const start = -(1 + r(max));
    const stijging = 1 + r(max + 10);
    return { v: 'Het is ' + start + ' graden. Het wordt ' + stijging + ' graden warmer. Hoe warm is het dan?',
      a: String(start + stijging), feit: { soort: 'negatief', start, stijging } };
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
    /* Ook deze twee takken gaven geen opties terug terwijl `tabel` in MEERKEUZE
       staat. De afleiders zijn de fouten die een kind bij een tabel echt maakt:
       een dag overslaan of dubbel tellen, en optellen waar aftrekken moet. */
    if (soort === 1) {
      const totaal = rij.reduce((n, x) => n + x.n, 0);
      const opties = [totaal, totaal - rij[0].n, totaal - rij[rij.length - 1].n,
        totaal + Math.max.apply(null, rij.map(x => x.n))]
        .filter(x => x > 0).map(String).filter((x, i, l) => l.indexOf(x) === i);
      return { v: 'Er werden boeken geleend: ' + tekst + '. Hoeveel in de hele week samen?',
        a: String(totaal), opties: schud(opties) };
    }
    const twee = schud(rij).slice(0, 2);
    const verschil = Math.abs(twee[0].n - twee[1].n);
    const opties = [verschil, twee[0].n + twee[1].n, Math.max(twee[0].n, twee[1].n)]
      .filter(x => x >= 0).map(String).filter((x, i, l) => l.indexOf(x) === i);
    return { v: 'Er werden boeken geleend: ' + tekst + '. Hoeveel schelen ' + twee[0].dag + ' en ' + twee[1].dag + '?',
      a: String(verschil), opties: schud(opties) };
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
/* Meten en tijd staan in ./leerstof-gen-meten.js; hun meerkeuzesoorten reizen
   mee zodat er maar een lijst is die de beller ziet. */
const { GENM, MEERKEUZE_METEN } = require('./leerstof-gen-meten');
Object.assign(GEN2, GENM);

const MEERKEUZE2 = ['breukvergelijk', 'schatten', 'tabel'].concat(MEERKEUZE_METEN);

module.exports = { GEN2, MEERKEUZE2 };
