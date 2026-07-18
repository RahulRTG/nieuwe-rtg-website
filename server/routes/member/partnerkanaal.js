/* Member-submodule: het partner- en bedrijvenkanaal. Niet-leden boeken reizen
   via een partnerlink, bedrijven vragen een partnerplek aan (alleen met een
   actieve Business Pass) en bestellen RTG-hardware in de winkel (Zaakdoos en
   toebehoren, prijzen in euro ex btw). Gemount vanuit routes/member.js. */
module.exports = (kern) => {
  const { app, db, save, crypto, findPartner, findStaffPartner, publicTrip, schoon,
    sessionFor, mail, sseToOffice } = kern;

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
};
