/* Het Privekantoor, deelbestand "plattegrond": de twintig werelden als tabel.

   Alleen data. Wie een wereld toevoegt of een deur verlegt, hoeft ./kamers.js
   niet te openen -- en omgekeerd blijft de motor daar leesbaar zonder honderd
   regels tekst ertussen.

   `pas` zegt welke pas de app zelf vraagt: 'lifestyle' is onderdeel van deze
   suite, 'rtg' is een algemene RTG-app die deze wereld ook bedient. Elk pad
   hieronder MOET als bestand bestaan; test/bureau.test.js loopt ze na. */
'use strict';

// pas: welke pas de app zelf vraagt. 'lifestyle' = onderdeel van deze suite,
// 'rtg' = een algemene RTG-app die deze wereld ook bedient.
const K = (id, naam, wat, kamers, apps) => ({ id, naam, wat, kamers, apps });

const KAMERS = [
  K('prive', 'Private Office', 'Uw zaken, uw beslissingen, uw correspondentie en het logboek van wat er voor u geregeld is.',
    ['cases', 'prive'], [{ naam: 'Zaken & beslissingen', url: '/apps/lifestyle.html', pas: 'lifestyle' },
      { naam: 'Logboek', url: '/apps/logboek.html', pas: 'lifestyle' }]),
  K('vermogen', 'Family Office', 'Wat u bezit, wat het waard is, wie het verzekert en wanneer het opnieuw bekeken moet worden.',
    ['vermogen'], [{ naam: 'Bezittingenregister', url: '/apps/lifestyle.html', pas: 'lifestyle' },
      { naam: 'Balans', url: '/apps/balans.html', pas: 'rtg' }]),
  K('huishouden', 'Household Office', 'Uw huizen tot op de pomp in het zwembad: ruimtes, installaties, onderhoud, garanties en wie het levert.',
    ['huishouden'], [{ naam: 'Woningtweeling', url: '/apps/lifestyle.html', pas: 'lifestyle' },
      { naam: 'Maison', url: '/apps/maison.html', pas: 'lifestyle' }]),
  K('reizen', 'Travel Office', 'Van draaiboek tot nazorg: verblijven, documenten, verstoringen met hun gevolgen, bonnen, achtergelaten spullen en punten.',
    ['reizen'], [{ naam: 'Reisdek', url: '/apps/lifestyle.html', pas: 'lifestyle' },
      { naam: 'Reisboek', url: '/apps/reisboek.html', pas: 'lifestyle' },
      { naam: 'Vluchten', url: '/apps/vluchten.html', pas: 'rtg' }]),
  K('vervoer', 'Mobility Office', 'Toestellen, vaartuigen en wagens: waar ze staan, wanneer ze gekeurd moeten en wat ze kosten.',
    ['vervoer'], [{ naam: 'Hangar', url: '/apps/hangar.html', pas: 'lifestyle' },
      { naam: 'Logboek', url: '/apps/logboek.html', pas: 'lifestyle' }]),
  K('zakelijk', 'Executive Office', 'Uw professionele kant: de ochtend- en avondbriefing, uw netwerk, de boardroom en de zakelijke agenda.',
    [], [{ naam: 'Uw briefing', url: '/apps/lifestyle.html', pas: 'lifestyle' },
      { naam: 'RTG Zakelijk', url: '/apps/zakelijk.html', pas: 'lifestyle' },
      { naam: 'Boardroom', url: '/apps/boardroom.html', pas: 'rtg' }]),
  K('kring', 'Social Office', 'De mensen om u heen: wie bij wie hoort, wanneer u elkaar zag, waar het over ging, en wat u beter niet aanroert.',
    ['kring'], [{ naam: 'Relatiekring', url: '/apps/lifestyle.html', pas: 'lifestyle' },
      { naam: 'Cercle', url: '/apps/cercle.html', pas: 'lifestyle' },
      { naam: 'Attenties', url: '/apps/attenties.html', pas: 'lifestyle' },
      { naam: 'Rendez-vous', url: '/apps/rendezvous.html', pas: 'lifestyle' }]),
  K('gelegenheden', 'Events Office', 'Van een diner tot een besloten feest: locatie, gasten, menu en de avond zelf.',
    ['gelegenheden'], [{ naam: 'Table', url: '/apps/table.html', pas: 'lifestyle' }]),
  K('gezondheid', 'Health Office', 'Afspraken en uw persoonlijke dossier. Besloten: dit blijft bij u.',
    ['gezondheid'], [{ naam: 'Gezondheid & welzijn', url: '/apps/lifestyle.html', pas: 'lifestyle' },
      { naam: 'Vitaal', url: '/apps/vitaal.html', pas: 'rtg' }]),
  K('onderwijs', 'Education Office', 'Scholen, opleidingen en wat de kinderen nodig hebben.',
    [], [{ naam: 'RTG School', url: '/apps/rtgschool.html', pas: 'rtg' }]),
  K('collectie', 'Culture Office', 'Kelder, garderobe en verzamelingen -- met herkomst, taxatiereeks, conditie, standplaats en bruikleen.',
    ['collectie'], [{ naam: 'Collectiedossier', url: '/apps/lifestyle.html', pas: 'lifestyle' },
      { naam: 'Cellier', url: '/apps/cellier.html', pas: 'lifestyle' },
      { naam: 'Garde-robe', url: '/apps/garderobe.html', pas: 'lifestyle' }]),
  K('gezelschap', 'Staff Office', 'Uw vaste mensen: wie ze zijn, wat er is afgesproken en welke documenten lopen.',
    ['gezelschap', 'staf'], [{ naam: 'Entourage', url: '/apps/entourage.html', pas: 'lifestyle' },
      { naam: 'Maison', url: '/apps/maison.html', pas: 'lifestyle' }]),
  K('filantropie', 'Philanthropy Office', 'Wat u geeft, aan wie, en wat het daar doet.',
    ['filantropie'], [{ naam: 'Mecenaat', url: '/apps/mecenaat.html', pas: 'lifestyle' },
      { naam: 'RTFoundation', url: '/apps/foundation/vrienden.html', pas: 'rtg' }]),
  K('juridisch', 'Legal Office', 'Dossiers, contracten en de afstemming met uw advocaat of notaris.',
    [], [{ naam: 'Juridisch', url: '/apps/juridisch.html', pas: 'rtg' }]),
  K('fiscaal', 'Tax Office', 'Documenten, deadlines en de afstemming met uw accountant. Uw fiscalist beslist.',
    [], [{ naam: 'Belastingkantoor', url: '/apps/belastingkantoor.html', pas: 'rtg' }]),
  K('nalatenschap', 'Legacy Office', 'Uw wensen, uw documenten en uw vertrouwenspersonen. Besloten: dit blijft bij u.',
    ['nalatenschap'], [{ naam: 'Nalatenschap', url: '/apps/nalatenschap.html', pas: 'lifestyle' }]),
  K('beveiliging', 'Security Office', 'Posten per woning, reisrisico met een houdbaarheid, digitale rondes, en een incident dat meteen een team krijgt.',
    ['beveiliging'], [{ naam: 'Beveiliging', url: '/apps/lifestyle.html', pas: 'lifestyle' }]),
  K('reputatie', 'Reputation Office', 'Optredens met hun embargo, de afgesproken lijn per onderwerp, uw woordvoerders en wat er is verschenen.',
    ['reputatie'], [{ naam: 'Reputatie', url: '/apps/lifestyle.html', pas: 'lifestyle' }]),
  K('inkoop', 'Personal Commerce', 'Persoonlijke inkoop en sourcing: zeg wat u nodig heeft; wat geleverd wordt, staat daarna in uw register.',
    [], [{ naam: 'Een inkoopzaak aanleggen', url: '/apps/lifestyle.html', pas: 'lifestyle' }]),
  K('dieren', 'Pet Office', 'Uw dieren: verzorging, dierenarts, documenten met hun geldigheid, en wie er voor ze zorgt als u weg bent.',
    ['dieren'], [{ naam: 'Dieren', url: '/apps/lifestyle.html', pas: 'lifestyle' }])
];


module.exports = KAMERS;
