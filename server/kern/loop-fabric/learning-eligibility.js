'use strict';
const P=require('./protocol');
const constitution=require('./constitution');

const MEMORY_CLASSES=Object.freeze(['PERSONAL','RELATIONSHIP_SHARED','ORGANIZATIONAL','DOMAIN_ASSET','COMMONS']);
const EPISTEMIC_TYPES=Object.freeze(['HUMAN_STATED','SYSTEM_OBSERVED','AUTHORITY_DECIDED','SOURCE_VERIFIED',
  'INFERRED','PROPOSED','SUMMARIZED','GENERATED']);
const USES=Object.freeze(['decision','recall','cross-domain','ai','aggregate','publish']);

function issue(value) {
  P.fields(value,['schemaVersion','eligibilityId','sourceRef','purpose','memoryClass','audience','basis','allowedFields','uses',
    'issuedAt','validUntil','retention','epistemicType','supersedes','aiScopes','promotionFrom','capabilityId']);
  const sourceRef=P.objectRef(value.sourceRef),purpose=P.text(value.purpose,120);
  if (!MEMORY_CLASSES.includes(value.memoryClass)) P.fail('ELIGIBILITY_INVALID','Onbekende memory class.');
  if (!EPISTEMIC_TYPES.includes(value.epistemicType)) P.fail('ELIGIBILITY_INVALID','Onbekende epistemische herkomst.');
  const audience=(value.audience||[]).map(row=>({domain:P.text(row.domain,60),id:P.text(row.id,160)}));
  if (!audience.length || audience.length>20) P.fail('ELIGIBILITY_INVALID','Learning eligibility vereist een begrensd publiek.');
  const allowedFields=[...new Set((value.allowedFields||[]).map(field=>P.text(field,80)))].sort();
  if (!allowedFields.length || allowedFields.length>30) P.fail('ELIGIBILITY_INVALID','Learning eligibility vereist een veldallowlist.');
  const uses={};for(const name of USES)uses[name]=value.uses&&value.uses[name]===true;
  const basis=value.basis;
  if (!basis || typeof basis!=='object' || Array.isArray(basis)) P.fail('ELIGIBILITY_INVALID','Een aantoonbare grond ontbreekt.');
  P.fields(basis,['type','evidenceRef']);
  const normalizedBasis={type:P.text(basis.type,80),evidenceRef:basis.evidenceRef?P.objectRef(basis.evidenceRef):null};
  const retention=value.retention;
  if (!retention || typeof retention!=='object' || Array.isArray(retention)) P.fail('ELIGIBILITY_INVALID','Expliciete retentie ontbreekt.');
  P.fields(retention,['mode','policyId']);
  const normalized={schemaVersion:1,constitutionVersion:constitution.VERSION,sourceRef,purpose,memoryClass:value.memoryClass,audience,
    basis:normalizedBasis,allowedFields,uses,issuedAt:P.instant(value.issuedAt,'issued_at'),
    validUntil:value.validUntil?P.instant(value.validUntil,'valid_until'):null,
    retention:{mode:P.text(retention.mode,80),policyId:P.text(retention.policyId,120)},
    epistemicType:value.epistemicType,supersedes:value.supersedes?P.objectRef(value.supersedes):null,
    aiScopes:Array.isArray(value.aiScopes)?value.aiScopes:[],promotionFrom:value.promotionFrom?P.clone(value.promotionFrom):null,
    capabilityId:value.capabilityId?P.text(value.capabilityId,120):null};
  if (normalized.validUntil && normalized.validUntil<=normalized.issuedAt)
    P.fail('ELIGIBILITY_INVALID','Learning eligibility is al verlopen.');
  if (normalized.memoryClass==='PERSONAL'&&(normalized.uses['cross-domain']||normalized.uses.aggregate||normalized.uses.publish))
    P.fail('MEMORY_PROMOTION_REQUIRED','Persoonlijk geheugen vereist een afzonderlijke, expliciete promotie naar een andere memory class.',403);
  if (normalized.memoryClass==='COMMONS'&&!['EXPLICIT_RELEASE','VOLUNTARY_EXPLICIT_CONTRIBUTION'].includes(normalized.basis.type))
    P.fail('COMMONS_RELEASE_REQUIRED','Commons Memory vereist een expliciete vrijgave.',403);
  if (normalized.uses.ai&&!['AI_EXPLICIT_SCOPE','EXPLICIT_CONSENT_FOR_AI'].includes(normalized.basis.type))
    P.fail('AI_SCOPE_REQUIRED','AI-gebruik vereist een afzonderlijke expliciete scope.',403);
  normalized.aiScopes=constitution.validateEligibility(normalized);
  normalized.eligibilityId='le_'+P.hash(normalized).slice(0,30);return normalized;
}

function evaluate(raw,request,now) {
  try {
    const eligibility=raw&&raw.schemaVersion===1&&raw.eligibilityId?P.clone(raw):issue(raw);
    P.fields(request,['sourceRef','purpose','recipient','use']);
    const sourceRef=P.objectRef(request.sourceRef),recipient=request.recipient;
    if (P.refKey(sourceRef)!==P.refKey(eligibility.sourceRef)) P.fail('ELIGIBILITY_SOURCE_CHANGED','Eligibility hoort bij een andere bronversie.',409);
    if (eligibility.purpose!==request.purpose) P.fail('PURPOSE_DENIED','Learning eligibility geldt niet voor dit doel.',403);
    if (!recipient || !eligibility.audience.some(x=>x.domain===recipient.domain&&x.id===recipient.id))
      P.fail('AUDIENCE_DENIED','Learning eligibility geldt niet voor deze ontvanger.',403);
    if (!USES.includes(request.use) || !eligibility.uses[request.use])
      P.fail('USE_DENIED','Learning eligibility staat dit gebruik niet toe.',403);
    const at=P.instant(now,'evaluated_at');
    if (eligibility.validUntil&&eligibility.validUntil<=at) P.fail('ELIGIBILITY_EXPIRED','Learning eligibility is verlopen.',410);
    return {ok:true,eligibility};
  } catch(error) { return P.error(error); }
}

function minimal(value) {
  const e=value&&value.eligibilityId?value:issue(value);
  return {eligibilityId:e.eligibilityId,sourceRef:P.clone(e.sourceRef),purpose:e.purpose,memoryClass:e.memoryClass,
    audienceHash:P.hash(e.audience),allowedFieldsHash:P.hash(e.allowedFields),uses:P.clone(e.uses),issuedAt:e.issuedAt,
    validUntil:e.validUntil,retention:P.clone(e.retention),epistemicType:e.epistemicType,
    constitutionVersion:e.constitutionVersion||constitution.VERSION,aiScopes:P.clone(e.aiScopes||[]),capabilityId:e.capabilityId||null};
}

module.exports={MEMORY_CLASSES,EPISTEMIC_TYPES,USES,issue,evaluate,minimal};
