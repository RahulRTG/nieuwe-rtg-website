/* Backoffice (deelmodule): THE TABLE samenstellen.

   Zes of acht leden aan een tafel die iets aan elkaar hebben. Curatie is
   mensenwerk, dus dit is de enige plek waar een tafel ontstaat -- de leden zien
   alleen hun eigen uitnodiging, nooit wie er nog meer komt
   (kern/rendezvous-tafels.js).

   OP CODENAAM. Het kantoor tikt codenamen in en krijgt codenamen terug. Wie de
   echte naam nodig heeft, gaat langs de kluis met een reden, en dat komt in het
   inzagejournaal. Gemount vanuit routes/office.js. */
module.exports = (octx) => {
  const { kern } = octx;
  const {
    app, naamAuth, keyVanCodenaam,
    rvTafelMaak, rvTafelNodig, rvTafelKantoor, rvMeldingen,
    rvArrangeQueue, rvArrangeFulfil,
    rvConciergeOfficeList, rvConciergeOfficeStep,
    rvCircleOffice, rvCircleCreate, rvCircleInvite, rvCircleGathering
  } = kern;
  const { eis } = require('../connection-policy')({ product: 'rendezvous' });
  const stuur = (res, r) => r && r.error ? res.status(r.status || 400).json({ error: r.error }) : res.json(r);

  app.post('/api/office/rendezvous/tafels', naamAuth, (req, res) => {
    if (!eis(req, res, 'connection.table.manage', 'office')) return;
    stuur(res, rvTafelKantoor());
  });

  app.post('/api/office/rendezvous/tafel/maak', naamAuth, async (req, res) => {
    if (!eis(req, res, 'connection.table.manage', 'office')) return;
    const b = req.body || {};
    /* De codenamen worden een voor een opgezocht. Een naam die niemand aanwijst
       wordt GEMELD en niet stil overgeslagen: anders zet het kantoor een tafel
       van acht neer die er stiekem zes telt (LAT.md regel 5). */
    const genodigden = [], onbekend = [];
    for (const naam of (Array.isArray(b.genodigden) ? b.genodigden : []).slice(0, 12)) {
      const t = await keyVanCodenaam(String(naam || '').trim());
      if (t && t.key) genodigden.push(t.key); else onbekend.push(String(naam || '').trim());
    }
    if (onbekend.length) return res.status(400).json({ error: 'Onbekende codenaam: ' + onbekend.join(', ') });
    stuur(res, rvTafelMaak({ ...b, genodigden }));
  });

  app.post('/api/office/rendezvous/tafel/nodig', naamAuth, async (req, res) => {
    if (!eis(req, res, 'connection.table.manage', 'office')) return;
    const t = await keyVanCodenaam(String((req.body || {}).codenaam || '').trim());
    if (!t || !t.key) return res.status(404).json({ error: 'Geen lid met die codenaam.' });
    stuur(res, rvTafelNodig(String((req.body || {}).id || ''), t.key));
  });

  app.post('/api/office/rendezvous/meldingen', naamAuth, (req, res) => {
    if (!eis(req, res, 'connection.safety.report.read', 'office')) return;
    stuur(res, rvMeldingen());
  });

  app.post('/api/office/rendezvous/concierge', naamAuth, (req, res) => {
    if (!eis(req, res, 'connection.concierge.manage', 'office')) return;
    stuur(res, rvConciergeOfficeList());
  });

  app.post('/api/office/rendezvous/concierge/step', naamAuth, (req, res) => {
    if (!eis(req, res, 'connection.concierge.manage', 'office')) return;
    const b = req.body || {};
    stuur(res, rvConciergeOfficeStep(b.id, b.state, b, req.session && req.session.key));
  });

  app.post('/api/office/rendezvous/arrangements', naamAuth, (req, res) => {
    if (!eis(req, res, 'connection.concierge.manage', 'office')) return;
    stuur(res, rvArrangeQueue());
  });

  app.post('/api/office/rendezvous/arrangement/step', naamAuth, (req, res) => {
    if (!eis(req, res, 'connection.concierge.manage', 'office')) return;
    const b = req.body || {};
    stuur(res, rvArrangeFulfil(b.id, b.state, b.confirmation, b.supplierCode));
  });

  app.post('/api/office/rendezvous/circles', naamAuth, (req, res) => {
    if (!eis(req, res, 'connection.circle.manage', 'office')) return;
    stuur(res, rvCircleOffice());
  });

  app.post('/api/office/rendezvous/circle/create', naamAuth, (req, res) => {
    if (!eis(req, res, 'connection.circle.manage', 'office')) return;
    stuur(res, rvCircleCreate(req.body || {}));
  });

  app.post('/api/office/rendezvous/circle/invite', naamAuth, async (req, res) => {
    if (!eis(req, res, 'connection.circle.manage', 'office')) return;
    const b = req.body || {};
    const found = await keyVanCodenaam(String(b.codename || ''));
    stuur(res, found && found.key
      ? rvCircleInvite(b.circleId, found.key)
      : { status: 404, error: 'Dit lid bestaat niet.' });
  });

  app.post('/api/office/rendezvous/circle/gathering', naamAuth, (req, res) => {
    if (!eis(req, res, 'connection.circle.manage', 'office')) return;
    const b = req.body || {};
    stuur(res, rvCircleGathering(b.circleId, b));
  });
};
