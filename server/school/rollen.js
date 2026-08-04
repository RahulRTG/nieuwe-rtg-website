/* School (deelmodule): rollen, rechten en het inzagejournaal -- de fundering
   onder de enterprise-lagen (inschrijving, zorg, aanwezigheid, veiligheid,
   financien, HR, analyse, koppelingen).

   Drie afspraken die dit meer maken dan een lijstje vinkjes:

   1. EEN RECHT HANGT AAN DE ROL, NIET AAN DE PERSOON. Wie iets mag, volgt uit
      de rollen die de directie heeft toegekend. Een leraar is geen half-
      zorgcoordinator omdat hij toevallig ook mentor is van een andere klas.
   2. DE SYSTEEMBEHEERDER KOMT NIET IN DOSSIERS. Hij beheert koppelingen en
      leest het journaal; leerlinggegevens, zorg, incidenten en geld staan
      voor hem dicht. Dat is geen vergeten recht maar het punt van de rol, en
      het staat als bewering in test/schoolrollen.test.js.
   3. ELKE BLIK OP EEN AFGESCHERMD DEEL WORDT GELOGD. Zorg, incidenten,
      personeelsdossiers en financien schrijven een regel in het journaal van
      de school: wie, wanneer, waarover en waarom. Het journaal bewaart de
      REDEN en de rol, nooit de opgevraagde inhoud -- anders is het een
      tweede, ongeschermde kopie van het dossier zelf (dezelfde regel als
      server/inzagelog.js voor de identiteitskluis). */
const ROLLEN = {
  directie:      { naam: 'Directie', rechten: ['*'] },
  bestuur:       { naam: 'Schoolbestuur', rechten: ['bestuur', 'analyse', 'financieel.lees'] },
  administratie: { naam: 'Administratie', rechten: ['leerling', 'leerling.schrijf', 'document', 'aanwezigheid', 'bezoeker'] },
  financieel:    { naam: 'Financiele afdeling', rechten: ['financieel', 'financieel.lees'] },
  hr:            { naam: 'HR', rechten: ['hr'] },
  roostermaker:  { naam: 'Roostermaker', rechten: ['rooster', 'leerling'] },
  mentor:        { naam: 'Mentor', rechten: ['leerling', 'aanwezigheid', 'zorg.signaal'] },
  zorg:          { naam: 'Zorgcoordinator', rechten: ['leerling', 'zorg', 'zorg.signaal'] },
  vertrouwen:    { naam: 'Vertrouwenspersoon', rechten: ['incident', 'incident.vertrouwelijk'] },
  leraar:        { naam: 'Docent', rechten: ['leerling', 'aanwezigheid'] },
  ondersteuning: { naam: 'Ondersteuning', rechten: ['leerling'] },
  gebouw:        { naam: 'Gebouw en veiligheid', rechten: ['veiligheid', 'bezoeker', 'aanwezigheid'] },
  extern:        { naam: 'Externe begeleider', rechten: ['zorg.gedeeld'] },
  beheerder:     { naam: 'Systeembeheerder', rechten: ['koppeling', 'journaal'] }
};
// wat een recht in gewone taal beschermt (voor het scherm en de uitleg bij een 403)
const RECHTUITLEG = {
  leerling: 'leerlinggegevens inzien', 'leerling.schrijf': 'leerlingen in- en uitschrijven',
  document: 'documenten en diploma\'s beheren', zorg: 'zorgdossiers inzien',
  'zorg.signaal': 'zorgsignalen zien zonder het dossier', 'zorg.gedeeld': 'alleen wat expliciet met u is gedeeld',
  incident: 'incidenten inzien', 'incident.vertrouwelijk': 'vertrouwelijke incidenten inzien',
  aanwezigheid: 'aanwezigheid en verlof', veiligheid: 'passen, gebouw en calamiteiten',
  bezoeker: 'bezoekersregistratie', financieel: 'financien beheren', 'financieel.lees': 'financiele cijfers lezen',
  hr: 'personeelszaken', rooster: 'roosters maken', analyse: 'dashboards en signalen',
  koppeling: 'koppelingen en webhooks', journaal: 'het inzagejournaal', bestuur: 'bestuursbeeld over vestigingen'
};

module.exports = (sctx) => {
  const { router, save, nu, schoon, S, eigenVeld, schoolVan, personeelVan } = sctx;

  // de rollen van een personeelslid; zonder toekenning valt hij terug op zijn
  // aanmeldrol, zodat bestaande scholen precies blijven werken zoals ze werkten
  const rollenVan = (p) => (Array.isArray(p.rollen) && p.rollen.length ? p.rollen : [p.rol === 'ondersteuning' ? 'ondersteuning' : 'leraar'])
    .filter(r => Object.prototype.hasOwnProperty.call(ROLLEN, r));

  function rechtenVan(p) {
    const uit = new Set();
    for (const r of rollenVan(p)) for (const recht of ROLLEN[r].rechten) uit.add(recht);
    return uit;
  }
  function mag(p, recht) {
    const r = rechtenVan(p);
    if (r.has('*')) return true;
    if (r.has(recht)) return true;
    // een grof recht dekt zijn eigen fijne varianten: 'zorg' dekt 'zorg.signaal'
    const stam = String(recht).split('.')[0];
    return stam !== recht && r.has(stam);
  }

  /* Het journaal. Bewust bij de school en niet bij de persoon: wie het dossier
     van een kind wil natrekken hoort het aan de school te kunnen vragen. */
  function journaal(sch) { if (!sch.journaal) sch.journaal = []; return sch.journaal; }
  function log(sch, wie, wat, over, reden) {
    journaal(sch).unshift({ at: nu(), wie: wie.naam || 'directie', rol: (rollenVan(wie)[0] || 'directie'),
      wat: String(wat).slice(0, 40), over: String(over || '').slice(0, 60), reden: schoon(reden, 120) || null });
    sch.journaal = sch.journaal.slice(0, 2000);
    save();
  }

  /* De gedeelde poort van alle enterprise-lagen. Twee sleutels komen binnen:
     het beheer-token van de school (directie: alles) of een personeel-token
     (de rollen bepalen). Een personeelslid dat nog op 'wacht' staat komt
     nergens in -- goedkeuring is de eerste poort, het recht de tweede. */
  function poort(req, res, recht) {
    const sch = eigenVeld(S(), String(req.body.schoolCode || '').trim().toUpperCase());
    if (!sch) { res.status(403).json({ error: 'Onbekende school.' }); return null; }
    const beheer = String(req.body.beheerToken || '');
    if (beheer && sch.token === beheer) return { sch, p: { naam: 'Directie', rollen: ['directie'] }, directie: true };
    const tok = String(req.body.personeelToken || '');
    const p = tok ? Object.values(sch.personeel || {}).find(x => x.token === tok) : null;
    if (!p) { res.status(403).json({ error: 'Onbekende school of verkeerd token.' }); return null; }
    if (p.status !== 'actief') { res.status(403).json({ error: 'De school moet je aanmelding eerst goedkeuren.' }); return null; }
    if (recht && !mag(p, recht)) {
      res.status(403).json({ error: 'Daar heb je geen recht op: ' + (RECHTUITLEG[recht] || recht) + '. Vraag de directie om de rol die daarbij hoort.',
        recht, rollen: rollenVan(p) });
      return null;
    }
    return { sch, p, directie: false };
  }

  /* ---------- de rollenkaart ----------
     Een waarheid over wie wat mag: het scherm verzint geen eigen lijst. */
  router.post('/school/rollen', (req, res) => {
    const g = poort(req, res); if (!g) return;
    res.json({ ok: true, directie: g.directie,
      mijn: { naam: g.p.naam, rollen: rollenVan(g.p), rechten: [...rechtenVan(g.p)] },
      rollen: Object.entries(ROLLEN).map(([id, r]) => ({ id, naam: r.naam, rechten: r.rechten,
        uitleg: r.rechten.map(x => RECHTUITLEG[x] || x) })),
      personeel: g.directie
        ? Object.values(g.sch.personeel || {}).map(p => ({ id: p.id, naam: p.naam, status: p.status, rollen: rollenVan(p) }))
        : undefined });
  });

  // de directie kent rollen toe. Alleen de directie: een rol die je jezelf kunt
  // geven is geen recht maar een knop.
  router.post('/school/personeel/rollen', (req, res) => {
    const sch = schoolVan(req, res); if (!sch) return;
    const p = eigenVeld(sch.personeel || {}, req.body.personeelId);
    if (!p) return res.status(404).json({ error: 'Dit personeelslid is niet gevonden.' });
    const gevraagd = Array.isArray(req.body.rollen) ? req.body.rollen.map(String) : [];
    const onbekend = gevraagd.filter(r => !Object.prototype.hasOwnProperty.call(ROLLEN, r) || r === 'directie');
    if (onbekend.length) return res.status(400).json({ error: 'Onbekende of niet toe te kennen rol: ' + onbekend.join(', ') + '. De directie-rol hangt aan het beheer-token van de school.' });
    p.rollen = [...new Set(gevraagd)].slice(0, 6);
    log(sch, { naam: 'Directie', rollen: ['directie'] }, 'rollen-gezet', p.id, 'rolwijziging door de directie');
    save();
    res.json({ ok: true, personeelId: p.id, rollen: rollenVan(p), rechten: [...rechtenVan(p)] });
  });

  /* Het journaal lezen: de directie en de systeembeheerder (die het beheert
     maar de inhoud eronder niet mag zien). Filteren kan op wat en waarover. */
  router.post('/school/journaal', (req, res) => {
    const g = poort(req, res, 'journaal'); if (!g) return;
    const wat = schoon(req.body.wat, 40), over = schoon(req.body.over, 60);
    const rijen = journaal(g.sch)
      .filter(r => (!wat || r.wat === wat) && (!over || r.over === over))
      .slice(0, Math.min(200, Number(req.body.limiet) || 100));
    res.json({ ok: true, aantal: journaal(g.sch).length, rijen,
      uitleg: 'Het journaal legt vast dat er is gekeken, door wie en waarom -- nooit wat er stond.' });
  });

  // eigen rechten opvragen zonder de hele kaart (voor het scherm van een leraar)
  router.post('/school/mijn-rechten', (req, res) => {
    const pv = personeelVan(req, res); if (!pv) return;
    res.json({ ok: true, naam: pv.p.naam, status: pv.p.status, rollen: rollenVan(pv.p), rechten: [...rechtenVan(pv.p)] });
  });

  return { ROLLEN, rollenVan, rechtenVan, mag, poort, log, journaal };
};
