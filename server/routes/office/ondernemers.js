/* Backoffice (deelmodule): de ONDERNEMERSKANT van het kantoor -- de regie over
   het Ondernemers-OS, de rechtsvormwacht, en de catalogus-wensen die uit de
   onboarding komen.

   Geknipt uit ./partners.js toen dat bestand over de 10 kB van het modulebeleid
   ging, en langs de naad die er al lag: daar staan de BESLUITEN over partners,
   scholen en het vertrouwenskanaal, hier de knoppen en lijsten die over
   ondernemers gaan. Ze veranderen ook om verschillende redenen.

   Draait op dezelfde gedeelde kern; gemount vanuit routes/office.js. */
module.exports = (octx) => {
  const { kern } = octx;
  const { app, boardroomWie, officeAuth, sseToOffice,
    ondernemingRegie, ondernemingProvisioningZet, ondernemingBijdrageZet, rechtsvormwacht } = kern;

  /* ---- de ondernemersregie: twee knoppen van de boardroom ----
     Achter de kantoorpoort, en elke wijziging komt met een naam in het
     journaal. Zie kern/onderneming/regie.js voor waarom soepeler zetten een
     naam vraagt en strenger zetten niet. */
  app.post('/api/office/ondernemersregie', officeAuth, (req, res) => {
    res.json({ ok: true, regie: ondernemingRegie() });
  });

  app.post('/api/office/ondernemersregie/provisioning', officeAuth, (req, res) => {
    const r = ondernemingProvisioningZet(String((req.body || {}).stand || ''), boardroomWie(req));
    res.status(r.status || 200).json(r);
  });

  app.post('/api/office/ondernemersregie/bijdrage', officeAuth, (req, res) => {
    const r = ondernemingBijdrageZet(req.body || {}, boardroomWie(req));
    res.status(r.status || 200).json(r);
  });

  /* ---- de catalogus-wensen ----
     Wat een ondernemer bij de onboarding vroeg ("zet mijn bedrijf op de lijst"),
     en wat het kantoor ermee deed. Op codenaam. Het besluit maakt GEEN zaak: dat
     blijft de partnerweg hierboven, mét Business Pass-bewijs. Zonder deze twee
     routes was die wens een belofte zonder lezer -- zie kern/onderneming/catalogus.js. */
  app.post('/api/office/catalogus-wensen', officeAuth, (req, res) => {
    res.json(kern.catalogusWensen());
  });
  app.post('/api/office/catalogus-wens/besluit', officeAuth, (req, res) => {
    const b = req.body || {};
    const r = kern.catalogusWensBesluit(b.id, b.besluit, boardroomWie(req), b.notitie);
    if (r.error) return res.status(r.status || 400).json({ error: r.error });
    sseToOffice('sync', { scope: 'partners' });
    res.json(r);
  });

  /* ---- de rechtsvormwacht ----
     De stand van het rechtsvormenregister en een handmatige controle. Zetten
     kan ook met de hand, maar langs dezelfde gevalideerde weg als een bron:
     een tweede, soepelere ingang zou de grendels omzeilen die er juist voor de
     bron staan. Zie kern/onderneming/rechtsvormwacht.js. */
  app.post('/api/office/rechtsvormwacht', officeAuth, (req, res) => {
    res.json({ ok: true, wacht: rechtsvormwacht.status() });
  });

  app.post('/api/office/rechtsvormwacht/check', officeAuth, async (req, res) => {
    const r = await rechtsvormwacht.check();
    res.json(Object.assign({ ok: true }, r, { wacht: rechtsvormwacht.status() }));
  });

  app.post('/api/office/rechtsvormwacht/zet', officeAuth, (req, res) => {
    const r = rechtsvormwacht.pasToe(req.body || {}, 'kantoor: ' + boardroomWie(req));
    res.json(Object.assign({}, r, { wacht: rechtsvormwacht.status() }));
  });
};
