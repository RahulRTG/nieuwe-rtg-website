/* ============================================================================
   DE GEHEUGENKAART -- wat RTG van mij DENKT te weten, in mijn eigen woorden.

   Apart van ./index.js omdat het een andere vraag beantwoordt: dat bestand
   knoopt de laag aan elkaar, dit bestand maakt er iets van dat een mens kan
   lezen. En samen gingen ze over de tienkilobytegrens van keuringsregel 13.

   TWEE REGELS DIE DIT SCHERM DRAGEN

   1. HIJ TOONT OOK WAT NIET MEER MEETELT. Een geheugenkaart die alleen het
      geldige toont, verzwijgt wat er is opgeslagen -- en dan klopt hij precies
      op het moment dat iemand hem controleert. Wat stil staat, staat er MET de
      reden waarom.

   2. HIJ NOEMT ZIJN EIGEN RAND. Dezelfde vorm als
      kern/identiteit/gegevenskaart.js: een overzicht dat niet zegt wat het
      NIET laat zien, leest als "dit is alles". Vandaar `grenzen`, en die staan
      er even groot bij als de inhoud.

   De uitleg per grond en per doel komt uit ./besluiten.js en wordt hier
   niet overgetypt: twee schermen die dezelfde grond anders uitleggen, is de
   dubbeling die LAT-regel 4 verbiedt.
   ========================================================================== */
'use strict';

const { GRONDUITLEG, DOELUITLEG } = require('./besluiten');

module.exports = function maakGeheugen({ neiging }) {
  /* WAT WEET RTG VAN MIJ. Alles, ook het vervallene en het geweigerde, met per
     regel waar het vandaan komt en wat ermee mag. De uitleg reist mee met de
     rij en staat niet als lijst onderaan: een graad die je pas drie schermen
     verder kunt verklaren, wordt gelezen als een oordeel.

     De teksten komen uit ./besluiten.js en staan hier NIET nog een keer. Dat
     stond er wel, en het was precies de dubbeling waar de kop hierboven tegen
     waarschuwt: een lokale `DOELUITLEG` overschaduwde de geimporteerde, zodat
     het register wel werd binnengehaald en nooit gelezen. Twee plekken die
     dezelfde grond uitleggen lopen uiteen, en de kopie wint stil.
     test/neiging.test.js vergelijkt de uitvoer sindsdien met de bron. */

  function geheugen(key) {
    neiging.veeg(key);
    const rijen = neiging.alles(key).map(n => Object.assign({}, n, {
      grondUitleg: GRONDUITLEG[n.grond] || '',
      doelen: n.doel.map(d => ({ id: d, uitleg: DOELUITLEG[d] })),
      /* Waarom deze regel er niet meer toe doet, in plaats van hem weglaten. */
      ...(n.telt ? {} : { stil: n.geweigerd
        ? 'Jij hebt gezegd dat RTG dit nergens voor mag gebruiken.'
        : 'Hier is te lang niets meer van gebleken, dus RTG rekent er niet meer mee.' })
    }));
    return {
      ok: true,
      neigingen: rijen,
      telt: rijen.filter(r => r.telt).length,
      /* De rand van deze kaart, in de woorden van een lid. Dezelfde vorm als
         kern/identiteit/gegevenskaart.js: een overzicht dat zijn eigen rand
         niet noemt, leest als "dit is alles". */
      grenzen: [
        { naam: 'Dit is wat RTG van je DENKT, niet wat hij van je WEET',
          reden: 'Hier staan neigingen: dingen die je hebt gezegd of die RTG heeft opgemerkt. Je naam, adres en documenten staan er niet bij -- die vind je onder "Wat weet RTG van mij".' },
        { naam: 'Wat een app zelf bijhoudt, staat hier niet',
          reden: 'Je dieetwens bij een restaurant, je wensen in Vonk of je voorkeuren bij een club worden daar bewaard en horen daar thuis. Deze laag kopieert ze niet.' },
        { naam: 'Hier gaat niets naar buiten',
          reden: 'Een neiging gaat nooit naar een zaak of een andere partij. Wil je iets met een zaak delen, dan gaat dat apart en met een reden erbij die je kunt intrekken.' },
        { naam: 'Wat je zelf hebt gezegd, vervalt niet vanzelf',
          reden: 'RTG vergeet wat hij heeft geraden als er lang niets meer van blijkt. Wat jij hem hebt verteld blijft staan tot jij het weghaalt.' }
      ],
      doelen: neiging.DOELEN.map(d => ({ id: d, uitleg: DOELUITLEG[d] })),
      bewaardagen: neiging.BEWAARDAGEN
    };
  }

  return { geheugen };
};
