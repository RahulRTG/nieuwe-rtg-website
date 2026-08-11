/* Magnaat: DE CONTRACTAFWIKKELING -- wie er deze maand betaalt en wie er boet.

   Afgesplitst van ./maand.js. Dat bestand rekent de MAAND van een wereld: de
   drukte, de bedrijven, de rente, de Foundation. Dit stuk gaat over EEN ding --
   wat er over de lopende contracten heen en weer gaat -- en het is precies het
   stuk waar de boekhouding moet kloppen tot op de euro.

   DE LEVERANCIER IS AL BETAALD: zijn contractomzet zit in zijn maand (zie
   ./stap.js). Hier gaat alleen de andere kant rond -- de afnemer betaalt, en
   boetes lopen van leverancier naar afnemer. Zo staat elk bedrag EEN keer op
   een rekening, en klopt de som over alle spelers. */
const H = require('./handel');

module.exports = ({ rond }) => {
  function wikkelAf(st, actief, leverDeel, kwaliteitVan) {
    const contractRegels = {};
    for (const c of actief) {
      const r = H.afwikkelen(c, { geleverd: c.eenheden * (leverDeel[c.leverancierId] || 0),
        kwaliteit: kwaliteitVan[c.leverancierId] === undefined ? 0 : kwaliteitVan[c.leverancierId] });
      st.geld[c.afnemer] -= r.betaling;
      c.betaald += r.betaling; c.ontvangen += r.betaling;
      if (r.boete > 0) {
        st.geld[c.leverancier] -= r.boete;
        st.geld[c.afnemer] += r.boete;
        c.boetes += r.boete;
        c.maandenTekort++;
      } else c.maandenGeleverd++;
      const regel = { id: c.id, soort: c.soort, geleverd: rond(r.geleverd), toegezegd: c.eenheden,
        bedrag: rond(r.betaling), boete: rond(r.boete), tekort: r.tekort, onderMaat: r.onderMaat };
      for (const kant of ['leverancier', 'afnemer'])
        (contractRegels[c[kant]] = contractRegels[c[kant]] || []).push(Object.assign({ rol: kant }, regel));
      if (st.maand + 1 >= c.eindMaand) c.status = 'afgelopen';
    }
    return contractRegels;
  }

  return { wikkelAf };
};
