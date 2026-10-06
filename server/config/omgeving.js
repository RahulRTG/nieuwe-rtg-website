/* WELKE STAND IS DIT, EN WAAR MAG HIJ LUISTEREN? -- NODE_ENV als gesloten lijst.

   WAAROM DIT BESTAAT. Dit huis vraagt op tientallen plekken
   `NODE_ENV === 'production'` (../config.js en verder). Een waarde die daar NET
   naast zit -- `prod`, `Production`, `staging` -- is dan geen productie, en ook
   geen fout: hij is stilzwijgend ONTWIKKELING. Op een echte server betekende dat
   geen inlogrem, opslag zonder versleuteling, de gedeelde kantoorcode die het
   kantoor opent, de demo-inlog van Magnaat Test, en -- bij `test` -- de
   achterdeuren die alleen voor toetsen bestaan (school/beheer.js,
   foundation/gezinstoegang.js, stripe.js). Een typefout in een
   omgevingsvariabele hoort geen beveiliging uit te zetten; hij hoort de start
   te breken.

   DE LIJST IS GESLOTEN: production, development, test, of niet gezet (dat is
   ontwikkeling, zoals het altijd was). Er komt geen vierde stand bij zonder dat
   iemand opschrijft wat hij betekent op elk van die tientallen plekken.

   EN `test` IS ALLEEN VOOR DEZE MACHINE. De toetsstand opent deuren die op een
   netwerk nooit open mogen staan. Hij luistert daarom op de loopback als niemand
   iets zegt, en weigert te starten als RTG_BIND hem op een ander adres zet.
   Draai je een proefinstallatie die anderen moeten bereiken, dan is dat
   `development` -- en dan staan die deuren dicht. */
'use strict';

const STANDEN = Object.freeze(['production', 'development', 'test']);

/* Waar de server LUISTERT is geen keuring maar een runtimebesluit, en woont
   daarom in ../lib/luisteradres.js (de luisteraars lezen hem ook, en een
   keuringsmap die haar eigen variabelen leest is haar eigen bewijs -- regel 27
   van scripts/check.js). Deze keuring roept hetzelfde besluit aan. */
const { isLoopback, bindBesluit, luisterHost, LOKAAL_BEVESTIGD } = require('../lib/luisteradres');

/* De keuring zelf: schrijft in hardeFouten, want beide fouten breken de start
   af ongeacht wat NODE_ENV zegt -- dat is nu juist de waarde die niet te
   vertrouwen is. */
function keurOmgeving(env, hardeFouten) {
  const stand = env.NODE_ENV;
  if (stand !== undefined && stand !== '' && !STANDEN.includes(stand)) {
    hardeFouten.push('NODE_ENV="' + stand + '" is geen stand die dit huis kent. Toegestaan: '
      + STANDEN.join(', ') + ', of niet gezet (= development). Een onbekende waarde is GEEN productie: '
      + 'zonder deze controle draaide de server dan stil als ontwikkelserver, zonder inlogrem, zonder '
      + 'versleuteling en met de demo- en toetsdeuren open. Zet NODE_ENV=production voor een echte installatie.');
  }
  const b = bindBesluit(env, (env.RTG_CLUSTER_KEY || env.RTG_DOMAINS) ? '127.0.0.1' : '');
  if (b.fout) hardeFouten.push(b.fout);
}

/* IS DEZE INSTALLATIE AANTOONBAAR ALLEEN LOKAAL BEREIKBAAR? Voor vlaggen die
   iets openzetten wat op een netwerk een overname is (RTG_DEV_LINKS). Drie
   bewijzen, en alle drie komen ze uit de omgeving en niet uit een verzoek:

     - APP_URL wijst naar een lokaal adres (dezelfde lezing als RTG_PRIVATE_BETA);
     - de toetsstand, want die luistert alleen op de loopback (zie boven);
     - RTG_BIND op de loopback ZONDER poortwachter ervoor. Met RTG_CLUSTER_KEY of
       RTG_DOMAINS staat er een proces voor dat wel naar buiten luistert en alles
       lokaal doorstuurt -- dan bewijst een loopback-bind niets (de kop van
       routes/auth.js beschrijft precies die vergissing). */
function bewezenLokaal(env) {
  env = env || process.env;
  const stand = require('./openbaar').installatieSoort(env);
  if (stand.soort === 'lokaal') return { ja: true, waarom: 'APP_URL is lokaal (' + stand.host + ')' };
  if (stand.soort === 'openbaar') return { ja: false, waarom: 'het opgegeven adres is openbaar (' + stand.host + ')' };
  if (env.NODE_ENV === 'test') return { ja: true, waarom: 'de toetsstand luistert alleen op de loopback' };
  const poortwachter = !!(env.RTG_CLUSTER_KEY || env.RTG_DOMAINS);
  if (!poortwachter && isLoopback(env.RTG_BIND)) return { ja: true, waarom: 'RTG_BIND is de loopback en er staat geen poortwachter voor' };
  return { ja: false, waarom: (stand.reden || 'APP_URL wijst naar ' + stand.host)
    + (poortwachter ? ', en er staat een poortwachter voor die naar buiten luistert' : ', en RTG_BIND is niet de loopback') };
}

module.exports = { STANDEN, isLoopback, bindBesluit, luisterHost, keurOmgeving, bewezenLokaal, LOKAAL_BEVESTIGD };
