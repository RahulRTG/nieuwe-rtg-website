/* Domein "supplier" (deelmodule): de deur van een activiteitenzaak. Afgesplitst
   uit ./tickets.js op de 10 kB-grens.

   De entreecode is een 128-bit bearer die in kern/tickettoegang.js woont. Hier
   staan de twee handelingen van de deur: scannen (de claim) en het vernieuwen
   van een DEURticket -- een kaartje dat aan de deur is verkocht en dus geen lid
   heeft dat hem zelf kan tonen. Een ledenticket vernieuwt alleen het lid. */
module.exports = (kern, { heeftTickets }) => {
  const { app, save, logActivity, sseToCustomer, sseToSupplier, supplierAuth, tickettoegang } = kern;

  /* Check-in: het personeelslid (security, gids, balie) scant de code, op
     eigen naam. De claim legt de check-in vast in de collectietransactie van
     de code; twee poorten die tegelijk scannen laten het ticket een keer
     binnen. Daarna krijgt de boeking de projectie. */
  app.post('/api/supplier/ticket/checkin', supplierAuth, async (req, res) => {
    const s = req.supplier;
    if (!heeftTickets(s)) return res.status(409).json({ error: 'Deze sector verkoopt geen tickets.' });
    const code = String(req.body.code || '').trim();
    if (!code) return res.status(400).json({ error: 'Voer de entreecode in.' });
    let r;
    try {
      tickettoegang.ruimLegacy();
      r = await tickettoegang.claim({ code, supplierCode: s.code, actor: req.actor, boekingVan: kern.boekingMetRef });
    } catch (e) { return res.status(503).json({ error: 'De entreecode kon nu niet veilig worden gecontroleerd. Probeer het zo opnieuw.' }); }
    const t = r.ref ? kern.boekingMetRef(r.ref) : null;
    // de projectie op de boeking: bij een geslaagde claim, en ter reparatie als
    // een eerdere claim wel vaststond maar de boeking hem miste
    if (t && r.checkin && !t.checkin) { t.checkin = r.checkin; t.status = 'afgerond'; save(); }
    if (r.error) return res.status(r.status).json({ error: r.error });
    logActivity(s.code, req.actor, 'checkte ' + t.customerCodename + ' in (' + t.service.name + ', ' + (t.personen || 1) + 'p' + (t.vip ? ', VIP' : '') + ')');
    if (t.customerKey || t.customerTier) sseToCustomer(t.customerKey || t.customerTier, 'sync', { scope: 'tickets' });
    sseToSupplier(s.code, 'sync', { scope: 'tickets' });
    res.json({ ok: true, ticket: { naam: t.service.name, tijd: t.tijd, personen: t.personen || 1, codename: t.customerCodename, vip: !!t.vip, zorg: t.zorg || null } });
  });

  /* Een deurticket vernieuwen (de gast is zijn code kwijt, of het kaartje is
     van voor de 128-bit code). Uitgeven is roteren: de vorige code is daarna
     ingetrokken. Alleen voor kaartjes van deze zaak zonder lid. */
  app.post('/api/supplier/ticket/toon', supplierAuth, async (req, res) => {
    const s = req.supplier;
    if (!heeftTickets(s)) return res.status(409).json({ error: 'Deze sector verkoopt geen tickets.' });
    const b = kern.boekingMetRef(String(req.body.ref || '').slice(0, 40));
    let r;
    try {
      tickettoegang.ruimLegacy();
      r = await tickettoegang.uitgeven({ boeking: b, supplierCode: s.code, actor: req.actor && req.actor.name });
    } catch (e) { return res.status(503).json({ error: 'De entreecode kon nu niet veilig worden gemaakt. Probeer het zo opnieuw.' }); }
    if (r.error) return res.status(r.status).json({ error: r.error });
    logActivity(s.code, req.actor, 'vernieuwde de entreecode van deurticket ' + b.ref);
    res.set('Cache-Control', 'no-store');
    res.json({ ok: true, eenmalig: true, ref: b.ref, code: r.code, toegang: r.toegang });
  });
};
