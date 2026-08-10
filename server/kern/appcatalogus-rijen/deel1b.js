/* RTG App-Bibliotheek, de rijen deel 1b. Vorm per app:
   [id, naam, categorie, url, uitleg]
   De uitleg over wat dit is staat in ../appcatalogus-data.js.
   Geknipt bij de sectie media & creatie omdat deel 1 over de 10 KB-lat ging
   die het modulebeleid stelt; appcatalogus-data.js plakt deel1, deel1b en
   deel2 in die volgorde weer aaneen, dus de bibliotheek blijft op volgorde. */
module.exports = [
  // ---- media & creatie ----
  ['mediaos', 'RTG Media', 'media', '/apps/media.html', 'Eén mediawereld over Klankwerk, Theater, Clips en Podium heen: muziek, kijk en flow als drie standen op dezelfde catalogus, met één makersprofiel en uw eigen regelaars in plaats van een algoritme.'],
  ['camera', 'Camera', 'media', '/apps/camera.html', 'Fotograferen, plus RTG Eye: voertuigschouw en hands-free werkvloerlog.'],
  ['muziek', 'RTG Sound', 'media', '/apps/muziek.html', 'Je muziek, rustig en zonder reclame.'],
  ['theater', 'Theater', 'media', '/apps/theater.html', 'Videobibliotheek op bioscoopniveau, tot 4K, met kanalen en reacties.'],
  ['clips', 'Clips', 'media', '/apps/clips.html', 'Korte video\'s die lokaal bij de maker blijven; een eindige dagselectie.'],
  ['klankwerk', 'RTG Klankwerk', 'media', '/apps/klankwerk.html', 'Zelf muziek maken: een raster, een notenrol en Rahul die iets neerzet. Alles wordt opgewekt, dus alles is van jou.'],
  ['zaal', 'De Zaal', 'media', '/apps/zaal.html', 'Wat leden zelf gemaakt hebben, op volgorde van wanneer het uitkwam. Geen hitlijst.'],
  ['podium', 'Podium', 'media', '/apps/podium.html', 'Je eigen live-kanaal (18+), met chat, RTG Pay-cadeaus en abonnementen.'],
  ['sitemaker', 'Website-maker', 'media', '/apps/sitemaker.html', 'Bouw met blokken je eigen RTG-site, met eigen foto\'s en beeld uit De Salon.'],
  ['browser', 'RTG Browser', 'media', '/apps/browser.html', 'Blader door de sites die leden in het RTG-web publiceren.'],
  ['werk', 'RTG Werk OS', 'media', '/apps/werk.html', 'De werkplek van een hele organisatie: startscherm per rol, projecten, kennisbank, klanten, servicedesk, bouw, apparaten, contracten en besluiten. Wat niet gemeten wordt, staat er als niet gemeten en niet als nul.'],
  /* RTG Kantoor is laag 2 (PLATFORM.md): hij ORKESTREERT Office, Agenda,
     Notities en Bestanden en vervangt ze niet. Alle vier zijn zelfstandige
     capabilities met een eigen kern -- op de toetsvraag "of slechts een tweede
     ingang naar dezelfde?" is het antwoord bij alle vier nee. Wat Kantoor
     toevoegt is wat nergens bestond: uw werkdag uit vier domeinen tegelijk. */
  ['kantoor', 'RTG Kantoor', 'media', '/apps/kantoor.html', 'Uw werkdag bij elkaar -- afspraken, open taken, documenten en gedeelde bestanden -- ongeacht in welke app ze leven. Maken en wijzigen blijft in de app die het echte werk doet.'],
  ['office', 'RTG Office', 'media', '/apps/office.html', 'Tekst en rekenblad met autosave, delen op codenaam en export.'],
  ['agenda', 'Agenda', 'media', '/apps/agenda.html', 'Maand, week en lijst; uitnodigen op codenaam, herinneringen, en je RTG-boekingen staan er vanzelf in.'],
  ['notities', 'Notities & Taken', 'media', '/apps/notities.html', 'Notities en lijstjes met vinkjes; delen op codenaam is samen werken, en een datum wordt vanzelf een agenda-afspraak.'],
  ['bestanden', 'Bestanden', 'media', '/apps/bestanden.html', 'De versleutelde kluis: mappen, versies, delen op codenaam en een prullenbak die 30 dagen bewaart. Je Office-werk staat er vanzelf bij.'],
  ['meet', 'Meet', 'sociaal', '/apps/meet.html', 'Vergaderen op codenaam: kamers met een korte code, scherm delen, en een Vergaderruimte-knop op elke agenda-afspraak. Beeld en geluid lopen peer-to-peer.'],
  ['galerij', 'Galerij', 'media', '/apps/galerij.html', 'Al je beelden op een plek: tijdlijn per maand, albums en favorieten. Leest De Salon en Bestanden; niets dubbel, geen gezichtsherkenning.'],
  ['gereedschap', 'Gereedschap', 'media', '/apps/gereedschap.html', 'Rekenmachine (met btw en rekening delen), wekkers en timers die op de server aftellen, stopwatch en wereldklok. Rahul zet ze ook voor je.'],
  ['vertaler', 'Vertaler', 'media', '/apps/vertaler.html', 'Typen of spreken, live vertalen, voorlezen en reiszinnen per situatie. Geschiedenis blijft op het toestel; zonder AI-sleutel vertaalt het huiswoordenboek eerlijk.'],
  ['memo', 'Memo', 'media', '/apps/memo.html', 'Spraakmemo\'s opnemen; de audio staat als gewoon bestand in je Bestanden-kluis. Het toestel luistert mee voor een transcript en Rahul vat samen als jij dat vraagt.'],
  ['scanner', 'Scanner', 'media', '/apps/scanner.html', 'Documenten vastleggen met de camera of uit je foto\'s, documentmodus voor leesbaar papier, en bewaren als PDF of losse foto\'s in je Bestanden-kluis.'],
  ['boeken', 'Boeken', 'media', '/apps/boeken.html', 'De huisbibliotheek plus je eigen tekstbestanden uit de kluis, met een rustige lezer. Alleen je leesplek reist mee; geen leesdoelen, geen reeksen.'],
  ['krant', 'RTG Krant', 'media', '/apps/krant.html', 'De kiosk: de kranten die nieuwsbedrijven binnen RTG uitgeven, elk in de eigen huisstijl.'],
  ['nieuws', 'Nieuws', 'media', '/apps/nieuws.html', 'RTG Nieuws per rubriek, met wat je later wilt lezen bewaard.'],
  ['garderobe', 'Garde-robe', 'media', '/apps/garderobe.html', 'Uw digitale garderobe: per stuk type, merk, kleur, maat en waar het hangt -- welke woning, welke kast. Plus uw vaklui: kleermaker, schoenmaker, stomerij.'],

  // ---- geld & werk ----
  ['metier', 'Métier', 'geld', '/apps/metier.html', 'Je beroepsprofiel op codenaam, met de rollen die RTG zelf heeft bevestigd. Je naam geef je per werkgever vrij, en je trekt hem net zo makkelijk weer in.'],
];
