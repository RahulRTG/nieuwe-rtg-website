'use strict';
const status={planning:'In voorbereiding',requested:'Wacht op de organisator',accepted:'De organisator heeft geaccepteerd',
  declined:'De organisator heeft afgewezen',active:'De uitvoering is begonnen',completed:'De uitvoering is vastgelegd',
  waiting:'Een mens behandelt deze vraag',cancelled:'Geannuleerd'};
module.exports=build=>viewerKey=>{
  const v=build(viewerKey);
  const items=v.blueprints.filter(b=>b.status==='published'&&!b.sourceWithdrawn).map(b=>({
    id:'livingworld:'+b.id,bron:'livingworld',type:'experience',titel:b.title,tekst:b.summary,
    auteur:b.author,plaats:(v.places.find(p=>p.id===b.placeId)||{}).area,
    at:b.updatedAt,bronversie:b.version,onderwerpen:[b.activity],url:b.url,actie:'Take me there'
  }));
  for(const p of v.plans)items.push({
    id:'livingworld:'+p.id,bron:'livingworld',type:'experience',titel:p.title,
    tekst:p.sourceWithdrawn?'De bron is ingetrokken. Neem contact op met de organisator.':
      p.sourceChanged||p.knowledgeChanged?'De gebruikte ervaring of kennis is gewijzigd. Controleer uw plan.':status[p.status],
    auteur:p.mine?'Mijn ervaring':'Aanvraag van '+p.participant,at:p.updatedAt,bronversie:p.revision,
    begint:p.date,prive:true,url:p.url,actie:p.mine?'Vervolg mijn ervaring':'Behandel aanvraag',
    aandacht:!!(p.sourceWithdrawn||p.sourceChanged||p.knowledgeChanged||p.actions.some(a=>
      ['plan.decide','plan.resolve','plan.acknowledge'].includes(a.id)))
  });
  for(const c of v.contributions)if(c.current || c.mine || c.actions.some(a=>a.id==='contribution.review'))items.push({
    id:'livingworld:'+c.id,bron:'livingworld',type:'work',titel:c.title,tekst:c.text,
    auteur:c.author,at:c.updatedAt,bronversie:c.revision,url:c.url,
    prive:!c.current,actie:c.status==='pending'&&!c.mine?'Beoordeel bijdrage':'Open bijdrage',
    aandacht:c.actions.some(a=>a.id==='contribution.review')
  });
  return {items};
};
