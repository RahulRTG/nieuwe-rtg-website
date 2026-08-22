/* De WERKTAFEL van RTG Command: het meubel -- bank, tabbladen, bladen, de
   sleepbare scheiding en de lade. De grendel (wie er naar binnen mag) staat in
   shared/command.js.

   Deze laag stelt GEEN toegangsvragen: die krijgt hij van de grendel mee. */
(function(w,d){
  'use strict';
  w.RTGCommandWerktafel=function(o){
    var root=null,panes=[],actief=-1,consoleLaag=null,INSTELLINGEN=o.catalog.INSTELLINGEN,titelVan=o.catalog.titelVan;
    var stand='open',bank=null,praatLaag=null;
    var poort=w.RTGCommandInlogpoort();
    var ICON={terug:'<path d="M15 5l-7 7 7 7"/>',home:'<path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/>',verder:'<path d="M9 5l7 7-7 7"/>',instel:'<path d="M4 7h10M18 7h2M4 17h2M10 17h10M14 4v6M6 14v6"/>',menu:'<path d="M4 6h16M4 12h16M4 18h16"/>',reis:'<path d="M4 19h16M6 19V8h12v11M9 8V5h6v3"/>',geld:'<rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 10h18"/>',salon:'<path d="M5 20v-7h14v7M7 13V8a5 5 0 0110 0v5"/>',mens:'<circle cx="12" cy="7" r="4"/><path d="M4 21a8 8 0 0116 0"/>',plus:'<path d="M12 5v14M5 12h14"/>',kruis:'<path d="M6 6l12 12M18 6L6 18"/>',play:'<path d="M8 5l11 7-11 7z"/>',pauze:'<path d="M8 5v14M16 5v14"/>'};
    function svg(k){return '<svg viewBox="0 0 24 24" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+ICON[k]+'</svg>'}

    /* zet() is de enige ingang voor de stand. Wisselt hij, dan wordt opnieuw
       opgebouwd en niet omgebouwd. In de open stand begint bouw() LEEG -- hier
       stonden twee open()-aanroepen, en welke apps dat zouden zijn is een keuze
       van een mens en niet van het huis. */
    function zet(s){if(root&&stand!==s)sloop();stand=s;bouw()}
    function bouw(){if(root||!o.magBestaan())return;root=d.createElement('div');root.id='rtgCommand';root.dataset.stand=stand;root.innerHTML='<aside class="cmd-bank"><div class="cmd-adem"></div><nav class="cmd-nav" aria-label="Hoofdnavigatie"></nav><div class="cmd-bankvoet"><button data-cmd="settings">'+svg('instel')+'<span>INSTELLINGEN</span></button></div></aside><main class="cmd-werk"><div class="cmd-tabs" role="tablist"></div><button class="cmd-toevoeg" aria-label="Werkblad openen">'+svg('plus')+'</button><div class="cmd-kiezer" hidden></div><div class="cmd-panes"></div><div class="cmd-praat" role="log" aria-live="polite" hidden></div><div class="cmd-balk"><button class="cmd-lade" aria-label="Apps" aria-expanded="false">'+svg('menu')+'</button><div class="cmd-balkbladen" role="tablist"></div><button class="cmd-balksluit" aria-label="Sluit dit werkblad" hidden>'+svg('kruis')+'</button><form class="cmd-vraagvorm"><input class="cmd-vraagveld" type="text" maxlength="300" autocomplete="off" aria-label="Vraag Rahul" placeholder="Vraag Rahul\u2026"><button class="cmd-vraagstuur" type="submit" aria-label="Stuur naar Rahul">'+svg('verder')+'</button></form><button class="cmd-mondknop" type="button" aria-label="Vraag Rahul"></button></div></main>';d.body.appendChild(root);d.body.classList.add('rtg-command');consoleLaag=w.RTGCommandConsole({root:root,svg:svg,context:o.catalog.context,bestemming:o.bestemming,open:o.open,sluit:sluit,thuis:o.thuis,getPanes:function(){return panes},getActief:function(){return actief}});consoleLaag.bouw();bank=w.RTGCommandBank({root:root,svg:svg,apps:[],stand:stand,open:o.open,werelden:o.werelden,systeem:o.systeem,inlog:o.inlog});bank.bouw();praatLaag=w.RTGCommandPraat({root:root,bestemming:o.bestemming});praatLaag.bouw();if(stand==='gesloten')poort.naar(root.querySelector('.cmd-panes'));else leeg();balk();
      root.querySelector('.cmd-toevoeg').onclick=function(){var k=root.querySelector('.cmd-kiezer');k.hidden=!k.hidden};
      root.querySelector('[data-cmd=settings]').onclick=stand==='gesloten'?function(){o.inlog()}:function(){o.open(INSTELLINGEN[1],INSTELLINGEN[0])};
      }
    /* Afbreken staat op EEN plek. Het stond in de matchMedia-luisteraar en liet
       `actief` en `consoleLaag` wijzen naar DOM die net weg was. */
    function sloop(){if(!root)return;poort.terug();if(praatLaag)praatLaag.stop();root.remove();root=null;panes=[];actief=-1;consoleLaag=null;praatLaag=null;d.body.classList.remove('rtg-command');}

    function openNaast(a,kant){if(!a)return null;for(var i=0;i<panes.length;i++)if(panes[i].url===a[1]){select(i);return panes[i]}if(panes.length>=2){var weg=actief===0?1:0;verwijder(weg)}var p=toon(a[1],a[0]);if(p&&kant==='links'&&panes.length===2){panes.splice(panes.indexOf(p),1);panes.unshift(p);root.querySelector('.cmd-panes').insertBefore(p.el,root.querySelector('.cmd-panes').firstChild);actief=0;sync()}return p}
    /* toon() gaat ervan uit dat het MAG: de grendel staat in shared/command.js
       en wordt daar een keer gesteld. */
    function toon(url,titel){bouw();if(!root||!url)return null;for(var i=0;i<panes.length;i++)if(panes[i].url===url){select(i);return panes[i]}
      if(panes.length>=2)verwijder(actief>=0?actief:0);var p={url:url,titel:titelVan(url,titel)},el=d.createElement('section');el.className='cmd-pane';var f=d.createElement('iframe');f.title=p.titel;f.src=url;if(w.RTGMedia)w.RTGMedia.kader(f);el.appendChild(f);root.querySelector('.cmd-panes').appendChild(el);p.el=el;p.frame=f;panes.push(p);f.addEventListener('load',function(){haakScroll(p);});select(panes.length-1);sync();return p}
    function verwijder(i){var p=panes[i];if(!p)return;p.el.remove();panes.splice(i,1);actief=Math.min(panes.length-1,Math.max(0,i-1))}
    function sluit(i){var p=panes[i];if(!p)return;p.el.classList.add('sluit');setTimeout(function(){var nu=panes.indexOf(p);if(nu<0)return;verwijder(nu);sync()},220)}
    function select(i){actief=i;sync();if(consoleLaag)consoleLaag.intro()}
    /* Ging op index, en verwijderen gebeurt pas na de animatie: met twee bladen
       sloot sluit(0) twee keer hetzelfde en bleef het tweede staan. */
    function sluitAlles(){panes.slice().forEach(function(p){var i=panes.indexOf(p);if(i>=0)sluit(i)})}
    function wis(){panes.slice().forEach(function(p){p.el.remove()});panes=[];actief=-1}
    /* NUL BLADEN IS EEN TOESTAND, GEEN EINDE: de werktafel is het beginscherm,
       dus inloggen en het laatste blad sluiten komen op dezelfde plek uit. Hier
       stond sloop(), en dat klopte zolang de klok de landing was. */
    function leeg(){var vak=root.querySelector('.cmd-panes');vak.textContent='';
      var m=d.createElement('div');m.className='cmd-leeg';
      m.innerHTML='<span>Kies een wereld om te beginnen.</span>';vak.appendChild(m)}
    /* DE SCHILBALK: op een telefoon het enige wat de schil zelf laat zien. Hij
       verving de tabstrip bovenin -- twee navigatielagen boven elkaar -- en
       staat onderaan binnen duimbereik.

       Vier dingen: de bank, waar je bent, weg hier, en Rahul (shared/command/
       praat.js, die van deze balk een vraagveld maakt). Bij nul bladen valt de
       sluitknop weg -- een knop zonder iets om te sluiten doet niets. */
    function balk(){
      var rij=root.querySelector('.cmd-balkbladen'),kruis=root.querySelector('.cmd-balksluit');
      if(!rij)return;
      rij.textContent='';
      panes.forEach(function(p,i){
        var b=d.createElement('button');
        b.className='cmd-balkblad'+(i===actief?' actief':'');
        b.setAttribute('role','tab');b.setAttribute('aria-selected',i===actief?'true':'false');
        b.textContent=p.titel;
        b.onclick=function(){select(i)};
        rij.appendChild(b);
      });
      kruis.hidden=!panes.length;
      kruis.onclick=function(){if(actief>=0)sluit(actief)};
    }
    function sync(){if(!root)return;root.dataset.bladen=panes.length;var tabs=root.querySelector('.cmd-tabs');tabs.textContent='';
      if(!panes.length){balk();if(stand!=='gesloten')leeg();return}
      balk();
      var oudLeeg=root.querySelector('.cmd-leeg');if(oudLeeg)oudLeeg.remove();panes.forEach(function(p,i){p.el.classList.toggle('actief',i===actief);var b=d.createElement('button');b.className='cmd-tab'+(i===actief?' actief':'');b.setAttribute('role','tab');b.innerHTML='<span>'+p.titel+'</span><i aria-label="Sluiten">×</i>';b.onclick=function(e){if(e.target.tagName==='I')sluit(i);else select(i)};tabs.appendChild(b)});verdeler();root.querySelectorAll('.cmd-nav button[data-url]').forEach(function(b){b.classList.toggle('actief',panes[actief]&&panes[actief].url===b.dataset.url)});if(consoleLaag)consoleLaag.intro()}
    /* De scheiding hoort bij TWEE bladen naast elkaar: een brede-schermvorm. Op
       een telefoon staat er een blad in beeld, dus valt er niets te verdelen.
       De inline `flex` van het slepen gaat hier ook weg, anders draagt een blad
       zijn desktopbreedte mee naar een smal venster. */
    function verdeler(){w.RTGCommandVerdeler(root.querySelector('.cmd-panes'),panes,o.breed())}
    // #rtg-cookie op ID: het aria-label is vertaald, en stond in het Engels dubbel
    function haakScroll(p){try{var doc=p.frame.contentDocument,st=doc.createElement('style');st.textContent='#rahulFab,.rahulfab,.rahulsheet,.mgz-blok,.mgz-ruimte,.amn-knop,#rtg-cookie{display:none!important}body{padding-bottom:0!important}';doc.head.appendChild(st);p.frame.contentWindow.addEventListener('scroll',klein,{passive:true});var sc=doc.querySelectorAll('[class*=content],main');for(var i=0;i<sc.length;i++)sc[i].addEventListener('scroll',klein,{passive:true})}catch(e){}}
    function klein(){if(consoleLaag)consoleLaag.klein()}

    /* De bank opnieuw vullen als de lijst werelden verandert (een pas die
       binnenkomt, een gast die inlogt). Staat de werktafel er niet, dan is er
       niets bij te werken: bouw() leest de lijst zelf bij het opbouwen. */
    function werelden(){if(bank)bank.vul();if(root)sync()}
    /* Rahul roepen van buitenaf (de deur in de bank, een opdracht). De balk is
       zijn plek, dus bouwt dit zo nodig eerst de werktafel op. */
    function praat(){bouw();if(praatLaag)praatLaag.open()}
    return{zet:zet,toon:toon,sluitAlles:sluitAlles,openNaast:openNaast,sluit:sluit,select:select,sync:sync,sloop:sloop,wis:wis,werelden:werelden,praat:praat,stand:function(){return stand},
      staat:function(){return{root:root,panes:panes,actief:actief}}};
  };
})(window,document);
