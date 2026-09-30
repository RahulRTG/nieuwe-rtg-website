(function(w){
'use strict';
w.LivingWorldDetail=function(o){
var el=o.el,labels=o.labels,view=o.view,host=o.host,act=o.act,actions=o.actions,card=o.card,section=o.section,info=o.info;
  function detail(row,type){
    var d=el('article','lw-detail');d.appendChild(el('p','lw-eyebrow',(labels[row.status]||row.status)+' · '+row.author));
    d.appendChild(el('h2','',row.title));d.appendChild(el('p','',row.summary||row.description||row.text||''));
    if(row.sourceChanged||row.sourceWithdrawn||row.knowledgeChanged)d.appendChild(el('p','lw-warning',
      row.sourceWithdrawn?'De bron is ingetrokken. Nieuwe uitvoering is geblokkeerd. Neem contact op met de organisator.':
      'De ervaring of gebruikte kennis is gewijzigd. Werk uw plan bij en laat de uitvoering opnieuw beoordelen.'));
    if(type==='blueprint'){
      var dl=el('dl');info(dl,'Plek',(view.places.find(function(p){return p.id===row.placeId;})||{}).title);
      info(dl,'Organisator',row.organizer);info(dl,'Activiteit',row.activity);info(dl,'Route',row.route);info(dl,'Moment',row.season);
      info(dl,'Uitrusting',row.equipment);info(dl,'Vervoer',row.transport);info(dl,'Gezelschap',row.crew);d.appendChild(dl);
      d.appendChild(el('p','lw-meta','Blueprintversie '+row.version+' · aanvragen worden persoonlijk behandeld'));
      if(row.derivedFrom)d.appendChild(el('p','lw-meta','Gebaseerd op '+row.derivedFrom.title+' · '+row.derivedFrom.author+' · versie '+row.derivedFrom.version));
      if(row.media){var a=el('a','','Bekijk de verbonden media');a.href=row.media.url;d.appendChild(a);}
      if(row.mediaUnavailable)d.appendChild(el('p','lw-warning','De gekoppelde media is momenteel niet beschikbaar.'));
      if(row.mediaChanged)d.appendChild(el('p','lw-warning','De media is gewijzigd sinds deze blueprintversie.'));
      requirements(d,row);steps(d,row);
      row.improvements.forEach(function(c){d.appendChild(card(c,'contribution'));});
    }
    if(type==='plan'){
      var stages=el('ol','lw-stages');['planning','requested','accepted','active','completed'].forEach(function(s){var li=el('li','',labels[s]);if(s===row.status)li.setAttribute('aria-current','step');stages.appendChild(li);});d.appendChild(stages);
      d.appendChild(el('p','',row.date?new Date(row.date).toLocaleString():'Kies uw gewenste moment.'));
      d.appendChild(el('p','',row.notes));d.appendChild(el('p','lw-meta','Organisator · '+row.organizer));
      requirements(d,row);steps(d,row);
      if(row.connections&&row.connections.length){
        d.appendChild(el('h3','','Verbonden met mijn ervaring'));
        row.connections.forEach(function(c){var p=el('p','',c.title+(c.status?' · '+c.status:''));
          if(c.changed)p.appendChild(el('strong','',' · Gewijzigd bij de bron'));
          if(c.url){var a=el('a','',' Open bron');a.href=c.url;p.appendChild(a);}d.appendChild(p);});
      }
      if(row.decision)d.appendChild(el('p','lw-warning','Besluit · '+row.decision.reason));
      if(row.issue&&row.status==='waiting')d.appendChild(el('p','lw-warning','Bij '+row.issue.owner+' in behandeling · '+row.issue.reason));
      if(row.participation)d.appendChild(el('p','lw-warning',row.participation.revokedAt?'Deelnameverklaring ingetrokken: '+row.participation.revokeReason:
        'Verklaring organisator: '+row.participation.statement+(row.acknowledgedAt?' · Door u bevestigd.':' · Wacht op bevestiging van de deelnemer.')));
      if(row.mine&&row.status==='completed'&&row.acknowledgedAt){
        var place=view.places.find(function(p){return p.id===row.placeId;});
        if(place){var c=el('button','','Iets achterlaten');c.type='button';c.onclick=function(){act('contribution.create',place);};d.appendChild(c);}
        var media=el('a','','Maak een verhaal of film');media.href='/apps/media.html';d.appendChild(media);
      }
    }
    if(type==='contribution'){
      d.appendChild(el('p','lw-meta','Waargenomen '+new Date(row.observedAt).toLocaleString()+(row.validUntil?' · geldig tot '+new Date(row.validUntil).toLocaleString():'')));
      d.appendChild(el('p','lw-meta',row.basis==='member_observation'?'Waarneming van een lid':'Gekoppeld aan deelname met twee verklaringen'));
      if(row.review)d.appendChild(el('p','','Beoordeling · '+row.review.reason));
      if(!row.current&&row.status==='accepted')d.appendChild(el('p','lw-warning','Deze bijdrage is niet meer actueel of de bewijsgrond is gewijzigd.'));
      if(row.impact){var i=row.impact;d.appendChild(el('h3','','Your contribution travelled.'));
        d.appendChild(el('p','',i.usedInPlans+' deelnemers namen dit op in hun plan. '+i.confirmedParticipants+
          ' deelnemers bevestigden de uitvoering. '+i.returnedContributions+' beoordeelde bijdragen kwamen terug.'));
        d.appendChild(el('p','lw-meta',i.basis+' Weergaven worden niet gemeten.'));}
    }
    d.appendChild(actions(row,type));host.appendChild(d);
    if(type==='place'){
      section('Ervaringen op deze plek',view.blueprints.filter(function(b){return b.placeId===row.id;}),'blueprint','Hier is nog geen ervaring gepubliceerd.');
      memory(row.memory);
    }
    var order=type==='plan' ? (row.isOrganizer&&!row.mine ? ['plan.decide','plan.start','plan.complete','plan.resolve'] :
      ['plan.acknowledge'].concat(row.date?['plan.request','plan.update']:['plan.update'])) :
      type==='blueprint'?['blueprint.publish','plan.create','blueprint.update']:
      type==='place'?['place.publish','blueprint.create','contribution.create']:
      ['contribution.review','contribution.adopt'];
    var primary=null;order.some(function(id){primary=d.querySelector('[data-lw-action="'+id+'"]');return!!primary;});
    if(primary){primary.dataset.lwPrimary='';primary.classList.add('lw-primary');}
  }
  function requirements(d,row){if(row.requirements.length){d.appendChild(el('h3','','Voorbereiding en vereisten'));var ul=el('ul');row.requirements.forEach(function(r){ul.appendChild(el('li','',r));});d.appendChild(ul);}}
  function steps(d,row){if(row.steps.length){d.appendChild(el('h3','','Uw weg naar deze ervaring'));row.steps.forEach(function(s){var p=el('p','',s.text+' '),a=el('a','',s.label+' openen');a.href=s.url;p.appendChild(a);d.appendChild(p);});}}
  function memory(rows){
    var box=el('section','lw-panel'),select=el('select'),label=el('label','','World Memory · tijdvenster'),grid=el('div','lw-grid');
    [['all','Alles'],['now','Nu · actuele waarnemingen'],['today','Vandaag'],['month','Deze maand'],['then','Eerder'],['knowledge','Kennis']].forEach(function(x){var op=el('option','',x[1]);op.value=x[0];select.appendChild(op);});
    label.appendChild(select);box.append(label,grid);host.appendChild(box);
    function paint(){var now=new Date(view.asOf),day=now.toISOString().slice(0,10),month=day.slice(0,7);
      var found=rows.filter(function(c){var date=c.observedAt.slice(0,10);return select.value==='all'||
        select.value==='now'&&c.current&&c.kind==='condition'||select.value==='today'&&date===day||
        select.value==='month'&&date.slice(0,7)===month||select.value==='then'&&date.slice(0,7)<month||
        select.value==='knowledge'&&c.current&&['knowledge','correction'].includes(c.kind);});
      grid.textContent='';found.forEach(function(c){grid.appendChild(card(c,'contribution'));});
      if(!found.length)grid.appendChild(el('p','lw-empty','Nog geen bijdragen in dit tijdvenster.'));
    }
    select.onchange=paint;paint();
  }
return detail;
};
})(window);
