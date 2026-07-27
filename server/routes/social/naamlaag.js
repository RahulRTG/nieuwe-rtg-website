/* Sociale laag (deelmodule): de persoonlijke naamlaag. Een lid geeft een
   vriend in het EIGEN account een eigen naam (bijvoorbeeld de echte naam);
   die naam verschijnt daarna overal in het eigen account en Rahul begrijpt
   bij die naam nog steeds wie er bedoeld wordt. Het etiket verlaat het
   account nooit: andermans schermen en alle antwoorden aan derden blijven
   op codenaam. Gemount vanuit routes/social.js op de gedeelde kern. */
module.exports = (sctx) => {
  const { kern } = sctx;
  const { app, auth, geenGast, naamlaag, connectieTussen, verbActief, keyVanCodenaam } = kern;

  // eigen naam zetten (lege naam = weghalen); alleen voor echte connecties,
  // zodat het etiket altijd bij een bestaande vriendschap hoort
  app.post('/api/member/naam/zet', auth, async (req, res) => {
    if (geenGast(req, res)) return;
    const codenaam = String(req.body.codenaam || '').trim();
    const naam = req.body.naam;
    if (naam && String(naam).trim()) {
      let doel = null;
      try { const t = await keyVanCodenaam(codenaam); doel = t && t.key; } catch (e) {}
      if (!doel || !verbActief(connectieTussen(req.session.key, doel)))
        return res.status(403).json({ error: 'Een eigen naam kan alleen voor een verbonden vriend.' });
    }
    const r = naamlaag.zetNaam(req.session.key, codenaam, naam);
    if (r.error) return res.status(r.status).json({ error: r.error });
    res.json(r);
  });

  // de hele eigen kaart (codenaam -> eigen naam), voor alle schermen
  app.post('/api/member/naam/lijst', auth, (req, res) => {
    if (geenGast(req, res)) return;
    res.json({ ok: true, namen: naamlaag.kaartVoor(req.session.key) });
  });

  // wie bedoel ik? Van vrije tekst (eigen naam of codenaam) naar de codenaam
  // die het systeem kent -- dezelfde functie die Rahul gebruikt.
  app.post('/api/member/naam/wie', auth, (req, res) => {
    if (geenGast(req, res)) return;
    res.json({ ok: true, codenaam: naamlaag.resolveer(req.session.key, req.body.tekst) });
  });

};
