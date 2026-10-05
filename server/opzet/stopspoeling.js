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

module.exports = { maakStopspoeling };
