/* WORDT DEZE LAAG ERGENS AFGEDWONGEN? -- de aanmeldplek, en verder niets.

   WAAROM DIT BESTAAT EN WAAROM HET ZO KLEIN IS. Het ledenscherm beloofde dat de
   isolatiestand "meteen werkt". Dat was niet waar: de stand versmalt wel de lijst
   waaruit de AI kiest, maar `middleware/functieschakelaars.js` kijkt alleen naar
   de HUIS-modus, dus een gewoon HTTP-verzoek van dat lid loopt gewoon door. Een
   scherm dat meer belooft dan de code doet is de duurste soort fout: een mens die
   denkt dat hij beschermd is, gedraagt zich daarnaar.

   De reparatie is niet een betere zin maar een AFGELEID veld. Dit bestand is de
   plek waar een handhaver zich meldt; zolang niemand dat doet, zegt het scherm
   dat de stand voor gewone verzoeken niet geldt. Zodra de poort er is en zich
   aanmeldt, slaat het scherm vanzelf om -- en het kan nooit meer voorlopen op de
   werkelijkheid.

   WAAROM HIER EN NIET IN DE MIDDLEWARE. Een `require` naar een bestand dat nog
   niet bestaat, is een kapotte verwijzing; keuringsregel 3 vindt hem en terecht.
   De aanmeldplek hoort bij de laag die iets te melden heeft, niet bij de laag die
   hem misschien ooit gaat gebruiken -- zelfde richting als `zetLaag` in
   server/opzet/verzoekketen.js: wie iets ophangt, meldt zich bij de eigenaar.

   HIJ BESLIST NIETS. Hij weet niet wat handhaven is en hij houdt niets tegen; hij
   onthoudt of iemand zei dat hij het doet. Wie hier een oordeel bij zet, heeft de
   tweede handhaver gemaakt. */
'use strict';

/* Modulestand, en dat mag hier: er is precies één keten per proces, en een
   handhaver die zich per exemplaar aanmeldt zou juist verbergen dat er twee zijn. */
let gemeld = null;

/* Een handhaver meldt zich, met de PLEK erbij. Die plek staat in het antwoord van
   het register, zodat een lezer kan nakijken of hij er echt hangt in plaats van
   op een boolean te vertrouwen. `modus` is 'schaduw' of 'afdwingen': een poort
   die meeloopt zonder te blokkeren, mag nooit als handhaving tellen
   (CONTROLPLANE.md -- je kunt niet afdwingen wat nooit in de schaduw heeft
   gelopen, en wat in de schaduw loopt dwingt nog niets af). */
function meldHandhaver({ waar, modus }) {
  const m = String(modus || '');
  if (m !== 'schaduw' && m !== 'afdwingen') {
    throw new Error('isolatie/handhaving: modus is "schaduw" of "afdwingen", niet "' + m + '"');
  }
  gemeld = { waar: String(waar || 'onbekend').slice(0, 120), modus: m };
  return gemeld;
}

function stand() {
  return {
    gemonteerd: gemeld !== null,
    waar: gemeld ? gemeld.waar : null,
    modus: gemeld ? gemeld.modus : null,
    /* AFDWINGEN IS IETS ANDERS DAN GEMONTEERD, en dat verschil is de helft van
       de waarde van dit bestand: een poort in de schaduw telt, maar houdt niets
       tegen, en een scherm dat die twee door elkaar haalt liegt opnieuw. */
    afdwingen: !!(gemeld && gemeld.modus === 'afdwingen'),
    waarom: gemeld
      ? (gemeld.modus === 'afdwingen'
        ? 'deze stand geldt voor je hele account: ook een gewoon verzoek loopt langs de poort'
        : 'de poort loopt mee maar houdt nog niets tegen; hij telt wat hij zou hebben gesloten')
      : 'deze stand versmalt wat de assistent voor je mag doen. Voor gewone verzoeken geldt alleen ' +
        'de stand van het platform zelf -- de poort per account staat er nog niet.'
  };
}

module.exports = { meldHandhaver, stand };
