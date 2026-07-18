/* Hoteldorp (deelmodule): de afdelingsdata. De afdelingen met hun ketens,
   de sets per dorpssoort (hotel, club, restaurant, beachclub) en de meters
   per afdeling. Pure data, geen logica. */
const AFDELINGEN = {
  frontoffice: { label: 'Front office', icon: '🛎️', waar: 'Kamer of plek', wat: 'Overdracht of actie, bijv. late check-out geregeld', keten: ['open', 'klaar'] },
  guest: { label: 'Guest manager', icon: '🤝', waar: 'Kamer', wat: 'Voorkeur of bijzonderheid, bijv. verjaardag morgen', keten: ['open', 'opgevolgd'] },
  relations: { label: 'Guest relations', icon: '🌹', waar: 'Kamer of gast', wat: 'Signaal, bijv. klacht over geluid, compliment voor het team', keten: ['gemeld', 'in gesprek', 'opgelost', 'nagebeld'] },
  concierge: { label: 'Concierge', icon: '🎩', waar: 'Kamer', wat: 'Wens van de gast, bijv. tafel voor twee om 21:00', keten: ['open', 'bezig', 'geregeld'] },
  parking: { label: 'Parking', icon: '🚗', waar: 'Plek, bijv. P2-14', wat: 'Auto en kamer, bijv. blauwe Defender, Sea-view suite', keten: ['geparkeerd', 'voorrijden', 'staat voor'] },
  security: { label: 'Security', icon: '🛡️', waar: 'Plek', wat: 'Melding of ronde, bijv. poolronde gelopen', keten: ['gemeld', 'bezig', 'afgehandeld'] },
  gym: { label: 'Gym', icon: '🏋️', waar: 'Toestel of zaal', wat: 'Melding, bijv. loopband 2 piept', keten: ['open', 'klaar'] },
  spa: { label: 'Spa', icon: '💆', waar: 'Tijd en kamer, bijv. 15:00, Garden kamer', wat: 'Behandeling, bijv. massage 60 minuten', keten: ['gepland', 'bezig', 'klaar'] },
  amenities: { label: 'Amenities', icon: '🧴', waar: 'Kamer', wat: 'Aanvulling of attentie, bijv. badjassen maat L, kussenmenu', keten: ['gevraagd', 'onderweg', 'op de kamer'] },
  patissier: { label: 'Patissier', icon: '🍰', waar: 'Voor wanneer en waar, bijv. 19:00, Sea-view suite', wat: 'Bestelling, bijv. verjaardagstaart voor acht', keten: ['besteld', 'in de maak', 'klaar', 'geserveerd'] },
  klussen: { label: 'Klusjesman', icon: '🔧', waar: 'Plek', wat: 'Klus, bijv. lamp op het terras vervangen', keten: ['open', 'bezig', 'klaar'] },
  it: { label: 'IT', icon: '🖥️', waar: 'Systeem of plek', wat: 'Storing, bijv. wifi in de lobby traag', keten: ['open', 'bezig', 'opgelost'] },
  sales: { label: 'Sales', icon: '📈', waar: 'Bedrijf of contact', wat: 'Lead, bijv. bedrijfsuitje twintig personen in september', keten: ['lead', 'offerte', 'gewonnen'] },
  events: { label: 'Events', icon: '🎪', waar: 'Datum en zaal', wat: 'Aanvraag, bijv. bruiloft 12 september, tachtig gasten', keten: ['aanvraag', 'voorstel', 'bevestigd', 'gedraaid'] },
  florist: { label: 'Florist', icon: '💐', waar: 'Waar het komt te staan', wat: 'Bestelling, bijv. boeket lobby en tafelstukken terras', keten: ['besteld', 'gemaakt', 'geplaatst'] },
  kidsclub: { label: 'Kids club', icon: '🧸', waar: 'Kind en kamer', wat: 'Aanmelding, bijv. Mia (6), Garden kamer, tot 16:00', keten: ['aangemeld', 'binnen', 'opgehaald'] },
  watersport: { label: 'Watersport', icon: '🏄', waar: 'Wie en wat', wat: 'Boeking, bijv. twee paddleboards, 14:00', keten: ['geboekt', 'op het water', 'terug'] },
  // het clubdorp: de nachtzaak van deur tot kantoor
  entree: { label: 'Entree & deur', icon: '🚪', waar: 'Naam of groep', wat: 'Gastenlijst of deur, bijv. groep van zes, tafel Marbella', keten: ['op de lijst', 'aan de deur', 'binnen'] },
  garderobe: { label: 'Garderobe', icon: '🧥', waar: 'Nummer, bijv. 214', wat: 'Wat er hangt, bijv. jas en helm', keten: ['in bewaring', 'opgehaald'] },
  bar: { label: 'Bar', icon: '🍸', waar: 'Station, bijv. bar links', wat: 'Wat er nodig is, bijv. ijs en limoenen aanvullen', keten: ['gevraagd', 'bezig', 'klaar'] },
  vip: { label: 'VIP & tafels', icon: '🍾', waar: 'Tafel, bijv. booth 3', wat: 'Reservering of fles, bijv. tafel voor acht, magnum om 01:00', keten: ['aangevraagd', 'bevestigd', 'zit', 'afgerekend'] },
  dj: { label: 'DJ & muziek', icon: '🎧', waar: 'Set of moment', wat: 'Verzoek of wissel, bijv. verzoekje verjaardag om 00:30', keten: ['in de wachtrij', 'gedraaid'] },
  techniek: { label: 'Licht & geluid', icon: '🎛️', waar: 'Plek of toestel', wat: 'Storing, bijv. spot boven de vloer valt uit', keten: ['gemeld', 'bezig', 'verholpen'] },
  vloer: { label: 'Vloer & runners', icon: '🧹', waar: 'Plek', wat: 'Melding, bijv. glaswerk bij de dansvloer ophalen', keten: ['gemeld', 'bezig', 'klaar'] },
  promo: { label: 'Promo & marketing', icon: '📣', waar: 'Kanaal of avond', wat: 'Actie, bijv. story met de line-up van vrijdag', keten: ['idee', 'gepland', 'live', 'afgerond'] },
  inkoop: { label: 'Inkoop & voorraad', icon: '📦', waar: 'Leverancier of product', wat: 'Bestelling, bijv. tien kratten cava bijbestellen', keten: ['besteld', 'onderweg', 'binnen'] },
  kantoor: { label: 'Kantoor & administratie', icon: '🗂️', waar: 'Map of onderwerp', wat: 'Taak, bijv. facturen van het weekend inboeken', keten: ['open', 'bezig', 'afgehandeld'] },
  // het restaurantdorp: van het boek tot de pas
  host: { label: 'Host & reserveringen', icon: '📖', waar: 'Tijd en gezelschap', wat: 'Reservering of ontvangst, bijv. 20:00, vier personen, raamtafel', keten: ['gereserveerd', 'ontvangen', 'aan tafel'] },
  bediening: { label: 'Bediening', icon: '🤵', waar: 'Tafel', wat: 'Wens of signaal, bijv. tafel 4 vraagt de kaart nog een keer', keten: ['gevraagd', 'bezig', 'geserveerd'] },
  keuken: { label: 'Keuken', icon: '🔪', waar: 'Sectie of gerecht', wat: 'Doorgifte, bijv. 86 op de zeebaars, mise en place bijna op', keten: ['gemeld', 'bezig', 'klaar'] },
  // en het strand van de beachclub
  ligbedden: { label: 'Ligbedden & strand', icon: '🏖️', waar: 'Rij en bed, bijv. eerste rij 4', wat: 'Reservering of wens, bijv. twee bedden, champagne-emmer om 15:00', keten: ['gereserveerd', 'bezet', 'vrijgegeven'] }
};

/* Welke afdelingen een zaak ziet: kamers geven het hoteldorp, een nachtzaak
   het clubdorp, een restaurant het restaurantdorp en een beachclub het
   restaurantdorp plus het strand. Security, klussen, IT, sales en events
   zitten overal in: dat werk is overal hetzelfde. */
const HOTEL_SET = ['frontoffice', 'guest', 'relations', 'concierge', 'parking', 'security', 'gym', 'spa', 'amenities', 'patissier', 'klussen', 'it', 'sales', 'events', 'florist', 'kidsclub', 'watersport'];
const CLUB_SET = ['entree', 'garderobe', 'bar', 'vip', 'dj', 'techniek', 'vloer', 'promo', 'security', 'klussen', 'it', 'sales', 'events', 'inkoop', 'kantoor'];
const RESTO_SET = ['host', 'bediening', 'keuken', 'bar', 'vloer', 'promo', 'inkoop', 'kantoor', 'security', 'klussen', 'it', 'sales', 'events'];
const BEACH_SET = [...RESTO_SET, 'ligbedden', 'watersport'];
const CLUB_TYPES = ['bar', 'club'];

const METERS = {
  standaard: { titel: 'Drukte', opties: ['rustig', 'normaal', 'druk'] },
  security: { titel: 'Status', opties: ['kalm', 'let op', 'verhoogd'] },
  it: { titel: 'Systemen', opties: ['alles draait', 'storing', 'onderhoud'] },
  florist: { titel: 'Voorraad', opties: ['gevuld', 'aanvullen', 'op'] },
  amenities: { titel: 'Voorraadkast', opties: ['gevuld', 'aanvullen', 'leeg'] },
  patissier: { titel: 'Vitrine', opties: ['gevuld', 'aanvullen', 'leeg'] },
  sales: { titel: 'Seizoen', opties: ['rustig', 'normaal', 'piek'] },
  events: { titel: 'Seizoen', opties: ['rustig', 'normaal', 'piek'] },
  entree: { titel: 'Rij aan de deur', opties: ['geen rij', 'rij', 'rij tot de hoek'] },
  bar: { titel: 'Voorraad', opties: ['gevuld', 'aanvullen', 'op'] },
  dj: { titel: 'De vloer', opties: ['warmt op', 'goed vol', 'piek'] },
  techniek: { titel: 'Systemen', opties: ['alles draait', 'storing', 'onderhoud'] },
  inkoop: { titel: 'Voorraad', opties: ['gevuld', 'aanvullen', 'op'] },
  promo: { titel: 'Campagne', opties: ['stil', 'loopt', 'piek'] },
  host: { titel: 'Bezetting', opties: ['rustig', 'goed bezet', 'vol'] },
  keuken: { titel: 'De pas', opties: ['rustig', 'loopt', 'vol'] },
  ligbedden: { titel: 'Het strand', opties: ['rustig', 'goed bezet', 'vol'] }
};

module.exports = { AFDELINGEN, HOTEL_SET, CLUB_SET, RESTO_SET, BEACH_SET, CLUB_TYPES, METERS };
