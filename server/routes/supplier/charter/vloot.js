/* Charter (deelmodule): de vloot: vaartuigen toevoegen, wijzigen of uit
   de vaart nemen en het overzicht van lopende en net afgeronde charters.
   Krijgt de gedeelde context een keer bij het opstarten vanuit
   routes/supplier/charter.js. */
module.exports = (cctx) => {
  const { app, crypto, db, express, logActivity, managerOnly, media, notify, save, schoon, sseToCustomer, sseToOffice, sseToSupplier, supplierAuth,
    BOOT_TYPES, isCharter, charterVan, fotosVan, getal } = cctx;
  // een vaartuig toevoegen, wijzigen of uit de vaart nemen (manager)
  app.post('/api/supplier/boot', supplierAuth, (req, res) => {
    if (!managerOnly(req, res)) return;
    const s = req.supplier;
    if (!isCharter(s, res)) return;
    if (!Array.isArray(s.boten)) s.boten = [];
    if (req.body.weg) {
      const b = s.boten.find(x => x.id === req.body.id);
      if (b) b.actief = false; // nooit echt weg: lopende charters verwijzen ernaar
      save(); sseToSupplier(s.code, 'sync', { scope: 'charter' });
      return res.json({ ok: true, boten: s.boten });
    }
    const naam = schoon(req.body.naam, 60);
    const dagprijs = Number(req.body.dagprijs);
    if (!naam) return res.status(400).json({ error: 'Geef het vaartuig een naam.' });
    if (!(dagprijs > 0) || dagprijs > 100000) return res.status(400).json({ error: 'Geef een geldige dagprijs op.' });
    const velden = {
      naam, actief: true,
      type: BOOT_TYPES.includes(req.body.type) ? req.body.type : 'Motorjacht',
      lengte: Math.min(120, Math.max(3, Number(req.body.lengte) || 12)),
      bouwjaar: getal(req.body.bouwjaar, 1950, 2100, new Date().getFullYear()),
      gasten: getal(req.body.gasten, 1, 500, 8),
      hutten: getal(req.body.hutten, 0, 40, 2),
      slaapplaatsen: getal(req.body.slaapplaatsen, 0, 80, 4),
      brandstof: ['diesel', 'benzine', 'elektrisch', 'geen'].includes(req.body.brandstof) ? req.body.brandstof : 'diesel',
      snelheidKn: getal(req.body.snelheidKn, 0, 80, 20),
      ligplaats: schoon(req.body.ligplaats, 60) || s.city || 'Haven',
      dagprijs: Math.round(dagprijs),
      motorurenPerDag: getal(req.body.motorurenPerDag, 0, 24, 0), // 0 = onbeperkt
      meerUur: Math.min(1000, Math.max(0, Number(req.body.meerUur) || 0)),
      borg: getal(req.body.borg, 0, 500000, 0),
      skipperVerplicht: req.body.skipperVerplicht === true,
      skipperPrijsPerDag: getal(req.body.skipperPrijsPerDag, 0, 5000, 300),
      vaarbewijsVereist: req.body.vaarbewijsVereist !== false,
      foto: (typeof req.body.foto === 'string' && req.body.foto.length < 500000) ? req.body.foto : (req.body.foto === null ? null : undefined),
      icoon: schoon(req.body.icoon, 4) || '\u{1F6E5}️'
    };
    if (velden.foto === undefined) delete velden.foto;
    if (req.body.id) {
      const b = s.boten.find(x => x.id === req.body.id);
      if (!b) return res.status(404).json({ error: 'Vaartuig niet gevonden.' });
      Object.assign(b, velden);
    } else {
      if (s.boten.length >= 60) return res.status(400).json({ error: 'Tot 60 vaartuigen per bedrijf.' });
      s.boten.push({ id: 'v' + crypto.randomBytes(3).toString('hex'), ...velden });
    }
    save();
    logActivity(s.code, req.actor, 'werkte de chartervloot bij');
    sseToSupplier(s.code, 'sync', { scope: 'charter' });
    res.json({ ok: true, boten: s.boten });
  });

  // het overzicht van de charters (vandaag lopend of net afgerond)
  app.post('/api/supplier/charter/overzicht', supplierAuth, (req, res) => {
    const s = req.supplier;
    if (!isCharter(s, res)) return;
    const vandaag = new Date().toISOString().slice(0, 10);
    const lijst = db.data.boekingen
      .filter(b => b.kind === 'charter' && b.supplierCode === s.code && b.paid &&
        (!['afgerond', 'geweigerd'].includes(b.status) || String(b.finishedAt || b.at).slice(0, 10) === vandaag))
      .slice(0, 40)
      .map(b => {
        const f = db.data.charterFotos[b.ref] || { voor: [], na: [] };
        const loc = db.data.charterLocaties[b.ref] || null;
        const boot = (s.boten || []).find(v => v.id === b.bootId) || null;
        return { ref: b.ref, codename: b.customerCodename, boot: b.bootNaam, type: b.bootType,
          van: b.van, tot: b.tot, dagen: b.dagen, prijs: b.price, status: b.status,
          gasten: b.gasten || null, metSkipper: !!b.metSkipper, skipperNaam: b.skipperNaam || null,
          borg: boot ? boot.borg : 0, spec: boot,
          uitvaart: b.uitvaart || null, teruggave: b.teruggave || null,
          fotosVoor: f.voor.length, fotosNa: f.na.length,
          sos: (b.sos || []).filter(x => !x.ok), sosAfgehandeld: (b.sos || []).filter(x => x.ok).length,
          locatie: loc && loc.aan && Number.isFinite(loc.lat) ? { lat: loc.lat, lng: loc.lng, at: loc.at } : null };
      });
    res.json({ charters: lijst });
  });

  // de foto's zelf, per charter (zwaar: los van het overzicht opvragen)
};
