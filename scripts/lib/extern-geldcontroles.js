/* De vijf geld/providerproeven delen één vooraf geautoriseerde, idempotente
   live-keten. Zonder keten-ID, change-referentie en hard maximumbedrag: OPEN. */
'use strict';
const crypto = require('node:crypto');
const HASH = /^[a-f0-9]{64}$/;
const CONTROLES = new Set(['paymentProvider','payoutProvider','webhookDelivery',
  'refundPayoutSettlement','reconciliation']);
const hash = v => crypto.createHash('sha256').update(String(v)).digest('hex');
const geheel = (v,min,max) => Number.isSafeInteger(v) && v >= min && v <= max;
function alleen(o,namen) { const x=Object.keys(o||{}).filter(k=>!namen.includes(k)); if(x.length) throw Error('de waarneming bevat onbekende velden'); }
function ja(v,n) { if(v!==true) throw Error(n+' is niet daadwerkelijk gemeten'); }
function h(v,n) { if(!HASH.test(String(v||''))) throw Error(n+' mist een SHA-256-verwijzing'); }
function uitslag(r,keur) {
  if (!r || r.stand !== 'OK') return { stand:(r&&r.stand)||'FAIL', redenen:(r&&r.redenen)||['geen externe uitslag'] };
  const gegevens={ runnerTrustVersion:r.runnerTrustVersion, runnerKeySha256:r.runnerKeySha256,
    responseSha256:r.responseSha256, externalMeasurement:r.meting };
  try { keur(r.meting.observations); return { stand:'OK', redenen:[], gegevens }; }
  catch(e) { const m=r.meting||{}; return { stand:'FAIL', redenen:[String(e.message||e).slice(0,400)],
    gegevens:{ runnerTrustVersion:r.runnerTrustVersion,runnerKeySha256:r.runnerKeySha256,responseSha256:r.responseSha256,
      rejectedMeasurement:{ control:m.control,commit:m.commit,correlationId:m.correlationId,
        measurementId:m.measurementId,startedAt:m.startedAt,finishedAt:m.finishedAt } } }; }
}
function config(o) {
  const geldStand=require('../../server/config/productie-geld').stand(o.env);
  if(geldStand.releaseZonderRail) return { railDisabled:true,
    serverSidePaymentStop:geldStand.betalingenUit===true, releaseWithoutRail:true };
  const chain=String(o.env.RTG_EVIDENCE_MONEY_CHAIN_ID||'').trim();
  const autorisatie=String(o.env.RTG_EVIDENCE_MONEY_AUTHORIZATION_REF||'').trim();
  const max=Number(o.env.RTG_EVIDENCE_MONEY_MAX_MINOR);
  const currency=String(o.env.RTG_EVIDENCE_MONEY_CURRENCY||'').trim().toLowerCase();
  if(chain.length<16||autorisatie.length<6||!geheel(max,1,10000)||!/^[a-z]{3}$/.test(currency))
    return { open:'geldproef mist chain-ID, autorisatiereferentie, valuta of een maximum van 1..10000 minor units' };
  return { chain,autorisatie,max,currency,correlationId:'money-'+hash(chain).slice(0,48) };
}
function basis(x,cfg) {
  ja(x.live,'live-providerrail'); ja(x.rtgOperationObserved,'RTG-operatie');
  ja(x.providerObserved,'providerwaarneming'); ja(x.idempotent,'idempotente proefketen');
  h(x.chainIdSha256,'geldketen');
  if(x.chainIdSha256!==hash(cfg.chain)) throw Error('de providerwaarneming hoort niet bij de geautoriseerde geldketen');
}
const VELDEN={
  paymentProvider:['live','rtgOperationObserved','providerObserved','idempotent','chainIdSha256','provider','paymentRefSha256','providerRetrieved','status','amountMinor','currency'],
  payoutProvider:['live','rtgOperationObserved','providerObserved','idempotent','chainIdSha256','provider','payoutRefSha256','providerRetrieved','destinationVerified','status','amountMinor','currency'],
  webhookDelivery:['live','rtgOperationObserved','providerObserved','idempotent','chainIdSha256','provider','eventRefSha256','providerItemManifestVersion','providerItemManifestSha256','providerItemManifestItems','signatureVerified','firstDeliveryAccepted','replayAttempted','replayDeduplicated','businessMutationCount','deliveryAttempts'],
  refundPayoutSettlement:['live','rtgOperationObserved','providerObserved','idempotent','chainIdSha256','provider','paymentRefSha256','refundRefSha256','payoutRefSha256','refundStatus','payoutStatus','refundAmountMinor','payoutAmountMinor','currency','doubleMutation'],
  reconciliation:['live','rtgOperationObserved','providerObserved','idempotent','chainIdSha256','provider','statementRefSha256','providerItemManifestVersion','providerItemManifestSha256','providerItemManifestItems','providerItems','ledgerItems','matchedItems','unmatchedProvider','unmatchedLedger','amountDeltaMinor','unknownOutcomes','reconciled']
};
function itemManifest(x) {
  if(x.providerItemManifestVersion!=='rtg-provider-items-v1')
    throw Error('het provideritemmanifest heeft niet de verplichte canonieke versie');
  h(x.providerItemManifestSha256,'provideritemmanifest');
  if(!geheel(x.providerItemManifestItems,1,1000000))
    throw Error('het provideritemmanifest heeft geen geldige itemtelling');
}
function keur(control,x,cfg) {
  alleen(x,VELDEN[control]); basis(x,cfg);
  if(!/^[a-z0-9_-]{2,40}$/.test(String(x.provider||''))) throw Error('provider ontbreekt');
  if(control==='paymentProvider'||control==='payoutProvider') {
    const ref=control==='paymentProvider'?'paymentRefSha256':'payoutRefSha256'; h(x[ref],ref);
    ja(x.providerRetrieved,'providerstatus'); if(control==='payoutProvider') ja(x.destinationVerified,'uitbetaalbestemming');
    if(!['paid','settled','succeeded'].includes(x.status)) throw Error('de geldmutatie is niet definitief betaald');
    if(!geheel(x.amountMinor,1,cfg.max)||x.currency!==cfg.currency) throw Error('bedrag of valuta valt buiten de autorisatie');
  } else if(control==='webhookDelivery') {
    h(x.eventRefSha256,'provider-event'); itemManifest(x);
    for(const k of ['signatureVerified','firstDeliveryAccepted','replayAttempted','replayDeduplicated']) ja(x[k],k);
    if(x.businessMutationCount!==1||!geheel(x.deliveryAttempts,2,100)) throw Error('de replay was niet aantoonbaar exact-once');
  } else if(control==='refundPayoutSettlement') {
    for(const k of ['paymentRefSha256','refundRefSha256','payoutRefSha256']) h(x[k],k);
    if(!['paid','settled','succeeded','refunded'].includes(x.refundStatus)||!['paid','settled'].includes(x.payoutStatus)) throw Error('refund en payout zijn niet beide definitief');
    if(![x.refundAmountMinor,x.payoutAmountMinor].every(v=>geheel(v,1,cfg.max))||x.currency!==cfg.currency||x.doubleMutation!==false) throw Error('refund/payout valt buiten autorisatie of bevat een dubbele mutatie');
  } else {
    h(x.statementRefSha256,'providerstatement'); itemManifest(x); ja(x.reconciled,'reconciliatie');
    if(![x.providerItems,x.ledgerItems,x.matchedItems].every(v=>geheel(v,1,1000000))||x.providerItems!==x.providerItemManifestItems||x.matchedItems!==x.providerItems||x.matchedItems!==x.ledgerItems||x.unmatchedProvider!==0||x.unmatchedLedger!==0||x.amountDeltaMinor!==0||x.unknownOutcomes!==0) throw Error('providerstatement, provideritemmanifest en RTG-grootboek sluiten niet exact aan');
  }
}
async function geld(control,o) {
  if(!CONTROLES.has(control)) return { stand:'FAIL',redenen:['onbekende geldcontrole'] };
  const cfg=config(o); if(cfg.railDisabled) return { stand:'OUT_OF_SCOPE',redenen:[],gegevens:{
    railDisabled:true,serverSidePaymentStop:true,releaseWithoutRail:true,controle:control } };
  if(cfg.open) return { stand:'OPEN',redenen:[cfg.open] };
  const r=await o.meetExtern(control,{ chainId:cfg.chain,authorizationRef:cfg.autorisatie,
    maxAmountMinor:cfg.max,currency:cfg.currency,mode:'live-existing-chain' },
  { correlationId:cfg.correlationId });
  return uitslag(r,x=>keur(control,x,cfg));
}
module.exports={ geld,keurGeld:keur,geldConfig:config,GELD_CONTROLES:CONTROLES };
