/* Domein "wereld": RTG als één sociale app met een contextschakelaar.

   One identity. One network. One app. Your context.

   Wat hier binnenkomt is niet een nieuw sociaal netwerk naast de bestaande,
   maar de LAAG EROVER. De Salon, Pulse, RTG Zakelijk, de genootschappen en de
   verhalen blijven waar ze zijn, met hun eigen poorten en hun eigen keuring;
   dit domein geeft er één ingang op, met een schakelaar die niet van app
   verandert maar van wereld.

   Vier endpoints, en meer horen er ook niet te zijn:
     /api/wereld/state   -- wie ben ik, wat mag ik, welke modi staan open
     /api/wereld/feed    -- de ene tijdlijn, gefilterd op modus
     /api/wereld/modus   -- mijn gekozen modus onthouden
     /api/wereld/open    -- een rtg://-verwijzing omzetten naar een app + link

   Plaatsen zit hier bewust NIET bij. Wie plaatst, plaatst in de app die de post
   bezit -- zie de kop van kern/wereld/feed.js.

   LET OP, EEN NAAM DIE TWEE KEER BESTAAT. Het kantoor heeft al een "wereld":
   `/api/office/wereld` is de veldkaart met een bolletje per Stadsdoos en per
   functie (test/wereld.test.js). Dat is iets heel anders dan dit, en de twee
   raken elkaar nergens -- ander domein, ander pad, andere poort. De toetsen van
   deze laag heten daarom `wereldlaag`, zodat een bestandsnaam nooit de indruk
   wekt dat het over die andere gaat. */
'use strict';

module.exports = (kern) => {
  const { app, auth, db, save, liveCodename, zijnVrienden } = kern;
  const rechten = require('../kern/wereld/rechten');
  const koppel = require('../kern/wereld/koppel');
  const { feed } = require('../kern/wereld/feed')({ db, liveCodename, zijnVrienden });

  /* De gekozen modus is een VOORKEUR en geen recht. Hij wordt bij het lezen
     altijd opnieuw langs rechten.modusOpen gehaald: wie ooit Business koos en
     later terugvalt naar de gratis pas, hoort daar niet in te blijven staan
     omdat er een oude waarde in de database stond. De poort hangt aan het doel
     en niet aan wat de aanvrager eerder mocht (LAT-regel 7). */
  function W() {
    if (!db.data.wereld || typeof db.data.wereld !== 'object') db.data.wereld = { modus: {} };
    if (!db.data.wereld.modus || typeof db.data.wereld.modus !== 'object') db.data.wereld.modus = {};
    return db.data.wereld;
  }
  function mijnModus(req) {
    const gekozen = W().modus[req.session.key];
    return rechten.modusOpen(req.session.tier, gekozen) ? gekozen : 'alles';
  }

  /* De staat van de app bij het openen: wie ik ben, welke modi ik heb, welke
     profiellagen ik mag vullen en wat ik verder mag. Het scherm tekent zich
     hiermee; er staat geen tweede lijst in de HTML die kan gaan afwijken. */
  app.post('/api/wereld/state', auth, (req, res) => {
    const tier = req.session.tier;
    if (!rechten.TRAP.includes(tier))
      return res.status(403).json({ error: 'RTG Wereld is er voor leden met een pas.' });
    res.json({
      ik: { codenaam: liveCodename(req.session) || 'Een lid', pas: tier },
      modus: mijnModus(req),
      modi: rechten.modiVoor(tier),
      lagen: rechten.lagenVoor(tier),
      zichtbaarheden: rechten.ZICHTBAARHEDEN,
      vermogens: rechten.vermogens(tier),
      // de naad naar de aparte berichten-app; het scherm bouwt zelf geen links
      chatApp: '/apps/comm.html'
    });
  });

  app.post('/api/wereld/modus', auth, (req, res) => {
    const modus = String(req.body.modus || '');
    if (!rechten.modusOpen(req.session.tier, modus))
      return res.status(403).json({ error: 'Deze wereld hoort bij een andere pas.' });
    W().modus[req.session.key] = modus;
    save();
    res.json({ ok: true, modus });
  });

  app.post('/api/wereld/feed', auth, (req, res) => {
    const tier = req.session.tier;
    if (!rechten.TRAP.includes(tier))
      return res.status(403).json({ error: 'RTG Wereld is er voor leden met een pas.' });
    const modus = req.body.modus ? String(req.body.modus) : mijnModus(req);
    const uit = feed({ tier, key: req.session.key, modus, vanaf: req.body.vanaf, hoeveel: req.body.hoeveel });
    if (uit.error) return res.status(403).json(uit);
    res.json(uit);
  });

  /* Een verwijzing openen. Onbekend geeft 404 en geen homepage: zie de kop van
     kern/wereld/koppel.js. `naarGesprek` staat er los naast, want dat is de
     enige weg naar de berichten-app en die hoort één plek te hebben. */
  app.post('/api/wereld/open', auth, (req, res) => {
    const doel = koppel.open(req.body.ref);
    if (!doel) return res.status(404).json({ error: 'Deze verwijzing ken ik niet.' });
    res.json({ doel });
  });

  app.post('/api/wereld/gesprek', auth, (req, res) => {
    const url = koppel.naarGesprek(req.body.codenaam, req.body.over);
    if (!url) return res.status(400).json({ error: 'Met wie?' });
    res.json({ url });
  });
};
