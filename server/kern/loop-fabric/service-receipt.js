'use strict';

const P=require('./protocol');

function verifyServiceReceipt(serviceProof,receipt,{domain,issuer,label}) {
  if (!receipt || receipt.sourceDomain!==domain)
    return {ok:false,code:'SERVICE_PROOF_INVALID',error:'Receipt issuer en brondomein verschillen.'};
  if (!receipt.serviceProof) return {ok:true,mode:'in-process'};
  if (!serviceProof || typeof serviceProof.controleerBericht!=='function')
    return {ok:false,code:'SERVICE_PROOF_UNAVAILABLE',error:'De servicehandtekening kan hier niet worden gecontroleerd.'};
  const payload=P.clone(receipt); delete payload.serviceProof;
  const checked=serviceProof.controleerBericht(receipt.serviceProof,payload);
  return checked.geldig && checked.issuer===issuer ? {ok:true,mode:'signed',proof:checked}
    : {ok:false,code:'SERVICE_PROOF_INVALID',error:`De ${label}-servicehandtekening klopt niet.`};
}

module.exports={verify:verifyServiceReceipt};
