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

/* Is dit adres de loopback van deze machine? Alleen dat, en niet "lokaal" in de
   ruime zin van ./openbaar.js: een privaat netwerkadres (192.168.x) is voor
   iedereen in hetzelfde pand bereikbaar, en precies dat mag de toetsstand niet. */
function isLoopback(host) {
  const h = String(host || '').trim().toLowerCase().replace(/^\[|\]$/g, '');
  if (!h) return false;
  if (h === 'localhost' || h === '::1') return true;
  return /^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(h);
}

/* WAAR LUISTERT DE SERVER? De invariant van A-P1-02 is "publiek bereikbaar
   -> productiebeveiliging verplicht", en een server die buiten productie op
   alle interfaces luistert terwijl niemand heeft gezegd dat dat adres lokaal is,
   IS publiek bereikbaar zodra de machine een netwerk heeft. Dus:

     productie      wat de aanvrager zegt; de productiekeuring doet de rest.
     test           alleen de loopback (zie de kop), anders een fout.
     ontwikkeling   de loopback, TENZIJ aantoonbaar is dat het netwerk lokaal is:
                    APP_URL wijst naar een lokaal adres (localhost, .local, een
                    privaat netwerkadres), of de beheerder bevestigt het met
                    RTG_LOKAAL_NETWERK=BEVESTIGD. Een expliciet RTG_BIND buiten de
                    loopback zonder een van die twee is een fout; zonder RTG_BIND
                    wordt het stil de loopback in plaats van alle interfaces.

   Dat laatste is de veilige standaard en breekt geen officieel startpad: npm
   start en npm run single werken op deze machine zoals altijd; wie vanaf een
   telefoon in hetzelfde netwerk wil testen, zet APP_URL op het LAN-adres.

   `standaard` is wat de aanroeper zonder deze regel zou kiezen ('' = alle
   interfaces). Geeft { host } of { fout }. */
const LOKAAL_BEVESTIGD = 'BEVESTIGD';
function bindBesluit(env, standaard) {
  env = env || process.env;
  const gezet = String(env.RTG_BIND || '').trim();
  if (env.NODE_ENV === 'production') return { host: gezet || standaard || '' };
  if (env.NODE_ENV === 'test') {
    if (!gezet) return { host: '127.0.0.1' };
    return isLoopback(gezet) ? { host: gezet } : { fout: testBindFout(gezet) };
  }
  const wens = gezet || standaard || '';
  if (wens && isLoopback(wens)) return { host: wens };
  const lokaal = require('./openbaar').installatieSoort(env).soort === 'lokaal';
  if (lokaal || env.RTG_LOKAAL_NETWERK === LOKAAL_BEVESTIGD) return { host: wens };
  if (!gezet) return { host: '127.0.0.1', verengd: true };
  return { fout: 'RTG_BIND=' + gezet + ' buiten productie, terwijl niet vast te stellen is dat dit netwerk lokaal is. '
    + 'Een ontwikkelserver mist de productiebeveiliging (inlogrem, versleuteling, dichte demo- en kantoordeuren) en hoort '
    + 'dus niet bereikbaar te zijn voor wie er niet hoort. Zet NODE_ENV=production voor een echte installatie, zet '
    + 'APP_URL op het lokale adres (localhost, .local of een privaat netwerkadres), of bevestig met '
    + 'RTG_LOKAAL_NETWERK=' + LOKAAL_BEVESTIGD + ' dat dit netwerk alleen van u is.' };
}

/* Voor de luisteraars (opzet/luister.js, trio.js). Gooit bij een fout: de
   startkeuring van server.js heeft het proces dan meestal al gestopt, maar de
   poortwachter (trio.js) draait die keuring niet en mag dus niet stil op een
   verkeerd adres gaan staan. */
function luisterHost(env, standaard) {
  const b = bindBesluit(env, standaard);
  if (b.fout) throw new Error(b.fout);
  return b.host;
}

function testBindFout(adres) {
  return 'NODE_ENV=test met RTG_BIND=' + adres + ': de toetsstand opent achterdeuren die alleen voor toetsen bestaan, '
    + 'en die mogen nooit vanaf een netwerk bereikbaar zijn. Laat RTG_BIND weg (dan luistert hij op 127.0.0.1), '
    + 'zet hem op een loopbackadres, of start met NODE_ENV=development.';
}

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
