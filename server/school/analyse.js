/* School (deelmodule): het directiebeeld -- dashboard, waarschuwingen en de
   signalen rond een leerling.

   Dit is de laag waar een schoolsysteem het snelst gevaarlijk wordt, want een
   getal over een kind ziet eruit als een feit. Vier regels houden hem eerlijk:

   1. GEEN VOORSPELLING, MAAR WAARNEMINGEN MET NAAM EN TOELICHTING. Er komt
      geen risicoscore uit, geen percentage "kans op uitval" en geen label dat
      aan een kind blijft plakken. Wat eruit komt zijn de FACTOREN die iemand
      zelf kan nakijken: zoveel lessen gemist, zoveel huiswerk open, dit
      gemiddelde. Wie het niet eens is met het signaal, ziet meteen waarom het
      er staat.
   2. GEEN RANGLIJST. Niet van leerlingen, niet van klassen, niet van docenten.
      Lijsten staan op naam gesorteerd. Een ranglijst maakt van "wie heeft
      aandacht nodig" vanzelf "wie presteert het slechtst".
   3. EEN WAARSCHUWING NOEMT ZIJN EIGEN REKENSOM. "40% hoger dan normaal" zegt
      erbij wat normaal is, over welke periode, en met hoeveel lessen gemeten.
      Een signaal op vier lessen is geen signaal; daarom staat er een ondergrens
      in de code.
   4. WAT WE NIET METEN, VERZINNEN WE NIET. Tevredenheid staat in elk
      enterprise-pakket op het dashboard; RTG School meet het nergens, dus komt
      er `null` terug met de reden erbij in plaats van een mooi cijfer. */
module.exports = (sctx) => {
  const { router, K, poort, leerlingLijst, presentieLijst, gemiddelde, peilingBeeld } = sctx;

  const MIN_LESSEN = 10; // onder deze grens is verzuim ruis, geen signaal
  const dagen = (d) => new Date(Date.now() - d * 86400000).toISOString().slice(0, 10);
  const klassenVan = (sch) => Object.values(K()).filter(k => k.schoolCode === sch.code);
  const open = (f) => Math.max(0, f.centen - (f.betaald || 0) + (f.terugbetaald || 0));

  // verzuim (afwezig + ziek) als aandeel van de lessen, over een periode
  function verzuim(sch, filter) {
    let lessen = 0, gemist = 0;
    for (const les of presentieLijst(sch)) {
      if (!filter(les)) continue;
      for (const r of les.regels) { lessen++; if (r.stand === 'afwezig' || r.stand === 'ziek') gemist++; }
    }
    return { lessen, gemist, deel: lessen ? gemist / lessen : null };
  }

  /* ---------- de waarschuwingen ---------- */
  function waarschuwingen(sch) {
    const uit = [];
    const dezeMaand = (les) => les.datum >= dagen(30);
    const daarvoor = (les) => les.datum < dagen(30) && les.datum >= dagen(120);
    for (const k of klassenVan(sch)) {
      const nu = verzuim(sch, l => l.klasCode === k.code && dezeMaand(l));
      const eerder = verzuim(sch, l => l.klasCode === k.code && daarvoor(l));
      if (nu.lessen < MIN_LESSEN || eerder.lessen < MIN_LESSEN || !eerder.deel) continue;
      const stijging = (nu.deel - eerder.deel) / eerder.deel;
      if (stijging >= 0.3) uit.push({ soort: 'verzuim', klas: k.naam, klasCode: k.code,
        tekst: 'Het verzuim in klas ' + k.naam + ' is deze maand ' + Math.round(stijging * 100) + '% hoger dan normaal ('
          + Math.round(nu.deel * 100) + '% van ' + nu.lessen + ' geregistreerde lesplaatsen, tegen ' + Math.round(eerder.deel * 100) + '% in de drie maanden ervoor).',
        meting: { nu: nu.deel, eerder: eerder.deel, lessen: nu.lessen } });
    }
    const openVerlof = (sch.verlof || []).filter(v => v.status === 'ingediend').length;
    if (openVerlof) uit.push({ soort: 'verlof', tekst: openVerlof + ' verlofaanvraag(en) wachten op een besluit.' });
    for (const b of Object.values(sch.budgetten || {})) if (b.besteed > b.centen)
      uit.push({ soort: 'budget', tekst: 'Budget "' + b.naam + '" is overschreden met ' + ((b.besteed - b.centen) / 100).toFixed(2) + ' euro.' });
    const vandaag = new Date().toISOString().slice(0, 10);
    for (const d of Object.values(sch.hr || {})) for (const bev of (d.bevoegdheden || []))
      if (bev.geldigTot && bev.geldigTot < vandaag)
        uit.push({ soort: 'bevoegdheid', tekst: 'De bevoegdheid "' + bev.wat + '" van ' + d.naam + ' is verlopen op ' + bev.geldigTot + '.' });
    const ernstig = (sch.incidenten || []).filter(i => i.at >= dagen(30) + 'T' && i.ernst !== 'licht').length;
    if (ernstig >= 3) uit.push({ soort: 'incident', tekst: ernstig + ' ernstige incidenten in de laatste dertig dagen. De inhoud staat in het incidentenregister, achter zijn eigen poort.' });
    return uit;
  }

  /* ---------- het dashboard ---------- */
  router.post('/school/dashboard', (req, res) => {
    const g = poort(req, res, 'analyse'); if (!g) return;
    const klassen = klassenVan(g.sch);
    const leerlingen = Object.values(leerlingLijst(g.sch));
    const facturen = g.sch.facturen || [];
    const maand = verzuim(g.sch, l => l.datum >= dagen(30));
    const perKlas = klassen.map(k => ({
      code: k.code, naam: k.naam, leerlingen: (k.leerlingen || []).length,
      gemiddelde: gemiddelde(k.cijfers || []),
      huiswerkOpen: (k.huiswerk || []).filter(h => h.deadline && h.deadline >= new Date().toISOString().slice(0, 10)).length,
      toetsenOpen: (k.toetsen || []).filter(t => t.status === 'open').length,
      verzuim: verzuim(g.sch, l => l.klasCode === k.code && l.datum >= dagen(30)).deel
    })).sort((a, b) => String(a.naam).localeCompare(String(b.naam)));

    const hr = Object.values(g.sch.hr || {});
    const vandaag = new Date().toISOString().slice(0, 10);
    const uit = hr.filter(d => (d.verlof || []).some(v => (v.soort === 'ziek' || v.status === 'toegekend') && v.van <= vandaag && (!v.tot || v.tot >= vandaag))).length;
    const personeel = Object.values(g.sch.personeel || {}).filter(p => p.status === 'actief');

    res.json({ ok: true, school: g.sch.naam,
      leerlingen: { ingeschreven: leerlingen.filter(l => l.status === 'ingeschreven').length,
        aanmeldingen: leerlingen.filter(l => l.status === 'aanmelding').length,
        wachtlijst: leerlingen.filter(l => l.status === 'wachtlijst').length },
      aanwezigheid: { periode: '30 dagen', geregistreerd: maand.lessen, gemist: maand.gemist,
        aanwezigheidsdeel: maand.lessen ? Math.round((1 - maand.deel) * 1000) / 1000 : null },
      klassen: perKlas,
      docenten: { actief: personeel.length, vandaagUit: uit, vervangingenLopend: klassen.filter(k => k.waarnemer).length },
      lesmateriaal: { huiswerkGegeven: klassen.reduce((n, k) => n + (k.huiswerk || []).length, 0),
        toetsenGemaakt: klassen.reduce((n, k) => n + (k.toetsen || []).length, 0) },
      financieel: sctx.mag(g.p, 'financieel.lees') || g.directie
        ? { gefactureerd: facturen.reduce((n, f) => n + f.centen, 0), betaald: facturen.reduce((n, f) => n + (f.betaald || 0), 0), open: facturen.reduce((n, f) => n + open(f), 0) }
        : null,
      incidenten: { laatste30: (g.sch.incidenten || []).filter(i => i.at >= dagen(30) + 'T').length,
        let: 'Alleen het aantal; de inhoud staat achter de incidentenpoort.' },
      tevredenheid: peilingBeeld(g.sch),
      tevredenheidUitleg: peilingBeeld(g.sch)
        ? 'Uit de anonieme peiling, op een schaal van 1 tot 5. Geen scores per medewerker: de stellingen gaan over de school.'
        : 'Geen cijfer: er is nog geen peiling met genoeg antwoorden. Een verzonnen tevredenheidscijfer is erger dan een leeg vakje.',
      waarschuwingen: waarschuwingen(g.sch),
      let: 'Geen ranglijsten: klassen staan op naam, niet op prestatie.' });
  });

  return { waarschuwingen, schoolVerzuim: verzuim };
};
