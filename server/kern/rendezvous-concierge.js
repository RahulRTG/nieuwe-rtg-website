/* Concierge is een werkqueue, geen AI-belofte. Een lid vraagt; een bevoegd
   mens erkent, behandelt en doet een voorstel; het lid keurt dat voorstel
   goed voordat CONFIRMED mogelijk wordt. */
'use strict';

const STATES = Object.freeze({ REQUESTED:'REQUESTED', ACKNOWLEDGED:'ACKNOWLEDGED',
  IN_PROGRESS:'IN_PROGRESS', PROPOSED:'PROPOSED', MEMBER_APPROVAL:'MEMBER_APPROVAL',
  CONFIRMED:'CONFIRMED', CANNOT_FULFIL:'CANNOT_FULFIL' });
const OFFICE_NEXT = Object.freeze({ REQUESTED:['ACKNOWLEDGED','CANNOT_FULFIL'],
  ACKNOWLEDGED:['IN_PROGRESS','CANNOT_FULFIL'], IN_PROGRESS:['PROPOSED','CANNOT_FULFIL'],
  MEMBER_APPROVAL:['CONFIRMED','CANNOT_FULFIL'] });

module.exports = ({ R, mag, schoon, nu, save, crypto, notify }) => {
  function C() { const r=R(); if(!Array.isArray(r.concierge))r.concierge=[]; return r.concierge; }
  const memberView = x => ({ id:x.id, subject:x.subject, request:x.request, city:x.city,
    window:x.window, state:x.state, proposal:x.proposal || undefined,
    confirmation:x.state==='CONFIRMED'?x.confirmation:undefined, updatedAt:x.updatedAt });
  const officeView = x => ({ ...memberView(x), member:x.member });
  function list(key) {
    const gate=mag(key);if(!gate.ok)return {status:403,error:gate.reden};
    return {status:200,requests:C().filter(x=>x.member===key).slice().reverse().map(memberView)};
  }
  function request(key, body) {
    const gate=mag(key);if(!gate.ok)return {status:403,error:gate.reden};
    const text=schoon(body.request,800), subject=schoon(body.subject,80);
    if(!text||!subject)return {status:400,error:'Beschrijf wat De Rechterhand voor u kan regelen.'};
    const idem=schoon(body.idempotencyKey,200);if(idem.length<16)return {status:400,error:'De aanvraagsleutel ontbreekt.'};
    const old=C().find(x=>x.member===key&&x.idempotencyKey===idem);if(old)return {status:200,repeated:true,request:memberView(old)};
    const at=nu(), item={id:'rvc'+crypto.randomBytes(8).toString('hex'),member:key,subject,request:text,
      city:schoon(body.city,60),window:schoon(body.window,120),state:STATES.REQUESTED,
      idempotencyKey:idem,createdAt:at,updatedAt:at,history:[{state:STATES.REQUESTED,at,actor:'member'}]};
    C().push(item);save();return {status:200,ok:true,request:memberView(item)};
  }
  function approve(key, id, yes) {
    const gate=mag(key);if(!gate.ok)return {status:403,error:gate.reden};
    const x=C().find(v=>v.id===String(id||'')&&v.member===key);
    if(!x)return {status:404,error:'Dit verzoek bestaat niet.'};
    if(x.state!=='PROPOSED')return {status:409,error:'Dit voorstel wacht niet op uw akkoord.'};
    x.state=yes===false?STATES.IN_PROGRESS:STATES.MEMBER_APPROVAL;x.updatedAt=nu();
    x.history.push({state:x.state,at:x.updatedAt,actor:'member'});save();
    return {status:200,ok:true,request:memberView(x)};
  }
  function officeList() { return {status:200,requests:C().slice().reverse().map(officeView)}; }
  function officeStep(id, state, body, actor) {
    const x=C().find(v=>v.id===String(id||''));if(!x)return {status:404,error:'Dit verzoek bestaat niet.'};
    const next=String(state||'');if(!(OFFICE_NEXT[x.state]||[]).includes(next))
      return {status:409,error:'Deze service-overgang is niet toegestaan.'};
    if(next==='PROPOSED') { const p=schoon(body&&body.proposal,1000);if(!p)return {status:400,error:'Een voorstel is vereist.'};x.proposal=p; }
    if(next==='CONFIRMED') { const c=schoon(body&&body.confirmation,1000);if(!c)return {status:400,error:'Bevestigde fulfilmentinformatie is vereist.'};x.confirmation=c; }
    x.state=next;x.updatedAt=nu();x.history.push({state:next,at:x.updatedAt,actor:schoon(actor,80)||'office'});save();
    try{notify(x.member,{title:'Rendez-vous Concierge',body:next==='CONFIRMED'?'Uw verzoek is bevestigd.':'Uw verzoek is bijgewerkt.',scope:'lifestyle'});}catch(e){}
    return {status:200,ok:true,request:officeView(x)};
  }
  return {rvConciergeList:list,rvConciergeRequest:request,rvConciergeApprove:approve,
    rvConciergeOfficeList:officeList,rvConciergeOfficeStep:officeStep,STATES};
};
