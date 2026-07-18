/* Member-voertuigen (deelmodule): autoverhuur: eerlijk huren met fotostaat, SOS en live locatie.
   Krijgt de gedeelde context een keer bij het opstarten vanuit
   routes/member/voertuigen.js. */
module.exports = (vctx) => {
  const { app, auth, crypto, db, eisAccount,
    express, findSupplier, geborenVan, leeftijdVan, liveCodename,
    notifySupplier, save, schoon, sseToOffice, sseToSupplier,
    salonZichtbaar, ontmoetZet, ontmoetPos, ontmoetKies, ontmoetTeken,
    ontmoetHier, ontmoetStop, ontmoetSos, ontmoetSignaalKantoor, ontmoetMijnState,
    avShowroom, avAanbevolen, avProefrit, avKoop, avInruil,
    avTeken, avMijnDeals, zorgVoor, zorgContact, media,
    boekingMetRef, boekingenVanZaak, boekingenVoegToe, openLijn } = vctx;
/* ================== autoverhuur: eerlijk huren ==================
   Tegen de schimmige verhuurders in: vaste dagprijs vooraf betaald (geen
   verrassingen aan de balie), de staat van de auto met foto's vastgelegd
   VOOR de uitgifte en NA het inleveren (door beide partijen, onveranderbaar,
   met RTG als scheidsrechter), een SOS-knop tijdens de huur en vrijwillig
   live locatie delen. */
const HUUR_KLAAR = { afgerond: 1, geweigerd: 1 };
function mijnHuur(req, res) {
  const bh = boekingMetRef(String(req.body.ref || ''));
  const h = bh && bh.kind === 'huur' && (bh.customerKey || bh.customerTier) === req.session.key ? bh : null;
  if (!h) { res.status(404).json({ error: 'Huur niet gevonden.' }); return null; }
  return h;
}
function huurFotos(ref) { return db.data.huurFotos[ref] = db.data.huurFotos[ref] || { voor: [], na: [] }; }

app.post('/api/verhuur/aanbod', auth, (req, res) => {
  const partners = db.data.suppliers
    .filter(s => (s.type === 'verhuur' || s.type === 'tweewielers') && (s.autos || []).some(a => a.actief !== false) && salonZichtbaar(s))
    .map(s => ({ code: s.code, name: s.name, city: s.city, loc: s.loc || null,
      autos: (s.autos || []).filter(a => a.actief !== false).slice(0, 40) }));
  res.json({ partners });
});

app.post('/api/huur/boek', auth, (req, res) => {
  const s = findSupplier(req.body.supplierCode);
  if (!s || (s.type !== 'verhuur' && s.type !== 'tweewielers')) return res.status(404).json({ error: 'Geen verhuurpartner gevonden.' });
  const auto = (s.autos || []).find(a => a.id === req.body.autoId && a.actief !== false);
  if (!auto) return res.status(404).json({ error: 'Deze auto is niet (meer) beschikbaar.' });
  const van = String(req.body.van || ''), tot = String(req.body.tot || '');
  const vandaag = new Date().toISOString().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(van) || !/^\d{4}-\d{2}-\d{2}$/.test(tot) || van < vandaag || tot <= van)
    return res.status(400).json({ error: 'Kies een periode vanaf vandaag; inleveren na de ophaaldag.' });
  const dagen = Math.round((new Date(tot) - new Date(van)) / 86400000);
  if (dagen > 30) return res.status(400).json({ error: 'Huren kan tot 30 dagen aaneen.' });
  // minimumleeftijd van de auto: uit het paspoort geverifieerd, geen zelfrapportage
  const lftH = leeftijdVan(geborenVan(req.session));
  if (auto.minLeeftijd && lftH != null && lftH < auto.minLeeftijd)
    return res.status(403).json({ error: auto.name + ' verhuren we vanaf ' + auto.minLeeftijd + ' jaar; uw leeftijd is via uw paspoort geverifieerd.' });
  // dubbele boekingen: de auto is van een gast, niet van twee
  const nu = Date.now();
  const bezet = boekingenVanZaak(s.code).some(b => b.kind === 'huur' && b.autoId === auto.id &&
    !HUUR_KLAAR[b.status] && (b.paid || (nu - new Date(b.at).getTime()) < 30 * 60000) &&
    b.van < tot && van < b.tot);
  if (bezet) return res.status(409).json({ error: auto.name + ' is in (een deel van) deze periode al verhuurd.' });
  const codename = liveCodename(req.session);
  const huur = {
    ref: 'RTG-H-' + crypto.randomBytes(3).toString('hex').toUpperCase(),
    kind: 'huur', supplierCode: s.code, supplierName: s.name,
    customerTier: req.session.tier, customerKey: req.session.key, customerCodename: codename,
    autoId: auto.id, autoNaam: auto.name, kenteken: auto.plate || null,
    van, tot, dagen,
    zorg: zorgVoor(req.session.key),
    service: { id: auto.id, name: auto.name + ', ' + dagen + ' dag(en)', soort: 'huur' },
    price: (auto.dagprijs || 0) * dagen,
    wanneer: van,
    betaalMoment: 'vooraf', status: 'wacht-op-betaling', paid: false,
    sos: [], at: new Date().toISOString()
  };
  boekingenVoegToe(huur);
  openLijn(s, req);
  save();
  res.json({ ok: true, huur }); // afrekenen via /api/booking/pay: de prijs staat VAST
});

app.post('/api/huur/mijn', auth, (req, res) => {
  const mijn = db.data.boekingen
    .filter(b => b.kind === 'huur' && (b.customerKey || b.customerTier) === req.session.key && b.status !== 'geweigerd' && b.paid)
    .slice(0, 10)
    .map(b => {
      const f = db.data.huurFotos[b.ref] || { voor: [], na: [] };
      const loc = db.data.huurLocaties[b.ref] || null;
      const zaak = findSupplier(b.supplierCode);
      const auto = zaak ? (zaak.autos || []).find(a => a.id === b.autoId) : null;
      return { ref: b.ref, supplierName: b.supplierName, auto: b.autoNaam, kenteken: b.kenteken,
        van: b.van, tot: b.tot, dagen: b.dagen, prijs: b.price, status: b.status,
        borg: auto ? (auto.borg || 0) : 0, spec: auto ? {
          categorie: auto.categorie, transmissie: auto.transmissie, brandstof: auto.brandstof,
          stoelen: auto.stoelen, deuren: auto.deuren, airco: auto.airco, bagage: auto.bagage,
          kmPerDag: auto.kmPerDag, meerKm: auto.meerKm, icoon: auto.icoon || '\uD83D\uDE97' } : null,
        uitgifte: b.uitgifte || null, inname: b.inname || null,
        fotosVoor: f.voor.length, fotosNa: f.na.length, sos: (b.sos || []).length,
        locatieAan: !!(loc && loc.aan) };
    });
  res.json({ huren: mijn });
});

/* Foto's: de huurder legt de staat vast, voor de uitgifte en bij het
   inleveren. Eenmaal vastgelegd blijft een foto staan: dat is het bewijs. */
app.post('/api/huur/foto', express.json({ limit: '1.5mb' }), auth, async (req, res) => {
  const h = mijnHuur(req, res); if (!h) return;
  const fase = req.body.fase === 'na' ? 'na' : 'voor';
  if (fase === 'voor' && h.status !== 'aangevraagd') return res.status(409).json({ error: 'Voor-foto\'s maak je voordat de auto is uitgegeven.' });
  if (fase === 'na' && h.status !== 'lopend') return res.status(409).json({ error: 'Na-foto\'s maak je bij het inleveren, tijdens de huur.' });
  const foto = String(req.body.foto || '');
  if (!/^data:image\/(jpeg|png|webp);base64,/.test(foto) || foto.length > 400000)
    return res.status(400).json({ error: 'Stuur een foto (jpeg/png/webp, tot ~300 kB).' });
  const f = huurFotos(h.ref);
  if (f[fase].filter(x => x.door === 'huurder').length >= 8) return res.status(400).json({ error: 'Tot acht foto\'s per kant.' });
  // De foto naar de mediastore; in db.data komt alleen de /media-verwijzing.
  const ref = await media.bewaarPubliek(foto, 400000);
  if (!ref) return res.status(400).json({ error: 'De foto kon niet worden opgeslagen.' });
  f[fase].push({ foto: ref, door: 'huurder', at: new Date().toISOString() });
  save();
  sseToSupplier(h.supplierCode, 'sync', { scope: 'huur' });
  res.json({ ok: true, aantal: f[fase].length });
});

/* De SOS-knop: bij pech, intimidatie of een onveilige situatie. De zaak EN
   het RTG-actiecentrum krijgen hem meteen, met locatie als die er is. */
app.post('/api/huur/sos', auth, (req, res) => {
  const h = mijnHuur(req, res); if (!h) return;
  if (HUUR_KLAAR[h.status]) return res.status(409).json({ error: 'Deze huur is al afgerond.' });
  const sos = { bericht: schoon(req.body.bericht, 200) || 'Noodsignaal', at: new Date().toISOString() };
  const lat = Number(req.body.lat), lng = Number(req.body.lng);
  if (Number.isFinite(lat) && Number.isFinite(lng)) { sos.lat = lat; sos.lng = lng; }
  h.sos = h.sos || [];
  h.sos.push(sos);
  save();
  notifySupplier(h.supplierCode, { icon: '\u{1F6A8}', title: 'SOS van ' + h.customerCodename,
    body: (h.autoNaam || 'huurauto') + ': ' + sos.bericht + (sos.lat ? ' \u00B7 locatie meegestuurd' : '') });
  sseToSupplier(h.supplierCode, 'sync', { scope: 'huur' });
  sseToOffice('sync', { scope: 'orders' });
  res.json({ ok: true });
});

/* Live locatie delen: vrijwillig, de huurder zet hem aan en uit. */
app.post('/api/huur/locatie', auth, (req, res) => {
  const h = mijnHuur(req, res); if (!h) return;
  if (HUUR_KLAAR[h.status]) return res.status(409).json({ error: 'Deze huur is al afgerond.' });
  const L = db.data.huurLocaties[h.ref] = db.data.huurLocaties[h.ref] || { aan: false };
  if (req.body.aan != null) L.aan = !!req.body.aan;
  const lat = Number(req.body.lat), lng = Number(req.body.lng);
  if (L.aan && Number.isFinite(lat) && Number.isFinite(lng)) { L.lat = lat; L.lng = lng; L.at = new Date().toISOString(); }
  if (!L.aan) { delete L.lat; delete L.lng; } // uit = weg: geen spoor achterlaten
  save();
  sseToSupplier(h.supplierCode, 'sync', { scope: 'huur' });
  res.json({ ok: true, aan: L.aan });
});

};
