(function(w){
'use strict';
function el(tag,cls,text){var n=document.createElement(tag);if(cls)n.className=cls;if(text!=null)n.textContent=text;return n;}
var labels={draft:'Privéconcept',published:'Gedeeld',withdrawn:'Ingetrokken',planning:'Voorbereiden',requested:'Bij organisator',
  accepted:'Geaccepteerd',declined:'Afgewezen',active:'Bezig',completed:'Uitgevoerd',cancelled:'Geannuleerd',waiting:'In behandeling',
  pending:'Wacht op beoordeling',rejected:'Afgewezen',superseded:'Vervangen'};
function render(host,view,selection,tab,act,open){
  host.textContent='';
  if(view.context.unavailable.length)host.appendChild(el('p','lw-warning','Niet opnieuw gecontroleerd: '+view.context.unavailable.join(', ')+'.'));
  function link(type,row){var a=el('a','',row.title);a.href=row.url;a.onclick=function(e){e.preventDefault();open(type,row.id);};return a;}
  function actions(row,type){
    var box=el('div','lw-actions');
    (row.actions||[]).forEach(function(a){var b=el('button','',a.label);b.type='button';b.dataset.lwAction=a.id;
      b.onclick=function(){act(a.id,row);};box.appendChild(b);});return box;
  }
  function card(row,type){var c=el('article','lw-panel');c.appendChild(el('p','lw-eyebrow',labels[row.status]||row.status));
    var h=el('h3');h.appendChild(link(type,row));c.appendChild(h);c.appendChild(el('p','',row.summary||row.description||row.text||row.notes));
    c.appendChild(el('p','lw-meta',row.author+(row.area?' · '+row.area:'')));
    if(type==='plan')c.appendChild(el('p','',row.isOrganizer?'Aanvraag van '+row.participant:'Organisator · '+row.organizer));
    return c;
  }
  function section(title,rows,type,empty){
    var s=el('section','lw-panel');s.appendChild(el('h2','',title));var grid=el('div','lw-grid');
    rows.forEach(function(row){grid.appendChild(card(row,type));});s.appendChild(rows.length?grid:el('p','lw-empty',empty));host.appendChild(s);
  }
  function info(node,label,value){if(value){node.appendChild(el('dt','',label));node.appendChild(el('dd','',value));}}
  var detail=w.LivingWorldDetail({el:el,labels:labels,view:view,host:host,act:act,actions:actions,card:card,section:section,info:info});
  if(selection){var kind={place:'places',blueprint:'blueprints',plan:'plans',contribution:'contributions'}[selection.type];
    var row=kind&&view[kind].find(function(r){return r.id===selection.id;});
    if(row)detail(row,selection.type);else host.appendChild(el('p','lw-empty','Dit onderdeel is niet meer beschikbaar. Ga terug naar Wereld.'));
  }else if(tab==='plans')section('Mijn ervaringen',view.plans.filter(function(p){return p.mine;}),'plan','Ontdek een ervaring en kies Take me there.');
  else if(tab==='studio'){
    var create=el('button','lw-primary','Plek toevoegen');create.type='button';create.dataset.lwPrimary='';create.onclick=function(){act('place.create',{});};host.appendChild(create);
    section('Ontvangen aanvragen',view.plans.filter(function(p){return p.isOrganizer&&!p.mine;}),'plan','Hier verschijnen aanvragen die aan u zijn overgedragen.');
    section('Bijdragen beoordelen',view.contributions.filter(function(c){return c.actions.some(function(a){return a.id==='contribution.review';});}),'contribution','Er wachten geen bijdragen op uw beoordeling.');
    section('Mijn plekken',view.places.filter(function(p){return p.mine;}),'place','Voeg een plek toe en maak haar rijker.');
    section('Mijn blueprints',view.blueprints.filter(function(p){return p.mine;}),'blueprint','Open een plek om een ervaring te maken.');
    section('Mijn bijdragen',view.contributions.filter(function(p){return p.mine;}),'contribution','Na uw ervaring kunt u kennis of een verhaal achterlaten.');
    var development=el('p','lw-actions'),connect=el('a','','Mijn bijdragen in Connect'),academy=el('a','','Verder leren in Academy');
    connect.href='/apps/connect.html#deel-jij';academy.href='/apps/rtgschool.html';development.append(connect,academy);host.appendChild(development);
  }else{
    section('World Pulse',view.contributions.filter(function(c){return c.current;}),'contribution','Nog geen actuele beoordeelde waarnemingen in uw wereld.');
    section('Take me there',view.blueprints.filter(function(b){return b.status==='published';}),'blueprint','De eerste gedeelde ervaring begint bij een maker. Open Werkplaats om er een te maken.');
    section('Living Places',view.places.filter(function(p){return p.status==='published';}),'place','Nog geen gedeelde plekken.');
  }
}
w.LivingWorldRender={render:render,el:el};
})(window);
