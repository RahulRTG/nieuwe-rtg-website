/* Mobility OS (datamodule): de catalogus van vervoersmodules.

   DE ONTWERPKEUZE VAN DEZE HELE KERN STAAT HIER. Elk vervoerstype is een
   aan- of uitzetbare module, maar alle modules gebruiken dezelfde ritten-,
   gebruikers-, locatie-, veiligheids- en betaalkern. Zonder dit register is
   "modulair" een woord in een document; hiermee is het een schakelaar die
   iets doet.

   laag 'voorziening' = iets waar producten op leunen (nooit zelf te boeken);
   laag 'product' = een vervoersvorm die een reiziger kiest.
   standaard = de stand zodra er niets is ingesteld.

   De schakelaarlogica (niveaus, afhankelijkheden, uitrol) staat in
   ./register.js; hier staat alleen wat er te schakelen valt. */

const MODULES = [
  // ---- voorzieningen ----
  { id: 'wallet_payments', laag: 'voorziening', naam: 'Betalen uit de wallet', standaard: true, vereist: [],
    uitleg: 'RTG Pay met autolaad; de betaalkern die elk product deelt.' },
  { id: 'cash_payments', laag: 'voorziening', naam: 'Contant betalen', standaard: false, vereist: [],
    uitleg: 'Contant afrekenen bij de chauffeur. Uit tenzij een vervoerder het aanzet.' },
  { id: 'charter_payments', laag: 'voorziening', naam: 'Charterafrekening', standaard: false, vereist: ['wallet_payments'],
    uitleg: 'Aanbetaling, restbetaling en annuleringsstaffel voor charters.' },
  { id: 'identity_verification', laag: 'voorziening', naam: 'Identiteitscontrole', standaard: true, vereist: [],
    uitleg: 'Geverifieerd paspoort van de reiziger; nodig zodra bemanning een namenlijst moet aanleveren.' },
  { id: 'partner_contracts', laag: 'voorziening', naam: 'Partnercontracten', standaard: false, vereist: [],
    uitleg: 'Een getekende overeenkomst met de exploitant. Zonder contract geen aanbod van derden.' },
  { id: 'manual_approval', laag: 'voorziening', naam: 'Menselijke bevestiging', standaard: true, vereist: [],
    uitleg: 'Een mens bevestigt de boeking. Nooit automatisch weg te nemen door de AI.' },
  { id: 'weather_validation', laag: 'voorziening', naam: 'Weertoets', standaard: false, vereist: [],
    uitleg: 'Vertrek toetsen aan weersminima. Verplicht onder alles wat vliegt of vaart.' },

  // ---- producten ----
  { id: 'ride_hailing', laag: 'product', naam: 'Directe rit', standaard: true, vereist: ['wallet_payments'],
    uitleg: 'Nu een wagen bestellen. Het eerste product; alles hieronder bouwt erop.' },
  { id: 'scheduled_rides', laag: 'product', naam: 'Vooraf boeken', standaard: true, vereist: ['ride_hailing'],
    uitleg: 'Een rit voor later, met of zonder terugrit.' },
  { id: 'shared_rides', laag: 'product', naam: 'Gedeelde rit', standaard: false, vereist: ['ride_hailing'],
    uitleg: 'Meerdere reizigers in een voertuig, met zitplaats.' },
  { id: 'business_accounts', laag: 'product', naam: 'Zakelijke accounts', standaard: true, vereist: ['ride_hailing'],
    uitleg: 'Bedrijven met medewerkers, kostenplaatsen, budgetten en maandfacturen.' },
  { id: 'corporate_shuttles', laag: 'product', naam: 'Bedrijfspendel', standaard: true, vereist: ['business_accounts', 'scheduled_rides'],
    uitleg: 'Een vaste dienstregeling tussen twee punten, automatisch tot ritten gemaakt.' },
  { id: 'public_transport_planner', laag: 'product', naam: 'OV-reisplanner', standaard: true, vereist: [],
    uitleg: 'Lijnen, haltes en live posities tonen en in een reis combineren. Verkoopt geen kaartje.' },
  { id: 'public_transport_ticketing', laag: 'product', naam: 'OV-kaartverkoop', standaard: false,
    vereist: ['public_transport_planner', 'partner_contracts', 'wallet_payments'],
    uitleg: 'Een geldig vervoerbewijs uitgeven. Kan alleen met een overeenkomst met de vervoerder: dat besluit je niet zelf.' },
  { id: 'wheelchair_transport', laag: 'product', naam: 'Rolstoelvervoer', standaard: true, vereist: ['ride_hailing'],
    uitleg: 'Ritten die een rolstoeltoegankelijk voertuig eisen.' },
  { id: 'school_transport', laag: 'product', naam: 'Schoolvervoer', standaard: false, vereist: ['scheduled_rides', 'identity_verification'],
    uitleg: 'Vaste ritten met kinderen; bevoegdheid van de chauffeur is een harde eis.' },
  { id: 'medical_transport', laag: 'product', naam: 'Medisch en begeleid vervoer', standaard: false, vereist: ['scheduled_rides', 'identity_verification'],
    uitleg: 'Zittend ziekenvervoer en begeleiding.' },
  { id: 'event_transport', laag: 'product', naam: 'Evenementenvervoer', standaard: false, vereist: ['scheduled_rides'],
    uitleg: 'Pendels rond een evenement, met capaciteit per rit.' },
  { id: 'boat_transport', laag: 'product', naam: 'Watertaxi en boot', standaard: false, vereist: ['partner_contracts', 'manual_approval', 'weather_validation'],
    uitleg: 'Vervoer over water door een gecertificeerde schipper.' },
  { id: 'helicopter_charter', laag: 'product', naam: 'Helikoptercharter', standaard: false,
    vereist: ['identity_verification', 'partner_contracts', 'manual_approval', 'weather_validation', 'charter_payments'],
    uitleg: 'Op aanvraag, via een exploitant met een geldige vergunning. RTG vliegt niet zelf.' },
  { id: 'aircraft_charter', laag: 'product', naam: 'Vliegtuigcharter', standaard: false,
    vereist: ['identity_verification', 'partner_contracts', 'manual_approval', 'weather_validation', 'charter_payments'],
    uitleg: 'Klein chartervliegtuig of privejet, via een exploitant met een AOC.' },
  { id: 'experience_transport', laag: 'product', naam: 'Bijzonder vervoer (ervaring)', standaard: false, vereist: ['partner_contracts', 'manual_approval'],
    uitleg: 'Oldtimer, tuktuk, paard en wagen: je boekt een ervaring, geen verplaatsing.' },
  { id: 'driver_tipping', laag: 'product', naam: 'Fooi', standaard: true, vereist: ['wallet_payments'],
    uitleg: 'Fooi gaat volledig naar de chauffeur.' },
  { id: 'subscriptions', laag: 'product', naam: 'Vervoersabonnementen', standaard: false, vereist: ['wallet_payments'],
    uitleg: 'Een vast maandbedrag in plaats van per rit.' },
  /* surge_pricing staat er wel en staat UIT, en dat is geen slordigheid.
     Kunstmatige schaarste omzetten in een hogere prijs is precies het patroon
     dat CLAUDE.md verbiedt. Hij staat in het register omdat een vervoerder in
     een ander land een spitstoeslag mag kennen die daar gewoon is -- dan is
     het een besluit met een naam en een datum, en geen stille standaard. */
  { id: 'surge_pricing', laag: 'product', naam: 'Spitstoeslag', standaard: false, vereist: ['ride_hailing'],
    uitleg: 'Hoger tarief bij drukte. Staat uit: RTG rekent geen schaarstepremie.' }
];

const OP_ID = Object.fromEntries(MODULES.map(m => [m.id, m]));

/* Fail-fast bij het opstarten, in de geest van de functiecatalogus: een dubbele
   id, een verwijzing naar een module die niet bestaat, en een kring van modules
   die op elkaar wachten. Alle drie leveren ze anders een schakelaar op die stil
   nooit aan te krijgen is -- de duurste soort, want er klaagt niets. */
if (Object.keys(OP_ID).length !== MODULES.length) {
  const gezien = new Set();
  throw new Error('mobiliteit/modulecatalogus: dubbele id(s): ' +
    MODULES.map(m => m.id).filter(id => gezien.has(id) || !gezien.add(id)).join(', '));
}
for (const m of MODULES)
  for (const v of m.vereist)
    if (!OP_ID[v]) throw new Error('mobiliteit/modulecatalogus: ' + m.id + ' vereist onbekende module ' + v);
(function geenKring() {
  const staat = {};                                  // 0 = ongezien, 1 = op de stapel, 2 = klaar
  const loop = (id, pad) => {
    if (staat[id] === 2) return;
    if (staat[id] === 1) throw new Error('mobiliteit/modulecatalogus: kring in de vereisten: ' + pad.concat(id).join(' -> '));
    staat[id] = 1;
    for (const v of OP_ID[id].vereist) loop(v, pad.concat(id));
    staat[id] = 2;
  };
  for (const m of MODULES) loop(m.id, []);
})();

// de niveaus, van grof naar fijn; het FIJNSTE dat iets zegt wint
const NIVEAUS = [
  { sleutel: 'landen', ctx: 'land' },
  { sleutel: 'steden', ctx: 'stad' },
  { sleutel: 'groepen', ctx: 'groep' },
  { sleutel: 'orgs', ctx: 'org' },
  { sleutel: 'vervoerders', ctx: 'vervoerder' }
];

module.exports = { MODULES, OP_ID, NIVEAUS };
