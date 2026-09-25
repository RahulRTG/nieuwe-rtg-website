/* ============================================================================
   WAT EEN LEZER VAN EEN KWESTIE ZIET.

   Veld voor veld opgebouwd en nooit een kopie van het geheel: een nieuw veld op
   een kwestie komt pas naar buiten als iemand het hier bewust bijzet. Het
   INBRENGERSNUMMER gaat nooit mee, en de terugkoppeling alleen naar wie hem
   zelf ontvangt (`eigenRefs`); het kantoor ziet de eindstand, niet wie hem
   gelezen heeft.

   HET KANTOOR ZIET TIJDEN ALLEEN TOT OP DE DAG, en geen regels over de
   terugkoppeling of over volgers. Een exact tijdstip van "gezien" of van het
   inbrengen is naast een willekeurig log met tijden een sleutel naar de mens.
   De opgeslagen tijden blijven exact (de hashketen hangt eraan); alleen wat
   naar buiten gaat, wordt grover. */
'use strict';

const VERBORGEN_VOOR_KANTOOR = ['terugkoppeling', 'volgers'];

function maakBeeld() {
  return function publiek(k, eigenRefs) {
    const tijd = (t) => (eigenRefs ? t : (t ? String(t).slice(0, 10) : t));
    const regels = eigenRefs ? k.tijdlijn : k.tijdlijn.filter(t => !VERBORGEN_VOOR_KANTOOR.includes(t.wat));
    return {
      id: k.id, onderwerp: k.onderwerp, gebied: k.gebied || null, at: tijd(k.at),
      rondes: k.rondes.map(r => ({
        nr: r.nr, stand: r.stand, geopend: tijd(r.geopend),
        eindstand: r.eindstand ? { stand: r.eindstand.stand, toelichting: r.eindstand.toelichting,
          bevoegdheid: r.eindstand.bevoegdheid, naar: r.eindstand.naar, in: r.eindstand.in,
          door: r.eindstand.door, at: tijd(r.eindstand.at) } : null,
        terugkoppeling: (eigenRefs && r.terugkoppeling)
          ? (eigenRefs.map(ref => r.terugkoppeling[ref]).find(Boolean) || null) : undefined
      })),
      tijdlijn: regels.map(t => ({ at: tijd(t.at), wat: t.wat, ronde: t.ronde, stand: t.stand || t.naar || null }))
    };
  };
}

module.exports = { maakBeeld };
