/* Small private communities: membership, context and gatherings only. There is
   deliberately no feed, follower graph or public member directory. */
'use strict';

module.exports = ({ R, mag, schoon, nu, save, crypto, notify, geblokkeerd }) => {
  function C(){const r=R();if(!r.circles||typeof r.circles!=='object')r.circles={};return r.circles;}
  const memberView=(c,key)=>({id:c.id,name:c.name,theme:c.theme,context:c.context,
    membership:c.members[key]&&c.members[key].state,gatherings:(c.gatherings||[]).map(g=>({id:g.id,title:g.title,
      city:g.city,date:g.date,context:g.context,rsvp:(g.rsvp[key]||{}).state||'OPEN'}))});
  function list(key){const gate=mag(key);if(!gate.ok)return {status:403,error:gate.reden};
    return {status:200,circles:Object.values(C()).filter(c=>c.members[key]&&c.members[key].state==='ACTIVE').map(c=>memberView(c,key))};}
  function rsvp(key,circleId,gatheringId,yes){const gate=mag(key);if(!gate.ok)return {status:403,error:gate.reden};
    const c=C()[String(circleId||'')];if(!c||!c.members[key]||c.members[key].state!=='ACTIVE')return {status:404,error:'Deze Circle is niet voor u geopend.'};
    const g=(c.gatherings||[]).find(x=>x.id===String(gatheringId||''));if(!g)return {status:404,error:'Deze gathering bestaat niet.'};
    g.rsvp[key]={state:yes===false?'DECLINED':'ACCEPTED',at:nu()};save();return {status:200,ok:true,state:g.rsvp[key].state};}
  function create(body){const name=schoon(body.name,80),idem=schoon(body.idempotencyKey,200);if(!name)return {status:400,error:'Een naam is vereist.'};
    if(idem.length<16)return {status:400,error:'De aanvraagsleutel ontbreekt.'};const old=Object.values(C()).find(x=>x.idempotencyKey===idem);
    if(old)return {status:200,ok:true,repeated:true,circle:{id:old.id,name:old.name}};
    const c={id:'rvcir'+crypto.randomBytes(6).toString('hex'),name,theme:schoon(body.theme,60),context:schoon(body.context,400),members:{},gatherings:[],idempotencyKey:idem,createdAt:nu()};C()[c.id]=c;save();return {status:200,ok:true,circle:{id:c.id,name:c.name}};}
  function invite(circleId,key){const c=C()[String(circleId||'')];if(!c||!R().profielen[key])return {status:404,error:'Circle of lid bestaat niet.'};
    if(Object.keys(c.members).some(other=>other!==key&&c.members[other].state==='ACTIVE'&&geblokkeerd(R(),key,other)))
      return {status:409,error:'Dit lid kan door een veiligheidsgrens niet aan deze Circle worden toegevoegd.'};
    c.members[key]={state:'ACTIVE',at:nu()};save();try{notify(key,{title:'Rendez-vous Society',body:'U bent uitgenodigd voor '+c.name+'.',scope:'lifestyle'});}catch(e){}
    return {status:200,ok:true};}
  function gathering(circleId,body){const c=C()[String(circleId||'')];if(!c)return {status:404,error:'Deze Circle bestaat niet.'};
    const title=schoon(body.title,100),date=String(body.date||''),idem=schoon(body.idempotencyKey,200);if(!title||!/^\d{4}-\d{2}-\d{2}$/.test(date))return {status:400,error:'Titel en datum zijn vereist.'};
    if(idem.length<16)return {status:400,error:'De aanvraagsleutel ontbreekt.'};const old=(c.gatherings||[]).find(x=>x.idempotencyKey===idem);if(old)return {status:200,ok:true,repeated:true,gathering:{id:old.id,title:old.title,date:old.date}};
    const g={id:'rvg'+crypto.randomBytes(6).toString('hex'),title,city:schoon(body.city,60),date,context:schoon(body.context,400),rsvp:{},idempotencyKey:idem,createdAt:nu()};
    c.gatherings.push(g);save();return {status:200,ok:true,gathering:{id:g.id,title:g.title,date:g.date}};}
  function officeList(){return {status:200,circles:Object.values(C()).map(c=>({id:c.id,name:c.name,theme:c.theme,
    members:Object.keys(c.members).length,gatherings:(c.gatherings||[]).length}))};}
  return {rvCircles:list,rvCircleRsvp:rsvp,rvCircleCreate:create,rvCircleInvite:invite,
    rvCircleGathering:gathering,rvCircleOffice:officeList};
};
