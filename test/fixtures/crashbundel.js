/* Kindproces voor test/stopspoeling.test.js (RTG-V1-RELEASE D1): een geldbundel
   in twee helften met een crash ertussen, op de ECHTE opslag. Draai met
   RTG_STORE=sqlite en een eigen RTG_DATA_DIR. Modi: zaai, lees, crash-in-bundel.
   Overgenomen uit de reproductie van de onafhankelijke herkeuring. */
'use strict';
const { setTimeout: wacht } = require('node:timers/promises');
const d = require('../../server/db');
const { bijCrash } = require('../../server/opzet/stopspoeling');
const modus = process.argv[2];

(async () => {
  await d.load();
  const { db, save, bijeen, inBundel, flushBijAfsluiten } = d;
  if (modus === 'zaai') {
    db.data.proefSaldi = { X: 100, Y: 0 };
    save(); await flushBijAfsluiten();
    process.exit(0);
  }
  if (modus === 'lees') { process.stdout.write(JSON.stringify(db.data.proefSaldi)); process.exit(0); }
  process.on('uncaughtException', () =>
    bijCrash({ save, flushBijAfsluiten, accounts: { flushBijAfsluiten: async () => {} }, inBundel }));
  if (modus === 'crash-in-bundel') {
    await bijeen(async () => {
      db.data.proefSaldi.X -= 50; save();
      setTimeout(() => { throw new Error('crash midden in de bundel'); }, 0);
      await wacht(3000);
      db.data.proefSaldi.Y += 50; save();
    });
  }
})();
