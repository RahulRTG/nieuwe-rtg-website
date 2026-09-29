/* A shared display has the standard frame but never opens personal widgets,
   contacts or the identity runtime of whoever last used this browser. */
(function(w,d){
  'use strict';
  function start(){
    if(d.querySelector('.wd-shell'))return;
    var U=w.RTGDesktopUI, home=w.RTGDesktopSurface.prepare(), root=U.el('div','wd-shell');
    var people=U.el('aside','wd-people'), favorites=U.el('aside','wd-favorites'), library=U.el('section','wd-library');
    var greeting=U.el('header','wd-greeting');greeting.appendChild(U.el('h1','','Game Night'));
    greeting.appendChild(U.el('p','','Speelscherm voor uw gezelschap'));
    people.appendChild(U.el('h2','','Samen spelen'));
    people.appendChild(U.el('p','wd-muted','Koppel dit scherm met de code uit uw spel. Iedereen doet mee vanaf het eigen toestel.'));
    favorites.appendChild(U.el('h2','','Op dit scherm'));
    favorites.appendChild(U.el('p','wd-muted','Alleen de gekoppelde spelstand wordt getoond. Persoonlijke contacten en gegevens staan op uw eigen toestel.'));
    library.appendChild(U.el('p','wd-muted','Uw telefoon blijft de bediening van het spel.'));
    home.before(root);home.classList.add('wd-home');root.append(greeting,people);w.RTGDesktopSurface.move(root,home);root.append(favorites,library);
    var chrome=U.el('div','rtg-edge-chrome'), top=U.el('header','rtg-edge-top'), brand=U.el('span','rtg-edge-mark','RTG');
    brand.appendChild(U.el('span','wd-world-label','Speelscherm'));top.appendChild(brand);chrome.appendChild(top);d.body.appendChild(chrome);
    var panel=U.el('section');panel.hidden=true;panel.appendChild(U.el('p','','Gebruik uw eigen toestel om een spel te starten en met dit scherm te koppelen.'));
    d.body.appendChild(panel);
    function help(){w.RTGAdaptiveEdge.openPanel(panel,{title:'Bediening van het speelscherm'});}
    w.RTGAdaptiveEdge.start(d,w,{root:chrome,cfg:{home:w.location.pathname,kaart:'Speelscherm'},ctx:{title:'Game Night'},onEdgeAction:function(action){
      if(action==='home'){home.scrollIntoView({block:'start'});return true;}
      if(['worlds','menu','context','primary','connect','ai'].includes(action)){help();return true;}
      return false;
    }});
    var ai=chrome.querySelector('[data-rtg-adaptive-action="ai"]');
    if(ai){ai.disabled=true;ai.setAttribute('aria-label','Rahul is beschikbaar op uw eigen toestel');}
    d.body.dataset.rtgDesktop=d.body.dataset.rtgWorld;
    w.RTGWorldPresentation.start({root:root,home:home,people:people,favorites:favorites});
    d.body.dataset.rtgDesktopState='ready';
  }
  w.RTGDesktopProjection={start:start};
})(window,document);
