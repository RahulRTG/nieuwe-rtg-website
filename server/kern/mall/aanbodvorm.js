/* RTG Mall, deelbestand "aanbodvorm": DE VORM VAN HET UNIVERSELE AANBOD.

   Pure data en een pure functie: welke typen aanbod er bestaan, welke
   verdiepingen de Mall heeft, en op welke verdieping een genre landt. Staat
   los van de database zodat een scherm, een toets of een ander domein de vorm
   kan lezen zonder de hele Mall op te bouwen.

   De TYPEN zijn wat de gebruiker DOET, niet wat de aanbieder IS. Een
   sportschool kan tegelijk producten, lessen, abonnementen en events hebben;
   dat zijn vier aanbod-objecten onder een bedrijfsprofiel, geen vier
   bedrijven. `cta` is de knoptekst die erbij hoort: de ervaring blijft RTG,
   maar "Kopen" en "Offerte aanvragen" zijn niet hetzelfde en mogen er ook
   niet hetzelfde uitzien. */
const TYPEN = {
  product:     { label: 'Product',      cta: 'Kopen' },
  dienst:      { label: 'Dienst',       cta: 'Afspraak maken' },
  boeking:     { label: 'Reservering',  cta: 'Reserveren' },
  huur:        { label: 'Huur',         cta: 'Huren' },
  ticket:      { label: 'Ticket',       cta: 'Tickets' },
  reis:        { label: 'Reis',         cta: 'Reis aanvragen' },
  verblijf:    { label: 'Verblijf',     cta: 'Boeken' },
  eten:        { label: 'Eten',         cta: 'Reserveren' },
  vervoer:     { label: 'Vervoer',      cta: 'Aanvragen' },
  marktplaats: { label: 'Marktplaats',  cta: 'Bekijken' },
  abonnement:  { label: 'Abonnement',   cta: 'Aanmelden' },
  offerte:     { label: 'Op aanvraag',  cta: 'Offerte aanvragen' }
};

/* De verdiepingen. Geen harde silo's: een zoekopdracht mag er dwars doorheen
   ("romantisch Ibiza" is hotel + restaurant + boot + spa). Ze bestaan om de
   Mall zonder zoekopdracht overzichtelijk te houden. */
const VERDIEPINGEN = [
  { id: 'eten',       label: 'Eten',              icon: 'bord' },
  { id: 'winkelen',   label: 'Winkelen',          icon: 'store' },
  { id: 'reizen',     label: 'Reizen',            icon: 'maison' },
  { id: 'uitgaan',    label: 'Er op uit',         icon: 'ticket' },
  { id: 'mobiliteit', label: 'Vervoer',           icon: 'taxi' },
  { id: 'beauty',     label: 'Beauty & wellness', icon: 'beauty' },
  { id: 'diensten',   label: 'Diensten',          icon: 'gereedschap' },
  { id: 'sport',      label: 'Sport',             icon: 'sport' },
  { id: 'zorg',       label: 'Zorg',              icon: 'zorg' },
  { id: 'wonen',      label: 'Wonen',             icon: 'wonen' },
  { id: 'leren',      label: 'Leren',             icon: 'reisboek' }
];
const VERDIEPING_IDS = VERDIEPINGEN.map(v => v.id);

/* Welk genre op welke verdieping landt. Wat hier niet staat valt terug op de
   verdieping van zijn TYPE, zodat een nieuw genre nooit uit de Mall verdwijnt
   maar hooguit grover wordt ingedeeld. */
const GENRE_VERDIEPING = {
  restaurant: 'eten', koffie: 'eten', chef: 'eten', boerderij: 'eten', bezorg: 'eten',
  retail: 'winkelen', juwelier: 'winkelen', galerie: 'winkelen', groothandel: 'winkelen',
  hotel: 'reizen', apartment: 'reizen', villa: 'reizen', resort: 'reizen',
  jet: 'reizen', helikopter: 'reizen', activiteit: 'reizen',
  bar: 'uitgaan', club: 'uitgaan', beachclub: 'uitgaan', events: 'uitgaan', theater: 'uitgaan',
  taxi: 'mobiliteit', verhuur: 'mobiliteit', tweewielers: 'mobiliteit', charter: 'mobiliteit',
  wellness: 'beauty', beauty: 'beauty', kapper: 'beauty',
  zzp: 'diensten', bouw: 'diensten', juridisch: 'diensten', financieel: 'diensten',
  sportclub: 'sport', sport: 'sport',
  zorg: 'zorg', huisarts: 'zorg', tandarts: 'zorg', apotheek: 'zorg',
  vastgoed: 'wonen', makelaar: 'wonen',
  school: 'leren', opleider: 'leren'
};
const TYPE_VERDIEPING = {
  reis: 'reizen', verblijf: 'reizen', eten: 'eten', vervoer: 'mobiliteit',
  ticket: 'uitgaan', marktplaats: 'winkelen', product: 'winkelen',
  huur: 'mobiliteit', dienst: 'diensten', boeking: 'diensten',
  abonnement: 'diensten', offerte: 'diensten'
};

const verdiepingVan = (genre, type) => GENRE_VERDIEPING[genre] || TYPE_VERDIEPING[type] || 'diensten';

module.exports = { TYPEN, VERDIEPINGEN, VERDIEPING_IDS, GENRE_VERDIEPING, TYPE_VERDIEPING, verdiepingVan };
