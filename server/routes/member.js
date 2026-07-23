/* Domein "member" (aparte module op de gedeelde kern). Dit bestand is de
   dunne dispatcher: de basisroutes (state + boardroom) staan hier, alle
   overige leden-routes wonen in behapbare submodules onder routes/member/.
   De helpers blijven in de kern (server.js) en komen via het kern-object binnen. */
module.exports = (kern) => {
  const { app, auth, db, stateFor, geenGast, lidBoard, lidBoardZet } = kern;
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
  // De Rechterhand: de premium suite van de Lifestyle Pass
  require('./member/lifestyle')(kern);
  // Extra premium ROS-apps van de Lifestyle Pass: Reisboek, Cellier, Table, Maison
  require('./member/rechterhand')(kern);
  // Rendez-vous: de besloten AI-datingapp van de Lifestyle Pass
  require('./member/rendezvous')(kern);
  // RTG Pulse: het eigen 9+-microblog op codenaam
  require('./member/pulse')(kern);
  // De Berichten-app: alle gesprekken van het platform op een plek
  require('./member/berichten')(kern);
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
