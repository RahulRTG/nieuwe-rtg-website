/* Domein "leren": overhoorlijsten, het overhoorduel, samen-projecten en
   schrijven met buddy-feedback. Twee ingangen naar dezelfde motor, net als
   bij de spellen: de RTG-leden-app (Bearer-token) en de RTFoundation
   (gezinscode + profieltoken), zodat een RTG-ouder gewoon kan aanschuiven
   bij het project of het duel van een RTF-kind. Gasten doen niet mee. */
module.exports = (kern) => {
  const { app, auth, geenGast, rtf, leren } = kern;

  function rtfDeelnemer(req, res) {
    const sess = rtf.verifieerProfiel(req.body.code, req.body.token);
    if (!sess) { res.status(403).json({ error: 'Log opnieuw in bij je gezin.' }); return null; }
    if (sess.gast) { res.status(403).json({ error: 'Als oppas of familielid leer je hier niet mee.' }); return null; }
    return sess.handle;
  }
  const stuur = (res, r) => r.error ? res.status(r.status).json({ error: r.error }) : res.json(r);

  const ACTIES = {
    // overhoorlijsten
    lijsten: (mij) => leren.lijstenVan(mij),
    'lijst-maak': (mij, b) => leren.lijstMaak(mij, { naam: b.naam, paren: b.paren }),
    'lijst-haal': (mij, b) => leren.lijstHaal(mij, String(b.id || '')),
    'lijst-weg': (mij, b) => leren.lijstWeg(mij, String(b.id || '')),
    'lijst-ai': (mij, b) => leren.lijstAi(mij, b.onderwerp, b.groep),
    'overhoor-klaar': (mij, b) => leren.overhoorKlaar(mij, String(b.id || ''), b.goed, b.totaal),
    // samen leren: het overhoorduel
    'sessie-start': (mij, b) => leren.sessieStart(mij, { lijstId: b.lijstId, vrienden: b.vrienden, codenamen: b.codenamen }),
    'sessie-antwoord': (mij, b) => leren.sessieAntwoord(mij, String(b.id || ''), b.akkoord === true),
    sessies: (mij) => leren.sessiesVan(mij),
    'sessie-staat': (mij, b) => leren.sessieStaat(mij, String(b.id || '')),
    'sessie-zet': (mij, b) => leren.sessieZet(mij, String(b.id || ''), b.antwoord),
    // samen aan een project
    projecten: (mij) => leren.projectenVan(mij),
    'project-maak': (mij, b) => leren.projectMaak(mij, { titel: b.titel, wat: b.wat }),
    'project-uitnodig': (mij, b) => leren.projectUitnodig(mij, { id: b.id, vrienden: b.vrienden, codenamen: b.codenamen }),
    'project-antwoord': (mij, b) => leren.projectAntwoord(mij, String(b.id || ''), b.akkoord === true),
    'project-staat': (mij, b) => leren.projectStaat(mij, String(b.id || '')),
    'project-weg': (mij, b) => leren.projectWeg(mij, String(b.id || '')),
    'taak-maak': (mij, b) => leren.taakMaak(mij, { id: b.id, tekst: b.tekst }),
    'taak-zet': (mij, b) => leren.taakZet(mij, { id: b.id, taakId: b.taakId, af: b.af, claim: b.claim }),
    notitie: (mij, b) => leren.notitie(mij, { id: b.id, tekst: b.tekst }),
    'project-ai': (mij, b) => leren.projectAi(mij, { id: b.id, groep: b.groep }),
    // schrijven
    'schrijf-opdracht': (mij, b) => leren.schrijfOpdracht(b.groep, b.anders === true),
    'schrijf-feedback': (mij, b) => leren.schrijfFeedback(mij, { tekst: b.tekst, opdracht: b.opdracht, groep: b.groep, buddy: b.buddy }),
    'schrijf-bewaar': (mij, b) => leren.schrijfBewaar(mij, { opdracht: b.opdracht, tekst: b.tekst, feedback: b.feedback }),
    schrijfsels: (mij) => leren.schrijfselsVan(mij)
  };
  // vangnet: Express 4 vangt async-fouten niet zelf (zie routes/spellen.js)
  async function veilig(res, werk) {
    try { stuur(res, await werk()); }
    catch (e) { res.status(500).json({ error: 'Er ging iets mis. Probeer het opnieuw.' }); }
  }
  for (const [naam, doe] of Object.entries(ACTIES)) {
    app.post('/api/member/leren/' + naam, auth, (req, res) => {
      if (geenGast(req, res)) return;
      veilig(res, () => doe(req.session.key, req.body || {}));
    });
    app.post('/api/rtf/leren/' + naam, (req, res) => {
      const mij = rtfDeelnemer(req, res); if (!mij) return;
      veilig(res, () => doe(mij, req.body || {}));
    });
  }
};
