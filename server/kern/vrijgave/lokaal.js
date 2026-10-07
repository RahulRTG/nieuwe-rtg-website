/* DE LOKALE INSTALLATIE: wanneer een capability zonder vastgelegde stand op
   `sandbox` mag beginnen, en wanneer dat NOOIT mag.

   WAAROM DIT BESTAAT. Een stand die niemand heeft gezet, is `disabled`
   (./register.js veiligeStand). Dat is precies goed voor een server die
   ergens draait waar mensen bij kunnen -- en precies verkeerd voor een
   ontwikkelmachine en de toetsen: daar zou elk lid dat zijn wallet oplaadt een
   "tijdelijk uit" krijgen, en de enige manier om dat te verhelpen was een
   stand aanzetten met een passkey. Een ontwikkelaar die daar geen zin in heeft,
   zoekt een omweg, en de goedkoopste omweg is "zet in dev alles op enabled".
   Dan is uit op een dag aan.

   DE REGEL, en hij is een EN van vier dingen die alle vier uit de OMGEVING komen
   en geen enkele uit een verzoek of uit het standbestand:

     1. NODE_ENV is `test` of `development` (niet gezet telt als development,
        precies zoals ../../config/omgeving.js het definieert). `production` --
        of iets anders -- en de regel bestaat niet.
     2. De installatie is NIET aantoonbaar openbaar (../../config/openbaar.js).
     3. Ze is aantoonbaar lokaal (../../config/omgeving.js `bewezenLokaal`), OF
        ze luistert op de loopback zonder een poortwachter ervoor (dezelfde
        `bindBesluit` die de luisteraar gebruikt -- een tweede lezing van "waar
        luister ik" zou binnen een jaar uiteenlopen met de echte).
     4. Er is voor DEZE capability niets vastgelegd. Wat een mens heeft gezet,
        geldt -- ook lokaal, en ook als het `disabled` is.

   WAT `sandbox` DAN BETEKENT, en dat is weinig: alleen op een rail zonder echt
   geld (./register.js NEPRAILS, plus lokaal het gesloten interne grootboek
   `intern`). Een echte provider (stripe, mollie, adyen, stripe_connect) is
   NOOIT een neprail, lokaal of niet -- ./registerkeur.js zakt als iemand er een
   op de lijst zet.

   WAT NOOIT MAG: een `sandbox` in productie of op een openbaar adres, ook niet
   als het standbestand hem noemt. `sandboxMag()` hieronder is daarom een eigen
   vraag naast `lokaleInstallatie()`: een uitdrukkelijk gezette sandbox mag op
   een besloten proefinstallatie (development op een privaat netwerk), maar
   nooit waar NODE_ENV production zegt -- ook niet als APP_URL toevallig lokaal
   is, want dat is een privebeta en geen ontwikkelmachine. */
'use strict';

function stand(env) {
  const s = env && env.NODE_ENV;
  return s === undefined || s === '' ? 'development' : String(s);
}

function openbaar(env) {
  /* Bij twijfel OPENBAAR: een storing in de adreslezing mag nooit een lokale
     uitzondering opleveren. (../../config/openbaar.js zelf kiest bij twijfel
     false, omdat hij een andere vraag beantwoordt -- "mag ik blokkeren" -- en
     daar is voorzichtig het omgekeerde.) */
  try { return require('../../config/openbaar').isOpenbaar(env); } catch (e) { return true; }
}

/* Mag een uitdrukkelijk gezette `sandbox` hier gelden? Nooit in productie,
   nooit openbaar. */
function sandboxMag(env = process.env) {
  if (stand(env) === 'production') return { ja: false, waarom: 'NODE_ENV=production kent geen sandboxstand' };
  if (!['development', 'test'].includes(stand(env))) return { ja: false, waarom: 'onbekende NODE_ENV' };
  if (openbaar(env)) return { ja: false, waarom: 'een openbare installatie kent geen sandboxstand' };
  return { ja: true, waarom: 'niet-productie en niet openbaar' };
}

/* Is dit aantoonbaar een lokale ontwikkel- of toetsinstallatie? Alleen dan
   begint een capability zonder vastgelegde stand op `sandbox`. */
function lokaleInstallatie(env = process.env) {
  const s = sandboxMag(env);
  if (!s.ja) return s;
  let omg;
  try { omg = require('../../config/omgeving'); } catch (e) { return { ja: false, waarom: 'omgeving onleesbaar' }; }
  let bewezen = null;
  try { bewezen = omg.bewezenLokaal(env); } catch (e) { bewezen = null; }
  if (bewezen && bewezen.ja) return { ja: true, waarom: bewezen.waarom };
  const poortwachter = !!(env.RTG_CLUSTER_KEY || env.RTG_DOMAINS);
  if (poortwachter) return { ja: false, waarom: 'er staat een poortwachter voor die naar buiten luistert' };
  /* Noemt de installatie zelf een adres dat niet lokaal is, dan bewijst een
     loopback-bind niets: dan staat er vrijwel zeker een proxy voor die dat adres
     naar buiten draagt. Alleen ZONDER opgegeven adres telt de bind. */
  if (String(env.APP_URL || '').trim()) return { ja: false, waarom: 'APP_URL noemt een adres dat niet aantoonbaar lokaal is' };
  /* Eigen TLS of een certificaat aanvragen is luisteren voor de wereld. */
  if (env.RTG_TLS === '1' || env.RTG_ACME === '1') return { ja: false, waarom: 'de installatie draagt zelf TLS naar buiten' };
  let b;
  try { b = omg.bindBesluit(env, ''); } catch (e) { b = { fout: 'bindbesluit onleesbaar' }; }
  if (b && !b.fout && b.host && omg.isLoopback(b.host)) return { ja: true, waarom: 'luistert op de loopback (' + b.host + ')' };
  return { ja: false, waarom: (bewezen && bewezen.waarom) || 'niet aantoonbaar lokaal' };
}

module.exports = { lokaleInstallatie, sandboxMag, stand };
