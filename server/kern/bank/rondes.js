/* Periodieke bankuitvoering. Alleen bestaande rente/incasso- en opdrachtacties;
   geen grootboek of nieuwe betaalroute. Een trage ronde mag bij de volgende tik
   niet opnieuw starten. De twee soorten rondes houden hun eigen bezetvlag.
   De bestaande termijnen, volgorde en foutmelding blijven behouden. */
'use strict';
module.exports = ({ rente, incasso, opdrachten, omgeving = process.env,
  zet = setInterval, wis = clearInterval, meld = bericht => console.warn(bericht) }) => {
  let gestopt = false;
  function plan(werk, ms, naam) {
    let bezig = false;
    const timer = zet(async () => {
      if (gestopt || bezig) return;
      bezig = true;
      try { await werk(); }
      catch (e) { meld('[bank] ' + naam + ' mislukt: ' + e.message); }
      finally { bezig = false; }
    }, ms);
    if (timer.unref) timer.unref();
    return timer;
  }
  const rondes = plan(async () => { await rente(); await incasso(); },
    Number(omgeving.BANK_RONDE_MS || 3600000), 'ronde');
  const opdrachtenTimer = plan(opdrachten,
    Number(omgeving.BANK_OPDRACHT_RONDE_MS || 60000), 'opdrachtenronde');
  return () => { gestopt = true; wis(rondes); wis(opdrachtenTimer); };
};
