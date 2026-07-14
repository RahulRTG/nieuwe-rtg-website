/* Domein "supplier" (deelmodule): charter, oftewel boten en jachten verhuren.
   Draait op de gedeelde kern. Zelfde eerlijke mechaniek als autoverhuur: de prijs
   staat vast en wordt vooraf betaald, de staat van het vaartuig wordt met foto's
   vastgelegd VOOR het uitvaren en NA de teruggave (door beide partijen, met RTG
   als scheidsrechter), er is een SOS-knop op het water en de gast deelt vrijwillig
   zijn positie. Aangevuld met vaartuig-specifieke zaken: motoruren en brandstof in
   plaats van km/tank, de ligplaats, en bemand (met schipper) of bareboat varen. */
module.exports = (kern) => {
  const { app, crypto, db, express, logActivity, managerOnly, notify, save, schoon, sseToCustomer, sseToOffice, sseToSupplier, supplierAuth } = kern;

  const BOOT_TYPES = ['Motorjacht', 'Zeiljacht', 'Catamaran', 'RIB', 'Sloep'];
  function isCharter(s, res) {
    if (s.type !== 'charter') { res.status(409).json({ error: 'Dit is geen charterbedrijf.' }); return false; }
    return true;
  }
  function charterVan(s, ref) {
    return db.data.boekingen.find(b => b.kind === 'charter' && b.supplierCode === s.code && b.ref === String(ref || ''));
  }
  function fotosVan(ref) { return db.data.charterFotos[ref] = db.data.charterFotos[ref] || { voor: [], na: [] }; }
  const getal = (v, min, max, standaard) => { const n = Number(v); return Number.isFinite(n) && n >= min && n <= max ? Math.round(n) : standaard; };

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
  app.post('/api/supplier/charter/fotos', supplierAuth, (req, res) => {
    const s = req.supplier;
    if (!isCharter(s, res)) return;
    const c = charterVan(s, req.body.ref);
    if (!c) return res.status(404).json({ error: 'Charter niet gevonden.' });
    res.json({ fotos: db.data.charterFotos[c.ref] || { voor: [], na: [] } });
  });

  app.post('/api/supplier/charter/foto', express.json({ limit: '1.5mb' }), supplierAuth, (req, res) => {
    const s = req.supplier;
    if (!isCharter(s, res)) return;
    const c = charterVan(s, req.body.ref);
    if (!c) return res.status(404).json({ error: 'Charter niet gevonden.' });
    const fase = req.body.fase === 'na' ? 'na' : 'voor';
    if (fase === 'voor' && c.status !== 'aangevraagd') return res.status(409).json({ error: 'Voor-foto\'s horen bij het uitvaren.' });
    if (fase === 'na' && c.status !== 'lopend') return res.status(409).json({ error: 'Na-foto\'s horen bij de teruggave.' });
    const foto = String(req.body.foto || '');
    if (!/^data:image\/(jpeg|png|webp);base64,/.test(foto) || foto.length > 400000)
      return res.status(400).json({ error: 'Stuur een foto (jpeg/png/webp, tot ~300 kB).' });
    const f = fotosVan(c.ref);
    if (f[fase].filter(x => x.door !== 'gast').length >= 8) return res.status(400).json({ error: 'Tot acht foto\'s per kant.' });
    f[fase].push({ foto, door: req.actor.name, at: new Date().toISOString() });
    save();
    sseToCustomer(c.customerKey || c.customerTier, 'sync', { scope: 'charter' });
    res.json({ ok: true, aantal: f[fase].length });
  });

  /* Uitvaren en teruggeven, met de foto-eis als harde regel. Bij het uitvaren
     legt de schipper de motoruren en het brandstofniveau vast; bij teruggave
     idem, en het verschil wordt eerlijk verrekend. */
  app.post('/api/supplier/charter/status', supplierAuth, (req, res) => {
    const s = req.supplier;
    if (!isCharter(s, res)) return;
    const c = charterVan(s, req.body.ref);
    if (!c) return res.status(404).json({ error: 'Charter niet gevonden.' });
    const status = String(req.body.status || '');
    const f = db.data.charterFotos[c.ref] || { voor: [], na: [] };
    if (status === 'lopend') {
      if (c.status !== 'aangevraagd') return res.status(409).json({ error: 'Deze charter is niet klaar om uit te varen.' });
      if (!c.paid) return res.status(409).json({ error: 'Nog niet betaald.' });
      if (!f.voor.length) return res.status(409).json({ error: 'Eerst de staat vastleggen: minstens een voor-foto (gast of bemanning).' });
      const urenStart = Number(req.body.urenStart);
      if (!Number.isFinite(urenStart) || urenStart < 0) return res.status(400).json({ error: 'Vul de motorurenstand bij uitvaren in.' });
      c.uitvaart = { urenStart: Math.round(urenStart), brandstofStart: Math.min(8, Math.max(0, parseInt(req.body.brandstofStart, 10) || 8)),
        skipper: c.metSkipper ? (req.actor.name || null) : null, door: req.actor.name, at: new Date().toISOString() };
      if (c.metSkipper && !c.skipperNaam) c.skipperNaam = req.actor.name;
    } else if (status === 'afgerond') {
      if (c.status !== 'lopend') return res.status(409).json({ error: 'Deze charter is niet onderweg.' });
      if (!f.na.length) return res.status(409).json({ error: 'Eerst de staat bij teruggave vastleggen: minstens een na-foto.' });
      const urenEind = Number(req.body.urenEind);
      if (!Number.isFinite(urenEind) || (c.uitvaart && urenEind < c.uitvaart.urenStart))
        return res.status(400).json({ error: 'Vul de motorurenstand bij teruggave in (niet lager dan bij uitvaren).' });
      const brandstofEind = Math.min(8, Math.max(0, parseInt(req.body.brandstofEind, 10) || 8));
      const boot = (s.boten || []).find(v => v.id === c.bootId) || {};
      const gevaren = c.uitvaart ? Math.round(urenEind) - c.uitvaart.urenStart : 0;
      const vrij = (boot.motorurenPerDag || 0) * (c.dagen || 1);
      const extraUur = (boot.motorurenPerDag && gevaren > vrij) ? gevaren - vrij : 0;
      const uurKosten = Math.round(extraUur * (boot.meerUur || 0) * 100) / 100;
      const brandstofTekort = c.uitvaart ? Math.max(0, c.uitvaart.brandstofStart - brandstofEind) : 0; // in achtsten
      const brandstofKosten = Math.round(brandstofTekort / 8 * 400 * 100) / 100; // ~400 euro voor een volle tank op zee
      c.teruggave = { urenEind: Math.round(urenEind), brandstofEind, gevaren, extraUur, uurKosten, brandstofTekort, brandstofKosten,
        meerkosten: Math.round((uurKosten + brandstofKosten) * 100) / 100, door: req.actor.name, at: new Date().toISOString() };
      c.finishedAt = new Date().toISOString();
      delete db.data.charterLocaties[c.ref];
    } else if (status === 'geweigerd') {
      if (!req.actor.manager) return res.status(403).json({ error: 'Alleen een manager annuleert een charter.' });
      if (c.status === 'lopend') return res.status(409).json({ error: 'Een lopende charter annuleer je niet; rond hem af met na-foto\'s.' });
      c.finishedAt = new Date().toISOString();
    } else return res.status(400).json({ error: 'Onbekende status.' });
    c.status = status;
    save();
    logActivity(s.code, req.actor, (status === 'lopend' ? 'liet uitvaren: ' : status === 'afgerond' ? 'nam terug: ' : 'annuleerde ') + (c.bootNaam || c.ref) + ' (' + c.customerCodename + ')');
    notify(c.customerTier, { icon: '⛵', title: s.name,
      body: status === 'lopend' ? 'Behouden vaart! De staat is vastgelegd met ' + f.voor.length + ' foto(’s).' + (c.metSkipper ? ' Uw schipper is ' + (c.skipperNaam || 'aan boord') + '.' : '')
        : status === 'afgerond' ? 'Teruggegeven. ' + (c.teruggave.meerkosten > 0 ? 'Meerkosten: € ' + c.teruggave.meerkosten + ' (motoruren/brandstof).' : 'Geen meerkosten. Uw borg wordt vrijgegeven.') + ' Bedankt voor de vaart!'
        : 'De charter is geannuleerd.', scope: 'orders' });
    sseToCustomer(c.customerKey || c.customerTier, 'sync', { scope: 'charter' });
    sseToOffice('sync', { scope: 'orders' });
    res.json({ ok: true, charter: { ref: c.ref, status: c.status } });
  });

  app.post('/api/supplier/charter/sos-ok', supplierAuth, (req, res) => {
    const s = req.supplier;
    if (!isCharter(s, res)) return;
    const c = charterVan(s, req.body.ref);
    if (!c || !Array.isArray(c.sos)) return res.status(404).json({ error: 'Geen SOS gevonden.' });
    let n = 0;
    for (const x of c.sos) if (!x.ok) { x.ok = { door: req.actor.name, at: new Date().toISOString() }; n++; }
    if (!n) return res.status(409).json({ error: 'Alles is al afgehandeld.' });
    save();
    logActivity(s.code, req.actor, 'handelde de SOS op zee van ' + c.customerCodename + ' af');
    sseToOffice('sync', { scope: 'orders' });
    res.json({ ok: true, afgehandeld: n });
  });
};
