/* Métier: de beroepsapp. Het profiel, het beroepsregister, aanbevelingen,
   de naamvrijgave en de drie AI-taken.

   Alles loopt over de gewone leden-auth, dus Rahul kan elk van deze handelingen
   zelf uitvoeren via het stuur (kern/stuur.js). Twee uitzonderingen die daar
   NIET onder mogen vallen, en waarom:
   - /naam-vrij en /naam-intrekken gaan over het weggeven van je echte naam. Dat
     hoort een mens zelf te doen, met de knop in de hand.
   - /zaak/naam is de werkgeverskant en loopt op de leveranciers-auth.
   Gemount vanuit routes/member.js. */
module.exports = (kern) => {
  const { app, auth, supplierAuth, geenGast, metier, metierBewijs, metierNetwerk, metierAI } = kern;
  const fout = (res, e) => res.status(400).json({ error: (e && e.message) || 'Er ging iets mis.' });
  const uit = (res, r) => r && r.error ? res.status(400).json(r) : res.json(r);

  // ---- het eigen profiel ----
  app.post('/api/metier/ik', auth, (req, res) => {
    if (geenGast(req, res)) return;
    try {
      const key = req.session.key;
      res.json({
        ok: true,
        profiel: metier.publiek(key, key, {
          aanbevelingen: metierNetwerk.aanbevelingenVan(key, req.session),
          onderschreven: metierNetwerk.onderschrevenVan(key, req.session)
        }),
        ...metierBewijs.mijnToestemmingen(key)
      });
    } catch (e) { fout(res, e); }
  });

  app.post('/api/metier/kaart', auth, (req, res) => {
    if (geenGast(req, res)) return;
    try { uit(res, metier.kaartZet(req.session.key, req.body || {})); } catch (e) { fout(res, e); }
  });

  app.post('/api/metier/rol', auth, (req, res) => {
    if (geenGast(req, res)) return;
    try { uit(res, metier.rolZet(req.session.key, req.body || {})); } catch (e) { fout(res, e); }
  });

  app.post('/api/metier/rol-weg', auth, (req, res) => {
    if (geenGast(req, res)) return;
    try { uit(res, metier.rolWeg(req.session.key, req.body.id)); } catch (e) { fout(res, e); }
  });

  app.post('/api/metier/lijst', auth, (req, res) => {
    if (geenGast(req, res)) return;
    try { uit(res, metier.lijstZet(req.session.key, req.body.veld, req.body.waarden)); } catch (e) { fout(res, e); }
  });

  // ---- het beroepsregister en het profiel van een ander ----
  app.post('/api/metier/zoek', auth, (req, res) => {
    if (geenGast(req, res)) return;
    try { res.json({ ok: true, ...metier.zoek(req.body || {}, req.session.key) }); } catch (e) { fout(res, e); }
  });

  app.post('/api/metier/lid', auth, async (req, res) => {
    if (geenGast(req, res)) return;
    try {
      const t = kern.keyVanCodenaam ? await kern.keyVanCodenaam(String(req.body.wie || '').trim()) : null;
      if (!t || !t.key) return res.status(404).json({ error: 'Dit lid ken ik niet.' });
      res.json({
        ok: true,
        profiel: metier.publiek(t.key, req.session.key, {
          aanbevelingen: metierNetwerk.aanbevelingenVan(t.key, req.session),
          onderschreven: metierNetwerk.onderschrevenVan(t.key, req.session)
        })
      });
    } catch (e) { fout(res, e); }
  });

  // ---- aanbevelingen en onderschrijvingen ----
  app.post('/api/metier/beveel-aan', auth, async (req, res) => {
    if (geenGast(req, res)) return;
    try { uit(res, await metierNetwerk.beveelAan(req.session, req.body.wie, req.body.tekst)); } catch (e) { fout(res, e); }
  });

  app.post('/api/metier/aanbeveling-verberg', auth, (req, res) => {
    if (geenGast(req, res)) return;
    try { uit(res, metierNetwerk.verberg(req.session.key, req.body.id, req.body.aan !== false)); } catch (e) { fout(res, e); }
  });

  app.post('/api/metier/aanbeveling-intrekken', auth, (req, res) => {
    if (geenGast(req, res)) return;
    try { uit(res, metierNetwerk.trekIn(req.session, req.body.wie, req.body.id)); } catch (e) { fout(res, e); }
  });

  app.post('/api/metier/onderschrijf', auth, async (req, res) => {
    if (geenGast(req, res)) return;
    try { uit(res, await metierNetwerk.onderschrijf(req.session, req.body.wie, req.body.vaardigheid, req.body.aan)); }
    catch (e) { fout(res, e); }
  });

  /* ---- de naam: vrijgeven, intrekken, en zien wie keek ----
     Dit is de kern van het ontwerp. Het lid drukt zelf; er is geen route waarmee
     iemand anders (of de AI namens hem) een naam kan vrijgeven. */
  app.post('/api/metier/naam-vrij', auth, (req, res) => {
    if (geenGast(req, res)) return;
    try { uit(res, metierBewijs.geefVrij(req.session.key, req.body.code, req.body.waarvoor)); } catch (e) { fout(res, e); }
  });

  app.post('/api/metier/naam-intrekken', auth, (req, res) => {
    if (geenGast(req, res)) return;
    try { uit(res, metierBewijs.trekIn(req.session.key, req.body.code)); } catch (e) { fout(res, e); }
  });

  app.post('/api/metier/naam-log', auth, (req, res) => {
    if (geenGast(req, res)) return;
    try { res.json(metierBewijs.mijnToestemmingen(req.session.key)); } catch (e) { fout(res, e); }
  });

  /* De werkgeverskant: een zaak vraagt de naam achter een codenaam. Lukt alleen
     met een geldige toestemming van dat lid, en het komt in zijn inzagelog. */
  app.post('/api/supplier/metier/naam', supplierAuth, async (req, res) => {
    try {
      const r = await metierBewijs.naamVoorZaak(req.supplier.code, req.body.codenaam);
      res.status(r.status || 200).json(r);
    } catch (e) { fout(res, e); }
  });

  // ---- Rahul als loopbaancoach: stelt voor, verstuurt nooit ----
  app.post('/api/metier/ai/profiel', auth, async (req, res) => {
    if (geenGast(req, res)) return;
    try { const r = await metierAI.profielKritiek(req.session); res.status(r.ok ? 200 : 503).json(r); }
    catch (e) { fout(res, e); }
  });

  app.post('/api/metier/ai/brief', auth, async (req, res) => {
    if (geenGast(req, res)) return;
    try { const r = await metierAI.brief(req.session, req.body.vacature); res.status(r.ok ? 200 : 503).json(r); }
    catch (e) { fout(res, e); }
  });

  app.post('/api/metier/ai/oefen', auth, async (req, res) => {
    if (geenGast(req, res)) return;
    try { const r = await metierAI.oefengesprek(req.session, req.body || {}); res.status(r.ok ? 200 : 503).json(r); }
    catch (e) { fout(res, e); }
  });
};
