'use strict';
/* Alleen de expliciete duurzame commit. FULL synchroniseert het WAL bij de
   eigen commit; de hele database hoeft niet na iedere mutatie ingevouwen.
   https://sqlite.org/pragma.html#pragma_synchronous
   Er staat geen await tussen beleidsinstelling, transactie en herstel. */
module.exports = function duurzaam(db, schrijf, checkpoint) {
  const voor = db.prepare('PRAGMA synchronous').get().synchronous;
  if (![0, 1, 2, 3].includes(voor) || db.prepare('PRAGMA journal_mode').get().journal_mode !== 'wal')
    throw new Error('Duurzame SQLite-opslag vereist een bekende synchronisatiestand en WAL.');
  let bevestigd = false;
  try {
    if (voor < 2) db.exec('PRAGMA synchronous=FULL');
    if (![2, 3].includes(db.prepare('PRAGMA synchronous').get().synchronous))
      throw new Error('SQLite heeft de duurzame synchronisatiestand niet bevestigd.');
    const uit = schrijf();
    if (uit?.committed !== true) {
      // FULL instellen zonder schrijvende commit spoelt eerdere NORMAL-writes
      // niet. Ook een netto ongewijzigde bundel houdt daarom een echte barrière.
      if (uit?.alGelijk !== true || checkpoint() !== true)
        return { ...uit, duurzaam: false };
    }
    bevestigd = true;
    return { ...uit, duurzaam: true };
  } finally {
    if (voor < 2) {
      try { db.exec('PRAGMA synchronous=' + voor); }
      catch (e) {
        // De COMMIT-waarheid verandert niet door het terugzetten van de policy.
        // Gooi hier ook nooit over de oorspronkelijke opslagfout heen.
        console.warn('[db] SQLite-synchronisatie kon niet worden teruggezet; ' +
          (bevestigd ? 'de duurzame commit is bevestigd.' : 'de opslagfout blijft leidend.'));
      }
    }
  }
};
