/* De eigenaar van het RTG-platform: één bron van waarheid.

   De eigenaar (Rahul Imran Ismail) heeft overal toegang tot de BEHEER-omgevingen:
   - de technische pagina (zekeringen, functieschakelaars, beveiliging);
   - de RTG-Backoffice (met zijn eigen accountlogin, zonder aparte code);
   - alle openbare/geaggregeerde bedrijfsdata.

   Behalve de dingen die juridisch NIET mogen, ook niet voor de eigenaar. Deze
   grenzen zijn geen instelling maar principe (AVG/GDPR-doelbinding en
   kinderbescherming), en er is daarom nergens een eigenaar-achterdeur naar:
   - de besloten sociale laag van kinderen t/m 15 (privéberichten, contacten);
   - privé-DM's en privékanalen tussen leden onderling of ouders<->leraar;
   - de RUWE identiteitsbewijzen buiten het KYC-verificatiedoel;
   - het platte wachtwoord van wie dan ook.
   Zie GRENZEN hieronder; die worden door de code van iedereen afgedwongen,
   dus een eigenaar-token opent ze niet alsnog. */

/* Het startadres: de omgevingsvariabele wint, anders de ingebouwde standaard.
   Dit is waar het platform mee opstart als er nog niets is overgedragen. */
const OWNER_EMAIL = (process.env.RTG_OWNER_EMAIL || 'roellie.i@gmail.com').trim().toLowerCase();

/* Het eigenaarschap is overdraagbaar vanuit de boardroom. De gekozen opvolger
   staat in de database; bij het opstarten zet server.js hem hier neer, zodat
   ELKE plek die isEigenaar() gebruikt meteen meebeweegt. Dat is belangrijker
   dan het lijkt: zou alleen de technische pagina de nieuwe eigenaar kennen en
   de hoofdzekering niet, dan zou de oude eigenaar er stilletjes nog doorheen
   komen. Eén bron van waarheid, dus ook bij een wisseling. */
let overgedragen = null;

function eigenaarEmail() { return overgedragen || OWNER_EMAIL; }

/* Zet de eigenaar. Geeft het genormaliseerde adres terug, of null als het geen
   bruikbaar adres is; de aanroeper hoort dan niets te wijzigen. De controle of
   er ook echt een account achter zit hoort bij de route, want daar zit de
   accounts-laag. */
function zetEigenaarEmail(email) {
  const schoon = String(email || '').trim().toLowerCase();
  if (!schoon || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(schoon)) return null;
  overgedragen = schoon;
  return schoon;
}

// De juridische grenzen, expliciet, zodat ze niet per ongeluk wegzakken.
const GRENZEN = [
  'Besloten sociale laag t/m 15 jaar: privéberichten en contacten van beschermde kinderen zijn voor niemand in te zien, ook niet voor de eigenaar.',
  'Privé tussen personen: 1-op-1 DM\'s tussen leden en het privékanaal ouders<->leraar blijven privé; er is geen beheer-inzage.',
  'Identiteitsbewijzen: alleen zichtbaar binnen het KYC-verificatiedoel (backoffice-verificatie), niet als algemene inzage.',
  'Wachtwoorden: worden alleen als hash bewaard; niemand, ook de eigenaar niet, kan een plat wachtwoord opvragen.'
];

/* Is dit accountobject de eigenaar? Vergelijkt op e-mailadres via de kluis
   (accounts.emailOf), zodat het ook klopt als de naam versleuteld is. Leest het
   adres via eigenaarEmail(), dus een overdracht telt hier onmiddellijk. */
function isEigenaar(accounts, user) {
  if (!user) return false;
  try {
    const email = (accounts.emailOf(user) || '').trim().toLowerCase();
    return !!email && email === eigenaarEmail();
  } catch (e) { return false; }
}

module.exports = { OWNER_EMAIL, GRENZEN, isEigenaar, eigenaarEmail, zetEigenaarEmail };
