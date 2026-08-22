/* De wereldschil van de ANDERE twee lagen van de RTFoundation.

   PLATFORM.md noemt drie niveaus -- individu, professional, organisatie -- en
   apps/foundation/sessie/sessie-03.js dekt het eerste: het gezin. Dit bestand
   dekt de andere twee, en dat zijn er met opzet TWEE en niet een.

   Waarom niet een. Het lijkt twaalf schermen van dezelfde soort ("alles wat
   niet het gezin is"), maar hun eigen koppen zeggen iets anders:

     Foundation OS · Governance · Clubs & steden · Mijn lijst · RTF-kantoor
       -- dit is de STICHTING die werkt. Medewerkers, bestuur, veldwerk.

     Portaal voor partners, gemeenten en ondernemers · Mijn hulpvraag ·
     Mijn giften · Mijn vrijwilligerswerk · RTFoundation in uw buurt
       -- dit zijn MENSEN EN ORGANISATIES DIE MET de stichting te maken hebben.
          Iemand die hulp vraagt, iemand die geeft, iemand die meehelpt.

   En de code zegt het ook: os.html linkt naar kantoor, governance, veld,
   portaal en publiek; os-portaal.html linkt naar deelnemer, donateur,
   vrijwilliger en publiek. Twee bomen, een raakpunt. Een deelnemer die zijn
   hulpvraag opent, hoort geen tab "Governance" te zien -- dat is niet zijn
   huis, en de balk zou hem vertellen dat hij ergens hoort waar hij niet hoort.

   os-publiek staat in de portaalset en niet in de kantoorset, hoewel os.html
   er ook naar linkt: die pagina ("Wat wij doen, bij u in de buurt") is
   geschreven voor de bezoeker, niet voor de medewerker.

   Laden met een gewone <script src="schil-os.js" defer>; dit bestand kiest
   zelf welke van de twee sets bij het huidige scherm hoort. */
(function (w, d) {
  'use strict';
  if (w.RTGWereld) return;

  var KANTOOR = {
    sleutel: 'rtf-os',
    naam: 'Foundation OS',
    bestemmingen: [
      { id: 'overzicht', naam: 'Overzicht', href: 'os.html', glyf: 'gebouw',
        schermen: ['os'] },
      { id: 'kantoor', naam: 'Kantoor', href: 'kantoor.html', glyf: 'office',
        schermen: ['kantoor'] },
      { id: 'clubs', naam: 'Clubs', href: 'clubswerk.html', glyf: 'entourage',
        schermen: ['clubswerk', 'club'] },
      { id: 'veld', naam: 'Veld', href: 'os-veld.html', glyf: 'navigatie',
        schermen: ['os-veld'] },
      { id: 'partners', naam: 'Partners', href: 'partner.html', glyf: 'rendezvous',
        schermen: ['partner'] },
      { id: 'bestuur', naam: 'Bestuur', href: 'os-bestuur.html', glyf: 'schild',
        schermen: ['os-bestuur'] }
    ]
  };

  var PORTAAL = {
    sleutel: 'rtf-portaal',
    naam: 'RTFoundation-portaal',
    bestemmingen: [
      { id: 'portaal', naam: 'Portaal', href: 'os-portaal.html', glyf: 'rtf',
        schermen: ['os-portaal'] },
      { id: 'hulpvraag', naam: 'Hulpvraag', href: 'os-deelnemer.html', glyf: 'help',
        schermen: ['os-deelnemer'] },
      { id: 'giften', naam: 'Giften', href: 'os-donateur.html', glyf: 'mecenaat',
        schermen: ['os-donateur'] },
      { id: 'meehelpen', naam: 'Meehelpen', href: 'os-vrijwilliger.html', glyf: 'hart',
        schermen: ['os-vrijwilliger'] },
      { id: 'buurt', naam: 'In de buurt', href: 'os-publiek.html', glyf: 'stad',
        schermen: ['os-publiek'] }
    ]
  };

  /* Welke set hoort bij dit scherm? Uit de URL, net als de actieve bestemming
     in shared/wereldschil.js -- zodat er geen tweede waarheid ontstaat over
     waar je bent. Een scherm dat in geen van beide staat krijgt geen balk;
     dat is eerlijker dan de verkeerde. */
  var m = /\/([^\/?#]+)\.html?$/.exec(w.location.pathname);
  var nu = m ? m[1].toLowerCase() : '';

  function bevat(set) {
    for (var i = 0; i < set.bestemmingen.length; i++) {
      var s = set.bestemmingen[i].schermen || [];
      for (var j = 0; j < s.length; j++) if (s[j] === nu) return true;
    }
    return false;
  }

  var gekozen = bevat(PORTAAL) ? PORTAAL : (bevat(KANTOOR) ? KANTOOR : null);
  if (!gekozen) return;
  w.RTGWereld = gekozen;

  try {
    if (!d.querySelector('link[href="/shared/wereldschil.css"]')) {
      var blad = d.createElement('link');
      blad.rel = 'stylesheet';
      blad.href = '/shared/wereldschil.css';
      (d.head || d.documentElement).appendChild(blad);
    }
    if (!d.querySelector('script[src="/shared/wereldschil.js"]')) {
      var s = d.createElement('script');
      s.src = '/shared/wereldschil.js';
      (d.head || d.documentElement).appendChild(s);
    }
    /* De pictogrammen komen uit shared/glyf.js; deze schermen dragen de
       sessielaag niet, dus die haalt hij hier zelf op. */
    if (!d.querySelector('script[src="/shared/glyf.js"]')) {
      var g = d.createElement('script');
      g.src = '/shared/glyf.js';
      (d.head || d.documentElement).appendChild(g);
    }
  } catch (e) {}
})(window, document);
