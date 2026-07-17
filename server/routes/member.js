/* Domein "member" (aparte module op de gedeelde kern). Alleen de routes;
   de helpers blijven in de kern (server.js) en komen via het kern-object binnen. */
module.exports = (kern) => {
  const { AUTHOR_TIER, DOOR_RELOCK_MS, FISCAAL_PEILJAAR, LANDEN, PERSONAS, UPLOAD_DIR, ZZP, accounts, aiSystemPrompt, alcoholGrensVan, anthropic, app, applyChatPubliek, applyChatVertaald, auth, betaal, broadcastSync, canEngage, cannedAnswer, centen, chatKeyOf, chatStuur, convOf, crypto, cvReady, db, eisAccount, engageError, findPartner, findStaffPartner, entreeCode, express, findSupplier, magBezorgen, ticketsVoorSlot, forgetSession, fs, gcCode, geborenVan, getChat, haversine, ledenPrijs, leeftijdVan, liveCodename, liveStateFor, logActivity, mail, meldWerkgever, memberSays, memberTemplate, myApplications, noteFailedTry, notify, notifySupplier, openVacatures, optieAan, path, pickupCode, publicPartner, publicSupplier, publicTrip, pushLive, registerContact, rtf, save, schoon, sessionFor, sessions, sseToCustomer, sseToOffice, sseToSupplier, stateFor, tooManyTries, trChat, unlockDoor, validDept,
    reserveerTafel, mijnReserveringen, annuleerReservering, annuleerItem, plaatsReview, reviewsVoor,
    verblijfBoek, mijnVerblijven, verblijfAnnuleer, gastDeur,
    toggleFavoriet, favorietenVan, isFavoriet, fooiUit, agendaVoor, maakSplits, mijnSplitsen, betaalSplits,
    zetOpWachtlijst, mijnWachtlijst, rsvpAnnuleer, puntenVan, verdienPunten, verzilverPunten, pasTegoedToe,
    voorkeurVan, zetVoorkeur,
    retailCatalogus, wishlistToggle, mijnApart, mijnStyling, vraagPaskamer, retailIsRetail,
    PASPOORT_NIVEAUS, paspoortStatus, paspoortMijn, paspoortBeslis, paspoortTrekIn,
    salonZichtbaar, salonProfielCompleet,
    ontmoetZet, ontmoetPos, ontmoetKies, ontmoetTeken, ontmoetHier, ontmoetStop,
    ontmoetSos, ontmoetSignaalKantoor, ontmoetMijnState,
    ghMarkt, ghPlaatsBestelling, ghMijnBestellingen, ghAnnuleer,
    mbAanvraag, mbMijn,
    avShowroom, avAanbevolen, avProefrit, avKoop, avInruil, avTeken, avMijnDeals,
    zorgContact, fonds, munten, factuur, talen,
    zorgVan, zorgZet, zorgVoor, locDeel, locStopKlant, locMijn,
    assetsOverzicht, assetDocument, assetKoop, assetHerroep, assetWachtlijstZet, assetMijn, assetGebruik, assetUitstap,
    fluisterZeg, fluisterOnthoud, fluisterVergeet, fluisterFocus, fluisterProfiel, fluisterPush,
    plaatsOrderVoor, betaalOrderVoor, koopTicketVoor, betaalBoekingVoor, vraagRitVoor, betaalRitVoor,
    dpBetaalDirect, dpMijnBetalingen, dpVerzoekenVoor, dpBetaalVerzoek, media,
    ordersVanKlant, boekingenVanKlant, boekingenVoegToe,
    txLedgerActief, txLedgerVanKlant, txLedgerTel } = kern;
  // laatste durende opslag van de live locatie per lid (throttle tegen GPS-storm)
  const liveSaveAt = new Map();

  /* Zodra een lid echt in contact komt met een partner (boekt, bestelt, huurt,
     koopt, laat bezorgen of gaat de partner volgen) openen we automatisch een
     open chatlijn. Zo zijn ze nooit vreemden en kunnen ze vooraf elkaars Salon
     bekijken. Idempotent en stil voor gasten (die hebben geen ledenchat). */
  const openLijnVoor = (s, session) => {
    if (!s || session.tier === 'guest') return;
    try { zorgContact(s, session.key, liveCodename(session), session.tier); } catch (e) {}
  };
  const openLijn = (s, req) => openLijnVoor(s, req.session);

app.post('/api/state', auth, (req, res) => res.json({ state: stateFor(req.session, req.body.lang) }));

app.post('/api/rtf/profielen', auth, (req, res) => {
  if (!eisAccount(req, res)) return;
  const info = rtf.gastProfielen(req.body.code);
  if (!info) return res.status(404).json({ error: 'Dit gezin kennen we niet. Klopt de gezinscode?' });
  if (!info.profielen.length) return res.status(404).json({ error: 'Dit gezin heeft nog geen oppas- of familieprofiel om te koppelen. Vraag de ouder er een aan te maken.' });
  res.json(info);
});

app.post('/api/rtf/koppel', auth, (req, res) => {
  if (!eisAccount(req, res)) return;
  const u = req.session.account;
  const r = rtf.linkGast({ code: req.body.code, profielId: req.body.profielId, userId: u.id, tier: u.tier, codenaam: u.codename });
  if (r.error) return res.status(r.status || 400).json({ error: r.error });
  res.json({ ok: true, gezinNaam: r.gezinNaam, profielNaam: r.profielNaam, tierNaam: r.tierNaam });
});

app.post('/api/rtf/ontkoppel', auth, (req, res) => {
  if (!eisAccount(req, res)) return;
  rtf.unlinkGast({ userId: req.session.account.id, code: req.body.code, profielId: req.body.profielId });
  res.json({ ok: true });
});

app.post('/api/rtf/meldingen/gelezen', auth, (req, res) => {
  if (!eisAccount(req, res)) return;
  const md = accounts.getMemberState(req.session.account.id) || {};
  (md.foundationMeldingen || []).forEach(m => { m.gelezen = true; });
  accounts.saveMemberState(req.session.account.id, md);
  res.json({ ok: true });
});

app.post('/api/rtf/overzicht', auth, (req, res) => {
  if (!eisAccount(req, res)) return;
  res.json({ gezinnen: rtf.gastOverzicht(req.session.account.id) });
});

app.post('/api/rtf/kanaal', auth, (req, res) => {
  if (!eisAccount(req, res)) return;
  const info = rtf.kanaalInfo(req.session.account.id, req.body.code);
  if (!info) return res.status(403).json({ error: 'Je bent niet aan dit gezin gekoppeld.' });
  res.json(info);
});

app.post('/api/rtf/bericht', auth, (req, res) => {
  if (!eisAccount(req, res)) return;
  const r = rtf.berichtVanGast({ userId: req.session.account.id, code: req.body.code, tekst: req.body.tekst });
  if (r.error) return res.status(r.status || 400).json({ error: r.error });
  res.json({ ok: true });
});

app.post('/api/pay', auth, async (req, res) => {
  if (req.session.tier === 'guest') return res.status(403).json({ error: 'Alleen voor leden.' });
  const zPay = db.data.techniek && db.data.techniek.zekeringen && db.data.techniek.zekeringen.betalingen;
  if (zPay && zPay.aan === false) return res.status(503).json({ error: 'Betalen is tijdelijk uitgeschakeld.' });
  // Echte accounts betalen hun eigen facturen; demo-sessies de gedeelde demo.
  const own = !!req.session.account;
  const md = own ? (accounts.getMemberState(req.session.account.id) || memberTemplate()) : db.data;
  const invoices = md.invoices || [];
  let targets;
  if (req.body.all) {
    targets = invoices.filter(i => i.status === 'open');
    if (!targets.length) return res.status(409).json({ error: 'Er staat niets open.' });
  } else {
    const inv = invoices.find(i => i.id === req.body.invoiceId);
    if (!inv) return res.status(404).json({ error: 'Factuur niet gevonden.' });
    if (inv.status === 'paid') return res.status(409).json({ error: 'Deze factuur is al betaald.' });
    targets = [inv];
  }
  // De afschrijving loopt via de betaalprovider met een idempotentiesleutel per
  // factuur: twee keer op "betaal" tikken of een netwerk-herhaling schrijft nooit
  // dubbel af. In demo-stand bevestigt de provider direct ('betaald'); met een
  // echte Stripe-sleutel komt de definitieve bevestiging via de webhook, en
  // markeren we hier nog niets als betaald.
  const wie = own ? ('acc:' + req.session.account.id) : ('sess:' + req.session.tier);
  let foundation = 0, provider = betaal.AANBIEDER, intents = [];
  for (const inv of targets) {
    let uitslag;
    try {
      uitslag = await betaal.maakBetaling({
        bedrag: Math.max(1, Math.round((inv.bijdrage || 0) * 100)), // euro's -> centen
        valuta: 'eur', referentie: String(inv.id),
        idempotentieSleutel: wie + ':inv:' + inv.id,
        omschrijving: 'RTG factuur ' + inv.id
      });
    } catch (e) { return res.status(502).json({ error: 'Betaling kon niet worden gestart.' }); }
    const bevestigd = uitslag.status === 'betaald' || uitslag.status === 'succeeded';
    if (bevestigd) {
      inv.status = 'paid';
      inv.date = 'Zojuist betaald';
      inv.betaalId = uitslag.id;
      // Vaste 30%-afdracht aan de RTFoundation: bij elke bevestigde maandbetaling
      // splitsen we het foundation-deel meteen af en zetten het (zodra het IBAN
      // bekend is) als uitbetaling weg. Boekingen dragen niets af; alleen
      // abonnementen. fonds.boekAfdracht is idempotent per factuur.
      if (fonds.isAbonnement(inv.desc)) {
        foundation += fonds.aandeelEuro(inv.bijdrage);
        try { await fonds.boekAfdracht({ invoiceId: inv.id, wie, bijdrage: inv.bijdrage, betaalId: uitslag.id, omschrijving: inv.desc }); }
        catch (e) { /* afdracht mag de betaling nooit blokkeren; ledger vangt het later op */ }
      }
      for (const item of (md.trip ? md.trip.items : [])) {
        if (item.invoiceId === inv.id) { item.status = 'paid'; item.label = 'Bevestigd'; }
      }
    } else {
      // echte kaartbetaling: client rondt af met clientSecret, webhook bevestigt
      intents.push({ invoiceId: inv.id, clientSecret: uitslag.clientSecret, status: uitslag.status });
    }
  }
  if (own) accounts.saveMemberState(req.session.account.id, md);
  else save();
  // ander open scherm van hetzelfde lid meteen bijwerken
  broadcastSync([req.session.tier], 'payments');
  const antwoord = { ok: true, foundation, provider, state: stateFor(req.session, req.body.lang) };
  if (intents.length) { antwoord.pending = true; antwoord.intents = intents; } // wachten op kaartbevestiging
  res.json(antwoord);
});

/* Met munten betalen. RTG accepteert cryptomunten voor zijn eigen diensten en
   zet ze via een vergunninghoudende aanbieder meteen om naar euro's; RTG houdt
   zelf nooit crypto vast. Staat de acceptatie uit, dan is dit niet beschikbaar. */
app.post('/api/munt/opties', (req, res) => res.json(munten.opties()));

app.post('/api/munt/verzoek', auth, async (req, res) => {
  if (req.session.tier === 'guest') return res.status(403).json({ error: 'Alleen voor leden.' });
  if (!munten.aan()) return res.status(503).json({ error: 'Betalen met munten is niet beschikbaar.' });
  const own = !!req.session.account;
  const md = own ? (accounts.getMemberState(req.session.account.id) || memberTemplate()) : db.data;
  const inv = (md.invoices || []).find(i => i.id === req.body.invoiceId);
  if (!inv) return res.status(404).json({ error: 'Factuur niet gevonden.' });
  if (inv.status === 'paid') return res.status(409).json({ error: 'Deze factuur is al betaald.' });
  const euroCenten = Math.max(1, Math.round((inv.bijdrage || 0) * 100));
  const wie = own ? ('acc:' + req.session.account.id) : ('sess:' + req.session.tier);
  try {
    const verzoek = await munten.maakVerzoek({
      euroCenten, munt: req.body.munt, referentie: String(inv.id),
      idempotentieSleutel: wie + ':muntinv:' + inv.id + ':' + String(req.body.munt || '').toLowerCase(),
      context: { soort: 'factuur', wie, invoiceId: inv.id, own, accountId: own ? req.session.account.id : null }
    });
    res.json({ ok: true, verzoek });
  } catch (e) { res.status(400).json({ error: e.message || 'Kon geen munt-adres maken.' }); }
});

/* Rechtstreeks een partner betalen met munten. Zelfde afhandeling als een gewone
   directe betaling, maar het geld komt via de munt-aanbieder binnen (omgezet naar
   euro); de webhook crediteert dan de leverancier. */
app.post('/api/munt/direct', auth, async (req, res) => {
  if (req.session.tier === 'guest') return res.status(403).json({ error: 'Alleen voor leden.' });
  if (!munten.aan()) return res.status(503).json({ error: 'Betalen met munten is niet beschikbaar.' });
  const s = findSupplier(req.body.supplierCode);
  if (!s) return res.status(404).json({ error: 'Leverancier niet gevonden.' });
  const euroCenten = Math.round(Number(req.body.bedrag) * 100);
  if (!(euroCenten >= 50)) return res.status(400).json({ error: 'Kies een bedrag van minstens € 0,50.' });
  const key = req.session.key;
  const codename = liveCodename(req.session);
  try {
    const verzoek = await munten.maakVerzoek({
      euroCenten, munt: req.body.munt, referentie: 'DP-' + s.code,
      idempotentieSleutel: key + ':muntdirect:' + s.code + ':' + euroCenten + ':' + String(req.body.munt || '').toLowerCase() + ':' + Date.now(),
      context: { soort: 'direct', key, codename, supplierCode: s.code, omschrijving: String(req.body.omschrijving || '').slice(0, 120) }
    });
    res.json({ ok: true, verzoek, supplier: { code: s.code, name: s.name } });
  } catch (e) { res.status(400).json({ error: e.message || 'Kon geen munt-adres maken.' }); }
});

/* Facturen downloaden. Elk lid kan zijn eigen factuur als PDF ophalen, en een
   jaaroverzicht van alle facturen. Zelf gebouwd, zonder externe pakketten. */
function ledenInvoices(req) {
  const own = !!req.session.account;
  const md = own ? (accounts.getMemberState(req.session.account.id) || memberTemplate()) : db.data;
  return md.invoices || [];
}

app.post('/api/factuur', auth, (req, res) => {
  if (req.session.tier === 'guest') return res.status(403).json({ error: 'Alleen voor leden.' });
  const inv = ledenInvoices(req).find(i => i.id === req.body.invoiceId);
  if (!inv) return res.status(404).json({ error: 'Factuur niet gevonden.' });
  const who = { codename: liveCodename(req.session), tier: req.session.tier };
  const pdf = factuur.ledenFactuur(inv, who);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'attachment; filename="RTG-factuur-' + String(inv.id).replace(/[^\w.-]/g, '') + '.pdf"');
  res.send(pdf);
});

app.post('/api/facturen/overzicht', auth, (req, res) => {
  if (req.session.tier === 'guest') return res.status(403).json({ error: 'Alleen voor leden.' });
  const jaar = String(req.body.jaar || '').match(/\d{4}/) ? req.body.jaar : null;
  const alle = ledenInvoices(req).filter(i => !jaar || String(i.date || '').includes(jaar));
  const who = { codename: liveCodename(req.session), tier: req.session.tier };
  const pasNaam = { rtg: 'RTG Pass', lifestyle: 'Lifestyle Pass', business: 'Business Pass' }[who.tier] || 'RTG';
  let betaald = 0, open = 0, naarFonds = 0;
  const rijen = [];
  for (const i of alle) {
    const tot = (i.netto || 0) + (i.bijdrage || 0);
    if (i.status === 'paid') betaald += tot; else open += tot;
    if (factuur.isContrib(i.desc)) naarFonds += Math.round((i.bijdrage || 0) / 1.21 * 0.3 * 100) / 100;
    rijen.push({ label: (i.id || '') + '  ' + (i.desc || ''), waarde: factuur.euroTekst(tot) + '  ' + (i.status === 'paid' ? '(betaald)' : '(open)') });
  }
  rijen.push({ label: 'Totaal betaald', waarde: factuur.euroTekst(betaald), bold: true, streep: true });
  rijen.push({ label: 'Totaal openstaand', waarde: factuur.euroTekst(open), bold: true });
  rijen.push({ label: 'Bijgedragen aan de RTFoundation', waarde: factuur.euroTekst(naarFonds), bold: true });
  const pdf = factuur.overzichtPdf(
    { titel: 'Factuuroverzicht' + (jaar ? ' ' + jaar : ''), periode: jaar || '', opnaam: who.codename + '  .  ' + pasNaam },
    rijen);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'attachment; filename="RTG-factuuroverzicht' + (jaar ? '-' + jaar : '') + '.pdf"');
  res.send(pdf);
});

app.post('/api/like', auth, (req, res) => {
  const post = db.data.posts.find(p => p.id === Number(req.body.postId));
  if (!post) return res.status(404).json({ error: 'Post niet gevonden.' });
  // Gratis gebruikers (zonder pas) bekijken de Salon, maar liken en reageren niet
  // bij particulieren. Berichten van partners mogen ze wel waarderen.
  if (req.session.tier === 'guest' && !post.partner)
    return res.status(403).json({ error: 'Zonder pas bekijk je de Salon, maar liken en reageren bij leden is voor leden. Solliciteren en betalen bij partners kan wel.' });
  if (req.body.liked) post.likedBy[req.session.key] = true;
  else delete post.likedBy[req.session.key];
  save();
  const likes = post.baseLikes + Object.keys(post.likedBy).length;
  // alle open Salon-schermen de nieuwe like-telling laten zien
  broadcastSync(['rtg', 'lifestyle', 'business'], 'salon');
  // de eigenaar van de post een notificatie geven (niet bij eigen like)
  const ownerTier = AUTHOR_TIER[post.author];
  if (req.body.liked && ownerTier && ownerTier !== req.session.tier) {
    notify(ownerTier, { icon: '♥', title: 'Nieuwe like', body: PERSONAS[req.session.tier].full + ' vindt uw post over ' + post.place + ' mooi.', scope: 'salon' });
  }
  res.json({ ok: true, likes });
});

app.post('/api/comment', auth, (req, res) => {
  const post = db.data.posts.find(p => p.id === Number(req.body.postId));
  if (!post) return res.status(404).json({ error: 'Post niet gevonden.' });
  if (!canEngage(req.session, post)) {
    return res.status(403).json({ error: engageError(req.session.tier) });
  }
  const text = String(req.body.text || '').trim().slice(0, 500);
  if (!text) return res.status(400).json({ error: 'Lege reactie.' });
  // Echte leden verschijnen in De Salon onder hun codenaam, nooit hun echte naam.
  const who = req.session.account ? req.session.account.codename : PERSONAS[req.session.tier].full;
  const clang = talen.taalVan(req.body.lang);
  const comment = { who, tier: req.session.tier, text, lang: clang };
  post.comments.push(comment);
  registerContact(req.session, post);
  save();
  // alle Salon-schermen tonen de nieuwe reactie live
  broadcastSync(['rtg', 'lifestyle', 'business'], 'salon');
  // de eigenaar van de post krijgt een notificatie (niet bij eigen reactie)
  const ownerTier = AUTHOR_TIER[post.author];
  if (ownerTier && ownerTier !== req.session.tier) {
    notify(ownerTier, { icon: '💬', title: 'Nieuwe reactie', body: who + ': “' + text.slice(0, 80) + '”', scope: 'salon' });
  }
  res.json({ ok: true, comment });
});

app.post('/api/dm', auth, (req, res) => {
  const post = db.data.posts.find(p => p.id === Number(req.body.postId));
  if (!post) return res.status(404).json({ error: 'Post niet gevonden.' });
  if (!canEngage(req.session, post)) {
    return res.status(403).json({ error: engageError(req.session.tier) });
  }
  const text = String(req.body.text || '').trim().slice(0, 1000);
  if (!text) return res.status(400).json({ error: 'Leeg bericht.' });
  registerContact(req.session, post);
  const fromName = req.session.account ? req.session.account.codename : PERSONAS[req.session.tier].full;
  db.data.dms.push({
    from: fromName,
    fromTier: req.session.tier,
    to: post.author,
    text,
    lang: talen.taalVan(req.body.lang),
    at: new Date().toISOString()
  });
  save();
  // de ontvanger krijgt een notificatie/push van het privébericht
  const ownerTier = AUTHOR_TIER[post.author];
  if (ownerTier && ownerTier !== req.session.tier) {
    notify(ownerTier, { icon: '✉', title: 'Nieuw bericht in De Salon', body: fromName + ' stuurde u een bericht.', scope: 'salon' });
  }
  res.json({ ok: true });
});

app.post('/api/partnertrips', (req, res) => {
  let staffRate = null;
  if (req.body.staffCode) {
    const p = findStaffPartner(req.body.staffCode);
    if (p) staffRate = p.staff.serviceRate;
  }
  res.json({ trips: db.data.partnerTrips.map(t => publicTrip(t, staffRate, req.body.lang)) });
});

app.post('/api/book', (req, res) => {
  const trip = db.data.partnerTrips.find(t => t.id === req.body.tripId);
  if (!trip) return res.status(404).json({ error: 'Reis niet gevonden.' });

  let partner = null;
  let rate = db.data.partnerService;
  let channel = 'klant';
  if (req.body.staffCode) {
    partner = findStaffPartner(req.body.staffCode);
    if (!partner) return res.status(404).json({ error: 'Deze personeelscode kennen we niet.' });
    rate = partner.staff.serviceRate;
    channel = 'personeel';
  } else if (req.body.code) {
    partner = findPartner(req.body.code);
    if (!partner) return res.status(404).json({ error: 'Deze partnercode kennen we niet.' });
  }

  const name = String(req.body.name || '').trim().slice(0, 120);
  const email = String(req.body.email || '').trim().slice(0, 200);
  if (!name || !email.includes('@')) return res.status(400).json({ error: 'Vul een naam en geldig e-mailadres in.' });

  // Interne administratie: verdeling wordt opgeslagen, nooit meegestuurd.
  // RTG verdient niets aan een boeking; een eventuele service gaat volledig
  // naar de partner. rtgCut is per definitie 0 (inkomsten komen uit abonnementen).
  const service = Math.round(trip.netto * rate);
  const total = trip.netto + service;
  const partnerCut = service;
  const ref = 'RTG-B-' + crypto.randomBytes(3).toString('hex').toUpperCase();
  db.data.bookings.push({
    ref, tripId: trip.id, channel, name, email,
    partnerCode: partner ? partner.code : null,
    netto: trip.netto, service, total, partnerCut, rtgCut: 0,
    at: new Date().toISOString()
  });
  save();
  res.json({ ok: true, ref, trip: { title: trip.title, dest: trip.dest }, partner: partner ? partner.name : null, total });
});

app.post('/api/salon/volg', auth, (req, res) => {
  if (req.session.tier === 'guest') return res.status(403).json({ error: 'Alleen voor leden.' });
  const s = findSupplier(req.body.code);
  if (!s) return res.status(404).json({ error: 'Partner niet gevonden.' });
  s.salon = s.salon || { bio: '', volgers: [], sinds: new Date().toISOString() };
  const i = s.salon.volgers.indexOf(req.session.key);
  if (i >= 0) s.salon.volgers.splice(i, 1);
  else { s.salon.volgers.push(req.session.key); openLijn(s, req); }
  save();
  broadcastSync(['rtg', 'lifestyle', 'business'], 'salon');
  res.json({ ok: true, volgIk: i < 0, volgers: s.salon.volgers.length });
});

/* De publieke Salon-etalage van een partner: bio, foto's, folders, aanbiedingen
   en polls op een plek. Hier leeft de marketing/producten, los van de leden-app. */
app.post('/api/salon/profiel', auth, (req, res) => {
  const s = findSupplier(req.body.code);
  if (!s || !salonZichtbaar(s)) return res.status(404).json({ error: 'Partner niet gevonden.' });
  const key = req.session.key;
  openLijn(s, req); // vanaf nu geen vreemden meer: open lijn zodra je de Salon bekijkt
  const t = db.data.supplierTypes[s.type] || {};
  const eigen = db.data.posts.filter(p => p.partnerCode === s.code);
  const claimVan = p => (p.deal && (p.deal.claims || []).find(c => c.key === key)) || null;
  const items = eigen.map(p => ({
    id: p.id, at: p.at || null, text: p.text, photo: p.photo || null,
    soort: p.folder ? 'folder' : p.deal ? 'deal' : p.poll ? 'poll' : 'post',
    likes: p.baseLikes + Object.keys(p.likedBy || {}).length,
    folder: p.folder ? { titel: p.folder.titel, fotos: p.folder.fotos || [], items: p.folder.items || [] } : null,
    deal: p.deal ? { titel: p.deal.titel, geldigTot: p.deal.geldigTot || null, mijnCode: (claimVan(p) || {}).code || null } : null,
    poll: p.poll ? { vraag: p.poll.vraag, totaal: p.poll.opties.reduce((n, o) => n + o.stemmen.length, 0),
      opties: p.poll.opties.map(o => ({ tekst: o.tekst, stemmen: o.stemmen.length, mijn: o.stemmen.includes(key) })),
      gestemd: p.poll.opties.some(o => o.stemmen.includes(key)) } : null
  }));
  res.json({
    partner: {
      code: s.code, name: s.name, type: s.type, typeLabel: t.label, icon: t.icon, city: s.city,
      bio: (s.salon && s.salon.bio) || '', foto: (s.salon && s.salon.foto) || null,
      photos: (s.photos || []).slice(0, 8),
      volgers: (s.salon && s.salon.volgers.length) || 0, volgIk: !!(s.salon && s.salon.volgers.includes(key)),
      sinds: (s.salon && s.salon.sinds) || null,
      caps: t.caps || []
    },
    items
  });
});

app.post('/api/salon/deal/claim', auth, (req, res) => {
  if (req.session.tier === 'guest') return res.status(403).json({ error: 'Alleen voor leden.' });
  const p = db.data.posts.find(x => x.id === Number(req.body.postId));
  if (!p || !p.deal) return res.status(404).json({ error: 'Aanbieding niet gevonden.' });
  if (p.deal.geldigTot && p.deal.geldigTot < new Date().toISOString().slice(0, 10))
    return res.status(410).json({ error: 'Deze aanbieding is verlopen.' });
  const al = p.deal.claims.find(c => c.key === req.session.key);
  if (al) return res.json({ ok: true, code: al.code, alGeclaimd: true });
  const codename = req.session.account ? req.session.account.codename : PERSONAS[req.session.tier].codename;
  const claim = { key: req.session.key, codename, code: 'RTG-D-' + crypto.randomBytes(3).toString('hex').toUpperCase(), at: new Date().toISOString(), used: false };
  p.deal.claims.push(claim);
  save();
  notifySupplier(p.partnerCode, { icon: '🎁', title: 'Aanbieding geclaimd', body: codename + ' claimde "' + p.deal.titel + '" (' + p.deal.claims.length + 'x totaal).' });
  res.json({ ok: true, code: claim.code });
});

app.post('/api/salon/poll/stem', auth, (req, res) => {
  if (req.session.tier === 'guest') return res.status(403).json({ error: 'Alleen voor leden.' });
  const p = db.data.posts.find(x => x.id === Number(req.body.postId));
  if (!p || !p.poll) return res.status(404).json({ error: 'Poll niet gevonden.' });
  if (p.poll.opties.some(o => o.stemmen.includes(req.session.key))) return res.status(409).json({ error: 'U heeft al gestemd.' });
  const i = Number(req.body.optie);
  if (!p.poll.opties[i]) return res.status(400).json({ error: 'Onbekende optie.' });
  p.poll.opties[i].stemmen.push(req.session.key);
  save();
  broadcastSync(['rtg', 'lifestyle', 'business'], 'salon');
  res.json({ ok: true });
});

app.post('/api/live/door', auth, (req, res) => {
  const L = db.data.live[req.session.key];
  if (!L || !L.active) return res.status(409).json({ error: 'U bent niet onderweg.' });
  const dest = L.destCode ? findSupplier(L.destCode) : null;
  if (!dest || !(dest.doors || []).length) return res.status(404).json({ error: 'Deze bestemming heeft geen digitale deuren.' });
  if (!optieAan(dest, 'deurenGast')) return res.status(409).json({ error: dest.name + ' heeft de digitale gastsleutel op dit moment uitstaan. Meld u bij de receptie.' });
  if (!L.arrived) return res.status(409).json({ error: 'De deur opent pas als u bent aangekomen.' });
  const door = dest.doors[0];
  unlockDoor(dest, door, L.codename);
  logActivity(dest.code, { name: L.codename }, 'gast opende "' + door.name + '" via de app');
  notifySupplier(dest.code, { icon: '🔓', title: 'Deur geopend', body: L.codename + ' heeft "' + door.name + '" geopend via de app.' });
  res.json({ ok: true, door: { name: door.name, relockSec: DOOR_RELOCK_MS / 1000 } });
});

/* De gast vraagt zelf om aandacht (roept de bediening) bij een zaak. Belandt als
   prioriteit op het scherm van het personeel (PDA) en de zaak-backoffice, zodat
   niemand ooit hoeft te wachten of te zwaaien. Service op 5-sterrenniveau. */
app.post('/api/aandacht', auth, (req, res) => {
  if (req.session.tier === 'guest') return res.status(403).json({ error: 'Alleen voor leden.' });
  const s = findSupplier(req.body.supplierCode);
  if (!s) return res.status(404).json({ error: 'Zaak niet gevonden.' });
  const codename = req.session.account ? req.session.account.codename : PERSONAS[req.session.tier].codename;
  const a = db.data.aandacht = db.data.aandacht || {};
  const lijst = a[s.code] = a[s.code] || [];
  // niet spammen: een openstaand verzoek van dezelfde gast telt als één
  const bestaand = lijst.find(x => !x.klaar && x.key === req.session.key);
  const redenen = { rekening: 'Vraagt om de rekening', bestellen: 'Wil bestellen', hulp: 'Vraagt om hulp' };
  const reden = redenen[req.body.reden] || schoon(req.body.reden, 120) || 'Vraagt om aandacht';
  if (bestaand) { bestaand.reden = reden; bestaand.at = new Date().toISOString(); }
  else {
    lijst.unshift({ id: crypto.randomBytes(4).toString('hex'), key: req.session.key, codename,
      tafel: schoon(req.body.table, 24), reden, at: new Date().toISOString(), klaar: false });
    a[s.code] = lijst.slice(0, 300);
  }
  save();
  notifySupplier(s.code, { icon: '\u{1F514}', title: 'Gast vraagt aandacht' + (req.body.table ? ' · ' + schoon(req.body.table, 24) : ''), body: codename + ': ' + reden });
  sseToSupplier(s.code, 'sync', { scope: 'orders' });
  sseToOffice('sync', { scope: 'orders' });
  res.json({ ok: true });
});

app.post('/api/partner/chat/send', auth, (req, res) => {
  if (req.session.tier === 'guest') return res.status(403).json({ error: 'Alleen voor leden.' });
  const s = findSupplier(req.body.supplierCode);
  if (!s) return res.status(404).json({ error: 'Partner niet gevonden.' });
  if (!optieAan(s, 'gastchat')) return res.status(409).json({ error: s.name + ' heeft de gastchat op dit moment uitstaan.' });
  const text = String(req.body.text || '').trim().slice(0, 500);
  if (!text) return res.status(400).json({ error: 'Leeg bericht.' });
  const dept = validDept(s, String(req.body.dept || ''));
  const codename = req.session.account ? req.session.account.codename : PERSONAS[req.session.tier].codename;
  const chat = getChat(s, req.session.key, codename, req.session.tier, dept);
  chat.codename = codename;
  chat.messages.push({ from: 'guest', who: codename, text, lang: talen.taalVan(req.body.lang), at: new Date().toISOString() });
  chat.messages = chat.messages.slice(-120);
  chat.unreadPartner += 1;
  chat.lastAt = new Date().toISOString();
  save();
  notifySupplier(s.code, { icon: '💬', title: codename + ' → ' + dept, body: text.slice(0, 90) });
  sseToSupplier(s.code, 'sync', { scope: 'gchat' });
  sseToCustomer(req.session.key, 'sync', { scope: 'gchat' });
  trChat(chat.messages, talen.taalVan(req.body.lang)).then(messages => res.json({ ok: true, messages }));
});

app.post('/api/partner/chat/history', auth, (req, res) => {
  const s = findSupplier(req.body.supplierCode);
  if (!s) return res.status(404).json({ error: 'Partner niet gevonden.' });
  const dept = validDept(s, String(req.body.dept || ''));
  const chat = db.data.guestChats[chatKeyOf(s.code, req.session.key, dept)];
  if (chat && chat.unreadGuest) { chat.unreadGuest = 0; save(); }
  const to = talen.taalVan(req.body.lang);
  trChat(chat ? chat.messages : [], to).then(messages => res.json({ messages, dept }));
});

app.post('/api/member/apply/chats', auth, (req, res) => {
  // ook gratis gebruikers chatten met de werkgever over hun sollicitatie
  const uit = Object.values(db.data.applyChats)
    .filter(c => c.applicant.kind === 'rtg' && c.applicant.key === req.session.key)
    .map(c => { const l = c.berichten[c.berichten.length - 1]; return { id: c.id, bedrijf: c.bedrijf, func: c.func, laatste: l ? l.tekst : null, laatsteVan: l ? l.van : null, at: l ? l.at : c.at }; })
    .sort((x, y) => (y.at || '').localeCompare(x.at || ''));
  res.json({ chats: uit });
});

app.post('/api/member/apply/chat', auth, (req, res) => {
  const chat = db.data.applyChats[String(req.body.id || '')];
  if (!chat || chat.applicant.kind !== 'rtg' || chat.applicant.key !== req.session.key) return res.status(404).json({ error: 'Chat niet gevonden.' });
  applyChatVertaald(chat, talen.taalVan(req.body.lang)).then(c => res.json({ chat: c }));
});

app.post('/api/member/apply/chat/send', auth, (req, res) => {
  const chat = db.data.applyChats[String(req.body.id || '')];
  if (!chat || chat.applicant.kind !== 'rtg' || chat.applicant.key !== req.session.key) return res.status(404).json({ error: 'Chat niet gevonden.' });
  const m = chatStuur(chat, 'sollicitant', chat.applicant.naam, req.body.text, talen.taalVan(req.body.lang));
  if (!m) return res.status(400).json({ error: 'Typ een bericht.' });
  meldWerkgever(chat, m.tekst);
  applyChatVertaald(chat, talen.taalVan(req.body.lang)).then(c => res.json({ chat: c }));
});

app.post('/api/rtf/apply/chat', (req, res) => {
  const sess = rtf.verifieerProfiel(req.body.code, req.body.token);
  if (!sess) return res.status(403).json({ error: 'Log opnieuw in bij je gezin.' });
  const chat = db.data.applyChats[String(req.body.id || '')];
  if (!chat || chat.applicant.kind !== 'rtf' || chat.applicant.gezinCode !== String(req.body.code).toUpperCase() || chat.applicant.profielId !== sess.p.id)
    return res.status(404).json({ error: 'Chat niet gevonden.' });
  applyChatVertaald(chat, talen.taalVan(req.body.lang)).then(c => res.json({ chat: c }));
});

app.post('/api/rtf/apply/chat/send', (req, res) => {
  const sess = rtf.verifieerProfiel(req.body.code, req.body.token);
  if (!sess) return res.status(403).json({ error: 'Log opnieuw in bij je gezin.' });
  const chat = db.data.applyChats[String(req.body.id || '')];
  if (!chat || chat.applicant.kind !== 'rtf' || chat.applicant.gezinCode !== String(req.body.code).toUpperCase() || chat.applicant.profielId !== sess.p.id)
    return res.status(404).json({ error: 'Chat niet gevonden.' });
  const m = chatStuur(chat, 'sollicitant', chat.applicant.naam, req.body.text, talen.taalVan(req.body.lang));
  if (!m) return res.status(400).json({ error: 'Typ een bericht.' });
  meldWerkgever(chat, m.tekst);
  applyChatVertaald(chat, talen.taalVan(req.body.lang)).then(c => res.json({ chat: c }));
});

app.post('/api/rtf/vacatures', (req, res) => {
  const lft = parseInt(req.body && req.body.leeftijd, 10);
  const minOk = Number.isFinite(lft) ? lft : null;
  const land = req.body && typeof req.body.land === 'string' && LANDEN[req.body.land] ? req.body.land : null;
  const alle = openVacatures(minOk); // zonder landfilter, om de landenlijst te vullen
  const landen = [];
  for (const v of alle) if (!landen.some(l => l.code === v.land)) landen.push({ code: v.land, naam: v.landNaam });
  landen.sort((a, b) => a.naam.localeCompare(b.naam));
  const zichtbaar = land ? alle.filter(v => v.land === land) : alle;
  res.json({ vacatures: zichtbaar.slice(0, 100), landen, magSolliciteren: minOk == null || minOk >= 16 });
});

app.post('/api/rtf/solliciteer', (req, res) => {
  const b = req.body || {};
  const bucket = 'rtfsoll:' + req.ip;
  if (tooManyTries(res, bucket)) return;
  // gezin-token: het profiel moet kloppen en mag geen gast zijn (privezaak)
  const sess = rtf.verifieerProfiel(b.code, b.token);
  if (!sess) { noteFailedTry(bucket); return res.status(403).json({ error: 'Log opnieuw in bij je gezin om te solliciteren.' }); }
  if (sess.gast) return res.status(403).json({ error: 'Als oppas of familielid solliciteer je niet namens het gezin.' });
  const lft = parseInt(b.leeftijd, 10);
  if (!Number.isFinite(lft) || lft < 16)
    return res.status(403).json({ error: 'Solliciteren kan vanaf 16 jaar. Jongere gezinsleden vinden in de app juist leer- en groeitips.' });
  const s = findSupplier(b.supplierCode);
  if (!s) return res.status(404).json({ error: 'Bedrijf niet gevonden.' });
  const vac = (db.data.vacatures[s.code] || []).find(v => v.id === b.vacatureId && v.open);
  if (!vac) return res.status(404).json({ error: 'Deze vacature staat niet meer open.' });
  if (lft < vac.minLeeftijd)
    return res.status(403).json({ error: 'Voor deze vacature moet je minstens ' + vac.minLeeftijd + ' jaar zijn.' });
  if (rtf.alGesolliciteerd(b.code, sess.p.id, vac.id))
    return res.status(409).json({ error: 'Je hebt al op deze vacature gesolliciteerd. Je ziet de status bij "Mijn sollicitaties".' });
  const cv = b.cv || {};
  const name = String(cv.name || '').trim().slice(0, 60);
  const contact = String(cv.contact || '').trim().slice(0, 80);
  const heeftInhoud = (Array.isArray(cv.experience) && cv.experience.length) || (Array.isArray(cv.skills) && cv.skills.length) || (cv.about || '').trim();
  if (!name || !contact || !heeftInhoud)
    return res.status(409).json({ error: 'Maak eerst je cv af in de RTF-app (naam, contact en werk of vaardigheden). Daarmee solliciteer je in een tik.', needCv: true });
  const landCode = (s.settings && LANDEN[s.settings.land]) ? s.settings.land : 'NL';
  const entry = {
    id: crypto.randomBytes(4).toString('hex'),
    name, func: vac.func, contact,
    note: String(b.note || '').trim().slice(0, 400),
    viaRTF: true, rtf: { code: String(b.code).toUpperCase(), profielId: sess.p.id },
    cv: {
      headline: String(cv.headline || '').slice(0, 80),
      experience: (Array.isArray(cv.experience) ? cv.experience : []).slice(0, 12).map(x => String(x).slice(0, 120)),
      skills: (Array.isArray(cv.skills) ? cv.skills : []).slice(0, 15).map(x => String(x).slice(0, 40)),
      languages: (Array.isArray(cv.languages) ? cv.languages : []).slice(0, 8).map(x => String(x).slice(0, 30)),
      about: String(cv.about || '').slice(0, 400)
    },
    status: 'nieuw', at: new Date().toISOString()
  };
  const list = db.data.applications[s.code] = (db.data.applications[s.code] || []);
  list.unshift(entry);
  db.data.applications[s.code] = list.slice(0, 100);
  // verwijzing bij het gezin, voor "Mijn sollicitaties" met live status
  rtf.bewaarSollicitatie(b.code, sess.p.id, { appId: entry.id, supplierCode: s.code, vacatureId: vac.id, func: vac.func, bedrijf: s.name, land: landCode, landNaam: LANDEN[landCode].naam });
  save();
  // De melding aan het bedrijf is identiek aan die van een gewoon RTG-lid: de
  // foundation-herkomst blijft onzichtbaar voor de werkgever.
  notifySupplier(s.code, { icon: '📝', title: 'Sollicitatie via RTG', body: name + ' (RTG-lid) solliciteert als ' + vac.func + ', met cv.' });
  sseToSupplier(s.code, 'sync', { scope: 'team' });
  sseToOffice('sync', { scope: 'team' });
  res.json({ ok: true });
});

app.post('/api/privacy/export', auth, (req, res) => {
  if (req.session.tier === 'guest') return res.status(403).json({ error: 'Alleen voor leden.' });
  const key = req.session.key;
  const chats = {};
  for (const [k, msgs] of Object.entries(db.data.guestChats || {})) {
    if (k.split('|')[1] === key) chats[k] = msgs;
  }
  const likes = db.data.posts.filter(p => p.likedBy && p.likedBy[key]).map(p => ({ postId: p.id, author: p.author }));
  const state = stateFor(req.session, req.body.lang);
  res.json({
    exportedAt: new Date().toISOString(),
    note: 'Alle gegevens die RTG over u bewaart, onder uw codenaam (pseudonimisering).',
    profile: state.user,
    cv: db.data.cvs[key] || null,
    applications: myApplications(key),
    invoices: state.invoices || [],
    trip: state.trip || null,
    live: db.data.live[key] || null,
    orders: ordersVanKlant(key),
    guestChats: chats,
    likedPosts: likes,
    notifications: db.data.notifications[key] || []
  });
});

app.post('/api/privacy/delete', auth, (req, res) => {
  if (req.session.tier === 'guest') return res.status(403).json({ error: 'Alleen voor leden.' });
  const key = req.session.key;
  // cv en live-locatie weg, chats weg, likes weg
  delete db.data.cvs[key];
  delete db.data.live[key];
  for (const k of Object.keys(db.data.guestChats || {})) if (k.split('|')[1] === key) delete db.data.guestChats[k];
  for (const p of db.data.posts) if (p.likedBy) delete p.likedBy[key];
  // sollicitaties anonimiseren: het bedrijf houdt zijn administratie,
  // maar zonder iets dat naar deze persoon herleidbaar is
  for (const list of Object.values(db.data.applications || {})) {
    for (const a of list) if (a.key === key) {
      a.name = '(op verzoek verwijderd)'; a.contact = ''; a.note = '';
      a.cv = null; a.codename = null; a.key = null;
    }
  }
  // meldingen weg (bij demo-profielen is dit de gedeelde demo-bel)
  if (db.data.notifications[key]) db.data.notifications[key] = [];
  // echt account: verwijder het account zelf, inclusief documentupload
  if (req.session.account) {
    const doc = accounts.deleteUser(req.session.account.id);
    if (doc) { try { fs.unlinkSync(path.join(UPLOAD_DIR, path.basename(doc))); } catch (e) {} }
  }
  // alle sessies van dit lid uitloggen
  for (const [h, sess] of sessions) if (sess.key === key) forgetSession(h);
  save();
  broadcastSync(['rtg', 'lifestyle', 'business'], 'salon');
  res.json({ ok: true });
});

app.post('/api/event/rsvp', auth, (req, res) => {
  if (req.session.tier === 'guest') return res.status(403).json({ error: 'Alleen voor leden.' });
  const s = findSupplier(req.body.supplierCode);
  const e = s && (s.events || []).find(x => x.id === req.body.eventId && x.published);
  if (!e) return res.status(404).json({ error: 'Event niet gevonden.' });
  if (!optieAan(s, 'events')) return res.status(409).json({ error: s.name + ' neemt op dit moment geen event-aanmeldingen aan.' });
  const qty = Math.min(8, Math.max(1, parseInt(req.body.qty, 10) || 1));
  const taken = (e.guests || []).reduce((n, g) => n + g.qty, 0);
  if (e.guests.some(g => g.key === req.session.key)) return res.status(409).json({ error: 'U staat al op de gastenlijst.' });
  if (taken + qty > e.capacity) return res.status(409).json({ error: 'Dit event is vol.' });
  const codename = req.session.account ? req.session.account.codename : PERSONAS[req.session.tier].codename;
  e.guests.push({ key: req.session.key, codename, qty, at: new Date().toISOString(), checkedIn: false });
  save();
  notifySupplier(s.code, { icon: '\uD83C\uDF9F', title: 'Aanmelding voor ' + e.name, body: codename + ', ' + qty + ' pers.' });
  notify(req.session.tier, { icon: '\uD83C\uDF9F', title: s.name, body: 'U staat op de gastenlijst van ' + e.name + ' (' + e.date + (e.time ? ', ' + e.time : '') + '), ' + qty + ' pers. Uw codenaam is uw toegang.', scope: 'events' });
  sseToSupplier(s.code, 'sync', { scope: 'events' });
  sseToOffice('sync', { scope: 'events' });
  res.json({ ok: true, spotsLeft: Math.max(0, e.capacity - taken - qty) });
});

app.post('/api/partner/apply', (req, res) => {
  const b = req.body || {};
  /* De toegangseis: een partnerplek (en dus een bedrijfscode) is er alleen
     voor bedrijven waar minstens een persoon een Business Pass heeft. De
     aanvrager bewijst dat met zijn eigen ingelogde pas: zonder geldige
     Business Pass-sessie geen aanvraag, en dus geen code. */
  const passToken = String(b.passToken || (req.headers.authorization || '').replace(/^Bearer\s+/i, '') || '');
  const passSess = passToken ? sessionFor(passToken) : null;
  if (!passSess || passSess.tier !== 'business')
    return res.status(403).json({ error: 'Zonder Business Pass geen bedrijfscode: een partnerplek vraagt u aan met een actieve Business Pass. Log op dit apparaat in op de Business Pass-app en probeer het opnieuw.' });
  // schoon(): strip < en > uit vrije tekst. De bedrijfsnaam en plaats komen later
  // in andermans schermen (De Salon, backoffice), dus nooit als opmaak laten landen.
  const company = schoon(b.company, 80);
  const type = String(b.type || '').trim();
  const city = schoon(b.city, 60);
  const contactName = schoon(b.contactName, 60);
  const email = String(b.email || '').trim().toLowerCase().slice(0, 80);
  const phone = String(b.phone || '').trim().slice(0, 30);
  const note = schoon(b.note, 500);
  if (!db.data.supplierTypes[type]) return res.status(400).json({ error: 'Kies een geldig type bedrijf.' });
  if (!company || !city || !contactName) return res.status(400).json({ error: 'Vul de bedrijfsnaam, plaats en contactpersoon in.' });
  // juridisch vereist: uitdrukkelijk akkoord met de partnervoorwaarden,
  // inclusief de verwerkersafspraken en het verplichte Salon-account
  if (req.body.akkoord !== true) return res.status(400).json({ error: 'Ga akkoord met de partnervoorwaarden (inclusief de verwerkersafspraken) om een partnerplek aan te vragen.' });
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return res.status(400).json({ error: 'Vul een geldig e-mailadres in.' });
  if (db.data.partnerApplications.some(a => a.status === 'nieuw' && a.email === email && a.company.toLowerCase() === company.toLowerCase()))
    return res.status(409).json({ error: 'Deze aanvraag staat al open. We nemen contact met u op.' });
  const entry = {
    id: crypto.randomBytes(4).toString('hex'),
    company, type, city, contactName, email, phone, note,
    // vastlegging van het akkoord (bewijs): wat en wanneer
    akkoord: { partnervoorwaarden: true, verwerkersafspraken: true, at: new Date().toISOString() },
    // het Business Pass-bewijs: zonder dit keurt het kantoor niets goed
    businessPass: { key: passSess.key, at: new Date().toISOString() },
    status: 'nieuw', at: new Date().toISOString()
  };
  db.data.partnerApplications.unshift(entry);
  db.data.partnerApplications = db.data.partnerApplications.slice(0, 200);
  save();
  mail.send(email, 'Uw partner-aanvraag bij Rahul Travel Group',
    'Beste ' + contactName + ',\n\nWe hebben uw aanvraag voor ' + company + ' (' + city + ') ontvangen. ' +
    'We beoordelen elke partner persoonlijk en komen binnen twee werkdagen bij u terug.\n\nRahul Travel Group');
  sseToOffice('sync', { scope: 'team' });
  res.json({ ok: true });
});

/* De RTG-winkel: hardware en uitbreidingen voor partners, zoals de Zaakdoos.
   De prijzen staan hier vast (euro, ex btw) zodat een bestelling altijd de
   prijs vastlegt die gold op het moment van bestellen; de verkooppagina
   toont ze ook in de munt van de kijker, maar gefactureerd wordt in euro. */
const WINKEL = {
  zaakdoos:         { naam: 'RTG Zaakdoos',            eenmalig: 100, perMaand: 150, eenheid: 'per doos' },
  'slimme-deur':    { naam: 'RTG Slimme Deur',         eenmalig: 120, perMaand: 5,   eenheid: 'per deur' },
  'kamer-butler':   { naam: 'RTG Kamer-butler',        eenmalig: 180, perMaand: 5,   eenheid: 'per kamer' },
  toegangspoort:    { naam: 'RTG Toegangspoort',       eenmalig: 450, perMaand: 5,   eenheid: 'per zuil' },
  paniekknop:       { naam: 'RTG Paniekknop',          eenmalig: 60,  perMaand: 5,   eenheid: 'per knop' },
  'gast-piepers':   { naam: 'RTG Gast-piepers',        eenmalig: 250, perMaand: 5,   eenheid: 'per set van 10' },
  'rtg-pda':        { naam: 'RTG PDA',                 eenmalig: 220, perMaand: 5,   eenheid: 'per stuk' },
  'rit-tracker':    { naam: 'RTG Rit-tracker',         eenmalig: 80,  perMaand: 5,   eenheid: 'per voertuig' },
  veldsensor:       { naam: 'RTG Veldsensor-set',      eenmalig: 350, perMaand: 5,   eenheid: 'per set' },
  schermen:         { naam: 'RTG Keuken- en kassascherm', eenmalig: 300, perMaand: 5, eenheid: 'per scherm' },
  'satelliet-pakket': { naam: 'RTG Satelliet-startpakket', eenmalig: 900, perMaand: 150, eenheid: 'per locatie' }
};
// de prijstabel is de ene bron: de verkooppagina leest hem hiervandaan
app.get('/api/winkel/producten', (req, res) => res.json({ producten: WINKEL }));
app.post('/api/winkel/bestel', (req, res) => {
  const b = req.body || {};
  const product = WINKEL[String(b.product || '')];
  if (!product) return res.status(400).json({ error: 'Kies een geldig product.' });
  const company = schoon(b.company, 80);
  const contactName = schoon(b.contactName, 60);
  const email = String(b.email || '').trim().toLowerCase().slice(0, 80);
  const phone = String(b.phone || '').trim().slice(0, 30);
  const note = schoon(b.note, 500);
  const aantal = Math.min(100, Math.max(1, Math.round(Number(b.aantal) || 1))); // een hotel bestelt zo 40 deuren
  if (!company || !contactName) return res.status(400).json({ error: 'Vul de bedrijfsnaam en contactpersoon in.' });
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return res.status(400).json({ error: 'Vul een geldig e-mailadres in.' });
  if (b.akkoord !== true) return res.status(400).json({ error: 'Ga akkoord met de prijs en de voorwaarden om te bestellen.' });
  if (!Array.isArray(db.data.winkelBestellingen)) db.data.winkelBestellingen = [];
  if (db.data.winkelBestellingen.some(o => o.status === 'nieuw' && o.email === email && o.product === String(b.product)))
    return res.status(409).json({ error: 'Deze bestelling staat al open. We nemen contact met u op.' });
  const entry = {
    id: crypto.randomBytes(4).toString('hex'),
    product: String(b.product), productNaam: product.naam, aantal,
    // de prijs zoals die gold bij het bestellen: eenmalig + per maand, euro ex btw
    prijs: { eenmalig: product.eenmalig, perMaand: product.perMaand, valuta: 'EUR', exBtw: true },
    company, contactName, email, phone, note,
    akkoord: { prijs: true, at: new Date().toISOString() },
    status: 'nieuw', at: new Date().toISOString()
  };
  db.data.winkelBestellingen.unshift(entry);
  db.data.winkelBestellingen = db.data.winkelBestellingen.slice(0, 500);
  save();
  mail.send(email, 'Uw bestelling bij Rahul Travel Group: ' + product.naam,
    'Beste ' + contactName + ',\n\nBedankt voor uw bestelling: ' + aantal + 'x ' + product.naam + ' voor ' + company + '.\n' +
    'Prijs: EUR ' + (product.eenmalig * aantal) + ' eenmalig en daarna EUR ' + (product.perMaand * aantal) + ' per maand, exclusief btw; facturatie in euro.\n' +
    'We nemen binnen twee werkdagen contact op voor de levering en de aansluiting.\n\nRahul Travel Group');
  sseToOffice('sync', { scope: 'team' });
  res.json({ ok: true });
});

app.post('/api/cv/get', auth, (req, res) => {
  const cv = db.data.cvs[req.session.key] || null;
  res.json({ cv, ready: cvReady(cv) });
});

app.post('/api/cv/save', auth, (req, res) => {
  // ook gratis gebruikers maken een cv om te kunnen solliciteren
  const b = req.body || {};
  const cv = {
    name: String(b.name || '').trim().slice(0, 60),
    contact: String(b.contact || '').trim().slice(0, 80),
    headline: String(b.headline || '').trim().slice(0, 80),
    experience: String(b.experience || '').split('\n').map(x => x.trim()).filter(Boolean).slice(0, 12),
    skills: String(b.skills || '').split(',').map(x => x.trim()).filter(Boolean).slice(0, 15),
    languages: String(b.languages || '').split(',').map(x => x.trim()).filter(Boolean).slice(0, 8),
    about: String(b.about || '').trim().slice(0, 400),
    updatedAt: new Date().toISOString()
  };
  if (!cv.name || !cv.contact) return res.status(400).json({ error: 'Vul minimaal uw naam en contactgegevens in.' });
  db.data.cvs[req.session.key] = cv;
  save();
  res.json({ ok: true, cv, ready: cvReady(cv) });
});

app.post('/api/member/vacatures', auth, (req, res) => {
  // vacatures bekijken en solliciteren mag ook zonder pas
  const lft = leeftijdVan(geborenVan(req.session));
  const land = typeof req.body.land === 'string' && LANDEN[req.body.land] ? req.body.land : null;
  const alle = openVacatures(lft);
  const landen = [];
  for (const v of alle) if (!landen.some(l => l.code === v.land)) landen.push({ code: v.land, naam: v.landNaam });
  landen.sort((a, b) => a.naam.localeCompare(b.naam));
  const zichtbaar = land ? alle.filter(v => v.land === land) : alle;
  res.json({ vacatures: zichtbaar.slice(0, 100), landen, leeftijd: lft, magSolliciteren: lft == null || lft >= 16 });
});

app.post('/api/member/apply', auth, (req, res) => {
  // solliciteren mag ook zonder pas: het cv is de sleutel, niet de Pass
  const s = findSupplier(req.body.supplierCode);
  if (!s) return res.status(404).json({ error: 'Partner niet gevonden.' });
  const cv = db.data.cvs[req.session.key];
  if (!cvReady(cv)) return res.status(409).json({ error: 'Maak eerst uw cv af in de cv-builder; daarmee solliciteert u bij elke RTG-partner in een tik.', needCv: true });
  const list = db.data.applications[s.code] = (db.data.applications[s.code] || []);
  let func, vacatureId = null;
  if (req.body.vacatureId) {
    const vac = (db.data.vacatures[s.code] || []).find(v => v.id === req.body.vacatureId && v.open);
    if (!vac) return res.status(404).json({ error: 'Deze vacature staat niet meer open.' });
    const lft = leeftijdVan(geborenVan(req.session));
    if (lft != null && lft < vac.minLeeftijd)
      return res.status(403).json({ error: 'Voor deze vacature moet je minstens ' + vac.minLeeftijd + ' jaar zijn.' });
    if (list.some(a => a.key === req.session.key && a.vacatureId === vac.id))
      return res.status(409).json({ error: 'U hebt al op deze vacature gesolliciteerd. De status ziet u bij uw sollicitaties.' });
    func = vac.func; vacatureId = vac.id;
  } else {
    func = String(req.body.func || '').trim().slice(0, 40);
    if (!func) return res.status(400).json({ error: 'Kies een functie.' });
  }
  const codename = req.session.account ? req.session.account.codename : PERSONAS[req.session.tier].codename;
  const entry = {
    id: crypto.randomBytes(4).toString('hex'),
    name: cv.name, func, contact: cv.contact,
    note: String(req.body.note || '').trim().slice(0, 400),
    viaRTG: true, codename, key: req.session.key, vacatureId,
    cv: { headline: cv.headline, experience: cv.experience, skills: cv.skills, languages: cv.languages, about: cv.about },
    status: 'nieuw', at: new Date().toISOString()
  };
  list.unshift(entry);
  db.data.applications[s.code] = list.slice(0, 100);
  save();
  notifySupplier(s.code, { icon: '📝', title: 'Sollicitatie via RTG', body: cv.name + ' (RTG-lid) solliciteert als ' + func + ', met cv.' });
  sseToSupplier(s.code, 'sync', { scope: 'team' });
  sseToOffice('sync', { scope: 'team' });
  res.json({ ok: true });
});

app.post('/api/booking/request', auth, (req, res) => {
  if (req.session.tier === 'guest') return res.status(403).json({ error: 'Alleen voor leden.' });
  const s = findSupplier(req.body.supplierCode);
  const caps = s ? ((db.data.supplierTypes[s.type] || {}).caps || []) : [];
  if (!s || !caps.includes('services')) return res.status(404).json({ error: 'Geen zelfstandige professional gevonden.' });
  if (s.settings && s.settings.ordersOpen === false) return res.status(409).json({ error: s.name + ' neemt op dit moment geen boekingen aan.' });
  const dienst = (s.services || []).find(x => x.id === req.body.serviceId);
  if (!dienst) return res.status(404).json({ error: 'Deze dienst bestaat niet (meer).' });
  const codename = req.session.account ? req.session.account.codename : PERSONAS[req.session.tier].codename;
  // jeugdleden (15-17) betalen altijd vooraf, ook bij een achteraf-zaak
  const lftB = leeftijdVan(geborenVan(req.session));
  const vooraf = optieAan(s, 'betaalVooraf') || (lftB != null && lftB < 18);
  const d = schoon(req.body.date, 10), u = schoon(req.body.time, 5);
  const wanneer = /^\d{4}-\d{2}-\d{2}$/.test(d) ? d + (/^\d{2}:\d{2}$/.test(u) ? ' ' + u : '') : null;
  const boeking = {
    ref: 'RTG-B-' + crypto.randomBytes(3).toString('hex').toUpperCase(),
    supplierCode: s.code, supplierName: s.name,
    customerTier: req.session.tier, customerKey: req.session.key, customerCodename: codename,
    service: { id: dienst.id, name: dienst.name, soort: dienst.soort || 'dienst', duurMin: dienst.duurMin || null },
    price: dienst.price,
    wanneer, note: schoon(req.body.note, 140),
    zorg: zorgVoor(req.session.key),
    betaalMoment: vooraf ? 'vooraf' : 'achteraf',
    status: vooraf ? 'wacht-op-betaling' : 'aangevraagd',
    paid: false, at: new Date().toISOString()
  };
  boekingenVoegToe(boeking);
  save();
  if (!vooraf) {
    notifySupplier(s.code, { icon: '🗓️', title: 'Nieuwe boeking (betaling achteraf)', body: codename + ': ' + dienst.name + (wanneer ? ' · ' + wanneer : '') + ' · € ' + dienst.price });
    sseToSupplier(s.code, 'sync', { scope: 'orders' });
    sseToOffice('sync', { scope: 'orders' });
  }
  res.json({ ok: true, boeking });
});

app.post('/api/booking/pay', auth, (req, res) => {
  const r = betaalBoekingVoor(req.session, req.body);
  if (r.error) return res.status(r.status).json({ error: r.error });
  res.json(r);
});

app.post('/api/bookings/mine', auth, async (req, res) => {
  // zelfde vensterbeleid als /api/orders/mine: vers venster, grootboek-historie
  const key = req.session.key;
  const offset = Math.max(0, parseInt(req.body.offset, 10) || 0);
  const mijn = boekingenVanKlant(key);
  if (!txLedgerActief()) return res.json({ boekingen: mijn.slice(offset, offset + 25), total: mijn.length });
  const total = Math.max(mijn.length, await txLedgerTel('boekingen', key));
  const boekingen = offset < mijn.length ? mijn.slice(offset, offset + 25) : await txLedgerVanKlant('boekingen', key, 25, offset);
  res.json({ boekingen, total });
});

app.post('/api/giftcard/buy', auth, (req, res) => {
  if (req.session.tier === 'guest') return res.status(403).json({ error: 'Alleen voor leden.' });
  const s = findSupplier(req.body.supplierCode);
  if (!s) return res.status(404).json({ error: 'Partner niet gevonden.' });
  const bedrag = Math.round(Number(req.body.bedrag));
  if (!(bedrag >= 10 && bedrag <= 5000)) return res.status(400).json({ error: 'Kies een bedrag tussen € 10 en € 5.000.' });
  const codename = req.session.account ? req.session.account.codename : PERSONAS[req.session.tier].codename;
  const kaart = { code: gcCode(), supplierCode: s.code, supplierName: s.name, bedrag, saldo: bedrag,
    kocht: codename, customerKey: req.session.key, at: new Date().toISOString(), verzilveringen: [] };
  db.data.giftcards.unshift(kaart);
  db.data.giftcards = db.data.giftcards.slice(0, 20000);
  save();
  notifySupplier(s.code, { icon: '🎁', title: 'Cadeaukaart verkocht', body: codename + ' kocht via de app een cadeaukaart van € ' + bedrag + '.' });
  sseToSupplier(s.code, 'sync', { scope: 'pos' });
  res.json({ ok: true, kaart });
});

app.post('/api/giftcards/mine', auth, (req, res) => {
  res.json({ kaarten: (db.data.giftcards || []).filter(g => g.customerKey === req.session.key).slice(0, 20) });
});

app.post('/api/member/zzp', auth, (req, res) => {
  if (req.session.tier !== 'business') return res.status(403).json({ error: 'De zzp-belastingtool is onderdeel van de Business Pass.' });
  // dezelfde berekening als de belastingtool van elke zaak (kern/fiscaal.js)
  const out = require('../kern/fiscaal').zzpBerekening(req.body.land, req.body.winst,
    { urencriterium: req.body.urencriterium, starter: req.body.starter });
  if (out.error) return res.status(out.status || 400).json({ error: 'Vul uw verwachte jaarwinst in.' });
  res.json(out);
});

app.post('/api/member/accountant', auth, async (req, res) => {
  if (req.session.tier !== 'business') return res.status(403).json({ error: 'De AI-boekhouder is onderdeel van de Business Pass.' });
  const landCode = LANDEN[req.body.land] ? req.body.land : 'NL';
  const L = LANDEN[landCode];
  const vraag = String(req.body.question || '').trim().slice(0, 400);
  if (!vraag) return res.status(400).json({ error: 'Stel een vraag.' });
  const key = req.session.key;
  const horeca = ordersVanKlant(key).filter(o => o.paid).reduce((x, o) => x + o.total, 0);
  const vervoer = db.data.rides.filter(r => (r.customerKey || r.customerTier) === key && r.paid).reduce((x, r) => x + (r.quote || 0), 0);
  let answer = null;
  if (anthropic) {
    try {
      const msg = await anthropic.messages.create({
        model: 'claude-sonnet-5', max_tokens: 450,
        system: 'Je bent de AI-boekhouder van de RTG Business Pass. Het lid reist zakelijk; het gekozen land is ' + L.naam + '. ' +
          'Aftrekregels daar: horeca: ' + L.zakelijk.horeca + ' logies: ' + L.zakelijk.logies + ' vervoer: ' + L.zakelijk.vervoer + ' jet: ' + L.zakelijk.jet + ' ' +
          'Voor zelfstandigen geldt daar het regime ' + ZZP[landCode].regime + ': ' + ZZP[landCode].regels.join(' ') + ' Er is een zzp-rekentool in de app voor een indicatie van belasting en nettowinst. ' +
          'Uitgaven via RTG: horeca € ' + horeca + ', vervoer € ' + vervoer + '. Facturen staan boekhoudklaar in het portaal met afboekcode en btw-specificatie. ' +
          'Antwoord in het Nederlands, maximaal 120 woorden, praktisch. Sluit af met: dit is voorlichting, geen bindend fiscaal advies.',
        messages: [{ role: 'user', content: vraag }]
      });
      answer = msg.content[0].text;
    } catch (err) { answer = null; }
  }
  if (!answer) {
    const v = vraag.toLowerCase();
    if (/zzp|zelfstandig|eenmanszaak|freelan|kor\b|urencriterium|autonomo|micro-?entre|freiberuf/.test(v))
      answer = 'Voor zelfstandigen in ' + L.naam + ' (' + ZZP[landCode].regime + '): ' + ZZP[landCode].regels.join(' ') + ' Gebruik de zzp-rekentool hieronder voor een indicatie van uw belasting, nettowinst en hoeveel u maandelijks opzij zet.';
    else if (/hotel|overnacht|logies|slapen/.test(v)) answer = L.naam + ': ' + L.zakelijk.logies;
    else if (/taxi|vervoer|rit|jet|vlieg/.test(v)) answer = L.naam + ': ' + L.zakelijk.vervoer + ' ' + L.zakelijk.jet + ' Via RTG gaf u € ' + vervoer + ' uit aan vervoer.';
    else if (/eten|diner|restaurant|horeca|lunch|terugvorder|aftrek|btw/.test(v)) answer = L.naam + ': ' + L.zakelijk.horeca + ' Via RTG gaf u € ' + horeca + ' uit in de horeca. Uw facturen staan boekhoudklaar in het portaal, met afboekcode en btw-specificatie.';
    else answer = 'Voor ' + L.naam + ' geldt: ' + L.zakelijk.horeca + ' ' + L.zakelijk.logies + ' ' + L.zakelijk.vervoer + ' Vraag me gerust naar een specifieke uitgave.';
    answer += ' Dit is voorlichting, geen bindend fiscaal advies.';
  }
  res.json({ answer, land: landCode, landen: Object.entries(LANDEN).map(([k, v2]) => ({ code: k, naam: v2.naam })), ai: !!anthropic });
});

app.post('/api/suppliers', auth, (req, res) => {
  if (req.session.tier === 'guest') return res.status(403).json({ error: 'Alleen voor leden.' });
  const city = req.body.city;
  // De Salon is verplicht: partners zonder compleet Salon-profiel tonen we niet
  const list = db.data.suppliers.filter(s => (!city || s.city === city) && salonZichtbaar(s))
    .map(s => ({ ...publicSupplier(s, req.body.lang), favoriet: isFavoriet(req.session.key, s.code) }));
  res.json({ suppliers: list, city: db.data.trip.dest });
});





app.post('/api/order', auth, (req, res) => {
  const r = plaatsOrderVoor(req.session, req.body);
  if (r.error) return res.status(r.status).json({ error: r.error });
  res.json(r);
});
app.post('/api/order/pay', auth, (req, res) => {
  const r = betaalOrderVoor(req.session, req.body);
  if (r.error) return res.status(r.status).json({ error: r.error });
  res.json(r);
});

app.post('/api/orders/mine', auth, async (req, res) => {
  // Schaalvast: de eerste pagina komt vers uit het RAM-venster; is het
  // grootboek actief, dan komen diepere pagina's (historie die uit het venster
  // is gerold) en het eerlijke totaal uit de geindexeerde grootboek-rijen.
  const key = req.session.key;
  const offset = Math.max(0, parseInt(req.body.offset, 10) || 0);
  const mijn = ordersVanKlant(key);
  if (!txLedgerActief()) return res.json({ orders: mijn.slice(offset, offset + 25), total: mijn.length });
  const total = Math.max(mijn.length, await txLedgerTel('orders', key));
  const orders = offset < mijn.length ? mijn.slice(offset, offset + 25) : await txLedgerVanKlant('orders', key, 25, offset);
  res.json({ orders, total });
});

app.post('/api/live/start', auth, (req, res) => {
  if (req.session.tier === 'guest') return res.status(403).json({ error: 'Alleen voor leden.' });
  const key = req.session.key;
  const destCode = req.body.destCode ? String(req.body.destCode).trim().toUpperCase() : null;
  const dest = destCode ? findSupplier(destCode) : null;
  const mode = ['walking', 'driving', 'flying'].includes(req.body.mode) ? req.body.mode : 'driving';
  // Startpositie: meegegeven, anders het hotel op de bestemming, anders vlakbij de bestemming.
  let start = (Number.isFinite(+req.body.lat) && Number.isFinite(+req.body.lng)) ? { lat: +req.body.lat, lng: +req.body.lng } : null;
  if (!start) { const hotel = db.data.suppliers.find(s => s.type === 'hotel' && s.city === db.data.trip.dest); if (hotel && hotel.loc) start = { lat: hotel.loc.lat, lng: hotel.loc.lng }; }
  if (!start && dest && dest.loc) start = { lat: dest.loc.lat + 0.012, lng: dest.loc.lng - 0.014 };
  db.data.live[key] = {
    key, tier: req.session.tier, codename: liveCodename(req.session),
    active: true, mode, destCode,
    lat: start ? start.lat : null, lng: start ? start.lng : null,
    updatedAt: new Date().toISOString(), startedAt: new Date().toISOString(), arrived: false
  };
  save();
  if (dest) notifySupplier(dest.code, { icon: '📍', title: 'Gast onderweg', body: db.data.live[key].codename + ' is naar u onderweg.' });
  pushLive(key);
  res.json({ ok: true, live: liveStateFor(key, req.body.lang) });
});

app.post('/api/live/update', auth, (req, res) => {
  const key = req.session.key;
  const L = db.data.live[key];
  if (!L || !L.active) return res.status(409).json({ error: 'U bent niet onderweg.' });
  const lat = Number(req.body.lat), lng = Number(req.body.lng);
  if (Number.isFinite(lat) && Number.isFinite(lng)) { L.lat = lat; L.lng = lng; L.updatedAt = new Date().toISOString(); }
  // automatische aankomst binnen ~150 m van de bestemming
  const dest = L.destCode ? findSupplier(L.destCode) : null;
  let aangekomen = false;
  if (dest && dest.loc && !L.arrived) {
    const d = haversine({ lat: L.lat, lng: L.lng }, dest.loc);
    if (d != null && d < 150) {
      L.arrived = true; aangekomen = true;
      notifySupplier(dest.code, { icon: '🎉', title: 'Gast gearriveerd', body: L.codename + ' is bij u aangekomen.' });
      notify(L.tier, { icon: '📍', title: 'Aangekomen', body: 'U bent bij ' + dest.name + '.', scope: 'live' });
    }
  }
  // De live locatie is vluchtig en komt vele keren per minuut per lid binnen; een
  // durende opslag PER ping zou de datastore overbelasten (elke save serialiseert
  // de hele kast). We sturen de positie altijd live via SSE door, maar bewaren
  // hooguit eens per 3 s per lid, en meteen bij een echte statuswijziging (aankomst).
  const nu = Date.now();
  if (aangekomen || nu - (liveSaveAt.get(key) || 0) > 3000) { liveSaveAt.set(key, nu); save(); }
  pushLive(key);
  res.json({ ok: true, live: liveStateFor(key, req.body.lang) });
});

app.post('/api/live/stop', auth, (req, res) => {
  const key = req.session.key;
  const L = db.data.live[key];
  if (L) { L.active = false; save(); pushLive(key); }
  res.json({ ok: true, live: liveStateFor(key, req.body.lang) });
});

// De persoonlijke laag (zorgprofiel, locatie-delen, De Butler, Shared
// Assets) woont in een eigen module: routes/member/persoonlijk.js.
require('./member/persoonlijk')(kern);

app.post('/api/live/state', auth, (req, res) => {
  res.json({ live: liveStateFor(req.session.key, req.body.lang) });
});

app.post('/api/ride/request', auth, (req, res) => {
  const r = vraagRitVoor(req.session, req.body);
  if (r.error) return res.status(r.status).json({ error: r.error });
  res.json(r);
});

app.post('/api/ride/pay', auth, (req, res) => {
  const r = betaalRitVoor(req.session, req.body);
  if (r.error) return res.status(r.status).json({ error: r.error });
  res.json(r);
});

app.post('/api/ai', auth, async (req, res) => {
  if (req.session.tier === 'guest') {
    return res.status(403).json({ error: 'De persoonlijke AI is exclusief voor leden.' });
  }
  // Alleen role/content overnemen, geschiedenis begrensd op de laatste 12 beurten.
  const history = (Array.isArray(req.body.messages) ? req.body.messages : [])
    .filter(m => (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
    .map(m => ({ role: m.role, content: m.content.slice(0, 2000) }))
    .slice(-12);
  // De Claude API vereist dat het gesprek met een user-beurt begint; de
  // proactieve opener van de AI staat vooraan als assistant, knip die eraf.
  while (history.length && history[0].role !== 'user') history.shift();
  if (!history.length || history[history.length - 1].role !== 'user') {
    return res.status(400).json({ error: 'Geen vraag ontvangen.' });
  }

  if (anthropic) {
    try {
      const response = await anthropic.messages.create({
        model: 'claude-opus-4-8',
        max_tokens: 1024,
        system: aiSystemPrompt(req.session.tier),
        messages: history
      });
      const reply = response.content
        .filter(b => b.type === 'text')
        .map(b => b.text)
        .join('\n')
        .trim();
      return res.json({ reply: reply || 'Excuses, ik heb geen antwoord kunnen formuleren.', source: 'claude' });
    } catch (e) {
      console.error('Claude API-fout, val terug op demo-antwoord:', e.message);
    }
  }
  res.json({ reply: cannedAnswer(history[history.length - 1].content), source: 'demo' });
});

app.post('/api/chat/history', auth, (req, res) => {
  if (!req.session.account) return res.json({ messages: [], mode: 'butler', demo: true });
  // het lid leest alles (ook concierge-antwoorden) in de eigen taal
  trChat(convOf(req.session.account.id), talen.taalVan(req.body.lang)).then(messages => res.json({
    messages,
    mode: req.session.tier === 'rtg' ? 'butler' : 'concierge',
    phone: accounts.phoneOf(req.session.account)
  }));
});

app.post('/api/chat/send', auth, async (req, res) => {
  if (!req.session.account) return res.status(403).json({ error: 'Alleen voor accounts.' });
  const text = String(req.body.text || '').trim();
  if (!text) return res.status(400).json({ error: 'Leeg bericht.' });
  const taal = talen.taalVan(req.body.lang);
  await memberSays(req.session.account, text, 'app', taal);
  const messages = await trChat(convOf(req.session.account.id), taal);
  res.json({ ok: true, messages, mode: req.session.tier === 'rtg' ? 'butler' : 'concierge' });
});

// Rechtstreeks betalen, de bezorgdienst, tickets en transfers wonen in
// een eigen module: routes/member/kopen.js.
require('./member/kopen')(kern);

// Autoverhuur, charters, Salon-ontmoetingen en de autoshowroom wonen in
// een eigen module: routes/member/voertuigen.js.
require('./member/voertuigen')(kern);

// Mode-bezorging, groothandel, contracten en vastgoed wonen in een eigen
// module: routes/member/handel.js.
require('./member/handel')(kern);

// De winkel-laag (retail/mode-catalogus) en de paspoort/identiteits-routes
// wonen in een eigen module: routes/member/winkel.js.
require('./member/winkel')(kern);

};
