/* Domein "member", deelmodule voertuigen & ontmoeten: autoverhuur en charters (eerlijk
   huren met fotostaat en SOS), de Salon-ontmoetingen en de autoshowroom.
   Alleen routes; de logica woont in de kern-modules. */
module.exports = (kern) => {
  const { app, auth, crypto, db, eisAccount,
    express, findSupplier, geborenVan, leeftijdVan, liveCodename,
    notifySupplier, save, schoon, sseToOffice, sseToSupplier,
    salonZichtbaar, ontmoetZet, ontmoetPos, ontmoetKies, ontmoetTeken,
    ontmoetHier, ontmoetStop, ontmoetSos, ontmoetSignaalKantoor, ontmoetMijnState,
    avShowroom, avAanbevolen, avProefrit, avKoop, avInruil,
    avTeken, avMijnDeals, zorgVoor, zorgContact, media } = kern;

  // koopt of huurt het lid echt? dan opent de chatlijn met de zaak: geen
  // vreemden meer (idempotent en stil voor gasten)
  const openLijn = (s, req) => {
    if (!s || req.session.tier === 'guest') return;
    try { zorgContact(s, req.session.key, liveCodename(req.session), req.session.tier); } catch (e) {}
  };

/* ================== autoverhuur: eerlijk huren ==================
   Tegen de schimmige verhuurders in: vaste dagprijs vooraf betaald (geen
   verrassingen aan de balie), de staat van de auto met foto's vastgelegd
   VOOR de uitgifte en NA het inleveren (door beide partijen, onveranderbaar,
   met RTG als scheidsrechter), een SOS-knop tijdens de huur en vrijwillig
   live locatie delen. */
const HUUR_KLAAR = { afgerond: 1, geweigerd: 1 };
function mijnHuur(req, res) {
  const h = db.data.boekingen.find(b => b.kind === 'huur' && b.ref === String(req.body.ref || '') &&
    (b.customerKey || b.customerTier) === req.session.key);
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
  const bezet = db.data.boekingen.some(b => b.kind === 'huur' && b.supplierCode === s.code && b.autoId === auto.id &&
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
  db.data.boekingen.unshift(huur);
  db.data.boekingen = db.data.boekingen.slice(0, 50000);
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

/* ================== charter: boten en jachten huren ==================
   Zelfde eerlijke opzet als autoverhuur (vaste prijs vooraf, staat met foto's
   voor en na, borg, SOS op zee, vrijwillig live positie), met vaartuig-specifieke
   zaken: met of zonder schipper, en een vaarbewijs bij bareboat. */
const CHARTER_KLAAR = { afgerond: 1, geweigerd: 1 };
function mijnCharter(req, res) {
  const c = db.data.boekingen.find(b => b.kind === 'charter' && b.ref === String(req.body.ref || '') &&
    (b.customerKey || b.customerTier) === req.session.key);
  if (!c) { res.status(404).json({ error: 'Charter niet gevonden.' }); return null; }
  return c;
}
function charterFotos(ref) { return db.data.charterFotos[ref] = db.data.charterFotos[ref] || { voor: [], na: [] }; }

app.post('/api/charter/aanbod', auth, (req, res) => {
  const partners = db.data.suppliers
    .filter(s => s.type === 'charter' && (s.boten || []).some(v => v.actief !== false) && salonZichtbaar(s))
    .map(s => ({ code: s.code, name: s.name, city: s.city, loc: s.loc || null,
      boten: (s.boten || []).filter(v => v.actief !== false).slice(0, 40) }));
  res.json({ partners });
});

app.post('/api/charter/boek', auth, (req, res) => {
  const s = findSupplier(req.body.supplierCode);
  if (!s || s.type !== 'charter') return res.status(404).json({ error: 'Geen charterpartner gevonden.' });
  const boot = (s.boten || []).find(v => v.id === req.body.bootId && v.actief !== false);
  if (!boot) return res.status(404).json({ error: 'Dit vaartuig is niet (meer) beschikbaar.' });
  const van = String(req.body.van || ''), tot = String(req.body.tot || '');
  const vandaag = new Date().toISOString().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(van) || !/^\d{4}-\d{2}-\d{2}$/.test(tot) || van < vandaag || tot <= van)
    return res.status(400).json({ error: 'Kies een periode vanaf vandaag; teruggeven na de vaardag.' });
  const dagen = Math.round((new Date(tot) - new Date(van)) / 86400000);
  if (dagen > 21) return res.status(400).json({ error: 'Charteren kan tot 21 dagen aaneen.' });
  // een boot huren doet u vanaf 18 jaar (paspoort geverifieerd, geen zelfrapportage)
  const lftC = leeftijdVan(geborenVan(req.session));
  if (lftC != null && lftC < 18) return res.status(403).json({ error: 'Een vaartuig charteren kan vanaf 18 jaar; uw leeftijd is via uw paspoort geverifieerd.' });
  const gasten = Math.max(1, Math.min(boot.gasten || 12, parseInt(req.body.gasten, 10) || 1));
  // schipper: verplicht op sommige vaartuigen; anders vaart u bareboat met vaarbewijs
  const metSkipper = boot.skipperVerplicht ? true : (req.body.metSkipper === true);
  if (!metSkipper && boot.vaarbewijsVereist && req.body.vaarbewijs !== true)
    return res.status(403).json({ error: 'Zonder schipper vaart u bareboat: bevestig uw vaarbewijs, of boek met schipper.' });
  // dubbele boekingen: het vaartuig is van een gast, niet van twee
  const nu = Date.now();
  const bezet = db.data.boekingen.some(b => b.kind === 'charter' && b.supplierCode === s.code && b.bootId === boot.id &&
    !CHARTER_KLAAR[b.status] && (b.paid || (nu - new Date(b.at).getTime()) < 30 * 60000) &&
    b.van < tot && van < b.tot);
  if (bezet) return res.status(409).json({ error: boot.naam + ' is in (een deel van) deze periode al gecharterd.' });
  const codename = liveCodename(req.session);
  const skipperKosten = metSkipper ? (boot.skipperPrijsPerDag || 0) * dagen : 0;
  const charter = {
    ref: 'RTG-C-' + crypto.randomBytes(3).toString('hex').toUpperCase(),
    kind: 'charter', supplierCode: s.code, supplierName: s.name,
    customerTier: req.session.tier, customerKey: req.session.key, customerCodename: codename,
    bootId: boot.id, bootNaam: boot.naam, bootType: boot.type,
    van, tot, dagen, gasten, metSkipper, skipperNaam: null,
    zorg: zorgVoor(req.session.key),
    service: { id: boot.id, name: boot.naam + ', ' + dagen + ' dag(en)' + (metSkipper ? ' met schipper' : ' bareboat'), soort: 'charter' },
    price: (boot.dagprijs || 0) * dagen + skipperKosten,
    wanneer: van,
    betaalMoment: 'vooraf', status: 'wacht-op-betaling', paid: false,
    sos: [], at: new Date().toISOString()
  };
  db.data.boekingen.unshift(charter);
  db.data.boekingen = db.data.boekingen.slice(0, 50000);
  openLijn(s, req);
  save();
  res.json({ ok: true, charter }); // afrekenen via /api/booking/pay: de prijs staat VAST
});

app.post('/api/charter/mijn', auth, (req, res) => {
  const mijn = db.data.boekingen
    .filter(b => b.kind === 'charter' && (b.customerKey || b.customerTier) === req.session.key && b.status !== 'geweigerd' && b.paid)
    .slice(0, 10)
    .map(b => {
      const f = db.data.charterFotos[b.ref] || { voor: [], na: [] };
      const loc = db.data.charterLocaties[b.ref] || null;
      const zaak = findSupplier(b.supplierCode);
      const boot = zaak ? (zaak.boten || []).find(v => v.id === b.bootId) : null;
      return { ref: b.ref, supplierName: b.supplierName, boot: b.bootNaam, type: b.bootType,
        van: b.van, tot: b.tot, dagen: b.dagen, prijs: b.price, status: b.status,
        gasten: b.gasten, metSkipper: !!b.metSkipper, skipperNaam: b.skipperNaam || null,
        borg: boot ? (boot.borg || 0) : 0, spec: boot ? {
          type: boot.type, lengte: boot.lengte, gasten: boot.gasten, hutten: boot.hutten,
          slaapplaatsen: boot.slaapplaatsen, brandstof: boot.brandstof, snelheidKn: boot.snelheidKn,
          ligplaats: boot.ligplaats, icoon: boot.icoon || '\u{1F6E5}️' } : null,
        uitvaart: b.uitvaart || null, teruggave: b.teruggave || null,
        fotosVoor: f.voor.length, fotosNa: f.na.length, sos: (b.sos || []).length,
        locatieAan: !!(loc && loc.aan) };
    });
  res.json({ charters: mijn });
});

app.post('/api/charter/foto', express.json({ limit: '1.5mb' }), auth, async (req, res) => {
  const c = mijnCharter(req, res); if (!c) return;
  const fase = req.body.fase === 'na' ? 'na' : 'voor';
  if (fase === 'voor' && c.status !== 'aangevraagd') return res.status(409).json({ error: 'Voor-foto\'s maakt u voordat u uitvaart.' });
  if (fase === 'na' && c.status !== 'lopend') return res.status(409).json({ error: 'Na-foto\'s maakt u bij de teruggave.' });
  const foto = String(req.body.foto || '');
  if (!/^data:image\/(jpeg|png|webp);base64,/.test(foto) || foto.length > 400000)
    return res.status(400).json({ error: 'Stuur een foto (jpeg/png/webp, tot ~300 kB).' });
  const f = charterFotos(c.ref);
  if (f[fase].filter(x => x.door === 'gast').length >= 8) return res.status(400).json({ error: 'Tot acht foto\'s per kant.' });
  // De foto naar de mediastore; in db.data komt alleen de /media-verwijzing.
  const ref = await media.bewaarPubliek(foto, 400000);
  if (!ref) return res.status(400).json({ error: 'De foto kon niet worden opgeslagen.' });
  f[fase].push({ foto: ref, door: 'gast', at: new Date().toISOString() });
  save();
  sseToSupplier(c.supplierCode, 'sync', { scope: 'charter' });
  res.json({ ok: true, aantal: f[fase].length });
});

app.post('/api/charter/sos', auth, (req, res) => {
  const c = mijnCharter(req, res); if (!c) return;
  if (CHARTER_KLAAR[c.status]) return res.status(409).json({ error: 'Deze charter is al afgerond.' });
  const sos = { bericht: schoon(req.body.bericht, 200) || 'Noodsignaal op zee', at: new Date().toISOString() };
  const lat = Number(req.body.lat), lng = Number(req.body.lng);
  if (Number.isFinite(lat) && Number.isFinite(lng)) { sos.lat = lat; sos.lng = lng; }
  c.sos = c.sos || [];
  c.sos.push(sos);
  save();
  notifySupplier(c.supplierCode, { icon: '\u{1F6A8}', title: 'SOS op zee van ' + c.customerCodename,
    body: (c.bootNaam || 'vaartuig') + ': ' + sos.bericht + (sos.lat ? ' · positie meegestuurd' : '') });
  sseToSupplier(c.supplierCode, 'sync', { scope: 'charter' });
  sseToOffice('sync', { scope: 'orders' });
  res.json({ ok: true });
});

app.post('/api/charter/locatie', auth, (req, res) => {
  const c = mijnCharter(req, res); if (!c) return;
  if (CHARTER_KLAAR[c.status]) return res.status(409).json({ error: 'Deze charter is al afgerond.' });
  const L = db.data.charterLocaties[c.ref] = db.data.charterLocaties[c.ref] || { aan: false };
  if (req.body.aan != null) L.aan = !!req.body.aan;
  const lat = Number(req.body.lat), lng = Number(req.body.lng);
  if (L.aan && Number.isFinite(lat) && Number.isFinite(lng)) { L.lat = lat; L.lng = lng; L.at = new Date().toISOString(); }
  if (!L.aan) { delete L.lat; delete L.lng; }
  save();
  sseToSupplier(c.supplierCode, 'sync', { scope: 'charter' });
  res.json({ ok: true, aan: L.aan });
});

/* ================== Salon-ontmoetingen (wederzijdse connecties in de buurt) ==
   Elk lid zet dit zelf aan of uit. Voorwaarde: 18+ met een geverifieerd
   paspoort. Terwijl het aanstaat stuurt de app af en toe de positie mee; een
   verbonden vriend die ook aanstaat en vlakbij is, levert een voorstel op.
   Beiden kiezen (of doen niets = afwijzen); bij een match tekenen ze een
   veiligheidscontract en kijkt RTG-kantoor live mee tot de afspraak klaar is. */
function ontmoetKey(req, res) { if (!eisAccount(req, res)) return null; return req.session.key; }

app.post('/api/ontmoeten/state', auth, (req, res) => {
  const key = ontmoetKey(req, res); if (!key) return;
  res.json(ontmoetMijnState(key));
});
app.post('/api/ontmoeten/aan', auth, (req, res) => {
  const key = ontmoetKey(req, res); if (!key) return;
  const r = ontmoetZet(key, req.body.aan === true);
  if (r.error) return res.status(r.status).json({ error: r.error });
  res.json({ ok: true, aan: r.aan, state: ontmoetMijnState(key) });
});
app.post('/api/ontmoeten/hier', auth, (req, res) => {
  const key = ontmoetKey(req, res); if (!key) return;
  const r = ontmoetPos(key, Number(req.body.lat), Number(req.body.lng));
  if (r.error) return res.status(r.status).json({ error: r.error });
  res.json({ ok: true, nieuwe: r.nieuwe, state: ontmoetMijnState(key) });
});
app.post('/api/ontmoeten/kies', auth, (req, res) => {
  const key = ontmoetKey(req, res); if (!key) return;
  const r = ontmoetKies(key, String(req.body.voorstelId || ''), String(req.body.keuze || ''));
  if (r.error) return res.status(r.status).json({ error: r.error });
  res.json({ ok: true, status: r.status2, activiteit: r.activiteit || null, dateId: r.dateId || null, state: ontmoetMijnState(key) });
});
app.post('/api/ontmoeten/teken', auth, (req, res) => {
  const key = ontmoetKey(req, res); if (!key) return;
  const r = ontmoetTeken(key, String(req.body.dateId || ''));
  if (r.error) return res.status(r.status).json({ error: r.error });
  res.json({ ok: true, status: r.status2, state: ontmoetMijnState(key) });
});
app.post('/api/ontmoeten/hier-date', auth, (req, res) => {
  const key = ontmoetKey(req, res); if (!key) return;
  const r = ontmoetHier(key, String(req.body.dateId || ''), Number(req.body.lat), Number(req.body.lng));
  if (r.error) return res.status(r.status).json({ error: r.error });
  res.json({ ok: true });
});
app.post('/api/ontmoeten/stop', auth, (req, res) => {
  const key = ontmoetKey(req, res); if (!key) return;
  const r = ontmoetStop(key, String(req.body.dateId || ''));
  if (r.error) return res.status(r.status).json({ error: r.error });
  res.json({ ok: true, status: r.status2, state: ontmoetMijnState(key) });
});
app.post('/api/ontmoeten/sos', auth, (req, res) => {
  const key = ontmoetKey(req, res); if (!key) return;
  const r = ontmoetSos(key, String(req.body.dateId || ''), req.body.bericht, Number(req.body.lat), Number(req.body.lng));
  if (r.error) return res.status(r.status).json({ error: r.error });
  res.json({ ok: true, sosId: r.sosId });
});
// WebRTC-signaal van het lid naar RTG-kantoor (live meekijken bij een SOS)
app.post('/api/ontmoeten/signaal', auth, (req, res) => {
  const key = ontmoetKey(req, res); if (!key) return;
  const r = ontmoetSignaalKantoor(key, String(req.body.dateId || ''), req.body.payload || null);
  if (r.error) return res.status(r.status).json({ error: r.error });
  res.json({ ok: true });
});

/* ================== autoverkoop: de exclusieve showroom ==================
   Leden bekijken de showroom, vragen een proefrit aan, doen een bod (optioneel
   met inruil en concierge-aflevering) en tekenen het digitale koopcontract. */
app.post('/api/verkoop/showroom', auth, (req, res) => {
  res.json({ autos: avShowroom({ zoek: req.body.zoek, brandstof: req.body.brandstof, maxPrijs: req.body.maxPrijs }),
    aanbevolen: avAanbevolen(req.session.key) });
});
app.post('/api/verkoop/proefrit', auth, (req, res) => {
  const r = avProefrit(req.session.key, liveCodename(req.session), String(req.body.supplierCode || ''), String(req.body.autoId || ''), req.body.wens);
  if (r.error) return res.status(r.status).json({ error: r.error });
  openLijn(findSupplier(req.body.supplierCode), req);
  res.json({ ok: true, deal: r.deal });
});
app.post('/api/verkoop/koop', auth, (req, res) => {
  const r = avKoop(req.session.key, liveCodename(req.session), String(req.body.supplierCode || ''), String(req.body.autoId || ''),
    { bod: req.body.bod, inruil: req.body.inruil, concierge: req.body.concierge === true, adres: req.body.adres });
  if (r.error) return res.status(r.status).json({ error: r.error });
  openLijn(findSupplier(req.body.supplierCode), req);
  res.json({ ok: true, deal: r.deal });
});
app.post('/api/verkoop/inruil', auth, (req, res) => {
  const r = avInruil(req.session.key, liveCodename(req.session), String(req.body.supplierCode || ''), String(req.body.autoId || ''), req.body.inruil);
  if (r.error) return res.status(r.status).json({ error: r.error });
  res.json({ ok: true, deal: r.deal });
});
app.post('/api/verkoop/teken', auth, (req, res) => {
  const r = avTeken(req.session.key, String(req.body.ref || ''), req.body.naam);
  if (r.error) return res.status(r.status).json({ error: r.error });
  res.json({ ok: true, status: r.status2 });
});
app.post('/api/verkoop/mijn', auth, (req, res) => {
  res.json({ deals: avMijnDeals(req.session.key) });
});
};
