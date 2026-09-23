'use strict';
/* De sollicitatiechat aan de kant van de werkgever: lezen en sturen. Afgesplitst
   uit ./sollicitaties.js, dat over de sollicitatie en het besluit gaat. */
const { eigenVeld } = require('../../../kern/util');
module.exports = (kern) => {
  const { app, applyChatVertaald, chatStuur, db, managerOnly, notify, supplierAuth, talen } = kern;

  app.post('/api/supplier/apply/chat', supplierAuth, (req, res) => {
    const chat = eigenVeld(db.data.applyChats, req.body.id);
    if (!chat || chat.supplierCode !== req.supplier.code) return res.status(404).json({ error: 'Chat niet gevonden.' });
    applyChatVertaald(chat, talen.taalVan(req.body.lang)).then(c => res.json({ chat: c }));
  });

  app.post('/api/supplier/apply/chat/send', supplierAuth, (req, res) => {
    if (!managerOnly(req, res)) return;
    const chat = eigenVeld(db.data.applyChats, req.body.id);
    if (!chat || chat.supplierCode !== req.supplier.code) return res.status(404).json({ error: 'Chat niet gevonden.' });
    const m = chatStuur(chat, 'werkgever', req.supplier.name, req.body.text, talen.taalVan(req.body.lang));
    if (!m) return res.status(400).json({ error: 'Typ een bericht.' });
    // seintje aan de sollicitant
    const app = (db.data.applications[req.supplier.code] || []).find(x => x.id === chat.id);
    if (app && app.key && db.data.notifications[app.key])
      notify(app.key, { icon: 'berichten', title: 'Bericht van ' + chat.bedrijf, body: m.tekst.slice(0, 80) });
    applyChatVertaald(chat, talen.taalVan(req.body.lang)).then(c => res.json({ chat: c }));
  });
};
