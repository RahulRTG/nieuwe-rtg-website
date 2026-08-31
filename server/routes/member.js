/* Domein "member" (aparte module op de gedeelde kern). Dit bestand is de
   dunne dispatcher: alleen /api/state en de app-regie staan hier, alle overige
   leden-routes wonen in behapbare submodules onder routes/member/ -- de
   boardroom van het lid sinds vandaag ook (./member/boardroom.js).
   De helpers blijven in de kern (server.js) en komen via het kern-object binnen. */
module.exports = (kern) => {
  const { app, auth, db, stateFor } = kern;
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

  require('./member/boardroom')(kern);

  // ---- de submodules: elk een eigen, behapbaar domein ----
  // De RTF-gezinskoppeling (oppas/familie aan een gezin, kanaal, berichten).
  require('./member/gezin')(kern);
  // Betalen: facturen (provider + 30% RTF-afdracht), munten, PDF-facturen.
  require('./member/betalen')(kern);
  // Het partner- en bedrijvenkanaal: niet-leden-boekingen, partner-aanvraag, winkel.
  require('./member/partnerkanaal')(kern);
  /* De meldknop van de ledenprijsgarantie. De voorwaarden beloofden "meld het
     via de app en het verschil wordt rechtgezet"; het plafond was gebouwd, deze
     knop niet (PRIJZEN.md 4.11). Drie kanten in een bestand: het lid meldt, de
     zaak erkent of betwist, het kantoor komt erbij als het vastloopt. */
  require('./member/prijsgarantie')(kern);
  /* Het AI-tegoed: de stand zien en het beleid bij het plafond zetten. Een laag
     die "nooit ongemerkt variabele kosten" afdwingt maar die niemand kan
     raadplegen, maakt die belofte niet waar. */
  require('./member/aitegoed')(kern);
  // Ter plaatse: gastsleutel, aandacht vragen, gastchat, event-RSVP.
  require('./member/terplaatse')(kern);
  // Onderweg: de live reis en ritten aanvragen/betalen.
  require('./member/onderweg')(kern);
  // Boeken en bestellen: diensten, historie, cadeaukaarten, partnerlijst, orders.
  require('./member/boeken')(kern);
  require('./member/cadeaukaart')(kern);
  require('./member/gegevens')(kern);
  require('./member/vakpro')(kern);
  require('./member/residentie')(kern);
  // De zakelijke tools van de Business Pass: zzp-belastingtool en AI-boekhouder.
  require('./member/zakelijk')(kern);
  /* Het Ondernemers-OS: één bedrijfsobject van "ik denk erover na" tot een
     groep met meerdere vennootschappen -- rechtsvorm, levensfase en de
     koppeling aan de bestaande zaak. Bewust zonder pas-poort; zie de kop daar. */
  require('./member/onderneming')(kern);
  // De Rechterhand: de premium suite van de Lifestyle Pass
  require('./member/lifestyle')(kern);
  // Extra premium ROS-apps van de Lifestyle Pass: Reisboek, Cellier, Table, Maison
  require('./member/rechterhand')(kern);
  // Rendez-vous: de besloten AI-datingapp van de Lifestyle Pass
  require('./member/rendezvous')(kern);
  // Het Privekantoor: de ENE app van de Lifestyle Pass (graaf, tower, delegatie, zaken)
  require('./member/bureau')(kern);
  /* "Vooruit": dezelfde Control Tower, maar voor ELKE pas -- ook de gratis. De
     motor (kern/levensgraaf) is niet premium; wat je met een datum kunt is dat
     wel. Zie de kop van routes/member/vooruit.js. */
  require('./member/vooruit')(kern);
  // RTG Pulse: het eigen 9+-microblog op codenaam
  require('./member/pulse')(kern);
  // De Berichten-app: alle gesprekken van het platform op een plek (de lijst),
  // en de handelingen erbij: zoeken, vlaggen en de drie AI-taken
  require('./member/berichten')(kern);
  require('./member/berichtenapp')(kern);
  /* Het communicatieplatform (kern/comm): een koppelvlak voor alle gesprekken
     van het hele platform, in plaats van een berichtenroute per module. */
  require('./member/comm')(kern);
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
  require('./member/sessies')(kern);
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
