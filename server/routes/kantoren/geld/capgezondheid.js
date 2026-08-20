/* Kantoren, deel "geld/gezondheid": hoe het met elk ONDERDEEL gaat, en de twee
   knoppen om er een dicht te zetten of vrij te geven.

   NIET "HET HUIS DOET HET" MAAR "de uitbetaalrail hapert en de kassa loopt".
   Zie kern/commercie/capgezondheid.js -- met name waarom quarantaine altijd EEN
   capability raakt en nooit het hele platform, en waarom een onderdeel er wel
   automatisch in komt en er nooit automatisch uit.

   Een eigen bestand en niet erbij in ./commercie.js: dat gaat over wat er met de
   AFSPRAKEN gebeurt, dit over of iets WERKT. Gemount vanuit ./commercie.js, met
   dezelfde context. */
module.exports = (ctx) => {
  const { app, officeAuth, boardroomAuth, veilig, afdelingen, kern } = ctx;

  /* `ongemeten` staat er met opzet bij: een bord dat na een stille nacht overal
     groen staat, is een bord dat niets zegt. */
  app.post('/api/office/gezondheid', officeAuth, (req, res) => veilig(res, () => {
    if (!kern || !kern.capGezondheid) return { status: 503, error: 'De gezondheidslaag is niet gemount.' };
    return { status: 200, ok: true, onderdelen: kern.capGezondheid.lijst(), zorgen: kern.capGezondheid.zorgen() };
  }));

  /* Dicht zetten en vrijgeven zijn allebei MENSENhandelingen, met een naam in
     het journaal. Een onderdeel komt automatisch in quarantaine maar er nooit
     automatisch uit: een systeem dat zichzelf dicht doet en zichzelf weer open
     doet, verbergt precies de storing die je had willen zien. */
  app.post('/api/office/gezondheid/quarantaine', boardroomAuth, (req, res) => veilig(res, () => {
    if (!kern || !kern.capGezondheid) return { status: 503, error: 'De gezondheidslaag is niet gemount.' };
    const b = req.body || {};
    const wie = String(b.naam || '').slice(0, 60);
    const r = kern.capGezondheid.quarantaine(b.cap, b.reden, wie);
    if (r.ok) afdelingen.audit(wie, 'Onderdeel ' + b.cap + ' in quarantaine: ' + String(b.reden || '').slice(0, 120));
    return r;
  }));

  app.post('/api/office/gezondheid/vrij', boardroomAuth, (req, res) => veilig(res, () => {
    if (!kern || !kern.capGezondheid) return { status: 503, error: 'De gezondheidslaag is niet gemount.' };
    const b = req.body || {};
    const wie = String(b.naam || '').slice(0, 60);
    const r = kern.capGezondheid.geefVrij(b.cap, wie);
    if (r.ok) afdelingen.audit(wie, 'Onderdeel ' + b.cap + ' vrijgegeven');
    return r;
  }));
};
