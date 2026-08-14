/* Domein "rtfbieb": de App-Bibliotheek van de RTFoundation. Achter de
   gezinscode + het profieltoken, met de leeftijdspoort van het profiel:
   beschermde profielen zien en installeren nooit iets boven hun groep.
   Gasten (oppas, opa/oma) mogen meekijken maar installeren niet. */
module.exports = (kern) => {
  const { app, rtf, rtfbieb } = kern;

  function profiel(req, res) {
    const sess = rtf.verifieerProfiel(req.body.code, req.body.token);
    if (!sess) { res.status(403).json({ error: 'Log opnieuw in bij je gezin.' }); return null; }
    const groep = (sess.p && sess.p.groep) || (sess.kind ? 'kind' : 'volw');
    return { handle: sess.handle, groep, gast: sess.gast, sess };
  }
  const stuur = (res, r) => r.error ? res.status(r.status || 400).json({ error: r.error }) : res.json(r);

  app.post('/api/rtf/bieb', (req, res) => {
    const s = profiel(req, res); if (!s) return;
    res.json(rtfbieb.overzicht(s.groep));
  });
  app.post('/api/rtf/bieb/catalogus', (req, res) => {
    const s = profiel(req, res); if (!s) return;
    res.json(rtfbieb.catalogus(s.groep, req.body || {}));
  });
  app.post('/api/rtf/bieb/installeer', (req, res) => {
    const s = profiel(req, res); if (!s) return;
    if (s.gast) return res.status(403).json({ error: 'Als oppas of familielid kijk je mee; installeren doet het gezin zelf.' });
    stuur(res, rtfbieb.installeer(s.handle, s.groep, req.body.id));
  });
  app.post('/api/rtf/bieb/weg', (req, res) => {
    const s = profiel(req, res); if (!s) return;
    if (s.gast) return res.status(403).json({ error: 'Als oppas of familielid kijk je mee; installeren doet het gezin zelf.' });
    stuur(res, rtfbieb.verwijder(s.handle, req.body.id));
  });
  app.post('/api/rtf/bieb/mijn', (req, res) => {
    const s = profiel(req, res); if (!s) return;
    res.json({ apps: rtfbieb.mijnApps(s.handle) });
  });

  /* De centrale leerlingdeur. De catalogus bepaalt welke leeftijd bij een app
     past; de gezinssessie, geboortedatum en echte klasinschrijving bepalen de
     passen. De browser ontvangt alleen het besluit en kan zichzelf dus geen
     hogere leeftijd of Schoolpas geven. */
  app.post('/api/rtf/toegang', (req, res) => {
    const s = profiel(req, res); if (!s) return;
    const rechten = rtf.leerlingPassen(s.sess);
    const heeftLeeftijd = rechten && rechten.leeftijdBevestigd;
    const isLeerling = rechten && rechten.leerling;
    const magApp = (a) => {
      if (!a || !rtfbieb.magZien(s.groep, a.doelgroep)) return false;
      /* Een kindprofiel zonder geboortedatum blijft dicht: een handmatig
         gekozen groep is geen leeftijdsbewijs. */
      if (s.sess.kind && !heeftLeeftijd) return false;
      if (s.gast && ['leren', 'spelen', 'geld'].includes(a.categorie)) return false;
      // het grote bord is de begeleiderskant; leerlingen zien het in Schrift
      if (a.sleutel === 'bord' && isLeerling) return false;
      return true;
    };
    const apps = rtfbieb.zichtbaar(s.groep).filter(magApp);
    const gevraagd = String(req.body.appId || '');
    const appItem = gevraagd ? rtfbieb.appVan(gevraagd.startsWith('rtf-') ? gevraagd : 'rtf-' + gevraagd) : null;
    const campus = req.body.scherm === 'campus';
    const toegestaan = campus ? !!(heeftLeeftijd && isLeerling) : (gevraagd ? !!(appItem && magApp(appItem)) : true);
    let reden = null;
    if (!toegestaan) {
      if (s.sess.kind && !heeftLeeftijd) reden = 'Vul eerst de geboortedatum in. Daarna maakt de server automatisch de juiste leeftijdspas.';
      else if (campus && !isLeerling) reden = 'De Campus is de persoonlijke werkplek van een leerlingprofiel.';
      else if (appItem && appItem.sleutel === 'bord' && isLeerling) reden = 'Het grote schoolbord is voor de begeleider. Jij ziet het bord veilig in Mijn schrift.';
      else if (gevraagd && !appItem) reden = 'Deze ruimte staat niet in de veilige Foundation-catalogus.';
      else reden = 'Deze ruimte hoort niet bij jouw leeftijd of pas.';
    }
    res.status(toegestaan ? 200 : 403).json({
      ok: toegestaan, toegestaan, reden, groep: s.groep,
      passen: rechten.passen, leeftijd: rechten.leeftijd, leeftijdBevestigd: rechten.leeftijdBevestigd,
      leerling: rechten.leerling, school: rechten.school,
      apps: apps.map(a => a.id), app: appItem ? { id: appItem.id, naam: appItem.naam, doelgroep: appItem.doelgroep } : null
    });
  });

  // de bibliothecaris, kindveilig: adviseert alleen echte apps uit de RTF-,
  // School- en Beroepen-Bibliotheek, op de leeftijdsgroep van het profiel
  app.post('/api/rtf/bieb/ai', async (req, res) => {
    const s = profiel(req, res); if (!s) return;
    try {
      const r = await kern.bibliothecaris.adviseer(String(req.body.vraag || ''), { wereld: 'rtf', groep: s.groep });
      const { status, ...rest } = r;
      res.status(status || 200).json(rest);
    } catch (e) { res.status(500).json({ error: 'Er ging iets mis. Probeer het opnieuw.' }); }
  });
};
