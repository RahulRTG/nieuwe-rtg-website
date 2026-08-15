(function(){'use strict';
  if(document.querySelector('.hq-shell'))return;
  var body=document.body;
  /* Deze shell heeft zelf een responsieve rail, scrollvloer en veilige
     ondernavigatie. De algemene iOS-laag zou daar nog een tweede homepil en
     kopverbouwing overheen leggen; onderaan ving die zelfs operationele
     knoppen af. Zet hem uit voordat het uitgestelde ios.js wordt uitgevoerd. */
  body.setAttribute('data-ios-uit','');
  var oudKop=body.querySelector(':scope>header'),inhoud=document.getElementById('main');
  if(!oudKop||!inhoud)return;
  var titel=(oudKop.querySelector('h1')||{}).textContent||'Horeca Operations';
  var p=location.pathname,items=[['/apps/horeca.html','⌂','Command'],['/apps/horeca.html#arrival','◌','Host'],['/apps/horeca.html#floor','⌁','Floor'],['/apps/horeca-expeditie.html','◇','Kitchen'],['/apps/horeca-beheer.html','≋','Operations']];
  var shell=document.createElement('div');shell.className='hq-shell';
  var rail=document.createElement('aside');rail.className='hq-rail';rail.innerHTML='<nav aria-label="Horeca OS">'+items.map(function(x){return'<a '+(p===x[0]?'class="actief" ':'')+'href="'+x[0]+'"><i>'+x[1]+'</i><span>'+x[2]+'</span></a>'}).join('')+'</nav><footer><details><summary>Meer</summary><a href="/apps/horeca-bezorg.html">Bezorging</a><a href="/apps/horeca-hotel.html">Hotel</a><a href="/apps/horeca-events.html">Events</a><a href="/apps/horeca-club.html">Club</a><a href="/apps/horeca-haccp.html">HACCP</a></details></footer>';
  var main=document.createElement('main');main.className='hq-main';var top=document.createElement('header');top.className='hq-top';top.innerHTML='<div class="hq-tabs" data-tabs><button class="actief" type="button">'+titel+'<small>HORECA OPERATIONS</small></button><button type="button">Service Live<small>VERBONDEN</small></button></div><section><i></i><span>Operatie beschermd</span></section>';
  var refresh=oudKop.querySelector('button');if(refresh)top.querySelector('section').appendChild(refresh);
  var stage=document.createElement('section');stage.className='hq-stage';var hero=document.createElement('section');hero.className='hq-module-hero';hero.innerHTML='<span>HORECA COMMAND · LIVE DOMEIN</span><h1>'+titel+'</h1><p>De bestaande operationele functies blijven intact. Rahul verbindt dit domein met gast, personeel, voorraad, veiligheid en financiële grenzen.</p>';
  inhoud.classList.add('hq-module');stage.appendChild(hero);stage.appendChild(inhoud);main.appendChild(top);main.appendChild(stage);shell.appendChild(rail);shell.appendChild(main);body.insertBefore(shell,body.firstChild);oudKop.remove();
  fetch('/api/supplier/state',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+((window.RTGHoreca&&RTGHoreca.token)||'')},body:'{}'}).then(function(r){return r.json()}).then(function(d){var a=d.state&&d.state.actor;if(!a)return;body.dataset.hqRole=a.manager?'manager':'staff';body.dataset.hqFunc=String(a.func||'').toLowerCase();var badge=document.createElement('span');badge.className='hq-role';badge.textContent=(a.func||a.role||'medewerker')+' · '+a.name;top.querySelector('section').insertBefore(badge,top.querySelector('section').lastChild)}).catch(function(){});
})();
