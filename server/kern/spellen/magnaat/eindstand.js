/* Magnaat: DE EINDSTAND -- waarop er wordt afgerekend, en waarop niet.

   Afgesplitst van ./weergave.js. Dat bestand gaat over WIE WAT ZIET tijdens de
   partij; dit over hoe de partij AFLOOPT. Twee onderwerpen die alleen een
   bestand deelden, en het tweede is af terwijl het eerste met elke laag meegroeit.

   DE WINNAAR IS HET HOOGSTE VERMOGEN -- geld plus wat je gebouwd hebt, minus wat
   je geleend hebt. Wie alles in zijn zaken heeft zitten hoort niet te verliezen
   van wie niets deed, en wie zijn vermogen bij elkaar geleend heeft evenmin.

   DE ANDERE DIMENSIES -- banen, reputatie, omzet -- staan op de eindstand en
   tellen NIET mee voor de winst. Ze laten zien wat voor ondernemer je was; er een
   tweede ranglijst van maken zou betekenen dat je op zes assen tegelijk aan het
   optimaliseren bent. */
module.exports = ({ codenaamVan, rond, waarde, eigenDeel, belangwaarde }) => {
  return function eindstand(potje) {
    const st = potje.staat;
    return potje.spelers.map(h => {
      const rij = st.vestigingen[h] || [];
      /* ALLEEN JE EIGEN DEEL, want een deelneming verplaatst waarde (./aandeel.js).
         Zou een eigenaar de hele waarde meetellen en de aandeelhouder ook zijn
         deel, dan staat dezelfde euro bij twee mensen op de eindstand en klopt
         de optelsom van de partij niet meer. */
      const ondernemingswaarde = rij.reduce((n, v) => n + waarde(v) * eigenDeel(st, v.id), 0)
        + belangwaarde(st, h);
      /* SCHULD GAAT ERAF, en dat is geen boekhoudkundige nettigheid maar een
         gat dat de geldpomp-keuring vond. Zonder deze regel telt geleend geld
         als vermogen: drie spelers die samen negen ton opnemen zetten negen ton
         op de eindstand, en op de laatste speeldag lenen is dan de goedkoopste
         manier om te winnen. Wat je van de bank hebt, is niet van jou. */
      const schuld = (st.leningen || [])
        .filter(l => l.speler === h && l.status === 'loopt')
        .reduce((n, l) => n + l.restant, 0);
      const banen = rij.reduce((n, v) => n + v.personeel, 0);
      const reputatie = rij.length ? Math.round(rij.reduce((n, v) => n + v.reputatie, 0) / rij.length) : 0;
      const omzet = rij.reduce((n, v) => n + (v.omzetTotaal || 0), 0);
      return {
        codenaam: codenaamVan(h),
        geld: rond(st.geld[h]), waarde: rond(ondernemingswaarde), schuld: rond(schuld),
        vermogen: rond(st.geld[h] + ondernemingswaarde - schuld),
        vestigingen: rij.length, banen, reputatie, omzet: rond(omzet)
      };
    }).sort((a, b) => b.vermogen - a.vermogen);
  };
};
