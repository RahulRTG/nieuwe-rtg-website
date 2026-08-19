/* WAT ER UIT DEZE LAAG KOMT ZONDER DAT ER GELD BEWEEGT.

   Vier dingen, en geen ervan raakt een saldo aan: klopt de boekhouding
   (sluitcontrole), wat is er over EEN rekening te zien (boekingenVan), een
   zacht seintje naar het lid dat er iets veranderd is, en de schaduwstand voor
   het statusbord.

   WAAROM DIT EEN EIGEN BESTAND IS. ./index.js stond op 11310 byte, over de
   grens uit keuringsregel 13. Lezen en schrijven scheiden is daar de rustigste
   naad: wie hier iets verandert kan per definitie geen geld verplaatsen, en dat
   is bij deze laag geen detail.

   WAT ER BINNENKOMT. De twee lezers van de opslag, de weg naar het lid, en de
   schaduwklant. Geen save en geen boek -- als die hier binnenkwamen was het
   geen kijkkant meer, en dat is precies de eigenschap die dit bestand draagt.
   ========================================================================== */
'use strict';

const { vingerafdruk } = require('./vingerafdruk');

module.exports = ({ saldi, grootboek, keyVanCodenaam, sseToCustomer, schaduw }) => {
  // de sluitcontrole: som van alle saldi is nul, en niemand staat rood
  function sluitcontrole() {
    let som = 0;
    const rood = [];
    for (const [rek, c] of Object.entries(saldi())) {
      som += c;
      if (!rek.startsWith('extern:') && c < 0) rood.push(rek);
    }
    return { klopt: som === 0 && !rood.length, som, rood };
  }

  /* Alleen-lezen: de boekingen van EEN rekening, nieuwste eerst, als kopieen.
     Toegevoegd voor de geldgraaf (kern/geldgraaf), om dezelfde reden als rekLid
     in ./index.js: de vorm van het grootboek is een regel van dit domein, en wie
     hem elders nableest, leest hem morgen verkeerd (LAT.md regel 4).
     Kopieen en geen verwijzingen, want wie meekijkt mag het grootboek niet
     kunnen verbouwen; en een harde cap, want een projectielaag heeft aan de
     recente geschiedenis genoeg en mag het warme geldpad niet vertragen. */
  function boekingenVan(rek, tot) {
    const max = Math.max(1, Math.min(1000, Math.round(Number(tot) || 200)));
    const uit = [];
    for (const b of grootboek()) {
      if (b.van !== rek && b.naar !== rek) continue;
      uit.push({ id: b.id, van: b.van, naar: b.naar, centen: b.centen, soort: b.soort, oms: b.oms, ref: b.ref, at: b.at });
      if (uit.length >= max) break;
    }
    return uit;
  }

  // een zachte melding naar het lid (best effort; de app pollt sowieso)
  function seintje(codenaam) {
    try {
      Promise.resolve(keyVanCodenaam(codenaam))
        .then(t => { if (t && t.key) sseToCustomer(t.key, 'sync', { scope: 'pay' }); })
        .catch(() => {});
    } catch (e) {}
  }

  // schaduw-stand voor het statusbord (drift-detector): vergelijkt de JS-stand
  // met de Rust-motor -- niet alleen de som maar ook een vingerafdruk over ALLE
  // saldi, zodat per-rekening-drift die de som mist er alsnog uit komt. De afdruk
  // wordt alleen hier berekend (statusbord-poll), niet in het warme geld-pad.
  // `aan` is false als RTG_MOTOR_SHADOW niet is gezet.
  const schaduwStand = { aan: schaduw.aan,
    stand: () => schaduw.stand(sluitcontrole().som, vingerafdruk(saldi())) };

  return { sluitcontrole, boekingenVan, seintje, schaduwStand };
};
