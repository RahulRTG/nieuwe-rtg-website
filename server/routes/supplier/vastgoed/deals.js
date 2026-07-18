/* Vastgoed (deelmodule): de deals: de slimme backoffice-cijfers, de
   bezichtigingen met keyless toegang en het beslissen over biedingen (met
   automatische factuur). Krijgt de gedeelde context een keer bij het
   opstarten vanuit routes/supplier/vastgoed.js. */
module.exports = (vctx) => {
  const { app, crypto, db, express, facturatie, logActivity, keyVanCodenaam, managerOnly, media, notify, salonNaarVolgers, save, schoon, sseToCustomer, sseToSupplier, supplierAuth,
    isVastgoed, pandVan, keylessCode } = vctx;

/* De slimme backoffice: kerncijfers, panden, en alles wat aandacht vraagt. */
app.post('/api/supplier/vastgoed/overzicht', supplierAuth, (req, res) => {
  const s = req.supplier;
  if (!isVastgoed(s, res)) return;
  const panden = s.panden || [];
  const bez = db.data.bezichtigingen.filter(b => b.supplierCode === s.code).slice(0, 100);
  const bod = db.data.biedingen.filter(b => b.supplierCode === s.code).slice(0, 100);
  const pandTitel = id => (panden.find(p => p.id === id) || {}).titel || id;
  res.json({
    stats: {
      totaal: panden.length,
      beschikbaar: panden.filter(p => p.status === 'beschikbaar').length,
      onderOptie: panden.filter(p => p.status === 'onder-optie').length,
      verkocht: panden.filter(p => p.status === 'verkocht' || p.status === 'verhuurd').length,
      openBezichtigingen: bez.filter(b => b.status === 'aangevraagd').length,
      openBiedingen: bod.filter(b => b.status === 'open').length,
      portefeuille: panden.filter(p => p.status !== 'verkocht' && p.status !== 'verhuurd').reduce((n, p) => n + (p.transactie === 'koop' ? p.prijs : 0), 0)
    },
    panden,
    aanbiedingen: db.data.vastgoedAanbod.filter(a => a.supplierCode === s.code).slice(0, 60)
      .map(a => ({ ref: a.ref, pand: pandTitel(a.pandId), aan: a.aanKeys.length, publiek: a.publiek, at: a.at })),
    bezichtigingen: bez.map(b => ({ ref: b.ref, pand: pandTitel(b.pandId), codename: b.codename, wens: b.wens, status: b.status, moment: b.moment || null, keyless: !!b.keyless })),
    biedingen: bod.map(b => ({ ref: b.ref, pand: pandTitel(b.pandId), codename: b.codename, bedrag: b.bedrag, status: b.status, tegenbod: b.tegenbod || null }))
  });
});

/* Bezichtiging bevestigen (met moment) en, als het pand keyless is, een
   toegangsvenster verlenen; of afwijzen. */
app.post('/api/supplier/bezichtiging/beslis', supplierAuth, (req, res) => {
  const s = req.supplier;
  if (!isVastgoed(s, res)) return;
  const b = db.data.bezichtigingen.find(x => x.ref === String(req.body.ref || '') && x.supplierCode === s.code);
  if (!b) return res.status(404).json({ error: 'Bezichtiging niet gevonden.' });
  const p = pandVan(s, b.pandId) || {};
  if (req.body.actie === 'afwijzen') { b.status = 'afgewezen'; }
  else if (req.body.actie === 'bevestigen') {
    const moment = String(req.body.moment || '');
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(moment)) return res.status(400).json({ error: 'Kies datum en tijd voor de bezichtiging.' });
    b.status = 'bevestigd'; b.moment = moment;
    // keyless: een venster rond het afgesproken moment (30 min voor tot 2 uur na)
    if (p.keyless) {
      const t = new Date(moment).getTime();
      b.keyless = { code: keylessCode(), van: new Date(t - 30 * 60000).toISOString(), tot: new Date(t + 120 * 60000).toISOString(), gebruikt: [] };
    }
  } else return res.status(400).json({ error: 'Onbekende actie.' });
  save();
  notify(b.customerTier || b.key, { icon: '\u{1F3E1}', title: s.name,
    body: req.body.actie === 'bevestigen'
      ? 'Bezichtiging van ' + p.titel + ' bevestigd: ' + String(b.moment).replace('T', ' ').slice(0, 16) + (b.keyless ? ' \u00B7 keyless toegang staat klaar.' : '')
      : 'De bezichtiging van ' + p.titel + ' kon helaas niet.', scope: 'vastgoed' });
  sseToCustomer(b.key, 'sync', { scope: 'vastgoed' });
  logActivity(s.code, req.actor, (req.body.actie === 'bevestigen' ? 'bevestigde' : 'wees af') + ' bezichtiging ' + b.ref);
  sseToSupplier(s.code, 'sync', { scope: 'vastgoed' });
  res.json({ ok: true });
});

/* Een bod behandelen: accepteren, afwijzen of een tegenbod doen. */
app.post('/api/supplier/bod/beslis', supplierAuth, (req, res) => {
  if (!managerOnly(req, res)) return;
  const s = req.supplier;
  if (!isVastgoed(s, res)) return;
  const b = db.data.biedingen.find(x => x.ref === String(req.body.ref || '') && x.supplierCode === s.code);
  if (!b) return res.status(404).json({ error: 'Bod niet gevonden.' });
  if (b.status !== 'open') return res.status(409).json({ error: 'Dit bod is al behandeld.' });
  const p = pandVan(s, b.pandId) || {};
  if (req.body.actie === 'accepteren') {
    b.status = 'geaccepteerd'; if (pandVan(s, b.pandId)) pandVan(s, b.pandId).status = 'onder-optie';
    // automatische factuur van de transactie voor beide partijen; vastgoed is
    // btw-vrij (bij overdracht geldt overdrachtsbelasting, geen btw op de koopsom).
    if (facturatie && !b.gefactureerd) {
      const koop = (p.transactie || 'koop') === 'huur';
      facturatie.boek({ soort: koop ? 'huur' : 'verkoop', btw: 0, verkoperCode: s.code, verkoperNaam: s.name,
        koper: { key: b.key, naam: b.codename, codenaam: b.codename },
        regels: [{ omschrijving: (koop ? 'Huur ' : 'Aankoop ') + (p.titel || 'pand') + (koop ? ' (per maand)' : ''), aantal: 1, stuk: b.bedrag, btw: 0 }],
        methode: 'via notaris/contract', ref: b.ref });
      b.gefactureerd = true;
    }
  }
  else if (req.body.actie === 'afwijzen') { b.status = 'afgewezen'; }
  else if (req.body.actie === 'tegenbod') {
    const tb = Number(req.body.tegenbod);
    if (!(tb > 0)) return res.status(400).json({ error: 'Geef een geldig tegenbod.' });
    b.status = 'tegenbod'; b.tegenbod = Math.round(tb);
  } else return res.status(400).json({ error: 'Onbekende actie.' });
  save();
  notify(b.customerTier || b.key, { icon: '\u{1F3E1}', title: s.name,
    body: b.status === 'geaccepteerd' ? 'Uw bod op ' + p.titel + ' is geaccepteerd! We stellen een contract op.'
      : b.status === 'tegenbod' ? 'Tegenbod op ' + p.titel + ': \u20AC ' + b.tegenbod.toLocaleString('nl-NL')
      : 'Uw bod op ' + p.titel + ' is helaas afgewezen.', scope: 'vastgoed' });
  sseToCustomer(b.key, 'sync', { scope: 'vastgoed' });
  logActivity(s.code, req.actor, 'behandelde bod ' + b.ref + ' (' + b.status + ')');
  sseToSupplier(s.code, 'sync', { scope: 'vastgoed' });
  res.json({ ok: true, status: b.status });
});
};
