/* UITVOERENDE MEDIA (deelmodule): WAT EEN STUK KAN DOEN.

   De vierde kolom van een partituur (UITVOEREND.md par. 2). Een onderdeel kan
   een HANDELING dragen: iets wat een kijker op dat moment in het werk kan doen.

   DE HANDELING WORDT VERKLAARD, NOOIT GEDETECTEERD. Dat is geen beperking maar
   de enige eerlijke vorm hier, en het volgt uit de architectuur: RTG heeft de
   clipbytes niet en hercomprimeert het Theater niet, dus er is geen moment
   waarop een pan of een gitaar HERKEND kan worden. Een gokje zou eruitzien als
   een feit en dat niet zijn -- precies wat kern/mediaos/hub.js al weigert bij
   "de officiele videoclip bij dit nummer". De maker wijst dus aan wat er te doen
   is, op de seconde waar hij het bedoelt.

   TWEE SOORTEN, EN ER KOMT ER GEEN DERDE ZONDER RAIL. Elke soort verwijst naar
   iets dat in dit huis AL bestaat en al een weg heeft; een handeling die een
   nieuwe weg zou vragen, hoort niet hier te ontstaan maar daar.

     aanbod   een andere partituur van deze maker waar een prijs op staat.
              Klaarzetten opent de BON (kern/uitvoering/aanbod.js) -- kopen doet
              het lid daarna zelf.
     stuk     een ander stuk in de mediawereld. Een verwijzing, meer niet.

   KLAARZETTEN, NOOIT DOEN. Er zit in dit bestand geen enkele weg naar geld of
   naar een tweede persoon. Een handeling levert een KAART op met wat er te doen
   is; bevestigen doet de mens op een scherm van RTG (GELD.md par. 3, LIFE.md).
   Zou hier een `pay`-aanroep staan, dan was een uitvoering een manier om iets af
   te rekenen zonder dat iemand erop tikte.

   EN DE DEUR BLIJFT VAN HET DOMEIN. Een handeling wordt opgelost met de sessie
   van de KIJKER, net als het fragment zelf. Wijst een maker naar iets wat deze
   kijker niet mag zien, dan staat de handeling er als onbeschikbaar met de reden
   -- geen dode knop, en geen kijkje achter een dichte deur. */
'use strict';

const SOORTEN = {
  aanbod: 'Iets van deze maker dat te koop is; u ziet eerst wat het kost.',
  stuk: 'Een ander stuk in de mediawereld.'
};

module.exports = ({ catalogus, partituurMet, codenaamVan }) => {

  /* Wat de maker mag vastleggen. Alles wat niet klopt levert GEEN handeling op
     in plaats van een halve: een knop waarvan de helft ontbreekt, is erger dan
     geen knop (LAT.md regel 5). */
  /* Heet met opzet niet `schoon`: die naam staat al in kern/util.js en in
     kern/spellen/projectie.js, en een derde maakt hem stomp -- dan zegt "schoon"
     niets meer over WAT er wordt opgeschoond. */
  function schoneHandeling(h, schoonTekst) {
    if (!h || typeof h !== 'object') return null;
    const soort = String(h.soort || '');
    if (!SOORTEN[soort]) return null;
    const doel = String(h.doel || '').trim();
    if (!doel) return null;
    const label = schoonTekst(h.label, 60);
    return { soort, doel, label: label || null };
  }

  /* Oplossen met de sessie van de KIJKER, op het moment van uitvoeren. Geeft
     altijd een kaart terug -- ook als hij dicht is, want dan hoort de kijker te
     lezen dat de maker hier iets bedoelde en waarom het er niet is. */
  function los(sess, h, makerKey) {
    if (!h) return null;
    if (h.soort === 'aanbod') {
      const p = partituurMet(h.doel);
      if (!p || !p.klaar) return { soort: h.soort, open: false, label: h.label,
        reden: 'Wat de maker hier aanbood, staat op dit moment niet klaar.' };
      /* Alleen eigen aanbod. Een maker die naar het betaalde werk van een ANDER
         wijst, zou binnen zijn eigen werk reclame maken voor een derde -- en dat
         is een besluit van dit huis en niet van een maker. */
      if (p.key !== makerKey) return { soort: h.soort, open: false, label: h.label,
        reden: 'Deze verwijzing hoort niet bij het werk van deze maker.' };
      if (!(p.prijsCenten > 0)) return { soort: h.soort, open: false, label: h.label,
        reden: 'Hier wordt geen geld voor gevraagd; er valt niets klaar te zetten.' };
      return { soort: h.soort, open: true, label: h.label || p.naam,
        partituurId: p.id, naam: p.naam, centen: p.prijsCenten,
        /* Het WERKWOORD staat in de kaart en niet op het scherm: een scherm dat
           zelf mag kiezen tussen "bekijk" en "koop", kiest op een dag "koop". */
        wat: 'klaarzetten', let: 'U ziet eerst de bon; betalen doet u zelf.' };
    }
    // een ander stuk: bestaat het voor DEZE kijker?
    const wereld = catalogus.alles(sess);
    const rij = wereld.rijen.find(r => r.id === h.doel);
    if (!rij) return { soort: h.soort, open: false, label: h.label,
      reden: 'Dit stuk is er niet meer voor u: weggehaald door de maker, of achter een deur die nu dicht staat.' };
    return { soort: h.soort, open: true, label: h.label || rij.titel,
      stukId: rij.id, naam: rij.titel, vormNaam: rij.vormNaam, wat: 'openen' };
  }

  return { schoneHandeling, los, SOORTEN };
};
