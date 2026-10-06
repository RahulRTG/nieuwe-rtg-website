/* Domein "supplier" (deelmodule): de kassa aan de deur van een activiteitenzaak.
   Afgesplitst uit ./tickets.js op de 10 kB-grens, toen de deurverkoop eerst de
   plek ging vasthouden en dan pas betalen. */
module.exports = (kern, { heeftTickets }) => {
  const { app, crypto, db, logActivity, pay, ticketsVoorSlot, save, sseToSupplier, supplierAuth, tickettoegang } = kern;

  /* Deurverkoop en VIP-entree: de kassa aan de deur. Het personeelslid verkoopt
     op de PDA (of het kassascherm) een kaartje voor een tijdslot van vandaag,
     contant of met RTG Pay. Het ticket is meteen betaald, de code kan direct
     naar binnen en de omzet telt gewoon mee op de kassa van de zaak. */
  app.post('/api/supplier/ticket/deurverkoop', supplierAuth, async (req, res) => {
    const s = req.supplier;
    if (!heeftTickets(s)) return res.status(409).json({ error: 'Deze sector verkoopt geen tickets.' });
    const act = (s.activiteiten || []).find(a => a.id === String(req.body.activiteitId || ''));
    if (!act) return res.status(404).json({ error: 'Kies een avond of activiteit.' });
    const tijd = String(req.body.tijd || '');
    if (!(act.tijden || []).includes(tijd)) return res.status(400).json({ error: 'Kies een tijdslot.' });
    const personen = Math.min(20, Math.max(1, parseInt(req.body.personen, 10) || 1));
    const vip = req.body.vip === true;
    const datum = new Date().toISOString().slice(0, 10);
    const total = Math.round((act.prijs || 0) * personen * 100) / 100;
    const method = req.body.method === 'rtgpay' ? 'rtgpay' : 'contant';
    const betaalt = method === 'rtgpay' && total > 0;
    const idem = req.body.idem ? String(req.body.idem).slice(0, 120) : null;

    /* EERST DE PLEK, DAN HET GELD. Tellen -> await kasInt -> toevoegen liet twee
       kopers dezelfde plekken verkopen zodra de betaling op echte I/O wachtte.
       Zoals kern/lidacties.js en kern/festival/verkoop.js: het kaartje staat er
       synchroon als `wacht-op-betaling` (ticketsVoorSlot telt het 30 min mee).
       Een retry met dezelfde idem-sleutel hergebruikt die vasthouding. */
    const vastgehouden = betaalt && idem
      ? ticketsVoorSlot(s.code, act.id, datum, tijd).find(t => t.deur && !t.paid && t.deurIdem === idem && t.personen === personen)
      : null;
    if (!vastgehouden) {
      const al = ticketsVoorSlot(s.code, act.id, datum, tijd).reduce((n, t) => n + (t.personen || 1), 0);
      if (al + personen > act.capaciteit) return res.status(409).json({ error: 'Vol: nog ' + Math.max(0, act.capaciteit - al) + ' plekken voor dit tijdslot.' });
    }
    const ticket = vastgehouden || {
      ref: 'D' + crypto.randomBytes(4).toString('hex'),
      kind: 'ticket',
      supplierCode: s.code, supplierName: s.name,
      customerTier: null, customerKey: null, customerCodename: 'Deurverkoop',
      service: { id: act.id, name: act.name, soort: 'ticket' },
      activiteitId: act.id, datum, tijd, personen, vip, deur: true,
      price: total, wanneer: datum + ' ' + tijd,
      betaalMoment: 'deur', status: 'bevestigd', paid: true, at: new Date().toISOString()
    };
    let betaler = null;
    if (betaalt) {
      if (!vastgehouden) {
        Object.assign(ticket, { status: 'wacht-op-betaling', paid: false, deurIdem: idem });
        kern.boekingenVoegToe(ticket);
        save();
      }
      const p = await pay.kasInt({ supplierCode: s.code, code: req.body.payCode, centen: Math.round(total * 100), oms: s.name + ' - ' + act.name, idem: req.body.idem });
      if (p.error) {
        // onbekende uitkomst: plek blijft vast (onbekend is geen mislukking)
        if (p.code !== 'KASCLAIM_HERVATBAAR') { ticket.status = 'geweigerd'; save(); }
        return res.status(p.status || 400).json(p.code ? { error: p.error, code: p.code } : { error: p.error });
      }
      betaler = p.van;
      Object.assign(ticket, { status: 'bevestigd', paid: true, customerCodename: betaler || 'Deurverkoop' });
    } else {
      kern.boekingenVoegToe(ticket);
    }
    const bonnen = db.data.posSales[s.code] = (db.data.posSales[s.code] || []);
    bonnen.unshift({
      id: crypto.randomBytes(4).toString('hex'), bon: ticket.ref, actor: req.actor.name,
      desc: 'Deurverkoop ' + act.name + (vip ? ' (VIP)' : ''), room: null,
      items: [{ name: act.name + (vip ? ' VIP' : ''), qty: personen, price: act.prijs || 0 }],
      total, method, betaler, at: new Date().toISOString()
    });
    db.data.posSales[s.code] = bonnen.slice(0, 300);
    save();
    logActivity(s.code, req.actor, 'verkocht ' + personen + 'x ' + act.name + (vip ? ' (VIP)' : '') + ' aan de deur (' + method + ', € ' + total + ')');
    sseToSupplier(s.code, 'sync', { scope: 'tickets' });
    /* De entreecode is een 128-bit bearer (kern/tickettoegang.js) en staat
       alleen in DIT antwoord kaal. Lukt hij niet, dan is het kaartje wel
       verkocht: de deur vernieuwt hem vanuit het dagprogramma. */
    let code = null;
    try { const t = await tickettoegang.uitgeven({ boeking: ticket, supplierCode: s.code, actor: req.actor.name }); code = t.code || null; }
    catch (e) { code = null; }
    res.set('Cache-Control', 'no-store');
    res.json({ ok: true, eenmalig: true, ticket: { ref: ticket.ref, code, naam: act.name, tijd, personen, vip, total, method } });
  });
};
