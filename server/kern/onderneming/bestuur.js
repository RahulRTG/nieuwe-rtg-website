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

   ALLES OP CODENAAM. Een bestuurdersregister is precies de plek waar de
   codenaam-regel stilletjes zou sneuvelen: hier hoort een echte naam thuis, in
   de wet althans. Bij RTG niet -- echte namen staan in de kluis (accounts.js),
   en dit register wijst naar personen zoals de rest van het huis dat doet. */
'use strict';

const RV = require('./rechtsvorm');

/* De UBO-afleiding staat in ./bestuur-ubo.js: het register gaat over wie er IN
   staat, die module over wat daar UIT volgt. De drempel komt daar vandaan, zodat
   er niet twee getallen zijn die allebei "de wet" beweren. */
const { UBO_DREMPEL } = require('./bestuur-ubo');

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

module.exports = ({ save, schoon, ondernemingCaps, keyVanCodenaam, lidstandVan }) => {
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
  /* De HUIDIGE belangen: een belang wordt afgesloten en niet overschreven, dus
     staat de historie in dezelfde lijst. Alles wat over "nu" gaat -- de
     verdeling, de UBO -- leest hier en nooit rechtstreeks uit b.aandelen. */
  const nu = (b) => b.aandelen.filter(a => !a.tot);

  const { duidPersoon, grondVan, grondslag } =
    require('./bestuur-persoon')({ scho, keyVanCodenaam, lidstandVan });

  const { ubo } = require('./bestuur-ubo')({ zittend, nu, ROLLEN });

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
    const open = nu(b);
    const totaal = rond1(open.reduce((n, a) => n + a.percentage, 0));
    const u = ubo(b, m.aandelen);

    return {
      stand: 'bestaat', rechtsvorm: rv.label,
      magAandelen: m.aandelen,
      /* Waarom er GEEN aandeelhouders staan bij een stichting of vereniging.
         Zonder deze regel leest een ontbrekend blok als een storing. */
      aandelenGeweerd: m.aandelen ? null
        : 'Een ' + rv.label.toLowerCase() + ' kent geen aandelen en dus geen eigenaar.',
      bestuurders: zit.map(x => ({ id: x.id, codenaam: x.codenaam, rol: x.rol,
        rolLabel: (ROLLEN[x.rol] || {}).label || x.rol,
        tekent: !!(ROLLEN[x.rol] || {}).tekent, sinds: x.sinds, grond: grondVan(x) })),
      afgetreden: b.bestuurders.filter(x => x.tot)
        .map(x => ({ id: x.id, codenaam: x.codenaam, rol: x.rol, sinds: x.sinds, tot: x.tot })),
      aandelen: m.aandelen ? open.map(a => ({ id: a.id, codenaam: a.codenaam,
        percentage: a.percentage, soort: a.soort, sinds: a.sinds || null, grond: grondVan(a) })) : [],
      /* De afgesloten belangen. Ze staan apart en niet tussen de huidige: dat
         is het verschil tussen "houdt" en "hield", en juist dat verschil is
         waar een geschil over gaat. */
      aandelenHistorie: m.aandelen ? b.aandelen.filter(a => a.tot)
        .map(a => ({ id: a.id, codenaam: a.codenaam, percentage: a.percentage,
          soort: a.soort, sinds: a.sinds || null, tot: a.tot })) : [],
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
      /* De UBO-afleiding is een rekenregel en die klopt altijd; of de PERSONEN
         erin ook zijn wie ze zeggen te zijn, is een andere vraag. Die hoort op
         het scherm waarmee iemand een UBO-opgave voorbereidt. */
      ubo: Object.assign(u, { grondslag: grondslag(u.personen, open.concat(zit)) }),
      rollen: Object.entries(ROLLEN).map(([id, r]) => Object.assign({ id }, r)),
      voorbehoud: 'Dit is niet de UBO-opgave bij de Kamer van Koophandel; die doet u daar, met echte namen en identiteitsbewijzen. Hier staat alles op codenaam, zoals overal in RTG.'
    };
  }

  /* De vier handelingen staan in ./bestuur-handelingen.js -- dit bestand ging
     over de 10 kB van het modulebeleid, en de naad loopt langs de vraag wie er
     SCHRIJFT. De grendels blijven hier, in `mag()`: een tweede plek die bepaalt
     wat een rechtsvorm mag, is een tweede waarheid. */
  const { bestuurderZet, bestuurderAf, aandeelZet, aandeelWeg } =
    require('./bestuur-handelingen')({ save, scho, mag, bak, zittend, bestuur, ROLLEN, duidPersoon });

  return { BESTUUR_ROLLEN: ROLLEN, BESTUUR_UBO_DREMPEL: UBO_DREMPEL,
    bestuur, bestuurderZet, bestuurderAf, aandeelZet, aandeelWeg };
};

module.exports.ROLLEN = ROLLEN;
module.exports.UBO_DREMPEL = UBO_DREMPEL;
