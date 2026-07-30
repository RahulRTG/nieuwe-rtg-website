/* Kassa (deelmodule): de premium-laag van De Kassa -- de functies waar
   andere kassasystemen een abonnement voor vragen, hier gewoon inbegrepen:
   - derving met een reden (verspil, breuk, eigen gebruik, repro): registreert
     wat de zaak verliet zonder verkoop en boekt de keukenvoorraad af;
   - retour: een teruggave als minbon in dezelfde kassastroom;
   - bonnen parkeren en terughalen (wachtbonnen);
   - het dagrapport (X): omzet per betaalwijze en per kassa, bonnen,
     retouren, kortingen en de derving van vandaag;
   - de kasopmaak: de lade tellen tegen het verwachte contant. */
module.exports = (kern) => {
  const { app, crypto, db, logActivity, pickupCode, save, schoon, sseToSupplier, supplierAuth } = kern;

  const DERVING = { verspil: 'verspilling', breuk: 'breuk', eigen: 'eigen gebruik', repro: 'repro/herdruk' };
  const vandaag = () => new Date().toISOString().slice(0, 10);
  const lijst = (bak, code) => (db.data[bak] = db.data[bak] || {}, db.data[bak][code] = db.data[bak][code] || []);
  const leesItems = (body) => (Array.isArray(body.items) ? body.items : []).slice(0, 40)
    .map(i => ({ name: String(i.name || '').slice(0, 80), qty: Math.max(1, parseInt(i.qty, 10) || 1), price: Math.max(0, Number(i.price) || 0) }))
    .filter(i => i.name);

  /* Derving: wat weg is zonder verkoop, met een reden en op naam. De
     keukenvoorraad wordt afgeboekt, want die croissant is echt weg. */
  app.post('/api/supplier/kassa/derving', supplierAuth, (req, res) => {
    const soort = String(req.body.soort || '');
    if (!DERVING[soort]) return res.status(400).json({ error: 'Kies verspil, breuk, eigen of repro.' });
    const items = leesItems(req.body);
    if (!items.length) return res.status(400).json({ error: 'Zet eerst op de bon wat er weg is.' });
    const reg = { id: crypto.randomBytes(4).toString('hex'), soort, label: DERVING[soort],
      items, waarde: Math.round(items.reduce((s, i) => s + i.price * i.qty, 0) * 100) / 100,
      kassa: req.body.kassa ? String(req.body.kassa).slice(0, 40) : null,
      notitie: schoon(req.body.notitie, 120), actor: req.actor.name, at: new Date().toISOString() };
    const l = lijst('kassaDerving', req.supplier.code);
    l.unshift(reg); if (l.length > 300) l.length = 300;
    save();
    // repro (een herdruk) verbruikt niets; echte derving boekt de voorraad af
    if (soort !== 'repro') { try { kern.keuken.boekVerkoopAf(req.supplier, items, DERVING[soort] + ' (' + req.actor.name + ')'); } catch (e) {} }
    logActivity(req.supplier.code, req.actor, 'boekte ' + DERVING[soort] + ': ' + items.map(i => i.qty + 'x ' + i.name).join(', '));
    sseToSupplier(req.supplier.code, 'sync', { scope: 'pos' });
    res.json({ ok: true, derving: reg });
  });

  /* Retour: de teruggave als minbon in dezelfde kassastroom, zodat het
     dagoverzicht en de kasopmaak vanzelf kloppen. */
  app.post('/api/supplier/kassa/retour', supplierAuth, (req, res) => {
    const items = leesItems(req.body);
    if (!items.length) return res.status(400).json({ error: 'Zet eerst op de bon wat er terugkomt.' });
    const bedrag = Math.round(items.reduce((s, i) => s + i.price * i.qty, 0) * 100) / 100;
    if (!(bedrag > 0)) return res.status(400).json({ error: 'Een retour heeft een bedrag nodig.' });
    const sale = { id: crypto.randomBytes(4).toString('hex'), bon: pickupCode(), actor: req.actor.name,
      kassa: req.body.kassa ? String(req.body.kassa).slice(0, 40) : null,
      desc: 'Retour' + (req.body.reden ? ': ' + schoon(req.body.reden, 120) : ''),
      room: null, items, total: -bedrag, method: 'contant', retour: true, at: new Date().toISOString() };
    const l = (db.data.posSales[req.supplier.code] = db.data.posSales[req.supplier.code] || []);
    l.unshift(sale); db.data.posSales[req.supplier.code] = l.slice(0, 300);
    save();
    logActivity(req.supplier.code, req.actor, 'boekte een retour van € ' + bedrag + (req.body.reden ? ' (' + schoon(req.body.reden, 60) + ')' : ''));
    sseToSupplier(req.supplier.code, 'sync', { scope: 'pos' });
    res.json({ ok: true, sale });
  });

  /* Wachtbonnen: een bon parkeren (tafel nog niet klaar, klant pakt er nog
     iets bij) en op elk scherm weer terughalen. */
  app.post('/api/supplier/kassa/parkeer', supplierAuth, (req, res) => {
    const items = leesItems(req.body);
    if (!items.length) return res.status(400).json({ error: 'Een lege bon parkeren heeft geen zin.' });
    const l = lijst('kassaWachtbonnen', req.supplier.code);
    if (l.length >= 30) return res.status(400).json({ error: 'Er staan al 30 wachtbonnen; haal er eerst een terug.' });
    const bon = { id: crypto.randomBytes(3).toString('hex'), naam: schoon(req.body.naam, 40) || 'Wachtbon',
      items, actor: req.actor.name, kassa: req.body.kassa ? String(req.body.kassa).slice(0, 40) : null, at: new Date().toISOString() };
    l.unshift(bon); save();
    sseToSupplier(req.supplier.code, 'sync', { scope: 'pos' });
    res.json({ ok: true, bon, wachtbonnen: l });
  });
  app.post('/api/supplier/kassa/wachtbon', supplierAuth, (req, res) => {
    const l = lijst('kassaWachtbonnen', req.supplier.code);
    if (!req.body.id) return res.json({ wachtbonnen: l });
    const i = l.findIndex(b => b.id === req.body.id);
    if (i < 0) return res.status(404).json({ error: 'Wachtbon niet gevonden (al teruggehaald?).' });
    const [bon] = l.splice(i, 1);
    save();
    sseToSupplier(req.supplier.code, 'sync', { scope: 'pos' });
    res.json({ ok: true, bon });
  });

  /* Het dagrapport (X): vandaag in een oogopslag, ook per kassa. */
  app.post('/api/supplier/kassa/dagrapport', supplierAuth, (req, res) => {
    const dag = vandaag();
    const sales = (db.data.posSales[req.supplier.code] || []).filter(x => String(x.at).slice(0, 10) === dag);
    const perMethode = {}, perKassa = {};
    let omzet = 0, retouren = 0, retourBedrag = 0, kortingen = 0;
    for (const s of sales) {
      omzet += s.total;
      if (s.retour) { retouren++; retourBedrag += -s.total; }
      perMethode[s.method] = Math.round(((perMethode[s.method] || 0) + s.total) * 100) / 100;
      const k = s.kassa || 'zonder naam';
      perKassa[k] = Math.round(((perKassa[k] || 0) + s.total) * 100) / 100;
      if (s.korting && s.korting.bedrag) kortingen += s.korting.bedrag;
    }
    const derving = (db.data.kassaDerving && db.data.kassaDerving[req.supplier.code] || [])
      .filter(d => String(d.at).slice(0, 10) === dag && d.soort !== 'repro');
    res.json({ dag, bonnen: sales.length, omzet: Math.round(omzet * 100) / 100,
      perMethode, perKassa, retouren, retourBedrag: Math.round(retourBedrag * 100) / 100,
      kortingen: Math.round(kortingen * 100) / 100,
      derving: { regels: derving.length, waarde: Math.round(derving.reduce((s, d) => s + (d.waarde || 0), 0) * 100) / 100,
        perSoort: derving.reduce((m, d) => (m[d.label] = (m[d.label] || 0) + 1, m), {}) } });
  });

  /* De kasopmaak: de lade tellen tegen het verwachte contant van vandaag. */
  app.post('/api/supplier/kassa/kasopmaak', supplierAuth, (req, res) => {
    const geteld = Number(req.body.geteld);
    if (!Number.isFinite(geteld) || geteld < 0) return res.status(400).json({ error: 'Vul het getelde bedrag in.' });
    const dag = vandaag();
    const verwacht = Math.round((db.data.posSales[req.supplier.code] || [])
      .filter(x => String(x.at).slice(0, 10) === dag && x.method === 'contant')
      .reduce((s, x) => s + x.total, 0) * 100) / 100;
    const verschil = Math.round((geteld - verwacht) * 100) / 100;
    const reg = { dag, geteld, verwacht, verschil, kassa: req.body.kassa ? String(req.body.kassa).slice(0, 40) : null,
      actor: req.actor.name, at: new Date().toISOString() };
    const l = lijst('kassaOpmaak', req.supplier.code);
    l.unshift(reg); if (l.length > 60) l.length = 60;
    save();
    logActivity(req.supplier.code, req.actor, 'maakte de kas op: geteld € ' + geteld + ', verwacht € ' + verwacht + ' (verschil € ' + verschil + ')');
    res.json({ ok: true, opmaak: reg });
  });

};
