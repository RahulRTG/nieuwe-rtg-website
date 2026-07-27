/* Supplier-submodule "gebouwplus": de Enterprise-laag boven het
   kantoorgebouw (RTG Enterprise) -- huurcontracten met verloopbewaking,
   leads voor lege verdiepingen, energiestanden per week met trend, en
   een signalenlijst die de manager vertelt waar hij moet kijken.
   Opslag in db.data.gebouwPlus[code] = { contracten, leads, energie }. */
module.exports = (kern) => {
  const { app, db, save, supplierAuth, managerOnly, logActivity, sseToSupplier, crypto } = kern;

  const rid = () => crypto.randomBytes(4).toString('hex');
  const txt = (v, n) => String(v == null ? '' : v).trim().slice(0, n);
  const DATUM = /^\d{4}-\d{2}-\d{2}$/;
  const LEADFASEN = ['nieuw', 'rondleiding', 'voorstel', 'getekend', 'afgewezen'];
  const MAX = 200;

  function bak(code) {
    if (!db.data.gebouwPlus) db.data.gebouwPlus = {};
    if (!db.data.gebouwPlus[code]) db.data.gebouwPlus[code] = { contracten: [], leads: [], energie: [] };
    return db.data.gebouwPlus[code];
  }
  const cap = l => { if (l.length > MAX) l.length = MAX; };
  const vandaag = () => new Date().toISOString().slice(0, 10);
  const overDagen = d => new Date(Date.now() + d * 86400000).toISOString().slice(0, 10);

  /* De signalen: wat verdient nu aandacht? Aflopende contracten binnen
     negentig dagen, leads die stil liggen en een energieweek die meer dan
     een vijfde boven het gemiddelde van de laatste acht weken uitkomt. */
  function signalen(b) {
    const s = [];
    const grens = overDagen(90);
    for (const c of b.contracten) {
      if (c.status === 'actief' && c.eind && c.eind <= grens)
        s.push({ soort: 'contract', tekst: 'Contract van ' + c.huurder + ' loopt af op ' + c.eind + '; plan het verlenggesprek.' });
    }
    for (const l of b.leads) {
      if (['nieuw', 'rondleiding', 'voorstel'].includes(l.fase) && l.sinds < overDagen(-14))
        s.push({ soort: 'lead', tekst: 'Lead ' + l.naam + ' staat al twee weken op "' + l.fase + '"; pak hem op of rond hem af.' });
    }
    const e = b.energie.slice(0, 8);
    if (e.length >= 3) {
      const gem = e.slice(1).reduce((a, x) => a + x.stroomKwh, 0) / (e.length - 1);
      if (gem > 0 && e[0].stroomKwh > gem * 1.2)
        s.push({ soort: 'energie', tekst: 'Het stroomverbruik van week ' + e[0].week + ' ligt ' + Math.round((e[0].stroomKwh / gem - 1) * 100) + '% boven het gemiddelde; loop de installaties na.' });
    }
    return s.slice(0, 12);
  }

  app.post('/api/supplier/gebouwplus/overzicht', supplierAuth, (req, res) => {
    if (!managerOnly(req, res)) return;
    const b = bak(req.supplier.code);
    res.json({ ok: true, contracten: b.contracten.slice(0, 60), leads: b.leads.slice(0, 60),
      energie: b.energie.slice(0, 26), signalen: signalen(b), fasen: LEADFASEN });
  });

  /* ---- huurcontracten: vastleggen, verlengen, beeindigen ---- */
  app.post('/api/supplier/gebouwplus/contract', supplierAuth, (req, res) => {
    if (!managerOnly(req, res)) return;
    const b = bak(req.supplier.code);
    const huurder = txt(req.body.huurder, 60);
    const verdiepingen = txt(req.body.verdiepingen, 30);
    const maandhuur = Math.round(Number(req.body.maandhuur));
    const start = DATUM.test(req.body.start) ? req.body.start : vandaag();
    const eind = DATUM.test(req.body.eind) ? req.body.eind : '';
    if (!huurder) return res.status(400).json({ error: 'Welke huurder tekent dit contract?' });
    if (!(maandhuur > 0)) return res.status(400).json({ error: 'Vul een maandhuur in euro\'s in.' });
    if (!eind || eind <= start) return res.status(400).json({ error: 'Kies een einddatum na de startdatum.' });
    const c = { id: rid(), huurder, verdiepingen, maandhuur, start, eind, status: 'actief' };
    b.contracten.unshift(c); cap(b.contracten); save();
    logActivity(req.supplier.code, req.actor, 'legde het huurcontract van ' + huurder + ' vast');
    sseToSupplier(req.supplier.code, 'sync', { scope: 'gebouw' });
    res.json({ ok: true, contract: c });
  });

  app.post('/api/supplier/gebouwplus/contract/zet', supplierAuth, (req, res) => {
    if (!managerOnly(req, res)) return;
    const b = bak(req.supplier.code);
    const c = b.contracten.find(x => x.id === req.body.id);
    if (!c) return res.status(404).json({ error: 'Contract niet gevonden.' });
    if (req.body.actie === 'verleng') {
      if (!DATUM.test(req.body.eind) || req.body.eind <= c.eind)
        return res.status(400).json({ error: 'Kies een nieuwe einddatum na de huidige.' });
      c.eind = req.body.eind; c.status = 'actief';
      logActivity(req.supplier.code, req.actor, 'verlengde het contract van ' + c.huurder + ' tot ' + c.eind);
    } else if (req.body.actie === 'beeindig') {
      c.status = 'beeindigd';
      logActivity(req.supplier.code, req.actor, 'beeindigde het contract van ' + c.huurder);
    } else return res.status(400).json({ error: 'Kies verleng of beeindig.' });
    save(); sseToSupplier(req.supplier.code, 'sync', { scope: 'gebouw' });
    res.json({ ok: true, contract: c });
  });

  /* ---- leads voor lege verdiepingen: van kennismaking tot handtekening ---- */
  app.post('/api/supplier/gebouwplus/lead', supplierAuth, (req, res) => {
    if (!managerOnly(req, res)) return;
    const b = bak(req.supplier.code);
    const naam = txt(req.body.naam, 60), wens = txt(req.body.wens, 160);
    if (!naam) return res.status(400).json({ error: 'Wie is de kandidaat-huurder?' });
    const l = { id: rid(), naam, wens, fase: 'nieuw', sinds: vandaag() };
    b.leads.unshift(l); cap(b.leads); save();
    sseToSupplier(req.supplier.code, 'sync', { scope: 'gebouw' });
    res.json({ ok: true, lead: l });
  });

  app.post('/api/supplier/gebouwplus/lead/fase', supplierAuth, (req, res) => {
    if (!managerOnly(req, res)) return;
    const b = bak(req.supplier.code);
    const l = b.leads.find(x => x.id === req.body.id);
    if (!l) return res.status(404).json({ error: 'Lead niet gevonden.' });
    if (!LEADFASEN.includes(req.body.fase)) return res.status(400).json({ error: 'Kies een bestaande fase.' });
    l.fase = req.body.fase; l.sinds = vandaag(); save();
    if (l.fase === 'getekend') logActivity(req.supplier.code, req.actor, 'zette lead ' + l.naam + ' op getekend');
    sseToSupplier(req.supplier.code, 'sync', { scope: 'gebouw' });
    res.json({ ok: true, lead: l });
  });

  /* ---- energie: een weekstand per week, de trend leest zichzelf ---- */
  app.post('/api/supplier/gebouwplus/energie', supplierAuth, (req, res) => {
    if (!managerOnly(req, res)) return;
    const b = bak(req.supplier.code);
    const week = txt(req.body.week, 8);
    if (!/^\d{4}-W\d{2}$/.test(week)) return res.status(400).json({ error: 'Geef de week als 2026-W31.' });
    const stroomKwh = Math.round(Number(req.body.stroomKwh));
    const waterM3 = Math.round(Number(req.body.waterM3));
    if (!(stroomKwh >= 0) || !(waterM3 >= 0)) return res.status(400).json({ error: 'Stroom (kWh) en water (m3) horen nul of hoger te zijn.' });
    const bestaand = b.energie.find(x => x.week === week);
    if (bestaand) { bestaand.stroomKwh = stroomKwh; bestaand.waterM3 = waterM3; }
    else { b.energie.unshift({ week, stroomKwh, waterM3 }); b.energie.sort((a, x) => x.week.localeCompare(a.week)); cap(b.energie); }
    save(); sseToSupplier(req.supplier.code, 'sync', { scope: 'gebouw' });
    res.json({ ok: true, energie: b.energie.slice(0, 26) });
  });
};
