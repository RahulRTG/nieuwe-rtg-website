/* HET BESTUUR: wie beslist, wie bezit, en wie er als UBO uit volgt.

   DIT BESTAAT ALLEEN WAAR HET ECHT BESTAAT. Een eenmanszaak heeft geen bestuur
   en geen aandeelhouders: de ondernemer *is* de onderneming. Zou dit scherm er
   toch staan, leeg, dan leest dat als "u moet dit nog invullen" -- en dan gaat
   iemand een bestuur verzinnen voor een bedrijf dat er geen kan hebben. De
   rechtsvorm-as (./rechtsvorm.js) weet dit al: `bestuur` en `aandeelhouders`
   zijn caps, en `aandelen` staat bij een stichting in de VERBODEN. Deze laag
   leest die assen en bouwt er niets naast.

   HET VERBOD WINT, OOK HIER. Een stichting heeft geen eigenaar en mag geen
   aandelen kennen. Dat is niet iets wat wij hier nog eens apart controleren met
   een lijstje rechtsvormen -- dan staan er twee waarheden -- maar het komt uit
   dezelfde `verboden` waar de capslijst hem ook uit haalt.

   DE UBO WORDT AFGELEID EN NIET INGEVULD. Wie meer dan 25% van de aandelen
   houdt, is uiteindelijk belanghebbende; is er niemand die daarboven uitkomt,
   dan gelden de statutair bestuurders als UBO. Dat is een REGEL en geen oordeel,
   dus hij hoort gerekend te worden en niet aangevinkt -- een aangevinkte UBO
   blijft staan als de aandelen verschuiven, en dan klopt het register precies
   op het moment dat het ertoe doet niet meer.

   EN WAT DIT NIET IS: een UBO-opgave bij de Kamer van Koophandel. Die doet u
   daar, met echte namen en identiteitsbewijzen. Dit is het beeld waarmee u die
   opgave voorbereidt en bijhoudt. Het staat in het antwoord zelf, want een
   register dat zich voordoet als de officiële opgave, is er een die niemand
   meer indient.

   ALLES OP CODENAAM. Een bestuurdersregister is precies de plek waar de
   codenaam-regel stilletjes zou sneuvelen: hier hoort een echte naam thuis, in
   de wet althans. Bij RTG niet -- echte namen staan in de kluis (accounts.js),
   en dit register wijst naar personen zoals de rest van het huis dat doet. */
'use strict';

const RV = require('./rechtsvorm');

/* De drempel waarboven iemand uiteindelijk belanghebbende is. MEER dan 25%,
   niet 25% of meer: die grens is de wet en niet onze afronding. */
const UBO_DREMPEL = 25;

const ROLLEN = {
  bestuurder: { label: 'Statutair bestuurder', tekent: true,
    wat: 'Vertegenwoordigt de onderneming en is als enige aansprakelijk bij onbehoorlijk bestuur.' },
  voorzitter: { label: 'Voorzitter', tekent: true, wat: 'Leidt het bestuur; statutair bestuurder.' },
  penningmeester: { label: 'Penningmeester', tekent: true, wat: 'Beheert de middelen; statutair bestuurder.' },
  secretaris: { label: 'Secretaris', tekent: true, wat: 'Houdt de besluiten bij; statutair bestuurder.' },
  commissaris: { label: 'Commissaris', tekent: false,
    wat: 'Houdt toezicht op het bestuur en vertegenwoordigt de onderneming niet.' },
  adviseur: { label: 'Adviseur', tekent: false,
    wat: 'Denkt mee zonder bestuursbevoegdheid. Telt niet mee voor de UBO-afleiding.' }
};

const rond1 = (n) => Math.round(Number(n) * 10) / 10;

module.exports = ({ save, schoon, ondernemingCaps }) => {
  const scho = (v, n) => (schoon ? schoon(v, n) : String(v == null ? '' : v).trim().slice(0, n));

  /* Wat deze onderneming mag hebben. Uit de SAMENGEVOEGDE capslijst van
     ./beeld.js -- dezelfde die het scherm krijgt, met de verboden er al af.
     Zou dit bestand zijn eigen lijstje maken, dan staan er twee waarheden over
     wat een rechtsvorm mag, en wint de verkeerde vanzelf een keer.

     LET OP DE TWEE NAMEN: de cap heet `aandeelhouders` (het register), het
     verbod heet `aandelen` (het ding zelf). Het register bestaat alleen zolang
     het ding zelf mag bestaan; ./beeld.js voert ze daarom allebei in. */
  function mag(o) {
    const samen = ondernemingCaps(o);
    return {
      bestuur: samen.caps.includes('bestuur'),
      aandelen: samen.caps.includes('aandeelhouders') && samen.caps.includes('aandelen'),
      geweerd: samen.geweerd
    };
  }

  const bak = (o) => {
    if (!o.bestuur || typeof o.bestuur !== 'object') o.bestuur = {};
    if (!Array.isArray(o.bestuur.bestuurders)) o.bestuur.bestuurders = [];
    if (!Array.isArray(o.bestuur.aandelen)) o.bestuur.aandelen = [];
    return o.bestuur;
  };

  const zittend = (b) => b.bestuurders.filter(x => !x.tot);

  /* ---- de UBO-afleiding ----
     Twee trappen, in deze volgorde, want zo staat de regel. Nooit allebei
     tegelijk: een pseudo-UBO naast een echte zou suggereren dat er twee soorten
     belanghebbenden zijn. */
  function ubo(b, kanAandelen) {
    if (kanAandelen) {
      const groot = b.aandelen.filter(a => a.percentage > UBO_DREMPEL)
        .sort((x, y) => y.percentage - x.percentage);
      if (groot.length) {
        return { soort: 'belang', drempel: UBO_DREMPEL,
          personen: groot.map(a => ({ codenaam: a.codenaam, percentage: a.percentage })),
          regel: 'Wie meer dan ' + UBO_DREMPEL + '% van de aandelen houdt, is uiteindelijk belanghebbende.' };
      }
    }
    /* Niemand boven de drempel (of geen aandelen mogelijk): dan de statutair
       bestuurders. Commissarissen en adviseurs tellen niet mee -- zij
       vertegenwoordigen de onderneming niet. */
    const tekenaars = zittend(b).filter(x => ROLLEN[x.rol] && ROLLEN[x.rol].tekent);
    if (!tekenaars.length) {
      return { soort: 'geen', drempel: UBO_DREMPEL, personen: [],
        regel: 'Er is niemand met een belang boven ' + UBO_DREMPEL + '% en er staat geen statutair bestuurder ingeschreven.',
        let: 'Zolang dit zo is, kunt u geen UBO-opgave doen. Elke rechtspersoon heeft er een.' };
    }
    return { soort: 'pseudo', drempel: UBO_DREMPEL,
      personen: tekenaars.map(x => ({ codenaam: x.codenaam, rol: x.rol })),
      regel: 'Niemand houdt meer dan ' + UBO_DREMPEL + '% van de aandelen. Dan gelden de statutair bestuurders als UBO.',
      let: 'Dit heet een pseudo-UBO. Hij is niet minder geldig, maar hij verandert zodra iemand wél boven de drempel uitkomt.' };
  }

  /* ---- het beeld ----
     Null waar het niet bestaat, en met de reden waarom -- niet een leeg
     register dat leest als een openstaande taak. */
  function bestuur(o) {
    if (!o.rechtsvorm) {
      return { stand: 'geen-rechtsvorm',
        vraag: 'Welke rechtsvorm wordt het?',
        uitleg: 'Of er een bestuur is, en of er aandeelhouders kunnen zijn, volgt uit de rechtsvorm. Zonder die keuze zouden wij een register neerzetten dat misschien niet mag bestaan.' };
    }
    const m = mag(o);
    const rv = RV.rechtsvormVan(o.rechtsvorm);
    if (!m.bestuur && !m.aandelen) {
      return { stand: 'niet-van-toepassing', rechtsvorm: rv.label,
        uitleg: 'Een ' + rv.label.toLowerCase() + ' heeft geen bestuur en geen aandeelhouders. U bent de onderneming.',
        let: 'Wij zetten hier met opzet geen leeg register neer: dat leest als iets dat u nog moet invullen.' };
    }

    const b = bak(o);
    const zit = zittend(b);
    const totaal = rond1(b.aandelen.reduce((n, a) => n + a.percentage, 0));

    return {
      stand: 'bestaat', rechtsvorm: rv.label,
      magAandelen: m.aandelen,
      /* Waarom er GEEN aandeelhouders staan bij een stichting of vereniging.
         Zonder deze regel leest een ontbrekend blok als een storing. */
      aandelenGeweerd: m.aandelen ? null
        : 'Een ' + rv.label.toLowerCase() + ' kent geen aandelen en dus geen eigenaar.',
      bestuurders: zit.map(x => ({ id: x.id, codenaam: x.codenaam, rol: x.rol,
        rolLabel: (ROLLEN[x.rol] || {}).label || x.rol,
        tekent: !!(ROLLEN[x.rol] || {}).tekent, sinds: x.sinds })),
      afgetreden: b.bestuurders.filter(x => x.tot)
        .map(x => ({ id: x.id, codenaam: x.codenaam, rol: x.rol, sinds: x.sinds, tot: x.tot })),
      aandelen: m.aandelen ? b.aandelen.map(a => ({ id: a.id, codenaam: a.codenaam,
        percentage: a.percentage, soort: a.soort })) : [],
      verdeeld: m.aandelen ? {
        totaal, open: rond1(100 - totaal),
        /* Niet uitgegeven aandelen zijn tijdens een oprichting doodnormaal. Dit
           is dus een melding en geen fout: een register dat rood kleurt terwijl
           er niets mis is, leert iemand rood te negeren. */
        melding: totaal === 100 ? null
          : (totaal < 100
            ? 'Er is ' + rond1(100 - totaal) + '% niet toegewezen. Tijdens een oprichting is dat normaal; daarna hoort het te kloppen.'
            : 'Er staat meer dan 100% uit. Dat kan niet; controleer de percentages.')
      } : null,
      ubo: ubo(b, m.aandelen),
      rollen: Object.entries(ROLLEN).map(([id, r]) => Object.assign({ id }, r)),
      voorbehoud: 'Dit is niet de UBO-opgave bij de Kamer van Koophandel; die doet u daar, met echte namen en identiteitsbewijzen. Hier staat alles op codenaam, zoals overal in RTG.'
    };
  }

  /* De vier handelingen staan in ./bestuur-handelingen.js -- dit bestand ging
     over de 10 kB van het modulebeleid, en de naad loopt langs de vraag wie er
     SCHRIJFT. De grendels blijven hier, in `mag()`: een tweede plek die bepaalt
     wat een rechtsvorm mag, is een tweede waarheid. */
  const { bestuurderZet, bestuurderAf, aandeelZet, aandeelWeg } =
    require('./bestuur-handelingen')({ save, scho, mag, bak, zittend, bestuur, ROLLEN });

  return { BESTUUR_ROLLEN: ROLLEN, BESTUUR_UBO_DREMPEL: UBO_DREMPEL,
    bestuur, bestuurderZet, bestuurderAf, aandeelZet, aandeelWeg };
};

module.exports.ROLLEN = ROLLEN;
module.exports.UBO_DREMPEL = UBO_DREMPEL;
