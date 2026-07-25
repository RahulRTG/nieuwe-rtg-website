/* Werkplek, deel "bureaus": de ontwerptak van een huis.

   RTG heeft zijn bureaus al achter de kantoordeur (/api/office/atelier en
   verder). De RTFoundation heeft nu dezelfde zes -- atelier, ontwerpstudio,
   hardwarelab, architectenbureau, redactie en de ideeenkamer -- op eigen data.
   In plaats van die routes te verdubbelen loopt hier een tweede ingang die het
   huis uit de body haalt: bedrijf 'rtg' pakt kern.atelier, bedrijf 'rtf' pakt
   kern.atelierRtf. Een pad, twee huizen, geen kopie.

   De deur komt van ./werkplek.js mee: dezelfde sleutel per bedrijf, dus een
   medewerker van RTF kan hier niet in de ontwerpen van RTG kijken.

   Niet meegenomen: het spoor waar een concept van het Hardwarelab in de
   RTG-winkel belandt (/winkel). Dat is geen ontwerp- maar een verkoophandeling
   van RTG zelf, en hoort niet vanuit de stichting te lopen. */
module.exports = (kern, huisAuth) => {
  const { app } = kern;
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
    schrijf: b => [String(b.onderwerp || ''), String(b.rubriek || '')]
  };

  /* De bureaus en wat je er kunt doen: [pad, functie, argvorm, wacht-op-AI].
     Dit is dezelfde lijst als in routes/kantoren/bureaus.js en ./redactie.js,
     alleen dan als tabel. */
  const BUREAUS = {
    atelier: [
      ['', 'overzicht', 'geen'], ['/maak', 'ontwerpMaak', 'body'],
      ['/zet', 'ontwerpZet', 'idBody'], ['/verwijder', 'ontwerpVerwijder', 'id'],
      ['/collectie', 'collectieMaak', 'body'], ['/techpack', 'aiTechpack', 'id'],
      ['/concept', 'aiConcept', 'id', true], ['/kritiek', 'aiKritiek', 'idVraag', true]
    ],
    studio: [
      ['', 'overzicht', 'geen'], ['/maak', 'ontwerpMaak', 'body'],
      ['/zet', 'ontwerpZet', 'idBody'], ['/verwijder', 'ontwerpVerwijder', 'id'],
      ['/collectie', 'collectieMaak', 'body'], ['/lookbook', 'lookbook', 'naam'],
      ['/specsheet', 'aiSpecsheet', 'id'],
      ['/concept', 'aiConcept', 'id', true], ['/kritiek', 'aiKritiek', 'idVraag', true]
    ],
    hardware: [
      ['', 'overzicht', 'geen'], ['/maak', 'ontwerpMaak', 'body'],
      ['/zet', 'ontwerpZet', 'idBody'], ['/verwijder', 'ontwerpVerwijder', 'id'],
      ['/serie', 'collectieMaak', 'body'], ['/productblad', 'productblad', 'naam'],
      ['/stuklijst', 'aiStuklijst', 'id'],
      ['/concept', 'aiConcept', 'id', true], ['/kritiek', 'aiKritiek', 'idVraag', true]
    ],
    architect: [
      ['', 'overzicht', 'geen'], ['/maak', 'ontwerpMaak', 'body'],
      ['/zet', 'ontwerpZet', 'idBody'], ['/verwijder', 'ontwerpVerwijder', 'id'],
      ['/project', 'collectieMaak', 'body'], ['/portfolio', 'portfolio', 'naam'],
      ['/bouwstaat', 'aiBouwstaat', 'id'],
      ['/concept', 'aiConcept', 'id', true], ['/kritiek', 'aiKritiek', 'idVraag', true]
    ],
    redactie: [
      ['', 'overzicht', 'geen'], ['/artikel/maak', 'artikelMaak', 'body'],
      ['/artikel/zet', 'artikelZet', 'idBody'], ['/artikel/status', 'artikelStatus', 'idStatus'],
      ['/artikel/verwijder', 'artikelVerwijder', 'id'],
      ['/editie/maak', 'editieMaak', 'body'], ['/editie/status', 'editieStatus', 'idStatus'],
      ['/drukproef', 'drukproef', 'id'], ['/nieuwstips', 'nieuwstips', 'geen'],
      ['/ai/schrijf', 'aiSchrijf', 'schrijf', true], ['/ai/redactie', 'aiRedactie', 'id', true]
    ],
    ideeen: [
      ['', 'overzicht', 'geen'], ['/maak', 'ideeMaak', 'body'],
      ['/zet', 'ideeZet', 'idBody'], ['/verwijder', 'ideeVerwijder', 'id'],
      ['/reactie', 'reactie', 'idBody'], ['/spinoff', 'spinOff', 'idBureau'],
      ['/uitwerken', 'aiUitwerken', 'id', true]
    ]
  };

  for (const bureau of Object.keys(BUREAUS)) {
    for (const [pad, functie, argvorm, wacht] of BUREAUS[bureau]) {
      app.post('/api/werkplek/bureau/' + bureau + pad, huisAuth, async (req, res) => {
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
      });
    }
  }

  /* De etalage van de ontwerptak: hoeveel staat er in elk bureau van dit huis?
     Voedt het overzichtsscherm zonder zes losse verzoeken. */
  app.post('/api/werkplek/bureaus', huisAuth, (req, res) => {
    try {
      const uit = Object.keys(BUREAUS).map(bureau => {
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
