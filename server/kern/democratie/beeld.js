/* ============================================================================
   WAT EEN LEZER VAN EEN KWESTIE ZIET.

   Veld voor veld opgebouwd en nooit een kopie van het geheel: een nieuw veld op
   een kwestie komt pas naar buiten als iemand het hier bewust bijzet. Het
   INBRENGERSNUMMER gaat nooit mee, en de terugkoppeling alleen naar wie hem
   zelf ontvangt (`eigenRefs`); het kantoor ziet de eindstand, niet wie hem
   gelezen heeft. */
'use strict';

function maakBeeld() {
  return function publiek(k, eigenRefs) {
    return {
      id: k.id, onderwerp: k.onderwerp, gebied: k.gebied || null, at: k.at,
      rondes: k.rondes.map(r => ({
        nr: r.nr, stand: r.stand, geopend: r.geopend,
        eindstand: r.eindstand ? { stand: r.eindstand.stand, toelichting: r.eindstand.toelichting,
          bevoegdheid: r.eindstand.bevoegdheid, naar: r.eindstand.naar, in: r.eindstand.in,
          door: r.eindstand.door, at: r.eindstand.at } : null,
        terugkoppeling: (eigenRefs && r.terugkoppeling)
          ? (eigenRefs.map(ref => r.terugkoppeling[ref]).find(Boolean) || null) : undefined
      })),
      tijdlijn: k.tijdlijn.map(t => ({ at: t.at, wat: t.wat, ronde: t.ronde, stand: t.stand || t.naar || null }))
    };
  };
}

module.exports = { maakBeeld };
