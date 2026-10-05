'use strict';
const P=require('./protocol');

const VERSION='2026-10-05.1';
const AI_SCOPES=Object.freeze(['assistance','inference','training']);
const RESOLVED_DECISIONS=Object.freeze(['D01_PERSONAL_MEMORY','D06_WORKFORCE_DEVELOPMENT','D07_TRAVEL_EXPERIENCE',
  'D08_FOUNDATION_ASSISTANCE','D11_COMMUNITY_EVENTS','D13_DISCOVERY_COMMONS','D14_AI_ASSISTANCE',
  'D15_SERVICE_IMPROVEMENT','D23_LIBRARY_EDUCATION_RELEASE']);
const GENERIC_LEARNING_CLOSED=Object.freeze(['D03_HEALTH_CONTEXT','D09_CHILD_EDUCATION','D12_DATING',
  'D17_SECURITY_CREDENTIALS','D18_IDENTITY_VERIFICATION','D20_PAYMENT_OPERATIONS','D21_FINANCIAL_PROFILING']);
const RULES=Object.freeze([
  {id:'LC01',text:'Gebruik van een dienst is geen toestemming voor optionele learning.'},
  {id:'LC02',text:'Memory classes promoveren alleen via een afzonderlijk source-issued artifact en eligibility.'},
  {id:'LC03',text:'Commons vereist een expliciete versiegebonden release.'},
  {id:'LC04',text:'AI-assistentie, inference en training zijn afzonderlijke doelen.'},
  {id:'LC05',text:'Persoonlijke ervaring wordt niet automatisch Organizational Memory.'},
  {id:'LC06',text:'Foundation-hulp en kansen hangen niet af van optionele learning.'},
  {id:'LC07',text:'Werknemerscontext wordt geen surveillance- of mensscoregeheugen.'},
  {id:'LC08',text:'Asset history bevat niet automatisch geschiedenis van bewoners of gebruikers.'},
  {id:'LC09',text:'Cross-domain transfer verhoogt epistemische status niet.'},
  {id:'LC10',text:'Recall controleert actuele authority, purpose, eligibility en retention.'},
  {id:'LC11',text:'Optionele learning rond minderjarigen blijft generiek gesloten.'},
  {id:'LC12',text:'Zorg, financiële profilering, credentials en intieme context hebben geen generiek learningpad.'},
  {id:'LC13',text:'Source domains behouden betekenis en canonical state.'},
  {id:'LC14',text:'Alleen de source owner bevestigt een Change met een source-issued receipt.'},
  {id:'LC15',text:'Change is geen bewezen verbetering; Verification is een nieuwe waarneming.'},
  {id:'LC16',text:'Failed, reversed, mixed, unknown, contested en not reproducible blijven first-class uitkomsten.'},
  {id:'LC17',text:'Volgorde, correlatie en lineage vormen geen causaliteitsbewijs.'},
  {id:'LC18',text:'Retentie heeft een bron- en purposebeleid; forever is geen default.'}
]);

function validateEligibility(value) {
  const basis=value.basis&&value.basis.type;
  if(['SERVICE_USE','IMPLIED_USE','ACCOUNT_EXISTS'].includes(basis))
    P.fail('LEARNING_CONSENT_NOT_INFERRED','Dienstgebruik is geen learninggrond.',403);
  if(value.retention&&['FOREVER','DEFAULT_FOREVER'].includes(value.retention.mode))
    P.fail('RETENTION_POLICY_REQUIRED','Learningretentie mag niet standaard forever zijn.',403);
  const scopes=[...new Set((value.aiScopes||[]).map(x=>P.text(x,40)))].sort();
  if(scopes.some(x=>!AI_SCOPES.includes(x)))P.fail('AI_SCOPE_REQUIRED','Onbekende AI-scope.',403);
  if(value.uses.ai&&scopes.length===0)P.fail('AI_SCOPE_REQUIRED','AI-gebruik vereist assistance, inference of training.',403);
  if(!value.uses.ai&&scopes.length)P.fail('AI_SCOPE_MISMATCH','AI-scopes bestaan terwijl AI-gebruik uit staat.',403);
  if(scopes.includes('training')&&basis!=='AI_TRAINING_EXPLICIT')
    P.fail('AI_TRAINING_SCOPE_REQUIRED','AI-training vereist een afzonderlijke expliciete grond.',403);
  if(value.memoryClass==='COMMONS'&&value.sourceRef.version==null)
    P.fail('COMMONS_VERSION_REQUIRED','Commons-release vereist een exacte bronversie.',403);
  if(value.promotionFrom) {
    const from=P.objectRef(value.promotionFrom.sourceRef),fromClass=P.text(value.promotionFrom.memoryClass,40);
    if(!['PERSONAL','RELATIONSHIP_SHARED'].includes(fromClass)||!value.promotionFrom.releaseRef)
      P.fail('MEMORY_PROMOTION_REQUIRED','Memory-promotie vereist een afzonderlijke release.',403);
    P.objectRef(value.promotionFrom.releaseRef);
    if(value.memoryClass==='ORGANIZATIONAL'&&!value.promotionFrom.unlinkedAt)
      P.fail('UNLINKING_REQUIRED','Persoonlijke ervaring vereist unlinking vóór Organizational Memory.',403);
    if(from.domain===value.sourceRef.domain&&P.refKey(from)===P.refKey(value.sourceRef))
      P.fail('MEMORY_PROMOTION_REQUIRED','Promotie maakt een nieuw minimaal artifact en overschrijft de bron niet.',403);
  }
  return scopes;
}

function assertChangeReceipt(receipt) {
  if(!receipt||receipt.sourceDomain!==receipt.newRef.domain)
    P.fail('FABRIC_SOURCE_OWNERSHIP','Alleen de source owner kan Change bevestigen.',500);
  return true;
}

function manifest(){return {schemaVersion:1,version:VERSION,rules:RULES,resolvedDecisions:RESOLVED_DECISIONS,
  genericLearningClosed:GENERIC_LEARNING_CLOSED,aiScopes:AI_SCOPES};}
module.exports={VERSION,RULES,AI_SCOPES,RESOLVED_DECISIONS,GENERIC_LEARNING_CLOSED,validateEligibility,assertChangeReceipt,manifest};
