/* De API van het communicatieplatform, tweede helft: WAT JE MET EEN BERICHT
   DOET nadat het er staat -- wijzigen, wissen, een reactie, de leesstand, de
   vlaggen, het concept, typen, de por, zoeken en @Rahul.

   Geknipt uit ./comm.js omdat dat bestand over de leesgrens van dit huis ging.
   De naad is echt: de eerste helft opent gesprekken en verstuurt, deze helft
   raakt alleen de stand van wat er al is. Aangeroepen op de plek waar deze
   routes stonden, want in dit huis is de volgorde van registreren ook de
   volgorde van afhandelen.

   Net zo dun als de andere helft: auth, doorgeven aan kern/comm, antwoord
   terug. Elke regel staat in de kern, want daar komt ook elke andere module
   langs. */
module.exports = ({ app, auth, geenGast, comm, commAi, fout, mij }) => {
  app.post('/api/comm/wijzig', auth, (req, res) => {
    if (geenGast(req, res)) return;
    try { comm.wijzig(mij(req), req.body.id, req.body.berichtId, req.body.tekst); res.json({ ok: true }); }
    catch (e) { fout(res, e); }
  });
  app.post('/api/comm/wis', auth, (req, res) => {
    if (geenGast(req, res)) return;
    try { comm.wis(mij(req), req.body.id, req.body.berichtId); res.json({ ok: true }); }
    catch (e) { fout(res, e); }
  });
  app.post('/api/comm/reactie', auth, (req, res) => {
    if (geenGast(req, res)) return;
    try { res.json({ ok: true, reacties: comm.reactie(mij(req), req.body.id, req.body.berichtId, req.body.teken) }); }
    catch (e) { fout(res, e); }
  });

  app.post('/api/comm/lees', auth, (req, res) => {
    if (geenGast(req, res)) return;
    try { res.json({ ok: true, stand: comm.lees(mij(req), req.body.id) }); }
    catch (e) { fout(res, e); }
  });
  app.post('/api/comm/vlag', auth, (req, res) => {
    if (geenGast(req, res)) return;
    try { res.json({ ok: true, stand: comm.vlag(mij(req), req.body.id, req.body.vlag, !!req.body.aan) }); }
    catch (e) { fout(res, e); }
  });
  app.post('/api/comm/concept', auth, (req, res) => {
    if (geenGast(req, res)) return;
    try { res.json({ ok: true, stand: comm.concept(mij(req), req.body.id, req.body.tekst) }); }
    catch (e) { fout(res, e); }
  });

  /* Typen en aanwezigheid. Deze route schrijft NIETS naar de database (zie de
     opmerking bij de Map in kern/comm): een toetsaanslag hoort geen schrijfronde
     te kosten. */
  app.post('/api/comm/typt', auth, (req, res) => {
    if (geenGast(req, res)) return;
    try { comm.typtNu(mij(req), req.body.id); res.json({ ok: true }); }
    catch (e) { fout(res, e); }
  });

  /* De por. Hij mag door "stil" heen -- dat is zijn hele bestaansreden -- en
     is precies daarom begrensd tot een per minuut per gesprek. De rem zit in
     de kern, zodat hij ook geldt als een module hem aanroept. */
  app.post('/api/comm/por', auth, (req, res) => {
    if (geenGast(req, res)) return;
    try { comm.nudge(mij(req), req.body.id); res.json({ ok: true }); }
    catch (e) { fout(res, e); }
  });

  app.post('/api/comm/zoek', auth, (req, res) => {
    if (geenGast(req, res)) return;
    try { res.json({ ok: true, ...comm.zoek(mij(req), req.body.vraag) }); }
    catch (e) { fout(res, e); }
  });

  /* @Rahul in een gesprek. Drie taken, en alle drie leveren TEKST: een
     samenvatting, een concept-antwoord, of de afspraken. Er gaat hier niets
     weg naar de andere kant -- het antwoord belandt in het invoerveld en de
     mens drukt zelf op versturen. Dezelfde drempel als bij geld. */
  app.post('/api/comm/ai', auth, async (req, res) => {
    if (geenGast(req, res)) return;
    if (!commAi) return res.status(503).json({ error: 'De AI is nu niet bereikbaar.' });
    try {
      const taak = String(req.body.taak || 'samenvat');
      const uit = taak === 'concept' ? await commAi.concept(mij(req), req.body.id, req.body.wens)
        : taak === 'afspraken' ? await commAi.afspraken(mij(req), req.body.id)
          : await commAi.samenvat(mij(req), req.body.id);
      if (!uit.ok) return res.status(uit.status || 503).json({ error: uit.reden });
      res.json(uit);
    } catch (e) { fout(res, e); }
  });
};
