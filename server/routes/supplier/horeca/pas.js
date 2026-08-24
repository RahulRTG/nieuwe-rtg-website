/* Horeca OS (deellaag): DE PAS -- de werklijst van wat gedragen moet worden, en
   wie het heeft opgepakt.

   Het bestaande passcherm (horeca/keuken-regie.js) laat zien wat er onderhanden
   is en geeft per BORD uit. Deze laag zet er de handeling omheen die er in een
   echte zaak omheen zit: iemand pakt een gang op, loopt ernaartoe, en geeft hem
   in één keer uit. Zonder die claim lopen er twee mensen naar tafel 8, of geen.

   De regels staan in kern/horeca/pas.js. Hier staat de poort, wie het deed, en
   het opslaan. */
'use strict';

module.exports = (kern) => {
  const { app, save, schoon, supplierAuth, logActivity, sseToSupplier, horeca } = kern;
  const { H } = horeca;
  const pas = require('../../../kern/horeca/pas')({ horeca, schoon });

  /* Wie ben ik. `staffId` en niet alleen de naam: twee collega's die allebei
     Sam heten zijn anders dezelfde persoon voor het systeem, en dan kan de een
     de claim van de ander loslaten zonder dat iemand het ziet. */
  const wieVan = (req) => ({ staffId: req.actor.staffId == null ? null : String(req.actor.staffId),
    naam: req.actor.name, manager: !!req.actor.manager });

  const rekVan = (req, res) => kern.horecaRekVan(req, res);
  const duw = (code) => sseToSupplier(code, 'sync', { scope: 'keuken' });

  /* ---------- de werklijst ---------- */
  app.post('/api/supplier/horeca/pas/gereed', supplierAuth, (req, res) => {
    const rijen = pas.gereed(H(req.supplier.code));
    const ik = wieVan(req);
    res.json({ ok: true, aantal: rijen.length,
      /* "Van mij" is geen filter maar een markering: wie zijn eigen taken niet
         terugziet tussen die van de rest, loopt er alsnog twee keer heen. */
      gereed: rijen.map((r) => Object.assign({}, r,
        { vanMij: !!(r.claim && String(r.claim.staffId) === String(ik.staffId)) })),
      vrij: rijen.filter((r) => !r.claim).length,
      let: 'Alleen complete gangen staan hier: een gang gaat samen de deur uit.' });
  });

  /* ---------- oppakken ---------- */
  app.post('/api/supplier/horeca/pas/pak', supplierAuth, (req, res) => {
    const r = rekVan(req, res); if (!r) return;
    const uit = pas.pak(r, req.body.gang, wieVan(req));
    if (uit.error) return res.status(uit.status || 400).json({ error: uit.error, code: uit.code || null, claim: uit.claim });
    if (!uit.al) {
      save();
      duw(req.supplier.code);
    }
    res.json({ ok: true, claim: uit.claim, al: !!uit.al });
  });

  /* ---------- loslaten ---------- */
  app.post('/api/supplier/horeca/pas/los', supplierAuth, (req, res) => {
    const r = rekVan(req, res); if (!r) return;
    const uit = pas.los(r, req.body.gang, wieVan(req));
    if (uit.error) return res.status(uit.status || 400).json({ error: uit.error });
    save();
    duw(req.supplier.code);
    res.json({ ok: true, losgelaten: uit.losgelaten });
  });

  /* ---------- overnemen ---------- */
  app.post('/api/supplier/horeca/pas/overneem', supplierAuth, (req, res) => {
    const r = rekVan(req, res); if (!r) return;
    const uit = pas.neemOver(r, req.body.gang, wieVan(req));
    if (uit.error) return res.status(uit.status || 400).json({ error: uit.error });
    save();
    /* Overnemen is geen stille herclaim: het staat in het logboek van de zaak,
       met beide namen erin. */
    logActivity(req.supplier.code, req.actor, 'nam gang ' + req.body.gang + ' op ' +
      (r.tafel || r.kanaal) + ' over van ' + uit.van);
    duw(req.supplier.code);
    res.json({ ok: true, claim: uit.claim, van: uit.van,
      let: 'Overgenomen van ' + uit.van + '. Dat staat in het logboek.' });
  });

  /* ---------- de hele gang uitgeven ---------- */
  app.post('/api/supplier/horeca/pas/uit', supplierAuth, (req, res) => {
    const r = rekVan(req, res); if (!r) return;
    const uit = pas.geefUit(r, req.body.gang, wieVan(req));
    if (uit.error) return res.status(uit.status || 400).json({ error: uit.error, code: uit.code || null });
    save();
    logActivity(req.supplier.code, req.actor, 'gaf gang ' + uit.gang + ' uit op ' + (r.tafel || r.kanaal) +
      ' (' + uit.uitgegeven + ' bord(en))');
    duw(req.supplier.code);
    sseToSupplier(req.supplier.code, 'sync', { scope: 'horeca' });
    res.json({ ok: true, uitgegeven: uit.uitgegeven, gang: uit.gang, rekening: kern.horecaPubliek(r) });
  });

  kern.horecaPas = pas;
};
