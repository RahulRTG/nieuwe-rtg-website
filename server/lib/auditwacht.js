/* ============================================================================
   DE AUDITWACHT -- een gebroken spoor is een ALARM en geen stille storing
   (audit P1-4).

   WAT ER MIS WAS. Wie in PostgreSQL-modus een regel in het handelingsspoor of
   het API-spoor bijstelde, brak de keten -- en de requestmerge
   (pg/verzoeksporen.js) weigerde daarna elke schrijfhandeling met een kaal
   `PG_REQUEST_CONFLICT`. Voor de gebruiker was dat een 409 "laad opnieuw", voor
   de beheerder niets: geen alarm, geen logregel die zei dat het SPOOR stuk was.
   Een vervalsing veroorzaakte zo een stille schrijfstoring, en wie hem niet
   zocht, vond hem niet.

   WAT HIER STAAT.
     - `meld(journaal, reden, bron)`: een breuk wordt een BEVINDING, met de
       journaalnaam en het tijdstip; de requestmerge roept dit aan voordat hij
       weigert, en de route antwoordt dan 503 met de reden (db/opslagfout.js).
     - `controleer(db)`: alle journalen nalopen -- inzage, inlog, handelingen,
       het API-spoor en het besluitjournaal van RTG Command. Bij het opstarten
       en daarna periodiek (`start`), zodat een breuk ook opvalt als niemand
       toevallig schrijft.
     - `bevinding()`: wat het alarm leest (kern/command/alarm.js,
       `auditspoor-gebroken`). Het alarm meet niets zelf; dit is de laag die
       het leest.
   Een melding roept daarnaast meteen de alarmweging aan (`haakAlarm`), buiten
   de requestcontext: anders zou het alarm wachten op de volgende tik, en de
   regel van het alarm landen in een verzoek dat net mislukt.

   WAT HIJ NIET DOET. Hij herstelt niets. Een gebroken keten repareren is
   bewijs herschrijven, en dat besluit hoort bij een mens -- met het anker
   (lib/ankerdienst.js) ernaast om te zien wat er werkelijk weg is.
   ========================================================================== */
'use strict';

const keten = require('./keten');

const staat = { breuken: new Map(), rondes: 0, laatsteRonde: null, timer: null, minuten: null };
let alarmHaak = null;

function haakAlarm(fn) { alarmHaak = typeof fn === 'function' ? fn : null; }

function wekAlarm() {
  if (!alarmHaak) return;
  const haak = alarmHaak;
  /* Buiten het verzoek: een alarmregel hoort niet in de werkkopie van een
     verzoek dat net faalt (db/verzoekcontext.js). */
  setImmediate(() => {
    try { require('../db/verzoekcontext').zonder(() => haak()); }
    catch (e) { console.error('[auditwacht] alarm kon niet worden gewogen:', e && e.message); }
  });
}

function meld(journaal, reden, bron) {
  const naam = String(journaal || 'onbekend');
  const nu = new Date().toISOString();
  const oud = staat.breuken.get(naam);
  staat.breuken.set(naam, { journaal: naam, reden: String(reden || 'de keten is gebroken').slice(0, 300),
    bron: String(bron || 'onbekend'), sinds: oud ? oud.sinds : nu, laatst: nu });
  if (!oud) {
    console.error('[auditwacht] AUDITSPOOR GEBROKEN: ' + naam + ' (' + (bron || 'onbekend') + '): ' + reden);
    wekAlarm();
  }
}

/* Het besluitjournaal en het API-spoor dragen een zegelketen (kern/command/
   journaal.js) en geen hashketen; dezelfde controle als de requestmerge. */
function commandHeel(lijst) {
  return require('../pg/spoorketen').commandHeel(lijst);
}

function journalen(db) {
  const d = (db && db.data) || {};
  return {
    inzageLog: () => { const v = keten.verifieer(d.inzageLog || []); return v.ok ? null : waarom(v); },
    securityLog: () => { const v = keten.verifieer(d.securityLog || []); return v.ok ? null : waarom(v); },
    handelingLog: () => { const v = keten.verifieer(d.handelingLog || []); return v.ok ? null : waarom(v); },
    apiSpoor: () => commandHeel((d.apiSpoor && d.apiSpoor.commandJournaal) || []) ? null
      : 'de zegelketen van het API-spoor klopt niet',
    commandJournaal: () => commandHeel(d.commandJournaal || []) ? null
      : 'de zegelketen van het besluitjournaal klopt niet'
  };
}
function waarom(v) {
  const g = (v.gebroken || [])[0];
  return g ? 'regel ' + g.index + ': ' + g.waarom : 'de keten is gebroken';
}

/* Alle journalen nalopen. Een journaal dat weer klopt, verdwijnt uit de
   bevindingen -- ook als de breuk door de requestmerge was gemeld: deze ronde
   kijkt naar de opgeslagen waarheid. */
function controleer(db) {
  staat.rondes++;
  const uit = {};
  for (const [naam, toets] of Object.entries(journalen(db))) {
    let r;
    try { r = toets(); } catch (e) { r = 'de controle kon niet draaien: ' + (e && e.message || e); }
    uit[naam] = r ? { ok: false, reden: r } : { ok: true };
    if (r) meld(naam, r, 'ronde');
    else if (staat.breuken.has(naam)) { staat.breuken.delete(naam); wekAlarm(); }
  }
  staat.laatsteRonde = { at: new Date().toISOString(), uitslag: uit };
  return uit;
}

/* Een bevinding die niet uit de journaalronde komt (het anker), sluit de
   melder zelf weer af zodra het klopt. */
function wis(naam) {
  if (staat.breuken.delete(String(naam))) wekAlarm();
}

function bevinding() {
  if (!staat.breuken.size) return null;
  return [...staat.breuken.values()].map(b => b.journaal + ' (' + b.bron + ', sinds ' + b.sinds + '): ' + b.reden).join('; ');
}

/* Bij het opstarten EN periodiek. RTG_AUDITWACHT_MINUTEN, standaard 5. De
   controle LEEST alleen; daarom mag hij ook in een meetserver lopen. */
function start({ db, omgeving } = {}) {
  const env = omgeving || process.env;
  if (staat.timer) return { gestart: false, reden: 'loopt al' };
  const minuten = Math.max(1, Number(env.RTG_AUDITWACHT_MINUTEN || 5) || 5);
  staat.minuten = minuten;
  const ronde = () => { try { controleer(db); } catch (e) { console.error('[auditwacht] ronde mislukt:', e && e.message); } };
  const eerste = setImmediate(ronde);
  if (eerste && eerste.unref) eerste.unref();
  staat.timer = setInterval(ronde, minuten * 60 * 1000);
  if (staat.timer.unref) staat.timer.unref();
  return { gestart: true, minuten };
}

function stop() { if (staat.timer) clearInterval(staat.timer); staat.timer = null; }

function stand() {
  return { breuken: [...staat.breuken.values()], rondes: staat.rondes, laatsteRonde: staat.laatsteRonde,
    minuten: staat.minuten, actief: !!staat.timer };
}

/* Alleen voor toetsen: een schone wacht. */
function _wis() { staat.breuken.clear(); staat.rondes = 0; staat.laatsteRonde = null; }

module.exports = { meld, wis, controleer, bevinding, start, stop, stand, haakAlarm, _wis };
