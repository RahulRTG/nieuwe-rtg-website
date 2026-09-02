/* ============================================================================
   RTG iD, deel "bewijs": voldoet dit lid aan een eis, ja of nee.

   HDI.md par. 2 stelde een `bewijsmap` voor (het woord `wallet` was bezet: dat
   is geld, en een wallet die soms geld en soms een diploma draagt laat de vraag
   "mag dit eruit?" twee antwoorden hebben). Bij het nameten bleek er geen
   bewijsmap te ONTBREKEN: kern/vakbewijs.js houdt de stukken al bij, met een
   aftekening door een mens, een geldigheid die bij elke vraag opnieuw wordt
   gerekend, en het nummer in de identiteitskluis. Wat ontbrak is dat een LID er
   zelf niets mee kon: vakbewijs werd alleen gelezen door kern/persoonseis.js,
   dat de vraag "mag deze mens hier werken" beantwoordt voor de ZAAK.

   Dit bestand is de brug, en hij is met opzet de smalste die er te maken is.

   WAT ER DE DEUR UIT GAAT: EEN VINKJE EN EEN DATUM. Niet welke stukken iemand
   heeft, niet sinds wanneer, niet van welke instantie, en nooit het nummer. Een
   dienst vraagt "voldoet deze mens aan de eis VOG" en krijgt `true` of `false`,
   met bij `true` de datum tot wanneer dat zo blijft.

   DRIE REDENEN WAAROM HET ZO SMAL IS, EN ALLE DRIE ZIJN ZE EEN GRENS UIT DIT
   HUIS EN GEEN VOORZICHTIGHEID:

   1. HET NUMMER VOERT DE CODENAAM TERUG NAAR EEN MENS. Een BIG-registratie
      staat in een OPENBAAR register. Een nummer naast een codenaam is dus geen
      extra veld maar de sleutel die het hele privacy-ontwerp opent (CLAUDE.md,
      en kern/vakbewijs-nummer.js zegt hetzelfde over zichzelf). Het nummer komt
      hier niet voor -- ook niet als het gevraagd wordt.

   2. EEN LIJST STUKKEN IS EEN PROFIEL. Twee diensten die elk netjes vragen wat
      ze nodig hebben, weten samen meer dan elk van hen zou mogen weten zodra ze
      LIJSTEN krijgen in plaats van antwoorden. Daarom bestaat er geen route die
      "alle bewijzen van dit lid" naar buiten geeft; het lid ziet zijn eigen
      lijst, en verder niemand.

   3. `false` ZEGT NIET WAAROM. Het verschil tussen "heeft het nooit gehad" en
      "het is verlopen" is nuttig voor het LID en verraadt aan een DIENST dat
      iemand het ooit had. Het lid ziet die reden dus op zijn eigen scherm; wat
      over de lijn gaat is een vinkje. Dat is dezelfde knip als bij 18plus, waar
      de geboortedatum de kluis ook niet verlaat.

   DE EISENLIJST WORDT AFGELEID EN NIET OVERGETYPT. Hij komt uit
   kern/persoonseis-lijst.js, het register dat een bestuurder of jurist leest.
   Een tweede lijst hier zou binnen een jaar uiteenlopen met de eerste (LAT.md
   regel 4), en dan zou een eis bestaan die nergens wordt afgedwongen of
   andersom.

   LAAT GEBONDEN. kern/vakbewijs.js wordt later gemonteerd dan RTG iD; zonder
   bron antwoordt deze laag eerlijk dat hij het niet weet, en nooit `false`.
   Het verschil tussen "nee" en "ik kan het niet nagaan" is precies waar
   BESTUUR.md over gaat: `niet vast te stellen` is een eersteklas uitslag.
   ========================================================================== */
'use strict';

const { SOORTEN } = require('./persoonseis-lijst');

/* Het voorvoegsel waarmee een dienst een bewijs vraagt: `bewijs:vog`. Een eigen
   ruimte naast de vijf gewone attributen, zodat er geen naam kan botsen als er
   ooit een stuk bijkomt dat toevallig `naam` of `leeftijd` heet. */
const VOORVOEGSEL = 'bewijs:';

/* De eisen die een dienst kan vragen. AFGELEID uit het persoonseis-register. */
const EISEN = Object.keys(SOORTEN);

const isBewijsAttribuut = (a) => typeof a === 'string' && a.startsWith(VOORVOEGSEL) &&
  EISEN.includes(a.slice(VOORVOEGSEL.length));
const soortVan = (a) => String(a || '').slice(VOORVOEGSEL.length);

module.exports = (ctx) => {
  const { accountVanKey } = ctx;
  /* Laat gebonden: een functie die de bron OPHAALT op het moment dat hij nodig
     is, in plaats van een verwijzing die bij het monteren wordt bevroren. */
  const bron = () => (typeof ctx.vakbewijsBron === 'function' ? ctx.vakbewijsBron() : null);

  /* Voldoet dit lid aan deze eis? Drie uitkomsten en niet twee: `null` betekent
     dat het niet is na te gaan, en dat is iets anders dan nee. */
  function voldoetAan(key, soort) {
    if (!EISEN.includes(soort)) return { soort, voldoet: null, tot: null, reden: 'onbekende-eis' };
    const v = bron();
    if (!v || typeof v.vakbewijsHeeft !== 'function' || typeof v.sleutelLid !== 'function') {
      return { soort, voldoet: null, tot: null, reden: 'geen-bron' };
    }
    const u = accountVanKey(key);
    if (!u) return { soort, voldoet: null, tot: null, reden: 'geen-account' };
    const r = v.vakbewijsHeeft(v.sleutelLid(u.id), soort);
    /* Bij `true` gaat de einddatum mee: een dienst die iemand voor een half jaar
       inhuurt, hoort te weten dat het bewijs over een maand verloopt. Bij
       `false` gaat er GEEN datum mee -- die zou verraden dat iemand het stuk
       ooit had (reden 3 in de kop). */
    if (r && r.ok) return { soort, voldoet: true, tot: (r.vakbewijs && r.vakbewijs.tot) || null, reden: null };
    return { soort, voldoet: false, tot: null, reden: null };
  }

  /* De eigen lijst van het lid. HIER staat de reden er WEL bij, en dat is de
     hele knip van dit bestand: wie het over zichzelf leest heeft er iets aan,
     wie het over een ander leest weet er te veel door. Deze functie hoort dus
     nooit achter een route te komen waar iemand een sleutel van een ander in
     kan vullen. */
  function mijnBewijzen(key) {
    const v = bron();
    if (!v || typeof v.vakbewijsHeeft !== 'function') {
      return { bron: false, eisen: [],
        uitleg: 'De bewijzenlaag is niet gekoppeld. Dat betekent dat wij het niet kunnen nagaan, ' +
          'en niet dat u niets heeft.' };
    }
    const u = accountVanKey(key);
    if (!u) return { bron: false, eisen: [], uitleg: 'Geen account gevonden bij deze sessie.' };
    const sleutel = v.sleutelLid(u.id);
    const eisen = EISEN.map(soort => {
      const r = v.vakbewijsHeeft(sleutel, soort);
      const s = SOORTEN[soort] || {};
      return {
        soort, naam: s.naam || soort, uitleg: s.uitleg || null, herkomst: s.bron || null,
        voldoet: !!(r && r.ok),
        tot: (r && r.ok && r.vakbewijs && r.vakbewijs.tot) || (r && r.tot) || null,
        /* De reden staat er alleen voor u, en in gewone taal. De machine-reden
           uit vakbewijs.js is bruikbaar maar niet leesbaar. */
        reden: r && r.ok ? null : redenTekst(r && r.reden)
      };
    });
    return { bron: true, eisen };
  }

  function redenTekst(reden) {
    if (reden === 'ontbreekt') return 'Hier is bij ons niets van vastgelegd.';
    if (reden === 'verlopen') return 'Dit is verlopen. Een nieuw stuk aanleveren kan bij de zaak waar u werkt.';
    if (reden === 'ingetrokken') return 'Dit is ingetrokken.';
    if (reden === 'niet-gezien') return 'U heeft dit aangeleverd, maar een medewerker van RTG heeft ' +
      'het nog niet gezien. Tot dat gebeurt telt het niet mee.';
    if (reden === 'geen-persoon') return 'Wij konden dit niet aan u koppelen.';
    return 'Onbekend.';
  }

  return { voldoetAan, mijnBewijzen, isBewijsAttribuut, soortVan, EISEN, VOORVOEGSEL };
};

module.exports.EISEN = EISEN;
module.exports.VOORVOEGSEL = VOORVOEGSEL;
module.exports.isBewijsAttribuut = isBewijsAttribuut;
module.exports.soortVan = soortVan;
