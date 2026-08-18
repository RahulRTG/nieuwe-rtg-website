/* Member-submodule: het partner- en bedrijvenkanaal. Niet-leden boeken reizen
   via een partnerlink, bedrijven vragen een partnerplek aan (als lid, met welke
   pas dan ook) en bestellen RTG-hardware in de winkel (Zaakdoos en
   toebehoren, prijzen in euro ex btw). Gemount vanuit routes/member.js. */
const { heeftPas, PAS_FOUT } = require('../../kern/paseis');
module.exports = (kern) => {
  const { app, db, save, crypto, findPartner, findStaffPartner, publicTrip, schoon,
    resolveSession, mail, sseToOffice, ondernemingBijdrageOver } = kern;

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

  app.post('/api/partner/apply', (req, res) => {
    const b = req.body || {};
    /* DE TOEGANGSEIS: EEN PAS, EN VERDER GEEN VOORWAARDE.

       Hier stond: alleen met een actieve BUSINESS PASS. Dat was een verkeerde
       gelijkstelling van twee dingen die niets met elkaar te maken hebben. De
       Business Pass is een lidmaatschapsniveau -- de duurste, met de zakelijke
       kant erbij -- en geen vergunning om een bedrijf te hebben. Wie met een
       gewone RTG Pass een zaak runt, is niet minder ondernemer; hij kon alleen
       zijn bedrijf niet aanmelden. Dat is precies de vorm van de grens die
       CONCERN.md al verbiedt aan de werknemerskant: niemand koopt hier een pas
       om te mogen werken.

       Wat blijft is dat er een LID achter de aanvraag staat. Een partnerplek is
       een zakelijke relatie met RTG, met een bedrijfscode en een beheer-inlog;
       die geven we niet uit aan een anonieme post. De gratis gast-laag (zonder
       pas) valt er daarom buiten -- dezelfde grens als overal elders in de app.

       Hier stond ooit sessionFor(). Die kent alleen de sessies uit /api/login --
       de demopassen. Een ECHT ledenaccount komt via accounts.verifyToken binnen
       en staat daar helemaal niet in. resolveSession() kent allebei de wegen,
       net als de gewone auth-middleware in server.js. */
    const passToken = String(b.passToken || (req.headers.authorization || '').replace(/^Bearer\s+/i, '') || '');
    const passSess = passToken ? resolveSession(passToken) : null;
    if (!passSess || !heeftPas(passSess.tier)) return res.status(403).json({ error: PAS_FOUT });
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
      /* Het lidmaatschapsbewijs: welke pas de aanvrager had, en wie hij is.
         Zonder dit keurt het kantoor niets goed -- niet omdat de SOORT pas iets
         moet zijn, maar omdat er een lid achter hoort te staan. Het veld heette
         `businessPass` toen dat wél de eis was; het kantoor leest allebei, zodat
         aanvragen van voor deze wijziging gewoon behandelbaar blijven. */
      pas: { tier: passSess.tier, key: passSess.key, at: new Date().toISOString() },
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

  // De losse partner-winkel is opgeheven: kopen gaat voortaan uitsluitend via de
  // RTG Mall (kern/mall.js + /api/mall). De catalogus woont in
  // kern/winkelcatalogus.js; de Mall leest hem daar.
};
