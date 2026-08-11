/* Magnaat: AFSCHEID VAN EEN VESTIGING -- de ene weg naar buiten.

   Een zaak kan op drie manieren verdwijnen: de eigenaar sluit hem, iemand koopt
   hem in de veiling, of de bank wint zijn onderpand uit. Alle drie moeten
   dezelfde dingen doen -- lopende contracten afkopen, het kavel vrijgeven, de
   opbrengst uitkeren -- en drie plekken die dat elk zelf regelen zijn drie sets
   randgevallen die uiteen gaan lopen.

   HET IS BEWUST GEEN "FAILLISSEMENT". Een speler raakt hier een PAND kwijt en
   nooit zijn hele bedrijf; zie GAMEHALL.md 12.6 en de reden in ./bank.js. */
module.exports = ({ mijnVestiging, afkoopsom, rond }) => {
  /* EEN HYPOTHEEK REIST MEE MET HET PAND, en dat ontbrak. Een speler kon een
     verhypothekeerd pand verkopen, de opbrengst houden en de lening laten staan
     -- met een onderpand dat vanaf dat moment van een ander was. De bank hield
     dus zekerheid op een gebouw van iemand die nergens getekend had, en de
     verkoper liep weg met de kas EN de schuld die er niet meer door gedekt was.

     Wat er nu gebeurt is wat er in het echt gebeurt: bij de overgang wordt de
     schuld op dat pand AFGELOST uit de opbrengst. Wat er overblijft is voor de
     verkoper; is de opbrengst te klein, dan blijft de rest als schuld staan --
     maar dan zonder zekerheid, en dat is een eerlijke uitkomst voor wie zijn
     onderpand onder de schuld vandaan verkoopt.

     Hij staat HIER omdat dit de module is die weet hoe een vestiging uit
     iemands handen gaat. Drie plekken die dit elk zelf regelen zijn drie sets
     randgevallen die uiteen gaan lopen -- precies waarom dit bestand bestaat. */
  function losOnderpandAf(st, h, vestigingId, opbrengst) {
    let afgelost = 0;
    for (const l of st.leningen || []) {
      if (l.status !== 'loopt' || l.onderpand !== vestigingId || l.speler !== h) continue;
      const nu = Math.min(l.restant, Math.max(0, opbrengst - afgelost));
      if (nu <= 0) { l.onderpand = null; l.zekerheidWeg = true; continue; }
      l.restant -= nu;
      l.betaaldAflossing = (l.betaaldAflossing || 0) + nu;
      afgelost += nu;
      if (l.restant <= 1) { l.restant = 0; l.status = 'afgelost'; l.eindMaand = st.maand; }
      else { l.onderpand = null; l.zekerheidWeg = true; }
    }
    return rond(afgelost);
  }

  /* Wat er met een onderpand gebeurt als de bank het opeist, loopt langs
     DEZELFDE weg als zelf sluiten: contracten worden afgekocht, het kavel komt
     vrij, de opbrengst is de halve bouwsom. Een tweede manier om een vestiging
     te laten verdwijnen zou een tweede set randgevallen zijn. */
  /* `losAf` staat standaard AAN: wie zijn zaak sluit, lost de hypotheek erop af
     uit de opbrengst. De BANK zet hem uit als hij zijn eigen onderpand uitwint --
     die verrekent de opbrengst daarna zelf met de lening, en twee keer aflossen
     zou de speler zijn schuld dubbel laten betalen. */
  function liquideer(st, h, vestigingId, losAf = true) {
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
    return losAf ? opbrengst - losOnderpandAf(st, h, v.id, opbrengst) : opbrengst;
  }

  /* EEN VESTIGING DIE VAN EIGENAAR WISSELT, en dit is de enige weg. Hij stond in
     ./veiling.js, en toen er een tweede manier bij kwam om een zaak over te
     nemen (./overname.js) waren dat meteen twee sets randgevallen: de hypotheek,
     de contracten, het contract-met-jezelf. Precies waarvoor dit bestand bestaat
     -- het staat in de kop hierboven, en het is nu ook zo.

     WIE KOOPT, KOOPT DE ZAAK MET ALLES ERAAN. De contracten verhuizen mee: zou
     een overname ze breken, dan is verkopen een manier om je verplichtingen
     kwijt te raken, en dan is elke leverancier een risico dat je niet kunt
     inschatten. */
  function verhuis(st, naar, vestigingId, prijs) {
    let van = null, v = null;
    for (const [h, rij] of Object.entries(st.vestigingen)) {
      const gevonden = rij.find(x => x.id === vestigingId);
      if (gevonden) { van = h; v = gevonden; break; }
    }
    if (!v || van === naar) return null;
    st.geld[naar] -= prijs;
    // eerst de hypotheek, dan de verkoper
    const afgelost = losOnderpandAf(st, van, v.id, prijs);
    st.geld[van] += prijs - afgelost;
    st.vestigingen[van] = st.vestigingen[van].filter(x => x !== v);
    st.vestigingen[naar].push(v);
    st.kavelBezet[v.kavel] = naar;
    let mee = 0;
    for (const c of st.contracten || []) {
      if (c.status !== 'loopt') continue;
      if (c.leverancierId === v.id) { c.leverancier = naar; mee++; }
      if (c.afnemerId === v.id) { c.afnemer = naar; mee++; }
    }
    /* Een contract met JEZELF kan niet bestaan: dan is er geen wederpartij meer
       die de boete int, en zou een speler zichzelf onbeperkt kunnen beboeten of
       betalen. Zo'n contract wordt afgekocht tegen de gewone som -- betaald door
       de koper, die dit wist toen hij bood. */
    for (const c of st.contracten || []) {
      if (c.status !== 'loopt' || c.leverancier !== c.afnemer) continue;
      /* DE SOM EERST, DAN PAS `eindMaand` ZETTEN. `afkoopsom` leest die datum,
         dus wie hem eerst verzet rekent met de verkeerde resterende looptijd --
         en dan komt er nul uit. Precies dat ging mis toen deze regels hierheen
         verhuisden. */
      const som = afkoopsom(c, st.maand);
      c.status = 'afgekocht'; c.eindMaand = st.maand; c.afkoop = som;
      mee--;
    }
    return { vestiging: v.id, naam: v.naam, verkoper: van, contracten: mee, afgelost };
  }

  return { liquideer, losOnderpandAf, verhuis };
};
