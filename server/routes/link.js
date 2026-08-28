/* RTG LINK -- de deur van de adres- en capabilitylaag (kern/link/, LINK.md).

   TWEE LOKETTEN, EN HET VERSCHIL ERTUSSEN IS DE HELE LAAG:

   - /api/link/los     kijkt wat een gescande code is en wat je ermee KUNT.
                       Doet niets. Zet niets in gang. Verstuurt niets.
   - /api/link/koppelingen  wat er van je openstaat, wat er gebeurd is, en wat
                       je er nu nog aan kunt doen.
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
  const { app, express, auth, geenGast, liveCodename, supplierAuth, resolveSession, sessionFor,
          linkLos, linkKoppelingen, linkWieId, linkCapMaak, linkCapAanvaard, linkCapTrek } = kern;
  const wieScant = require('../kern/link/wie')({ sessionFor, resolveSession });

  /* Wat een mens intypt of scant. 4 kB is ruim: een RTG-code is hooguit
     honderdvijftig tekens, en alles daarboven is geen code maar een poging. */
  app.post('/api/link/los', express.json({ limit: '4kb' }), async (req, res) => {
    const wie = wieScant(req);
    if (!wie) return res.status(401).json({ error: 'Niet ingelogd.' });
    const r = await linkLos(wie, req.body && req.body.tekst);
    if (r.error) return res.status(r.status || 400).json({ error: r.error, soort: r.soort || undefined });
    res.json({ type: r.type, wat: r.wat, vorm: r.vorm, onderwerp: r.onderwerp,
      bevestiging: r.bevestiging, bevestigingVervalt: r.bevestigingVervalt,
      intenties: r.intenties });
  });

  /* MIJN KOPPELINGEN (LINK.md par. 4, stap 6). Alleen van jezelf: er gaat geen
     sleutel mee in het verzoek, dus er is geen weg om in de lijst van een ander
     te kijken.

     Een zaak heeft wel bonnen (de kassa aanvaardt capabilities) maar geen
     ledensleutel; die komt binnen op zijn eigen naam. Zo is er een loket voor
     een vraag die voor allebei hetzelfde is. */
  app.post('/api/link/koppelingen', express.json({ limit: '1kb' }), (req, res) => {
    const wie = wieScant(req);
    if (!wie) return res.status(401).json({ error: 'Niet ingelogd.' });
    /* Onder welke naam staan iemands bonnen? Dat rekent de laag uit (linkWieId),
       niet deze deur: twee plekken die een identiteit samenstellen zijn twee
       namen zodra er een rol bijkomt -- en dan schrijft de een waar de ander
       leest. */
    const mij = linkWieId(wie);
    if (!mij) return res.json({ open: [], bonnen: [], partijen: [], nietBewaard: 0 });
    res.json(linkKoppelingen(mij, wie));
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
    /* `eigen` is wat alleen de MAKER terugkrijgt en nooit op de kaart van een
       scanner staat -- bij de kassacode is dat de code van zes tekens, om voor te
       lezen aan een kassa zonder camera. */
    res.json({ token: r.token, exp: r.exp, ttlMs: r.ttlMs, kaart: r.kaart, eigen: r.eigen || undefined });
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

  /* Intrekken zolang er niets mee gebeurd is -- met de code die op je scherm
     staat (capcode), of met het id waaronder hij in je koppelingen staat. Twee
     ingangen, want je hebt hem niet altijd bij de hand; een besluit, want de
     eigenaarscontrole staat in kern/link/cap-beheer.js. */
  app.post('/api/link/cap/trek', auth, (req, res) => {
    if (geenGast(req, res)) return;
    const r = linkCapTrek(alsLid(req), req.body && req.body.capcode, req.body && req.body.id);
    if (r.error) return res.status(r.status || 400).json({ error: r.error });
    res.json({ ok: true });
  });

  /* ---------- de kassakant ----------

     TWEE LOKETTEN VOOR EEN HANDELING, en dat is geen dubbeling maar het gevolg
     van twee werelden met twee poorten. Een lid komt binnen met `auth`, een zaak
     met `supplierAuth` -- die laatste eist rol 'supplier', kijkt de zaak na, en
     draagt de persoonseis van het genre. Wie een kassa langs de ledendeur zou
     laten, zet die poort uit. Wat er ACHTER de deur gebeurt is bij allebei
     dezelfde `capAanvaard`; alleen de geloofsbrief verschilt.

     Het bedrag komt hier binnen en niet in de code: de kassacode is een BEGRENSDE
     opdracht (het lid gaf een maximum af), en wat het werkelijk wordt vult de
     kassa in. Of dat past, bepaalt kern/pay/kassa.js -- dezelfde functie als bij
     /api/supplier/pay/in, en de enige die een kassacode verzilvert. */
  app.post('/api/supplier/link/cap/aanvaard', supplierAuth, async (req, res) => {
    const zaak = { soort: 'supplier', code: req.supplier.code };
    const r = await linkCapAanvaard(zaak, req.body && req.body.capcode, null, req.body || {});
    if (r.error) return res.status(r.status || 400).json({ error: r.error });
    res.json({ ok: true, kaart: r.kaart, uitkomst: r.uitkomst });
  });
};
