/* Domein "member" (deelmodule): DE BOARDROOM VAN HET LID -- het bord waarop een
   lid zijn eigen functies aan- en uitzet, en het journaal daarvan.

   AFGESPLITST VAN ../member.js. Dat bestand hoort een dunne dispatcher te zijn
   -- de regel eronder is dat er per domein een behapbare submodule is -- en de
   boardroom was het enige echte werk dat er nog in stond. Nu staat hij waar de
   rest ook staat.

   DE TAAL KOMT VAN DE LEZER MEE. De labels van dit bord staan op de server
   (kern/lidboard/talen), dus de pagina kan ze niet zelf vertalen.

   ER ZIT EEN REM OP HET SCHAKELEN, en de tellers ruimen zichzelf op: een Map die
   met elk account meegroeit dat ooit iets heeft omgezet, is een lek met een
   nette naam. */
module.exports = (kern) => {
  const { app, auth, geenGast, werkgeversVan } = kern;
  const { lidBoard, lidBoardZet, lidBoardZetVeel, lidBoardHerstel, lidBoardLog } = kern.lidboard;
  const functies = require('../../functies');

  /* ---------------------- De boardroom van het lid ----------------------
     Het schakelbord met alle functies (app-onderdelen, privacy & sociaal,
     AI & meldingen, verbindingen). Alleen voor een echt account (geen gast).
     De stand staat server-side op de sessiesleutel, dus hij reist mee naar
     elk toestel van het lid.

     De doelgroep (de pas) gaat mee: daarmee weet het bord wat de RTG-
     schakelkast over elke functie zegt en toont het een functie die RTG
     platform-breed heeft dichtgezet als "beheerd" in plaats van als een
     schakelaar die niets doet.

     Schrijven is begrensd. Elke omzetting schrijft de database weg en zet een
     regel in het journaal; zonder rem kan een lus dat honderden keren per
     seconde doen. Dertig schakelingen per minuut per account is ruim boven
     wat een mens haalt en ver onder wat schade doet. */
  const dgVan = req => functies.tierNaarDoelgroep(req.session.tier);
  // de taal komt van de lezer mee: de labels van dit bord staan op de server
  // (kern/lidboard/talen), dus de pagina kan ze niet zelf vertalen
  const taalVan = req => String((req.body && req.body.lang) || 'nl').slice(0, 5);
  const bordOpts = (req, extra) => Object.assign({
    doelgroep: dgVan(req), lang: taalVan(req), versie: req.body.versie, door: 'lid', bron: 'app'
  }, extra || {});

  const schakelTellers = new Map(); // sleutel -> { n, tot }
  const SCHAKEL_MAX = 30, SCHAKEL_VENSTER = 60000;
  function teVaak(res, sleutel) {
    const nu = Date.now();
    const t = schakelTellers.get(sleutel);
    if (!t || t.tot <= nu) { schakelTellers.set(sleutel, { n: 1, tot: nu + SCHAKEL_VENSTER }); return false; }
    if (t.n >= SCHAKEL_MAX) {
      res.status(429).json({ error: 'Te veel wijzigingen achter elkaar. Probeer het zo opnieuw.' });
      return true;
    }
    t.n += 1;
    return false;
  }
  // de tellers van verlopen vensters opruimen, zodat de Map niet meegroeit met
  // het aantal accounts dat ooit iets heeft omgezet
  setInterval(() => {
    const nu = Date.now();
    for (const [k, t] of schakelTellers) if (t.tot <= nu) schakelTellers.delete(k);
  }, 5 * 60000).unref();

  app.post('/api/member/boardroom', auth, (req, res) => {
    if (geenGast(req, res)) return;
    res.json({
      bord: lidBoard(req.session.key, { doelgroep: dgVan(req), lang: taalVan(req) }),
      // wie er beleid op je bord kan voeren: de bedrijven waar je aan gekoppeld
      // bent. Ze kunnen alleen dichtzetten, nooit openzetten.
      werkgevers: typeof werkgeversVan === 'function' ? werkgeversVan(req.session.key) : []
    });
  });
  app.post('/api/member/boardroom/zet', auth, (req, res) => {
    if (geenGast(req, res)) return;
    if (teVaak(res, req.session.key)) return;
    const r = lidBoardZet(req.session.key, String(req.body.id || ''), req.body.aan !== false, bordOpts(req));
    res.status(r.status).json(r);
  });
  /* Een set functies in een keer: "alles uit", "alles aan", of een eigen
     selectie. Alles-of-niets, dus een bord blijft nooit half om. */
  app.post('/api/member/boardroom/zetveel', auth, (req, res) => {
    if (geenGast(req, res)) return;
    if (teVaak(res, req.session.key)) return;
    const r = lidBoardZetVeel(req.session.key, req.body.standen, bordOpts(req, { bron: 'app:bulk' }));
    res.status(r.status).json(r);
  });
  // Terug naar de standaard-stand van een nieuw account (deel-functies uit).
  app.post('/api/member/boardroom/herstel', auth, (req, res) => {
    if (geenGast(req, res)) return;
    if (teVaak(res, req.session.key)) return;
    const r = lidBoardHerstel(req.session.key, bordOpts(req));
    res.status(r.status).json(r);
  });
  /* Het journaal: wie zette wat om, wanneer, waarvandaan. Van de betrokkene
     zelf, dus achter zijn eigen inlog en zonder namen van anderen erin. */
  app.post('/api/member/boardroom/logboek', auth, (req, res) => {
    if (geenGast(req, res)) return;
    res.json({ logboek: lidBoardLog(req.session.key, req.body.max) });
  });
};
