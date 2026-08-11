/* ============================================================================
   DE SPELWERELD-BEDRADING: een vak, en dezelfde schermen erop.

   VERHAAL.md stap 3. De motoren en de mount staan in kern/spelwereld.js en
   kern/spelwereld-mount.js; dit bestand hangt ze op. Een eigen bestand en geen
   regel in ./aanbouw.js, want die zit op 8,8 kB en de 10 kB-grens is precies de
   rem die dit soort aangroei hoort te stoppen.

   HIJ HANGT VOOR DE 404-AFHANDELING, en dat is geen detail maar de reden dat het
   een dispatcher is: werelden ontstaan tijdens het draaien, en een router die je
   later ophangt komt achter de catch-all te staan en wordt nooit bereikt. Zie de
   kop van ../kern/spelwereld-mount.js.

   HIJ IS UIT TENZIJ IEMAND HEM AANZET. Dezelfde vorm als ../opzet/liegpoort.js,
   en om dezelfde reden: een oefenomgeving die in productie zomaar meedraait is
   een oppervlak dat niemand heeft gevraagd. Met RTG_SPELWERELD=1 staat hij aan.
   Een pad dat je niet draait is een pad dat niet werkt, dus hij zit in de gewone
   keten en niet in een tweede opstartpad.
   ========================================================================== */
'use strict';

module.exports = function hangSpelwereldOp(kern, grens) {
  if (process.env.RTG_SPELWERELD !== '1') return null;
  const { app, db, save, express, log } = kern;
  const seed = require('../seed');

  const spelwereld = require('../kern/spelwereld')({ db, save, zaai: seed });
  const mount = require('../kern/spelwereld-mount')({
    spelwereld, kern, Router: express.Router,
    log: (t) => (log ? log(t) : console.warn(t))
  });

  /* Verlopen werelden opruimen bij het opstarten, en daarna dagelijks. Een
     wereld zonder eind blijft liggen tot iemand hem voor productie aanziet --
     dezelfde regel als bij de zandbakken. */
  for (const id of spelwereld.veeg()) mount.vergeet(id);
  const timer = setInterval(() => {
    for (const id of spelwereld.veeg()) mount.vergeet(id);
  }, Number(process.env.RTG_SPELWERELD_VEEG_MS || 86400000));
  if (timer.unref) timer.unref();

  /* DE LIJN. Alles onder /spelwereld/<id>/ gaat naar de wereld van die id; al
     het andere raakt hij niet aan. */
  app.use('/spelwereld', mount.handler);

  Object.assign(kern, { spelwereld, spelwereldMount: mount });
  console.log('[start] spelwerelden actief (' + spelwereld.lijst().length + ' bestaand)');
  return { spelwereld, mount };
};
