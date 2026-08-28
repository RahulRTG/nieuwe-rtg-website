/* School (deelmodule): de kant van de LEERLING bij een toets.

   Zelfde toetsen als in ./toets.js, maar een andere poort en een andere
   belofte. De poort is de gezinssessie (een kind zit met zijn eigen profiel in
   de klas, niet met de klascode van de leraar). De belofte is dat een leerling
   tijdens het maken NOOIT goed of fout te zien krijgt: een toets kijk je na
   het inleveren na, niet halverwege. Dat verschil met het oefenen is bewust --
   bij oefenen helpt directe terugkoppeling, bij een toets stuurt ze.

   toetsenVan/maakWerk komen uit ./toets.js: een toets heeft een vorm, en die
   hoort niet twee keer beschreven te staan. */
// een antwoord wordt op vorm vergeleken, niet op tekens: hoofdletters en
// dubbele spaties zijn geen fout
const norm = s => String(s == null ? '' : s).toLowerCase().replace(/\s+/g, ' ').trim();

module.exports = (sctx, hulp) => {
  const { router, save, eigenVeld, K, gezinSessie, leerlingVan } = sctx;
  const { toetsenVan, maakWerk } = hulp;

  /* ---------- leerling: toetsen zien, maken, nagekeken worden ---------- */
  router.post('/school/toets/voor-mij', (req, res) => {
    const s = gezinSessie(req, res); if (!s) return;
    const k = eigenVeld(K(), String(req.body.klasCode || '').trim().toUpperCase());
    if (!k) return res.status(404).json({ error: 'Klas niet gevonden.' });
    const profielId = s.beheerder && req.body.profielId ? String(req.body.profielId) : s.p.id;
    const l = leerlingVan(k, s.g, profielId);
    if (!l) return res.status(403).json({ error: 'Dit kind zit niet in deze klas.' });
    res.json({ ok: true, toetsen: toetsenVan(k).filter(t => t.soort !== 'mo').map(t => {
      const w = t.werk[l.sleutel];
      return { id: t.id, soort: t.soort, naam: t.naam, vak: t.vak, status: t.status,
        vragen: t.doelen.length * t.perDoel, bezig: !!(w && !w.klaar), klaar: !!(w && w.klaar),
        uitslag: w && w.klaar ? { goed: w.goed, totaal: w.vragen.length } : null };
    }) });
  });

  router.post('/school/toets/start', (req, res) => {
    const s = gezinSessie(req, res); if (!s) return;
    const k = eigenVeld(K(), String(req.body.klasCode || '').trim().toUpperCase());
    if (!k) return res.status(404).json({ error: 'Klas niet gevonden.' });
    const l = leerlingVan(k, s.g, s.p.id);
    if (!l) return res.status(403).json({ error: 'Je zit niet in deze klas.' });
    const t = toetsenVan(k).find(x => x.id === String(req.body.toetsId || ''));
    if (!t || t.soort === 'mo') return res.status(404).json({ error: 'Toets niet gevonden.' });
    if (t.status !== 'open') return res.status(400).json({ error: 'Deze toets is gesloten.' });
    if (t.werk[l.sleutel] && t.werk[l.sleutel].klaar) return res.status(409).json({ error: 'Je hebt deze toets al gemaakt.' });
    if (!t.werk[l.sleutel]) t.werk[l.sleutel] = maakWerk(t);
    const w = t.werk[l.sleutel]; save();
    const v = w.vragen[w.ix];
    res.json({ ok: true, naam: t.naam, nr: w.ix + 1, totaal: w.vragen.length, vraag: v.v, opties: v.opties });
  });

  router.post('/school/toets/antwoord', (req, res) => {
    const s = gezinSessie(req, res); if (!s) return;
    const k = eigenVeld(K(), String(req.body.klasCode || '').trim().toUpperCase());
    const l = k && leerlingVan(k, s.g, s.p.id);
    const t = k && toetsenVan(k).find(x => x.id === String(req.body.toetsId || ''));
    const w = t && l && t.werk[l.sleutel];
    if (!w || w.klaar) return res.status(400).json({ error: 'Start deze toets eerst.' });
    const vraag = w.vragen[w.ix];
    const goed = norm(req.body.antwoord) === norm(vraag.a);
    if (goed) { w.goed += 1; w.perDoel[vraag.doel] = (w.perDoel[vraag.doel] || 0) + 1; }
    w.ix += 1;
    const klaar = w.ix >= w.vragen.length;
    if (klaar) w.klaar = true;
    save();
    // anders dan bij het oefenen GEEN goed/fout per vraag: een toets kijk je
    // na het inleveren na, niet halverwege
    const uit = { ok: true, nr: w.ix, totaal: w.vragen.length, klaar };
    if (klaar) { uit.aantalGoed = w.goed; uit.bericht = 'Ingeleverd. Je leraar kijkt naar de uitslag en geeft het cijfer.'; }
    else { const vv = w.vragen[w.ix]; uit.vraag = vv.v; uit.opties = vv.opties; }
    res.json(uit);
  });

};
