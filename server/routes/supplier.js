/* Domein "supplier" (aparte module op de gedeelde kern). Alleen de routes;
   de helpers blijven in de kern (server.js) en komen via het kern-object binnen. */
const { eigenVeld } = require('../kern/util'); // veilige objecttoegang (geen prototype-pollution)
module.exports = (kern) => {
  const { accounts, app, db, findSupplier, save, scheduleFor, sessionFor, sseClients, sseSend, sseToSupplier, supplierAuth,
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
require('./supplier/eten')(kern); // een operationeel orderbeeld boven horeca + oudere orders

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
  const supplier = findSupplier(sess.code);
  if (!supplier || supplier.partnerStatus === 'geschorst' || supplier.partnerStatus === 'beeindigd')
    return res.status(401).end();
  if (sess.staffId != null) {
    const staff = accounts.getStaffById(Number(sess.staffId));
    if (!staff || String(staff.supplier_code).toUpperCase() !== String(sess.code).toUpperCase()) return res.status(401).end();
  }
  res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform', 'Connection': 'keep-alive' });
  res.write('retry: 3000\n\n');
  const client = { sup: sess.code, staffId: sess.staffId != null ? sess.staffId : null, res };
  sseClients.push(client);
  sseSend(res, 'hello', { unread: (db.data.supplierNotifications[sess.code] || []).filter(n => !n.read) });
  const ping = setInterval(() => res.write(': ping\n\n'), 25000);
  req.on('close', () => { clearInterval(ping); const i = sseClients.indexOf(client); if (i >= 0) sseClients.splice(i, 1); });
});

app.post('/api/supplier/state', supplierAuth, (req, res) => res.json({ state: supplierState(req.supplier, req.actor) }));

/* "Zo staat u in de Mall": de andere kant van de Supplier OS-koppeling. De
   zaak ziet welk aanbod van haar in de Mall staat, welke stand de Mall daarbij
   uit haar eigen agenda en voorraad leest, en wat er nog ontbreekt (geen uren
   = niet in "Nu open"). Alleen de eigen zaak; er is geen code-parameter, zodat
   niemand hiermee bij een ander kan kijken. */
app.post('/api/supplier/mall', supplierAuth, (req, res) => {
  const r = kern.mall.mallVoorZaak(req.supplier.code);
  if (r.error) return res.status(r.status || 400).json({ error: r.error });
  res.json(r);
});

/* De koppeling voor een EXTERN kassa- of boekingssysteem: voorraad en
   open/dicht melden. Alleen die twee, en alleen voor de eigen zaak. Een
   melding telt een half uur als actueel en vervalt daarna vanzelf, zodat een
   uitgevallen koppeling geen winkel ten onrechte open en gevuld houdt. Zie de
   kop van kern/mall/extern.js. */
app.post('/api/supplier/mall/sync', supplierAuth, (req, res) => {
  res.json(kern.mall.mallStand.extern.meld(req.supplier, req.body || {}));
});

/* De vraagkant: aanvragen van leden die bij deze zaak passen (vak en
   werkgebied), en reageren. Wie zich bedenkt wijzigt zijn eigen reactie in
   plaats van er een tweede naast te zetten; zie kern/mall/aanvragen.js. */
app.post('/api/supplier/mall/aanvragen', supplierAuth, (req, res) => {
  res.json(kern.mall.mallAanvragen.voorZaak(req.supplier));
});
app.post('/api/supplier/mall/aanvraag/reageer', supplierAuth, (req, res) => {
  const r = kern.mall.mallAanvragen.reageer(req.supplier, req.body.id, req.body || {});
  if (r.error) return res.status(r.status || 400).json({ error: r.error });
  res.json(r);
});

/* Samengesteld aanbod van de zaak zelf: een bundel, een evenement of een
   seizoensaanbod uit haar EIGEN aanbod. Andermans aanbod erin bundelen wordt
   geweigerd -- dat is een belofte die zij niet kan waarmaken. */
app.post('/api/supplier/mall/collecties', supplierAuth, (req, res) => {
  res.json(kern.mall.mallCollecties.vanZaak(req.supplier.code));
});
app.post('/api/supplier/mall/collectie/zet', supplierAuth, (req, res) => {
  const r = kern.mall.mallCollecties.zet(req.supplier.code, req.supplier.name, req.body || {});
  if (r.error) return res.status(r.status || 400).json({ error: r.error });
  res.json(r);
});
app.post('/api/supplier/mall/collectie/weg', supplierAuth, (req, res) => {
  const r = kern.mall.mallCollecties.verwijder(req.supplier.code, (req.body || {}).id);
  if (r.error) return res.status(r.status || 400).json({ error: r.error });
  res.json(r);
});

/* De tijdzone van de zaak. Zonder deze is "Nu open" de tijd van de server, en
   dat is voor een zaak op Ibiza een uur mis. Leeg maken kan door 'auto' te
   sturen: dan geldt weer de hoofdzone van het land. */
app.post('/api/supplier/tijdzone', supplierAuth, (req, res) => {
  const wens = String((req.body || {}).tijdzone || '').trim();
  const { geldigeZone } = require('../kern/tijdzone');
  if (wens && wens !== 'auto' && !geldigeZone(wens))
    return res.status(400).json({ error: 'Onbekende tijdzone. Gebruik een IANA-naam, bijvoorbeeld Europe/Madrid.' });
  if (!wens || wens === 'auto') delete req.supplier.tijdzone; else req.supplier.tijdzone = wens;
  save();
  res.json({ ok: true, tijdzone: kern.mall.mallStand.zoneVoor(req.supplier) });
});

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
  require('./supplier/btw')(kern);
  require('./supplier/vervoer')(kern);
  require('./supplier/kassa')(kern);
  require('./supplier/horeca')(kern); // RTG Horeca OS: rekeningen, keuken, bezorging, club, hotel-folio
  /* De retourstroom, verkoperkant (kern/commerce/retour.js, COMMERCE.md par. 6).
     De ledenkant staat in routes/commerce.js; de standen die de VERKOPER zet,
     komen alleen langs deze deur. */
  require('./supplier/retour')(kern);
  require('./supplier/werving')(kern);
  /* "Vooruit": dezelfde Control Tower als de ledenkant, op de code van de zaak.
     Zie de kop van ./supplier/vooruit.js. */
  require('./supplier/vooruit')(kern);
};
