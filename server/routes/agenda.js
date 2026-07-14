/* De persoonlijke AI-agenda: dezelfde motor voor leden (in de backoffice van hun
   pas) en leveranciers (in de boardroom). Eigenaar-sleutel: 'lid:<key>' of
   'sup:<code>'. Altijd-aan gemount. */
module.exports = (kern) => {
  const { app, agenda, auth, geenGast, supplierAuth, managerOnly } = kern;

  // ---------- lid ----------
  const lidKey = (req) => 'lid:' + req.session.key;
  app.post('/api/agenda/mijn-lijst', auth, (req, res) => {
    res.json({ items: agenda.lijst(lidKey(req)), telling: agenda.telling(lidKey(req)) });
  });
  app.post('/api/agenda/toevoegen', auth, (req, res) => {
    if (geenGast(req, res)) return;
    const r = agenda.voegToe(lidKey(req), req.body || {});
    if (r.error) return res.status(400).json(r);
    res.json({ ok: true, items: agenda.lijst(lidKey(req)), telling: agenda.telling(lidKey(req)) });
  });
  app.post('/api/agenda/wijzig', auth, (req, res) => {
    const r = agenda.wijzig(lidKey(req), req.body || {});
    if (r.error) return res.status(400).json(r);
    res.json({ ok: true, items: agenda.lijst(lidKey(req)), telling: agenda.telling(lidKey(req)) });
  });
  app.post('/api/agenda/verwijder', auth, (req, res) => {
    agenda.verwijder(lidKey(req), String(req.body.id || ''));
    res.json({ ok: true, items: agenda.lijst(lidKey(req)), telling: agenda.telling(lidKey(req)) });
  });
  app.post('/api/agenda/ai', auth, async (req, res) => {
    if (geenGast(req, res)) return;
    const r = await agenda.aiVoegToe(lidKey(req), String(req.body.opdracht || ''), true);
    res.json({ antwoord: r.antwoord, gedaan: !!r.gedaan, items: agenda.lijst(lidKey(req)), telling: agenda.telling(lidKey(req)) });
  });

  // ---------- leverancier ----------
  const supKey = (req) => 'sup:' + req.supplier.code;
  app.post('/api/supplier/agenda/lijst', supplierAuth, (req, res) => {
    res.json({ items: agenda.lijst(supKey(req)), telling: agenda.telling(supKey(req)) });
  });
  app.post('/api/supplier/agenda/toevoegen', supplierAuth, (req, res) => {
    if (!managerOnly(req, res)) return;
    const r = agenda.voegToe(supKey(req), req.body || {});
    if (r.error) return res.status(400).json(r);
    res.json({ ok: true, items: agenda.lijst(supKey(req)), telling: agenda.telling(supKey(req)) });
  });
  app.post('/api/supplier/agenda/wijzig', supplierAuth, (req, res) => {
    if (!managerOnly(req, res)) return;
    const r = agenda.wijzig(supKey(req), req.body || {});
    if (r.error) return res.status(400).json(r);
    res.json({ ok: true, items: agenda.lijst(supKey(req)), telling: agenda.telling(supKey(req)) });
  });
  app.post('/api/supplier/agenda/verwijder', supplierAuth, (req, res) => {
    if (!managerOnly(req, res)) return;
    agenda.verwijder(supKey(req), String(req.body.id || ''));
    res.json({ ok: true, items: agenda.lijst(supKey(req)), telling: agenda.telling(supKey(req)) });
  });
  app.post('/api/supplier/agenda/ai', supplierAuth, async (req, res) => {
    if (!managerOnly(req, res)) return;
    const r = await agenda.aiVoegToe(supKey(req), String(req.body.opdracht || ''), true);
    res.json({ antwoord: r.antwoord, gedaan: !!r.gedaan, items: agenda.lijst(supKey(req)), telling: agenda.telling(supKey(req)) });
  });
};
