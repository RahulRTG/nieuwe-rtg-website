/* Domein "supplier" (deelmodule): het beveiligings-commandocentrum. De manager
   plant het rooster (of laat de AI het overnemen), bewaakt het budget, beheert
   posten en handelt inzetaanvragen en incidenten af. De bewaker gebruikt de PDA
   (op staffId): eigen diensten, inklokken op post, patrouillerondes, incidenten
   melden en de SOS-noodknop. Draait op kern/beveiliging. */
module.exports = (kern) => {
  const { app, express, supplierAuth, managerOnly,
    bevIsBeveiliging, bevCommand, bevFunctieLijst, bevZetFunctie, bevZetPost, bevVerwijderPost,
    bevBudget, bevZetBudget, bevRooster, bevZetDienst, bevSchrapDienst, bevPlanAuto,
    bevAanvraag, bevAanvraagLijst, bevBeslisAanvraag, bevBeslisIncident,
    bevMijnDiensten, bevInklok, bevUitklok, bevRondeStart, bevRondeCheckpoint, bevRondeKlaar,
    bevMeldIncident, bevSos, BEVEILIGING_SHIFTS, BEVEILIGING_ERNST } = kern;

  // alle endpoints gelden alleen voor een beveiligingsteam
  function eisBeveiliging(req, res) {
    if (bevIsBeveiliging(req.supplier)) return true;
    res.status(409).json({ error: 'Deze functie is er voor beveiligingsteams.' });
    return false;
  }
  const foto = express.json({ limit: '3mb' }); // incidenten met bodycam-foto

  /* ---- commandocentrum ---- */
  app.post('/api/supplier/beveiliging/command', supplierAuth, (req, res) => {
    if (!eisBeveiliging(req, res)) return;
    res.json(Object.assign(bevCommand(req.supplier), { shifts: BEVEILIGING_SHIFTS, ernsten: BEVEILIGING_ERNST }));
  });
  app.post('/api/supplier/beveiliging/functie', supplierAuth, (req, res) => {
    if (!eisBeveiliging(req, res) || !managerOnly(req, res)) return;
    const r = bevZetFunctie(req.supplier, String(req.body.id || ''), req.body.aan !== false);
    if (r.error) return res.status(r.status).json({ error: r.error });
    res.json(r);
  });

  /* ---- posten/objecten ---- */
  app.post('/api/supplier/beveiliging/post', supplierAuth, (req, res) => {
    if (!eisBeveiliging(req, res) || !managerOnly(req, res)) return;
    const r = bevZetPost(req.supplier, req.body || {});
    if (r.error) return res.status(r.status).json({ error: r.error });
    res.json(r);
  });
  app.post('/api/supplier/beveiliging/post/weg', supplierAuth, (req, res) => {
    if (!eisBeveiliging(req, res) || !managerOnly(req, res)) return;
    const r = bevVerwijderPost(req.supplier, String(req.body.id || ''));
    if (r.error) return res.status(r.status).json({ error: r.error });
    res.json(r);
  });

  /* ---- budget ---- */
  app.post('/api/supplier/beveiliging/budget', supplierAuth, (req, res) => {
    if (!eisBeveiliging(req, res)) return;
    if (req.body && (req.body.periodeUren != null || req.body.tariefUur != null)) {
      if (!managerOnly(req, res)) return;
      const r = bevZetBudget(req.supplier, req.body);
      return res.json(r);
    }
    res.json({ ok: true, budget: bevBudget(req.supplier, { maand: req.body && req.body.maand }) });
  });

  /* ---- rooster ---- */
  app.post('/api/supplier/beveiliging/rooster', supplierAuth, (req, res) => {
    if (!eisBeveiliging(req, res)) return;
    res.json(bevRooster(req.supplier, req.body && req.body.van, req.body && req.body.dagen));
  });
  app.post('/api/supplier/beveiliging/dienst', supplierAuth, (req, res) => {
    if (!eisBeveiliging(req, res) || !managerOnly(req, res)) return;
    const r = bevZetDienst(req.supplier, req.body || {});
    if (r.error) return res.status(r.status).json({ error: r.error });
    res.json(r);
  });
  app.post('/api/supplier/beveiliging/dienst/weg', supplierAuth, (req, res) => {
    if (!eisBeveiliging(req, res) || !managerOnly(req, res)) return;
    const r = bevSchrapDienst(req.supplier, String(req.body.id || ''));
    if (r.error) return res.status(r.status).json({ error: r.error });
    res.json(r);
  });
  app.post('/api/supplier/beveiliging/planauto', supplierAuth, (req, res) => {
    if (!eisBeveiliging(req, res) || !managerOnly(req, res)) return;
    const r = bevPlanAuto(req.supplier, req.body && req.body.datum);
    if (r.error) return res.status(r.status).json({ error: r.error });
    res.json(r);
  });

  /* ---- inzetaanvragen ---- */
  app.post('/api/supplier/beveiliging/aanvraag', supplierAuth, (req, res) => {
    if (!eisBeveiliging(req, res)) return;
    const r = bevAanvraag(req.supplier, req.body || {});
    if (r.error) return res.status(r.status).json({ error: r.error });
    res.json(r);
  });
  app.post('/api/supplier/beveiliging/aanvragen', supplierAuth, (req, res) => {
    if (!eisBeveiliging(req, res)) return;
    res.json(bevAanvraagLijst(req.supplier));
  });
  app.post('/api/supplier/beveiliging/aanvraag/beslis', supplierAuth, (req, res) => {
    if (!eisBeveiliging(req, res) || !managerOnly(req, res)) return;
    const r = bevBeslisAanvraag(req.supplier, String(req.body.ref || ''), String(req.body.actie || ''), { autoPlan: req.body.autoPlan });
    if (r.error) return res.status(r.status).json({ error: r.error });
    res.json(r);
  });
  app.post('/api/supplier/beveiliging/incident/beslis', supplierAuth, (req, res) => {
    if (!eisBeveiliging(req, res) || !managerOnly(req, res)) return;
    const r = bevBeslisIncident(req.supplier, String(req.body.id || ''));
    if (r.error) return res.status(r.status).json({ error: r.error });
    res.json(r);
  });

  /* ---- PDA: de bewaker (op staffId) ---- */
  function gid(req) { return req.actor && req.actor.staffId != null ? req.actor.staffId : null; }
  app.post('/api/supplier/beveiliging/pda/diensten', supplierAuth, (req, res) => {
    if (!eisBeveiliging(req, res)) return;
    res.json(bevMijnDiensten(req.supplier.code, gid(req)));
  });
  app.post('/api/supplier/beveiliging/pda/inklok', supplierAuth, (req, res) => {
    if (!eisBeveiliging(req, res)) return;
    const r = bevInklok(req.supplier.code, gid(req), String(req.body.id || ''), req.body.lat, req.body.lng);
    if (r.error) return res.status(r.status).json({ error: r.error });
    res.json(r);
  });
  app.post('/api/supplier/beveiliging/pda/uitklok', supplierAuth, (req, res) => {
    if (!eisBeveiliging(req, res)) return;
    const r = bevUitklok(req.supplier.code, gid(req), String(req.body.id || ''));
    if (r.error) return res.status(r.status).json({ error: r.error });
    res.json(r);
  });
  app.post('/api/supplier/beveiliging/pda/ronde/start', supplierAuth, (req, res) => {
    if (!eisBeveiliging(req, res)) return;
    const r = bevRondeStart(req.supplier.code, gid(req), String(req.body.postId || ''));
    if (r.error) return res.status(r.status).json({ error: r.error });
    res.json(r);
  });
  app.post('/api/supplier/beveiliging/pda/ronde/checkpoint', supplierAuth, (req, res) => {
    if (!eisBeveiliging(req, res)) return;
    const r = bevRondeCheckpoint(req.supplier.code, gid(req), String(req.body.id || ''), req.body.naam, req.body.lat, req.body.lng);
    if (r.error) return res.status(r.status).json({ error: r.error });
    res.json(r);
  });
  app.post('/api/supplier/beveiliging/pda/ronde/klaar', supplierAuth, (req, res) => {
    if (!eisBeveiliging(req, res)) return;
    const r = bevRondeKlaar(req.supplier.code, gid(req), String(req.body.id || ''));
    if (r.error) return res.status(r.status).json({ error: r.error });
    res.json(r);
  });
  app.post('/api/supplier/beveiliging/pda/incident', supplierAuth, foto, (req, res) => {
    if (!eisBeveiliging(req, res)) return;
    const r = bevMeldIncident(req.supplier.code, gid(req), req.body || {});
    if (r.error) return res.status(r.status).json({ error: r.error });
    res.json(r);
  });
  app.post('/api/supplier/beveiliging/pda/sos', supplierAuth, (req, res) => {
    if (!eisBeveiliging(req, res)) return;
    const r = bevSos(req.supplier.code, gid(req), req.body.lat, req.body.lng);
    if (r.error) return res.status(r.status).json({ error: r.error });
    res.json(r);
  });
};
