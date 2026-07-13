/* Domein "supplier" (deelmodule): tickets. Draait op de gedeelde kern. */
module.exports = (kern) => {
  const { app, crypto, db, logActivity, ticketsVoorSlot, managerOnly, save, schoon, sseToCustomer, sseToSupplier, supplierAuth } = kern;

/* ================== tickets: activiteiten, tours en musea ================== */
function heeftTickets(s) {
  return ((db.data.supplierTypes[s.type] || {}).caps || []).includes('tickets');
}

app.post('/api/supplier/activiteit', supplierAuth, (req, res) => {
  if (!managerOnly(req, res)) return;
  const s = req.supplier;
  if (!heeftTickets(s)) return res.status(409).json({ error: 'Deze sector verkoopt geen tickets.' });
  if (!Array.isArray(s.activiteiten)) s.activiteiten = [];
  if (req.body.weg) {
    s.activiteiten = s.activiteiten.filter(a => a.id !== req.body.id);
    save(); sseToSupplier(s.code, 'sync', { scope: 'tickets' });
    return res.json({ ok: true, activiteiten: s.activiteiten });
  }
  const name = schoon(req.body.name, 60);
  const prijs = Number(req.body.prijs);
  const capaciteit = Math.min(500, Math.max(1, parseInt(req.body.capaciteit, 10) || 0));
  const tijden = (Array.isArray(req.body.tijden) ? req.body.tijden : String(req.body.tijden || '').split(','))
    .map(t => String(t).trim()).filter(t => /^\d{2}:\d{2}$/.test(t)).slice(0, 12);
  if (!name) return res.status(400).json({ error: 'Geef de activiteit een naam.' });
  if (!(prijs >= 0) || prijs > 10000) return res.status(400).json({ error: 'Geef een geldige prijs op.' });
  if (!capaciteit) return res.status(400).json({ error: 'Geef de capaciteit per tijdslot op.' });
  if (!tijden.length) return res.status(400).json({ error: 'Geef minstens een tijdslot op (bijv. 10:00).' });
  const velden = { name, desc: schoon(req.body.desc, 140), prijs, capaciteit, duur: schoon(req.body.duur, 30), tijden };
  if (req.body.id) {
    const a = s.activiteiten.find(x => x.id === req.body.id);
    if (!a) return res.status(404).json({ error: 'Activiteit niet gevonden.' });
    Object.assign(a, velden);
  } else {
    if (s.activiteiten.length >= 30) return res.status(400).json({ error: 'Tot 30 activiteiten per zaak.' });
    s.activiteiten.push({ id: 'a' + crypto.randomBytes(3).toString('hex'), ...velden });
  }
  save();
  logActivity(s.code, req.actor, 'werkte het activiteitenaanbod bij');
  sseToSupplier(s.code, 'sync', { scope: 'tickets' });
  res.json({ ok: true, activiteiten: s.activiteiten });
});

/* Het dagprogramma: per activiteit en tijdslot de bezetting en de gastenlijst.
   Voor de zaak-tab en de PDA (gids, security, ticketbalie). */
app.post('/api/supplier/programma', supplierAuth, (req, res) => {
  const s = req.supplier;
  if (!heeftTickets(s)) return res.status(409).json({ error: 'Deze sector verkoopt geen tickets.' });
  const datum = /^\d{4}-\d{2}-\d{2}$/.test(String(req.body.datum || '')) ? req.body.datum : new Date().toISOString().slice(0, 10);
  const slots = [];
  for (const a of (s.activiteiten || [])) {
    for (const tijd of (a.tijden || [])) {
      const kaartjes = ticketsVoorSlot(s.code, a.id, datum, tijd).filter(t => t.paid);
      slots.push({
        activiteitId: a.id, naam: a.name, tijd, capaciteit: a.capaciteit,
        verkocht: kaartjes.reduce((n, t) => n + (t.personen || 1), 0),
        binnen: kaartjes.filter(t => t.checkin).reduce((n, t) => n + (t.personen || 1), 0),
        gasten: kaartjes.map(t => ({ codename: t.customerCodename, personen: t.personen || 1, code: t.code, binnen: !!t.checkin }))
      });
    }
  }
  slots.sort((x, y) => x.tijd.localeCompare(y.tijd));
  res.json({ datum, slots });
});

/* Check-in aan de deur: het personeelslid (security, gids, balie) vinkt de
   entreecode af, op eigen naam. Een ticket kan maar een keer naar binnen. */
app.post('/api/supplier/ticket/checkin', supplierAuth, (req, res) => {
  const s = req.supplier;
  if (!heeftTickets(s)) return res.status(409).json({ error: 'Deze sector verkoopt geen tickets.' });
  const code = String(req.body.code || '').trim().toUpperCase();
  if (!code) return res.status(400).json({ error: 'Voer de entreecode in.' });
  const t = db.data.boekingen.find(b => b.kind === 'ticket' && b.supplierCode === s.code && b.code === code);
  if (!t) return res.status(404).json({ error: 'Deze code hoort niet bij een ticket van uw zaak.' });
  if (!t.paid) return res.status(409).json({ error: 'Dit ticket is nog niet betaald.' });
  if (t.checkin) return res.status(409).json({ error: 'Al binnen: om ' + String(t.checkin.at).slice(11, 16) + ' afgevinkt door ' + t.checkin.door + '.' });
  const vandaag = new Date().toISOString().slice(0, 10);
  if (t.datum !== vandaag) return res.status(409).json({ error: 'Dit ticket is voor ' + t.datum + ' (' + t.tijd + '), niet voor vandaag.' });
  t.checkin = { at: new Date().toISOString(), door: req.actor.name, staffId: req.actor.staffId || null };
  t.status = 'afgerond';
  save();
  logActivity(s.code, req.actor, 'checkte ' + t.customerCodename + ' in (' + t.service.name + ', ' + (t.personen || 1) + 'p)');
  sseToCustomer(t.customerKey || t.customerTier, 'sync', { scope: 'tickets' });
  sseToSupplier(s.code, 'sync', { scope: 'tickets' });
  res.json({ ok: true, ticket: { naam: t.service.name, tijd: t.tijd, personen: t.personen || 1, codename: t.customerCodename } });
});

/* De eigen transferdienst van een activiteitenzaak: chauffeurs van de zaak
   halen gasten op; prijs 0 = inclusief bij het ticket, anders het afgesproken
   vaste bedrag per rit. De ritten zelf lopen via de gewone rittenmachinerie. */
app.post('/api/supplier/transfer', supplierAuth, (req, res) => {
  if (!managerOnly(req, res)) return;
  const s = req.supplier;
  if (s.type !== 'activiteit') return res.status(409).json({ error: 'De transferdienst is voor activiteitenzaken.' });
  if (!s.transfer || typeof s.transfer !== 'object') s.transfer = { aan: false, prijs: 0 };
  if (req.body.aan != null) s.transfer.aan = !!req.body.aan;
  if (req.body.prijs != null) {
    const p = Number(req.body.prijs);
    if (!(p >= 0) || p > 1000) return res.status(400).json({ error: 'Geef een prijs tussen 0 (inclusief) en 1000 op.' });
    s.transfer.prijs = Math.round(p);
  }
  save();
  logActivity(s.code, req.actor, 'zette de transferdienst ' + (s.transfer.aan ? 'aan (\u20AC ' + s.transfer.prijs + ')' : 'uit'));
  sseToSupplier(s.code, 'sync', { scope: 'tickets' });
  res.json({ ok: true, transfer: s.transfer });
});

};
