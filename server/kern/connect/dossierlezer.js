/* ============================================================================
   HET DOSSIER LEZEN -- de regels van EEN mens, en de hoogste trede per onderwerp.

   WAAROM APART VAN ./leerdossier.js. Dezelfde constructie als ./portfolio.js,
   dat op deze opslag al zo woont: een lezer krijgt `peil` en `trede` mee en kan
   daarmee PER CONSTRUCTIE niet schrijven. Wie hier iets wil bewaren, moet eerst
   de schrijver binnenhalen, en dat is precies het moment waarop iemand vraagt
   waarom.

   ER IS MET OPZET GEEN FUNCTIE DIE OVER SLEUTELS HEEN LEEST. Een sleutel in, de
   regels van DIE mens uit. Een lezer over meerdere dossiers zou de route zijn
   die HDI.md par. 5.1 verbiedt -- "alles over deze mens" zonder dat de mens zelf
   aanroept -- en in de vorm van een lijst mensen is hij nog erger.
   ========================================================================== */
'use strict';

module.exports = ({ peil, trede }) => {
  /* De hoogste trede PER ONDERWERP, met de graad van die trede erbij. Twee
     onderwerpen worden nooit opgeteld en nooit gesorteerd op trap: een lijst
     die op hoogte staat, is een ranglijst van je eigen leven. */
  function hoogste(sleutel) {
    const lijst = peil(sleutel);
    const per = new Map();
    for (const r of lijst) {
      const t = trede(r.trede);
      if (!t) continue;
      const nu = per.get(r.onderwerp);
      if (!nu || t.trap > nu.trap) per.set(r.onderwerp, { trap: t.trap, trede: t.id, naam: t.naam, graad: t.graad });
    }
    return [...per.entries()].sort((a, b) => a[0].localeCompare(b[0]))
      .map(([onderwerp, v]) => ({ onderwerp, trede: v.trede, naam: v.naam, graad: v.graad }));
  }

  function lees(sleutel, opties) {
    const o = opties || {};
    const lijst = peil(sleutel);
    const gefilterd = o.onderwerp ? lijst.filter(r => r.onderwerp === String(o.onderwerp)) : lijst;
    return {
      regels: gefilterd.slice().reverse().slice(0, Math.min(Number(o.max) || 200, 500)),
      totaal: gefilterd.length,
      /* Per ONDERWERP de hoogste trede, afgeleid en niet bewaard. En bewust
         geen getal eroverheen: een totaal over onderwerpen is een niveau. */
      perOnderwerp: hoogste(sleutel),
      nietGemeten: 'Dit dossier zegt wat er is gebeurd, niet hoe goed het ging. Er staat geen cijfer in, ' +
        'geen niveau en geen vergelijking met iemand anders -- ook niet verborgen als sorteervolgorde.'
    };
  }

  return { lees, hoogste };
};
