/* Domein "supplier" (deelmodule): verhuur. Draait op de gedeelde kern. */
module.exports = (kern) => {
  const { app, crypto, db, express, logActivity, managerOnly, media, notify, save, schoon, sseToCustomer, sseToOffice, sseToSupplier, supplierAuth } = kern;

/* ================== autoverhuur: de zaak-kant ==================
   Vloot met vaste dagprijs, en de veiligheidsregels die schimmig verhuren
   onmogelijk maken: uitgeven kan pas MET voor-foto's, afronden pas MET
   na-foto's, en alles blijft vastgelegd met RTG als scheidsrechter. */
function isVerhuur(s, res) {
  if (s.type !== 'verhuur') { res.status(409).json({ error: 'Dit is geen verhuurzaak.' }); return false; }
  return true;
}
function huurVan(s, ref) {
  return db.data.boekingen.find(b => b.kind === 'huur' && b.supplierCode === s.code && b.ref === String(ref || ''));
}
function fotosVan(ref) { return db.data.huurFotos[ref] = db.data.huurFotos[ref] || { voor: [], na: [] }; }

app.post('/api/supplier/auto', supplierAuth, (req, res) => {
  if (!managerOnly(req, res)) return;
  const s = req.supplier;
  if (!isVerhuur(s, res)) return;
  if (!Array.isArray(s.autos)) s.autos = [];
  if (req.body.weg) {
    const a = s.autos.find(x => x.id === req.body.id);
    if (a) a.actief = false; // nooit echt weg: lopende huren verwijzen ernaar
    save(); sseToSupplier(s.code, 'sync', { scope: 'huur' });
    return res.json({ ok: true, autos: s.autos });
  }
  const name = schoon(req.body.name, 60);
  const dagprijs = Number(req.body.dagprijs);
  if (!name) return res.status(400).json({ error: 'Geef de auto een naam.' });
  if (!(dagprijs > 0) || dagprijs > 5000) return res.status(400).json({ error: 'Geef een geldige dagprijs op.' });
  const keuze = (v, opties, standaard) => opties.includes(v) ? v : standaard;
  const getal = (v, min, max, standaard) => { const n = Number(v); return Number.isFinite(n) && n >= min && n <= max ? Math.round(n) : standaard; };
  const velden = {
    name, plate: schoon(req.body.plate, 12), dagprijs: Math.round(dagprijs), actief: true,
    categorie: schoon(req.body.categorie, 40) || 'Personenauto',
    transmissie: keuze(req.body.transmissie, ['handgeschakeld', 'automaat'], 'handgeschakeld'),
    brandstof: keuze(req.body.brandstof, ['benzine', 'diesel', 'elektrisch', 'hybride'], 'benzine'),
    stoelen: getal(req.body.stoelen, 1, 9, 5), deuren: getal(req.body.deuren, 2, 5, 4),
    airco: req.body.airco !== false, bagage: getal(req.body.bagage, 0, 9, 2),
    kmPerDag: getal(req.body.kmPerDag, 0, 2000, 0), // 0 = onbeperkt
    meerKm: Math.min(5, Math.max(0, Number(req.body.meerKm) || 0)),
    borg: getal(req.body.borg, 0, 5000, 0),
    minLeeftijd: getal(req.body.minLeeftijd, 18, 30, 21),
    icoon: schoon(req.body.icoon, 4) || '\uD83D\uDE97'
  };
  if (req.body.id) {
    const a = s.autos.find(x => x.id === req.body.id);
    if (!a) return res.status(404).json({ error: 'Auto niet gevonden.' });
    Object.assign(a, velden);
  } else {
    if (s.autos.length >= 60) return res.status(400).json({ error: 'Tot 60 auto\'s per zaak.' });
    s.autos.push({ id: 'c' + crypto.randomBytes(3).toString('hex'), ...velden });
  }
  save();
  logActivity(s.code, req.actor, 'werkte de verhuurvloot bij');
  sseToSupplier(s.code, 'sync', { scope: 'huur' });
  res.json({ ok: true, autos: s.autos });
});

app.post('/api/supplier/huur/overzicht', supplierAuth, (req, res) => {
  const s = req.supplier;
  if (!isVerhuur(s, res)) return;
  const vandaag = new Date().toISOString().slice(0, 10);
  const lijst = db.data.boekingen
    .filter(b => b.kind === 'huur' && b.supplierCode === s.code && b.paid &&
      (!['afgerond', 'geweigerd'].includes(b.status) || String(b.finishedAt || b.at).slice(0, 10) === vandaag))
    .slice(0, 40)
    .map(b => {
      const f = db.data.huurFotos[b.ref] || { voor: [], na: [] };
      const loc = db.data.huurLocaties[b.ref] || null;
      const auto = (s.autos || []).find(a => a.id === b.autoId) || null;
      return { ref: b.ref, codename: b.customerCodename, auto: b.autoNaam, kenteken: b.kenteken,
        van: b.van, tot: b.tot, dagen: b.dagen, prijs: b.price, status: b.status,
        borg: auto ? auto.borg : 0, spec: auto,
        uitgifte: b.uitgifte || null, inname: b.inname || null,
        fotosVoor: f.voor.length, fotosNa: f.na.length,
        sos: (b.sos || []).filter(x => !x.ok), sosAfgehandeld: (b.sos || []).filter(x => x.ok).length,
        locatie: loc && loc.aan && Number.isFinite(loc.lat) ? { lat: loc.lat, lng: loc.lng, at: loc.at } : null };
    });
  res.json({ huren: lijst });
});

/* De foto's zelf, per huur (zwaar: los van het overzicht opvragen). */
app.post('/api/supplier/huur/fotos', supplierAuth, (req, res) => {
  const s = req.supplier;
  if (!isVerhuur(s, res)) return;
  const h = huurVan(s, req.body.ref);
  if (!h) return res.status(404).json({ error: 'Huur niet gevonden.' });
  res.json({ fotos: db.data.huurFotos[h.ref] || { voor: [], na: [] } });
});

app.post('/api/supplier/huur/foto', express.json({ limit: '1.5mb' }), supplierAuth, async (req, res) => {
  const s = req.supplier;
  if (!isVerhuur(s, res)) return;
  const h = huurVan(s, req.body.ref);
  if (!h) return res.status(404).json({ error: 'Huur niet gevonden.' });
  const fase = req.body.fase === 'na' ? 'na' : 'voor';
  if (fase === 'voor' && h.status !== 'aangevraagd') return res.status(409).json({ error: 'Voor-foto\'s horen bij de uitgifte.' });
  if (fase === 'na' && h.status !== 'lopend') return res.status(409).json({ error: 'Na-foto\'s horen bij het inleveren.' });
  const foto = String(req.body.foto || '');
  if (!/^data:image\/(jpeg|png|webp);base64,/.test(foto) || foto.length > 400000)
    return res.status(400).json({ error: 'Stuur een foto (jpeg/png/webp, tot ~300 kB).' });
  const f = fotosVan(h.ref);
  if (f[fase].filter(x => x.door !== 'huurder').length >= 8) return res.status(400).json({ error: 'Tot acht foto\'s per kant.' });
  // De foto naar de mediastore; in db.data komt alleen de /media-verwijzing.
  const ref = await media.bewaarPubliek(foto, 400000);
  if (!ref) return res.status(400).json({ error: 'De foto kon niet worden opgeslagen.' });
  f[fase].push({ foto: ref, door: req.actor.name, at: new Date().toISOString() });
  save();
  sseToCustomer(h.customerKey || h.customerTier, 'sync', { scope: 'huur' });
  res.json({ ok: true, aantal: f[fase].length });
});

/* Uitgeven en innemen, met de foto-eis als harde regel. */
app.post('/api/supplier/huur/status', supplierAuth, (req, res) => {
  const s = req.supplier;
  if (!isVerhuur(s, res)) return;
  const h = huurVan(s, req.body.ref);
  if (!h) return res.status(404).json({ error: 'Huur niet gevonden.' });
  const status = String(req.body.status || '');
  const f = db.data.huurFotos[h.ref] || { voor: [], na: [] };
  if (status === 'lopend') {
    if (h.status !== 'aangevraagd') return res.status(409).json({ error: 'Deze huur is niet klaar voor uitgifte.' });
    if (!h.paid) return res.status(409).json({ error: 'Nog niet betaald.' });
    if (!f.voor.length) return res.status(409).json({ error: 'Eerst de staat vastleggen: minstens een voor-foto (klant of balie).' });
    // km-stand en tankniveau bij uitgifte vastleggen (het startpunt, onbetwistbaar)
    const kmStart = Number(req.body.kmStart);
    if (!Number.isFinite(kmStart) || kmStart < 0) return res.status(400).json({ error: 'Vul de km-stand bij uitgifte in.' });
    h.uitgifte = { kmStart: Math.round(kmStart), tankStart: Math.min(8, Math.max(0, parseInt(req.body.tankStart, 10) || 8)), door: req.actor.name, at: new Date().toISOString() };
  } else if (status === 'afgerond') {
    if (h.status !== 'lopend') return res.status(409).json({ error: 'Deze huur loopt niet.' });
    if (!f.na.length) return res.status(409).json({ error: 'Eerst de staat bij inname vastleggen: minstens een na-foto.' });
    const kmEind = Number(req.body.kmEind);
    if (!Number.isFinite(kmEind) || (h.uitgifte && kmEind < h.uitgifte.kmStart))
      return res.status(400).json({ error: 'Vul de km-stand bij inname in (niet lager dan bij uitgifte).' });
    const tankEind = Math.min(8, Math.max(0, parseInt(req.body.tankEind, 10) || 8));
    // transparante meerkosten: extra km boven de vrije km, en het tankverschil
    const auto = (s.autos || []).find(a => a.id === h.autoId) || {};
    const gereden = h.uitgifte ? Math.round(kmEind) - h.uitgifte.kmStart : 0;
    const vrij = (auto.kmPerDag || 0) * (h.dagen || 1);
    const extraKm = (auto.kmPerDag && gereden > vrij) ? gereden - vrij : 0;
    const kmKosten = Math.round(extraKm * (auto.meerKm || 0) * 100) / 100;
    const tankTekort = h.uitgifte ? Math.max(0, h.uitgifte.tankStart - tankEind) : 0; // in achtsten
    const tankKosten = Math.round(tankTekort / 8 * 60 * 100) / 100; // ~60 euro voor een volle tank
    h.inname = { kmEind: Math.round(kmEind), tankEind, gereden, extraKm, kmKosten, tankTekort, tankKosten,
      meerkosten: Math.round((kmKosten + tankKosten) * 100) / 100, door: req.actor.name, at: new Date().toISOString() };
    h.finishedAt = new Date().toISOString();
    delete db.data.huurLocaties[h.ref];
  } else if (status === 'geweigerd') {
    if (!req.actor.manager) return res.status(403).json({ error: 'Alleen een manager annuleert een huur.' });
    if (h.status === 'lopend') return res.status(409).json({ error: 'Een lopende huur annuleer je niet; rond hem af met na-foto\'s.' });
    h.finishedAt = new Date().toISOString();
  } else return res.status(400).json({ error: 'Onbekende status.' });
  h.status = status;
  save();
  logActivity(s.code, req.actor, (status === 'lopend' ? 'gaf ' : status === 'afgerond' ? 'nam in: ' : 'annuleerde ') + (h.autoNaam || h.ref) + ' (' + h.customerCodename + ')');
  notify(h.customerTier, { icon: '\u{1F697}', title: s.name,
    body: status === 'lopend' ? 'Goede reis! De staat is vastgelegd met ' + f.voor.length + ' foto(\u2019s) en ' + h.uitgifte.kmStart + ' km op de teller.'
      : status === 'afgerond' ? 'Ingeleverd. ' + (h.inname.meerkosten > 0 ? 'Meerkosten: \u20AC ' + h.inname.meerkosten + ' (' + h.inname.extraKm + ' extra km, tank).' : 'Geen meerkosten. Uw borg wordt vrijgegeven.') + ' Dank u wel!'
      : 'De huur is geannuleerd.', scope: 'orders' });
  sseToCustomer(h.customerKey || h.customerTier, 'sync', { scope: 'huur' });
  sseToOffice('sync', { scope: 'orders' });
  res.json({ ok: true, huur: { ref: h.ref, status: h.status } });
});

app.post('/api/supplier/huur/sos-ok', supplierAuth, (req, res) => {
  const s = req.supplier;
  if (!isVerhuur(s, res)) return;
  const h = huurVan(s, req.body.ref);
  if (!h || !Array.isArray(h.sos)) return res.status(404).json({ error: 'Geen SOS gevonden.' });
  let n = 0;
  for (const x of h.sos) if (!x.ok) { x.ok = { door: req.actor.name, at: new Date().toISOString() }; n++; }
  if (!n) return res.status(409).json({ error: 'Alles is al afgehandeld.' });
  save();
  logActivity(s.code, req.actor, 'handelde de SOS van ' + h.customerCodename + ' af');
  sseToOffice('sync', { scope: 'orders' });
  res.json({ ok: true, afgehandeld: n });
});

};
