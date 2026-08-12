/* Magnaat: DE AFSLUITING VAN EEN MAAND -- wat er ná de bedrijven gebeurt.

   Afgesplitst van ./maand.js op de naad die daar al lag. Dat bestand gaat over
   de VOLGORDE van een maand -- wie er wanneer rekent, en waarom dat vastligt --
   en dit over de drie dingen die pas kunnen zodra alle bedrijven gedraaid
   hebben: de contracten afwikkelen, de Foundation laten afdragen en bouwen, en
   het verslag opmaken.

   DE VOLGORDE IS DE UITLEG. Contracten worden NA de maand afgewikkeld, want de
   kwaliteitseis gaat over de kwaliteit die er DEZE maand geleverd is. De
   Foundation draagt af over de hele stad en niet alleen over de spelers, anders
   bouwt hij in een partij met twee mensen nooit iets. */
const F = require('./foundation');

const rond = (n) => Math.round(n);

module.exports = ({ wikkelAf, kiesProject }) => {
  return function afsluiten(potje, st, k, { perSpeler, actief, leverDeel, kwaliteitVan, druk,
    wereldOmzet, rentelast, premielast, schadelast, onderzoeklast, onderzoekUitPot, beheerlast,
    concernlast }) {
    /* DE CONTRACTEN AFWIKKELEN staat in ./maand-contracten.js -- na de maand,
       want de kwaliteitseis gaat over de kwaliteit die er DEZE maand geleverd
       is, en die volgt uit de maand. */
    const contractRegels = wikkelAf(st, actief, leverDeel, kwaliteitVan);

    /* De afdracht rust op de HELE stad en niet alleen op de spelers: anders
       bouwt de Foundation in een partij met twee mensen nooit iets. Zie de
       reden bij `stadsomzet` in de stadsdata. */
    const afdracht = F.draagAf(st.foundation, wereldOmzet + (k.stadsomzet || 0));
    /* Waar de bedrijvigheid zit, zodat de Foundation daar bouwt. Uit dezelfde
       telling die de concurrentiedruk gebruikt: een tweede telling zou een
       tweede antwoord op dezelfde vraag zijn. */
    const perZone = {};
    for (const sleutel of Object.keys(druk)) {
      const zone = sleutel.split(':')[0];
      perZone[zone] = (perZone[zone] || 0) + druk[sleutel];
    }
    /* WAT DE TAFEL KOOS (./governance.js). Hij staat HIER en niet in
       ./foundation.js omdat het een vraag aan de PARTIJ is (wie doet er nog
       mee) en niet aan de Foundation. Stemde niemand, dan geeft hij null en
       bouwt de vaste volgorde af zoals hij altijd deed. */
    const projecten = F.bouw(st.foundation, k, perZone, kiesProject ? () => kiesProject(potje) : null, st.maand);
    st.maand++;
    const verslag = { maand: st.maand, perSpeler, afdracht, projecten,
      wereldOmzet: rond(wereldOmzet), contractRegels,
      rentelast: rond(rentelast), premielast: rond(premielast), beheerlast: rond(beheerlast), concernlast: rond(concernlast),
      schadelast: rond(schadelast), onderzoeklast: rond(onderzoeklast),
      onderzoekUitPot: rond(onderzoekUitPot) };
    for (const h of potje.spelers) st.laatste[h] = { maand: st.maand, regels: perSpeler[h] || [],
      projecten, contracten: contractRegels[h] || [] };
    return verslag;
  };
};
