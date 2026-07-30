/* Routes van de werkvloer-laag: de koppellaag (twee schermen, één
   handeling), de tafellijst met wensen en allergenen, en de gedeelde
   checklijst. Alle drie draaien op de zaak-inlog, en die is voor de
   leverancier-app op het bureau EN voor de PDA in de broekzak dezelfde --
   daarom werkt het overzetten tussen die twee vanzelf: het is één zaak,
   twee schermen, en req.actor zegt wie er tekent of afvinkt.

   RTG Kantoren kijkt mee op de koppellaag van een zaak (bijvoorbeeld om te
   zien of een factuur is afgetekend), maar tekent nooit voor een ander. */
module.exports = (kern) => {
  const { app, supplierAuth, officeAuth, managerOnly, logActivity, koppel, tafelwensen, checklijst } = kern;
  const stuur = (res, r) => r.error ? res.status(r.status || 400).json({ error: r.error }) : res.json(r);
  const zaak = req => req.supplier.code;
  // req.actor is de persoon achter dit scherm; zijn naam tekent en vinkt af
  const wie = req => String((req.actor && req.actor.name) || 'onbekend');

  /* ---------- de koppellaag ---------- */
  app.post('/api/werkvloer/koppel', supplierAuth, (req, res) => res.json(koppel.mijn(zaak(req), req.body || {})));
  app.post('/api/werkvloer/koppel/maak', supplierAuth, (req, res) => {
    const r = koppel.maak(zaak(req), wie(req), req.body || {});
    if (!r.error) logActivity(req.supplier.code, req.actor, 'zette een verzoek klaar voor het andere scherm: ' + r.verzoek.titel);
    stuur(res, r);
  });
  app.post('/api/werkvloer/koppel/code', supplierAuth, (req, res) => stuur(res, koppel.code(zaak(req), req.body.id)));
  app.post('/api/werkvloer/koppel/teken', supplierAuth, (req, res) => {
    const r = koppel.teken(zaak(req), req.body.id, wie(req), req.body.paden);
    if (!r.error) logActivity(req.supplier.code, req.actor, 'tekende: ' + r.verzoek.titel);
    stuur(res, r);
  });
  app.post('/api/werkvloer/koppel/betaald', supplierAuth, (req, res) => {
    if (!managerOnly(req, res)) return;
    stuur(res, koppel.betaalMelden(zaak(req), req.body.id, req.body.ref, req.body.hoe));
  });
  app.post('/api/werkvloer/koppel/annuleer', supplierAuth, (req, res) => stuur(res, koppel.annuleer(zaak(req), req.body.id, wie(req))));
  // RTG Kantoren kijkt mee bij een zaak; tekenen doet het kantoor niet
  app.post('/api/office/koppel', officeAuth, (req, res) => res.json(koppel.mijn(String(req.body.zaak || ''), req.body || {})));

  /* ---------- de tafellijst met wensen en allergenen ---------- */
  app.post('/api/werkvloer/tafels', supplierAuth, (req, res) => res.json(tafelwensen.tafelLijst(zaak(req), req.body || {})));
  app.post('/api/werkvloer/tafel', supplierAuth, (req, res) =>
    stuur(res, tafelwensen.tafelZet(zaak(req), req.body.tafel || {}, req.body.id ? String(req.body.id) : null)));
  app.post('/api/werkvloer/tafel/weg', supplierAuth, (req, res) => {
    if (!managerOnly(req, res)) return;
    stuur(res, tafelwensen.tafelWeg(zaak(req), req.body.id));
  });
  app.post('/api/werkvloer/keukenbord', supplierAuth, (req, res) => res.json(tafelwensen.keukenbord(zaak(req), req.body || {})));
  app.post('/api/werkvloer/bedieningskaart', supplierAuth, (req, res) => stuur(res, tafelwensen.bedieningskaart(zaak(req), req.body.id)));

  /* ---------- de gedeelde checklijst ---------- */
  app.post('/api/werkvloer/checklijsten', supplierAuth, (req, res) => res.json(checklijst.mijn(zaak(req), wie(req), req.body || {})));
  app.post('/api/werkvloer/checklijst', supplierAuth, (req, res) => {
    const r = checklijst.maak(zaak(req), wie(req), req.body.lijst || {});
    if (!r.error) logActivity(req.supplier.code, req.actor, 'maakte de checklijst: ' + r.lijst.titel);
    stuur(res, r);
  });
  app.post('/api/werkvloer/checklijst/vink', supplierAuth, (req, res) =>
    stuur(res, checklijst.vink(zaak(req), req.body.id, req.body.item, wie(req), req.body.aan !== false)));
  app.post('/api/werkvloer/checklijst/item', supplierAuth, (req, res) =>
    stuur(res, checklijst.itemBij(zaak(req), req.body.id, wie(req), req.body.tekst, req.body.voor)));
  app.post('/api/werkvloer/checklijst/deel', supplierAuth, (req, res) =>
    stuur(res, checklijst.deel(zaak(req), req.body.id, wie(req), req.body.met)));
  app.post('/api/werkvloer/checklijst/weg', supplierAuth, (req, res) =>
    stuur(res, checklijst.weg(zaak(req), req.body.id, wie(req))));
};
