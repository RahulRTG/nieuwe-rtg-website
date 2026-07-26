/* Genootschap: besloten groepen van leden, met prikbord en bijeenkomsten.

   Alles loopt over de gewone leden-auth, dus Rahul kan elke handeling zelf doen
   via het stuur (kern/stuur.js) -- behalve wat tussen mensen hoort: uitnodigen,
   iemand eruit zetten en van rol wisselen staan hieronder wel als route, maar de
   AI-taken in kern/genootschap/ai.js raken ze niet aan; die schrijven alleen
   tekst. Gemount vanuit routes/member.js. */
module.exports = (kern) => {
  const { app, auth, geenGast, genootschap, genootschapBeheer, prikbord, bijeenkomst, genootschapAI,
    genootschapInzicht, genootschapUitvoer } = kern;
  const fout = (res, e) => res.status(400).json({ error: (e && e.message) || 'Er ging iets mis.' });
  const uit = (res, r) => r && r.error ? res.status(400).json(r) : res.json(r);
  const id = (req) => req.body.groep;

  // ---- de genootschappen zelf ----
  app.post('/api/genootschap/mijn', auth, (req, res) => {
    if (geenGast(req, res)) return;
    try { res.json(genootschap.mijn(req.session)); } catch (e) { fout(res, e); }
  });

  app.post('/api/genootschap/zoek', auth, (req, res) => {
    if (geenGast(req, res)) return;
    try { res.json(genootschap.zoek(req.session, req.body || {})); } catch (e) { fout(res, e); }
  });

  app.post('/api/genootschap/richt-op', auth, (req, res) => {
    if (geenGast(req, res)) return;
    try { uit(res, genootschap.richtOp(req.session, req.body || {})); } catch (e) { fout(res, e); }
  });

  app.post('/api/genootschap/pas-aan', auth, (req, res) => {
    if (geenGast(req, res)) return;
    try { uit(res, genootschap.pasAan(req.session, id(req), req.body || {})); } catch (e) { fout(res, e); }
  });

  app.post('/api/genootschap/nodig-uit', auth, async (req, res) => {
    if (geenGast(req, res)) return;
    try { uit(res, await genootschap.nodigUit(req.session, id(req), req.body.wie)); } catch (e) { fout(res, e); }
  });

  app.post('/api/genootschap/binnen', auth, (req, res) => {
    if (geenGast(req, res)) return;
    try { uit(res, genootschap.tredBinnen(req.session, id(req))); } catch (e) { fout(res, e); }
  });

  app.post('/api/genootschap/vertrek', auth, (req, res) => {
    if (geenGast(req, res)) return;
    try { uit(res, genootschap.vertrek(req.session, id(req))); } catch (e) { fout(res, e); }
  });

  app.post('/api/genootschap/rol', auth, async (req, res) => {
    if (geenGast(req, res)) return;
    try { uit(res, await genootschapBeheer.rolZet(req.session, id(req), req.body.wie, req.body.rol)); }
    catch (e) { fout(res, e); }
  });

  app.post('/api/genootschap/eruit', auth, async (req, res) => {
    if (geenGast(req, res)) return;
    try { uit(res, await genootschapBeheer.zetUit(req.session, id(req), req.body.wie)); } catch (e) { fout(res, e); }
  });

  // ---- het prikbord ----
  app.post('/api/genootschap/prikbord', auth, (req, res) => {
    if (geenGast(req, res)) return;
    try { uit(res, prikbord.lees(req.session, id(req), req.body || {})); } catch (e) { fout(res, e); }
  });

  app.post('/api/genootschap/prik', auth, (req, res) => {
    if (geenGast(req, res)) return;
    try { uit(res, prikbord.plaats(req.session, id(req), req.body || {})); } catch (e) { fout(res, e); }
  });

  app.post('/api/genootschap/prik-weg', auth, (req, res) => {
    if (geenGast(req, res)) return;
    try { uit(res, prikbord.weg(req.session, id(req), req.body.id)); } catch (e) { fout(res, e); }
  });

  app.post('/api/genootschap/reageer', auth, (req, res) => {
    if (geenGast(req, res)) return;
    try { uit(res, prikbord.reageer(req.session, id(req), req.body.id, req.body.tekst)); } catch (e) { fout(res, e); }
  });

  app.post('/api/genootschap/reactie-weg', auth, (req, res) => {
    if (geenGast(req, res)) return;
    try { uit(res, prikbord.reactieWeg(req.session, id(req), req.body.id, req.body.reactieId)); } catch (e) { fout(res, e); }
  });

  app.post('/api/genootschap/stem', auth, (req, res) => {
    if (geenGast(req, res)) return;
    try { uit(res, prikbord.stem(req.session, id(req), req.body.id, req.body.keuze)); } catch (e) { fout(res, e); }
  });

  // ---- bijeenkomsten ----
  app.post('/api/genootschap/agenda', auth, (req, res) => {
    if (geenGast(req, res)) return;
    try { uit(res, bijeenkomst.agenda(req.session, id(req))); } catch (e) { fout(res, e); }
  });

  app.post('/api/genootschap/mijn-agenda', auth, (req, res) => {
    if (geenGast(req, res)) return;
    try { res.json(bijeenkomst.mijnAgenda(req.session)); } catch (e) { fout(res, e); }
  });

  app.post('/api/genootschap/roep-bijeen', auth, (req, res) => {
    if (geenGast(req, res)) return;
    try { uit(res, bijeenkomst.roepBijeen(req.session, id(req), req.body || {})); } catch (e) { fout(res, e); }
  });

  app.post('/api/genootschap/antwoord', auth, (req, res) => {
    if (geenGast(req, res)) return;
    try { uit(res, bijeenkomst.antwoord(req.session, id(req), req.body.id, req.body.antwoord)); } catch (e) { fout(res, e); }
  });

  app.post('/api/genootschap/afgelast', auth, (req, res) => {
    if (geenGast(req, res)) return;
    try { uit(res, bijeenkomst.afgelast(req.session, id(req), req.body.id, req.body.reden)); } catch (e) { fout(res, e); }
  });

  /* ---- inzicht, bijgepraat en meenemen: elders premium of moeilijk gemaakt ----
     De grenzen zitten in de modules, niet hier: gezondheid is voor beheerders,
     de volledige uitvoer ook, en je eigen inbreng is voor elk lid. Zo staat elke
     grens op een plek. */
  app.post('/api/genootschap/gezondheid', auth, (req, res) => {
    if (geenGast(req, res)) return;
    try { uit(res, genootschapInzicht.gezondheid(req.session, id(req))); } catch (e) { fout(res, e); }
  });

  app.post('/api/genootschap/bijgepraat', auth, (req, res) => {
    if (geenGast(req, res)) return;
    try { uit(res, genootschapInzicht.bijgepraat(req.session, id(req))); } catch (e) { fout(res, e); }
  });

  app.post('/api/genootschap/gezien', auth, (req, res) => {
    if (geenGast(req, res)) return;
    try { uit(res, genootschapInzicht.markeer(req.session, id(req))); } catch (e) { fout(res, e); }
  });

  app.post('/api/genootschap/uitvoer', auth, (req, res) => {
    if (geenGast(req, res)) return;
    try { uit(res, genootschapUitvoer.alles(req.session, id(req))); } catch (e) { fout(res, e); }
  });

  app.post('/api/genootschap/mijn-uitvoer', auth, (req, res) => {
    if (geenGast(req, res)) return;
    try { uit(res, genootschapUitvoer.mijn(req.session, id(req))); } catch (e) { fout(res, e); }
  });

  // ---- Rahul: schrijft en telt, plaatst nooit ----
  app.post('/api/genootschap/ai/aankondiging', auth, async (req, res) => {
    if (geenGast(req, res)) return;
    try { const r = await genootschapAI.aankondiging(req.session, id(req), req.body.steekwoorden); res.status(r.ok ? 200 : 503).json(r); }
    catch (e) { fout(res, e); }
  });

  app.post('/api/genootschap/ai/prikbord', auth, async (req, res) => {
    if (geenGast(req, res)) return;
    try { const r = await genootschapAI.prikbordSamen(req.session, id(req)); res.status(r.ok ? 200 : 503).json(r); }
    catch (e) { fout(res, e); }
  });

  app.post('/api/genootschap/ai/datum', auth, async (req, res) => {
    if (geenGast(req, res)) return;
    try { const r = await genootschapAI.datumRaad(req.session, id(req)); res.status(r.ok ? 200 : 503).json(r); }
    catch (e) { fout(res, e); }
  });
};
