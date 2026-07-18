/* Member-voertuigen (deelmodule): boten en jachten (charter) met dezelfde eerlijke waarborgen.
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
/* ================== charter: boten en jachten huren ==================
   Zelfde eerlijke opzet als autoverhuur (vaste prijs vooraf, staat met foto's
   voor en na, borg, SOS op zee, vrijwillig live positie), met vaartuig-specifieke
   zaken: met of zonder schipper, en een vaarbewijs bij bareboat. */
const CHARTER_KLAAR = { afgerond: 1, geweigerd: 1 };
function mijnCharter(req, res) {
  const bc = boekingMetRef(String(req.body.ref || ''));
  const c = bc && bc.kind === 'charter' && (bc.customerKey || bc.customerTier) === req.session.key ? bc : null;
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
  const bezet = boekingenVanZaak(s.code).some(b => b.kind === 'charter' && b.bootId === boot.id &&
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
  boekingenVoegToe(charter);
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
};
