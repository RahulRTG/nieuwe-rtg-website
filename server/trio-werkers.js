/* ============================================================================
   MEER POORTWACHTERS OP DEZELFDE POORT.

   WAAROM DIT ER IS -- gemeten, niet vermoed. Met spreiding aan (RTG_SPREIDING=1)
   nemen alle drie de servers verkeer aan, maar de doorvoer bewoog 1,4%. De
   rekentijd per proces zei waarom:

     clients   doorvoer   poortwachter   server 1/2/3      p99
        1       7.235/s       84%        44 / 44 / 62%   12,9 ms
        2       7.547/s       87%        47 / 47 / 53%   20,4 ms
        3       7.696/s       90%        47 / 48 / 49%   28,7 ms

   De poortwachter loopt naar 90% van EEN kern en blijft daar; de servers zitten
   op ongeveer de helft en hebben ruimte over; samen gebruikt de serverkant 2,33
   van de vier kernen, dus de machine is niet vol. Meer last geeft dan ook geen
   doorvoer maar wachtrij: +6% tegen een p99 die verdubbelt. Dat is het
   handschrift van een verzadigde enkele draad.

   Verkeer verdelen over drie servers heeft dus geen zin zolang alles door EEN
   proces moet dat per verzoek het lichaam buffert, de koppen kopieert en een
   tweede socket opent. Dat bufferen blijft trouwens: het is precies wat een
   halve POST veilig naar een andere server laat verhuizen als er een omvalt.

   DE OPZET. Met RTG_POORTWACHTERS=N splitst de voordeur in twee soorten proces:

     de HOOFD  start en bewaakt de drie servers, kiest de leider en de
               meelopers, en stuurt zelf GEEN verkeer door. Zijn event-loop
               blijft vrij voor de hartslag, wat hem juist betrouwbaarder maakt.
     de WERKER een kale doorgeefluik-poortwachter. N daarvan luisteren op
               DEZELFDE poort met SO_REUSEPORT; de kernel verdeelt de
               verbindingen. Elke werker doet de kleefkeuze zelf -- die is puur
               en heeft geen overleg nodig.

   Zonder RTG_POORTWACHTERS verandert er niets: de hoofd luistert zelf, precies
   zoals de voordeur dat altijd deed.

   WAT DE WERKERS WEL EN NIET WETEN. Ze krijgen bij elke verandering de
   serverlijst doorgestuurd (poort, gezond, rol) plus wie de leider is en of
   spreiding aanstaat. Ze BESLISSEN niets over rollen: promoveren, degraderen en
   het kiezen van een leider blijft bij de hoofd, want twee processen die dat
   allebei mogen, doen het ooit tegelijk. Valt een server om onder een werker,
   dan meldt die dat aan de hoofd en kiest hij lokaal meteen een andere -- de
   melding is een seintje, geen verzoek om toestemming.
   ========================================================================== */
'use strict';
const path = require('path');
const { fork } = require('child_process');

/* ---------------- de kant van de HOOFD ---------------- */

/* De stand die over de lijn gaat, als losse functie. Dat is geen nettigheid: dit
   is het CONTRACT tussen de hoofd en zijn werkers, en een contract dat alleen
   binnen een fabriek bestaat kan geen toets tegen zichzelf houden. Nu kan
   test/trio-werkers.test.js een serverlijst hierdoor halen, hem aan een schaduw
   voeren en eisen dat die precies dezelfde keuze maakt als trio-spreiding.js. */
function staatVan({ servers, actief, spreiding }) {
  return JSON.stringify({
    actief,
    spreiding: !!spreiding,
    servers: servers.map(s => ({ nr: s.nr, port: s.port, gezond: !!(s.child && s.healthy), rol: s.rol }))
  });
}

function maakWerkers({ aantal, servers, actieve, spreidingAan, log, gevallen }) {
  const kinderen = [];
  let laatste = '';
  let stoppen = false;

  const staatNu = () => staatVan({ servers, actief: actieve(), spreiding: spreidingAan() });
  /* Alleen sturen als er iets veranderd is. De hartslag draait elke twee
     seconden en de stand staat er meestal al; N processen elke ronde een bericht
     sturen dat niets zegt, is precies het soort werk dat we net weghaalden. */
  function deel(force) {
    const nu = staatNu();
    if (!force && nu === laatste) return;
    laatste = nu;
    for (const k of kinderen) { try { k.send({ soort: 'staat', staat: nu }); } catch (e) {} }
  }

  function start(i) {
    const kind = fork(path.join(__dirname, 'trio.js'), [], {
      env: Object.assign({}, process.env, { RTG_TRIO_WERKER: '1', RTG_TRIO_WERKER_NR: String(i + 1) }),
      stdio: ['ignore', 'pipe', 'pipe', 'ipc']
    });
    kinderen[i] = kind;
    const tag = '[voordeur ' + (i + 1) + '] ';
    const door = stroom => d => String(d).split('\n').filter(Boolean).forEach(l => stroom.write(tag + l + '\n'));
    kind.stdout.on('data', door(process.stdout));
    kind.stderr.on('data', door(process.stderr));
    kind.on('message', m => {
      /* Een werker meldt dat een server een verzoek liet vallen. Hij heeft zelf
         al doorgeschakeld; wij moeten kijken of er een nieuwe leider nodig is. */
      if (m && m.soort === 'gevallen') gevallen(m.idx, m.reden);
    });
    kind.on('exit', (code, sig) => {
      kinderen[i] = null;
      if (stoppen) return;
      log('voordeur ' + (i + 1) + ' is uitgevallen (' + (sig || 'code ' + code) + '), herstart over 1 seconde');
      setTimeout(() => { if (!stoppen) { start(i); deel(true); } }, 1000);
    });
    try { kind.send({ soort: 'staat', staat: staatNu() }); } catch (e) {}
  }

  function startAlle() {
    for (let i = 0; i < aantal; i++) start(i);
    log(aantal + ' voordeurprocessen op dezelfde poort (SO_REUSEPORT); dit proces bewaakt alleen de servers');
  }
  function stop() {
    stoppen = true;
    for (const k of kinderen) if (k) try { k.kill('SIGTERM'); } catch (e) {}
  }
  return { startAlle, deel, stop, aantal };
}

/* De opbouw, zodat trio.js een regel blijft. Hoeveel voordeuren er komen staat
   in RTG_POORTWACHTERS; 0 (de standaard) betekent geen, en dan luistert de hoofd
   gewoon zelf zoals altijd. Een werker start er nooit zelf nog eens een. */
const MAX_VOORDEUREN = 64;

/* RTG_POORTWACHTERS=auto. Een beheerder hoeft geen getal te verzinnen dat van de
   machine afhangt, en een getal dat op de ene machine goed is, is dat op de
   andere niet. De keuze: een kern minder dan de machine heeft, want de hoofd
   bewaakt alleen en de drie servers moeten er ook nog bij; minimaal 2, want met
   een valt er niets te verdelen en dan kun je de schakelaar net zo goed uitzetten;
   hoogstens 8, omdat er boven dat aantal op geen enkele machine hier iets gemeten
   is en een gok geen standaard hoort te zijn. Wie het beter weet, zet een getal.
   Op een of twee kernen komt er 0 uit: daar is dit hele mechanisme zinloos. */
function autoAantal(kernen) {
  if (kernen <= 2) return 0;
  return Math.max(2, Math.min(8, kernen - 1));
}

function koppelWerkers({ WERKER, wacht, servers, log, LOKAAL_TLS }) {
  /* Een omgevingsvariabele is tekst en mag alles zijn. Number('nee') is NaN, en
     een NaN die als aantal door de code reist komt uiteindelijk in een melding
     terecht als "RTG_POORTWACHTERS=NaN". Het PLAFOND staat er om een typefout
     (een nul te veel) geen duizend processen te laten forken. */
  const rauw = String(process.env.RTG_POORTWACHTERS || '').trim().toLowerCase();
  const gevraagd = rauw === 'auto' ? autoAantal(require('os').cpus().length) : Number(rauw);
  const VOORDEUREN = WERKER || !Number.isFinite(gevraagd) || gevraagd <= 0
    ? 0 : Math.min(MAX_VOORDEUREN, Math.floor(gevraagd));
  /* Met lokale TLS gaat het NIET, en dat weigeren we hardop in plaats van het
     stilletjes te doen: elk proces geeft bij het starten zijn eigen certificaat
     uit, dus dan ziet een telefoon per verbinding een ander certificaat van
     dezelfde site. De melding staat in trio.js, bij het starten. */
  if (!(VOORDEUREN > 0) || LOKAAL_TLS) return { VOORDEUREN, werkers: null };
  const werkers = maakWerkers({
    aantal: VOORDEUREN, servers, log,
    actieve: () => wacht.actieve(),
    spreidingAan: () => wacht.spreiding.aan(),
    /* Een werker zag een server een verzoek laten vallen. Hij heeft zelf al
       doorgeschakeld; wij zetten hem hier op onbereikbaar en laten de gewone
       keuze zijn werk doen. */
    gevallen: (idx, reden) => {
      if (servers[idx]) { servers[idx].healthy = false; servers[idx].healthySince = 0; servers[idx].rol = 'uit'; }
      wacht.kiesActieve(reden || 'een voordeur zag een server een verzoek laten vallen');
    }
  });
  return { VOORDEUREN, werkers };
}

module.exports = { maakWerkers, koppelWerkers, staatVan, autoAantal };
