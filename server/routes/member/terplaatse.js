/* Member-submodule: ter plaatse bij een partner. De digitale gastsleutel
   (deur openen bij aankomst), om aandacht vragen (rekening/bestellen/hulp),
   de gastchat met de zaak per afdeling en de event-aanmelding (RSVP op de
   gastenlijst). Gemount vanuit routes/member.js. */
module.exports = (kern) => {
  const { app, auth, db, save, crypto, findSupplier, optieAan, unlockDoor, logActivity,
    notifySupplier, notify, sseToSupplier, sseToOffice, sseToCustomer, schoon, PERSONAS,
    DOOR_RELOCK_MS, validDept, getChat, chatKeyOf, talen, trChat } = kern;

  app.post('/api/live/door', auth, (req, res) => {
    const L = db.data.live[req.session.key];
    if (!L || !L.active) return res.status(409).json({ error: 'U bent niet onderweg.' });
    const dest = L.destCode ? findSupplier(L.destCode) : null;
    if (!dest || !(dest.doors || []).length) return res.status(404).json({ error: 'Deze bestemming heeft geen digitale deuren.' });
    if (!optieAan(dest, 'deurenGast')) return res.status(409).json({ error: dest.name + ' heeft de digitale gastsleutel op dit moment uitstaan. Meld u bij de receptie.' });
    if (!L.arrived) return res.status(409).json({ error: 'De deur opent pas als u bent aangekomen.' });
    const door = dest.doors[0];
    unlockDoor(dest, door, L.codename);
    logActivity(dest.code, { name: L.codename }, 'gast opende "' + door.name + '" via de app');
    notifySupplier(dest.code, { icon: '🔓', title: 'Deur geopend', body: L.codename + ' heeft "' + door.name + '" geopend via de app.' });
    res.json({ ok: true, door: { name: door.name, relockSec: DOOR_RELOCK_MS / 1000 } });
  });

  /* De gast vraagt zelf om aandacht (roept de bediening) bij een zaak. Belandt als
     prioriteit op het scherm van het personeel (PDA) en de zaak-backoffice, zodat
     niemand ooit hoeft te wachten of te zwaaien. Service op 5-sterrenniveau. */
  app.post('/api/aandacht', auth, (req, res) => {
    if (req.session.tier === 'guest') return res.status(403).json({ error: 'Alleen voor leden.' });
    const s = findSupplier(req.body.supplierCode);
    if (!s) return res.status(404).json({ error: 'Zaak niet gevonden.' });
    const codename = req.session.account ? req.session.account.codename : PERSONAS[req.session.tier].codename;
    const a = db.data.aandacht = db.data.aandacht || {};
    const lijst = a[s.code] = a[s.code] || [];
    // niet spammen: een openstaand verzoek van dezelfde gast telt als één
    const bestaand = lijst.find(x => !x.klaar && x.key === req.session.key);
    const redenen = { rekening: 'Vraagt om de rekening', bestellen: 'Wil bestellen', hulp: 'Vraagt om hulp' };
    const reden = redenen[req.body.reden] || schoon(req.body.reden, 120) || 'Vraagt om aandacht';
    if (bestaand) { bestaand.reden = reden; bestaand.at = new Date().toISOString(); }
    else {
      lijst.unshift({ id: crypto.randomBytes(4).toString('hex'), key: req.session.key, codename,
        tafel: schoon(req.body.table, 24), reden, at: new Date().toISOString(), klaar: false });
      a[s.code] = lijst.slice(0, 300);
    }
    save();
    notifySupplier(s.code, { icon: '\u{1F514}', title: 'Gast vraagt aandacht' + (req.body.table ? ' · ' + schoon(req.body.table, 24) : ''), body: codename + ': ' + reden });
    sseToSupplier(s.code, 'sync', { scope: 'orders' });
    sseToOffice('sync', { scope: 'orders' });
    res.json({ ok: true });
  });

  app.post('/api/partner/chat/send', auth, (req, res) => {
    if (req.session.tier === 'guest') return res.status(403).json({ error: 'Alleen voor leden.' });
    const s = findSupplier(req.body.supplierCode);
    if (!s) return res.status(404).json({ error: 'Partner niet gevonden.' });
    if (!optieAan(s, 'gastchat')) return res.status(409).json({ error: s.name + ' heeft de gastchat op dit moment uitstaan.' });
    const text = String(req.body.text || '').trim().slice(0, 500);
    if (!text) return res.status(400).json({ error: 'Leeg bericht.' });
    const dept = validDept(s, String(req.body.dept || ''));
    const codename = req.session.account ? req.session.account.codename : PERSONAS[req.session.tier].codename;
    const chat = getChat(s, req.session.key, codename, req.session.tier, dept);
    chat.codename = codename;
    chat.messages.push({ from: 'guest', who: codename, text, lang: talen.taalVan(req.body.lang), at: new Date().toISOString() });
    chat.messages = chat.messages.slice(-120);
    chat.unreadPartner += 1;
    chat.lastAt = new Date().toISOString();
    save();
    notifySupplier(s.code, { icon: '💬', title: codename + ' → ' + dept, body: text.slice(0, 90) });
    sseToSupplier(s.code, 'sync', { scope: 'gchat' });
    sseToCustomer(req.session.key, 'sync', { scope: 'gchat' });
    trChat(chat.messages, talen.taalVan(req.body.lang)).then(messages => res.json({ ok: true, messages }));
  });

  app.post('/api/partner/chat/history', auth, (req, res) => {
    const s = findSupplier(req.body.supplierCode);
    if (!s) return res.status(404).json({ error: 'Partner niet gevonden.' });
    const dept = validDept(s, String(req.body.dept || ''));
    const chat = db.data.guestChats[chatKeyOf(s.code, req.session.key, dept)];
    if (chat && chat.unreadGuest) { chat.unreadGuest = 0; save(); }
    const to = talen.taalVan(req.body.lang);
    trChat(chat ? chat.messages : [], to).then(messages => res.json({ messages, dept }));
  });

  app.post('/api/event/rsvp', auth, (req, res) => {
    if (req.session.tier === 'guest') return res.status(403).json({ error: 'Alleen voor leden.' });
    const s = findSupplier(req.body.supplierCode);
    const e = s && (s.events || []).find(x => x.id === req.body.eventId && x.published);
    if (!e) return res.status(404).json({ error: 'Event niet gevonden.' });
    if (!optieAan(s, 'events')) return res.status(409).json({ error: s.name + ' neemt op dit moment geen event-aanmeldingen aan.' });
    const qty = Math.min(8, Math.max(1, parseInt(req.body.qty, 10) || 1));
    const taken = (e.guests || []).reduce((n, g) => n + g.qty, 0);
    if (e.guests.some(g => g.key === req.session.key)) return res.status(409).json({ error: 'U staat al op de gastenlijst.' });
    if (taken + qty > e.capacity) return res.status(409).json({ error: 'Dit event is vol.' });
    const codename = req.session.account ? req.session.account.codename : PERSONAS[req.session.tier].codename;
    e.guests.push({ key: req.session.key, codename, qty, at: new Date().toISOString(), checkedIn: false });
    save();
    notifySupplier(s.code, { icon: '🎟', title: 'Aanmelding voor ' + e.name, body: codename + ', ' + qty + ' pers.' });
    notify(req.session.tier, { icon: '🎟', title: s.name, body: 'U staat op de gastenlijst van ' + e.name + ' (' + e.date + (e.time ? ', ' + e.time : '') + '), ' + qty + ' pers. Uw codenaam is uw toegang.', scope: 'events' });
    sseToSupplier(s.code, 'sync', { scope: 'events' });
    sseToOffice('sync', { scope: 'events' });
    res.json({ ok: true, spotsLeft: Math.max(0, e.capacity - taken - qty) });
  });
};
