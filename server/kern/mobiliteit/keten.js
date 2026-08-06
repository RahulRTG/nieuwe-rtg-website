/* Mobility OS (datamodule): de statusketen van een vervoersopdracht, de
   uitzonderingen erbuiten, en de gebeurtenisnamen.

   EEN KETEN VOOR ALLE VERVOERSTYPEN. Een taxirit, een pendelbus, een
   veerboot en een helikoptertransfer doorlopen dezelfde stappen; alleen de
   duur en de bemanning verschillen. Daarom is dit een tabel en geen
   if/else per soort: een nieuw vervoerstype erbij hoeft de dispatch, de
   meldingen en het grootboek niets nieuws te leren.

   WAAROM DE OVERGANGEN HIER STAAN EN NIET IN DE ROUTE. Een status die je
   van buitenaf op elke waarde mag zetten is geen status maar een tekstveld.
   Dan kan een voertuig 'voltooid' worden zonder ooit 'ingestapt' te zijn
   geweest -- en daar hangt geld aan, want afrekenen kijkt naar diezelfde
   waarde. VOLGENDE zegt per stap wat er daarna mag, en niets anders mag.

   DE UITZONDERINGEN ZIJN GEEN STAPPEN. Annulering, no-show, incident en een
   betaalprobleem kunnen bijna altijd gebeuren en leiden nergens heen; ze
   staan daarom naast de keten. Een vervangend voertuig is de enige die
   TERUG gaat: de rit leeft door, alleen met een andere wagen. */

// de hoofdketen, in volgorde
const KETEN = ['aangevraagd', 'geprijsd', 'aangeboden', 'geaccepteerd', 'onderweg',
  'aangekomen', 'ingestapt', 'rijdt', 'voltooid', 'afgerekend'];

// uitzonderingsstatussen: buiten de keten, met een eigen betekenis
const UITZONDERINGEN = {
  geannuleerd: { naam: 'Geannuleerd', eind: true },
  'no-show': { naam: 'Reiziger niet verschenen', eind: true },
  incident: { naam: 'Incident', eind: false },
  'vervangend-voertuig': { naam: 'Vervangend voertuig onderweg', eind: false },
  betaalprobleem: { naam: 'Betaling mislukt', eind: false }
};

/* Wat mag er na deze status? Alleen wat hier staat. De uitzonderingen die
   overal mogen (annuleren, incident) worden apart bijgeschreven, zodat de
   tabel leesbaar blijft. */
const VOLGENDE = {
  aangevraagd: ['geprijsd', 'geannuleerd'],
  geprijsd: ['aangeboden', 'geannuleerd', 'betaalprobleem'],
  aangeboden: ['geaccepteerd', 'aangevraagd', 'geannuleerd'],     // terug naar aangevraagd = geweigerd, opnieuw aanbieden
  geaccepteerd: ['onderweg', 'geannuleerd', 'vervangend-voertuig'],
  onderweg: ['aangekomen', 'geannuleerd', 'vervangend-voertuig', 'incident'],
  aangekomen: ['ingestapt', 'no-show', 'geannuleerd', 'incident'],
  ingestapt: ['rijdt', 'incident'],
  rijdt: ['voltooid', 'incident'],
  voltooid: ['afgerekend', 'betaalprobleem'],
  afgerekend: [],
  // vanuit de uitzonderingen terug de keten in
  incident: ['rijdt', 'voltooid', 'geannuleerd'],
  'vervangend-voertuig': ['geaccepteerd', 'geannuleerd'],
  betaalprobleem: ['afgerekend', 'geannuleerd'],
  geannuleerd: [],
  'no-show': ['afgerekend']                                        // een no-show mag wel een annuleringsvergoeding kosten
};

/* De melding aan de reiziger per status. Ontbreekt er een, dan valt de
   melder terug op een neutrale zin -- nooit op de kale statusnaam, want
   'no-show' is geen Nederlands. */
const MELDING = {
  geprijsd: 'De prijs van uw rit staat vast.',
  aangeboden: 'We zoeken een chauffeur voor u.',
  geaccepteerd: 'Uw rit is bevestigd.',
  onderweg: 'Uw chauffeur is onderweg naar u.',
  aangekomen: 'Uw chauffeur staat voor.',
  ingestapt: 'Welkom aan boord.',
  rijdt: 'Goede reis.',
  voltooid: 'U bent gearriveerd. Dank voor het reizen met RTG.',
  afgerekend: 'De rit is afgerekend.',
  geannuleerd: 'De rit is geannuleerd.',
  'no-show': 'De chauffeur heeft gewacht maar niemand aangetroffen.',
  incident: 'Er is iets voorgevallen tijdens uw rit. Wij nemen contact op.',
  'vervangend-voertuig': 'Er komt een vervangend voertuig naar u toe.',
  betaalprobleem: 'De betaling lukte niet. Controleer uw wallet.'
};

/* De gebeurtenissen. Deze namen staan bewust in het Engels en in de
   punt-vorm: ze zijn het contract waar taxi, bedrijfsvervoer en later OV
   allemaal op aanhaken, en ze gaan ooit de deur uit naar een partner via
   een webhook. Alles wat naar buiten gaat verandert niet meer zomaar. */
const GEBEURTENIS = {
  aangevraagd: 'ride.requested',
  geprijsd: 'ride.priced',
  aangeboden: 'ride.offered',
  geaccepteerd: 'ride.accepted',
  onderweg: 'driver.en_route',
  aangekomen: 'driver.arrived',
  ingestapt: 'passenger.onboard',
  rijdt: 'trip.started',
  voltooid: 'trip.completed',
  afgerekend: 'payment.settled',
  geannuleerd: 'ride.cancelled',
  'no-show': 'passenger.no_show',
  incident: 'safety.alert_created',
  'vervangend-voertuig': 'vehicle.replaced',
  betaalprobleem: 'payment.failed'
};

// deze twee mogen vanuit vrijwel elke levende status
const ALTIJD = ['geannuleerd', 'incident'];
const EIND = new Set(['afgerekend', 'geannuleerd']);

/* Mag deze overgang? Geeft een reden terug bij nee: een dispatcher die een
   knop indrukt hoort te lezen waarom er niets gebeurt. */
function magNaar(van, naar) {
  if (!GEBEURTENIS[naar]) return { mag: false, reden: 'onbekende status ' + naar };
  if (EIND.has(van)) return { mag: false, reden: 'de rit is al ' + van };
  const toegestaan = (VOLGENDE[van] || []).concat(ALTIJD.includes(naar) ? [naar] : []);
  if (!toegestaan.includes(naar))
    return { mag: false, reden: 'van "' + van + '" kan het niet naar "' + naar + '" (wel: ' + (VOLGENDE[van] || []).join(', ') + ')' };
  return { mag: true };
}

module.exports = { KETEN, UITZONDERINGEN, VOLGENDE, MELDING, GEBEURTENIS, ALTIJD, EIND, magNaar };
