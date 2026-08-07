/* Backoffice (deelmodule): DE LEDENBALIE -- de derde poort van het kantoor.
   Waarom hij bestaat en welke vijf regels erop staan: zie de kop van
   server/kern/ledenbalie.js. Hier alleen de deuren.

   TWEE SOORTEN DEUR, en het verschil is de hele opzet:

     de ZETELS      -> boardroomAuth. Wie er aan de balie mag zitten is een
                       bestuursbesluit, geen baliewerk. De gedeelde kantoorcode
                       deelt dus geen zetels uit; die wijst niemand aan.
     de BALIE zelf  -> officeAuth PLUS een zetel. De code opent het kantoor,
                       niet de balie.

   WIE ER ZIT, komt van boardroomWie(req): de sleutel van het lid-account dat
   aan de backoffice is gekoppeld, of van de eigenaar met zijn eigen inlog. Bij
   de kale gedeelde code is dat null -- en dan is er geen zetel, dus geen balie.
   Diezelfde functie levert ook wat er in het inzagejournaal komt te staan,
   zodat "wie keek er" en "wie mocht er kijken" per definitie dezelfde zijn. */
module.exports = (octx) => {
  const { kern } = octx;
  const { app, officeAuth, boardroomAuth, boardroomWie, ledenbalie } = kern;
  if (!ledenbalie) return;

  const stuur = (res, r) => res.status(r && r.status ? r.status : 200).json(r);
  const veilig = (res, werk) => {
    try { stuur(res, werk()); }
    catch (e) { console.error('[balie]', e); res.status(500).json({ error: 'Er ging iets mis. Probeer het opnieuw.' }); }
  };

  /* ---------------- de zetels: bestuurswerk ---------------- */
  app.post('/api/office/balie/zetels', boardroomAuth, (req, res) =>
    veilig(res, () => ledenbalie.balieZetels()));
  app.post('/api/office/balie/zetel', boardroomAuth, (req, res) => veilig(res, () => {
    const b = req.body || {};
    return b.weg ? ledenbalie.balieZetelWeg(b.key) : ledenbalie.balieZetelZet(b.key);
  }));

  /* ---------------- de balie: alleen met een zetel ----------------

     `zetel` komt UIT DE SESSIE (boardroomWie) en nooit uit de body. Zou hij
     aanleverbaar zijn, dan was de zetel een suggestie in plaats van een poort
     -- dezelfde regel als bij het actormodel van de communicatiekern. */
  const zetel = (req) => boardroomWie(req) || null;

  app.post('/api/office/balie/zoek', officeAuth, (req, res) => veilig(res, () => {
    const b = req.body || {};
    return ledenbalie.balieZoek(zetel(req), b.codenaam, b.reden);
  }));
  app.post('/api/office/balie/dossier', officeAuth, (req, res) => veilig(res, () => {
    const b = req.body || {};
    return ledenbalie.balieDossier(zetel(req), b.id, b.reden);
  }));
  app.post('/api/office/balie/herstel', officeAuth, (req, res) => veilig(res, () => {
    const b = req.body || {};
    return ledenbalie.balieHerstel(zetel(req), b.id, b.reden);
  }));
  app.post('/api/office/balie/klacht', officeAuth, (req, res) => veilig(res, () => {
    const b = req.body || {};
    return ledenbalie.balieKlachtOpen(zetel(req), b.id, b.soort, b.tekst);
  }));
  app.post('/api/office/balie/klacht/status', officeAuth, (req, res) => veilig(res, () => {
    const b = req.body || {};
    return ledenbalie.balieKlachtStatus(zetel(req), b.klachtId, b.status);
  }));
  app.post('/api/office/balie/abo', officeAuth, (req, res) => veilig(res, () => {
    const b = req.body || {};
    return ledenbalie.balieAboVoorstel(zetel(req), b.id, b.naarPas, b.reden);
  }));
};
