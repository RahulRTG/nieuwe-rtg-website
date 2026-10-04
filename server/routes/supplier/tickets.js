/* Domein "supplier" (deelmodule): tickets. Draait op de gedeelde kern. */
module.exports = (kern) => {
  const { app, crypto, db, logActivity, pay, ticketsVoorSlot, managerOnly, save, schoon, sseToSupplier, supplierAuth, tickettoegang } = kern;

/* ================== tickets: activiteiten, tours en musea ================== */
function heeftTickets(s) {
  return (db.capsVan(s)).includes('tickets');
}

app.post('/api/supplier/activiteit', supplierAuth, (req, res) => {
  if (!managerOnly(req, res)) return;
  const s = req.supplier;
  if (!heeftTickets(s)) return res.status(409).json({ error: 'Deze sector verkoopt geen tickets.' });
  /* KIJKEN ZONDER NEER TE ZETTEN: vier keuringen hieronder kunnen nog weigeren,
     en een 400 hoort geen lege lijst achter te laten. Bestaat de lijst, dan is
     dit hem ECHT. */
  const bestaande = Array.isArray(s.activiteiten) ? s.activiteiten : [];
  if (req.body.weg) {
    s.activiteiten = bestaande.filter(a => a.id !== req.body.id);
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
    const a = bestaande.find(x => x.id === req.body.id);
    if (!a) return res.status(404).json({ error: 'Activiteit niet gevonden.' });
    Object.assign(a, velden);
  } else {
    if (bestaande.length >= 30) return res.status(400).json({ error: 'Tot 30 activiteiten per zaak.' });
    // pas hier komt er iets bij, en pas hier hoort het vak te ontstaan
    if (!Array.isArray(s.activiteiten)) s.activiteiten = [];
    s.activiteiten.push({ id: 'a' + crypto.randomBytes(3).toString('hex'), ...velden });
  }
  save();
  logActivity(s.code, req.actor, 'werkte het activiteitenaanbod bij');
  sseToSupplier(s.code, 'sync', { scope: 'tickets' });
  res.json({ ok: true, activiteiten: s.activiteiten });
});

// de sluitdagen (dag dicht/open, zonder bestaande boekingen te raken): ./tickets-dicht.js
require('./tickets-dicht')(kern, { heeftTickets });

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
        // VIP eerst: aan de deur wil je die namen bovenaan zien staan
        gasten: kaartjes.map(t => ({ codename: t.customerCodename, personen: t.personen || 1, ref: t.ref, deur: !!t.deur, binnen: !!t.checkin, vip: !!t.vip, zorg: t.zorg || null }))
          .sort((a, b) => (b.vip ? 1 : 0) - (a.vip ? 1 : 0))
      });
    }
  }
  slots.sort((x, y) => x.tijd.localeCompare(y.tijd));
  res.json({ datum, slots });
});

// check-in aan de deur en het vernieuwen van een deurticket: ./tickets-deur.js
require('./tickets-deur')(kern, { heeftTickets });

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
