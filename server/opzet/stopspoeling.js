/* ============================================================================
   WAT ER WEG MOET VOORDAT DIT PROCES STOPT -- een definitie, twee lezers.

   Er waren twee afsluitwegen en ze groeiden uit elkaar (RTG-V1-RELEASE D1).
   SIGTERM (./luister.js) spoelde het journaal, de vertaalkast en de
   write-behind; een crash (uncaughtException in ../server.js) deed alleen
   save(). Precies bij een crash -- waar incidentreconstructie op leunt -- ging
   dus een write-behind-venster en een stapel gebufferde auditregels verloren.

   De reparatie is geen derde kopie maar EEN lijst die beide aanroepen. Komt er
   ooit een buffer bij die bij het stoppen leeg moet, dan hoort hij hier en
   krijgen beide wegen hem tegelijk.

   Twee helften, omdat de aanroepers ze anders gebruiken:
   - spoelSynchroon(): save() plus de stapels die per venster spoelen. Synchroon,
     want een asynchrone spoeling haalt process.exit() niet meer.
   - spoelAsynchroon(): de laatste write-behind-flush (Postgres, accounts). Geeft
     een belofte die nooit verwerpt; de aanroeper bepaalt hoe lang hij wacht.
   Elke stap staat in een eigen try: een stap die faalt, mag de volgende niet
   tegenhouden. */
'use strict';

function maakStopspoeling({ save, flushBijAfsluiten, accounts }) {
  function spoelSynchroon() {
    try { save(); } catch (e) {}
    try { require('../kern/journaalbestand').spoelAlle(); } catch (e) {}
    try { require('../lib/vertaalkast').spoelAlle(); } catch (e) {}
  }
  function spoelAsynchroon() {
    const stap = (f) => { try { return Promise.resolve(f()); } catch (e) { return Promise.reject(e); } };
    return Promise.allSettled([
      stap(() => flushBijAfsluiten && flushBijAfsluiten()),
      stap(() => accounts && accounts.flushBijAfsluiten && accounts.flushBijAfsluiten())
    ]);
  }
  return { spoelSynchroon, spoelAsynchroon };
}

/* DE CRASHWEG (uncaughtException in ../server.js). Dezelfde spoeling als
   SIGTERM, en daarna altijd exitcode 1 -- een crash mag nooit als nette
   afsluiting eindigen, want dan herstart geen proces-manager hem.

   Minstens 200 ms, zodat het log nog wegkomt; hooguit RTG_CRASH_GRACE_MS (5 s),
   zodat een write-behind die blijft hangen de herstart niet tegenhoudt. De
   timers staan NIET .unref(): een unref'd timer houdt het proces niet wakker, en
   was dit de laatste handle, dan viel het proces met exitcode 0 om. `exit` en
   `graceMs` zijn er voor de toets; in productie is het process.exit. */
function bijCrash({ save, flushBijAfsluiten, accounts, exit, graceMs }) {
  const stopMet = exit || ((code) => process.exit(code));
  const grens = Math.max(200, Number(graceMs || process.env.RTG_CRASH_GRACE_MS || 5000));
  let spoel = null;
  try { spoel = maakStopspoeling({ save, flushBijAfsluiten, accounts }); spoel.spoelSynchroon(); }
  catch (e) { try { save(); } catch (x) {} }
  const klaarNa = Date.now() + 200;
  let klaar = false;
  const einde = () => { if (!klaar) { klaar = true; stopMet(1); } };
  const stop = () => setTimeout(einde, Math.max(0, klaarNa - Date.now()));
  if (spoel) spoel.spoelAsynchroon().finally(stop); else stop();
  setTimeout(einde, grens);
}

module.exports = { maakStopspoeling, bijCrash };
