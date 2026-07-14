/* Domein "member" (aparte module op de gedeelde kern). Alleen de routes;
   de helpers blijven in de kern (server.js) en komen via het kern-object binnen. */
module.exports = (kern) => {
  const { AUTHOR_TIER, DOOR_RELOCK_MS, FISCAAL_PEILJAAR, LANDEN, PERSONAS, UPLOAD_DIR, ZZP, accounts, aiSystemPrompt, alcoholGrensVan, anthropic, app, applyChatPubliek, auth, betaal, broadcastSync, canEngage, cannedAnswer, centen, chatKeyOf, chatStuur, convOf, crypto, cvReady, db, eisAccount, engageError, findPartner, findStaffPartner, entreeCode, express, findSupplier, magBezorgen, ticketsVoorSlot, forgetSession, fs, gcCode, geborenVan, getChat, haversine, ledenPrijs, leeftijdVan, liveCodename, liveStateFor, logActivity, mail, meldWerkgever, memberSays, memberTemplate, myApplications, noteFailedTry, notify, notifySupplier, openVacatures, optieAan, path, pickupCode, publicPartner, publicSupplier, publicTrip, pushLive, registerContact, rtf, save, schoon, sessions, sseToCustomer, sseToOffice, sseToSupplier, stateFor, tooManyTries, trChat, unlockDoor, validDept,
    reserveerTafel, mijnReserveringen, annuleerReservering, annuleerItem, plaatsReview, reviewsVoor,
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
    zorgContact, fonds, munten, factuur,
    dpBetaalDirect, dpMijnBetalingen, dpVerzoekenVoor, dpBetaalVerzoek } = kern;
  // laatste durende opslag van de live locatie per lid (throttle tegen GPS-storm)
  const liveSaveAt = new Map();

  /* Zodra een lid echt in contact komt met een partner (boekt, bestelt, huurt,
     koopt, laat bezorgen of gaat de partner volgen) openen we automatisch een
     open chatlijn. Zo zijn ze nooit vreemden en kunnen ze vooraf elkaars Salon
     bekijken. Idempotent en stil voor gasten (die hebben geen ledenchat). */
  const openLijn = (s, req) => {
    if (!s || req.session.tier === 'guest') return;
    try { zorgContact(s, req.session.key, liveCodename(req.session), req.session.tier); } catch (e) {}
  };

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
  const clang = req.body.lang === 'en' ? 'en' : 'nl';
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
    lang: req.body.lang === 'en' ? 'en' : 'nl',
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
  chat.messages.push({ from: 'guest', who: codename, text, lang: req.body.lang === 'en' ? 'en' : 'nl', at: new Date().toISOString() });
  chat.messages = chat.messages.slice(-120);
  chat.unreadPartner += 1;
  chat.lastAt = new Date().toISOString();
  save();
  notifySupplier(s.code, { icon: '💬', title: codename + ' → ' + dept, body: text.slice(0, 90) });
  sseToSupplier(s.code, 'sync', { scope: 'gchat' });
  sseToCustomer(req.session.key, 'sync', { scope: 'gchat' });
  trChat(chat.messages, req.body.lang === 'en' ? 'en' : 'nl').then(messages => res.json({ ok: true, messages }));
});

app.post('/api/partner/chat/history', auth, (req, res) => {
  const s = findSupplier(req.body.supplierCode);
  if (!s) return res.status(404).json({ error: 'Partner niet gevonden.' });
  const dept = validDept(s, String(req.body.dept || ''));
  const chat = db.data.guestChats[chatKeyOf(s.code, req.session.key, dept)];
  if (chat && chat.unreadGuest) { chat.unreadGuest = 0; save(); }
  const to = req.body.lang === 'en' ? 'en' : 'nl';
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
  res.json({ chat: applyChatPubliek(chat) });
});

app.post('/api/member/apply/chat/send', auth, (req, res) => {
  const chat = db.data.applyChats[String(req.body.id || '')];
  if (!chat || chat.applicant.kind !== 'rtg' || chat.applicant.key !== req.session.key) return res.status(404).json({ error: 'Chat niet gevonden.' });
  const m = chatStuur(chat, 'sollicitant', chat.applicant.naam, req.body.text);
  if (!m) return res.status(400).json({ error: 'Typ een bericht.' });
  meldWerkgever(chat, m.tekst);
  res.json({ chat: applyChatPubliek(chat) });
});

app.post('/api/rtf/apply/chat', (req, res) => {
  const sess = rtf.verifieerProfiel(req.body.code, req.body.token);
  if (!sess) return res.status(403).json({ error: 'Log opnieuw in bij je gezin.' });
  const chat = db.data.applyChats[String(req.body.id || '')];
  if (!chat || chat.applicant.kind !== 'rtf' || chat.applicant.gezinCode !== String(req.body.code).toUpperCase() || chat.applicant.profielId !== sess.p.id)
    return res.status(404).json({ error: 'Chat niet gevonden.' });
  res.json({ chat: applyChatPubliek(chat) });
});

app.post('/api/rtf/apply/chat/send', (req, res) => {
  const sess = rtf.verifieerProfiel(req.body.code, req.body.token);
  if (!sess) return res.status(403).json({ error: 'Log opnieuw in bij je gezin.' });
  const chat = db.data.applyChats[String(req.body.id || '')];
  if (!chat || chat.applicant.kind !== 'rtf' || chat.applicant.gezinCode !== String(req.body.code).toUpperCase() || chat.applicant.profielId !== sess.p.id)
    return res.status(404).json({ error: 'Chat niet gevonden.' });
  const m = chatStuur(chat, 'sollicitant', chat.applicant.naam, req.body.text);
  if (!m) return res.status(400).json({ error: 'Typ een bericht.' });
  meldWerkgever(chat, m.tekst);
  res.json({ chat: applyChatPubliek(chat) });
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
    orders: db.data.orders.filter(o => (o.customerKey || o.customerTier) === key),
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
    betaalMoment: vooraf ? 'vooraf' : 'achteraf',
    status: vooraf ? 'wacht-op-betaling' : 'aangevraagd',
    paid: false, at: new Date().toISOString()
  };
  db.data.boekingen.unshift(boeking);
  db.data.boekingen = db.data.boekingen.slice(0, 50000);
  save();
  if (!vooraf) {
    notifySupplier(s.code, { icon: '🗓️', title: 'Nieuwe boeking (betaling achteraf)', body: codename + ': ' + dienst.name + (wanneer ? ' · ' + wanneer : '') + ' · € ' + dienst.price });
    sseToSupplier(s.code, 'sync', { scope: 'orders' });
    sseToOffice('sync', { scope: 'orders' });
  }
  res.json({ ok: true, boeking });
});

app.post('/api/booking/pay', auth, (req, res) => {
  const b = db.data.boekingen.find(x => x.ref === req.body.ref && (x.customerKey || x.customerTier) === req.session.key);
  if (!b) return res.status(404).json({ error: 'Boeking niet gevonden.' });
  if (b.paid) return res.status(409).json({ error: 'Al betaald.' });
  if (b.status === 'wacht-op-betaling' && Date.now() - new Date(b.at) > 30 * 60000)
    return res.status(410).json({ error: 'Deze aanvraag is verlopen. Boek opnieuw.' });
  // punten-tegoed (RTG legt bij) en spaarpunten
  const kortingB = pasTegoedToe(req.session.key, b.price || 0);
  if (kortingB) b.puntenKorting = kortingB;
  b.paid = true;
  b.paidAt = new Date().toISOString();
  if (b.status === 'wacht-op-betaling') b.status = 'aangevraagd';
  verdienPunten(req.session.key, (b.price || 0) - kortingB, b.supplierName);
  openLijn(findSupplier(b.supplierCode), req);
  save();
  notifySupplier(b.supplierCode, { icon: '🗓️', title: 'Nieuwe boeking (betaald)', body: b.customerCodename + ': ' + b.service.name + (b.wanneer ? ' · ' + b.wanneer : '') + ' · € ' + b.price });
  sseToSupplier(b.supplierCode, 'sync', { scope: 'orders' });
  sseToOffice('sync', { scope: 'orders' });
  res.json({ ok: true, boeking: b });
});

app.post('/api/bookings/mine', auth, (req, res) => {
  const mijn = db.data.boekingen.filter(b => (b.customerKey || b.customerTier) === req.session.key);
  res.json({ boekingen: mijn.slice(0, 25), total: mijn.length });
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
  const landCode = ZZP[req.body.land] ? req.body.land : 'NL';
  const Z = ZZP[landCode];
  const winst = Math.max(0, Math.min(5000000, Math.round(Number(req.body.winst) || 0)));
  if (!winst) return res.status(400).json({ error: 'Vul uw verwachte jaarwinst in.' });
  const out = { land: landCode, landNaam: LANDEN[landCode].naam, regime: Z.regime, winst, posten: [], regels: Z.regels.slice(), indicatie: true, peiljaar: FISCAAL_PEILJAAR };
  let belasting = 0, belastbaar = winst;
  if (landCode === 'NL') {
    const uren = req.body.urencriterium !== false;
    const za = uren ? Math.min(Z.zelfstandigenaftrek, winst) : 0;
    const sa = uren && req.body.starter ? Z.startersaftrek : 0;
    const rest = Math.max(0, winst - za - sa);
    const mkb = centen(rest * Z.mkbVrijstelling);
    belastbaar = centen(rest - mkb);
    out.posten.push(za ? { label: 'Zelfstandigenaftrek', bedrag: -za }
                       : { label: 'Zelfstandigenaftrek (urencriterium niet gehaald)', bedrag: 0 });
    if (sa) out.posten.push({ label: 'Startersaftrek', bedrag: -sa });
    out.posten.push({ label: 'MKB-winstvrijstelling (12,7%)', bedrag: -mkb });
    let vorige = 0, ib = 0;
    for (const [grens, tarief] of Z.schijven) {
      const deel = Math.max(0, Math.min(belastbaar, grens) - vorige);
      ib += deel * tarief;
      vorige = grens;
      if (belastbaar <= grens) break;
    }
    const ahk = Math.max(0, Z.ahk.max - Math.max(0, belastbaar - Z.ahk.afbouwVanaf) * Z.ahk.afbouw);
    const ak = Math.max(0, Z.arbeidskorting.max - Math.max(0, belastbaar - Z.arbeidskorting.afbouwVanaf) * Z.arbeidskorting.afbouw);
    const korting = Math.min(ib, ahk + ak);
    belasting = Math.max(0, centen(ib - korting));
    out.posten.push({ label: 'Inkomstenbelasting (schijven)', bedrag: centen(ib) });
    out.posten.push({ label: 'Heffingskortingen (indicatie)', bedrag: -centen(korting) });
    if (winst < Z.korGrens) out.regels.unshift('Met deze omzet komt u waarschijnlijk in aanmerking voor de KOR (btw-vrijstelling): minder administratie, geen btw-aangifte.');
  } else {
    belasting = centen(winst * Z.simpel);
    out.posten.push({ label: 'Indicatieve heffing (~' + Math.round(Z.simpel * 100) + '% effectief, incl. sociale lasten)', bedrag: belasting });
  }
  out.belastbaar = centen(belastbaar);
  out.belasting = belasting;
  out.netto = centen(winst - belasting);
  out.reserveerPct = Math.max(20, Math.min(50, Math.round(belasting / winst * 100) + 5));
  out.perMaand = centen(belasting / 12);
  out.regels.push('Indicatieve berekening op basis van de tarieven van ' + FISCAAL_PEILJAAR + '; controleer jaarlijks en raadpleeg voor uw aangifte een fiscalist.');
  res.json(out);
});

app.post('/api/member/accountant', auth, async (req, res) => {
  if (req.session.tier !== 'business') return res.status(403).json({ error: 'De AI-boekhouder is onderdeel van de Business Pass.' });
  const landCode = LANDEN[req.body.land] ? req.body.land : 'NL';
  const L = LANDEN[landCode];
  const vraag = String(req.body.question || '').trim().slice(0, 400);
  if (!vraag) return res.status(400).json({ error: 'Stel een vraag.' });
  const key = req.session.key;
  const horeca = db.data.orders.filter(o => (o.customerKey || o.customerTier) === key && o.paid).reduce((x, o) => x + o.total, 0);
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
  // betalen bij partners mag ook zonder pas (gratis gebruiker)
  const s = findSupplier(req.body.supplierCode);
  if (!s) return res.status(404).json({ error: 'Leverancier niet gevonden.' });
  if (s.settings && s.settings.ordersOpen === false) return res.status(409).json({ error: s.name + ' neemt op dit moment geen bestellingen aan.' });
  const wanted = Array.isArray(req.body.items) ? req.body.items : [];
  const items = [];
  let total = 0;
  for (const w of wanted) {
    const m = (s.menu || []).find(x => x.id === w.id);
    const qty = Math.min(20, Math.max(1, parseInt(w.qty, 10) || 1));
    // ledenprijsgarantie: reken nooit meer dan de publieke prijs, ook al zou
    // de menuprijs door een fout hoger staan (extra vangnet na het opslaan)
    if (m) { const unit = ledenPrijs(m.publiekePrijs, m.price); items.push({ id: m.id, name: m.name, qty, price: unit }); total += unit * qty; }
  }
  if (!items.length) return res.status(400).json({ error: 'Geen geldige gerechten gekozen.' });
  const codename = req.session.account ? req.session.account.codename : PERSONAS[req.session.tier].codename;
  // leeftijd uit het paspoort: alcohol (bar-items) alleen boven de grens van
  // het land van de zaak; de partner ziet enkel dat de leeftijd geverifieerd is
  const lft = leeftijdVan(geborenVan(req.session));
  const metAlcohol = items.some(it => { const m = (s.menu || []).find(x => x.id === it.id); return m && m.station === 'bar'; });
  if (metAlcohol && lft != null) {
    const a = alcoholGrensVan(s);
    if (lft < a.grens) return res.status(403).json({ error: 'Alcohol is in ' + a.land + ' vanaf ' + a.grens + ' jaar; je leeftijd is via je paspoort geverifieerd. Kies iets zonder alcohol.' });
  }
  // de zaak kiest het betaalmoment: vooraf (standaard, pas zichtbaar na
  // afrekenen) of achteraf (direct zichtbaar, betalen via de app volgt);
  // jeugdleden (15-17) betalen altijd vooraf, ook bij een achteraf-zaak
  const vooraf = optieAan(s, 'betaalVooraf') || (lft != null && lft < 18);
  const order = {
    ref: 'RTG-O-' + crypto.randomBytes(3).toString('hex').toUpperCase(),
    pickup: pickupCode(),
    supplierCode: s.code, supplierName: s.name, type: s.type,
    customerTier: req.session.tier, customerKey: req.session.key, customerCodename: codename,
    items, total,
    table: schoon(req.body.table, 24),
    allergyNote: schoon(req.body.allergyNote, 200),
    tagSalon: !!req.body.tagSalon,
    betaalMoment: vooraf ? 'vooraf' : 'achteraf',
    leeftijdOk: metAlcohol && lft != null ? true : undefined,
    status: vooraf ? 'wacht-op-betaling' : 'nieuw', paid: false, at: new Date().toISOString()
  };
  db.data.orders.unshift(order);
  openLijn(s, req);
  save();
  if (!vooraf) {
    notifySupplier(s.code, { icon: '\u{1F6CE}️', title: 'Nieuwe bestelling (betaling achteraf)', body: codename + ', ' + items.reduce((n, i) => n + i.qty, 0) + ' item(s), € ' + total + (order.allergyNote ? ' · allergie: ' + order.allergyNote : '') });
    sseToSupplier(s.code, 'sync', { scope: 'orders' });
    sseToOffice('sync', { scope: 'orders' });
  }
  res.json({ ok: true, order });
});

app.post('/api/order/pay', auth, (req, res) => {
  const o = db.data.orders.find(x => x.ref === req.body.ref && (x.customerKey || x.customerTier) === req.session.key);
  if (!o) return res.status(404).json({ error: 'Bestelling niet gevonden.' });
  if (o.paid) return res.status(409).json({ error: 'Al betaald.' });
  // de verloopgrens geldt alleen voor vooraf betalen; achteraf mag later
  if (o.status === 'wacht-op-betaling' && Date.now() - new Date(o.at) > 30 * 60000) return res.status(410).json({ error: 'Deze bestelling is verlopen. Plaats hem opnieuw.' });
  // fooi (gaat naar het team), punten-tegoed (RTG legt bij) en spaarpunten
  const fooi = fooiUit(req.body, o.total);
  if (fooi) o.fooi = fooi;
  const korting = pasTegoedToe(req.session.key, o.total);
  if (korting) o.puntenKorting = korting;
  o.paid = true;
  o.paidAt = new Date().toISOString();
  if (o.status === 'wacht-op-betaling') o.status = 'nieuw';
  verdienPunten(req.session.key, o.total - korting, o.supplierName);
  save();
  // nu pas hoort de zaak ervan: betaald = definitief
  notifySupplier(o.supplierCode, { icon: '\u{1F6CE}\uFE0F', title: 'Nieuwe bestelling (betaald)', body: o.customerCodename + ', ' + o.items.reduce((n, i) => n + i.qty, 0) + ' item(s), \u20AC ' + o.total + (o.allergyNote ? ' \u00B7 allergie: ' + o.allergyNote : '') });
  sseToSupplier(o.supplierCode, 'sync', { scope: 'orders' });
  sseToOffice('sync', { scope: 'orders' });
  res.json({ ok: true, order: o });
});

app.post('/api/orders/mine', auth, (req, res) => {
  // schaalvast: de laatste 25 bestellingen plus het eerlijke totaal
  const mijn = db.data.orders.filter(o => (o.customerKey || o.customerTier) === req.session.key);
  res.json({ orders: mijn.slice(0, 25), total: mijn.length });
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

app.post('/api/live/state', auth, (req, res) => {
  res.json({ live: liveStateFor(req.session.key, req.body.lang) });
});

app.post('/api/ride/request', auth, (req, res) => {
  if (req.session.tier === 'guest') return res.status(403).json({ error: 'Alleen voor leden.' });
  const s = findSupplier(req.body.supplierCode);
  const caps = s ? ((db.data.supplierTypes[s.type] || {}).caps || []) : [];
  if (!s || !caps.includes('rides')) return res.status(404).json({ error: 'Geen vervoerspartner gevonden.' });
  // activiteitenzaken rijden alleen hun eigen transfers: die regel je via je ticket
  if (s.type === 'activiteit') return res.status(409).json({ error: 'De transfer van ' + s.name + ' regel je via je ticket (Ter plaatse, Mijn tickets).' });
  if (!optieAan(s, 'ritten')) return res.status(409).json({ error: s.name + ' neemt op dit moment geen ritaanvragen aan.' });
  // leeftijd uit het paspoort: privejets en helikopters boek je vanaf 18 jaar
  const lftR = leeftijdVan(geborenVan(req.session));
  if ((s.type === 'jet' || s.type === 'helikopter') && lftR != null && lftR < 18)
    return res.status(403).json({ error: (s.type === 'helikopter' ? 'Helikoptervluchten' : 'Privejets') + ' boek je vanaf 18 jaar. Een taxi regelen we graag voor je.' });
  const dest = req.body.toCode ? findSupplier(req.body.toCode) : null;
  const codename = liveCodename(req.session);
  // slimme offerte: afstand uit de live-locatie en de bestemming, anders een
  // realistisch stadsgemiddelde; prijs volgt het tarief van de vervoerder
  const pax = Math.min(9, Math.max(1, Number(req.body.passengers) || 1));
  const koffers = Math.min(9, Math.max(0, Number(req.body.luggage) || 0));
  const L = db.data.live[req.session.key];
  const van = (L && Number.isFinite(L.lat)) ? { lat: L.lat, lng: L.lng } : (s.loc || null);
  const naar = dest && dest.loc ? dest.loc : null;
  let km = s.type === 'jet' ? 350 : (s.type === 'helikopter' ? 60 : 9);
  const meters = haversine(van, naar);
  if (meters != null && meters > 200) km = Math.max(1, meters / 1000);
  const t = (s.settings && s.settings.tarief) || {};
  const quote = Math.round(Math.max(t.minimum || 0, (t.start || 0) + (t.perKm || 2.5) * km));
  const ride = {
    ref: 'RTG-R-' + crypto.randomBytes(3).toString('hex').toUpperCase(),
    supplierCode: s.code, supplierName: s.name, type: s.type,
    customerTier: req.session.tier, customerKey: req.session.key, customerCodename: codename,
    from: schoon(req.body.from || 'Huidige locatie', 80),
    to: schoon(req.body.to || (dest && dest.name) || '', 80),
    toCode: dest ? dest.code : null,
    when: schoon(req.body.when || 'Zo snel mogelijk', 40),
    // vooruit plannen: datum en tijd geven een geplande rit (taxi en jet)
    plannedFor: (() => {
      const d = schoon(req.body.date, 10), u = schoon(req.body.time, 5);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return null;
      const iso = d + 'T' + (/^\d{2}:\d{2}$/.test(u) ? u : '12:00') + ':00';
      return isNaN(new Date(iso)) ? null : iso;
    })(),
    passengers: pax, luggage: koffers, note: schoon(req.body.note, 140),
    km: Math.round(km * 10) / 10, quote,
    driver: null, vehicle: null,
    // de vervoerder kiest het betaalmoment: vooraf (standaard) of achteraf;
    // jeugdleden (15-17) betalen altijd vooraf
    betaalMoment: (optieAan(s, 'betaalVooraf') || (lftR != null && lftR < 18)) ? 'vooraf' : 'achteraf',
    status: (optieAan(s, 'betaalVooraf') || (lftR != null && lftR < 18)) && quote > 0 ? 'wacht-op-betaling' : 'aangevraagd',
    paid: quote === 0, at: new Date().toISOString()
  };
  if (ride.plannedFor) ride.when = 'Gepland: ' + ride.plannedFor.slice(0, 16).replace('T', ' ');
  db.data.rides.unshift(ride);
  save();
  if (ride.status === 'aangevraagd') {
    notifySupplier(s.code, { icon: '\u{1F697}', title: 'Nieuwe ritaanvraag', body: codename + ': ' + ride.from + ' naar ' + (ride.to || 'bestemming') + ' \u00B7 ' + pax + 'p \u00B7 \u20AC ' + quote });
    sseToSupplier(s.code, 'sync', { scope: 'orders' });
    sseToOffice('sync', { scope: 'orders' });
  }
  pushLive(req.session.key);
  res.json({ ok: true, ride });
});

app.post('/api/ride/pay', auth, (req, res) => {
  const r = db.data.rides.find(x => x.ref === req.body.ref && (x.customerKey || x.customerTier) === req.session.key);
  if (!r) return res.status(404).json({ error: 'Rit niet gevonden.' });
  if (r.paid) return res.status(409).json({ error: 'Al betaald.' });
  // de verloopgrens geldt alleen voor vooraf betalen; achteraf mag later
  if (r.status === 'wacht-op-betaling' && Date.now() - new Date(r.at) > 30 * 60000) return res.status(410).json({ error: 'Deze aanvraag is verlopen. Vraag de rit opnieuw aan.' });
  // fooi voor de chauffeur, punten-tegoed (RTG legt bij) en spaarpunten
  const fooiR = fooiUit(req.body, r.quote);
  if (fooiR) r.fooi = fooiR;
  const kortingR = pasTegoedToe(req.session.key, r.quote);
  if (kortingR) r.puntenKorting = kortingR;
  r.paid = true;
  r.paidAt = new Date().toISOString();
  if (r.status === 'wacht-op-betaling') r.status = 'aangevraagd';
  verdienPunten(req.session.key, r.quote - kortingR, r.supplierName);
  save();
  notifySupplier(r.supplierCode, { icon: r.type === 'jet' ? '\u2708\uFE0F' : '\u{1F697}', title: 'Nieuwe ritaanvraag (betaald)', body: r.customerCodename + ': ' + r.from + ' naar ' + (r.to || 'bestemming') + ' \u00B7 ' + r.passengers + 'p \u00B7 \u20AC ' + r.quote + (r.plannedFor ? ' \u00B7 ' + r.when : '') });
  sseToSupplier(r.supplierCode, 'sync', { scope: 'orders' });
  sseToOffice('sync', { scope: 'orders' });
  pushLive(req.session.key);
  res.json({ ok: true, ride: r });
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
  res.json({
    messages: convOf(req.session.account.id),
    mode: req.session.tier === 'rtg' ? 'butler' : 'concierge',
    phone: accounts.phoneOf(req.session.account)
  });
});

app.post('/api/chat/send', auth, async (req, res) => {
  if (!req.session.account) return res.status(403).json({ error: 'Alleen voor accounts.' });
  const text = String(req.body.text || '').trim();
  if (!text) return res.status(400).json({ error: 'Leeg bericht.' });
  await memberSays(req.session.account, text, 'app');
  res.json({ ok: true, messages: convOf(req.session.account.id), mode: req.session.tier === 'rtg' ? 'butler' : 'concierge' });
});

/* ============ rechtstreeks betalen aan een leverancier (Face ID) ============
   Elk betalend lid rekent alles met Face ID af, via de AI en de Salon, en het
   geld gaat rechtstreeks naar de leverancier. Alleen leden (geen gasten). */
app.post('/api/betaal/direct', auth, async (req, res) => {
  if (req.session.tier === 'guest') return res.status(403).json({ error: 'Rechtstreeks betalen is voor leden.' });
  const cent = req.body.centen != null ? Math.round(Number(req.body.centen)) : Math.round(Number(req.body.bedrag) * 100);
  const r = await dpBetaalDirect({ key: req.session.key, codename: liveCodename(req.session),
    supplierCode: String(req.body.supplierCode || ''), bedragCenten: cent,
    omschrijving: req.body.omschrijving, bron: req.body.bron, idem: req.body.idem });
  if (r.error) return res.status(r.status).json({ error: r.error });
  res.json(r);
});
app.post('/api/betaal/verzoeken', auth, (req, res) => {
  if (req.session.tier === 'guest') return res.json({ verzoeken: [] });
  res.json({ verzoeken: dpVerzoekenVoor(liveCodename(req.session)) });
});
app.post('/api/betaal/verzoek/pay', auth, async (req, res) => {
  if (req.session.tier === 'guest') return res.status(403).json({ error: 'Betalen is voor leden.' });
  const r = await dpBetaalVerzoek({ key: req.session.key, codename: liveCodename(req.session), ref: String(req.body.ref || ''), idem: req.body.idem });
  if (r.error) return res.status(r.status).json({ error: r.error });
  res.json(r);
});
app.post('/api/betaal/mijn', auth, (req, res) => {
  res.json({ betalingen: dpMijnBetalingen(req.session.key) });
});

app.post('/api/partner', (req, res) => {
  const partner = findPartner(req.body.code);
  if (!partner) return res.status(404).json({ error: 'Deze partnercode kennen we niet.' });
  res.json({ partner: publicPartner(partner) });
});

/* ================== bestellen: de ophaal/bezorgdienst ==================
   Horeca en zelfstandigen voeren een eigen bezorg-assortiment (los van de
   menukaart ter plaatse). Het lid kiest ophalen of bezorgen; betalen gaat
   altijd vooraf via de bestaande betaalstroom (/api/order/pay), zodat de
   kassa, backoffice, boekhouding en archiefkast automatisch meedoen. */
app.post('/api/bezorg/partners', auth, (req, res) => {
  const partners = db.data.suppliers
    .filter(s => magBezorgen(s) && s.bezorg && s.bezorg.aan && s.bezorg.producten.length && salonZichtbaar(s))
    .map(s => ({ code: s.code, name: s.name, type: s.type, city: s.city, loc: s.loc || null,
      ophalen: s.bezorg.ophalen !== false, bezorgen: s.bezorg.bezorgen !== false,
      producten: s.bezorg.producten.slice(0, 60) }));
  res.json({ partners });
});

app.post('/api/bezorg/bestel', auth, (req, res) => {
  const s = findSupplier(req.body.supplierCode);
  if (!s) return res.status(404).json({ error: 'Partner niet gevonden.' });
  if (!magBezorgen(s) || !s.bezorg || !s.bezorg.aan || !s.bezorg.producten.length)
    return res.status(409).json({ error: s.name + ' heeft op dit moment geen ophaal/bezorgdienst.' });
  const levering = req.body.levering === 'bezorgen' ? 'bezorgen' : 'ophalen';
  if (levering === 'bezorgen' && s.bezorg.bezorgen === false)
    return res.status(409).json({ error: s.name + ' bezorgt niet; ophalen kan wel.' });
  if (levering === 'ophalen' && s.bezorg.ophalen === false)
    return res.status(409).json({ error: s.name + ' doet alleen bezorgen.' });
  const wanted = Array.isArray(req.body.items) ? req.body.items : [];
  const items = [];
  let total = 0;
  for (const w of wanted) {
    const p = s.bezorg.producten.find(x => x.id === w.id);
    const qty = Math.min(20, Math.max(1, parseInt(w.qty, 10) || 1));
    if (p) { items.push({ id: p.id, name: p.name, qty, price: p.price }); total += p.price * qty; }
  }
  if (!items.length) return res.status(400).json({ error: 'Kies eerst iets uit het assortiment.' });
  let adres = null, geo = null;
  if (levering === 'bezorgen') {
    adres = schoon(req.body.adres, 120);
    if (!adres) return res.status(400).json({ error: 'Vul een bezorgadres in.' });
    const lat = Number(req.body.lat), lng = Number(req.body.lng);
    if (Number.isFinite(lat) && Number.isFinite(lng)) geo = { lat, lng };
  }
  const codename = req.session.account ? req.session.account.codename : PERSONAS[req.session.tier].codename;
  const order = {
    ref: 'RTG-B-' + crypto.randomBytes(3).toString('hex').toUpperCase(),
    pickup: pickupCode(),
    supplierCode: s.code, supplierName: s.name, type: s.type,
    customerTier: req.session.tier, customerKey: req.session.key, customerCodename: codename,
    items, total, levering, adres, geo,
    allergyNote: schoon(req.body.note, 200),
    betaalMoment: 'vooraf',
    status: 'wacht-op-betaling', paid: false, at: new Date().toISOString()
  };
  db.data.orders.unshift(order);
  save();
  res.json({ ok: true, order }); // afrekenen via /api/order/pay; dan pas hoort de zaak ervan
});

/* De bestelling live volgen: status, bezorger op naam en (onderweg) de
   laatste GPS-positie met verwachte aankomsttijd. */
app.post('/api/bezorg/volg', auth, (req, res) => {
  const o = db.data.orders.find(x => x.ref === String(req.body.ref || '') && (x.customerKey || x.customerTier) === req.session.key);
  if (!o || !o.levering) return res.status(404).json({ error: 'Bestelling niet gevonden.' });
  const B = db.data.bezorgers || {};
  const pos = o.bezorger ? B[o.supplierCode + ':' + (o.bezorger.staffId || 'beheer')] : null;
  res.json({
    order: o, bezorger: o.bezorger ? { name: o.bezorger.name } : null,
    positie: o.status === 'onderweg' && pos ? { lat: pos.lat, lng: pos.lng, at: pos.at } : null,
    etaMin: o.status === 'onderweg' ? (o.etaMin || null) : null
  });
});

/* ================== tickets: activiteiten, tours en musea ==================
   Tijdsloten met capaciteit; betalen vooraf via de bestaande boekingstroom
   (/api/booking/pay). Het ticket krijgt een entreecode die het personeel aan
   de deur op eigen naam afvinkt. */
app.post('/api/tickets/aanbod', auth, (req, res) => {
  const partners = db.data.suppliers
    .filter(s => ((db.data.supplierTypes[s.type] || {}).caps || []).includes('tickets') && (s.activiteiten || []).length && salonZichtbaar(s))
    .map(s => ({ code: s.code, name: s.name, city: s.city, loc: s.loc || null, activiteiten: s.activiteiten.slice(0, 30) }));
  res.json({ partners });
});

app.post('/api/ticket/koop', auth, (req, res) => {
  const s = findSupplier(req.body.supplierCode);
  const caps = s ? ((db.data.supplierTypes[s.type] || {}).caps || []) : [];
  if (!s || !caps.includes('tickets')) return res.status(404).json({ error: 'Geen activiteitenpartner gevonden.' });
  const act = (s.activiteiten || []).find(a => a.id === req.body.activiteitId);
  if (!act) return res.status(404).json({ error: 'Deze activiteit bestaat niet (meer).' });
  const datum = String(req.body.datum || '');
  const tijd = String(req.body.tijd || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(datum) || datum < new Date().toISOString().slice(0, 10))
    return res.status(400).json({ error: 'Kies een datum vanaf vandaag.' });
  if (!(act.tijden || []).includes(tijd)) return res.status(400).json({ error: 'Kies een tijdslot van deze activiteit.' });
  const personen = Math.min(10, Math.max(1, parseInt(req.body.personen, 10) || 1));
  const bezet = ticketsVoorSlot(s.code, act.id, datum, tijd).reduce((n, t) => n + (t.personen || 1), 0);
  if (bezet + personen > act.capaciteit)
    return res.status(409).json({ error: 'Dit tijdslot heeft nog ' + Math.max(0, act.capaciteit - bezet) + ' plek(ken). Kies een ander slot.' });
  const codename = req.session.account ? req.session.account.codename : PERSONAS[req.session.tier].codename;
  const ticket = {
    ref: 'RTG-T-' + crypto.randomBytes(3).toString('hex').toUpperCase(),
    kind: 'ticket', code: entreeCode(),
    supplierCode: s.code, supplierName: s.name,
    customerTier: req.session.tier, customerKey: req.session.key, customerCodename: codename,
    service: { id: act.id, name: act.name, soort: 'ticket' },
    activiteitId: act.id, datum, tijd, personen,
    price: (act.prijs || 0) * personen,
    wanneer: datum + ' ' + tijd,
    betaalMoment: 'vooraf', status: 'wacht-op-betaling', paid: false, at: new Date().toISOString()
  };
  db.data.boekingen.unshift(ticket);
  db.data.boekingen = db.data.boekingen.slice(0, 50000);
  save();
  res.json({ ok: true, ticket }); // afrekenen via /api/booking/pay
});

app.post('/api/tickets/mijn', auth, (req, res) => {
  const mijn = db.data.boekingen
    .filter(b => b.kind === 'ticket' && (b.customerKey || b.customerTier) === req.session.key && b.status !== 'geweigerd' && b.paid)
    .slice(0, 20)
    .map(b => {
      const zaak = findSupplier(b.supplierCode);
      const rit = db.data.rides.find(r => r.ticketRef === b.ref && !['afgerond', 'geweigerd'].includes(r.status));
      return { ref: b.ref, code: b.code, supplierName: b.supplierName, naam: b.service.name,
        datum: b.datum, tijd: b.tijd, personen: b.personen, prijs: b.price,
        gebruikt: !!b.checkin, checkin: b.checkin || null,
        // de eigen transferdienst van de zaak, en de lopende rit met chauffeur
        transferAan: !!(zaak && zaak.transfer && zaak.transfer.aan),
        transferPrijs: zaak && zaak.transfer ? (zaak.transfer.prijs || 0) : 0,
        transfer: rit ? { ref: rit.ref, status: rit.status, prijs: rit.quote || 0, paid: !!rit.paid,
          chauffeur: rit.driver ? rit.driver.name : null, etaMin: rit.pickupEtaMin || null } : null };
    });
  res.json({ tickets: mijn });
});

/* De transfer van een activiteitenzaak: alleen met een geldig (betaald, nog
   niet gebruikt) ticket. De rit gaat de gewone rittenmachinerie in: de
   chauffeur van de zaak neemt hem op naam aan, de klant ziet wie er komt
   (en andersom), en de zaak ziet alles in de eigen app. */
app.post('/api/transfer/aanvraag', auth, (req, res) => {
  const t = db.data.boekingen.find(b => b.kind === 'ticket' && b.ref === String(req.body.ticketRef || '') &&
    (b.customerKey || b.customerTier) === req.session.key);
  if (!t) return res.status(404).json({ error: 'Ticket niet gevonden.' });
  if (!t.paid) return res.status(409).json({ error: 'Betaal eerst het ticket; dan regelen we de transfer.' });
  if (t.checkin) return res.status(409).json({ error: 'Dit ticket is al gebruikt.' });
  if (t.datum < new Date().toISOString().slice(0, 10)) return res.status(409).json({ error: 'Dit ticket is verlopen.' });
  const s = findSupplier(t.supplierCode);
  if (!s || !s.transfer || !s.transfer.aan)
    return res.status(409).json({ error: (s ? s.name : 'Deze zaak') + ' heeft geen eigen transferdienst.' });
  if (db.data.rides.some(r => r.ticketRef === t.ref && !['afgerond', 'geweigerd'].includes(r.status)))
    return res.status(409).json({ error: 'Er staat al een transfer voor dit ticket.' });
  const prijs = s.transfer.prijs || 0;
  const codename = liveCodename(req.session);
  const ride = {
    ref: 'RTG-R-' + crypto.randomBytes(3).toString('hex').toUpperCase(),
    supplierCode: s.code, supplierName: s.name, type: 'transfer',
    customerTier: req.session.tier, customerKey: req.session.key, customerCodename: codename,
    from: schoon(req.body.van || 'Huidige locatie', 80),
    to: s.name, toCode: s.code,
    when: t.tijd + ' \u00B7 ' + t.service.name,
    plannedFor: t.datum + 'T' + t.tijd + ':00',
    passengers: t.personen || 1, luggage: 0,
    note: schoon(req.body.note, 140),
    km: null, quote: prijs, ticketRef: t.ref,
    driver: null, vehicle: null,
    betaalMoment: 'vooraf',
    // prijs 0 = inclusief bij het ticket: meteen definitief, geen betaalstap
    status: prijs > 0 ? 'wacht-op-betaling' : 'aangevraagd',
    paid: prijs === 0, at: new Date().toISOString()
  };
  db.data.rides.unshift(ride);
  save();
  if (ride.status === 'aangevraagd') {
    notifySupplier(s.code, { icon: '\u{1F690}', title: 'Transferaanvraag', body: codename + ': ophalen ' + ride.from + ' voor ' + t.service.name + ' ' + t.tijd + ' \u00B7 ' + (t.personen || 1) + 'p' + (prijs ? ' \u00B7 \u20AC ' + prijs : ' \u00B7 inclusief') });
    sseToSupplier(s.code, 'sync', { scope: 'orders' });
    sseToOffice('sync', { scope: 'orders' });
  }
  res.json({ ok: true, ride }); // met een prijs: afrekenen via /api/ride/pay
});

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
    .filter(s => s.type === 'verhuur' && (s.autos || []).some(a => a.actief !== false) && salonZichtbaar(s))
    .map(s => ({ code: s.code, name: s.name, city: s.city, loc: s.loc || null,
      autos: (s.autos || []).filter(a => a.actief !== false).slice(0, 40) }));
  res.json({ partners });
});

app.post('/api/huur/boek', auth, (req, res) => {
  const s = findSupplier(req.body.supplierCode);
  if (!s || s.type !== 'verhuur') return res.status(404).json({ error: 'Geen verhuurpartner gevonden.' });
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
app.post('/api/huur/foto', express.json({ limit: '1.5mb' }), auth, (req, res) => {
  const h = mijnHuur(req, res); if (!h) return;
  const fase = req.body.fase === 'na' ? 'na' : 'voor';
  if (fase === 'voor' && h.status !== 'aangevraagd') return res.status(409).json({ error: 'Voor-foto\'s maak je voordat de auto is uitgegeven.' });
  if (fase === 'na' && h.status !== 'lopend') return res.status(409).json({ error: 'Na-foto\'s maak je bij het inleveren, tijdens de huur.' });
  const foto = String(req.body.foto || '');
  if (!/^data:image\/(jpeg|png|webp);base64,/.test(foto) || foto.length > 400000)
    return res.status(400).json({ error: 'Stuur een foto (jpeg/png/webp, tot ~300 kB).' });
  const f = huurFotos(h.ref);
  if (f[fase].filter(x => x.door === 'huurder').length >= 8) return res.status(400).json({ error: 'Tot acht foto\'s per kant.' });
  f[fase].push({ foto, door: 'huurder', at: new Date().toISOString() });
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

app.post('/api/charter/foto', express.json({ limit: '1.5mb' }), auth, (req, res) => {
  const c = mijnCharter(req, res); if (!c) return;
  const fase = req.body.fase === 'na' ? 'na' : 'voor';
  if (fase === 'voor' && c.status !== 'aangevraagd') return res.status(409).json({ error: 'Voor-foto\'s maakt u voordat u uitvaart.' });
  if (fase === 'na' && c.status !== 'lopend') return res.status(409).json({ error: 'Na-foto\'s maakt u bij de teruggave.' });
  const foto = String(req.body.foto || '');
  if (!/^data:image\/(jpeg|png|webp);base64,/.test(foto) || foto.length > 400000)
    return res.status(400).json({ error: 'Stuur een foto (jpeg/png/webp, tot ~300 kB).' });
  const f = charterFotos(c.ref);
  if (f[fase].filter(x => x.door === 'gast').length >= 8) return res.status(400).json({ error: 'Tot acht foto\'s per kant.' });
  f[fase].push({ foto, door: 'gast', at: new Date().toISOString() });
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

/* ================== veilig laten bezorgen door een modewinkel ==================
   Een lid laat gekochte/apart-gelegde mode-artikelen thuisbezorgen. Veilig: een
   bezorgcode die je alleen aan de echte koerier geeft, live volgen, en bij dure
   stukken een ID-controle aan de deur (RTG-geverifieerd account vereist). */
app.post('/api/mode/bezorg/aanvraag', auth, express.json({ limit: '1mb' }), (req, res) => {
  const r = mbAanvraag(req.session.key, liveCodename(req.session), String(req.body.supplierCode || ''), req.body.items,
    { adres: req.body.adres, lat: req.body.lat, lng: req.body.lng });
  if (r.error) return res.status(r.status).json({ error: r.error });
  openLijn(findSupplier(req.body.supplierCode), req);
  res.json({ ok: true, bezorging: r.bezorging });
});
app.post('/api/mode/bezorg/mijn', auth, (req, res) => {
  res.json({ bezorgingen: mbMijn(req.session.key) });
});

/* ================== boodschappen bij de groothandel/supermarkt ==================
   Leden bestellen boodschappen bij een groothandel die de consument-functie
   aan heeft staan, en laten die bezorgen of halen ze af. */
app.post('/api/groothandel/markt', auth, (req, res) => {
  res.json({ groothandels: ghMarkt('lid', { zoek: req.body.zoek, categorie: req.body.categorie }) });
});
app.post('/api/groothandel/bestel', auth, (req, res) => {
  const koper = { soort: 'lid', id: req.session.key, naam: liveCodename(req.session) };
  const r = ghPlaatsBestelling(String(req.body.groothandelCode || ''), koper, req.body.regels, { bezorgen: req.body.bezorgen !== false });
  if (r.error) return res.status(r.status).json({ error: r.error });
  openLijn(findSupplier(req.body.groothandelCode), req);
  res.json({ ok: true, order: r.order });
});
app.post('/api/groothandel/mijn', auth, (req, res) => {
  res.json({ bestellingen: ghMijnBestellingen({ soort: 'lid', id: req.session.key }) });
});
app.post('/api/groothandel/annuleer', auth, (req, res) => {
  const r = ghAnnuleer({ soort: 'lid', id: req.session.key }, String(req.body.ref || ''));
  if (r.error) return res.status(r.status).json({ error: r.error });
  res.json({ ok: true });
});

/* ================== contracten: het lid tekent digitaal ================== */
app.post('/api/contracten/mijn', auth, (req, res) => {
  const mijn = db.data.contracten
    .filter(c => c.partij.kind === 'lid' && c.partij.key === req.session.key)
    .slice(0, 50)
    .map(c => ({ ref: c.ref, soort: c.soort, supplierName: c.supplierName, titel: c.titel, tekst: c.tekst,
      velden: c.velden || [], status: c.status, getekendDoorMij: !!c.tekenPartij, getekendDoorZaak: !!c.tekenZaak,
      at: c.at }));
  res.json({ contracten: mijn });
});

app.post('/api/contract/teken', auth, (req, res) => {
  const c = db.data.contracten.find(x => x.ref === String(req.body.ref || '') && x.partij.kind === 'lid' && x.partij.key === req.session.key);
  if (!c) return res.status(404).json({ error: 'Contract niet gevonden.' });
  if (c.status === 'geweigerd') return res.status(409).json({ error: 'Dit contract is al geweigerd.' });
  if (c.tekenPartij) return res.status(409).json({ error: 'U heeft dit contract al ondertekend.' });
  const naam = schoon(req.body.naam, 60);
  if (!naam || req.body.akkoord !== true) return res.status(400).json({ error: 'Typ uw naam en vink akkoord aan om te tekenen.' });
  c.tekenPartij = { naam, at: new Date().toISOString() };
  if (c.tekenZaak && c.tekenPartij) c.status = 'getekend';
  save();
  notifySupplier(c.supplierCode, { icon: '\u2713', title: 'Contract getekend', body: c.partij.codename + ' tekende: ' + c.titel });
  sseToSupplier(c.supplierCode, 'sync', { scope: 'contract' });
  res.json({ ok: true, status: c.status });
});

app.post('/api/contract/weiger', auth, (req, res) => {
  const c = db.data.contracten.find(x => x.ref === String(req.body.ref || '') && x.partij.kind === 'lid' && x.partij.key === req.session.key);
  if (!c) return res.status(404).json({ error: 'Contract niet gevonden.' });
  if (c.tekenPartij) return res.status(409).json({ error: 'U heeft dit contract al ondertekend.' });
  c.status = 'geweigerd';
  save();
  notifySupplier(c.supplierCode, { icon: '\u2715', title: 'Contract geweigerd', body: c.partij.codename + ' weigerde: ' + c.titel });
  sseToSupplier(c.supplierCode, 'sync', { scope: 'contract' });
  res.json({ ok: true });
});

/* ================== vastgoed: het lid ================== */
function pandPubliek(s, p) {
  return { id: p.id, titel: p.titel, soort: p.soort, transactie: p.transactie, prijs: p.prijs,
    plaats: p.plaats, adres: p.adres, slaapkamers: p.slaapkamers, badkamers: p.badkamers,
    oppervlakte: p.oppervlakte, perceel: p.perceel, tuin: p.tuin, zwembad: p.zwembad, garage: p.garage,
    energielabel: p.energielabel, omschrijving: p.omschrijving, status: p.status, keyless: !!p.keyless,
    fotos: p.fotos || [], supplierCode: s.code, supplierName: s.name };
}
app.post('/api/vastgoed/aanbod', auth, (req, res) => {
  const key = req.session.key;
  const uit = [];
  for (const s of db.data.suppliers) {
    if (s.type !== 'vastgoed' || !salonZichtbaar(s)) continue;
    const aanb = db.data.vastgoedAanbod.filter(a => a.supplierCode === s.code && (a.publiek || a.aanKeys.includes(key)));
    const pandIds = new Set(aanb.map(a => a.pandId));
    const gericht = new Set(aanb.filter(a => a.aanKeys.includes(key)).map(a => a.pandId));
    for (const p of (s.panden || [])) {
      if (!pandIds.has(p.id)) continue;
      uit.push({ ...pandPubliek(s, p), gericht: gericht.has(p.id) });
    }
  }
  // eigen bezichtigingen en biedingen erbij
  const bez = db.data.bezichtigingen.filter(b => b.key === key).slice(0, 30).map(b => {
    const s = findSupplier(b.supplierCode); const p = s ? (s.panden || []).find(x => x.id === b.pandId) : null;
    const keyNu = b.keyless && Date.now() >= new Date(b.keyless.van).getTime() && Date.now() <= new Date(b.keyless.tot).getTime();
    return { ref: b.ref, pand: p ? p.titel : b.pandId, plaats: p ? p.plaats : '', status: b.status, moment: b.moment || null,
      keyless: b.keyless ? { actiefNu: keyNu, van: b.keyless.van, tot: b.keyless.tot } : null };
  });
  const bod = db.data.biedingen.filter(b => b.key === key).slice(0, 30).map(b => {
    const s = findSupplier(b.supplierCode); const p = s ? (s.panden || []).find(x => x.id === b.pandId) : null;
    return { ref: b.ref, pand: p ? p.titel : b.pandId, bedrag: b.bedrag, status: b.status, tegenbod: b.tegenbod || null };
  });
  res.json({ panden: uit, bezichtigingen: bez, biedingen: bod });
});

app.post('/api/vastgoed/interesse', auth, (req, res) => {
  const s = findSupplier(req.body.supplierCode);
  if (!s || s.type !== 'vastgoed') return res.status(404).json({ error: 'Makelaar niet gevonden.' });
  const p = (s.panden || []).find(x => x.id === req.body.pandId);
  if (!p) return res.status(404).json({ error: 'Pand niet gevonden.' });
  // alleen als het pand aan mij is aangeboden (gericht of publiek)
  const mag = db.data.vastgoedAanbod.some(a => a.supplierCode === s.code && a.pandId === p.id && (a.publiek || a.aanKeys.includes(req.session.key)));
  if (!mag) return res.status(403).json({ error: 'Dit pand is niet aan u aangeboden.' });
  if (db.data.bezichtigingen.some(b => b.key === req.session.key && b.pandId === p.id && !['afgewezen'].includes(b.status)))
    return res.status(409).json({ error: 'U heeft al een bezichtiging voor dit pand aangevraagd.' });
  const b = { ref: 'RTG-V-' + crypto.randomBytes(3).toString('hex').toUpperCase(),
    supplierCode: s.code, pandId: p.id, key: req.session.key, customerTier: req.session.tier, codename: liveCodename(req.session),
    wens: schoon(req.body.wens, 40), status: 'aangevraagd', at: new Date().toISOString() };
  db.data.bezichtigingen.unshift(b);
  db.data.bezichtigingen = db.data.bezichtigingen.slice(0, 50000);
  save();
  notifySupplier(s.code, { icon: '\u{1F441}\uFE0F', title: 'Bezichtiging aangevraagd', body: b.codename + ': ' + p.titel + (b.wens ? ' \u00B7 ' + b.wens : '') });
  sseToSupplier(s.code, 'sync', { scope: 'vastgoed' });
  res.json({ ok: true, ref: b.ref });
});

app.post('/api/vastgoed/bod', auth, (req, res) => {
  const s = findSupplier(req.body.supplierCode);
  if (!s || s.type !== 'vastgoed') return res.status(404).json({ error: 'Makelaar niet gevonden.' });
  const p = (s.panden || []).find(x => x.id === req.body.pandId);
  if (!p) return res.status(404).json({ error: 'Pand niet gevonden.' });
  const mag = db.data.vastgoedAanbod.some(a => a.supplierCode === s.code && a.pandId === p.id && (a.publiek || a.aanKeys.includes(req.session.key)));
  if (!mag) return res.status(403).json({ error: 'Dit pand is niet aan u aangeboden.' });
  const bedrag = Number(req.body.bedrag);
  if (!(bedrag > 0) || bedrag > 1e9) return res.status(400).json({ error: 'Geef een geldig bod.' });
  const b = { ref: 'RTG-O-' + crypto.randomBytes(3).toString('hex').toUpperCase(),
    supplierCode: s.code, pandId: p.id, key: req.session.key, customerTier: req.session.tier, codename: liveCodename(req.session),
    bedrag: Math.round(bedrag), status: 'open', at: new Date().toISOString() };
  db.data.biedingen.unshift(b);
  db.data.biedingen = db.data.biedingen.slice(0, 50000);
  save();
  notifySupplier(s.code, { icon: '\u{1F4B0}', title: 'Nieuw bod', body: b.codename + ' biedt \u20AC ' + b.bedrag.toLocaleString('nl-NL') + ' op ' + p.titel });
  sseToSupplier(s.code, 'sync', { scope: 'vastgoed' });
  res.json({ ok: true, ref: b.ref });
});

/* Keyless toegang tot een bevestigde bezichtiging, alleen binnen het venster. */
app.post('/api/vastgoed/keyless', auth, (req, res) => {
  const b = db.data.bezichtigingen.find(x => x.ref === String(req.body.ref || '') && x.key === req.session.key);
  if (!b || !b.keyless) return res.status(404).json({ error: 'Geen keyless toegang gevonden.' });
  const nu = Date.now();
  if (nu < new Date(b.keyless.van).getTime()) return res.status(409).json({ error: 'De toegang opent om ' + String(b.keyless.van).replace('T', ' ').slice(0, 16) + '.' });
  if (nu > new Date(b.keyless.tot).getTime()) return res.status(409).json({ error: 'Het toegangsvenster is verstreken.' });
  b.keyless.gebruikt = b.keyless.gebruikt || [];
  b.keyless.gebruikt.push(new Date().toISOString());
  save();
  const s = findSupplier(b.supplierCode);
  notifySupplier(b.supplierCode, { icon: '\u{1F513}', title: 'Keyless geopend', body: b.codename + ' opende de deur voor de bezichtiging.' });
  res.json({ ok: true, code: b.keyless.code, tot: b.keyless.tot, relockSec: 8 });
});

/* ================= DE ERVARING-LAAG (kern/ervaring.js) =================
   Tafelreserveringen, annuleren, reviews, favorieten, de reisagenda,
   rekening splitsen, wachtlijsten, RTG-punten en meldingsvoorkeuren. */

// tafel reserveren: het lid vraagt aan, de zaak beslist
app.post('/api/reserveer', auth, (req, res) => {
  if (req.session.tier === 'guest') return res.status(403).json({ error: 'Alleen voor leden.' });
  const r = reserveerTafel(req.session, liveCodename(req.session), req.body);
  if (r.error) return res.status(r.status).json({ error: r.error });
  res.json(r);
});
app.post('/api/reserveringen/mijn', auth, (req, res) => res.json({ reserveringen: mijnReserveringen(req.session.key) }));
app.post('/api/reservering/annuleer', auth, (req, res) => {
  const r = annuleerReservering(req.session.key, String(req.body.id || ''));
  if (r.error) return res.status(r.status).json({ error: r.error });
  res.json(r);
});

// annuleren door het lid: bestelling, rit of boeking (incl. tickets)
app.post('/api/annuleer', auth, (req, res) => {
  const r = annuleerItem(req.session, String(req.body.soort || ''), String(req.body.ref || ''));
  if (r.error) return res.status(r.status).json({ error: r.error });
  res.json(r);
});

// reviews: 1-5 sterren na een afgeronde dienst; publiek per partner opvraagbaar
app.post('/api/review', auth, (req, res) => {
  if (req.session.tier === 'guest') return res.status(403).json({ error: 'Alleen voor leden.' });
  const r = plaatsReview(req.session, liveCodename(req.session), req.body);
  if (r.error) return res.status(r.status).json({ error: r.error });
  res.json(r);
});
app.post('/api/reviews', auth, (req, res) => res.json(reviewsVoor(req.body.supplierCode)));

// favorieten: mijn adressen
app.post('/api/favoriet', auth, (req, res) => {
  if (req.session.tier === 'guest') return res.status(403).json({ error: 'Alleen voor leden.' });
  const r = toggleFavoriet(req.session.key, req.body.supplierCode);
  if (r.error) return res.status(r.status).json({ error: r.error });
  res.json(r);
});
app.post('/api/favorieten', auth, (req, res) => res.json({ favorieten: favorietenVan(req.session.key) }));

// de reisagenda: alles met een datum, per dag gegroepeerd
app.post('/api/agenda/mijn', auth, (req, res) => res.json(agendaVoor(req.session.key)));

// rekening splitsen met verbonden vrienden (betaalverzoeken)
app.post('/api/splits', auth, (req, res) => {
  if (req.session.tier === 'guest') return res.status(403).json({ error: 'Alleen voor leden.' });
  const r = maakSplits(req.session.key, liveCodename(req.session), String(req.body.ref || ''), req.body.metKeys);
  if (r.error) return res.status(r.status).json({ error: r.error });
  res.json(r);
});
app.post('/api/splitsen/mijn', auth, (req, res) => res.json({ splitsen: mijnSplitsen(req.session.key) }));
app.post('/api/splits/betaal', auth, (req, res) => {
  const r = betaalSplits(req.session.key, String(req.body.id || ''));
  if (r.error) return res.status(r.status).json({ error: r.error });
  res.json(r);
});

// wachtlijst voor een vol event of tijdslot
app.post('/api/wachtlijst', auth, (req, res) => {
  if (req.session.tier === 'guest') return res.status(403).json({ error: 'Alleen voor leden.' });
  const r = zetOpWachtlijst(req.session, liveCodename(req.session), req.body);
  if (r.error) return res.status(r.status).json({ error: r.error });
  res.json(r);
});
app.post('/api/wachtlijst/mijn', auth, (req, res) => res.json({ wachtlijst: mijnWachtlijst(req.session.key) }));

// aanmelding voor een event intrekken (maakt de plek vrij voor de wachtlijst)
app.post('/api/event/rsvp/annuleer', auth, (req, res) => {
  const r = rsvpAnnuleer(req.session.key, req.body.supplierCode, req.body.eventId);
  if (r.error) return res.status(r.status).json({ error: r.error });
  res.json(r);
});

// RTG-punten: saldo en historie, verzilveren naar tegoed
app.post('/api/punten', auth, (req, res) => res.json(puntenVan(req.session.key)));
app.post('/api/punten/verzilver', auth, (req, res) => {
  const r = verzilverPunten(req.session.key, req.body.punten);
  if (r.error) return res.status(r.status).json({ error: r.error });
  res.json(r);
});

/* ---- retail/mode: de catalogus van een modehuis, verlanglijst, apart en styling ---- */
// de catalogus van een merk (collecties + artikelen met ledenprijs, drops, wishlist)
app.post('/api/retail/catalogus', auth, (req, res) => {
  const s = findSupplier(req.body.supplierCode);
  if (!s || !retailIsRetail(s)) return res.status(404).json({ error: 'Modepartner niet gevonden.' });
  res.json(retailCatalogus(s, req.session.key, req.body.lang));
});
// een artikel op de verlanglijst zetten of eraf halen
app.post('/api/retail/wishlist', auth, (req, res) => {
  if (req.session.tier === 'guest') return res.status(403).json({ error: 'Alleen voor leden.' });
  const r = wishlistToggle(String(req.body.supplierCode || ''), req.session.key, String(req.body.artikelId || ''));
  if (r.error) return res.status(r.status).json({ error: r.error });
  res.json(r);
});
// een maat naar een paskamer laten brengen (in de winkel, vanuit de app)
app.post('/api/retail/paskamer', auth, (req, res) => {
  if (req.session.tier === 'guest') return res.status(403).json({ error: 'Alleen voor leden.' });
  const s = findSupplier(req.body.supplierCode);
  if (!s || !retailIsRetail(s)) return res.status(404).json({ error: 'Modepartner niet gevonden.' });
  const r = vraagPaskamer(s, req.session.key, liveCodename(req.session), req.body);
  if (r.error) return res.status(r.status).json({ error: r.error });
  res.json(r);
});
// wat er voor mij apart ligt, en de stylingvoorstellen die ik kreeg
app.post('/api/retail/mijn', auth, (req, res) => res.json({ apart: mijnApart(req.session.key), styling: mijnStyling(req.session.key) }));

/* ---- paspoort/identiteit: het lid houdt de regie (kern/paspoort.js) ---- */
// mijn verificatiestatus en de openstaande/afgehandelde identiteitsverzoeken
app.post('/api/paspoort/mijn', auth, (req, res) => {
  res.json({ status: paspoortStatus(req.session.key), verzoeken: paspoortMijn(req.session.key), niveaus: PASPOORT_NIVEAUS });
});
// een idkaart-/paspoortverzoek goedkeuren of weigeren
app.post('/api/paspoort/beslis', auth, (req, res) => {
  if (req.session.tier === 'guest') return res.status(403).json({ error: 'Alleen voor leden met een geverifieerd account.' });
  const r = paspoortBeslis(req.session.key, String(req.body.id || ''), req.body.akkoord === true);
  if (r.error) return res.status(r.status).json({ error: r.error });
  res.json(r);
});
// een eerder gegeven goedkeuring weer intrekken
app.post('/api/paspoort/trek-in', auth, (req, res) => {
  const r = paspoortTrekIn(req.session.key, String(req.body.id || ''));
  if (r.error) return res.status(r.status).json({ error: r.error });
  res.json(r);
});

// meldingsvoorkeuren: per scope aan of uit (afgedwongen in notify)
app.post('/api/meldingen/voorkeur', auth, (req, res) => {
  // demo-sessies hebben hun pas als sleutel, accounts hun eigen sleutel: notify
  // gebruikt dezelfde, dus de voorkeur landt automatisch op het juiste doel
  if (req.body.zet && typeof req.body.zet === 'object') return res.json({ voorkeur: zetVoorkeur(req.session.key, req.body.zet) });
  res.json({ voorkeur: voorkeurVan(req.session.key) });
});
};
