'use strict';
module.exports=({product,root,context,media,schoon,save,ping,id,now,pair})=>{
  function removeMessage(actor,input,messageId){const c=context(actor,input);if(!c)return {status:404,error:'Dit gesprek bestaat niet.'};
    const r=root(),m=r.messages.find(x=>x.id===String(messageId||'')&&x.product===product&&x.scope===c.scope&&x.from===actor);
    if(!m)return {status:404,error:'Dit bericht is niet van u.'};
    if(m.mediaId){const item=r.media.find(x=>x.id===m.mediaId);if(item){try{media.verwijder(item.ref);}catch(e){}r.media=r.media.filter(x=>x.id!==item.id);}}
    r.messages=r.messages.filter(x=>x.id!==m.id);save();ping(c.counterpart,'message',c.scope);return {status:200,ok:true};}
  function reportMessage(actor,input,messageId,reason){const c=context(actor,input);if(!c)return {status:404,error:'Dit gesprek bestaat niet.'};
    const r=root(),m=r.messages.find(x=>x.id===String(messageId||'')&&x.product===product&&x.scope===c.scope&&x.from===c.counterpart);
    if(!m)return {status:404,error:'Dit bericht bestaat niet.'};const text=schoon(reason,300);if(!text)return {status:400,error:'Geef een korte reden.'};
    if(!r.reports.some(x=>x.reporter===actor&&x.messageId===m.id))r.reports.unshift({id:id('ccr'),product,scope:c.scope,
      reporter:actor,counterpart:c.counterpart,messageId:m.id,kind:m.kind,text:m.text||'',reason:text,at:now(),state:'OPEN'});
    save();return {status:200,ok:true};}
  function terminatePair(a,b,reason){const p=pair(a,b);for(const call of root().calls)if(call.product===product&&call.pair===p&&['RINGING','ACTIVE'].includes(call.state)){
    call.state=reason||'BLOCKED';call.revision+=1;call.updatedAt=now();ping(call.from,'call',call.scope,call.id);ping(call.to,'call',call.scope,call.id);}save();}
  return {removeMessage,reportMessage,terminatePair};
};
