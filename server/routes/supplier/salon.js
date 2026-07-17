/* Domein "supplier" (deelmodule): De Salon (marketing van de zaak). Draait op de
   gedeelde kern. Publiceren kan pas met een compleet Salon-profiel en met de
   Salon-marketing aan in de eigen boardroom. */
module.exports = (kern) => {
  const { ALT_IDEE, BOEK_KETEN, DEMO, DEMO_SUPPLIER, HK_STATUSES, LANDEN, POS_METHODS, RIT_KETEN, RIT_LEGACY, TABLE_STATUSES, VAC_SOORTEN, ZAAK_OPTIES, accounts, addTicket, aiFindDoor, aiFindRoom, alcoholGrensVan, anthropic, app, applyChatPubliek, applyChatVertaald, auth, beslisReservering, isFavoriet, broadcastSync,
    zetCollectie, zetArtikel, pasVoorraad, releaseDrop, klantProfiel, zetKlantMaten, voegKlantnotitie,
    legApart, vraagPaskamer, paskamerBreng, stuurStyling, retailVerkoop, voorraadZoek, retailState,
    RETAIL_MATEN, RETAIL_SEIZOENEN, PASPOORT_NIVEAUS, paspoortVraag, paspoortBekijk, paspoortIncident, paspoortPartner,
    cannedBoekhouder, cateringDishes, chatStuur, checkCred, coachCache, coachRules, crypto, db, ensureApplyChat, eventCovers, express, fallbackRunsheet, financeVoor, factuur, facturatie, boekhoudkennis, talen, findSupplier, gcCode, geborenVan, guestsFor, hasCred, i18n, ledenPrijs, leeftijdVan, logActivity, keyVanCodenaam, magBezorgen, haversine, etaMinutes, ticketsVoorSlot, loginFails, managerOnly, noteFailedTry, notify, notifyApplicant, notifySupplier, parseRunsheetText, pickupCode, pinFails, posDay, publicSupplier, pushLive, rememberSession, ritBezetting, ritVerder, runItem, salonNaarVolgers, salonProfielCompleet, salonItemsVan, save, scheduleFor, schoon, sectiesForOrder, sessionFor, setRoomHk, sortRunsheet, sseClients, sseSend, sseToCustomer, sseToOffice, sseToSupplier, stationsForOrder, supplierAuth, supplierState, tooManyTries, trChat, unlockDoor, weekdagFactor,
    zaakBoard, zaakZet, zaakFunctieAan, klantSalon, media,
    dpVerzoekMaak, dpVerzoekIntrek, dpOntvangsten, logInlog, pay,
    tafelplanning, reserveringTafel, reserveringKomst, walkIn, shiftSamenvatting,
    fluisterZeg, orderMetRef, ordersVanZaak, ordersVoegToe, boekingenVanZaak } = kern;

// De Salon is verplicht: publiceren (post/folder/deal/poll) kan pas met een
// compleet profiel (bio + foto). De bio/foto-endpoints zelf blijven altijd open.
// Bovendien kan de zaak zijn Salon-marketing in zijn eigen boardroom uitzetten.
function eisSalonProfiel(req, res) {
  if (!zaakFunctieAan(req.supplier, 'salon')) { res.status(409).json({ error: 'Salon-marketing staat uit in uw boardroom. Zet het aan om te publiceren.' }); return false; }
  if (salonProfielCompleet(req.supplier)) return true;
  res.status(409).json({ error: 'Vul eerst uw Salon-profiel in (een bio en een profielfoto). De Salon is de plek voor uw marketing, producten en folders.' });
  return false;
}

app.post('/api/supplier/salon/post', express.json({ limit: '6mb' }), supplierAuth, async (req, res) => {
  if (!eisSalonProfiel(req, res)) return;
  const text = String(req.body.text || '').trim().slice(0, 600);
  if (!text) return res.status(400).json({ error: 'Schrijf eerst een tekst.' });
  let photo = null;
  const pi = parseInt(req.body.photoIndex, 10);
  // Een bestaande pagina-foto is al een /media-verwijzing; een nieuwe upload
  // bewaren we in de mediastore en verwijzen we naar (nooit base64 in db.data).
  if (Number.isInteger(pi) && req.supplier.photos && req.supplier.photos[pi]) photo = req.supplier.photos[pi];
  else if (typeof req.body.image === 'string') photo = await media.bewaarPubliek(req.body.image, 1.5 * 1024 * 1024);
  const post = {
    id: Date.now(),
    author: req.supplier.name, tier: 'partner', partner: true, partnerCode: req.supplier.code,
    place: req.supplier.city, visual: null, photo,
    text, lang: talen.taalVan(req.body.lang),
    at: new Date().toISOString(),
    baseLikes: 0, likedBy: {}, comments: []
  };
  db.data.posts.unshift(post);
  db.data.posts = db.data.posts.slice(0, 60);
  save();
  logActivity(req.supplier.code, req.actor, 'publiceerde op De Salon');
  salonNaarVolgers(req.supplier, text);
  broadcastSync(['rtg', 'lifestyle', 'business'], 'salon');
  sseToOffice('sync', { scope: 'salon' });
  res.json({ ok: true, postId: post.id });
});

app.post('/api/supplier/salon/deal', supplierAuth, (req, res) => {
  if (!req.actor.manager) return res.status(403).json({ error: 'Alleen voor management.' });
  if (!eisSalonProfiel(req, res)) return;
  const titel = schoon(req.body.titel, 80);
  const text = schoon(req.body.text, 400);
  if (!titel || !text) return res.status(400).json({ error: 'Geef de aanbieding een titel en een tekst.' });
  const geldigTot = /^\d{4}-\d{2}-\d{2}$/.test(String(req.body.geldigTot || '')) ? req.body.geldigTot : null;
  const post = {
    id: Date.now(),
    author: req.supplier.name, tier: 'partner', partner: true, partnerCode: req.supplier.code,
    place: req.supplier.city, visual: null, photo: null,
    text, lang: 'nl', at: new Date().toISOString(), baseLikes: 0, likedBy: {}, comments: [],
    deal: { titel, geldigTot, claims: [] }
  };
  db.data.posts.unshift(post);
  db.data.posts = db.data.posts.slice(0, 60);
  save();
  logActivity(req.supplier.code, req.actor, 'zette een aanbieding op De Salon: "' + titel + '"');
  salonNaarVolgers(req.supplier, '🎁 ' + titel);
  broadcastSync(['rtg', 'lifestyle', 'business'], 'salon');
  res.json({ ok: true, postId: post.id });
});

app.post('/api/supplier/salon/deal/redeem', supplierAuth, (req, res) => {
  const code = String(req.body.code || '').trim().toUpperCase();
  for (const p of db.data.posts) {
    if (!p.deal || p.partnerCode !== req.supplier.code) continue;
    const claim = p.deal.claims.find(c => c.code === code);
    if (claim) {
      if (claim.used) return res.status(409).json({ error: 'Deze code is al verzilverd.' });
      claim.used = true;
      claim.usedAt = new Date().toISOString();
      save();
      logActivity(req.supplier.code, req.actor, 'verzilverde aanbiedingscode ' + code + ' (' + claim.codename + ')');
      return res.json({ ok: true, titel: p.deal.titel, codename: claim.codename });
    }
  }
  res.status(404).json({ error: 'Deze code kennen we hier niet.' });
});

app.post('/api/supplier/salon/poll', supplierAuth, (req, res) => {
  if (!req.actor.manager) return res.status(403).json({ error: 'Alleen voor management.' });
  if (!eisSalonProfiel(req, res)) return;
  const vraag = schoon(req.body.vraag, 140);
  const opties = (Array.isArray(req.body.opties) ? req.body.opties : []).map(o => schoon(o, 60)).filter(Boolean).slice(0, 4);
  if (!vraag || opties.length < 2) return res.status(400).json({ error: 'Geef een vraag en minstens twee opties.' });
  const post = {
    id: Date.now(),
    author: req.supplier.name, tier: 'partner', partner: true, partnerCode: req.supplier.code,
    place: req.supplier.city, visual: null, photo: null,
    text: vraag, lang: 'nl', at: new Date().toISOString(), baseLikes: 0, likedBy: {}, comments: [],
    poll: { vraag, opties: opties.map(t2 => ({ tekst: t2, stemmen: [] })) }
  };
  db.data.posts.unshift(post);
  db.data.posts = db.data.posts.slice(0, 60);
  save();
  logActivity(req.supplier.code, req.actor, 'zette een poll op De Salon');
  salonNaarVolgers(req.supplier, '📊 ' + vraag);
  broadcastSync(['rtg', 'lifestyle', 'business'], 'salon');
  res.json({ ok: true, postId: post.id });
});

app.post('/api/supplier/salon/bio', express.json({ limit: '2mb' }), supplierAuth, async (req, res) => {
  if (!req.actor.manager) return res.status(403).json({ error: 'Alleen voor management.' });
  const s = req.supplier;
  s.salon = s.salon || { bio: '', foto: null, volgers: [], sinds: new Date().toISOString() };
  if (req.body.bio != null) s.salon.bio = schoon(req.body.bio, 200);
  // een profielfoto (etalage-omslag) mag mee; leeg laten wist hem niet. De foto
  // gaat naar de mediastore; in db.data staat alleen de /media-URL.
  if (typeof req.body.foto === 'string' && req.body.foto.startsWith('data:image/')) {
    const ref = await media.bewaarPubliek(req.body.foto, 1.5 * 1024 * 1024);
    if (ref) s.salon.foto = ref;
  }
  save();
  logActivity(s.code, req.actor, 'werkte het Salon-profiel bij');
  res.json({ ok: true, salon: { bio: s.salon.bio, foto: s.salon.foto || null, volgers: s.salon.volgers.length }, compleet: salonProfielCompleet(s) });
});

// de verplichte Salon-status: is het profiel compleet en welke stappen resten nog
app.post('/api/supplier/salon/status', supplierAuth, (req, res) => {
  const s = req.supplier;
  const bio = ((s.salon && s.salon.bio) || '').trim();
  const heeftFoto = !!(s.salon && s.salon.foto) || (Array.isArray(s.photos) && s.photos.length > 0);
  const items = salonItemsVan(s.code);
  const stappen = [
    { id: 'bio', klaar: bio.length >= 15, tekst: 'Schrijf een bio (min. 15 tekens)' },
    { id: 'foto', klaar: heeftFoto, tekst: 'Voeg een profielfoto of bedrijfsfoto toe' },
    { id: 'item', klaar: items >= 1, tekst: 'Plaats uw eerste folder of bericht' }
  ];
  const gedaan = stappen.filter(x => x.klaar).length;
  res.json({
    compleet: salonProfielCompleet(s),               // vereist voor zichtbaarheid en publiceren
    zichtbaar: salonProfielCompleet(s),
    volledig: gedaan === stappen.length,             // ook de eerste folder geplaatst
    percentage: Math.round(gedaan / stappen.length * 100),
    stappen, items,
    bio: bio, foto: (s.salon && s.salon.foto) || null, volgers: (s.salon && s.salon.volgers.length) || 0
  });
});

// een folder (digitale brochure): titel + foto's + producten/hoogtepunten
app.post('/api/supplier/salon/folder', express.json({ limit: '8mb' }), supplierAuth, async (req, res) => {
  if (!req.actor.manager) return res.status(403).json({ error: 'Alleen voor management.' });
  if (!eisSalonProfiel(req, res)) return;
  const titel = schoon(req.body.titel, 80);
  if (!titel) return res.status(400).json({ error: 'Geef de folder een titel.' });
  // elke folderfoto naar de mediastore; in db.data alleen de /media-URL's
  const fotos = [];
  for (const f of (Array.isArray(req.body.fotos) ? req.body.fotos : []).slice(0, 8)) {
    const ref = await media.bewaarPubliek(f, 1.5 * 1024 * 1024);
    if (ref) fotos.push(ref);
  }
  const items = (Array.isArray(req.body.items) ? req.body.items : []).slice(0, 30).map(it => ({
    naam: schoon(it.naam, 80), prijs: it.prijs != null && it.prijs !== '' ? Math.max(0, Number(it.prijs) || 0) : null, tekst: schoon(it.tekst, 120)
  })).filter(it => it.naam);
  if (!fotos.length && !items.length) return res.status(400).json({ error: 'Voeg minstens een foto of een product toe.' });
  const post = {
    id: Date.now(),
    author: req.supplier.name, tier: 'partner', partner: true, partnerCode: req.supplier.code,
    place: req.supplier.city, visual: null, photo: fotos[0] || null,
    text: schoon(req.body.tekst, 300) || titel, lang: talen.taalVan(req.body.lang),
    at: new Date().toISOString(), baseLikes: 0, likedBy: {}, comments: [],
    folder: { titel, fotos, items }
  };
  db.data.posts.unshift(post);
  db.data.posts = db.data.posts.slice(0, 60);
  save();
  logActivity(req.supplier.code, req.actor, 'plaatste een folder op De Salon: "' + titel + '"');
  salonNaarVolgers(req.supplier, '📖 ' + titel);
  broadcastSync(['rtg', 'lifestyle', 'business'], 'salon');
  sseToOffice('sync', { scope: 'salon' });
  res.json({ ok: true, postId: post.id });
});

app.post('/api/supplier/salon/stats', supplierAuth, (req, res) => {
  if (!req.actor.manager) return res.status(403).json({ error: 'Alleen voor management.' });
  const s = req.supplier;
  const eigen = db.data.posts.filter(p => p.partnerCode === s.code);
  const likes = eigen.reduce((n, p) => n + p.baseLikes + Object.keys(p.likedBy).length, 0);
  const reacties = eigen.reduce((n, p) => n + p.comments.length, 0);
  res.json({
    volgers: (s.salon && s.salon.volgers.length) || 0,
    bio: (s.salon && s.salon.bio) || '',
    posts: eigen.length, likes, reacties,
    deals: eigen.filter(p => p.deal).map(p => ({
      titel: p.deal.titel, geldigTot: p.deal.geldigTot,
      claims: p.deal.claims.length, verzilverd: p.deal.claims.filter(c => c.used).length
    })),
    polls: eigen.filter(p => p.poll).map(p => ({
      vraag: p.poll.vraag,
      opties: p.poll.opties.map(o => ({ tekst: o.tekst, stemmen: o.stemmen.length }))
    }))
  });
});
};
