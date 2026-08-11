/* Spellen (deelmodule): Reactieduel voor tieners. Vijf ronden met voor
   iedereen DEZELFDE wachttijden (rood -> groen); je tikt zo snel je kunt en
   de som van je vijf tijden telt, de laagste wint. De client meet de eigen
   reactietijd en meldt die: het eer-systeem, net als het Woordduel zonder
   woordenboek -- de server bewaakt wel de grenzen (een onmenselijk snelle
   tik telt als valse start en kost de straftijd). Krijgt de gedeelde
   context een keer bij het opstarten vanuit kern/spellen.js. */
module.exports = (ctx) => {
  const { save, crypto, codenaamVan, nudge } = ctx;
  const RONDEN = 5, STRAF = 1500, MENS = 90, PLAFOND = 5000;
  function reactieInit(potje) {
    const st = { wachten: [], tijden: {}, klaarOm: {} };
    for (let i = 0; i < RONDEN; i++) st.wachten.push(1200 + crypto.randomInt(0, 2600));
    for (const sp of potje.spelers) st.tijden[sp] = [];
    potje.staat = st;
  }
  function reactieZet(potje, mij, zet) {
    const st = potje.staat;
    if (zet.actie !== 'tik') return { status: 400, error: 'Onbekende zet.' };
    if (st.tijden[mij].length >= RONDEN) return { status: 409, error: 'Jij bent al klaar; wacht op de rest.' };
    // een valse start (voor groen getikt) of een tik onder de menselijke
    // ondergrens wordt de straftijd; treuzelen wordt op het plafond gekapt
    const vals = zet.vals === true || Number(zet.ms) < MENS;
    const ms = vals ? STRAF : Math.min(PLAFOND, Math.round(Number(zet.ms) || PLAFOND));
    st.tijden[mij].push(ms);
    if (st.tijden[mij].length >= RONDEN) st.klaarOm[mij] = Date.now();
    if (potje.spelers.every(sp => st.tijden[sp].length >= RONDEN)) {
      potje.status = 'klaar';
      const som = sp => st.tijden[sp].reduce((a, b) => a + b, 0);
      const beste = Math.min(...potje.spelers.map(som));
      const kandidaten = potje.spelers.filter(sp => som(sp) === beste);
      if (kandidaten.length > 1) potje.gelijk = true;
      else potje.winnaar = codenaamVan(kandidaten[0]);
    }
    save();
    potje.spelers.filter(sp => sp !== mij).forEach(sp => nudge(sp, potje));
    return { status: 200, ok: true, ms, vals };
  }
  // de wachttijd van de EIGEN volgende ronde reist mee zodat de client het
  // stoplicht kan spelen; de tussenstand is potje-intern en verdwijnt met
  // het potje (er bestaat geen ranglijst)
  const reactieView = (p, st, mij) => ({
    ronde: st.tijden[mij].length, tot: RONDEN,
    wacht: st.tijden[mij].length < RONDEN ? st.wachten[st.tijden[mij].length] : null,
    tijden: st.tijden[mij],
    stand: p.spelers.map(sp => ({ af: st.tijden[sp].length, totaal: st.tijden[sp].reduce((a, b) => a + b, 0) }))
  });
  /* EEN EIGEN KIJKWEERGAVE, en dit spel is een van de twee die laten zien
     waarom die vraag per spel gesteld moet worden.

     `reactieView` leest `st.tijden[mij].length`. Voor een kijker is `mij` null,
     dus dat is `undefined.length` -- meekijken GOOIDE hier, en de route maakte
     er een 500 van. Dit spel stond gewoon op `kijken: true`; geen enkele toets
     riep spelKijk erop aan, dus de fout heeft er stil in gezeten.

     Wat een kijker wel krijgt is wat de vier andere duels hem ook geven: de
     tussenstand. De wachttijd van de volgende ronde is persoonlijk en hoort
     daar niet in -- die vooruit kunnen zien is precies het spel. */
  const reactieBuiten = (p, st) => ({ tot: RONDEN,
    stand: p.spelers.map(sp => ({ af: st.tijden[sp].length, totaal: st.tijden[sp].reduce((a, b) => a + b, 0) })) });
  const spel = { sleutel: 'reactie', naam: 'Reactieduel', max: 4, wereld: 'rtf', buitenBeurt: ['tik'],
    init: reactieInit, zet: reactieZet,
    zicht: { speler: reactieView, kijker: reactieBuiten, publiek: reactieBuiten } };
  return { spel, reactieInit, reactieZet, reactieView };
};
