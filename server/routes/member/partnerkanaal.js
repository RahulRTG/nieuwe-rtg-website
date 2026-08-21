/* Member-submodule: het partner- en bedrijvenkanaal. Niet-leden boeken reizen
   via een partnerlink, bedrijven vragen een partnerplek aan (alleen met een
   actieve Business Pass) en bestellen RTG-hardware in de winkel (Zaakdoos en
   toebehoren, prijzen in euro ex btw). Gemount vanuit routes/member.js. */
module.exports = (kern) => {
  const { app, db, save, crypto, findPartner, findStaffPartner, publicTrip,
    ondernemingBijdrageOver } = kern;

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

    /* Interne administratie: de verdeling wordt opgeslagen, nooit meegestuurd.

       rtgCut WAS hier per definitie 0 -- "RTG verdient niets aan een boeking".
       Sinds de ondernemersregie (kern/onderneming/regie.js) is dat een KNOP van
       de boardroom in plaats van een constante. Staat de bijdrage uit, dan komt
       er nog steeds nul uit en verandert er niets aan wat een partner krijgt;
       staat hij aan, dan houdt RTG het ingestelde promillage in op de service
       en gaat de rest naar de partner.

       De bijdrage wordt over de SERVICE genomen en niet over het totaal: de
       netto reissom is het geld van de aanbieder en niet de opbrengst van deze
       transactie. Een percentage over andermans inkoop is geen bijdrage maar
       een boete op omzet. */
    const service = Math.round(trip.netto * rate);
    const total = trip.netto + service;
    const bijdrage = ondernemingBijdrageOver
      ? ondernemingBijdrageOver({ centen: service, viaRtg: true, betaald: true })
      : { centen: 0, reden: 'De ondernemersregie is niet gemount.' };
    const rtgCut = Math.min(service, Math.max(0, bijdrage.centen || 0));
    const partnerCut = service - rtgCut;
    const ref = 'RTG-B-' + crypto.randomBytes(3).toString('hex').toUpperCase();
    db.data.bookings.push({
      ref, tripId: trip.id, channel, name, email,
      partnerCode: partner ? partner.code : null,
      netto: trip.netto, service, total, partnerCut, rtgCut,
      bijdrage: { grondslag: bijdrage.grondslag, promille: bijdrage.promille, reden: bijdrage.reden || null },
      at: new Date().toISOString()
    });
    save();
    // de boeker krijgt meteen alle reisregels van de bestemming mee
    const wijzer = kern.reiswijzer(trip.dest);
    res.json({ ok: true, ref, trip: { title: trip.title, dest: trip.dest }, partner: partner ? partner.name : null, total,
      reiswijzer: wijzer.error ? null : wijzer });
  });

  require('./partneraanmelding')(kern);

  // De losse partner-winkel is opgeheven: kopen gaat voortaan uitsluitend via de
  // RTG Mall (kern/mall.js + /api/mall). De catalogus woont in
  // kern/winkelcatalogus.js; de Mall leest hem daar.
};
