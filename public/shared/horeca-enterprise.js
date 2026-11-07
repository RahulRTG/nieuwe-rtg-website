(function(){'use strict';
  if(document.querySelector('.hq-shell'))return;
  var body=document.body,ds=document.documentElement.hasAttribute('data-ds');
  function klasse(oud,nieuw){return oud+(ds?' '+nieuw:'');}
  /* Deze shell heeft zelf een responsieve rail, scrollvloer en veilige
     ondernavigatie. De algemene iOS-laag zou daar nog een tweede homepil en
     kopverbouwing overheen leggen; onderaan ving die zelfs operationele
     knoppen af. Zet hem uit voordat het uitgestelde ios.js wordt uitgevoerd. */
  body.setAttribute('data-ios-uit','');
  var oudKop=body.querySelector(':scope>header'),inhoud=document.getElementById('main');
  if(!oudKop||!inhoud)return;
  var titel=(oudKop.querySelector('h1')||{}).textContent||'Horeca Operations';
  var p=location.pathname,items=[['/apps/horeca.html','⌂','Command'],['/apps/horeca.html#arrival','◌','Host'],['/apps/horeca.html#floor','⌁','Floor'],['/apps/horeca-expeditie.html','◇','Kitchen'],['/apps/horeca-beheer.html','≋','Operations']];
  var shell=document.createElement('div');shell.className=klasse('hq-shell','ds-horeca-shell');
  var rail=document.createElement('aside');rail.className=klasse('hq-rail','ds-horeca-rail');rail.innerHTML='<nav aria-label="Horeca OS">'+items.map(function(x){return'<a '+(p===x[0]?'class="actief" ':'')+'href="'+x[0]+'"><i>'+x[1]+'</i><span>'+x[2]+'</span></a>'}).join('')+'</nav><footer><details><summary>Meer</summary><a href="/apps/horeca-bezorg.html">Bezorging</a><a href="/apps/horeca-hotel.html">Hotel</a><a href="/apps/horeca-events.html">Events</a><a href="/apps/horeca-club.html">Club</a><a href="/apps/horeca-haccp.html">HACCP</a></details></footer>';
  var main=document.createElement('main');main.className=klasse('hq-main','ds-horeca-main');var top=document.createElement('header');top.className=klasse('hq-top','ds-horeca-top');if(ds)top.setAttribute('data-rtg-menu-host','');top.innerHTML='<div class="hq-tabs" data-tabs><span class="actief ds-horeca-domein">'+titel+'<small>HORECA OPERATIONS</small></span><span>Werkprofiel<small data-hq-profiel>Wordt geladen</small></span></div><section><i></i><span data-hq-status>Controle per handeling</span></section>';
  var refresh=oudKop.querySelector('button');if(refresh)top.querySelector('section').appendChild(refresh);
  var stage=document.createElement('section');stage.className=klasse('hq-stage','ds-horeca-stage');var hero=document.createElement('section');hero.className=klasse('hq-module-hero','ds-horeca-module-hero');hero.innerHTML='<span>HORECA COMMAND · WERKRUIMTE</span><h1>'+titel+'</h1><p>Bekijk de actuele gegevens en werk uw administratie bij. Kies hieronder de taak die u wilt uitvoeren.</p>';
  inhoud.classList.add('hq-module');if(ds)inhoud.classList.add('ds-horeca-module');stage.appendChild(hero);stage.appendChild(inhoud);main.appendChild(top);main.appendChild(stage);shell.appendChild(rail);shell.appendChild(main);body.insertBefore(shell,body.firstChild);oudKop.remove();
  var token=(window.RTGHoreca&&RTGHoreca.token)||'';
  function actueel(){try{return shell.isConnected&&!!token&&localStorage.getItem('rtg_sup_token')===token}catch(e){return false}}
  if(!actueel()){top.querySelector('[data-hq-profiel]').textContent='Niet geladen';return;}
  fetch('/api/supplier/state',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:'{}'})
    .then(function(r){return r.json().then(function(d){if(!r.ok||!d||d.ok===false||d.error||!d.state||!d.state.actor||typeof d.state.actor.name!=='string'||!d.state.actor.name.trim()||typeof d.state.actor.role!=='string'||!d.state.actor.role.trim()||typeof d.state.actor.manager!=='boolean')throw new Error('Werkprofiel niet geladen');return d})})
    .then(function(d){
      if(!actueel())return;
      var a=d.state.actor;body.dataset.hqRole=a.manager===true?'manager':'staff';body.dataset.hqFunc=String(a.func||'').toLowerCase();
      var badge=document.createElement('span');badge.className=klasse('hq-role','ds-horeca-role');badge.textContent=(a.func||a.role||'medewerker')+' · '+(a.name||'');
      top.querySelector('section').insertBefore(badge,top.querySelector('section').lastChild);
      top.querySelector('[data-hq-profiel]').textContent='Profiel geladen';
    }).catch(function(){if(actueel())top.querySelector('[data-hq-profiel]').textContent='Niet geladen';});
})();
