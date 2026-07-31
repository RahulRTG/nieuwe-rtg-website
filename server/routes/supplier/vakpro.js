/* Supplier-submodule "vakpro": de pro-laag van de dienstverlenende genres.
   Offertes beantwoorden, het klantenboek (CRM op codenaam), digitale
   werkbonnen en het herhaal-onderhoud met nette herinneringen. Prijs- en
   intervalbeslissingen zijn aan de eigenaar (manager); werkbon en notitie
   mag het hele team. Gemount vanuit routes/supplier.js. */
module.exports = (kern) => {
  const { app, supplierAuth, logActivity } = kern;
  const vak = () => kern.vakwerk;
  const stuur = (res, r) => r.error ? res.status(r.status || 400).json({ error: r.error }) : res.json(r);

  /* EEN DEUR VOOR DE HELE PRO-LAAG.

     Alleen vak/pro en vak/capaciteit vroegen hiervoor of de zaak wel een
     vakzaak IS; de rest leunde erop dat alles op supplierCode gefilterd wordt.
     Veilig was dat wel -- een restaurant vond niets -- maar het antwoord zei
     "dat bestaat niet" waar dit huis elders "u hoort hier niet" zegt, en dat
     verschil hoort niet van route tot route te wisselen. Nu staat de controle
     op alle pro-routes, met dezelfde 403 en dezelfde zin. */
  function eisVak(req, res) {
    if (!vak().isVak(req.supplier)) { res.status(403).json({ error: 'Alleen voor dienstverlenende zaken.' }); return false; }
    return true;
  }

  // het pro-overzicht: alles voor het vandaag-bord in een aanroep; de
  // ritme-tick plant hier meteen de volgende vaste afspraken in
  app.post('/api/supplier/vak/pro', supplierAuth, (req, res) => {
    const code = req.supplier.code;
    if (!eisVak(req, res)) return;
    vak().ritmeTick(code);
    res.json({
      ok: true,
      offertes: vak().offertesVanZaak(code),
      werkbonOpen: vak().werkbonOpen(code),
      klanten: vak().klantenboek(code),
      onderhoud: vak().onderhoudLijst(code),
      ritmes: vak().ritmesVanZaak(code),
      wachtlijst: vak().wachtVanZaak(code),
      beoordelingen: vak().reviewsVanZaak(code)
    });
  });

  app.post('/api/supplier/vak/ritme/stop', supplierAuth, (req, res) => {
    if (!eisVak(req, res)) return;
    stuur(res, vak().ritmeStop({ code: req.supplier.code }, (req.body || {}).id));
  });
  app.post('/api/supplier/vak/wachtlijst/uitnodig', supplierAuth, (req, res) => {
    if (!eisVak(req, res)) return;
    const r = vak().wachtUitnodig(req.supplier.code, req.body || {});
    if (!r.error) logActivity(req.supplier.code, req.actor, 'nodigde een wachtende uit');
    stuur(res, r);
  });
  app.post('/api/supplier/vak/capaciteit', supplierAuth, (req, res) => {
    if (!eisVak(req, res)) return;
    if (!req.actor.manager) return res.status(403).json({ error: 'Alleen voor de eigenaar.' });
    stuur(res, vak().urenZet(req.supplier.code, { capaciteit: (req.body || {}).capaciteit }));
  });

  app.post('/api/supplier/vak/offerte/antwoord', supplierAuth, (req, res) => {
    if (!eisVak(req, res)) return;
    if (!req.actor.manager) return res.status(403).json({ error: 'Alleen de eigenaar bepaalt de prijs.' });
    const r = vak().offerteAntwoord(req.supplier.code, req.body || {});
    if (!r.error) logActivity(req.supplier.code, req.actor, 'bood offerte ' + req.body.id + ' aan');
    stuur(res, r);
  });
  app.post('/api/supplier/vak/offerte/weiger', supplierAuth, (req, res) => {
    if (!eisVak(req, res)) return;
    if (!req.actor.manager) return res.status(403).json({ error: 'Alleen de eigenaar wijst een aanvraag af.' });
    const r = vak().offerteWeiger(req.supplier.code, req.body || {});
    if (!r.error) logActivity(req.supplier.code, req.actor, 'wees offerte ' + req.body.id + ' af');
    stuur(res, r);
  });

  app.post('/api/supplier/vak/werkbon', supplierAuth, (req, res) => {
    if (!eisVak(req, res)) return;
    const r = vak().werkbonZet(req.supplier.code, req.actor, req.body || {});
    if (!r.error) logActivity(req.supplier.code, req.actor, 'schreef de werkbon van ' + req.body.ref);
    stuur(res, r);
  });

  app.post('/api/supplier/vak/klantnotitie', supplierAuth, (req, res) => {
    if (!eisVak(req, res)) return;
    stuur(res, vak().klantNotitie(req.supplier.code, req.body || {}));
  });

  app.post('/api/supplier/vak/dienst/herhaal', supplierAuth, (req, res) => {
    if (!eisVak(req, res)) return;
    if (!req.actor.manager) return res.status(403).json({ error: 'Alleen voor de eigenaar.' });
    stuur(res, vak().herhaalZet(req.supplier.code, req.body || {}));
  });
  app.post('/api/supplier/vak/onderhoud/herinner', supplierAuth, (req, res) => {
    if (!eisVak(req, res)) return;
    const r = vak().onderhoudHerinner(req.supplier.code, req.body || {});
    if (!r.error) logActivity(req.supplier.code, req.actor, 'stuurde een onderhoudsherinnering');
    stuur(res, r);
  });
};
