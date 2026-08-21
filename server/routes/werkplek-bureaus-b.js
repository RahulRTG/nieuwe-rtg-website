/* DE WERKPLEK-BUREAUS, tweede helft: architect, redactie, ideeen en de plank.

   Afgesplitst van ./werkplek-bureaus.js omdat dat bestand over de 10 kB van
   keuringsregel 13 liep. De snede loopt langs een BUREAU-grens: hierboven staan
   de bureaus die iets ONTWERPEN (atelier, studio, hardware), hier die iets
   SCHRIJVEN of BEDENKEN, plus de plank die laat zien wat er uit het
   hardwarelab in de verkoop staat.

   Hij krijgt de helpers van het eerste deel mee in plaats van ze na te bouwen:
   `doe` draagt de foutafhandeling en de argumentvormen van alle bureaus, en een
   tweede kopie daarvan zou binnen een week uiteenlopen (LAT.md regel 4).

   EN `kies` EN `BUREAUS` STONDEN HIER EERST NIET BIJ. Ze staan in het eerste
   deel en werden hieronder gewoon gebruikt -- in server.js waren ze vrije namen
   in hetzelfde bereik, na de knip niet meer. /api/werkplek/bureaus gooide
   daardoor een ReferenceError, die de try/catch eromheen netjes omzette in een
   500 met "Er ging iets mis". Geen crash, geen melding in de toets-uitvoer,
   alleen een endpoint dat het voor ELK huis niet meer deed.

   Gevonden door test/werkplek.test.js in CI en niet door mij: de routekaart
   bewijst dat de server OPSTART met dezelfde routes, en dat is precies wat hij
   bewijst -- hij doet geen verzoek. Zie TAKEN.md 6.17. */
'use strict';

module.exports = ({ app, db, huisAuth, doe, kies, BUREAUS }) => {
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
