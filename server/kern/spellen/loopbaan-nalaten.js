/* WAT IEMAND ACHTERLIET BIJ WIE DOORGING -- de nalatenschap.

   Afgesplitst van ./loopbaan-noteren.js toen dat bestand op de 10 kB-grens
   knelde, en de naad zat er al in: dat bestand gaat over DIENSTVERBANDEN -- wie
   voor wie werkte, wat daaruit volgde -- en dit over een OVERDRACHT. Twee
   gebeurtenissen die allebei een moment opleveren, maar die niets met elkaar te
   maken hebben: je kunt je zaak doorgeven zonder ooit iemand in dienst te
   hebben gehad, en dat is precies de campagne waarin de overdracht het enige is
   wat er te onthouden viel.

   DE ASYMMETRIE IS DE KERN, en die staat hieronder uitgeschreven: wie stopt
   onthoudt aan wie hij het gaf, wie doorgaat onthoudt van wie hij het kreeg. */
'use strict';

module.exports = ({ onthoud, duur, codenaamVan }) => {
  /* ---------- de nalatenschap: wat je achterliet bij wie doorging ----------

     DRIE REGELS, en ze volgen alle drie uit lagen die er al stonden.

     1. GEEN OPVOLGER, GEEN MOMENT. Wie zonder opvolger uitstapt wikkelt af en
        laat niemand achter. Dan is er geen tweede mens, en `onthoud` weigert
        zo'n moment sowieso -- de wet van deze laag is dat een herinnering twee
        mensen raakt. Hier wordt hij niet eens aangeboden.
     2. TWEE KANTEN, ELK OP ZIJN EIGEN CODENAAM EN ELK MET ZIJN EIGEN GRENS. Een
        volwassene die met een tiener speelde houdt zijn eigen kant; de tiener
        houdt niets. Daarom staan hier twee aanroepen en geen gedeelde vlag.
     3. WAT HIJ ONTHOUDT IS EEN DUUR. Zie de kop hierboven. */
  function noteerNalatenschap(potje) {
    const weg = ((potje && potje.staat) || {}).uit || {};
    const uit = [];
    for (const [h, w] of Object.entries(weg)) {
      /* Wie met lege handen vertrok liet ook niets achter, en een moment
         daarover zou een herinnering aan een leegte zijn. */
      if (!w || !w.naar || !(w.overgedragen > 0)) continue;
      const van = codenaamVan(h), naar = codenaamVan(w.naar);
      const hoelang = duur(w.maand || 0);
      const a = onthoud(h, van, 'doorgegeven', { samen: naar, wat: hoelang, potje: potje.id });
      const b = onthoud(w.naar, naar, 'overgenomen', { samen: van, wat: hoelang, potje: potje.id });
      if (a.bewaard || b.bewaard) uit.push({ van, naar, maand: w.maand || 0 });
    }
    return uit.length ? uit : null;
  }


  return { noteerNalatenschap };
};
