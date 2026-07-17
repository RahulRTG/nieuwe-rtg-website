/* Domein "supplier" (deelmodule): pda. Draait op de gedeelde kern. */
const training = require('../../training');
module.exports = (kern) => {
  const { accounts, anthropic, app, db, findSupplier, logActivity, managerOnly, notifySupplier, save, schoon, sseToSupplier, supplierAuth, orderMetRef, ordersVanZaak } = kern;

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

/* ============================================================================
   Service-uitmuntendheid: de zaak ziet welke gasten aandacht vragen en welke
   tafels/bestellingen te lang stil liggen, zodat niemand ooit vergeten wordt.
   ========================================================================== */
app.post('/api/supplier/aandacht', supplierAuth, (req, res) => {
  const lijst = ((db.data.aandacht || {})[req.supplier.code] || []).filter(x => !x.klaar);
  const nu = Date.now();
  const grens = Math.max(1, Number(req.body.minuten) || 10) * 60000;
  const traagTafels = ordersVanZaak(req.supplier.code).filter(o => o.paid &&
      (o.status === 'nieuw' || o.status === 'in bereiding') && (nu - new Date(o.paidAt || o.at)) > grens)
    .map(o => ({ ref: o.ref, tafel: o.table || null, codename: o.customerCodename,
      minuten: Math.round((nu - new Date(o.paidAt || o.at)) / 60000) }))
    .sort((a, b) => b.minuten - a.minuten);
  res.json({ aandacht: lijst, traagTafels });
});

app.post('/api/supplier/aandacht/klaar', supplierAuth, (req, res) => {
  const lijst = (db.data.aandacht || {})[req.supplier.code] || [];
  const it = lijst.find(x => x.id === String(req.body.id || ''));
  if (it) { it.klaar = true; it.klaarDoor = req.actor.name; it.klaarAt = new Date().toISOString(); save();
    logActivity(req.supplier.code, req.actor, 'hielp een gast die om aandacht vroeg' + (it.tafel ? ' (' + it.tafel + ')' : '')); }
  res.json({ ok: true });
});

/* ============================================================================
   Training & tips in de PDA: micro-learning voor het personeel. Rol-bewuste
   tips uit de bibliotheek, een tip van de dag, eigen tips van de zaak, en een
   AI-coach (met terugval op de bibliotheek). Zo blijft elk teamlid groeien.
   ========================================================================== */
function actorFunc(req) {
  const st = req.actor && req.actor.staffId ? accounts.getStaffById(req.actor.staffId) : null;
  return (st && st.func) || (req.actor && req.actor.manager ? 'Beheer' : '');
}
function eigenTips(code) {
  return ((db.data.training || {})[code] || []).filter(t => t && t.t);
}
// Voortgang: welke tips heeft dit teamlid al gelezen? Per zaak, per persoon.
function gelezenLijst(code, staffId) {
  if (!staffId) return [];
  return (((db.data.trainGelezen || {})[code] || {})[String(staffId)]) || [];
}
app.post('/api/supplier/training', supplierAuth, (req, res) => {
  const func = actorFunc(req);
  const role = req.actor.role;
  const eigen = eigenTips(req.supplier.code);
  // De eigen tips van de zaak staan vooraan; daarna de rol-tips uit de bibliotheek.
  const bib = training.tipsVoor(func, role);
  const gezien = new Set(eigen.map(t => t.t));
  const tips = eigen.concat(bib.filter(t => !gezien.has(t.t)));
  const vandaag = eigen.length
    ? eigen[Math.floor(Date.now() / 86400000) % eigen.length]
    : training.tipVanDeDag(func, role);
  const gelezen = gelezenLijst(req.supplier.code, req.actor.staffId).filter(t => tips.some(x => x.t === t));
  res.json({ func: func || null, kanBeheren: !!req.actor.manager, tipVanDeDag: vandaag, tips, eigen, gelezen });
});

// Een tip als gelezen markeren (of terugdraaien): zo ziet iedereen de voortgang.
app.post('/api/supplier/training/gelezen', supplierAuth, (req, res) => {
  const titel = String(req.body.titel || '');
  if (!titel) return res.status(400).json({ error: 'Welke tip?' });
  if (!req.actor.staffId) return res.status(200).json({ gelezen: [] }); // bedrijfslogin heeft geen persoon
  db.data.trainGelezen = db.data.trainGelezen || {};
  const perZaak = db.data.trainGelezen[req.supplier.code] = db.data.trainGelezen[req.supplier.code] || {};
  const key = String(req.actor.staffId);
  const set = new Set(perZaak[key] || []);
  if (req.body.uit) set.delete(titel); else set.add(titel);
  perZaak[key] = [...set]; save();
  res.json({ gelezen: perZaak[key] });
});

app.post('/api/supplier/training/add', supplierAuth, (req, res) => {
  if (!managerOnly(req, res)) return; // eigen tips beheren is voor het management
  const t = schoon(req.body.titel, 80);
  const s = schoon(req.body.tekst, 400);
  if (!t || !s) return res.status(400).json({ error: 'Geef een titel en een tekst.' });
  db.data.training = db.data.training || {};
  const arr = db.data.training[req.supplier.code] = db.data.training[req.supplier.code] || [];
  if (arr.some(x => x.t === t)) return res.status(409).json({ error: 'Er is al een tip met deze titel.' });
  arr.push({ t, s, door: req.actor.name, at: new Date().toISOString() });
  save();
  logActivity(req.supplier.code, req.actor, 'voegde een trainingstip toe: ' + t);
  res.json({ ok: true, eigen: eigenTips(req.supplier.code) });
});

app.post('/api/supplier/training/remove', supplierAuth, (req, res) => {
  if (!managerOnly(req, res)) return;
  const t = String(req.body.titel || '');
  const arr = (db.data.training || {})[req.supplier.code] || [];
  const i = arr.findIndex(x => x.t === t);
  if (i < 0) return res.status(404).json({ error: 'Tip niet gevonden.' });
  arr.splice(i, 1); save();
  res.json({ ok: true, eigen: eigenTips(req.supplier.code) });
});

app.post('/api/supplier/coach', supplierAuth, async (req, res) => {
  const vraag = schoon(req.body.vraag, 300);
  if (!vraag) return res.status(400).json({ error: 'Stel een vraag.' });
  const func = actorFunc(req);
  const eigen = eigenTips(req.supplier.code);
  const bib = training.tipsVoor(func, req.actor.role);
  // Context van een concrete tafel/bestelling: allergie en wensen tellen mee.
  let orderCtx = '', tafel = null;
  if (req.body.ref) {
    const o = (x => x && x.supplierCode === req.supplier.code ? x : undefined)(orderMetRef(String(req.body.ref)));
    if (o) {
      tafel = o.table || null;
      const items = (o.items || []).map(i => (i.qty > 1 ? i.qty + 'x ' : '') + i.name).join(', ');
      orderCtx = [tafel ? 'Tafel: ' + tafel : null, o.customerCodename ? 'Gast: ' + o.customerCodename : null,
        items ? 'Bestelling: ' + items : null, o.allergyNote ? 'ALLERGIE: ' + o.allergyNote : null,
        o.note ? 'Opmerking: ' + o.note : null].filter(Boolean).join('. ');
    }
  }
  // Voor de terugval de allergie mee in de trefwoorden, zodat de juiste tip bovenkomt.
  const terugval = training.coachTip(vraag + ' ' + orderCtx, func, req.actor.role);
  if (anthropic) {
    try {
      const context = eigen.concat(bib).slice(0, 20).map(t => '- ' + t.t + ': ' + t.s).join('\n');
      const msg = await anthropic.messages.create({
        model: 'claude-haiku-4-5-20251001', max_tokens: 300,
        system: 'Je bent een vriendelijke, ervaren horeca- en service-coach voor het personeel van een topzaak (5-sterren-hotel, Michelin-niveau). '
          + 'Antwoord in het Nederlands, kort en praktisch (maximaal 4 zinnen), concreet en bemoedigend. '
          + 'Bij een allergie ben je stellig over veilige bereiding en dubbelcheck. '
          + 'De functie van het teamlid is: ' + (func || 'onbekend') + '. '
          + (orderCtx ? 'Situatie aan tafel: ' + orderCtx + '. ' : '')
          + 'Gebruik waar passend deze huistips van de zaak:\n' + (context || '(geen)'),
        messages: [{ role: 'user', content: vraag }]
      });
      const antwoord = (msg.content || []).filter(b => b.type === 'text').map(b => b.text).join(' ').trim();
      if (antwoord) return res.json({ antwoord, bron: 'ai', tip: terugval, tafel });
    } catch (e) { /* val terug op de bibliotheek */ }
  }
  res.json({ antwoord: terugval ? terugval.s : 'Blijf vriendelijk, aandachtig en een stap voor op de wens van de gast.',
    bron: 'bibliotheek', tip: terugval, tafel });
});
};
