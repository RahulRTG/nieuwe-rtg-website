/* DE INFRASTRUCTUURPOORT VAN DE TOETSEN: wanneer mag een toets zichzelf
   overslaan omdat er iets ontbreekt (een database, Redis, een browser, xmllint,
   openssl, /proc), en wanneer is dat een ZAKKER.

   WAT ER MIS WAS. Tientallen toetsen sloegen zich over zodra er geen
   DATABASE_URL, geen redis-server of geen Chromium was, elk met een eigen zin.
   Op een ontwikkelmachine is dat juist: daar ontbreekt het, en zeggen DAT het
   ontbreekt is eerlijk. Maar in CI en bij een release BELOOFT de omgeving die
   infrastructuur -- de job installeert hem -- en daar is een overgeslagen toets
   geen eerlijke mededeling maar een groene stap over een meting die niet heeft
   gedraaid (LAT.md regel 3 en 12). Een apt-installatie die stil mislukt, en
   vijftien toetsen "slagen" door niets te doen.

   DE SCHAKELAAR. RTG_EIS_INFRA zegt welke infrastructuur deze omgeving eist:
     RTG_EIS_INFRA=alles            (of 1)  alles hieronder
     RTG_EIS_INFRA=pg,redis                 alleen deze soorten
   Een soort die geeist wordt en ontbreekt, laat de toets ZAKKEN met de reden --
   `vereist()` gooit, en een toetsbestand dat dat bij het laden doet, zakt als
   geheel. Zonder de schakelaar blijft een ontbrekende soort een overgeslagen
   toets, maar dan altijd met het etiket `[infra:<soort>]` in de reden, zodat
   scripts/test-runner.js hem kan tellen en melden (en onder de schakelaar als
   rood kan aanwijzen, mocht een toets toch langs deze poort heen overslaan).

   Een onbekende soort in RTG_EIS_INFRA is een fout en geen stilte: een tikfout
   in een workflow ("redis-sever") zou anders precies de toets uitzetten die hij
   moest afdwingen. */
'use strict';

const SOORTEN = Object.freeze({
  pg: 'een echte PostgreSQL (DATABASE_URL of PG_URL)',
  redis: 'een echte Redis-dienst (REDIS_URL)',
  'redis-server': 'het programma redis-server (een eigen, geisoleerd proces)',
  browser: 'Playwright met een startbare Chromium',
  xmllint: 'het programma xmllint (libxml2-utils)',
  openssl: 'het programma openssl (een zelfgetekend certificaat)',
  proc: 'het bestandssysteem /proc (Linux)',
  ps: 'de programma\'s ps en pgrep'
});

function eisen(env = process.env) {
  const ruw = String(env.RTG_EIS_INFRA || '').trim();
  if (!ruw || ruw === '0') return new Set();
  if (ruw === '1' || ruw === 'alles') return new Set(Object.keys(SOORTEN));
  const namen = ruw.split(',').map(s => s.trim()).filter(Boolean);
  const onbekend = namen.filter(n => !SOORTEN[n]);
  if (onbekend.length) {
    throw new Error('RTG_EIS_INFRA noemt een onbekende soort: ' + onbekend.join(', ') +
      ' -- bekend zijn ' + Object.keys(SOORTEN).join(', ') + ' (of "alles")');
  }
  return new Set(namen);
}

/* De ene vraag: is `soort` er (`aanwezig`)? Zo ja: false (niet overslaan).
   Zo nee: de reden om over te slaan, met het etiket -- of, als deze omgeving
   de soort EIST, een fout. Bruikbaar als `{ skip: vereist(...) }`, als
   `t.skip(vereist(...))` en als waarde voor een vroege return. */
function vereist(soort, aanwezig, reden, env = process.env) {
  if (!SOORTEN[soort]) throw new Error('test/infra.js: onbekende soort ' + JSON.stringify(soort));
  const geeist = eisen(env);   // ook als alles er is: een tikfout in de schakelaar zakt altijd
  if (aanwezig) return false;
  const waarom = String(reden || SOORTEN[soort] + ' ontbreekt');
  if (geeist.has(soort)) {
    throw new Error('[infra:' + soort + '] deze omgeving eist ' + SOORTEN[soort] + ' (RTG_EIS_INFRA), maar: ' + waarom +
      '. Een overgeslagen toets telt hier niet als geslaagd -- installeer het, of haal de soort uit RTG_EIS_INFRA ' +
      'als deze omgeving hem werkelijk niet hoort te leveren.');
  }
  return '[infra:' + soort + '] ' + waarom;
}

/* Meer soorten tegelijk ([[soort, aanwezig], ...]): ELKE soort wordt eerst
   getoetst, en pas daarna komt de eerste reden terug. Met `a || b` zou een
   ontbrekende maar NIET geeiste eerste soort de tweede, die wel geeist wordt,
   nooit laten vragen -- en dan slaat de toets over waar hij moest zakken. */
function vereistAlle(paren, reden, env = process.env) {
  const uit = paren.map(([soort, aanwezig]) => vereist(soort, aanwezig, reden, env));
  return uit.find(Boolean) || false;
}

const ETIKET = /\[infra:([a-z-]+)\]/;

/* Het oordeel van de DRAAIER (scripts/test-runner.js) over de overgeslagen
   toetsen van een ronde, uit de TAP-regels ({ test, reden }). De infra-skips
   worden altijd genoemd, ook lokaal; onder RTG_EIS_INFRA laat een infra-skip
   van een GEEISTE soort de ronde zakken -- de vangrail voor een toets die
   langs `vereist()` heen toch met het etiket overslaat. Een skip met een
   andere reden (een gelijktijdige afbouw, een productkeuze) beoordeelt deze
   functie niet: dat is de volle-rondepoort in de draaier zelf. */
function infraOordeel(overgeslagenTests, env = process.env) {
  const geeist = eisen(env);
  const infra = (overgeslagenTests || []).map(o => {
    const m = ETIKET.exec(String((o && o.reden) || ''));
    return m ? { test: o.test, soort: m[1], reden: o.reden } : null;
  }).filter(Boolean);
  const geweigerd = infra.filter(o => geeist.has(o.soort));
  return { infra, geweigerd, zakt: geweigerd.length > 0 };
}

module.exports = { vereist, vereistAlle, eisen, infraOordeel, SOORTEN, ETIKET };
