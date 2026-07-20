/* Functieschakelaars, deel "doelgroepen" (server/functies/register): de
   categorieen, de doelgroepen (wie een functie kan gebruiken) en de handige
   groepen leden. Pure config; de catalogus (./cat-*) leunt op de leden-groepen
   en de motor (functies/toegang.js) op de doelgroepen. Afgesplitst uit
   register.js zodat de catalogus en de validatie dun blijven. */
const CATEGORIEEN = [
  'Leden (RTG-app)',
  'Genres & diensten',
  'Sociaal (De Salon)',
  'Eigen apps',
  'Partners (leveranciers)',
  'RTG-Backoffice',
  'RTFoundation',
  'Betalen & verificatie',
  'Personeel & integraties'
];

/* De doelgroepen: wie een functie kan gebruiken. Klein en helder gehouden zodat
   de controlekamer niet overweldigt. synoniemen dienen de AI-hulp (vrije taal). */
const DOELGROEPEN = [
  { id: 'rtg',         naam: 'RTG-leden',    emoji: '🟢', kleur: '#3BA55D', uitleg: 'Leden met de RTG Pass.',                              synoniemen: ['rtg', 'rtg-leden', 'rtg leden', 'gewone leden'] },
  { id: 'lifestyle',   naam: 'Lifestyle',    emoji: '🟣', kleur: '#A46BD6', uitleg: 'Leden met de Lifestyle Pass.',                       synoniemen: ['lifestyle', 'lifestyle-leden', 'lifestyle mensen'] },
  { id: 'business',    naam: 'Business',     emoji: '🔵', kleur: '#4B8DC9', uitleg: 'Leden met de Business Pass (zakelijk).',             synoniemen: ['business', 'zakelijk', 'business pass'] },
  { id: 'gast',        naam: 'Gratis app',   emoji: '⚪', kleur: '#8A8680', uitleg: 'De gratis RTG-app, zonder pas (rondkijken en bij partners bestellen).', synoniemen: ['gast', 'gasten', 'gratis', 'gratis app', 'zonder pas', 'free'] },
  { id: 'leverancier', naam: 'Leveranciers', emoji: '🟠', kleur: '#D6A32E', uitleg: 'Partners en hun personeel in de partner-app.',       synoniemen: ['leverancier', 'leveranciers', 'partner', 'partners', 'zaak', 'zaken'] },
  { id: 'personeel',   naam: 'Personeel',    emoji: '🟤', kleur: '#B07B4E', uitleg: 'Medewerkers in de personeels-app (PDA).',            synoniemen: ['personeel', 'medewerker', 'medewerkers', 'pda', 'staff'] },
  { id: 'foundation',  naam: 'Foundation',   emoji: '🎓', kleur: '#5AB4C9', uitleg: 'Gezinnen, leerlingen en scholen in de RTF-app.',     synoniemen: ['foundation', 'rtf', 'rtfoundation', 'school', 'scholen', 'onderwijs', 'gezin', 'gezinnen', 'leerling'] },
  { id: 'intern',      naam: 'RTG intern',   emoji: '⚫', kleur: '#8A8681', uitleg: 'De RTG-backoffice en integraties (intern).',         synoniemen: ['intern', 'backoffice', 'kantoor', 'rtg zelf'] }
];
const DOELGROEP_IDS = DOELGROEPEN.map(d => d.id);
const DOELGROEP_OP_ID = Object.fromEntries(DOELGROEPEN.map(d => [d.id, d]));

// Handige groepen doelgroepen om herhaling te vermijden.
const LEDEN = ['rtg', 'lifestyle', 'business'];
const LEDEN_RTF = ['rtg', 'lifestyle', 'business', 'foundation'];
// mét de gratis app: de functies die ook zonder pas bereikbaar zijn
const LEDEN_GAST = ['rtg', 'lifestyle', 'business', 'gast'];

module.exports = { CATEGORIEEN, DOELGROEPEN, DOELGROEP_IDS, DOELGROEP_OP_ID, LEDEN, LEDEN_RTF, LEDEN_GAST };
