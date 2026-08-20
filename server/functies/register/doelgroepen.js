/* Functieschakelaars, deel "doelgroepen" (server/functies/register): de
   categorieen, de doelgroepen (wie een functie kan gebruiken) en de handige
   groepen leden. Pure config; de catalogus (./cat-*) leunt op de leden-groepen
   en de motor (functies/toegang.js) op de doelgroepen. Afgesplitst uit
   register.js zodat de catalogus en de validatie dun blijven. */
/* De categorieen waarin het bord de functies groepeert.

   LET OP, EN DIT IS EEN GELEERDE LES: het bord toont ALLEEN functies waarvan
   de categorie in deze lijst staat. Toen cat-domeinen.js met eigen categorieen
   werd toegevoegd, stonden er 91 functies in de kast en toonde het bord er 56
   -- geen fout, geen melding, gewoon vijfendertig schakelaars die niemand zag.
   register/index.js faalt daarom nu bij het opstarten op een categorie die
   hier niet staat. */
const CATEGORIEEN = [
  'Leden (RTG-app)',
  'Diensten (leden)',
  'Toegang en identiteit',
  'Genres & diensten',
  'Cultuur en gezelschap',
  'Sociaal (De Salon)',
  'Eigen apps',
  'Winkel en media',
  'Partners (leveranciers)',
  'Werk (zaken en personeel)',
  'RTG-Backoffice',
  'RTFoundation',
  'Identiteit en veiligheid',
  'Betalen & verificatie',
  'Geld',
  'Personeel & integraties'
];

/* De doelgroepen: wie een functie kan gebruiken. Klein en helder gehouden zodat
   de controlekamer niet overweldigt. synoniemen dienen de AI-hulp (vrije taal). */
const DOELGROEPEN = [
  { id: 'rtg',         naam: 'RTG-leden',    emoji: 'cercle', kleur: '#3BA55D', uitleg: 'Leden met de RTG Pass.',                              synoniemen: ['rtg', 'rtg-leden', 'rtg leden', 'gewone leden'] },
  { id: 'lifestyle',   naam: 'Lifestyle',    emoji: 'cercle', kleur: '#A46BD6', uitleg: 'Leden met de Lifestyle Pass.',                       synoniemen: ['lifestyle', 'lifestyle-leden', 'lifestyle mensen'] },
  { id: 'business',    naam: 'Business',     emoji: 'cercle', kleur: '#4B8DC9', uitleg: 'Leden met de Business Pass (zakelijk).',             synoniemen: ['business', 'zakelijk', 'business pass'] },
  { id: 'gast',        naam: 'Gratis app',   emoji: 'cercle', kleur: '#8A8680', uitleg: 'De gratis RTG-app, zonder pas (rondkijken en bij partners bestellen).', synoniemen: ['gast', 'gasten', 'gratis', 'gratis app', 'zonder pas', 'free'] },
  { id: 'leverancier', naam: 'Leveranciers', emoji: 'cercle', kleur: '#D6A32E', uitleg: 'Partners en hun personeel in de partner-app.',       synoniemen: ['leverancier', 'leveranciers', 'partner', 'partners', 'zaak', 'zaken'] },
  { id: 'personeel',   naam: 'Personeel',    emoji: 'cercle', kleur: '#B07B4E', uitleg: 'Medewerkers in de personeels-app (PDA).',            synoniemen: ['personeel', 'medewerker', 'medewerkers', 'pda', 'staff'] },
  { id: 'foundation',  naam: 'Foundation',   emoji: 'diploma', kleur: '#5AB4C9', uitleg: 'Gezinnen, leerlingen en scholen in de RTF-app.',     synoniemen: ['foundation', 'rtf', 'rtfoundation', 'school', 'scholen', 'onderwijs', 'gezin', 'gezinnen', 'leerling'] },
  { id: 'intern',      naam: 'RTG intern',   emoji: 'cercle', kleur: '#8A8680', uitleg: 'De RTG-backoffice en integraties (intern).',         synoniemen: ['intern', 'backoffice', 'kantoor', 'rtg zelf'] }
];
const DOELGROEP_IDS = DOELGROEPEN.map(d => d.id);
const DOELGROEP_OP_ID = Object.fromEntries(DOELGROEPEN.map(d => [d.id, d]));

// Handige groepen doelgroepen om herhaling te vermijden.
const LEDEN = ['rtg', 'lifestyle', 'business'];
const LEDEN_RTF = ['rtg', 'lifestyle', 'business', 'foundation'];
// mét de gratis app: de functies die ook zonder pas bereikbaar zijn
const LEDEN_GAST = ['rtg', 'lifestyle', 'business', 'gast'];
/* WORKOS IS EEN WERELD MET DRIE RELATIES (WERELDEN.md). Een werknemer krijgt de
   werkvloer VIA zijn werkgever, een werkgever KOOPT de werkruimte, en RTG zit er
   als werkgever zelf ook in. Dat zijn geen drie producten maar drie relaties tot
   dezelfde wereld, en het bord hoort ze alle drie apart te kunnen sturen.

   Deze groep stond er niet, en dat was te meten: elf werkfuncties droegen alleen
   `leverancier` en `personeel`, terwijl hun paden geen /api/supplier- of
   /api/staff-prefix hebben. De doelgroep viel dus terug op de PAS -- en een
   partner heeft geen pas. Het gevolg was dat de knop voor die twee groepen niets
   stuurde, en de knop voor een Business-lid helemaal niet bestond. Zie
   functies/doelgroep.js voor de andere helft van die reparatie. */
const WERKOS = ['intern', 'business', 'leverancier', 'personeel'];

module.exports = { CATEGORIEEN, DOELGROEPEN, DOELGROEP_IDS, DOELGROEP_OP_ID, LEDEN, LEDEN_RTF, LEDEN_GAST, WERKOS };
