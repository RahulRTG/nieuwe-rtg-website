/* RTG LINK -- de deur van de adres- en capabilitylaag (kern/link/, LINK.md).

   TWEE LOKETTEN, EN HET VERSCHIL ERTUSSEN IS DE HELE LAAG:

   - /api/link/los     kijkt wat een gescande code is en wat je ermee KUNT.
                       Doet niets. Zet niets in gang. Verstuurt niets.
   - /api/link/bonnen  wat je er eerder wel echt mee hebt gedaan.
   - /api/link/cap/*   de capability: een code die een HANDELING draagt --
                       maken, aanvaarden, intrekken.

   Er is met opzet GEEN /api/link/doe. De handeling loopt langs de weg die de
   intentie noemt, en daar drukt een mens op -- dezelfde volgorde als bij de
   contactpin (kijken en verbinden zijn daar twee loketten, en om dezelfde reden).
   Een deur die scant en meteen uitvoert, voert iets uit wat niemand bewust vroeg.

   DE POORT ZIT IN DE HANDLER en niet in een middleware, net als bij
   routes/code.js: elke rol mag hier komen (een lid, een zaak, een medewerker,
   het kantoor), maar wat hij te zien krijgt hangt af van wie hij is. Zonder
   geldige sessie is het 401 -- kern/link/wie.js doet die controle op het token
   zelf en niet op de vorm van de kop. */
module.exports = (kern) => {
  const { app, express, auth, geenGast, liveCodename, resolveSession, sessionFor,
          linkLos, linkBonnen, linkCapMaak, linkCapAanvaard, linkCapTrek } = kern;
  const wieScant = require('../kern/link/wie')({ sessionFor, resolveSession });

  /* Wat een mens intypt of scant. 4 kB is ruim: een RTG-code is hooguit
     honderdvijftig tekens, en alles daarboven is geen code maar een poging. */
  app.post('/api/link/los', express.json({ limit: '4kb' }), async (req, res) => {
    const wie = wieScant(req);
    if (!wie) return res.status(401).json({ error: 'Niet ingelogd.' });
    const r = await linkLos(wie, req.body && req.body.tekst);
    if (r.error) return res.status(r.status || 400).json({ error: r.error, soort: r.soort || undefined });
    res.json({ type: r.type, wat: r.wat, vorm: r.vorm, onderwerp: r.onderwerp, intenties: r.intenties });
  });

  /* De eigen bonnen. Alleen van jezelf: er gaat geen sleutel mee in het verzoek,
     dus er is geen weg om in de lijst van een ander te kijken. Een zaak of een
     medewerker heeft geen handle en dus geen bonnenlijst -- die krijgt een lege,
     en dat is eerlijker dan een 403 op iets wat gewoon niet bestaat. */
  app.post('/api/link/bonnen', express.json({ limit: '1kb' }), (req, res) => {
    const wie = wieScant(req);
    if (!wie) return res.status(401).json({ error: 'Niet ingelogd.' });
    if (!wie.key) return res.json({ bonnen: [], nietBewaard: 0 });
    res.json(linkBonnen(wie.key));
  });

  /* ---------- de capability (kern/link/cap.js) ----------

     DEZE DRIE STAAN ACHTER `auth` EN DE VORIGE TWEE NIET, en dat verschil is
     geen slordigheid. Kijken wat een code is, doet iedereen die onze app open
     heeft: een zaak aan de kassa, een medewerker op de vloer, een lid. Een
     capability MAKEN of AANVAARDEN is een handeling op naam van een mens -- er
     hoort een sleutel bij, een codenaam, en de poorten van het domein dat de
     handeling bezit. Daar hoort de gewone ledenpoort omheen.

     Het veld heet `capcode` en niet `token` of `code`, om dezelfde reden als
     `livecode` bij de contactpin: `token` is aan de gezinskant al de sessie, en
     twee namen voor hetzelfde ding over twee apps is hoe de volgende die dit
     leest het weer fout doet. */
  const alsLid = (req) => ({ soort: 'lid', key: req.session.key,
    codenaam: liveCodename(req.session), sessie: req.session });

  // een code maken die een handeling draagt (welke, zegt het register)
  app.post('/api/link/cap/maak', auth, (req, res) => {
    if (geenGast(req, res)) return;
    const r = linkCapMaak(alsLid(req), req.body || {});
    if (r.error) return res.status(r.status || 400).json({ error: r.error });
    res.json({ token: r.token, exp: r.exp, ttlMs: r.ttlMs, kaart: r.kaart });
  });

  /* Aanvaarden: kijken deed /api/link/los al, en dat is met opzet een ander
     loket. Wie hier aanklopt, heeft het bedoelingsscherm gezien en op bevestigen
     gedrukt -- dit is de daad, niet de blik. */
  app.post('/api/link/cap/aanvaard', auth, async (req, res) => {
    if (geenGast(req, res)) return;
    const r = await linkCapAanvaard(alsLid(req), req.body && req.body.capcode, req.session);
    if (r.error) return res.status(r.status || 400).json({ error: r.error, kyc: r.kyc || undefined });
    res.json({ ok: true, kaart: r.kaart, uitkomst: r.uitkomst });
  });

  // intrekken zolang er niets mee gebeurd is
  app.post('/api/link/cap/trek', auth, (req, res) => {
    if (geenGast(req, res)) return;
    const r = linkCapTrek(alsLid(req), req.body && req.body.capcode);
    if (r.error) return res.status(r.status || 400).json({ error: r.error });
    res.json({ ok: true });
  });
};
