/* Domein "supplier" (aparte module op de gedeelde kern). Alleen de routes;
   de helpers blijven in de kern (server.js) en komen via het kern-object binnen. */
const { eigenVeld } = require('../kern/util'); // veilige objecttoegang (geen prototype-pollution)
module.exports = (kern) => {
  const { app, db, save, scheduleFor, sessionFor, sseClients, sseSend, sseToSupplier, supplierAuth,
          supplierState } = kern;



/* De toegang- en backofficelaag draaien als submodules op de gedeelde kern. */
require('./supplier/toegang')(kern);
require('./supplier/moedertaal')(kern);
/* De zakelijke kant van het communicatieplatform: dezelfde kern als de
   ledenapp, met de sleutel die uit de sessie volgt. Zie ./supplier/comm.js. */
require('./supplier/comm')(kern);
require('./supplier/backoffice')(kern);
require('./supplier/hrplus')(kern);
require('./supplier/prplus')(kern);
require('./supplier/gebouwplus')(kern);
require('./supplier/gebouwpand')(kern);
require('./supplier/wensen')(kern);
require('./supplier/genrepuls')(kern);
require('./supplier/genreplan')(kern);
require('./supplier/genreblik')(kern);

app.post('/api/supplier/schedule', supplierAuth, (req, res) => res.json(scheduleFor(req.supplier.code)));

app.post('/api/supplier/team/message', supplierAuth, (req, res) => {
  const text = String(req.body.text || '').trim().slice(0, 500);
  if (!text) return res.status(400).json({ error: 'Leeg bericht.' });
  const list = db.data.supplierTeam[req.supplier.code] = (db.data.supplierTeam[req.supplier.code] || []);
  list.push({ who: req.actor.name, role: req.actor.role, text, at: new Date().toISOString() });
  db.data.supplierTeam[req.supplier.code] = list.slice(-100);
  save();
  sseToSupplier(req.supplier.code, 'sync', { scope: 'team' });
  res.json({ ok: true });
});

app.get('/api/supplier/stream', (req, res) => {
  const sess = sessionFor(req.query.token);
  if (!sess || sess.role !== 'supplier') return res.status(401).end();
  res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform', 'Connection': 'keep-alive' });
  res.write('retry: 3000\n\n');
  const client = { sup: sess.code, staffId: sess.staffId != null ? sess.staffId : null, res };
  sseClients.push(client);
  sseSend(res, 'hello', { unread: (db.data.supplierNotifications[sess.code] || []).filter(n => !n.read) });
  const ping = setInterval(() => res.write(': ping\n\n'), 25000);
  req.on('close', () => { clearInterval(ping); const i = sseClients.indexOf(client); if (i >= 0) sseClients.splice(i, 1); });
});

app.post('/api/supplier/state', supplierAuth, (req, res) => res.json({ state: supplierState(req.supplier, req.actor) }));

app.post('/api/supplier/notifications/read', supplierAuth, (req, res) => {
  (db.data.supplierNotifications[req.supplier.code] || []).forEach(n => n.read = true);
  save();
  res.json({ ok: true });
});


  require('./supplier/kamers')(kern);
  require('./supplier/gastcontact')(kern);
  require('./supplier/tafels-team')(kern);
  require('./supplier/boekingen')(kern);
  require('./supplier/vakpro')(kern);
  require('./supplier/ai')(kern);
  require('./supplier/menukaart')(kern);
  require('./supplier/orders')(kern);
  require('./supplier/reserveringen')(kern);
  require('./supplier/poort')(kern);
  require('./supplier/agent')(kern);
  require('./supplier/tools')(kern);
  require('./supplier/keuken')(kern);
  require('./supplier/verblijf')(kern);
  require('./supplier/thuis')(kern);
  require('./supplier/gast')(kern);
  require('./supplier/pda')(kern);
  require('./supplier/bezorg')(kern);
  require('./supplier/bezorg-keten')(kern);
  require('./supplier/tickets')(kern);
  require('./supplier/verhuur')(kern);
  require('./supplier/charter')(kern);
  require('./supplier/contract')(kern);
  require('./supplier/vastgoed')(kern);
  require('./supplier/boerderij')(kern);
  require('./supplier/creator')(kern);
  require('./supplier/samenwerking')(kern);
  require('./supplier/handel')(kern);
  require('./supplier/groothandel')(kern);
  require('./supplier/modebezorg')(kern);
  require('./supplier/autoverkoop')(kern);
  require('./supplier/beveiliging')(kern);
  require('./supplier/care')(kern);
  require('./supplier/hulpdienst')(kern);
  require('./supplier/zorgketen')(kern);
  require('./supplier/ketenchat')(kern);
  require('./supplier/defensie')(kern);
  require('./supplier/retail')(kern);
  require('./supplier/paspoort')(kern);
  require('./supplier/salon')(kern);
  require('./supplier/events')(kern);
  require('./supplier/financien')(kern);
  require('./supplier/vervoer')(kern);
  require('./supplier/kassa')(kern);
  require('./supplier/horeca')(kern); // RTG Horeca OS: rekeningen, keuken, bezorging, club, hotel-folio
  require('./supplier/werving')(kern);
};
