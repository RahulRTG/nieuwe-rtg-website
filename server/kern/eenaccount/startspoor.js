/* Eenaccount (deelbestand): WAT ER NA HET MUNTEN VAN EEN WERK-SESSIE WORDT
   VASTGELEGD, en de welzijnszin die erbij hoort. Uit ./starten.js gelicht toen
   dat bestand tegen de 10 kB aanliep.

   De logregel is een beschermde klokgebeurtenis (soort `klok-inlog`, besluit 2A
   van 11 oktober 2026): hij wordt volledig geschreven, maar alleen de manager
   en de medewerker zelf krijgen hem terug (kern/leverancier/logboekzicht.js). */
'use strict';
const klok = require('../../lib/klok');

module.exports = ({ db, save, logInlog, logActivity }) => {
  // geeft de welzijnszin terug, of null
  function naStart(s, actor, key, req) {
    logInlog('zaak', true, s.code + ' · ' + actor.name + ' via RTG-account', req);
    logActivity(s.code, actor, actor.name + ' logde in met het RTG-account', 'klok-inlog');
    /* Rahuls welzijnszin: een stille, eenmalige opmerking bij de start --
       nooit een blokkade, nooit een score, alleen zorg. Diep in de nacht
       of bij een zoveelste werkstart vandaag mag dat gezegd worden. */
    const uur = klok.datum().getHours();
    const wm = db.data.accountWelzijn = db.data.accountWelzijn || {};
    const vandaag = klok.datum().toISOString().slice(0, 10);
    const wr = wm[key] = (wm[key] && wm[key].dag === vandaag) ? wm[key] : { dag: vandaag, starts: 0 };
    wr.starts++;
    save();
    if (uur >= 23 || uur < 6) return 'Late dienst; neem morgen bewust je rust.';
    if (wr.starts >= 5) return 'Dit is al je ' + wr.starts + 'e werkstart vandaag; vergeet de pauze niet.';
    return null;
  }
  return { naStart };
};
