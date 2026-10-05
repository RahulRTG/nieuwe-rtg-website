/* AFZETTEN OF STOPPEN -- het trio kent nooit twee schrijvers tegelijk.

   De poortwachter (./trio-wacht.js) nam de oude leider zijn rol "best effort"
   af en promoveerde de nieuwe ook als dat afnemen mislukte. Een leider die
   vastzit (een lange GC-pauze, een volle schijf) geeft geen antwoord op de
   gezondheidscontrole EN niet op de demote, maar hij leeft nog en schrijft
   verder zodra hij loskomt. Op SQLite laat de samenvoeging tussen processen
   dan stil de laatste schrijver winnen (../db/merge.js): een saldo-update
   verdwijnt. Zo gevonden door de herkeuring van RTG-V1-RELEASE C6, na ongeveer
   7 s stilstand.

   De regel: een ander wordt pas leider als de oude aantoonbaar NIET meer
   schrijft. Bevestigt hij de afzetting niet, dan stoppen we zijn proces
   (SIGKILL; een SQLite-transactie die daarbij half is, rolt terug via de WAL)
   en wachten we tot het weg is. De herstartlus in ./trio-wacht.js brengt hem
   daarna terug als stand-by, en die schrijft niet. Lukt ook dat stoppen niet
   binnen de grens, dan promoveren we NIET: liever een paar seconden geen leider
   dan twee. */
'use strict';

const STOP_MS = 5000;

function maakAfzetten({ servers, spreiding, log }) {
  function weg(kind) { return kind.exitCode !== null || kind.signalCode !== null; }
  async function zetAf(idx) {
    if (await spreiding.zetRol(idx, spreiding.naLeiderschap())) return true;
    const s = servers[idx];
    if (!s || !s.child || weg(s.child)) return true;   // er draait niets meer dat kan schrijven
    const kind = s.child;
    log('server ' + s.nr + ' bevestigt zijn afzetting niet; zijn proces wordt gestopt voordat een ander leider wordt');
    const gestopt = new Promise((klaar) => kind.once('exit', () => klaar(true)));
    try { kind.kill('SIGKILL'); } catch (e) { /* hieronder telt alleen of hij weg is */ }
    let wekker;
    const grens = new Promise((klaar) => { wekker = setTimeout(() => klaar(weg(kind)), STOP_MS); });
    const uit = await Promise.race([gestopt, grens]);
    clearTimeout(wekker);
    if (!uit) log('server ' + s.nr + ' is niet binnen ' + STOP_MS + ' ms gestopt; er wordt deze ronde niemand gepromoveerd');
    return uit;
  }
  return { zetAf };
}

module.exports = { maakAfzetten, STOP_MS };
