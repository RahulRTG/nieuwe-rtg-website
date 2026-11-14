/* ============================================================================
   HET KLANTBEELD VAN EEN SERVICEZAAK -- voortgang zonder interne besturing.

   Team, eigenaar, weging en Rahul-routering blijven in het kantoorbeeld. De
   melder ziet de eigen zaak en het gesprek, zonder dat interne overdrachten als
   klantbelofte of als verborgen label naar buiten lekken.
   ========================================================================== */
'use strict';

module.exports = function maakMelderbeeld(kort) {
  function kortMelder(z) {
    const k = kort(z);
    delete k.team;
    delete k.eigenaar;
    delete k.prioriteit;
    delete k.prioriteitNaam;
    return k;
  }

  function tijdlijnVoorMelder(z) {
    const intern = new Set(['rahulTriage', 'rahulAdvies', 'team', 'eigenaar', 'prioriteit']);
    return z.tijdlijn.filter(r => !intern.has(r.wat)).map(r => {
      const regel = Object.assign({}, r);
      if (regel.wat === 'stand' && regel.door === 'systeem' &&
          /^Zaak aangemaakt en toegewezen aan /.test(regel.notitie || '')) delete regel.notitie;
      return regel;
    });
  }

  return { kortMelder, tijdlijnVoorMelder };
};
