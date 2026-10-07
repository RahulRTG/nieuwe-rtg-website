/* WAAR LUISTERT DE SERVER? -- het runtimebesluit achter RTG_BIND.

   Afgesplitst van ../config/omgeving.js, die de startkeuring doet. De
   luisteraars (../opzet/luister.js, ../trio.js) en die keuring vragen hetzelfde
   besluit; zie de kop van ../config/omgeving.js voor waarom NODE_ENV een
   gesloten lijst is en de toetsstand alleen op de loopback hoort. */
'use strict';

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
  const lokaal = require('../config/openbaar').installatieSoort(env).soort === 'lokaal';
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


module.exports = { isLoopback, bindBesluit, luisterHost, testBindFout, LOKAAL_BEVESTIGD };
