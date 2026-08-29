/* De werktafel: bank, bladen, scheiding en lade. De grendel staat in command.js. */
(function(w,d){
  'use strict';
  w.RTGCommandWerktafel=function(o){
    var root=null,panes=[],actief=-1,consoleLaag=null,APPS=o.catalog.APPS,titelVan=o.catalog.titelVan;
    var stand='open',bank=null,praatLaag=null,balkLaag=null;
    var poort=w.RTGCommandInlogpoort();
    var ICON={terug:'<path d="M15 5l-7 7 7 7"/>',home:'<path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/>',verder:'<path d="M9 5l7 7-7 7"/>',instel:'<path d="M4 7h10M18 7h2M4 17h2M10 17h10M14 4v6M6 14v6"/>',menu:'<path d="M4 6h16M4 12h16M4 18h16"/>',reis:'<path d="M4 19h16M6 19V8h12v11M9 8V5h6v3"/>',geld:'<rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 10h18"/>',salon:'<path d="M5 20v-7h14v7M7 13V8a5 5 0 0110 0v5"/>',mens:'<circle cx="12" cy="7" r="4"/><path d="M4 21a8 8 0 0116 0"/>',plus:'<path d="M12 5v14M5 12h14"/>',kruis:'<path d="M6 6l12 12M18 6L6 18"/>',play:'<path d="M8 5l11 7-11 7z"/>',pauze:'<path d="M8 5v14M16 5v14"/>'};
    function svg(k){return '<svg viewBox="0 0 24 24" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+ICON[k]+'</svg>'}

    /* zet() is de enige ingang voor de stand. Wisselt hij, dan wordt opnieuw
       opgebouwd en niet omgebouwd. In de open stand begint bouw() LEEG -- hier
       stonden twee open()-aanroepen, en welke apps dat zouden zijn is een keuze
       van een mens en niet van het huis. */
    function zet(s){if(root&&stand!==s)sloop();stand=s;bouw()}
    function bouw(){if(root||!o.magBestaan())return;root=d.createElement('div');root.id='rtgCommand';root.dataset.stand=stand;root.innerHTML=w.RTGCommandRomp(svg,function(){zet(stand)});d.body.appendChild(root);d.body.classList.add('rtg-command');consoleLaag=w.RTGCommandConsole({root:root,svg:svg,context:o.catalog.context,bestemming:o.bestemming,open:o.open,sluit:sluit,thuis:o.thuis,getPanes:function(){return panes},getActief:function(){return actief}});consoleLaag.bouw();bank=w.RTGCommandBank({root:root,svg:svg,apps:APPS,stand:stand,open:o.open,werelden:o.werelden,systeem:o.systeem,inlog:o.inlog});bank.bouw();praatLaag=w.RTGCommandPraat({root:root,bestemming:o.bestemming});praatLaag.bouw();if(w.RTGAdaptiefBalk)balkLaag=w.RTGAdaptiefBalk({root:root,werelden:o.werelden,open:o.open,panes:function(){return panes},actief:function(){return actief}});if(stand==='gesloten')poort.naar(root.querySelector('.cmd-panes'));else leeg();balk();if(balkLaag)balkLaag.bouw();
      root.querySelector('.cmd-toevoeg').onclick=function(){var k=root.querySelector('.cmd-kiezer');k.hidden=!k.hidden};
      root.querySelector('[data-cmd=settings]').onclick=function(){consoleLaag.toonBlad(3,true)};
      if(stand!=='gesloten')hervat();
      }
    /* Terug waar je gebleven was. Waarom dit MAG en de lege tafel niet meer de
       enige stand is: shared/command/geheugen.js, met de twee wegen die wel
       leeg blijven uitkomen. Staat er niets, dan blijft de lege keuze staan die
       bouw() net heeft neergezet. */
    function hervat(){if(!w.RTGCommandGeheugen)return;var g=w.RTGCommandGeheugen.lees();if(!g)return;
      g.bladen.forEach(function(b){toon(b.url,b.titel)});
      if(panes.length)select(Math.min(g.actief,panes.length-1))}
    /* Afbreken staat op EEN plek. Het stond in de matchMedia-luisteraar en liet
       `actief` en `consoleLaag` wijzen naar DOM die net weg was. */
    function sloop(){if(!root)return;poort.terug();if(bank&&bank.stop)bank.stop();if(praatLaag)praatLaag.stop();if(balkLaag)balkLaag.stop();balkLaag=null;root.remove();root=null;panes=[];actief=-1;consoleLaag=null;praatLaag=null;d.body.classList.remove('rtg-command');if(w.RTGAdaptiefBrugSync)w.RTGAdaptiefBrugSync();}

    function openNaast(a,kant){if(!a)return null;for(var i=0;i<panes.length;i++)if(panes[i].url===a[1]){select(i);return panes[i]}if(panes.length>=2){var weg=actief===0?1:0;verwijder(weg)}var p=toon(a[1],a[0]);if(p&&kant==='links'&&panes.length===2){panes.splice(panes.indexOf(p),1);panes.unshift(p);root.querySelector('.cmd-panes').insertBefore(p.el,root.querySelector('.cmd-panes').firstChild);actief=0;sync()}return p}
    /* toon() gaat ervan uit dat het MAG: de grendel staat in shared/command.js
       en wordt daar een keer gesteld. */
    function toon(url,titel){bouw();if(w.RTG_MAGNAAT_URL)url=w.RTG_MAGNAAT_URL(url);if(!root||!url)return null;for(var i=0;i<panes.length;i++)if(panes[i].url===url){select(i);return panes[i]}
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
    /* Op telefoon is dit de enige schilbalk; Adaptief vult de handelingen. */
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
      // de contextzone hertekent zichzelf; hier staat alleen WANNEER
      if(balkLaag)balkLaag.sync();
    }
    function sync(){if(!root)return;root.dataset.bladen=panes.length;var tabs=root.querySelector('.cmd-tabs');tabs.textContent='';
      /* Hier wordt onthouden, en nul bladen wegschrijven IS het wissen. Zo komen
         Home en het sluiten van je laatste blad allebei op een schone tafel uit
         zonder dat daar een tweede regel voor nodig is (geheugen.js). */
      if(stand!=='gesloten'&&w.RTGCommandGeheugen)w.RTGCommandGeheugen.schrijf(panes,actief);
      if(!panes.length){balk();if(stand!=='gesloten')leeg();if(w.RTGAdaptiefBrugSync)w.RTGAdaptiefBrugSync();return}
      balk();
      var oudLeeg=root.querySelector('.cmd-leeg');if(oudLeeg)oudLeeg.remove();panes.forEach(function(p,i){p.el.classList.toggle('actief',i===actief);var b=d.createElement('button');b.className='cmd-tab'+(i===actief?' actief':'');b.setAttribute('role','tab');b.innerHTML='<span>'+p.titel+'</span><i aria-label="Sluiten">×</i>';b.onclick=function(e){if(e.target.tagName==='I')sluit(i);else select(i)};tabs.appendChild(b)});if(w.RTGAdaptiefBrugSync)w.RTGAdaptiefBrugSync();verdeler();root.querySelectorAll('.cmd-nav button[data-url]').forEach(function(b){b.classList.toggle('actief',panes[actief]&&panes[actief].url===b.dataset.url)});if(consoleLaag)consoleLaag.intro()}
    /* De scheiding hoort bij TWEE bladen naast elkaar: een brede-schermvorm. Op
       een telefoon staat er een blad in beeld, dus valt er niets te verdelen.
       De inline `flex` van het slepen gaat hier ook weg, anders draagt een blad
       zijn desktopbreedte mee naar een smal venster. */
    function verdeler(){var breed=o.breed();w.RTGCommandVerdeler(root.querySelector('.cmd-panes'),panes,breed);
      panes.forEach(function(p){if(p.haak&&p.haak.vorm)p.haak.vorm(breed)})}
    function vervang(p,url){var oud=p.frame,f=d.createElement('iframe');f.title=p.titel;f.src=url;if(w.RTGMedia)w.RTGMedia.kader(f);p.frame=f;p.haak=null;oud.replaceWith(f);f.addEventListener('load',function(){haakScroll(p)})}
    // App-shell blijft host: kale Home opent Second Screen, een deep-link de host.
    function neemHome(p,home){if(!p||!home)return false;if(home.diep){w.location.href=home.url.href;return true}
      var terug=p.url;o.open(home.url.href,p.titel);if(terug&&!o.thuisAdres(terug)){vervang(p,terug);return true}
      var i=panes.indexOf(p);if(i>=0)verwijder(i);sync();return true}
    function thuisUitKind(bron,url){var home=o.thuisAdres(url),p=panes.find(function(x){return x.frame.contentWindow===bron});return neemHome(p,home)}
    function haakScroll(p){var home=null;try{home=o.thuisAdres(p.frame.contentWindow.location.href)}catch(e){}
      if(neemHome(p,home))return;
      if(w.RTGCommandBladhaak)p.haak=w.RTGCommandBladhaak(p,klein,o.breed(),sync);sync()}
    function klein(){if(consoleLaag)consoleLaag.klein()}

    /* De bank opnieuw vullen wanneer werelden of passen veranderen. */
    function werelden(){if(bank)bank.vul();if(root)sync()}
    /* Rahul roepen bouwt zo nodig eerst de werktafel. */
    function praat(){bouw();if(praatLaag)praatLaag.open()}
    return{zet:zet,toon:toon,sluitAlles:sluitAlles,openNaast:openNaast,sluit:sluit,select:select,sync:sync,sloop:sloop,wis:wis,werelden:werelden,praat:praat,thuisUitKind:thuisUitKind,stand:function(){return stand},
      staat:function(){return{root:root,panes:panes,actief:actief}}};
  };
})(window,document);
