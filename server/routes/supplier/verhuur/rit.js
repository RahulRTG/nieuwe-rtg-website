/* Verhuur (deelmodule): de rit: de foto-upload (voor/na als harde eis),
   uitgeven en innemen met km/tank/borg-verrekening en automatische
   factuur, en het afhandelen van SOS. Krijgt de gedeelde context een keer
   bij het opstarten vanuit routes/supplier/verhuur.js. */
module.exports = (vctx) => {
  const { app, crypto, db, express, facturatie, logActivity, managerOnly, media, notify, save, schoon, sseToCustomer, sseToOffice, sseToSupplier, supplierAuth,
    isVerhuur, huurVan, fotosVan } = vctx;
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
    // automatische huurfactuur voor beide partijen: basishuur + eventuele meerkosten
    if (facturatie && !h.gefactureerd) {
      const regels = [{ omschrijving: (h.autoNaam || 'Huurauto') + ' · ' + (h.dagen || 1) + ' dag(en)', aantal: 1, stuk: h.price || 0 }];
      if (h.inname.meerkosten > 0) regels.push({ omschrijving: 'Meerkosten (extra km/tank)', aantal: 1, stuk: h.inname.meerkosten });
      facturatie.boek({ soort: 'huur', verkoperCode: s.code, verkoperNaam: s.name,
        koper: { key: h.customerKey, naam: h.customerCodename, codenaam: h.customerCodename }, regels, methode: 'vooraf', ref: h.ref });
      h.gefactureerd = true;
    }
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
