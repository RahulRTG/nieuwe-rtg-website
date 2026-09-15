/* DE SAMENSTELLING WORDT EEN STEL GELDRIJEN -- puur, zonder db, pay of sessie.

   Afgeknipt van ./reisbureau-betaling.js op de naad die keuringsregel 13 al twee
   keer in deze tak heeft aangewezen: een BEREKENING staat los van een
   GEBEURTENIS. Hier komt een reis en een aantal personen in, en er komt een stel
   herkomstrijen uit; er wordt niets geboekt en niets bewaard.

   Dat die twee uit elkaar staan is niet alleen maat: de invariant hieronder --
   de rijen tellen op tot precies de reissom -- is hierdoor aantoonbaar zonder
   dat er een server draait, en dat is wat toets 4 van test/reisherkomst.test.js
   doet. */
'use strict';

const { geldrij } = require('./waarde/economischeherkomst');
const { voorAanvraag } = require('./reisbureau-samenstelling');

/* ---------- PUUR: de samenstelling wordt een stel geldrijen ----------
   Geen db, geen pay, geen sessie -- zodat een toets hem kan voeden zonder dat er
   een server draait, en zodat de invariant hieronder aantoonbaar is in plaats
   van beloofd. */
function geldrijenVoor({ trip, personen, boekingId, valuta }) {
  const s = voorAanvraag(trip, personen);
  if (!s.bekend) return { ok: false, waarom: s.waarom, rijen: [], totaalCenten: null };

  const bron = boekingId ? ('payboeking:' + boekingId) : null;
  const rijen = s.regels.map(o => geldrij({
    bedragCenten: o.centen,
    valuta: valuta || 'EUR',
    /* WIE BETAALDE: het lid. Voor elke rij dezelfde, want er is een betaler. */
    economischeHerkomst: 'lid',
    /* AAN WIE HIJ TOEKOMT: per onderdeel verschillend, uit de commerciele bron
       en nergens afgeleid. */
    economischeEigenaar: o.eigenaar,
    /* WAAR HET GELD FEITELIJK HEEN GING: naar RTG. Ook voor het deel van het
       hotel -- dat is de hele reden dat dit veld bestaat. Zou hier `derde`
       staan, dan beweert de rij een uitkering die niet heeft plaatsgevonden. */
    naarWie: 'rtg',
    grond: o.wat || o.soort,
    bronObject: bron,
    relatie: o.leverancier || null,
    /* HET LAND BLIJFT LEEG. `trip.dest` is een plaatsnaam ("Ibiza") en daar
       valt geen landcode uit af te leiden zonder te raden -- dezelfde regel als
       in KAARTEN.md: een ingelezen waarde wordt nooit stilletjes verbeterd. */
    land: null,
    bewijs: 'kern/reisbureau-samenstelling.js, onderdeel van reis ' + String(trip && trip.id || '?')
  }));

  /* DE INVARIANT VAN DEZE SCHAKEL: de herkomstrijen tellen op tot precies het
     bedrag dat het lid betaalde. Niet "ongeveer", en er wordt geen restrij
     bijgemaakt om het kloppend te krijgen -- een restrij zonder eigenaar is
     precies de cent die later aan de verkeerde kant van de streep belandt. */
  const som = rijen.reduce((a, r) => a + (r.bedragCenten || 0), 0);
  if (som !== s.totaalCenten) {
    return {
      ok: false, rijen: [], totaalCenten: null,
      waarom: 'de herkomstrijen tellen op tot ' + som + ' cent en de reissom is ' + s.totaalCenten +
        ' cent. Er wordt niets bijgeboekt om het verschil te dekken.'
    };
  }
  return { ok: true, rijen, totaalCenten: s.totaalCenten, personen: s.personen, waarom: null };
}

module.exports = { geldrijenVoor };
