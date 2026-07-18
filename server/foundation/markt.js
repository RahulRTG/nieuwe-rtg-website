/* RTFoundation-marktplaats: gezinnen kopen en verkopen (gedeelde motor
   kern/markt.js, ook gebruikt door leveranciers). Veiligheid ingebouwd:
   kinderprofielen (beschermd) mogen alleen kijken, niet plaatsen of chatten.
   Gemount vanuit foundation.js op de gedeelde context. */
module.exports = (ctx) => {
  const { router, familieVan, isBeschermd } = ctx;

  let markt = null;
  function setMarkt(m) { markt = m; }
  function marktKlaar(res) { if (!markt) { res.status(503).json({ error: 'De marktplaats is nu even niet beschikbaar.' }); return false; } return true; }
  function marktPartij(s) {
    return { soort: 'rtf', id: s.g.code + ':' + s.p.id, naam: s.p.codenaam || s.p.naam, badge: 'gezin', magVerkopen: !isBeschermd(s.p) };
  }
  function marktVolwassen(s, res) {
    if (isBeschermd(s.p)) { res.status(403).json({ error: 'Dit is voor kinderveiligheid alleen voor volwassenen in het gezin. Je kunt wel rondkijken.' }); return false; }
    return true;
  }

  router.post('/markt/lijst', (req, res) => {
    if (!marktKlaar(res)) return;
    const s = familieVan(req, res); if (!s) return;
    res.json(markt.lijst(req.body || {}, marktPartij(s)));
  });
  router.post('/markt/detail', (req, res) => {
    if (!marktKlaar(res)) return;
    const s = familieVan(req, res); if (!s) return;
    const d = markt.detail(String(req.body.id || ''), marktPartij(s));
    if (!d) return res.status(404).json({ error: 'Advertentie niet gevonden.' });
    res.json({ ad: d });
  });
  router.post('/markt/mijn', (req, res) => {
    if (!marktKlaar(res)) return;
    const s = familieVan(req, res); if (!s) return;
    res.json({ ads: markt.mijn(marktPartij(s)), postvak: markt.postvak(marktPartij(s)) });
  });
  router.post('/markt/plaats', (req, res) => {
    if (!marktKlaar(res)) return;
    const s = familieVan(req, res); if (!s) return;
    if (!marktVolwassen(s, res)) return;
    const r = markt.plaats(req.body || {}, marktPartij(s));
    if (r.error) return res.status(r.status || 400).json(r);
    res.json(r);
  });
  router.post('/markt/status', (req, res) => {
    if (!marktKlaar(res)) return;
    const s = familieVan(req, res); if (!s) return;
    const r = markt.zetStatus(String(req.body.id || ''), marktPartij(s), String(req.body.status || ''));
    if (r.error) return res.status(r.status || 400).json(r);
    res.json(r);
  });
  router.post('/markt/verwijder', (req, res) => {
    if (!marktKlaar(res)) return;
    const s = familieVan(req, res); if (!s) return;
    const r = markt.verwijder(String(req.body.id || ''), marktPartij(s));
    if (r.error) return res.status(r.status || 400).json(r);
    res.json(r);
  });
  router.post('/markt/reageer', (req, res) => {
    if (!marktKlaar(res)) return;
    const s = familieVan(req, res); if (!s) return;
    if (!marktVolwassen(s, res)) return;
    const r = markt.reageer(String(req.body.id || ''), marktPartij(s), String(req.body.tekst || ''));
    if (r.error) return res.status(r.status || 400).json(r);
    res.json(r);
  });
  router.post('/markt/antwoord', (req, res) => {
    if (!marktKlaar(res)) return;
    const s = familieVan(req, res); if (!s) return;
    if (!marktVolwassen(s, res)) return;
    const r = markt.antwoord(String(req.body.chatId || ''), marktPartij(s), String(req.body.tekst || ''));
    if (r.error) return res.status(r.status || 400).json(r);
    res.json(r);
  });
  router.post('/markt/postvak', (req, res) => {
    if (!marktKlaar(res)) return;
    const s = familieVan(req, res); if (!s) return;
    res.json({ postvak: markt.postvak(marktPartij(s)) });
  });
  router.post('/markt/chat', (req, res) => {
    if (!marktKlaar(res)) return;
    const s = familieVan(req, res); if (!s) return;
    const r = markt.chatOpen(String(req.body.chatId || ''), marktPartij(s));
    if (r.error) return res.status(r.status || 400).json(r);
    res.json(r);
  });
  // veilig samen betalen: prijs afspreken -> beide GPS bij elkaar -> factuur -> betalen
  router.post('/markt/deal/voorstel', (req, res) => {
    if (!marktKlaar(res)) return;
    const s = familieVan(req, res); if (!s) return;
    if (!marktVolwassen(s, res)) return;
    const r = markt.dealVoorstel(String(req.body.chatId || ''), marktPartij(s), req.body.bedrag);
    if (r.error) return res.status(r.status || 400).json(r);
    res.json(r);
  });
  router.post('/markt/deal/hier', (req, res) => {
    if (!marktKlaar(res)) return;
    const s = familieVan(req, res); if (!s) return;
    if (!marktVolwassen(s, res)) return;
    const r = markt.dealHier(String(req.body.chatId || ''), marktPartij(s), req.body.lat, req.body.lng);
    if (r.error) return res.status(r.status || 400).json(r);
    res.json(r);
  });
  router.post('/markt/deal/betaal', async (req, res) => {
    if (!marktKlaar(res)) return;
    const s = familieVan(req, res); if (!s) return;
    if (!marktVolwassen(s, res)) return;
    const r = await markt.dealBetaal(String(req.body.chatId || ''), marktPartij(s), String(req.body.methode || 'apple-pay'));
    if (r.error) return res.status(r.status || 400).json(r);
    res.json(r);
  });
  router.post('/markt/meld', (req, res) => {
    if (!marktKlaar(res)) return;
    const s = familieVan(req, res); if (!s) return;
    const r = markt.meld(String(req.body.id || ''), marktPartij(s), String(req.body.reden || ''));
    if (r.error) return res.status(r.status || 400).json(r);
    res.json(r);
  });
  router.post('/markt/blokkeer', (req, res) => {
    if (!marktKlaar(res)) return;
    const s = familieVan(req, res); if (!s) return;
    const r = markt.blokkeer(marktPartij(s), String(req.body.soort || ''), String(req.body.doelId || ''));
    if (r.error) return res.status(r.status || 400).json(r);
    res.json(r);
  });
  router.post('/markt/ai', async (req, res) => {
    if (!marktKlaar(res)) return;
    const s = familieVan(req, res); if (!s) return;
    const r = await markt.aiHelp(String(req.body.soort || 'beschrijving'), req.body || {});
    res.json(r);
  });

  return { setMarkt };
};
