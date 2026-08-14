/* De WERKTAFEL van RTG Command: het meubel -- bank, tabbladen, bladen, de
   sleepbare scheiding en de lade. De grendel (wie er naar binnen mag) staat in
   shared/command.js; dat bestand droeg allebei en ging daarmee over de 10 KB
   uit regel 13 van scripts/check.js heen.

   Deze laag stelt GEEN toegangsvragen. Hij krijgt ze mee als o.mag() en
   o.breed(); wie hier een tweede oordeel inbouwt, zet de waarheid over toegang
   op twee plekken. */
(function(w,d){
  'use strict';
  w.RTGCommandWerktafel=function(o){
    var root=null,panes=[],actief=-1,consoleLaag=null,APPS=o.catalog.APPS,titelVan=o.catalog.titelVan;
    var ICON={terug:'<path d="M15 5l-7 7 7 7"/>',home:'<path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/>',verder:'<path d="M9 5l7 7-7 7"/>',instel:'<path d="M4 7h10M18 7h2M4 17h2M10 17h10M14 4v6M6 14v6"/>',menu:'<path d="M4 6h16M4 12h16M4 18h16"/>',reis:'<path d="M4 19h16M6 19V8h12v11M9 8V5h6v3"/>',geld:'<rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 10h18"/>',salon:'<path d="M5 20v-7h14v7M7 13V8a5 5 0 0110 0v5"/>',mens:'<circle cx="12" cy="7" r="4"/><path d="M4 21a8 8 0 0116 0"/>',plus:'<path d="M12 5v14M5 12h14"/>',play:'<path d="M8 5l11 7-11 7z"/>',pauze:'<path d="M8 5v14M16 5v14"/>'};
    function svg(k){return '<svg viewBox="0 0 24 24" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+ICON[k]+'</svg>'}

    /* Aan het eind hiervan stonden twee open()-aanroepen: Reizen & Veilig en
       Geld gingen vanzelf open, dus wie op een computer inlogde zag de klok met
       de werelden nooit -- WERELD.md par. 3 ("geen twee beginschermen") gold
       hier met nul. De werktafel is nu wat er GEBEURT als je iets opent, en hij
       verdwijnt met het laatste blad (zie sync()). Daarmee zijn ook het
       tabletkader en de wings uit app.html geen dode code meer: die stonden
       achter body.rtg-command, permanent op elke computer. */
    function bouw(){if(root||!o.mag())return;root=d.createElement('div');root.id='rtgCommand';root.innerHTML='<aside class="cmd-bank"><div class="cmd-adem"></div><nav class="cmd-nav" aria-label="Hoofdnavigatie"></nav><div class="cmd-bankvoet"><button data-cmd="settings">'+svg('instel')+'<span>Instellingen</span></button></div></aside><main class="cmd-werk"><button class="cmd-lade" aria-label="Werelden" aria-expanded="false">'+svg('menu')+'</button><div class="cmd-tabs" role="tablist"></div><button class="cmd-toevoeg" aria-label="Werkblad openen">'+svg('plus')+'</button><div class="cmd-kiezer" hidden></div><div class="cmd-panes"></div></main>';d.body.appendChild(root);d.body.classList.add('rtg-command');bouwNav();bouwKiezer();consoleLaag=w.RTGCommandConsole({root:root,svg:svg,context:o.catalog.context,bestemming:o.bestemming,open:o.open,sluit:sluit,thuis:sloop,getPanes:function(){return panes},getActief:function(){return actief}});consoleLaag.bouw();
      root.querySelector('.cmd-toevoeg').onclick=function(){var k=root.querySelector('.cmd-kiezer');k.hidden=!k.hidden};
      root.querySelector('[data-cmd=settings]').onclick=function(){consoleLaag.toonBlad(3,true)};
      /* De greep staat in de TABBALK en niet in de console: die is onzichtbaar
         (rahul-tab/style-base.js zet .cmd-console op display:none), en een
         greep in een onzichtbare balk is geen greep. */
      root.querySelector('.cmd-lade').onclick=function(){
        var aan=root.classList.toggle('bank-open');
        this.setAttribute('aria-expanded',aan?'true':'false');};
      /* Een lade gaat ook dicht door ernaast te tikken en met Escape. Zonder die
         twee is de greep de enige uitweg, en dat is het soort scherm waar je op
         een telefoon in vast komt te zitten. Een tik OP de bank mag er niet
         doorheen vallen, anders sluit hij voor je iets hebt gekozen. */
      root.addEventListener('pointerdown',function(e){
        if(!root.classList.contains('bank-open'))return;
        if(e.target.closest('.cmd-bank')||e.target.closest('.cmd-lade'))return;
        dichtLade();});
      d.addEventListener('keydown',opEscape);}
    function dichtLade(){if(!root)return;root.classList.remove('bank-open');
      var k=root.querySelector('.cmd-lade');if(k)k.setAttribute('aria-expanded','false')}
    function opEscape(e){if(e.key!=='Escape'||!root||!root.classList.contains('bank-open'))return;
      var k=root.querySelector('.cmd-lade');dichtLade();if(k)k.focus();}
    /* Afbreken staat op EEN plek. Het stond alleen in de matchMedia-luisteraar
       en liet `actief` en `consoleLaag` wijzen naar DOM die net was weggehaald.
       De drie plekken die de werktafel kunnen wegnemen gebruiken nu deze. */
    function sloop(){if(!root)return;root.remove();root=null;panes=[];actief=-1;consoleLaag=null;d.body.classList.remove('rtg-command');}
    /* Kiezen sluit de lade: op een telefoon ligt hij over het blad dat je net
       opende. Op een breed scherm doet dat niets, want daar is de bank een rail. */
    function bouwNav(){var nav=root.querySelector('.cmd-nav');APPS.forEach(function(a){var b=d.createElement('button');b.innerHTML=svg(a[2])+'<span>'+a[0]+'</span>';b.dataset.url=a[1];b.onclick=function(){dichtLade();o.open(a[1],a[0]);};nav.appendChild(b)})}
    function bouwKiezer(){var k=root.querySelector('.cmd-kiezer');APPS.forEach(function(a){var b=d.createElement('button');b.textContent=a[0];b.onclick=function(){k.hidden=true;o.open(a[1],a[0])};k.appendChild(b)})}

    function openNaast(a,kant){if(!a)return null;for(var i=0;i<panes.length;i++)if(panes[i].url===a[1]){select(i);return panes[i]}if(panes.length>=2){var weg=actief===0?1:0;verwijder(weg)}var p=toon(a[1],a[0]);if(p&&kant==='links'&&panes.length===2){panes.splice(panes.indexOf(p),1);panes.unshift(p);root.querySelector('.cmd-panes').insertBefore(p.el,root.querySelector('.cmd-panes').firstChild);actief=0;sync()}return p}
    /* toon() gaat ervan uit dat het MAG: de grendel staat in shared/command.js
       en wordt daar een keer gesteld. */
    function toon(url,titel){bouw();if(!root)return null;for(var i=0;i<panes.length;i++)if(panes[i].url===url){select(i);return panes[i]}
      if(panes.length>=2)verwijder(actief>=0?actief:0);var p={url:url,titel:titelVan(url,titel)},el=d.createElement('section');el.className='cmd-pane';var f=d.createElement('iframe');f.title=p.titel;f.src=url;if(w.RTGMedia)w.RTGMedia.kader(f);el.appendChild(f);root.querySelector('.cmd-panes').appendChild(el);p.el=el;p.frame=f;panes.push(p);f.addEventListener('load',function(){haakScroll(p);});select(panes.length-1);sync();return p}
    function verwijder(i){var p=panes[i];if(!p)return;p.el.remove();panes.splice(i,1);actief=Math.min(panes.length-1,Math.max(0,i-1))}
    function sluit(i){var p=panes[i];if(!p)return;p.el.classList.add('sluit');setTimeout(function(){var nu=panes.indexOf(p);if(nu<0)return;verwijder(nu);sync()},220)}
    function select(i){actief=i;sync();if(consoleLaag)consoleLaag.intro()}
    function wis(){panes.slice().forEach(function(p){p.el.remove()});panes=[];actief=-1}
    /* Het laatste blad sluiten brengt je THUIS en niet in een lege werktafel.
       Een werktafel zonder bladen toont niets en kan niets; het beginscherm
       eronder toont alles. Daarmee is "alles dicht" dezelfde plek als "net
       ingelogd", en dat is precies wat een beginscherm hoort te zijn. */
    function sync(){if(!root)return;if(!panes.length){sloop();return}var tabs=root.querySelector('.cmd-tabs');tabs.textContent='';panes.forEach(function(p,i){p.el.classList.toggle('actief',i===actief);var b=d.createElement('button');b.className='cmd-tab'+(i===actief?' actief':'');b.setAttribute('role','tab');b.innerHTML='<span>'+p.titel+'</span><i aria-label="Sluiten">×</i>';b.onclick=function(e){if(e.target.tagName==='I')sluit(i);else select(i)};tabs.appendChild(b)});verdeler();root.querySelectorAll('.cmd-nav button[data-url]').forEach(function(b){b.classList.toggle('actief',panes[actief]&&panes[actief].url===b.dataset.url)});if(consoleLaag)consoleLaag.intro()}
    /* De scheiding hoort bij TWEE bladen naast elkaar: een brede-schermvorm. Op
       een telefoon staat er een blad in beeld, dus valt er niets te verdelen.
       De inline `flex` van het slepen gaat hier ook weg, anders draagt een blad
       zijn desktopbreedte mee naar een smal venster. */
    function verdeler(){var vak=root.querySelector('.cmd-panes'),oud=vak.querySelector('.cmd-split');if(oud)oud.remove();panes.forEach(function(p){p.el.style.flex=''});if(panes.length!==2||!o.breed())return;var s=d.createElement('div');s.className='cmd-split';s.setAttribute('role','separator');s.setAttribute('aria-orientation','vertical');s.tabIndex=0;s.innerHTML='<i></i>';vak.insertBefore(s,panes[1].el);function zet(x){var r=vak.getBoundingClientRect(),pct=Math.max(30,Math.min(70,(x-r.left)/r.width*100));panes[0].el.style.flex='0 0 '+pct+'%';panes[1].el.style.flex='1 1 0'}function klaar(e){s.classList.remove('sleept');var r=vak.getBoundingClientRect(),p=(e.clientX-r.left)/r.width*100,n=p<42?35:p>58?65:50;panes[0].el.style.flex='0 0 '+n+'%';d.removeEventListener('pointermove',beweeg);d.removeEventListener('pointerup',klaar)}function beweeg(e){zet(e.clientX)}s.onpointerdown=function(e){e.preventDefault();s.classList.add('sleept');d.addEventListener('pointermove',beweeg);d.addEventListener('pointerup',klaar)};s.onkeydown=function(e){if(e.key==='ArrowLeft'||e.key==='ArrowRight'){var n=e.key==='ArrowLeft'?35:65;panes[0].el.style.flex='0 0 '+n+'%'}}}
    function haakScroll(p){try{var doc=p.frame.contentDocument,st=doc.createElement('style');st.textContent='#rahulFab,.rahulfab,.rahulsheet,.mgz-blok,.mgz-ruimte,.amn-knop,[aria-label="Cookiemelding"]{display:none!important}body{padding-bottom:0!important}';doc.head.appendChild(st);p.frame.contentWindow.addEventListener('scroll',klein,{passive:true});var sc=doc.querySelectorAll('[class*=content],main');for(var i=0;i<sc.length;i++)sc[i].addEventListener('scroll',klein,{passive:true})}catch(e){}}
    function klein(){if(consoleLaag)consoleLaag.klein()}

    return{toon:toon,openNaast:openNaast,sluit:sluit,select:select,sync:sync,sloop:sloop,wis:wis,
      staat:function(){return{root:root,panes:panes,actief:actief}}};
  };
})(window,document);
