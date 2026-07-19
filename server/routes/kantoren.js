/* Domein "kantoren": de afdelingskamers en de boardroom van RTG zelf.
   Alles achter de office-inlog (dezelfde als de backoffice); het schakelen
   van functies raakt het hele platform en hoort dus bij het kantoor. */
module.exports = (kern) => {
  const { app, officeAuth, afdelingen, sseToOffice, db, save,
    geldOverzicht, geldPasprijzen, geldPasprijsZet, geldCommissieZet, geldKortingZet } = kern;
  const stuur = (res, r) => r.error ? res.status(r.status).json({ error: r.error }) : res.json(r);
  const veilig = (res, werk) => { try { stuur(res, werk()); } catch (e) { console.error('[kantoren]', e); res.status(500).json({ error: 'Er ging iets mis. Probeer het opnieuw.' }); } };

  app.post('/api/office/kamers', officeAuth, (req, res) => veilig(res, () => afdelingen.kamers()));
  app.post('/api/office/kamer', officeAuth, (req, res) => veilig(res, () => afdelingen.kamer(String(req.body.id || ''))));
  app.post('/api/office/kamer/taak', officeAuth, (req, res) => veilig(res, () => afdelingen.taakMaak(String(req.body.id || ''), req.body.tekst)));
  app.post('/api/office/kamer/taak-zet', officeAuth, (req, res) => veilig(res, () => afdelingen.taakZet(String(req.body.id || ''), String(req.body.taakId || ''), req.body.af)));
  app.post('/api/office/boardroom', officeAuth, (req, res) => veilig(res, () => afdelingen.boardroom()));
  app.post('/api/office/boardroom/schakel', officeAuth, (req, res) => veilig(res, () => {
    const r = afdelingen.schakel(String(req.body.functie || ''), req.body.aan === true, req.body.doelgroep ? String(req.body.doelgroep) : null, req.body.naam ? String(req.body.naam) : 'boardroom');
    if (r.ok) sseToOffice('sync', { scope: 'boardroom' });
    return r;
  }));
  app.post('/api/office/boardroom/verbeter', officeAuth, (req, res) => veilig(res, () => ({ ok: true, verbeterkamer: afdelingen.voorstellen(true) })));
  // de leveranciers-regie: een functie per genre zaken open of dicht
  app.post('/api/office/boardroom/genre', officeAuth, (req, res) => veilig(res, () => {
    const r = afdelingen.schakelGenre(String(req.body.functie || ''), String(req.body.genre || ''),
      req.body.aan === true, req.body.naam ? String(req.body.naam) : 'boardroom');
    if (r.ok) sseToOffice('sync', { scope: 'boardroom' });
    return r;
  }));
  // de grote hendel: alles bij iedereen beschikbaar zetten of sluiten (intern blijft open)
  app.post('/api/office/boardroom/alles', officeAuth, (req, res) => veilig(res, () => {
    const r = afdelingen.schakelAlles(req.body.aan === true, req.body.naam ? String(req.body.naam) : 'boardroom');
    if (r.ok) sseToOffice('sync', { scope: 'boardroom' });
    return r;
  }));
  // de uitrolfases: in EEN klik de hele kast in de stand van een fase
  /* De AI-regie: de boardroom vult Rahuls karakter en verhaal aan. De
     vaste kern van het karakter blijft in de code staan (bewaakt door de
     drift-tests); deze aanvullingen komen live in ELKE assistent mee. */
  app.post('/api/office/boardroom/rahul', officeAuth, (req, res) => {
    res.json({ ok: true, profiel: db.data.rahulProfiel || { karakter: '', verhaal: '' } });
  });
  app.post('/api/office/boardroom/rahul/zet', officeAuth, (req, res) => {
    const kort = v => String(v == null ? '' : v).trim().slice(0, 2000);
    db.data.rahulProfiel = { karakter: kort(req.body.karakter), verhaal: kort(req.body.verhaal), at: new Date().toISOString() };
    save();
    sseToOffice('sync', { scope: 'boardroom' });
    res.json({ ok: true, profiel: db.data.rahulProfiel });
  });

  /* De identiteitskluis-inzage: kamers met naamInzage (en de boardroom)
     vragen de echte naam bij een codenaam op; elke opvraging komt in het
     auditlog, ook zonder treffer. */
  app.post('/api/office/inzage', officeAuth, async (req, res) => {
    try { stuur(res, await afdelingen.naamInzage(String(req.body.kamer || ''), req.body.codenaam, req.body.naam ? String(req.body.naam) : null)); }
    catch (e) { console.error('[kantoren]', e); res.status(500).json({ error: 'Er ging iets mis. Probeer het opnieuw.' }); }
  });
  // de kantine: de kaart van vandaag lezen en zetten
  app.post('/api/office/kantine/menu', officeAuth, (req, res) => veilig(res, () => afdelingen.kantineMenu()));
  app.post('/api/office/kantine/menu-zet', officeAuth, (req, res) => veilig(res, () => afdelingen.kantineMenuZet(req.body.items, req.body.naam)));
  /* De doos-regie: beheer op afstand van de Zaakdoos-vloot. Het kantoor zet
     de doelversie en per doos een netwerkrol; de doos haalt beide zelf op
     bij zijn eigen melding (de cloud duwt nooit iets naar binnen). */
  // het gezamenlijke rampbeeld: de boardroom ziet alle korpsen, zorg en defensie
  app.post('/api/office/rampbeeld', officeAuth, (req, res) => veilig(res, () => kern.rampbeeld.beeld(null)));
  app.post('/api/office/rampbeeld/schaal', officeAuth, (req, res) => veilig(res, () => kern.rampbeeld.schaal(String(req.body.niveau || ''), req.body.naam || 'boardroom')));
  app.post('/api/office/rampbeeld/evaluatie', officeAuth, (req, res) => veilig(res, () => kern.rampbeeld.evaluatie(null)));
  app.post('/api/office/rampbeeld/ai', officeAuth, async (req, res) => {
    try { const r = await kern.rampbeeld.coordinatorAi(null, req.body.q); r.error ? res.status(r.status || 400).json({ error: r.error }) : res.json(r); }
    catch (e) { console.error('[rampbeeld]', e); res.status(500).json({ error: 'Er ging iets mis. Probeer het opnieuw.' }); }
  });
  /* RTG Atelier: het ontwerpbureau. Ontwerpen maken en bijwerken, de
     AI-concepten, tech packs en de kritiek van de creatief directeur. */
  app.post('/api/office/atelier', officeAuth, (req, res) => veilig(res, () => kern.atelier.overzicht()));
  app.post('/api/office/atelier/maak', officeAuth, (req, res) => veilig(res, () => kern.atelier.ontwerpMaak(req.body || {})));
  app.post('/api/office/atelier/zet', officeAuth, (req, res) => veilig(res, () => kern.atelier.ontwerpZet(String(req.body.id || ''), req.body || {})));
  app.post('/api/office/atelier/verwijder', officeAuth, (req, res) => veilig(res, () => kern.atelier.ontwerpVerwijder(String(req.body.id || ''))));
  app.post('/api/office/atelier/collectie', officeAuth, (req, res) => veilig(res, () => kern.atelier.collectieMaak(req.body || {})));
  app.post('/api/office/atelier/techpack', officeAuth, (req, res) => veilig(res, () => kern.atelier.aiTechpack(String(req.body.id || ''))));
  app.post('/api/office/atelier/concept', officeAuth, async (req, res) => {
    try { const r = await kern.atelier.aiConcept(String(req.body.id || '')); r.error ? res.status(r.status || 400).json({ error: r.error }) : res.json(r); }
    catch (e) { console.error('[atelier]', e); res.status(500).json({ error: 'Er ging iets mis. Probeer het opnieuw.' }); }
  });
  app.post('/api/office/atelier/kritiek', officeAuth, async (req, res) => {
    try { const r = await kern.atelier.aiKritiek(String(req.body.id || ''), req.body.q); r.error ? res.status(r.status || 400).json({ error: r.error }) : res.json(r); }
    catch (e) { console.error('[atelier]', e); res.status(500).json({ error: 'Er ging iets mis. Probeer het opnieuw.' }); }
  });

  /* RTG Ontwerpstudio: het voertuig- en vaartuig-ontwerpbureau. Zelfde vorm
     als het atelier: concepten met AI, specsheet en de chef-ontwerper. */
  app.post('/api/office/studio', officeAuth, (req, res) => veilig(res, () => kern.studio.overzicht()));
  app.post('/api/office/studio/maak', officeAuth, (req, res) => veilig(res, () => kern.studio.ontwerpMaak(req.body || {})));
  app.post('/api/office/studio/zet', officeAuth, (req, res) => veilig(res, () => kern.studio.ontwerpZet(String(req.body.id || ''), req.body || {})));
  app.post('/api/office/studio/verwijder', officeAuth, (req, res) => veilig(res, () => kern.studio.ontwerpVerwijder(String(req.body.id || ''))));
  app.post('/api/office/studio/collectie', officeAuth, (req, res) => veilig(res, () => kern.studio.collectieMaak(req.body || {})));
  app.post('/api/office/studio/specsheet', officeAuth, (req, res) => veilig(res, () => kern.studio.aiSpecsheet(String(req.body.id || ''))));
  app.post('/api/office/studio/concept', officeAuth, async (req, res) => {
    try { const r = await kern.studio.aiConcept(String(req.body.id || '')); r.error ? res.status(r.status || 400).json({ error: r.error }) : res.json(r); }
    catch (e) { console.error('[studio]', e); res.status(500).json({ error: 'Er ging iets mis. Probeer het opnieuw.' }); }
  });
  app.post('/api/office/studio/kritiek', officeAuth, async (req, res) => {
    try { const r = await kern.studio.aiKritiek(String(req.body.id || ''), req.body.q); r.error ? res.status(r.status || 400).json({ error: r.error }) : res.json(r); }
    catch (e) { console.error('[studio]', e); res.status(500).json({ error: 'Er ging iets mis. Probeer het opnieuw.' }); }
  });
  app.post('/api/office/doos/regie', officeAuth, (req, res) => veilig(res, () => afdelingen.doosRegie()));
  app.post('/api/office/doos/update-zet', officeAuth, (req, res) => veilig(res, () => afdelingen.doosUpdateZet(req.body.versie, req.body.notities, req.body.naam)));
  app.post('/api/office/doos/netwerk-zet', officeAuth, (req, res) => veilig(res, () => afdelingen.doosNetwerkZet(String(req.body.doos || ''), req.body.instellingen || {}, req.body.naam)));

  app.post('/api/office/boardroom/fase', officeAuth, (req, res) => veilig(res, () => {
    const r = afdelingen.schakelFase(String(req.body.fase || ''), req.body.naam ? String(req.body.naam) : 'boardroom');
    if (r.ok) sseToOffice('sync', { scope: 'boardroom' });
    return r;
  }));

  /* De geld-regie: RTG bepaalt de pasprijzen, de partnervergoeding (per genre
     of per zaak) en het ledenvoordeel per genre. De pasprijzen zijn publiek:
     wat hier gezet wordt is meteen overal het geldende bedrag. */
  app.post('/api/pasprijzen', (req, res) => stuur(res, geldPasprijzen()));
  app.get('/api/pasprijzen', (req, res) => stuur(res, geldPasprijzen()));
  app.post('/api/office/geld', officeAuth, (req, res) => veilig(res, () => geldOverzicht()));
  app.post('/api/office/geld/pasprijs', officeAuth, (req, res) => veilig(res, () => {
    const r = geldPasprijsZet(req.body || {});
    if (r.ok) afdelingen.audit(req.body.naam || 'boardroom', 'Pasprijs ' + r.pas + ' gezet op € ' + (r.maandCenten / 100).toFixed(2) + ' per maand (ex btw)');
    return r;
  }));
  app.post('/api/office/geld/commissie', officeAuth, (req, res) => veilig(res, () => {
    const r = geldCommissieZet(req.body || {});
    if (r.ok) afdelingen.audit(req.body.naam || 'boardroom', 'Partnervergoeding ' + (r.code || r.genre) + ' gezet op ' + (r.rate * 100).toFixed(1) + '%');
    return r;
  }));
  app.post('/api/office/geld/korting', officeAuth, (req, res) => veilig(res, () => {
    const r = geldKortingZet(req.body || {});
    if (r.ok) afdelingen.audit(req.body.naam || 'boardroom', 'Ledenvoordeel ' + r.genre + ' gezet op ' + r.pct + '%');
    return r;
  }));

  // de paniekkamer: knoppen worden voorstellen; de boardroom besluit
  app.post('/api/office/paniek', officeAuth, (req, res) => veilig(res, () => afdelingen.paniekLijst()));
  app.post('/api/office/paniek/stel', officeAuth, (req, res) => veilig(res, () => {
    const r = afdelingen.paniekStel({ functie: String(req.body.functie || ''), aan: req.body.aan === true, doelgroep: req.body.doelgroep ? String(req.body.doelgroep) : null, reden: req.body.reden });
    if (r.ok) sseToOffice('sync', { scope: 'paniek' });
    return r;
  }));
  app.post('/api/office/paniek/besluit', officeAuth, (req, res) => veilig(res, () => {
    const r = afdelingen.paniekBesluit(String(req.body.id || ''), String(req.body.besluit || ''));
    if (r.ok) sseToOffice('sync', { scope: 'paniek' });
    return r;
  }));
  // aanmelden: vanuit de kantoor-app of de RTG Kantoor PDA (ook thuis)
  app.post('/api/office/dienst/in', officeAuth, (req, res) => veilig(res, () => afdelingen.dienstIn(req.body.naam, String(req.body.kamer || ''), String(req.body.waar || ''))));
  app.post('/api/office/dienst/uit', officeAuth, (req, res) => veilig(res, () => afdelingen.dienstUit(String(req.body.id || ''))));
  app.post('/api/office/dienst', officeAuth, (req, res) => veilig(res, () => afdelingen.dienstNu()));
  // platformbrede statistieken, interne chat met snaps, en onboarding per kamer
  app.post('/api/office/stats', officeAuth, (req, res) => veilig(res, () => afdelingen.platformStats()));
  app.post('/api/office/kachat', officeAuth, (req, res) => veilig(res, () => afdelingen.chatLijst(String(req.body.kamer || ''))));
  app.post('/api/office/kachat/stuur', officeAuth, (req, res) => veilig(res, () => afdelingen.chatStuur(String(req.body.kamer || ''), req.body.naam, req.body.tekst, req.body.foto)));
  app.post('/api/office/onboarding', officeAuth, (req, res) => veilig(res, () => afdelingen.onboarding(String(req.body.kamer || ''))));
  app.post('/api/office/paniek/bericht', officeAuth, (req, res) => veilig(res, () => afdelingen.paniekBericht(String(req.body.id || ''), String(req.body.wie || ''), req.body.tekst)));
  // de wereld: alles in het veld als bolletje (groen oke, oranje uit, rood
  // storing), met reset- en hulpknoppen; elke knop komt in het auditlog
  app.post('/api/office/wereld', officeAuth, (req, res) => veilig(res, () => afdelingen.wereld()));
  app.post('/api/office/wereld/actie', officeAuth, (req, res) => veilig(res, () => {
    const r = afdelingen.wereldActie(String(req.body.id || ''), String(req.body.actie || ''), req.body.naam);
    if (r.ok) sseToOffice('sync', { scope: 'wereld' });
    return r;
  }));
};
