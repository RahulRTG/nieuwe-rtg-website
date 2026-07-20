/* PDA (deelmodule): de vloer: service-uitmuntendheid (aandachtslijst en
   trage tafels) en training in de PDA: tips per functie, tip van de dag,
   eigen tips, voortgang en de AI-coach met bibliotheek-terugval. Krijgt de
   gedeelde context een keer bij het opstarten vanuit routes/supplier/pda.js. */
const training = require('../../../training');
module.exports = (kctx) => {
  const { accounts, anthropic, app, crypto, db, findSupplier, logActivity, loginFails, managerOnly, noteFailedTry, notifySupplier, rememberSession, save, schoon, sseToSupplier, supplierAuth, supplierState, tooManyTries, orderMetRef, ordersVanZaak } = kctx;
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
        system: require('../../../kern/rahul').RAHUL_LEAD + 'je bent een vriendelijke, ervaren horeca- en service-coach voor het personeel van een topzaak (5-sterren-hotel, Michelin-niveau). '
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
