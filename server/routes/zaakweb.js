/* Routes voor de bedrijfssite: de zaak-kant van het RTG Web Platform.

   Staat apart van routes/webmaker.js omdat hier een andere inlog en een
   andere rolverdeling geldt: bewerken mag iedereen die bij de zaak werkt,
   maar naar buiten brengen is werk van de leiding. */
module.exports = (kern) => {
  const { app, webmaker, webplatform, webmakerAi, webmakerTeam, supplierAuth, managerOnly } = kern;
  const stuur = (res, r) => r && r.error ? res.status(r.status || 400).json({ error: r.error }) : res.json(r);
  const metWacht = d => Object.assign({}, d, { wacht: webmaker.wacht(d) });

  /* Wie op de site mag staan. Werk van de leiding: iemand op de website
     zetten is een publicatiebesluit over een mens, niet een instelling. */
  app.post('/api/supplier/site/team', supplierAuth, (req, res) => {
    if (!managerOnly(req, res)) return;
    res.json({ lijst: webmakerTeam.lijst(req.supplier.code) });
  });
  app.post('/api/supplier/site/team/zet', supplierAuth, (req, res) => {
    if (!managerOnly(req, res)) return;
    const b = req.body || {};
    stuur(res, webmakerTeam.zet(req.supplier.code, b.id, b.aan === true));
  });

  // dezelfde ontwerpassistent als in de ledenmaker; bewaart niets zelf
  app.post('/api/supplier/site/ai', supplierAuth, async (req, res) => {
    const b = req.body || {};
    res.json(await webmakerAi.schrijf(b.design || {}, b.opdracht));
  });

  /* ---- de bedrijfssite (RTG Web Platform) ----

     De zaak zelf, achter supplierAuth. De site leeft in dezelfde opslag als
     ledensites, met eigenaar 'zaak:CODE' -- dat een site bij een bedrijf
     hoort komt uit de inlog, niet uit het verzoek. "Automatic first":
     genereren maakt in een keer een complete site uit het zaakprofiel en zet
     hem online; "customizable forever": daarna bewerkt de ondernemer hem met
     dezelfde maker als ieder lid. */
  const zaakKey = req => 'zaak:' + req.supplier.code;
  /* Wie het deed. Bij een zaak delen meerdere mensen dezelfde site, dus het
     spoor hoort een naam te noemen -- dezelfde naam die ook in de
     activiteitenlijst van de zaak staat. */
  const wie = req => (req.actor && req.actor.name) || null;
  app.post('/api/supplier/site/genereer', supplierAuth, (req, res) => {
    if (!managerOnly(req, res)) return;   // genereren zet de site meteen online
    const key = zaakKey(req);
    const bestaande = webmaker.mijn(key);
    const opnieuw = !!(req.body || {}).opnieuw;
    if (bestaande.length && !opnieuw) {
      // niet stil overschrijven wat de ondernemer zelf heeft aangepast
      return res.json({ ok: true, bestond: true, design: metWacht(webmaker.haal(key, bestaande[0].id)) });
    }
    const ontwerp = webplatform.genereer(req.supplier);
    if (bestaande.length) ontwerp.id = bestaande[0].id;
    const r = webmaker.bewaar(key, ontwerp, { zaakCode: req.supplier.code, reden: 'opnieuw uit profiel' });
    if (r.error) return stuur(res, r);
    // meteen online op de bedrijfsnaam; is dat adres van een ander, dan naam-code
    let p = webmaker.publiceer(key, r.design.id, webmaker.slug(req.supplier.name));
    if (p.error && p.status === 409) p = webmaker.publiceer(key, r.design.id, webmaker.slug(req.supplier.name + '-' + req.supplier.code));
    if (p.error) return stuur(res, p);
    res.json({ ok: true, design: metWacht(webmaker.haal(key, r.design.id)), adres: p.adres });
  });
  app.post('/api/supplier/site/mijn', supplierAuth, (req, res) => res.json({ lijst: webmaker.mijn(zaakKey(req)) }));
  app.post('/api/supplier/site/haal', supplierAuth, (req, res) => {
    const d = webmaker.haal(zaakKey(req), (req.body || {}).id);
    if (!d) return res.status(404).json({ error: 'Website niet gevonden.' });
    res.json({ design: metWacht(d) });
  });
  app.post('/api/supplier/site/bewaar', supplierAuth, (req, res) => {
    const b = req.body || {};
    stuur(res, webmaker.bewaar(zaakKey(req), b.design || b, { zaakCode: req.supplier.code }));
  });
  /* Naar buiten brengen is werk van de leiding: bewerken mag iedereen die bij
     de zaak werkt, maar het moment waarop het web verandert -- online gaan,
     wijzigingen publiceren, uit de lucht halen -- hoort bij het management.
     Dat is dezelfde grens als op de menukaart en de prijzen. */
  app.post('/api/supplier/site/publiceer', supplierAuth, (req, res) => {
    if (!managerOnly(req, res)) return;
    const b = req.body || {}; stuur(res, webmaker.publiceer(zaakKey(req), b.id, b.adres, wie(req)));
  });
  app.post('/api/supplier/site/live', supplierAuth, (req, res) => {
    if (!managerOnly(req, res)) return;
    stuur(res, webmaker.zetLive(zaakKey(req), (req.body || {}).id, wie(req)));
  });
  app.post('/api/supplier/site/offline', supplierAuth, (req, res) => {
    if (!managerOnly(req, res)) return;
    stuur(res, webmaker.offline(zaakKey(req), (req.body || {}).id, wie(req)));
  });
  app.post('/api/supplier/site/versies', supplierAuth, (req, res) => stuur(res, webmaker.versies(zaakKey(req), (req.body || {}).id)));
  app.post('/api/supplier/site/herstel', supplierAuth, (req, res) => { const b = req.body || {}; stuur(res, webmaker.herstel(zaakKey(req), b.id, b.i, wie(req))); });
  /* publiceren op een gekozen moment, en het spoor: allebei werk van de
     leiding, want het gaat over wat er naar buiten gaat en wie dat deed */
  app.post('/api/supplier/site/plan', supplierAuth, (req, res) => {
    if (!managerOnly(req, res)) return;
    const b = req.body || {};
    stuur(res, webmaker.plan(zaakKey(req), b.id, b.moment, wie(req)));
  });
  app.post('/api/supplier/site/spoor', supplierAuth, (req, res) => {
    if (!managerOnly(req, res)) return;
    stuur(res, webmaker.spoorVan(zaakKey(req), (req.body || {}).id));
  });

};
