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

const OWNER_EMAIL = (process.env.RTG_OWNER_EMAIL || 'roellie.i@gmail.com').trim().toLowerCase();

// De juridische grenzen, expliciet, zodat ze niet per ongeluk wegzakken.
const GRENZEN = [
  'Besloten sociale laag t/m 15 jaar: privéberichten en contacten van beschermde kinderen zijn voor niemand in te zien, ook niet voor de eigenaar.',
  'Privé tussen personen: 1-op-1 DM\'s tussen leden en het privékanaal ouders<->leraar blijven privé; er is geen beheer-inzage.',
  'Identiteitsbewijzen: alleen zichtbaar binnen het KYC-verificatiedoel (backoffice-verificatie), niet als algemene inzage.',
  'Wachtwoorden: worden alleen als hash bewaard; niemand, ook de eigenaar niet, kan een plat wachtwoord opvragen.'
];

/* Is dit accountobject de eigenaar? Vergelijkt op e-mailadres via de kluis
   (accounts.emailOf), zodat het ook klopt als de naam versleuteld is. */
function isEigenaar(accounts, user) {
  if (!user) return false;
  try {
    const email = (accounts.emailOf(user) || '').trim().toLowerCase();
    return !!email && email === OWNER_EMAIL;
  } catch (e) { return false; }
}

module.exports = { OWNER_EMAIL, GRENZEN, isEigenaar };
