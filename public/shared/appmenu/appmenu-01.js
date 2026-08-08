/* =================== HET APP-MENU: één hamburger, in de apps ===================

   WAAROM DIT ER IS. In de apps van het OS was er niets: je stond in Muziek of
   in de Mall en er was geen weg terug naar huis, geen instellingen, geen
   overzicht van wat die app kon; alleen de veeg van de onderrand, die je moest
   kennen. Eén hamburger rechtsboven, op elk app-scherm, lost dat op.

   HET BEGINSCHERM KRIJGT HEM NIET, en dat is een keuze en geen vergeetpost.
   Daar droeg de statusbalk eerst drie losse knopjes (batterij, bel,
   bedieningspaneel); die zijn weggehaald omdat drie tekens naast elkaar boven
   een scherm van lucht en een klok precies de stapeling zijn waar de
   merkregels tegen waarschuwen. Er een vierde teken voor terugzetten is dan
   niet veel beter. Het beginscherm is de rustplek: mappen, klok, functies, de
   balk van Rahul, en verder niets. Wat er aan systeem achter zit haal je van
   de bovenrand omlaag (shared/randen.js opent daar het bedieningspaneel), en
   dat paneel draagt zoeken, meldingen, scannen, je Zegel en je backoffice.

   WAT ER IN HET MENU STAAT, en waar het vandaan komt:

     1. DEZE APP -- de functies van het scherm waar je staat. Niet met de hand
        per app opgeschreven (dat zijn ruim honderdveertig bestanden die binnen
        een week uit elkaar lopen), maar gelezen uit wat de pagina AL heeft:
        de delenbalk van shared/deelmenu.js, de tabs, de knoppen die
        shared/ios.js in de navigatiebalk heeft gezet, en anders de eerste
        schakelrij die op vorm te herkennen is. Een app
        die iets beters te bieden heeft zegt dat zelf met RTGAppMenu.zet().

     2. OVERAL -- de vaste rijen: naar het beginscherm, terug, instellingen,
        meldingen, Rahul, delen, uitloggen. Elke rij verschijnt alleen als er
        op dit scherm ook echt iets achter zit.

   Dit bestand wordt door shared/ios.js binnengehaald, dus het staat vanzelf op
   elke app-pagina; er hoefde geen enkele HTML voor open. Uitzetten kan met
   <body data-appmenu-uit>. */
(function (w, d) {
  'use strict';
  if (w.RTGAppMenu) return;

  var body = d.body;
  if (!body || body.hasAttribute('data-appmenu-uit')) return;
  /* Het beginscherm doet niet mee: zie de kop. Daar is de bovenrand de ingang
     naar het systeem, niet een knop in beeld. */
  if (body.hasAttribute('data-ios-home')) return;

  var T = function (k, nl) { return (w.RTGi18n && w.RTGi18n.t) ? w.RTGi18n.t(k, nl) : nl; };

  /* HET MENU BRENGT ZIJN EIGEN WOORDEN MEE.

     shared/i18n.js leest de vertalingen uit window.I18N, en dat object wordt
     per PAGINA gevuld -- prima voor teksten die in die pagina staan, maar dit
     menu staat op alle pagina's en zou dan overal buiten apps/app.html in het
     Nederlands blijven hangen, ook voor wie Engels heeft gekozen. Een gedeelde
     laag hoort zijn eigen woordenboek bij zich te dragen.

     Aanvullen, nooit overschrijven: wat de pagina zelf al zegt wint, en via
     window.I18N.en lopen deze regels ook gewoon mee in de wereldtalen
     (i18n.js laadWereldDict vertaalt de Engelse set).

     Op een pagina die shared/i18n.js helemaal niet laadt -- en dat zijn de
     meeste app-schermen, die staan bewust in het Nederlands -- gebeurt er
     niets en blijft het menu Nederlands. Dat is ook goed: één Engelse
     menuknop op een verder Nederlands scherm is erger dan geen. */
  (function () {
    var eigen = {
      'menu.label': 'Menu', 'menu.sluit': 'Close menu', 'menu.thuis': 'Home screen',
      'menu.terug': 'One step back', 'menu.instel': 'Settings', 'menu.rahul': 'Ask Rahul',
      'menu.deel': 'Share this screen', 'menu.deze': 'This app',
      'menu.overal': 'Everywhere', 'menu.app': 'This app',
      'menu.niets': 'There is nothing extra to do on this screen.',
      'os.zoek': 'Search', 'app.notifs': 'Notifications', 'app.logout': 'Sign out',
      'os.cc.scan': 'Scan', 'os.cc.zegel': 'My Seal', 'os.cc.bo': 'My back office',
      'os.cc.vol': 'Full screen'
    };
    w.I18N = w.I18N || {};
    w.I18N.en = w.I18N.en || {};
    for (var k in eigen) if (!(k in w.I18N.en)) w.I18N.en[k] = eigen[k];
  })();

