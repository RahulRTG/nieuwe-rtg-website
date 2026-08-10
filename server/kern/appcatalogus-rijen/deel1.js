/* RTG App-Bibliotheek, de rijen deel 1. Vorm per app:
   [id, naam, categorie, url, uitleg]
   De uitleg over wat dit is staat in ../appcatalogus-data.js. */
module.exports = [

  // ---- sociaal & contact ----
  /* RTG Sociaal is laag 2 (PLATFORM.md): hij ORKESTREERT Berichten, De Salon,
     Genootschap, Pulse en de rest, en vervangt ze niet. */
  ['sociaal', 'RTG Sociaal', 'sociaal', '/apps/sociaal.html', 'Wat er tussen u en de mensen om u heen speelt -- gesprekken die op antwoord wachten, aanstaande bijeenkomsten, en wat er in uw kring geplaatst is. Praten en plaatsen blijft in de app die het echte werk doet.'],
  ['berichten', 'Berichten', 'sociaal', '/apps/comm.html', 'Alle gesprekken van het platform op een plek -- mensen, zaken, onderweg, officieel -- met bellen en videobellen in de kop van het gesprek. Rahul vat samen, stelt een antwoord op en haalt de afspraken eruit.'],
  ['salon', 'De Salon', 'sociaal', '/apps/salon.html', 'Het besloten sociale netwerk van RTG: zelf plaatsen met foto\'s en onderwerpen, leden volgen, bewaren en reageren. Rahul schrijft een bijschrift mee en vat de reacties samen.'],
  ['genootschap', 'Genootschap', 'sociaal', '/apps/genootschap.html', 'Besloten groepen met een prikbord, peilingen en bijeenkomsten. Geheim is echt geheim, en er is geen enkele groeitruc.'],
  ['pulse', 'Pulse', 'sociaal', '/apps/pulse.html', 'De hoogtepunten van vandaag in jouw RTG-wereld, rustig gebundeld, geen eindeloze feed.'],
  /* Deze twee beschrijvingen klopten geen van beide met de code. Cercle heette
     "de mensen die dichtbij staan" terwijl de module clubs en lidmaatschappen
     bijhoudt; Entourage heette "je vaste mensen en hun rol" wat naar personeel
     leest terwijl het om uw reisgezelschap gaat. Ze leken daardoor twee
     ingangen naar dezelfde capability -- en dat waren ze niet.
     Een beschrijving is geen etiket maar wat een lid leest voordat hij kiest;
     staat er iets anders dan de app doet, dan zoekt hij op de verkeerde plek. */
  ['cercle', 'Cercle', 'sociaal', '/apps/cercle.html', 'Uw besloten clubs en lidmaatschappen: stad, lidnummer, dresscode, met welke clubs er reciprociteit is en hoeveel gastpassen u nog heeft. Vraag "waar kan ik in Milaan terecht" en u ziet op welk lidmaatschap.'],
  ['entourage', 'Entourage', 'sociaal', '/apps/entourage.html', 'Uw vaste reisgezelschap: wie u meeneemt, hun band, dieet en documenten met vervaldatum. Stel een gezelschap samen en zie wat er ontbreekt voordat u aan de balie staat.'],
  ['rendezvous', 'Rendez-vous', 'sociaal', '/apps/rendezvous.html', 'Afspraken en ontmoetingen plannen met je kring.'],
  ['vonk', 'Vonk', 'sociaal', '/apps/vonk.html', 'RTG Vonk: kennismaken op wens; bij een wederzijdse match reserveert RTG een tafel in het midden.'],
  ['attenties', 'Attenties', 'sociaal', '/apps/attenties.html', 'Uw relatiebeheer: per relatie de band, de belangrijke data en hun voorkeuren, plus de giftgeschiedenis zodat u nooit twee keer hetzelfde geeft.'],

  // ---- reizen & verblijf ----
  /* RTG Reizen is de wereld erboven (PLATFORM.md, laag 2): hij orkestreert de
     reisapps en vervangt ze niet. Hij staat daarom NAAST Verblijven,
     Reisbureau, Vluchten en Hangar en niet in plaats daarvan -- die vier houden
     hun eigen catalogus en hun eigen boekingsstroom. Wat hij toevoegt is wat
     nergens bestond: uw komende reis bij elkaar, uit alle domeinen tegelijk. */
  ['reizen', 'RTG Reizen', 'reizen', '/apps/reizen.html', 'Uw komende reis bij elkaar -- vlucht, verblijf, reis en charter -- ongeacht in welke app u hem boekte. Boeken en annuleren blijft in de app die het echte werk doet.'],
  ['rtg', 'Het Huis', 'reizen', '/apps/rtg.html', 'Reserveren, boeken en bestellen bij alle partners, alles op codenaam.'],
  ['hotels', 'Verblijven', 'reizen', '/apps/hotels.html', 'Hotels, appartementen en villa\'s met ledenprijzen en keyless toegang.'],
  ['reisbureau', 'Reisbureau', 'reizen', '/apps/reisbureau.html', 'Samengestelde reizen tegen de nettoprijs, met AI-reisadvies in gewone woorden.'],
  ['reisboek', 'Reisboek', 'reizen', '/apps/reisboek.html', 'Uw prive-reisdossier: per reis een draaiboek met de heen- en terugreis, de verblijven, de reisdocumenten met geldigheid en een dag-tot-dag-programma.'],
  ['vluchten', 'Vluchten', 'reizen', '/apps/vluchten.html', 'Vluchten zoeken, boeken en volgen.'],
  ['hangar', 'Hangar', 'reizen', '/apps/hangar.html', 'Uw privevliegtuigen en charters: per toestel type, registratie, thuishaven en stoelen, met de vluchten, de vlieguren en de laatst bekende positie.'],
  ['ov', 'RTG OV', 'reizen', '/apps/ov.html', 'Bus, trein, metro, veerboot en taxi in één reisapp, met live GPS en snelle check-in.'],
  ['navigatie', 'Navigatie', 'reizen', '/apps/navigatie.html', 'Navigeren met de RTG-kaart.'],
  ['flits', 'Flits', 'reizen', '/apps/flits.html', 'Een ingetogen rijscherm met community-meldingen (flitser, file, ongeval) en spraak.'],
  ['stad', 'Mijn Stad', 'reizen', '/apps/stad.html', 'Alles om je heen in het RTG-web, op de kaart van je stad.'],
  ['maison', 'Maison', 'reizen', '/apps/maison.html', 'Huishouden en staf: uw huishoudelijk personeel met rol en contact, de lopende taken met wie en wanneer, en een logboek van wat er in en om huis speelt.'],

  // ---- eten & uitgaan ----
  ['foodcourt', 'Food Court', 'eten', '/apps/foodcourt.html', 'Alle restaurants op een rij; reserveren met tijdsloten in een paar tikken.'],
  ['table', 'Table', 'eten', '/apps/table.html', 'De prive-diners en events die u zelf geeft: gastenlijst met dieet en voorkeuren, tafelindeling, menu per gang. Herbruikbaar voor de volgende keer.'],
  ['cellier', 'Cellier', 'eten', '/apps/cellier.html', 'Uw wijnkelder: per fles domein, jaargang, aantal, waarde en drinkvenster. Het overzicht wijst aan wat nu op dronk is, met de kelderwaarde. Een fles schenken telt af.'],
  ['uitgaan', 'Uitgaan', 'eten', '/apps/uitgaan.html', 'Bars, clubs en beachclubs met hun avonden en gastenlijsten.'],
];
