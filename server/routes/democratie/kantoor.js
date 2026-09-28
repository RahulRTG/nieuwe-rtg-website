/* Routes "democratie", de kant van het kantoor (kern/democratie/).

   ALLES OP NAAM. Een besluit over een kwestie moet terug te voeren zijn op een
   mens (DO-09, macht is zichtbaar): `boardroomWie(req)` geeft alleen een
   sleutel als er een eigen account achter het kantoortoken zit. Met de gedeelde
   kantoorcode blijft dat leeg, en dan weigert deze deur -- ook bij het lezen,
   want een kwestie draagt vrije tekst van een burger. Een spoor dat eindigt bij
   een gedeelde code is geen spoor (KANTOORMACHT.md). */
'use strict';

module.exports = ({ app, officeAuth, boardroomWie, democratie, stuur }) => {
  const opNaam = async (req, res, werk) => {
    const wie = boardroomWie(req);
    if (!wie) {
      return res.status(403).json({ error: 'Kwesties behandelen gaat op naam: log in met uw eigen account in de kantoorrol, niet met de gedeelde code.' });
    }
    try { stuur(res, await werk(wie, req.body || {})); }
    catch (e) { console.error('[democratie]', e); res.status(500).json({ error: 'Dit lukte niet.' }); }
  };

  app.post('/api/office/democratie/kwestie/lijst', officeAuth, (req, res) =>
    opNaam(req, res, () => democratie.lijst()));

  app.post('/api/office/democratie/kwestie/behandel', officeAuth, (req, res) =>
    opNaam(req, res, (wie, b) => democratie.behandel(wie, b)));

  app.post('/api/office/democratie/kwestie/eindstand', officeAuth, (req, res) =>
    opNaam(req, res, (wie, b) => democratie.sluit(wie, b)));

  app.post('/api/office/democratie/kwestie/heropen', officeAuth, (req, res) =>
    opNaam(req, res, (wie, b) => democratie.heropen(wie, b)));

  app.post('/api/office/democratie/kwestie/herbezorg', officeAuth, (req, res) =>
    opNaam(req, res, () => democratie.herbezorg()));

  app.post('/api/office/democratie/meter', officeAuth, (req, res) =>
    opNaam(req, res, () => democratie.meter()));
};
