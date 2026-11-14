/* De bestaande requirement- en dimensiebeoordeling, naast de samensteller. */
'use strict';
const artifact=require('./artifact');
const {sha}=require('./evidence');
const {stable}=artifact;
const configurations=require('./configurations');
const planning=require('./qualification-planning');
const DIMENSION_ORDER=['identity','composition','continuity','restraint','adaptability','accessibility','fluidity','human-quality'];
function baseRequirements(contract, profile, dimension, signature) {
  /* Een signature mag de grondwet uitbreiden, nooit de noemer verkleinen. */
  const additionalStates=Array.isArray(signature?.value?.additionalStates)?signature.value.additionalStates:[];
  const additionalDevices=Array.isArray(signature?.value?.additionalDevices)?signature.value.additionalDevices:[];
  const states = [...new Set(contract.states.concat(additionalStates))];
  const devices = [...new Set(contract.devices.concat(additionalDevices))];
  const interactionRows=Array.isArray(signature?.value?.interactions)?signature.value.interactions:[];
  const interactions = interactionRows.map(action => action.id);
  if (dimension === 'identity') return ['signature'];
  if (dimension === 'composition' || dimension === 'restraint') return states.flatMap(state => devices.map(device => state + '@' + device)).concat(interactions.map(id=>'interaction:'+id));
  if (dimension === 'continuity') return contract.continuityChecks.slice().concat(interactions.map(id=>'interaction:'+id));
  if (dimension === 'adaptability') return devices.flatMap(device => contract.networks.map(network => device + '@' + network));
  if (dimension === 'accessibility') return devices.flatMap(device => contract.accessibilityChecks.map(check => device + '@' + check)).concat(interactions.map(id=>'interaction:'+id));
  if (dimension === 'fluidity') return devices.flatMap(device => contract.fluidityChecks.map(check => device + '@' + check)).concat(interactions.map(id=>'interaction:'+id));
  if (dimension === 'human-quality') {
    const tasks = Array.isArray(signature?.value?.humanTasks)?signature.value.humanTasks:[];
    return (tasks.length ? tasks.flatMap((task,index)=>['task:'+index+'@mobile','task:'+index+'@desktop']) : ['signature:human-task@mobile','signature:human-task@desktop']).concat(interactions.map(id=>'interaction:'+id));
  }
  return [];
}

// Het vijfde argument is optioneel voor bestaande protocollen. Bij een echt
// onderwerp vergroot de afbouwbinding de bestaande bewijslast; zij kan geen
// toestand, interactie of configuratie uit de oorspronkelijke noemer halen.
function requirements(contract, profile, dimension, signature, subject) {
  return [...new Set(baseRequirements(contract,profile,dimension,signature)
    .concat(planning.requirements(contract,dimension,subject,profile)))];
}

const evidenceStatus = artifact.status;
function worst(statuses) {
  return ['FAILED','BLOCKED','STALE','NOT_TESTED'].find(value=>statuses.includes(value)) || 'PROVEN';
}
function assessCells(root,kind,subject,dimension,requirement,matches,evidence,source,candidate) {
  const groups=new Map(),results=[];
  for(const record of matches) {
    const live=require('./execution').scoped(record,root);
    const key=JSON.stringify([record.configurationHash,live?.runId || null]);
    if(!groups.has(key))groups.set(key,[]);
    groups.get(key).push({record,live});
  }
  for(const group of groups.values()) {
    if(group.length!==1) {results.push({status:'BLOCKED',reason:'DUPLICATE_EXECUTION_CELL'});continue;}
    const {record,live}=group[0];
    const configurationHash=live?sha(JSON.stringify(stable(live.configuration))):
      evidence.configuration?sha(JSON.stringify(stable(evidence.configuration))):record.configurationHash;
    const assessment=artifact.assessment(record,source,candidate,dimension,
      {root,subjectType:kind,subjectId:subject.id,requirement,configurationHash});
    /* Alleen het proces dat de getypeerde ontvangstbewijzen zojuist heeft
       gemaakt bezit de WeakMap-receipt. Voor eisen zonder aanvullende
       configuratiematrix is die exacte, onveranderde procesbinding volledig
       uitvoeringsbewijs. Een geïmporteerd bestand krijgt deze promotie nooit;
       destination-cellen moeten daarnaast nog steeds hun hele matrix sluiten. */
    if(live&&assessment.scopedStatus==='PROVEN_IN_SCOPE') assessment.status='PROVEN';
    results.push(assessment);
  }
  if(!results.length)results.push(artifact.assessment(undefined,source,candidate,dimension));
  const scopedProofs=results.filter(row=>row.scopedStatus).map(row=>({requirement,status:row.scopedStatus,scope:row.scope}));
  return {requirement,status:worst(results.map(row=>row.status)),
    ...(results.some(row=>row.integrity==='VALID')?{integrity:'VALID',reason:results.find(row=>row.integrity==='VALID').reason}:{}),scopedProofs};
}
function matrixCells(contract,signature,dimension,requirement,scopedProofs) {
  const plan=configurations.required(contract,signature,dimension,requirement);
  if(!plan)return null;
  const baseline=configurations.inspect(plan),groups=new Map();
  for(const {scope} of scopedProofs) {
    if(!scope.matrixCell)continue; // de oorspronkelijke 390×844-scope is geen matrixcel
    if(!groups.has(scope.runId))groups.set(scope.runId,[]);
    groups.get(scope.runId).push(scope.configuration);
  }
  const runs=[...groups].map(([runId,configs])=>{
    const summary=configurations.inspect(plan,configs);
    return {...summary,runId,observedCellCount:summary.mappedCellCount};
  });
  if(runs.length===1)return {...runs[0],runs};
  if(runs.length>1)return {...baseline,status:'BLOCKED',reason:'MULTIPLE_EXECUTIONS_NOT_AGGREGATED',
    blockers:baseline.blockers.concat('MULTIPLE_EXECUTIONS_NOT_AGGREGATED'),runs};
  return baseline;
}

function dimensionRows(root, contract, profileName, subject, kind, signature, evidence, source, candidate) {
  const profile = contract.profiles[profileName];
  return DIMENSION_ORDER.map(dimension => {
    if (!profile.dimensions.includes(dimension)) {
      const decision = profile.notApplicable && profile.notApplicable[dimension];
      return {id:dimension,applicable:false,status:'NOT_APPLICABLE',decision:decision?.decision || null,reason:decision?.reason || null,requirementCount:0,provenCount:0};
    }
    const required = requirements(contract, profileName, dimension, signature, subject);
    const configurationCoverage=[];
    const records = required.map(requirement => {
      const matches = (evidence.records || []).filter(item => item && item.subjectType === kind && item.subjectId === subject.id && item.dimension === dimension && item.requirement === requirement);
      const result=assessCells(root,kind,subject,dimension,requirement,matches,evidence,source,candidate);
      const matrix=matrixCells(contract,signature,dimension,requirement,result.scopedProofs);
      if(matrix)configurationCoverage.push(matrix);
      if (result.status==='PROVEN' && matrix && matrix.status!=='PROVEN') return {requirement,...result,status:matrix.status,reason:matrix.reason};
      return {requirement,...result};
    });
    const statuses = new Set(records.map(row => row.status));
    for (const matrix of configurationCoverage) statuses.add(matrix.status);
    let status = 'PROVEN';
    for (const value of ['FAILED','BLOCKED','STALE','NOT_TESTED']) if (statuses.has(value)) { status = value; break; }
    if (signature.status !== 'DECLARED') status = signature.status === 'BLOCKED' ? 'BLOCKED' : 'NOT_TESTED';
    return {id:dimension,applicable:true,status,requirementCount:records.length,provenCount:records.filter(row=>row.status==='PROVEN').length,
      ...(configurationCoverage.length ? {configurationCoverage} : {}),
      ...(records.some(row=>row.integrity==='VALID') ? {reason:records.find(row=>row.integrity==='VALID').reason} : {}),
      ...(records.some(row=>row.scopedProofs.length) ? {scopedProofs:records.flatMap(row=>row.scopedProofs)} : {})};
  });
}

module.exports={requirements,dimensionRows,evidenceStatus,DIMENSION_ORDER};
