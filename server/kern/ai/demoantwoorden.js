/* AI (deelmodule): de VASTE DEMO-ANTWOORDEN, voor een installatie zonder
   Claude API-sleutel -- en dat is elke demo en de hele toetssuite. Dit is dus
   niet het randgeval maar het gewone geval, en het is de tekst die in de
   praktijk het vaakst verstuurd wordt.

   Waarom apart van ./prompt: dat bestand gaat over de instructie AAN het model
   en dit over wat er uitgaat als er geen model is. Twee dingen, twee bestanden
   -- en prompt.js liep met deze tekst erbij over de 10 kB-grens (check.js
   regel 13), wat de natuurlijke naad alleen maar bevestigde. */
'use strict';

/* Demo-antwoorden wanneer er geen Claude API-key is.

   HET REGISTER HOORT BIJ DE PAS, OOK HIER.

   AI_TONE in kern/ai.js is er stellig over: de RTG Pass tutoyeert (je/jij),
   Lifestyle en Business spreken met u. Die regel zat alleen in de SYSTEM
   PROMPT, en die geldt uitsluitend als er een API-sleutel is. Zonder sleutel
   -- elke demo, en de hele toetssuite -- kwamen deze vaste antwoorden eruit,
   en die stonden allemaal in de u-vorm. Een lid met een RTG Pass werd dus
   vousvoyeerd door de app die hem juist zou tutoyeren.

   Dat is dezelfde vorm als de fout die hierboven staat beschreven: de regel
   stond er wel, maar keek langs de tekst die in de praktijk verstuurd wordt.
   Vandaar dat het register nu in de antwoorden zelf zit, met de pas als
   invoer, en dat test/menselijkverkeer.test.js erop let. */
function cannedAnswer(q, tier) {
  const l = q.toLowerCase().trim();
  // rtg tutoyeert; lifestyle en business (en alles wat we niet kennen) niet
  const jij = tier === 'rtg';
  const kies = (uVorm, jeVorm) => (jij ? jeVorm : uVorm);
  /* DIT ANTWOORD BEGON MET "GEREGELD." EN DAT WAS NIET WAAR.

     Het gaat uit zodra een lid ja zegt op een aanbod ("ja", "graag", "doe
     maar", "regel het") en het beweerde dat de paklijst klaarstond en het
     dagplan was INGEPLAND, tot en met een boot van 10:00 en een tafel om
     21:00. Er wordt hier niets geboekt: dit is het vaste antwoord voor een
     installatie zonder API-sleutel, en dat is elke demo en de hele suite.

     De merkregel is dat de AI nooit bevestigt dat iets geregeld is. De prompt
     draagt die regel sinds de vorige ronde, en juist dit antwoord ontsnapte:
     de toets die erop let filtert regels die met een quote beginnen, en deze
     begint met `return`. De grendel stond er dus, en keek langs de enige
     tekst die in de praktijk verstuurd wordt.

     Nu zegt hij wat er echt gebeurt: het staat als voorstel klaar, RTG vraagt
     het aan, en niets is bevestigd tot de partner ja zegt. */
  if (/^(ja|graag|ja graag|doe maar|prima|goed|regel het|ja, regel het)\b/.test(l))
    return kies('Ik zet het voor u in gang. De paklijst staat als voorstel in uw reisoverzicht, en voor 20 juli leg ik dit voor: 10:00 privéboot naar Formentera, lunch aan boord, en om 21:00 een tafel bij Sal de Mar.\n\nNog niets is bevestigd: de boot en de tafel gaan als aanvraag naar de partners en ik laat het u weten zodra zij ja zeggen. Wilt u dat ik het zo aanvraag?',
      'Ik zet het voor je in gang. De paklijst staat als voorstel in je reisoverzicht, en voor 20 juli leg ik dit voor: 10:00 privéboot naar Formentera, lunch aan boord, en om 21:00 een tafel bij Sal de Mar.\n\nNog niets is bevestigd: de boot en de tafel gaan als aanvraag naar de partners en ik laat het je weten zodra zij ja zeggen. Wil je dat ik het zo aanvraag?');
  if (l.includes('inpak') || l.includes('paklijst') || l.includes('koffer'))
    return kies('Voor Ibiza in juli (25-31°C, zonnig):\n• Lichte kleding + zwemkleding\n• Zonnebrand en een hoed\n• Nette outfit voor Sal de Mar\n• Een lichte trui voor de avonden aan zee\n\nZal ik hier een afvinklijst van maken in uw reisoverzicht?',
      'Voor Ibiza in juli (25-31°C, zonnig):\n• Lichte kleding + zwemkleding\n• Zonnebrand en een hoed\n• Nette outfit voor Sal de Mar\n• Een lichte trui voor de avonden aan zee\n\nZal ik hier een afvinklijst van maken in je reisoverzicht?');
  if (l.includes('visum') || l.includes('paspoort') || l.includes('document'))
    return kies('Voor Ibiza (Spanje, EU) heeft u als Nederlander geen visum nodig; een geldige ID-kaart of paspoort volstaat. Ik zet uw boekingsbevestigingen alvast klaar in de app, mocht ernaar gevraagd worden.',
      'Voor Ibiza (Spanje, EU) heb je als Nederlander geen visum nodig; een geldige ID-kaart of paspoort volstaat. Ik zet je boekingsbevestigingen alvast klaar in de app, mocht ernaar gevraagd worden.');
  if (l.includes('weer'))
    return 'Ibiza medio juli: gemiddeld 25-31°C, veel zon en warme avonden. De beste tijd voor de boot naar Formentera is vroeg in de ochtend, vóór de drukte; zal ik het vertrek op 10:00 laten aanhouden?';
  if (l.includes('plan') || l.includes('dag') || l.includes('doen'))
    return 'Voorstel voor 20 juli:\n• 10:00 privéboot naar Formentera\n• 13:00 lunch aan boord of op het strand\n• 18:00 terug, borrel bij Sunset Ibiza\n• 21:00 diner bij Sal de Mar (staat in aanvraag)\n\nZal ik de strandlunch laten reserveren?';
  if (l.includes('restaurant') || l.includes('eten') || l.includes('diner'))
    return kies('Uw tafel bij Sal de Mar (19 jul, 21:00) is in aanvraag, bevestiging volgt doorgaans binnen 48 uur. Wilt u een reservelijst? Ik denk aan een strandrestaurant in Cala Jondal of een adres in Marina Botafoch, beide via ons netwerk tegen normale prijs.',
      'Je tafel bij Sal de Mar (19 jul, 21:00) is in aanvraag, bevestiging volgt doorgaans binnen 48 uur. Wil je een reservelijst? Ik denk aan een strandrestaurant in Cala Jondal of een adres in Marina Botafoch, beide via ons netwerk tegen normale prijs.');
  return kies('Daar zoek ik het fijne van uit en ik kom er vandaag nog op terug. Voor uw reis naar Ibiza kan ik alvast helpen met de paklijst, documenten, het weer of een dagplanning, zeg het maar.',
      'Daar zoek ik het fijne van uit en ik kom er vandaag nog op terug. Voor je reis naar Ibiza kan ik alvast helpen met de paklijst, documenten, het weer of een dagplanning, zeg het maar.');
}

module.exports = { cannedAnswer };
