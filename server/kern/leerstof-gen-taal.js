/* RTG School, de taal-generatoren. Hoort bij ./leerstof-gen.js, dat alle
   reeksen samenvoegt.

   Waarom deze reeks er is. De taalleerlijn draaide op 'kies': een handmatig
   lijstje van vijf woordparen per leerdoel, goed en fout naast elkaar. Na twee
   sessies kent een kind die vijf paren en meet je zijn geheugen in plaats van
   zijn spelling.

   Hier maakt de motor de fout ZELF, uit de regel. Geef hem veertig woorden met
   'cht' en de verbastering 'cht -> gt', en er zijn veertig verse opgaven met
   telkens een fout die past bij precies die regel. Een woordbank uitbreiden is
   dan een regel tekst, geen paren tellen.

   De verbasteringen staan in VERBASTER en zijn met opzet dom: ze doen een
   letterlijke vervanging. Levert dat hetzelfde woord op (de regel raakt dit
   woord niet), dan valt de generator terug op een tweede verbastering -- en
   anders slaat hij dat woord over. Een "fout" antwoord dat gelijk is aan het
   goede antwoord is geen opgave maar een strikvraag zonder oplossing. */
const crypto = require('crypto');
const r = n => crypto.randomInt(0, n);
const kies = arr => arr[r(arr.length)];
function schud(a) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = r(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; }

/* Elke verbastering maakt van een goed gespeld woord een fout gespeld woord,
   volgens precies de regel die het leerdoel oefent. */
const VERBASTER = {
  'cht-gt': w => w.replace('cht', 'gt'),
  'sch-sg': w => w.replace(/sch/g, 'sg'),
  'ei-ij': w => w.replace('ei', 'ij'),
  'ij-ei': w => w.replace('ij', 'ei'),
  'au-ou': w => w.replace('au', 'ou'),
  'ou-au': w => w.replace('ou', 'au'),
  'd-t': w => w.replace(/d$/, 't'),
  't-d': w => w.replace(/t$/, 'd'),
  'i-j': w => w.replace(/i$/, 'j'),
  'dubbel-klinker': w => w.replace(/([aeou])([bcdfgklmnprstvz])/, '$1$1$2'),
  /* Een verbastering moet een fout zijn die een kind ECHT maakt. "llip" en
     "nnet" (de beginmedeklinker verdubbeld) schrijft niemand; de eindletter
     verdubbelen (nett, boss) en de klinker verlengen (neet) wel. Een
     onwaarschijnlijke fout maakt de opgave makkelijker dan de werkelijkheid. */
  'dubbel-eind': w => w.replace(/([bcdfgklmnprstvz])$/, '$1$1'),
  'klinker-wissel': w => w.replace(/([aeiou])/, m => ({ a: 'e', e: 'a', i: 'e', o: 'a', u: 'o' })[m] || m),
  'ng-nk': w => w.replace('ng', 'nk'),
  'nk-ng': w => w.replace('nk', 'ng'),
  'los': w => w.replace(/^(\w{3,})(\w{4,})$/, '$1 $2'),
  'v-f': w => w.replace(/^v/, 'f'),
  'z-s': w => w.replace(/^z/, 's')
};

const GENT = {
  /* Spelling volgens een regel: het goede woord uit de bank, de fout eruit
     afgeleid. g.fout is de naam van de verbastering, g.fout2 de reserve. */
  spel(g) {
    const bank = schud(g.woorden);
    for (const woord of bank) {
      for (const naam of [g.fout, g.fout2].filter(Boolean)) {
        const fout = VERBASTER[naam] ? VERBASTER[naam](woord) : woord;
        if (fout && fout !== woord) return { v: 'Welk woord is goed geschreven?', a: woord, opties: schud([woord, fout]) };
      }
    }
    // geen enkel woord in de bank raakt deze regel: dat is een fout in de leerlijn
    throw new Error('leerstof-gen-taal: geen woord in de bank past bij de regel ' + g.fout);
  },

  // de of het: het lidwoord dat je gewoon moet weten
  lidwoord(g) {
    const [woord, lid] = kies(g.woorden);
    return { v: '... ' + woord, a: lid, opties: schud(['de', 'het']) };
  },

  // meervoud maken: -en of -s, met verdubbeling of verlenging waar dat moet
  meervoud(g) {
    const [enkel, meer] = kies(g.woorden);
    return { v: 'Een ' + enkel + ', twee ...', a: meer };
  },

  // verkleinwoorden: -je, -tje, -pje, -etje
  verklein(g) {
    const [woord, klein] = kies(g.woorden);
    return { v: 'Maak klein: ' + woord + ' wordt ...', a: klein };
  },

  // alfabetische volgorde: welk woord staat voorin het woordenboek
  alfabet(g) {
    const drie = schud(g.woorden).slice(0, 3);
    const eerst = drie.slice().sort()[0];
    return { v: 'Welk woord staat het eerst in het woordenboek?', a: eerst, opties: schud(drie) };
  },

  // woordsoorten: zelfstandig naamwoord, werkwoord, bijvoeglijk naamwoord
  woordsoort(g) {
    const soorten = Object.keys(g.woorden);
    const soort = kies(soorten);
    const woord = kies(g.woorden[soort]);
    return { v: 'Wat voor woord is "' + woord + '"?', a: soort, opties: schud(soorten.slice()) };
  },

  /* Zinsdelen VRAGEN OM EEN ZIN. "Is 'de hond' een onderwerp?" is niet te
     beantwoorden: in "de hond eet" wel, in "ik zie de hond" niet. Daarom bouwt
     deze generator eerst een zin en stelt hij de vraag daarover. Dat is het
     verschil tussen een woordsoort (die zit in het woord) en een zinsdeel
     (dat zit in de zin). */
  zinsdeel(g) {
    /* Het werkwoord draagt zijn eigen voorwerpen mee. Zonder dat koppel komt
       er "de hond leest het boek" uit: grammaticaal te ontleden, maar een kind
       dat over de zin struikelt, leest de vraag niet meer. */
    const onderwerp = kies(g.onderwerpen || []);
    const [ww, voorwerpen] = kies(g.werkwoorden || []);
    const voorwerp = kies(voorwerpen);
    const zin = onderwerp.charAt(0).toUpperCase() + onderwerp.slice(1) + ' ' + ww + ' ' + voorwerp + '.';
    const vraag = kies(['persoonsvorm', 'onderwerp', 'lijdend voorwerp']);
    const goed = vraag === 'persoonsvorm' ? ww : vraag === 'onderwerp' ? onderwerp : voorwerp;
    return { v: '"' + zin + '" Wat is in deze zin ' + (vraag === 'onderwerp' ? 'het onderwerp' : vraag === 'persoonsvorm' ? 'de persoonsvorm' : 'het lijdend voorwerp') + '?',
      a: goed, opties: schud([onderwerp, ww, voorwerp]) };
  },

  // woordenschat: hetzelfde of juist het tegenovergestelde
  woordpaar(g) {
    const [woord, goed] = kies(g.paren);
    const anderen = g.paren.filter(p => p[0] !== woord).map(p => p[1]);
    const vraag = g.soortVraag === 'tegenstelling'
      ? 'Wat is het tegenovergestelde van "' + woord + '"?'
      : 'Welk woord betekent ongeveer hetzelfde als "' + woord + '"?';
    return { v: vraag, a: goed, opties: schud([goed].concat(schud(anderen).slice(0, 2))) };
  },

  // klankgroepen: de basis onder open en gesloten lettergrepen
  klankgroep(g) {
    const [woord, aantal] = kies(g.woorden);
    return { v: 'Uit hoeveel klankgroepen bestaat "' + woord + '"? (bo-men zijn er twee)', a: String(aantal) };
  },

  /* Begrijpend lezen: een kort tekstje dat de motor zelf samenstelt, met een
     vraag die alleen te beantwoorden is door het te lezen. De naam, de plaats
     en de getallen wisselen, dus onthouden helpt niet. */
  lezen(g) {
    const NAMEN = ['Sam', 'Noor', 'Yusuf', 'Fleur', 'Daan', 'Amira', 'Bram', 'Lot'];
    const PLEK = ['de bibliotheek', 'het zwembad', 'de markt', 'het museum', 'de kinderboerderij'];
    const DING = [['boeken', 'boek'], ['kaartjes', 'kaartje'], ['appels', 'appel'], ['stickers', 'sticker']];
    const naam = kies(NAMEN), plek = kies(PLEK), [mv, ev] = kies(DING);
    const a = 2 + r(8), b = 1 + r(5);
    const tekst = naam + ' ging naar ' + plek + ' en nam ' + a + ' ' + mv + ' mee. Onderweg gaf ' + naam + ' er ' + b + ' weg.';
    const soort = g.soort2 === 'verwijzen' ? 1 : r(2);
    if (soort === 1) {
      const andere = PLEK.filter(x => x !== plek);
      return { v: tekst + ' Waar ging ' + naam + ' heen?', a: plek, opties: schud([plek].concat(schud(andere).slice(0, 2))) };
    }
    /* Ook de rekenvariant krijgt opties. Een generator die de ene keer wel en
       de andere keer geen keuzes teruggeeft, is niet bruikbaar in een
       meerkeuzespel -- en dan klopt zijn plek op de meerkeuzelijst niet. */
    const goed = a - b;
    const fout = [a + b, a, b].filter(x => x !== goed);
    return { v: tekst + ' Hoeveel ' + (goed === 1 ? ev : mv) + ' hield ' + naam + ' over?',
      a: String(goed), opties: schud([String(goed)].concat(fout.slice(0, 2).map(String))) };
  },

  // signaalwoorden: het verband tussen twee zinnen
  signaal(g) {
    const [zin, woord] = kies(g.zinnen);
    const anderen = g.zinnen.filter(z => z[1] !== woord).map(z => z[1]);
    return { v: 'Welk woord past hier: ' + zin, a: woord, opties: schud([woord].concat(schud(anderen).slice(0, 2))) };
  }
};

const MEERKEUZE_TAAL = ['spel', 'lidwoord', 'alfabet', 'woordsoort', 'woordpaar', 'signaal', 'zinsdeel', 'lezen'];

module.exports = { GENT, MEERKEUZE_TAAL, VERBASTER };
