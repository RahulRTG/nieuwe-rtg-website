'use strict';
const M = require('./model'), actions = require('./actions'), envelope = require('../envelop');
const klok = require('../../lib/klok');
module.exports = function makeLivingWorld({db,save,bewerkCollectie,sources,now}) {
  const eigen = require('../eigencollectie')({db,domein:'kern/living-world',bezit:{livingWorld:'kaart'}});
  const time = now || (() => klok.datum().toISOString());
  const read = () => Object.assign(M.empty(),eigen.kijk('livingWorld'));
  async function mutate(work) {
    if (bewerkCollectie) return bewerkCollectie('livingWorld',work);
    const before = eigen.kijk('livingWorld'), next = M.clone(before), out = work(next);
    eigen.zetBak('livingWorld',next);
    try { await save(); } catch(e) { eigen.zetBak('livingWorld',before); throw e; }
    return out;
  }
  function target(s, action, p) {
    if (action === 'place.create') return null;
    if (action === 'blueprint.create' || action === 'contribution.create') return M.get(s,'places',p.placeId);
    if (['blueprint.fork','plan.create'].includes(action)) return M.get(s,'blueprints',p.id);
    return M.get(s,{place:'places',blueprint:'blueprints',plan:'plans',contribution:'contributions'}[action.split('.')[0]],p.id);
  }
  function error(e) {
    if (!e.livingWorld) throw e;
    return {error:e.message,status:e.status,code:e.code};
  }
  function apply(s,key,action,data,receipt,at) {
    if (!actions.definitions[action]) M.fail('Onbekende handeling.',400,'UNKNOWN_ACTION');
    const row = target(s,action,data);
    if (!actions.allowed(action,row,key,s)) M.fail('Deze handeling is nu niet toegestaan.',403,'ACTION_DENIED');
    const family = action.split('.')[0];
    const id = 'lw_' + M.hash([key,receipt,action]).slice(0,24);
    const ctx = {state:s,key,data,action,at,id,sources};
    const result = family === 'place' || family === 'blueprint' ? require('./places')(ctx)
      : family === 'plan' ? require('./plans')(ctx) : require('./contributions')(ctx);
    if (result !== row && !['place.create','blueprint.create','blueprint.fork','plan.create','contribution.create'].includes(action))
      throw new Error('Onverwacht object in Living World.');
    if (result === row) result.revision++;
    result.updatedAt = at;
    const type = family === 'blueprint' ? 'blueprint' : family;
    return {ok:true,objectRef:M.ref(type,result.id),result:{id:result.id,type,revision:result.revision,
      status:result.status,url:M.href(type,result.id)}};
  }
  function prepareWorldAction(key,action,data) {
    try {
      if (!key || typeof data !== 'object' || !data || Array.isArray(data)) M.fail('Ongeldige invoer.');
      const parameters = M.clone(data);
      if (JSON.stringify(parameters).length > 20000) M.fail('Te veel invoer.');
      const s = M.clone(read());
      const out = apply(s,key,action,parameters,'preview',time());
      return {ok:true,parameters,objectRef:out.objectRef,
        policy:{decision:'ALLOW_WITH_CONFIRMATION',policyId:'policy:living-world-source-authority',
          version:'v1',reasonCodes:[action]},
        confirmation:{required:true,text:actions.definitions[action][0] + '?'},
        consequence:{changesDomainTruth:true,changesExperienceState:false,createsFinancialCommitment:false,
          reversible:true,notificationSent:false}};
    } catch(e) { return error(e); }
  }
  async function execute(key,action,data,receipt) {
    if (!/^[a-zA-Z0-9._:-]{8,160}$/.test(receipt || ''))
      return {error:'Een uitvoeringsreferentie is vereist.',status:400,code:'RECEIPT_REQUIRED'};
    const fingerprint = M.hash([key,action,data]);
    const receiptKey = M.hash([key,receipt]);
    const work = current => {
      const s = Object.assign(M.empty(),M.clone(current));
      const previous = s.receipts[receiptKey];
      if (previous) {
        if (previous.fingerprint !== fingerprint) M.fail('Deze uitvoeringsreferentie is al gebruikt.',409,'REPLAY_CONFLICT');
        return {...M.clone(previous.out),replay:true};
      }
      const at = time(), out = apply(s,key,action,data,receipt,at);
      const eventId = 'lwe_' + receiptKey.slice(0,24), priorEvent = s.history.at(-1);
      const event = {id:eventId,sequence:s.history.length+1,actor:key,action,
        objectRef:out.objectRef,revision:out.result.revision,at,operationId:receipt,
        previousHash:priorEvent ? priorEvent.hash : null,
        envelop:envelope.maak({id:eventId,at,kanaal:'living-world',actor:key,
          correlatie:receipt,oorzaak:null,
          classificatie:action.startsWith('contribution.') ? 'persoonsgegeven' : 'intern'})};
      if (action.startsWith('contribution.')) event.protocol = loopSource.observationRecord(s.contributions[out.result.id]);
      event.hash = M.hash(event); s.history.push(event);
      out.result.receiptId = event.id;
      s.receipts[receiptKey] = {fingerprint,out:M.clone(out)};
      Object.assign(current,s);
      return out;
    };
    try {
      if (bewerkCollectie) return await bewerkCollectie('livingWorld',work);
      const before = eigen.kijk('livingWorld'), next = M.clone(before), out = work(next);
      if (!out.replay) {
        eigen.zetBak('livingWorld',next);
        try { await save(); } catch(e) { eigen.zetBak('livingWorld',before); throw e; }
      }
      return out;
    } catch(e) { return error(e); }
  }
  const loopSource = require('./loop-source')({read,mutate,time});
  const projection = require('./projection')({read,time,sources});
  return {prepare:prepareWorldAction,execute,view:projection.view,saloon:projection.saloon,mediaLinks:projection.mediaLinks,
    portfolio:require('./portfolio')(read,time),deliver:loopSource.deliver,
    protocolEvents:loopSource.protocolEvents,resolveObservation:loopSource.resolveObservation,
    learningEligibility:loopSource.learningEligibility,
    returnChangeReceipt:loopSource.returnChangeReceipt,deliveryStatus:loopSource.deliveryStatus,
    deliveryStatuses:loopSource.deliveryStatuses,replayDeadLetter:loopSource.replayDeadLetter};
};
