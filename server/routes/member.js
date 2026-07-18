/* Domein "member" (aparte module op de gedeelde kern). Dit bestand is de
   dunne dispatcher: de basisroutes (state + boardroom) staan hier, alle
   overige leden-routes wonen in behapbare submodules onder routes/member/.
   De helpers blijven in de kern (server.js) en komen via het kern-object binnen. */
module.exports = (kern) => {
  const { app, auth, stateFor, geenGast, lidBoard, lidBoardZet } = kern;

  app.post('/api/state', auth, (req, res) => res.json({ state: stateFor(req.session, req.body.lang) }));

  /* De eigen boardroom van het lid: het schakelbord met alle functies (app-
     onderdelen, privacy & sociaal, AI & meldingen, verbindingen). Alleen voor een
     echt account (geen gast). De stand staat server-side op de sessiesleutel, dus
     hij reist mee naar elk toestel van het lid. */
  app.post('/api/member/boardroom', auth, (req, res) => {
    if (geenGast(req, res)) return;
    res.json({ bord: lidBoard(req.session.key) });
  });
  app.post('/api/member/boardroom/zet', auth, (req, res) => {
    if (geenGast(req, res)) return;
    const r = lidBoardZet(req.session.key, String(req.body.id || ''), req.body.aan !== false);
    res.status(r.status).json(r);
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
  // De zakelijke tools van de Business Pass: zzp-belastingtool en AI-boekhouder.
  require('./member/zakelijk')(kern);
  // De AVG-rechten: dossier downloaden en definitief verwijderen.
  require('./member/privacy')(kern);
  // De persoonlijke AI en de Butler/concierge-chat.
  require('./member/assistent')(kern);
  // De persoonlijke laag (zorgprofiel, locatie-delen, De Butler, Shared Assets).
  require('./member/persoonlijk')(kern);
  // Rechtstreeks betalen, de bezorgdienst, tickets en transfers.
  require('./member/kopen')(kern);
  // Autoverhuur, charters, Salon-ontmoetingen en de autoshowroom.
  require('./member/voertuigen')(kern);
  // Mode-bezorging, groothandel, contracten en vastgoed.
  require('./member/handel')(kern);
  // De winkel-laag (retail/mode-catalogus) en de paspoort/identiteits-routes.
  require('./member/winkel')(kern);
  // De Salon: post-interactie en de partner-etalage.
  require('./member/salon')(kern);
  // Werk & sollicitaties: cv, vacatures, solliciteren en de sollicitatie-chat.
  require('./member/werk')(kern);
};
