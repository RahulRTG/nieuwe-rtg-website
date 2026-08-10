/* Domein "leren", de RTFoundation-kant: dezelfde acties als de leden-kant
   (routes/leren.js), maar achter de gezinsdeur van het foundation-huis.

   WAAROM APART. Elke actie hangt op TWEE deuren, en samen paste dat niet meer
   binnen de 10 KB-maat (scripts/check.js regel 13) zodra de paden voluit
   kwamen te staan -- en voluit moeten ze, anders ziet de schakelkast ze niet
   (regel 45). De naad ligt op de deur en niet middenin een lijst acties: wie
   de foundation-kant zoekt, vindt hem hier compleet.

   De ACTIES zelf staan niet twee keer: dit bestand roept dezelfde
   kern-functies aan als zijn buurman. Gemount vanuit routes/leren.js. */
module.exports = (kern) => {
  const { app, rtf, leren } = kern;
  const stuur = (res, r) => r.error ? res.status(r.status).json({ error: r.error }) : res.json(r);

  /* De gezinsdeur als ECHTE MIDDLEWARE: zo staat bij elke route zichtbaar
     welke deur hij heeft, voor een lezer en voor scripts/check.js regel 28. */
  function huisPoort(req, res, next) {
    const sess = rtf.verifieerProfiel(req.body.code, req.body.token);
    if (!sess) return res.status(403).json({ error: 'Log opnieuw in bij je gezin.' });
    if (sess.gast) return res.status(403).json({ error: 'Als oppas of familielid leer je hier niet mee.' });
    req.huisLid = sess.handle;
    next();
  }

  // vangnet: Express 4 vangt async-fouten niet zelf (zie routes/spellen.js)
  async function veilig(res, werk) {
    try { stuur(res, await werk()); }
    catch (e) { res.status(500).json({ error: 'Er ging iets mis. Probeer het opnieuw.' }); }
  }
  const viaHuis = (fn) => (req, res) => veilig(res, () => fn(req.huisLid, req.body || {}));

  app.post('/api/rtf/leren/lijsten', huisPoort, viaHuis((mij) => leren.lijstenVan(mij)));
  app.post('/api/rtf/leren/lijst-maak', huisPoort, viaHuis((mij, b) => leren.lijstMaak(mij, { naam: b.naam, paren: b.paren })));
  app.post('/api/rtf/leren/lijst-haal', huisPoort, viaHuis((mij, b) => leren.lijstHaal(mij, String(b.id || ''))));
  app.post('/api/rtf/leren/lijst-weg', huisPoort, viaHuis((mij, b) => leren.lijstWeg(mij, String(b.id || ''))));
  app.post('/api/rtf/leren/lijst-ai', huisPoort, viaHuis((mij, b) => leren.lijstAi(mij, b.onderwerp, b.groep)));
  app.post('/api/rtf/leren/overhoor-klaar', huisPoort, viaHuis((mij, b) => leren.overhoorKlaar(mij, String(b.id || ''), b.goed, b.totaal)));
  app.post('/api/rtf/leren/herhaal', huisPoort, viaHuis((mij) => leren.herhaalVandaag(mij)));
  app.post('/api/rtf/leren/herhaal-antwoord', huisPoort, viaHuis((mij, b) => leren.herhaalAntwoord(mij, { lijstId: b.lijstId, idx: b.idx, goed: b.goed === true })));
  app.post('/api/rtf/leren/herhaal-stand', huisPoort, viaHuis((mij) => leren.herhaalStand(mij)));
  app.post('/api/rtf/leren/sessie-start', huisPoort, viaHuis((mij, b) => leren.sessieStart(mij, { lijstId: b.lijstId, vrienden: b.vrienden, codenamen: b.codenamen })));
  app.post('/api/rtf/leren/sessie-antwoord', huisPoort, viaHuis((mij, b) => leren.sessieAntwoord(mij, String(b.id || ''), b.akkoord === true)));
  app.post('/api/rtf/leren/sessies', huisPoort, viaHuis((mij) => leren.sessiesVan(mij)));
  app.post('/api/rtf/leren/sessie-staat', huisPoort, viaHuis((mij, b) => leren.sessieStaat(mij, String(b.id || ''))));
  app.post('/api/rtf/leren/sessie-zet', huisPoort, viaHuis((mij, b) => leren.sessieZet(mij, String(b.id || ''), b.antwoord)));
  app.post('/api/rtf/leren/projecten', huisPoort, viaHuis((mij) => leren.projectenVan(mij)));
  app.post('/api/rtf/leren/project-maak', huisPoort, viaHuis((mij, b) => leren.projectMaak(mij, { titel: b.titel, wat: b.wat })));
  app.post('/api/rtf/leren/project-uitnodig', huisPoort, viaHuis((mij, b) => leren.projectUitnodig(mij, { id: b.id, vrienden: b.vrienden, codenamen: b.codenamen })));
  app.post('/api/rtf/leren/project-antwoord', huisPoort, viaHuis((mij, b) => leren.projectAntwoord(mij, String(b.id || ''), b.akkoord === true)));
  app.post('/api/rtf/leren/project-staat', huisPoort, viaHuis((mij, b) => leren.projectStaat(mij, String(b.id || ''))));
  app.post('/api/rtf/leren/project-weg', huisPoort, viaHuis((mij, b) => leren.projectWeg(mij, String(b.id || ''))));
  app.post('/api/rtf/leren/taak-maak', huisPoort, viaHuis((mij, b) => leren.taakMaak(mij, { id: b.id, tekst: b.tekst })));
  app.post('/api/rtf/leren/taak-zet', huisPoort, viaHuis((mij, b) => leren.taakZet(mij, { id: b.id, taakId: b.taakId, af: b.af, claim: b.claim })));
  app.post('/api/rtf/leren/notitie', huisPoort, viaHuis((mij, b) => leren.notitie(mij, { id: b.id, tekst: b.tekst })));
  app.post('/api/rtf/leren/project-ai', huisPoort, viaHuis((mij, b) => leren.projectAi(mij, { id: b.id, groep: b.groep })));
  app.post('/api/rtf/leren/schrijf-opdracht', huisPoort, viaHuis((mij, b) => leren.schrijfOpdracht(b.groep, b.anders === true)));
  app.post('/api/rtf/leren/schrijf-feedback', huisPoort, viaHuis((mij, b) => leren.schrijfFeedback(mij, { tekst: b.tekst, opdracht: b.opdracht, groep: b.groep, buddy: b.buddy })));
  app.post('/api/rtf/leren/schrijf-bewaar', huisPoort, viaHuis((mij, b) => leren.schrijfBewaar(mij, { opdracht: b.opdracht, tekst: b.tekst, feedback: b.feedback })));
  app.post('/api/rtf/leren/schrijfsels', huisPoort, viaHuis((mij) => leren.schrijfselsVan(mij)));
};
