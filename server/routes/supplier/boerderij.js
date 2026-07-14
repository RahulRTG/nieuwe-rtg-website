/* Domein "supplier" (deelmodule): boerderij. Draait op de gedeelde kern.
   De slimme bedrijfsvoering van een boer: type kiezen, percelen + gewassen,
   dieren, takenbord en een AI-adviseur die ook echt dingen doet. De logica zit
   in kern/boerderij.js; hier alleen de endpoints + rechten + realtime. */
module.exports = (kern) => {
  const { app, boerderij, logActivity, managerOnly, save, sseToSupplier, supplierAuth } = kern;

  function isBoer(s, res) {
    if (!boerderij.isBoer(s)) { res.status(409).json({ error: 'Dit is geen boerderij.' }); return false; }
    return true;
  }
  // Manager mag alles beheren; gewone knechten mogen loggen (voeren, water, oogst,
  // taak afronden) maar niet de bedrijfsopzet veranderen.
  function sync(s) { sseToSupplier(s.code, 'sync', { scope: 'boerderij' }); }

  // het volledige dashboard (iedereen van het bedrijf mag kijken)
  app.post('/api/supplier/boerderij/overzicht', supplierAuth, (req, res) => {
    const s = req.supplier;
    if (!isBoer(s, res)) return;
    res.json(boerderij.overzicht(s));
  });

  // het boerderijtype kiezen/wijzigen (manager)
  app.post('/api/supplier/boerderij/type', supplierAuth, (req, res) => {
    if (!managerOnly(req, res)) return;
    const s = req.supplier; if (!isBoer(s, res)) return;
    const r = boerderij.kiesType(s, String(req.body.type || ''));
    if (r.error) return res.status(400).json(r);
    logActivity(s.code, req.actor, 'stelde het boerderijtype in');
    sync(s); res.json(boerderij.overzicht(s));
  });

  // perceel toevoegen/wijzigen/verwijderen (manager)
  app.post('/api/supplier/boerderij/perceel', supplierAuth, (req, res) => {
    if (!managerOnly(req, res)) return;
    const s = req.supplier; if (!isBoer(s, res)) return;
    const r = boerderij.zetPerceel(s, req.body || {});
    if (r.error) return res.status(400).json(r);
    logActivity(s.code, req.actor, 'werkte een perceel bij');
    sync(s); res.json(boerderij.overzicht(s));
  });

  // zaaien op een perceel (manager)
  app.post('/api/supplier/boerderij/zaai', supplierAuth, (req, res) => {
    if (!managerOnly(req, res)) return;
    const s = req.supplier; if (!isBoer(s, res)) return;
    const r = boerderij.zaaiPerceel(s, String(req.body.id || ''), String(req.body.gewas || ''));
    if (r.error) return res.status(400).json(r);
    logActivity(s.code, req.actor, 'zaaide een perceel in');
    sync(s); res.json({ ok: true, oogstVerwacht: r.oogstVerwacht, overzicht: boerderij.overzicht(s) });
  });

  // een perceel beregenen (ook staf, dagelijks werk)
  app.post('/api/supplier/boerderij/water', supplierAuth, (req, res) => {
    const s = req.supplier; if (!isBoer(s, res)) return;
    const r = boerderij.waterPerceel(s, String(req.body.id || ''));
    if (r.error) return res.status(400).json(r);
    sync(s); res.json({ ok: true, overzicht: boerderij.overzicht(s) });
  });

  // oogsten (ook staf)
  app.post('/api/supplier/boerderij/oogst', supplierAuth, (req, res) => {
    const s = req.supplier; if (!isBoer(s, res)) return;
    const r = boerderij.oogstPerceel(s, String(req.body.id || ''), req.body.kg);
    if (r.error) return res.status(400).json(r);
    logActivity(s.code, req.actor, 'oogstte een perceel');
    sync(s); res.json({ ok: true, opbrengst: r.opbrengst, eenheid: r.eenheid, overzicht: boerderij.overzicht(s) });
  });

  // diergroep toevoegen/wijzigen/verwijderen (manager)
  app.post('/api/supplier/boerderij/dier', supplierAuth, (req, res) => {
    if (!managerOnly(req, res)) return;
    const s = req.supplier; if (!isBoer(s, res)) return;
    const r = boerderij.zetDier(s, req.body || {});
    if (r.error) return res.status(400).json(r);
    logActivity(s.code, req.actor, 'werkte een diergroep bij');
    sync(s); res.json(boerderij.overzicht(s));
  });

  // dieren voeren (ook staf)
  app.post('/api/supplier/boerderij/voer', supplierAuth, (req, res) => {
    const s = req.supplier; if (!isBoer(s, res)) return;
    const r = boerderij.voerDier(s, String(req.body.id || ''));
    if (r.error) return res.status(400).json(r);
    sync(s); res.json({ ok: true, voerKg: r.voerKg, overzicht: boerderij.overzicht(s) });
  });

  // dagopbrengst van een diergroep vastleggen (ook staf)
  app.post('/api/supplier/boerderij/opbrengst', supplierAuth, (req, res) => {
    const s = req.supplier; if (!isBoer(s, res)) return;
    const r = boerderij.opbrengstDier(s, String(req.body.id || ''), req.body.waarde);
    if (r.error) return res.status(400).json(r);
    sync(s); res.json({ ok: true, overzicht: boerderij.overzicht(s) });
  });

  // taak plannen/verwijderen (manager); afronden mag iedereen
  app.post('/api/supplier/boerderij/taak', supplierAuth, (req, res) => {
    if (!managerOnly(req, res)) return;
    const s = req.supplier; if (!isBoer(s, res)) return;
    const r = boerderij.zetTaak(s, req.body || {});
    if (r.error) return res.status(400).json(r);
    sync(s); res.json(boerderij.overzicht(s));
  });
  app.post('/api/supplier/boerderij/taak/klaar', supplierAuth, (req, res) => {
    const s = req.supplier; if (!isBoer(s, res)) return;
    const r = boerderij.rondTaak(s, String(req.body.id || ''), req.actor && req.actor.name);
    if (r.error) return res.status(400).json(r);
    sync(s); res.json({ ok: true, overzicht: boerderij.overzicht(s) });
  });

  // de AI-adviseur: beantwoordt vragen en voert opdrachten uit (manager)
  app.post('/api/supplier/boerderij/ai', supplierAuth, async (req, res) => {
    if (!managerOnly(req, res)) return;
    const s = req.supplier; if (!isBoer(s, res)) return;
    const r = await boerderij.advies(s, String(req.body.vraag || ''), true);
    if (r.gedaan) { logActivity(s.code, req.actor, 'liet de AI-adviseur iets doen'); sync(s); }
    res.json({ antwoord: r.antwoord, gedaan: !!r.gedaan, overzicht: boerderij.overzicht(s) });
  });
};
