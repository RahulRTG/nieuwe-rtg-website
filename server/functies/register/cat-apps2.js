/* Vervolg van cat-apps: op de 10 kB-grens geknipt, op een rij-grens.
   Zelfde vorm; register/index.js voegt beide samen. */
'use strict';
const { LEDEN, LEDEN_RTF, LEDEN_GAST } = require('./doelgroepen');

module.exports = [
  { id: 'socialewereld', categorie: 'Eigen apps', naam: 'RTG Sociaal (de kring op een plek)', standaard: true, doelgroepen: LEDEN,
    uitleg: 'De samenhanglaag over De Salon, berichten, pulse en de ontmoetingen: wat er tussen u en uw kring speelt. ' +
      'De onderliggende apps hebben hun eigen schakelaars.',
    paden: ['/api/sociaal'] },
  // Let op: NIET 'office' als id; die naam is al van de RTG-Backoffice hieronder.
  { id: 'kantoorpakket', categorie: 'Eigen apps', naam: 'RTG Office (kantoorpakket)', standaard: true, doelgroepen: LEDEN,
    uitleg: 'Het eigen kantoorpakket: tekstdocumenten en rekenbladen op uw account, alleen-lezen te delen op codenaam.', paden: ['/api/kantoorpakket'] },
  /* Het Ondernemers-OS. Stond met al zijn routes BUITEN de schakelkast -- niet
     door een besluit maar door optelling: de app groeide en stap twee (deze
     catalogus) bleef liggen. Vanuit de boardroom was hij daardoor niet uit te
     zetten en greep de storingswachter er nooit op in. Een pad volstaat: alles
     onder /api/onderneming hoort bij deze ene app, en dat is precies de reden
     dat het OS een OS heet en geen verzameling modules. */
  { id: 'ondernemersos', categorie: 'Eigen apps', naam: 'RTG Ondernemers-OS', standaard: true, doelgroepen: LEDEN,
    uitleg: 'Van "ik denk erover na" tot een draaiend bedrijf in een scherm: de verkenning en de stress test, de rechtsvorm en het oprichtingsproject, het dagbeeld met debiteuren, btw, kas en capaciteit, de verkooppijplijn en het bestuur met de UBO-afleiding.',
    /* /api/concern hoort bij deze app en niet bij een eigen knop: het concern
       IS de onderneming zodra er meer dan een vennootschap onder hangt. Zonder
       dit pad stonden de boom en de bulk-acties buiten de schakelkast -- weer
       door optelling, precies zoals hierboven beschreven, en daarom staat de
       reden er nu bij in plaats van alleen het pad. */
    paden: ['/api/onderneming', '/api/concern'] },
  { id: 'vonk', categorie: 'Eigen apps', naam: 'RTG Vonk (dating)', standaard: true, doelgroepen: LEDEN,
    uitleg: 'Dating op codenaam met de Salon-veiligheidslat: 18+, geverifieerd paspoort, een eindige dagselectie, en bij een match automatisch een tafel rond het midden van beide woonplaatsen (EUR 10 p.p., waarvan EUR 5 voor RTG).', paden: ['/api/vonk'] },
  { id: 'mediaos', categorie: 'Eigen apps', naam: 'RTG Media (één mediawereld)', standaard: true, doelgroepen: LEDEN,
    uitleg: 'De laag die Klankwerk, Theater, Clips en Podium tot één wereld maakt: drie standen (muziek, kijk, flow) op dezelfde catalogus, één makersprofiel, één volgrelatie, één bibliotheek en de eigen smaakregelaars. Zet u hem uit, dan blijven de vier apps eronder gewoon werken.',
    paden: ['/api/mediaos'] },
  { id: 'clips', categorie: 'Eigen apps', naam: 'RTG Clips (korte video’s)', standaard: true, doelgroepen: LEDEN,
    uitleg: 'Korte verticale video’s die alleen op het toestel van de maker staan (OPFS); kijken is rechtstreeks P2P. De feed is een eindige dagselectie, bewust zonder oneindige scroll.', paden: ['/api/clips'] },
  { id: 'oog', categorie: 'Eigen apps', naam: 'RTG Eye (werkvloer-camera)', standaard: true, doelgroepen: ['leverancier', 'personeel'],
    uitleg: 'De camerablik van de werkvloer: voertuigschouw en het handsfree uitgifteregister. Standaard voor genres met voertuigen of voorraad; de boardroom kan per genre bijsturen.',
    paden: ['/api/staff/oog', '/api/supplier/oog'],
    alleenGenres: ['taxi', 'jet', 'helikopter', 'ov', 'verhuur', 'charter', 'boerderij', 'retail', 'groothandel', 'hotel', 'activiteit', 'beveiliging'] },
  { id: 'ghost', categorie: 'Eigen apps', naam: 'Ghost Driver (simulatie)', standaard: true, doelgroepen: ['leverancier', 'intern'],
    uitleg: 'De voorspellende verkeers- en logistieksimulatie. Standaard alleen voor vervoerders; de verkeersleiding (kantoor) ziet altijd alles.',
    paden: ['/api/supplier/ghost', '/api/office/ghost'],
    alleenGenres: ['taxi', 'jet', 'helikopter', 'ov', 'charter'] },

  /* De gastkant van de horecatoren en de avondplanner. Ze stonden allebei met
     al hun routes BUITEN de kast -- dezelfde optelling als bij het
     Ondernemers-OS hierboven: routes schrijven is stap een, deze catalogus is
     stap twee, en stap twee bleef liggen. Vanuit de boardroom waren ze niet uit
     te zetten en greep de storingswachter er nooit op in.

     LET OP BIJ DE GASTKANT: een gast aan tafel 12 heeft vaak GEEN account, en
     dan levert doelgroepVanVerzoek() null op -- er telt voor hem alleen de
     globale schakelaar. Dat is precies goed: wie de QR scant hoort niet buiten
     te vallen omdat hij geen pas heeft, maar de zaal moet wel in een keer dicht
     kunnen als er iets mis is. De doelgroepen hieronder sturen dus alleen de
     leden-ingangen (bezorgen, afhalen, de foodcourt). */
  { id: 'gastos', categorie: 'Eigen apps', naam: 'RTG Hospitality Guest OS (de gastkant)', standaard: true, doelgroepen: LEDEN_GAST,
    uitleg: 'Bestellen vanaf je eigen telefoon: aan tafel via de QR, op je hotelkamer op de gastrekening, in de club op je polsband, ' +
      'en van huis uit laten bezorgen, afhalen of een foodcourt-mandje bij meer loketten. Dezelfde rekening die de bediening ziet; ' +
      'dit zet de gastdeur open of dicht, niet het horecasysteem van de zaak.',
    paden: ['/api/gast'] },
  { id: 'avondos', categorie: 'Eigen apps', naam: 'RTG Evening OS (een avond plannen)', standaard: true, doelgroepen: LEDEN,
    uitleg: 'Een hele avond als plan: eten, iets drinken en de rit naar huis, binnen je budget en op tijd thuis. Elke stap wijst naar ' +
      'een echte boeking in zijn eigen domein en draagt zijn eigen staat; een tafel wordt aangevraagd en nooit door de planner bevestigd. ' +
      'Hier zit ook de Hospitality DNA: wat een zaak van je te zien krijgt, per soort en per zaak.',
    paden: ['/api/avond'] },

];
