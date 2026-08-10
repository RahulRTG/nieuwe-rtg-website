/* Werkplek, deel "bureaus": de ontwerptak van een huis.

   RTG heeft zijn bureaus al achter de kantoordeur (/api/office/atelier en
   verder). De RTFoundation heeft nu dezelfde zes -- atelier, ontwerpstudio,
   hardwarelab, architectenbureau, redactie en de ideeenkamer -- op eigen data.
   In plaats van die routes te verdubbelen loopt hier een tweede ingang die het
   huis uit de body haalt: bedrijf 'rtg' pakt kern.atelier, bedrijf 'rtf' pakt
   kern.atelierRtf. Een pad, twee huizen, geen kopie.

   De deur komt van ./werkplek.js mee: dezelfde sleutel per bedrijf, dus een
   medewerker van RTF kan hier niet in de ontwerpen van RTG kijken.

   Elk huis heeft ook een eigen plank: het spoor waar een afgerond concept van
   het Hardwarelab in de verkoop gaat. Voor RTG is dat de echte RTG-winkel, voor
   de stichting haar eigen plank -- hetzelfde gebaar, maar het werk van de
   stichting belandt nooit ongemerkt tussen dat van RTG. */
module.exports = (kern, huisAuth) => {
  const { app, db } = kern;
  const stuur = (res, r) => r.error ? res.status(r.status || 400).json({ error: r.error }) : res.json(r);

  /* Welke instantie hoort bij dit huis: RTG heeft de oorspronkelijke, de
     stichting het exemplaar met -Rtf erachter. */
  const kies = (code, bureau) => kern[code === 'rtg' ? bureau : bureau + 'Rtf'];

  /* De argumenten die een actie uit de body haalt. Bewust klein gehouden: elk
     bureau gebruikt dezelfde handvol vormen. */
  const ARG = {
    geen: () => [],
    body: b => [b],
    id: b => [String(b.id || '')],
    idBody: b => [String(b.id || ''), b],
    idVraag: b => [String(b.id || ''), b.q],
    idStatus: b => [String(b.id || ''), String(b.status || '')],
    idBureau: b => [String(b.id || ''), String(b.bureau || '')],
    naam: b => [b.naam],
    prijs: b => [String(b.id || ''), b.prijs || b],
    schrijf: b => [String(b.onderwerp || ''), String(b.rubriek || '')]
  };

  /* De bureaus en wat je er kunt doen: [pad, functie, argvorm, wacht-op-AI].
     Dit is dezelfde lijst als in routes/kantoren/bureaus.js en ./redactie.js,
     alleen dan als tabel. */
  /* De ZES BUREAUS als lijst. Hier stond een tabel BUREAUS met per bureau zijn
     acties, en die tabel voedde twee dingen tegelijk: de route-registratie en
     dit overzicht. De registratie staat nu uitgeschreven (zie hieronder);
     deze lijst blijft, want een overzicht van wat er IS hoort een bron te
     hebben en niet een optelling van wat er toevallig geregistreerd is. */
  const BUREAUS = ['atelier', 'studio', 'hardware', 'architect', 'redactie', 'ideeen'];

  /* ELK PAD VOLUIT. Hier stond een dubbele lus die het pad opbouwde uit twee
     variabelen ('/api/werkplek/bureau/' + bureau + pad); scripts/schakelbaar.js
     zag daardoor geen van deze routes, en wat die census niet ziet is vanuit de
     boardroom niet uit te zetten en niet per stad te sluiten (scripts/check.js
     regel 45).

     De TABEL is niet verdwenen, hij is de aanroep geworden: bureau, functie en
     argumentvorm staan nu bij de route waar ze bij horen. Het werk zelf -- de
     module kiezen, bestaan controleren, argumenten vormen, fouten vangen --
     staat nog steeds op EEN plek. */
  const doe = (bureau, functie, argvorm, wacht) => async (req, res) => {
    try {
      const mod = kies(req.werkplekCode, bureau);
      if (!mod || typeof mod[functie] !== 'function') {
        return res.status(404).json({ error: 'Dit bureau heeft dit huis niet.' });
      }
      const args = ARG[argvorm](req.body || {});
      stuur(res, wacht ? await mod[functie](...args) : mod[functie](...args));
    } catch (e) {
      console.error('[werkplek-bureaus]', bureau, functie, e);
      res.status(500).json({ error: 'Er ging iets mis. Probeer het opnieuw.' });
    }
  };

  // atelier
  app.post('/api/werkplek/bureau/atelier', huisAuth, doe('atelier', 'overzicht', 'geen'));
  app.post('/api/werkplek/bureau/atelier/maak', huisAuth, doe('atelier', 'ontwerpMaak', 'body'));
  app.post('/api/werkplek/bureau/atelier/zet', huisAuth, doe('atelier', 'ontwerpZet', 'idBody'));
  app.post('/api/werkplek/bureau/atelier/verwijder', huisAuth, doe('atelier', 'ontwerpVerwijder', 'id'));
  app.post('/api/werkplek/bureau/atelier/collectie', huisAuth, doe('atelier', 'collectieMaak', 'body'));
  app.post('/api/werkplek/bureau/atelier/techpack', huisAuth, doe('atelier', 'aiTechpack', 'id'));
  app.post('/api/werkplek/bureau/atelier/concept', huisAuth, doe('atelier', 'aiConcept', 'id', true));
  app.post('/api/werkplek/bureau/atelier/kritiek', huisAuth, doe('atelier', 'aiKritiek', 'idVraag', true));
  // studio
  app.post('/api/werkplek/bureau/studio', huisAuth, doe('studio', 'overzicht', 'geen'));
  app.post('/api/werkplek/bureau/studio/maak', huisAuth, doe('studio', 'ontwerpMaak', 'body'));
  app.post('/api/werkplek/bureau/studio/zet', huisAuth, doe('studio', 'ontwerpZet', 'idBody'));
  app.post('/api/werkplek/bureau/studio/verwijder', huisAuth, doe('studio', 'ontwerpVerwijder', 'id'));
  app.post('/api/werkplek/bureau/studio/collectie', huisAuth, doe('studio', 'collectieMaak', 'body'));
  app.post('/api/werkplek/bureau/studio/lookbook', huisAuth, doe('studio', 'lookbook', 'naam'));
  app.post('/api/werkplek/bureau/studio/specsheet', huisAuth, doe('studio', 'aiSpecsheet', 'id'));
  app.post('/api/werkplek/bureau/studio/concept', huisAuth, doe('studio', 'aiConcept', 'id', true));
  app.post('/api/werkplek/bureau/studio/kritiek', huisAuth, doe('studio', 'aiKritiek', 'idVraag', true));
  // hardware
  app.post('/api/werkplek/bureau/hardware', huisAuth, doe('hardware', 'overzicht', 'geen'));
  app.post('/api/werkplek/bureau/hardware/maak', huisAuth, doe('hardware', 'ontwerpMaak', 'body'));
  app.post('/api/werkplek/bureau/hardware/zet', huisAuth, doe('hardware', 'ontwerpZet', 'idBody'));
  app.post('/api/werkplek/bureau/hardware/verwijder', huisAuth, doe('hardware', 'ontwerpVerwijder', 'id'));
  app.post('/api/werkplek/bureau/hardware/serie', huisAuth, doe('hardware', 'collectieMaak', 'body'));
  app.post('/api/werkplek/bureau/hardware/productblad', huisAuth, doe('hardware', 'productblad', 'naam'));
  app.post('/api/werkplek/bureau/hardware/stuklijst', huisAuth, doe('hardware', 'aiStuklijst', 'id'));
  app.post('/api/werkplek/bureau/hardware/plank', huisAuth, doe('hardware', 'naarWinkel', 'prijs'));
  app.post('/api/werkplek/bureau/hardware/plank-af', huisAuth, doe('hardware', 'uitWinkel', 'id'));
  app.post('/api/werkplek/bureau/hardware/concept', huisAuth, doe('hardware', 'aiConcept', 'id', true));
  app.post('/api/werkplek/bureau/hardware/kritiek', huisAuth, doe('hardware', 'aiKritiek', 'idVraag', true));
  // architect
  app.post('/api/werkplek/bureau/architect', huisAuth, doe('architect', 'overzicht', 'geen'));
  app.post('/api/werkplek/bureau/architect/maak', huisAuth, doe('architect', 'ontwerpMaak', 'body'));
  app.post('/api/werkplek/bureau/architect/zet', huisAuth, doe('architect', 'ontwerpZet', 'idBody'));
  app.post('/api/werkplek/bureau/architect/verwijder', huisAuth, doe('architect', 'ontwerpVerwijder', 'id'));
  app.post('/api/werkplek/bureau/architect/project', huisAuth, doe('architect', 'collectieMaak', 'body'));
  app.post('/api/werkplek/bureau/architect/portfolio', huisAuth, doe('architect', 'portfolio', 'naam'));
  app.post('/api/werkplek/bureau/architect/bouwstaat', huisAuth, doe('architect', 'aiBouwstaat', 'id'));
  app.post('/api/werkplek/bureau/architect/concept', huisAuth, doe('architect', 'aiConcept', 'id', true));
  app.post('/api/werkplek/bureau/architect/kritiek', huisAuth, doe('architect', 'aiKritiek', 'idVraag', true));
  // redactie
  app.post('/api/werkplek/bureau/redactie', huisAuth, doe('redactie', 'overzicht', 'geen'));
  app.post('/api/werkplek/bureau/redactie/artikel/maak', huisAuth, doe('redactie', 'artikelMaak', 'body'));
  app.post('/api/werkplek/bureau/redactie/artikel/zet', huisAuth, doe('redactie', 'artikelZet', 'idBody'));
  app.post('/api/werkplek/bureau/redactie/artikel/status', huisAuth, doe('redactie', 'artikelStatus', 'idStatus'));
  app.post('/api/werkplek/bureau/redactie/artikel/verwijder', huisAuth, doe('redactie', 'artikelVerwijder', 'id'));
  app.post('/api/werkplek/bureau/redactie/editie/maak', huisAuth, doe('redactie', 'editieMaak', 'body'));
  app.post('/api/werkplek/bureau/redactie/editie/status', huisAuth, doe('redactie', 'editieStatus', 'idStatus'));
  app.post('/api/werkplek/bureau/redactie/drukproef', huisAuth, doe('redactie', 'drukproef', 'id'));
  app.post('/api/werkplek/bureau/redactie/nieuwstips', huisAuth, doe('redactie', 'nieuwstips', 'geen'));
  app.post('/api/werkplek/bureau/redactie/ai/schrijf', huisAuth, doe('redactie', 'aiSchrijf', 'schrijf', true));
  app.post('/api/werkplek/bureau/redactie/ai/redactie', huisAuth, doe('redactie', 'aiRedactie', 'id', true));
  // ideeen
  app.post('/api/werkplek/bureau/ideeen', huisAuth, doe('ideeen', 'overzicht', 'geen'));
  app.post('/api/werkplek/bureau/ideeen/maak', huisAuth, doe('ideeen', 'ideeMaak', 'body'));
  app.post('/api/werkplek/bureau/ideeen/zet', huisAuth, doe('ideeen', 'ideeZet', 'idBody'));
  app.post('/api/werkplek/bureau/ideeen/verwijder', huisAuth, doe('ideeen', 'ideeVerwijder', 'id'));
  app.post('/api/werkplek/bureau/ideeen/reactie', huisAuth, doe('ideeen', 'reactie', 'idBody'));
  app.post('/api/werkplek/bureau/ideeen/spinoff', huisAuth, doe('ideeen', 'spinOff', 'idBureau'));
  app.post('/api/werkplek/bureau/ideeen/uitwerken', huisAuth, doe('ideeen', 'aiUitwerken', 'id', true));

  /* De plank van dit huis: wat er uit het Hardwarelab in de verkoop staat.
     RTG leest de echte winkel, de stichting haar eigen plank. Prijzen zijn in
     euro, ex btw -- precies zoals ze bij naarWinkel zijn ingevoerd. */
  const PLANK = { rtg: 'winkelProducten', rtf: 'winkelProductenRtf' };
  app.post('/api/werkplek/plank', huisAuth, (req, res) => {
    try {
      const bak = db.data[PLANK[req.werkplekCode]] || {};
      const items = Object.keys(bak).map(slug => Object.assign({ slug }, bak[slug]))
        .sort((a, b) => String(b.at || '').localeCompare(String(a.at || '')));
      res.json({ ok: true, bedrijf: req.werkplekCode, eigenWinkel: req.werkplekCode === 'rtg', producten: items });
    } catch (e) {
      console.error('[werkplek-bureaus] plank', e);
      res.status(500).json({ error: 'Er ging iets mis. Probeer het opnieuw.' });
    }
  });

  /* De etalage van de ontwerptak: hoeveel staat er in elk bureau van dit huis?
     Voedt het overzichtsscherm zonder zes losse verzoeken. */

  app.post('/api/werkplek/bureaus', huisAuth, (req, res) => {
    try {
      const uit = BUREAUS.map(bureau => {
        const mod = kies(req.werkplekCode, bureau);
        let telling = null;
        try {
          const o = mod && typeof mod.overzicht === 'function' ? mod.overzicht() : null;
          if (o) telling = (o.ontwerpen || o.ideeen || o.artikelen || []).length;
        } catch (e) { telling = null; }
        return { bureau, aanwezig: !!mod, aantal: telling };
      });
      res.json({ ok: true, bedrijf: req.werkplekCode, bureaus: uit });
    } catch (e) {
      console.error('[werkplek-bureaus]', e);
      res.status(500).json({ error: 'Er ging iets mis. Probeer het opnieuw.' });
    }
  });
};
