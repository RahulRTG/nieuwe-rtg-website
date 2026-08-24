/* WELKE SERVERS ZIJN ER BLIJVEN STAAN?

   Op 24 augustus stond er tijdens een toetsronde een server/server.js met PPID 1:
   geen ouder meer, dus achtergebleven uit een toetskind dat zelf netjes afsloot
   en zijn server liet staan. Hij draaide de HELE ronde mee en at een van de vier
   kernen op. Niemand merkte het -- de ronde was gewoon groen, alleen trager, en
   "trager" leest als een drukke machine.

   Dat is de stilste vorm van LAT-regel 5: er faalt niets zichtbaar, het antwoord
   wordt alleen langzamer en elke meting eromheen onvergelijkbaar. Twee rondes
   van 1130 en 1172 seconden zijn zo gemeten voordat iemand ps draaide.

   De dader was test/tls-boot.test.js, die server/trio.js met SIGKILL stopte --
   niet te vangen, dus de nette afsluiter die trio's drie werkers meeneemt draaide
   nooit. Dat is gerepareerd; deze teller is er zodat de VOLGENDE zo'n lek meteen
   opvalt in plaats van na een halve dag meten.

   Het staat hier los van scripts/test-runner.js zodat het te toetsen is:
   test/wezen.test.js maakt een echt ouderloos proces en kijkt of het gevonden
   wordt. Een poort die je niet hebt zien vuren, bewaakt niets (LAT-regel 10). */
'use strict';
const path = require('path');
const { spawnSync } = require('child_process');

const WORTEL = path.join(__dirname, '..', '..');

/* De ouderloze servers van DEZE boom, als Map pid -> commandoregel.
   `null` betekent "niet kunnen kijken" en niet "niets gevonden" -- die twee uit
   elkaar houden is het hele punt van LAT-regel 3. */
/* De processenlijst komt via een LEZER, en dat is geen versiering. De tak
   hieronder -- "ps gaf niets, dus we weten niets" -- is de hele reden dat deze
   functie `null` teruggeeft in plaats van een lege lijst, en die tak is met een
   echte ps niet te bereiken: die slaagt altijd. Een mutatie die hem op een lege
   Map zette bleef dan ook groen (AFGESLAGEN), en een tak die niet kan zakken is
   geen tak maar een gebaar. Met een injecteerbare lezer is het drie regels --
   dezelfde oplossing als bij leesMutaties in scripts/norm.js. */
function leesProcessen() {
  try { return spawnSync('ps', ['-eo', 'pid,ppid,args'], { encoding: 'utf8' }); }
  catch (e) { return null; }
}

function ouderlozeServers(wortel, lezer) {
  const basis = wortel || WORTEL;
  /* De vangst hoort HIER en niet alleen in de standaardlezer: een lezer die
     GOOIT is net zo goed "niet kunnen kijken" als een lezer die niets teruggeeft.
     Dat stond er eerst niet -- de try/catch zat in leesProcessen -- en de toets
     met een gooiende lezer viel er meteen over. Een uitzondering die doorschiet
     zou de ronde omgooien met een stacktrace in plaats van met de zin die er
     hoort te staan. */
  let uit = null;
  try { uit = (lezer || leesProcessen)(); } catch (e) { return null; }
  if (!uit || uit.status !== 0 || !uit.stdout) return null;
  const pad = path.join(basis, 'server', 'server.js');
  const wezen = new Map();
  for (const regel of uit.stdout.split('\n')) {
    const m = regel.trim().match(/^(\d+)\s+(\d+)\s+(.*)$/);
    if (!m || m[2] !== '1') continue;          // alleen wat geen ouder meer heeft
    if (!m[3].includes(pad)) continue;
    wezen.set(m[1], m[3].slice(0, 120));
  }
  return wezen;
}

/* Wat is er TIJDENS de ronde ouderloos geworden en nog in leven?
   Wat er vooraf al stond is niet van ons: een ontwikkelserver mag gewoon
   draaien. Kan er niet gekeken worden (voor of na), dan is het antwoord
   `null` -- geen lege lijst, want dat zou "alles in orde" betekenen. */
function nieuweWezen(vooraf, na) {
  if (!vooraf || !na) return null;
  return [...na].filter(([pid]) => !vooraf.has(pid)).map(([pid, cmd]) => ({ pid, cmd }));
}

/* WAT DRAAIDE ER NOG MEER? -- de context waarzonder een rondetijd niets zegt.

   Op 24 augustus stond hier een grondmeting van 920 s naast rondes van 1130 en
   1172 s, en ik heb dat verschil eerst voor een regressie aangezien. Het was er
   geen: tussen die metingen door was er een ontwikkelserver bijgekomen (trio.js
   met drie werkers) en draaide er een gelekte server mee. Op een machine met
   vier kernen is dat de helft van de capaciteit, en geen van beide stond in de
   uitvoer van de ronde.

   Een getal zonder zijn omstandigheden is geen meting maar een indruk. Sinds
   vandaag zet de ronde er daarom bij hoeveel RTG-serverprocessen er draaiden en
   wat de belasting was, zodat de volgende lezer twee rondes kan vergelijken
   zonder ps te hoeven raden. */
function machinebeeld(wortel, lezer) {
  const basis = wortel || WORTEL;
  let uit = null;
  try { uit = (lezer || leesProcessen)(); } catch (e) { return null; }
  if (!uit || uit.status !== 0 || !uit.stdout) return null;
  const pad = path.join(basis, 'server');
  let servers = 0;
  for (const regel of uit.stdout.split('\n')) {
    if (/\bnode\b/.test(regel) && regel.includes(pad) && /server\.js|trio\.js/.test(regel)) servers++;
  }
  let last = null;
  try { last = require('os').loadavg()[0]; } catch (e) { last = null; }
  return { servers, kernen: require('os').availableParallelism ? require('os').availableParallelism() : require('os').cpus().length, belasting: last };
}

module.exports = { ouderlozeServers, nieuweWezen, leesProcessen, machinebeeld };
