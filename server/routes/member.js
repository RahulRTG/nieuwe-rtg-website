/* Domein "member" (aparte module op de gedeelde kern). Dit bestand is de
   dunne dispatcher: de basisroutes (state + boardroom) staan hier, alle
   overige leden-routes wonen in behapbare submodules onder routes/member/.
   De helpers blijven in de kern (server.js) en komen via het kern-object binnen. */
module.exports = (kern) => {
  const { app, auth, db, stateFor, geenGast, lidBoard, lidBoardZet, lidBoardZetVeel,
    lidBoardHerstel, lidBoardLog, werkgeversVan } = kern;
  const functies = require('../functies');

  app.post('/api/state', auth, (req, res) => res.json({ state: stateFor(req.session, req.body.lang) }));

  /* De app-regie van de RTG-boardroom, gezien vanaf deze pas: welke functies
     staan voor dit lid uit? Het OS-springboard verbergt die apps; de API
     weigert ze sowieso al (de toegangsmotor bewaakt elke route). */
  app.post('/api/member/apps', auth, (req, res) => {
    const staat = db.data && db.data.techniek && db.data.techniek.functies;
    const dg = functies.tierNaarDoelgroep(req.session.tier);
    const uit = !staat ? [] : functies.FUNCTIES
      .filter(f => functies.blokkadeReden(f.id, staat, { doelgroep: dg, persoon: req.session.key }))
      .map(f => f.id);
    res.json({ uit });
  });

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

  // ---- de submodules: elk een eigen, behapbaar domein ----
  // De RTF-gezinskoppeling (oppas/familie aan een gezin, kanaal, berichten).
  require('./member/gezin')(kern);
  // Betalen: facturen (provider + 30% RTF-afdracht), munten, PDF-facturen.
  require('./member/betalen')(kern);
  // Het partner- en bedrijvenkanaal: niet-leden-boekingen, partner-aanvraag, winkel.
  require('./member/partnerkanaal')(kern);
  // Ter plaatse: gastsleutel, aandacht vragen, gastchat, event-RSVP.
  require('./member/terplaatse')(kern);
  // Onderweg: de live reis en ritten aanvragen/betalen.
  require('./member/onderweg')(kern);
  // Boeken en bestellen: diensten, historie, cadeaukaarten, partnerlijst, orders.
  require('./member/boeken')(kern);
  require('./member/gegevens')(kern);
  require('./member/vakpro')(kern);
  require('./member/residentie')(kern);
  // De zakelijke tools van de Business Pass: zzp-belastingtool en AI-boekhouder.
  require('./member/zakelijk')(kern);
  // De Rechterhand: de premium suite van de Lifestyle Pass
  require('./member/lifestyle')(kern);
  // Extra premium ROS-apps van de Lifestyle Pass: Reisboek, Cellier, Table, Maison
  require('./member/rechterhand')(kern);
  // Rendez-vous: de besloten AI-datingapp van de Lifestyle Pass
  require('./member/rendezvous')(kern);
  // RTG Pulse: het eigen 9+-microblog op codenaam
  require('./member/pulse')(kern);
  // De Berichten-app: alle gesprekken van het platform op een plek (de lijst),
  // en de handelingen erbij: zoeken, vlaggen en de drie AI-taken
  require('./member/berichten')(kern);
  require('./member/berichtenapp')(kern);
  // De Salon als app: plaatsen, feed met paginering, profielen, reacties, AI
  require('./member/salonapp')(kern);
  // Métier: het beroepsprofiel op codenaam, met de naam als sleutel die je per
  // werkgever afgeeft en weer intrekt
  require('./member/metier')(kern);
  // Genootschap: besloten groepen met een prikbord en bijeenkomsten
  require('./member/genootschap')(kern);
  // De wauw-laag: stemming, verjaardagsglans en De Terugblik
  require('./member/wauw')(kern);
  // De moedertaal van het account: iedereen praat en leest in de eigen taal
  require('./member/taal')(kern);
  // RTG Nieuws: het gepubliceerde werk van RTG Redactie, met Rahul als nieuwslezer
  require('./member/nieuws')(kern);
  // De AVG-rechten: dossier downloaden en definitief verwijderen.
  require('./member/privacy')(kern);
  // De persoonlijke AI en Rahul/concierge-chat.
  require('./member/assistent')(kern);
  // Rahul kijkt mee met een foto (kern/kijken.js) en zegt waar die foto heen kan
  require('./member/kijk')(kern);
  // De persoonlijke laag (zorgprofiel, locatie-delen, Rahul, Shared Assets).
  require('./member/persoonlijk')(kern);
  // Rechtstreeks betalen, de bezorgdienst, tickets en transfers.
  require('./member/kopen')(kern);
  // Autoverhuur, charters, Salon-ontmoetingen en de autoshowroom.
  require('./member/voertuigen')(kern);
  // Mode-bezorging, groothandel, contracten en vastgoed.
  require('./member/handel')(kern);
  // De winkel-laag (retail/mode-catalogus) en de paspoort/identiteits-routes.
  require('./member/winkel')(kern);
  // Het inwoner-loket van RTG Gemeente (meldingen, burgerzaken, vergunningen, afval).
  require('./member/gemeente')(kern);
  // Het MijnOverheid-loket van De Overheid (Berichtenbox, belasting, RDW, KVK, sociale zekerheid, stemmen).
  require('./member/overheid')(kern);
  // De Salon: post-interactie en de partner-etalage.
  require('./member/salon')(kern);
  // Werk & sollicitaties: cv, vacatures, solliciteren en de sollicitatie-chat.
  require('./member/werk')(kern);
  // Bedrijfspakketten: bedrijfstype -> juiste indeling voor de eigen zaak.
  require('./member/pakket')(kern);
};
