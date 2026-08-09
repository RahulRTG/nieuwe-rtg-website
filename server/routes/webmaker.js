/* Routes voor de Website-maker (leden) en de RTG-browser.

   Bouwen en publiceren zit achter de gewone leden-inlog en is voor echte leden
   (geen gast). De browser-gids en het openen van een site mag elk ingelogd lid,
   zodat je door het RTG-web kunt bladeren. */
module.exports = (kern) => {
  const { app, auth, webmaker, webplatform, antivirus, media, supplierAuth, findSupplier, addTicket, liveCodename, save } = kern;
  const FOTO_MAX_BYTES = 2 * 1024 * 1024; // ~2 MB per foto
  const stuur = (res, r) => r && r.error ? res.status(r.status || 400).json({ error: r.error }) : res.json(r);
  const geenGast = (req, res) => {
    if (req.session.tier === 'guest') { res.status(403).json({ error: 'Een eigen website maken is voor leden. Word lid om te beginnen.' }); return true; }
    return false;
  };

  // ---- de maker (eigenaar) ----
  app.post('/api/site/mijn', auth, (req, res) => { if (geenGast(req, res)) return; res.json({ lijst: webmaker.mijn(req.session.key) }); });
  app.post('/api/site/haal', auth, (req, res) => {
    if (geenGast(req, res)) return;
    const d = webmaker.haal(req.session.key, (req.body || {}).id);
    if (!d) return res.status(404).json({ error: 'Website niet gevonden.' });
    res.json({ design: d });
  });
  app.post('/api/site/bewaar', auth, (req, res) => { if (geenGast(req, res)) return; const b = req.body || {}; stuur(res, webmaker.bewaar(req.session.key, b.design || b)); });
  app.post('/api/site/verwijder', auth, (req, res) => { if (geenGast(req, res)) return; stuur(res, webmaker.verwijder(req.session.key, (req.body || {}).id)); });
  app.post('/api/site/publiceer', auth, (req, res) => { if (geenGast(req, res)) return; const b = req.body || {}; stuur(res, webmaker.publiceer(req.session.key, b.id, b.adres)); });
  app.post('/api/site/offline', auth, (req, res) => { if (geenGast(req, res)) return; stuur(res, webmaker.offline(req.session.key, (req.body || {}).id)); });

  // ---- eigen foto's: uploaden (na virusscan), tonen en weghalen ----
  app.post('/api/site/fotos', auth, (req, res) => { if (geenGast(req, res)) return; res.json({ fotos: webmaker.fotos(req.session.key) }); });
  app.post('/api/site/foto', auth, async (req, res) => {
    if (geenGast(req, res)) return;
    const dataUrl = String((req.body || {}).dataUrl || '');
    /* jpeg, png en webp, en met opzet geen gif: server/media.js slaat alleen
       die drie op en /media serveert alleen die drie. Stond gif hier wel
       toegestaan, dan kwam het bestand door deze deur en door de
       Ontsmetter heen om daarna te stranden op "kon niet worden
       opgeslagen" -- een onbegrijpelijke fout voor iets wat de app zelf
       zei aan te nemen. */
    if (!/^data:image\/(jpeg|png|webp);base64,/.test(dataUrl)) return res.status(400).json({ error: 'Kies een afbeelding (jpg, png of webp).' });
    if (dataUrl.length > FOTO_MAX_BYTES * 1.4) return res.status(400).json({ error: 'De foto is te groot (max ~2 MB).' });
    // eerst door de Ontsmetter: besmette bestanden komen er niet in
    const veilig = antivirus && antivirus.veiligeFoto ? antivirus.veiligeFoto(dataUrl, { bron: 'site-foto', door: req.session.key }) : { ok: true };
    if (!veilig.ok) return res.status(400).json({ error: veilig.error || 'De foto is geweigerd door de beveiliging.' });
    // dan versleuteld naar de mediastore; in db.data komt alleen de /media-url
    let url = null;
    try { url = media && media.bewaarPubliek ? await media.bewaarPubliek(dataUrl, FOTO_MAX_BYTES) : null; } catch (e) { url = null; }
    if (!url) return res.status(400).json({ error: 'De foto kon niet worden opgeslagen.' });
    stuur(res, webmaker.fotoBewaar(req.session.key, url));
  });
  app.post('/api/site/foto-weg', auth, (req, res) => { if (geenGast(req, res)) return; stuur(res, webmaker.fotoWeg(req.session.key, String((req.body || {}).url || ''))); });

  /* ---- de bedrijfssite (RTG Web Platform) ----

     De zaak zelf, achter supplierAuth. De site leeft in dezelfde opslag als
     ledensites, met eigenaar 'zaak:CODE' -- dat een site bij een bedrijf
     hoort komt uit de inlog, niet uit het verzoek. "Automatic first":
     genereren maakt in een keer een complete site uit het zaakprofiel en zet
     hem online; "customizable forever": daarna bewerkt de ondernemer hem met
     dezelfde maker als ieder lid. */
  const zaakKey = req => 'zaak:' + req.supplier.code;
  app.post('/api/supplier/site/genereer', supplierAuth, (req, res) => {
    const key = zaakKey(req);
    const bestaande = webmaker.mijn(key);
    const opnieuw = !!(req.body || {}).opnieuw;
    if (bestaande.length && !opnieuw) {
      // niet stil overschrijven wat de ondernemer zelf heeft aangepast
      return res.json({ ok: true, bestond: true, design: webmaker.haal(key, bestaande[0].id) });
    }
    const ontwerp = webplatform.genereer(req.supplier);
    if (bestaande.length) ontwerp.id = bestaande[0].id;
    const r = webmaker.bewaar(key, ontwerp, { zaakCode: req.supplier.code });
    if (r.error) return stuur(res, r);
    // meteen online op de bedrijfsnaam; is dat adres van een ander, dan naam-code
    let p = webmaker.publiceer(key, r.design.id, webmaker.slug(req.supplier.name));
    if (p.error && p.status === 409) p = webmaker.publiceer(key, r.design.id, webmaker.slug(req.supplier.name + '-' + req.supplier.code));
    if (p.error) return stuur(res, p);
    res.json({ ok: true, design: webmaker.haal(key, r.design.id), adres: p.adres });
  });
  app.post('/api/supplier/site/mijn', supplierAuth, (req, res) => res.json({ lijst: webmaker.mijn(zaakKey(req)) }));
  app.post('/api/supplier/site/haal', supplierAuth, (req, res) => {
    const d = webmaker.haal(zaakKey(req), (req.body || {}).id);
    if (!d) return res.status(404).json({ error: 'Website niet gevonden.' });
    res.json({ design: d });
  });
  app.post('/api/supplier/site/bewaar', supplierAuth, (req, res) => {
    const b = req.body || {};
    stuur(res, webmaker.bewaar(zaakKey(req), b.design || b, { zaakCode: req.supplier.code }));
  });
  app.post('/api/supplier/site/publiceer', supplierAuth, (req, res) => { const b = req.body || {}; stuur(res, webmaker.publiceer(zaakKey(req), b.id, b.adres)); });
  app.post('/api/supplier/site/offline', supplierAuth, (req, res) => { stuur(res, webmaker.offline(zaakKey(req), (req.body || {}).id)); });

  // ---- de browser (elk ingelogd lid mag bladeren) ----
  app.post('/api/browser/gids', auth, (req, res) => { res.json({ lijst: webmaker.gids() }); });
  app.post('/api/browser/open', auth, (req, res) => {
    const r = webmaker.open((req.body || {}).adres);
    if (r.error) return stuur(res, r);
    /* hoort de site bij een zaak, dan worden de live blokken nu uit het
       zaakprofiel opgelost en krijgt de browser de acties mee -- zo weet het
       scherm dat dit een bedrijf is en niet zomaar een pagina. */
    const s = (r.site.zaakCode && findSupplier) ? findSupplier(r.site.zaakCode) : null;
    r.site = webplatform.losSite(r.site, s);
    res.json({ ok: true, site: r.site, zaak: s ? webplatform.zaakInfo(s) : null });
  });
  /* het formulier op een bedrijfssite: het bericht landt als klus (ticket) bij
     de zaak zelf, op de codenaam van het lid -- geen los postvak dat niemand
     leest, maar de werklijst die de zaak al heeft. */
  app.post('/api/browser/bericht', auth, (req, res) => {
    const b = req.body || {};
    const tekst = String(b.tekst || '').trim().slice(0, 500);
    if (tekst.length < 3) return res.status(400).json({ error: 'Schrijf eerst een bericht.' });
    const code = webmaker.zaakVanAdres(b.adres);
    const s = code && findSupplier ? findSupplier(code) : null;
    if (!s) return res.status(404).json({ error: 'Deze site heeft geen bedrijf erachter; het formulier werkt alleen op bedrijfssites.' });
    addTicket(s.code, { name: 'RTG-web · ' + (liveCodename ? liveCodename(req.session) : 'lid') }, 'Websitebericht: ' + tekst.slice(0, 140));
    save();
    res.json({ ok: true });
  });
  /* universeel zoeken: sites en bedrijven in een adem. Een bedrijf met een
     eigen online site krijgt het adres mee, zodat zoeken direct het RTG-web in
     leidt. */
  app.post('/api/browser/zoek', auth, (req, res) => {
    const q = (req.body || {}).q;
    const zaken = webplatform.zoekZaken(q).map(z => Object.assign(z, { adres: webmaker.adresVanZaak(z.code) || '' }));
    res.json({ sites: webmaker.zoek(q), zaken });
  });
};
