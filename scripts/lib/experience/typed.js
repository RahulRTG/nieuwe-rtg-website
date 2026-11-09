/* Gesloten getypeerde adapters voor de bestaande executor. Deze module kan
   configuraties/waarnemingen controleren, maar maakt geen procesreceipts. */
'use strict';
const {stable,same}=require('./artifact');
const {sha}=require('./evidence');
const configurations=require('./configurations');
const canonical=value=>JSON.stringify(stable(value));
const fixed=configuration=>{const {browserVersion,...rest}=configuration;return rest;};
const cellKey=b=>canonical([b.instrument,b.subjectType,b.subjectId,b.dimension,b.requirement,b.configuration]);
function signatureInventory(signatures,b) {
  if(b.proof!=='experience-signatures'||b.instrument!=='test/experience-signatures.proof.test.js'||
    b.type!=='experience-signature-inventory-v1'||b.method!=='contract'||
    b.scope!=='all-current-experience-signatures'||b.check!=='Experience signature contract'||
    !same(Object.keys(b).sort(),['check','instrument','method','proof','scope','type'])) {
    throw new Error('Onbekend Experience-signatureproducercontract');
  }
  const rows=[];
  for(const [subjectType,values] of [['app',signatures.apps],['screen',signatures.screens]]) {
    if(!values||typeof values!=='object'||Array.isArray(values)) throw new Error('Experience-signatureinventaris ontbreekt');
    for(const [key,value] of Object.entries(values).sort(([a],[z])=>a.localeCompare(z))) {
      const subjectId=subjectType==='app'?key:'screen:'+key;
      rows.push({...b,subjectType,subjectId,dimension:'identity',requirement:'signature',
        scope:'signature:'+subjectId,check:'Experience signature contract: '+subjectId,
        configuration:{kind:'experience-signature',subjectType,subjectId},
        expected:{declared:true,signatureHash:sha(canonical(value))},matrixCell:null});
    }
  }
  return rows;
}
function bindings(contract,signatures,proof) {
  const selected=(contract.executedProofs||[]).filter(b=>b.proof===proof.id),expanded=[];
  for(const b of selected) {
    if(b.type==='experience-signature-inventory-v1') {
      expanded.push(...signatureInventory(signatures,b));
      continue;
    }
    const name=b.subjectId==='screen:/apps/hotels.html'?'hotels':b.subjectId==='screen:/apps/juridisch.html'?'juridisch':null;
    if(!name||b.instrument!=='test/'+name+'-ds.e2e.js'||b.instrument!==proof.test||b.subjectType!=='screen'||proof.id!==name+'-destination'||
      b.dimension!=='continuity'||b.requirement!=='destination'||b.method!=='browser'||!contract.continuityChecks.includes(b.requirement)) throw new Error('Onbekend getypeerd Experience-contract');
    if(b.type===undefined) {
      if(name!=='hotels'||b.scope!=='hotels-member-normal-chromium-390x844'||b.check!=='Hotels destination: aangemeld lid bereikt de Travel-collectie'||
        !same(b.configuration,{browser:'chromium',viewport:{width:390,height:844},deviceScaleFactor:1,touch:false,
          reducedMotion:true,locale:'nl-NL',serviceWorkers:'block',persona:'rtg-member',state:'normal',network:'local-test-server'})) throw new Error('Onbekend getypeerd Experience-contract');
      expanded.push({...b,matrixCell:null});continue;
    }
    const legal=name==='juridisch';
    if(b.type!==(legal?'juridisch-public-normal-destination-v1':'hotels-normal-destination-v1')||b.devices!=='all'||
      b.scope!==(legal?'juridisch-public-normal-chromium':'hotels-member-normal-chromium')||
      b.check!==(legal?'Juridisch destination normal':'Hotels destination normal')||!same(b.configuration,{state:'normal',network:'normal',persona:legal?'anonymous':'rtg-member',
        reducedMotion:true,locale:'nl-NL',serviceWorkers:'block'})) throw new Error('Onbekende getypeerde configuratiegroep');
    const signature=signatures.screens?.['/apps/'+name+'.html'];
    if(!signature) throw new Error('Matrixproducer mist signature');
    const plan=configurations.required(contract,{value:signature},b.dimension,b.requirement);
    if(plan.status==='BLOCKED') throw new Error('Matrixconfiguratie geblokkeerd: '+plan.blockers.join(','));
    for(const device of plan.devices) {
      const configuration={...plan.deviceConfigurations[device],...b.configuration,device};
      if(configuration.browser!=='chromium') throw new Error('Dit instrument voert alleen Chromium uit');
      const match=configurations.match(plan,{...configuration,browserVersion:'0.0'});
      if(match.status==='BLOCKED') throw new Error(match.reason);
      expanded.push({...b,scope:b.scope+'-'+device,check:b.check+': '+device,configuration,matrixCell:match.cell});
    }
  }
  if(new Set(expanded.map(cellKey)).size!==expanded.length || new Set(expanded.map(b=>b.scope)).size!==expanded.length) throw new Error('Dubbele Experience-producercel');
  return expanded;
}
function diagnostics(log,prefix) {
  return log.split(/\r?\n/).filter(line=>line.startsWith('# '+prefix+' ')).map(line=>JSON.parse(line.slice(prefix.length+3)));
}
function required(contract,signatures,proofs) {
  const declared=contract.executedProofs || [];
  if(!Array.isArray(declared)||!Array.isArray(proofs)||new Set(proofs.map(p=>p.id)).size!==proofs.length) throw new Error('Ongeldige Experience-proefbindingen');
  if(declared.some(b=>!b||proofs.filter(p=>p.id===b.proof).length!==1)) throw new Error('Getypeerd Experience-contract mist bestaande proef');
  return proofs.flatMap(proof=>bindings(contract,signatures,proof));
}
function prepare(contract,signatures,proof,log,sourceHash,commit) {
  const declared=bindings(contract,signatures,proof);
  if(!declared.length)return null;
  const configs=diagnostics(log,'RTG_EXPERIENCE_CONFIGURATION'),observations=diagnostics(log,'RTG_EXPERIENCE_OBSERVATION');
  const passedChecks=new Set(log.split(/\r?\n/).map(line=>/^\s*ok \d+ - (.+)$/.exec(line)?.[1]));
  if(observations.length!==declared.length||new Set(configs.map(canonical)).size!==configs.length) throw new Error('EXACT_OBSERVATION_MISSING');
  const used=new Set(),cells=[];
  for(const b of declared) {
    if(!passedChecks.has(b.check)) throw new Error('TYPED_CHECK_NOT_EXECUTED');
    const choices=configs.filter(c=>c&&typeof c==='object'&&!Array.isArray(c)&&
      same(b.method==='browser'?fixed(c):c,b.configuration));
    if(choices.length!==1||(b.method==='browser'&&
      (typeof choices[0].browserVersion!=='string'||!/^\d+(\.\d+)+$/.test(choices[0].browserVersion)))) throw new Error('TYPED_CONFIGURATION_MISMATCH');
    const configuration=choices[0],configurationHash=sha(canonical(configuration));used.add(configurationHash);
    const binding={subjectType:b.subjectType,subjectId:b.subjectId,dimension:b.dimension,requirement:b.requirement,sourceHash,commit,configurationHash,method:b.method};
    const expected={version:1,instrument:proof.test,...binding,checks:[{id:b.check,observed:b.expected,expected:b.expected,passed:true}],result:'passed'};
    const matching=observations.filter(o=>o&&o.subjectType===b.subjectType&&o.subjectId===b.subjectId&&o.dimension===b.dimension&&o.requirement===b.requirement&&o.configurationHash===configurationHash);
    if(matching.length!==1||!same(matching[0],expected)) throw new Error('TYPED_OBSERVATION_MISMATCH');
    cells.push({binding,configuration,observation:matching[0],scope:{id:b.scope,proof:proof.id,subjectType:b.subjectType,
      subjectId:b.subjectId,dimension:b.dimension,requirement:b.requirement,instrument:proof.test,check:b.check,configuration,matrixCell:b.matrixCell}});
  }
  if(used.size!==configs.length) throw new Error('UNEXPECTED_CONFIGURATION');
  return cells;
}
function covers(scope,binding) {
  if(!scope||!scope.configuration||!binding||
    !['proof','subjectType','subjectId','dimension','requirement','instrument','check'].every(k=>scope[k]===binding[k])||scope.id!==binding.scope) return false;
  if(binding.method==='browser') return typeof scope.configuration.browserVersion==='string'&&
    /^\d+(\.\d+)+$/.test(scope.configuration.browserVersion)&&same(fixed(scope.configuration),binding.configuration);
  if(binding.method==='contract') return same(scope.configuration,binding.configuration);
  return false;
}
module.exports={bindings,required,prepare,covers};
