/* Magnaat: IETS TERUGVINDEN IN DE STAAT -- welk kavel, welke vestiging, van wie.

   Vier vragen die overal in deze map gesteld worden. Ze stonden tussen de klok
   in ./economie.js en zijn met elke fase meegegroeid: fase B had er een nodig
   die OVER de grens tussen spelers heen kijkt (`wieHeeft`), en de veiling er
   een die een bouwrecht kent. Bij elkaar zijn het geen spelregels maar
   opzoekingen, en die horen niet tussen de levensloop van een partij. */
module.exports = ({ kaart }) => {
  const K = (st) => kaart(st.stad);
  /* Een kavel is vrij als er niets op staat EN er geen bouwrecht op rust. Een
     bouwrecht komt uit een gewonnen veiling (./veiling.js): wie een plek koopt,
     koopt de tijd om te bedenken wat erop komt. `wie` is er zodat de houder van
     het recht er zelf wel mag bouwen -- dezelfde vraag, twee antwoorden. */
  const vrijKavel = (st, id, wie) => K(st).kavel.has(id) && !st.kavelBezet[id]
    && (!(st.kavelRecht || {})[id] || st.kavelRecht[id] === wie);
  const mijnVestiging = (st, h, id) => (st.vestigingen[h] || []).find(x => x.id === id);
  /* Van wie is deze vestiging? Voor de contractlaag, die over de grens tussen
     twee spelers heen kijkt en dus niet met `mijnVestiging` toekan. */
  function wieHeeft(st, id) {
    for (const [h, rij] of Object.entries(st.vestigingen)) {
      const v = rij.find(x => x.id === id);
      if (v) return { speler: h, v };
    }
    return null;
  }

  return { K, vrijKavel, mijnVestiging, wieHeeft };
};
