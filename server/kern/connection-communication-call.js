'use strict';

module.exports = ({ product, root, save, id, now, context, mutual, limit, isBlocked, schoon, ping, types }) => {
  const project = (call, actor) => ({ id: call.id, type: call.type, state: call.state,
    incoming: call.from !== actor, revision: call.revision });
  function close(c, type, reason) {
    let gesloten = 0;
    for (const call of root().calls) if (call.product === product && call.scope === c.scope && call.pair === c.pair &&
      (!type || call.type === type) && ['RINGING', 'ACTIVE'].includes(call.state)) {
      call.state = reason || 'ENDED'; call.revision += 1; call.updatedAt = now();
      gesloten += 1;
      ping(call.from, 'call', call.scope, call.id); ping(call.to, 'call', call.scope, call.id);
    }
    return gesloten;
  }
  function find(actor, callId) {
    const call = root().calls.find(x => x.id === String(callId || '') && x.product === product &&
      (x.from === actor || x.to === actor));
    if (!call || isBlocked(call.from, call.to)) return null;
    const age = Date.now() - Date.parse(call.updatedAt || call.createdAt || 0);
    if ((call.state === 'RINGING' && age > 60000) || (call.state === 'ACTIVE' && age > 4 * 3600000)) {
      call.state = 'EXPIRED'; call.revision += 1; call.updatedAt = now(); save();
    }
    return call;
  }
  function start(actor, input, type, idem) {
    const capability = types[type]; if (!capability) return { status:400, error:'Onbekend gesprekstype.' };
    const c = context(actor, input); if (!c) return { status:404, error:'Dit gesprek bestaat niet.' };
    const r = root(); if (!mutual(r, actor, c, capability)) return { status:403, code:'MUTUAL_CONSENT_REQUIRED', error:'Beiden moeten dit eerst toestaan.' };
    if (!limit(actor, 'call', 6, 3600000)) return { status:429, error:'Te veel oproepen kort na elkaar.' };
    const token = String(idem || '').slice(0, 200); if (token.length < 16) return { status:400, error:'De oproepsleutel ontbreekt.' };
    const old = r.calls.find(x => x.product === product && x.from === actor && x.idempotencyKey === token);
    if (old) return { status:200, ok:true, repeated:true, call:project(old, actor) };
    close(c, null, 'REPLACED');
    const call = { id:id('ccc'), product, scope:c.scope, pair:c.pair, from:actor, to:c.counterpart,
      type, state:'RINGING', revision:1, signals:[], idempotencyKey:token, createdAt:now(), updatedAt:now() };
    r.calls.push(call); save(); ping(c.counterpart, 'call', c.scope, call.id);
    return { status:200, ok:true, call:project(call, actor) };
  }
  function answer(actor, callId, accept) {
    const call=find(actor,callId);if(!call||call.to!==actor||call.state!=='RINGING')return {status:409,error:'Deze oproep staat niet meer open.'};
    if(!mutual(root(),actor,{counterpart:call.from,scope:call.scope,pair:call.pair},types[call.type]))accept=false;
    call.state=accept===false?'DECLINED':'ACTIVE';call.revision++;call.updatedAt=now();save();ping(call.from,'call',call.scope,call.id);
    return {status:200,ok:true,call:project(call,actor)};
  }
  function signal(actor,callId,kind,payload){const call=find(actor,callId);if(!call||!['RINGING','ACTIVE'].includes(call.state))return {status:409,error:'Deze oproep is gesloten.'};
    if(!['offer','answer','ice','caption'].includes(kind))return {status:400,error:'Onbekend sein.'};
    if(kind==='caption'){const text=schoon(payload&&payload.text,400);if(!text)return {status:400,error:'Een lege meeleesregel wordt niet verstuurd.'};payload={text};}
    if(Buffer.byteLength(JSON.stringify(payload||{}))>65536)return {status:413,error:'Dit sein is te groot.'};
    if(!limit(actor,'signal',240,60000))return {status:429,error:'Te veel oproepsignalen.'};
    const target=call.from===actor?call.to:call.from;call.signals.push({id:id('ccs'),from:actor,to:target,kind,payload,at:now()});
    call.signals=call.signals.slice(-100);save();ping(target,'call-signal',call.scope,call.id);return {status:200,ok:true};}
  function poll(actor,callId,after){const call=find(actor,callId);if(!call)return {status:404,error:'Deze oproep bestaat niet.'};
    const visible=call.signals.filter(x=>x.to===actor),at=after?visible.findIndex(x=>x.id===after):-1;
    return {status:200,call:project(call,actor),signals:at>=0?visible.slice(at+1):visible};}
  function end(actor,callId,reason){const call=find(actor,callId);if(!call||!['RINGING','ACTIVE'].includes(call.state))return {status:200,ok:true,repeated:true};
    call.state=reason||'ENDED';call.revision++;call.updatedAt=now();save();ping(call.from===actor?call.to:call.from,'call',call.scope,call.id);return {status:200,ok:true};}
  return { start, answer, signal, poll, end, close, project };
};
