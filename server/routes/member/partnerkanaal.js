/* Member-submodule: het partner- en bedrijvenkanaal. Niet-leden boeken reizen
   via een partnerlink, bedrijven vragen een partnerplek aan (als lid, met welke
   pas dan ook) en bestellen RTG-hardware in de winkel (Zaakdoos en
   toebehoren, prijzen in euro ex btw). Gemount vanuit routes/member.js. */
const caps = require('../../kern/commercie/capaciteiten');
const ladder = require('../../kern/pasladder');

module.exports = (kern) => {
  const { app, db, save, crypto, findPartner, publicTrip, ondernemingBijdrageOver } = kern;

  /* B14: de partnercode (`code`) is een openbare attributie en verandert geen
     prijs; alleen een geldige personeelscode (kern/partnerpersoneelscode.js,
     128 bits per medewerker) toont het personeelstarief. Tonen verbruikt niets. */
  const personeel = () => kern.partnerPersoneelscode;
  app.post('/api/partnertrips', (req, res) => {
    let staffRate = null;
    if (req.body.staffCode) {
      const v = personeel().welke(req.body.staffCode);
      if (v) staffRate = v.partner.staff.serviceRate;
    }
    res.json({ trips: db.data.partnerTrips.map(t => publicTrip(t, staffRate, req.body.lang)) });
  });

  /* Een boeking met een personeelscode verbruikt EEN gebruik, atomair in de
     collectietransactie (claim), en pas NA de invoercontrole: een fout
     formulier kost de medewerker geen boeking. Met alleen een partnercode is het
     het gewone tarief; de code legt alleen vast wie de boeker stuurde. */
  app.post('/api/book', async (req, res) => {
   try {
    const trip = db.data.partnerTrips.find(t => t.id === req.body.tripId);
    if (!trip) return res.status(404).json({ error: 'Reis niet gevonden.' });

    let partner = null;
    let rate = db.data.partnerService;
    let channel = 'klant';
    let plek = null;
    if (!req.body.staffCode && req.body.code) {
      partner = findPartner(req.body.code);
      if (!partner) return res.status(404).json({ error: 'Deze partnercode kennen we niet.' });
    }

    const name = String(req.body.name || '').trim().slice(0, 120);
    const email = String(req.body.email || '').trim().slice(0, 200);
    if (!name || !email.includes('@')) return res.status(400).json({ error: 'Vul een naam en geldig e-mailadres in.' });
    if (req.body.staffCode) {
      const c = await personeel().claim(req.body.staffCode);
      if (!c) return res.status(404).json({ error: 'Deze personeelscode kennen we niet.' });
      partner = c.partner; plek = c.id;
      rate = partner.staff.serviceRate;
      channel = 'personeel';
    }

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
      partnerCode: partner ? partner.code : null, personeelsplek: plek,
      netto: trip.netto, service, total, partnerCut, rtgCut,
      bijdrage: { grondslag: bijdrage.grondslag, promille: bijdrage.promille, reden: bijdrage.reden || null },
      at: new Date().toISOString()
    });
    save();
    // de boeker krijgt meteen alle reisregels van de bestemming mee
    const wijzer = kern.reiswijzer(trip.dest);
    res.json({ ok: true, ref, trip: { title: trip.title, dest: trip.dest }, partner: partner ? partner.name : null, total,
      reiswijzer: wijzer.error ? null : wijzer });
   } catch (e) { console.error('[partnerboeking]', e); res.status(500).json({ error: 'Er ging iets mis. Probeer het opnieuw.' }); }
  });

  /* DE PARTNERAANVRAAG WOONT IN ./partneraanmelding.js, samen met de types- en
     de mijn-route. Er stonden twee versies van /api/partner/apply naast elkaar
     na de samenvoeging; zie de kop daar voor welke is gebleven en waarom. */
  /* En de aanmeldmodule erbij: die draagt sinds deze samenvoeging /api/partner/types
     en /api/partner/applications/mijn. Zijn eigen /api/partner/apply is eruit --
     zie de kop daar; twee modules op hetzelfde adres is er een te veel. */
  require('./partneraanmelding')(kern);

  // De losse partner-winkel is opgeheven: kopen gaat voortaan uitsluitend via de
  // RTG Mall (kern/mall.js + /api/mall). De catalogus woont in
  // kern/winkelcatalogus.js; de Mall leest hem daar.
};
