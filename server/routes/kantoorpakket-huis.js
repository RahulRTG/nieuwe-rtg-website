/* RTG Office, deel twee: de ingangen van het RTFoundation-huis en de
   werkplekken. Deel een (routes/kantoorpakket.js) heeft de zaak, de
   RTG-kantoren en het lid.

   WAAROM GESPLITST: samen paste het niet meer binnen de 10 KB-maat
   (scripts/check.js regel 13) toen de paden voluit kwamen te staan -- en
   voluit moeten ze, anders ziet de schakelkast ze niet (regel 45). De naad
   ligt op de INGANG en niet middenin de acties: alle vier de ingangen doen
   dezelfde twaalf dingen, alleen de sleutel en de kring verschillen.

   Gemount vanuit routes/kantoorpakket.js. */
module.exports = (kern, gedeeld) => {
  const { app, rtf, werkplek, boardroomWie, boardroomBaas, officeMijn, officeMaak, officeOpen,
    officeBewaar, officeWeg, officeSter, officeVersies, officeTerug, officeAI, officeKring,
    officeVul, officeUitslag } = kern;
  const { stuur, ruim } = gedeeld;

  /* RTF-leden: elk gezinsprofiel een eigen map (gezinscode + profieltoken in
     de body, zoals alle RTF-routes), met een kring per gezin: de maker kan
     een document met het eigen gezin delen (meelezen of samen schrijven),
     nooit daarbuiten. Een oppas of familielid (gast) leest alleen mee. */
  /* De gezinsdeur als ECHTE MIDDLEWARE: zo staat bij elke route zichtbaar
     welke deur hij heeft, voor een lezer en voor scripts/check.js regel 28
     (die het venster na de route leest en een poort in een wrapper dus niet
     ziet). De drive reist mee op req. */
  function rtfPoort(req, res, next) {
    const sess = rtf && rtf.verifieerProfiel(req.body.code, req.body.token);
    if (!sess) return res.status(403).json({ error: 'Log opnieuw in bij je gezin.' });
    const code = String(req.body.code || '').toUpperCase();
    req.drive = { key: 'rtf:' + code + ':' + sess.handle, kring: 'rtfgezin:' + code, gast: !!sess.gast };
    next();
  }
  /* Voluit. `schrijf: true` betekent: een gast leest mee maar maakt en
     bewerkt niet -- die grens hoort zichtbaar bij de route. */
  const rtfDoe = (fn, opties) => async (req, res) => {
    const s = req.drive;
    if (opties && opties.schrijf && s.gast) return res.status(403).json({ error: 'Als oppas of familielid lees je mee; maken en bewerken doet het gezin zelf.' });
    stuur(res, await fn(s, req.body || {}));
  };
  app.post('/api/rtf/kantoorpakket/mijn', rtfPoort, rtfDoe((s) => officeMijn(s.key, s.kring)));
  app.post('/api/rtf/kantoorpakket/maak', rtfPoort, rtfDoe((s, b) => officeMaak(s.key, b, s.kring), { schrijf: true }));
  app.post('/api/rtf/kantoorpakket/open', rtfPoort, rtfDoe((s, b) => officeOpen(s.key, b.id, s.kring)));
  app.post('/api/rtf/kantoorpakket/bewaar', ruim, rtfPoort, rtfDoe((s, b) => officeBewaar(s.key, b.id, b, s.kring), { schrijf: true, ruim: true }));
  app.post('/api/rtf/kantoorpakket/weg', rtfPoort, rtfDoe((s, b) => officeWeg(s.key, b.id), { schrijf: true }));
  app.post('/api/rtf/kantoorpakket/ster', rtfPoort, rtfDoe((s, b) => officeSter(s.key, b.id, b.aan), { schrijf: true }));
  app.post('/api/rtf/kantoorpakket/versies', rtfPoort, rtfDoe((s, b) => officeVersies(s.key, b.id, s.kring)));
  app.post('/api/rtf/kantoorpakket/terug', rtfPoort, rtfDoe((s, b) => officeTerug(s.key, b.id, b.nr), { schrijf: true }));
  app.post('/api/rtf/kantoorpakket/ai', rtfPoort, rtfDoe((s, b) => officeAI(s.key, b.id, b.opdracht, b.vraag, s.kring), { schrijf: true }));
  app.post('/api/rtf/kantoorpakket/gezin', rtfPoort, rtfDoe((s, b) => officeKring(s.key, b.id, b.rechten), { schrijf: true }));
  // invullen mag ook een oppas of familielid (gast): antwoorden is geen bewerken
  app.post('/api/rtf/kantoorpakket/vul', rtfPoort, rtfDoe((s, b) => officeVul(s.key, b.id, b, s.kring)));
  app.post('/api/rtf/kantoorpakket/uitslag', rtfPoort, rtfDoe((s, b) => officeUitslag(s.key, b.id, s.kring), { schrijf: true }));

  /* De werkplekken: elk huis zijn eigen kantoordrive, op dezelfde kern als de
     rest van RTG Office. RTG werkte al op 'rtg:kantoor'; de RTFoundation kreeg
     die drive nooit, en had dus geen eigen documenten. Nu heeft elk huis er
     een, met dezelfde drie soorten (tekst, blad, presentatie), dezelfde
     versies, dezelfde export en dezelfde AI-hulp.

     De deur is die van de werkplek zelf: de eigenaar mag in beide huizen, een
     medewerker alleen in het zijne. Wie geen sleutel heeft ziet de map niet,
     laat staan de inhoud. */
  const huisDrive = req => {
    const key = boardroomWie(req);
    const baas = boardroomBaas(key);
    const code = String((req.body || {}).bedrijf || '').toLowerCase();
    if (!werkplek.kent(code)) return { fout: { status: 404, error: 'Dit bedrijf kennen we niet.' } };
    if (!werkplek.magIn(code, key, baas)) return { fout: { status: 403, error: 'Deze werkplek is niet van u. Vraag de eigenaar om toegang tot dit bedrijf.' } };
    // de kring is het huis zelf: collega's van hetzelfde bedrijf delen de map
    return { key: code + ':kantoor', kring: 'werkplek:' + code };
  };
  // voluit, zelfde reden (scripts/check.js regel 45)
  /* Ook hier de deur als middleware: welke werkplek dit is, en of u erin
     mag, hoort zichtbaar bij de route te staan (scripts/check.js regel 28). */
  function huisPoort(req, res, next) {
    const s = huisDrive(req);
    if (s.fout) return res.status(s.fout.status).json({ error: s.fout.error });
    req.drive = s;
    next();
  }
  const huisDoe = (fn) => async (req, res) => stuur(res, await fn(req.drive, req.body || {}));
  app.post('/api/werkplek/kantoorpakket/mijn', huisPoort, huisDoe((s) => officeMijn(s.key, s.kring)));
  app.post('/api/werkplek/kantoorpakket/maak', huisPoort, huisDoe((s, b) => officeMaak(s.key, b, s.kring)));
  app.post('/api/werkplek/kantoorpakket/open', huisPoort, huisDoe((s, b) => officeOpen(s.key, b.id, s.kring)));
  app.post('/api/werkplek/kantoorpakket/bewaar', ruim, huisPoort, huisDoe((s, b) => officeBewaar(s.key, b.id, b, s.kring), { ruim: true }));
  app.post('/api/werkplek/kantoorpakket/weg', huisPoort, huisDoe((s, b) => officeWeg(s.key, b.id)));
  app.post('/api/werkplek/kantoorpakket/ster', huisPoort, huisDoe((s, b) => officeSter(s.key, b.id, b.aan)));
  app.post('/api/werkplek/kantoorpakket/versies', huisPoort, huisDoe((s, b) => officeVersies(s.key, b.id, s.kring)));
  app.post('/api/werkplek/kantoorpakket/terug', huisPoort, huisDoe((s, b) => officeTerug(s.key, b.id, b.nr)));
  app.post('/api/werkplek/kantoorpakket/ai', huisPoort, huisDoe((s, b) => officeAI(s.key, b.id, b.opdracht, b.vraag, s.kring)));
  app.post('/api/werkplek/kantoorpakket/vul', huisPoort, huisDoe((s, b) => officeVul(s.key, b.id, b, s.kring)));
  app.post('/api/werkplek/kantoorpakket/uitslag', huisPoort, huisDoe((s, b) => officeUitslag(s.key, b.id, s.kring)));
};
