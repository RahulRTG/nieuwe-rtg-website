/* Staff (deelmodule): DE VERTROUWENSPERSOON.

   Afgesplitst van ./dienst.js, dat over de 10 KB ging. De snede loopt langs een
   echte grens, en het is de belangrijkste grens in deze hele map: wat een
   medewerker hier schrijft komt NIET bij zijn werkgever. Niet in de state, niet
   in een melding, niet in een overzicht. Alleen de vertrouwenspersoon van RTG
   leest het, en anoniem versturen kan ook.

   Daarom staat het apart: een route die per ongeluk in het zaak-overzicht
   belandt, is hier geen bug maar een schending. Wie dit bestand aanraakt, weet
   waar hij aan zit. */
module.exports = (actx) => {
  const { app, crypto, db, save, schoon, sseToOffice, supplierAuth } = actx;


app.post('/api/staff/trust/send', supplierAuth, (req, res) => {
  if (!req.actor.staffId) return res.status(403).json({ error: 'Alleen met een persoonlijke login.' });
  const text = schoon(req.body.text, 800);
  if (!text) return res.status(400).json({ error: 'Leeg bericht.' });
  let t = db.data.trustLine.find(x => x.code === req.supplier.code && x.staffId === req.actor.staffId);
  if (!t) {
    t = { id: crypto.randomBytes(4).toString('hex'), code: req.supplier.code, company: req.supplier.name,
          staffId: req.actor.staffId, anon: !!req.body.anon, name: req.actor.name, messages: [], open: true, lastAt: null };
    db.data.trustLine.unshift(t);
    db.data.trustLine = db.data.trustLine.slice(0, 2000);
  }
  if (req.body.anon != null) t.anon = !!req.body.anon;
  t.messages.push({ from: 'staff', text, at: new Date().toISOString() });
  t.messages = t.messages.slice(-60);
  t.open = true;
  t.lastAt = new Date().toISOString();
  save();
  // bewust GEEN logActivity en GEEN notifySupplier: dit blijft buiten de werkgever om
  sseToOffice('sync', { scope: 'trust' });
  res.json({ ok: true, trust: trustVan(req.supplier.code, req.actor.staffId) });
});

app.post('/api/staff/trust/thread', supplierAuth, (req, res) => {
  if (!req.actor.staffId) return res.status(403).json({ error: 'Alleen met een persoonlijke login.' });
  res.json({ trust: trustVan(req.supplier.code, req.actor.staffId) });
});
};
