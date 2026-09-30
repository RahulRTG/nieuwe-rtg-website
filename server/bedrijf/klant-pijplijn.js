'use strict';
// Verkoopbeeld op de bestaande kansen; bedragen uit verschillende valuta worden niet opgeteld.
module.exports = (sctx, { KA, FASEN, faseVan }) => {
  const { app, werkPoort } = sctx;
  /* De pijplijn: gewogen, met de rekensom erbij en zonder het woord prognose. */
  app.post('/api/bedrijf/pijplijn', (req, res) => {
    const g = werkPoort(req, res, 'klant'); if (!g) return;
    const alleValuta = Object.values(KA(g.w));
    const alle = alleValuta.filter(k => !k.valuta || k.valuta === 'EUR');
    const open = alle.filter(k => k.fase !== 'gewonnen' && k.fase !== 'verloren');
    const perFase = {};
    let gewogen = 0;
    for (const k of open) {
      const f = faseVan(k.fase);
      const deel = Math.round(k.bedragCenten * f.kans / 100);
      gewogen += deel;
      perFase[k.fase] = perFase[k.fase] || { aantal: 0, bedragCenten: 0, kansPct: f.kans, gewogenCenten: 0 };
      perFase[k.fase].aantal++;
      perFase[k.fase].bedragCenten += k.bedragCenten;
      perFase[k.fase].gewogenCenten += deel;
    }
    const gewonnen = alle.filter(k => k.fase === 'gewonnen');
    const verloren = alle.filter(k => k.fase === 'verloren');
    const redenen = {};
    for (const k of verloren) { const r = k.reden || 'zonder reden'; redenen[r] = (redenen[r] || 0) + 1; }
    res.json({ ok: true, fasen: FASEN, valuta: 'EUR', andereValuta: alleValuta.length - alle.length,
      open: { aantal: open.length, bedragCenten: open.reduce((t, k) => t + k.bedragCenten, 0), gewogenCenten: gewogen },
      perFase,
      gewonnen: { aantal: gewonnen.length, bedragCenten: gewonnen.reduce((t, k) => t + k.bedragCenten, 0) },
      verloren: { aantal: verloren.length, redenen },
      scoringPct: (gewonnen.length + verloren.length)
        ? Math.round(gewonnen.length / (gewonnen.length + verloren.length) * 1000) / 10 : null,
      let: 'Dit geldbeeld telt alleen EUR; afspraken in andere valuta staan in Dagelijks werk en worden niet omgerekend. Gewogen is bedrag maal de kans van de fase. Dat is een rekensom en geen prognose: een voorspelling hoort pas te bestaan als er genoeg afgesloten kwartalen zijn om hem aan te toetsen.' });
  });

  sctx.startBron('klanten', 'klant', (g) => {
    const mijn = Object.values(KA(g.w)).filter(k => k.eigenaar === g.l.naam && k.fase !== 'gewonnen' && k.fase !== 'verloren');
    return { openKansen: mijn.length,
      kansen: mijn.slice(0, 8).map(k => ({ id: k.id, titel: k.titel, klant: k.klant, fase: k.fase })) };
  });

};
