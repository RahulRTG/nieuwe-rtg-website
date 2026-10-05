/* AFZETTEN OF STOPPEN -- het trio kent nooit twee leiders tegelijk (zonder
   spreiding is de leider de enige schrijver).

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
   dan twee.

   DE SPIEGELKANT (tweede herkeuring van C6): een promotie die niet bevestigd is,
   is daarmee niet mislukt. Een time-out zegt niets over de server; laden,
   migreren en een backup gaan voor zijn antwoord uit, en daarna is hij gewoon
   leider. Wie dan de volgende kandidaat promoveert, heeft er twee. Dus wordt
   ook een kandidaat eerst aantoonbaar afgezet (promoveer hieronder).

   WAT HIER NIET DICHT IS: een stand-by antwoordt op een schrijfverzoek met 200
   en bewaart niets (db/index.js bewaar). wissel() houdt het verkeer weg tijdens
   de failback en de hartslag promoveert een actieve die zegt geen leider te
   zijn (leesStand), maar een verzoek dat al onderweg was, het venster tot de
   volgende hartslag en de werkers van RTG_POORTWACHTERS raken die stand-by nog.
   Zie RTG-V1-RELEASE-READINESS-AUDIT.md. */
'use strict';

const STOP_MS = 5000;

/* Gezond, en wat de server ZELF over zijn leiderschap zegt (`leider` in
   /api/health; null als hij het niet zegt). De boekhouding van de poortwachter
   is niet genoeg: een server die herstartte is stand-by, een demote kan een
   time-out geven en toch zijn uitgevoerd, en een 'onzeker' moet ooit worden
   nagekeken (derde herkeuring van C6). */
async function leesStand(apiCall, port) {
  const r = await apiCall(port, '/api/health', 'GET');
  if (!r || r.status !== 200) return { gezond: false, leider: null };
  try { const b = JSON.parse(r.body); return { gezond: true, leider: typeof b.leider === 'boolean' ? b.leider : null }; }
  catch (e) { return { gezond: true, leider: null }; }
}

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

  /* 'ja' is leider; 'nee' is aantoonbaar geen leider; 'onzeker' kon niet worden
     afgezet en geldt als leider tot de volgende ronde hem afzet. */
  async function promoveer(i) {
    if (await spreiding.zetRol(i, 'leider')) return 'ja';
    return (await zetAf(i)) ? 'nee' : 'onzeker';
  }

  /* DE FAILBACK, vrijwillig: de oude leider af, de betere erop. Geeft de nieuwe
     actieve terug, -1 als de volgende hartslag moet kiezen. De aanroeper zet de
     actieve tijdens de wissel op -1. Een demote die niet is bevestigd laat de
     oude leider staan, zoals voorheen: een demote is goedkoop, dus geen antwoord
     betekent een server die vastzit, en die opnieuw promoveren laadt de data van
     schijf over een geheugen dat nog niet bewaard kan zijn. */
  async function wissel(oudIdx, beter) {
    const oud = servers[oudIdx];
    if (!await spreiding.zetRol(oudIdx, spreiding.naLeiderschap())) {
      log('server ' + oud.nr + ' bevestigt zijn afzetting niet; geen failback deze ronde');
      return oudIdx;
    }
    const uit = await promoveer(beter);
    if (uit !== 'nee') {
      log('server ' + servers[beter].nr + (uit === 'ja' ? ' doet het weer en neemt het werk terug'
        : ' bevestigt zijn promotie niet en kon niet worden afgezet; hij geldt als actief') + '; server ' + oud.nr +
        (spreiding.aan() ? ' loopt mee als volger' : ' is weer standby'));
      return beter;
    }
    return (await promoveer(oudIdx)) === 'nee' ? -1 : oudIdx;   // terugdraaien
  }
  return { zetAf, promoveer, wissel };
}

module.exports = { maakAfzetten, leesStand, STOP_MS };
