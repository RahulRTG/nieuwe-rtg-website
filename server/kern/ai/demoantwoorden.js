/* AI (deelmodule): de VASTE ANTWOORDEN, voor een installatie zonder Claude
   API-sleutel -- en dat is elke demo en de hele toetssuite. Dit is dus niet het
   randgeval maar het gewone geval, en het is de tekst die in de praktijk het
   vaakst verstuurd wordt.

   Waarom apart van ./prompt: dat bestand gaat over de instructie AAN het model
   en dit over wat er uitgaat als er geen model is. Twee dingen, twee bestanden
   -- en prompt.js liep met deze tekst erbij over de 10 kB-grens (check.js
   regel 13), wat de natuurlijke naad alleen maar bevestigde. */
'use strict';

/* Regelgestuurde werkantwoorden wanneer er geen AI-provider is.

   HET REGISTER HOORT BIJ DE PAS, OOK HIER.

   AI_TONE in kern/ai.js is er stellig over: de RTG Pass tutoyeert (je/jij),
   Lifestyle en Business spreken met u. Die regel zat alleen in de SYSTEM
   PROMPT, en die geldt uitsluitend als er een API-sleutel is. Zonder sleutel
   -- de handmatige stand en de hele toetssuite -- kwamen deze vaste antwoorden eruit,
   en die stonden allemaal in de u-vorm. Een lid met een RTG Pass werd dus
   vousvoyeerd door de app die hem juist zou tutoyeren.

   Dat is dezelfde vorm als de fout die hieronder staat beschreven: de regel
   stond er wel, maar keek langs de tekst die in de praktijk verstuurd wordt.
   Vandaar dat het register nu in de antwoorden zelf zit, met de pas als
   invoer, en dat test/menselijkverkeer.test.js erop let.

   EN DE REIS HOORT BIJ HET LID, OOK HIER.

   Deze antwoorden waren woordelijk geschreven voor de DEMO-reis uit de seed:
   Ibiza in juli, 25-31 graden, een boot naar Formentera om 10:00 en een tafel
   bij Sal de Mar om 21:00. Elk lid kreeg ze, ook wie zich net had aangemeld en
   nergens heen ging. Rahul vertelde die mensen dus over een reis die niet
   bestond, met een temperatuur die niemand had gemeten -- en dat is precies wat
   de merkregel verbiedt.

   Nu draagt elk antwoord de reis van het lid mee (`reis`, uit
   kern/lid.js ledenInhoudVan). Is die er niet, dan zegt Rahul dat gewoon en
   vraagt hij waar het heen moet: een leeg dossier is een uitnodiging, geen
   gat om met verzinsels te vullen. */
function cannedAnswer(q, tier, reis) {
  const l = String(q || '').toLowerCase().trim();
  // rtg tutoyeert; lifestyle en business (en alles wat we niet kennen) niet
  const jij = tier === 'rtg';
  const kies = (uVorm, jeVorm) => (jij ? jeVorm : uVorm);
  const je = (u, j) => (jij ? j : u);           // los voornaamwoord in een zin
  const r = reis && reis.dest ? reis : null;
  const waarheen = r ? r.dest + (r.dates ? ' (' + r.dates + ')' : '') : null;
  // het onderdeel dat nog niet vaststaat: daar wacht Rahul echt op
  const inAanvraag = r && (r.items || []).find(i => i.status === 'req');
  // "waar wil je heen": de vaste wedervraag zodra er nog geen reis is
  const vraagReis = kies(
    'Zodra ik weet waar u heen wilt en wanneer, zet ik het hele voortraject voor u klaar. Waar mag het heen?',
    'Zodra ik weet waar je heen wilt en wanneer, zet ik het hele voortraject voor je klaar. Waar mag het heen?');

  /* DIT ANTWOORD BEGON MET "GEREGELD." EN DAT WAS NIET WAAR.

     Het gaat uit zodra een lid ja zegt op een aanbod ("ja", "graag", "doe
     maar", "regel het") en het beweerde dat de paklijst klaarstond en het
     dagplan was INGEPLAND, tot en met een boot van 10:00 en een tafel om
     21:00. Er wordt hier niets geboekt: dit is het vaste antwoord voor een
     installatie zonder API-sleutel, en dat is de handmatige stand en de suite.

     De merkregel is dat de AI nooit bevestigt dat iets geregeld is. De prompt
     draagt die regel sinds de vorige ronde, en juist dit antwoord ontsnapte:
     de toets die erop let filtert regels die met een quote beginnen, en deze
     begint met `return`. De grendel stond er dus, en keek langs de enige
     tekst die in de praktijk verstuurd wordt.

     Nu zegt hij wat er echt gebeurt: het staat als voorstel klaar, RTG vraagt
     het aan, en niets is bevestigd tot de partner ja zegt. */
  if (/^(ja|graag|ja graag|doe maar|prima|goed|regel het|ja, regel het)\b/.test(l)) {
    if (!r) return kies(
      'Ik pak het op. Alleen staat er nog geen reis van u in het systeem: er is dus niets in aanvraag en niets bevestigd. ' + vraagReis,
      'Ik pak het op. Alleen staat er nog geen reis van je in het systeem: er is dus niets in aanvraag en niets bevestigd. ' + vraagReis);
    return kies(
      'Ik zet het voor u in gang. Het voorstel komt in uw reisoverzicht bij ' + waarheen + ', en wat een partner moet bevestigen gaat als aanvraag de deur uit.\n\nNog niets is bevestigd: ik laat het u weten zodra zij ja zeggen. Wilt u dat ik het zo aanvraag?',
      'Ik zet het voor je in gang. Het voorstel komt in je reisoverzicht bij ' + waarheen + ', en wat een partner moet bevestigen gaat als aanvraag de deur uit.\n\nNog niets is bevestigd: ik laat het je weten zodra zij ja zeggen. Wil je dat ik het zo aanvraag?');
  }

  if (l.includes('inpak') || l.includes('paklijst') || l.includes('koffer')) {
    if (!r) return kies(
      'Een paklijst maak ik op de bestemming, het seizoen en wat u daar gaat doen -- anders is het een willekeurig lijstje. ' + vraagReis,
      'Een paklijst maak ik op de bestemming, het seizoen en wat je daar gaat doen -- anders is het een willekeurig lijstje. ' + vraagReis);
    return kies(
      'Voor ' + waarheen + ' loop ik het per dag na: kleding voor de dagen buiten, iets nets voor de avonden, en de documenten en medicijnen apart. Zal ik er een afvinklijst van maken in uw reisoverzicht?',
      'Voor ' + waarheen + ' loop ik het per dag na: kleding voor de dagen buiten, iets nets voor de avonden, en de documenten en medicijnen apart. Zal ik er een afvinklijst van maken in je reisoverzicht?');
  }

  if (l.includes('visum') || l.includes('paspoort') || l.includes('document')) {
    if (!r) return kies(
      'Welke documenten u nodig heeft hangt af van waar u heen gaat en met welk paspoort u reist; ik zoek dat liever op dan dat ik het gok. ' + vraagReis,
      'Welke documenten je nodig hebt hangt af van waar je heen gaat en met welk paspoort je reist; ik zoek dat liever op dan dat ik het gok. ' + vraagReis);
    return kies(
      'Voor ' + r.dest + ' zoek ik de document- en visumeisen na bij uw nationaliteit en geef ik u het antwoord met de bron erbij. Uw boekingsbevestigingen staan al klaar in de app. Zal ik dat nu uitzoeken?',
      'Voor ' + r.dest + ' zoek ik de document- en visumeisen na bij jouw nationaliteit en geef ik je het antwoord met de bron erbij. Je boekingsbevestigingen staan al klaar in de app. Zal ik dat nu uitzoeken?');
  }

  if (l.includes('weer')) {
    if (!r) return kies(
      'Het weer haal ik op voor de plek en de dagen waar het om gaat. ' + vraagReis,
      'Het weer haal ik op voor de plek en de dagen waar het om gaat. ' + vraagReis);
    return 'Voor ' + waarheen + ' houd ik de verwachting bij en trek ik hem vlak voor vertrek na; ver vooruit is het een aanname en geen voorspelling. Zal ik ' + je('u', 'je') + ' een bericht sturen zodra de verwachting betrouwbaar is?';
  }

  if (l.includes('plan') || l.includes('dag') || l.includes('doen')) {
    if (!r) return kies(
      'Een dagplan bouw ik op wat er op de bestemming te doen is en op het tempo dat u wilt. ' + vraagReis,
      'Een dagplan bouw ik op wat er op de bestemming te doen is en op het tempo dat je wilt. ' + vraagReis);
    return kies(
      'Ik zet een dagindeling voor ' + r.dest + ' als voorstel klaar: ochtend rustig, het uitje in het midden van de dag en de avond op tafel. Alles wat een partner moet bevestigen gaat als aanvraag. Zal ik dat zo klaarzetten?',
      'Ik zet een dagindeling voor ' + r.dest + ' als voorstel klaar: ochtend rustig, het uitje midden op de dag en de avond op tafel. Alles wat een partner moet bevestigen gaat als aanvraag. Zal ik dat zo klaarzetten?');
  }

  if (l.includes('restaurant') || l.includes('eten') || l.includes('diner')) {
    if (!r) return kies(
      'Een tafel regel ik via ons netwerk, tegen de normale prijs. Vertel me waar u bent of heen gaat en voor hoeveel personen, dan leg ik het voor.',
      'Een tafel regel ik via ons netwerk, tegen de normale prijs. Vertel me waar je bent of heen gaat en voor hoeveel personen, dan leg ik het voor.');
    if (inAanvraag) return kies(
      inAanvraag.title + ' staat nog in aanvraag; een partner reageert doorgaans binnen 48 uur en ik bewaak dat. Wilt u dat ik er alvast een alternatief naast leg?',
      inAanvraag.title + ' staat nog in aanvraag; een partner reageert doorgaans binnen 48 uur en ik bewaak dat. Wil je dat ik er alvast een alternatief naast leg?');
    return kies(
      'Voor ' + r.dest + ' leg ik u twee of drie adressen uit ons netwerk voor, tegen normale prijs, en vraag ik de tafel aan zodra u kiest. Voor welke avond en met hoeveel personen?',
      'Voor ' + r.dest + ' leg ik je twee of drie adressen uit ons netwerk voor, tegen normale prijs, en vraag ik de tafel aan zodra je kiest. Voor welke avond en met hoeveel personen?');
  }

  return kies(
    'De vrije AI-verrijking is nu niet actief. Alle onderdelen blijven beschikbaar via de schermen en vaste opdrachten. Ik kan u hier direct helpen met paklijsten, documenten, planning en aanvragen; voor een andere vraag kiest u het betreffende onderdeel in het menu.',
    'De vrije AI-verrijking is nu niet actief. Alle onderdelen blijven beschikbaar via de schermen en vaste opdrachten. Ik kan je hier direct helpen met paklijsten, documenten, planning en aanvragen; voor een andere vraag kies je het betreffende onderdeel in het menu.');
}

module.exports = { cannedAnswer };
