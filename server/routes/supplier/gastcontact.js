/* Supplier-submodule "gastcontact": Gastcontact: de gastchat per afdeling, het Salon-profiel van de klant,
   ontvangsten, betaalverzoeken en live verbinden met een gast onderweg.
   Verbatim afgesplitst uit routes/supplier.js; alleen de routes, de helpers
   komen via het kern-object binnen. */
const wie = require('../../kern/comm/wie');
module.exports = (kern) => {
  const { app, db, talen, guestsFor, logActivity, notify, pushLive, save, sseToCustomer, sseToSupplier,
          supplierAuth, trChat, klantSalon, dpVerzoekMaak, dpVerzoekIntrek, dpOntvangsten,
          comm, commGast } = kern;



/* De drie routes hieronder lazen de gastchat rechtstreeks uit
   db.data.guestChats; sinds de verhuizing komt hij uit de communicatiekern
   (kern/comm/gast.js). De sleutel die het scherm meestuurt draagt nog dezelfde
   drie delen (CODE|lid|afdeling), zodat de zaak-app niets merkt -- maar de
   CONTROLE is nu een andere en een strengere: hoort dit gesprek bij MIJN zaak
   volgens de deelnemerslijst van de kern, in plaats van volgens een veld
   `supplierCode` in het record. Dezelfde poort als overal, geen tweede lezing. */
function lijnVan(req, res) {
  const deel = String(req.body.key || '').replace(/^gast:/, '').split('|');
  if (deel.length < 3 || deel[0].toUpperCase() !== req.supplier.code) {
    res.status(404).json({ error: 'Gesprek niet gevonden.' }); return null;
  }
  const lijn = { code: req.supplier.code, lidKey: deel[1], dept: deel.slice(2).join('|') };
  /* bestaand() en niet gesprek(): opzoeken mag de lijn niet aanleggen -- zie
     de opmerking daar. Zonder dat bestaat elke sleutel die je verzint. */
  lijn.gesprek = commGast.bestaand(lijn.code, lijn.lidKey, lijn.dept);
  if (!lijn.gesprek || !comm.magErin(comm.gesprekVan(lijn.gesprek.id), wie.zaak(lijn.code))) {
    res.status(404).json({ error: 'Gesprek niet gevonden.' }); return null;
  }
  return lijn;
}

app.post('/api/supplier/chat/send', supplierAuth, (req, res) => {
  const lijn = lijnVan(req, res);
  if (!lijn) return;
  const text = String(req.body.text || '').trim().slice(0, 500);
  if (!text) return res.status(400).json({ error: 'Leeg bericht.' });
  const meta = lijn.gesprek.meta || {};
  commGast.stuurZaak(lijn.code, lijn.lidKey, lijn.dept, text, req.actor.name,
    { lang: talen.taalVan(req.body.lang) });
  logActivity(req.supplier.code, req.actor, 'antwoordde ' + (meta.codename || 'een gast') + ' (' + lijn.dept + ')');
  notify(meta.tier || 'rtg', { icon: 'berichten', title: req.supplier.name + ' · ' + lijn.dept, body: text.slice(0, 90), scope: 'gchat' });
  sseToCustomer(lijn.lidKey, 'sync', { scope: 'gchat' });
  sseToSupplier(req.supplier.code, 'sync', { scope: 'gchat' });
  // 'zaak': het team ziet de hele naam van de collega die antwoordde
  const alles = commGast.berichten(lijn.code, lijn.lidKey, lijn.dept, 120, 'zaak');
  trChat(alles, talen.taalVan(req.body.lang)).then(messages => res.json({ ok: true, messages }));
});

app.post('/api/supplier/chat/history', supplierAuth, (req, res) => {
  const lijn = lijnVan(req, res);
  if (!lijn) return;
  const messages = commGast.berichten(lijn.code, lijn.lidKey, lijn.dept, 120, 'zaak');
  if (messages.length) commGast.leesZaak(lijn.code, lijn.lidKey, lijn.dept);
  trChat(messages, talen.taalVan(req.body.lang))
    .then(m => res.json({ messages: m, codename: (lijn.gesprek.meta || {}).codename || null }));
});

/* De Salon van de klant zoals de partner die vooraf mag zien: privacy-first,
   dus alleen de codenaam, de pas en de eigen Salon-posts (nooit de echte naam).
   Zo bent u geen vreemden van elkaar. Alleen op te vragen als er echt een open
   lijn met deze klant is (het gesprek moet bij deze zaak horen). */
app.post('/api/supplier/klant/salon', supplierAuth, (req, res) => {
  /* Dezelfde poort als de twee routes hierboven, en dat is hier extra van
     belang: dit toont de Salon van een LID aan een bedrijf. Zonder de eis dat
     er een open lijn is, zou een zaak met een verzonnen sleutel het profiel
     van elk lid kunnen opvragen. */
  const lijn = lijnVan(req, res);
  if (!lijn) return;
  res.json(klantSalon(lijn.lidKey));
});

/* Rechtstreekse ontvangsten: wat er direct van klanten binnenkwam, plus het
   sturen en intrekken van betaalverzoeken (op codenaam). */
app.post('/api/supplier/ontvangsten', supplierAuth, (req, res) => {
  res.json(dpOntvangsten(req.supplier.code));
});
app.post('/api/supplier/betaalverzoek', supplierAuth, async (req, res) => {
  const cent = req.body.centen != null ? Math.round(Number(req.body.centen)) : Math.round(Number(req.body.bedrag) * 100);
  // `idem` van de app: twee keer klikken hoort EEN verzoek te geven (TAKEN.md 4.55)
  const r = await dpVerzoekMaak({ supplierCode: req.supplier.code, actorName: req.actor.name,
    naarCodename: req.body.codename, bedragCenten: cent, omschrijving: req.body.omschrijving, idem: req.body.idem });
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
