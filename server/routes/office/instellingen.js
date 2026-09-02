/* Backoffice (deelmodule): DE INSTELLINGEN AANSLUITEN -- gemeente, luchthaven,
   vervoerder, rijk, politie, brandweer, ambulance, marechaussee.

   Waarom deze deur bestaat staat in kern/instelling.js; kort: die acht genres
   zijn 'intern' en worden dus nooit via het partnerformulier aangevraagd, maar
   ze kwamen alleen uit de demo-seed. Op een echte installatie stonden die
   werelden daardoor permanent leeg zonder enige weg naar binnen.

   ACHTER DE BOARDROOM, en niet achter de gedeelde kantoorcode. Aansluiten maakt
   een bedrijfscode en een beheer-inlog aan; dat is exact het gewicht van
   /api/office/partner/decide, dat om dezelfde reden boardroomAuth draagt. De
   lijst zelf mag het hele kantoor zien -- weten wélke gemeente er hangt is geen
   besluit.

   Draait op dezelfde gedeelde kern; gemount vanuit routes/office.js. */
module.exports = (octx) => {
  const { kern } = octx;
  const { app, boardroomAuth, boardroomWie, officeAuth, sseToOffice } = kern;
  const stuur = (res, r) => (r && r.error) ? res.status(r.status || 400).json({ error: r.error }) : res.json(r);

  app.post('/api/office/instelling/genres', officeAuth, (req, res) =>
    stuur(res, kern.instelling.instellingGenres()));
  app.post('/api/office/instellingen', officeAuth, (req, res) =>
    stuur(res, kern.instelling.instellingen()));

  app.post('/api/office/instelling/aansluiten', boardroomAuth, async (req, res) => {
    try {
      const r = await kern.instelling.instellingAansluiten(req.body || {}, boardroomWie(req));
      if (r && r.error) return res.status(r.status || 400).json({ error: r.error });
      sseToOffice('sync', { scope: 'team' });
      res.json(r);
    } catch (e) {
      console.error('[instelling]', e);
      res.status(500).json({ error: 'Er ging iets mis. Probeer het opnieuw.' });
    }
  });

  /* DE POSITIE VAN DE RTFOUNDATION. Zelfde deur, zelfde gewicht, andere
     rechtspersoon -- zie kern/rtfwallet.js. Hij staat hier en niet bij de
     giftroutes, omdat dit geen giftbesluit is maar het aanmaken van een
     werkplek: precies wat dit bestand doet.

     De STAND mag het hele kantoor zien (weten of de stichting een positie heeft
     is geen besluit); hem MAKEN is boardroom, want er komt een bedrijfscode en
     een beheer-PIN uit. */
  app.post('/api/office/rtfwallet', officeAuth, (req, res) =>
    stuur(res, kern.rtfWallet.stand()));

  app.post('/api/office/rtfwallet/maak', boardroomAuth, async (req, res) => {
    try {
      const r = await kern.rtfWallet.maak(req.body || {}, boardroomWie(req));
      if (r && r.error) return res.status(r.status || 400).json(r);
      sseToOffice('sync', { scope: 'team' });
      res.json(r);
    } catch (e) {
      console.error('[rtfwallet]', e);
      res.status(500).json({ error: 'Er ging iets mis. Probeer het opnieuw.' });
    }
  });
};
