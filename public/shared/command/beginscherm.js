/* HET BEGINSCHERM VAN RTG COMMAND -- wat er staat als er nul werkbladen open zijn.

   Een eigen bestand omdat het een eigen onderwerp is: werktafel.js gaat over
   bladen (openen, sluiten, onthouden), dit gaat over wat een mens ziet als hij
   binnenkomt. Het is ook de reden dat werktafel.js over de 10 KB ging.

   HET HUIS OPENT NOOIT LEEG (WERELD.md, herzien 12 september 2026).

   Hier stond een regel tekst -- "Kies een wereld om te beginnen." -- boven een
   leeg vlak, en dat was het eerste wat elk nieuw lid zag. De werelden stonden
   wel in de schilbalk, maar als pictogram zonder opschrift en onder een tweede
   balk die eroverheen schilderde. Gemeten: nul leesbare handelingen
   (`npm run eersteminuut`).

   Wat hier staat is het minimum dat de nieuwe norm haalt: betekenis, een
   herkenbare ingang en ten minste een bruikbare volgende stap. Geen dashboard
   en geen voorgekookte activiteit -- dat blijft verboden, en er wordt hier dus
   ook niets geladen, geopend of verstuurd.

   GEEN TWEEDE LIJST EN GEEN TWEEDE PAD. De werelden komen uit o.werelden(),
   dezelfde bron die de bank leest (en die uit MAPPEN komt). De ingang opent de
   BESTAANDE balk van Rahul via de praatlaag -- precies wat een tik op de mond
   doet. Wie hier een eigen router of een eigen wereldlijst neerzet, herhaalt de
   fout van shared/rtg-edge-worlds.js (MENS.md par. 3). */
(function(w,d){
  'use strict';
  w.RTGCommandBeginscherm=function(vak,o){
      var m=d.createElement('div');m.className='cmd-leeg';
      /* HET HUIS OPENT NOOIT LEEG (WERELD.md, herzien 12 september 2026).

         Hier stond een regel tekst -- "Kies een wereld om te beginnen." -- boven
         een leeg vlak, en dat was jarenlang het eerste wat een nieuw lid zag.
         De werelden stonden wel in de schilbalk, maar als pictogram zonder
         opschrift en onder een tweede balk die eroverheen schilderde. Gemeten:
         nul leesbare handelingen (`npm run eersteminuut`).

         Wat er nu staat is het minimum dat die norm haalt: betekenis, een
         herkenbare ingang en ten minste een bruikbare volgende stap. Geen
         dashboard, geen voorgekookte activiteit -- dat blijft verboden, en er
         wordt hier dus ook niets geladen, geopend of verstuurd.

         GEEN TWEEDE LIJST EN GEEN TWEEDE PAD. De werelden komen uit
         o.werelden(), dezelfde bron die de bank leest (en die uit MAPPEN komt).
         Het vraagveld opent de BESTAANDE balk van Rahul via praat.open() --
         precies wat een tik op de mond doet. Wie hier een eigen router of een
         eigen wereldlijst neerzet, heeft de fout van shared/rtg-edge-worlds.js
         herhaald (MENS.md par. 3). */
      var uur=new Date().getHours();
      var groet=uur<6?'Goedenacht.':uur<12?'Goedemorgen.':uur<18?'Goedemiddag.':'Goedenavond.';
      var kop=d.createElement('p');kop.className='cmd-groet';kop.textContent=groet;m.appendChild(kop);
      /* GEEN VOORNAAMWOORD IN DEZE ZIN. De toon verschilt per pas -- je/jij bij
         RTG Pass, u bij Lifestyle en Business (CLAUDE.md) -- en deze schil weet
         niet welke pas er kijkt. "Wat wil je doen?" is op twee van de drie
         passen fout; een zin zonder voornaamwoord is op alle drie goed. */
      var vraag=d.createElement('button');vraag.type='button';vraag.className='cmd-intentie';
      vraag.textContent='Typ of zeg wat er geregeld moet worden';
      vraag.setAttribute('aria-label','Zeg wat er geregeld moet worden');
      vraag.onclick=function(){if(o.praat)o.praat()};
      m.appendChild(vraag);
      var lijst=[];try{lijst=(o.werelden&&o.werelden())||[]}catch(e){}
      lijst=lijst.filter(function(x){return x&&x.naam&&x.url});
      if(lijst.length){
        var titel=d.createElement('h2');titel.className='cmd-starttitel';
        titel.textContent='Uw werelden';m.appendChild(titel);
        var nav=d.createElement('nav');nav.className='cmd-startwerelden';
        nav.setAttribute('aria-label','Werelden');
        var omschrijvingen={
          living:'Dagelijks leven en welzijn',
          work:'Werk en organisaties',
          travel:'Reizen en onderweg',
          foundation:'Samen helpen en bijdragen'
        };
        lijst.forEach(function(x){
          var b=d.createElement('button');b.type='button';b.className='cmd-startwereld';
          var sleutel=(x.naam+' '+x.url).toLowerCase();
          var wereld=sleutel.indexOf('living')>-1?'living':sleutel.indexOf('work')>-1||sleutel.indexOf('kantoor')>-1?'work':
            sleutel.indexOf('travel')>-1||sleutel.indexOf('reiz')>-1?'travel':'foundation';
          var naam=d.createElement('strong');naam.textContent=x.naam;
          var uitleg=d.createElement('small');uitleg.textContent=omschrijvingen[wereld];
          b.dataset.url=x.url;b.dataset.world=wereld;b.appendChild(naam);b.appendChild(uitleg);
          b.onclick=function(){o.open(x.url,x.naam)};
          nav.appendChild(b);});
        m.appendChild(nav);
      } else {
        /* Nul werelden is een geldige stand en geen storing (bank.js): een gast,
           of een pagina die de lijst niet aanreikt. Dan zegt het scherm dat, in
           plaats van een lege nav te tonen. */
        var uitleg=d.createElement('span');uitleg.className='cmd-leegreden';
        uitleg.textContent='Er zijn hier nog geen werelden om te openen.';m.appendChild(uitleg);
      }
    vak.appendChild(m);
  };
})(window,document);
