/* Supplier-submodule "gastcontact": Gastcontact: de gastchat per afdeling, het Salon-profiel van de klant,
   ontvangsten, betaalverzoeken en live verbinden met een gast onderweg.
   Verbatim afgesplitst uit routes/supplier.js; alleen de routes, de helpers
   komen via het kern-object binnen. */
const { eigenVeld } = require('../../kern/util'); // veilige objecttoegang (geen prototype-pollution)
module.exports = (kern) => {
  const { app, db, talen, guestsFor, logActivity, notify, pushLive, save, sseToCustomer, sseToSupplier,
          supplierAuth, trChat, klantSalon, dpVerzoekMaak, dpVerzoekIntrek, dpOntvangsten } = kern;



app.post('/api/supplier/chat/send', supplierAuth, (req, res) => {
  const chat = eigenVeld(db.data.guestChats, req.body.key);
  if (!chat || chat.supplierCode !== req.supplier.code) return res.status(404).json({ error: 'Gesprek niet gevonden.' });
  const text = String(req.body.text || '').trim().slice(0, 500);
  if (!text) return res.status(400).json({ error: 'Leeg bericht.' });
  chat.messages.push({ from: 'partner', who: req.actor.name, text, lang: talen.taalVan(req.body.lang), at: new Date().toISOString() });
  chat.messages = chat.messages.slice(-120);
  chat.unreadGuest += 1;
  chat.lastAt = new Date().toISOString();
  save();
  logActivity(req.supplier.code, req.actor, 'antwoordde ' + chat.codename + ' (' + (chat.dept || 'Team') + ')');
  notify(chat.tier, { icon: 'berichten', title: req.supplier.name + (chat.dept ? ' · ' + chat.dept : ''), body: text.slice(0, 90), scope: 'gchat' });
  sseToCustomer(chat.customerKey, 'sync', { scope: 'gchat' });
  sseToSupplier(req.supplier.code, 'sync', { scope: 'gchat' });
  trChat(chat.messages, talen.taalVan(req.body.lang)).then(messages => res.json({ ok: true, messages }));
});

app.post('/api/supplier/chat/history', supplierAuth, (req, res) => {
  const chat = eigenVeld(db.data.guestChats, req.body.key);
  if (!chat || chat.supplierCode !== req.supplier.code) return res.status(404).json({ error: 'Gesprek niet gevonden.' });
  if (chat.unreadPartner) { chat.unreadPartner = 0; save(); }
  trChat(chat.messages, talen.taalVan(req.body.lang)).then(messages => res.json({ messages, codename: chat.codename }));
});

/* De Salon van de klant zoals de partner die vooraf mag zien: privacy-first,
   dus alleen de codenaam, de pas en de eigen Salon-posts (nooit de echte naam).
   Zo bent u geen vreemden van elkaar. Alleen op te vragen als er echt een open
   lijn met deze klant is (het gesprek moet bij deze zaak horen). */
app.post('/api/supplier/klant/salon', supplierAuth, (req, res) => {
  const chat = eigenVeld(db.data.guestChats, req.body.key);
  if (!chat || chat.supplierCode !== req.supplier.code) return res.status(404).json({ error: 'Gesprek niet gevonden.' });
  res.json(klantSalon(chat.customerKey));
});

/* Rechtstreekse ontvangsten: wat er direct van klanten binnenkwam, plus het
   sturen en intrekken van betaalverzoeken (op codenaam). */
app.post('/api/supplier/ontvangsten', supplierAuth, (req, res) => {
  res.json(dpOntvangsten(req.supplier.code));
});
app.post('/api/supplier/betaalverzoek', supplierAuth, (req, res) => {
  const cent = req.body.centen != null ? Math.round(Number(req.body.centen)) : Math.round(Number(req.body.bedrag) * 100);
  const r = dpVerzoekMaak({ supplierCode: req.supplier.code, actorName: req.actor.name,
    naarCodename: req.body.codename, bedragCenten: cent, omschrijving: req.body.omschrijving });
  if (r.error) return res.status(r.status).json({ error: r.error });
  logActivity(req.supplier.code, req.actor, 'stuurde een betaalverzoek van € ' + (cent / 100).toFixed(2));
  res.json(r);
});
app.post('/api/supplier/betaalverzoek/intrek', supplierAuth, (req, res) => {
  const r = dpVerzoekIntrek(req.supplier.code, String(req.body.ref || ''));
  if (r.error) return res.status(r.status).json({ error: r.error });
  res.json(r);
});

app.post('/api/supplier/guest/connect', supplierAuth, (req, res) => {
  const codename = String(req.body.codename || '').trim();
  const key = Object.keys(db.data.live).find(k => db.data.live[k].active && db.data.live[k].codename === codename);
  if (!key) return res.status(404).json({ error: 'Deze gast is nu niet live onderweg.' });
  const L = db.data.live[key];
  L.connected = [...new Set([...(L.connected || []), req.supplier.code])];
  save();
  logActivity(req.supplier.code, req.actor, 'verbond met gast ' + codename);
  notify(L.tier, { icon: 'rechterhand', title: req.supplier.name, body: 'Volgt uw aankomst om alles voor u klaar te zetten.', scope: 'live' });
  pushLive(key);
  res.json({ ok: true, guests: guestsFor(req.supplier.code) });
});

};
