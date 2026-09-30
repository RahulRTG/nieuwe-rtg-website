'use strict';
/* Alleen bronverwijzingen en de actuele, voor deze lezer toegankelijke stand.
   Een gekozen verwijzing is geen nieuwe boeking of communitylidmaatschap. */
module.exports = kern => key => {
  const items=[],mediaChoices=[],unavailable=[];
  function source(name,read) {
    try { read(); } catch(e) { unavailable.push(name); }
  }
  source('reiswereld',()=>{
    const r=kern.reiswereld.komend(key);
    if(r.stil && r.stil.length)unavailable.push('Een of meer reisbronnen');
    for(const x of r.komend || []) if(x.kenmerk && x.link)items.push({
      id:'travel:'+x.soort+':'+x.kenmerk,kind:'travel',title:x.titel,status:x.status,
      url:x.link,source:x.herkomst || x.app,version:[x.status,x.van,x.tot].join('|')
    });
  });
  source('communities',()=>{
    for(const g of kern.genootschap.mijne(key))items.push({id:'community:'+g.id,kind:'community',
      title:g.naam,status:'Lid',url:'/apps/genootschap.html',source:'genootschap',version:String(g.id)});
  });
  source('community-events',()=>{
    const result=kern.bijeenkomst.mijnAgenda({key});
    for(const b of result.komt || [])items.push({id:'event:'+b.groepId+':'+b.id,kind:'event',
      title:b.wat,status:b.afgelast?'Afgelast':(b.mijnAntwoord || 'Nog niet geantwoord'),
      date:b.datum,time:b.tijd,url:'/apps/genootschap.html',source:b.groep,
      version:JSON.stringify([b.datum,b.tijd,b.afgelast,b.mijnAntwoord])});
  });
  source('media',()=>{
    for(const v of kern.theaterVideosVan(key) || []) if(v.klaar && !v.zaakCode)
      mediaChoices.push({id:'video:'+v.id,title:v.titel});
    for(const c of kern.clipsVan(key,key) || [])mediaChoices.push({id:'clip:'+c.id,title:c.titel});
  });
  return {items,mediaChoices,unavailable};
};
