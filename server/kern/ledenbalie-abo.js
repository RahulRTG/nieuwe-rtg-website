/* WAT DE BALIE OVER HET ABONNEMENT VAN EEN LID MAG ZEGGEN.

   Los van ./ledenbalie.js langs dezelfde naad als ./ledenbalie-zetels.js (de
   toegang), ./ledenbalie-zaken.js (de administratie) en
   ./ledenbalie-pseudoniem.js (de vertaling naar een steuncode): hier woont het
   GELD-beeld van een lid, en dat heeft zijn eigen bronnen -- de prijslijst en
   de pasladder -- die met de rest van de balie niets te maken hebben.

   TWEE DINGEN DIE HIER NIET GEBEUREN. Er wordt geen pas TOEGEKEND: een
   voorstel richting Lifestyle of Business blijft een voorstel, en het besluit
   is een mens (/api/aanmelding/beslis). En er wordt geen bedrag VERZONNEN: een
   pas die contractueel is (Business, Lifestyle) heeft geen bedrag in de
   prijslijst, en dan staat er `opMaat: true` met `maandbijdrage: null` in
   plaats van een getal dat niemand heeft afgesproken. Dat is PRIJZEN.md: een
   bodem is geen prijs, en een ontbrekend bedrag is geen nul. */
'use strict';

module.exports = ({ pasVan, geldPasprijzen, maandCentenVoor, contractueel, voorstellenVan }) =>
  function aboVan(u) {
    const pas = pasVan(u.tier);
    const passen = (() => { try { const p = geldPasprijzen && geldPasprijzen(); return (p && p.passen) || null; } catch (e) { return null; } })();
    const centen = maandCentenVoor(passen, pas);
    return { pas, pasNaam: (passen && passen[pas] && passen[pas].naam) || pas,
      // contractueel (Business, Lifestyle) heeft geen bedrag in de prijslijst
      opMaat: contractueel(pas),
      maandbijdrage: centen == null ? null : Math.round(centen) / 100,
      status: pas === 'gratis' ? 'gratis app' : 'lopend',
      voorstellen: voorstellenVan(u.id) };
  };
