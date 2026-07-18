/* PDA (deelmodule): het personeelsnetwerk: verbindingen tussen zaken na
   wederzijdse toestemming, en de gedeelde gespreksruimte per verbinding.
   Krijgt de gedeelde context een keer bij het opstarten vanuit
   routes/supplier/pda.js. */
module.exports = (kctx) => {
  const { accounts, anthropic, app, crypto, db, findSupplier, logActivity, loginFails, managerOnly, noteFailedTry, notifySupplier, rememberSession, save, schoon, sseToSupplier, supplierAuth, supplierState, tooManyTries, orderMetRef, ordersVanZaak } = kctx;

/* ============================================================================
   Personeelsnetwerk: PDA's van VERSCHILLENDE bedrijven kunnen met elkaar praten,
   maar alleen na WEDERZIJDSE toestemming van de zaken (een manager vraagt aan, de
   manager van de andere zaak keurt goed). Daarna kan al het personeel van beide
   zaken in een aparte ruimte berichten sturen. Zo kunnen bijvoorbeeld een hotel
   en een taxibedrijf onderling afstemmen zonder dat het door de gastenkanalen loopt.
   ========================================================================== */
function netState() {
  const n = db.data.supplierNet = db.data.supplierNet || { links: [], gesprek: {} };
  if (!Array.isArray(n.links)) n.links = [];
  if (!n.gesprek) n.gesprek = {};
  return n;
}
function netPaar(a, b) { return [String(a).toUpperCase(), String(b).toUpperCase()].sort().join('|'); }
function netLink(a, b) { return netState().links.find(l => netPaar(l.a, l.b) === netPaar(a, b)); }

app.post('/api/supplier/net/verzoek', supplierAuth, (req, res) => {
  if (!managerOnly(req, res)) return; // alleen een manager verbindt de zaak
  const doel = findSupplier(req.body.code);
  if (!doel) return res.status(404).json({ error: 'Dit bedrijf kennen we niet.' });
  if (doel.code === req.supplier.code) return res.status(400).json({ error: 'Dat is uw eigen bedrijf.' });
  const n = netState();
  let l = netLink(req.supplier.code, doel.code);
  if (l && l.status === 'akkoord') return res.status(409).json({ error: 'U bent al verbonden.' });
  if (l && l.status === 'wacht') {
    // de andere zaak had ons al gevraagd: dit verzoek is dan meteen de goedkeuring
    if (l.doorCode !== req.supplier.code) {
      l.status = 'akkoord'; l.beslistAt = new Date().toISOString(); save();
      notifySupplier(doel.code, { icon: '\u{1F91D}', title: 'Verbonden in het personeelsnetwerk', body: req.supplier.name + ' is nu verbonden.' });
      sseToSupplier(doel.code, 'sync', { scope: 'team' });
      return res.json({ ok: true, status: 'akkoord' });
    }
    return res.json({ ok: true, status: 'wacht' });
  }
  l = { a: req.supplier.code, b: doel.code, status: 'wacht', doorCode: req.supplier.code, at: new Date().toISOString() };
  n.links.push(l); save();
  notifySupplier(doel.code, { icon: '\u{1F91D}', title: 'Netwerkverzoek', body: req.supplier.name + ' wil verbinden in het personeelsnetwerk.' });
  sseToSupplier(doel.code, 'sync', { scope: 'team' });
  logActivity(req.supplier.code, req.actor, 'vroeg ' + doel.name + ' om verbinding in het personeelsnetwerk');
  res.json({ ok: true, status: 'wacht' });
});

app.post('/api/supplier/net/beslis', supplierAuth, (req, res) => {
  if (!managerOnly(req, res)) return;
  const l = netLink(req.supplier.code, req.body.code);
  if (!l || l.status !== 'wacht') return res.status(404).json({ error: 'Geen openstaand verzoek.' });
  if (l.doorCode === req.supplier.code) return res.status(403).json({ error: 'Uw eigen verzoek wacht op de andere zaak.' });
  if (req.body.actie === 'weiger') { const n = netState(); n.links = n.links.filter(x => x !== l); }
  else { l.status = 'akkoord'; l.beslistAt = new Date().toISOString(); }
  save();
  res.json({ ok: true, status: req.body.actie === 'weiger' ? 'geweigerd' : 'akkoord' });
});

app.post('/api/supplier/net/lijst', supplierAuth, (req, res) => {
  const me = req.supplier.code;
  const mijn = netState().links.filter(l => l.a === me || l.b === me);
  res.json({ verbindingen: mijn.map(l => {
    const ander = l.a === me ? l.b : l.a; const s = findSupplier(ander);
    return { code: ander, naam: s ? s.name : ander, status: l.status,
      inkomend: l.status === 'wacht' && l.doorCode !== me, uitgaand: l.status === 'wacht' && l.doorCode === me };
  }) });
});
app.post('/api/supplier/net/gesprek', supplierAuth, (req, res) => {
  const l = netLink(req.supplier.code, req.body.code);
  if (!l || l.status !== 'akkoord') return res.status(403).json({ error: 'U bent niet verbonden met dit bedrijf.' });
  const k = netPaar(req.supplier.code, req.body.code);
  res.json({ berichten: (netState().gesprek[k] || []).slice(-100) });
});

app.post('/api/supplier/net/bericht', supplierAuth, (req, res) => {
  const l = netLink(req.supplier.code, req.body.code);
  if (!l || l.status !== 'akkoord') return res.status(403).json({ error: 'U bent niet verbonden met dit bedrijf.' });
  const tekst = schoon(req.body.tekst, 500);
  if (!tekst) return res.status(400).json({ error: 'Leeg bericht.' });
  const n = netState(); const k = netPaar(req.supplier.code, req.body.code);
  const arr = n.gesprek[k] = n.gesprek[k] || [];
  arr.push({ code: req.supplier.code, naam: req.supplier.name, door: req.actor.name, tekst, at: new Date().toISOString() });
  n.gesprek[k] = arr.slice(-200); save();
  const ander = l.a === req.supplier.code ? l.b : l.a;
  notifySupplier(ander, { icon: '\u{1F4AC}', title: 'Netwerk: ' + req.supplier.name, body: req.actor.name.split(' ')[0] + ': ' + tekst.slice(0, 80) });
  sseToSupplier(ander, 'sync', { scope: 'team' });
  res.json({ ok: true });
});
  return { netState, netPaar, netLink };
};
