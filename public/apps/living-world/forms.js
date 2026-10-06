(function(w){
'use strict';
var steps=['learn','travel','stay','community','crew','provider','equipment','organize','capture','story'];
function field(name,label,type,value,options){return{name:name,label:label,type:type||'text',value:value,options:options};}
function shape(action,row,view){
  row=row||{};var fields=[],base={},intro='Controleer uw keuze. Pas na uw bevestiging wordt zij opgeslagen.';
  if(row.id)base={id:row.id,revision:row.revision};
  function reason(label){fields.push(field('reason',label||'Toelichting','textarea',''));}
  if(action==='place.create'||action==='place.update'){
    fields=[field('title','Naam van de plek','text',row.title),field('area','Plaats of regio','text',row.area),
      field('description','Wat maakt deze plek bijzonder?','textarea',row.description)];
  }else if(action==='blueprint.create'||action==='blueprint.update'){
    if(action==='blueprint.create'){base={placeId:row.id};row={};}
    fields=[field('title','Naam van de ervaring','text',row.title),field('summary','De ervaring','textarea',row.summary),
      field('activity','Activiteit','text',row.activity),field('route','Route','textarea',row.route),
      field('season','Moment of seizoen','text',row.season),field('requirements','Vereisten · één per regel','lines',row.requirements),
      field('equipment','Uitrusting','textarea',row.equipment),field('transport','Vervoer','textarea',row.transport),
      field('crew','Gezelschap','textarea',row.crew),field('mediaRef','Eigen gepubliceerde video of clip','select',row.mediaRef,
        [['','Geen media verbinden']].concat((view.context.mediaChoices||[]).map(function(m){return[m.id,m.title];}))),
      field('remixAllowed','Anderen mogen een eigen blueprintvariant maken','checkbox',row.remixAllowed)];
    steps.forEach(function(kind){var old=(row.steps||[]).find(function(s){return s.kind===kind;});fields.push(field('step_'+kind,
      {learn:'Leren / voorbereiden',travel:'Reis',stay:'Verblijf',community:'Community',crew:'Reisgezelschap',
        provider:'Aanbieder',equipment:'Uitrusting regelen',organize:'Organiseren',capture:'Vastleggen',story:'Verhaal maken'}[kind],
      'text',old&&old.text));});
    intro='Beschrijf de herbruikbare opzet. De uitvoering wordt per aanvraag door u als organisator beoordeeld. Een publicatie boekt of betaalt niets.';
  }else if(action==='blueprint.fork'){
    fields=[field('title','Naam van uw variant','text',row.title+' · mijn versie')];
    intro='U maakt een privéconcept met verwijzing naar het origineel. Boekingen, persoonlijke gegevens en mediarechten worden niet overgenomen.';
  }else if(action==='plan.create'){
    fields=[field('consentImpact','Vrijwillig laten meetellen hoe ik bijdragen gebruik','checkbox',false)];
    knowledge();
    intro='U maakt uw eigen privéplan. Er wordt nog niets geboekt of naar een organisator verstuurd.';
  }else if(action==='plan.update'){
    fields=[field('title','Mijn ervaring','text',row.title),field('date','Gewenst moment · uw lokale tijd','datetime-local',local(row.date)),
      field('notes','Mijn voorkeuren en vragen','textarea',row.notes),field('preparation','Mijn voorbereiding · één verklaring per regel','lines',row.preparation)];
    knowledge();
    intro='Een wijziging zet het plan terug naar voorbereiding. Leg het daarna opnieuw voor aan de organisator. Eigen verklaringen zijn geen kwalificatiebewijs.';
  }else if(action==='plan.decide'){
    fields=[field('decision','Besluit','select','',[['','Kies een besluit'],['accepted','Accepteren'],['declined','Afwijzen']]),
      field('requirementsChecked','Ik heb de vereisten en de uitvoerbaarheid persoonlijk gecontroleerd','checkbox',false)];reason('Reden en gemaakte afspraken');
    intro='U behandelt deze aanvraag als organisator. Accepteren registreert uw akkoord voor deze uitvoering; het bevestigt geen externe boeking of betaling.';
  }else if(action==='plan.complete'){
    fields=[field('statement','Wat heeft de deelnemer daadwerkelijk gedaan?','textarea','')];
    intro='U legt uw eigen verklaring als organisator vast. De deelnemer bevestigt de deelname daarna afzonderlijk.';
  }else if(action==='plan.acknowledge'){
    fields=[field('consentImpact','Mijn deelname vrijwillig laten meetellen bij gebruikte bijdragen','checkbox',row.consentImpact)];
    intro='Bevestig dat u deze ervaring daadwerkelijk heeft meegemaakt. Een bijdrage achterlaten blijft vrijwillig.';
  }else if(action==='plan.consent'){
    fields=[field('enabled','Gebruik en deelname laten meetellen bij mijn gekozen bijdragen','checkbox',row.consentImpact)];
    intro='U kunt dit altijd uitzetten. Makers zien aantallen bij hun bijdrage, geen lijst met deelnemers.';
  }else if(action==='plan.connect'){
    var choices=(view.context.items||[]).map(function(s){return[s.id,s.title+' · '+s.status];});
    (row.connections||[]).forEach(function(s){if(s.id&&!choices.some(function(c){return c[0]===s.id;}))choices.push([s.id,s.title]);});
    fields=[field('sourceId','Kies een eigen reis, community of evenement','select','',[['','Kies een onderdeel']].concat(choices)),
      field('remove','Deze verbinding verwijderen','checkbox',false)];
    intro='Alleen de verwijzing wordt bewaard. De actuele stand blijft uit de bron komen; privéboekingsdetails blijven voor u.';
  }else if(action==='contribution.create'){
    base={placeId:row.id};var plans=view.plans.filter(function(p){return p.mine&&p.placeId===row.id&&p.status==='completed'&&p.acknowledgedAt;});
    fields=[field('kind','Soort bijdrage','select','knowledge',[['knowledge','Kennis'],['condition','Actuele waarneming'],['correction','Correctie'],['story','Verhaal']]),
      field('planId','Verbinden met mijn bevestigde ervaring','select','',[['','Losse waarneming']].concat(plans.map(function(p){return[p.id,p.title];}))),
      field('title','Titel','text',''),field('text','Wat wilt u achterlaten?','textarea',''),
      field('observedAt','Wanneer heeft u dit waargenomen?','datetime-local',local(new Date().toISOString())),
      field('validUntil','Geldig tot · verplicht voor actuele waarnemingen','datetime-local',''),
      field('communityRelease','Deze bijdrage expliciet vrijgeven voor de Living World','checkbox',false),
      field('attribution','Naam voor bronvermelding bij publieke vrijgave','text',''),
      field('supersedes','Eerdere bijdrage corrigeren','select','',[['','Geen']].concat(view.contributions.filter(function(c){return c.placeId===row.id&&c.status==='accepted';}).map(function(c){return[c.id,c.title];})))];
    intro='Uw bijdrage blijft standaard privé. Alleen met uw afzonderlijke keuze mag de beheerder haar beoordelen en als bronvermelde verbetering in deze Living World gebruiken. AI-training en afgeleide werken blijven uitgesloten.';
  }else if(action==='contribution.review'){
    fields=[field('decision','Beoordeling','select','',[['','Kies een besluit'],['accepted','Goedkeuren'],['rejected','Afwijzen']])];reason('Wat heeft u gecontroleerd?');
  }else if(action==='contribution.adopt'){
    var b=view.blueprints.find(function(b){return b.id===row.blueprintId;});base.blueprintRevision=b&&b.revision;
    intro='Deze beoordeelde bijdrage wordt een herkenbare verbetering in een nieuwe blueprintversie. Bestaande plannen krijgen een wijzigingssignaal.';
  }else if(/withdraw|cancel|issue|resolve|revokeEvidence/.test(action)){reason();
  }else if(action==='plan.request'){intro='Uw plan, voorkeuren en voorbereiding worden zichtbaar voor '+row.organizer+'. De aanvraag blijft daar terug te vinden, ook zonder pushbericht.';
  }else if(action==='plan.start'){intro='Leg vast dat de uitvoering daadwerkelijk begint. Deze handeling registreert uw verklaring; zij meet geen locatie.';
  }else if(/publish/.test(action)){intro='Dit onderdeel wordt zichtbaar voor andere ingelogde leden. Controleer of u alle opgenomen informatie wilt delen.';}
  function knowledge(){
    var list=view.contributions.filter(function(c){return c.placeId===row.placeId&&c.current;});
    fields.push(field('knowledgeIds','Welke bijdragen gebruikt u bij uw voorbereiding?','checks',
      (row.knowledge||[]).map(function(r){return r.id;}),list.map(function(c){return[c.id,c.title+' · '+c.text];})));
  }
  return{base:base,fields:fields,intro:intro};
}
function local(iso){if(!iso)return'';var d=new Date(iso);return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,16);}
function collect(form,schema,action){
  var out=Object.assign({},schema.base),data=new FormData(form);
  schema.fields.forEach(function(f){var v=data.get(f.name);
    if(f.type==='checkbox')out[f.name]=v==='on';
    else if(f.type==='checks')out[f.name]=data.getAll(f.name);
    else if(f.type==='lines')out[f.name]=String(v||'').split('\n').map(function(s){return s.trim();}).filter(Boolean);
    else if(f.type==='datetime-local')out[f.name]=v?new Date(v).toISOString():null;
    else out[f.name]=String(v||'');
  });
  if(action==='blueprint.create'||action==='blueprint.update'){
    out.steps=[];steps.forEach(function(kind){var v=out['step_'+kind];if(v)out.steps.push({kind:kind,text:v});delete out['step_'+kind];});
  }else if(action==='contribution.create'){
    if(out.communityRelease){
      out.sharing={visibility:'community',purpose:'world-memory',recipients:[],consent:true,returnUpdates:false,
        release:{attribution:out.attribution,reuse:['read','cite'],aiScopes:[],derivativeScope:'denied'}};
    }
    delete out.communityRelease;delete out.attribution;
  }
  return out;
}
w.LivingWorldForms={shape:shape,collect:collect};
})(window);
