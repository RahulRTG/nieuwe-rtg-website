/* DE DOZEN VAN DEZE ZAAK -- een manager geeft, roteert en trekt de sleutel van
   zijn eigen Zaakdoos in (devices.zaakdoos_sleutel, besluit B12).

   Drie dingen liggen vast:
   - De ZAAK komt uit de sessie (req.supplier.code) en nooit uit het lijf. Een
     manager kan dus geen doos van een andere zaak uitgeven, roteren, intrekken
     of zien: het register behandelt een doos van een ander als onbekend.
   - Uitgeven doet een MENS OP NAAM: een manager met een eigen personeels- of
     RTG-account (staffId of lidKey in de sessie). De gedeelde bedrijfsinlog van
     de demo heeft geen naam en komt er niet door.
   - De kale sleutel staat alleen in het antwoord op uitgeven/roteren
     (no-store, eenmalig-geheim-routes, buiten elke antwoordcache). Het overzicht
     draagt geen sleutel en geen hash. */
module.exports = (kern) => {
  const { app, supplierAuth, managerOnly } = kern;
  const register = () => kern.doosSleutels;
  const opNaam = req => {
    const a = req.actor || {};
    if (a.staffId) return 'zaak:' + req.supplier.code + '#' + a.staffId;
    if (a.lidKey) return 'zaak:' + req.supplier.code + '/' + a.lidKey;
    return '';
  };
  function manager(req, res) {
    if (!managerOnly(req, res)) return null;
    const wie = opNaam(req);
    if (!wie) { res.status(403).json({ error: 'Een doossleutel geeft een manager uit met zijn eigen account, niet met de gedeelde bedrijfsinlog.' }); return null; }
    return wie;
  }

  app.post('/api/supplier/doos/sleutel', supplierAuth, async (req, res) => {
    res.set('Cache-Control', 'no-store');
    const wie = manager(req, res);
    if (!wie) return;
    const b = req.body || {};
    let r;
    try { r = await register().geef({ doos: b.doos, zaak: req.supplier.code, scope: b.scope, dagen: b.dagen, door: wie }); }
    catch (e) { console.error('[doossleutel]', e); return res.status(500).json({ error: 'Er ging iets mis. Probeer het opnieuw.' }); }
    if (r.error) return res.status(r.status || 400).json({ error: r.error });
    res.json(r);
  });

  app.post('/api/supplier/doos/sleutel/weg', supplierAuth, async (req, res) => {
    const wie = manager(req, res);
    if (!wie) return;
    let r;
    try { r = await register().trekIn({ doos: req.body && req.body.doos, zaak: req.supplier.code, door: wie,
      reden: req.body && req.body.reden }); }
    catch (e) { console.error('[doossleutel]', e); return res.status(500).json({ error: 'Er ging iets mis. Probeer het opnieuw.' }); }
    if (r.error) return res.status(r.status || 400).json({ error: r.error });
    res.json(r);
  });

  app.post('/api/supplier/doos/sleutels', supplierAuth, (req, res) => {
    if (!managerOnly(req, res)) return;
    res.json({ ok: true, zaak: req.supplier.code, dozen: register().dozen(req.supplier.code) });
  });
};
