/* Domein "leren": overhoorlijsten, het overhoorduel, samen-projecten en
   schrijven met buddy-feedback. Twee ingangen naar dezelfde motor, net als
   bij de spellen: de RTG-leden-app (Bearer-token) en de RTFoundation
   (gezinscode + profieltoken), zodat een RTG-ouder gewoon kan aanschuiven
   bij het project of het duel van een RTF-kind. Gasten doen niet mee. */
module.exports = (kern) => {
  const { app, auth, geenGast, rtf, leren } = kern;

  /* De gezinsdeur als ECHTE MIDDLEWARE en niet als aanroep binnenin: zo staat
     bij elke route zichtbaar welke deur hij heeft, voor een lezer en voor
     scripts/check.js regel 28 (die het venster na de route leest en een poort
     in een wrapper dus niet ziet). Wie er doorheen komt, reist mee op req. */
  function huisPoort(req, res, next) {
    const sess = rtf.verifieerProfiel(req.body.code, req.body.token);
    if (!sess) return res.status(403).json({ error: 'Log opnieuw in bij je gezin.' });
    if (sess.gast) return res.status(403).json({ error: 'Als oppas of familielid leer je hier niet mee.' });
    req.huisLid = sess.handle;
    next();
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
    // de eerlijke vergeetcurve: de dagstapel, een antwoord en het bakjesoverzicht
    herhaal: (mij) => leren.herhaalVandaag(mij),
    'herhaal-antwoord': (mij, b) => leren.herhaalAntwoord(mij, { lijstId: b.lijstId, idx: b.idx, goed: b.goed === true }),
    'herhaal-stand': (mij) => leren.herhaalStand(mij),
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

  /* ELKE ACTIE HANGT OP TWEE DEUREN: de leden-app en het RTFoundation-huis.
     Dat was een lus over de actie-tabel met opgebouwde paden, en daardoor zag
     scripts/schakelbaar.js geen van beide -- niet uit te zetten, niet per stad
     te sluiten (scripts/check.js regel 45). Uitgeschreven staat er nu ook
     zwart op wit DAT het er twee zijn, en dat is winst op zichzelf: wie de
     ene deur dichtzet, ziet hier meteen dat er nog een is.

     De twee poorten verschillen en blijven elk op EEN plek: een lid komt
     binnen op zijn sessie (geen gasten), een deelnemer van de foundation op
     zijn gezinscode. */
  /* geenGast blijft hier BINNEN en wordt geen middleware: hij geeft true of
     false terug en roept geen next(), dus als middleware zou elk verzoek
     blijven hangen. De poort die regel 28 ziet is `auth` ervoor; deze tweede
     controle sluit de anonieme demo-gast uit. */
  const viaLid = (fn) => (req, res) => {
    if (geenGast(req, res)) return;
    veilig(res, () => fn(req.session.key, req.body || {}));
  };
  const viaHuis = (fn) => (req, res) => {
    veilig(res, () => fn(req.huisLid, req.body || {}));
  };

  app.post('/api/member/leren/lijsten', auth, viaLid((mij) => leren.lijstenVan(mij)));
  app.post('/api/member/leren/lijst-maak', auth, viaLid((mij, b) => leren.lijstMaak(mij, { naam: b.naam, paren: b.paren })));
  app.post('/api/member/leren/lijst-haal', auth, viaLid((mij, b) => leren.lijstHaal(mij, String(b.id || ''))));
  app.post('/api/member/leren/lijst-weg', auth, viaLid((mij, b) => leren.lijstWeg(mij, String(b.id || ''))));
  app.post('/api/member/leren/lijst-ai', auth, viaLid((mij, b) => leren.lijstAi(mij, b.onderwerp, b.groep)));
  app.post('/api/member/leren/overhoor-klaar', auth, viaLid((mij, b) => leren.overhoorKlaar(mij, String(b.id || ''), b.goed, b.totaal)));
  app.post('/api/member/leren/herhaal', auth, viaLid((mij) => leren.herhaalVandaag(mij)));
  app.post('/api/member/leren/herhaal-antwoord', auth, viaLid((mij, b) => leren.herhaalAntwoord(mij, { lijstId: b.lijstId, idx: b.idx, goed: b.goed === true })));
  app.post('/api/member/leren/herhaal-stand', auth, viaLid((mij) => leren.herhaalStand(mij)));
  app.post('/api/member/leren/sessie-start', auth, viaLid((mij, b) => leren.sessieStart(mij, { lijstId: b.lijstId, vrienden: b.vrienden, codenamen: b.codenamen })));
  app.post('/api/member/leren/sessie-antwoord', auth, viaLid((mij, b) => leren.sessieAntwoord(mij, String(b.id || ''), b.akkoord === true)));
  app.post('/api/member/leren/sessies', auth, viaLid((mij) => leren.sessiesVan(mij)));
  app.post('/api/member/leren/sessie-staat', auth, viaLid((mij, b) => leren.sessieStaat(mij, String(b.id || ''))));
  app.post('/api/member/leren/sessie-zet', auth, viaLid((mij, b) => leren.sessieZet(mij, String(b.id || ''), b.antwoord)));
  app.post('/api/member/leren/projecten', auth, viaLid((mij) => leren.projectenVan(mij)));
  app.post('/api/member/leren/project-maak', auth, viaLid((mij, b) => leren.projectMaak(mij, { titel: b.titel, wat: b.wat })));
  app.post('/api/member/leren/project-uitnodig', auth, viaLid((mij, b) => leren.projectUitnodig(mij, { id: b.id, vrienden: b.vrienden, codenamen: b.codenamen })));
  app.post('/api/member/leren/project-antwoord', auth, viaLid((mij, b) => leren.projectAntwoord(mij, String(b.id || ''), b.akkoord === true)));
  app.post('/api/member/leren/project-staat', auth, viaLid((mij, b) => leren.projectStaat(mij, String(b.id || ''))));
  app.post('/api/member/leren/project-weg', auth, viaLid((mij, b) => leren.projectWeg(mij, String(b.id || ''))));
  app.post('/api/member/leren/taak-maak', auth, viaLid((mij, b) => leren.taakMaak(mij, { id: b.id, tekst: b.tekst })));
  app.post('/api/member/leren/taak-zet', auth, viaLid((mij, b) => leren.taakZet(mij, { id: b.id, taakId: b.taakId, af: b.af, claim: b.claim })));
  app.post('/api/member/leren/notitie', auth, viaLid((mij, b) => leren.notitie(mij, { id: b.id, tekst: b.tekst })));
  app.post('/api/member/leren/project-ai', auth, viaLid((mij, b) => leren.projectAi(mij, { id: b.id, groep: b.groep })));
  app.post('/api/member/leren/schrijf-opdracht', auth, viaLid((mij, b) => leren.schrijfOpdracht(b.groep, b.anders === true)));
  app.post('/api/member/leren/schrijf-feedback', auth, viaLid((mij, b) => leren.schrijfFeedback(mij, { tekst: b.tekst, opdracht: b.opdracht, groep: b.groep, buddy: b.buddy })));
  app.post('/api/member/leren/schrijf-bewaar', auth, viaLid((mij, b) => leren.schrijfBewaar(mij, { opdracht: b.opdracht, tekst: b.tekst, feedback: b.feedback })));
  app.post('/api/member/leren/schrijfsels', auth, viaLid((mij) => leren.schrijfselsVan(mij)));

  /* De foundation-kant staat in een eigen bestand: samen pasten de twee
     deuren niet meer binnen de 10 KB-maat toen de paden voluit kwamen. */
  require('./leren-huis')(kern);
};
