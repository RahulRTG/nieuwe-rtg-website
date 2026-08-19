/* DE SCHILBALK ALS COMMANDBALK: van een strook die zegt waar je bent, naar een
   instrument dat meebeweegt met wat je doet.

   WAT ER STOND. Onderaan de werktafel lag een balk met drie zones: de bank
   links, je werkbladen in het midden, Rahul rechts. Met nul bladen stond er
   "Kies een wereld" -- een zin, geen bediening. Om bij een wereld te komen moest
   je eerst de lade openen: twee handelingen voor de enige handeling die dat
   scherm heeft.

   WAT ER NU STAAT. Dezelfde drie zones op dezelfde plekken, maar het midden is
   een CONTEXTZONE: de werelden als er niets openstaat, de handelingen die een
   blad aanmeldt zodra er een openstaat, en de handelingen van een selectie zodra
   je iets aanwijst. De tabel staat in ADAPTIEF.md.

   DE STRUCTUUR BLIJFT VOORSPELBAAR, en dat is de hele voorwaarde. Links is
   altijd de bank, rechts is altijd Rahul, en het midden begint altijd met waar
   je bent. Wat verandert is de INHOUD van het midden, nooit de plekken.

   WAT DEZE LAAG NIET WEET. Hij kent geen documenten, cellen of dia's. Hij vraagt
   het register (shared/adaptief/register.js) welke capabilities er nu spelen en
   in welke vorm ze hier horen, en tekent dat. Een app die morgen bijkomt hoeft
   dit bestand niet aan te raken -- dat is het verschil tussen een framework en
   honderd losse uitzonderingen.

   Levert window.RTGAdaptiefBalk; shared/command/werktafel.js bouwt hem. */
(function (w, d) {
  'use strict';
  w.RTGAdaptiefBalk = function (o) {
    var root = o.root, A = w.RTGAdaptief;
    var zone = null, anker = null, rij = null, meer = null, kijker = null;
    /* De knoppen en de overloop staan in shared/adaptief/balkknop.js: dat gaat
       over WAT er in de zone staat, dit over de zone zelf. Ze krijgen de rij en
       de titel als vraag mee en niet als waarde, want allebei veranderen bij
       elke hertekening. */
    var knoppen = w.RTGAdaptiefBalkKnoppen({
      items: function () { return laatsteRij; },
      titel: function () { return (anker && !anker.hidden && anker.textContent) || ''; }
    });
    var vastBladen = false, laatsteRij = [], laatsteBreedte = -1, meetKlok = 0, laatsteBlad = null;

    function balk() { return root && root.querySelector('.cmd-balk'); }

    /* ---------------------------------------------------------- opbouwen --
       De zone komt NA de bladen en VOOR de sluitknop. Dat is DOM-volgorde en
       geen `order`: de greep staat links, Rahul rechts, en een schermlezer
       leest ze waar ze staan -- dezelfde afspraak als de vraagstand van Rahul
       (WERELD.md). */
    function bouw() {
      var b = balk();
      if (!b || zone) return;
      zone = d.createElement('div');
      zone.className = 'cmd-acties';
      zone.setAttribute('role', 'toolbar');
      zone.setAttribute('aria-label', 'Handelingen');
      anker = d.createElement('button');
      anker.type = 'button';
      anker.className = 'cmd-anker';
      anker.onclick = function () { vastBladen = true; teken(); };
      rij = d.createElement('div');
      rij.className = 'cmd-actierij';
      meer = d.createElement('button');
      meer.type = 'button';
      meer.className = 'cmd-meer';
      meer.textContent = '⋯';
      meer.setAttribute('aria-label', 'Meer handelingen');
      meer.onclick = function () { knoppen.openLade(); };
      zone.appendChild(anker); zone.appendChild(rij); zone.appendChild(meer);
      var bladen = b.querySelector('.cmd-balkbladen');
      if (bladen && bladen.nextSibling) b.insertBefore(zone, bladen.nextSibling);
      else b.appendChild(zone);
      /* MEET NIET OP EEN MOMENT, VOLG HET ELEMENT. Hoeveel knoppen er passen
         hangt af van de breedte van de zone, en die verandert met het venster,
         met de anker-naam en met de sluitknop die erbij komt of wegvalt. Eén
         meting bij het opbouwen gaf een rij die op een gedraaide telefoon of
         achter een lange documentnaam over de rand liep (WERELD.md, dezelfde
         les als de sterrenhemel). */
      if (w.ResizeObserver) { kijker = new w.ResizeObserver(hermeet); kijker.observe(b); }
      laatsteBreedte = b.clientWidth;
      if (A) { A.opContext(function () { vastBladen = false; teken(); }); A.opVorm(teken); }
    }

    /* HOEVEEL PAST ER? METEN, NIET DELEN.

       Hier stond een deling: de breedte van de zone gedeeld door 46. Dat gaf op
       een telefoon van 390 met een documentnaam ervoor precies EEN knop, want de
       som klopte wel maar de aannames erin niet -- knoppen zijn niet allemaal
       even breed, en de reservering voor ⋯ ging er ook af als er niets
       overliep.

       Nu wordt er geteld tot het niet meer past. Dat is exact, ongeacht wat een
       knop draagt (een letter, een glyf, twee tekens), en het is meteen het
       antwoord op de tweede fout: knoppen weghalen verandert de breedte van de
       balk niet, dus roept dit zichzelf niet opnieuw op. */
    function pas() {
      if (!zone || !rij) return;
      /* ⋯ KRIJGT ZIJN PLEK VOORAF. Hij werd hierna getoond, en dat kostte de rij
         alsnog 44px die net was volgemaakt: vijf knoppen pasten, en met de
         overloopknop erbij liep de vijfde onder de rand door. Vooraf reserveren
         en achteraf teruggeven kan niet misgaan -- teruggeven maakt alleen maar
         ruimte vrij. */
      meer.hidden = laatsteRij.length < 2;
      var over = 0;
      while (rij.children.length > 1 && rij.scrollWidth > rij.clientWidth + 1) {
        rij.removeChild(rij.lastChild); over++;
      }
      if (!over) meer.hidden = true;
    }
    /* De waarnemer mag alleen bijten als de BREEDTE veranderde. Zonder die
       voorwaarde melde hij ook op hertekeningen van zichzelf, en dat leverde de
       browsermelding "ResizeObserver loop completed with undelivered
       notifications" -- die hier als clientfout in het logboek belandde. */
    function hermeet() {
      if (!zone) return;
      var b = balk(); if (!b) return;
      if (b.clientWidth === laatsteBreedte) return;
      laatsteBreedte = b.clientWidth;
      if (meetKlok) w.cancelAnimationFrame(meetKlok);
      meetKlok = w.requestAnimationFrame(function () { meetKlok = 0; teken(); });
    }

    /* ------------------------------------------------------------ tekenen --
       Drie bronnen, in deze volgorde: een selectie of bladcontext die een app
       aanmeldt, anders de werelden als er niets openstaat, anders de bladen.

       Bij nul handelingen valt de zone helemaal weg en staat de balk er weer
       zoals hij was. Een lege actiebalk is erger dan geen actiebalk: hij belooft
       bediening en levert een streep. */
    function teken() {
      if (!zone) return;
      var b = balk(); if (!b) return;
      var ctx = A ? A.context() : null;
      var items = (A && ctx && ctx.acties.length) ? A.voorNu() : [];
      var nu = blad();
      var titel = (ctx && ctx.titel) || (nu && nu.titel) || '';
      /* EEN TIK OP HET ANKER MAG GEEN EENRICHTINGSWEG ZIJN. Hij zet de zone terug
         op je werkbladen, en dat bleef zo tot er toevallig een nieuwe context
         kwam -- op een blad dat niets meldt zat je daarna vast. Kies je een ander
         blad, dan is de vraag "waar ben ik" beantwoord. */
      if (nu !== laatsteBlad) { laatsteBlad = nu; vastBladen = false; }

      if (!items.length && !panes().length && !vastBladen) { items = werelditems(); titel = ''; }
      if (vastBladen || !items.length) { b.setAttribute('data-zone', 'bladen'); laatsteRij = []; return; }

      b.setAttribute('data-zone', 'acties');
      /* HET ANKER WIJKT BIJ EEN SELECTIE, en dat is een maatbesluit. Op 390px
         houdt de balk 234px over tussen de bank en Rahul; een documentnaam eet
         daar de helft van, en dan blijft er ruimte voor één handeling. Bij een
         selectie is "waar je bent" bovendien geen vraag -- je kijkt naar wat je
         net aanwees -- en dan horen de handelingen die ruimte te krijgen.

         Wat je daarmee inlevert: zolang er tekst geselecteerd is, is de weg
         terug naar je werkbladen niet in de balk. Hij komt terug zodra je de
         selectie loslaat, en de bank links blijft de hele tijd staan. */
      var toonAnker = !!titel && !(ctx && ctx.selectie);
      anker.hidden = !toonAnker;
      anker.textContent = toonAnker ? titel : '';
      if (toonAnker) anker.title = titel + ' · toon werkbladen';
      laatsteRij = items;
      rij.textContent = '';
      items.forEach(function (it) { rij.appendChild(knoppen.knop(it)); });
      /* De overloop verbergt niets: wat niet past staat in de lade, en de lade
         draagt de VOLLEDIGE lijst en niet alleen de rest -- zoeken naar "stond
         hij nou in de balk of erachter" is precies wat progressive disclosure
         niet hoort te kosten. */
      meer.hidden = true;
      pas();
    }


    /* ------------------------------------------------------- de werelden --
       Op het beginscherm is de enige handeling: kies een wereld. Die stonden
       alleen in de lade, twee tikken diep. Ze staan nu in de balk zelf.

       De lijst komt uit dezelfde bron als de bank -- o.werelden(), aangereikt
       door app-main uit MAPPEN. Geen tweede lijst hier (WERELD.md, LAT.md regel
       4); als die lijst leeg is staat er niets en valt de zone gewoon weg. */
    function werelditems() {
      var lijst = [];
      try { lijst = (o.werelden && o.werelden()) || []; } catch (e) {}
      return lijst.filter(function (x) { return x && x.naam && x.url; })
        .map(function (x) {
          return { id: 'schil.wereld.' + x.url, naam: x.naam, label: x.naam, teken: x.teken,
            groep: 'Werelden', doe: function () { o.open(x.url, x.naam); } };
        });
    }

    function panes() { try { return o.panes() || []; } catch (e) { return []; } }
    // het blad zelf, niet zijn naam: twee bladen mogen dezelfde titel dragen
    function blad() { var p = panes(), i = o.actief ? o.actief() : -1; return p[i] || null; }

    function stop() { if (kijker) { kijker.disconnect(); kijker = null; } zone = null; }

    return { bouw: function () { bouw(); teken(); }, sync: teken, stop: stop };
  };
})(window, document);
