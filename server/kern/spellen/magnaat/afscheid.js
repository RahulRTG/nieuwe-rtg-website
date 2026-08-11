/* Magnaat: AFSCHEID VAN EEN VESTIGING -- de ene weg naar buiten.

   Een zaak kan op drie manieren verdwijnen: de eigenaar sluit hem, iemand koopt
   hem in de veiling, of de bank wint zijn onderpand uit. Alle drie moeten
   dezelfde dingen doen -- lopende contracten afkopen, het kavel vrijgeven, de
   opbrengst uitkeren -- en drie plekken die dat elk zelf regelen zijn drie sets
   randgevallen die uiteen gaan lopen.

   HET IS BEWUST GEEN "FAILLISSEMENT". Een speler raakt hier een PAND kwijt en
   nooit zijn hele bedrijf; zie GAMEHALL.md 12.6 en de reden in ./bank.js. */
module.exports = ({ mijnVestiging, afkoopsom, rond }) => {
  /* Wat er met een onderpand gebeurt als de bank het opeist, loopt langs
     DEZELFDE weg als zelf sluiten: contracten worden afgekocht, het kavel komt
     vrij, de opbrengst is de halve bouwsom. Een tweede manier om een vestiging
     te laten verdwijnen zou een tweede set randgevallen zijn. */
  function liquideer(st, h, vestigingId) {
    const v = mijnVestiging(st, h, vestigingId);
    if (!v) return 0;
    const opbrengst = rond(v.gebouwdVoor * 0.5);
    for (const c of st.contracten || []) {
      if (c.status !== 'loopt') continue;
      if (c.leverancierId !== v.id && c.afnemerId !== v.id) continue;
      const som = afkoopsom(c, st.maand);
      const tegen = c.leverancier === h ? c.afnemer : c.leverancier;
      st.geld[h] -= som;
      st.geld[tegen] += som;
      c.status = 'afgekocht'; c.eindMaand = st.maand; c.afkoop = som;
    }
    st.vestigingen[h] = st.vestigingen[h].filter(x => x !== v);
    delete st.kavelBezet[v.kavel];
    return opbrengst;
  }

  return { liquideer };
};
