/* ============================================================================
   IETS OPENEN -- de enige plek waar de trede `gezien` ontstaat.

   MET OPZET NIET BIJ HET TONEN. Een dossier dat volloopt met alles wat langskwam
   meet aandacht en geen leren; dat is precies het verschil dat de eerste trede
   van ./leerdossier.js uitschrijft. Openen is een HANDELING van de mens, tonen
   is iets wat het scherm doet.

   WAAROM DIT EEN EIGEN BESTAND IS. Het hoort bij ./werkbij.js en niet bij de
   bedrading: allebei schrijven ze een dossierregel als gevolg van iets wat een
   mens deed, en allebei doen ze dat over TWEE dossiers tegelijk. Die tweede kant
   is de hele reden dat de code langer is dan hij eruitziet.
   ========================================================================== */
'use strict';

const { bronKlopt, weigering } = require('./verwijzing');

module.exports = ({ noteer, makerVan }) => {
  function open(sleutel, item) {
    const i = item || {};

    /* EERST DE VERWIJZING, DAN DE REGEL. `i.id` komt van een mens en wordt
       ongezien in het dossier bewaard EN teruggegeven; zonder deze zeef is dat
       een kladblok waar ook de naam van iemand anders in past. Zie de kop van
       ./verwijzing.js voor wat deze controle wel en niet belooft. */
    const v = bronKlopt(i.id);
    if (!v.ok) return { ok: false, reden: weigering(v.reden) };
    const eigen = noteer(sleutel, { trede: 'gezien', onderwerp: i.onderwerp,
      bron: i.id, door: 'hetSysteem', werkwoord: 'ontdek', herkomst: i.herkomst });

    /* DE ANDERE KANT: is dit werk van IEMAND ANDERS, dan is het zojuist bij een
       mens aangekomen. Dat is de trede `bereikt` bij de MAKER, en hij is met
       opzet `eenmalig` -- anders schrijft deze regel een teller in het dossier
       van iemand anders, en is het dossier van een maker een kijklog geworden
       waar hij zelf niets aan kan doen.

       DE MAKER WORDT OPGEZOCHT EN NOOIT AANGENOMEN, net als bij de naklank.
       `bereikt` draagt `aanspraak: 'geen'` en komt dus niet in het portfolio:
       dat je werk ergens aankwam is BEREIK, en bereik is aandacht. Het staat er
       omdat het het eerlijke verschil is met "aangeboden", en verder nergens
       voor. */
    let bereikt = null;
    let werk = null;
    try { werk = makerVan ? makerVan(String(i.id || '')) : null; } catch (e) { werk = null; }
    if (werk && werk.sleutel && String(werk.sleutel) !== String(sleutel || '')) {
      bereikt = noteer(werk.sleutel, { trede: 'bereikt', onderwerp: werk.onderwerp,
        bron: String(i.id), door: 'hetSysteem', werkwoord: 'deel', herkomst: 'connect' });
    }
    return Object.assign({}, eigen, { bereikteMaker: !!(bereikt && bereikt.ok && bereikt.nieuw) });
  }

  return { open };
};
