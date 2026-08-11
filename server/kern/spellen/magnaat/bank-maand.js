/* Magnaat: DE MAAND VAN EEN LENING -- rente, aflossing en de convenanttrap.

   Afgesplitst van ./bank-acties.js op dezelfde naad als overal in deze map: dat
   bestand kent wat een SPELER doet (opnemen, aflossen, herzien), dit bestand
   kent wat de KLOK doet. Dat onderscheid is hier scherper dan elders, want de
   trap loopt zonder dat iemand iets aanraakt -- een speler die een half jaar
   niet kijkt, komt terug in een andere situatie dan hij achterliet, en dat mag
   nergens anders vandaan komen dan hier.

   RENTE VERLAAT DE WERELD. Dit is de enige post in het spel waar geld niet bij
   een andere speler landt maar echt weg is; scripts/magnaat-pomp.js kent daar
   een eigen categorie voor, anders keurt die meter financiering af omdat hij
   werkt. */
const B = require('./bank');

const rond = (n) => Math.round(n);

module.exports = ({ mijne, cijfers, liquideer }) => {
  /* ---------- de maand ----------
     Per speler: rente, aflossing, en de convenanttrap. Geeft regels terug voor
     het maandoverzicht plus wat er aan RENTE de wereld verlaat.

     WIE NIET KAN BETALEN GAAT NIET METEEN OM. Wat er niet uit de kas komt, komt
     uit de rekening-courant -- die staat immers altijd open, en dan zakt hij
     verder rood en betaalt hij dat via de post hierboven. Een aflossing die
     niet lukt telt wel als GEMIST, en dat is precies wat je betalingsdiscipline
     op het scherm laat zakken en je volgende lening duurder maakt. */
  function maandVoorSpeler(st, h) {
    const regels = [];
    let rente = 0;
    const c = cijfers(st, h);
    for (const l of mijne(st, h)) {
      const r = B.maandVoor(l, c);
      st.geld[h] -= r.rente;
      l.betaaldRente += r.rente;
      rente += r.rente;
      let afgelost = 0;
      if (r.aflossing > 0) {
        /* De aflossing gaat ALTIJD door -- als de kas hem niet draagt, zakt de
           rekening-courant. Dat is geen coulance maar de eerlijke volgorde: de
           schuld verschuift naar de duurste vorm en dat voel je meteen. */
        afgelost = Math.min(r.aflossing, l.restant);
        st.geld[h] -= afgelost;
        l.restant -= afgelost;
        l.betaaldAflossing += afgelost;
        if (st.geld[h] < 0) {
          st.betaalgemist = st.betaalgemist || {};
          st.betaalgemist[h] = (st.betaalgemist[h] || 0) + 1;
        }
      }
      /* DE CONVENANTTRAP. Drie stappen en geen beslag bij de eerste misstap;
         zie de reden in ./bank.js. */
      const voor = B.trapVan(l.breukMaanden || 0);
      l.breukMaanden = r.breuken.length ? (l.breukMaanden || 0) + 1 : 0;
      const na = B.trapVan(l.breukMaanden);
      /* DE OPSLAG WORDT ELKE MAAND OPNIEUW BEPAALD, en `opgeeist` moet daar
         doorheen komen: een ongedekte lening die al eens is opgeeist blijft de
         dubbele opslag dragen. Zonder dat vinkje zette deze regel hem de maand
         erna weer op de gewone opslag terug, en dan is opeisen zonder onderpand
         een tik op de vingers die na een maand vervalt. */
      l.opslag = l.opgeeist ? B.BREUK_OPSLAG * 2
        : l.breukMaanden >= B.TRAP.opslag ? B.BREUK_OPSLAG : 0;
      let opgeeist = false;
      if (na === 'opeisbaar') {
        opgeeist = true;
        const uitKas = Math.min(l.restant, Math.max(0, st.geld[h]));
        st.geld[h] -= uitKas;
        l.restant -= uitKas;
        l.betaaldAflossing += uitKas;
        if (l.restant < 1) { l.restant = 0; l.status = 'afgelost'; }
        else if (l.onderpand && liquideer) {
          /* HET ONDERPAND GAAT ERAAN en verder niets. Dat is het verschil
             tussen vastgoedfinanciering en de rest: de bank neemt de zaak
             waarop hij een recht had, niet je hele bedrijf.

             De opbrengst gaat EERST naar de schuld en wat overblijft naar de
             speler -- dat is de volgorde die een onderpand betekenis geeft, en
             hij loopt langs dezelfde weg als zelf sluiten (contracten worden
             afgekocht, het kavel komt vrij). */
          /* ZONDER AFLOSSEN: de bank verrekent de opbrengst hieronder zelf met
             deze lening. Zou ./afscheid.js hem ook aflossen, dan betaalt de
             speler zijn schuld twee keer. */
          const opbrengst = liquideer(st, h, l.onderpand, false);
          const naarSchuld = Math.min(l.restant, Math.max(0, opbrengst));
          l.restant -= naarSchuld;
          l.betaaldAflossing += naarSchuld;
          st.geld[h] += opbrengst - naarSchuld;
          l.status = 'uitgewonnen';
          l.uitgewonnen = l.onderpand;
          l.opbrengst = rond(opbrengst);
          // blijft er schuld over, dan blijft die staan tegen de hoogste opslag
          if (l.restant >= 1) {
            l.status = 'loopt'; l.onderpand = null; l.opgeeist = true;
            l.opslag = B.BREUK_OPSLAG * 2; l.breukMaanden = B.TRAP.opslag;
          }
        } else {
          /* GEEN ONDERPAND, GEEN DEUR. Een ongedekte lening kan niemand
             afpakken; wat er gebeurt is dat hij duur blijft staan. Failliet
             gaan bestaat hier niet -- zie GAMEHALL.md 12.6: geen straf voor
             wegblijven, en een speler die zijn wereld kwijtraakt komt niet
             terug. */
          l.opgeeist = true;
          l.opslag = B.BREUK_OPSLAG * 2;
          l.breukMaanden = B.TRAP.opslag;
        }
      }
      if (r.rente > 0 || afgelost > 0 || na)
        regels.push({ id: l.id, naam: B.VORMEN[l.soort].naam,
          rente: rond(r.rente), aflossing: rond(afgelost), restant: rond(l.restant),
          resultaat: -rond(r.rente + afgelost),
          breuken: r.breuken, trap: na, nieuweTrap: na && na !== voor ? na : null,
          opgeeist: opgeeist || undefined, uitgewonnen: l.uitgewonnen });
    }
    return { regels, rente };
  }

  return { maandVoorSpeler };
};
