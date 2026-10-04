/* De controles van het alarm (./alarm.js). Elk geeft null (niets aan de hand)
   of een bevinding, en geen enkele meet zelf: ze lezen de servicedoelen, de
   sonde, de canary, de gegevenskwaliteit, de hashketen van het journaal en de
   capability-SLO. Afgesplitst omdat alarm.js over de omvanggrens ging. */
'use strict';

module.exports = function maakAlarmControles({ slo, sonde, canary, journaal, kwaliteit, instellingen }) {
  /* De controles. Elk geeft null (niets aan de hand) of een bevinding. Ze
     vangen hun eigen storing af: een alarm dat zelf omvalt omdat de laag
     eronder een fout gooit, is stil op precies het verkeerde moment. */
  return function controles() {
    const d = instellingen();
    const uit = [];
    const probeer = (id, naam, ernst, doe) => {
      try { const r = doe(); if (r) uit.push({ id, naam, ernst, wat: r }); }
      catch (e) { uit.push({ id, naam, ernst: 'midden', wat: 'deze controle kon niet draaien: ' + e.message }); }
    };

    probeer('doel-gezakt', 'Een servicedoel is niet gehaald', 'hoog', () => {
      const st = slo.stand();
      const g = st.doelen.filter(x => x.genoeg && x.oordeel === 'niet gehaald');
      return g.length ? g.map(x => x.naam).join(', ') + ' staat over de streefwaarde' : null;
    });

    probeer('budget-bijna-op', 'Het foutbudget raakt op', 'midden', () => {
      const st = slo.stand();
      const g = st.doelen.filter(x => x.genoeg && x.budget && !x.budget.op && x.budget.restDeel < d.budgetRestDeel);
      return g.length ? g.map(x => x.naam + ' (' + Math.round(x.budget.restDeel * 100) + '% over)').join(', ') : null;
    });

    probeer('niets-van-buiten', 'Er wordt niet van buitenaf gemeten', 'laag', () => {
      const b = sonde.buitenkort();
      return b.gemeten ? null : 'de sonde heeft in dertig dagen niets van buitenaf gemeld. Alles wat ' +
        'de servicedoelen tonen, komt dan van de app over zichzelf -- en die telt niets als hij plat ligt.';
    });

    probeer('sonde-storing', 'De sonde ziet storingen van buitenaf', 'hoog', () => {
      const st = sonde.stand(d.buitenStilUren);
      if (!st.buiten.pogingen || !st.buiten.mislukt) return null;
      return st.buiten.mislukt + ' van ' + st.buiten.pogingen + ' externe metingen mislukten in ' +
        d.buitenStilUren + ' uur';
    });

    probeer('canary-teruggerold', 'Een uitrol is automatisch teruggerold', 'midden', () => {
      if (!canary) return null;
      const g = canary.lopende().filter(x => x.stand === 'teruggerold' && x.automatisch);
      return g.length ? g.map(x => x.naam).join(', ') + ' ging over de terugroldrempel' : null;
    });

    probeer('journaal-gebroken', 'De hashketen van het journaal klopt niet', 'hoog', () => {
      const k = journaal.controleer();
      return k && k.heel === false ? (k.waarom || 'de keten is gebroken') + ' (bij ' + k.bij + ')' : null;
    });

    probeer('gegevens-kapot', 'Er staan defecten in de gegevens', 'laag', () => {
      if (!kwaliteit) return null;
      const t = kwaliteit.meet().tel;
      return t.defecten > d.defectenDrempel
        ? t.defecten + ' defecten over ' + t.soorten + ' bevinding(en); de drempel staat op ' + d.defectenDrempel
        : null;
    });

    probeer('capability-gezakt', 'Een capability-SLO is niet gehaald', 'hoog', () => {
      const g = (slo.stand().capabilities || []).filter(x => x.oordeel === 'niet gehaald');
      return g.length ? g.map(x => x.capability).join(', ') + ' mist beschikbaarheid of latency' : null;
    });

    probeer('capability-verouderd', 'Capabilitybewijs is verouderd', 'midden', () => {
      const g = (slo.stand().capabilities || []).filter(x =>
        (x.reasons || []).includes('STALE_MEASUREMENTS') && x.availability && x.availability.eligible > 0);
      return g.length ? g.map(x => x.capability).join(', ') + ' heeft geen verse meting' : null;
    });

    return uit;
  };
};
