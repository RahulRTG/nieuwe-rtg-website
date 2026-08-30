/* ============================================================================
   DE GENREZAKEN -- een zaaksessie per bedrijfssoort.

   HET PROBLEEM. Van de 517 routes in FIXTURE_403 worden er 235 geweigerd op
   het GENRE van de zaak, en niet op de rol. De proef had een zaaksessie -- de
   demo-zaak -- en die is een hotel. Elke jachthavenroute kreeg dus keurig
   "Deze zaak is geen jachthaven", en dat is geen gat maar precies de scheiding
   die werkt; alleen kon de proef er niets over meten.

   De weigering hangt aan wat de zaak IS. Twee vormen, allebei uit de bron
   gelezen en niet geraden:

     s.type === 'sportclub'        (kern/sportclub/index.js, isSportclub)
     capsVan(s).includes('marina') (routes/marina.js, en zo bij elk domein)

   en `capsVan` komt op zijn beurt uit `supplierTypes[s.type].caps`
   (kern/werkvormen.js). Het genre van de zaak is dus in beide vormen de enige
   knop -- er is geen vlag, geen instelling en geen recht dat dit opent.

   WAT DIT NIET IS. Dit is geen versoepeling en geen tweede sleutel: elke
   sessie hieronder is een gewone personeelslogin met een PIN, langs dezelfde
   /api/supplier/login als de leverancier-app zelf. Wat de proef wint is niet
   MEER mogen, maar aankloppen bij de JUISTE zaak.

   DE BUDGETGRENS DIE HIER MEETELT. /api/supplier/roster laat dertig
   opvragingen per kwartier per IP toe (routes/supplier/toegang.js,
   rosterMag) -- een echte rem, met een reden erbij: zonder hem is het
   complete personeelsbestand van elke partner uit te lezen. Deze lijst telt
   twintig zaken en blijft daar bewust onder; wie er een genre bij zet, kijkt
   eerst of hij er nog onder blijft. test/genrezaken.test.js zakt zodra dat
   niet meer zo is.

   WAAROM DE CODES HIER STAAN EN NIET WORDEN GEZOCHT. De demozaken worden per
   domein gezaaid (kern/<domein>/index.js, alleen in demostand). Een zoeker
   over alle zaken zou bij elke nieuwe demozaak een ander antwoord geven, en
   dan meet een volgende ronde iets anders zonder dat iemand weet waarom. De
   koppeling staat daarom vast, met per regel het genre waar hij aan hangt --
   en de proef MELDT wat er niet openging in plaats van stil door te lopen. */
'use strict';

/* Per zaak: de leverancierscode, het genre dat zij draagt, en de routepaden
   die zonder haar op 403 blijven staan. De paden zijn voorvoegsels en zijn
   gemeten uit ONBEWEZEN.json (bak FIXTURE_403), niet bedacht. */
const ZAKEN = [
  { code: 'RIJK',      genre: 'rijk',          prefixen: ['/api/overheid/'],
    waarom: 'de rijksoverheid; overheid.magBehandelen leest s.type === "rijk"' },
  { code: 'FCRTG',     genre: 'sportclub',     prefixen: ['/api/sport/'],
    waarom: 'de sportclub; sport.isSportclub leest s.type === "sportclub"' },
  { code: 'LUCHT',     genre: 'luchthaven',    prefixen: ['/api/lucht/'],
    waarom: 'de luchthaven; lucht.isLucht leest s.type === "luchthaven"' },
  { code: 'GEMEENTE',  genre: 'gemeente',      prefixen: ['/api/gemeente/'],
    waarom: 'de gemeente; gemeente.magBehandelen leest s.type === "gemeente"' },
  { code: 'KMAR',      genre: 'marechaussee',  prefixen: ['/api/kmar/'],
    waarom: 'de marechaussee; kmar.isKmar leest s.type === "marechaussee"' },
  { code: 'MERIDIAAN', genre: 'kantoorgebouw', prefixen: ['/api/supplier/gebouw'],
    waarom: 'het kantoorgebouw; routes/gebouw.js vraagt de cap "gebouw"' },
  /* De vakwerkkant vraagt geen cap maar een GENRE uit VAK_GENRES
     (kern/vakwerk/index.js, genreVan). `zzp` staat daar bovenaan. VAKISLA
     droeg het genre wel maar heeft geen manager in het rooster, en zonder
     manager is er geen personeelslogin -- gemeten, niet aangenomen. */
  { code: 'AYAKA',     genre: 'zzp',           prefixen: ['/api/supplier/vak'],
    waarom: 'de dienstverlenende zaak; kern/vakwerk/index.js vraagt een genre uit VAK_GENRES' },
  { code: 'VALAURA',   genre: 'wintersport',   prefixen: ['/api/supplier/alpine'],
    waarom: 'het wintersportresort; routes/alpine.js vraagt de cap "alpine"' },
  { code: 'PORTELL',   genre: 'marina',        prefixen: ['/api/supplier/marina'],
    waarom: 'de jachthaven; routes/marina.js vraagt de cap "marina"' },
  { code: 'AMICS',     genre: 'petcare',       prefixen: ['/api/supplier/petcare'],
    waarom: 'het petcare-bedrijf; routes/planners.js vraagt de cap "petcare"' },
  { code: 'FORTIA',    genre: 'fitnessclub',   prefixen: ['/api/supplier/fitclub'],
    waarom: 'de fitnessclub; routes/planners.js vraagt de cap "fitclub"' },
  { code: 'SAROCA',    genre: 'golfclub',      prefixen: ['/api/supplier/golf'],
    waarom: 'de golfclub; routes/planners.js vraagt de cap "golf"' },
  { code: 'VELVET',    genre: 'beautysalon',   prefixen: ['/api/supplier/beauty'],
    waarom: 'de beautysalon; routes/planners.js vraagt de cap "beauty"' },
  { code: 'NIDO',      genre: 'kinderopvang',  prefixen: ['/api/supplier/opvang'],
    waarom: 'de kinderopvang; routes/planners.js vraagt de cap "opvang"' },
  { code: 'TERRAMAR',  genre: 'vracht',        prefixen: ['/api/supplier/vracht'],
    waarom: 'de vracht- en expeditiepartner; routes/vracht.js vraagt de cap "vracht"' },
  { code: 'SEGUR',     genre: 'verzekeringen', prefixen: ['/api/supplier/zorgpolis', '/api/supplier/polis'],
    waarom: 'de verzekeraar en de verzekeringsadviseur; beide vragen de cap "polis"' },
  { code: 'AURELIA',   genre: 'weddingplanner', prefixen: ['/api/supplier/weddings'],
    waarom: 'de wedding- en eventplanner; routes/planners.js vraagt de cap "weddings"' },
  { code: 'LEXNOVA',   genre: 'professioneel', prefixen: ['/api/supplier/advies'],
    waarom: 'de professionele praktijk; routes/planners.js vraagt de cap "advies"' },
  { code: 'CANMISSES', genre: 'ziekenhuis',    prefixen: ['/api/supplier/zorg'],
    waarom: 'het ziekenhuis; alleen daar bestaat een eerste hulp (kern/zorgketen)' },
  { code: 'URGENCIA',  genre: 'ambulance',     prefixen: ['/api/supplier/keten'],
    waarom: 'de hulpdienst; de zorgketen en het rampbeeld zijn voor hulpdiensten, zorg en defensie' }
];

/* De rem op /api/supplier/roster staat op dertig per kwartier per IP. Deze
   lijst gebruikt er een per zaak, en de proef doet er verder geen. */
const ROSTER_BUDGET = 30;

/* Welke zaak hoort bij dit pad -- of geen. Het langste voorvoegsel wint, zodat
   /api/supplier/zorgpolis niet bij /api/supplier/zorg belandt. */
function zaakVoor(pad) {
  let beste = null;
  for (const z of ZAKEN) {
    for (const p of z.prefixen) {
      if (!String(pad || '').startsWith(p)) continue;
      if (!beste || p.length > beste.lengte) beste = { zaak: z, lengte: p.length };
    }
  }
  return beste ? beste.zaak : null;
}

/* De rolnaam waaronder een genresessie in de bewijsstukken staat. Het is een
   EIGEN rol en geen variant van `supplier`: wie hem samenvouwt met de gewone
   zaaksessie, meet niet meer of de genrescheiding werkt. */
const rolVanZaak = (code) => 'zaak:' + code;

/* MAG DEZE ROUTE NAAR EEN GENREZAAK. Alleen vanaf `supplier` -- dat is
   dezelfde SOORT deur (een zaaksessie), en dan is dit een verfijning: welke
   ZAAK die sessie moet zijn. Vanaf elke andere rol is het geen verfijning maar
   een ander antwoord op de vraag wie er aanklopt, en dan weet een voorvoegsel
   het niet beter dan de bewakerskaart (dezelfde redenering als
   NOOIT_OPWAARDEREN in ./lijfsleutels.js).

   Geeft de nieuwe rol terug, of null met de reden. */
function genreRolVoor(huidigeRol, pad) {
  const z = zaakVoor(pad);
  if (!z) return { rol: null, reden: 'geen genrezaak dekt dit pad' };
  if (huidigeRol !== 'supplier') {
    return { rol: null, reden: '`' + huidigeRol + '` is geen zaaksessie; een genrezaak verfijnt alleen `supplier`' };
  }
  return { rol: rolVanZaak(z.code), reden: null, zaak: z };
}

module.exports = { ZAKEN, ROSTER_BUDGET, zaakVoor, rolVanZaak, genreRolVoor };
