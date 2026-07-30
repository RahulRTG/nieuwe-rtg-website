/* RTFoundation-gasten (deelmodule): de geldschool -- de brug tussen de
   klusjes (sterren), het vaste weekgeld en het zakgeldpotje van het kind.

   Drie eerlijke regels:
   1. De ouder beslist over geld. Weekgeld instellen en sterren verzilveren
      kan alleen een ouder of de beheerder; het kind ziet alles terug in
      zijn eigen potje.
   2. De eer blijft staan. Verzilveren haalt sterren van het BESCHIKBARE
      saldo (verdiend min verzilverd), maar de ranglijst blijft tellen wat
      een kind ooit verdiende -- trots raak je niet kwijt aan geld.
   3. Geen echt geld. Het potje is een leerboekje: de app boekt, de
      portemonnee van thuis betaalt. Er loopt hier geen betaling.

   Gemount vanuit foundation/gasten.js op de gedeelde context. Het lui
   bijboeken van weekgeld woont in kern/tiener.js (bij het potje zelf),
   zodat het kind het ook ziet zonder dat een ouder eerst kijkt. */
module.exports = (ctx) => {
  const { router, save, rid, familieVan, isGast } = ctx;
  const magGeld = s => ['beheerder', 'ouder'].includes(s.p.rol);
  const bak = p => { if (!p.tiener) p.tiener = { toetsen: [], transacties: [], doelen: [] }; return p.tiener; };
  function boekBij(p, centen, wat) {
    const b = bak(p);
    b.transacties.unshift({ id: rid(6), centen, wat, at: Date.now() });
    b.transacties = b.transacties.slice(0, 500);
  }

  // het overzicht: per kind de sterrenstand en het weekgeld. Het hele gezin
  // mag kijken (net als de klusjes-ranglijst); alleen een ouder beheert.
  router.post('/gezin/geldschool', (req, res) => {
    const s = familieVan(req, res); if (!s) return;
    const verz = s.g.sterrenVerzilverd || {};
    const kinderen = Object.values(s.g.profielen).filter(p => !isGast(p)).map(p => {
      const verdiend = (s.g.sterren || {})[p.id] || 0;
      return { id: p.id, naam: p.naam, kleur: p.kleur || '', avatar: p.avatar || '',
        sterren: verdiend, verzilverd: verz[p.id] || 0, beschikbaar: verdiend - (verz[p.id] || 0),
        weekgeldCenten: (p.zakgeld && p.zakgeld.perWeek) || 0 };
    });
    res.json({ ok: true, kinderen, magBeheren: magGeld(s), mijnId: s.p.id });
  });

  /* weekgeld instellen: de week begint nu, dus de eerste week wordt meteen
     geboekt; daarna boekt het potje zelf lui elke zeven dagen bij
     (kern/tiener.js). 0 zet het weekgeld uit. */
  router.post('/gezin/geldschool/weekgeld', (req, res) => {
    const s = familieVan(req, res); if (!s) return;
    if (!magGeld(s)) return res.status(403).json({ error: 'Alleen een ouder of de beheerder gaat over het weekgeld.' });
    const p = s.g.profielen[String(req.body.pid || '')];
    if (!p || isGast(p)) return res.status(404).json({ error: 'Dit gezinslid bestaat niet.' });
    const c = Math.round(Number(req.body.centenPerWeek));
    if (!Number.isFinite(c) || c < 0 || c > 10000) return res.status(400).json({ error: 'Kies een weekbedrag tussen 0 en 100 euro.' });
    if (!c) { delete p.zakgeld; save(); return res.json({ ok: true, weekgeldCenten: 0 }); }
    p.zakgeld = { perWeek: c, laatst: Date.now() };
    boekBij(p, c, 'Zakgeld (week)');
    save();
    res.json({ ok: true, weekgeldCenten: c });
  });

  // sterren verzilveren: de ouder kiest zelf het bedrag; de app noteert
  // hoeveel sterren zijn verzilverd en boekt het geld in het potje van het kind
  router.post('/gezin/geldschool/verzilver', (req, res) => {
    const s = familieVan(req, res); if (!s) return;
    if (!magGeld(s)) return res.status(403).json({ error: 'Alleen een ouder of de beheerder verzilvert sterren.' });
    const p = s.g.profielen[String(req.body.pid || '')];
    if (!p || isGast(p)) return res.status(404).json({ error: 'Dit gezinslid bestaat niet.' });
    const sterren = Math.round(Number(req.body.sterren));
    const centen = Math.round(Number(req.body.centen));
    if (!Number.isFinite(sterren) || sterren < 1) return res.status(400).json({ error: 'Hoeveel sterren verzilver je?' });
    if (!Number.isFinite(centen) || centen < 1 || centen > 50000) return res.status(400).json({ error: 'Kies een bedrag tot 500 euro.' });
    const verz = (s.g.sterrenVerzilverd = s.g.sterrenVerzilverd || {});
    const beschikbaar = ((s.g.sterren || {})[p.id] || 0) - (verz[p.id] || 0);
    if (sterren > beschikbaar) return res.status(400).json({ error: 'Zoveel sterren staan er niet open. Er ' + (beschikbaar === 1 ? 'staat er nog 1' : 'staan er nog ' + beschikbaar) + '.' });
    verz[p.id] = (verz[p.id] || 0) + sterren;
    boekBij(p, centen, 'Sterren verzilverd (' + sterren + ')');
    save();
    res.json({ ok: true, beschikbaar: beschikbaar - sterren });
  });
  return {};
};
