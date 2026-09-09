(function (w) {
  'use strict';
  w.RTGTravelOSConfig = {
    routes: {
      '/apps/vluchten.html': {
        naam: 'VLUCHTEN', actief: 'reizen', scene: 'aviation', eigenHero: true,
        titel: 'Vertrek met overzicht.',
        intro: 'Boeking, inchecken, gate en aankomst in één rustig vluchtbeeld.',
        stappen: [['ZOEKEN', 'Lijnvlucht en private aviation'], ['VERTREK', 'Check-in, gate en documenten'], ['AANKOMST', 'Transfer staat op tijd klaar']]
      },
      '/apps/hotels.html': {
        naam: 'VERBLIJVEN', actief: 'reizen', scene: 'villa', eigenHero: true,
        titel: 'Uw verblijf, rustig voorbereid.',
        intro: 'Van de eerste selectie tot de bevestigde kamer en aankomst.',
        stappen: [['SELECTIE', 'Hotel, appartement of villa'], ['BEVESTIGD', 'Prijs en voorwaarden vooraf'], ['AANKOMST', 'Adres, sleutel en vervoer bijeen']]
      },
      '/apps/reisbureau.html': {
        naam: 'REISBUREAU', actief: 'reizen', scene: 'desk',
        titel: 'Eén reis. Eén regisseur.',
        intro: 'Een persoonlijk voorstel waarin vlucht, verblijf en beweging op elkaar aansluiten.',
        stappen: [['UW WENS', 'In gewone woorden'], ['VOORSTEL', 'Eén geheel, helder geprijsd'], ['REGIE', 'Een mens blijft bereikbaar']]
      },
      '/apps/ov.html': { naam: 'MOBILITEIT', actief: 'reizen', scene: 'mobility', eigenHero: true },
      '/apps/navigatie.html': { naam: 'NAVIGATIE', actief: 'reizen', scene: 'road', kaart: true },
      '/apps/rit.html': {
        naam: 'AANKOMST & CHAUFFEUR', actief: 'taxi', scene: 'road', eigenHero: true,
        titel: 'Van aankomst naar bestemming.',
        intro: 'Transfer, chauffeur en verblijf sluiten aan zonder dat u opnieuw hoeft te beginnen.',
        stappen: [['AANVRAGEN', 'Ophaalpunt, bestemming en bagage'], ['ONTVANGEN', 'Chauffeur en ontmoetingspunt'], ['THUISKOMEN', 'Rit, gastheer en sleutel bijeen']]
      },
      '/apps/reisboek.html': {
        naam: 'REISBOEK', actief: 'reizen', scene: 'documents', eigenHero: true,
        titel: 'Uw reis beweegt met u mee.',
        intro: 'Vlucht, chauffeur, verblijf, documenten en wijzigingen vormen samen één rustige reis.',
        stappen: [['VANDAAG', 'Elk volgend moment op zijn plaats'], ['DOCUMENTEN', 'Alleen wat veilig bij uw reis hoort'], ['WIJZIGINGEN', 'Voorstellen klaar; u beslist']]
      },
      '/apps/hangar.html': {
        naam: 'PRIVATE MOBILITY', actief: 'reizen', scene: 'aviation',
        titel: 'Private mobility, strak geregeld.',
        intro: 'Toestel, bemanning, vluchtlogboek en voorbereiding in één discreet overzicht.',
        stappen: [['TOESTEL', 'Vloot en beschikbaarheid'], ['VLUCHT', 'Bemanning en slot'], ['LOGBOEK', 'Elke beweging vastgelegd']]
      },
      '/apps/flits.html': {
        naam: 'VERKEER', actief: 'reizen', scene: 'road',
        titel: 'Vooruitkijken op de weg.',
        intro: 'Wat onderweg speelt, precies op tijd en zonder onnodige afleiding.',
        stappen: [['VOORUIT', 'Files en gevaren op uw route'], ['RUST', 'Alleen melden wat ertoe doet'], ['SAMEN', 'Community-informatie gecontroleerd']]
      },
      '/apps/stad.html': {
        naam: 'STAD', actief: 'reizen', scene: 'city',
        titel: 'Aangekomen. Nu begint de plek.',
        intro: 'Uw adressen, reserveringen en lokale ritme bij elkaar.',
        stappen: [['DICHTBIJ', 'Adressen die nu passen'], ['GERESERVEERD', 'Uw plekken voor vandaag'], ['VERDER', 'Vervoer tot aan de deur']]
      },
      '/apps/boeken.html': {
        naam: 'BOEKEN', actief: 'reizen', scene: 'documents',
        titel: 'Rust voor onderweg.',
        intro: 'Uw eigen bibliotheek reist mee, zonder doelen, reeksen of afleiding.',
        stappen: [['UW PLANK', 'Eigen teksten uit de kluis'], ['LEESPLEK', 'Gaat mee met uw account'], ['PRIVÉ', 'Wat u leest blijft van u']]
      },
      '/apps/residentie.html': {
        naam: 'DE RÉSIDENCE', actief: 'reizen', scene: 'residence',
        titel: 'Uw huis, waar u ook bent.',
        intro: 'Een besloten plek om aan te komen, elkaar te ontmoeten en uw eigen suite te openen.',
        immersive: true, geenNav: true
      },
      '/apps/ovdienst.html': {
        naam: 'OV-DIENST', scene: 'operations', titel: 'De dienst blijft in beweging.',
        intro: 'Haltes, reizigers en voertuigstatus in één veilig werkbeeld.', operations: true
      },
      '/apps/ovroutes.html': {
        naam: 'ROUTETEKENAAR', scene: 'operations', titel: 'Lijnen die kloppen.',
        intro: 'Teken haltes, volgorde en tarieven zonder de operatie uit het oog te verliezen.', operations: true
      },
      '/apps/ovcontrol.html': {
        naam: 'MOBILITY CONTROL', scene: 'operations', titel: 'Rust in de operatie.',
        intro: 'Live zicht op vloot, lijnen en capaciteit. Automatisering adviseert; mensen beslissen.', operations: true
      },
      '/apps/luchthaven.html': {
        naam: 'AIRPORT OPERATIONS', scene: 'operations', titel: 'Iedere beweging voorbereid.',
        intro: 'Vluchtleiding, platform, bagage en security werken vanuit hetzelfde operationele beeld.', operations: true
      }
    },
    profiles: {
      invite: {
        naam: 'REISUITNODIGING', scene: 'documents',
        titel: 'Uw reis staat klaar.',
        intro: 'Open alleen wat voor u is klaargezet. De details komen pas in beeld nadat u de reis overneemt.',
        guest: true, geenNav: true
      }
    }
  };
})(window);
