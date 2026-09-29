/* Contractcontrole is structureel bewijs, nooit bewijs van menselijk begrip. */
'use strict';
const fs = require('node:fs'), path = require('node:path');
const identity = require('../../../public/shared/rtg-world-identity');
const manifests = require('../../../server/kern/experience/manifesten');
const { routesInBron } = require('../routes');
function files(dir) {
  return fs.readdirSync(dir, {recursive:true}).filter(f => /\.(js|html|css|json|yml|yaml)$/.test(f))
    .map(f => path.join(dir,f)).sort();
}
function inventory(root) {
  const paths = files(path.join(root,'public/apps')).filter(f => f.endsWith('.html'))
    .map(f => '/' + path.relative(path.join(root,'public'),f).replace(/\\/g,'/'))
    .filter(route => identity.classify(route) !== 'redirect');
  return paths.map(route => ({id:'screen:'+route,route,world:identity.classify(route),coverage:'NOT_MODELED'}));
}
function compile(root, constitution, journeys) {
  const errors = [], nodes = inventory(root), edges = [], ids = new Set(), proofIds = new Set();
  const routes = files(path.join(root,'server/routes')).filter(f => f.endsWith('.js'));
  const endpoints = new Map();
  for (const f of routes) {
    for (const r of routesInBron(fs.readFileSync(f,'utf8'),path.relative(root,f))) endpoints.set(r.pad,r.bestand);
  }
  function problem(code, subject) { errors.push({code,subject}); }
  function destination(url) {
    return typeof url === 'string' && (endpoints.has(url) || nodes.some(n => n.route === url));
  }
  if (constitution.version !== 1 || !Array.isArray(constitution.rules) || !constitution.rules.length) problem('CONSTITUTION_MISSING','constitution');
  for (const id of ['destination','honest-state','authority','recovery','continuity']) if (!(constitution.rules||[]).some(r=>r.id===id&&r.level==='hard')) problem('HARD_RULE_MISSING',id);
  if (constitution.release?.automaticProductionChanges !== false) problem('AUTONOMOUS_RELEASE','constitution');
  if (!Array.isArray(journeys) || !journeys.length) problem('JOURNEY_MISSING','journeys');
  for (const world of manifests.ids()) nodes.push({id:'world:'+world,type:'world',label:manifests.haal(world).name});
  for (const screen of nodes.filter(n=>n.route)) edges.push({from:screen.id,to:'world:'+screen.world});
  for (const j of journeys || []) {
    if (!j.id || ids.has(j.id)) problem('DUPLICATE_OR_MISSING_ID',j.id); ids.add(j.id);
    if (!j.humanIntent || !j.owner || !j.domainObject || !Number.isInteger(j.version)) problem('DNA_INCOMPLETE',j.id);
    nodes.push({id:'intent:'+j.id,label:j.humanIntent,type:'intent'});
    nodes.push({id:'object:'+j.id,label:j.domainObject,type:'domain-object',owner:j.owner});
    nodes.push({id:'owner:'+j.id,type:'owner',label:j.owner});
    edges.push({from:'object:'+j.id,to:'owner:'+j.id});
    if (!Array.isArray(j.requiredStates)||!['loading','empty','normal','unavailable','changed','offline','uncertain','error'].every(s=>j.requiredStates.includes(s))) problem('REQUIRED_STATES_MISSING',j.id);
    if (!j.effortBudget || !Object.values(j.effortBudget).every(n=>Number.isFinite(n)&&n>=0)) problem('EFFORT_BUDGET_MISSING',j.id);
    if (!j.humanReview || j.humanReview.status !== 'NOT_TESTED') problem('HUMAN_REVIEW_UNVERIFIED',j.id);
    const steps = j.steps || [], stepIds = new Set(steps.map(s=>s.id));
    if (!steps.length || stepIds.size !== steps.length) problem('STEPS_INVALID',j.id);
    for (const s of steps) {
      const at = j.id + ':' + s.id, screen = nodes.find(n=>n.route===s.screen);
      if (!screen) problem('SCREEN_MISSING',at);
      else { screen.coverage='CONTRACT_ONLY'; if (screen.world !== s.world) problem('WORLD_MISMATCH',at); }
      if (!manifests.haal(s.world)) problem('WORLD_UNKNOWN',at);
      if (!s.primaryAction || !destination(s.destination)) problem('ACTION_DESTINATION_MISSING',at);
      if (!s.result) problem('RESULT_MISSING',at);
      if (!s.authority) problem('AUTHORITY_MISSING',at);
      if (!destination(s.recovery)) problem('RECOVERY_MISSING',at);
      for (const state of j.requiredStates || []) if (!(s.states || []).includes(state)) problem('STATE_MISSING',at+':'+state);
      nodes.push({id:'capability:'+at,type:'capability',label:s.capability,authority:s.authority,result:s.result});
      nodes.push({id:'result:'+at,type:'result',label:s.result});
      edges.push({from:'action:'+at,to:'result:'+at});
      nodes.push({id:'action:'+at,type:'action',label:s.primaryAction,destination:s.destination,source:endpoints.get(s.destination)||'public'+s.destination});
      edges.push({from:'intent:'+j.id,to:'capability:'+at},{from:'capability:'+at,to:'screen:'+s.screen},
        {from:'capability:'+at,to:'object:'+j.id},{from:'capability:'+at,to:'action:'+at});
    }
    for (let i=1;i<steps.length;i++) if (!(j.handoffs||[]).some(h=>h.from===steps[i-1].id&&h.to===steps[i].id)) problem('HANDOFF_MISSING',j.id+':'+steps[i].id);
    for (const h of j.handoffs || []) {
      if (!stepIds.has(h.from)||!stepIds.has(h.to)||!destination(h.returnTo)||!Array.isArray(h.carry)||!h.exclude?.length||!h.revalidate?.length) problem('HANDOFF_INVALID',j.id);
      if ((h.carry||[]).some(k=>/credentials|authority|token/i.test(k))) problem('AUTHORITY_TRANSFER',j.id);
    }
    if (!j.proofs?.length) problem('PROOF_MISSING',j.id);
    for (const p of j.proofs || []) {
      if (!/^[a-z][a-z0-9-]*$/.test(p.id)||proofIds.has(p.id)||!['OPERATIONAL','EXPERIENCE','RESILIENCE'].includes(p.layer)||!p.scope) problem('PROOF_INVALID',p.id);
      proofIds.add(p.id);
      if (!/^test\/[\w.-]+\.js$/.test(p.test)||!fs.existsSync(path.join(root,p.test))) problem('TEST_MISSING',p.id);
      nodes.push({id:'proof:'+j.id+':'+p.id,type:'proof',test:p.test,scope:p.scope});
      edges.push({from:'intent:'+j.id,to:'proof:'+j.id+':'+p.id});
    }
  }
  // Gedeelde proeven worden eenmaal uitgevoerd; elke afhankelijke reis noemt
  // ze expliciet. Een typefout mag geen stil ontbrekend bewijs worden.
  for (const j of journeys || []) {
    for (const id of j.proofRefs || []) {
      const owner = journeys.find(other => (other.proofs || []).some(p => p.id === id));
      if (!owner) problem('SHARED_PROOF_MISSING',j.id+':'+id);
      else edges.push({from:'intent:'+j.id,to:'proof:'+owner.id+':'+id});
    }
  }
  return {valid:!errors.length,errors,nodes,edges,worlds:manifests.publiek(),journeys};
}
module.exports = {compile,inventory,files};
