/* Supplier-submodule "vakpro": de pro-laag van de dienstverlenende genres.
   Offertes beantwoorden, het klantenboek (CRM op codenaam), digitale
   werkbonnen en het herhaal-onderhoud met nette herinneringen. Prijs- en
   intervalbeslissingen zijn aan de eigenaar (manager); werkbon en notitie
   mag het hele team. Gemount vanuit routes/supplier.js. */
module.exports = (kern) => {
  const { app, supplierAuth, logActivity } = kern;
  const vak = () => kern.vakwerk;
  const stuur = (res, r) => r.error ? res.status(r.status || 400).json({ error: r.error }) : res.json(r);

  // het pro-overzicht: alles voor het vandaag-bord in een aanroep
  app.post('/api/supplier/vak/pro', supplierAuth, (req, res) => {
    const code = req.supplier.code;
    if (!vak().isVak(req.supplier)) return res.status(403).json({ error: 'Alleen voor dienstverlenende zaken.' });
    res.json({
      ok: true,
      offertes: vak().offertesVanZaak(code),
      werkbonOpen: vak().werkbonOpen(code),
      klanten: vak().klantenboek(code),
      onderhoud: vak().onderhoudLijst(code)
    });
  });

  app.post('/api/supplier/vak/offerte/antwoord', supplierAuth, (req, res) => {
    if (!req.actor.manager) return res.status(403).json({ error: 'Alleen de eigenaar bepaalt de prijs.' });
    const r = vak().offerteAntwoord(req.supplier.code, req.body || {});
    if (!r.error) logActivity(req.supplier.code, req.actor, 'bood offerte ' + req.body.id + ' aan');
    stuur(res, r);
  });
  app.post('/api/supplier/vak/offerte/weiger', supplierAuth, (req, res) => {
    if (!req.actor.manager) return res.status(403).json({ error: 'Alleen de eigenaar wijst een aanvraag af.' });
    const r = vak().offerteWeiger(req.supplier.code, req.body || {});
    if (!r.error) logActivity(req.supplier.code, req.actor, 'wees offerte ' + req.body.id + ' af');
    stuur(res, r);
  });

  app.post('/api/supplier/vak/werkbon', supplierAuth, (req, res) => {
    const r = vak().werkbonZet(req.supplier.code, req.actor, req.body || {});
    if (!r.error) logActivity(req.supplier.code, req.actor, 'schreef de werkbon van ' + req.body.ref);
    stuur(res, r);
  });

  app.post('/api/supplier/vak/klantnotitie', supplierAuth, (req, res) => {
    stuur(res, vak().klantNotitie(req.supplier.code, req.body || {}));
  });

  app.post('/api/supplier/vak/dienst/herhaal', supplierAuth, (req, res) => {
    if (!req.actor.manager) return res.status(403).json({ error: 'Alleen voor de eigenaar.' });
    stuur(res, vak().herhaalZet(req.supplier.code, req.body || {}));
  });
  app.post('/api/supplier/vak/onderhoud/herinner', supplierAuth, (req, res) => {
    const r = vak().onderhoudHerinner(req.supplier.code, req.body || {});
    if (!r.error) logActivity(req.supplier.code, req.actor, 'stuurde een onderhoudsherinnering');
    stuur(res, r);
  });
};
