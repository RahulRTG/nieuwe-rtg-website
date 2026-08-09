/* RTG Mall, deelbestand "plek": HET LOCATIEMODEL EN HET SERVICEGEBIED.

   De Mall draait eerst om locatie en intentie, pas daarna om het type
   aanbieder. Dat vraagt twee dingen die er nog niet waren:

   1. EEN PLEK waar de bezoeker staat of naartoe kijkt. Niet een gigantische
      wereldcatalogus, maar "Mall Ibiza" of "Mall Haarlem". De plekken worden
      AFGELEID uit het aanbod dat er werkelijk is -- een stad bestaat in de
      Mall zodra er iets te doen is. Zo kan er geen lijst met lege steden
      ontstaan die niemand bijhoudt (LAT-regel 4: geen tweede waarheid).

   2. EEN BEREIK per aanbieder. Niet iedereen heeft een winkel: een elektricien
      in Haarlem met 30 km werkgebied hoort ook in Heemstede en Zandvoort te
      staan, een bezorgrestaurant binnen 6 km, een jurist landelijk en het
      reisbureau in heel Europa. Zonder dit veld is "in de buurt" alleen te
      beantwoorden voor zaken met een adres, en verdwijnt de halve
      dienstensector uit de Mall.

   Het bereik hoort bij de ZAAK (het Supplier Object) en staat dus onder
   `s.mall.bereik`; de boardroom kan hem zetten (kern/mall/etalage.js). Staat
   hij er niet, dan geldt wat het genre standaard meebrengt -- een hotel is
   een adres, een klusbedrijf een straal. Dat is een aanname, en die staat
   daarom als `aangenomen: true` in het antwoord, zodat een scherm hem kan
   tonen als "werkgebied nog niet ingesteld" in plaats van hem als feit te
   verkopen.

   Wat hier NIET wordt gemodelleerd, met opzet: provincies, eilanden en wijken.
   De hierarchie gaat wereld -> werelddeel -> land -> stad, en die vier komen
   alle vier uit data die we echt hebben (de landentabel en het adres van de
   zaak). Een niveau "Balearen" of "Haarlem-Centrum" zou nu verzonnen moeten
   worden; dat wacht op een echte bron. */

const { haversine } = require('../../lib/geo');

/* De bereik-soorten. `km` is de straal die eromheen hoort; null betekent dat
   afstand er niet toe doet (landelijk, Europees, online). */
const BEREIKEN = {
  adres:  { label: 'Op locatie',   km: 0 },
  straal: { label: 'Werkgebied',   km: 30 },
  stad:   { label: 'Hele stad',    km: 25 },
  land:   { label: 'Landelijk',    km: null },
  europa: { label: 'Europa',       km: null },
  online: { label: 'Online',       km: null }
};
const BEREIK_IDS = Object.keys(BEREIKEN);

/* Wat een genre standaard meebrengt. Waar je naartoe gaat is een adres; wat
   naar jou toe komt is een straal; wat op afstand kan is landelijk. */
const GENRE_BEREIK = {
  hotel: 'adres', apartment: 'adres', villa: 'adres', resort: 'adres',
  restaurant: 'adres', bar: 'adres', club: 'adres', beachclub: 'adres', koffie: 'adres',
  retail: 'adres', juwelier: 'adres', galerie: 'adres', boerderij: 'adres',
  wellness: 'adres', sportclub: 'adres', theater: 'adres', school: 'adres',
  bezorg: 'straal', chef: 'straal', zzp: 'straal', bouw: 'straal', care: 'straal',
  verhuur: 'stad', tweewielers: 'stad', taxi: 'stad',
  zorg: 'stad', apotheek: 'stad',
  juridisch: 'land', financieel: 'land', vastgoed: 'stad',
  jet: 'europa', helikopter: 'europa', charter: 'europa'
};

// het bereik van RTG zelf (reisbureau, eigen-merk): heel Europa, geen adres
const RTG_BEREIK = { soort: 'europa', km: null, label: BEREIKEN.europa.label, aangenomen: false };
// een particuliere advertentie: je haalt hem op in zijn eigen plaats
const MARKT_BEREIK = { soort: 'stad', km: BEREIKEN.stad.km, label: BEREIKEN.stad.label, aangenomen: false };

// "Ibiza-Stad" en "ibiza stad" horen dezelfde plek te zijn
function slugVan(t) {
  return String(t == null ? '' : t).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
}

module.exports = (ctx) => {
  const { haalLandVind } = ctx;

  /* De landbepaling leent de tabel van de Reiswijzer (kern/reis.js), die van
     elke bekende bestemming al weet in welk land hij ligt. Die staat later in
     de opbouw dan de Mall, vandaar de late binding. Is hij er niet, dan blijft
     het land leeg -- de Mall werkt dan gewoon op stadsniveau. Dat mag geen
     stilte zijn: `landbron` zegt of de tabel er was. */
  function landCode(stad, gegeven) {
    if (gegeven) return String(gegeven).toUpperCase().slice(0, 2);
    const vind = typeof haalLandVind === 'function' ? haalLandVind() : null;
    return (vind && stad) ? vind(stad) : null;
  }
  const landbron = () => (typeof haalLandVind === 'function' && !!haalLandVind());

  /* Een plek uit losse gegevens. `punt` mag een {lat,lng} zijn of ontbreken;
     zonder punt kan er geen afstand worden gerekend en valt de plek terug op
     naam-vergelijking, wat voor een marktplaats-advertentie ("Amsterdam-West")
     precies goed genoeg is. */
  function plekVan({ stad, land, punt, label } = {}) {
    const naam = String(stad == null ? '' : stad).replace(/[<>]/g, '').trim().slice(0, 60);
    const p = punt && Number.isFinite(punt.lat) && Number.isFinite(punt.lng) ? { lat: punt.lat, lng: punt.lng } : null;
    return {
      stad: naam || null,
      slug: naam ? slugVan(naam) : null,
      land: landCode(naam, land),
      punt: p,
      label: label ? String(label).replace(/[<>]/g, '').trim().slice(0, 80) : null
    };
  }

  /* Het bereik van een zaak: wat de ondernemer zelf instelde, anders wat zijn
     genre meebrengt, anders "op locatie". Een zelf ingestelde straal mag een
     eigen aantal kilometers hebben (de bezorgradius van 6 km, het werkgebied
     van 30). */
  function bereikVan(s) {
    const eigen = s && s.mall && s.mall.bereik;
    const soort = eigen && BEREIK_IDS.includes(eigen.soort) ? eigen.soort
      : (GENRE_BEREIK[s && s.type] || 'adres');
    const std = BEREIKEN[soort];
    const km = (eigen && Number.isFinite(Number(eigen.km))) ? Math.max(0, Math.min(2000, Number(eigen.km)))
      : std.km;
    return { soort, km, label: std.label, aangenomen: !(eigen && BEREIK_IDS.includes(eigen.soort)) };
  }

  /* Bedient dit aanbod de gekozen plek? Vier manieren, van hard naar ruim:
       1. zelfde stad          -- altijd raak
       2. binnen de straal     -- alleen als beide punten bekend zijn
       3. zelfde land          -- bij bereik 'land'
       4. europa / online      -- overal raak
     Zonder gekozen plek is alles raak; de Mall filtert dan niet op locatie. */
  function bedient(a, plek) {
    if (!plek || !plek.slug) return true;
    if (a.plek.slug && a.plek.slug === plek.slug) return true;
    const b = a.bereik || { soort: 'adres', km: 0 };
    if (b.soort === 'europa' || b.soort === 'online') return true;
    if (b.soort === 'land') return !!(a.plek.land && plek.land && a.plek.land === plek.land);
    if (b.km && a.plek.punt && plek.punt) {
      const m = haversine(a.plek.punt, plek.punt);
      return m != null && m <= b.km * 1000;
    }
    return false;
  }

  // afstand in meters tussen een aanbod en een punt; null als een van beide ontbreekt
  function afstandTot(a, punt) {
    if (!punt || !a.plek.punt) return null;
    return haversine(a.plek.punt, punt);
  }

  /* De plekkenlijst, afgeleid uit het aanbod dat er is. Een stad komt in de
     lijst zodra er iets staat; het punt is het gemiddelde van de bekende
     punten daar, zodat "binnen 10 km van Ibiza" ook werkt als de bezoeker
     zelf geen GPS deelt. */
  function plekkenUit(lijst) {
    const per = new Map();
    for (const a of lijst) {
      if (!a.plek.slug) continue;
      if (!per.has(a.plek.slug)) per.set(a.plek.slug, { slug: a.plek.slug, stad: a.plek.stad, land: a.plek.land, aantal: 0, punten: [] });
      const p = per.get(a.plek.slug);
      p.aantal++;
      if (a.plek.punt) p.punten.push(a.plek.punt);
      if (!p.land && a.plek.land) p.land = a.plek.land;
    }
    return [...per.values()].map(p => ({
      slug: p.slug, stad: p.stad, land: p.land, aantal: p.aantal,
      punt: p.punten.length ? {
        lat: p.punten.reduce((n, x) => n + x.lat, 0) / p.punten.length,
        lng: p.punten.reduce((n, x) => n + x.lng, 0) / p.punten.length
      } : null
    })).sort((a, b) => b.aantal - a.aantal || a.stad.localeCompare(b.stad));
  }

  const api = { plekVan, bereikVan, bedient, afstandTot, plekkenUit, slugVan, landbron,
    BEREIKEN, BEREIK_IDS, GENRE_BEREIK, RTG_BEREIK, MARKT_BEREIK };
  ctx.plek = api;
  return api;
};

module.exports.BEREIKEN = BEREIKEN;
module.exports.BEREIK_IDS = BEREIK_IDS;
module.exports.GENRE_BEREIK = GENRE_BEREIK;
module.exports.slugVan = slugVan;
